/* ─── 송년회 홀 평면도 ─────────────────────────────────────────
 * 261116 사장 '이거 송년회 좌석배치도인데 이거 완벽하게 구현해' — 받은 도면 그림(960×720 px)에서
 * 벽선·무대·기둥·원탁 중심을 픽셀로 따서 그 좌표를 그대로 쓴다(좌표계 = 도면 그림 픽셀, 위 = 무대 쪽).
 * 곡선 벽은 딴 점들을 Catmull-Rom 으로 잇는다. 원탁 반지름 16.5 · 의자 8개(중심에서 23.5, 위부터 시계 방향).
 * 도면이 바뀌면 이 파일 점만 고치면 된다(화면 = components/reception/HallMap.tsx). */

export type Pt = readonly [number, number];

/** 도면에서 홀만 잘라 보이는 영역(viewBox) */
export const HALL_VIEW = { x: 22, y: 106, w: 916, h: 520 } as const;

export const TABLE_R = 16.5;
export const CHAIR_DIST = 23.5;
export const CHAIR_SIZE = 11;

/** 원탁 19개 — 도면 번호 그대로(맨 윗줄 1~4, 둘째 줄 5~12, 아랫줄 13~19) */
export const HALL_TABLES: ReadonlyArray<{ n: number; x: number; y: number }> = [
  { n: 1, x: 328, y: 291 }, { n: 2, x: 404, y: 306 }, { n: 3, x: 563, y: 306 }, { n: 4, x: 638, y: 301 },
  { n: 5, x: 222, y: 344 }, { n: 6, x: 291, y: 361 }, { n: 7, x: 359, y: 376 }, { n: 8, x: 434, y: 381 },
  { n: 9, x: 532, y: 381 }, { n: 10, x: 600, y: 374 }, { n: 11, x: 676, y: 361 }, { n: 12, x: 750, y: 344 },
  { n: 13, x: 230, y: 424 }, { n: 14, x: 306, y: 444 }, { n: 15, x: 381, y: 458 }, { n: 16, x: 457, y: 465 },
  { n: 17, x: 556, y: 459 }, { n: 18, x: 634, y: 445 }, { n: 19, x: 714, y: 426 },
];

/** 좌석 s(1부터)의 각도(도) — 1번 = 무대 쪽(위), 시계 방향으로 45°씩 */
export const seatAngle = (s: number) => -90 + (s - 1) * 45;

/** 기둥(네모 + H) — rot = 벽 방향 */
export const HALL_COLUMNS: ReadonlyArray<{ x: number; y: number; rot: number }> = [
  { x: 210, y: 240, rot: -44 }, { x: 746, y: 238, rot: 40 },
  { x: 80, y: 420, rot: 30 }, { x: 203, y: 491, rot: 24 }, { x: 337, y: 535, rot: 11 },
  { x: 480, y: 549, rot: 0 }, { x: 620, y: 535, rot: -11 }, { x: 755, y: 490, rot: -24 }, { x: 880, y: 420, rot: -30 },
];
/** 무대 양옆 둥근 기둥 */
export const STAGE_PILLARS: readonly Pt[] = [[418, 158], [542, 158]];

/** 글자 자리 */
export const HALL_LABELS = {
  stage: [480, 186] as Pt,
  entrance: [533, 611] as Pt,
};

/* ── 선 ── */
const OUTER: Pt[] = [
  [31, 440], [65, 397], [95, 358.5], [125, 320], [155, 281.5], [185, 247], [215, 219], [245, 196], [275, 177], [305, 161.5],
  [335, 148.5], [365, 138.5], [395, 131], [425, 126], [455, 123], [485, 123], [515, 124], [545, 128], [575, 134], [605, 142.5],
  [635, 153.5], [665, 167], [695, 184], [725, 204.5], [755, 229], [785, 259.5], [815, 297], [845, 335], [875, 373], [905, 413], [917, 429],
];
const INNER: Pt[] = [
  [80, 416], [95, 372.5], [125, 334], [155, 296], [185, 259.5], [215, 229], [245, 206.5], [275, 186.5], [305, 170.5], [335, 155],
  [365, 143], [395, 135.5], [425, 131.5], [455, 128.5], [485, 128], [515, 129.5], [545, 133], [575, 138.5], [605, 147.5], [635, 159],
  [665, 176.5], [695, 194], [725, 215.5], [755, 240], [785, 273], [815, 311], [845, 349], [875, 383], [880, 416],
];
/** 홀 아래 경계 = 기둥 줄(겹선) */
const COL_LINE: Pt[] = [[80, 420], [203, 491], [337, 535], [480, 549], [620, 535], [755, 490], [880, 420]];
/** 로비 바깥벽 — 왼쪽 문·가운데 정문 자리에서 끊긴다 */
const FOYER_L: Pt[] = [[31, 440], [62, 444], [130, 485], [200, 516], [254, 540]];
const FOYER_M: Pt[] = [[298, 552], [370, 566], [450, 575], [513, 577]];
const FOYER_R: Pt[] = [[553, 573], [600, 566], [650, 552], [700, 536], [760, 517], [800, 500], [840, 479], [871, 459]];
const FOYER_R_END: Pt[] = [[871, 459], [861, 449], [867, 442], [905, 413]];

const mirror = ([x, y]: Pt): Pt => [960 - x, y];
const f = (n: number) => Math.round(n * 10) / 10;

