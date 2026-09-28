import { apiClient } from './client';

const BASE = '/api/v1';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  tag: string | null;
  /** 카드 그림 경로(없으면 동물 친구 그림) */
  imageUrl?: string | null;
  isPinned: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const announcementApi = {
  getList: () =>
    apiClient.get<Announcement[]>(`${BASE}/announcements`).then((r) => r.data),

  getDetail: (id: string) =>
    apiClient.get<Announcement>(`${BASE}/announcements/${id}`).then((r) => r.data),
};
