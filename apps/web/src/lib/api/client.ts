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
      useAuthStore.getState().logout();
      // 어드민이면 admin 로그인으로, 아니면 홈으로 (보호 라우트면 layout이 모달 띄워줌)
      const isOnAdmin = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
      window.location.href = isOnAdmin ? '/admin/login' : '/main';
      return Promise.reject(e);
    } finally {
      failedQueue = [];
      isRefreshing = false;
    }
  },
);
