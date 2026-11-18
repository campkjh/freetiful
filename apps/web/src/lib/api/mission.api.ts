import { apiClient } from './client';

// 신규가입 5,000원 미션(261110) — API apps/api/src/mission(welcome-mission.controller.ts)
export interface WelcomeMissionStatus {
  eligible: boolean;
  reward: number;
  startAt: string;
  /** KST 'YYYY-MM-DD' */
  today: string;
  role: string;
  attendance: { days: string[]; count: number; required: number; checkedToday: boolean };
  post: { count: number; required: number; minChars?: number };
  quote: { count: number; required: number };
  completed: boolean;
  claim: {
    status: 'pending' | 'paid' | 'rejected';
    createdAt: string;
    paidAt: string | null;
    bankName: string;
    account: string;
    accountHolder: string;
    adminNote: string | null;
  } | null;
  /** 시크릿 미션(261118) — 5,000원 미션을 다 하면 열린다. 옛 API 응답엔 없을 수 있다 */
  secret?: {
    open: boolean;
    prize: string;
    instagram: string;
    entry: { status: 'entered' | 'won' | 'rejected'; instagramId: string; createdAt: string; adminNote: string | null } | null;
  };
  phone: string;
  name: string;
}

export interface WelcomeClaimForm {
  phone: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

const BASE = '/api/v1/mission/welcome';

export const missionApi = {
  status: () => apiClient.get<WelcomeMissionStatus>(BASE).then((r) => r.data),
  checkin: () => apiClient.post<WelcomeMissionStatus & { justCheckedIn: boolean }>(`${BASE}/checkin`).then((r) => r.data),
  claim: (form: WelcomeClaimForm) => apiClient.post<WelcomeMissionStatus>(`${BASE}/claim`, form).then((r) => r.data),
  /** 시크릿 미션 응모 — 인스타 아이디 + 스토리 캡처(올리기 전에 줄여서) */
  enterSecret: (instagramId: string, file: Blob) => {
    const form = new FormData();
    form.append('instagramId', instagramId);
    form.append('file', file, 'story.jpg');
    return apiClient
      .post<WelcomeMissionStatus>(`${BASE}/secret`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 })
      .then((r) => r.data);
  },
};

/** 기기에 남기는 미션 표시(오늘 오버레이 봄 · 오늘 출석 물어봄 · 첫 글/견적 축하함) 키 — 번호를 올리면 모든 기기에서 처음처럼 다시 뜬다(261110 사장 '다시 다 초기화') */
const MISSION_LOCAL_VER = 3;
export const missionLocalKey = (name: 'ov' | 'checkin' | 'task' | 'rules' | 'secret', rest: string) => `freetiful-mission-${name}:v${MISSION_LOCAL_VER}:${rest}`;

/** 테스트 기간 — 가입일 상관없이 관리자(역할 admin) 빼고 전원, 총괄운영자도 실제 참여(261110 사장 '11월10일 이후가 아니라 전부 다, 테스트로'). 끝낼 땐 false — 서버 welcome-mission.rules.ts 도 같이 */
export const WELCOME_MISSION_OPEN_TO_ALL = true;

/** 마이 메뉴에 미션 줄을 보일지 — 서버 판정(isWelcomeMissionUser)과 같은 기준 */
export const WELCOME_MISSION_START = Date.parse('2026-11-10T00:00:00+09:00');
export function isWelcomeMissionUser(u: { createdAt?: string | null; role?: string | null } | null | undefined) {
  if (!u || u.role === 'admin') return false;
  if (WELCOME_MISSION_OPEN_TO_ALL) return true;
  if (!u.createdAt) return false;
  const t = Date.parse(u.createdAt);
  return Number.isFinite(t) && t >= WELCOME_MISSION_START;
}

/**
 * 웨딩숲 미션 글 판정 — 서버 welcome-mission.rules.ts `isWelcomeMissionPost` 와 같은 계산(바꿀 땐 둘 다).
 * 쓰는 동안 글자 수 게이지(빨강→주황→초록)에 쓴다: length = 인정되는 글자 수(띄어쓰기 포함, 문장부호 · 낱자 · 이모지 · 같은 글자 반복 뺌), spam = 장난 글.
 */
export function missionPostCheck(content: string, minChars = 30) {
  const text = (content || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[ㄱ-ㅎㅏ-ㅣ]/g, '')
    .replace(/[\p{P}\p{S}\p{M}\p{C}]/gu, '')
    .replace(/(\S)\1{2,}/gu, '$1$1')
    .replace(/\s+/g, ' ')
    .trim();
  const length = Array.from(text).length;
  if (length < minChars) return { length, ok: false, spam: false };
  const head = Array.from(text.replace(/ /g, '')).slice(0, 100);
  const kinds = new Set(head).size;
  const pairs = new Set(head.slice(1).map((c, i) => head[i] + c)).size;
  const ok = kinds >= 12 && kinds / head.length >= 0.3 && pairs / (head.length - 1) >= 0.5;
  return { length, ok, spam: !ok };
}
