import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatRealtimeService {
  private server: Server | null = null;
  private readonly userSockets = new Map<string, Set<string>>();
  // 방 멤버 id 캐시(1분) — '입력 중'은 키 입력마다 오므로 매번 DB 를 치지 않게.
  private readonly roomMembers = new Map<string, { ids: string[]; at: number }>();

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

  rememberRoomMembers(roomId: string, ids: string[]) {
    this.roomMembers.set(roomId, { ids, at: Date.now() });
  }

  cachedRoomMembers(roomId: string): string[] | null {
    const hit = this.roomMembers.get(roomId);
    return hit && Date.now() - hit.at < 60_000 ? hit.ids : null;
  }

  /** 채팅 '목록' 화면에도 입력 중을 띄우도록 방 id 를 담아 멤버 개인 소켓으로 보낸다(본인 제외). */
  emitRoomTyping(roomId: string, userId: string, isTyping: boolean, memberIds: string[]) {
    for (const id of new Set(memberIds)) {
      if (id !== userId) this.emitToUser(id, 'roomTyping', { roomId, userId, isTyping });
    }
  }

  /** 자동응답이 답을 준비하는 동안 상대 화면(방 안·목록)에 '입력 중' 을 띄운다 */
  emitTyping(roomId: string, userId: string, isTyping: boolean) {
    if (!this.server) return;
    this.server.to(`room:${roomId}`).emit('userTyping', { userId, isTyping });
    const ids = this.cachedRoomMembers(roomId);
    if (ids) this.emitRoomTyping(roomId, userId, isTyping, ids);
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
      },
    });

    if (!message) return;

    const payload = {
      ...message,
      reactions: [],
      isRead: false,
    };

    this.server.to(`room:${roomId}`).emit('newMessage', payload);
    this.emitToUsers(options?.notifyUserIds ?? [], 'newMessage', payload);

    if (options?.dashboardUserIds?.length) {
      this.emitDashboardUpdated(options.dashboardUserIds, { roomId, messageId, kind: 'message' });
    }
  }

  async emitProfileUpdatedForUser(
    userId: string,
    data: { name?: string | null; profileImageUrl?: string | null },
  ) {
    if (!this.server) return;

    const rooms = await this.prisma.chatRoom.findMany({
      where: {
        OR: [
          { userId },
          { proProfile: { userId } },
          { members: { some: { userId } } },
        ],
      },
      select: {
        id: true,
        userId: true,
        proProfile: { select: { userId: true } },
        members: { select: { userId: true } },
      },
      take: 500,
    });

    const affectedUserIds = new Set<string>([userId]);
    for (const room of rooms) {
      affectedUserIds.add(room.userId);
      if (room.proProfile?.userId) affectedUserIds.add(room.proProfile.userId);
      room.members.forEach((member) => affectedUserIds.add(member.userId));
      this.server.to(`room:${room.id}`).emit('profileUpdated', { userId, ...data });
    }

    for (const targetUserId of affectedUserIds) {
      this.emitToUser(targetUserId, 'profileUpdated', { userId, ...data });
    }
  }
}
