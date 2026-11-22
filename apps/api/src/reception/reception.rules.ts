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

// ───────────── 2차(261122) — 자리 명단 · 럭키드로우 응모권 · 퀴즈 테이블 ─────────────

/** 테이블 수 · 테이블당 좌석 — 웹 lib/reception/event.ts(TABLE_COUNT · SEATS_PER_TABLE)와 같게(261122 사장 배정표 = 18개) */
export const TABLE_COUNT = 18;
export const SEATS_PER_TABLE = 8;
/** 자리 명단 최대 줄 수(손님 ~150명, 넉넉히) */
export const SEAT_ROWS_MAX = 400;
export const PRIZE_MAX = 40;

/** 이름 비교 열쇠 — 띄어쓰기 전부 빼고 소문자(NFKC). '김 솔' == '김솔', 전각 글자도 같게 */
export function nameKey(name: string): string {
  return name.normalize('NFKC').replace(/[\s​-‍﻿]+/g, '').toLowerCase();
}

/** 테이블 번호 1~TABLE_COUNT — 숫자 또는 숫자 글자('3')만. 아니면 null */
export function parseTableNo(v: unknown): number | null {
  const n = typeof v === 'string' && /^\s*\d{1,3}\s*$/.test(v) ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= TABLE_COUNT ? n : null;
}

export const TICKETS_MODES = ['auto', 'open', 'closed'] as const;
export type TicketsMode = (typeof TICKETS_MODES)[number];
export const isTicketsMode = (v: unknown): v is TicketsMode =>
  typeof v === 'string' && (TICKETS_MODES as readonly string[]).includes(v);

/** 'auto' 일 때 응모권이 나오는 때 — 행사 당일 15:00 ~ 다음 날 03:00(KST). 전날 미리 이름 넣은 사람이 번호를 먼저 받지 않게 */
export const TICKETS_AUTO_FROM = Date.parse('2026-11-23T15:00:00+09:00');
export const TICKETS_AUTO_UNTIL = Date.parse('2026-11-24T03:00:00+09:00');

/** 응모권 발급 열림 — open=열림, closed=닫힘, auto=행사 시간대만 */
export function ticketsOpen(mode: TicketsMode, now: Date | number): boolean {
  if (mode === 'open') return true;
  if (mode === 'closed') return false;
  const t = typeof now === 'number' ? now : now.getTime();
  return t >= TICKETS_AUTO_FROM && t < TICKETS_AUTO_UNTIL;
}

/** 어드민이 응모권을 지운 이름 — 발급이 열려 있어도 이 이름(nameKey)으로는 새 응모권을 다시 주지 않는다(지운 게 15초 폴링에 되살아나지 않게) */
export interface TicketBlock {
  nameKey: string;
  name: string;
  at: string;
}

/** 지운 이름 목록 읽기(reception_state 'ticket-blocks' = { list }) — 모양이 틀린 줄은 버린다 */
export function parseTicketBlocks(v: unknown): TicketBlock[] {
  const list = (v && typeof v === 'object' ? (v as { list?: unknown }).list : null) as unknown;
  if (!Array.isArray(list)) return [];
  const out: TicketBlock[] = [];
  for (const o of list) {
    const b = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
    if (typeof b.nameKey !== 'string' || !b.nameKey || typeof b.name !== 'string' || typeof b.at !== 'string') continue;
    if (!out.some((x) => x.nameKey === b.nameKey)) out.push({ nameKey: b.nameKey, name: b.name, at: b.at });
  }
  return out;
}

/**
 * 동명이인(261122 배정표에 김현우 님이 2번·12번 두 곳) — 명단에 같은 이름이 다른 테이블에 또 있으면 그 줄들의 열쇠 = '이름열쇠 @테이블'.
 * nameKey 는 띄어쓰기를 다 빼므로 ' @' 가 든 열쇠는 어떤 이름에서도 나오지 않는다(다른 사람 열쇠와 겹칠 일 없음).
 * 손님은 함께 앉는 사람을 보고 테이블을 고르고(PUT guest pick), 응모권도 그 줄 열쇠로 따로 받는다.
 */
