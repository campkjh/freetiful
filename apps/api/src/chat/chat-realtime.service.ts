import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatRealtimeService {
  private server: Server | null = null;
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(private readonly prisma: PrismaService) {}

  setServer(server: Server) {
    this.server = server;
  }

  trackUserSocket(userId: string, socketId: string) {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)?.add(socketId);
  }

  untrackUserSocket(userId: string, socketId: string) {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.userSockets.delete(userId);
    }
  }

  emitToUser(userId: string, event: string, data: unknown) {
    if (!this.server) return;
    const sockets = this.userSockets.get(userId);
    if (!sockets?.size) return;
    for (const socketId of sockets) {
      this.server.to(socketId).emit(event, data);
    }
  }

  emitToUsers(userIds: Array<string | null | undefined>, event: string, data: unknown) {
    for (const userId of new Set(userIds.filter(Boolean) as string[])) {
      this.emitToUser(userId, event, data);
    }
  }

  emitDashboardUpdated(userIds: Array<string | null | undefined>, data: Record<string, unknown> = {}) {
    this.emitToUsers(userIds, 'dashboardUpdated', data);
  }

  emitMatchUpdated(userIds: Array<string | null | undefined>, data: Record<string, unknown> = {}) {
    this.emitToUsers(userIds, 'matchUpdated', data);
  }

  async emitPersistedMessage(
    roomId: string,
    messageId: string,
    options?: {
      notifyUserIds?: string[];
      unreadUserIds?: string[];
      roomUpdatedUserIds?: string[];
      dashboardUserIds?: string[];
    },
  ) {
    if (!this.server) return;

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: { select: { id: true, name: true, profileImageUrl: true } },
        replyTo: { select: { id: true, content: true, senderId: true, type: true } },
        reactions: true,
        reads: { select: { userId: true, readAt: true } },
      },
    });

    if (!message) return;

    const payload = {
      ...message,
      reactions: [],
      isRead: message.reads.some((read) => read.userId !== message.senderId),
    };

    this.server.to(`room:${roomId}`).emit('newMessage', payload);

    const roomUpdatedUserIds = options?.roomUpdatedUserIds ?? options?.notifyUserIds ?? [];
    const unreadUserIds = new Set(options?.unreadUserIds ?? options?.notifyUserIds ?? []);

    for (const userId of roomUpdatedUserIds) {
      this.emitToUser(userId, 'roomUpdated', { roomId, messageId });
      if (unreadUserIds.has(userId)) {
        this.emitToUser(userId, 'unreadUpdate', { roomId, messageId });
      }
    }

    if (options?.dashboardUserIds?.length) {
      this.emitDashboardUpdated(options.dashboardUserIds, { roomId, messageId, kind: 'message' });
    }
  }
}
