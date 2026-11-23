/* 슈트패브릭 'Freetiful Fight' 시뮬레이션(261123 사장 '진짜 싸우는 느낌이 아닌데 잘 구현해줘').
 *  · 참가자 전원이 하늘에서 떨어져 입장 → 서로 쫓아가 잽 · 발차기 · 어퍼컷을 주고받는 난투(체력 · 가드 · 다운 · K.O. 날아감)
 *    → 두 명 남으면 FINAL ROUND(격투 게임 1:1, 콤보 · 가드 · 맞부딪힘 · 장풍 · 어퍼컷 다운) → 마지막 일격 슬로모션 K.O.
 *  · 시드만으로 정해지는 결정적 계산(같은 시드면 같은 싸움). 누가 이기는지는 '자리(slot)'로만 정해지고,
 *    부르는 쪽(FightArena)이 서버가 이미 뽑아 둔 당첨 응모권을 이긴 자리에 앉힌다 — 연출이 당첨을 바꾸지 않는다.
 *  · 시간표(fightTimeline)는 인원으로만 정해진다 → 연출 길이(fightDurationMs)를 미리 알 수 있다(draw-reveal 이 씀).
 *  · 난투는 '남은 인원 목표 곡선'을 따라가게 피해 배율을 조절하고, 싸움 구역을 가운데로 좁혀 마지막 둘이 꼭 만나게 한다. */

export const FIGHT_HZ = 30;
const DT = 1 / FIGHT_HZ;
export const ARENA_W = 1600;
export const ARENA_D = 200;
const MID = ARENA_W / 2;

/** 자세 — 그리는 쪽이 기울기 · 효과를 고른다 */
export const POSE = { idle: 0, walk: 1, windup: 2, strike: 3, recover: 4, hit: 5, block: 6, down: 7, ko: 8, win: 9, enter: 10, charge: 11 } as const;
/** 기술 */
export const MOVE = { jab: 0, kick: 1, upper: 2, wave: 3 } as const;
export const MOVE_LABEL = ['잽', '발차기', '어퍼컷', '장풍'] as const;

/** 한 칸(틱 · 사람)마다 적는 값: x, z(깊이), h(공중 높이), hp, 자세, 자세 진행(0~1), 보는 쪽(±1), 보임(0~1), 번쩍임(0~1), 기술 */
export const FIGHT_STRIDE = 10;

export type FightTimeline = {
  /** FIGHT! — 난투 시작 */
  fight: number;
  /** 두 명 남기를 바라는 때(난투 목표) */
  duelAt: number;
  /** FINAL ROUND 걸어 나오는 시간 */
  walk: number;
  /** 마지막 일격(K.O.) */
  ko: number;
  end: number;
  slowFrom: number;
  slowTo: number;
  /** 슬로모션 배속(0.3 = 0.3배) */
  slow: number;
};

export function fightTimeline(n: number): FightTimeline {
  const count = Math.max(1, Math.floor(n));
  const fight = 2.6;
  if (count === 1) return { fight, duelAt: fight, walk: 0, ko: fight + 0.4, end: fight + 3.4, slowFrom: fight + 0.4, slowTo: fight + 0.4, slow: 1 };
  const melee = count <= 2 ? 0 : Math.min(15.5, 1.5 + 2.9 * Math.log(count));
  const duelAt = fight + melee;
  const walk = count <= 2 ? 0.6 : 1.3;
  const duel = count <= 2 ? 7 : Math.max(5.5, Math.min(7, 5 + 0.35 * Math.log(count)));
  const ko = duelAt + walk + duel;
  return { fight, duelAt, walk, ko, end: ko + 3.2, slowFrom: ko - 0.5, slowTo: ko + 0.3, slow: 0.3 };
}

/** 실제로 화면에 걸리는 길이(ms) — 슬로모션만큼 늘어난다 */
export function fightDurationMs(n: number) {
  const tl = fightTimeline(n);
  return Math.round((tl.end + (tl.slowTo - tl.slowFrom) * (1 / tl.slow - 1)) * 1000);
}

/** 화면 시각(초) → 시뮬레이션 시각(초) — K.O. 앞뒤만 느리게 */
export function fightSimTime(real: number, tl: FightTimeline) {
  if (real <= tl.slowFrom || tl.slow >= 1) return Math.min(real, tl.end);
  const slowReal = (tl.slowTo - tl.slowFrom) / tl.slow;
  if (real <= tl.slowFrom + slowReal) return tl.slowFrom + (real - tl.slowFrom) * tl.slow;
  return Math.min(tl.end, real - slowReal + (tl.slowTo - tl.slowFrom));
}

