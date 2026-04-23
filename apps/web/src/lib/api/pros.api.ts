import { apiClient } from './client';
import type { ProProfile } from '@prettyful/types';

const BASE = '/api/v1';

// 읽기(list/get/reviews 등)는 discoveryApi 에서 처리함.
// 이 파일은 "내 프로 프로필" 쓰기 작업 전용.
export const prosApi = {
  getMyProfile: () =>
    apiClient.get<ProProfile>(`${BASE}/pro/profile`).then((r) => r.data),

  submitRegistration: (data: {
    name?: string;
    phone?: string;
    gender?: string;
    shortIntro?: string;
    mainExperience?: string;
    careerYears?: number;
    awards?: string;
    youtubeUrl?: string;
    detailHtml?: string;
    photos?: string[];
    mainPhotoIndex?: number;
    services?: { title: string; description?: string; basePrice?: number }[];
    faqs?: { question: string; answer: string }[];
    languages?: string[];
    category?: string;
    regions?: string[];
  }) =>
    apiClient.post(`${BASE}/pro/register`, data, { timeout: 60000 }).then((r) => r.data),

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

  // ─── 스케줄 요청 (고객이 구매해서 들어온 대기 요청) ─────────────────────
  getScheduleRequests: () =>
    apiClient.get<any[]>(`${BASE}/pro/schedule-requests`).then((r) => r.data),

  acceptScheduleRequest: (id: string) =>
    apiClient.post(`${BASE}/pro/schedule-requests/${id}/accept`).then((r) => r.data),

  rejectScheduleRequest: (id: string, reason?: string) =>
    apiClient.post(`${BASE}/pro/schedule-requests/${id}/reject`, { reason }).then((r) => r.data),
};
