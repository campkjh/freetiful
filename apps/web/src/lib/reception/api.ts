'use client';

// 송년회 이벤트·설문 API(NestJS apps/api/src/reception) — 같은 출처 /api/v1/** 를 Next rewrites 가 Railway 로 넘긴다.
// apiClient(axios) 대신 fetch: 로그인 없는 화면이라 401 → 로그인 시트 흐름을 타면 안 된다(wedding-run.api.ts 와 같은 이유).
// 로그인 상태면 토큰만 붙인다(261122 사장 '당첨이 되면 푸시 알람이 가게끔 당사자에게') — 서버가 손님 표·응모권에 계정을 붙여 당첨 푸시를 보낸다.
// 토큰이 없거나 틀려도 서버는 401 을 내지 않는다(OptionalJwtAuthGuard). 같은 출처라 CORS 는 그대로.
import { useAuthStore } from '@/lib/store/auth.store';
import { RECEPTION_EVENT_KEY } from './event';

const BASE = `/api/v1/reception/${RECEPTION_EVENT_KEY}`;

export type VoteKind = 'like' | 'empathy';

export interface ReceptionPhoto {
  id: string;
  name: string;
  imageUrl: string;
  thumbUrl: string;
  width: number;
  height: number;
  likes: number;
  empathies: number;
  createdAt: string;
  rank: number;
  mine: boolean;
  liked: boolean;
  empathized: boolean;
}

export interface ReceptionFeed {
  photos: ReceptionPhoto[];
  me: { likesLeft: number; empathiesLeft: number; myPhotoId: string | null; limit: number };
}

/** 2차 회식 참여(261122 설문 첫 질문) */
export type AfterPartyAnswer = 'yes' | 'no';

export interface SurveyAnswers {
  /** 2차 회식 참여 — 옛 응답엔 없음. 누르는 순간 PUT /after-party 로도 따로 저장된다 */
  afterParty?: AfterPartyAnswer;
  rating: number;
  best: string;
  again: 'yes' | 'maybe' | 'no';
  comment: string;
}

/* ─── 입장(이름 남기기) · 자리 · 럭키드로우 응모권 — PUT /guest 응답(서버 명세 D) ─── */
export interface ReceptionTicket {
  number: number;
  name: string;
  issuedAt: string;
  /** 취소 안 된 추첨 중 가장 최근 것 */
  win: { prize: string; at: string } | null;
}

/** 동명이인 — 명단에 같은 이름이 2줄 이상일 때 한 줄(손님이 함께 앉는 사람을 보고 고른다) */
export interface ReceptionSameName {
  table: number;
  seat: number | null;
  /** 같은 테이블에 앉는 사람들(좌석 순) */
  mates: string[];
}

export interface ReceptionMe {
  ok: true;
  name: string;
  /** 자리 명단이 1줄이라도 있나 — 없으면 웹이 임시 자리(seatFor)를 보여 준다 */
  seatListLoaded: boolean;
  /** 명단에서 찾은 자리(없으면 null). 동명이인이면 고른 자리(아직 안 골랐으면 null) */
  seat: { table: number; seat: number | null } | null;
  /** 동명이인이면 고를 자리들(테이블 순), 아니면 null — 예전 서버는 안 보냄 */
  sameName: ReceptionSameName[] | null;
  ticketsOpen: boolean;
  ticket: ReceptionTicket | null;
}

/* ─── 퀴즈(서버가 정답의 유일한 출처 — 정답 칸은 공개된 문제만 온다) ─── */
export type QuizKind = 'text' | 'ox' | 'choice' | 'match' | 'mission';
export type QuizPhase = 'idle' | 'open' | 'locked' | 'revealed';

export interface QuizState {
  currentId: string | null;
  phase: QuizPhase;
  openedAt: string | null;
  revealed: string[];
  /** 손님 화면 맨 위에 '순위 발표' 점수판을 크게 */
  showBoard: boolean;
}

export interface QuizQuestionPublic {
  id: string;
  round: 1 | 2 | 3;
  roundTitle: string;
  no: number;
  kind: QuizKind;
  points: number;
  prompt: string;
  /** choice 보기 / match 오른쪽 보기('A) 피자스쿨' …) */
  options?: string[];
  /** match 왼쪽 칸 이름('1)' …) */
  slots?: string[];
  slotImages?: string[];
  image?: string;
  placeholder?: string;
  /** mission 규칙 줄 */
  notes?: string[];
  /** 공개된 문제만 */
  answerLabel?: string;
  explanation?: string;
}

export interface QuizTableResult {
  table: number;
  answer: string | null;
  display: string | null;
  name: string | null;
  correct: boolean;
}

export interface QuizBoardRow {
  table: number;
  score: number;
  correct: number;
}

export interface QuizMine {
  questionId: string;
  answer: string;
  display: string;
  name: string;
  updatedAt: string;
  /** 미션만(261122) — 우리 테이블 도전 결과. name = 도전한 사람(운영팀이 도전 없이 결과만 찍었으면 '') */
  result?: 'pending' | 'success' | 'fail';
}

export interface QuizPublic {
  state: QuizState;
  questions: QuizQuestionPublic[];
  /** table 을 주고 지금 문제에 그 테이블 답이 있으면 */
  mine: QuizMine | null;
  /** 공개된 문제만 — tables 는 1~테이블 수 전부(안 낸 테이블 answer null) */
  results: Record<string, { answerLabel: string; explanation?: string; tables: QuizTableResult[] }>;
  board: QuizBoardRow[];
  tableCount: number;
}

/** call 이 던지는 오류 — status = 서버 응답 코드(망 오류로 응답 자체가 없으면 undefined) */
export type ReceptionApiError = Error & { status?: number };

