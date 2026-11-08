// 송년회(261108 사장 'Freetiful & WMAK 2026 Year-End RECEPTION') 행사 정보 · 식순 · 자리 배치 — 화면에 쓰는 값 한 곳.
// 행사 정보는 홈 진입 팝업 그림(public/images/popups/reception-2026.webp)과 같다. 서버 규칙은 apps/api/src/reception/reception.rules.ts.

export const RECEPTION_EVENT_KEY = 'wmak-2026';

export const RECEPTION_INFO = {
  date: '2026년 11월 23일 (월)',
  time: '17:30 – 21:00',
  place: '청담 리베라호텔 3F 베르사이유 홀',
} as const;

/** 식순 — 사장 제공 식순 그림 순서 그대로(1부 · 2부) */
export const RECEPTION_PROGRAM: ReadonlyArray<{ part: 1 | 2; title: string }> = [
  { part: 1, title: '등록 및 입장' },
  { part: 1, title: '오프닝 축하공연' },
  { part: 1, title: '공식 행사 및 시상식' },
  { part: 1, title: '네트워킹 만찬' },
  { part: 2, title: '2부 오프닝 축하공연' },
  { part: 2, title: '베스트드레서 어워즈' },
  { part: 2, title: '레크리에이션 및 경품 추첨' },
];

/* ─── 자리 ─────────────────────────────────────────────
 * 홀 = 무대 아래 원탁 15개(한 줄 3개 × 5줄) · 테이블당 10석.
 * 지금은 사장 '일단 자리는 임의로' — 이름으로 정한 임시 자리. 실제 배정표가 오면 SEAT_ASSIGNMENTS 에
 * '이름(띄어쓰기 없이)': [테이블, 좌석] 으로 채우면 그 사람은 그 자리로 나온다. */
export const TABLE_COUNT = 15;
export const TABLES_PER_ROW = 3;
export const SEATS_PER_TABLE = 10;

export const SEAT_ASSIGNMENTS: Record<string, readonly [table: number, seat: number]> = {};

export interface ReceptionSeat {
  table: number;
  seat: number;
  /** 배정표에 있는 자리인가(아니면 임시 자리) */
  assigned: boolean;
}

const seatKey = (name: string) => name.replace(/\s+/g, '').toLowerCase();

/** FNV-1a — 같은 이름은 어느 기기에서든 같은 임시 자리 */
function hash(s: string) {
  let h = 0x811c9dc5;
  for (const ch of s) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function seatFor(name: string): ReceptionSeat {
  const key = seatKey(name);
  const fixed = SEAT_ASSIGNMENTS[key];
  if (fixed) return { table: fixed[0], seat: fixed[1], assigned: true };
  const i = hash(key) % (TABLE_COUNT * SEATS_PER_TABLE);
  return { table: Math.floor(i / SEATS_PER_TABLE) + 1, seat: (i % SEATS_PER_TABLE) + 1, assigned: false };
}
