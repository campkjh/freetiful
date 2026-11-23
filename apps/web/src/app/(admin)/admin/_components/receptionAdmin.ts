'use client';

// 송년회 어드민(참여자 · 설문 응답) 공용 — API GET /api/v1/admin/reception/:eventKey(apps/api reception-admin.controller.ts).
// 참여자 = 자리 탭에서 이름을 넣은 기기 ∪ 사진·좋아요/공감·설문을 한 기기. 기기가 곧 한 사람(로그인 없음).
// (261122 2차) 입장 현황 · 퀴즈 · 럭키드로우 · 자리 명단 — 응답 타입은 서버 명세 E 그대로, 태블릿 한 대가 폴링으로 본다.
// (261122 3차) 참여자 판 — GET :eventKey/people(자리 명단 전원 + 명단 밖 손님). 태그 · 줄 색 · 맨 위 순서는 아래 personStage 한 곳에서 정한다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { adminFetch } from './adminFetch';
import { useAdminRefresh } from './adminRefresh';
import { RECEPTION_DAY, RECEPTION_EVENT_KEY, RECEPTION_PROGRAM } from '@/lib/reception/event';

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
  /** afterParty = 2차 회식 참여(261122 설문 첫 질문 — 옛 응답엔 없음) */
  answers: { afterParty?: 'yes' | 'no'; rating?: number; best?: string; again?: 'yes' | 'maybe' | 'no'; comment?: string };
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
  /** 'rename' = 테이블 배치에서 이름을 고쳐 빈 옛 이름(운영자가 지운 게 아님 — '지운 이름' 카드엔 안 보임) */
  reason?: 'rename';
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
  /** [+60초]로 더한 초 — 옛 서버엔 없음 */
  extraSec?: number;
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

export type QuizStateAction = 'open' | 'lock' | 'reveal' | 'unreveal' | 'idle' | 'board' | 'reset' | 'extend';

export interface DrawPrize { name: string; total: number; drawn: number; /** 세는 말('개' · 정장은 '벌') — 예전 API 엔 없음 */ unit?: string }
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

/* ─── 3차(261122) 참여자 판 — apps/api reception-people.service.ts 와 같은 모양 ─────────── */

export interface PersonPhoto {
  thumbUrl: string;
  imageUrl: string;
  rank: number;
  likes: number;
  empathies: number;
  at: string;
}

/** 스페셜 미션 도전(261122) — 테이블 대표 1명. id 로 판정(receptionAdminApi.judgeChallenge) */
export type MissionResult = 'pending' | 'success' | 'fail';
export interface PersonChallenge {
  id: string;
  questionId: string;
  title: string;
  table: number;
  /** 성공하면 그 테이블이 받는 점수 */
  points: number;
  result: MissionResult;
  /** 도전한 때(판정해도 안 바뀜) */
  at: string;
}

/** 한 줄 = 한 사람(명단 한 줄 · 명단 밖 손님). 도착 = 응모권이 나온 때 */
export interface PersonRow {
  /** 명단 줄 = 줄 열쇠(동명이인 '이름열쇠 @테이블'), 명단 밖 = 'x:이름열쇠' */
  key: string;
  name: string;
  listed: boolean;
  table: number | null;
  seat: number | null;
  arrivedAt: string | null;
  ticket: { id: string; number: number } | null;
  quizAt: string | null;
  quizCount: number;
  photo: PersonPhoto | null;
  votedAt: string | null;
  likesUsed: number;
  empathiesUsed: number;
  surveyAt: string | null;
  win: ReceptionWin | null;
  /** 스페셜 미션 도전(옛 서버는 없음) */
  challenges?: PersonChallenge[];
  /** 2차 회식 참여(설문 첫 질문 — 누르는 순간 저장). 안 골랐으면 null · 옛 서버는 없음 */
  afterParty?: { going: 'yes' | 'no'; at: string | null } | null;
  devices: number;
  lastSeenAt: string | null;
}

export interface ReceptionPeople {
  serverTime: string;
  ticketsMode: TicketsMode;
  ticketsOpen: boolean;
  blocked: TicketBlock[];
  people: PersonRow[];
  /** 테이블 퀴즈 점수(손님 점수판과 같음 — 공개된 문제 + 미션 성공). 옛 서버는 없음 */
  quizScores?: QuizScore[];
}

