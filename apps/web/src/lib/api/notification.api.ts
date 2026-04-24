import { apiClient } from './client';

const BASE = '/api/v1/notification';
const CACHE_KEY = 'freetiful-notifications-cache';
const COUNT_KEY = 'freetiful-unread-count-cache';
const DELETED_IDS_KEY = 'freetiful-deleted-notification-ids';
const DELETE_ALL_CUTOFF_KEY = 'freetiful-notifications-delete-all-cutoff';
const PREFETCH_TTL = 30_000;
const MAX_DELETED_IDS = 200;
let prefetchInFlight: Promise<void> | null = null;
let lastPrefetchAt = 0;

function emitNotificationsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('freetiful:notifications-changed'));
}

function readDeletedIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DELETED_IDS_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [];
  } catch { return []; }
}

function writeDeletedIds(ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(ids.slice(0, MAX_DELETED_IDS)));
  } catch {}
}

function rememberDeletedId(id: string) {
  const ids = readDeletedIds().filter((existing) => existing !== id);
  writeDeletedIds([id, ...ids]);
}

function forgetDeletedId(id: string) {
  writeDeletedIds(readDeletedIds().filter((existing) => existing !== id));
}

function rememberDeleteAllCutoff() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DELETE_ALL_CUTOFF_KEY, String(Date.now()));
  } catch {}
}

function clearDeleteAllCutoff() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(DELETE_ALL_CUTOFF_KEY);
  } catch {}
}

function getDeleteAllCutoff(): number {
  if (typeof window === 'undefined') return 0;
  try {
    return Number(localStorage.getItem(DELETE_ALL_CUTOFF_KEY) || 0);
  } catch { return 0; }
}

function shouldHideNotification(notification: any, deletedIds: Set<string>, deleteAllCutoff: number) {
  if (!notification) return false;
  if (notification.id && deletedIds.has(String(notification.id))) return true;
  if (!deleteAllCutoff || !notification.createdAt) return false;
  const createdAt = new Date(notification.createdAt).getTime();
  return Number.isFinite(createdAt) && createdAt <= deleteAllCutoff;
}

function filterDeletedNotifications(payload: any) {
  const deletedIds = new Set(readDeletedIds());
  const deleteAllCutoff = getDeleteAllCutoff();
  if (!deletedIds.size && !deleteAllCutoff) return payload;

  const filterItems = (items: any[]) =>
    items.filter((item) => !shouldHideNotification(item, deletedIds, deleteAllCutoff));

  if (Array.isArray(payload)) return filterItems(payload);
  if (Array.isArray(payload?.data)) {
    const data = filterItems(payload.data);
    const removedCount = payload.data.length - data.length;
    const total = Number(payload.meta?.total ?? data.length);
    return {
      ...payload,
      data,
      meta: payload.meta
        ? { ...payload.meta, total: Math.max(data.length, total - removedCount) }
        : payload.meta,
    };
  }
  if (Array.isArray(payload?.items)) return { ...payload, items: filterItems(payload.items) };
  return payload;
}

function cacheNotifications(payload: any) {
  if (typeof window === 'undefined') return payload;
  const filtered = filterDeletedNotifications(payload);
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(filtered)); } catch {}
  emitNotificationsChanged();
  return filtered;
}

function setCachedUnreadCount(count: number) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(COUNT_KEY, String(Math.max(0, count))); } catch {}
  emitNotificationsChanged();
}

function getItemsFromPayload(payload: any): any[] {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload)) return payload;
  return [];
}

function updateCachedPayload(updateItems: (items: any[]) => any[]) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (Array.isArray(data?.data)) {
      const nextItems = updateItems(data.data);
      const next = { ...data, data: nextItems };
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      return nextItems;
    }
    if (Array.isArray(data?.items)) {
      const nextItems = updateItems(data.items);
      const next = { ...data, items: nextItems };
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      return nextItems;
    }
    if (Array.isArray(data)) {
      const nextItems = updateItems(data);
      localStorage.setItem(CACHE_KEY, JSON.stringify(nextItems));
      return nextItems;
    }
  } catch {}
  return [];
}

