// 웨딩런 코스 생성기 — 장애물·바닥 틈·하트·축의금 봉투·기믹을 '앞으로 만날 자리'에 미리 배치 (261011 사장 '웨딩런', 사양서 [6])
//  · 순수 계산(Phaser 없음). 좌표 = 월드 x(게임 시작부터 달린 거리, 바퀴가 바뀌어도 계속 증가).
//  · 장애물 간격은 '현재 속도 × 점프 체공 시간'으로 계산 → 불가능한 조합·착지 직후 피할 수 없는 장애물 없음(minGap 주석).
//  · 움직이는 장애물은 '플레이어와 만나는 자리(meetX)'로 배치하고, 화면엔 그 자리에 맞춰 더 오른쪽에서 출발시킨다.
//  · (261011 사장 '갈수록 완전 더 어렵게, 기믹도 많이') 밀도는 구간 계단(course.ts density), 기믹 18종(gimmicks.ts)을
//    1바퀴는 정해진 순서로, 2바퀴~ 는 후보 풀·겹침 허용표로 배치. 기믹 하나 = 한 덩어리(첫 요소 앞·마지막 요소 뒤 minGap).
//  · (261011 검증 E2) 구간 그림이 늦으면 '받은 장애물만'으로, 오래 안 오면(포기) 가까운 구간 장애물로 대체 — 하트로만 바뀌지 않게.
import { WR_SEGMENTS, type WrObstacle } from '../assets';
import {
  CHAR_H,
  COLLECT_RATIO,
  COMBO_BY_LAP,
  DIST_PER_POINT,
  ENVELOPE_VALUE,
  GIMMICK_HINT,
  GIMMICK_TUNING as GT,
  GRAVITY,
  HEART_VALUE,
  JUMP_AIR_SEC,
  JUMP_H,
  JUMP_V,
  KIND_WEIGHT,
  LIGHT_ZONE,
  MOVE_MUL,
  PIT_EDGE_GRACE,
  PIT_FROM_SEG,
  PIT_W_RATIO,
  REST_CHANCE_BY_LAP,
  REST_SEC,
} from './config';
import {
  density,
  inZones,
  lerp2,
  level,
  lightZones,
  moveMul,
  noGimmickZones,
  overlapQuiet,
  quietZones,
  SEG_LEN,
  SEG_START,
  segmentAt,
  speedAt,
  type Zone,
} from './course';
import { obsGeom, PLAYER_HIT_MAX_W, type ObsGeom } from './geom';
import {
  BOLT_GEOM,
  BUBBLE_GEOM,
  BUBBLE_HI_GEOM,
  DARK_GUARD_SEC,
  envAllows,
  envChain,
  envPerSeg,
  GIMMICK_IDS,
  GIMMICKS,
  gimmicksPerSeg,
  LAP1_SCHEDULE,
  motionEndM,
  motionS,
  motionTable,
  NAG_LINES,
  RIBBON_GEOM,
  SHADOW_SIGNAL,
  surfGeom,
  zapGeom,
  type EnvKind,
  type GimmickId,
  type Motion,
  type WarnKind,
} from './gimmicks';

export type MarkKind = 'boltMark' | 'shout' | 'shadow' | 'eyes' | 'count' | 'spark';

export type PlanObs = {
  kind: 'obs';
  id: number;
  g: ObsGeom;
  seg: number;
  /** 플레이어 피벗과 장애물 피벗이 같은 x 가 되는 월드 위치 */
  meetX: number;
  /** 다가오는 자체 속도(땅 속도 대비 비율) — 움직임 기믹은 마지막 등속 값 */
  moveFrac: number;
  spawned: boolean;
  /** 연습 장애물(첫 판 조작 안내) */
  tutorial?: 'jump' | 'slide';
  /** 기믹 요소 */
  gim?: GimmickId;
  /** 기믹 한 덩어리 번호 */
  gi?: number;
  /** 덩어리의 첫 요소 */
  first?: boolean;
  /** τ(만남까지 남은 시간) 함수로 움직임 — gimmicks.ts */
  motion?: Motion;
  /** 배치 때 속도(τ = 남은 거리 ÷ 이 값) */
  vPlan?: number;
  /** 움직임 표(motionTable) — 배치 때 한 번 만들어 장면이 재사용(261011 검증 low: 매 프레임 새로 만들던 것) */
  sTab?: Float32Array;
  /** 2단 점프 연습(넘어지지 않음) */
  practice?: boolean;
  /** 첫 등장 안내 말풍선 문구 */
  hint?: string;
  /** 말풍선 장애물 문구 */
  text?: string;
  /** 붙는 연출(땅 번개 표시·호통·그림자·눈빛·카운트다운·불꽃) */
  marks?: MarkKind[];
};
export type PlanPit = { kind: 'pit'; id: number; x0: number; x1: number };
export type PlanItem = { kind: 'heart' | 'envelope'; id: number; x: number; h: number; spawned: boolean };
/** 환경형 기믹 구간(정전·플래시·바람·난기류) — 플레이어 x 가 [x0, x1] 안일 때 */
export type PlanEnv = { id: number; gi: number; gim: GimmickId; kind: EnvKind; x0: number; x1: number; v: number; lap: number };
/** 예고(플레이어 x 가 x 를 지나는 순간 소리 + 화면 신호, 위협이 화면 밖이면 오른쪽 끝 아이콘) */
export type PlanWarn = {
  id: number;
  gi: number;
  gim: GimmickId;
  x: number;
  contactX: number;
  kind: WarnKind;
  /** 아이콘 높이(땅 기준) */
  h: number;
  sound: string;
  fired: boolean;
  /** 판에서 이 기믹 첫 등장(화면 문구) */
  first: boolean;
  /** 2단 점프 연습 안내 */
  tutorial?: boolean;
  /** 첫 요소 id(화면에 들어오면 아이콘 숨김) */
  obsId?: number;
  /** 박자(북·박수) — 플레이어 x */
  beats?: number[];
  beatSound?: string;
  /** 장면이 친 박자 수 */
  beatIdx?: number;
};
/** 장식(충돌 없음) — 바닥 전기 띠 끝 가전 */
export type PlanDecor = { id: number; x: number; def: WrObstacle; scale: number; dy: number; spawned: boolean };
/** 확인용 기록 */
export type GimLog = {
  gi: number;
  gim: GimmickId;
  lap: number;
  seg: number;
  warnX: number;
  contactX: number;
  endX: number;
  n: number;
  env?: EnvKind;
  chained?: boolean;
  /** 연쇄 기믹이 실제로 환경 구간 안에서 일어남(바람·난기류는 구간을 늘려 덮고, 플래시는 한 번 더 터짐) */
  overlap?: boolean;
  practice?: boolean;
  forced?: boolean;
};
/**
 * (261011 검증 medium '겹침이 정전 말고는 실제로 겹치지 않음') 2바퀴~ 환경형 기믹(바람·난기류·플래시·정전)이 놓이면
 * 그 뒤 연쇄 기믹이 '환경이 켜져 있는 동안' 오게 — 바람·난기류는 구간을 연쇄 끝까지 늘리고, 플래시는 연쇄마다 한 번 더 터진다.
 */
type Host = { gi: number; kind: EnvKind; env: PlanEnv | null; left: number; maxX1: number; lastRef: Last | null };
/** 연쇄로 당겨 올 일반 일정의 범위(초) · 바람·난기류 구간을 늘릴 수 있는 최대 길이(초, 구간 시작부터) */
const CHAIN_PULL_SEC = 5;
const HOST_MAX_SEC: Record<EnvKind, number> = { wind: 7, turb: 6, flash: 0, blackout: 0 };

type Last = {
  action: 'jump' | 'slide';
  meetX: number;
  w: number;
  top: number;
  moveFrac: number;
  wp: number;
  spawnX: number;
  rested?: boolean;
  /** 가운데가 지난 뒤 가장 늦은 착지(초) — 바닥 전기(2단 점프) */
  land?: number;
  /** 이 장애물을 넘는 점프의 중력 배수(바람 0.78) */
  gA?: number;
};

type Need = { action: 'jump' | 'slide'; w: number; top: number; moveFrac: number; wp: number };

/** 높이 h 까지 오르는 시간(이륙부터) — gMul = 중력 배수 */
export function tUp(h: number, gMul = 1): number {
  if (h <= 0) return 0;
  const g = GRAVITY * gMul;
  const peak = (JUMP_V * JUMP_V) / (2 * g);
  const r = Math.min(1, h / peak);
  return (JUMP_V / g) * (1 - Math.sqrt(1 - r));
}

/**
 * 앞 장애물 A 가운데가 플레이어를 지난 뒤, 다음 장애물 B 가운데가 플레이어에 닿기까지 필요한 최소 시간(초).
 *  · reach = B 앞끝이 플레이어 앞끝에 닿고 가운데가 겹칠 때까지, pass = A 가운데부터 뒤끝이 빠질 때까지(다가오는 속도 반영)
 *  · A 점프 → 가장 늦게 뛰어(앞끝 닿기 직전 이륙) 넘었을 때의 착지 시각 = tA + 체공 - reachA - tUp(hA)
 *     → 그 뒤 반응 여유 + B 를 넘으려면 늦어도 tB - reachB - tUp(hB) 에 이륙 → 착지 직후 피할 수 없는 장애물 없음
 *     (바람 구역 점프는 체공 0.897 · 바닥 전기는 2단 점프 가장 늦은 착지 A.land)
 *  · A 슬라이드 → A 뒤끝이 빠져야 일어나/뛸 수 있음
 */
