import { apiClient } from './client';

const BASE = '/api/v1/pro';

export const scheduleApi = {
  getMySchedule: (month: string) =>
    apiClient.get(`${BASE}/schedule`, { params: { month } }).then((r) => r.data),

  updateDate: (date: string, data: { status: string; eventTitle?: string; eventLocation?: string }) =>
    apiClient.put(`${BASE}/schedule/${date}`, data).then((r) => r.data),

  getBookedDates: (proProfileId: string) =>
    apiClient.get(`${BASE}/${proProfileId}/booked-dates`).then((r) => r.data),
};
