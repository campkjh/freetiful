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
};

/** 기기에 남기는 미션 표시(오늘 오버레이 봄 · 오늘 출석 물어봄 · 첫 글/견적 축하함) 키 — 번호를 올리면 모든 기기에서 처음처럼 다시 뜬다(261110 사장 '다시 다 초기화') */
const MISSION_LOCAL_VER = 3;
export const missionLocalKey = (name: 'ov' | 'checkin' | 'task', rest: string) => `freetiful-mission-${name}:v${MISSION_LOCAL_VER}:${rest}`;

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
