'use client';

// 송년회 이벤트·설문 API(NestJS apps/api/src/reception) — 같은 출처 /api/v1/** 를 Next rewrites 가 Railway 로 넘긴다.
// apiClient(axios) 대신 fetch: 로그인 없는 화면이라 401 → 로그인 시트 흐름을 타면 안 된다(wedding-run.api.ts 와 같은 이유).
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

export interface SurveyAnswers {
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

export interface ReceptionMe {
  ok: true;
  name: string;
  /** 자리 명단이 1줄이라도 있나 — 없으면 웹이 임시 자리(seatFor)를 보여 준다 */
  seatListLoaded: boolean;
  /** 명단에서 찾은 자리(없으면 null) */
  seat: { table: number; seat: number | null } | null;
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

async function call<T>(path: string, deviceId: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'X-RC-Device': deviceId };
  if (init.body && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store', ...init, headers: { ...headers, ...(init.headers as any) } });
  if (!res.ok) {
    let msg = res.status === 413 ? '사진이 너무 커요. 다른 사진으로 올려 주세요.' : '잠시 후 다시 시도해 주세요.';
    try {
      const j = await res.json();
      const m = Array.isArray(j?.message) ? j.message[0] : j?.message;
      if (typeof m === 'string' && m && res.status < 500) msg = m;
    } catch {}
    throw new Error(msg);
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
  guest: (deviceId: string, name: string) => call<ReceptionMe>('/guest', deviceId, { method: 'PUT', body: JSON.stringify({ name }) }),
  /** 퀴즈 지금 상태 · 문제 · 공개된 정답과 테이블별 답 · 점수판. table 을 주면 그 테이블의 지금 문제 답(mine)도 */
  quiz: (deviceId: string, table?: number | null) =>
    call<QuizPublic>(`/quiz${table ? `?table=${encodeURIComponent(String(table))}` : ''}`, deviceId),
  /** 테이블 답 내기(같은 테이블은 마지막에 낸 답 하나) — 응답 = 그 테이블 기준 QuizPublic */
  answer: (deviceId: string, body: { questionId: string; table: number; answer: string; name: string }) =>
    call<QuizPublic>('/quiz/answer', deviceId, { method: 'PUT', body: JSON.stringify(body) }),
  survey: (deviceId: string) => call<{ survey: { name: string; answers: SurveyAnswers; updatedAt: string } | null }>('/survey', deviceId),
  saveSurvey: (deviceId: string, name: string, answers: SurveyAnswers) =>
    call<{ survey: { name: string; answers: SurveyAnswers; updatedAt: string } | null }>('/survey', deviceId, { method: 'PUT', body: JSON.stringify({ name, answers }) }),
};

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
