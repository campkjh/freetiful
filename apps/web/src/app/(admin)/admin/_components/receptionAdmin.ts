'use client';

// 송년회 어드민(참여자 · 설문 응답) 공용 — API GET /api/v1/admin/reception/:eventKey(apps/api reception-admin.controller.ts).
// 참여자 = 자리 탭에서 이름을 넣은 기기 ∪ 사진·좋아요/공감·설문을 한 기기. 기기가 곧 한 사람(로그인 없음).
// (261122 2차) 입장 현황 · 퀴즈 · 럭키드로우 · 자리 명단 — 응답 타입은 서버 명세 E 그대로, 태블릿 한 대가 폴링으로 본다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { adminFetch } from './adminFetch';
import { useAdminRefresh } from './adminRefresh';
import { RECEPTION_EVENT_KEY } from '@/lib/reception/event';

export interface ReceptionParticipant {
  deviceId: string;
  name: string | null;
  firstAt: string;
  lastAt: string;
  photo: { thumbUrl: string; imageUrl: string; likes: number; empathies: number; rank: number; createdAt: string } | null;
  likesUsed: number;
  empathiesUsed: number;
  surveyAt: string | null;
}

export interface ReceptionSurveyRow {
  deviceId: string;
  name: string;
  answers: { rating?: number; best?: string; again?: 'yes' | 'maybe' | 'no'; comment?: string };
  createdAt: string;
  updatedAt: string;
}

export interface ReceptionOverview {
  summary: {
    participants: number;
    named: number;
    photos: number;
    voters: number;
    surveys: number;
    avgRating: number | null;
    again: { yes: number; maybe: number; no: number };
    best: { title: string; count: number }[];
  };
  participants: ReceptionParticipant[];
  surveys: ReceptionSurveyRow[];
}

export const AGAIN_LABEL = { yes: '꼭 올게요', maybe: '아마도요', no: '잘 모르겠어요' } as const;
export const AGAIN_TONE = { yes: 'green', maybe: 'orange', no: 'red' } as const;

export function useReceptionOverview() {
  const [data, setData] = useState<ReceptionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminFetch('GET', `/api/v1/admin/reception/${RECEPTION_EVENT_KEY}`, undefined, { cache: false }));
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || '불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useAdminRefresh(load);
  return { data, loading, error, reload: load };
}

/* ─── 2차(261122) 응답 타입 — apps/api 명세 E 와 같은 모양 ───────────────────── */

export type TicketsMode = 'auto' | 'open' | 'closed';
export interface ReceptionWin { prize: string; at: string }

/** 응모권 = 입장. table/seat = 지금 명단에서 이름으로 찾은 자리(못 찾으면 null · listed=false) */
export interface LiveArrival {
  id: string;
  number: number;
  name: string;
  table: number | null;
  seat: number | null;
  listed: boolean;
  issuedAt: string;
  lastSeenAt: string;
  win: ReceptionWin | null;
}

/** 자리 명단 한 줄(테이블 → 좌석 → 이름 순) */
export interface LiveSeatRow {
  name: string;
  table: number;
  seat: number | null;
  arrived: boolean;
  ticketNumber: number | null;
  arrivedAt: string | null;
}

/** 응모권을 지운 이름 — 이 이름으로는 응모권이 다시 안 나온다(손님 폰 15초 폴링에 되살아나지 않게). 풀기 = unblockTicket */
export interface TicketBlock {
  nameKey: string;
  name: string;
  at: string;
}

export interface ReceptionLive {
  ticketsMode: TicketsMode;
  ticketsOpen: boolean;
  now: string;
  arrivals: LiveArrival[];
  seats: LiveSeatRow[];
  /** 지운 이름(최근 위) — 옛 서버는 안 보낼 수 있다 */
  blocked?: TicketBlock[];
  summary: {
    arrived: number;
    listed: number;
    listedArrived: number;
    walkIns: number;
    tables: { table: number; listed: number; arrived: number }[];
  };
}

export type QuizKind = 'text' | 'ox' | 'choice' | 'match' | 'mission';
export type QuizPhase = 'idle' | 'open' | 'locked' | 'revealed';

