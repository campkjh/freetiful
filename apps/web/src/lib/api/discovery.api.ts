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
  favoriteCount: number;
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

export function getCachedProSearchPool(): ProListItem[] {
  const seen = new Set<string>();
  const rows: ProListItem[] = [];
  const addRows = (payload: any) => {
    getRowsFromListPayload(payload).forEach((item) => {
      if (!item?.id || seen.has(item.id)) return;
      seen.add(item.id);
      rows.push(item);
    });
  };

  const now = Date.now();
  cache.forEach((value, key) => {
    if (!key.startsWith('list:') || now - value.ts >= TTL) return;
    addRows(value.data);
  });

  if (typeof window !== 'undefined') {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (!key.startsWith(STORAGE_PREFIX + 'list:')) return;
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed?.ts || now - parsed.ts > TTL) return;
        addRows(parsed.data);
      });
    } catch {}
  }

  return rows;
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

type FavoriteCountChange = {
  favoriteCount?: number;
  delta?: number;
};

function patchFavoriteCountValue(current: unknown, change: FavoriteCountChange) {
  const base = typeof current === 'number' && Number.isFinite(current) ? current : 0;
  const next = typeof change.favoriteCount === 'number'
    ? change.favoriteCount
    : base + (change.delta ?? 0);
  return Math.max(0, next);
}

function patchFavoriteCountPayload(payload: any, proProfileId: string, change: FavoriteCountChange): { data: any; changed: boolean; count?: number } {
  let changed = false;
  let resolvedCount: number | undefined;

  const patchItem = (item: any) => {
    if (!item || item.id !== proProfileId) return item;
    const favoriteCount = patchFavoriteCountValue(item.favoriteCount, change);
    resolvedCount = favoriteCount;
    changed = true;
    return { ...item, favoriteCount };
  };

  if (Array.isArray(payload)) {
    return { data: payload.map(patchItem), changed, count: resolvedCount };
  }

  if (Array.isArray(payload?.data)) {
    return { data: { ...payload, data: payload.data.map(patchItem) }, changed, count: resolvedCount };
  }

  if (payload?.id === proProfileId) {
    const favoriteCount = patchFavoriteCountValue(payload.favoriteCount, change);
    return { data: { ...payload, favoriteCount }, changed: true, count: favoriteCount };
  }

  return { data: payload, changed: false };
}

export function updateCachedProFavoriteCount(proProfileId: string, change: FavoriteCountChange) {
  let resolvedCount: number | undefined;
  const now = Date.now();

  const preview = previewCache.get(proProfileId);
  if (preview && now - preview.ts < TTL) {
    const favoriteCount = patchFavoriteCountValue(preview.data.favoriteCount, change);
    previewCache.set(proProfileId, { data: { ...preview.data, favoriteCount }, ts: now });
    resolvedCount = favoriteCount;
  }

  cache.forEach((value, key) => {
    if (!key.startsWith('list:') && key !== `detail:${proProfileId}`) return;
    const patched = patchFavoriteCountPayload(value.data, proProfileId, change);
    if (!patched.changed) return;
    cache.set(key, { data: patched.data, ts: value.ts });
    if (typeof patched.count === 'number') resolvedCount = patched.count;
  });

  if (typeof window !== 'undefined') {
    try {
      Object.keys(localStorage).forEach((storageKey) => {
        if (!storageKey.startsWith(STORAGE_PREFIX)) return;
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed?.ts || !('data' in parsed)) return;
        const cacheKey = storageKey.slice(STORAGE_PREFIX.length);
        if (!cacheKey.startsWith('list:') && cacheKey !== `detail:${proProfileId}`) return;
        const patched = patchFavoriteCountPayload(parsed.data, proProfileId, change);
        if (!patched.changed) return;
        localStorage.setItem(storageKey, JSON.stringify({ ...parsed, data: patched.data }));
        if (typeof patched.count === 'number') resolvedCount = patched.count;
      });
    } catch {}
  }

  return resolvedCount;
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
  realtime?: boolean;
};

export const discoveryApi = {
  getDailyRecommendation: () =>
    cached('daily', () => apiClient.get<RecommendedPro>(`${BASE}/recommendation/daily`).then((r) => r.data)),

  getProList: (params?: ProListParams) => {
    const { realtime, ...requestParams } = params || {};
    if (realtime) {
      const realtimeParams: Record<string, any> = { ...requestParams, _t: Date.now() };
      if (requestParams.sort === 'pudding') {
        const requestedLimit = Number(requestParams.limit) || 20;
        const limitRange = Math.max(1, 101 - Math.min(requestedLimit, 100));
        const limitOffset = requestedLimit < 100 ? Math.floor(Date.now() / 20_000) % limitRange : 0;
        realtimeParams.limit = Math.min(100, requestedLimit + limitOffset);
        realtimeParams.page = requestParams.page ?? 1;
        realtimeParams.region = requestParams.region ?? '전국';
      }
      return apiClient.get<{ data: ProListItem[]; total: number; hasMore: boolean }>(`${BASE}/pros`, {
        params: realtimeParams,
      }).then((r) => {
        indexProPreviews(r.data);
        return r.data;
      });
    }
    const key = `list:${JSON.stringify(requestParams || {})}`;
    return cached(key, () => apiClient.get<{ data: ProListItem[]; total: number; hasMore: boolean }>(`${BASE}/pros`, { params: requestParams }).then((r) => r.data));
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
