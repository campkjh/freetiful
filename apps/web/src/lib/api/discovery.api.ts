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
const STORAGE_PREFIX = 'freetiful-discovery-cache:v2:';

function normalizePublicProPrices<T>(payload: T): T {
  if (Array.isArray(payload)) {
    return payload.map((item) => normalizePublicProPrices(item)) as T;
  }

  if (!payload || typeof payload !== 'object') return payload;

  const source = payload as Record<string, any>;
  let next: Record<string, any> = source;

  if ('basePrice' in source) {
    next = { ...next, basePrice: 0 };
  }

  if (Array.isArray(source.services)) {
    next = {
      ...next,
      services: source.services.map((service) => ({
        ...service,
        basePrice: 0,
      })),
    };
  }

  if (Array.isArray(source.data)) {
    next = {
      ...next,
      data: normalizePublicProPrices(source.data),
    };
  }

  return next as T;
}

function getRowsFromListPayload(payload: any): ProListItem[] {
  return Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
}

function indexProPreviews(payload: any, ts = Date.now()) {
  const rows = getRowsFromListPayload(normalizePublicProPrices(payload));
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
    return normalizePublicProPrices(parsed.data as T);
  } catch {
    return null;
  }
}

function storageSet(key: string, data: any) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ data: normalizePublicProPrices(data), ts: Date.now() }));
  } catch {}
}

// 캐시 응답 시 백그라운드 재검증 간격 — 프로필 수정이 다른 사용자에게도 빠르게 보이도록
const REVALIDATE_AFTER = 20_000;

function backgroundRevalidate<T>(key: string, fetcher: () => Promise<T>) {
  if (inflight.has(key)) return;
  const p = fetcher().then((data) => {
    const normalized = normalizePublicProPrices(data);
    cache.set(key, { data: normalized, ts: Date.now() });
    if (key.startsWith('list:')) indexProPreviews(normalized);
    storageSet(key, normalized);
    inflight.delete(key);
    return normalized;
  }).catch(() => { inflight.delete(key); }) as Promise<T>;
  inflight.set(key, p);
}

function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) {
    // stale-while-revalidate: 즉시 캐시 반환 + 오래됐으면 백그라운드 갱신
    if (Date.now() - hit.ts > REVALIDATE_AFTER) backgroundRevalidate(key, fetcher);
    return Promise.resolve(normalizePublicProPrices(hit.data as T));
  }
  const stored = storageGet<T>(key);
  if (stored) {
    const ts = Date.now();
    cache.set(key, { data: stored, ts });
    if (key.startsWith('list:')) indexProPreviews(stored, ts);
    backgroundRevalidate(key, fetcher);   // 디스크 캐시는 이전 세션 데이터 — 항상 백그라운드 갱신
    return Promise.resolve(stored);
  }
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fetcher().then((data) => {
    const normalized = normalizePublicProPrices(data);
    cache.set(key, { data: normalized, ts: Date.now() });
    if (key.startsWith('list:')) indexProPreviews(normalized);
    storageSet(key, normalized);
    inflight.delete(key);
    return normalized;
  }).catch((e) => { inflight.delete(key); throw e; });
  inflight.set(key, p);
  return p;
}

export function getCachedProDetail(id: string): any | null {
  const hit = cache.get(`detail:${id}`);
  if (hit && Date.now() - hit.ts < TTL) return normalizePublicProPrices(hit.data);
  return storageGet(`detail:${id}`);
}

export function getCachedProList(params?: ProListParams): { data: ProListItem[]; total: number; hasMore: boolean } | null {
  const key = `list:${JSON.stringify(params || {})}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) return normalizePublicProPrices(hit.data);
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
    getRowsFromListPayload(normalizePublicProPrices(payload)).forEach((item) => {
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
  previewCache.set(item.id, { data: normalizePublicProPrices(item), ts: Date.now() });
}

// 프로필 수정 후 CDN(s-maxage) 우회용 버전 — 이 기기의 다음 요청부터 URL 이 바뀌어 엣지 캐시를 통과
const CACHE_BUST_KEY = 'freetiful-pros-cache-bust';
function cacheBust(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try { return localStorage.getItem(CACHE_BUST_KEY) || undefined; } catch { return undefined; }
}

export function invalidateProCache(id?: string) {
  if (typeof window !== 'undefined') {
    try { localStorage.setItem(CACHE_BUST_KEY, String(Date.now())); } catch {}
  }
  if (id) {
    cache.delete(`detail:${id}`);
    previewCache.delete(id);
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_PREFIX + `detail:${id}`);
    return;
  }
  // id 없으면 모든 detail + list + preview + daily 캐시 삭제
  const keys = Array.from(cache.keys());
  keys.forEach((k) => {
    if (k.startsWith('list:') || k.startsWith('detail:')) cache.delete(k);
  });
  cache.delete('daily');
  previewCache.clear();
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
  sort?: 'rating' | 'reviews' | 'price' | 'experience';
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
      return apiClient.get<{ data: ProListItem[]; total: number; hasMore: boolean }>(`${BASE}/pros`, {
        params: realtimeParams,
      }).then((r) => {
        const normalized = normalizePublicProPrices(r.data);
        indexProPreviews(normalized);
        return normalized;
      });
    }
    const key = `list:${JSON.stringify(requestParams || {})}`;
    const bust = cacheBust();
    return cached(key, () => apiClient.get<{ data: ProListItem[]; total: number; hasMore: boolean }>(`${BASE}/pros`, { params: bust ? { ...requestParams, _v: bust } : requestParams }).then((r) => r.data));
  },

  getProDetail: (id: string, skipCache = false) => {
    const key = `detail:${id}`;
    if (skipCache) {
      cache.delete(key);
      if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_PREFIX + key);
      return apiClient.get(`${BASE}/pros/${id}`, { params: { nocache: '1' } }).then((r) => {
        const normalized = normalizePublicProPrices(r.data);
        cache.set(key, { data: normalized, ts: Date.now() });
        storageSet(key, normalized);
        return normalized;
      });
    }
    const bust = cacheBust();
    return cached(key, () => apiClient.get(`${BASE}/pros/${id}`, { params: bust ? { _v: bust } : undefined }).then((r) => r.data));
  },
};
