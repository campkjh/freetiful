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
    category?: string | null;
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
  /** 룸에 연결된 프로 프로필 ID — 결제/프로필 이동 시 사용 */
  proProfileId?: string;
  /** 내가 프로(사회자) 측인지 */
  iAmPro?: boolean;
  /** 전문사회자 찾기/견적에서 생성된 요청 ID */
  matchRequestId?: string | null;
  /** 가장 최근 견적 상태 */
  latestQuotationStatus?: string | null;
  /** 견적문의 탭에 노출할 방인지 */
  hasQuoteInquiry?: boolean;
  /** 예약확정 탭에 노출할 방인지 */
  hasConfirmedBooking?: boolean;
  matchRequest?: {
    id: string;
    type?: string | null;
    eventDate?: string | null;
    eventTime?: string | null;
    eventLocation?: string | null;
    budgetMin?: number | null;
    budgetMax?: number | null;
    status?: string | null;
  } | null;
  latestQuotation?: {
    id: string;
    amount: number;
    title?: string | null;
    status: string;
    eventDate?: string | null;
    eventTime?: string | null;
    createdAt?: string;
  } | null;
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
  getRooms: (params?: { search?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number; withTotal?: boolean }) =>
    apiClient.get<{ data: ChatRoomItem[]; total: number; hasMore: boolean }>(`${BASE}/rooms`, { params }),

  createRoom: (proProfileId: string, matchRequestId?: string) =>
    apiClient.post(`${BASE}/rooms`, { proProfileId, matchRequestId }),

  // 사회자가 매칭 요청을 보고 고객에게 먼저 채팅 거는 경우
  createRoomAsPro: (customerUserId: string, matchRequestId?: string) =>
    apiClient.post(`${BASE}/rooms/pro-initiate`, { customerUserId, matchRequestId }),

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
