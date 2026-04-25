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

function detectClientPlatform() {
  if (typeof window === 'undefined') return 'web';
  const w = window as any;
  const ua = window.navigator.userAgent || '';
  if (w.webkit?.messageHandlers || /iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (w.Android || w.FreetifulAndroid || /Android/i.test(ua)) return 'android';
  return 'web';
}

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = useAuthStore.getState().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    config.headers['x-platform'] = detectClientPlatform();
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) return Promise.reject(error);

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
      const { accessToken, refreshToken: newRefreshToken } = res.data.tokens;
      store.setTokens(accessToken, newRefreshToken || store.refreshToken!);
      failedQueue.forEach((q) => q.resolve(accessToken));
      original.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(original);
    } catch (e) {
      failedQueue.forEach((q) => q.reject(e));
      // 로그아웃 금지 — refresh 실패해도 사용자가 명시적으로 로그아웃할 때까지 세션 유지.
      // 어드민 경로에서만 로그인 페이지로 보내고, 일반 사용자는 토큰 없이 API만 실패하게 둠.
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
        useAuthStore.getState().logout();
        window.location.href = '/admin/login';
      }
      return Promise.reject(e);
    } finally {
      failedQueue = [];
      isRefreshing = false;
    }
  },
);