export interface QuizState {
  currentId: string | null;
  phase: QuizPhase;
  openedAt: string | null;
  revealed: string[];
  showBoard: boolean;
}

/** 어드민 문제 — 정답 글(answerLabel)은 늘 온다(정답 원값 answer/accept 는 안 올 수도 있다) */
export interface QuizQuestionAdmin {
  id: string;
  round: 1 | 2 | 3;
  roundTitle: string;
  no: number;
  kind: QuizKind;
  points: number;
  prompt: string;
  options?: string[];
  slots?: string[];
  slotImages?: string[];
  image?: string;
  placeholder?: string;
  notes?: string[];
  answerLabel: string;
  explanation?: string;
}

export interface QuizAdminTable {
  table: number;
  answer: string | null;
  display: string | null;
  name: string | null;
  updatedAt: string | null;
  auto: boolean;
  override: boolean | null;
  correct: boolean;
}

export interface QuizScore { table: number; score: number; correct: number }

export interface QuizAdmin {
  state: QuizState;
  questions: QuizQuestionAdmin[];
  results: Record<string, { tables: QuizAdminTable[]; submitted: number; correctCount: number }>;
  /** 공개된 문제만 채점(손님 화면과 같은 점수판) */
  board: QuizScore[];
  /** 전 문제 채점(어드민 참고용) */
  boardAll: QuizScore[];
  tableCount: number;
}

export type QuizStateAction = 'open' | 'lock' | 'reveal' | 'unreveal' | 'idle' | 'board' | 'reset';

export interface DrawPrize { name: string; total: number; drawn: number }
export interface DrawRow {
  id: string;
  number: number;
  name: string;
  table: number | null;
  prize: string;
  at: string;
  cancelled: boolean;
}
export interface DrawBoard {
  prizes: DrawPrize[];
  draws: DrawRow[];
  /** 한 번도 안 뽑힌 응모권 수(무효된 응모권도 다시 안 뽑는다) */
  eligible: number;
  tickets: number;
}

/* ─── 작은 도움 함수 ───────────────────────────────────────────── */

const BASE = `/api/v1/admin/reception/${RECEPTION_EVENT_KEY}`;
const KST_MS = 9 * 3600000;

/** 한 문제 제한 시간(표시만 — 마감은 운영자가 누른다) */
export const QUIZ_SECONDS = 60;
export const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'] as const;
export const QUIZ_KIND_LABEL: Record<QuizKind, string> = { text: '주관식', ox: 'OX', choice: '객관식', match: '짝 맞추기', mission: '미션' };

/** 서버 nameKey(reception.rules.ts)와 같게 — NFKC → 공백 · 폭 없는 문자(U+200B~200D · FEFF, 엑셀·카톡 복사에 섞임) 제거 → 소문자('김 솔' == '김솔') */
export const receptionNameKey = (name: string) => name.normalize('NFKC').replace(/[\s​-‍﻿]+/g, '').toLowerCase();

/** 응모권 번호 'No. 007' */
export const ticketLabel = (n: number) => `No. ${String(n).padStart(3, '0')}`;

/** ISO → KST 'HH:mm' */
export function kstHm(iso?: string | null): string {
  if (!iso) return '';
  const k = new Date(new Date(iso).getTime() + KST_MS);
  if (Number.isNaN(k.getTime())) return '';
  return `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`;
}

export const adminErrorText = (e: any, fallback = '처리하지 못했어요') => {
  const m = e?.response?.data?.message;
  return (Array.isArray(m) ? m.join(', ') : m) || e?.message || fallback;
};

/** 동작 줄이기 설정 — 촤라락·굴리기 연출을 끈다 */
export function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduce;
}

/* ─── 폴링 훅 ─────────────────────────────────────────────────────
 * 태블릿을 켜 둔 채 행사 내내 본다 — 탭이 숨으면 멈추고 돌아오면 바로 한 번 받는다.
 * 실패해도 이전 화면은 그대로(error 만 바뀜). 겹쳐 부르지 않는다.
 * 고치기(mutate) 중에 떠난 폴링 응답은 버린다 — 늦게 온 옛 값이 방금 바꾼 화면을 덮지 않게. */