export function minGapSec(A: Last, B: Need, v: number, pad: number): number {
  const cA = v * (1 + A.moveFrac);
  const cB = v * (1 + B.moveFrac);
  const reachA = (A.w / 2 + A.wp / 2) / cA;
  const passA = (A.w / 2 + A.wp / 2) / cA;
  const reachB = (B.w / 2 + B.wp / 2) / cB;
  let t: number;
  if (A.action === 'jump') {
    const gA = A.gA ?? 1;
    const latestLand = A.land ?? JUMP_AIR_SEC / gA - reachA - tUp(A.top, gA);
    t = B.action === 'jump' ? latestLand + pad + reachB + tUp(B.top) : latestLand + pad + reachB;
    t = Math.max(t, passA + reachB + pad); // 한 번 점프로 둘 다 넘는 경우에도 겹치지 않게
  } else {
    t = B.action === 'jump' ? passA + pad + reachB + tUp(B.top) + 0.08 : passA + reachB + pad * 0.6 + 0.12;
  }
  return Math.max(t, 0.5);
}

export type PlannerCtx = {
  lap: number;
  lapStartX: number;
  /** 아직 남은 단계 전환 번호(첫 바퀴 1, 이미 지났으면 5) */
  stagesFrom: number;
  /** 장애물 그림(키)이 준비됐나 */
  obsReady: (key: string) => boolean;
  /** 그 구간 그림을 충분히 기다렸거나 받기를 포기했나 → 가까운 구간 장애물로 대체(E2) */
  segWaited: (seg: number) => boolean;
  /** 다가오는 장애물이 화면 오른쪽 밖에서 출발할 거리(플레이어 기준) */
  spawnAhead: number;
  /** 이미 깔린 발판 끝 — 바닥 틈은 이보다 오른쪽에만(이미 깐 발판에 구멍을 낼 수 없음) */
  pitMinX?: () => number;
  /** 기믹 배치(개발 확인에서 끌 수 있음) */
  gimmicks?: boolean;
};

type Sched = { x: number; seg: number; id?: GimmickId; opt?: 'practice' | 'blackout'; deadline: number; forced?: boolean; chainEnv?: EnvKind };

type PatElem = {
  g: ObsGeom;
  moveFrac: number;
  motion?: Motion;
  /** 앞 요소와의 물리 간격(같은 속도로 다가오는 묶음 — 말풍선·쌍번개·아치) */
  gapPhys?: number;
  /** minGap 배수 */
  gapMul?: number;
  /** 가운데끼리 최소 시간(박자) */
  gapSec?: number;
  practice?: boolean;
  text?: string;
  marks?: MarkKind[];
  land?: number;
  gA?: number;
  heart?: 'arc' | 'low' | 'dj' | 'none';
};
type Pattern = {
  elems: PatElem[];
  /** 예고(접촉 전 초) */
  lead: number;
  /** 경고 아이콘 높이 */
  warnH: number;
  env?: (cx: number[], v: number) => Array<{ kind: EnvKind; x0: number; x1: number }>;
  decor?: (cx: number[], v: number) => Array<{ x: number; def: WrObstacle; scale: number; dy: number }>;
  beats?: (cx: number[], v: number) => number[];
  beatSound?: string;
  tutorial?: boolean;
  /** 예고(안내 문구)는 맵 제목 시간에 겹쳐도 됨 — 요소만 제목 시간 밖 */
  titleOk?: boolean;
  /** 요소 없는 환경형(정전) — 시작 자리 */
  envOnly?: { kind: EnvKind; pre: number; dur: number };
};

const DEF_BY_KEY = new Map<string, WrObstacle>(WR_SEGMENTS.flatMap((s) => s.obstacles.map((o) => [o.key, o] as const)));
export const defByKey = (k: string) => DEF_BY_KEY.get(k);

export class Planner {
  obs: PlanObs[] = [];
  pits: PlanPit[] = [];
  items: PlanItem[] = [];
  envs: PlanEnv[] = [];
  warns: PlanWarn[] = [];
  decor: PlanDecor[] = [];
  gimLog: GimLog[] = [];
  /** 확인용: 못 놓은 기믹과 이유 */
  skipLog: Array<{ lap: number; seg: number; id: string; why: string }> = [];
  enabled = true;
  private id = 1;
  private gi = 1;
  private cursor = 0;
  private last: Last | null = null;
  private zones: Zone[] = [];
  private lightZ: Zone[] = [];
  private noGim: Zone[] = [];
  /** 정전·플래시 앞뒤 — 바닥 틈·그림자 신호 기믹 금지 */
  private darkZ: Zone[] = [];
  private ctx: PlannerCtx;
  private placedValue = 0;
  private bag = new Map<number, Set<string>>();
  private lastKey = '';
  private rng: () => number;
  private sched: Sched[] = [];
  /** 판에서 이미 본 기믹(첫 등장 안내는 한 번만) */
  private seen = new Set<GimmickId>();
  private comboLeft = 0;
  private lastGim: GimmickId | null = null;
  private lastPitEnd = -Infinity;
  /** 구간별 환경형 수(바퀴*100+구간) */
  private envCount = new Map<number, number>();
  /** 정전 단독(3바퀴~) 바퀴당 1번 */
  private soloBlackoutLap = 0;
  /** 지금 연쇄를 받는 환경형 기믹(2바퀴~) · 방금 놓은 기믹이 연쇄를 받기 시작했나 */
  private host: Host | null = null;
  private justHosted = false;
  /** 확인용 누적 개수 */
  stats = { heart: 0, envelope: 0, obs: 0, pit: 0, budgetMiss: 0, gimmick: 0, gimSkip: 0, combo: 0, pitTry: 0, pitBlocked: 0 };

  constructor(ctx: PlannerCtx, rng: () => number = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.makeZones();
  }

  /** 새 판·다음 바퀴: 생성 상태 초기화(이미 놓인 것들은 그대로 두고 커서만 옮김) */
  reset(ctx: PlannerCtx, cursor: number, opts: { clear?: boolean; resetBudget?: boolean; keepSchedule?: boolean } = {}) {
    const lapChanged = ctx.lap !== this.ctx.lap || ctx.lapStartX !== this.ctx.lapStartX;
    this.ctx = ctx;
    this.makeZones();
    this.cursor = cursor;
    this.last = null;
    this.bag.clear();
    this.lastKey = '';
    this.comboLeft = 0;
    this.lastPitEnd = -Infinity;
    this.host = null;
    if (opts.clear) {
      this.obs = [];
      this.pits = [];
      this.items = [];
      this.envs = [];
      this.warns = [];
      this.decor = [];
      // (261011 검증 low) 새 판은 월드 x 가 0 부터 — 지난 판 정전·플래시 앞뒤 금지 구간이 새 판 같은 자리에서 틈·기믹을 막지 않게
      this.darkZ = [];
    }
    if (opts.resetBudget) {
      this.placedValue = 0;
      this.seen.clear();
      this.gimLog = [];
      this.soloBlackoutLap = 0;
      this.envCount.clear();
      this.lastGim = null;
    }
    if (opts.clear || lapChanged || !opts.keepSchedule) this.buildSchedule(cursor);
  }

  setStagesFrom(n: number) {
    if (n !== this.ctx.stagesFrom) {
      this.ctx = { ...this.ctx, stagesFrom: n };
      this.makeZones();
    }
  }

  setCursor(x: number) {
    this.cursor = Math.max(this.cursor, x);
  }

  private makeZones() {
    const off = this.ctx.lapStartX;
    const sh = (z: Zone[]) => z.map(([a, b]) => [a + off, b + off] as Zone);
    this.zones = sh(quietZones(this.ctx.lap, { stagesFrom: this.ctx.stagesFrom }));
    this.lightZ = sh(lightZones(this.ctx.lap));
    this.noGim = sh(noGimmickZones(this.ctx.lap));
  }

  /* ───────── 기믹 일정 ───────── */

  /** 바퀴 기믹 일정 — 1바퀴 고정 순서, 2바퀴~ 구간마다 목표 개수를 f ∈ [0.25, 0.92] 에 고르게(뽑기는 놓을 때) */
  private buildSchedule(fromX: number) {
    const { lap, lapStartX } = this.ctx;
    this.sched = [];
    if (this.ctx.gimmicks === false) return;
    const xAt = (seg: number, f: number) => lapStartX + SEG_START[seg] + f * SEG_LEN[seg];
    // 제목 시간에 걸려 밀리면 다음 구간(제목 뒤)까지는 이어서 놓는다 — 구간 끝 기믹이 통째로 빠지지 않게
    const deadlineOf = (seg: number) => {
      const s2 = Math.min(WR_SEGMENTS.length - 1, seg + 1);
      return lapStartX + SEG_START[s2] + SEG_LEN[s2] - 1.0 * speedAt(lap, SEG_START[s2] + SEG_LEN[s2]);
    };
    if (lap === 1) {
      for (const e of LAP1_SCHEDULE) this.sched.push({ x: xAt(e.seg, e.f), seg: e.seg, id: e.id, opt: e.opt, deadline: deadlineOf(e.seg) });
    } else {
      const per = gimmicksPerSeg(lap);
      for (let s = 0; s < WR_SEGMENTS.length; s++) {
        const n = Math.floor(per) + (this.rng() < per - Math.floor(per) ? 1 : 0);
        for (let k = 0; k < n; k++) {
          const f = 0.2 + (0.62 * (k + 0.5)) / n + (this.rng() - 0.5) * 0.06;
          this.sched.push({ x: xAt(s, Math.min(0.85, Math.max(0.2, f))), seg: s, deadline: deadlineOf(s) });
        }
      }
    }
    this.sched = this.sched.filter((s) => s.x >= fromX - 200).sort((a, b) => a.x - b.x);
  }

