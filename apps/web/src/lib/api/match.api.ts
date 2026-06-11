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

  getProRequests: (params?: { limit?: number; skip?: number }) =>
    apiClient.get(`${BASE}/pro/requests`, { params }).then((r) => r.data),

  respond: (deliveryId: string, action: 'accept' | 'reject' | 'archive', message?: string) =>
    apiClient.post(`${BASE}/delivery/${deliveryId}/respond`, { action, message }).then((r) => r.data),
};