function useReceptionPoll<T>(path: string, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const epoch = useRef(0);
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const mine = epoch.current;
    try {
      const d = (await adminFetch('GET', path, undefined, { cache: false })) as T;
      if (mine === epoch.current) {
        setData(d);
        setError(null);
      }
    } catch (e: any) {
      if (mine === epoch.current) setError(adminErrorText(e, '불러오지 못했어요'));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    let alive = true;
    let timer = 0;
    let gen = 0;
    const run = async (g: number) => {
      if (!alive || g !== gen || document.hidden) return; // 숨으면 다음 판을 안 잡는다(돌아오면 restart)
      await load();
      if (!alive || g !== gen || intervalMs <= 0) return;
      timer = window.setTimeout(() => run(g), intervalMs);
    };
    const restart = () => {
      gen += 1;
      window.clearTimeout(timer);
      run(gen);
    };
    restart();
    const onVis = () => { if (!document.hidden) restart(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load, intervalMs]);
  useAdminRefresh(load);

  /** 서버를 고치고 그 응답(= 새 화면 값)을 바로 넣는다. pick = 응답에서 화면 값 꺼내기 */
  const mutate = useCallback(async <R,>(fn: () => Promise<R>, pick?: (r: R) => T): Promise<R> => {
    epoch.current += 1;
    try {
      const r = await fn();
      epoch.current += 1;
      setData(pick ? pick(r) : (r as unknown as T));
      setError(null);
      return r;
    } catch (e) {
      epoch.current += 1;
      throw e;
    }
  }, []);

  return { data, loading, error, reload: load, mutate };
}

/** 입장 현황 · 자리 명단 — 기본 3초 */
export const useReceptionLive = (intervalMs = 3000) => useReceptionPoll<ReceptionLive>(`${BASE}/live`, intervalMs);
/** 퀴즈 진행 — 2초(손님 화면은 3초) */
export const useReceptionQuiz = (intervalMs = 2000) => useReceptionPoll<QuizAdmin>(`${BASE}/quiz`, intervalMs);
/** 럭키드로우 — 5초 */
export const useReceptionDraws = (intervalMs = 5000) => useReceptionPoll<DrawBoard>(`${BASE}/draws`, intervalMs);

/** 고치는 요청 — 응답은 각 화면 값(ReceptionLive · QuizAdmin · DrawBoard) */
export const receptionAdminApi = {
  ticketsMode: (mode: TicketsMode) => adminFetch('POST', `${BASE}/tickets/mode`, { mode }) as Promise<ReceptionLive>,
  /** 지운 이름은 막힌다(다시 안 나옴) — 실수였으면 unblockTicket(이름)으로 풀기 */
  deleteTicket: (id: string) => adminFetch('DELETE', `${BASE}/tickets/${encodeURIComponent(id)}`) as Promise<ReceptionLive>,
  unblockTicket: (name: string) => adminFetch('POST', `${BASE}/tickets/unblock`, { name }) as Promise<ReceptionLive>,
  putSeats: (rows: { name: string; table: number; seat: number | null }[]) => adminFetch('PUT', `${BASE}/seats`, { rows }) as Promise<ReceptionLive>,
  quizState: (body: { action: QuizStateAction; questionId?: string; on?: boolean }) => adminFetch('POST', `${BASE}/quiz/state`, body) as Promise<QuizAdmin>,
  /** answer 키 = 답 저장/지우기(null·''), correct 키 = O/X 고정(null = 자동으로) — 넣은 키만 바뀐다 */
  quizAnswer: (body: { questionId: string; table: number; answer?: string | null; correct?: boolean | null }) => adminFetch('PUT', `${BASE}/quiz/answer`, body) as Promise<QuizAdmin>,
  draw: (prize: string) => adminFetch('POST', `${BASE}/draws`, { prize }) as Promise<{ draw: DrawRow; board: DrawBoard }>,
  cancelDraw: (id: string) => adminFetch('POST', `${BASE}/draws/${encodeURIComponent(id)}/cancel`) as Promise<DrawBoard>,
};
