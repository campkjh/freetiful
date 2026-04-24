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
  showPartnersLogo?: boolean;
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
const previewCache = new Map<string, { data: ProListItem; ts: number }>();
const TTL = 5 * 60_000;
const STORAGE_PREFIX = 'freetiful-discovery-cache:';

function getRowsFromListPayload(payload: any): ProListItem[] {
  return Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
}

function indexProPreviews(payload: any, ts = Date.now()) {
  const rows = getRowsFromListPayload(payload);
  if (rows.length === 0) return;
  rows.forEach((item) => {
    if (item?.id) previewCache.set(item.id, { data: item, ts });
  });
}

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
    const ts = Date.now();
    cache.set(key, { data: stored, ts });
    if (key.startsWith('list:')) indexProPreviews(stored, ts);
    return Promise.resolve(stored);
  }
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fetcher().then((data) => {
    cache.set(key, { data, ts: Date.now() });
    if (key.startsWith('list:')) indexProPreviews(data);
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

export function getCachedProList(params?: ProListParams): { data: ProListItem[]; total: number; hasMore: boolean } | null {
  const key = `list:${JSON.stringify(params || {})}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) return hit.data;
  const stored = storageGet<{ data: ProListItem[]; total: number; hasMore: boolean }>(key);
  if (stored) {
    const ts = Date.now();
    cache.set(key, { data: stored, ts });
    indexProPreviews(stored, ts);
  }
  return stored;
}

export function getCachedProPreview(id: string): ProListItem | null {
  const preview = previewCache.get(id);
  if (preview && Date.now() - preview.ts < TTL) return preview.data;

  for (const [key, value] of cache.entries()) {
    if (!key.startsWith('list:') || Date.now() - value.ts >= TTL) continue;
    indexProPreviews(value.data, value.ts);
    const found = previewCache.get(id);
    if (found) return found.data;
  }

  if (typeof window === 'undefined') return null;
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(STORAGE_PREFIX + 'list:')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!parsed?.ts || Date.now() - parsed.ts > TTL) continue;
      indexProPreviews(parsed.data, parsed.ts);
      const found = previewCache.get(id);
      if (found) return found.data;
    }
  } catch {}
  return null;
}

export function primeProPreview(item: ProListItem) {
  if (!item?.id) return;
  previewCache.set(item.id, { data: item, ts: Date.now() });
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

type ProListParams = {
  page?: number;
  limit?: number;
  search?: string;
  sort?: 'rating' | 'reviews' | 'price' | 'experience' | 'pudding';
  gender?: string;
  minPrice?: number;
  maxPrice?: number;
  featured?: boolean;
  region?: string;
  withTotal?: boolean;
};

export const discoveryApi = {
  getDailyRecommendation: () =>
    cached('daily', () => apiClient.get<RecommendedPro>(`${BASE}/recommendation/daily`).then((r) => r.data)),

  getProList: (params?: ProListParams) => {
    const key = `list:${JSON.stringify(params || {})}`;
    return cached(key, () => apiClient.get<{ data: ProListItem[]; total: number; hasMore: boolean }>(`${BASE}/pros`, { params }).then((r) => r.data));
  },

  getProDetail: (id: string, skipCache = false) => {
    const key = `detail:${id}`;
    if (skipCache) {
      cache.delete(key);
      if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_PREFIX + key);
      return apiClient.get(`${BASE}/pros/${id}`, { params: { nocache: '1' } }).then((r) => {
        cache.set(key, { data: r.data, ts: Date.now() });
        storageSet(key, r.data);
        return r.data;
      });
    }
    return cached(key, () => apiClient.get(`${BASE}/pros/${id}`).then((r) => r.data));
  },
};
