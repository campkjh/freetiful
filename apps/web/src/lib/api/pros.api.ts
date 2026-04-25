import { apiClient } from './client';
import type { ProProfile, User } from '@prettyful/types';

const BASE = '/api/v1';

export interface ProfileHandoverCandidate {
  id: string;
  ownerUserId: string;
  isMine: boolean;
  name: string;
  profileImageUrl: string | null;
  shortIntro: string | null;
  mainExperience: string | null;
  careerYears: number | null;
  avgRating: number;
  reviewCount: number;
  basePrice: number | null;
  categories: string[];
}

// 읽기(list/get/reviews 등)는 discoveryApi 에서 처리함.
// 이 파일은 "내 프로 프로필" 쓰기 작업 전용.
export const prosApi = {
  getMyProfile: () =>
    apiClient.get<ProProfile | null>(`${BASE}/pro/profile`).then((r) => r.data),

  getProfileHandoverCandidates: (params?: { search?: string; limit?: number }) =>
    apiClient
      .get<ProfileHandoverCandidate[]>(`${BASE}/pro/profile-handover/candidates`, { params })
      .then((r) => r.data),

  claimProfileHandover: (proProfileId: string) =>
    apiClient
      .post<{ user: User; profile: ProProfile }>(`${BASE}/pro/profile-handover/${proProfileId}/claim`)
      .then((r) => r.data),

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
    tags?: string[];
  }) =>
    apiClient.post(`${BASE}/pro/register`, data, { timeout: 60000 }).then((r) => r.data),

  updateMyProfile: (data: {
    shortIntro?: string;
    mainExperience?: string;
    careerYears?: number;
    awards?: string;
    detailHtml?: string;
    youtubeUrl?: string;
    gender?: string;
    isNationwide?: boolean;
    isProfileHidden?: boolean;
  }) =>
    apiClient.put(`${BASE}/pro/profile`, data).then((r) => r.data),

  updateProfileVisibility: (isProfileHidden: boolean) =>
    apiClient
      .put(`${BASE}/pro/profile/visibility`, { isProfileHidden })
      .then((r) => r.data)
      .catch((error) => {
        const status = error?.response?.status;
        if (status === 404 || status === 405) {
          return apiClient
            .put(`${BASE}/pro/profile`, { isProfileHidden })
            .then((r) => r.data);
        }
        throw error;
      }),

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