/**
 * 참여자 태그 단계(261122 사장 '앱에 이름을 입력하면 해당 테이블이 최상단 · 은은한 하늘색 · 도착 태그 →
 * 럭키드로우·이벤트 참여하면 태그가 바뀌고 그때마다 색(노랑 · 보라 등)이 바뀌고 위로').
 *  · none = 아직 안 옴(태그 없음 · 맨 아래 테이블 → 좌석 → 이름 순)
 *  · 온 사람은 한 일 중 가장 최근 것이 태그 — 도착 · 퀴즈 · 미션 도전 · 베스트드레서(사진 올림 / 좋아요·공감 누름) · 설문 · 당첨.
 *    도착보다 이른 기록(행사 전 시험 데이터)은 안 센다. 시각이 같으면 당첨 > 설문 > 베스트드레서 > 미션 > 퀴즈 > 도착.
 *  · (261122 사장 '퀴즈에 도전 버튼 → 참여자 명단에 실패 성공 버튼') 미션 = 도전한 때(주황) — 태그는 '미션 도전 중' → 판정하면
 *    '미션 성공 +300점' / '미션 실패'. 판정은 시각을 안 밀어서 누르는 순간 줄이 튀지 않는다.
 *  · 온 사람끼리는 그 시각(stageAt)이 늦을수록 위 — 방금 뭔가 한 사람이 맨 위.
 */
export type PersonStage = 'none' | 'arrived' | 'quiz' | 'mission' | 'dresser' | 'survey' | 'win';
const STAGE_ORDER: Record<PersonStage, number> = { none: -1, arrived: 0, quiz: 1, mission: 2, dresser: 3, survey: 4, win: 5 };

const isoMs = (v?: string | null): number | null => {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
};

/** 베스트드레서 활동 시각 = 사진 올린 때와 마지막으로 누른 때 중 늦은 것 */
export function dresserAt(p: PersonRow): number | null {
  const a = isoMs(p.photo?.at);
  const b = isoMs(p.votedAt);
  return a == null ? b : b == null ? a : Math.max(a, b);
}

export interface PersonStageInfo {
  stage: PersonStage;
  /** 그 단계 시각(ms) — none 이면 0 */
  at: number;
  quiz: boolean;
  mission: boolean;
  dresser: boolean;
  survey: boolean;
  win: boolean;
}

/** 마지막 도전(태그 · 시각) */
export const lastChallenge = (p: PersonRow): PersonChallenge | null => {
  const list = p.challenges || [];
  return list.length ? list.reduce((a, b) => (b.at > a.at ? b : a)) : null;
};

export function personStage(p: PersonRow): PersonStageInfo {
  const arrived = isoMs(p.arrivedAt);
  if (arrived == null) return { stage: 'none', at: 0, quiz: false, mission: false, dresser: false, survey: false, win: false };
  let stage: PersonStage = 'arrived';
  let at = arrived;
  const seen = (s: PersonStage, t: number | null) => {
    if (t == null || t < arrived) return false;
    if (t > at || (t === at && STAGE_ORDER[s] > STAGE_ORDER[stage])) {
      stage = s;
      at = t;
    }
    return true;
  };
  const quiz = seen('quiz', isoMs(p.quizAt));
  const mission = seen('mission', isoMs(lastChallenge(p)?.at));
  const dresser = seen('dresser', dresserAt(p));
  const survey = seen('survey', isoMs(p.surveyAt));
  const win = seen('win', isoMs(p.win?.at));
  return { stage, at, quiz, mission, dresser, survey, win };
}

/** 줄 순서 — 온 사람(최근 활동 위) → 안 온 사람(테이블 → 좌석 → 이름, 명단 밖은 맨 끝) */
export function comparePeople(a: { p: PersonRow; s: PersonStageInfo }, b: { p: PersonRow; s: PersonStageInfo }): number {
  const an = a.s.stage === 'none';
  const bn = b.s.stage === 'none';
  if (an !== bn) return an ? 1 : -1;
  if (!an && a.s.at !== b.s.at) return b.s.at - a.s.at;
  return (
    (a.p.table ?? 99) - (b.p.table ?? 99) ||
    (a.p.seat ?? 99) - (b.p.seat ?? 99) ||
    a.p.name.localeCompare(b.p.name, 'ko') ||
    (a.p.key < b.p.key ? -1 : a.p.key > b.p.key ? 1 : 0)
  );
}

