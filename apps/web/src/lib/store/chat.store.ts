'use client';

import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { chatApi, type ChatRoomItem, type MessageItem } from '../api/chat.api';
import { useAuthStore } from './auth.store';

const ROOM_CACHE_KEY = 'freetiful-chat-rooms-cache-v1';
const ROOM_CACHE_TTL = 5 * 60_000;

type FetchRoomsParams = {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  withTotal?: boolean;
  force?: boolean;
};

type SendMessagePayload = {
  type: string;
  content?: string;
  metadata?: Record<string, unknown>;
  replyToId?: string;
};

type SendMessageAck = {
  ok: boolean;
  message?: MessageItem;
  error?: string;
};

function currentUserId() {
  return useAuthStore.getState().user?.id || null;
}

function readRoomsCache(userId = currentUserId()): { rooms: ChatRoomItem[]; ts: number; userId: string } | null {
  if (typeof window === 'undefined') return null;
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(ROOM_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.rooms) || !parsed?.ts) return null;
    if (parsed.userId !== userId) return null;
    if (Date.now() - parsed.ts > ROOM_CACHE_TTL) {
      localStorage.removeItem(ROOM_CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeRoomsCache(rooms: ChatRoomItem[], userId = currentUserId()) {
  if (typeof window === 'undefined') return;
  if (!userId) return;
  try {
    localStorage.setItem(ROOM_CACHE_KEY, JSON.stringify({ userId, rooms, ts: Date.now() }));
  } catch {}
}

function getRoomFlagsFromMessage(message: MessageItem): Partial<ChatRoomItem> {
  const system = (message.metadata as any)?.system;
  if (system?.kind === 'quote') return { hasQuoteInquiry: true };
  if (system?.kind === 'booking_confirmed' || system?.kind === 'payment_paid') {
    return { hasQuoteInquiry: true, hasConfirmedBooking: true };
  }
  const content = message.content || '';
  if (/예약확정|확정|결제 완료|진행/.test(content)) return { hasConfirmedBooking: true };
  if (/견적|문의/.test(content)) return { hasQuoteInquiry: true };
  return {};
}

function ensureClientMessageId(data: SendMessagePayload): SendMessagePayload {
  const metadata =
    data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
      ? data.metadata
      : {};
  if (typeof metadata.clientMessageId === 'string' && metadata.clientMessageId) {
    return data;
  }
  const clientMessageId = `cm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return { ...data, metadata: { ...metadata, clientMessageId } };
}

interface ChatState {
  // Connection
  socket: Socket | null;
  isConnected: boolean;

  // Room list
  rooms: ChatRoomItem[];
  roomsUserId: string | null;
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
  fetchRooms: (params?: FetchRoomsParams) => Promise<void>;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  fetchMessages: (roomId: string, loadMore?: boolean) => Promise<void>;
  sendMessage: (data: SendMessagePayload) => Promise<MessageItem | null>;
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
  roomsUserId: null,
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
      const { currentRoomId, messageCache } = get();
      const cachedForRoom = messageCache.get(message.roomId) || [];
      if (!cachedForRoom.some((m) => m.id === message.id)) {
        messageCache.set(message.roomId, [...cachedForRoom, message].slice(-80));
      }
      const hasRoomInList = get().rooms.some((room) => room.id === message.roomId);
      if (message.roomId === currentRoomId) {
        set((s) => ({
          messages: s.messages.some((m) => m.id === message.id)
            ? s.messages
            : [...s.messages, message],
        }));
      }
      // Update room list
      set((s) => ({
        rooms: s.rooms.map((r) =>
          r.id === message.roomId
            ? {
                ...r,
                ...getRoomFlagsFromMessage(message),
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
      if (!hasRoomInList) {
        get().fetchRooms({ limit: 50, withTotal: false, force: true }).catch(() => {});
      }
    });

    const refreshRooms = () => {
      get().fetchRooms({ limit: 50, withTotal: false, force: true }).catch(() => {});
    };
    socket.on('roomUpdated', refreshRooms);
    socket.on('unreadUpdate', refreshRooms);

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
    const userId = currentUserId();
    if (!userId) {
      set({ rooms: [], roomsUserId: null, roomsLoading: false, lastRoomsFetchAt: 0 });
      return;
    }

    const { force = false, ...apiParams } = params || {};
    let { rooms, roomsLoading, lastRoomsFetchAt, roomsUserId } = get();
    if (rooms.length > 0 && roomsUserId !== userId) {
      rooms = [];
      lastRoomsFetchAt = 0;
      set({ rooms: [], roomsUserId: userId, lastRoomsFetchAt: 0, roomsLoading: false });
    }

    const hasFilters = !!(apiParams.search || apiParams.dateFrom || apiParams.dateTo);
    const requestParams = { limit: 30, withTotal: false, ...apiParams };
    if (!force && !hasFilters && roomsLoading) return;
    if (!force && !hasFilters && rooms.length > 0 && Date.now() - lastRoomsFetchAt < 30_000) {
      set({ roomsLoading: false });
      return;
    }

    if (!force && !hasFilters && rooms.length === 0) {
      const cached = readRoomsCache(userId);
      if (cached) {
        set({ rooms: cached.rooms, roomsUserId: userId, lastRoomsFetchAt: cached.ts, roomsLoading: false });
        chatApi.getRooms(requestParams)
          .then((res) => {
            const nextRooms = res.data.data;
            set({ rooms: nextRooms, roomsUserId: userId, lastRoomsFetchAt: Date.now() });
            writeRoomsCache(nextRooms, userId);
          })
          .catch(() => {});
        return;
      }
    }

    if (rooms.length > 0) {
      set({ roomsLoading: false });
      chatApi.getRooms(requestParams)
        .then((res) => {
          const nextRooms = res.data.data;
          set({ rooms: nextRooms, roomsUserId: userId, lastRoomsFetchAt: Date.now() });
          if (!hasFilters) writeRoomsCache(nextRooms, userId);
        })
        .catch(() => {});
      return;
    }
    set({ roomsLoading: true });
    try {
      const res = await chatApi.getRooms(requestParams);
      set({ rooms: res.data.data, roomsUserId: userId, lastRoomsFetchAt: Date.now() });
      if (!hasFilters) writeRoomsCache(res.data.data, userId);
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
      const nextMessages = loadMore ? [...newMsgs, ...get().messages] : newMsgs;
      get().messageCache.set(roomId, nextMessages);
      set((s) => ({
        messages: loadMore ? [...newMsgs, ...s.messages] : newMsgs,
        hasMoreMessages: res.data.hasMore,
        messageCursor: res.data.cursor,
      }));
    } finally {
      set({ messagesLoading: false });
    }
  },

  sendMessage: async (data) => {
    const { socket, currentRoomId } = get();
    if (!currentRoomId) return null;

    const roomId = currentRoomId;
    const payload = ensureClientMessageId(data);
    const applyPersistedMessage = (message: MessageItem) => {
      const { messageCache } = get();
      const cachedForRoom = messageCache.get(message.roomId) || [];
      if (!cachedForRoom.some((m) => m.id === message.id)) {
        messageCache.set(message.roomId, [...cachedForRoom, message].slice(-80));
      }
      set((s) => ({
        messages: s.currentRoomId === message.roomId && !s.messages.some((m) => m.id === message.id)
          ? [...s.messages, message]
          : s.messages,
        rooms: s.rooms.map((r) =>
          r.id === message.roomId
            ? {
                ...r,
                ...getRoomFlagsFromMessage(message),
                lastMessage: { id: message.id, type: message.type, content: message.content, createdAt: message.createdAt },
                lastMessageAt: message.createdAt,
              }
            : r,
        ).sort((a, b) => {
          const da = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const db = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return db - da;
        }),
      }));
      writeRoomsCache(get().rooms);
    };

    const sendViaRest = async () => {
      const res = await chatApi.sendMessage(roomId, payload);
      applyPersistedMessage(res.data);
      return res.data;
    };

    if (!socket || !socket.connected) {
      return sendViaRest();
    }

    const ackMessage = await new Promise<MessageItem | null>((resolve) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve(null);
      }, 4500);

      socket.emit('sendMessage', { roomId, ...payload }, (ack?: SendMessageAck) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(ack?.ok && ack.message ? ack.message : null);
      });
    });

    if (ackMessage) {
      applyPersistedMessage(ackMessage);
      return ackMessage;
    }

    const myId = currentUserId();
    const clientMessageId = (payload.metadata as Record<string, unknown> | undefined)?.clientMessageId;
    const alreadyBroadcast = [...(get().messageCache.get(roomId) || []), ...get().messages]
      .find((m) => (
        m.roomId === roomId &&
        m.senderId === myId &&
        typeof clientMessageId === 'string' &&
        (m.metadata as Record<string, unknown> | null)?.clientMessageId === clientMessageId
      ));
    if (alreadyBroadcast) return alreadyBroadcast;

    return sendViaRest();
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
