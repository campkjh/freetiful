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

export interface AiHeroImageInput {
  name?: string;
  category?: string;
  keywords?: string;
  imageDataUrls?: string[];
}

export interface AiCorrectTextInput {
  text: string;
  context?: string;
}

export interface AiCorrectTextOutput {
  text: string;
  corrected: boolean;
  reason?: string;
}

export const aiApi = {
  status: () => apiClient.get<{ enabled: boolean }>(`${BASE}/status`).then((r) => r.data),
  generateProfile: (input: AiProfileInput) =>
    apiClient.post<AiProfileOutput>(`${BASE}/generate-profile`, input, { timeout: 60000 }).then((r) => r.data),
  correctText: (input: AiCorrectTextInput) =>
    apiClient.post<AiCorrectTextOutput>(`${BASE}/correct-text`, input, { timeout: 30000 }).then((r) => r.data),
  generateHeroImage: (input: AiHeroImageInput) =>
    apiClient
      .post<{ url: string | null; debug: string[] }>(`${BASE}/generate-hero-image`, input, { timeout: 90000 })
      .then((r) => r.data),
};
