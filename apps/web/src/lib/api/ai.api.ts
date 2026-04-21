import { apiClient } from './client';

const BASE = '/api/v1/ai';

export interface AiProfileInput {
  name?: string;
  category?: string;
  careerYears?: number;
  selectedTags?: string[];
  languages?: string[];
  awards?: string;
  keywords?: string;
  imageDataUrls?: string[];
}

export interface AiProfileOutput {
  shortIntro: string;
  mainExperience: string;
  detailHtml: string;
  faqs: { question: string; answer: string }[];
}

export const aiApi = {
  status: () => apiClient.get<{ enabled: boolean }>(`${BASE}/status`).then((r) => r.data),
  generateProfile: (input: AiProfileInput) =>
    apiClient.post<AiProfileOutput>(`${BASE}/generate-profile`, input, { timeout: 60000 }).then((r) => r.data),
};
