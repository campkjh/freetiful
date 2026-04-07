import { apiClient } from './client';

const BASE = '/api/v1/chat';

// ─── Chat Rooms ──────────────────────────────────────────────────────────────

export interface ChatRoomItem {
  id: string;
  otherUser: {
    id: string;
    name: string;
    profileImageUrl: string | null;
    isActive?: boolean;
  };
  lastMessage: {
    id: string;
    type: string;
    content: string | null;
    createdAt: string;
  } | null;
  lastMessageAt: string | null;
  unreadCount: number;
  isFavorited: boolean;
}

export interface MessageItem {
  id: string;
  roomId: string;
  senderId: string;
  type: 'text' | 'image' | 'file' | 'location' | 'link' | 'sticker' | 'system';
  content: string | null;
  metadata: Record<string, unknown> | null;
  replyToId: string | null;
  replyTo: { id: string; content: string | null; senderId: string; type: string } | null;
  isEdited: boolean;
  isDeleted: boolean;
  isRead: boolean;
  createdAt: string;
  sender: { id: string; name: string; profileImageUrl: string | null };
  reactions: { emoji: string; count: number; userIds: string[] }[];
}

export const chatApi = {
  // Rooms
  getRooms: (params?: { search?: string; dateFrom?: string; dateTo?: string; page?: number }) =>
    apiClient.get<{ data: ChatRoomItem[]; total: number; hasMore: boolean }>(`${BASE}/rooms`, { params }),

  createRoom: (proProfileId: string, matchRequestId?: string) =>
    apiClient.post(`${BASE}/rooms`, { proProfileId, matchRequestId }),

  getRoom: (roomId: string) =>
    apiClient.get(`${BASE}/rooms/${roomId}`),

  deleteRoom: (roomId: string) =>
    apiClient.delete(`${BASE}/rooms/${roomId}`),

  toggleFavorite: (roomId: string) =>
    apiClient.post<{ isFavorited: boolean }>(`${BASE}/rooms/${roomId}/favorite`),

  markAsRead: (roomId: string) =>
    apiClient.post(`${BASE}/rooms/${roomId}/read`),

  // Messages
  getMessages: (roomId: string, params?: { search?: string; before?: string; after?: string; limit?: number; cursor?: string }) =>
    apiClient.get<{ data: MessageItem[]; hasMore: boolean; cursor: string | null }>(`${BASE}/rooms/${roomId}/messages`, { params }),

  sendMessage: (roomId: string, data: { type: string; content?: string; metadata?: Record<string, unknown>; replyToId?: string }) =>
    apiClient.post<MessageItem>(`${BASE}/rooms/${roomId}/messages`, data),

  editMessage: (messageId: string, content: string) =>
    apiClient.put(`${BASE}/messages/${messageId}`, { content }),

  deleteMessage: (messageId: string) =>
    apiClient.delete(`${BASE}/messages/${messageId}`),

  addReaction: (messageId: string, emoji: string) =>
    apiClient.post(`${BASE}/messages/${messageId}/reactions`, { emoji }),

  searchMessages: (roomId: string, q: string) =>
    apiClient.get(`${BASE}/rooms/${roomId}/search`, { params: { q } }),

  // Photo Gallery
  getPhotoGallery: (roomId: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`${BASE}/rooms/${roomId}/photos`, { params }),

  // Scheduled Messages
  createScheduledMessage: (roomId: string, data: { type: string; content?: string; scheduledAt: string }) =>
    apiClient.post(`${BASE}/rooms/${roomId}/scheduled`, data),

  getScheduledMessages: (roomId: string) =>
    apiClient.get(`${BASE}/rooms/${roomId}/scheduled`),

  deleteScheduledMessage: (id: string) =>
    apiClient.delete(`${BASE}/scheduled/${id}`),

  // Frequent Messages
  getFrequentMessages: () =>
    apiClient.get(`${BASE}/frequent-messages`),

  createFrequentMessage: (content: string) =>
    apiClient.post(`${BASE}/frequent-messages`, { content }),

  updateFrequentMessage: (id: string, content: string) =>
    apiClient.put(`${BASE}/frequent-messages/${id}`, { content }),

  deleteFrequentMessage: (id: string) =>
    apiClient.delete(`${BASE}/frequent-messages/${id}`),
};