  /** 개발 확인: 다음 빈자리에 기믹 강제(그 앞 계획은 지움) */
  force(id: GimmickId, at: number, opt?: 'practice' | 'blackout') {
    this.truncateAfter(at);
    this.sched = this.sched.filter((s) => s.x > at + 6000);
    this.sched.unshift({ x: at, seg: segmentAt(at - this.ctx.lapStartX), id, opt, deadline: Infinity, forced: true });
  }

  /** 개발 확인: x 뒤의 아직 안 나온 계획을 지우고 커서를 x 로(지운 수집물 예산은 되돌림) */
  truncateAfter(x: number) {
    let refund = 0;
    this.items = this.items.filter((it) => {
      if (it.x > x && !it.spawned) {
        refund += it.kind === 'heart' ? HEART_VALUE : ENVELOPE_VALUE;
        return false;
      }
      return true;
    });
    this.placedValue = Math.max(0, this.placedValue - refund);
    this.obs = this.obs.filter((o) => o.spawned || o.meetX <= x);
    this.pits = this.pits.filter((p) => p.x0 <= x);
    this.envs = this.envs.filter((e) => e.x0 <= x);
    this.warns = this.warns.filter((w) => w.fired || w.x <= x);
    this.decor = this.decor.filter((d) => d.spawned || d.x <= x);
    this.cursor = x;
    this.comboLeft = 0;
    // 남은 마지막 장애물을 '앞 장애물'로(강제 기믹도 minGap 을 지키게)
    const lo = this.obs.filter((o) => o.meetX <= x).sort((a, b) => b.meetX - a.meetX)[0];
    const lp = this.pits.filter((p) => p.x1 <= x).sort((a, b) => b.x1 - a.x1)[0];
    if (lp && (!lo || (lp.x0 + lp.x1) / 2 > lo.meetX)) {
      const cx = (lp.x0 + lp.x1) / 2;
      this.last = { action: 'jump', meetX: cx, w: Math.max(10, lp.x1 - lp.x0 - PIT_EDGE_GRACE * 2), top: 0, moveFrac: 0, wp: 14, spawnX: cx };
    } else if (lo) {
      const e: PatElem = { g: lo.g, moveFrac: lo.moveFrac, motion: lo.motion };
      this.last = this.recOf(e, lo.meetX, lo.vPlan ?? speedAt(this.ctx.lap, lo.meetX - this.ctx.lapStartX));
      if (lo.g.code === 'zap') this.last.land = (lo.g.w / 2 + GT.zapPlayerW) / (lo.vPlan ?? 600) + GT.zapLandAfter;
    } else this.last = null;
  }

  /** 지금 계획에 남은 기믹 일정(확인용) */
  scheduleView() {
    return this.sched.map((s) => ({ x: Math.round(s.x), seg: s.seg, id: s.id ?? null, opt: s.opt ?? null }));
  }

  /* ───────── 연습·수집물 ───────── */

  /** 연습 장애물 직접 배치(첫 판 조작 안내) */
  addTutorial(def: WrObstacle, meetX: number, tag: 'jump' | 'slide'): PlanObs {
    const g = obsGeom(def);
    const o: PlanObs = { kind: 'obs', id: this.id++, g, seg: 0, meetX, moveFrac: g.move * MOVE_MUL[0], spawned: false, tutorial: tag };
    this.obs.push(o);
    this.obs.sort((a, b) => a.meetX - b.meetX);
    return o;
  }

  /** 하트 줄을 직접 배치(연습 구간 보상 등) — 예산이 모자라면 놓을 수 있는 만큼만 앞에서부터 */
  addHeartRow(x0: number, n: number, h = CHAR_H * 0.45, step = 48) {
    let m = n;
    while (m > 0 && !this.canAfford(x0, m * HEART_VALUE)) m--;
    for (let k = 0; k < m; k++) this.tryItem('heart', x0 + k * step, h);
  }

  /** 수집물 예산: 놓은 점수 누적 ≤ 그 자리까지 거리 점수 × COLLECT_RATIO (config 근거) */
  private tryItem(kind: 'heart' | 'envelope', x: number, h: number): boolean {
    const val = kind === 'heart' ? HEART_VALUE : ENVELOPE_VALUE;
    if (x <= 0 || this.placedValue + val > (COLLECT_RATIO * x) / DIST_PER_POINT) {
      this.stats.budgetMiss++;
      return false;
    }
    this.placedValue += val;
    this.items.push({ kind, id: this.id++, x, h, spawned: false });
    this.stats[kind]++;
    return true;
  }

  /** 무늬 전체를 놓을 예산이 있나(호·줄이 중간에 끊겨 보이지 않게 — 전부 아니면 안 놓음) */
  private canAfford(x: number, value: number): boolean {
    return x > 0 && this.placedValue + value <= (COLLECT_RATIO * x) / DIST_PER_POINT;
  }

  /** 이상적인 점프(가운데 = cx, 그 지점 속도 v)를 따라가는 하트 호 */
  private arc(cx: number, v: number, n: number, withEnvelope: boolean) {
    const span = v * JUMP_AIR_SEC;
    const total = n * HEART_VALUE + (withEnvelope ? ENVELOPE_VALUE - HEART_VALUE : 0);
    if (!this.canAfford(cx - span * 0.3, total)) {
      this.stats.budgetMiss++;
      return;
    }
    for (let k = 0; k < n; k++) {
      const s = 0.2 + (0.6 * k) / Math.max(1, n - 1);
      const x = cx + (s - 0.5) * span;
      const feet = 4 * JUMP_H * s * (1 - s);
      const mid = k === Math.floor(n / 2);
      this.tryItem(withEnvelope && mid ? 'envelope' : 'heart', x, feet + CHAR_H * 0.5);
    }
  }

  /** 2단 점프 길(꼭대기 190)을 따라가는 하트 — 바닥 전기 위 */
  private djArc(cx: number, w: number, v: number, envelope: boolean) {
    const n = 5;
    const total = n * HEART_VALUE + (envelope ? ENVELOPE_VALUE - HEART_VALUE : 0);
    const x0 = cx - w / 2 - 0.1 * v; // 이상적 이륙
    if (!this.canAfford(x0, total)) {
      this.stats.budgetMiss++;
      return;
    }
    // 이륙 0.3초에 2단(꼭대기 190) — phys.js 와 같은 궤적
    const feetAt = (t: number) => {
      if (t <= 0.3) return JUMP_V * t - 0.5 * GRAVITY * t * t;
      const y1 = JUMP_V * 0.3 - 0.5 * GRAVITY * 0.09;
      const tt = t - 0.3;
      const g2 = GRAVITY * 0.8;
      const v2 = Math.min(600, Math.sqrt(Math.max(0, 2 * g2 * (190 - y1))));
      return Math.max(0, y1 + v2 * tt - 0.5 * g2 * tt * tt);
    };
    for (let k = 0; k < n; k++) {
      const t = 0.22 + 0.15 * k;
      this.tryItem(envelope && k === 2 ? 'envelope' : 'heart', x0 + t * v, feetAt(t) + CHAR_H * 0.5);
    }
  }

  private lowRow(cx: number, n = 3, step = 46) {
    if (!this.canAfford(cx - step, n * HEART_VALUE)) return;
    for (let k = 0; k < n; k++) this.tryItem('heart', cx + (k - (n - 1) / 2) * step, CHAR_H * 0.24);
  }

  /* ───────── 장애물 고르기 ───────── */

  /** 이 구간에서 쓸 수 있는 장애물 — 받은 것만, 하나도 없으면 기다렸는지 보고 가까운 구간 것으로(E2) */
  private usableDefs(seg: number): WrObstacle[] | null {
    const defs = WR_SEGMENTS[seg].obstacles;
    const ready = defs.filter((d) => this.ctx.obsReady(d.key));
    if (ready.length) return ready;
    if (!this.ctx.segWaited(seg)) return null;
    for (let k = 1; k < WR_SEGMENTS.length; k++) {
      for (const s of [seg - k, seg + k]) {
        if (s < 0 || s >= WR_SEGMENTS.length) continue;
        const r = WR_SEGMENTS[s].obstacles.filter((d) => this.ctx.obsReady(d.key));
        if (r.length) return r;
      }
    }
    return null;
  }

