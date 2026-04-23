import { apiClient } from './client';

const BASE = '/api/v1/notification';
const CACHE_KEY = 'freetiful-notifications-cache';
const COUNT_KEY = 'freetiful-unread-count-cache';

export function getCachedNotifications(): any[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function getCachedUnreadCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(COUNT_KEY);
    return raw ? Number(raw) : 0;
  } catch { return 0; }
}

export const notificationApi = {
  getList: (params?: { page?: number; limit?: number }) =>
    apiClient.get(`${BASE}`, { params }).then((r) => {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(r.data)); } catch {}
      return r.data;
    }),

  markAsRead: (id: string) =>
    apiClient.post(`${BASE}/${id}/read`).then((r) => r.data),

  markAllAsRead: () =>
    apiClient.post(`${BASE}/read-all`).then((r) => r.data),

  deleteOne: (id: string) =>
    apiClient.delete(`${BASE}/${id}`).then((r) => {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data?.items)) {
            data.items = data.items.filter((n: any) => n.id !== id);
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
          } else if (Array.isArray(data)) {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data.filter((n: any) => n.id !== id)));
          }
        }
      } catch {}
      return r.data;
    }),

  deleteAll: () =>
    apiClient.delete(`${BASE}`).then((r) => {
      try { localStorage.removeItem(CACHE_KEY); localStorage.setItem(COUNT_KEY, '0'); } catch {}
      return r.data;
    }),

  getUnreadCount: () =>
    apiClient.get<{ count: number }>(`${BASE}/unread-count`).then((r) => {
      try { localStorage.setItem(COUNT_KEY, String(r.data?.count ?? 0)); } catch {}
      return r.data;
    }),

  // 앱 시작 시 프리페치 (백그라운드)
  prefetch: async () => {
    try {
      await Promise.all([
        apiClient.get(`${BASE}`, { params: { limit: 20 } }).then((r) => {
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(r.data)); } catch {}
        }),
        apiClient.get(`${BASE}/unread-count`).then((r) => {
          try { localStorage.setItem(COUNT_KEY, String(r.data?.count ?? 0)); } catch {}
        }),
      ]);
    } catch {}
  },
};
