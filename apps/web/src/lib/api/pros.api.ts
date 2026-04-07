import { apiClient } from './client';
import type { ProProfile, PaginatedResponse } from '@prettyful/types';

const BASE = '/api/v1';

export const prosApi = {
  list: (params?: {
    categoryId?: string;
    eventCategoryId?: string;
    regionId?: string;
    sort?: 'pudding_rank' | 'avg_rating' | 'review_count' | 'newest';
    page?: number;
    limit?: number;
  }) =>
    apiClient.get<PaginatedResponse<ProProfile>>(`${BASE}/pros`, { params }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<ProProfile>(`${BASE}/pros/${id}`).then((r) => r.data),

  getReviews: (id: string, page = 1) =>
    apiClient.get(`${BASE}/pros/${id}/reviews`, { params: { page } }).then((r) => r.data),

  getSchedule: (id: string) =>
    apiClient.get(`${BASE}/pros/${id}/schedule`).then((r) => r.data),

  getRecommended: () =>
    apiClient.get<ProProfile[]>(`${BASE}/pros/recommended`).then((r) => r.data),

  // Pro profile management
  getMyProfile: () =>
    apiClient.get<ProProfile>(`${BASE}/pro/profile`).then((r) => r.data),

  createProfile: () =>
    apiClient.post<ProProfile>(`${BASE}/pro/profile`).then((r) => r.data),

  updateProfile: (data: Partial<ProProfile>) =>
    apiClient.put<ProProfile>(`${BASE}/pro/profile`, data).then((r) => r.data),

  submitProfile: () =>
    apiClient.post(`${BASE}/pro/profile/submit`).then((r) => r.data),

  saveDraft: (data: Partial<ProProfile>) =>
    apiClient.post(`${BASE}/pro/profile/draft`, data).then((r) => r.data),

  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post(`${BASE}/pro/profile/images`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  deleteImage: (id: string) =>
    apiClient.delete(`${BASE}/pro/profile/images/${id}`),

  reorderImages: (ids: string[]) =>
    apiClient.put(`${BASE}/pro/profile/images/reorder`, { ids }),

  adjustImage: (id: string, options: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    sharpen?: boolean;
    cropX?: number;
    cropY?: number;
    cropWidth?: number;
    cropHeight?: number;
  }) =>
    apiClient.put(`${BASE}/pro/profile/images/${id}/adjust`, options).then((r) => r.data),
};
