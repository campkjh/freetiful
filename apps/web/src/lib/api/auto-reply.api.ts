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

export type PersonaTone = 'warm' | 'trust' | 'bright' | 'plain';
export type PersonaCall = 'customer' | 'couple' | 'name';
export type PersonaLength = 'short' | 'normal' | 'long';
export type PersonaEmoji = 'none' | 'some' | 'many';
export type PersonaGuard = 'price' | 'date' | 'promise' | 'other';

/** 사회자가 심어 두는 '자아' — 말투·호칭·길이·안전장치 */
export interface Persona {
  /** AI 가 맥락을 보고 비슷한 뜻이면 알아서 답하게 한다 */
  aiEnabled: boolean;
  /** 보낼 때 어미·호칭까지 내 말투로 바꾼다 (이중 opt-in) */
  aiAdaptEnabled: boolean;
  personaText: string;
  tone: PersonaTone;
  call: PersonaCall;
  length: PersonaLength;
  emoji: PersonaEmoji;
  signatures: string[];
  banPhrases: string;
  guards: PersonaGuard[];
}

export interface PersonaResponse extends Persona {
  aiAvailable: boolean;
  signaturePresets: string[];
}

export interface PreviewResult {
  willReply: boolean;
  answer?: string;
  why?: string;
  reason?: string;
  risks?: string[];
  aiUsed?: boolean;
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

  getPersona: () => apiClient.get<PersonaResponse>(`${BASE}/me/persona`).then((r) => r.data),

  savePersona: (body: Partial<Persona>) =>
    apiClient.put<PersonaResponse>(`${BASE}/me/persona`, body).then((r) => r.data),

  /** 프로필을 재료로 자아 초안을 대신 써 준다 */
  draftPersona: () =>
    apiClient
      .post<{ personaText: string; tone?: PersonaTone; length?: PersonaLength; signatures?: string[]; needsProfile?: boolean; message?: string }>(
        `${BASE}/me/persona-draft`,
      )
      .then((r) => r.data),

  /** 적어 둔 문구를 내 말투로 다듬는다 (폼에만 반영, 저장은 따로) */
  rewrite: (text: string) =>
    apiClient
      .post<{ text: string; changed: boolean; reason?: string; droppedFacts?: string[] }>(`${BASE}/me/rewrite`, { text })
      .then((r) => r.data),

  /** 이렇게 물어보면 뭐라고 답하는지 미리보기 */
  preview: (text: string) =>
    apiClient.post<PreviewResult>(`${BASE}/me/preview`, { text }).then((r) => r.data),

  /** 고객 화면에서 보여 줄 질문 목록 */
  getPublic: (proProfileId: string) =>
    apiClient
      .get<{ items: { id: string; question: string }[] }>(`${BASE}/${proProfileId}`)
      .then((r) => r.data.items || []),

  /** 질문을 눌렀을 때 — 질문과 답변이 한 번에 대화에 남는다 */
  ask: (roomId: string, itemId: string) =>
    apiClient.post(`/api/v1/chat/rooms/${roomId}/auto-reply`, { itemId }).then((r) => r.data),
};