function removeCachedNotification(id: string) {
  let removedUnread = 0;
  updateCachedPayload((items) =>
    items.filter((item) => {
      const shouldRemove = String(item?.id) === id;
      if (shouldRemove && item?.isRead === false) removedUnread += 1;
      return !shouldRemove;
    }),
  );
  if (removedUnread > 0) setCachedUnreadCount(getCachedUnreadCount() - removedUnread);
  else emitNotificationsChanged();
}

function markCachedNotificationAsRead(id: string) {
  let changedUnread = 0;
  updateCachedPayload((items) =>
    items.map((item) => {
      if (String(item?.id) !== id) return item;
      if (item?.isRead === false) changedUnread += 1;
      return { ...item, isRead: true, readAt: item?.readAt || new Date().toISOString() };
    }),
  );
  if (changedUnread > 0) setCachedUnreadCount(getCachedUnreadCount() - changedUnread);
  else emitNotificationsChanged();
}

function markAllCachedNotificationsAsRead() {
  updateCachedPayload((items) =>
    items.map((item) => ({ ...item, isRead: true, readAt: item?.readAt || new Date().toISOString() })),
  );
  setCachedUnreadCount(0);
}

export function getCachedNotifications(): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const filtered = filterDeletedNotifications(JSON.parse(raw));
    localStorage.setItem(CACHE_KEY, JSON.stringify(filtered));
    return filtered;
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
      return cacheNotifications(r.data);
    }),

  markAsRead: (id: string) =>
    apiClient.post(`${BASE}/${id}/read`).then((r) => {
      markCachedNotificationAsRead(id);
      return r.data;
    }),

  markAllAsRead: () =>
    apiClient.post(`${BASE}/read-all`).then((r) => {
      markAllCachedNotificationsAsRead();
      return r.data;
    }),

  deleteOne: (id: string) => {
    rememberDeletedId(id);
    removeCachedNotification(id);
    return apiClient.delete(`${BASE}/${id}`).then((r) => {
      return r.data;
    }).catch((e) => {
      forgetDeletedId(id);
      throw e;
    });
  },

  deleteAll: () => {
    rememberDeleteAllCutoff();
    try { localStorage.removeItem(CACHE_KEY); } catch {}
    setCachedUnreadCount(0);
    return apiClient.delete(`${BASE}`).then((r) => {
      try { localStorage.removeItem(CACHE_KEY); } catch {}
      setCachedUnreadCount(0);
      return r.data;
    }).catch((e) => {
      clearDeleteAllCutoff();
      throw e;
    });
  },

  getUnreadCount: () =>
    apiClient.get<{ count: number }>(`${BASE}/unread-count`).then((r) => {
      setCachedUnreadCount(r.data?.count ?? 0);
      return r.data;
    }),

  // 앱 시작 시 프리페치 (백그라운드)
  prefetch: async () => {
    if (prefetchInFlight) return prefetchInFlight;
    if (Date.now() - lastPrefetchAt < PREFETCH_TTL) return;
    prefetchInFlight = (async () => {
    try {
      await Promise.all([
        apiClient.get(`${BASE}`, { params: { limit: 20 } }).then((r) => {
          cacheNotifications(r.data);
        }),
        apiClient.get(`${BASE}/unread-count`).then((r) => {
          const cached = getCachedNotifications();
          const cachedUnread = getItemsFromPayload(cached).filter((n) => n?.isRead === false).length;
          setCachedUnreadCount(Math.min(Number(r.data?.count ?? 0), cachedUnread || Number(r.data?.count ?? 0)));
        }),
      ]);
      lastPrefetchAt = Date.now();
    } catch {
    } finally {
      prefetchInFlight = null;
    }
    })();
    return prefetchInFlight;
  },
};