export type FightEvent =
  | { type: 'hit'; s: number; x: number; z: number; h: number; kind: number; heavy: boolean; blocked: boolean; dmg: number; a: number; d: number; final?: boolean }
  | { type: 'clash'; s: number; x: number; z: number; h: number; a: number; d: number }
  | { type: 'ko'; s: number; x: number; z: number; a: number; d: number; left: number }
  | { type: 'land'; s: number; x: number; z: number; big: boolean }
  | { type: 'wave'; s: number; s1: number; x0: number; x1: number; z: number; a: number; d: number };

export type FightSim = {
  n: number;
  ticks: number;
  tl: FightTimeline;
  frames: Float32Array;
  /** 틱마다 카메라 cx, cy, 보이는 폭(span) */
  cam: Float32Array;
  /** 틱마다 남은 사람 */
  alive: Uint16Array;
  events: FightEvent[];
  art: Uint8Array;
  winner: number;
  /** 결승 두 자리(왼쪽, 오른쪽) — 혼자면 null */
  finalists: [number, number] | null;
  /** 두 명 남은 시각(초) */
  duelStart: number;
  /** 탈락 순서(자리) */
  koOrder: number[];
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const smoothstep = (t: number) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };

// 난투 기술 — 거리 · 준비 · 마무리 · 피해
const REACH = [40, 52, 36, 0];
const WINDUP = [0.16, 0.26, 0.3, 0];
const RECOVER = [0.2, 0.3, 0.36, 0];
const BASE_DMG = [7, 11, 15, 0];

type Fighter = {
  x: number; z: number; h: number; vh: number; kx: number;
  hp: number; alive: boolean; pose: number; st: number; dur: number; face: number;
  target: number; retarget: number; cool: number; kind: number; atk: number; flash: number;
  koAt: number; dropAt: number; landed: boolean; speed: number; aggr: number; guard: number;
  walkPhase: number; alpha: number; bounced: boolean;
};

/** 결승 연출 한 조각(초 단위 · 결승 자리 0 = 왼쪽, 1 = 오른쪽) */
type Seg = { s0: number; s1: number; who: 0 | 1; pose: number; kind: number };
type Key = { s: number; x: number };
type Air = { s0: number; s1: number; who: 0 | 1; peak: number };
type DuelHit = { s: number; d: 0 | 1; dmg: number; kind: number; heavy: boolean; blocked: boolean; final?: boolean; clash?: boolean; h: number };

