import { apiClient } from './client';
import { updateCachedProFavoriteCount } from './discovery.api';

const BASE = '/api/v1/favorite';

// 세션 캐시 (탭 이동 시 즉시 렌더용) + 동시 호출 dedupe
let listCache: any | null = null;
let listInFlight: Promise<any> | null = null;
const FAVORITES_STORAGE_KEY = 'freetiful-favorites-list-cache-v1';
const FAVORITE_IDS_STORAGE_KEY = 'freetiful-favorites';
const HOME_PROS_CACHE_KEY = 'freetiful-pros-cache-v4';
const FAVORITE_CHANGED_EVENT = 'freetiful:favorite-changed';
const FAVORITES_STORAGE_TTL = 10 * 60_000;

type FavoriteListParams = { page?: number; limit?: number; withTotal?: boolean };
type FavoriteListOptions = { force?: boolean };
export type FavoriteChangeDetail = {
  proProfileId: string;
  isFavorited: boolean;
  favoriteCount?: number;
  delta?: number;
  source?: string;
};

export function readStoredFavoriteIds() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITE_IDS_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function writeStoredFavoriteIds(ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FAVORITE_IDS_STORAGE_KEY, JSON.stringify(Array.from(new Set(ids))));
  } catch {}
}

export function syncStoredFavoriteId(proProfileId: string, isFavorited: boolean) {
  const ids = readStoredFavoriteIds();
  const next = isFavorited
    ? (ids.includes(proProfileId) ? ids : [...ids, proProfileId])
    : ids.filter((id) => id !== proProfileId);
  writeStoredFavoriteIds(next);
  invalidateFavoritesCache();
  return next;
}

export function emitFavoriteChange(detail: FavoriteChangeDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<FavoriteChangeDetail>(FAVORITE_CHANGED_EVENT, { detail }));
}

export function subscribeFavoriteChanges(handler: (detail: FavoriteChangeDetail) => void) {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => handler((event as CustomEvent<FavoriteChangeDetail>).detail);
  window.addEventListener(FAVORITE_CHANGED_EVENT, listener);
  return () => window.removeEventListener(FAVORITE_CHANGED_EVENT, listener);
}

function patchFavoriteCount(current: unknown, change: { favoriteCount?: number; delta?: number }) {
  const base = typeof current === 'number' && Number.isFinite(current) ? current : 0;
  const next = typeof change.favoriteCount === 'number' ? change.favoriteCount : base + (change.delta ?? 0);
  return Math.max(0, next);
}

function patchHomeProsCache(proProfileId: string, change: { favoriteCount?: number; delta?: number }) {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(HOME_PROS_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    let resolvedCount: number | undefined;
    const next = parsed.map((item: any) => {
      if (!item || item.id !== proProfileId) return item;
      const favoriteCount = patchFavoriteCount(item.favoriteCount ?? item.pudding, change);
      resolvedCount = favoriteCount;
      return { ...item, favoriteCount };
    });
    if (typeof resolvedCount === 'number') {
      localStorage.setItem(HOME_PROS_CACHE_KEY, JSON.stringify(next));
    }
    return resolvedCount;
  } catch {
    return undefined;
  }
}

export function applyFavoriteCountToLocalCaches(proProfileId: string, change: { favoriteCount?: number; delta?: number }) {
  const discoveryCount = updateCachedProFavoriteCount(proProfileId, change);
  const homeCount = patchHomeProsCache(proProfileId, typeof discoveryCount === 'number' ? { favoriteCount: discoveryCount } : change);
  return typeof discoveryCount === 'number' ? discoveryCount : homeCount;
}

