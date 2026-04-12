import { apiClient } from './client';
import type { User } from '@prettyful/types';

const BASE = '/api/v1/users';

export const usersApi = {
  getProfile: () =>
    apiClient.get<User & { proProfile?: any; businessProfile?: any }>(`${BASE}/profile`).then((r) => r.data),

  updateProfile: (data: { name?: string; phone?: string; profileImageUrl?: string }) =>
    apiClient.put<User>(`${BASE}/profile`, data).then((r) => r.data),

  getPointBalance: () =>
    apiClient.get<{ balance: number }>(`${BASE}/points`).then((r) => r.data),

  getPointHistory: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${BASE}/points/history`, { params }).then((r) => r.data),

  switchRole: (role: 'general' | 'pro') =>
    apiClient.post<User>(`${BASE}/role`, { role }).then((r) => r.data),

  deleteAccount: () =>
    apiClient.post(`${BASE}/delete-account`).then((r) => r.data),
};
