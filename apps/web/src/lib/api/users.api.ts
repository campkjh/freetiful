import { apiClient } from './client';
import type { User } from '@prettyful/types';

const BASE = '/api/v1/users';

export type NotificationSettings = {
  chatPush: boolean;
  bookingPush: boolean;
  paymentPush: boolean;
  reviewPush: boolean;
  systemPush: boolean;
  marketingPush: boolean;
  marketingSms: boolean;
  marketingEmail: boolean;
};

export const usersApi = {
  getProfile: () =>
    apiClient.get<User & { proProfile?: any; businessProfile?: any }>(`${BASE}/profile`).then((r) => r.data),

  updateProfile: (data: { name?: string; phone?: string; profileImageUrl?: string; profileImageDataUrl?: string }) =>
    apiClient.put<User>(`${BASE}/profile`, data).then((r) => r.data),

  uploadProfileImage: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient
      .post<{ profileImageUrl: string }>(`${BASE}/profile/image`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  getNotificationSettings: () =>
    apiClient.get<NotificationSettings>(`${BASE}/notification-settings`).then((r) => r.data),

  updateNotificationSettings: (data: Partial<NotificationSettings>) =>
    apiClient.put<NotificationSettings>(`${BASE}/notification-settings`, data).then((r) => r.data),

  getPointBalance: () =>
    apiClient.get<{ balance: number }>(`${BASE}/points`).then((r) => r.data),

  getPointHistory: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${BASE}/points/history`, { params }).then((r) => r.data),

  switchRole: (role: 'general' | 'pro') =>
    apiClient.post<User>(`${BASE}/role`, { role }).then((r) => r.data),

  deleteAccount: () =>
    apiClient.post(`${BASE}/delete-account`).then((r) => r.data),
};