  private pickDef(seg: number, diff: number, defs: WrObstacle[], onlyJump = false): WrObstacle {
    const lap1 = this.ctx.lap === 1;
    const pool = onlyJump ? defs.filter((d) => d.kind === 'ground' || d.kind === 'moving-ground') : defs;
    const list = pool.length ? pool : defs;
    const weightOf = (d: WrObstacle) => {
      const kw = KIND_WEIGHT[d.kind];
      let w = lerp2(kw, diff);
      if (lap1 && seg === 0) {
        if (d.kind === 'moving-ground') w = 0;
        if (d.kind === 'flying') w *= 0.6;
      }
      if (list.length > 1 && d.key === this.lastKey) w *= 0.25;
      return w;
    };
    // 구간마다 모든 장애물이 적어도 한 번씩 나오게(사양서 [13] '12개 배경과 해당 장애물이 순서대로')
    const bagKey = this.ctx.lap * 100 + seg;
    let bag = this.bag.get(bagKey);
    if (!bag) {
      bag = new Set(WR_SEGMENTS[seg].obstacles.map((d) => d.key));
      this.bag.set(bagKey, bag);
    }
    if (bag.size > 0 && !onlyJump) {
      const cand = list.filter((d) => bag!.has(d.key) && weightOf(d) > 0);
      if (cand.length) {
        const d = cand[Math.floor(this.rng() * cand.length)];
        bag.delete(d.key);
        this.lastKey = d.key;
        return d;
      }
    }
    const total = list.reduce((a, d) => a + weightOf(d), 0);
    let r = this.rng() * total;
    let pick = list[0];
    for (const d of list) {
      r -= weightOf(d);
      if (r <= 0) {
        pick = d;
        break;
      }
    }
    bag.delete(pick.key);
    this.lastKey = pick.key;
    return pick;
  }

  /* ───────── 메인 ───────── */

  /** 월드 x 가 limit 에 닿을 때까지 앞쪽을 채운다 */
  planUntil(limit: number) {
    if (!this.enabled) return;
    let guard = 0;
    while (this.cursor < limit && guard++ < 64) {
      const { lap, lapStartX } = this.ctx;
      const d = this.cursor - lapStartX;
      const seg = segmentAt(d);
      const v = speedAt(lap, d);
      const { diff } = level(lap, d);
      const pad = density('pad', lap, d);

      // 안전 구간 안이면 끝으로 건너뜀(그 안엔 하트 줄만)
      const qz = overlapQuiet(this.zones, this.cursor, this.cursor + 1);
      if (qz != null) {
        const from = this.cursor + 80;
        const to = Math.min(qz, from + 900);
        if (to - from > 300 && this.rng() < 0.6) this.addHeartRow(from + 60, Math.min(6, Math.floor((to - from - 120) / 60)));
        this.cursor = qz + 1;
        continue;
      }

      // 기믹 일정 — 다음 기믹 자리가 가까우면(보통 장애물 하나 간격 안) 커서를 그 자리로 당겨 바로 놓는다(구간 끝으로 밀려 빠지지 않게)
      const nx = this.sched[0];
      if (nx && nx.x > this.cursor && nx.x - this.cursor < 1.3 * v) this.cursor = nx.x;
      if (this.trySchedule(v, pad)) continue;

      // 구간 그림이 아직이면(느린 네트워크) 장애물 없이 하트만 — 받은 장애물이 있으면 그것만으로, 오래 기다렸으면 가까운 구간 것으로
      const defs = this.usableDefs(seg);
      if (!defs) {
        this.addHeartRow(this.cursor + 40, 4);
        this.cursor += 420;
        continue;
      }

      // 가끔 쉬어 가는 하트 줄
      const restChance = REST_CHANCE_BY_LAP[Math.min(REST_CHANCE_BY_LAP.length - 1, lap - 1)];
      if (this.last && !this.last.rested && this.comboLeft === 0 && this.rng() < restChance) {
        // 한 장애물 뒤에 한 번만. last 는 그대로 둬서 다음 장애물 간격 계산(minGap)이 계속 지켜진다
        this.last.rested = true;
        const restDist = (REST_SEC[0] + this.rng() * (REST_SEC[1] - REST_SEC[0])) * v;
        const from = this.last.meetX + 200;
        const end = this.last.meetX + restDist - 180; // 하트 줄이 다음 장애물에 닿지 않게
        const n = Math.min(8, Math.floor((end - from) / 52));
        if (n >= 2) this.addHeartRow(from, n, CHAR_H * 0.45, 52);
        const ex = from + Math.max(0, n) * 52 + 40;
        if (ex < end && this.rng() < 0.35) this.tryItem('envelope', ex, JUMP_H * 0.85 + CHAR_H * 0.35);
        this.cursor = Math.max(this.cursor, this.last.meetX + restDist);
        continue;
      }

      // 간격 여유: 콤보 묶음이면 최소 간격, 맵 제목 '가벼운 구간'이면 ×1.35
      const combo = this.comboLeft > 0;
      let extra = combo ? 1 : 1 + this.rng() * (density('gapMul', lap, d) - 1);
      const breath = combo ? 0 : density('breath', lap, d) * this.rng();
      const light = inZones(this.lightZ, this.cursor);
      if (light) extra *= LIGHT_ZONE.gapMul;

      // 바닥 틈(점프)
      const pitMin = this.ctx.pitMinX ? this.ctx.pitMinX() : -Infinity;
      const pitChance =
        (lap > 1 || seg >= PIT_FROM_SEG) && this.cursor > pitMin + 400 && !light && !combo ? density('pit', lap, d) : 0;
      if (this.rng() < pitChance) {
        this.stats.pitTry++;
        const w = v * JUMP_AIR_SEC * lerp2(PIT_W_RATIO, diff);
        const wEff = Math.max(10, w - PIT_EDGE_GRACE * 2);
        const me = { action: 'jump' as const, w: wEff, top: 0, moveFrac: 0, wp: 14 };
        let cx = this.cursor;
        if (this.last) cx = Math.max(cx, this.last.meetX + minGapSec(this.last, me, v, pad) * v * extra + breath, this.last.spawnX + w / 2 + 40);
        const span0 = cx - w / 2 - v * 0.4;
        const span1 = cx + w / 2 + v * 0.4;
        const q = overlapQuiet(this.zones, span0, span1) ?? overlapQuiet(this.darkZ, span0, span1) ?? overlapQuiet(this.lightZ, span0, span1);
        if (q == null && cx - w / 2 < pitMin) {
          // 이미 깐 발판 위 — 틈 대신 이번 자리는 건너뜀(다음 반복에서 장애물로)
          this.cursor = Math.max(this.cursor + 1, pitMin + 400);
          continue;
        }
        if (q == null) {
          this.pits.push({ kind: 'pit', id: this.id++, x0: cx - w / 2, x1: cx + w / 2 });
          this.lastPitEnd = cx + w / 2;
          this.stats.pit++;
          if (this.rng() < 0.7) this.arc(cx, v, 4, false);
          this.last = { action: 'jump', meetX: cx, w: wEff, top: 0, moveFrac: 0, wp: 14, spawnX: cx };
          this.cursor = cx + 1;
          continue;
        }
        // 틈을 못 놓는 자리 — 장애물로 이어감
        this.stats.pitBlocked++;
      }

      // 장애물
      const def = this.pickDef(seg, diff, defs);
      const g = obsGeom(def);
      const moveFrac = g.move * moveMul(lap, d);
      const me = { action: g.action, w: g.w, top: g.hit.t, moveFrac, wp: PLAYER_HIT_MAX_W };
      let cx = this.cursor;
      if (this.last) {
        cx = Math.max(cx, this.last.meetX + minGapSec(this.last, me, v, pad) * v * extra + breath);
        // 앞의 움직이는 장애물이 이 장애물을 뚫고 지나가는 그림 방지: 그것의 출발 자리보다 오른쪽
        cx = Math.max(cx, this.last.spawnX + g.drawW / 2 + 40);
      }
      const reach = (g.w / 2 + PLAYER_HIT_MAX_W / 2) / (1 + moveFrac);
      const span0 = cx - reach - v * 0.35;
      const span1 = cx + reach + v * 0.45;
      const q = overlapQuiet(this.zones, span0, span1);
      if (q != null) {
        this.cursor = Math.max(this.cursor + 1, q + (cx - span0) + 1);
        // 못 놓았으면 '구간마다 한 번씩' 목록에 되돌려 둠
        this.bag.get(this.ctx.lap * 100 + seg)?.add(def.key);
        this.comboLeft = 0;
        continue;
      }
      const o: PlanObs = { kind: 'obs', id: this.id++, g, seg, meetX: cx, moveFrac, spawned: false };
      this.obs.push(o);
      this.stats.obs++;
      // 하트: 점프 장애물 위로 호 / 머리 위 장애물 밑으로 낮은 줄
      if (g.action === 'jump') {
        if (this.rng() < 0.7) this.arc(cx, v, this.rng() < 0.45 ? 3 : 5, this.rng() < 0.16);
      } else if (this.rng() < 0.6) this.lowRow(cx);
      const spawnX = moveFrac > 0 ? cx + (this.ctx.spawnAhead * moveFrac) / (1 + moveFrac) + g.drawW / 2 : cx;
      this.last = { action: g.action, meetX: cx, w: g.w, top: g.hit.t, moveFrac, wp: PLAYER_HIT_MAX_W, spawnX };
      this.cursor = cx + 1;
      // 콤보 묶음(최소 간격 연속) — 바퀴별 확률·최대 개수
      if (this.comboLeft > 0) this.comboLeft--;
      else if (!light) {
        const [p, max] = COMBO_BY_LAP[Math.min(COMBO_BY_LAP.length - 1, lap - 1)];
        if (this.rng() < p) {
          this.comboLeft = 1 + Math.floor(this.rng() * Math.max(1, max - 1));
          this.stats.combo++;
        }
      }
    }
    this.items.sort((a, b) => a.x - b.x);
    this.obs.sort((a, b) => a.meetX - b.meetX);
  }

  /* ───────── 기믹 배치 ───────── */

