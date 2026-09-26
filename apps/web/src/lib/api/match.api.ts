import { apiClient } from './client';

const BASE = '/api/v1/match';

export const matchApi = {
  createRequest: (data: {
    categoryId: string;
    eventCategoryId?: string;
    eventDate?: string;
    eventTime?: string;
    eventLocation?: string;
    budgetMin?: number;
    budgetMax?: number;
    type?: 'multi' | 'single';
    styleOptionIds?: string[];
    personalityOptionIds?: string[];
    selectedProProfileIds?: string[];
    rawUserInput?: Record<string, unknown>;
  }) => apiClient.post(`${BASE}/request`, data).then((r) => r.data),

  quickRequest: (data: {
    name?: string;
    phone: string;
    categoryId: string;
    eventCategoryId?: string;
    eventDate?: string;
    eventTime?: string;
    eventLocation?: string;
    type?: 'multi' | 'single';
    selectedProProfileIds?: string[];
    rawUserInput?: Record<string, unknown>;
  }) => apiClient.post(`${BASE}/quick-request`, data).then((r) => r.data),

  getMyRequests: (params?: { skip?: number; take?: number }) =>
    apiClient.get(`${BASE}/requests`, { params }).then((r) => r.data),

  /** 사회자 한 명에게 보낸 요청만 취소 — 아직 답하지 않은 요청만 */
  cancelDelivery: (deliveryId: string) =>
    apiClient.post(`${BASE}/deliveries/${deliveryId}/cancel`).then((r) => r.data),

  /** 내 요청 취소 — 아직 답하지 않은 사회자에게 간 요청을 거둔다(대화 중인 방은 그대로) */
  cancelRequest: (requestId: string) =>
    apiClient.post(`${BASE}/requests/${requestId}/cancel`).then((r) => r.data),

  getProRequests: (params?: { limit?: number; skip?: number }) =>
    apiClient.get(`${BASE}/pro/requests`, { params }).then((r) => r.data),

  /** 사회자 거절 사유 추천 — AI 4개 + 규칙 프리셋(최대 6개) */
  declineSuggestions: (deliveryId: string) =>
    apiClient
      .get(`${BASE}/delivery/${deliveryId}/decline-suggestions`, { timeout: 8000 })
      .then((r) => r.data as { items: { label: string; text: string }[]; source: 'ai' | 'rule' }),

  respond: (deliveryId: string, action: 'accept' | 'reject' | 'archive', message?: string) =>
    apiClient.post(`${BASE}/delivery/${deliveryId}/respond`, { action, message }).then((r) => r.data),
};
