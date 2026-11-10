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
  post: { count: number; required: number };
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

/** 마이 메뉴에 미션 줄을 보일지 — 서버 판정(isWelcomeMissionUser)과 같은 기준 */
export const WELCOME_MISSION_START = Date.parse('2026-11-10T00:00:00+09:00');
export function isWelcomeMissionUser(u: { createdAt?: string | null; role?: string | null } | null | undefined) {
  if (!u?.createdAt || u.role === 'admin') return false;
  const t = Date.parse(u.createdAt);
  return Number.isFinite(t) && t >= WELCOME_MISSION_START;
}
