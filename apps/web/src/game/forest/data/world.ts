// 마을 배치(미터). 화면 위쪽 = 북쪽(-z). 중앙 광장에서 돌아올 수 있는 순환 동선(제작 프롬프트 8쪽).
// 대표 장면: 광장 북쪽 끝(1,3.4,-2)에서 꽃길을 보면 꽃길 위 아바타·소담, 왼쪽 집·우편함, 오른쪽 호수, 뒤에 서약의 정원 아치.
export type V2 = [number, number];

export interface ZoneDef {
  id: string;
  name: string;
  center: V2;
  radius: number;
  desc: string;
}

export const ZONES: ZoneDef[] = [
  { id: 'plaza', name: '약속의 광장', center: [0, 0], radius: 8, desc: '큰 나무 · 게시판 · 벤치' },
  { id: 'greenhouse', name: '꽃잎 온실', center: [13, 10], radius: 7, desc: '꽃집 · 화단 · 부케 테이블' },
  { id: 'workshop', name: '나뭇결 공방', center: [-13, 10], radius: 7, desc: '목재 더미 · 작업대' },
  { id: 'boutique', name: '햇살 의상실', center: [-23, -1], radius: 6, desc: '쇼윈도 · 전신 거울' },
  { id: 'lake', name: '달빛 호수', center: [12, -16.8], radius: 8.5, desc: '나무 데크 · 갈대' },
  { id: 'garden', name: '서약의 정원', center: [0, -28], radius: 9, desc: '꽃 아치 · 통로 · 하객 자리' },
  { id: 'home', name: '우리의 집', center: [-9.6, -13.6], radius: 6.5, desc: '작은 집 · 우편함 · 앞마당' },
  { id: 'whisper', name: '속삭임 숲', center: [29, -9], radius: 7, desc: '굽은 산책길 · 희귀 꽃 · 반딧불이' },
  { id: 'gate', name: '숲 입구', center: [0, 18.5], radius: 5, desc: '이사 온 첫걸음' },
];

/** 이동 가능한 바깥 경계(둥근 사각형) */
export const BOUNDS = { minX: -31, maxX: 35, minZ: -38.5, maxZ: 25.5, corner: 7 };

export const SPAWN: { pos: V2; dir: number } = { pos: [0, 16.8], dir: Math.PI }; // dir: 0 = +z(남), PI = -z(북)
export const HOME_SPAWN: { pos: V2; dir: number } = { pos: [-9.6, -12.4], dir: 0 };

// ── 주요 지점 ──
export const PLAZA = { center: [0, 0] as V2, radius: 7, bigTree: [0, -0.8] as V2, board: [4.7, 3.7] as V2, bench: [-4.6, 3.9] as V2, lamps: [[-5.9, -4.3], [5.9, -4.3], [-5.9, 4.7], [5.9, 4.7]] as V2[] };

export const GARDEN = {
  minX: -7.6,
  maxX: 7.6,
  minZ: -35.2,
  maxZ: -21,
  /** 꾸미기 가능한 칸 */
  edit: { minX: -6.9, maxX: 6.9, minZ: -34.4, maxZ: -21.9 },
  aisle: { minX: -0.95, maxX: 0.95, minZ: -31.4, maxZ: -21.6 },
  archSpot: [0, -32.3] as V2,
  entrance: [0, -21] as V2,
  sign: [2.7, -20.2] as V2,
  officiant: [0, -33.4] as V2,
};

export const HOME = {
  house: [-9.6, -16.2] as V2,
  houseSize: [4.4, 3.8] as V2,
  door: [-9.6, -14.22] as V2,
  mailbox: [-6.3, -12.8] as V2,
  storage: [-7.45, -13.85] as V2,
  promiseTree: [-5.5, -17.3] as V2,
  yard: { minX: -14.0, maxX: -5.4, minZ: -13.5, maxZ: -9.0 },
  plots: [[-13.1, -12.7], [-11.9, -12.7], [-13.1, -11.5], [-11.9, -11.5]] as V2[],
};

export const LAKE = { center: [12, -16.8] as V2, rx: 7.2, rz: 5.0, deck: { minX: 3.6, maxX: 8.4, minZ: -17.7, maxZ: -15.9 } };

export const GREENHOUSE = {
  center: [13.4, 8.6] as V2,
  size: [5.2, 4.2] as V2,
  counter: [9.9, 11.0] as V2,
  bouquetTable: [11.7, 12.1] as V2,
  plots: [[16.6, 12.6], [17.8, 12.6], [16.6, 13.8], [17.8, 13.8]] as V2[],
};

