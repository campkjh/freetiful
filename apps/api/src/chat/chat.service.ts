import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ImageService } from '../image/image.service';
import { PuddingService } from '../pudding/pudding.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CreateChatRoomDto,
  CreateRoomAsProDto,
  SendMessageDto,
  EditMessageDto,
  ReactToMessageDto,
  CreateScheduledMessageDto,
  CreateFrequentMessageDto,
  UpdateFrequentMessageDto,
  ChatRoomQueryDto,
  MessageQueryDto,
  PhotoGalleryQueryDto,
} from './dto/chat.dto';

@Injectable()
export class ChatService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private imageService: ImageService,
    private pudding: PuddingService,
  ) {}

  private roomCache = new Map<string, { data: any; ts: number }>();
  private CACHE_TTL = 3_000; // 채팅/프로필 변경은 빠르게 반영
  private repairCache = new Map<string, number>(); // userId → last repair ts
  private REPAIR_THROTTLE = 30 * 60_000; // 30분 (한 번 repair 후 30분 동안은 skip)
  private participantCache = new Map<string, { ids: string[]; ts: number }>();
  private PARTICIPANT_CACHE_TTL = 10 * 60_000;

  onModuleInit() {
    this.ensurePerformanceIndexes().catch(() => undefined);
    this.ensureRoomMembersBackfilled().catch(() => undefined);
  }

  private async ensurePerformanceIndexes() {
    await Promise.allSettled([
      this.prisma.$executeRawUnsafe(
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS "chat_room_members_userId_roomId_idx" ON "chat_room_members" ("userId", "roomId")',
      ),
      this.prisma.$executeRawUnsafe(
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS "messages_senderId_roomId_createdAt_idx" ON "messages" ("senderId", "roomId", "createdAt")',
      ),
      this.prisma.$executeRawUnsafe(
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS "messages_roomId_isDeleted_createdAt_idx" ON "messages" ("roomId", "isDeleted", "createdAt")',
      ),
      this.prisma.$executeRawUnsafe(
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS "chat_rooms_userId_lastMessageAt_idx" ON "chat_rooms" ("userId", "lastMessageAt")',
      ),
      this.prisma.$executeRawUnsafe(
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS "chat_rooms_proProfileId_lastMessageAt_idx" ON "chat_rooms" ("proProfileId", "lastMessageAt")',
      ),
      this.prisma.$executeRawUnsafe(
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS "chat_rooms_matchRequestId_idx" ON "chat_rooms" ("matchRequestId")',
      ),
      this.prisma.$executeRawUnsafe(
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS "messages_senderId_createdAt_roomId_idx" ON "messages" ("senderId", "createdAt", "roomId")',
      ),
      this.prisma.$executeRawUnsafe(
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS "quotations_userId_chatRoomId_idx" ON "quotations" ("userId", "chatRoomId")',
      ),
      this.prisma.$executeRawUnsafe(
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS "quotations_chatRoomId_userId_idx" ON "quotations" ("chatRoomId", "userId")',
      ),
      this.prisma.$executeRawUnsafe(
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS "match_requests_userId_createdAt_idx" ON "match_requests" ("userId", "createdAt")',
      ),
    ]);
  }

  private async ensureRoomMembersBackfilled() {
    await Promise.allSettled([
      this.prisma.$executeRawUnsafe(`
        INSERT INTO "chat_room_members" ("roomId", "userId")
        SELECT cr."id", cr."userId"
        FROM "chat_rooms" cr
        WHERE cr."userId" IS NOT NULL
        ON CONFLICT DO NOTHING
      `),
      this.prisma.$executeRawUnsafe(`
        INSERT INTO "chat_room_members" ("roomId", "userId")
        SELECT cr."id", pp."userId"
        FROM "chat_rooms" cr
        JOIN "pro_profiles" pp ON pp."id" = cr."proProfileId"
        WHERE pp."userId" IS NOT NULL
        ON CONFLICT DO NOTHING
      `),
    ]);
  }

  private getRoomCached(key: string) {
    const hit = this.roomCache.get(key);
    return hit && Date.now() - hit.ts < this.CACHE_TTL ? hit.data : null;
  }

  private setRoomCached(key: string, data: any) {
    // 빈 결과는 캐시하지 않는다 — 일시적 빈 응답이 60초 동안 굳혀져
    // 채팅 리스트가 통째로 안 보이는 현상을 막기 위함.
    const dataArr = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : null;
    if (dataArr && dataArr.length === 0) return;
    this.roomCache.set(key, { data, ts: Date.now() });
    if (this.roomCache.size > 100) {
      const oldest = this.roomCache.keys().next().value;
      if (oldest) this.roomCache.delete(oldest);
    }
  }

  /** 백그라운드에서 repair 실행 — 응답을 막지 않고 다음 요청 때 캐시 invalidate 되도록 */
  private maybeBackgroundRepair(userId: string) {
    Promise.resolve().then(() => this.ensureRoomsRepaired(userId).catch(() => undefined));
  }

  /** 특정 유저의 룸 목록 캐시 무효화 (새 룸 생성/메시지 전송 시 호출) */
  private invalidateRoomsCache(userId: string) {
    this.repairCache.delete(userId);
    this.participantCache.delete(userId);
    for (const key of this.roomCache.keys()) {
      if (key.startsWith(`rooms:${userId}:`) || key.includes(`"userId":"${userId}"`)) {
        this.roomCache.delete(key);
      }
    }
  }

  private async findLegacyChatUserIds(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        authProviders: {
          select: { provider: true, providerUserId: true, providerEmail: true },
        },
      },
    });
    if (!user) return [];

    const identifiers = new Set<string>();
    for (const provider of user.authProviders) {
      if (provider.provider !== 'kakao') continue;
      const providerUserId = provider.providerUserId?.trim();
      if (!providerUserId) continue;
      identifiers.add(`kakao_${providerUserId}`);
      identifiers.add(`kakao_${providerUserId}@kakao.freetiful.com`);
      identifiers.add(`${providerUserId}@kakao.freetiful.com`);
      if (providerUserId.startsWith('kakao_')) {
        identifiers.add(providerUserId);
        identifiers.add(`${providerUserId}@kakao.freetiful.com`);
      }
    }
    for (const value of [user.id, user.email, user.name]) {
      const raw = value?.trim();
      if (!raw) continue;
      const local = raw.split('@')[0];
      if (!local.startsWith('kakao_')) continue;
      identifiers.add(local);
      identifiers.add(`${local}@kakao.freetiful.com`);
      identifiers.add(local.replace(/^kakao_/, ''));
      identifiers.add(`${local.replace(/^kakao_/, '')}@kakao.freetiful.com`);
    }

    const candidates = Array.from(identifiers).filter((value) => value && value !== user.email && value !== user.id);
    if (candidates.length === 0) return [];

    const legacyUsers = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        OR: [
          { id: { in: candidates } },
          { email: { in: candidates } },
          { name: { in: candidates } },
        ],
      },
      select: { id: true },
      take: 20,
    });
    return legacyUsers.map((legacyUser) => legacyUser.id);
  }

  private async getChatParticipantUserIds(userId: string) {
    const cached = this.participantCache.get(userId);
    if (cached && Date.now() - cached.ts < this.PARTICIPANT_CACHE_TTL) return cached.ids;
    const legacyUserIds = await this.findLegacyChatUserIds(userId);
    const ids = Array.from(new Set([userId, ...legacyUserIds].filter(Boolean)));
    this.participantCache.set(userId, { ids, ts: Date.now() });
    return ids;
  }

  private fastChatRoomParticipantWhere(participantUserIds: string[]) {
    return [
      { userId: { in: participantUserIds } },
      { proProfile: { userId: { in: participantUserIds } } },
      { members: { some: { userId: { in: participantUserIds } } } },
    ];
  }

  private chatRoomParticipantWhere(participantUserIds: string[]) {
    return [
      { userId: { in: participantUserIds } },
      { proProfile: { userId: { in: participantUserIds } } },
      { members: { some: { userId: { in: participantUserIds } } } },
      { messages: { some: { senderId: { in: participantUserIds } } } },
      { quotations: { some: { userId: { in: participantUserIds } } } },
      { matchRequest: { is: { userId: { in: participantUserIds } } } },
    ];
  }

  private chatRoomVisibleWhere(participantUserIds: string[]) {
    return {
      OR: [
        { userId: { in: participantUserIds }, userDeletedAt: null },
        { proProfile: { userId: { in: participantUserIds } }, proDeletedAt: null },
        {
          AND: [
            {
              OR: [
                { members: { some: { userId: { in: participantUserIds } } } },
                { messages: { some: { senderId: { in: participantUserIds } } } },
                { quotations: { some: { userId: { in: participantUserIds } } } },
                { matchRequest: { is: { userId: { in: participantUserIds } } } },
              ],
            },
            { userDeletedAt: null },
            { proDeletedAt: null },
          ],
        },
      ],
    };
  }

  private fastChatRoomVisibleWhere(participantUserIds: string[]) {
    return {
      OR: [
        { userId: { in: participantUserIds }, userDeletedAt: null },
        { proProfile: { userId: { in: participantUserIds } }, proDeletedAt: null },
        {
          AND: [
            { members: { some: { userId: { in: participantUserIds } } } },
            { userDeletedAt: null },
            { proDeletedAt: null },
          ],
        },
      ],
    };
  }

  private async getHotChatRoomIds(participantUserIds: string[], take: number) {
    const cap = Math.max(take * 6, 80);
    const [memberRooms, directRooms, messageRooms, quotationRooms, requestRooms] = await Promise.all([
      this.prisma.chatRoomMember.findMany({
        where: { userId: { in: participantUserIds } },
        select: { roomId: true },
        take: cap,
      }),
      this.prisma.chatRoom.findMany({
        where: {
          OR: [
            { userId: { in: participantUserIds } },
            { proProfile: { userId: { in: participantUserIds } } },
          ],
        },
        orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        select: { id: true },
        take: cap,
      }),
      this.prisma.message.findMany({
        where: { senderId: { in: participantUserIds } },
        orderBy: { createdAt: 'desc' },
        distinct: ['roomId'],
        select: { roomId: true },
        take: cap,
      }),
      this.prisma.quotation.findMany({
        where: { userId: { in: participantUserIds }, chatRoomId: { not: null } },
        orderBy: { updatedAt: 'desc' },
        select: { chatRoomId: true },
        take: cap,
      }),
      this.prisma.chatRoom.findMany({
        where: { matchRequest: { is: { userId: { in: participantUserIds } } } },
        orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        select: { id: true },
        take: cap,
      }),
    ]);

    const ids = new Set<string>();
    for (const item of memberRooms) ids.add(item.roomId);
    for (const item of directRooms) ids.add(item.id);
    for (const item of messageRooms) ids.add(item.roomId);
    for (const item of quotationRooms) {
      if (item.chatRoomId) ids.add(item.chatRoomId);
    }
    for (const item of requestRooms) ids.add(item.id);
    return Array.from(ids);
  }

  private async refreshRoomLastVisibleMessage(roomId: string) {
    const latestVisible = await this.prisma.message.findFirst({
      where: { roomId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    });

    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: {
        lastMessageId: latestVisible?.id ?? null,
        lastMessageAt: latestVisible?.createdAt ?? null,
      },
    });
  }

  private async ensureRoomsRepaired(userId: string) {
    const last = this.repairCache.get(userId) || 0;
    if (Date.now() - last <= this.REPAIR_THROTTLE) return;
    this.repairCache.set(userId, Date.now());
    await this.repairRoomsForUser(userId);
    await this.reviveRoomsWithNewerMessagesForUser(userId);
  }

  private async getRoomParticipantUserIds(roomId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: {
        userId: true,
        proProfile: { select: { userId: true } },
        matchRequest: { select: { userId: true } },
        members: { select: { userId: true } },
        quotations: { select: { userId: true } },
      },
    });
    if (!room) return [];

    return Array.from(
      new Set(
        [
          room.userId,
          room.proProfile?.userId,
          room.matchRequest?.userId,
          ...room.members.map((member) => member.userId),
          ...room.quotations.map((quotation) => quotation.userId),
        ].filter(Boolean) as string[],
      ),
    );
  }

  private async mergeLegacyChatData(fromUserId: string, toUserId: string) {
    if (fromUserId === toUserId) return false;

    let changed = false;
    const rooms = await this.prisma.chatRoom.findMany({
      where: {
        OR: [
          ...this.chatRoomParticipantWhere([fromUserId]),
        ],
      },
      select: {
        id: true,
        userId: true,
        proProfile: { select: { userId: true } },
      },
      take: 500,
    });
    if (rooms.length === 0) return false;

    const roomIds = rooms.map((room) => room.id);
    const existingToMembers = await this.prisma.chatRoomMember.findMany({
      where: { userId: toUserId, roomId: { in: roomIds } },
      select: { roomId: true },
    });
    const alreadyIn = new Set(existingToMembers.map((member) => member.roomId));

    await this.prisma.$transaction(async (tx) => {
      if (alreadyIn.size > 0) {
        const deleted = await tx.chatRoomMember.deleteMany({
          where: { userId: fromUserId, roomId: { in: Array.from(alreadyIn) } },
        });
        changed ||= deleted.count > 0;
      }

      const memberUpdate = await tx.chatRoomMember.updateMany({
        where: { userId: fromUserId, roomId: { in: roomIds } },
        data: { userId: toUserId },
      });
      changed ||= memberUpdate.count > 0;

      const roomUpdate = await tx.chatRoom.updateMany({
        where: { userId: fromUserId },
        data: { userId: toUserId, userDeletedAt: null },
      });
      changed ||= roomUpdate.count > 0;

      const messageUpdate = await tx.message.updateMany({
        where: { senderId: fromUserId, roomId: { in: roomIds } },
        data: { senderId: toUserId },
      });
      changed ||= messageUpdate.count > 0;

      await tx.chatRoomMember.createMany({
        data: rooms.flatMap((room) => {
          const memberIds = Array.from(new Set([toUserId, room.proProfile.userId].filter(Boolean)));
          return memberIds.map((memberId) => ({ roomId: room.id, userId: memberId }));
        }),
        skipDuplicates: true,
      });
    });

    for (const room of rooms) {
      this.invalidateRoomsCache(room.userId);
      this.invalidateRoomsCache(room.proProfile.userId);
    }
    this.invalidateRoomsCache(fromUserId);
    this.invalidateRoomsCache(toUserId);
    return changed;
  }

  private async repairRoomsForUser(userId: string) {
    const participantUserIds = await this.getChatParticipantUserIds(userId);
    for (const legacyUserId of participantUserIds.filter((id) => id !== userId)) {
      await this.mergeLegacyChatData(legacyUserId, userId).catch(() => false);
    }

    const rooms = await this.prisma.chatRoom.findMany({
      where: {
        OR: this.chatRoomParticipantWhere(participantUserIds),
      },
      select: {
        id: true,
        userId: true,
        proProfileId: true,
        lastMessageId: true,
        lastMessageAt: true,
        userDeletedAt: true,
        proDeletedAt: true,
        proProfile: { select: { userId: true } },
        matchRequest: { select: { userId: true } },
        quotations: {
          where: { userId: { in: participantUserIds } },
          take: 1,
          select: { userId: true },
        },
        members: { select: { userId: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, senderId: true, createdAt: true },
        },
      },
      take: 500,
    });

    const roomsWithParticipantMessages = rooms.length > 0
      ? new Set((await this.prisma.message.findMany({
          where: {
            roomId: { in: rooms.map((room) => room.id) },
            senderId: { in: participantUserIds },
          },
          select: { roomId: true },
          distinct: ['roomId'],
        })).map((message) => message.roomId))
      : new Set<string>();

    const writes: Promise<unknown>[] = [];
    for (const room of rooms) {
      const hasParticipantMessage = roomsWithParticipantMessages.has(room.id);
      const userSideBelongsToCurrent = participantUserIds.includes(room.userId);
      const proSideBelongsToCurrent = participantUserIds.includes(room.proProfile.userId);
      const requestSideBelongsToCurrent = Boolean(
        (room.matchRequest?.userId && participantUserIds.includes(room.matchRequest.userId)) ||
        room.quotations.some((quotation) => participantUserIds.includes(quotation.userId)),
      );
      const shouldMoveCustomerSideToCurrent =
        userSideBelongsToCurrent ||
        requestSideBelongsToCurrent ||
        (hasParticipantMessage && !proSideBelongsToCurrent);
      const effectiveCustomerUserId = shouldMoveCustomerSideToCurrent ? userId : room.userId;
      const effectiveProUserId = proSideBelongsToCurrent ? userId : room.proProfile.userId;
      const expectedMembers = Array.from(new Set([effectiveCustomerUserId, effectiveProUserId].filter(Boolean)));
      const existingMembers = new Set(room.members.map((member) => member.userId));
      const missingMembers = expectedMembers.filter((memberId) => !existingMembers.has(memberId));
      if (missingMembers.length > 0) {
        writes.push(this.prisma.chatRoomMember.createMany({
          data: missingMembers.map((memberId) => ({ roomId: room.id, userId: memberId })),
          skipDuplicates: true,
        }));
      }

      const latest = room.messages[0];
      if (!latest) continue;

      const updateData: any = {};
      if (shouldMoveCustomerSideToCurrent && room.userId !== userId) {
        updateData.userId = userId;
      }
      if (!room.lastMessageAt || latest.createdAt.getTime() > room.lastMessageAt.getTime()) {
        updateData.lastMessageId = latest.id;
        updateData.lastMessageAt = latest.createdAt;
      }
      if (shouldMoveCustomerSideToCurrent && room.userDeletedAt) {
        updateData.userDeletedAt = null;
      }
      if (proSideBelongsToCurrent && room.proDeletedAt) {
        updateData.proDeletedAt = null;
      }
      if (Object.keys(updateData).length > 0) {
        writes.push(this.prisma.chatRoom.update({
          where: { id: room.id },
          data: updateData,
        }));
      }
    }

    if (writes.length === 0) return;
    await Promise.all(writes);
    for (const room of rooms) {
      this.invalidateRoomsCache(room.userId);
      this.invalidateRoomsCache(room.proProfile.userId);
    }
  }

  private async reviveRoomsWithNewerMessagesForUser(userId: string) {
    const candidates = await this.prisma.chatRoom.findMany({
      where: {
        members: { some: { userId } },
        OR: [
          { userId, userDeletedAt: { not: null } },
          { proProfile: { userId }, proDeletedAt: { not: null } },
        ],
      },
      select: {
        id: true,
        userId: true,
        userDeletedAt: true,
        proDeletedAt: true,
        lastMessageAt: true,
        proProfile: { select: { userId: true } },
      },
      take: 100,
    });

    const updates = candidates
      .map((room) => {
        const lastMessageAt = room.lastMessageAt?.getTime();
        if (!lastMessageAt) return null;
        if (room.userId === userId && room.userDeletedAt && lastMessageAt > room.userDeletedAt.getTime()) {
          return this.prisma.chatRoom.update({
            where: { id: room.id },
            data: { userDeletedAt: null },
          });
        }
        if (room.proProfile.userId === userId && room.proDeletedAt && lastMessageAt > room.proDeletedAt.getTime()) {
          return this.prisma.chatRoom.update({
            where: { id: room.id },
            data: { proDeletedAt: null },
          });
        }
        return null;
      })
      .filter(Boolean) as Promise<unknown>[];

    if (updates.length === 0) return;
    await Promise.all(updates);
    this.invalidateRoomsCache(userId);
  }

  // ─── Chat Rooms ──────────────────────────────────────────────────────────

  async createRoom(userId: string, dto: CreateChatRoomDto) {
    // 자기 자신과 채팅방 만들지 못하게 방어 (프로 본인이 자기 상세페이지를 본 경우)
    const targetPro = await this.prisma.proProfile.findUnique({
      where: { id: dto.proProfileId },
      select: { userId: true },
    });
    if (!targetPro) throw new NotFoundException('전문가를 찾을 수 없습니다');
    if (targetPro.userId === userId) {
      throw new NotFoundException('본인과는 채팅을 시작할 수 없습니다');
    }

    const participantUserIds = await this.getChatParticipantUserIds(userId);

    // 기존 룸 체크 + 필요한 joins을 한 번에 가져옴 (삭제 표시된 방도 재문의 시 복구)
    const existingWithJoins = await this.prisma.chatRoom.findFirst({
      where: {
        proProfileId: dto.proProfileId,
        OR: this.chatRoomParticipantWhere(participantUserIds),
      },
      include: {
        proProfile: {
          include: {
            user: { select: { id: true, name: true, profileImageUrl: true, isActive: true } },
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
        user: { select: { id: true, name: true, profileImageUrl: true } },
        members: { where: { userId } },
        quotations: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } },
      },
    });
    if (existingWithJoins) {
      await this.prisma.chatRoom.update({
        where: { id: existingWithJoins.id },
        data: {
          userId,
          userDeletedAt: null,
          proDeletedAt: null,
        },
      });
      await this.prisma.chatRoomMember.createMany({
        data: [
          { roomId: existingWithJoins.id, userId },
          { roomId: existingWithJoins.id, userId: existingWithJoins.proProfile.userId },
        ],
        skipDuplicates: true,
      });
      this.invalidateRoomsCache(userId);
      this.invalidateRoomsCache(existingWithJoins.proProfile.userId);

      const member = existingWithJoins.members[0];
      const isProUser = existingWithJoins.proProfile.userId === userId;
      const otherUser = isProUser
        ? existingWithJoins.user
        : {
            id: existingWithJoins.proProfile.user.id,
            name: existingWithJoins.proProfile.user.name,
            profileImageUrl:
              existingWithJoins.proProfile.user.profileImageUrl ??
              existingWithJoins.proProfile.images[0]?.imageUrl,
            isActive: existingWithJoins.proProfile.user.isActive,
          };
      return {
        id: existingWithJoins.id,
        otherUser,
        isFavorited: member?.isFavorited ?? false,
        unreadCount: member?.unreadCount ?? 0,
        proProfileId: existingWithJoins.proProfileId,
        iAmPro: isProUser,
        matchRequestId: existingWithJoins.matchRequestId,
        latestQuotationStatus: existingWithJoins.quotations[0]?.status ?? null,
        hasQuoteInquiry: Boolean(existingWithJoins.matchRequestId || existingWithJoins.quotations.length > 0),
        hasConfirmedBooking: ['accepted', 'paid'].includes(existingWithJoins.quotations[0]?.status ?? ''),
      };
    }

    // 신규 룸 생성 - user 정보도 함께 fetch (병렬)
    const [pro, inquiryUser] = await Promise.all([
      this.prisma.proProfile.findUnique({
        where: { id: dto.proProfileId },
        include: {
          user: { select: { id: true, name: true, profileImageUrl: true, isActive: true } },
          images: { where: { isPrimary: true }, take: 1 },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      }),
    ]);
    if (!pro) throw new NotFoundException('전문가를 찾을 수 없습니다');

    const room = await this.prisma.chatRoom.create({
      data: {
        userId,
        proProfileId: dto.proProfileId,
        matchRequestId: dto.matchRequestId,
        members: {
          createMany: {
            data: [
              { userId },
              { userId: pro.userId },
            ],
          },
        },
      },
    });
    const systemMessage = await this.prisma.message.create({
      data: {
        roomId: room.id,
        senderId: userId,
        type: 'system',
        content: '견적 요청으로 대화가 시작되었습니다.',
      },
      select: { id: true, createdAt: true },
    });
    await this.prisma.chatRoom.update({
      where: { id: room.id },
      data: { lastMessageId: systemMessage.id, lastMessageAt: systemMessage.createdAt },
    });

    // 룸 목록 캐시 무효화 (고객 + 전문가 양쪽)
    this.invalidateRoomsCache(userId);
    this.invalidateRoomsCache(pro.userId);

    // 새 문의 알림 → 전문가에게 (fire-and-forget)
    this.notificationService.createNotification(
      pro.userId,
      'chat' as any,
      '새 문의가 도착했습니다 💬',
      `${inquiryUser?.name || '고객'}님이 채팅 문의를 보냈습니다.`,
      { roomId: room.id },
    ).catch(() => {});

    // 새 채팅 도착 푸딩 +50 (pro 입장)
    this.pudding.awardNewChatReceived(room.proProfileId, room.id).catch(() => {});

    // 추가 쿼리 없이 응답 조립 (이미 pro join을 받아놨음)
    return {
      id: room.id,
      otherUser: {
        id: pro.user.id,
        name: pro.user.name,
        profileImageUrl: pro.user.profileImageUrl ?? pro.images[0]?.imageUrl,
        isActive: pro.user.isActive,
      },
      isFavorited: false,
      unreadCount: 0,
      proProfileId: room.proProfileId,
      iAmPro: false, // createRoom 호출자는 항상 고객 측 (proProfile.userId === userId 면 위에서 차단됨)
      matchRequestId: room.matchRequestId,
      latestQuotationStatus: null,
      hasQuoteInquiry: Boolean(room.matchRequestId),
      hasConfirmedBooking: false,
    };
  }

  /** 전문가가 매칭 요청을 받고 먼저 고객에게 채팅을 거는 경우 */
  async createRoomAsPro(proUserId: string, dto: CreateRoomAsProDto) {
    // 호출자의 proProfile 확인
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { userId: proUserId },
      include: {
        user: { select: { id: true, name: true, profileImageUrl: true, isActive: true } },
        images: { where: { isPrimary: true }, take: 1 },
      },
    });
    if (!proProfile) throw new ForbiddenException('전문가 프로필이 없습니다');
    if (proProfile.userId === dto.customerUserId) {
      throw new BadRequestException('본인과는 채팅을 시작할 수 없습니다');
    }

    // matchRequestId가 있으면 해당 요청이 현재 pro에게 전달된 것인지 검증
    if (dto.matchRequestId) {
      const delivery = await this.prisma.matchDelivery.findFirst({
        where: { matchRequestId: dto.matchRequestId, proProfileId: proProfile.id },
      });
      if (!delivery) {
        throw new ForbiddenException('해당 매칭 요청에 대한 권한이 없습니다');
      }
    }

    const customerParticipantUserIds = await this.getChatParticipantUserIds(dto.customerUserId);

    // 기존 룸 확인 (customer ↔ 이 pro)
    const existing = await this.prisma.chatRoom.findFirst({
      where: {
        proProfileId: proProfile.id,
        OR: this.chatRoomParticipantWhere(customerParticipantUserIds),
      },
      include: {
        user: { select: { id: true, name: true, profileImageUrl: true, isActive: true } },
        members: { where: { userId: proUserId } },
        quotations: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } },
      },
    });
    if (existing) {
      await this.prisma.chatRoom.update({
        where: { id: existing.id },
        data: {
          userId: dto.customerUserId,
          userDeletedAt: null,
          proDeletedAt: null,
        },
      });
      await this.prisma.chatRoomMember.createMany({
        data: [
          { roomId: existing.id, userId: dto.customerUserId },
          { roomId: existing.id, userId: proUserId },
        ],
        skipDuplicates: true,
      });
      this.invalidateRoomsCache(dto.customerUserId);
      this.invalidateRoomsCache(proUserId);

      const member = existing.members[0];
      return {
        id: existing.id,
        otherUser: {
          id: existing.user.id,
          name: existing.user.name,
          profileImageUrl: existing.user.profileImageUrl,
          isActive: existing.user.isActive,
        },
        isFavorited: member?.isFavorited ?? false,
        unreadCount: member?.unreadCount ?? 0,
        proProfileId: existing.proProfileId,
        iAmPro: true,
        matchRequestId: existing.matchRequestId,
        latestQuotationStatus: existing.quotations[0]?.status ?? null,
        hasQuoteInquiry: Boolean(existing.matchRequestId || existing.quotations.length > 0),
        hasConfirmedBooking: ['accepted', 'paid'].includes(existing.quotations[0]?.status ?? ''),
      };
    }

    const customer = await this.prisma.user.findUnique({
      where: { id: dto.customerUserId },
      select: { id: true, name: true, profileImageUrl: true, isActive: true },
    });
    if (!customer) throw new NotFoundException('고객을 찾을 수 없습니다');

    const room = await this.prisma.chatRoom.create({
      data: {
        userId: dto.customerUserId,
        proProfileId: proProfile.id,
        matchRequestId: dto.matchRequestId,
        members: {
          createMany: {
            data: [
              { userId: dto.customerUserId },
              { userId: proUserId },
            ],
          },
        },
      },
    });
    const systemMessage = await this.prisma.message.create({
      data: {
        roomId: room.id,
        senderId: proUserId,
        type: 'system',
        content: `${proProfile.user.name || '사회자'}님이 매칭 요청을 보고 먼저 연락드렸습니다.`,
      },
      select: { id: true, createdAt: true },
    });
    await this.prisma.chatRoom.update({
      where: { id: room.id },
      data: { lastMessageId: systemMessage.id, lastMessageAt: systemMessage.createdAt },
    });

    this.invalidateRoomsCache(dto.customerUserId);
    this.invalidateRoomsCache(proUserId);

    // 고객에게 알림
    this.notificationService.createNotification(
      dto.customerUserId,
      'chat' as any,
      '새 채팅이 도착했습니다 💬',
      `${proProfile.user.name || '사회자'}님이 매칭 요청을 보고 먼저 연락드렸습니다.`,
      { roomId: room.id, proProfileId: proProfile.id },
    ).catch(() => {});

    return {
      id: room.id,
      otherUser: {
        id: customer.id,
        name: customer.name,
        profileImageUrl: customer.profileImageUrl,
        isActive: customer.isActive,
      },
      isFavorited: false,
      unreadCount: 0,
      proProfileId: room.proProfileId,
      iAmPro: true,
      matchRequestId: room.matchRequestId,
      latestQuotationStatus: null,
      hasQuoteInquiry: Boolean(room.matchRequestId),
      hasConfirmedBooking: false,
    };
  }

  async getRooms(userId: string, query: ChatRoomQueryDto) {
    const { search, dateFrom, dateTo, page = 1, limit = 20 } = query;
    const take = Math.min(Number(limit) || 20, 50);
    const withTotal = query.withTotal === undefined
      ? true
      : query.withTotal === true || String(query.withTotal).toLowerCase() === 'true';

    const cacheKey = `rooms:${userId}:${JSON.stringify({
      page,
      limit: take,
      search: search || '',
      dateFrom: dateFrom || '',
      dateTo: dateTo || '',
      withTotal,
    })}`;
    // 1) cache fastpath — repair 보다 먼저 확인 (cache hit 시 repair 스킵)
    const cached = this.getRoomCached(cacheKey);
    if (cached) {
      return cached;
    }

    const participantUserIds = await this.getChatParticipantUserIds(userId);

    const hasListFilters = !!(search || dateFrom || dateTo);
    const applyListFilters = (targetWhere: any) => {
      if (dateFrom || dateTo) {
        targetWhere.lastMessageAt = {};
        if (dateFrom) targetWhere.lastMessageAt.gte = new Date(dateFrom);
        if (dateTo) targetWhere.lastMessageAt.lte = new Date(dateTo);
      }

      if (search) {
        targetWhere.AND.push({
          OR: [
            { user: { name: { contains: search, mode: 'insensitive' } } },
            { proProfile: { user: { name: { contains: search, mode: 'insensitive' } } } },
            { messages: { some: { content: { contains: search, mode: 'insensitive' } } } },
          ],
        });
      }
      return targetWhere;
    };

    const where: any = applyListFilters({
      AND: [
        { OR: this.fastChatRoomParticipantWhere(participantUserIds) },
        this.fastChatRoomVisibleWhere(participantUserIds),
      ],
    });

    const roomSelect = {
      id: true,
      userId: true,
      proProfileId: true,
      matchRequestId: true,
      lastMessageAt: true,
      proProfile: {
        select: {
          userId: true,
          user: { select: { id: true, name: true, profileImageUrl: true, isActive: true } },
          images: { where: { isPrimary: true }, take: 1, select: { imageUrl: true } },
          categories: { take: 1, select: { category: { select: { name: true } } } },
        },
      },
      user: { select: { id: true, name: true, profileImageUrl: true } },
      members: { where: { userId: { in: participantUserIds } }, select: { userId: true, isFavorited: true, unreadCount: true } },
      messages: {
        where: { isDeleted: false },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        select: { id: true, senderId: true, type: true, content: true, createdAt: true },
      },
      quotations: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        select: { id: true, amount: true, title: true, status: true, eventDate: true, eventTime: true, eventLocation: true, createdAt: true },
      },
      matchRequest: { select: { id: true, eventDate: true, eventTime: true, eventLocation: true } },
    };

    let rooms: any[] = [];
    let totalCount = 0;

    // 채팅 리스트 첫 화면은 0.5초 안에 보여야 하므로, 관계 OR 전체 탐색보다
    // chat_room_members / 직접 소유 / 최근 메시지로 후보 id를 작게 만든 뒤 상세를 조회한다.
    if (!hasListFilters && page === 1) {
      const hotRoomIds = await this.getHotChatRoomIds(participantUserIds, take);
      if (hotRoomIds.length > 0) {
        rooms = await this.prisma.chatRoom.findMany({
          where: {
            id: { in: hotRoomIds },
            AND: [this.chatRoomVisibleWhere(participantUserIds)],
          },
          select: roomSelect,
          orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
          take,
        });
        totalCount = withTotal ? hotRoomIds.length : rooms.length;
      }
    }

    if (rooms.length === 0) {
      [rooms, totalCount] = await Promise.all([
        this.prisma.chatRoom.findMany({
          where,
          select: roomSelect,
          orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
          skip: (page - 1) * take,
          take,
        }),
        withTotal ? this.prisma.chatRoom.count({ where }) : Promise.resolve(0),
      ]);
    }

    if (rooms.length === 0 && page === 1 && !hasListFilters) {
      this.maybeBackgroundRepair(userId);
    }

    const data = rooms.map((room) => {
      const member = room.members.find((m) => m.userId === userId) ?? room.members[0];
      const lastMsg = room.messages[0];
      const isProUser = participantUserIds.includes(room.proProfile.userId);
      const proCategory = room.proProfile.categories?.[0]?.category?.name;
      const latestQuotationStatus = room.quotations[0]?.status ?? null;
      const lastContent = lastMsg?.content ?? '';
      const hasQuoteInquiry = Boolean(
        room.matchRequestId ||
        latestQuotationStatus ||
        /견적|문의/.test(lastContent),
      );
      const hasConfirmedBooking = Boolean(
        latestQuotationStatus === 'accepted' ||
        latestQuotationStatus === 'paid' ||
        /예약확정|확정|결제 완료|진행/.test(lastContent),
      );
      const otherUser = isProUser
        ? { id: room.user.id, name: room.user.name, profileImageUrl: room.user.profileImageUrl, category: null as string | null }
        : {
            id: room.proProfile.user.id,
            name: room.proProfile.user.name,
            profileImageUrl: room.proProfile.user.profileImageUrl ?? room.proProfile.images[0]?.imageUrl,
            category: proCategory ?? null,
          };

      return {
        id: room.id,
        otherUser,
        lastMessage: lastMsg
          ? { id: lastMsg.id, senderId: lastMsg.senderId, type: lastMsg.type, content: lastMsg.content, createdAt: lastMsg.createdAt }
          : null,
        lastMessageAt: room.lastMessageAt,
        unreadCount: member?.unreadCount ?? 0,
        isFavorited: member?.isFavorited ?? false,
        proProfileId: room.proProfileId,
        iAmPro: isProUser,
        matchRequestId: room.matchRequestId,
        latestQuotationStatus,
        hasQuoteInquiry,
        hasConfirmedBooking,
        // 채팅 디테일 페이지의 스케줄 배너가 prewarm 만으로 즉시 렌더되게 하기 위함.
        matchRequest: (room as any).matchRequest ?? null,
        latestQuotation: room.quotations[0] ?? null,
      };
    });

    const total = withTotal ? totalCount : data.length;
    const result = { data, total, page, limit: take, hasMore: withTotal ? page * take < total : data.length === take };
    this.setRoomCached(cacheKey, result);
    if (data.length === 0 && !search && !dateFrom && !dateTo) {
      this.maybeBackgroundRepair(userId);
    }
    return result;
  }

  async getRoomById(roomId: string, userId: string) {
    this.maybeBackgroundRepair(userId);
    const participantUserIds = await this.getChatParticipantUserIds(userId);
    const room = await this.prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        AND: [
          { OR: this.fastChatRoomParticipantWhere(participantUserIds) },
          this.fastChatRoomVisibleWhere(participantUserIds),
        ],
      },
      include: {
        proProfile: {
          include: {
            user: { select: { id: true, name: true, profileImageUrl: true, isActive: true } },
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
        user: { select: { id: true, name: true, profileImageUrl: true } },
        members: { where: { userId: { in: participantUserIds } } },
        matchRequest: {
          select: {
            id: true,
            type: true,
            eventDate: true,
            eventTime: true,
            eventLocation: true,
            budgetMin: true,
            budgetMax: true,
            status: true,
            rawUserInput: true,
            category: { select: { id: true, name: true } },
            eventCategory: { select: { id: true, name: true } },
          },
        },
        quotations: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, amount: true, title: true, status: true, eventDate: true, eventTime: true, eventLocation: true, createdAt: true } },
      },
    });

    if (!room) throw new NotFoundException('채팅방을 찾을 수 없습니다');

    const member = room.members[0];
    const isProUser = participantUserIds.includes(room.proProfile.userId);
    const otherUser = isProUser
      ? room.user
      : {
          id: room.proProfile.user.id,
          name: room.proProfile.user.name,
          profileImageUrl: room.proProfile.user.profileImageUrl ?? room.proProfile.images[0]?.imageUrl,
          isActive: room.proProfile.user.isActive,
        };

    return {
      id: room.id,
      otherUser,
      isFavorited: member?.isFavorited ?? false,
      unreadCount: member?.unreadCount ?? 0,
      iAmPro: isProUser, // 이 채팅방에서 내가 프로(사회자) 측인지
      proProfileId: room.proProfileId,
      matchRequestId: room.matchRequestId,
      matchRequest: room.matchRequest,
      latestQuotation: room.quotations[0] ?? null,
    };
  }

  async deleteRoom(roomId: string, userId: string) {
    const room = await this.prisma.chatRoom.findFirst({
      where: { id: roomId, members: { some: { userId } } },
      include: {
        proProfile: { select: { userId: true } },
      },
    });
    if (!room) throw new NotFoundException('채팅방을 찾을 수 없습니다');

    // Soft delete only for the requesting user
    if (room.userId === userId) {
      await this.prisma.chatRoom.update({
        where: { id: roomId },
        data: { userDeletedAt: new Date() },
      });
    } else {
      await this.prisma.chatRoom.update({
        where: { id: roomId },
        data: { proDeletedAt: new Date() },
      });
    }
    this.invalidateRoomsCache(room.userId);
    this.invalidateRoomsCache(room.proProfile.userId);
  }

  async toggleFavorite(roomId: string, userId: string) {
    const member = await this.prisma.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!member) throw new NotFoundException('채팅방 멤버를 찾을 수 없습니다');

    const updated = await this.prisma.chatRoomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { isFavorited: !member.isFavorited },
    });

    return { isFavorited: updated.isFavorited };
  }

  // ─── Messages ────────────────────────────────────────────────────────────

  async getMessages(roomId: string, userId: string, query: MessageQueryDto) {
    await this.verifyMembership(roomId, userId);

    const { search, before, after, limit = 50, cursor } = query;

    const where: any = {
      roomId,
      isDeleted: false,
    };

    if (search) {
      where.content = { contains: search, mode: 'insensitive' };
    }
    if (after) {
      where.createdAt = { ...(where.createdAt || {}), gte: new Date(after) };
    }
    if (before) {
      where.createdAt = { ...(where.createdAt || {}), lte: new Date(before) };
    }
    if (cursor) {
      where.createdAt = { ...(where.createdAt || {}), lt: new Date(cursor) };
    }

    const messages = await this.prisma.message.findMany({
      where,
      include: {
        sender: { select: { id: true, name: true, profileImageUrl: true } },
        replyTo: {
          select: { id: true, content: true, senderId: true, type: true },
        },
        reactions: true,
        reads: { select: { userId: true, readAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // 방 목록에는 마지막 메시지가 있는데 상세 첫 로드가 비는 오래된 데이터 꼬임 방어.
    // lastMessageId가 살아있는 정상 메시지라면 최소한 그 메시지는 상세에도 보이게 한다.
    if (
      messages.length === 0 &&
      !search &&
      !before &&
      !after &&
      !cursor
    ) {
      const room = await this.prisma.chatRoom.findUnique({
        where: { id: roomId },
        select: { lastMessageId: true },
      });
      if (room?.lastMessageId) {
        const lastMessage = await this.prisma.message.findFirst({
          where: { id: room.lastMessageId, roomId, isDeleted: false },
          include: {
            sender: { select: { id: true, name: true, profileImageUrl: true } },
            replyTo: {
              select: { id: true, content: true, senderId: true, type: true },
            },
            reactions: true,
            reads: { select: { userId: true, readAt: true } },
          },
        });
        if (lastMessage) messages.push(lastMessage);
      }
    }

    // Group reactions
    const data = messages.reverse().map((msg) => ({
      ...msg,
      reactions: this.groupReactions(msg.reactions),
      isRead: msg.reads.some((r) => r.userId !== msg.senderId),
    }));

    return {
      data,
      hasMore: messages.length === limit,
      cursor: messages.length > 0 ? messages[messages.length - 1].createdAt.toISOString() : null,
    };
  }

  async sendMessage(roomId: string, userId: string, dto: SendMessageDto) {
    await this.verifyMembership(roomId, userId);

    const metadata =
      dto.metadata && typeof dto.metadata === 'object' && !Array.isArray(dto.metadata)
        ? dto.metadata
        : undefined;
    const clientMessageId =
      typeof metadata?.clientMessageId === 'string' ? metadata.clientMessageId : undefined;

    if (clientMessageId) {
      const existing = await this.prisma.message.findFirst({
        where: {
          roomId,
          senderId: userId,
          isDeleted: false,
          metadata: {
            path: ['clientMessageId'],
            equals: clientMessageId,
          } as any,
        },
        include: {
          sender: { select: { id: true, name: true, profileImageUrl: true } },
          replyTo: { select: { id: true, content: true, senderId: true, type: true } },
          reactions: true,
          reads: { select: { userId: true, readAt: true } },
        },
      });
      if (existing) {
        return {
          ...existing,
          reactions: this.groupReactions(existing.reactions),
          isRead: existing.reads.some((r) => r.userId !== existing.senderId),
        };
      }
    }

    // image 타입이고 content 가 base64 data URL 이면 서버에 저장 후 공개 URL 로 대체
    let finalContent = dto.content;
    if (dto.type === 'image' && dto.content && dto.content.startsWith('data:image/')) {
      try {
        const match = dto.content.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
        if (match) {
          const mime = match[1];
          const buffer = Buffer.from(match[2], 'base64');
          const ext = mime.split('/')[1] || 'jpg';
          const fakeFile: any = {
            fieldname: 'file',
            originalname: `chat-${Date.now()}.${ext}`,
            encoding: '7bit',
            mimetype: mime,
            size: buffer.length,
            buffer,
            destination: '',
            filename: '',
            path: '',
            stream: null as any,
          };
          const processed = await this.imageService.processImage(fakeFile, {
            requireFace: false,
            maxWidth: 1600,
            maxHeight: 1600,
            quality: 85,
          });
          finalContent = processed.webpPath || processed.path;
        }
      } catch (e) {
        // 저장 실패해도 content 는 그대로 둠 (클라이언트에서 에러 처리)
      }
    }

    const message = await this.prisma.message.create({
      data: {
        roomId,
        senderId: userId,
        type: dto.type,
        content: finalContent,
        metadata: dto.metadata as any,
        replyToId: dto.replyToId,
        mediaExpiresAt: ['image', 'file'].includes(dto.type)
          ? new Date(Date.now() + 20 * 24 * 60 * 60 * 1000) // 20 days
          : null,
      },
      include: {
        sender: { select: { id: true, name: true, profileImageUrl: true } },
        replyTo: { select: { id: true, content: true, senderId: true, type: true } },
        reads: { select: { userId: true, readAt: true } },
      },
    });

    // Update room last message and revive the room for both sides when a new message arrives.
    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: {
        lastMessageId: message.id,
        lastMessageAt: message.createdAt,
        userDeletedAt: null,
        proDeletedAt: null,
      },
    });

    const participantIds = await this.getRoomParticipantUserIds(roomId);
    const receiverIds = participantIds.filter((participantId) => participantId !== userId);

    if (participantIds.length > 0) {
      await this.prisma.chatRoomMember.createMany({
        data: participantIds.map((participantId) => ({ roomId, userId: participantId })),
        skipDuplicates: true,
      });
    }

    // Increment unread for receivers, including rooms with missing legacy member rows.
    if (receiverIds.length > 0) {
      await this.prisma.chatRoomMember.updateMany({
        where: { roomId, userId: { in: receiverIds } },
        data: { unreadCount: { increment: 1 } },
      });
    }

    // 룸 목록 캐시 무효화 (발신자 + 수신자 모두) + 메시지 알림
    try {
      for (const participantId of participantIds) {
        this.invalidateRoomsCache(participantId);
      }
      const senderName = message.sender?.name || '상대방';
      const preview = (finalContent || '').slice(0, 40);
      for (const receiverId of receiverIds) {
        this.notificationService.createNotification(
          receiverId,
          'chat' as any,
          `${senderName}님의 메시지`,
          preview || '새 메시지가 도착했습니다.',
          { roomId, messageId: message.id },
        ).catch(() => {});
      }
    } catch {}

    // 프로가 고객에게 답변 시 푸딩 +50 (해당 고객에 대해 1회)
    try {
      const room = await this.prisma.chatRoom.findUnique({
        where: { id: roomId },
        select: {
          userId: true,
          proProfileId: true,
          proProfile: { select: { userId: true, id: true } },
        },
      });
      if (room?.proProfile?.userId === userId && room.userId) {
        // 발신자가 이 방의 프로 → 고객에게 보낸 답변
        this.pudding.awardRepliedToCustomer(room.proProfileId, room.userId).catch(() => {});
      }
    } catch {}

    return { ...message, reactions: [], isRead: message.reads.some((r) => r.userId !== message.senderId) };
  }

  async uploadImage(roomId: string, userId: string, file: Express.Multer.File) {
    await this.verifyMembership(roomId, userId);
    if (!file) {
      throw new BadRequestException('이미지 파일이 필요합니다.');
    }

    const processed = await this.imageService.processImage(file, {
      requireFace: false,
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 85,
    });

    return {
      imageUrl: processed.webpPath || processed.path,
      originalUrl: processed.path,
      width: processed.width,
      height: processed.height,
      size: processed.size,
      mimeType: processed.mimeType,
    };
  }

  async getRoomMemberIds(roomId: string) {
    return this.getRoomParticipantUserIds(roomId);
  }

  async editMessage(messageId: string, userId: string, dto: EditMessageDto) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('메시지를 찾을 수 없습니다');
    if (message.senderId !== userId) throw new ForbiddenException('본인 메시지만 수정할 수 있습니다');
    if (message.type !== 'text') throw new BadRequestException('텍스트 메시지만 수정 가능합니다');

    return this.prisma.message.update({
      where: { id: messageId },
      data: { content: dto.content, isEdited: true, editedAt: new Date() },
    });
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('메시지를 찾을 수 없습니다');
    if (message.senderId !== userId) throw new ForbiddenException('본인 메시지만 삭제할 수 있습니다');

    const deleted = await this.prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    await this.refreshRoomLastVisibleMessage(message.roomId);
    const members = await this.prisma.chatRoomMember.findMany({
      where: { roomId: message.roomId },
      select: { userId: true },
    });
    for (const member of members) {
      this.invalidateRoomsCache(member.userId);
    }

    return deleted;
  }

  async addReaction(messageId: string, userId: string, dto: ReactToMessageDto) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('메시지를 찾을 수 없습니다');

    // Toggle: remove if exists, add if not
    const existing = await this.prisma.messageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji: dto.emoji } },
    });

    if (existing) {
      await this.prisma.messageReaction.delete({ where: { id: existing.id } });
      return { action: 'removed', emoji: dto.emoji };
    }

    await this.prisma.messageReaction.create({
      data: { messageId, userId, emoji: dto.emoji },
    });
    return { action: 'added', emoji: dto.emoji };
  }

  async markAsRead(roomId: string, userId: string) {
    await this.verifyMembership(roomId, userId);

    // Reset unread count
    await this.prisma.chatRoomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { unreadCount: 0, lastReadAt: new Date() },
    });

    // Mark all unread messages as read
    const unreadMessages = await this.prisma.message.findMany({
      where: {
        roomId,
        senderId: { not: userId },
        reads: { none: { userId } },
      },
      select: { id: true },
    });

    if (unreadMessages.length > 0) {
      await this.prisma.messageRead.createMany({
        data: unreadMessages.map((m) => ({ messageId: m.id, userId })),
        skipDuplicates: true,
      });
    }

    return { readCount: unreadMessages.length };
  }

  // ─── Photo Gallery ───────────────────────────────────────────────────────

  async getPhotoGallery(roomId: string, userId: string, query: PhotoGalleryQueryDto) {
    await this.verifyMembership(roomId, userId);

    const { page = 1, limit = 30 } = query;

    const [photos, total] = await Promise.all([
      this.prisma.message.findMany({
        where: {
          roomId,
          type: 'image',
          isDeleted: false,
          OR: [
            { mediaExpiresAt: null },
            { mediaExpiresAt: { gt: new Date() } },
          ],
        },
        select: {
          id: true,
          content: true,
          metadata: true,
          createdAt: true,
          mediaExpiresAt: true,
          sender: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.message.count({
        where: {
          roomId,
          type: 'image',
          isDeleted: false,
          OR: [
            { mediaExpiresAt: null },
            { mediaExpiresAt: { gt: new Date() } },
          ],
        },
      }),
    ]);

    return { data: photos, total, page, limit, hasMore: page * limit < total };
  }

  // ─── Scheduled Messages ──────────────────────────────────────────────────

  async createScheduledMessage(roomId: string, userId: string, dto: CreateScheduledMessageDto) {
    await this.verifyMembership(roomId, userId);

    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('예약 시간은 현재 시간 이후여야 합니다');
    }

    return this.prisma.scheduledMessage.create({
      data: {
        roomId,
        senderId: userId,
        type: dto.type,
        content: dto.content,
        metadata: dto.metadata as any,
        scheduledAt,
      },
    });
  }

  async getScheduledMessages(roomId: string, userId: string) {
    await this.verifyMembership(roomId, userId);

    return this.prisma.scheduledMessage.findMany({
      where: { roomId, senderId: userId, isSent: false },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async deleteScheduledMessage(id: string, userId: string) {
    const msg = await this.prisma.scheduledMessage.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException('예약 메시지를 찾을 수 없습니다');
    if (msg.senderId !== userId) throw new ForbiddenException();
    if (msg.isSent) throw new BadRequestException('이미 전송된 메시지입니다');

    await this.prisma.scheduledMessage.delete({ where: { id } });
  }

  // ─── Frequent Messages ───────────────────────────────────────────────────

  async getFrequentMessages(userId: string) {
    return this.prisma.frequentMessage.findMany({
      where: { userId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async createFrequentMessage(userId: string, dto: CreateFrequentMessageDto) {
    return this.prisma.frequentMessage.create({
      data: { userId, content: dto.content, displayOrder: dto.displayOrder ?? 0 },
    });
  }

  async updateFrequentMessage(id: string, userId: string, dto: UpdateFrequentMessageDto) {
    const msg = await this.prisma.frequentMessage.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException();
    if (msg.userId !== userId) throw new ForbiddenException();

    return this.prisma.frequentMessage.update({
      where: { id },
      data: { ...dto },
    });
  }

  async deleteFrequentMessage(id: string, userId: string) {
    const msg = await this.prisma.frequentMessage.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException();
    if (msg.userId !== userId) throw new ForbiddenException();

    await this.prisma.frequentMessage.delete({ where: { id } });
  }

  // ─── Search Messages in Room ─────────────────────────────────────────────

  async searchMessages(roomId: string, userId: string, search: string) {
    await this.verifyMembership(roomId, userId);

    return this.prisma.message.findMany({
      where: {
        roomId,
        isDeleted: false,
        content: { contains: search, mode: 'insensitive' },
      },
      include: {
        sender: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ─── Cron Jobs ───────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledMessages() {
    const due = await this.prisma.scheduledMessage.findMany({
      where: { isSent: false, scheduledAt: { lte: new Date() } },
    });

    for (const sm of due) {
      await this.prisma.$transaction(async (tx) => {
        const message = await tx.message.create({
          data: {
            roomId: sm.roomId,
            senderId: sm.senderId,
            type: sm.type as any,
            content: sm.content,
            metadata: sm.metadata as any,
            mediaExpiresAt: ['image', 'file'].includes(sm.type)
              ? new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)
              : null,
          },
        });

        await tx.chatRoom.update({
          where: { id: sm.roomId },
          data: { lastMessageId: message.id, lastMessageAt: message.createdAt },
        });

        await tx.chatRoomMember.updateMany({
          where: { roomId: sm.roomId, userId: { not: sm.senderId } },
          data: { unreadCount: { increment: 1 } },
        });

        await tx.scheduledMessage.update({
          where: { id: sm.id },
          data: { isSent: true, sentAt: new Date() },
        });
      });
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredMedia() {
    // Delete expired media messages (20 days old)
    await this.prisma.message.updateMany({
      where: {
        type: { in: ['image', 'file'] },
        mediaExpiresAt: { lte: new Date() },
        isDeleted: false,
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        content: '만료된 미디어입니다',
      },
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async verifyMembership(roomId: string, userId: string) {
    const member = await this.prisma.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (member) return member;

    const participantUserIds = await this.getChatParticipantUserIds(userId);
    const room = await this.prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        OR: this.chatRoomParticipantWhere(participantUserIds),
      },
      select: { id: true },
    });
    if (!room) throw new ForbiddenException('채팅방에 접근할 수 없습니다');

    await this.ensureRoomsRepaired(userId).catch(() => undefined);
    await this.prisma.chatRoomMember.createMany({
      data: [{ roomId, userId }],
      skipDuplicates: true,
    });
    const repairedMember = await this.prisma.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!repairedMember) throw new ForbiddenException('채팅방에 접근할 수 없습니다');
    return repairedMember;
  }

  private groupReactions(reactions: { id: string; emoji: string; userId: string }[]) {
    const map = new Map<string, { emoji: string; count: number; userIds: string[] }>();
    for (const r of reactions) {
      const existing = map.get(r.emoji);
      if (existing) {
        existing.count++;
        existing.userIds.push(r.userId);
      } else {
        map.set(r.emoji, { emoji: r.emoji, count: 1, userIds: [r.userId] });
      }
    }
    return Array.from(map.values());
  }
}
