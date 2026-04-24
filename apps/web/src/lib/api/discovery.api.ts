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
  tags?: string[];
}

const cache = new Map<string, { data: any; ts: number }>();
const inflight = new Map<string, Promise<any>>();
const TTL = 5 * 60_000;
const STORAGE_PREFIX = 'freetiful-discovery-cache:';

function storageGet<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || Date.now() - parsed.ts > TTL) {
      localStorage.removeItem(STORAGE_PREFIX + key);
      return null;
    }
    return parsed.data as T;
  } catch {
    return null;
  }
}

function storageSet(key: string, data: any) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) return Promise.resolve(hit.data as T);
  const stored = storageGet<T>(key);
  if (stored) {
    cache.set(key, { data: stored, ts: Date.now() });
    return Promise.resolve(stored);
  }
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fetcher().then((data) => {
    cache.set(key, { data, ts: Date.now() });
    storageSet(key, data);
    inflight.delete(key);
    return data;
  }).catch((e) => { inflight.delete(key); throw e; });
  inflight.set(key, p);
  return p;
}

export function getCachedProDetail(id: string): any | null {
  const hit = cache.get(`detail:${id}`);
  if (hit && Date.now() - hit.ts < TTL) return hit.data;
  return storageGet(`detail:${id}`);
}

export function getCachedProPreview(id: string): ProListItem | null {
  const findInPayload = (payload: any): ProListItem | null => {
    const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    return rows.find((item: any) => item?.id === id) || null;
  };

  for (const [key, value] of cache.entries()) {
    if (!key.startsWith('list:') || Date.now() - value.ts >= TTL) continue;
    const found = findInPayload(value.data);
    if (found) return found;
  }

  if (typeof window === 'undefined') return null;
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(STORAGE_PREFIX + 'list:')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!parsed?.ts || Date.now() - parsed.ts > TTL) continue;
      const found = findInPayload(parsed.data);
      if (found) return found;
    }
  } catch {}
  return null;
}

export function invalidateProCache(id?: string) {
  if (id) {
    cache.delete(`detail:${id}`);
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_PREFIX + `detail:${id}`);
    return;
  }
  // id 없으면 모든 detail + list 캐시 삭제
  const keys = Array.from(cache.keys());
  keys.forEach((k) => {
    if (k.startsWith('list:') || k.startsWith('detail:')) cache.delete(k);
  });
  if (typeof window !== 'undefined') {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  }
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
    region?: string;
  }) => {
    const key = `list:${JSON.stringify(params || {})}`;
    return cached(key, () => apiClient.get<{ data: ProListItem[]; total: number; hasMore: boolean }>(`${BASE}/pros`, { params }).then((r) => r.data));
  },

  getProDetail: (id: string, skipCache = false) => {
    if (skipCache) cache.delete(`detail:${id}`);
    return cached(`detail:${id}`, () => apiClient.get(`${BASE}/pros/${id}`).then((r) => r.data));
  },
};
