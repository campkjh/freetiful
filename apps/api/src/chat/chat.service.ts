import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private prisma: PrismaService) {}

  // ─── Chat Rooms ──────────────────────────────────────────────────────────

  async createRoom(userId: string, dto: CreateChatRoomDto) {
    // Check if room already exists between user and pro
    const existing = await this.prisma.chatRoom.findFirst({
      where: {
        userId,
        proProfileId: dto.proProfileId,
        userDeletedAt: null,
      },
    });
    if (existing) return this.getRoomById(existing.id, userId);

    // Verify pro exists
    const pro = await this.prisma.proProfile.findUnique({
      where: { id: dto.proProfileId },
    });
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

    return this.getRoomById(room.id, userId);
  }

  async getRooms(userId: string, query: ChatRoomQueryDto) {
    const { search, dateFrom, dateTo, page = 1, limit = 20 } = query;

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
      const otherUser = isProUser
        ? { id: room.user.id, name: room.user.name, profileImageUrl: room.user.profileImageUrl }
        : {
            id: room.proProfile.user.id,
            name: room.proProfile.user.name,
            profileImageUrl: room.proProfile.user.profileImageUrl ?? room.proProfile.images[0]?.imageUrl,
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
      };
    });

    return { data, total, page, limit, hasMore: page * limit < total };
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

    const message = await this.prisma.message.create({
      data: {
        roomId,
        senderId: userId,
        type: dto.type,
        content: dto.content,
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