function readStoredFavorites() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || Date.now() - parsed.ts > FAVORITES_STORAGE_TTL) {
      localStorage.removeItem(FAVORITES_STORAGE_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeStoredFavorites(data: any) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

function getFavoriteIdsFromPayload(data: any) {
  const items = Array.isArray(data?.items) ? data.items : [];
  return items
    .map((item: any) => item?.proProfile?.id || item?.proProfileId || item?.targetId)
    .filter((id: unknown): id is string => typeof id === 'string');
}

function isFavoritesPayloadConsistentWithLocalIds(data: any) {
  const localIds = readStoredFavoriteIds();
  if (localIds.length === 0) return true;
  const payloadIds = new Set(getFavoriteIdsFromPayload(data));
  return localIds.every((id) => payloadIds.has(id));
}

export function getCachedFavoritesList() {
  if (listCache) {
    if (isFavoritesPayloadConsistentWithLocalIds(listCache)) return listCache;
    invalidateFavoritesCache();
  }
  const stored = readStoredFavorites();
  if (stored && isFavoritesPayloadConsistentWithLocalIds(stored)) {
    listCache = stored;
    return stored;
  }
  if (stored) invalidateFavoritesCache();
  return null;
}
export function invalidateFavoritesCache() {
  listCache = null;
  listInFlight = null;
  if (typeof window !== 'undefined') {
    try { localStorage.removeItem(FAVORITES_STORAGE_KEY); } catch {}
  }
}

export function removeFavoriteFromCachedList(proProfileId: string) {
  if (!Array.isArray(listCache?.items)) return;
  listCache = {
    ...listCache,
    items: listCache.items.filter((item: any) => item?.proProfile?.id !== proProfileId && item?.proProfileId !== proProfileId),
  };
  writeStoredFavorites(listCache);
}

function fetchFavoritesList(params?: FavoriteListParams) {
  if (listInFlight) return listInFlight;
  listInFlight = apiClient.get(`${BASE}`, { params }).then((r) => {
    listCache = r.data;
    listInFlight = null;
    writeStoredFavorites(r.data);
    return r.data;
  }).catch((e) => { listInFlight = null; throw e; });
  return listInFlight;
}

export const favoriteApi = {
  toggle: (proProfileId: string) => {
    invalidateFavoritesCache();
    return apiClient.post<{ isFavorited: boolean; favoriteCount?: number }>(`${BASE}/${proProfileId}`).then((r) => {
      syncStoredFavoriteId(proProfileId, r.data.isFavorited);
      applyFavoriteCountToLocalCaches(proProfileId, { favoriteCount: r.data.favoriteCount });
      emitFavoriteChange({
        proProfileId,
        isFavorited: r.data.isFavorited,
        favoriteCount: r.data.favoriteCount,
        source: 'favorite-api',
      });
      return r.data;
    });
  },

  remove: (proProfileId: string) => {
    syncStoredFavoriteId(proProfileId, false);
    return apiClient.delete<{ isFavorited: boolean; favoriteCount?: number }>(`${BASE}/${proProfileId}`).then((r) => {
      removeFavoriteFromCachedList(proProfileId);
      applyFavoriteCountToLocalCaches(proProfileId, { favoriteCount: r.data.favoriteCount });
      emitFavoriteChange({
        proProfileId,
        isFavorited: false,
        favoriteCount: r.data.favoriteCount,
        source: 'favorite-api',
      });
      return r.data;
    });
  },

  getList: (params?: FavoriteListParams, options?: FavoriteListOptions) => {
    if (options?.force) return fetchFavoritesList(params);

    // 캐시 있으면 바로 반환 + 백그라운드 refresh
    if (listCache && isFavoritesPayloadConsistentWithLocalIds(listCache)) {
      fetchFavoritesList(params).catch(() => {});
      return Promise.resolve(listCache);
    }
    const stored = readStoredFavorites();
    if (stored && isFavoritesPayloadConsistentWithLocalIds(stored)) {
      listCache = stored;
      fetchFavoritesList(params).catch(() => {});
      return Promise.resolve(stored);
    }
    return fetchFavoritesList(params);
  },

  check: (proProfileId: string) =>
    apiClient.get<{ isFavorited: boolean }>(`${BASE}/${proProfileId}/check`).then((r) => r.data),
};
