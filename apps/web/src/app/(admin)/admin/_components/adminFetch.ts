import { apiClient } from '@/lib/api/client';

type AdminFetchOptions = {
  cache?: boolean;
  cacheTtl?: number;
};

const DEFAULT_GET_CACHE_TTL = 12_000;
const getCache = new Map<string, { data: any; expires: number }>();
const inFlightGets = new Map<string, Promise<any>>();

function getCacheKey(path: string) {
  const adminKey = (typeof window !== 'undefined' && localStorage.getItem('admin-key')) || '';
  return `${adminKey ? 'admin-key' : 'jwt'}:${path}`;
}

export function clearAdminFetchCache(prefix?: string) {
  if (!prefix) {
    getCache.clear();
    inFlightGets.clear();
    return;
  }
  for (const key of Array.from(getCache.keys())) {
    if (key.includes(prefix)) getCache.delete(key);
  }
  for (const key of Array.from(inFlightGets.keys())) {
    if (key.includes(prefix)) inFlightGets.delete(key);
  }
}

/**
 * 어드민 API 요청 헬퍼
 * - JWT는 apiClient 인터셉터로 자동 전송
 * - localStorage.admin-key 있으면 x-admin-key 헤더도 함께 전송 (구 백엔드 호환)
 * - 404 발생 시 `/api/v1/<path>` → `/api/v1/api/v1/<path>` 로 자동 재시도 (구 백엔드가 double-prefix로 서빙 중일 때)
 * - GET 요청은 짧게 메모리 캐싱 + in-flight dedupe 하여 페이지 왕복/필터 재진입 체감 속도를 줄임
 */
export async function adminFetch(method: string, path: string, body?: any, options: AdminFetchOptions = {}) {
  const normalizedMethod = method.toUpperCase();
  const isGet = normalizedMethod === 'GET';
  const shouldCache = isGet && options.cache !== false;
  const cacheKey = shouldCache ? getCacheKey(path) : '';
  if (shouldCache) {
    const cached = getCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.data;
    const pending = inFlightGets.get(cacheKey);
    if (pending) return pending;
  }

  const headers: Record<string, string> = {};
  const adminKey = (typeof window !== 'undefined' && localStorage.getItem('admin-key')) || '';
  if (adminKey) headers['x-admin-key'] = adminKey;

  const request = async () => {
    try {
      const res = await apiClient.request({ method: normalizedMethod, url: path, data: body, headers });
      return res.data;
    } catch (e: any) {
      const status = e?.response?.status;
      // 404 이면서 admin 경로일 때 — double-prefix 폴백 재시도
      if (status === 404 && path.includes('/api/v1/admin/')) {
        const fallback = path.replace('/api/v1/admin/', '/api/v1/api/v1/admin/');
        try {
          const res = await apiClient.request({ method: normalizedMethod, url: fallback, data: body, headers });
          return res.data;
        } catch (e2) {
          throw e2;
        }
      }
      throw e;
    }
  };

  if (!shouldCache) {
    const data = await request();
    if (!isGet) clearAdminFetchCache();
    return data;
  }

  const promise = request()
    .then((data) => {
      getCache.set(cacheKey, {
        data,
        expires: Date.now() + (options.cacheTtl ?? DEFAULT_GET_CACHE_TTL),
      });
      if (getCache.size > 80) {
        const oldest = getCache.keys().next().value;
        if (oldest) getCache.delete(oldest);
      }
      return data;
    })
    .finally(() => {
      inFlightGets.delete(cacheKey);
    });

  inFlightGets.set(cacheKey, promise);
  return promise;
}