export function simulateFight(count: number, seed: number): FightSim {
  const n = Math.max(1, Math.floor(count));
  const tl = fightTimeline(n);
  const ticks = Math.ceil(tl.end * FIGHT_HZ) + 2;
  const rnd = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const frames = new Float32Array(ticks * n * FIGHT_STRIDE);
  const cam = new Float32Array(ticks * 3);
  const aliveAt = new Uint16Array(ticks);
  const events: FightEvent[] = [];
  const koOrder: number[] = [];
  const art = new Uint8Array(n);
  const artShift = seed % 15;
  for (let i = 0; i < n; i++) art[i] = (i * 7 + artShift) % 15;

  // 입장 자리 — 넓은 무대에 흩어 세운다(자리 순서는 섞어서)
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const cols = n <= 2 ? n : Math.max(1, Math.ceil(Math.sqrt(n * ((ARENA_W - 200) / ARENA_D) * 0.85)));
  const rows = Math.ceil(n / cols);
  const F: Fighter[] = Array.from({ length: n }, () => null as unknown as Fighter);
  order.forEach((slot, k) => {
    const col = k % cols;
    const row = Math.floor(k / cols);
    const inRow = Math.min(cols, n - row * cols);
    const width = n <= 2 ? 300 : ARENA_W - 200;
    const x = n === 1 ? MID : MID - width / 2 + ((col + 0.5) * width) / inRow + (n > 2 ? (rnd() - 0.5) * (width / inRow) * 0.5 : 0);
    const z = n <= 2 ? ARENA_D / 2 : ((row + 0.5) * ARENA_D) / rows + (rnd() - 0.5) * (ARENA_D / rows) * 0.4;
    F[slot] = {
      x, z, h: 360, vh: 0, kx: 0, hp: 100, alive: true, pose: POSE.enter, st: 0, dur: 0, face: x < MID ? 1 : -1,
      target: -1, retarget: 0, cool: rnd() * 0.6, kind: 0, atk: -1, flash: 0, koAt: -1,
      dropAt: n <= 2 ? 0.5 + k * 0.35 : 0.15 + rnd() * 1.7, landed: false,
      speed: 95 + rnd() * 45, aggr: 0.8 + rnd() * 0.5, guard: 0.12 + rnd() * 0.18, walkPhase: rnd(), alpha: 0, bounced: false,
    };
  });

  let alive = n;
  let dmgMul = 1;
  let duelStart = n <= 2 ? tl.fight : -1;
  let finalists: [number, number] | null = null;
  let winnerSide: 0 | 1 = rnd() < 0.5 ? 0 : 1;
  let camX = MID, camY = ARENA_D / 2 - 40, camSpan = ARENA_W + 150;

  // 결승 연출(두 명 남은 뒤 한 번 짠다)
  let segs: Seg[] = [];
  const keys: [Key[], Key[]] = [[], []];
  let airs: Air[] = [];
  let duelHits: DuelHit[] = [];
  let duelHitAt = 0;
  let duelZ = ARENA_D / 2;
  let koDone = false;

  const rollKind = () => { const r = rnd(); return r < 0.52 ? MOVE.jab : r < 0.84 ? MOVE.kick : MOVE.upper; };

  const knockOut = (d: Fighter, di: number, ai: number, s: number, power: number, up: number) => {
    d.hp = 0; d.alive = false; d.pose = POSE.ko; d.st = 0; d.koAt = s;
    const dir = ai >= 0 ? Math.sign(d.x - F[ai].x) || F[ai].face : (d.x < MID ? -1 : 1);
    d.kx = dir * power; d.vh = up; d.face = -dir; d.flash = 1; d.bounced = false;
    alive--;
    koOrder.push(di);
    events.push({ type: 'ko', s, x: d.x, z: d.z, a: ai, d: di, left: alive });
  };

  const planDuel = (s: number) => {
    const pair = F.map((f, i) => i).filter((i) => F[i].alive);
    pair.sort((a, b) => F[a].x - F[b].x);
    finalists = [pair[0], pair[1]];
    if (n === 2 && F[pair[0]].x === F[pair[1]].x) F[pair[1]].x += 1;
    duelStart = s;
    for (const i of pair) { const f = F[i]; f.hp = 100; f.kx = 0; f.vh = 0; f.h = 0; f.flash = 0; }
    duelZ = clamp((F[pair[0]].z + F[pair[1]].z) / 2, 60, ARENA_D - 60);
    const c0 = clamp((F[pair[0]].x + F[pair[1]].x) / 2, MID - 260, MID + 260);
    const t0 = s;
    const start = s + tl.walk;
    // 걸어 나와 마주 서기
    keys[0] = [{ s: t0, x: F[pair[0]].x }, { s: start, x: c0 - 80 }];
    keys[1] = [{ s: t0, x: F[pair[1]].x }, { s: start, x: c0 + 80 }];
    segs = []; airs = []; duelHits = []; duelHitAt = 0;
    const W = winnerSide;
    const L = (1 - W) as 0 | 1;
    const finalDur = 1.15;
    const span = Math.max(2, tl.ko - finalDur - start);
    // 주고받기 목록 — 앞은 지는 쪽이 몰아붙이고, 뒤는 이기는 쪽 역전
    type Ex = { type: 'combo' | 'kick' | 'block' | 'clash' | 'wave' | 'upper'; att: 0 | 1; dur: number };
    const list: Ex[] = [];
    let used = 0;
    let waves = 0;
    while (used < span - 0.6) {
      const part = used / span;
      const att: 0 | 1 = rnd() < (part < 0.42 ? 0.35 : part < 0.7 ? 0.5 : 0.75) ? W : L;
      const r = rnd();
      let type: Ex['type'] = r < 0.3 ? 'combo' : r < 0.5 ? 'kick' : r < 0.64 ? 'block' : r < 0.76 ? 'clash' : r < 0.88 ? 'upper' : 'wave';
      if (type === 'wave' && waves >= 2) type = 'combo';
      if (type === 'wave') waves++;
      const dur = type === 'upper' ? 1.55 : type === 'wave' ? 1.05 : 0.85 + rnd() * 0.25;
      if (used + dur > span) break;
      list.push({ type, att, dur });
      used += dur;
    }
    // 남은 시간은 고르게 나눠 붙인다
    const pad = list.length ? (span - used) / list.length : 0;
    // 피해 — 지는 쪽은 마지막 일격 전에 (100 - finalBlow), 이기는 쪽은 (100 - 남길 체력)
    const finalBlow = 14 + Math.floor(rnd() * 12);
    const winnerLeft = 18 + Math.floor(rnd() * 34);
    const raw: { ex: number; d: 0 | 1; w: number }[] = [];
    list.forEach((e, k) => {
      const d = (1 - e.att) as 0 | 1;
      if (e.type === 'combo') { raw.push({ ex: k, d, w: 4 }, { ex: k, d, w: 4 }, { ex: k, d, w: 6 }); }
      else if (e.type === 'kick') raw.push({ ex: k, d, w: 10 });
      else if (e.type === 'block') raw.push({ ex: k, d, w: 1 });
      else if (e.type === 'clash') { raw.push({ ex: k, d: 0, w: 2 }, { ex: k, d: 1, w: 2 }); }
      else if (e.type === 'upper') raw.push({ ex: k, d, w: 15 });
      else raw.push({ ex: k, d, w: 12 });
    });
    const sumL = raw.filter((h) => h.d === L).reduce((t, h) => t + h.w, 0) || 1;
    const sumW = raw.filter((h) => h.d === W).reduce((t, h) => t + h.w, 0) || 1;
    const scaleL = (100 - finalBlow) / sumL;
    const scaleW = (100 - winnerLeft) / sumW;
    const dmgQueue = raw.map((h) => ({ ...h, dmg: h.w * (h.d === L ? scaleL : scaleW) }));
    let qi = 0;
    const take = () => dmgQueue[qi++]?.dmg ?? 1;
    // 마지막 일격 전에 지는 쪽이 이미 0 이 되지 않게(반올림) — 마지막 일격 피해가 남은 체력 전부
    const pos: [number, number] = [c0 - 80, c0 + 80];
    let cursor = start;
    const xOf = (who: 0 | 1) => pos[who];
    const keyAt = (who: 0 | 1, s1: number, x: number) => { keys[who].push({ s: s1, x }); pos[who] = x; };
    const seg = (who: 0 | 1, s0: number, s1: number, pose: number, kind = 0) => segs.push({ s0, s1, who, pose, kind });
    const hitAt = (hs: number, d: 0 | 1, kind: number, heavy: boolean, blocked: boolean, h: number, dmg: number, extra?: Partial<DuelHit>) =>
      duelHits.push({ s: hs, d, dmg, kind, heavy, blocked, h, ...extra });
    const neutral = (c: number, s1: number) => { keyAt(0, s1, c - 80); keyAt(1, s1, c + 80); };
    const dirOf = (who: 0 | 1) => (who === 0 ? 1 : -1);

    list.forEach((e) => {
      const dur = e.dur + pad;
      const a = e.att;
      const d = (1 - a) as 0 | 1;
      const fa = dirOf(a);
      const t = cursor;
      keyAt(0, t, xOf(0)); keyAt(1, t, xOf(1));
      if (e.type === 'combo') {
        keyAt(a, t + 0.26, xOf(d) - fa * 58);
        const hits = [0.32, 0.47, 0.64];
        hits.forEach((u, k) => {
          seg(a, t + u - 0.05, t + u, POSE.windup, MOVE.jab);
          seg(a, t + u, t + u + 0.09, POSE.strike, MOVE.jab);
          seg(d, t + u, t + u + 0.13, POSE.hit, MOVE.jab);
          hitAt(t + u, d, MOVE.jab, k === 2, false, 46, take());
          keyAt(d, t + u + 0.1, xOf(d) + fa * 9);
          keyAt(a, t + u + 0.1, xOf(a) + fa * 9);
        });
        seg(a, t + 0.73, t + 0.85, POSE.recover, MOVE.jab);
      } else if (e.type === 'kick' || e.type === 'block') {
        keyAt(a, t + 0.26, xOf(d) - fa * 68);
        seg(a, t + 0.26, t + 0.42, POSE.windup, MOVE.kick);
        seg(a, t + 0.42, t + 0.52, POSE.strike, MOVE.kick);
        seg(a, t + 0.52, t + 0.72, POSE.recover, MOVE.kick);
        if (e.type === 'block') {
          seg(d, t + 0.36, t + 0.62, POSE.block, MOVE.kick);
          hitAt(t + 0.42, d, MOVE.kick, false, true, 36, take());
          keyAt(d, t + 0.6, xOf(d) + fa * 26);
        } else {
          seg(d, t + 0.42, t + 0.72, POSE.hit, MOVE.kick);
          hitAt(t + 0.42, d, MOVE.kick, true, false, 34, take());
          keyAt(d, t + 0.62, xOf(d) + fa * 46);
        }
      } else if (e.type === 'clash') {
        const mid = (xOf(0) + xOf(1)) / 2;
        keyAt(0, t + 0.24, mid - 34); keyAt(1, t + 0.24, mid + 34);
        seg(0, t + 0.24, t + 0.38, POSE.windup, MOVE.jab); seg(1, t + 0.24, t + 0.38, POSE.windup, MOVE.jab);
        seg(0, t + 0.38, t + 0.48, POSE.strike, MOVE.jab); seg(1, t + 0.38, t + 0.48, POSE.strike, MOVE.jab);
        seg(0, t + 0.48, t + 0.7, POSE.hit, MOVE.jab); seg(1, t + 0.48, t + 0.7, POSE.hit, MOVE.jab);
        const d0 = take(); const d1 = take();
        hitAt(t + 0.38, 0, MOVE.jab, true, true, 48, d0, { clash: true });
        hitAt(t + 0.38, 1, MOVE.jab, true, true, 48, d1, { clash: true });
        keyAt(0, t + 0.6, mid - 70); keyAt(1, t + 0.6, mid + 70);
      } else if (e.type === 'wave') {
        seg(a, t, t + 0.36, POSE.charge, MOVE.wave);
        seg(a, t + 0.36, t + 0.52, POSE.strike, MOVE.wave);
        seg(a, t + 0.52, t + 0.7, POSE.recover, MOVE.wave);
        seg(d, t + 0.64, t + 0.9, POSE.hit, MOVE.wave);
        events.push({ type: 'wave', s: t + 0.36, s1: t + 0.64, x0: xOf(a) + fa * 30, x1: xOf(d) - fa * 6, z: duelZ, a: finalists![a], d: finalists![d] });
        hitAt(t + 0.64, d, MOVE.wave, true, false, 46, take());
        keyAt(d, t + 0.84, xOf(d) + fa * 38);
      } else {
        keyAt(a, t + 0.24, xOf(d) - fa * 54);
        seg(a, t + 0.24, t + 0.38, POSE.windup, MOVE.upper);
        seg(a, t + 0.38, t + 0.5, POSE.strike, MOVE.upper);
        seg(a, t + 0.5, t + 0.8, POSE.recover, MOVE.upper);
        seg(d, t + 0.38, t + 1.4, POSE.down, MOVE.upper);
        airs.push({ s0: t + 0.38, s1: t + 0.98, who: d, peak: 70 });
        hitAt(t + 0.38, d, MOVE.upper, true, false, 60, take());
        keyAt(d, t + 0.98, xOf(d) + fa * 80);
        keyAt(d, t + 1.4, xOf(d));
      }
      // 다시 거리 두기 — 가운데 쪽으로 천천히 돌아온다
      const c = clamp((xOf(0) + xOf(1)) / 2 * 0.7 + MID * 0.3, MID - 300, MID + 300);
      neutral(c, t + dur);
      cursor = t + dur;
    });
    // 마지막 일격 — 이기는 쪽 대시 · 잽 · 잽 · 슬로모션 어퍼컷
    const t = tl.ko - finalDur;
    const fa = dirOf(W);
    keyAt(0, t, xOf(0)); keyAt(1, t, xOf(1));
    keyAt(W, t + 0.3, xOf(L) - fa * 56);
    [0.38, 0.55].forEach((u) => {
      seg(W, t + u - 0.06, t + u, POSE.windup, MOVE.jab);
      seg(W, t + u, t + u + 0.09, POSE.strike, MOVE.jab);
      seg(L, t + u, t + u + 0.13, POSE.hit, MOVE.jab);
      hitAt(t + u, L, MOVE.jab, false, false, 46, finalBlow * 0.22);
      keyAt(L, t + u + 0.1, xOf(L) + fa * 7);
      keyAt(W, t + u + 0.1, xOf(W) + fa * 7);
    });
    seg(W, t + 0.7, tl.ko, POSE.windup, MOVE.upper);
    seg(W, tl.ko, tl.ko + 0.6, POSE.strike, MOVE.upper);
    seg(W, tl.ko + 0.6, tl.ko + 0.95, POSE.recover, MOVE.upper);
    hitAt(tl.ko, L, MOVE.upper, true, false, 62, 999, { final: true });
  };

  /** 결승 값 — 키 사이 부드럽게 */
  const keyX = (who: 0 | 1, s: number) => {
    const list = keys[who];
    if (!list.length) return 0;
    if (s <= list[0].s) return list[0].x;
    for (let k = 1; k < list.length; k++) {
      if (s <= list[k].s) {
        const a = list[k - 1], b = list[k];
        const span = b.s - a.s;
        return span <= 1e-6 ? b.x : a.x + (b.x - a.x) * smoothstep((s - a.s) / span);
      }
    }
    return list[list.length - 1].x;
  };

  const write = (tick: number) => {
    const base = tick * n * FIGHT_STRIDE;
    for (let i = 0; i < n; i++) {
      const f = F[i];
      const o = base + i * FIGHT_STRIDE;
      frames[o] = f.x; frames[o + 1] = f.z; frames[o + 2] = f.h; frames[o + 3] = f.hp;
      frames[o + 4] = f.pose;
      frames[o + 5] = f.pose === POSE.walk ? f.walkPhase % 1 : f.dur > 0 ? clamp(f.st / f.dur, 0, 1) : f.st;
      frames[o + 6] = f.face; frames[o + 7] = f.alpha; frames[o + 8] = f.flash; frames[o + 9] = f.kind;
    }
    cam[tick * 3] = camX; cam[tick * 3 + 1] = camY; cam[tick * 3 + 2] = camSpan;
    aliveAt[tick] = alive;
  };

  for (let tick = 0; tick < ticks; tick++) {
    const s = tick * DT;
    // 공통 — 번쩍임 · 밀림 · 공중
    for (let i = 0; i < n; i++) {
      const f = F[i];
      f.flash = Math.max(0, f.flash - DT * 5);
      if (s < f.dropAt) { f.alpha = 0; continue; }
      if (!f.landed) {
        const u = (s - f.dropAt) / 0.45;
        f.alpha = 1;
        f.h = Math.max(0, 360 * (1 - u) * (1 - u));
        if (u >= 1) {
          f.h = 0; f.landed = true; f.pose = POSE.idle; f.st = 0; f.dur = 0;
          events.push({ type: 'land', s, x: f.x, z: f.z, big: n <= 12 });
        }
        continue;
      }
      if (f.pose === POSE.ko) {
        f.st += DT;
        f.x += f.kx * DT;
        f.h += f.vh * DT;
        f.vh -= 1150 * DT;
        if (f.h <= 0) {
          f.h = 0;
          if (!f.bounced) { f.bounced = true; f.vh = Math.abs(f.vh) * 0.22; f.kx *= 0.45; events.push({ type: 'land', s, x: f.x, z: f.z, big: true }); }
          else { f.vh = 0; f.kx *= Math.pow(0.02, DT); }
        }
        f.x = clamp(f.x, 10, ARENA_W - 10);
        const isLoserOfFinal = finalists && koDone && (i === finalists[0] || i === finalists[1]);
        f.alpha = isLoserOfFinal ? 1 : 1 - clamp((s - f.koAt - 1.5) / 0.6, 0, 1);
        continue;
      }
    }

    if (s >= tl.fight && duelStart < 0) {
      // ── 난투 ──
      const p = clamp((s - tl.fight) / Math.max(0.5, tl.duelAt - tl.fight), 0, 1);
      // 목표 곡선은 조금 일찍(90%) 두 명에 닿게 — 막판 몇 명이 오래 끄는 걸 막는다
      const want = 2 + (n - 2) * Math.pow(Math.max(0, 1 - p / 0.9), 1.25);
      const err = (alive - want) / Math.max(1.2, want * 0.3);
      const goal = clamp(Math.exp(err * 1.1), 0.35, 14);
      dmgMul += (goal - dmgMul) * 0.12;
      const few = alive <= 5 && p > 0.6;
      const overtime = s > tl.duelAt + 0.4;
      if (overtime) dmgMul = 40;
      const hw = (ARENA_W / 2 - 60) + (200 - (ARENA_W / 2 - 60)) * Math.pow(p, 0.85);
      const lo = MID - hw, hi = MID + hw;
      const on = new Uint16Array(n);
      for (let i = 0; i < n; i++) if (F[i].alive && F[i].target >= 0) on[F[i].target]++;

      for (let i = 0; i < n; i++) {
        const f = F[i];
        if (!f.alive || !f.landed) continue;
        f.x += f.kx * DT;
        f.kx *= Math.pow(0.004, DT);
        if (f.h > 0 || f.vh !== 0) { f.h += f.vh * DT; f.vh -= 1150 * DT; if (f.h <= 0) { f.h = 0; f.vh = 0; } }
        f.st += DT;
        f.cool -= DT;
        f.retarget -= DT;
        if (f.pose === POSE.hit || f.pose === POSE.block || f.pose === POSE.down) {
          if (f.st >= f.dur) { f.pose = POSE.idle; f.st = 0; f.dur = 0; f.cool = Math.min(f.cool, 0.15); }
          continue;
        }
        if (f.pose === POSE.windup) {
          if (f.st < f.dur) continue;
          // 기술 맞히기
          f.pose = POSE.strike; f.st = 0; f.dur = 0.1;
          const d = F[f.atk];
          const kind = f.kind;
          if (d && d.alive && d.pose !== POSE.down && Math.abs(d.z - f.z) < 18 && (d.x - f.x) * f.face > -6 && Math.abs(d.x - f.x) < REACH[kind] + 14) {
            const facing = d.face === -f.face;
            const canGuard = (d.pose === POSE.idle || d.pose === POSE.walk) && facing;
            const blocked = canGuard && rnd() < d.guard * (few ? 0.5 : 1);
            const dmg = blocked ? 1 : BASE_DMG[kind] * dmgMul * (0.8 + rnd() * 0.4);
            const heavy = !blocked && kind !== MOVE.jab;
            events.push({ type: 'hit', s, x: d.x - f.face * 10, z: d.z, h: kind === MOVE.upper ? 56 : kind === MOVE.kick ? 34 : 46, kind, heavy, blocked, dmg, a: i, d: f.atk });
            d.flash = blocked ? 0.4 : 1;
            if (!blocked && d.hp - dmg <= 0 && alive > 2) {
              knockOut(d, f.atk, i, s, kind === MOVE.upper ? 230 : 300 + rnd() * 160, kind === MOVE.upper ? 520 : 260 + rnd() * 140);
            } else {
              d.hp = Math.max(1, d.hp - dmg);
              d.face = -f.face;
              d.st = 0;
              if (blocked) { d.pose = POSE.block; d.dur = 0.24; d.kx = f.face * 80; }
              else if (kind === MOVE.upper || (kind === MOVE.kick && rnd() < 0.28)) {
                d.pose = POSE.down; d.dur = 1.05; d.kx = f.face * 170; d.vh = kind === MOVE.upper ? 330 : 140;
              } else { d.pose = POSE.hit; d.dur = 0.24; d.kx = f.face * (kind === MOVE.kick ? 130 : 75); }
            }
          }
          continue;
        }
        if (f.pose === POSE.strike) {
          if (f.st >= f.dur) { f.pose = POSE.recover; f.st = 0; f.dur = RECOVER[f.kind] ?? 0.25; }
          continue;
        }
        if (f.pose === POSE.recover) {
          if (f.st >= f.dur) { f.pose = POSE.idle; f.st = 0; f.dur = 0; f.cool = (0.08 + rnd() * 0.42) / f.aggr * (few ? 0.5 : 1); f.kind = rollKind(); }
          continue;
        }
        // 생각하기 · 다가가기
        let T = f.target >= 0 ? F[f.target] : null;
        if (!T || !T.alive || f.retarget <= 0) {
          let best = -1, score = Infinity;
          for (let j = 0; j < n; j++) {
            if (j === i || !F[j].alive || !F[j].landed) continue;
            const sc = Math.abs(F[j].x - f.x) + 2.2 * Math.abs(F[j].z - f.z) + 55 * on[j] + rnd() * 25;
            if (sc < score) { score = sc; best = j; }
          }
          if (f.target >= 0 && on[f.target] > 0) on[f.target]--;
          f.target = best;
          if (best >= 0) on[best]++;
          f.retarget = 0.45 + rnd() * 0.6;
          T = best >= 0 ? F[best] : null;
        }
        if (!T) { f.pose = POSE.idle; continue; }
        const side = Math.sign(T.x - f.x) || f.face;
        const reach = REACH[f.kind];
        let wx = T.x - side * reach * 0.88;
        wx = clamp(wx, lo, hi);
        const dx = wx - f.x;
        const dz = T.z - f.z;
        const dist = Math.hypot(dx, dz * 1.5);
        f.face = side;
        const inRange = Math.abs(T.x - f.x) <= reach + 4 && Math.abs(T.x - f.x) >= reach * 0.45 && Math.abs(dz) < 10;
        if (inRange && f.cool <= 0 && T.pose !== POSE.down) {
          f.pose = POSE.windup; f.st = 0; f.dur = WINDUP[f.kind] * (0.85 + rnd() * 0.3); f.atk = f.target;
          continue;
        }
        const speed = f.speed * (overtime ? 1.6 : few ? 1.3 : 1);
        if (dist > 2) {
          const step = Math.min(dist, speed * DT);
          f.x += (dx / dist) * step;
          f.z += (dz / dist) * step * 0.7;
          f.walkPhase += step / 34;
          f.pose = POSE.walk;
        } else f.pose = POSE.idle;
        f.dur = 0;
        f.st = 0;
      }
      // 시간을 넘기면 — 체력 높은 둘만 남기고 정리(거의 안 일어남)
      if (overtime && alive > 2 && s > tl.duelAt + 1.2) {
        const rest = F.map((f, i) => i).filter((i) => F[i].alive).sort((a, b) => F[b].hp - F[a].hp);
        const victim = rest[rest.length - 1];
        const near = rest.slice(0, -1).sort((a, b) => Math.abs(F[a].x - F[victim].x) - Math.abs(F[b].x - F[victim].x))[0];
        events.push({ type: 'hit', s, x: F[victim].x, z: F[victim].z, h: 46, kind: MOVE.kick, heavy: true, blocked: false, dmg: F[victim].hp, a: near, d: victim });
        knockOut(F[victim], victim, near, s, 340, 300);
      }
      // 서로 밀어내기(겹쳐 서지 않게) · 무대 안
      for (let i = 0; i < n; i++) {
        const a = F[i];
        if (!a.alive || !a.landed) continue;
        for (let j = i + 1; j < n; j++) {
          const b = F[j];
          if (!b.alive || !b.landed) continue;
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          if (Math.abs(dx) < 24 && Math.abs(dz) < 11) {
            const push = (24 - Math.abs(dx)) * 0.22;
            const sx = dx === 0 ? (i % 2 ? 1 : -1) : Math.sign(dx);
            a.x -= sx * push; b.x += sx * push;
            const pz = (11 - Math.abs(dz)) * 0.08 * (dz === 0 ? 1 : Math.sign(dz));
            a.z -= pz; b.z += pz;
          }
        }
        a.x = clamp(a.x, 30, ARENA_W - 30);
        a.z = clamp(a.z, 4, ARENA_D - 4);
      }
      if (alive === 2) planDuel(s + DT);
    } else if (s < tl.fight) {
      // 입장 — 착지한 사람은 가볍게 몸 풀기
      for (const f of F) if (f.landed && f.pose !== POSE.ko) { f.pose = POSE.idle; f.face = f.x < MID ? 1 : -1; }
    }

    if (n === 2 && duelStart >= 0 && !finalists && s >= tl.fight - 0.6) planDuel(tl.fight - 0.6);

    if (finalists && s >= duelStart) {
      // ── 결승 ──
      const pair = finalists;
      for (const who of [0, 1] as const) {
        const f = F[pair[who]];
        if (f.pose === POSE.ko) continue;
        const nx = keyX(who, s);
        const moved = Math.abs(nx - f.x);
        f.walkPhase += moved / 30;
        f.x = nx;
        f.z += (duelZ - f.z) * 0.15;
        f.face = who === 0 ? 1 : -1;
        const sg = segs.find((g) => g.who === who && s >= g.s0 && s < g.s1);
        if (sg) { f.pose = sg.pose; f.kind = sg.kind; f.st = s - sg.s0; f.dur = sg.s1 - sg.s0; }
        else if (koDone && pair[who] === pair[winnerSide]) { f.pose = POSE.win; f.st = s - tl.ko; f.dur = 0; }
        else { f.pose = moved > 0.6 ? POSE.walk : POSE.idle; f.st = 0; f.dur = 0; }
        const air = airs.find((g) => g.who === who && s >= g.s0 && s < g.s1);
        f.h = air ? 4 * air.peak * ((s - air.s0) / (air.s1 - air.s0)) * (1 - (s - air.s0) / (air.s1 - air.s0)) : 0;
      }
      while (duelHitAt < duelHits.length && duelHits[duelHitAt].s <= s + 1e-9) {
        const hit = duelHits[duelHitAt++];
        const di = pair[hit.d];
        const ai = pair[1 - hit.d];
        const d = F[di];
        // 맞은 자리 = 맞는 사람의 때린 사람 쪽 옆
        const fa = hit.d === 0 ? 1 : -1;
        if (hit.clash) {
          if (hit.d === 0) events.push({ type: 'clash', s, x: (F[pair[0]].x + F[pair[1]].x) / 2, z: d.z, h: hit.h, a: ai, d: di });
          d.hp = Math.max(1, d.hp - hit.dmg);
          continue;
        }
        events.push({ type: 'hit', s, x: d.x + fa * 12, z: d.z, h: hit.h, kind: hit.kind, heavy: hit.heavy, blocked: hit.blocked, dmg: hit.final ? d.hp : hit.dmg, a: ai, d: di, final: hit.final });
        d.flash = hit.blocked ? 0.4 : 1;
        if (hit.final) {
          koDone = true;
          knockOut(d, di, ai, s, 330, 560);
        } else d.hp = Math.max(hit.blocked ? 1 : 3, d.hp - hit.dmg);
      }
    }

    // 카메라
    let tx = MID, ty = ARENA_D / 2 - 40, ts = ARENA_W + 150;
    if (s >= tl.fight || n <= 2) {
      if (finalists) {
        const a = F[finalists[0]], b = F[finalists[1]];
        const w = F[finalists[winnerSide]];
        if (koDone && s > tl.ko + 0.9) { tx = w.x; ts = 300; ty = w.z - 52; }
        else { tx = (a.x + b.x) / 2; ts = Math.max(320, Math.abs(a.x - b.x) + 230); ty = (a.z + b.z) / 2 - 48; }
      } else {
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (const f of F) {
          if (!f.alive) continue;
          x0 = Math.min(x0, f.x); x1 = Math.max(x1, f.x); z0 = Math.min(z0, f.z); z1 = Math.max(z1, f.z);
        }
        if (x0 <= x1) { tx = (x0 + x1) / 2; ts = clamp(Math.max(x1 - x0 + 240, (z1 - z0 + 150) * 1.78), 380, ARENA_W + 150); ty = (z0 + z1) / 2 - 40; }
      }
    }
    const k = tick === 0 ? 1 : 0.075;
    camX += (tx - camX) * k;
    camY += (ty - camY) * k;
    camSpan = Math.exp(Math.log(camSpan) + (Math.log(ts) - Math.log(camSpan)) * k);
    write(tick);
  }

  const winner = n === 1 ? 0 : finalists ? finalists[winnerSide] : F.findIndex((f) => f.alive);
  // 혼자면 바로 이긴 자세
  if (n === 1) {
    for (let tick = Math.ceil(tl.ko * FIGHT_HZ); tick < ticks; tick++) frames[tick * FIGHT_STRIDE + 4] = POSE.win;
  }
  return { n, ticks, tl, frames, cam, alive: aliveAt, events, art, winner, finalists, duelStart, koOrder };
}
