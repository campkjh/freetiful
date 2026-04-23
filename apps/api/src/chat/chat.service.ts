import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ImageService } from '../image/image.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CreateChatRoomDto,
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
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private imageService: ImageService,
  ) {}

  private roomCache = new Map<string, { data: any; ts: number }>();
  private CACHE_TTL = 60_000; // 1분 (채팅은 짧게)

  private getRoomCached(key: string) {
    const hit = this.roomCache.get(key);
    return hit && Date.now() - hit.ts < this.CACHE_TTL ? hit.data : null;
  }

  private setRoomCached(key: string, data: any) {
    this.roomCache.set(key, { data, ts: Date.now() });
    if (this.roomCache.size > 100) {
      const oldest = this.roomCache.keys().next().value;
      if (oldest) this.roomCache.delete(oldest);
    }
  }

  /** 특정 유저의 룸 목록 캐시 무효화 (새 룸 생성/메시지 전송 시 호출) */
  private invalidateRoomsCache(userId: string) {
    for (const key of this.roomCache.keys()) {
      if (key.startsWith(`rooms:${userId}:`)) {
        this.roomCache.delete(key);
      }
    }
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

    // 기존 룸 체크 + 필요한 joins을 한 번에 가져옴 (2번 쿼리 → 1번)
    const existingWithJoins = await this.prisma.chatRoom.findFirst({
      where: {
        userId,
        proProfileId: dto.proProfileId,
        userDeletedAt: null,
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
        messages: {
          create: {
            senderId: userId,
            type: 'system',
            content: '견적 요청으로 대화가 시작되었습니다.',
          },
        },
      },
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
    };
  }

  async getRooms(userId: string, query: ChatRoomQueryDto) {
    const { search, dateFrom, dateTo, page = 1, limit = 20 } = query;

    const cacheKey = `rooms:${userId}:${page}:${search || ''}`;
    const cached = this.getRoomCached(cacheKey);
    if (cached) return cached;

    const where: any = {
      members: { some: { userId } },
      OR: [
        { userId, userDeletedAt: null },
        { proProfile: { userId }, proDeletedAt: null },
      ],
    };

    if (dateFrom || dateTo) {
      where.lastMessageAt = {};
      if (dateFrom) where.lastMessageAt.gte = new Date(dateFrom);
      if (dateTo) where.lastMessageAt.lte = new Date(dateTo);
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { proProfile: { user: { name: { contains: search, mode: 'insensitive' } } } },
            { messages: { some: { content: { contains: search, mode: 'insensitive' } } } },
          ],
        },
      ];
    }

    const [rooms, total] = await Promise.all([
      this.prisma.chatRoom.findMany({
        where,
        include: {
          proProfile: {
            include: {
              user: { select: { id: true, name: true, profileImageUrl: true, isActive: true } },
              images: { where: { isPrimary: true }, take: 1 },
              categories: { include: { category: { select: { name: true } } } },
            },
          },
          user: { select: { id: true, name: true, profileImageUrl: true } },
          members: { where: { userId } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.chatRoom.count({ where }),
    ]);

    const data = rooms.map((room) => {
      const member = room.members[0];
      const lastMsg = room.messages[0];
      const isProUser = room.proProfile.userId === userId;
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
          ? { id: lastMsg.id, type: lastMsg.type, content: lastMsg.content, createdAt: lastMsg.createdAt }
          : null,
        lastMessageAt: room.lastMessageAt,
        unreadCount: member?.unreadCount ?? 0,
        isFavorited: member?.isFavorited ?? false,
        proProfileId: room.proProfileId,
        iAmPro: isProUser,
      };
    });

    const result = { data, total, page, limit, hasMore: page * limit < total };
    this.setRoomCached(cacheKey, result);
    return result;
  }

  async getRoomById(roomId: string, userId: string) {
    const room = await this.prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        members: { some: { userId } },
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

    if (!room) throw new NotFoundException('채팅방을 찾을 수 없습니다');

    const member = room.members[0];
    const isProUser = room.proProfile.userId === userId;
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
    };
  }

  async deleteRoom(roomId: string, userId: string) {
    const room = await this.prisma.chatRoom.findFirst({
      where: { id: roomId, members: { some: { userId } } },
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
      },
    });

    // Update room last message
    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: { lastMessageId: message.id, lastMessageAt: message.createdAt },
    });

    // Increment unread for other members
    await this.prisma.chatRoomMember.updateMany({
      where: { roomId, userId: { not: userId } },
      data: { unreadCount: { increment: 1 } },
    });

    // 룸 목록 캐시 무효화 (발신자 + 수신자 모두) + 메시지 알림
    try {
      const allMembers = await this.prisma.chatRoomMember.findMany({
        where: { roomId },
        select: { userId: true },
      });
      for (const m of allMembers) {
        this.invalidateRoomsCache(m.userId);
      }
      const senderName = message.sender?.name || '상대방';
      const preview = (dto.content || '').slice(0, 40);
      for (const m of allMembers) {
        if (m.userId === userId) continue;
        this.notificationService.createNotification(
          m.userId,
          'chat' as any,
          `${senderName}님의 메시지`,
          preview || '새 메시지가 도착했습니다.',
          { roomId, messageId: message.id },
        ).catch(() => {});
      }
    } catch {}

    return { ...message, reactions: [], isRead: false };
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

    return this.prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true, deletedAt: new Date() },
    });
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
    if (!member) throw new ForbiddenException('채팅방에 접근할 수 없습니다');
    return member;
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