async function call<T>(path: string, deviceId: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'X-RC-Device': deviceId };
  if (init.body && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  try {
    const token = useAuthStore.getState().accessToken;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* 저장소 접근 불가 — 손님(기기)으로만 */
  }
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store', ...init, headers: { ...headers, ...(init.headers as any) } });
  if (!res.ok) {
    let msg = res.status === 413 ? '사진이 너무 커요. 다른 사진으로 올려 주세요.' : '잠시 후 다시 시도해 주세요.';
    try {
      const j = await res.json();
      const m = Array.isArray(j?.message) ? j.message[0] : j?.message;
      if (typeof m === 'string' && m && res.status < 500) msg = m;
    } catch {}
    // status 도 실어 보낸다 — 받는 쪽이 '서버가 답을 거절(400)'과 '망 · 서버 오류'를 가를 수 있게(망 오류는 fetch 가 던져 status 없음)
    const err = new Error(msg) as ReceptionApiError;
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const receptionApi = {
  feed: (deviceId: string) => call<ReceptionFeed>('/photos', deviceId),
  upload: (deviceId: string, name: string, file: Blob, fileName: string) => {
    const fd = new FormData();
    fd.append('name', name);
    fd.append('file', file, fileName);
    return call<ReceptionFeed>('/photos', deviceId, { method: 'POST', body: fd });
  },
  remove: (deviceId: string, id: string) => call<ReceptionFeed>(`/photos/${encodeURIComponent(id)}`, deviceId, { method: 'DELETE' }),
  vote: (deviceId: string, id: string, kind: VoteKind, on: boolean) =>
    call<ReceptionFeed>(`/photos/${encodeURIComponent(id)}/votes`, deviceId, { method: 'POST', body: JSON.stringify({ kind, on }) }),
  /** 손님 남기기(어드민 참여자 목록) + 자리 · 응모권 — 이름이 있는 기기만. 발급 시간이면 서버가 응모권도 같이 낸다(한 사람 한 장).
   *  옛 서버는 { ok } 만 준다 → 받는 쪽은 lib/reception/me.ts normalizeMe 로 빈 칸을 채워 쓴다 */
  /** pick = 동명이인일 때 고른 테이블(고른 적 없으면 안 보냄) */
  guest: (deviceId: string, name: string, pick?: number | null) =>
    call<ReceptionMe>('/guest', deviceId, { method: 'PUT', body: JSON.stringify(pick ? { name, pick } : { name }) }),
  /** 퀴즈 지금 상태 · 문제 · 공개된 정답과 테이블별 답 · 점수판. table 을 주면 그 테이블의 지금 문제 답(mine)도 */
  quiz: (deviceId: string, table?: number | null) =>
    call<QuizPublic>(`/quiz${table ? `?table=${encodeURIComponent(String(table))}` : ''}`, deviceId),
  /** 테이블 답 내기(같은 테이블은 마지막에 낸 답 하나) — 응답 = 그 테이블 기준 QuizPublic */
  answer: (deviceId: string, body: { questionId: string; table: number; answer: string; name: string }) =>
    call<QuizPublic>('/quiz/answer', deviceId, { method: 'PUT', body: JSON.stringify(body) }),
  /** 스페셜 미션 도전하기(261122) — 테이블당 1명 · 한 번. 이미 도전한 사람이 있으면 400('이미 ○○ 님이 도전했어요'). 응답 = 그 테이블 기준 QuizPublic */
  challenge: (deviceId: string, body: { questionId: string; table: number; name: string }) =>
    call<QuizPublic>('/quiz/challenge', deviceId, { method: 'PUT', body: JSON.stringify(body) }),
  survey: (deviceId: string) => call<ReceptionSurveyMine>('/survey', deviceId),
  saveSurvey: (deviceId: string, name: string, answers: SurveyAnswers) =>
    call<ReceptionSurveyMine>('/survey', deviceId, { method: 'PUT', body: JSON.stringify({ name, answers }) }),
  /** 2차 회식 참여 — 누르는 순간 손님 표에 저장(설문을 안 내도 어드민 참여자 판에 '2차 참여'). 응답 = 저장된 값 */
  setAfterParty: (deviceId: string, name: string, going: AfterPartyAnswer) =>
    call<{ afterParty: AfterPartyAnswer; afterPartyAt: string }>('/after-party', deviceId, { method: 'PUT', body: JSON.stringify({ name, going }) }),
};

/** GET · PUT /survey 응답 — afterParty 는 손님 표 값(설문을 안 내도 있음). 옛 서버는 survey 만 보낸다 */
export interface ReceptionSurveyMine {
  survey: { name: string; answers: SurveyAnswers; updatedAt: string } | null;
  afterParty?: AfterPartyAnswer | null;
  afterPartyAt?: string | null;
}

/** 올리기 전에 줄인다 — 폰 원본(3~8MB)은 웹 앞단(Vercel) 본문 한도에 걸릴 수 있다. 실패하면 원본 그대로 */
export async function shrinkPhoto(file: File): Promise<{ blob: Blob; name: string }> {
  const MAX = 2048;
  try {
    let src: ImageBitmap | HTMLImageElement;
    let w: number;
    let h: number;
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
      src = bmp; w = bmp.width; h = bmp.height;
    } catch {
      const url = URL.createObjectURL(file);
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        src = img; w = img.naturalWidth; h = img.naturalHeight;
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    }
    const scale = Math.min(1, MAX / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no ctx');
    ctx.drawImage(src as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.88));
    if (!blob) throw new Error('no blob');
    return { blob, name: 'photo.jpg' };
  } catch {
    return { blob: file, name: file.name || 'photo.jpg' };
  }
}
