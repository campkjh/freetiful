import { apiClient } from './client';

const BASE = '/api/v1/favorite';

export const favoriteApi = {
  toggle: (proProfileId: string) =>
    apiClient.post<{ isFavorited: boolean }>(`${BASE}/${proProfileId}`).then((r) => r.data),

  getList: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${BASE}`, { params }).then((r) => r.data),

  check: (proProfileId: string) =>
    apiClient.get<{ isFavorited: boolean }>(`${BASE}/${proProfileId}/check`).then((r) => r.data),
};