/** 1부 · 2부 시작(KST) — 식순표(RECEPTION_PROGRAM)의 부별 첫 시각. 못 읽으면 18:20 · 19:40(261108 식순표) */
function partStart(part: 1 | 2, fallback: string): number {
  const time = RECEPTION_PROGRAM.find((x) => x.part === part && x.time && /^\d{1,2}:\d{2}/.test(x.time))?.time;
  const hm = (time || fallback).match(/^(\d{1,2}):(\d{2})/);
  const t = hm ? Date.parse(`${RECEPTION_DAY}T${hm[1].padStart(2, '0')}:${hm[2]}:00+09:00`) : NaN;
  return Number.isFinite(t) ? t : Date.parse(`2026-11-23T${fallback}:00+09:00`);
}
export const PART1_AT = partStart(1, '18:20');
export const PART2_AT = partStart(2, '19:40');

/** 도착 태그 글 — 지금 시각(KST)으로: 1부 시작 전 '도착' · 1부 '1부 참여중' · 2부 시작부터 '2부 참여중' */
export function arrivedTagText(nowMs: number): string {
  if (nowMs >= PART2_AT) return '2부 참여중';
  if (nowMs >= PART1_AT) return '1부 참여중';
  return '도착';
}

export function stageTagText(p: PersonRow, stage: PersonStage, nowMs: number): string | null {
  switch (stage) {
    case 'arrived': return arrivedTagText(nowMs);
    case 'quiz': return '퀴즈 참여';
    case 'mission': {
      const c = lastChallenge(p);
      if (!c) return '미션 도전';
      return c.result === 'success' ? `미션 성공 +${c.points}점` : c.result === 'fail' ? '미션 실패' : '미션 도전 중';
    }
    case 'dresser': return '베스트드레서';
    case 'survey': return '설문 완료';
    case 'win': return p.win ? `당첨 · ${p.win.prize}` : '당첨';
    default: return null;
  }
}

/* ─── 작은 도움 함수 ───────────────────────────────────────────── */

const BASE = `/api/v1/admin/reception/${RECEPTION_EVENT_KEY}`;
const KST_MS = 9 * 3600000;

/** 한 문제 제한 시간(표시만 — 마감은 운영자가 누른다) · 분:초 — 손님 화면과 한 곳(lib/reception/quiz.ts)에서 */
export { QUIZ_SECONDS, quizClock } from '@/lib/reception/quiz';
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
 * 고치기(mutate) 중에 떠난 폴링 응답은 버린다 — 늦게 온 옛 값이 방금 바꾼 화면을 덮지 않게.
 * accept(3차) = 폴링 응답을 넣을지 — false 면 이전 화면 유지(참여자 판: 갑자기 빈 목록이 오면 지우지 않기). 세 번 연달아 false 면 그땐 넣는다(정말 비운 것). */