/** 점들을 부드러운 곡선 path 로(Catmull-Rom → 3차 베지어). cont = 앞 path 에 이어 붙일 때(M 대신 L) */
export function smooth(p: readonly Pt[], cont = false): string {
  let d = `${cont ? 'L' : 'M'}${f(p[0][0])} ${f(p[0][1])}`;
  for (let k = 0; k < p.length - 1; k++) {
    const p0 = p[k - 1] ?? p[k];
    const p1 = p[k];
    const p2 = p[k + 1];
    const p3 = p[k + 2] ?? p[k + 1];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}
const poly = (p: readonly Pt[], close = false) => `M${p.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}${close ? 'Z' : ''}`;

/** 선을 법선 방향으로 d 만큼 민 점들(겹선용) */
function offset(p: readonly Pt[], d: number): Pt[] {
  return p.map((pt, i) => {
    const a = p[i - 1] ?? pt;
    const b = p[i + 1] ?? pt;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    return [pt[0] - (dy / len) * d, pt[1] + (dx / len) * d] as Pt;
  });
}

/** 계단 — 네모 하나 + 디딤판 선 3개 */
function stairs(q: readonly [Pt, Pt, Pt, Pt]): string {
  const [a, b, c, e] = q;
  let d = poly(q, true);
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    d += `M${f(a[0] + (b[0] - a[0]) * t)} ${f(a[1] + (b[1] - a[1]) * t)}L${f(e[0] + (c[0] - e[0]) * t)} ${f(e[1] + (c[1] - e[1]) * t)}`;
  }
  return d;
}

/* 무대 — 왼쪽 반을 따서 오른쪽은 좌우 대칭 */
const STAGE_SIDE: Pt[] = [[322, 163], [332, 175], [352, 190], [362, 213]];
const CRESCENT = 'C398 187 428 173 429 150C429 146 427 144 424 142';
const STAIRS_UP: [Pt, Pt, Pt, Pt] = [[386, 138], [407, 132], [411, 155], [391, 160]];
const STAIRS_DOWN: [Pt, Pt, Pt, Pt] = [[360, 187], [381, 181], [389, 204], [368, 209]];
const mq = (q: [Pt, Pt, Pt, Pt]) => q.map(mirror) as unknown as [Pt, Pt, Pt, Pt];
const STAGE_BACK = INNER.filter(([x]) => x > 322 && x < 638).reverse();

export const HALL_PATHS = {
  outerWall: smooth(OUTER),
  innerWall: smooth(INNER),
  colLineA: smooth(offset(COL_LINE, -2.3)),
  colLineB: smooth(offset(COL_LINE, 2.3)),
  /** 홀 바닥(안쪽 벽 ~ 기둥 줄) */
  floor: `${smooth(INNER)}${smooth([...COL_LINE].reverse(), true)}Z`,
  /** 건물 전체(바깥벽 ~ 로비 벽) */
  building: `${smooth(OUTER)}${[...FOYER_R_END].reverse().map(([x, y]) => `L${x} ${y}`).join('')}${smooth([...FOYER_L, ...FOYER_M, ...FOYER_R].reverse(), true)}Z`,
  foyer: [smooth(FOYER_L), smooth(FOYER_M), smooth(FOYER_R), poly(FOYER_R_END)].join(''),
  /** 정문(양여닫이)·왼쪽 문 — 문짝 + 열리는 호 */
  doors:
    'M514 577L514 596A19 19 0 0 0 533 577M553 573L553 592A19 19 0 0 1 534 575' +
    'M254 540L251 562A22 22 0 0 0 275 547M298 552L294 573A21 21 0 0 1 277 548',
  /** 정문 앞 반달 차양 */
  canopy: 'M353 589Q405 634 450 600Q404 614 353 589Z',
  /** 홀 안쪽에서 로비로 나가는 문 표시(도면의 ∧) */
  exits: poly([[100, 433], [121, 430], [127, 443]]) + poly([[155, 461], [170, 456], [177, 475]]) + poly([[838, 443], [839, 425], [850, 432]]) + poly([[781, 474], [782, 456], [796, 465]]),
  /** 기둥 줄 아래 긴 카운터 */
  counter: poly([[366, 528], [452, 538], [451, 546], [365, 536]], true),
  stage: `${poly(STAGE_SIDE)}C400 217 440 221 480 222C520 221 560 217 598 213${STAGE_SIDE.map(mirror).reverse().slice(1).map(([x, y]) => `L${x} ${y}`).join('')}${smooth(STAGE_BACK, true)}Z`,
  stageLip: 'M464 222.6L496 222.6',
  stageOval: { cx: 480, cy: 162, rx: 137, ry: 52 },
  crescents: `M368 182${CRESCENT}M${960 - 368} 182C${960 - 398} 187 ${960 - 428} 173 ${960 - 429} 150C${960 - 429} 146 ${960 - 427} 144 ${960 - 424} 142`,
  stairs: stairs(STAIRS_UP) + stairs(STAIRS_DOWN) + stairs(mq(STAIRS_UP)) + stairs(mq(STAIRS_DOWN)),
  screen: { x: 438, y: 140, w: 83, h: 6 },
  /** 무대 앞 이동식 단·계단(점선) */
  stageDashed: 'M430 185H528V210H430ZM455 203H503V217H455ZM415 221H455V238H415ZM505 221H545V238H505Z',
};