export const WORKSHOP = {
  center: [-13.4, 8.4] as V2,
  size: [4.8, 4.0] as V2,
  workbench: [-10.1, 11.6] as V2,
  logs: [-16.9, 12.0] as V2,
};

export const BOUTIQUE = { center: [-24.2, -1.6] as V2, size: [4.6, 4.2] as V2, mirror: [-20.9, 1.0] as V2, door: [-21.85, -1.6] as V2 };

export const WHISPER = { rare: [[29.6, -7.4], [32.2, -11.8], [27.6, -15.4]] as V2[] };

export const GATE_SIGN: V2 = [2.3, 17.6];

/** 길(폭 m) — 가운데 선 */
export const PATHS: Array<{ pts: V2[]; w: number; flowers?: boolean }> = [
  { pts: [[0, 25.4], [0, 13], [0, 6.6]], w: 2.4 },
  { pts: [[0, -6.6], [0, -13], [0, -21.2]], w: 2.6, flowers: true }, // 꽃길 — 광장에서 서약의 정원
  { pts: [[4.6, 4.6], [7.5, 7.6], [9.6, 10.4]], w: 2.0 },
  { pts: [[-4.6, 4.6], [-7.5, 7.6], [-9.8, 10.6]], w: 2.0 },
  { pts: [[-6.6, 0], [-13, -0.4], [-20.6, -1.4]], w: 2.0 },
  { pts: [[-4.4, -5.2], [-6.4, -8.2], [-8.4, -11.4]], w: 2.0 },
  { pts: [[4.4, -5.2], [4.8, -10.2], [4.2, -15.4]], w: 2.0 },
  { pts: [[6.6, -0.6], [14, -1.6], [21, -2.4], [26.5, -5.4], [30, -9.6], [29.8, -13.6], [27.2, -16.6]], w: 1.6 },
  { pts: [[0, -13.4], [-2.8, -14.0], [-5.2, -13.3]], w: 1.4 },
  { pts: [[0, -13.4], [2.8, -14.3], [4.2, -15.4]], w: 1.4 },
];

/** 주민 이동 그래프 */
export const NAV_NODES: Record<string, V2> = {
  plaza_s: [0, 4.6],
  plaza_e: [4.6, -2.6],
  plaza_w: [-4.6, -2.6],
  plaza_bench: [-4.6, 5.0],
  plaza_board: [4.7, 5.0],
  j_n: [0, -8.4],
  j_garden: [0, -19.8],
  garden_in: [0, -23.4],
  garden_arch: [1.9, -31.2],
  j_lake: [4.8, -9.6],
  lake_deck: [5.6, -16.8],
  j_home: [-6.4, -8.2],
  home_front: [-8.4, -11.6],
  j_gh: [7.4, 7.4],
  gh_counter: [9.4, 11.8],
  gh_farm: [15.6, 13.2],
  j_ws: [-7.4, 7.4],
  ws_bench: [-10.0, 12.9],
  ws_logs: [-15.6, 12.8],
  j_bt: [-12.0, -0.4],
  bt_front: [-20.2, -0.6],
  j_s: [0, 10],
};

export const NAV_EDGES: Array<[string, string]> = [
  ['plaza_s', 'plaza_e'],
  ['plaza_s', 'plaza_w'],
  ['plaza_e', 'plaza_w'],
  ['plaza_s', 'plaza_bench'],
  ['plaza_s', 'plaza_board'],
  ['plaza_w', 'plaza_bench'],
  ['plaza_e', 'plaza_board'],
  ['plaza_e', 'j_n'],
  ['plaza_w', 'j_n'],
  ['j_n', 'j_garden'],
  ['j_garden', 'garden_in'],
  ['garden_in', 'garden_arch'],
  ['plaza_e', 'j_lake'],
  ['j_lake', 'lake_deck'],
  ['plaza_w', 'j_home'],
  ['j_home', 'home_front'],
  ['plaza_board', 'j_gh'],
  ['j_gh', 'gh_counter'],
  ['gh_counter', 'gh_farm'],
  ['plaza_bench', 'j_ws'],
  ['j_ws', 'ws_bench'],
  ['ws_bench', 'ws_logs'],
  ['plaza_w', 'j_bt'],
  ['j_bt', 'bt_front'],
  ['plaza_s', 'j_s'],
];