  private trySchedule(v: number, pad: number): boolean {
    const s = this.sched[0];
    if (!s || this.cursor < s.x) return false;
    if (this.cursor > s.deadline) {
      this.skip(s, 'deadline');
      return true;
    }
    const id = s.id ?? this.pickGimmick(s);
    if (!id) {
      this.skip(s, 'no-candidate');
      return true;
    }
    this.justHosted = false;
    const res = this.placeGimmick(id, s, v, pad);
    if (res === true) {
      this.sched.shift();
      this.lastGim = id;
      this.stats.gimmick++;
      // 2바퀴~ 환경형(바람·난기류·플래시·정전, 바닥 전기+정전 포함)이면 그 동안 장애물 기믹을 겹쳐서(동시 2 → 3 → 4).
      // (261011 검증 medium) 연쇄는 곧 올 일반 일정을 환경 안으로 당겨 온다 — 예전엔 일정을 더 쌓아 뒤 기믹이 '기한 넘김'으로 밀려 빠졌다.
      const h = this.host;
      if (this.justHosted && h && h.left > 0) {
        const pulled: Sched[] = [];
        this.sched = this.sched.filter((e) => {
          if (pulled.length >= h.left || e.id || e.chainEnv || e.forced || e.x > this.cursor + CHAIN_PULL_SEC * v) return true;
          pulled.push({ x: this.cursor, seg: s.seg, deadline: Math.max(e.deadline, s.deadline + 2 * v), chainEnv: h.kind });
          return false;
        });
        while (pulled.length < h.left) pulled.push({ x: this.cursor, seg: s.seg, deadline: s.deadline + 2 * v, chainEnv: h.kind });
        this.sched.unshift(...pulled);
      }
      return true;
    }
    if (typeof res === 'number') {
      // 제목 시간·안전 구간에 걸림 → 일정만 뒤로 미루고, 그 사이는 보통 장애물로 채운다(빈 길이 길어지지 않게)
      s.x = Math.max(this.cursor + 1, res);
      if (s.x > s.deadline) {
        this.skip({ ...s, id }, 'postponed-past-deadline');
        return true;
      }
      this.sched.sort((a, b) => a.x - b.x);
      return false;
    }
    this.skip({ ...s, id }, this.gimReady(id) ? 'build-failed' : 'texture');
    return true;
  }

  private skip(s: Sched, why: string) {
    this.sched.shift();
    this.stats.gimSkip++;
    this.skipLog.push({ lap: this.ctx.lap, seg: s.seg, id: s.id ?? '(pick)', why });
    if (this.skipLog.length > 100) this.skipLog.shift();
  }

  private gimReady(id: GimmickId): boolean {
    return GIMMICKS[id].needs.every((k) => this.ctx.obsReady(k));
  }

  /** 2바퀴~ 뽑기 — 대표 구간 ×2, 상주(아무 데서나)는 어디서나, 같은 기믹 연속 금지, 환경형 수·겹침 허용표 */
  private pickGimmick(s: Sched): GimmickId | null {
    const lap = this.ctx.lap;
    const key = lap * 100 + s.seg;
    const envUsed = this.envCount.get(key) ?? 0;
    const cands: Array<[GimmickId, number]> = [];
    for (const id of GIMMICK_IDS) {
      const g = GIMMICKS[id];
      if (g.minLap > lap || id === this.lastGim) continue;
      if (!this.gimReady(id)) continue;
      if (s.chainEnv) {
        if (g.env || !envAllows(s.chainEnv, id, lap)) continue;
      } else if (g.env) {
        if (envUsed >= envPerSeg(lap)) continue;
        if (id === 'blackout' && this.soloBlackoutLap === lap) continue;
      }
      let w = g.weight;
      if (g.home === s.seg) w *= 2;
      else if (!g.anywhere && Math.abs(g.home - s.seg) > 1) w *= 0.3;
      cands.push([id, w]);
    }
    if (!cands.length) return null;
    let r = this.rng() * cands.reduce((a, c) => a + c[1], 0);
    for (const [id, w] of cands) {
      r -= w;
      if (r <= 0) return id;
    }
    return cands[cands.length - 1][0];
  }

  private geomOf(key: string): ObsGeom | null {
    const d = DEF_BY_KEY.get(key);
    return d && this.ctx.obsReady(key) ? obsGeom(d) : null;
  }

  /** 지금 구간의 받은 지상 장애물 하나(바람·쌍번개 사이) */
  private groundElem(seg: number, diff: number): ObsGeom | null {
    const defs = (this.usableDefs(seg) ?? []).filter((d) => d.kind === 'ground');
    if (!defs.length) {
      for (const s of [0, 1]) {
        const r = WR_SEGMENTS[s].obstacles.filter((d) => d.kind === 'ground' && this.ctx.obsReady(d.key));
        if (r.length) return obsGeom(r[Math.floor(this.rng() * r.length)]);
      }
      return null;
    }
    return obsGeom(this.pickDef(seg, diff, defs, true));
  }

  private recOf(e: PatElem, cx: number, v: number): Last {
    const spawnX = this.spawnWorldX(e, cx, v);
    return { action: e.g.action, meetX: cx, w: e.g.w, top: e.g.hit.t + (e.g.code === 'surf' ? 0 : 0), moveFrac: e.moveFrac, wp: PLAYER_HIT_MAX_W, spawnX, land: e.land, gA: e.gA };
  }

  /** 화면에 들어올 때의 월드 x(뒤 장애물이 이것을 뚫고 지나가는 그림 방지) */
  private spawnWorldX(e: PatElem, cx: number, v: number): number {
    const ahead = this.ctx.spawnAhead;
    if (e.motion) {
      const tab = motionTable(e.motion);
      // gap(τ) = v·τ + v·S(τ) = ahead 인 τ
      let tau = 0;
      for (let i = 0; i < 600; i++) {
        tau = i * 0.01;
        if (v * tau + v * motionS(tab, e.motion, tau) >= ahead) break;
      }
      return cx + v * motionS(tab, e.motion, tau) + e.g.drawW / 2;
    }
    return e.moveFrac > 0 ? cx + (ahead * e.moveFrac) / (1 + e.moveFrac) + e.g.drawW / 2 : cx;
  }

