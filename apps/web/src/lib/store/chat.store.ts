'use client';

import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { chatApi, type ChatRoomItem, type MessageItem } from '../api/chat.api';
import { useAuthStore } from './auth.store';

const ROOM_CACHE_KEY = 'freetiful-chat-rooms-cache-v2';
// 30분 — 채팅 리스트가 단기간 캐시 만료로 사라지는 문제 방지.
// (예: 다른 페이지에 5분 머무르고 돌아오면 빈 화면이 깜빡 → 다시 채워지던 현상)
const ROOM_CACHE_TTL = 30 * 60_000;
const ROOM_REVALIDATE_MS = 5_000;
const DEFAULT_SOCKET_URL = 'https://affectionate-smile-production-6535.up.railway.app';

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

function dispatchChatEvent(name: string, detail?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {}
}

function normalizeSocketBaseUrl(value?: string | null) {
  const trimmed = value?.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed
    .replace(/\/api\/v1$/i, '')
    .replace(/\/api$/i, '')
    .replace(/\/chat$/i, '');
}

function isSameBrowserHost(url: string) {
  if (typeof window === 'undefined') return false;
  try {
    return new URL(url, window.location.origin).hostname === window.location.hostname;
  } catch {
    return false;
  }
}

function getRoomFlagsFromMessage(message: MessageItem): Partial<ChatRoomItem> {
  const system = (message.metadata as any)?.system;
  if (system?.kind === 'quote') return { hasQuoteInquiry: true };
  if (system?.kind === 'payment_pending_acceptance') return { hasQuoteInquiry: true };
  if (system?.kind === 'booking_confirmed' || system?.kind === 'payment_paid') {
    return { hasQuoteInquiry: true, hasConfirmedBooking: true };
  }
  const content = message.content || '';
  if (/예약확정|확정|결제 완료|진행/.test(content)) return { hasConfirmedBooking: true };
  if (/견적|문의/.test(content)) return { hasQuoteInquiry: true };
  return {};
}

function getRoomFlagsFromPayload(data: SendMessagePayload): Partial<ChatRoomItem> {
  const system = (data.metadata as Record<string, any> | null)?.system;
  if (system?.kind === 'quote') return { hasQuoteInquiry: true };
  if (system?.kind === 'payment_pending_acceptance') return { hasQuoteInquiry: true };
  if (system?.kind === 'booking_confirmed' || system?.kind === 'payment_paid') {
    return { hasQuoteInquiry: true, hasConfirmedBooking: true };
  }
  const content = data.content || '';
  if (/예약확정|확정|결제 완료|진행/.test(content)) return { hasConfirmedBooking: true };
  if (/견적|문의/.test(content)) return { hasQuoteInquiry: true };
  return {};
}

