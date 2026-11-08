// 송년회(261108 사장 'Freetiful & WMAK 2026 Year-End RECEPTION') 행사 정보 · 식순 · 자리 배치 — 화면에 쓰는 값 한 곳.
// 행사 정보는 홈 진입 팝업 그림(public/images/popups/reception-2026.webp)과 같다. 서버 규칙은 apps/api/src/reception/reception.rules.ts.

export const RECEPTION_EVENT_KEY = 'wmak-2026';

export const RECEPTION_INFO = {
  date: '2026년 11월 23일 (월)',
  time: '17:30 – 21:00',
  place: '청담 리베라호텔 3F 베르사이유 홀',
} as const;

export interface ReceptionProgramItem {
  part: 1 | 2;
  /** 표에 시각이 적힌 순서만 — 나머지는 앞 순서에 이어서 진행 */
  time?: string;
  title: string;
  /** 제목 옆 작은 꼬리표('2곡') */
  tag?: string;
  /** 제목 아래 한 줄 설명 */
  note?: string;
  /** 딸린 순서 */
  sub?: readonly string[];
}

/** 식순 — 사장 식순표(261108) 그대로: 1부 · 2부, 표의 빈 줄만 뺐다 */
export const RECEPTION_PROGRAM: ReadonlyArray<ReceptionProgramItem> = [
  { part: 1, time: '18:20', title: '축하공연', tag: '2곡' },
  { part: 1, time: '18:30', title: '개식사' },
  { part: 1, title: '내빈소개' },
  { part: 1, title: '축사', tag: '2명' },
  { part: 1, title: '프리티풀 대표 인사' },
  { part: 1, title: '협회 대표 인사' },
  { part: 1, title: '협회 성과보고 및 운영진 인사' },
  { part: 1, title: '프리티풀 성과보고 및 운영진 인사' },
  { part: 1, time: '19:00', title: '시상식' },
  { part: 1, time: '19:10', title: '단체 촬영' },
  { part: 1, time: '19:15~', title: '자유 네트워킹 겸 식사' },
  { part: 2, time: '19:40', title: '축하공연', tag: '3곡' },
  { part: 2, time: '19:50', title: '레크리에이션', sub: ['네트워킹 가능한 게임', '외빈 대상으로 한 레크리에이션'] },
  { part: 2, time: '20:05', title: '베스트드레서 어워즈' },
  { part: 2, time: '20:20', title: '경품추첨', note: '큰손 대표님들이 간단히 회사 소개 후 직접 추첨' },
  { part: 2, time: '20:30', title: '종료' },
];

/** 설문 '가장 좋았던 순서' — 식순 중 손님이 고를 만한 것만(인사·종료 등은 뺌) */
export const RECEPTION_SURVEY_PICKS = ['1부 축하공연', '시상식', '자유 네트워킹 겸 식사', '2부 축하공연', '레크리에이션', '베스트드레서 어워즈', '경품추첨'] as const;

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