  /** 기믹 한 덩어리 만들기 — 설계 §6 표의 요소·간격·예고 */
  private buildPattern(id: GimmickId, s: Sched, v: number, pad: number): Pattern | null {
    const lap = this.ctx.lap;
    const d = this.cursor - this.ctx.lapStartX;
    const seg = segmentAt(d);
    const { diff } = level(lap, d);
    const mm = moveMul(lap, d);
    const lead = GT.warn[id] ?? 1.2;
    const r = this.rng();
    const H = CHAR_H;
    switch (id) {
      case 'mil-bolt': {
        const bolt: PatElem = { g: BOLT_GEOM, moveFrac: 0, motion: { k: 'bolt' }, marks: ['boltMark'], heart: 'low' };
        const mother = this.geomOf('scolding_mother');
        let elems: PatElem[];
        if (mother && (lap === 1 || r < 0.3)) elems = [bolt, { g: mother, moveFrac: 0, marks: ['shout'], gapMul: 1.05, heart: 'arc' }];
        else if (lap >= 3 && r < 0.6) elems = [bolt, { ...bolt, gapPhys: GT.boltPairGap, heart: 'none' }];
        else if (lap >= 3 && r < 0.85) {
          const gg = this.groundElem(seg, diff);
          elems = gg ? [bolt, { g: gg, moveFrac: 0, gapMul: 1.05, heart: 'arc' }, { ...bolt, gapMul: 1.05 }] : [bolt];
        } else elems = [bolt];
        return { elems, lead, warnH: 96 };
      }
      case 'zap-floor': {
        const zg = zapGeom(v);
        const land = (zg.w / 2 + GT.zapPlayerW) / v + GT.zapLandAfter;
        const strip: PatElem = { g: zg, moveFrac: 0, land, gapMul: 1.15, heart: 'dj', marks: ['spark'] };
        if (s.opt === 'practice') {
          // 연습 1회(넘어지지 않음) — 실패하면 장면이 이 구간의 다음 전기 2개까지 연습으로 바꿔 준다('실패 시 최대 2회 더')
          // 안내 문구는 맵 제목 시간에 겹쳐도 됨(연습 띠 자체는 제목 시간 밖)
          return { elems: [{ ...strip, practice: true, gapMul: 1.3 }], lead: 2.6, warnH: 24, tutorial: true, titleOk: true, decor: (cx) => this.applianceDecor(cx[0] + zg.w / 2) };
        }
        return {
          elems: [strip],
          lead,
          warnH: 24,
          decor: (cx) => this.applianceDecor(cx[0] + zg.w / 2),
          env:
            s.opt === 'blackout' || (lap >= 2 && this.rng() < (lap >= 3 ? 0.6 : 0.4))
              ? (cx, vv) => {
                  const x0 = cx[0] + zg.w / 2 + GT.blackoutAfterZap * vv;
                  return [{ kind: 'blackout' as EnvKind, x0, x1: x0 + GT.blackoutDur[lap >= 3 ? 1 : 0] * vv }];
                }
              : undefined,
        };
      }
      case 'blackout':
        return { elems: [], lead: GT.blackoutPre, warnH: 0, envOnly: { kind: 'blackout', pre: GT.blackoutPre, dur: GT.blackoutDur[lap >= 3 ? 1 : 0] } };
      case 'nag-barrage': {
        const father = this.geomOf('nagging_father');
        if (!father) return null;
        const n = lap === 1 ? 2 : lap === 2 ? 3 : 4;
        const elems: PatElem[] = [];
        for (let k = 0; k < n; k++) {
          elems.push({ g: BUBBLE_GEOM, moveFrac: GT.bubbleMove, text: NAG_LINES[k % NAG_LINES.length], gapPhys: k ? GT.bubbleGap : undefined, heart: k === 0 ? 'low' : 'none' });
          // (261011 검증 medium) 바로 위 윗줄 — 탄막 = 두 줄 벽, 2단 점프로 넘거나 사이로 못 지나감(슬라이드로만)
          elems.push({ g: BUBBLE_HI_GEOM, moveFrac: GT.bubbleMove, text: NAG_LINES[(k + 2) % NAG_LINES.length], gapPhys: 0, heart: 'none' });
        }
        elems.push({ g: father, moveFrac: 0, gapMul: 1.05, heart: 'arc' });
        return { elems, lead, warnH: 100 };
      }
      case 'pigeon-dive': {
        const pg = this.geomOf('pigeon');
        if (!pg) return null;
        const m = pg.move * mm;
        const e: PatElem = { g: pg, moveFrac: m, motion: { k: 'dive', m, from: GT.diveFrom - (pg.lift + pg.hit.b) }, marks: ['shadow'], heart: 'low' };
        return { elems: lap >= 2 && r < 0.5 ? [e, { ...e, gapMul: 1.05 }] : [e], lead, warnH: 150 };
      }
      case 'kid-rush': {
        const kg = this.geomOf('running_children');
        if (!kg) return null;
        const e: PatElem = { g: kg, moveFrac: GT.kidMove[lap >= 3 ? 1 : 0], heart: 'arc' };
        return { elems: lap >= 2 && r < 0.5 ? [e, { ...e }] : [e], lead, warnH: 40 };
      }
      case 'royal-triple': {
        const rg = this.geomOf('royal_procession');
        if (!rg) return null;
        const m = rg.move * mm;
        const rec: Last = { action: 'jump', meetX: 0, w: rg.w, top: rg.hit.t, moveFrac: m, wp: PLAYER_HIT_MAX_W, spawnX: 0 };
        const B = Math.max(1.0, minGapSec(rec, { action: 'jump', w: rg.w, top: rg.hit.t, moveFrac: m, wp: PLAYER_HIT_MAX_W }, v, pad) * 1.02);
        const n = lap >= 3 ? 4 : 3;
        const elems: PatElem[] = [];
        for (let k = 0; k < n; k++) elems.push({ g: rg, moveFrac: m, gapSec: k ? B : undefined, heart: 'arc' });
        // 북소리 = 각 행렬의 이상적 이륙 시각(접촉 −0.30초)
        return { elems, lead, warnH: 40, beats: (cx, vv) => cx.map((x) => x - 0.3 * vv), beatSound: 'drum' };
      }
      case 'rack-slide': {
        const rk = this.geomOf('dress_rack');
        if (!rk) return null;
        const e: PatElem = { g: rk, moveFrac: GT.rackMove, motion: { k: 'accel', m1: GT.rackMove }, heart: 'arc' };
        return { elems: lap >= 2 && r < 0.5 ? [e, { ...e, gapMul: 1.05 }] : [e], lead, warnH: 40 };
      }
      case 'dryer-wind': {
        const dy = this.geomOf('flying_dyson');
        if (!dy) return null;
        // 2바퀴~ 은 연쇄 기믹이 바람 속에서 이어지므로(구간을 늘림) 바람 자체 지상 장애물은 1개 — 시간을 아껴 기믹 수를 늘린다(261011 검증 medium)
        const n = lap >= 2 && envChain(lap) > 0 ? 1 : lap >= 3 ? 3 : 2;
        const elems: PatElem[] = [];
        for (let k = 0; k < n; k++) {
          const gg = this.groundElem(seg, diff);
          if (gg) elems.push({ g: gg, moveFrac: 0, gA: GT.windG, gapMul: 1.05, heart: 'arc' });
        }
        if (!elems.length) return null;
        elems.push({ g: dy, moveFrac: dy.move * mm, gapMul: 1.05, heart: 'low' });
        return {
          elems,
          lead,
          warnH: 100,
          env: (cx, vv) => [{ kind: 'wind', x0: cx[0] - 0.75 * vv, x1: cx[cx.length - 2] + 0.3 * vv }],
        };
      }
      case 'paper-rain': {
        const cs = this.geomOf('contract_stack');
        if (!cs) return null;
        const e: PatElem = { g: cs, moveFrac: 0, motion: { k: 'drop' }, marks: ['shadow'], heart: 'arc' };
        return { elems: lap >= 2 ? [e, { ...e, gapMul: 1.05 }] : [e], lead, warnH: 150 };
      }
      case 'photo-flash': {
        const ph = this.geomOf('wedding_photographer');
        if (!ph) return null;
        const e: PatElem = { g: ph, moveFrac: 0, marks: ['count'], heart: 'arc' };
        // 2바퀴~ 은 연쇄 기믹마다 플래시가 한 번 더 터진다(연사) → 사진사는 1명
        const elems = lap >= 3 && envChain(lap) === 0 ? [e, { ...e, gapMul: 1.3 }] : [e];
        return {
          elems,
          lead,
          warnH: 40,
          env: (cx, vv) => cx.map((x) => ({ kind: 'flash' as EnvKind, x0: x - GT.flashAt * vv, x1: x - (GT.flashAt - GT.flashDur) * vv })),
        };
      }
      case 'turbulence': {
        const cg = this.geomOf('service_cart');
        if (!cg) return null;
        // 2바퀴~ 은 연쇄 기믹이 흔들림 속에서 이어지므로(구간을 늘림) 카트 2대
        const n = 2;
        const elems: PatElem[] = [];
        for (let k = 0; k < n; k++) elems.push({ g: cg, moveFrac: GT.cartMove, gapMul: 1.05, heart: 'arc' });
        return { elems, lead, warnH: 40, env: (cx, vv) => [{ kind: 'turb', x0: cx[0] - lead * vv, x1: cx[0] + (GT.turbSec - lead) * vv }] };
      }
      case 'monkey-hop': {
        const mk = this.geomOf('playful_monkey');
        if (!mk) return null;
        const m = Math.max(0.3, mk.move * mm);
        const e: PatElem = { g: mk, moveFrac: m, motion: { k: 'hop', m }, heart: 'arc' };
        return { elems: lap >= 2 && r < 0.5 ? [e, { ...e, gapMul: 1.05 }] : [e], lead, warnH: 40 };
      }
      case 'surf-wave': {
        const sd = DEF_BY_KEY.get('surfboard');
        if (!sd || !this.ctx.obsReady('surfboard')) return null;
        const sg = surfGeom(sd);
        return { elems: [{ g: sg, moveFrac: GT.surfMove, motion: { k: 'wave', m: GT.surfMove }, heart: 'low' }], lead, warnH: 120 };
      }
      case 'robo-zigzag': {
        const rv = this.geomOf('robot_vacuum');
        if (!rv) return null;
        const [a, b, c] = GT.roboMove;
        const e: PatElem = { g: rv, moveFrac: c, motion: { k: 'zigzag', a, b, c }, heart: 'arc' };
        return { elems: lap >= 2 ? [e, { ...e, gapMul: 1.05 }] : [e], lead, warnH: 24 };
      }
      case 'cat-pounce': {
        const ct = this.geomOf('home_cat');
        if (!ct) return null;
        const e: PatElem = { g: ct, moveFrac: GT.catMove, motion: { k: 'pounce', m1: GT.catMove, shelf: 150 }, marks: ['eyes'], heart: 'arc' };
        return { elems: lap >= 2 && r < 0.5 ? [e, { ...e, gapMul: 1.05 }] : [e], lead, warnH: 160 };
      }
      case 'clap-rhythm': {
        const cg = this.geomOf('clapping_guests');
        if (!cg) return null;
        const J: PatElem = { g: cg, moveFrac: 0, heart: 'arc' };
        const S: PatElem = { g: RIBBON_GEOM, moveFrac: 0, heart: 'low' };
        const rJ: Last = { action: 'jump', meetX: 0, w: cg.w, top: cg.hit.t, moveFrac: 0, wp: PLAYER_HIT_MAX_W, spawnX: 0 };
        const rS: Last = { action: 'slide', meetX: 0, w: RIBBON_GEOM.w, top: RIBBON_GEOM.hit.t, moveFrac: 0, wp: PLAYER_HIT_MAX_W, spawnX: 0 };
        const B = Math.max(
          lap >= 3 ? 0.95 : 1.05,
          minGapSec(rJ, { action: 'slide', w: RIBBON_GEOM.w, top: 0, moveFrac: 0, wp: PLAYER_HIT_MAX_W }, v, pad),
          minGapSec(rS, { action: 'jump', w: cg.w, top: cg.hit.t, moveFrac: 0, wp: PLAYER_HIT_MAX_W }, v, pad),
        );
        const seq = lap >= 3 ? [J, S, J, S, J] : [J, S, J];
        const elems = seq.map((e, k) => ({ ...e, gapSec: k ? B : undefined }));
        // 짝·짝 두 번 미리(접촉 −2B, −B) + 박자마다
        return { elems, lead: Math.max(lead, 2 * B + 0.2), warnH: 40, beats: (cx, vv) => [cx[0] - 2 * B * vv, cx[0] - B * vv, ...cx.map((x) => x - 0.3 * vv)], beatSound: 'clap' };
      }
      case 'arch-tunnel': {
        const ag = this.geomOf('floral_arch');
        const ch = this.geomOf('guest_chair');
        if (!ag || !ch) return null;
        const n = lap === 1 ? 2 : lap === 2 ? 3 : 4;
        const elems: PatElem[] = [];
        for (let k = 0; k < n; k++) elems.push({ g: ag, moveFrac: 0, gapPhys: k ? GT.archGap : undefined, heart: 'low' });
        elems.push({ g: ch, moveFrac: 0, gapMul: 1.0, heart: 'arc' });
        return { elems, lead, warnH: 100 };
      }
      default:
        void H;
        return null;
    }
  }

