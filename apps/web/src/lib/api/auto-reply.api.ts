import { apiClient } from './client';

const BASE = '/api/v1/pro-auto-replies';

export interface AutoReplyItem {
  id?: string;
  question: string;
  answer: string;
  /** 이 말이 나오면 이 답을 보낸다 — 쉼표로 구분 */
  keywords?: string;
  isEnabled?: boolean;
}

export interface AutoReplySettings {
  greeting: string;
  greetingEnabled: boolean;
  /** 사회자가 인사말을 안 적었을 때 실제로 나가는 문구 */
  defaultGreeting: string;
  items: AutoReplyItem[];
  /** 견적 문의가 오면 나갈 답변 */
  quoteReply: string;
  /** 적어 두면 답변과 함께 견적서까지 자동 발송 */
  quoteAmount: number | null;
  quoteEnabled: boolean;
  /** 섭외 요청이 오면 승인 없이 바로 방을 열고 인사말을 보낸다 */
  autoApprove: boolean;
  /** 이미 써 둔 프로필 FAQ — 자동응답이 비었을 때만 제안으로 내려온다 */
  faqSuggestions: { question: string; answer: string }[];
  suggestedQuestions: string[];
}

export const autoReplyApi = {
  getMine: () => apiClient.get<AutoReplySettings>(`${BASE}/me`).then((r) => r.data),

  saveMine: (body: {
    greeting: string;
    greetingEnabled: boolean;
    items: AutoReplyItem[];
    quoteReply: string;
    quoteAmount: number | null;
    quoteEnabled: boolean;
    autoApprove: boolean;
  }) =>
    apiClient.put<AutoReplySettings>(`${BASE}/me`, body).then((r) => r.data),

  /** 고객 화면에서 보여 줄 질문 목록 */
  getPublic: (proProfileId: string) =>
    apiClient
      .get<{ items: { id: string; question: string }[] }>(`${BASE}/${proProfileId}`)
      .then((r) => r.data.items || []),

  /** 질문을 눌렀을 때 — 질문과 답변이 한 번에 대화에 남는다 */
  ask: (roomId: string, itemId: string) =>
    apiClient.post(`/api/v1/chat/rooms/${roomId}/auto-reply`, { itemId }).then((r) => r.data),
};
