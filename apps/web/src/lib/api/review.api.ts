import { apiClient } from './client';

const BASE = '/api/v1/review';

export interface CreateReviewData {
  proProfileId: string;
  paymentId: string;
  ratingSatisfaction: number;
  ratingComposition: number;
  ratingExperience: number;
  ratingAppearance: number;
  ratingVoice: number;
  ratingWit: number;
  comment?: string;
  isAnonymous?: boolean;
}

export const reviewApi = {
  create: (data: CreateReviewData) =>
    apiClient.post(`${BASE}`, data).then((r) => r.data),

  getByPro: (proProfileId: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`${BASE}/pro/${proProfileId}`, { params }).then((r) => r.data),

  reply: (reviewId: string, reply: string) =>
    apiClient.post(`${BASE}/${reviewId}/reply`, { reply }).then((r) => r.data),

  getMine: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${BASE}/mine`, { params }).then((r) => r.data),
};