  /**
   * 바닥 전기 띠 끝 가전 장식 — (261011 검증 스크린샷) 발판 위에 세운 세탁기·TV 가 흐리게 그려도 장애물처럼 보여
   * 오해를 부름 → 그리지 않는다(가전 매장 배경에 이미 가전이 있고, 띠 끝 불꽃·'징—'·경고 아이콘이 출처를 알려 줌).
   * 장식 경로(PlanDecor)는 남겨 둔다 — 다른 무해한 장식이 필요해지면 여기서 돌려주면 된다.
   */
  private applianceDecor(_endX: number): Array<{ x: number; def: WrObstacle; scale: number; dy: number }> {
    void _endX;
    return [];
  }

  /** 덩어리 배치 — 성공 true, 막히면 다시 시도할 커서, 못 하면 false */
  private placeGimmick(id: GimmickId, s: Sched, v: number, pad0: number): true | number | false {
    if (!this.gimReady(id)) return false;
    const pat = this.buildPattern(id, s, v, pad0);
    if (!pat) return false;
    const lap = this.ctx.lap;
    const first = !this.seen.has(id);
    const pad = pad0 + (first ? 0.15 : 0);
    const gi = this.gi++;
    const def = GIMMICKS[id];
    // 연쇄(2바퀴~ 환경형 뒤) — 받을 환경이 아직 있으면 그 안에서. 바람 속 점프는 체공이 길어(중력 ×0.78) 간격도 그 기준으로
    const host = s.chainEnv && this.host && this.host.kind === s.chainEnv && this.host.left > 0 ? this.host : null;
    if (host?.kind === 'wind') for (const e of pat.elems) if (e.g.action === 'jump') e.gA = GT.windG;

    // 요소 없는 환경형(정전 단독)
    if (pat.envOnly) {
      const x0 = Math.max(this.cursor + pat.envOnly.pre * v, this.lastPitEnd + (pat.envOnly.pre + DARK_GUARD_SEC + 0.2) * v, (this.last?.meetX ?? -Infinity) + 0.4 * v);
      const x1 = x0 + pat.envOnly.dur * v;
      const from = x0 - pat.envOnly.pre * v - 0.1 * v;
      const q = overlapQuiet(this.noGim, from, x1 + 0.3 * v) ?? overlapQuiet(this.zones, from, x1 + 0.3 * v);
      if (q != null) return x0 + (q + 1 - from) - pat.envOnly.pre * v;
      // (261011 검증 low '환경형 2개 동시 금지') 다른 환경 구간(바람·난기류·플래시·정전)과 겹치면 뒤로
      const qe = this.envBusy(from, x1 + GT.blackoutPost * v);
      if (qe != null) return x0 + (qe + 0.1 * v - from) - pat.envOnly.pre * v;
      const env = this.commitEnv(gi, id, pat.envOnly.kind, x0, x1, v);
      this.warns.push({ id: this.id++, gi, gim: id, x: x0 - pat.envOnly.pre * v, contactX: x0, kind: 'none', h: 0, sound: def.sound, fired: false, first });
      this.seen.add(id);
      if (id === 'blackout' && !s.chainEnv) this.soloBlackoutLap = lap;
      this.bumpEnv(s.seg);
      this.gimLog.push({ gi, gim: id, lap, seg: s.seg, warnX: x0 - pat.envOnly.pre * v, contactX: x0, endX: x1, n: 0, env: 'blackout', chained: !!s.chainEnv, forced: s.forced });
      this.cursor = Math.max(this.cursor, x0 + 1);
      this.startHost(gi, 'blackout', env, s, x0);
      return true;
    }

    // 위치: 첫 요소 = 앞 장애물 → 첫 요소 minGap, 그 뒤 요소마다 minGap(또는 물리 간격·박자)
    const cx: number[] = [];
    let prev: Last | null = this.last;
    for (let i = 0; i < pat.elems.length; i++) {
      const e = pat.elems[i];
      const need: Need = { action: e.g.action, w: e.g.w, top: e.g.hit.t, moveFrac: e.moveFrac, wp: PLAYER_HIT_MAX_W };
      let x: number;
      if (i === 0) {
        x = this.cursor;
        if (prev) {
          x = Math.max(x, prev.meetX + minGapSec(prev, need, v, pad) * v * Math.max(1.05, e.gapMul ?? 1.05));
          x = Math.max(x, prev.spawnX + e.g.drawW / 2 + 40);
        }
      } else {
        const p = cx[i - 1];
        if (e.gapPhys != null) x = p + e.gapPhys / (1 + e.moveFrac);
        else {
          x = p + Math.max(minGapSec(prev!, need, v, pad) * (e.gapMul ?? 1), e.gapSec ?? 0) * v;
          x = Math.max(x, prev!.spawnX + e.g.drawW / 2 + 40);
        }
      }
      cx.push(x);
      prev = this.recOf(e, x, v);
    }
    const lastCx = cx[cx.length - 1];
    const lead = pat.lead;
    const e0 = pat.elems[0];
    // (261011 검증 low '긴 기믹은 첫 접촉까지 예고가 더 짧음') 예고는 '첫 요소 가운데'가 아니라 '플레이어 앞끝이 첫 요소 앞끝에 닿는 때' 기준
    //   → 바닥 전기(길이 ≈ 0.78초)·꽃 아치처럼 긴 요소도 접촉 lead 초 전에 예고
    const reach0 = (e0.g.w / 2 + PLAYER_HIT_MAX_W / 2) / (v * (1 + e0.moveFrac));
    const warnX = cx[0] - (lead + reach0) * v;
    const envs = pat.env ? pat.env(cx, v) : [];
    let to = lastCx + 0.5 * v;
    let from = warnX - 0.15 * v;
    for (const e of envs) {
      to = Math.max(to, e.x1 + 0.3 * v);
      from = Math.min(from, e.x0 - (e.kind === 'blackout' ? GT.blackoutPre : 0.2) * v);
    }
    if (pat.beats) for (const b of pat.beats(cx, v)) from = Math.min(from, b - 0.1 * v);
    // 요소가 차지하는 범위(첫 요소 앞끝 − 0.35초 ~ 끝) — 안전 구간(이벤트 연출)은 요소만 피하면 됨, 예고는 겹쳐도 됨
    const elemFrom = cx[0] - (e0.g.w / 2 + PLAYER_HIT_MAX_W / 2) / (1 + e0.moveFrac) - 0.35 * v;
    let envFrom = Infinity;
    for (const e of envs) envFrom = Math.min(envFrom, e.x0 - (e.kind === 'blackout' ? GT.blackoutPre : 0.2) * v);
    const titleFrom = pat.titleOk ? Math.min(elemFrom, envFrom) : from;
    // 맵 제목 시간·안전 구간과 겹치면 뒤로
    // (돌려주는 값 = 첫 요소가 그만큼 뒤로 가도록 하는 '일정 자리')
    const qt = overlapQuiet(this.noGim, titleFrom, to);
    if (qt != null) return cx[0] + (qt + 1 - titleFrom);
    const qFrom = Math.min(elemFrom, envFrom);
    const q = overlapQuiet(this.zones, qFrom, to);
    if (q != null) return cx[0] + (q + 1 - qFrom);
    // 그림자 신호 기믹은 정전·플래시 앞뒤 금지
    if (SHADOW_SIGNAL.has(id)) {
      const qd = overlapQuiet(this.darkZ, from, to);
      if (qd != null) return cx[0] + (qd + 1 - from);
    }
    // (261011 검증 low '환경형 2개 동시 금지' — 바닥 전기 뒤 정전 + 드라이어 바람이 통째로 겹침) 환경형 기믹(바람·난기류·플래시)은
    // 다른 환경 구간과 겹치면 뒤로, 바닥 전기의 정전은 겹치면 빼고 놓는다
    if (def.env && envs.length) {
      const qe = this.envBusy(envFrom, to);
      if (qe != null) return cx[0] + (qe + 0.1 * v - envFrom);
    }
    // 정전 구간 앞뒤에 이미 놓인 바닥 틈이 있으면(드묾)·다른 환경 구간과 겹치면 정전은 빼고 놓는다
    const envOk = envs.filter((e) => {
      if (e.kind !== 'blackout' && e.kind !== 'flash') return true;
      // 연쇄(이미 다른 환경 안)로 놓이는 바닥 전기는 정전을 따로 켜지 않는다(환경형 2개 동시 금지)
      if (s.chainEnv) return false;
      if (this.pits.some((p) => p.x1 > e.x0 - (GT.blackoutPre + DARK_GUARD_SEC) * v && p.x0 < e.x1 + DARK_GUARD_SEC * v)) return false;
      if (!def.env && this.envBusy(e.x0 - GT.blackoutPre * v - 0.2 * v, e.x1 + GT.blackoutPost * v + 0.3 * v) != null) return false;
      return true;
    });

    // 연쇄가 실제로 환경 안에서 일어나나 — 앞 환경(또는 앞 연쇄) 마지막 요소 바로 뒤일 때만(사이에 보통 장애물이 끼면 그 점프는 바람 계산이 아님)
    let overlap = false;
    let windX1 = -Infinity;
    if (host && host.env && this.last === host.lastRef) {
      const he = host.env;
      if (host.kind === 'wind' || host.kind === 'turb') {
        // 바람은 마지막 '점프' 요소 + 0.3초까지만(그 뒤 일반 장애물 이륙이 바람 속이 되지 않게 — 원래 바람 구간과 같은 규칙).
        // 연쇄 점프 요소는 모두 바람 체공(gA)으로 간격을 잡았으므로 그 사이 이륙은 바람 속이어도 공정하다
        let lastJump = -Infinity;
        pat.elems.forEach((e, i) => {
          if (e.g.action === 'jump') lastJump = cx[i];
        });
        windX1 = host.kind === 'wind' ? (lastJump > -Infinity ? lastJump + 0.3 * v : cx[0] - 0.4 * v) : lastCx + 0.35 * v;
        overlap = Math.max(he.x1, windX1) <= host.maxX1;
      } else if (host.kind === 'blackout') {
        overlap = cx.some((x) => x >= he.x0 && x <= he.x1);
      } else if (host.kind === 'flash') {
        const fx0 = cx[0] - GT.flashAt * v;
        const fx1 = cx[0] - (GT.flashAt - GT.flashDur) * v;
        overlap = !this.pits.some((p) => p.x1 > fx0 - DARK_GUARD_SEC * v && p.x0 < fx1 + DARK_GUARD_SEC * v);
      }
    }

    // 확정
    const ids: number[] = [];
    pat.elems.forEach((e, i) => {
      const x = cx[i];
      const o: PlanObs = {
        kind: 'obs',
        id: this.id++,
        g: e.g,
        seg: segmentAt(x - this.ctx.lapStartX),
        meetX: x,
        moveFrac: e.motion ? motionEndM(e.motion) : e.moveFrac,
        spawned: false,
        gim: id,
        gi,
        first: i === 0,
        motion: e.motion,
        vPlan: v,
        sTab: e.motion ? motionTable(e.motion) : undefined,
        practice: e.practice,
        text: e.text,
        marks: e.marks,
        hint: (i === 0 && first) || e.practice ? GIMMICK_HINT[id] : undefined,
      };
      this.obs.push(o);
      ids.push(o.id);
      this.stats.obs++;
      switch (e.heart) {
        case 'arc':
          if (this.rng() < 0.6) this.arc(x, v, this.rng() < 0.5 ? 3 : 5, this.rng() < 0.12);
          break;
        case 'low':
          if (this.rng() < 0.6) this.lowRow(x);
          break;
        case 'dj':
          this.djArc(x, e.g.w, v, e.practice === true || this.rng() < 0.25);
          break;
        default:
          break;
      }
    });
    const committed: PlanEnv[] = [];
    for (const e of envOk) committed.push(this.commitEnv(gi, id, e.kind, e.x0, e.x1, v));
    if (pat.decor) for (const dc of pat.decor(cx, v)) this.decor.push({ id: this.id++, x: dc.x, def: dc.def, scale: dc.scale, dy: dc.dy, spawned: false });
    this.warns.push({
      id: this.id++,
      gi,
      gim: id,
      x: warnX,
      contactX: cx[0],
      kind: def.warnKind,
      h: pat.warnH,
      sound: def.sound,
      fired: false,
      first,
      tutorial: pat.tutorial,
      obsId: ids[0],
      beats: pat.beats ? pat.beats(cx, v) : undefined,
      beatSound: pat.beatSound,
    });
    this.seen.add(id);
    if (def.env) this.bumpEnv(s.seg);
    // 연쇄: 바람·난기류 구간을 늘리고, 플래시는 이 기믹 첫 요소 0.9초 전에 한 번 더(연사)
    if (host) {
      host.left--;
      if (overlap && host.env) {
        if (host.kind === 'wind' || host.kind === 'turb') host.env.x1 = Math.max(host.env.x1, windX1);
        else if (host.kind === 'flash') this.commitEnv(host.gi, host.env.gim, 'flash', cx[0] - GT.flashAt * v, cx[0] - (GT.flashAt - GT.flashDur) * v, v);
      }
      host.lastRef = prev;
      if (host.left <= 0) this.host = null;
    }
    this.gimLog.push({ gi, gim: id, lap, seg: s.seg, warnX, contactX: cx[0], endX: lastCx, n: cx.length, env: def.env ?? undefined, chained: !!s.chainEnv, overlap, practice: s.opt === 'practice', forced: s.forced });
    this.last = prev;
    this.cursor = lastCx + 1;
    this.comboLeft = 0;
    this.obs.sort((a, b) => a.meetX - b.meetX);
    // 2바퀴~ 환경형이면 연쇄를 받기 시작(바닥 전기 + 정전도 정전 환경으로)
    if (!s.chainEnv) {
      const hostEnv = committed.find((e) => e.kind === def.env) ?? committed.find((e) => e.kind === 'blackout');
      if (hostEnv) this.startHost(gi, hostEnv.kind, hostEnv, s, hostEnv.x0);
    }
    return true;
  }

