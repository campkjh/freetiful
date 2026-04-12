import { apiClient } from './client';

const BASE = '/api/v1/notification';

export const notificationApi = {
  getList: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${BASE}`, { params }).then((r) => r.data),

  markAsRead: (id: string) =>
    apiClient.post(`${BASE}/${id}/read`).then((r) => r.data),

  markAllAsRead: () =>
    apiClient.post(`${BASE}/read-all`).then((r) => r.data),

  getUnreadCount: () =>
    apiClient.get<{ count: number }>(`${BASE}/unread-count`).then((r) => r.data),
};
