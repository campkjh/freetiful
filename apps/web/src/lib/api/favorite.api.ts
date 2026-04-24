import { apiClient } from './client';

const BASE = '/api/v1/favorite';

// 세션 캐시 (탭 이동 시 즉시 렌더용) + 동시 호출 dedupe
let listCache: any | null = null;
let listInFlight: Promise<any> | null = null;
const FAVORITES_STORAGE_KEY = 'freetiful-favorites-list-cache-v1';
const FAVORITES_STORAGE_TTL = 10 * 60_000;

type FavoriteListParams = { page?: number; limit?: number; withTotal?: boolean };
type FavoriteListOptions = { force?: boolean };

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

export function getCachedFavoritesList() {
  if (listCache) return listCache;
  const stored = readStoredFavorites();
  if (stored) listCache = stored;
  return stored;
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
  toggle: (proProfileId: string) =>
    apiClient.post<{ isFavorited: boolean }>(`${BASE}/${proProfileId}`).then((r) => {
      invalidateFavoritesCache(); // 찜 추가/제거 시 캐시 무효화
      return r.data;
    }),

  remove: (proProfileId: string) =>
    apiClient.delete<{ isFavorited: boolean }>(`${BASE}/${proProfileId}`).then((r) => {
      removeFavoriteFromCachedList(proProfileId);
      return r.data;
    }),

  getList: (params?: FavoriteListParams, options?: FavoriteListOptions) => {
    if (options?.force) return fetchFavoritesList(params);

    // 캐시 있으면 바로 반환 + 백그라운드 refresh
    if (listCache) {
      fetchFavoritesList(params).catch(() => {});
      return Promise.resolve(listCache);
    }
    const stored = readStoredFavorites();
    if (stored) {
      listCache = stored;
      fetchFavoritesList(params).catch(() => {});
      return Promise.resolve(stored);
    }
    return fetchFavoritesList(params);
  },

  check: (proProfileId: string) =>
    apiClient.get<{ isFavorited: boolean }>(`${BASE}/${proProfileId}/check`).then((r) => r.data),
};
