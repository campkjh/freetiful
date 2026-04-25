import axios from 'axios';
import { useAuthStore } from '@/lib/store/auth.store';

type AdminFetchOptions = {
  cache?: boolean;
  cacheTtl?: number;
};

const DEFAULT_GET_CACHE_TTL = 12_000;
const getCache = new Map<string, { data: any; expires: number }>();
const inFlightGets = new Map<string, Promise<any>>();

function getCacheKey(path: string) {
  const adminKey = (typeof window !== 'undefined' && localStorage.getItem('admin-key')) || '';
  const user = useAuthStore.getState().user;
  const scope = adminKey ? 'admin-key' : `jwt:${user?.id || user?.email || 'anonymous'}`;
  return `${scope}:${path}`;
}

function detectAdminClientPlatform() {
  if (typeof window === 'undefined') return 'web';
  const w = window as any;
  const ua = window.navigator.userAgent || '';
  if (w.webkit?.messageHandlers || /iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (w.Android || w.FreetifulAndroid || /Android/i.test(ua)) return 'android';
  return 'web';
}

function buildAdminHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-platform': detectAdminClientPlatform(),
  };
  const adminKey = (typeof window !== 'undefined' && localStorage.getItem('admin-key')) || '';
  const token = useAuthStore.getState().accessToken;
  if (adminKey) headers['x-admin-key'] = adminKey;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function refreshAdminAccessToken() {
  const store = useAuthStore.getState();
  const currentRefreshToken = store.refreshToken;
  if (!currentRefreshToken) return null;
  try {
    const res = await axios.post('/api/v1/auth/refresh', { refreshToken: currentRefreshToken }, { timeout: 15000 });
    const { accessToken, refreshToken } = res.data?.tokens || {};
    if (!accessToken) return null;
    store.setTokens(accessToken, refreshToken || currentRefreshToken);
    return accessToken as string;
  } catch {
    return null;
  }
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
 * - 관리자 화면에서는 전역 apiClient 401 리다이렉트를 타지 않도록 직접 Authorization 헤더를 붙임
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

  const performRequest = async (url: string, headers = buildAdminHeaders()) => {
    const res = await axios.request({
      method: normalizedMethod,
      url,
      data: body,
      headers,
      timeout: 20000,
    });
    return res.data;
  };

  const request = async () => {
    const headers = buildAdminHeaders();
    try {
      return await performRequest(path, headers);
    } catch (e: any) {
      const status = e?.response?.status;
      const hasAdminKey = !!headers['x-admin-key'];
      if (status === 401 && !hasAdminKey && headers.Authorization) {
        const refreshedToken = await refreshAdminAccessToken();
        if (refreshedToken) {
          return performRequest(path, { ...headers, Authorization: `Bearer ${refreshedToken}` });
        }
      }

      // 404 이면서 admin 경로일 때 — double-prefix 폴백 재시도
      if (status === 404 && path.includes('/api/v1/admin/')) {
        const fallback = path.replace('/api/v1/admin/', '/api/v1/api/v1/admin/');
        try {
          return await performRequest(fallback, headers);
        } catch (e2) {
          throw e2;
        }
      }
      if (status === 401 || status === 403) clearAdminFetchCache();
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
