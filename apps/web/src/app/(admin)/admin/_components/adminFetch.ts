import { apiClient } from '@/lib/api/client';

/**
 * 어드민 API 요청 헬퍼
 * - JWT는 apiClient 인터셉터로 자동 전송
 * - localStorage.admin-key 있으면 x-admin-key 헤더도 함께 전송 (구 백엔드 호환)
 * - 404 발생 시 `/api/v1/<path>` → `/api/v1/api/v1/<path>` 로 자동 재시도 (구 백엔드가 double-prefix로 서빙 중일 때)
 */
export async function adminFetch(method: string, path: string, body?: any) {
  const headers: Record<string, string> = {};
  const adminKey = (typeof window !== 'undefined' && localStorage.getItem('admin-key')) || '';
  if (adminKey) headers['x-admin-key'] = adminKey;

  try {
    const res = await apiClient.request({ method, url: path, data: body, headers });
    return res.data;
  } catch (e: any) {
    const status = e?.response?.status;
    // 404 이면서 admin 경로일 때 — double-prefix 폴백 재시도
    if (status === 404 && path.includes('/api/v1/admin/')) {
      const fallback = path.replace('/api/v1/admin/', '/api/v1/api/v1/admin/');
      try {
        const res = await apiClient.request({ method, url: fallback, data: body, headers });
        return res.data;
      } catch (e2) {
        throw e2;
      }
    }
    throw e;
  }
}