  /** 2바퀴~ 환경형 기믹이 놓였을 때 — 뒤 연쇄 기믹을 그 환경 안으로 받는다(trySchedule 이 일정을 당겨 옴) */
  private startHost(gi: number, kind: EnvKind, env: PlanEnv, s: Sched, x0: number) {
    const n = this.ctx.lap >= 2 && !s.chainEnv && !s.forced ? envChain(this.ctx.lap) : 0;
    if (n <= 0) return;
    // lastRef = 지금 '앞 장애물'(this.last) — 연쇄가 바로 뒤에 붙을 때만(사이에 보통 장애물이 끼지 않을 때만) 환경을 늘린다
    this.host = { gi, kind, env, left: n, maxX1: x0 + HOST_MAX_SEC[kind] * env.v, lastRef: this.last };
    this.justHosted = true;
  }

  /** [a, b] 와 겹치는 환경 구간(앞뒤 여유 포함)이 있으면 그 끝, 없으면 null */
  private envBusy(a: number, b: number): number | null {
    let end: number | null = null;
    for (const e of this.envs) {
      const pre = (e.kind === 'blackout' ? GT.blackoutPre : 0.2) * e.v;
      const post = (e.kind === 'blackout' ? GT.blackoutPost + 0.3 : 0.3) * e.v;
      if (e.x1 + post >= a && e.x0 - pre <= b) end = Math.max(end ?? -Infinity, e.x1 + post);
    }
    return end;
  }

  private bumpEnv(seg: number) {
    const key = this.ctx.lap * 100 + seg;
    this.envCount.set(key, (this.envCount.get(key) ?? 0) + 1);
  }

  private commitEnv(gi: number, gim: GimmickId, kind: EnvKind, x0: number, x1: number, v: number): PlanEnv {
    const env: PlanEnv = { id: this.id++, gi, gim, kind, x0, x1, v, lap: this.ctx.lap };
    this.envs.push(env);
    this.envs.sort((a, b) => a.x0 - b.x0);
    if (kind === 'blackout' || kind === 'flash') {
      const pre = kind === 'blackout' ? GT.blackoutPre : 0;
      this.darkZ.push([x0 - (pre + DARK_GUARD_SEC) * v, x1 + DARK_GUARD_SEC * v]);
      this.darkZ.sort((a, b) => a[0] - b[0]);
    }
    return env;
  }

  /** 지나간 계획 정리 */
  prune(beforeX: number) {
    if (this.obs.length && this.obs[0].meetX < beforeX) this.obs = this.obs.filter((o) => o.meetX >= beforeX || !o.spawned);
    if (this.pits.length && this.pits[0].x1 < beforeX - 2000) this.pits = this.pits.filter((p) => p.x1 >= beforeX - 2000);
    if (this.items.length && this.items[0].x < beforeX) this.items = this.items.filter((it) => it.x >= beforeX || !it.spawned);
    if (this.envs.length && this.envs[0].x1 < beforeX - 1000) this.envs = this.envs.filter((e) => e.x1 >= beforeX - 1000);
    if (this.warns.length && this.warns[0].contactX < beforeX - 1000) this.warns = this.warns.filter((w) => w.contactX >= beforeX - 1000);
    if (this.decor.length && this.decor[0].x < beforeX - 600) this.decor = this.decor.filter((d) => d.x >= beforeX - 600 || !d.spawned);
    if (this.darkZ.length && this.darkZ[0][1] < beforeX - 2000) this.darkZ = this.darkZ.filter((z) => z[1] >= beforeX - 2000);
  }

  /** 월드 x 에 바닥이 있나(틈 가장자리 관대) */
  pitAt(x: number): PlanPit | null {
    for (const p of this.pits) {
      if (p.x0 > x) break;
      if (x > p.x0 + PIT_EDGE_GRACE && x < p.x1 - PIT_EDGE_GRACE) return p;
    }
    return null;
  }

  /** 월드 x 의 환경형 구간 */
  envAt(x: number, kind?: EnvKind): PlanEnv | null {
    for (const e of this.envs) if ((!kind || e.kind === kind) && x >= e.x0 && x <= e.x1) return e;
    return null;
  }
}
