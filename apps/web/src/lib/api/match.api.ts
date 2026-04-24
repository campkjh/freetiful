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
    rawUserInput?: Record<string, unknown>;
  }) => apiClient.post(`${BASE}/request`, data).then((r) => r.data),

  getMyRequests: () =>
    apiClient.get(`${BASE}/requests`).then((r) => r.data),

  getProRequests: () =>
    apiClient.get(`${BASE}/pro/requests`).then((r) => r.data),

  respond: (deliveryId: string, action: 'accept' | 'reject') =>
    apiClient.post(`${BASE}/delivery/${deliveryId}/respond`, { action }).then((r) => r.data),
};
