import { apiClient } from './client';
import type { Faq } from './faq.api';

const BASE = '/api/v1';

export interface AdminFaqInput {
  category: string;
  question: string;
  answer: string;
  displayOrder?: number;
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

export const adminFaqsApi = {
  list: () =>
    apiClient.get<Faq[]>(`${BASE}/admin/faqs`, { headers: withAdminKey() }).then((r) => r.data),

  getDetail: (id: string) =>
    apiClient
      .get<Faq>(`${BASE}/admin/faqs/${id}`, { headers: withAdminKey() })
      .then((r) => r.data),

  create: (data: AdminFaqInput) =>
    apiClient
      .post<Faq>(`${BASE}/admin/faqs`, data, { headers: withAdminKey() })
      .then((r) => r.data),

  update: (id: string, data: Partial<AdminFaqInput>) =>
    apiClient
      .patch<Faq>(`${BASE}/admin/faqs/${id}`, data, { headers: withAdminKey() })
      .then((r) => r.data),

  remove: (id: string) =>
    apiClient
      .delete(`${BASE}/admin/faqs/${id}`, { headers: withAdminKey() })
      .then((r) => r.data),
};
