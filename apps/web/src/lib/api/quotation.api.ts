import { apiClient } from './client';

const BASE = '/api/v1/quotation';

export const quotationApi = {
  create: (data: {
    userId: string;
    amount: number;
    title?: string;
    description?: string;
    eventDate?: string;
    eventTime?: string;
    eventLocation?: string;
    validUntil?: string;
    chatRoomId?: string;
  }) => apiClient.post(`${BASE}`, data).then((r) => r.data),

  getForPro: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${BASE}/pro`, { params }).then((r) => r.data),

  getForUser: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${BASE}/user`, { params }).then((r) => r.data),

  getDetail: (id: string) =>
    apiClient.get(`${BASE}/${id}`).then((r) => r.data),

  updateStatus: (id: string, status: 'accepted' | 'cancelled') =>
    apiClient.put(`${BASE}/${id}/status`, { status }).then((r) => r.data),

  getDashboard: () =>
    apiClient.get(`${BASE}/dashboard`).then((r) => r.data),
};
