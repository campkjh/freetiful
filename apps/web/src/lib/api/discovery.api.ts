import { apiClient } from './client';

const BASE = '/api/v1/discovery';

export interface RecommendedPro {
  id: string;
  userId: string;
  name: string;
  image: string;
  shortIntro: string;
  avgRating: number;
  reviewCount: number;
  careerYears: number;
  basePrice: number;
}

export interface ProListItem {
  id: string;
  userId: string;
  name: string;
  profileImageUrl: string;
  images: string[];
  shortIntro: string;
  mainExperience: string;
  avgRating: number;
  reviewCount: number;
  careerYears: number;
  basePrice: number;
  isFeatured: boolean;
  puddingCount: number;
  gender: string;
  youtubeUrl: string | null;
}

export const discoveryApi = {
  getDailyRecommendation: () =>
    apiClient.get<RecommendedPro>(`${BASE}/recommendation/daily`).then((r) => r.data),

  getProList: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: 'rating' | 'reviews' | 'price' | 'experience' | 'pudding' | 'newest';
    gender?: string;
    featured?: boolean;
  }) =>
    apiClient.get<{ data: ProListItem[]; total: number; hasMore: boolean }>(`${BASE}/pros`, { params }).then((r) => r.data),

  getProDetail: (id: string) =>
    apiClient.get(`${BASE}/pros/${id}`).then((r) => r.data),
};
