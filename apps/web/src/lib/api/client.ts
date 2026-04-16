import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

// Same-origin 사용 — Next.js rewrites가 /api/* → NEXT_PUBLIC_API_URL (Railway)로 프록시.
// 이렇게 하면 CORS 없이 freetiful.com 내부에서 모든 API 호출 가능.
const API_BASE = '';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = useAuthStore.getState().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

// 이 경로들의 401 은 "자격증명 실패" 이므로 refresh/logout/리다이렉트 인터셉터를 건너뜀
// (소셜 로그인에서 "계정 없음→emailRegister fallback" 분기가 끊기는 문제 방지)
const AUTH_BYPASS_PATHS = [
  '/api/v1/auth/login/',
  '/api/v1/auth/register/',
  '/api/v1/auth/refresh',
];

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const url: string = original?.url || '';
    const isAuthEndpoint = AUTH_BYPASS_PATHS.some((p) => url.includes(p));
    if (error.response?.status !== 401 || original._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => failedQueue.push({ resolve, reject })).then(
        (token) => { original.headers.Authorization = `Bearer ${token}`; return apiClient(original); },
      );
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const store = useAuthStore.getState();
      // Bypass apiClient to avoid recursive 401 loops
      const res = await axios.post(`/api/v1/auth/refresh`, { refreshToken: store.refreshToken });
      const { accessToken } = res.data.tokens;
      store.setTokens(accessToken, store.refreshToken!);
      failedQueue.forEach((q) => q.resolve(accessToken));
      original.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(original);
    } catch (e) {
      failedQueue.forEach((q) => q.reject(e));
      useAuthStore.getState().logout();
      window.location.href = '/main';
      return Promise.reject(e);
    } finally {
      failedQueue = [];
      isRefreshing = false;
    }
  },
);