export const sameNameKey = (key: string, table: number) => `${key} @${table}`;
/** 명단 줄 · 응모권 열쇠 → 이름 열쇠(동명이인 꼬리 떼기) */
export const baseNameKey = (key: string) => key.split(' @')[0];

export interface SeatRowInput {
  name: string;
  /** 명단 줄 열쇠 — 보통 nameKey(name), 동명이인이면 sameNameKey */
  nameKey: string;
  table: number;
  seat: number | null;
}

/** 자리 명단 검사 — 틀리면 이유(몇 번째 줄인지 같이). 같은 이름이 같은 테이블에 두 번이면 그 이름들을 알려 주고, 다른 테이블이면 동명이인 열쇠로 */
export function parseSeatRows(v: unknown): SeatRowInput[] | string {
  if (!Array.isArray(v)) return '명단 형식이 맞지 않아요.';
  if (v.length > SEAT_ROWS_MAX) return `명단은 ${SEAT_ROWS_MAX}줄까지 넣을 수 있어요.`;
  const out: SeatRowInput[] = [];
  for (let i = 0; i < v.length; i++) {
    const o = (v[i] && typeof v[i] === 'object' ? v[i] : {}) as Record<string, unknown>;
    const name = cleanName(o.name);
    if (!name) return `${i + 1}번째 줄 이름을 확인해 주세요(1~${NAME_MAX}자).`;
    const table = parseTableNo(o.table);
    if (table == null) return `${i + 1}번째 줄(${name}) 테이블은 1~${TABLE_COUNT} 사이 숫자예요.`;
    let seat: number | null = null;
    if (o.seat != null && o.seat !== '') {
      const s = typeof o.seat === 'string' && /^\s*\d{1,2}\s*$/.test(o.seat) ? Number(o.seat) : o.seat;
      if (typeof s !== 'number' || !Number.isInteger(s) || s < 1 || s > SEATS_PER_TABLE) {
        return `${i + 1}번째 줄(${name}) 좌석은 1~${SEATS_PER_TABLE} 사이 숫자예요.`;
      }
      seat = s;
    }
    out.push({ name, nameKey: nameKey(name), table, seat });
  }
  // 같은 이름 — 다른 테이블이면 동명이인(손님이 고름), 같은 테이블이면 잘못 넣은 줄
  const groups = new Map<string, SeatRowInput[]>();
  for (const r of out) groups.set(r.nameKey, [...(groups.get(r.nameKey) || []), r]);
  const sameTable: string[] = [];
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;
    const tables = rows.map((r) => r.table);
    if (new Set(tables).size < tables.length) {
      sameTable.push(rows[0].name);
      continue;
    }
    for (const r of rows) r.nameKey = sameNameKey(r.nameKey, r.table);
  }
  if (sameTable.length) return `같은 테이블에 같은 이름이 두 번 있어요: ${sameTable.join(', ')}`;
  return out;
}

/** 럭키드로우 경품(261122 사장 경품표 그대로 · 순서 = 사장 번호 1~7) — total = 뽑을 개수, worth = 화면에 같이 보여 줄 값어치 */
export const DRAW_PRIZES: ReadonlyArray<{ name: string; total: number; worth: string }> = [
  { name: '슬릭스틸 아이웨어 선글라스+안경테 세트', total: 2, worth: '각 27만원 상당' },
  { name: '1++ 한우선물세트', total: 4, worth: '각 20만원 상당' },
  { name: '스튜디오패스 촬영+의상', total: 3, worth: '각 15만원 상당' },
  { name: '로이어 블루 펩타이드 화장품 3종 세트', total: 4, worth: '각 6만원 상당' },
  { name: '아르비에 스킨케어 세럼 세트', total: 3, worth: '각 10만원 상당' },
  { name: '슈트패브릭 영국 허더스필드 맞춤 정장', total: 1, worth: '200만원 상당' },
  { name: '체스타필드 요크셔 맞춤정장 세트', total: 1, worth: '270만원 상당' },
];

/** 경품 이름 — 앞뒤·겹친 띄어쓰기 정리, 1~40자. 안 맞으면 null */
export function cleanPrize(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (!s || [...s].length > PRIZE_MAX) return null;
  return s;
}