/** 흔들 수 있는 나무(목재·나뭇가지·열매) */
export const SHAKE_TREES: Array<{ id: string; pos: V2; fruit: boolean }> = [
  { id: 't_ws1', pos: [-19.4, 6.0], fruit: false },
  { id: 't_ws2', pos: [-20.2, 13.4], fruit: false },
  { id: 't_ws3', pos: [-7.6, 15.8], fruit: false },
  { id: 't_ws4', pos: [-16.2, 17.2], fruit: false },
  { id: 't_ws5', pos: [-11.2, 17.6], fruit: false },
  { id: 't_gh1', pos: [19.6, 5.4], fruit: true },
  { id: 't_gh2', pos: [8.2, 15.6], fruit: true },
  { id: 't_hm1', pos: [-18.6, -6.2], fruit: false },
  { id: 't_lk1', pos: [21.6, -8.6], fruit: true },
  { id: 't_s1', pos: [-5.2, 15.0], fruit: false },
];

/** 채집 꽃 자리 */
export const FLOWER_SPOTS: Array<{ id: string; pos: V2; item: 'white_flower' | 'pink_flower' | 'yellow_flower' | 'rare_flower' }> = [
  { id: 'f_w1', pos: [3.4, 9.6], item: 'white_flower' },
  { id: 'f_w2', pos: [-3.1, 10.8], item: 'white_flower' },
  { id: 'f_w3', pos: [2.6, 12.9], item: 'white_flower' },
  { id: 'f_w4', pos: [7.2, 12.6], item: 'white_flower' },
  { id: 'f_w5', pos: [8.6, 6.0], item: 'white_flower' },
  { id: 'f_w6', pos: [11.2, 14.6], item: 'white_flower' },
  { id: 'f_w7', pos: [14.6, 15.4], item: 'white_flower' },
  { id: 'f_w8', pos: [6.4, 3.0], item: 'white_flower' },
  { id: 'f_w9', pos: [-6.8, 2.0], item: 'white_flower' },
  { id: 'f_w10', pos: [-8.8, 14.2], item: 'white_flower' },
  { id: 'f_w11', pos: [-14.4, 15.0], item: 'white_flower' },
  { id: 'f_w12', pos: [-3.0, -16.2], item: 'white_flower' },
  { id: 'f_w13', pos: [3.0, -18.4], item: 'white_flower' },
  { id: 'f_w14', pos: [-3.4, -19.6], item: 'white_flower' },
  { id: 'f_w15', pos: [9.8, -6.2], item: 'white_flower' },
  { id: 'f_w16', pos: [-9.6, -5.0], item: 'white_flower' },
  { id: 'f_w17', pos: [16.6, 3.0], item: 'white_flower' },
  { id: 'f_w18', pos: [-17.4, 3.6], item: 'white_flower' },
  { id: 'f_p1', pos: [-2.6, 7.8], item: 'pink_flower' },
  { id: 'f_p2', pos: [10.2, 4.4], item: 'pink_flower' },
  { id: 'f_p3', pos: [-11.0, 3.4], item: 'pink_flower' },
  { id: 'f_p4', pos: [2.8, -10.6], item: 'pink_flower' },
  { id: 'f_p5', pos: [-18.0, -9.0], item: 'pink_flower' },
  { id: 'f_p6', pos: [18.6, 10.0], item: 'pink_flower' },
  { id: 'f_p7', pos: [-25.6, 3.4], item: 'pink_flower' },
  { id: 'f_p8', pos: [9.4, -10.4], item: 'pink_flower' },
  { id: 'f_y1', pos: [4.2, 16.2], item: 'yellow_flower' },
  { id: 'f_y2', pos: [-3.9, -10.4], item: 'yellow_flower' },
  { id: 'f_y3', pos: [20.4, 1.2], item: 'yellow_flower' },
  { id: 'f_y4', pos: [-22.4, 5.0], item: 'yellow_flower' },
  { id: 'f_y5', pos: [-2.8, 18.4], item: 'yellow_flower' },
  { id: 'f_y6', pos: [24.2, -2.0], item: 'yellow_flower' },
  ...WHISPER.rare.map((pos, i) => ({ id: `f_r${i + 1}`, pos, item: 'rare_flower' as const })),
];

/** 작은 돌을 얻는 바위 */
export const ROCKS: Array<{ id: string; pos: V2 }> = [
  { id: 'r1', pos: [-21.4, 9.0] },
  { id: 'r2', pos: [23.4, -19.2] },
  { id: 'r3', pos: [6.6, 19.4] },
  { id: 'r4', pos: [-26.2, -7.6] },
];
