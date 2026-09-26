import { apiClient } from './client';

const BASE = '/api/v1/review';

export interface CreateReviewData {
  proProfileId: string;
  paymentId?: string;
  ratingSatisfaction: number;
  ratingComposition: number;
  ratingExperience: number;
  ratingAppearance: number;
  ratingVoice: number;
  ratingWit: number;
  comment?: string;
  photos?: string[];
  isAnonymous?: boolean;
}

export const reviewApi = {
  create: (data: CreateReviewData) =>
    apiClient.post(`${BASE}`, data).then((r) => r.data),

  getByPro: (proProfileId: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`${BASE}/pro/${proProfileId}`, { params }).then((r) => r.data),

  /** 사회자 리뷰 요약(스타일 소개) — 실제 리뷰만 AI 요약, 리뷰가 2개 미만이면 data=null */
  getSummary: (proProfileId: string) =>
    apiClient
      .get<{ data: { summary: string; keywords: string[]; source: 'ai' | 'rule'; reviewCount: number } | null }>(`${BASE}/pro/${proProfileId}/summary`, { timeout: 15000 })
      .then((r) => r.data?.data ?? null),

  reply: (reviewId: string, reply: string) =>
    apiClient.post(`${BASE}/${reviewId}/reply`, { reply }).then((r) => r.data),

  getMine: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${BASE}/mine`, { params }).then((r) => r.data),
};
