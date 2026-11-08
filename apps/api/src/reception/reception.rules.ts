/**
 * 송년회(261108 사장 'Freetiful & WMAK 2026 Year-End RECEPTION' — 웹 /reception) 규칙 한 곳.
 * 손님은 로그인 없이 '기기 + 이름' — 기기 = 브라우저가 처음 만든 UUID(머리글 X-RC-Device), 이름 = 자리 탭에서 입력한 것.
 *  · 이벤트 탭: 한 기기 = 살아 있는 사진 1장. 좋아요·공감은 각각 한 사람 10개까지(사진 한 장에 종류별 1개, 내 사진엔 못 누름).
 *    사진이 받는 좋아요·공감 수는 무제한. 순위 = 공감 많은 순 → 좋아요 많은 순 → 먼저 올린 순.
 *  · 설문: 기기당 1건(다시 내면 덮어씀).
 */

export const RECEPTION_EVENTS = ['wmak-2026'] as const;
export type ReceptionEventKey = (typeof RECEPTION_EVENTS)[number];

export const VOTE_KINDS = ['like', 'empathy'] as const;
export type ReceptionVoteKind = (typeof VOTE_KINDS)[number];

/** 한 사람이 누를 수 있는 좋아요 · 공감 수(종류별) */
export const VOTE_LIMIT = 10;
/** 한 기기가 한 시간에 올릴 수 있는 사진 수(지우고 다시 올리기 반복 막기) */
export const UPLOAD_PER_HOUR = 10;
export const PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export const NAME_MAX = 20;
export const SURVEY_COMMENT_MAX = 500;

export const isReceptionEvent = (v: unknown): v is ReceptionEventKey =>
  typeof v === 'string' && (RECEPTION_EVENTS as readonly string[]).includes(v);

export const isVoteKind = (v: unknown): v is ReceptionVoteKind =>
  typeof v === 'string' && (VOTE_KINDS as readonly string[]).includes(v);

/** 기기 id — 웹이 crypto.randomUUID() 로 만든 값(다른 모양은 받지 않는다) */
export function parseDeviceId(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s) ? s : null;
}

/** 이름 — 앞뒤·겹친 띄어쓰기 정리, 제어 문자 제거, 1~20자. 안 맞으면 null */
export function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (!s || [...s].length > NAME_MAX) return null;
  return s;
}

export interface RankablePhoto {
  id: string;
  likes: number;
  empathies: number;
  createdAt: Date;
}

/** 순위 — 공감 많은 순, 같으면 좋아요 많은 순, 같으면 먼저 올린 순 */
export function compareRank(a: RankablePhoto, b: RankablePhoto): number {
  return (
    b.empathies - a.empathies ||
    b.likes - a.likes ||
    a.createdAt.getTime() - b.createdAt.getTime() ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

export interface SurveyAnswers {
  /** 오늘 행사 만족도 1~5 */
  rating: number;
  /** 가장 좋았던 순서(식순 이름) — 없으면 '' */
  best: string;
  /** 내년에도 함께 — 'yes' | 'maybe' | 'no' */
  again: 'yes' | 'maybe' | 'no';
  comment: string;
}

/** 설문 답 검사 — 틀리면 이유 문자열 */
export function parseSurvey(v: unknown): SurveyAnswers | string {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const rating = Number(o.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return '만족도를 골라 주세요.';
  const again = o.again;
  if (again !== 'yes' && again !== 'maybe' && again !== 'no') return '내년 참석 여부를 골라 주세요.';
  const best = typeof o.best === 'string' ? o.best.trim().slice(0, 40) : '';
  const comment = typeof o.comment === 'string' ? o.comment.replace(/\u0000/g, '').trim() : '';
  if ([...comment].length > SURVEY_COMMENT_MAX) return `하고 싶은 말은 ${SURVEY_COMMENT_MAX}자까지 쓸 수 있어요.`;
  return { rating, best, again, comment };
}
