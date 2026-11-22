/* ─── 송년회 좌석 배정표(어드민 테이블 배치) ─────────────────────────────
 * 261123 사장 '좌석배치 그 도면있잖아 그거처럼 100%완전히 구현해줘' + 새 배정표 그림 — 사장이 만든 배정표 그림
 * (프리티풀 × 한국여성사회자협회 Year-End Reception · 무대 · 원탁 18개 · 원탁마다 이름 칸 8개)을 픽셀로 따서 그 좌표를 그대로 쓴다.
 * 좌표계 = 배정표 원본 그림 픽셀(폭 2802). 원탁 중심은 그림의 원 채움(#F2F3F7)에서 잰 값, 이름 칸은 테두리 선에서 잰 값.
 * 손님 앱 자리 탭의 홀 평면도(hall.ts · HallMap)와는 다른 그림이다 — 번호 · 줄 배치(윗줄 3·1|2·4 / 5~12 / 18~13)는 같다.
 * 좌석 번호 = 1 무대 쪽(위)부터 시계 방향(2 오른쪽 위 · 3 오른쪽 · 4 오른쪽 아래 · 5 아래 · 6 왼쪽 아래 · 7 왼쪽 · 8 왼쪽 위) — 명단 · 손님 앱과 같다.
 * 그림이 바뀌면 이 파일 숫자만 고치면 된다(화면 = app/(admin)/admin/reception/_parts/SeatBoard.tsx). */

/** 그림 전체(원본 픽셀) */
export const CHART_W = 2802;
export const CHART_H = 1420;

/** 맨 위 제목 칸 */
export const CHART_TITLE = { x: 50, y: 28, w: 2704, h: 109, text: '프리티풀 × 한국여성사회자협회', en: 'Year-End Reception' } as const;
/** 무대 칸 */
export const CHART_STAGE = { x: 1076, y: 176, w: 652, h: 78 } as const;

/** 원탁(회색 원) 반지름 — 테두리 바깥까지 */
export const CHART_TABLE_R = 93;
/** 이름 칸 크기 */
export const CHART_BOX = { w: 120, h: 48 } as const;

/** 원탁 18개 중심 */
export const CHART_TABLES: ReadonlyArray<{ n: number; x: number; y: number }> = [
  { n: 3, x: 705, y: 452 }, { n: 1, x: 1060, y: 495 }, { n: 2, x: 1741, y: 495 }, { n: 4, x: 2096, y: 452 },
  { n: 5, x: 194, y: 790 }, { n: 6, x: 537, y: 825 }, { n: 7, x: 884, y: 850 }, { n: 8, x: 1227, y: 870 },
  { n: 9, x: 1574, y: 870 }, { n: 10, x: 1918, y: 850 }, { n: 11, x: 2262, y: 825 }, { n: 12, x: 2608, y: 790 },
  { n: 18, x: 532, y: 1184 }, { n: 17, x: 878, y: 1221 }, { n: 16, x: 1222, y: 1240 },
  { n: 15, x: 1568, y: 1240 }, { n: 14, x: 1912, y: 1221 }, { n: 13, x: 2258, y: 1184 },
];

/**
 * 좌석 s 이름 칸 중심(원탁 중심에서) + 칸이 넓어질 때 붙는 쪽 + 한 칸 둘일 때 늘어나는 쪽 + 최대 폭.
 * side 'c' = 가운데 기준(위 · 아래) · 'l' = 왼쪽 끝 고정(오른쪽 칸들, 오른쪽으로 늘어남) · 'r' = 오른쪽 끝 고정(왼쪽 칸들)
 * grow = 두 줄이 되면 늘어나는 쪽(옆 칸에 안 닿게 — 위 칸 1 은 위로, 아래 칸 5 는 아래로, 2·8 은 아래로, 4·6 은 위로, 3·7 은 가운데)
 * maxW = 옆 원탁 칸에 안 닿는 최대 폭(줄 간격 347 기준: 3·7 끼리 남는 폭 253 → 124, 2·8 / 4·6 끼리 277 → 136, 1·5 는 위아래가 비어 160)
 */
export const CHART_SEATS: Readonly<Record<number, { dx: number; dy: number; side: 'c' | 'l' | 'r'; grow: 'up' | 'down' | null; maxW: number }>> = {
  1: { dx: 0, dy: -122, side: 'c', grow: 'up', maxW: 160 },
  2: { dx: 95, dy: -72, side: 'l', grow: 'down', maxW: 136 },
  3: { dx: 107, dy: 0, side: 'l', grow: null, maxW: 124 },
  4: { dx: 95, dy: 72, side: 'l', grow: 'up', maxW: 136 },
  5: { dx: 0, dy: 122, side: 'c', grow: 'down', maxW: 160 },
  6: { dx: -95, dy: 72, side: 'r', grow: 'up', maxW: 136 },
  7: { dx: -107, dy: 0, side: 'r', grow: null, maxW: 124 },
  8: { dx: -95, dy: -72, side: 'r', grow: 'down', maxW: 136 },
};

/**
 * 좌석 없는 사람(명단에 테이블만) 자리. 그림의 '김정덕'(5번 원탁 왼쪽 아래 바깥, 칸 없이 글자만)처럼 —
 * 바깥에 빈 곳이 있는 양 끝 원탁(5 · 12)은 바깥 아래, 나머지는 원탁 안 번호 밑.
 */
export const CHART_LOOSE_OUT: Readonly<Record<number, { dx: number; dy: number; align: 'left' | 'right' }>> = {
  5: { dx: -144, dy: 216, align: 'left' },
  12: { dx: 144, dy: 216, align: 'right' },
};

/**
 * 이름 글자 크기(원본 픽셀) — 그림 = 29, 한 칸 둘이면 24. 칸 최대 폭(maxW, 좌우 여백 · 테두리 18 빼고)에 들어가게 줄이되 16 아래로는 안 줄인다
 * (그보다 길면 말줄임). prefix = 앞에 붙는 '1.' 같은 번호(한 글자로 셈).
 */
export function chartNameSize(name: string, lines = 1, maxW = 136, prefix = false): number {
  const n = Math.max([...name].length + (prefix ? 1 : 0), 1);
  const base = lines > 1 ? 24 : 29;
  return Math.max(16, Math.min(base, (maxW - 18) / n));
}

/** 원탁 안 좌석 없는 이름 — 번호 밑 두 줄까지(그 아래는 아래 칸 · 옆 칸 자리), 폭 ±34 안(대각선 칸 안쪽 끝 ±35) */
export const CHART_LOOSE_IN_MAX = 2;
export function chartLooseSize(name: string): number {
  return Math.max(14, Math.min(22, 60 / Math.max([...name].length, 1)));
}
