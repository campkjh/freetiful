import { apiClient } from './client';
import { useAuthStore } from '../store/auth.store';
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

  // 소개영상 직접 업로드 (100MB, 원본 저장 → /uploads URL). 대용량이라 Vercel 프록시 502 회피
  // 위해 채팅 미디어와 동일하게 Railway 직행 + axios progress.
  uploadVideo: (
    file: File,
    config?: { onUploadProgress?: (e: { loaded: number; total?: number }) => void },
  ) => {
    const form = new FormData();
    form.append('file', file, file.name || 'video');
    const DIRECT = process.env.NEXT_PUBLIC_DIRECT_API_URL || 'https://affectionate-smile-production-6535.up.railway.app';
    return apiClient.post<{ url: string }>(
      `${DIRECT}${BASE}/pro/profile/video`,
      form,
      { headers: { 'Content-Type': null as any }, timeout: 300000, onUploadProgress: config?.onUploadProgress },
    ).then((r) => r.data);
  },

  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const token = useAuthStore.getState().accessToken;
    // 60초 timeout — 모바일 저속 네트워크에서 fetch 가 영원히 hang 되는 경우 방지
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 60_000);
    return fetch(`${BASE}/pro/profile/images`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'x-platform': 'web',
      },
      body: form,
      signal: ac.signal,
    }).then(async (response) => {
      clearTimeout(timer);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.message || data?.error || '프로필 이미지를 업로드하지 못했습니다.';
        throw new Error(Array.isArray(message) ? message.join(', ') : message);
      }
      return data;
    }).catch((e) => {
      clearTimeout(timer);
      if (e?.name === 'AbortError') throw new Error('업로드 시간 초과 (60s)');
      throw e;
    });
  },

  getImages: () =>
    apiClient.get(`${BASE}/pro/profile/images`).then((r) => r.data),

  deleteImage: (id: string) =>
    apiClient.delete(`${BASE}/pro/profile/images/${id}`),

  reorderImages: (ids: string[], primaryId?: string) =>
    apiClient.put(`${BASE}/pro/profile/images/reorder`, { ids, primaryId }).then((r) => r.data),

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
