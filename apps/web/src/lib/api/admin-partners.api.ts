import { apiClient } from './client';

/**
 * 어드민 — 웨딩 파트너 업체 (BusinessProfile) CRUD
 *
 * JWT 는 apiClient 인터셉터가 자동 전송. localStorage.admin-key 는 adminFetch 에서만
 * 붙여주므로 여기서는 관리자 페이지 내부에서만 사용 (auth.store 로그인 필수).
 */

const BASE = '/api/v1';

export interface AdminPartnerListItem {
  id: string;
  businessName: string;
  businessType: string | null;
  address: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
  images: { imageUrl: string }[];
  categories: { category: { name: string } }[];
}

export interface AdminPartnerListResponse {
  data: AdminPartnerListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminPartnerDetail {
  id: string;
  userId: string;
  status: string;
  businessName: string;
  businessType: string | null;
  address: string | null;
  addressDetail: string | null;
  lat: string | number | null;
  lng: string | number | null;
  phone: string | null;
  descriptionHtml: string | null;
  instagramUrl: string | null;
  websiteUrl: string | null;
  videoUrl: string | null;
  profileViews: number;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  images: {
    id: string;
    imageUrl: string;
    displayOrder: number;
    createdAt: string;
  }[];
  categories: {
    categoryId: string;
    businessProfileId: string;
    category: { id: string; name: string; type: string };
  }[];
}

export interface AdminBusinessCategory {
  id: string;
  name: string;
  nameEn: string | null;
  iconUrl: string | null;
  displayOrder: number;
}

export interface AdminPartnerInput {
  businessName: string;
  businessType?: string | null;
  address?: string | null;
  addressDetail?: string | null;
  phone?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  descriptionHtml?: string | null;
  instagramUrl?: string | null;
  websiteUrl?: string | null;
  videoUrl?: string | null;
  categoryNames?: string[];
  status?: string;
}

function withAdminKey() {
  const headers: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const k = localStorage.getItem('admin-key');
    if (k) headers['x-admin-key'] = k;
  }
  return headers;
}

export const adminPartnersApi = {
  list: (params: { page?: number; limit?: number; search?: string; startDate?: string; endDate?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.search) q.set('search', params.search);
    if (params.startDate) q.set('startDate', params.startDate);
    if (params.endDate) q.set('endDate', params.endDate);
    return apiClient
      .get<AdminPartnerListResponse>(`${BASE}/admin/businesses?${q.toString()}`, {
        headers: withAdminKey(),
      })
      .then((r) => r.data);
  },

  getDetail: (id: string) =>
    apiClient
      .get<AdminPartnerDetail>(`${BASE}/admin/businesses/${id}`, { headers: withAdminKey() })
      .then((r) => r.data),

  create: (data: AdminPartnerInput) =>
    apiClient
      .post<AdminPartnerDetail>(`${BASE}/admin/businesses`, data, { headers: withAdminKey() })
      .then((r) => r.data),

  update: (id: string, data: Partial<AdminPartnerInput>) =>
    apiClient
      .patch<AdminPartnerDetail>(`${BASE}/admin/businesses/${id}`, data, {
        headers: withAdminKey(),
      })
      .then((r) => r.data),

  remove: (id: string) =>
    apiClient.delete(`${BASE}/admin/businesses/${id}`, { headers: withAdminKey() }).then((r) => r.data),

  uploadImage: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient
      .post<{ id: string; imageUrl: string; displayOrder: number }>(
        `${BASE}/admin/businesses/${id}/images`,
        form,
        {
          headers: { 'Content-Type': 'multipart/form-data', ...withAdminKey() },
          timeout: 60000,
        },
      )
      .then((r) => r.data);
  },

  deleteImage: (id: string, imageId: string) =>
    apiClient
      .delete(`${BASE}/admin/businesses/${id}/images/${imageId}`, { headers: withAdminKey() })
      .then((r) => r.data),

  reorderImages: (id: string, imageIds: string[]) =>
    apiClient
      .patch(
        `${BASE}/admin/businesses/${id}/images/reorder`,
        { ids: imageIds },
        { headers: withAdminKey() },
      )
      .then((r) => r.data),

  getCategories: () =>
    apiClient
      .get<AdminBusinessCategory[]>(`${BASE}/admin/business-categories`, { headers: withAdminKey() })
      .then((r) => r.data),
};
