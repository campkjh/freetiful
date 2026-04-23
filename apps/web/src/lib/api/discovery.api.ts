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
  isNationwide?: boolean;
  categories?: string[];
  regions?: string[];
  languages?: string[];
}

const cache = new Map<string, { data: any; ts: number }>();
const inflight = new Map<string, Promise<any>>();
const TTL = 60_000; // 1분 (편집 반영 빠르게)

function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) return Promise.resolve(hit.data as T);
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fetcher().then((data) => {
    cache.set(key, { data, ts: Date.now() });
    inflight.delete(key);
    return data;
  }).catch((e) => { inflight.delete(key); throw e; });
  inflight.set(key, p);
  return p;
}

export function getCachedProDetail(id: string): any | null {
  const hit = cache.get(`detail:${id}`);
  return hit && Date.now() - hit.ts < TTL ? hit.data : null;
}

export function invalidateProCache(id?: string) {
  if (id) {
    cache.delete(`detail:${id}`);
    return;
  }
  // id 없으면 모든 detail + list 캐시 삭제
  const keys = Array.from(cache.keys());
  keys.forEach((k) => {
    if (k.startsWith('list:') || k.startsWith('detail:')) cache.delete(k);
  });
}

export const discoveryApi = {
  getDailyRecommendation: () =>
    cached('daily', () => apiClient.get<RecommendedPro>(`${BASE}/recommendation/daily`).then((r) => r.data)),

  getProList: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: 'rating' | 'reviews' | 'price' | 'experience' | 'pudding';
    gender?: string;
    featured?: boolean;
  }) => {
    const key = `list:${JSON.stringify(params || {})}`;
    return cached(key, () => apiClient.get<{ data: ProListItem[]; total: number; hasMore: boolean }>(`${BASE}/pros`, { params }).then((r) => r.data));
  },

  getProDetail: (id: string, skipCache = false) => {
    if (skipCache) cache.delete(`detail:${id}`);
    return cached(`detail:${id}`, () => apiClient.get(`${BASE}/pros/${id}`).then((r) => r.data));
  },
};
