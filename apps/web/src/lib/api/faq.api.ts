import { apiClient } from './client';

const BASE = '/api/v1';

export interface Faq {
  id: string;
  category: string;
  question: string;
  answer: string;
  displayOrder: number;
  isActive: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export const faqApi = {
  getList: () => apiClient.get<Faq[]>(`${BASE}/faqs`).then((r) => r.data),

  getDetail: (id: string) => apiClient.get<Faq>(`${BASE}/faqs/${id}`).then((r) => r.data),
};
