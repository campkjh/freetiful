'use client';

// 웨딩런 랭킹 API(261011 사장 '웨딩런 — 신혼집까지 달려!') — NestJS apps/api/src/game.
//  · apiClient(axios) 대신 fetch 를 쓴다: apiClient 는 401 이면 토큰 갱신 → 실패 시 로그인 시트를 띄우는데,
//    게임은 비로그인(게스트)도 그대로 하는 화면이라 로그인 창이 튀어나오면 안 된다. 로그인 상태면 토큰만 붙인다(서버가 userId 연결).
//  · 같은 출처 /api/v1/** → Next rewrites 가 Railway API 로 넘긴다.
import { useAuthStore } from '@/lib/store/auth.store';

const BASE = '/api/v1/game/wedding-run';

export type WrPeriod = 'today' | 'week' | 'all';

export interface WrSession {
  sessionId: string;
  token: string;
  startedAt: number;
}

export interface WrSubmitBody {
  token: string;
  score: number;
  stage: number;
  segment: number;
  arrived: boolean;
  laps: number;
  durationMs: number;
  hearts: number;
  envelopes: number;
  nickname: string;
  /** 기본 닉네임으로 되돌리기(직접 정한 이름 지움) — 261011 검증 반영 */
  resetNickname?: boolean;
  /** (261011) 손님 때 정한 이름을 막 로그인한 계정으로 — 계정에 직접 정한 이름이 없을 때만 적용 */
  nicknameSoft?: boolean;
  deviceId: string;
}

export interface WrSubmitRes {
  id: string;
  isNewBest: boolean;
  best: number;
  today: { rank: number; participants: number };
  nextGoal: { rank: number; gap: number } | null;
  top10Gap: number | null;
  /** 실제 저장된 닉네임(규칙에 어긋나면 서버가 기본 닉네임으로 바꿔 저장) */
  nickname?: string;
  /** 바꿨다면 그 이유, 아니면 null */
  nicknameRejected?: string | null;
  /** 자동 보류(사람이 내기 어려운 판) — 운영 확인 뒤 순위에 반영. 보류면 today.rank 는 이 판을 뺀 값(0 = 없음) */
  held?: boolean;
}

export interface WrLeaderRow {
  rank: number;
  nickname: string;
  score: number;
  stage: number;
  arrived: boolean;
  /** 이 줄이 나인가(서버가 계정·기기로 판단 — playerKey 는 안 내보냄) */
  isMe?: boolean;
}

export interface WrLeaderboard {
  period: WrPeriod;
  participants: number;
  top: WrLeaderRow[];
  me: { rank: number; nickname: string; best: number; stage: number; arrived: boolean } | null;
}

export interface WrPublicScore {
  id: string;
  nickname: string;
  score: number;
  stage: number;
  segment: number;
  arrived: boolean;
}

export class WrApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message || `wedding-run api ${status}`);
    this.status = status;
    this.body = body;
  }
}

/** 서버가 준 오류 문구(Nest 기본 { message }) */
export function wrErrorMessage(e: unknown): string | null {
  if (!(e instanceof WrApiError)) return null;
  const b = e.body as { message?: unknown } | null;
  const m = b && typeof b === 'object' ? b.message : null;
  if (typeof m === 'string') return m;
  if (Array.isArray(m) && typeof m[0] === 'string') return m[0];
  return null;
}

async function call<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 9000);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = useAuthStore.getState().accessToken;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* 저장소 접근 불가 — 게스트로 */
  }
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) }, signal: ctrl.signal, cache: 'no-store' });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok) throw new WrApiError(res.status, body);
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

export const wrApi = {
  createSession: (deviceId: string) =>
    call<WrSession>('/sessions', { method: 'POST', body: JSON.stringify({ deviceId }), timeoutMs: 6000 }),

  submitScore: (body: WrSubmitBody) =>
    call<WrSubmitRes>('/scores', { method: 'POST', body: JSON.stringify(body), timeoutMs: 10000 }),

  // 기기 id 는 머리글 X-WR-Device 로(주소에 실으면 접근 기록에 남음) — 서버는 예전 ?deviceId= 도 받는다(261011 통합: 랭킹 API 보강에 맞춤)
  leaderboard: (period: WrPeriod, deviceId: string) =>
    call<WrLeaderboard>(`/leaderboard?period=${encodeURIComponent(period)}`, { headers: { 'X-WR-Device': deviceId } }),

  getScore: (id: string) => call<WrPublicScore>(`/scores/${encodeURIComponent(id)}`, { timeoutMs: 6000 }),

  /**
   * 판 포기(그만둔 판·안 쓴 판의 세션 닫기) — 결과를 기다리지 않는다. keepalive 라 페이지를 떠나는 중에도 보내진다.
   * 서버가 없거나 옛 서버(404)면 조용히 무시. 261011 검증 반영(같은 IP 열린 판 상한에서 빼기).
   */
  abandonSession: (token: string, deviceId: string) => {
    try {
      void fetch(`${BASE}/sessions/abandon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, deviceId }),
        keepalive: true,
        cache: 'no-store',
      }).catch(() => undefined);
    } catch {
      /* 무시 */
    }
  },
};
