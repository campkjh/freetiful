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
 * 좌석 s 이름 칸 중심(원탁 중심에서) + 칸이 넓어질 때 붙는 쪽.
 * side 'c' = 가운데 기준(위 · 아래) · 'l' = 왼쪽 끝 고정(오른쪽 칸들, 오른쪽으로 늘어남) · 'r' = 오른쪽 끝 고정(왼쪽 칸들)
 */
export const CHART_SEATS: Readonly<Record<number, { dx: number; dy: number; side: 'c' | 'l' | 'r' }>> = {
  1: { dx: 0, dy: -122, side: 'c' },
  2: { dx: 95, dy: -72, side: 'l' },
  3: { dx: 107, dy: 0, side: 'l' },
  4: { dx: 95, dy: 72, side: 'l' },
  5: { dx: 0, dy: 122, side: 'c' },
  6: { dx: -95, dy: 72, side: 'r' },
  7: { dx: -107, dy: 0, side: 'r' },
  8: { dx: -95, dy: -72, side: 'r' },
};

/**
 * 좌석 없는 사람(명단에 테이블만) 자리. 그림의 '김정덕'(5번 원탁 왼쪽 아래 바깥, 칸 없이 글자만)처럼 —
 * 바깥에 빈 곳이 있는 양 끝 원탁(5 · 12)은 바깥 아래, 나머지는 원탁 안 번호 밑.
 */
export const CHART_LOOSE_OUT: Readonly<Record<number, { dx: number; dy: number; align: 'left' | 'right' }>> = {
  5: { dx: -144, dy: 216, align: 'left' },
  12: { dx: 144, dy: 216, align: 'right' },
};

/** 이름 글자 크기(원본 픽셀) — 그림 = 29, 한 칸 둘이면 24. 긴 이름은 줄이되 22 아래로는 안 줄이고 칸을 바깥쪽으로 늘린다
 *  (6자 '김현우사회자'도 옆 원탁 칸에 안 닿음 — 12번 왼쪽 아래 칸 왼쪽 끝 2425 > 11번 오른쪽 아래 칸 오른쪽 끝 2417) */
export function chartNameSize(name: string, lines = 1): number {
  const n = Math.max([...name].length, 1);
  const base = lines > 1 ? 24 : 29;
  return Math.max(22, Math.min(base, 104 / n));
}
