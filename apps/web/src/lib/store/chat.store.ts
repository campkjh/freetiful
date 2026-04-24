'use client';

import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { chatApi, type ChatRoomItem, type MessageItem } from '../api/chat.api';
import { useAuthStore } from './auth.store';

interface ChatState {
  // Connection
  socket: Socket | null;
  isConnected: boolean;

  // Room list
  rooms: ChatRoomItem[];
  roomsLoading: boolean;
  lastRoomsFetchAt: number;

  // Current room
  currentRoomId: string | null;
  messages: MessageItem[];
  messagesLoading: boolean;
  hasMoreMessages: boolean;
  messageCursor: string | null;

  // Per-room message cache
  messageCache: Map<string, MessageItem[]>;

  // Typing indicator
  typingUsers: Map<string, boolean>;

  // Actions
  connect: () => void;
  disconnect: () => void;
  fetchRooms: (params?: { search?: string; dateFrom?: string; dateTo?: string }) => Promise<void>;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  fetchMessages: (roomId: string, loadMore?: boolean) => Promise<void>;
  sendMessage: (data: { type: string; content?: string; metadata?: Record<string, unknown>; replyToId?: string }) => void;
  editMessage: (messageId: string, content: string) => void;
  deleteMessage: (messageId: string) => void;
  addReaction: (messageId: string, emoji: string) => void;
  setTyping: (isTyping: boolean) => void;
  toggleFavorite: (roomId: string) => Promise<void>;
  deleteRoom: (roomId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  socket: null,
  isConnected: false,
  rooms: [],
  roomsLoading: false,
  lastRoomsFetchAt: 0,
  currentRoomId: null,
  messages: [],
  messagesLoading: false,
  hasMoreMessages: false,
  messageCursor: null,
  messageCache: new Map(),
  typingUsers: new Map(),

  connect: () => {
    const token = useAuthStore.getState().accessToken;
    if (!token || get().socket) return;

    const fallbackUrl =
      typeof window !== 'undefined' && window.location.hostname === 'localhost'
        ? 'http://localhost:4000'
        : typeof window !== 'undefined'
          ? window.location.origin
          : '';
    const baseUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      fallbackUrl;

    const socket = io(baseUrl + '/chat', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 300,
      reconnectionDelayMax: 2000,
      timeout: 8000,
    });

    socket.on('connect', () => set({ isConnected: true }));
    socket.on('disconnect', () => set({ isConnected: false }));

    socket.on('newMessage', (message: MessageItem) => {
      const { currentRoomId } = get();
      if (message.roomId === currentRoomId) {
        set((s) => ({ messages: [...s.messages, message] }));
      }
      // Update room list
      set((s) => ({
        rooms: s.rooms.map((r) =>
          r.id === message.roomId
            ? {
                ...r,
                lastMessage: { id: message.id, type: message.type, content: message.content, createdAt: message.createdAt },
                lastMessageAt: message.createdAt,
                unreadCount: message.roomId === currentRoomId ? r.unreadCount : r.unreadCount + 1,
              }
            : r,
        ).sort((a, b) => {
          const da = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const db = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return db - da;
        }),
      }));
    });

    socket.on('messageEdited', (updated: any) => {
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === updated.id ? { ...m, content: updated.content, isEdited: true } : m,
        ),
      }));
    });

    socket.on('messageDeleted', ({ messageId }: { messageId: string }) => {
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === messageId ? { ...m, isDeleted: true, content: '삭제된 메시지입니다' } : m,
        ),
      }));
    });

    socket.on('reactionUpdate', (data: { messageId: string; userId: string; action: string; emoji: string }) => {
      set((s) => ({
        messages: s.messages.map((m) => {
          if (m.id !== data.messageId) return m;
          const reactions = [...m.reactions];
          const idx = reactions.findIndex((r) => r.emoji === data.emoji);
          if (data.action === 'added') {
            if (idx >= 0) {
              reactions[idx] = { ...reactions[idx], count: reactions[idx].count + 1, userIds: [...reactions[idx].userIds, data.userId] };
            } else {
              reactions.push({ emoji: data.emoji, count: 1, userIds: [data.userId] });
            }
          } else if (idx >= 0) {
            if (reactions[idx].count <= 1) reactions.splice(idx, 1);
            else reactions[idx] = { ...reactions[idx], count: reactions[idx].count - 1, userIds: reactions[idx].userIds.filter((id) => id !== data.userId) };
          }
          return { ...m, reactions };
        }),
      }));
    });

    socket.on('userRead', ({ roomId, userId }: { roomId: string; userId: string }) => {
      const myId = useAuthStore.getState().user?.id;
      if (userId !== myId) {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.roomId === roomId && m.senderId === myId ? { ...m, isRead: true } : m,
          ),
        }));
      }
    });

    socket.on('userTyping', ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      set((s) => {
        const typingUsers = new Map(s.typingUsers);
        if (isTyping) typingUsers.set(userId, true);
        else typingUsers.delete(userId);
        return { typingUsers };
      });
    });

    set({ socket });
  },

  disconnect: () => {
    get().socket?.disconnect();
    set({ socket: null, isConnected: false });
  },

  fetchRooms: async (params) => {
    const { rooms, roomsLoading, lastRoomsFetchAt } = get();
    const hasFilters = !!(params?.search || params?.dateFrom || params?.dateTo);
    if (!hasFilters && roomsLoading) return;
    if (!hasFilters && rooms.length > 0 && Date.now() - lastRoomsFetchAt < 30_000) {
      set({ roomsLoading: false });
      return;
    }
    if (rooms.length > 0) {
      set({ roomsLoading: false });
      chatApi.getRooms(params)
        .then((res) => set({ rooms: res.data.data, lastRoomsFetchAt: Date.now() }))
        .catch(() => {});
      return;
    }
    set({ roomsLoading: true });
    try {
      const res = await chatApi.getRooms(params);
      set({ rooms: res.data.data, lastRoomsFetchAt: Date.now() });
    } finally {
      set({ roomsLoading: false });
    }
  },

  joinRoom: (roomId) => {
    const { socket, messageCache } = get();
    const cached = messageCache.get(roomId) || [];
    set({ currentRoomId: roomId, messages: cached, messageCursor: null, hasMoreMessages: false });
    socket?.emit('joinRoom', { roomId });

    // Reset unread in room list
    set((s) => ({
      rooms: s.rooms.map((r) => (r.id === roomId ? { ...r, unreadCount: 0 } : r)),
    }));
  },

  leaveRoom: () => {
    const { socket, currentRoomId, messages, messageCache } = get();
    if (currentRoomId) {
      socket?.emit('leaveRoom', { roomId: currentRoomId });
      if (messages.length > 0) {
        messageCache.set(currentRoomId, messages);
      }
    }
    set({ currentRoomId: null, messages: [], typingUsers: new Map() });
  },

  fetchMessages: async (roomId, loadMore = false) => {
    set({ messagesLoading: true });
    try {
      const cursor = loadMore ? get().messageCursor : undefined;
      const res = await chatApi.getMessages(roomId, { cursor: cursor ?? undefined, limit: 50 });
      const newMsgs = res.data.data;
      set((s) => ({
        messages: loadMore ? [...newMsgs, ...s.messages] : newMsgs,
        hasMoreMessages: res.data.hasMore,
        messageCursor: res.data.cursor,
      }));
    } finally {
      set({ messagesLoading: false });
    }
  },

  sendMessage: (data) => {
    const { socket, currentRoomId } = get();
    if (!socket || !currentRoomId) return;
    socket.emit('sendMessage', { roomId: currentRoomId, ...data });
  },

  editMessage: (messageId, content) => {
    const { socket, currentRoomId } = get();
    if (!socket || !currentRoomId) return;
    socket.emit('editMessage', { messageId, roomId: currentRoomId, content });
  },

  deleteMessage: (messageId) => {
    const { socket, currentRoomId } = get();
    if (!socket || !currentRoomId) return;
    socket.emit('deleteMessage', { messageId, roomId: currentRoomId });
  },

  addReaction: (messageId, emoji) => {
    const { socket, currentRoomId } = get();
    if (!socket || !currentRoomId) return;
    socket.emit('addReaction', { messageId, roomId: currentRoomId, emoji });
  },

  setTyping: (isTyping) => {
    const { socket, currentRoomId } = get();
    if (!socket || !currentRoomId) return;
    socket.emit('typing', { roomId: currentRoomId, isTyping });
  },

  toggleFavorite: async (roomId) => {
    const res = await chatApi.toggleFavorite(roomId);
    set((s) => ({
      rooms: s.rooms.map((r) => (r.id === roomId ? { ...r, isFavorited: res.data.isFavorited } : r)),
    }));
  },

  deleteRoom: async (roomId) => {
    await chatApi.deleteRoom(roomId);
    set((s) => ({ rooms: s.rooms.filter((r) => r.id !== roomId) }));
  },
}));
