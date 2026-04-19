import { apiClient } from './client';

const BASE = '/api/v1/favorite';

// 세션 캐시 (탭 이동 시 즉시 렌더용) + 동시 호출 dedupe
let listCache: any | null = null;
let listInFlight: Promise<any> | null = null;
export function getCachedFavoritesList() {
  return listCache;
}
export function invalidateFavoritesCache() {
  listCache = null;
  listInFlight = null;
}

export const favoriteApi = {
  toggle: (proProfileId: string) =>
    apiClient.post<{ isFavorited: boolean }>(`${BASE}/${proProfileId}`).then((r) => {
      invalidateFavoritesCache(); // 찜 추가/제거 시 캐시 무효화
      return r.data;
    }),

  getList: (params?: { page?: number; limit?: number }) => {
    // 캐시 있으면 바로 반환 + 백그라운드 refresh
    if (listCache) {
      if (!listInFlight) {
        listInFlight = apiClient.get(`${BASE}`, { params }).then((r) => {
          listCache = r.data;
          listInFlight = null;
          return r.data;
        }).catch((e) => { listInFlight = null; throw e; });
      }
      return Promise.resolve(listCache);
    }
    if (listInFlight) return listInFlight;
    listInFlight = apiClient.get(`${BASE}`, { params }).then((r) => {
      listCache = r.data;
      listInFlight = null;
      return r.data;
    }).catch((e) => { listInFlight = null; throw e; });
    return listInFlight;
  },

  check: (proProfileId: string) =>
    apiClient.get<{ isFavorited: boolean }>(`${BASE}/${proProfileId}/check`).then((r) => r.data),
};
