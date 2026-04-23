import { apiClient } from './client';
import type { Announcement } from './announcement.api';

const BASE = '/api/v1';

export interface AdminAnnouncementInput {
  title: string;
  content: string;
  tag?: string | null;
  isPinned?: boolean;
  isPublished?: boolean;
}

function withAdminKey() {
  const headers: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const k = localStorage.getItem('admin-key');
    if (k) headers['x-admin-key'] = k;
  }
  return headers;
}

export const adminAnnouncementsApi = {
  list: () =>
    apiClient
      .get<Announcement[]>(`${BASE}/admin/announcements`, { headers: withAdminKey() })
      .then((r) => r.data),

  getDetail: (id: string) =>
    apiClient
      .get<Announcement>(`${BASE}/admin/announcements/${id}`, { headers: withAdminKey() })
      .then((r) => r.data),

  create: (data: AdminAnnouncementInput) =>
    apiClient
      .post<Announcement>(`${BASE}/admin/announcements`, data, { headers: withAdminKey() })
      .then((r) => r.data),

  update: (id: string, data: Partial<AdminAnnouncementInput>) =>
    apiClient
      .patch<Announcement>(`${BASE}/admin/announcements/${id}`, data, { headers: withAdminKey() })
      .then((r) => r.data),

  remove: (id: string) =>
    apiClient
      .delete(`${BASE}/admin/announcements/${id}`, { headers: withAdminKey() })
      .then((r) => r.data),
};