function getPreviewContent(data: SendMessagePayload) {
  if (typeof data.content === 'string' && data.content.trim()) return data.content;
  switch (data.type) {
    case 'image':
      return '사진을 보냈습니다';
    case 'file':
      return '파일을 보냈습니다';
    case 'location':
      return '위치를 공유했습니다';
    case 'system':
      return '안내 메시지를 보냈습니다';
    default:
      return '메시지를 보냈습니다';
  }
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

function messageTime(message: Pick<MessageItem, 'createdAt'>) {
  const time = new Date(message.createdAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortMessagesAsc<T extends Pick<MessageItem, 'createdAt'>>(messages: T[]) {
  return [...messages].sort((a, b) => messageTime(a) - messageTime(b));
}

function sameClientMessageId(a: MessageItem, b: MessageItem) {
  const aId = (a.metadata as Record<string, unknown> | null)?.clientMessageId;
  const bId = (b.metadata as Record<string, unknown> | null)?.clientMessageId;
  return typeof aId === 'string' && aId.length > 0 && aId === bId;
}

function replaceOrAppendMessage(messages: MessageItem[], message: MessageItem) {
  const filtered = messages.filter((item) => item.id !== message.id && !sameClientMessageId(item, message));
  return sortMessagesAsc([...filtered, message]);
}

function mergeFetchedMessageItems(current: MessageItem[], fetched: MessageItem[], requestedAt: number) {
  if (fetched.length === 0 && current.length > 0) return current;

  const fetchedIds = new Set(fetched.map((message) => message.id));
  const preserved = current.filter((message) => {
    if (fetchedIds.has(message.id)) return false;
    if (fetched.some((item) => sameClientMessageId(message, item))) return false;
    return messageTime(message) >= requestedAt - 2_000;
  });

  return sortMessagesAsc([...fetched, ...preserved]);
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
  deleteMessage: (messageId: string) => Promise<void>;
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

    // Vercel 의 NEXT_PUBLIC_API_URL/SOCKET_URL 미설정 시 그대로 freetiful.com 으로 붙으면
    // Vercel rewrites 가 socket.io 를 프록시 안 해서 연결 자체가 실패함.
    // → 운영 도메인(freetiful.com) 에서는 Railway 직접 URL 폴백.
    const isProdHost =
      typeof window !== 'undefined' &&
      /freetiful\.com$/i.test(window.location.hostname);
    const isHttpLocalDev =
      typeof window !== 'undefined' &&
      window.location.hostname === 'localhost' &&
      /^https?:$/i.test(window.location.protocol);
    const fallbackUrl =
      isHttpLocalDev
        ? 'http://localhost:4000'
        : DEFAULT_SOCKET_URL;
    const socketEnvUrl = normalizeSocketBaseUrl(process.env.NEXT_PUBLIC_SOCKET_URL);
    const apiEnvUrl = normalizeSocketBaseUrl(process.env.NEXT_PUBLIC_API_URL);
    const safeApiEnvUrl = isProdHost && isSameBrowserHost(apiEnvUrl) ? '' : apiEnvUrl;
    const baseUrl = socketEnvUrl || safeApiEnvUrl || normalizeSocketBaseUrl(fallbackUrl);

    const socket = io(baseUrl + '/chat', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 300,
      reconnectionDelayMax: 2000,
      timeout: 2500,
      rememberUpgrade: true,
    });

    socket.on('connect', () => {
      set({ isConnected: true });
      dispatchChatEvent('freetiful:chat-socket-connected');
    });
    socket.on('disconnect', () => {
      set({ isConnected: false });
      dispatchChatEvent('freetiful:chat-socket-disconnected');
    });

    socket.on('newMessage', (message: MessageItem) => {
      const { currentRoomId, messageCache } = get();
      const myId = currentUserId();
      const isMine = !!myId && message.senderId === myId;
      const cachedForRoom = messageCache.get(message.roomId) || [];
      messageCache.set(message.roomId, replaceOrAppendMessage(cachedForRoom, message).slice(-80));
      const hasRoomInList = get().rooms.some((room) => room.id === message.roomId);
      if (message.roomId === currentRoomId) {
        set((s) => ({
          messages: replaceOrAppendMessage(s.messages, message),
        }));
      }
      // Update room list
      set((s) => {
        const nextRooms = s.rooms.map((r) =>
          r.id === message.roomId
            ? {
                ...r,
                ...getRoomFlagsFromMessage(message),
                lastMessage: { id: message.id, type: message.type, content: message.content, createdAt: message.createdAt },
                lastMessageAt: message.createdAt,
                unreadCount:
                  message.roomId === currentRoomId || isMine
                    ? 0
                    : r.unreadCount + 1,
              }
            : r,
        ).sort((a, b) => {
          const da = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const db = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return db - da;
        });
        writeRoomsCache(nextRooms);
        return { rooms: nextRooms };
      });
      dispatchChatEvent('freetiful:chat-room-activity', {
        roomId: message.roomId,
        messageId: message.id,
        type: message.type,
        systemKind: (message.metadata as any)?.system?.kind || null,
      });
      if (!hasRoomInList) {
        get().fetchRooms({ limit: 50, force: true }).catch(() => {});
      }
    });

    socket.on('profileUpdated', (data: { userId: string; name?: string | null; profileImageUrl?: string | null }) => {
      if (!data?.userId) return;
      set((s) => {
        const nextRooms = s.rooms.map((room) => {
          if (room.otherUser.id !== data.userId) return room;
          return {
            ...room,
            otherUser: {
              ...room.otherUser,
              ...(data.name !== undefined ? { name: data.name || room.otherUser.name } : {}),
              ...(data.profileImageUrl !== undefined ? { profileImageUrl: data.profileImageUrl } : {}),
            },
          };
        });
        const nextMessages = s.messages.map((message) => {
          if (message.senderId !== data.userId) return message;
          return {
            ...message,
            sender: {
              ...message.sender,
              ...(data.name !== undefined ? { name: data.name || message.sender.name } : {}),
              ...(data.profileImageUrl !== undefined ? { profileImageUrl: data.profileImageUrl } : {}),
            },
          };
        });
        for (const [roomId, cached] of s.messageCache.entries()) {
          s.messageCache.set(roomId, cached.map((message) => (
            message.senderId === data.userId
              ? {
                  ...message,
                  sender: {
                    ...message.sender,
                    ...(data.name !== undefined ? { name: data.name || message.sender.name } : {}),
                    ...(data.profileImageUrl !== undefined ? { profileImageUrl: data.profileImageUrl } : {}),
                  },
                }
              : message
          )));
        }
        writeRoomsCache(nextRooms);
        return { rooms: nextRooms, messages: nextMessages };
      });
      dispatchChatEvent('freetiful:chat-profile-updated', data);
    });

    let refreshTimer: number | null = null;
    const refreshRooms = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        get().fetchRooms({ limit: 50, force: true }).catch(() => {});
        dispatchChatEvent('freetiful:chat-rooms-changed');
        refreshTimer = null;
      }, 120);
    };
    socket.on('roomUpdated', refreshRooms);
    socket.on('unreadUpdate', refreshRooms);
    socket.on('dashboardUpdated', (data: Record<string, unknown>) => {
      refreshRooms();
      dispatchChatEvent('freetiful:dashboard-updated', data);
    });
    socket.on('matchUpdated', (data: Record<string, unknown>) => {
      dispatchChatEvent('freetiful:match-requests-changed', data);
      dispatchChatEvent('freetiful:dashboard-updated', data);
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
    dispatchChatEvent('freetiful:chat-socket-disconnected');
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
    if (!force && !hasFilters && rooms.length > 0 && Date.now() - lastRoomsFetchAt < ROOM_REVALIDATE_MS) {
      set({ roomsLoading: false });
      return;
    }

    // 빈 응답이 와도 기존 캐시/상태를 절대 비우지 않는다.
    // 백엔드 캐시(60s)가 일시적으로 빈 결과를 반환하거나, 토큰 갱신 중 인증 실패가
    // 일어나면 [] 가 와서 사용자가 채팅 리스트가 통째로 사라지는 현상을 보던 문제.
    // 빈 응답이라면 기존 데이터 유지하고 다음 fetch 때 재시도.
    const applyServerRooms = (nextRooms: ChatRoomItem[]) => {
      const current = get().rooms;
      if (nextRooms.length === 0 && current.length > 0) {
        // 빈 응답인데 우리 손엔 데이터가 있다 — 무시. 기존 캐시도 유지.
        return;
      }
      set({ rooms: nextRooms, roomsUserId: userId, lastRoomsFetchAt: Date.now() });
      if (!hasFilters && nextRooms.length > 0) writeRoomsCache(nextRooms, userId);
    };

    if (!force && !hasFilters && rooms.length === 0) {
      const cached = readRoomsCache(userId);
      if (cached) {
        set({ rooms: cached.rooms, roomsUserId: userId, lastRoomsFetchAt: cached.ts, roomsLoading: false });
        chatApi.getRooms(requestParams)
          .then((res) => applyServerRooms(res.data.data))
          .catch(() => {});
        return;
      }
    }

    if (rooms.length > 0) {
      set({ roomsLoading: false });
      chatApi.getRooms(requestParams)
        .then((res) => applyServerRooms(res.data.data))
        .catch(() => {});
      return;
    }
    set({ roomsLoading: true });
    let keepLoadingForRetry = false;
    try {
      const res = await chatApi.getRooms(requestParams);
      applyServerRooms(res.data.data);
    } catch {
      if (!hasFilters && get().rooms.length === 0 && typeof window !== 'undefined') {
        keepLoadingForRetry = true;
        window.setTimeout(() => {
          get().fetchRooms({ ...apiParams, limit: requestParams.limit, force: true }).catch(() => {});
        }, 500);
      }
    } finally {
      set({ roomsLoading: keepLoadingForRetry });
    }
  },

  joinRoom: (roomId) => {
    const { socket, messageCache } = get();
    const cached = messageCache.get(roomId) || [];
    set({ currentRoomId: roomId, messages: cached, messageCursor: null, hasMoreMessages: false });
    socket?.emit('joinRoom', { roomId });
    chatApi.markAsRead(roomId).catch(() => {});

    // Reset unread in room list
    set((s) => {
      const nextRooms = s.rooms.map((r) => (r.id === roomId ? { ...r, unreadCount: 0 } : r));
      writeRoomsCache(nextRooms);
      return { rooms: nextRooms };
    });
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
      const requestedAt = Date.now();
      const res = await chatApi.getMessages(roomId, { cursor: cursor ?? undefined, limit: 50 });
      const newMsgs = res.data.data;
      const nextMessages = loadMore
        ? [...newMsgs, ...get().messages]
        : mergeFetchedMessageItems(get().messages, newMsgs, requestedAt);
      if (nextMessages.length > 0 || newMsgs.length > 0) {
        get().messageCache.set(roomId, nextMessages);
      }
      set((s) => ({
        messages: loadMore ? [...newMsgs, ...s.messages] : mergeFetchedMessageItems(s.messages, newMsgs, requestedAt),
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
    const previewCreatedAt = new Date().toISOString();
    const previewContent = getPreviewContent(payload);
    const hasRoomInList = get().rooms.some((room) => room.id === roomId);
    const currentUser = useAuthStore.getState().user;
    const optimisticClientMessageId = (payload.metadata as Record<string, unknown> | undefined)?.clientMessageId;
    const optimisticMessage: MessageItem | null = currentUser
      ? {
          id: `pending-${optimisticClientMessageId || Date.now()}`,
          roomId,
          senderId: currentUser.id,
          type: payload.type as MessageItem['type'],
          content: payload.content || null,
          metadata: payload.metadata || null,
          replyToId: payload.replyToId || null,
          replyTo: null,
          isEdited: false,
          isDeleted: false,
          isRead: false,
          createdAt: previewCreatedAt,
          sender: {
            id: currentUser.id,
            name: currentUser.name || '나',
            profileImageUrl: currentUser.profileImageUrl || null,
          },
          reactions: [],
        }
      : null;

    if (optimisticMessage) {
      set((s) => {
        const nextMessages = s.currentRoomId === roomId
          ? replaceOrAppendMessage(s.messages, optimisticMessage)
          : s.messages;
        const cached = s.messageCache.get(roomId) || [];
        s.messageCache.set(roomId, replaceOrAppendMessage(cached, optimisticMessage).slice(-80));
        return { messages: nextMessages };
      });
    }

    if (hasRoomInList) {
      set((s) => {
        const nextRooms = s.rooms.map((r) =>
          r.id === roomId
            ? {
                ...r,
                ...getRoomFlagsFromPayload(payload),
                lastMessage: {
                  id: `pending-${(payload.metadata as Record<string, unknown> | undefined)?.clientMessageId || Date.now()}`,
                  type: payload.type,
                  content: previewContent,
                  createdAt: previewCreatedAt,
                },
                lastMessageAt: previewCreatedAt,
                unreadCount: 0,
              }
            : r,
        ).sort((a, b) => {
          const da = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const db = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return db - da;
        });
        writeRoomsCache(nextRooms);
        return { rooms: nextRooms };
      });
      dispatchChatEvent('freetiful:chat-room-activity', {
        roomId,
        type: payload.type,
        optimistic: true,
        systemKind: ((payload.metadata as Record<string, any> | null)?.system?.kind) || null,
      });
      dispatchChatEvent('freetiful:chat-rooms-changed', {
        roomId,
        optimistic: true,
      });
    }

    const applyPersistedMessage = (message: MessageItem) => {
      const { messageCache } = get();
      const cachedForRoom = messageCache.get(message.roomId) || [];
      messageCache.set(message.roomId, replaceOrAppendMessage(cachedForRoom, message).slice(-80));
      const hasRoomInList = get().rooms.some((room) => room.id === message.roomId);
      set((s) => {
        const nextMessages = s.currentRoomId === message.roomId
          ? replaceOrAppendMessage(s.messages, message)
          : s.messages;
        const nextRooms = s.rooms.map((r) =>
          r.id === message.roomId
            ? {
                ...r,
                ...getRoomFlagsFromMessage(message),
                lastMessage: { id: message.id, type: message.type, content: message.content, createdAt: message.createdAt },
                lastMessageAt: message.createdAt,
                unreadCount: 0,
              }
            : r,
        ).sort((a, b) => {
          const da = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const db = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return db - da;
        });
        writeRoomsCache(nextRooms);
        return { messages: nextMessages, rooms: nextRooms };
      });
      dispatchChatEvent('freetiful:chat-room-activity', {
        roomId: message.roomId,
        messageId: message.id,
        type: message.type,
        systemKind: (message.metadata as any)?.system?.kind || null,
      });
      dispatchChatEvent('freetiful:chat-rooms-changed', {
        roomId: message.roomId,
        messageId: message.id,
      });
      window.setTimeout(() => {
        get().fetchRooms({ limit: 50, force: true }).catch(() => {});
      }, hasRoomInList ? 250 : 0);
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
      }, 1200);

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

  deleteMessage: async (messageId) => {
    const { socket, currentRoomId } = get();
    if (!currentRoomId) return;

    set((s) => {
      const nextMessages = s.messages.map((m) =>
        m.id === messageId ? { ...m, isDeleted: true, content: '삭제된 메시지입니다' } : m,
      );
      const cached = s.messageCache.get(currentRoomId) || [];
      s.messageCache.set(
        currentRoomId,
        cached.map((m) => (m.id === messageId ? { ...m, isDeleted: true, content: '삭제된 메시지입니다' } : m)),
      );
      return { messages: nextMessages };
    });

    await chatApi.deleteMessage(messageId);
    if (socket?.connected) {
      socket.emit('deleteMessage', { messageId, roomId: currentRoomId });
    }
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
    set((s) => {
      const nextRooms = s.rooms.filter((r) => r.id !== roomId);
      writeRoomsCache(nextRooms);
      return { rooms: nextRooms };
    });
  },
}));
