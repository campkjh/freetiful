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
import { VideoCompressService } from '../image/video-compress.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChatRealtimeService } from './chat-realtime.service';
import { AutoReplyService } from '../auto-reply/auto-reply.service';
import {
  CreateChatRoomDto,
  CreateRoomAsProDto,
  SendMessageDto,
  EditMessageDto,
  ReactToMessageDto,
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
    private chatRealtimeService: ChatRealtimeService,
    private videoCompress: VideoCompressService,
    private autoReplyService: AutoReplyService,
  ) {}

  private roomCache = new Map<string, { data: any; ts: number }>();
  private CACHE_TTL = 10_000; // 실시간 이벤트로 갱신하고, 목록 API는 짧게 버퍼링
  private repairCache = new Map<string, number>(); // userId → last repair ts
  private REPAIR_THROTTLE = 30 * 60_000; // 30분 (한 번 repair 후 30분 동안은 skip)
  private participantCache = new Map<string, { ids: string[]; ts: number }>();
  private PARTICIPANT_CACHE_TTL = 10 * 60_000;
  private roomParticipantCache = new Map<string, { ids: string[]; ts: number }>();
  private ROOM_PARTICIPANT_CACHE_TTL = 10 * 60_000;
  private membershipCache = new Map<string, number>();
  private MEMBERSHIP_CACHE_TTL = 5 * 60_000;
  private recentClientMessageCache = new Map<string, { data: any; ts: number }>();
  private RECENT_CLIENT_MESSAGE_TTL = 2 * 60_000;

  onModuleInit() {
    this.ensurePerformanceIndexes().catch(() => undefined);
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
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS "pro_categories_categoryId_proProfileId_idx" ON "pro_categories" ("categoryId", "proProfileId")',
      ),
      this.prisma.$executeRawUnsafe(
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS "match_deliveries_matchRequestId_proProfileId_idx" ON "match_deliveries" ("matchRequestId", "proProfileId")',
      ),
      this.prisma.$executeRawUnsafe(
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS "match_deliveries_proProfileId_status_deliveredAt_idx" ON "match_deliveries" ("proProfileId", "status", "deliveredAt" DESC)',
      ),
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
    this.participantCache.delete(`legacy:${userId}`);
    for (const key of this.roomCache.keys()) {
      if (key.startsWith(`rooms:${userId}:`) || key.includes(`"userId":"${userId}"`)) {
        this.roomCache.delete(key);
      }
    }
  }

  private cacheRoomParticipants(roomId: string, userIds: Array<string | null | undefined>) {
    const ids = Array.from(new Set(userIds.filter(Boolean) as string[]));
    if (ids.length > 0) {
      this.roomParticipantCache.set(roomId, { ids, ts: Date.now() });
      for (const userId of ids) this.cacheMembership(roomId, userId);
    }
    return ids;
  }

  private cacheMembership(roomId: string, userId: string) {
    const key = `${roomId}:${userId}`;
    this.membershipCache.set(key, Date.now());
    if (this.membershipCache.size > 2000) {
      const oldest = this.membershipCache.keys().next().value;
      if (oldest) this.membershipCache.delete(oldest);
    }
  }

  private hasCachedMembership(roomId: string, userId: string) {
    const key = `${roomId}:${userId}`;
    const ts = this.membershipCache.get(key);
    if (!ts) return false;
    if (Date.now() - ts > this.MEMBERSHIP_CACHE_TTL) {
      this.membershipCache.delete(key);
      return false;
    }
    return true;
  }

  private getRecentClientMessage(cacheKey: string) {
    const hit = this.recentClientMessageCache.get(cacheKey);
    if (!hit) return null;
    if (Date.now() - hit.ts > this.RECENT_CLIENT_MESSAGE_TTL) {
      this.recentClientMessageCache.delete(cacheKey);
      return null;
    }
    return hit.data;
  }

  private setRecentClientMessage(cacheKey: string, data: any) {
    this.recentClientMessageCache.set(cacheKey, { data, ts: Date.now() });
    if (this.recentClientMessageCache.size > 500) {
      const oldest = this.recentClientMessageCache.keys().next().value;
      if (oldest) this.recentClientMessageCache.delete(oldest);
    }
  }

  private acceptMatchDeliveryInBackground(
    delivery: { id: string; matchRequestId: string; status: string } | null,
    customerUserId: string,
    proUserId: string,
  ) {
    if (!delivery || !['pending', 'viewed'].includes(delivery.status)) return;
    this.prisma.matchDelivery.updateMany({
      where: { id: delivery.id, status: { in: ['pending', 'viewed'] } },
      data: { status: 'replied', repliedAt: new Date() },
    }).then(() => {
      this.invalidateRoomsCache(customerUserId);
      this.invalidateRoomsCache(proUserId);
      this.chatRealtimeService.emitMatchUpdated([customerUserId, proUserId], {
        kind: 'match-request-accepted',
        matchDeliveryId: delivery.id,
        matchRequestId: delivery.matchRequestId,
      });
    }).catch(() => undefined);
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

  private async getChatParticipantUserIds(userId: string, options: { includeLegacy?: boolean } = {}) {
    const includeLegacy = options.includeLegacy === true;
    const cacheKey = includeLegacy ? `legacy:${userId}` : userId;
    const cached = this.participantCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < this.PARTICIPANT_CACHE_TTL) return cached.ids;

    if (!includeLegacy) {
      const ids = [userId];
      this.participantCache.set(cacheKey, { ids, ts: Date.now() });
      return ids;
    }

    const legacyUserIds = await this.findLegacyChatUserIds(userId);
    const ids = Array.from(new Set([userId, ...legacyUserIds].filter(Boolean)));
    this.participantCache.set(cacheKey, { ids, ts: Date.now() });
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
    const cached = this.roomParticipantCache.get(roomId);
    if (cached && Date.now() - cached.ts < this.ROOM_PARTICIPANT_CACHE_TTL) return cached.ids;

    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: {
        userId: true,
        proProfile: { select: { userId: true } },
        matchRequest: { select: { userId: true } },
        members: { select: { userId: true } },
      },
    });
    if (!room) return [];

    return this.cacheRoomParticipants(roomId, [
      room.userId,
      room.proProfile?.userId,
      room.matchRequest?.userId,
      ...room.members.map((member) => member.userId),
    ]);
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
    const participantUserIds = await this.getChatParticipantUserIds(userId, { includeLegacy: true });
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
        OR: this.fastChatRoomParticipantWhere(participantUserIds),
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
      this.cacheRoomParticipants(existingWithJoins.id, [userId, existingWithJoins.proProfile.userId]);

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
        unreadCount: existingWithJoins.members[0]?.unreadCount ?? 0,
        proProfileId: existingWithJoins.proProfileId,
        iAmPro: isProUser,
        matchRequestId: existingWithJoins.matchRequestId,
        latestQuotationStatus: null,
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

    // 사회자 인사말 자동응답 — 첫 문의에 몇 시간씩 답이 없는 게 이탈의 가장 큰 이유였다.
    // 사회자가 따로 적어 두지 않았으면 기본 문구로 나간다. 실패해도 방 생성은 그대로 진행.
    this.sendGreetingInBackground(room.id, dto.proProfileId, pro.userId, pro.user.name);

    // 룸 목록 캐시 무효화 (고객 + 전문가 양쪽)
    this.invalidateRoomsCache(userId);
    this.invalidateRoomsCache(pro.userId);
    this.cacheRoomParticipants(room.id, [userId, pro.userId]);

    // 새 문의 알림 → 전문가에게 (fire-and-forget)
    // 섭외요청(matchRequest)에서 시작된 견적이면 채팅방이 아니라 새요청 목록으로 보낸다 —
    // 전문가가 요청 내용을 먼저 보고 수락/거절할 수 있어야 한다.
    // 새요청 목록은 matchDelivery 만 렌더하므로(GET /match/pro/requests), matchRequest 가 없는
    // 순수 채팅 문의는 그대로 채팅방으로 보낸다. 안 그러면 빈 목록에 떨어진다.
    this.notificationService.createNotification(
      pro.userId,
      'chat' as any,
      '새 문의가 도착했습니다 💬',
      `${inquiryUser?.name || '고객'}님이 채팅 문의를 보냈습니다.`,
      dto.matchRequestId
        ? { roomId: room.id, matchRequestId: dto.matchRequestId, url: '/pro-dashboard/inquiries' }
        : { roomId: room.id },
    ).catch(() => {});

    // 추가 쿼리 없이 응답 조립 (이미 pro join을 받아놨음)
    return {
      id: room.id,
      otherUser: {
        id: pro.user.id,
        name: pro.user.name,
        profileImageUrl: pro.user.profileImageUrl ?? pro.images[0]?.imageUrl,
        isActive: pro.user.isActive,
      },
      unreadCount: 0,
      proProfileId: room.proProfileId,
      iAmPro: false, // createRoom 호출자는 항상 고객 측 (proProfile.userId === userId 면 위에서 차단됨)
      matchRequestId: room.matchRequestId,
      latestQuotationStatus: null,
    };
  }

  /** 전문가가 매칭 요청을 받고 먼저 고객에게 채팅을 거는 경우 */
  async createRoomAsPro(proUserId: string, dto: CreateRoomAsProDto) {
    // 호출자의 proProfile 확인
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { userId: proUserId },
      select: {
        id: true,
        userId: true,
        user: { select: { id: true, name: true, profileImageUrl: true, isActive: true } },
        images: { where: { isPrimary: true }, take: 1 },
      },
    });
    if (!proProfile) throw new ForbiddenException('전문가 프로필이 없습니다');
    if (proProfile.userId === dto.customerUserId) {
      throw new BadRequestException('본인과는 채팅을 시작할 수 없습니다');
    }

    // 순차 조회 — Supabase 작은 커넥션 풀에서 동시(Promise.all) 쿼리는 풀 고갈→P2024 타임아웃(500) 유발.
    // 딜리버리 select 에 고객 user 까지 포함해 별도 customer 조회(아래)는 제거(왕복 1회 절약, 동시성 증가 없음).
    const deliveryToAccept = (dto.matchDeliveryId || dto.matchRequestId)
      ? await this.prisma.matchDelivery.findFirst({
          where: {
            ...(dto.matchDeliveryId ? { id: dto.matchDeliveryId } : {}),
            ...(dto.matchRequestId ? { matchRequestId: dto.matchRequestId } : {}),
            proProfileId: proProfile.id,
          },
          select: {
            id: true,
            matchRequestId: true,
            status: true,
            matchRequest: {
              select: {
                userId: true,
                user: { select: { id: true, name: true, profileImageUrl: true, isActive: true } },
              },
            },
          },
        })
      : null;
    if (dto.matchDeliveryId || dto.matchRequestId) {
      if (!deliveryToAccept) {
        throw new ForbiddenException('해당 매칭 요청에 대한 권한이 없습니다');
      }
      if (deliveryToAccept.matchRequest.userId !== dto.customerUserId) {
        throw new ForbiddenException('요청 고객 정보가 일치하지 않습니다');
      }
    }
    const effectiveMatchRequestId = dto.matchRequestId ?? deliveryToAccept?.matchRequestId;

    const customerParticipantUserIds = await this.getChatParticipantUserIds(dto.customerUserId);
    const existing = await this.prisma.chatRoom.findFirst({
      where: {
        proProfileId: proProfile.id,
        OR: this.fastChatRoomParticipantWhere(customerParticipantUserIds),
      },
      include: {
        user: { select: { id: true, name: true, profileImageUrl: true, isActive: true } },
        members: { where: { userId: proUserId } },
      },
    });
    if (existing) {
      await this.prisma.chatRoom.update({
        where: { id: existing.id },
        data: {
          userId: dto.customerUserId,
          userDeletedAt: null,
          proDeletedAt: null,
          ...(effectiveMatchRequestId ? { matchRequestId: effectiveMatchRequestId } : {}),
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
      this.cacheRoomParticipants(existing.id, [dto.customerUserId, proUserId]);
      this.acceptMatchDeliveryInBackground(deliveryToAccept, dto.customerUserId, proUserId);

      return {
        id: existing.id,
        otherUser: {
          id: existing.user.id,
          name: existing.user.name,
          profileImageUrl: existing.user.profileImageUrl,
          isActive: existing.user.isActive,
        },
        unreadCount: existing.members[0]?.unreadCount ?? 0,
        proProfileId: existing.proProfileId,
        iAmPro: true,
        matchRequestId: effectiveMatchRequestId ?? existing.matchRequestId,
        latestQuotationStatus: null,
      };
    }

    // 딜리버리에서 이미 고객 정보를 받았으면 재사용(왕복 1회 절약), 없으면 조회
    const customer = deliveryToAccept?.matchRequest?.user
      ?? await this.prisma.user.findUnique({
        where: { id: dto.customerUserId },
        select: { id: true, name: true, profileImageUrl: true, isActive: true },
      });
    if (!customer) throw new NotFoundException('고객을 찾을 수 없습니다');

    const room = await this.prisma.chatRoom.create({
      data: {
        userId: dto.customerUserId,
        proProfileId: proProfile.id,
        matchRequestId: effectiveMatchRequestId,
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
    this.cacheRoomParticipants(room.id, [dto.customerUserId, proUserId]);
    this.acceptMatchDeliveryInBackground(deliveryToAccept, dto.customerUserId, proUserId);

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
      unreadCount: 0,
      proProfileId: room.proProfileId,
      iAmPro: true,
      matchRequestId: room.matchRequestId,
      latestQuotationStatus: null,
    };
  }

  async getRooms(userId: string, query: ChatRoomQueryDto) {
    const { dateFrom, dateTo, page = 1, limit = 20 } = query;
    const take = Math.min(Number(limit) || 20, 50);
    const withTotal = query.withTotal === undefined
      ? true
      : query.withTotal === true || String(query.withTotal).toLowerCase() === 'true';

    const cacheKey = `rooms:${userId}:${JSON.stringify({
      page,
      limit: take,
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

    const memberWhere: any = {
      AND: [
        { members: { some: { userId: { in: participantUserIds } } } },
        this.fastChatRoomVisibleWhere(participantUserIds),
      ],
    };

    const legacyWhere: any = {
      AND: [
        { OR: this.fastChatRoomParticipantWhere(participantUserIds) },
        this.fastChatRoomVisibleWhere(participantUserIds),
      ],
    };

    if (dateFrom || dateTo) {
      memberWhere.lastMessageAt = {};
      legacyWhere.lastMessageAt = {};
      if (dateFrom) {
        memberWhere.lastMessageAt.gte = new Date(dateFrom);
        legacyWhere.lastMessageAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        memberWhere.lastMessageAt.lte = new Date(dateTo);
        legacyWhere.lastMessageAt.lte = new Date(dateTo);
      }
    }

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
      members: { where: { userId: { in: participantUserIds } }, select: { userId: true, unreadCount: true } },
      messages: {
        where: { isDeleted: false },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        select: { id: true, senderId: true, type: true, content: true, createdAt: true },
      },
    };

    const loadRooms = (where: any) => Promise.all([
      this.prisma.chatRoom.findMany({
        where,
        select: roomSelect,
        orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        skip: (page - 1) * take,
        take,
      }),
      withTotal ? this.prisma.chatRoom.count({ where }) : Promise.resolve(0),
    ]);

    let [rooms, totalCount] = await loadRooms(memberWhere);
    if (rooms.length === 0 && !dateFrom && !dateTo) {
      [rooms, totalCount] = await loadRooms(legacyWhere);
    }

    const data = rooms.map((room) => {
      const member = room.members.find((m) => m.userId === userId) ?? room.members[0];
      const lastMsg = room.messages[0];
      const isProUser = participantUserIds.includes(room.proProfile.userId);
      const proCategory = room.proProfile.categories?.[0]?.category?.name;
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
        proProfileId: room.proProfileId,
        iAmPro: isProUser,
        matchRequestId: room.matchRequestId,
        latestQuotationStatus: null,
      };
    });

    const total = withTotal ? totalCount : data.length;
    const result = { data, total, page, limit: take, hasMore: withTotal ? page * take < total : data.length === take };
    this.setRoomCached(cacheKey, result);
    if (data.length === 0 && !dateFrom && !dateTo) {
      this.maybeBackgroundRepair(userId);
    }
    return result;
  }

  async getRoomById(roomId: string, userId: string) {
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
            status: true,
            eventDate: true,
            eventTime: true,
            eventLocation: true,
            rawUserInput: true,
            category: { select: { id: true, name: true } },
            eventCategory: { select: { id: true, name: true } },
          },
        },
        quotations: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, amount: true, title: true, status: true, createdAt: true } },
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
    this.roomParticipantCache.delete(roomId);
    for (const key of this.membershipCache.keys()) {
      if (key.startsWith(`${roomId}:`)) this.membershipCache.delete(key);
    }
  }

  // ─── Messages ────────────────────────────────────────────────────────────

  async getMessages(roomId: string, userId: string, query: MessageQueryDto) {
    await this.verifyMembership(roomId, userId);

    const { before, after, limit = 30, cursor } = query;
    const take = Math.min(Number(limit) || 30, 80);

    const where: any = {
      roomId,
      isDeleted: false,
    };

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
        reactions: { select: { emoji: true, userId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    // 방 목록에는 마지막 메시지가 있는데 상세 첫 로드가 비는 오래된 데이터 꼬임 방어.
    // lastMessageId가 살아있는 정상 메시지라면 최소한 그 메시지는 상세에도 보이게 한다.
    if (
      messages.length === 0 &&
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
            reactions: { select: { emoji: true, userId: true } },
          },
        });
        if (lastMessage) messages.push(lastMessage);
      }
    }

    // 메시지별 reaction 로딩 — 현재 유저의 reaction 을 [0] 으로(웹/네이티브가 reactions[0].emoji 사용).
    // 기존엔 [] 하드코딩이라 채팅 재진입 시 공감이 사라졌음.
    const orderedMessages = messages.reverse();
    const data = orderedMessages.map((msg) => ({
      ...msg,
      reactions: (((msg as any).reactions as Array<{ emoji: string; userId: string }>) || [])
        .slice()
        .sort((a, b) => (b.userId === userId ? 1 : 0) - (a.userId === userId ? 1 : 0)),
      isRead: false,
    }));

    return {
      data,
      hasMore: messages.length === take,
      cursor: orderedMessages.length > 0 ? orderedMessages[0].createdAt.toISOString() : null,
    };
  }

  /**
   * 고객이 보낸 말에 사회자 자동응답을 대신 내보낸다(백그라운드).
   *
   * 사람이 붙어 있으면 끼어들지 않는다 — 사회자가 최근 3분 안에 직접 보낸 게 있으면 건너뛴다.
   * 같은 답을 반복하지 않도록 방마다 항목당 1회, 전체 6회까지만.
   */
  private maybeAutoRespondInBackground(roomId: string, senderId: string, content?: string | null) {
    const text = (content || '').trim();
    if (!text) return;
    void (async () => {
      try {
        const room = await this.prisma.chatRoom.findUnique({
          where: { id: roomId },
          select: {
            id: true,
            userId: true,
            proProfileId: true,
            matchRequest: { select: { eventDate: true, eventTime: true, eventLocation: true, eventCategory: { select: { name: true } } } },
            proProfile: { select: { userId: true, user: { select: { profileImageUrl: true } } } },
            user: { select: { name: true } },
          },
        });
        if (!room || room.userId !== senderId) return;
        const proUserId = room.proProfile?.userId;
        if (!proUserId) return;

        // 사회자가 직접 대화 중이면 끼어들지 않는다(자동응답으로 나간 건 사람이 아니다)
        const recentHuman = await this.prisma.message.findFirst({
          where: {
            roomId,
            senderId: proUserId,
            createdAt: { gte: new Date(Date.now() - 3 * 60_000) },
            NOT: { metadata: { path: ['autoReply'], equals: true } },
          },
          select: { id: true },
        });
        if (recentHuman) return;

        const sentAuto = await this.prisma.message.findMany({
          where: { roomId, senderId: proUserId, metadata: { path: ['autoReply'], equals: true } },
          select: { metadata: true },
          take: 20,
        });
        if (sentAuto.length >= 6) return;
        const usedIds = new Set(
          sentAuto.map((row) => (row.metadata as any)?.autoReplyId).filter(Boolean),
        );

        const match = await this.autoReplyService.matchFor(room.proProfileId, text, room.user?.name);
        if (!match || usedIds.has(match.id)) return;

        const replied = await this.sendMessage(roomId, proUserId, {
          type: 'text' as any,
          content: match.answer,
          metadata: { autoReply: true, autoReplyId: match.id },
        } as any);
        const memberIds = await this.getRoomMemberIds(roomId);
        await this.chatRealtimeService.emitPersistedMessage(roomId, (replied as any).id, {
          notifyUserIds: memberIds,
          roomUpdatedUserIds: memberIds,
          unreadUserIds: memberIds.filter((id) => id !== proUserId),
          dashboardUserIds: memberIds,
        });

        // 견적 자동응답에 금액이 적혀 있으면 견적서까지 자동으로 보낸다
        if (match.kind === 'quote' && match.amount && match.amount > 0) {
          const already = await this.prisma.quotation.findFirst({
            where: { chatRoomId: roomId, proProfileId: room.proProfileId },
            select: { id: true },
          });
          if (already) return;
          const eventName = room.matchRequest?.eventCategory?.name
            ? `${room.user?.name || '고객'}님의 ${room.matchRequest.eventCategory.name}`
            : '행사 진행';
          const quotation = await this.prisma.quotation.create({
            data: {
              proProfileId: room.proProfileId,
              userId: room.userId,
              amount: match.amount,
              title: eventName,
              description: '자동응답으로 발송된 견적서입니다.',
              eventDate: room.matchRequest?.eventDate ?? undefined,
              eventTime: room.matchRequest?.eventTime ?? undefined,
              eventLocation: room.matchRequest?.eventLocation ?? undefined,
              chatRoomId: roomId,
            },
            select: { id: true },
          });
          const quoteMessage = await this.sendMessage(roomId, proUserId, {
            type: 'system' as any,
            content: '견적서 발송',
            metadata: {
              autoReply: true,
              autoReplyId: `${match.id}:quote`,
              system: {
                kind: 'quote',
                eventName,
                amount: match.amount,
                quotationId: quotation.id,
                eventDate: room.matchRequest?.eventDate ?? undefined,
                eventLocation: room.matchRequest?.eventLocation ?? undefined,
                proImage: room.proProfile?.user?.profileImageUrl ?? undefined,
              },
            },
          } as any);
          await this.chatRealtimeService.emitPersistedMessage(roomId, (quoteMessage as any).id, {
            notifyUserIds: memberIds,
            roomUpdatedUserIds: memberIds,
            unreadUserIds: memberIds.filter((id) => id !== proUserId),
            dashboardUserIds: memberIds,
          });
          this.notificationService.createNotification(
            room.userId,
            'system' as any,
            '견적서가 도착했습니다',
            `${match.amount.toLocaleString()}원 견적서가 도착했습니다.`,
            { quotationId: quotation.id, roomId },
          ).catch(() => {});
        }
      } catch (error) {
        console.warn(`자동응답 실패 room=${roomId}: ${error}`);
      }
    })();
  }

  /** 방이 열리자마자 사회자 인사말을 대신 내보낸다(백그라운드) */
  private sendGreetingInBackground(
    roomId: string,
    proProfileId: string,
    proUserId: string,
    proName?: string | null,
  ) {
    void (async () => {
      try {
        const greeting = await this.autoReplyService.greetingFor(proProfileId, proName);
        if (!greeting) return;
        const message = await this.sendMessage(roomId, proUserId, {
          type: 'text' as any,
          content: greeting,
          metadata: { autoReply: true },
        } as any);
        const memberIds = await this.getRoomMemberIds(roomId);
        await this.chatRealtimeService.emitPersistedMessage(roomId, message.id, {
          notifyUserIds: memberIds,
          roomUpdatedUserIds: memberIds,
          unreadUserIds: memberIds.filter((id) => id !== proUserId),
          dashboardUserIds: memberIds,
        });
      } catch (error) {
        console.warn(`인사말 자동응답 실패 room=${roomId}: ${error}`);
      }
    })();
  }

  /**
   * 고객이 추천 질문을 누르면 — 질문은 고객 이름으로, 답변은 사회자 이름으로 남긴다.
   * 답변에 autoReply 표시를 달아 화면에서 '자동응답 메시지' 로 구분한다.
   */
  async sendAutoReply(roomId: string, userId: string, itemId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: { id: true, userId: true, proProfileId: true, proProfile: { select: { userId: true } } },
    });
    if (!room) throw new NotFoundException('채팅방을 찾을 수 없습니다');
    if (room.userId !== userId) throw new ForbiddenException('고객만 사용할 수 있습니다');
    const proUserId = room.proProfile?.userId;
    if (!proUserId) throw new NotFoundException('사회자를 찾을 수 없습니다');

    const { question, answer } = await this.autoReplyService.answerOf(room.proProfileId, itemId);

    const asked = await this.sendMessage(roomId, userId, {
      type: 'text' as any,
      content: question,
    } as any);
    const replied = await this.sendMessage(roomId, proUserId, {
      type: 'text' as any,
      content: answer,
      metadata: { autoReply: true },
    } as any);

    const memberIds = await this.getRoomMemberIds(roomId);
    for (const [message, senderId] of [[asked, userId], [replied, proUserId]] as const) {
      await this.chatRealtimeService.emitPersistedMessage(roomId, (message as any).id, {
        notifyUserIds: memberIds,
        roomUpdatedUserIds: memberIds,
        unreadUserIds: memberIds.filter((id) => id !== senderId),
        dashboardUserIds: memberIds,
      });
    }
    return { asked, replied };
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
      const cached = this.getRecentClientMessage(`${roomId}:${userId}:${clientMessageId}`);
      if (cached) return cached;
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
        // processImage 실패(미지원 포맷 등) → 원본을 DB 에 저장해 /uploads/:id 로라도 서빙
        try {
          const m2 = dto.content.match(/^data:([^;]+);base64,(.+)$/i);
          if (m2) {
            const raw = Buffer.from(m2[2], 'base64');
            finalContent = await this.imageService.saveRawMedia(raw, m2[1]);
            this.queueVideoCompress(finalContent, m2[1], raw.length);
          } else throw e;
        } catch {
          // 거대한 base64 를 content 로 흘리면(렌더 안 됨/DB·실시간 부하) 차라리 전송 실패 →
          // 클라이언트가 버블을 '전송 실패·재시도'로 유지(사진 사라짐 대신).
          throw new BadRequestException('이미지 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
        }
      }
    }

    // video / file 타입 base64 data URL → 이미지 변환 없이 원본 저장 후 공개 URL 로 대체
    if (
      (dto.type === 'video' || dto.type === 'file') &&
      dto.content &&
      dto.content.startsWith('data:')
    ) {
      try {
        const match = dto.content.match(/^data:([^;]+);base64,(.+)$/i);
        if (match) {
          const mime = match[1];
          const buffer = Buffer.from(match[2], 'base64');
          const originalName = (dto as any)?.metadata?.fileName as string | undefined;
          finalContent = await this.imageService.saveRawMedia(buffer, mime, originalName);
          // iOS 네이티브는 영상을 base64 로 보내 이 경로를 탄다 — 멀티파트(uploadMedia)와 동일하게 압축
          this.queueVideoCompress(finalContent, mime, buffer.length);
        }
      } catch (e) {
        // 저장 실패 시 거대한 base64 를 그대로 DB/실시간에 흘리지 않도록 전송 자체를 실패시킴
        throw new BadRequestException('미디어 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    }

    // [임시 진단] 채팅 미디어 전송 디버깅 (추후 제거)
    console.log(`[sendMessage] user=${userId.slice(0,8)} room=${roomId.slice(0,8)} type=${dto.type} inLen=${(dto.content || '').length} out=${(finalContent || '').slice(0, 48)}`);
    const participantIdsPromise = this.getRoomParticipantUserIds(roomId);
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
      },
    });

    const participantIds = await participantIdsPromise;
    const receiverIds = participantIds.filter((participantId) => participantId !== userId);

    Promise.all([
      this.prisma.chatRoom.update({
        where: { id: roomId },
        data: {
          lastMessageId: message.id,
          lastMessageAt: message.createdAt,
          userDeletedAt: null,
          proDeletedAt: null,
        },
      }),
      participantIds.length > 0
        ? this.prisma.chatRoomMember.createMany({
            data: participantIds.map((participantId) => ({ roomId, userId: participantId })),
            skipDuplicates: true,
          })
        : Promise.resolve(),
      receiverIds.length > 0
        ? this.prisma.chatRoomMember.updateMany({
            where: { roomId, userId: { in: receiverIds } },
            data: { unreadCount: { increment: 1 } },
          })
        : Promise.resolve(),
    ]).then(() => {
      for (const participantId of participantIds) {
        this.invalidateRoomsCache(participantId);
      }
      const senderName = message.sender?.name || '상대방';
      // 미디어 등은 URL/base64 원문 대신 라벨로 (푸시 알림 미리보기)
      const previewByType: Record<string, string> = {
        image: '사진을 보냈습니다', video: '동영상을 보냈습니다', file: '파일을 보냈습니다',
        audio: '음성 메시지를 보냈습니다', voice: '음성 메시지를 보냈습니다', location: '위치를 공유했습니다',
      };
      const preview = previewByType[dto.type] || (finalContent || '').slice(0, 40);
      for (const receiverId of receiverIds) {
        this.notificationService.createNotification(
          receiverId,
          'chat' as any,
          `${senderName}님의 메시지`,
          preview || '새 메시지가 도착했습니다.',
          { roomId, messageId: message.id },
        ).catch(() => {});
      }
    }).catch(() => undefined);

    const payload = { ...message, reactions: [], isRead: false };
    Object.defineProperty(payload, '__participantIds', {
      value: participantIds,
      enumerable: false,
    });
    if (clientMessageId) {
      this.setRecentClientMessage(`${roomId}:${userId}:${clientMessageId}`, payload);
    }

    // 고객이 보낸 말이면 사회자 자동응답을 살펴본다(자동응답 자신은 제외 — 무한 루프 방지)
    if (dto.type === 'text' && !(dto.metadata as any)?.autoReply) {
      this.maybeAutoRespondInBackground(roomId, userId, finalContent);
    }

    return payload;
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

  // 멀티파트 미디어 업로드 → 공개 /uploads URL 반환 (메시지는 클라가 별도로 content=URL 로 전송).
  // 이미지: processImage(webp 변환), 동영상/파일: saveRawMedia(원본 DB 저장). 모두 DB 영구저장.
  /** '/uploads/<id>' 에서 id 만 뽑아 영상 압축 큐에 넣는다(영상이 아니거나 작으면 무시됨) */
  private queueVideoCompress(url: string, mimeType: string, size: number) {
    if (!url?.startsWith('/uploads/')) return;
    this.videoCompress.enqueue(url.slice('/uploads/'.length), mimeType, size);
  }

  async uploadMedia(roomId: string, userId: string, file: Express.Multer.File, type?: string) {
    await this.verifyMembership(roomId, userId);
    if (!file || !file.buffer) {
      throw new BadRequestException('파일이 필요합니다.');
    }
    const mime = file.mimetype || '';
    const isImage = type === 'image' || mime.startsWith('image/');
    if (isImage) {
      try {
        const processed = await this.imageService.processImage(file, {
          requireFace: false,
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 85,
        });
        return { url: processed.webpPath || processed.path };
      } catch {
        // 미지원 포맷 등 → 원본 그대로 저장
        const url = await this.imageService.saveRawMedia(file.buffer, mime || 'image/jpeg', file.originalname);
        return { url };
      }
    }
    const url = await this.imageService.saveRawMedia(file.buffer, mime || 'application/octet-stream', file.originalname);
    // 영상은 뒤에서 다시 인코딩해 용량을 줄인다(URL 은 그대로, 바이트만 교체).
    // 응답은 여기서 바로 나가므로 업로드 체감 속도에는 영향이 없다.
    this.queueVideoCompress(url, mime, file.buffer.length);
    return { url };
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

    await this.prisma.chatRoomMember.updateMany({
      where: { roomId, userId },
      data: { unreadCount: 0, lastReadAt: new Date() },
    });

    Promise.resolve().then(async () => {
      const unreadMessages = await this.prisma.message.findMany({
        where: {
          roomId,
          senderId: { not: userId },
          reads: { none: { userId } },
        },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      if (unreadMessages.length === 0) return;
      await this.prisma.messageRead.createMany({
        data: unreadMessages.map((m) => ({ messageId: m.id, userId })),
        skipDuplicates: true,
      });
    }).catch(() => undefined);

    return { readCount: 0 };
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

  // ─── Cron Jobs ───────────────────────────────────────────────────────────

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
    if (this.hasCachedMembership(roomId, userId)) {
      return { roomId, userId };
    }

    const member = await this.prisma.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      select: { roomId: true, userId: true },
    });
    if (member) {
      this.cacheMembership(roomId, userId);
      return member;
    }

    const participantUserIds = await this.getChatParticipantUserIds(userId);
    let room = await this.prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        OR: this.fastChatRoomParticipantWhere(participantUserIds),
      },
      select: { id: true, userId: true, proProfile: { select: { userId: true } }, members: { select: { userId: true } } },
    });
    if (!room) {
      const legacyParticipantUserIds = await this.getChatParticipantUserIds(userId, { includeLegacy: true });
      room = await this.prisma.chatRoom.findFirst({
        where: {
          id: roomId,
          OR: this.chatRoomParticipantWhere(legacyParticipantUserIds),
        },
        select: { id: true, userId: true, proProfile: { select: { userId: true } }, members: { select: { userId: true } } },
      });
    }
    if (!room) throw new ForbiddenException('채팅방에 접근할 수 없습니다');

    await this.prisma.chatRoomMember.createMany({
      data: [{ roomId, userId }],
      skipDuplicates: true,
    });
    this.cacheRoomParticipants(roomId, [room.userId, room.proProfile?.userId, ...room.members.map((m) => m.userId), userId]);
    const repairedMember = await this.prisma.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      select: { roomId: true, userId: true },
    });
    if (!repairedMember) throw new ForbiddenException('채팅방에 접근할 수 없습니다');
    this.cacheMembership(roomId, userId);
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
