import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Ack } from '@nestjs/websockets/decorators/ack.decorator';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/chat.dto';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [
      'http://localhost:3000',
      'http://localhost:8081',
      'https://freetiful.com',
      'https://www.freetiful.com',
    ],
    credentials: true,
  },
  namespace: '/chat',
  pingInterval: 10000,
  pingTimeout: 5000,
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, Set<string>>();

  constructor(
    private jwtService: JwtService,
    private chatService: ChatService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.userId = payload.sub;

      // Track connected sockets per user
      if (!this.userSockets.has(payload.sub)) {
        this.userSockets.set(payload.sub, new Set());
      }
      this.userSockets.get(payload.sub)!.add(client.id);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const sockets = this.userSockets.get(client.userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) this.userSockets.delete(client.userId);
      }
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!client.userId) return;
    client.join(`room:${data.roomId}`);

    // Mark messages as read
    await this.chatService.markAsRead(data.roomId, client.userId);
    this.server.to(`room:${data.roomId}`).emit('userRead', {
      roomId: data.roomId,
      userId: client.userId,
    });
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { roomId: string },
  ) {
    client.leave(`room:${data.roomId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { roomId: string } & SendMessageDto,
    @Ack() ack?: (response: { ok: boolean; message?: unknown; error?: string }) => void,
  ) {
    if (!client.userId) {
      ack?.({ ok: false, error: '인증이 필요합니다' });
      return;
    }

    try {
      const { roomId, ...dto } = data;
      const message = await this.chatService.sendMessage(roomId, client.userId, dto);

      // Broadcast to all users in the room
      this.server.to(`room:${roomId}`).emit('newMessage', message);
      ack?.({ ok: true, message });

      // Notify connected room-list screens that are not currently joined to the room.
      const memberIds = await this.chatService.getRoomMemberIds(roomId);
      for (const memberId of memberIds) {
        if (memberId === client.userId) continue;
        this.emitToUser(memberId, 'roomUpdated', { roomId });
        this.emitToUser(memberId, 'unreadUpdate', { roomId });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '메시지 전송에 실패했습니다';
      ack?.({ ok: false, error: message });
      client.emit('messageError', { roomId: data.roomId, error: message });
    }
  }

  @SubscribeMessage('editMessage')
  async handleEditMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string; roomId: string; content: string },
  ) {
    if (!client.userId) return;

    const updated = await this.chatService.editMessage(data.messageId, client.userId, {
      content: data.content,
    });

    this.server.to(`room:${data.roomId}`).emit('messageEdited', updated);
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string; roomId: string },
  ) {
    if (!client.userId) return;

    await this.chatService.deleteMessage(data.messageId, client.userId);
    this.server.to(`room:${data.roomId}`).emit('messageDeleted', { messageId: data.messageId });
  }

  @SubscribeMessage('addReaction')
  async handleReaction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string; roomId: string; emoji: string },
  ) {
    if (!client.userId) return;

    const result = await this.chatService.addReaction(data.messageId, client.userId, {
      emoji: data.emoji,
    });

    this.server.to(`room:${data.roomId}`).emit('reactionUpdate', {
      messageId: data.messageId,
      userId: client.userId,
      ...result,
    });
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { roomId: string; isTyping: boolean },
  ) {
    if (!client.userId) return;

    client.to(`room:${data.roomId}`).emit('userTyping', {
      userId: client.userId,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!client.userId) return;

    await this.chatService.markAsRead(data.roomId, client.userId);
    this.server.to(`room:${data.roomId}`).emit('userRead', {
      roomId: data.roomId,
      userId: client.userId,
    });
  }

  // Helper: emit to specific user across all their connected sockets
  private emitToUser(userId: string, event: string, data: any) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      for (const socketId of sockets) {
        this.server.to(socketId).emit(event, data);
      }
    }
  }
}