function useReceptionPoll<T>(path: string, intervalMs: number, accept?: (next: T, prev: T | null) => boolean) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const epoch = useRef(0);
  const busy = useRef(false);
  const last = useRef<T | null>(null);
  const rejected = useRef(0);
  const acceptRef = useRef(accept);
  acceptRef.current = accept;

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const mine = epoch.current;
    try {
      const d = (await adminFetch('GET', path, undefined, { cache: false })) as T;
      if (mine === epoch.current) {
        const ok = !acceptRef.current || acceptRef.current(d, last.current);
        rejected.current = ok ? 0 : rejected.current + 1;
        if (ok || rejected.current >= 3) {
          rejected.current = 0;
          last.current = d;
          setData(d);
        }
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
      const next = pick ? pick(r) : (r as unknown as T);
      last.current = next;
      rejected.current = 0;
      setData(next);
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
/** 참여자 판 — 2초(서버가 1초 묶음). 사람이 있다가 갑자기 0명이 오면 그 판은 버린다(연결이 꼬인 빈 응답에 표가 지워지지 않게) */
const keepPeople = (next: ReceptionPeople, prev: ReceptionPeople | null) => !((prev?.people?.length ?? 0) > 0 && (next?.people?.length ?? 0) === 0);
export const useReceptionPeople = (intervalMs = 2000) => useReceptionPoll<ReceptionPeople>(`${BASE}/people`, intervalMs, keepPeople);

/** 고치는 요청 — 응답은 각 화면 값(ReceptionLive · QuizAdmin · DrawBoard) */
export const receptionAdminApi = {
  ticketsMode: (mode: TicketsMode) => adminFetch('POST', `${BASE}/tickets/mode`, { mode }) as Promise<ReceptionLive>,
  /** 지운 이름은 막힌다(다시 안 나옴) — 실수였으면 unblockTicket(이름)으로 풀기 */
  /** 손님 사진 내리기(베스트드레서) — 받은 좋아요 · 공감도 같이 지움 */
  deletePhoto: (id: string) => adminFetch('DELETE', `${BASE}/photos/${encodeURIComponent(id)}`) as Promise<{ ok: true; removed: boolean }>,
  deleteTicket: (id: string) => adminFetch('DELETE', `${BASE}/tickets/${encodeURIComponent(id)}`) as Promise<ReceptionLive>,
  unblockTicket: (name: string) => adminFetch('POST', `${BASE}/tickets/unblock`, { name }) as Promise<ReceptionLive>,
  putSeats: (rows: { name: string; table: number; seat: number | null }[]) => adminFetch('PUT', `${BASE}/seats`, { rows }) as Promise<ReceptionLive>,
  quizState: (body: { action: QuizStateAction; questionId?: string; on?: boolean }) => adminFetch('POST', `${BASE}/quiz/state`, body) as Promise<QuizAdmin>,
  /** answer 키 = 답 저장/지우기(null·''), correct 키 = O/X 고정(null = 자동으로) — 넣은 키만 바뀐다 */
  quizAnswer: (body: { questionId: string; table: number; answer?: string | null; correct?: boolean | null }) => adminFetch('PUT', `${BASE}/quiz/answer`, body) as Promise<QuizAdmin>,
  draw: (prize: string, batch = false) => adminFetch('POST', `${BASE}/draws${batch ? '/batch' : ''}`, { prize }) as Promise<{ draw: DrawRow; winners?: DrawRow[]; board: DrawBoard; participants?: { number: number; name: string }[] }>,
  /** 물리 연출 추첨(핀볼 레이스 · 체스타필드 배틀) — 무대가 정한 순서대로 응모권 번호를 당첨으로 기록. 안 뽑힌 응모권 · 남은 경품만 */
  /** 물리 판이 정한 당첨 — numbers 와 같은 순서의 응모권 id(판에 들어간 그 응모권인지 서버가 대조) */
  pick: (prize: string, numbers: number[], ids: string[]) => adminFetch('POST', `${BASE}/draws/pick`, { prize, numbers, ids }) as Promise<{ draw: DrawRow; winners?: DrawRow[]; board: DrawBoard }>,
  /** 입장 현황을 지금 값으로(폴링 기다리지 않고) — 물리 연출에 넣을 참가자를 누르는 순간 기준으로 */
  live: () => adminFetch('GET', `${BASE}/live`, undefined, { cache: false }) as Promise<ReceptionLive>,
  board: () => adminFetch('GET', `${BASE}/draws`, undefined, { cache: false }) as Promise<DrawBoard>,
  cancelDraw: (id: string) => adminFetch('POST', `${BASE}/draws/${encodeURIComponent(id)}/cancel`) as Promise<DrawBoard>,
  resetDraws: (expectedIds: string[]) => adminFetch('POST', `${BASE}/draws/reset`, { expectedIds }) as Promise<DrawBoard>,
  /** 미션 도전 판정 — success(점수) · fail · pending(되돌리기) · cancel(도전 지우기). 그 사이 도전이 바뀌었으면 400 */
  judgeChallenge: (id: string, result: MissionResult | 'cancel') => adminFetch('PUT', `${BASE}/quiz/challenge`, { id, result }) as Promise<QuizAdmin>,
  /** 참여자 판 — fresh = 서버 1초 묶음 건너뛰기(방금 고친 것이 바로 보이게) */
  people: (fresh = false) => adminFetch('GET', `${BASE}/people${fresh ? '?fresh=1' : ''}`, undefined, { cache: false }) as Promise<ReceptionPeople>,
};
