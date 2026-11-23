// 체스타필드 배틀 — 링 안 공 배틀(구멍 탈출 → 실 끊기 결승) 순수 시뮬레이션.
//  · DOM · React · window 없음. 무작위는 밖에서 받은 random() 하나뿐(시드 고정 테스트 가능).
//  · 세계 좌표 = 링 반지름 1, 원점 중심, y 아래로(화면과 같게). 그리는 쪽은 배율만 곱한다.
//  · 공정: 모든 공 같은 크기 · 같은 속력(매 스텝 속력 맞춤), 시작 위치 균등 무작위, 배열 순서도 섞는다.
//  · 반드시 끝난다: 탈출 단계는 조용하면 구멍이 넓어지고(85초 뒤 크게), 결승은 조용하면 새 실이 안 생기고
//    속도가 오르며, 마지막 안전장치(110초 강제 탈락 · 결승 28초/122초 뒤 오래된 실부터 자동 절단)가 있다.

export type BattleEntrant = { number: number; name: string };
export type BattlePhase = 'escape' | 'showdown' | 'done';
export type BattleOutReason = 'gap' | 'cut' | 'safety';
export type BattleString = { readonly id: number; readonly angle: number; readonly born: number };

type MutableBall = {
  index: number;
  number: number;
  name: string;
  hue: number;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  out: boolean;
  /** 탈락한 시뮬 시각(살아 있으면 -1) */
  outAt: number;
  outReason: BattleOutReason | null;
  outPhase: 'escape' | 'showdown' | null;
  /** 최종 순위(1=우승, 결정 전 0) */
  place: number;
  /** 결승에서 쥔 실(앵커 = 링 위 각도, 다른 끝 = 공 중심) */
  strings: BattleString[];
  /** 결승 구역 시작 각도(결승 전 NaN) */
  sector: number;
};
export type BattleBall = { readonly [K in keyof MutableBall]: K extends 'strings' ? readonly BattleString[] : MutableBall[K] };

export type BattleGap = { start: number; end: number };
export type BattleRing = {
  readonly radius: number;
  readonly rotation: number;
  readonly spin: number;
  /** 물리적으로 열려 있는지(결승에선 닫힘) */
  readonly open: boolean;
  readonly gapCount: number;
  /** 화면용 구멍(절대 각도, end > start). 결승 들어가면 0.6초 동안 좁아져 사라진다 */
  readonly gaps: readonly BattleGap[];
};
export type BattleSnap = {
  readonly owner: number;
  readonly hue: number;
  readonly ax: number; readonly ay: number;
  readonly bx: number; readonly by: number;
  readonly cx: number; readonly cy: number;
  readonly at: number;
};

export type BattleEvent =
  | { type: 'out'; number: number; remaining: number; reason: BattleOutReason; x: number; y: number }
  | { type: 'cut'; owner: number; by: number | null; x: number; y: number }
  | { type: 'bounce'; number: number; x: number; y: number; pinned: boolean }
  | { type: 'showdown'; survivors: number[] }
  | { type: 'win'; number: number };

export interface BattleSim {
  readonly balls: readonly BattleBall[];
  readonly ring: BattleRing;
  readonly snaps: readonly BattleSnap[];
  readonly total: number;
  readonly ballRadius: number;
  readonly phase: BattlePhase;
  readonly time: number;
  readonly alive: number;
  readonly winner: number | null;
  readonly showdownAt: number | null;
  /** 순항 속도 대비 배수 */
  readonly speed: number;
  /** 결승: 조용해서 벽 튕김이 더는 실을 안 박는 중 */
  readonly noNewStrings: boolean;
  /** 안전장치 동작 중(탈출 크게 열림 / 결승 자동 절단) */
  readonly safety: boolean;
  step(dt: number): BattleEvent[];
}

export const BATTLE_TUNING = {
  /** 내부 고정 스텝(초) — step(dt) 는 이 크기 이하로 쪼갠다 */
  substep: 1 / 240,
  /** 큰 판 시작 밀도(공 면적 / 링 면적) */
  pack: 0.24,
  ballRadiusMin: 0.03,
  ballRadiusMax: 0.075,
  /** 링이 좁혀지는 한도 = 공 반지름 / 링 반지름 이 이 값이 될 때까지(마지막엔 공이 크게 보인다) */
  closeInRelRadius: 0.075,
  ringMin: 0.45,
  /** 초당 링 반지름 감소 한도 */
  ringShrinkRate: 0.03,
  /** 시작 속력(링 반지름/초, 현재 링 반지름에 비례) */
  speed: 0.7,
  /** 초당 순항 속도의 몇 배씩 빨라지는지 */
  speedGain: 0.018,
  speedCap: 2.2,
  /** 안전장치 중 속도 상한 배수 */
  safetySpeedBoost: 1.3,
  /** 벽 반사각 흔들림(rad) */
  bounceJitter: 0.2,
  /** 공끼리 부딪힐 때 흔들림(rad) */
  collideJitter: 0.12,
  /** 링 회전(rad/s) */
  spin: 0.55,
  /** 공 하나 지름을 뺀 '빠져나갈 수 있는' 구멍 폭 합(rad) */
  gapOpenTotal: 0.4,
  /** 이만큼 아무도 안 나가면 구멍이 넓어지기 시작(초) */
  quietWidenAfter: 2.5,
  /** 구멍 하나당 넓어지는 속도(rad/s) */
  widenRate: 0.1,
  /** 평소 구멍이 링을 덮는 최대 비율 */
  maxOpenFraction: 0.5,
  /** 누가 나가면 넓어진 몫을 이 비율만 남긴다 */
  widenKeepOnOut: 0.6,
  escapeSafetyAt: 85,
  escapeSafetyWidenRate: 0.6,
  escapeSafetyMaxOpen: 0.85,
  escapeForceAt: 110,
  escapeForceEvery: 0.2,
  /** 이 인원이 남으면 결승(실 끊기) */
  showdownSize: 3,
  startStrings: 3,
  maxStrings: 12,
  /** 결승 시작 직후 실이 박히는 동안은 안 끊긴다(초) */
  showdownGrace: 1.8,
  /** 결승 시작 속도 배수(여기서 다시 speedGain 으로 오른다) */
  showdownSpeed: 0.85,
  showdownSpeedGain: 0.035,
  /** 결승에서 이만큼 아무도 안 나가면 새 실을 안 박는다(초) */
  showdownQuiet: 5,
  duelQuiet: 3,
  showdownSafetyAfter: 28,
  showdownSafetyAt: 122,
  autoCutEvery: 0.4,
  /** 탈락 공 낙하 */
  gravity: 1.6,
  outKick: 0.6,
  outAnim: 2.4,
  snapLife: 0.9,
  gapCloseTime: 0.6,
  /** 결승 시작 때 구멍에 반쯤 걸쳐 있던 공을 링 안쪽으로 들이는 속도(링 반지름/초) — 순간이동 대신 스르륵 */
  settleSpeed: 0.5,
  /** 우승 공이 가운데로 모이는 속도 */
  winnerGather: 3,
} as const;

const TAU = Math.PI * 2;
const wrapAngle = (a: number) => {
  const v = a % TAU;
  return v < 0 ? v + TAU : v;
};

export function battleBallRadius(count: number): number {
  const T = BATTLE_TUNING;
  return Math.min(T.ballRadiusMax, Math.max(T.ballRadiusMin, Math.sqrt(T.pack / Math.max(1, count))));
}

export function battleGapCount(count: number): number {
  return count >= 160 ? 4 : count >= 70 ? 3 : count >= 24 ? 2 : 1;
}

/** 점 p 에서 선분 a-b 까지 거리 제곱 + 가장 가까운 점의 매개변수 u */
function segDist2(px: number, py: number, ax: number, ay: number, bx: number, by: number): [number, number] {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let u = l2 > 1e-18 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  const qx = ax + dx * u - px;
  const qy = ay + dy * u - py;
  return [qx * qx + qy * qy, u];
}

class FlagBattle implements BattleSim {
  readonly balls: MutableBall[];
  readonly ring: { radius: number; rotation: number; spin: number; open: boolean; gapCount: number; gaps: BattleGap[] };
  snaps: BattleSnap[] = [];
  readonly total: number;
  readonly ballRadius: number;
  phase: BattlePhase = 'escape';
  time = 0;
  alive: number;
  winner: number | null = null;
  showdownAt: number | null = null;
  speed = 1;
  noNewStrings = false;
  safety = false;

  private readonly random: () => number;
  private readonly gapStart: number[];
  private gapPhys = 0;
  private extra = 0;
  private closedAt = -1;
  private closeFrom = 0;
  private lastOutAt = 0;
  private stringId = 0;
  private stepCount = 0;
  private nextForce = 0;
  private nextAutoCut = 0;
  private escapeSafety = false;
  private showdownSafety = false;
  private pending: BattleEvent[] = [];
  /** 결승이 열릴 때 벽선(R-r) 밖 = 구멍에 걸쳐 있던 공들. 안으로 다 들어올 때까지 천천히 민다. */
  private readonly settling = new Set<MutableBall>();
  private readonly cell: number;
  private readonly dim: number;
  private readonly head: Int32Array;
  private readonly next: Int32Array;

  constructor(entrants: readonly BattleEntrant[], random: () => number) {
    this.random = random;
    const seen = new Set<number>();
    const list: BattleEntrant[] = [];
    for (const e of entrants) {
      if (!e || !Number.isFinite(e.number) || seen.has(e.number)) continue;
      seen.add(e.number);
      list.push({ number: e.number, name: String(e.name ?? '') });
    }
    const n = list.length;
    this.total = n;
    this.alive = n;
    const r = battleBallRadius(n);
    this.ballRadius = r;
    const gapCount = battleGapCount(n);
    this.gapStart = Array.from({ length: gapCount }, () => 0);
    this.ring = { radius: 1, rotation: random() * TAU, spin: (random() < 0.5 ? -1 : 1) * BATTLE_TUNING.spin, open: true, gapCount, gaps: Array.from({ length: gapCount }, () => ({ start: 0, end: 0 })) };

    // 시작 자리: 링 안쪽 균등 무작위, 서로 안 겹치게(밀도 0.24 이하라 금방 찬다)
    const lim = Math.max(0, 1 - r - 0.03);
    const minD2 = (2 * r * 1.08) ** 2;
    const placed: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      let x = 0;
      let y = 0;
      for (let tries = 0; tries < 4000; tries++) {
        const rho = lim * Math.sqrt(random());
        const th = random() * TAU;
        x = Math.cos(th) * rho;
        y = Math.sin(th) * rho;
        let ok = true;
        for (const p of placed) {
          const dx = p.x - x;
          const dy = p.y - y;
          if (dx * dx + dy * dy < minD2) { ok = false; break; }
        }
        if (ok) break;
      }
      placed.push({ x, y });
    }
    // 배열 순서(충돌 · 절단 처리 순서)는 응모 순서와 무관하게 섞는다
    const order = list.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const v0 = BATTLE_TUNING.speed;
    this.balls = order.map((src, index) => {
      const e = list[src];
      const hue = (src * 137.508 + 200) % 360;
      const th = random() * TAU;
      return {
        index, number: e.number, name: e.name, hue, color: `hsl(${hue.toFixed(1)} 78% 58%)`,
        x: placed[index].x, y: placed[index].y, vx: Math.cos(th) * v0, vy: Math.sin(th) * v0, r,
        out: false, outAt: -1, outReason: null, outPhase: null, place: 0, strings: [], sector: NaN,
      };
    });

    this.cell = 2 * r;
    this.dim = Math.ceil(2.4 / this.cell) + 1;
    this.head = new Int32Array(this.dim * this.dim);
    this.next = new Int32Array(Math.max(1, n));

    this.updateGaps();
    if (n === 1) {
      this.phase = 'done';
      this.balls[0].place = 1;
      this.winner = this.balls[0].number;
      this.pending.push({ type: 'win', number: this.winner });
    } else if (n === 0) {
      this.phase = 'done';
    } else if (n <= BATTLE_TUNING.showdownSize) {
      this.enterShowdown(this.pending);
    }
  }

  step(dt: number): BattleEvent[] {
    const events: BattleEvent[] = this.pending.length ? this.pending.splice(0) : [];
    if (!(dt > 0)) return events;
    let left = Math.min(dt, 0.25);
    const h0 = BATTLE_TUNING.substep;
    while (left > 1e-12) {
      const h = Math.min(h0, left);
      this.substep(h, events);
      left -= h;
    }
    return events;
  }

  // ── 내부 ──

  private alphaAngle(): number {
    return Math.asin(Math.min(0.99, this.ballRadius / this.ring.radius));
  }

  private ringTarget(): number {
    const T = BATTLE_TUNING;
    const r = this.ballRadius;
    const floor = Math.min(1, Math.max(T.ringMin, r / T.closeInRelRadius));
    const want = Math.sqrt((Math.max(1, this.alive) * r * r) / T.pack);
    return Math.min(1, Math.max(floor, want));
  }

  private extraMax(): number {
    const T = BATTLE_TUNING;
    const G = this.ring.gapCount;
    const frac = this.escapeSafety ? T.escapeSafetyMaxOpen : T.maxOpenFraction;
    const base = 2 * this.alphaAngle() + T.gapOpenTotal / G;
    return Math.max(0, (frac * TAU) / G - base);
  }

  private updateGaps() {
    const T = BATTLE_TUNING;
    const ring = this.ring;
    const G = ring.gapCount;
    this.gapPhys = 2 * this.alphaAngle() + T.gapOpenTotal / G + this.extra;
    let visual = this.gapPhys;
    if (!ring.open) visual = this.closeFrom * Math.max(0, 1 - (this.time - this.closedAt) / T.gapCloseTime);
    for (let i = 0; i < G; i++) {
      const centre = ring.rotation + (i * TAU) / G;
      this.gapStart[i] = wrapAngle(centre - this.gapPhys / 2);
      const g = ring.gaps[i];
      g.start = centre - visual / 2;
      g.end = centre + visual / 2;
    }
  }

  private substep(h: number, ev: BattleEvent[]) {
    const T = BATTLE_TUNING;
    this.time += h;
    this.stepCount++;
    const t = this.time;
    const ring = this.ring;
    ring.rotation = wrapAngle(ring.rotation + ring.spin * h);

    if (this.phase !== 'done') {
      const target = this.ringTarget();
      if (ring.radius > target) ring.radius = Math.max(target, ring.radius - T.ringShrinkRate * h);
      const cap = this.safety ? T.speedCap * T.safetySpeedBoost : T.speedCap;
      // 결승은 한 박자 늦췄다가 다시 빨라진다(실 끊기가 눈에 보이게)
      this.speed = this.showdownAt === null
        ? Math.min(cap, 1 + T.speedGain * t)
        : Math.min(cap, T.showdownSpeed + T.showdownSpeedGain * (t - this.showdownAt));
    }
    if (this.phase === 'escape') {
      if (!this.escapeSafety && t >= T.escapeSafetyAt) { this.escapeSafety = true; this.safety = true; }
      const quiet = t - this.lastOutAt;
      const rate = this.escapeSafety ? T.escapeSafetyWidenRate : quiet > T.quietWidenAfter ? T.widenRate : 0;
      if (rate > 0) this.extra = Math.min(this.extraMax(), this.extra + rate * h);
    }
    this.updateGaps();

    const balls = this.balls;
    if (this.phase !== 'done') {
      for (const b of balls) {
        if (b.out) continue;
        b.x += b.vx * h;
        b.y += b.vy * h;
      }
      this.collide();
      this.walls(ev, h);
      if (this.phase === 'escape' && t >= T.escapeForceAt) this.forceEscape(ev);
      // 결승 전환은 벽 처리가 공 전부를 다 본 뒤에 — 같은 순간 구멍 밖으로 넘어간 공은 그대로 탈락시키고
      // (끌어 들이지 않는다), 그래서 드물게(동시에 둘이 빠지면) 2명 결승이 될 수 있다.
      if ((this.phase as BattlePhase) === 'escape' && this.alive <= T.showdownSize) this.enterShowdown(ev);
      if ((this.phase as BattlePhase) === 'showdown') {
        if (this.showdownAt !== null && t - this.showdownAt >= T.showdownGrace) this.cuts(ev);
        if (this.phase === 'showdown') this.showdownGuard(ev);
      }
      // 같은 속력으로 맞춘다(공정 + 멈추는 공 없음). walls/cuts 가 phase 를 바꿨을 수 있다.
      if ((this.phase as BattlePhase) !== 'done') {
        const target = T.speed * this.speed * ring.radius;
        for (const b of balls) {
          if (b.out) continue;
          const s = Math.hypot(b.vx, b.vy);
          if (s < 1e-9) {
            const th = this.random() * TAU;
            b.vx = Math.cos(th) * target;
            b.vy = Math.sin(th) * target;
          } else {
            b.vx *= target / s;
            b.vy *= target / s;
          }
        }
      }
    }
    if (this.phase === 'done') {
      const k = 1 - Math.exp(-T.winnerGather * h);
      for (const b of balls) {
        if (b.out) continue;
        b.x -= b.x * k;
        b.y -= b.y * k;
        b.vx = 0;
        b.vy = 0;
      }
    }

    // 탈락 공은 떨어지며 사라진다
    for (const b of balls) {
      if (!b.out || t - b.outAt > T.outAnim) continue;
      b.vy += T.gravity * h;
      b.x += b.vx * h;
      b.y += b.vy * h;
    }
    if (this.snaps.length && t - this.snaps[0].at > T.snapLife) this.snaps = this.snaps.filter((s) => t - s.at <= T.snapLife);
  }

  private collide() {
    const balls = this.balls;
    const { cell, dim, head, next } = this;
    const r = this.ballRadius;
    const minD = 2 * r;
    const minD2 = minD * minD;
    const jitter = BATTLE_TUNING.collideJitter;
    const spin = (o: MutableBall, j: number) => {
      const c = Math.cos(j);
      const sn = Math.sin(j);
      const vx = o.vx * c - o.vy * sn;
      o.vy = o.vx * sn + o.vy * c;
      o.vx = vx;
    };
    head.fill(-1);
    const cellOf = (v: number) => {
      const c = Math.floor((v + 1.2) / cell);
      return c < 0 ? 0 : c >= dim ? dim - 1 : c;
    };
    for (const b of balls) {
      if (b.out) continue;
      const c = cellOf(b.y) * dim + cellOf(b.x);
      next[b.index] = head[c];
      head[c] = b.index;
    }
    for (const a of balls) {
      if (a.out) continue;
      const cx = cellOf(a.x);
      const cy = cellOf(a.y);
      for (let gy = Math.max(0, cy - 1); gy <= Math.min(dim - 1, cy + 1); gy++) {
        for (let gx = Math.max(0, cx - 1); gx <= Math.min(dim - 1, cx + 1); gx++) {
          for (let j = head[gy * dim + gx]; j !== -1; j = next[j]) {
            if (j <= a.index) continue;
            const b = balls[j];
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            let d2 = dx * dx + dy * dy;
            if (d2 >= minD2) continue;
            if (d2 < 1e-18) {
              // 완전히 겹치면 번호로 정한 방향으로 떼어 낸다
              const th = ((a.index * 7 + j * 13) % 360) * (Math.PI / 180);
              dx = Math.cos(th) * 1e-6;
              dy = Math.sin(th) * 1e-6;
              d2 = 1e-12;
            }
            const d = Math.sqrt(d2);
            const nx = dx / d;
            const ny = dy / d;
            const push = (minD - d) / 2;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;
            const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (rel < 0) {
              a.vx += rel * nx;
              a.vy += rel * ny;
              b.vx -= rel * nx;
              b.vy -= rel * ny;
              // 같은 속력 공끼리 붙어 '기차'처럼 같이 도는 걸 막는 작은 흔들림
              if (jitter > 0) {
                spin(a, (this.random() - 0.5) * 2 * jitter);
                spin(b, (this.random() - 0.5) * 2 * jitter);
              }
            }
          }
        }
      }
    }
  }

  private walls(ev: BattleEvent[], h: number) {
    const T = BATTLE_TUNING;
    const R = this.ring.radius;
    const r = this.ballRadius;
    const G = this.ring.gapCount;
    for (const b of this.balls) {
      if (b.out || this.phase === 'done') continue;
      const d = Math.hypot(b.x, b.y);
      if (d <= R - r) {
        if (this.settling.size) this.settling.delete(b);
        continue;
      }
      const th = Math.atan2(b.y, b.x);
      let gi = -1;
      if (this.ring.open && this.phase === 'escape') {
        const a = wrapAngle(th);
        for (let g = 0; g < G; g++) {
          if (wrapAngle(a - this.gapStart[g]) < this.gapPhys) { gi = g; break; }
        }
      }
      if (gi >= 0) {
        // 구멍 안: 구멍 끝 모서리(점)와만 부딪힌다. 중심이 링 선을 넘으면 탈락.
        for (const ang of [this.gapStart[gi], this.gapStart[gi] + this.gapPhys]) {
          const ex = Math.cos(ang) * R;
          const ey = Math.sin(ang) * R;
          const dx = b.x - ex;
          const dy = b.y - ey;
          const dd = Math.hypot(dx, dy);
          if (dd >= r || dd < 1e-12) continue;
          const nx = dx / dd;
          const ny = dy / dd;
          b.x = ex + nx * r;
          b.y = ey + ny * r;
          const vn = b.vx * nx + b.vy * ny;
          if (vn < 0) {
            b.vx -= 2 * vn * nx;
            b.vy -= 2 * vn * ny;
          }
        }
        const d2 = Math.hypot(b.x, b.y);
        if (d2 > R) {
          // 밖으로 살짝 차 주고(링을 확실히 벗어나게) 탈락
          b.vx += (b.x / d2) * T.outKick;
          b.vy += (b.y / d2) * T.outKick;
          this.eliminate(b, 'gap', ev);
        }
        continue;
      }
      const nx = b.x / d;
      const ny = b.y / d;
      let nd = R - r;
      if (this.settling.has(b)) {
        // 결승 시작 때 구멍에 걸쳐 있던 공: 벽선까지 한 번에 당기지 않고 조금씩(링 밖으로는 절대 안 나감)
        nd = Math.max(R - r, Math.min(d - T.settleSpeed * R * h, R));
        if (nd <= R - r) this.settling.delete(b);
      }
      b.x = nx * nd;
      b.y = ny * nd;
      const vn = b.vx * nx + b.vy * ny;
      if (vn > 0) {
        b.vx -= 2 * vn * nx;
        b.vy -= 2 * vn * ny;
        // 원형 당구는 궤도가 고정(같은 현만 반복)이라 반사각을 살짝 흔든다 — 둘이 나란히 도는 교착 방지.
        // 흔든 쪽이 벽 밖을 향하면 반대로 흔든다(스치듯 튕길 땐 늘 안쪽으로 꺾인다).
        const j = (this.random() - 0.5) * 2 * T.bounceJitter;
        if (!this.rotateInward(b, j, nx, ny)) this.rotateInward(b, -j, nx, ny);
        let pinned = false;
        if (this.phase === 'showdown' && !this.noNewStrings && b.strings.length < T.maxStrings) {
          b.strings.push({ id: this.stringId++, angle: wrapAngle(th), born: this.time });
          pinned = true;
        }
        ev.push({ type: 'bounce', number: b.number, x: nx * R, y: ny * R, pinned });
      }
    }
  }

  /** 속도를 j 만큼 돌려 보고, 벽 안쪽(-n)을 충분히 향하면 적용 */
  private rotateInward(b: MutableBall, j: number, nx: number, ny: number): boolean {
    const c = Math.cos(j);
    const sn = Math.sin(j);
    const jx = b.vx * c - b.vy * sn;
    const jy = b.vx * sn + b.vy * c;
    if (jx * nx + jy * ny >= -0.08 * Math.hypot(jx, jy)) return false;
    b.vx = jx;
    b.vy = jy;
    return true;
  }

  private eliminate(b: MutableBall, reason: BattleOutReason, ev: BattleEvent[]) {
    const T = BATTLE_TUNING;
    b.out = true;
    b.outAt = this.time;
    b.outReason = reason;
    b.outPhase = this.phase === 'showdown' ? 'showdown' : 'escape';
    b.place = this.alive;
    this.alive--;
    this.lastOutAt = this.time;
    this.settling.delete(b);
    if (reason === 'gap') this.extra *= T.widenKeepOnOut;
    else {
      // 결승 탈락: 툭 떨어진다
      b.vx *= 0.3;
      b.vy = b.vy * 0.3 - 0.35;
      b.strings = [];
    }
    ev.push({ type: 'out', number: b.number, remaining: this.alive, reason, x: b.x, y: b.y });
    // 탈출전 → 결승 전환은 substep 에서(벽 처리가 끝난 뒤) 한다
    if (this.alive <= 1) this.win(ev);
    else if (this.phase === 'showdown' && !this.showdownSafety) this.noNewStrings = false;
  }

  private win(ev: BattleEvent[]) {
    const last = this.balls.find((b) => !b.out);
    this.phase = 'done';
    if (!last) return;
    last.place = 1;
    this.winner = last.number;
    ev.push({ type: 'win', number: last.number });
  }

  private enterShowdown(ev: BattleEvent[]) {
    const T = BATTLE_TUNING;
    this.phase = 'showdown';
    this.showdownAt = this.time;
    this.closeFrom = this.ring.open ? this.gapPhys : 0;
    this.ring.open = false;
    this.closedAt = this.time;
    this.lastOutAt = this.time;
    this.noNewStrings = false;
    this.updateGaps();
    const survivors = this.balls.filter((b) => !b.out).sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
    const k = survivors.length;
    const sector = TAU / k;
    // 구멍에 걸쳐(벽선 R-r 밖) 있던 공: 밖으로 가던 속도는 안으로 꺾고, walls() 가 천천히 들인다
    const inner = this.ring.radius - this.ballRadius;
    for (const b of survivors) {
      const d = Math.hypot(b.x, b.y);
      if (d <= inner || d < 1e-12) continue;
      this.settling.add(b);
      const vn = (b.vx * b.x + b.vy * b.y) / d;
      if (vn > 0) {
        b.vx -= (2 * vn * b.x) / d;
        b.vy -= (2 * vn * b.y) / d;
      }
    }
    // 각자 자기 쪽 1/k 구역에 실을 부채꼴로 박는다. 구역은 공이 있는 방향 순서대로 주되, 구역 전체의 회전은
    // 공마다 '구역 가운데까지 각도 차'가 가장 작게(원형 평균) 맞춘다 — 몰려 있어도 남의 쪽을 받지 않게.
    let sx = 0;
    let sy = 0;
    survivors.forEach((b, i) => {
      const a = Math.atan2(b.y, b.x) - i * sector;
      sx += Math.cos(a);
      sy += Math.sin(a);
    });
    const centre0 = sx * sx + sy * sy > 1e-12 ? Math.atan2(sy, sx) : Math.atan2(survivors[0].y, survivors[0].x);
    const base = centre0 - sector / 2 + (this.random() - 0.5) * sector * 0.2;
    survivors.forEach((b, i) => {
      b.sector = wrapAngle(base + i * sector);
      for (let j = 0; j < T.startStrings; j++) {
        b.strings.push({ id: this.stringId++, angle: wrapAngle(b.sector + (sector * (j + 0.5)) / T.startStrings), born: this.time });
      }
    });
    ev.push({ type: 'showdown', survivors: survivors.map((b) => b.number) });
  }

  private cuts(ev: BattleEvent[]) {
    const R = this.ring.radius;
    const r2 = this.ballRadius * this.ballRadius;
    const live = this.balls.filter((b) => !b.out);
    const n = live.length;
    const offset = this.stepCount % n;
    for (let c = 0; c < n; c++) {
      const cutter = live[(c + offset) % n];
      if (cutter.out) continue;
      for (const owner of live) {
        if (owner === cutter || owner.out) continue;
        for (let k = owner.strings.length - 1; k >= 0; k--) {
          const s = owner.strings[k];
          const ax = Math.cos(s.angle) * R;
          const ay = Math.sin(s.angle) * R;
          const [d2, u] = segDist2(cutter.x, cutter.y, ax, ay, owner.x, owner.y);
          if (d2 >= r2) continue;
          this.cutString(owner, k, cutter, ax + (owner.x - ax) * u, ay + (owner.y - ay) * u, ev);
          if (owner.out || this.phase !== 'showdown') break;
        }
        if (this.phase !== 'showdown') return;
      }
    }
  }

  private cutString(owner: MutableBall, k: number, by: MutableBall | null, cx: number, cy: number, ev: BattleEvent[]) {
    const s = owner.strings[k];
    const R = this.ring.radius;
    owner.strings.splice(k, 1);
    this.snaps.push({ owner: owner.index, hue: owner.hue, ax: Math.cos(s.angle) * R, ay: Math.sin(s.angle) * R, bx: owner.x, by: owner.y, cx, cy, at: this.time });
    ev.push({ type: 'cut', owner: owner.number, by: by ? by.number : null, x: cx, y: cy });
    if (owner.strings.length === 0 && this.alive > 1) this.eliminate(owner, 'cut', ev);
  }

  private showdownGuard(ev: BattleEvent[]) {
    const T = BATTLE_TUNING;
    const t = this.time;
    if (!this.showdownSafety && this.showdownAt !== null && (t - this.showdownAt >= T.showdownSafetyAfter || t >= T.showdownSafetyAt)) {
      this.showdownSafety = true;
      this.safety = true;
      this.noNewStrings = true;
      this.nextAutoCut = t;
    }
    // 조용하면 새 실을 안 박는다 — 둘만 남은 맞대결은 더 빨리(수렴)
    const quiet = this.alive <= 2 ? T.duelQuiet : T.showdownQuiet;
    if (!this.noNewStrings && t - this.lastOutAt > quiet) this.noNewStrings = true;
    if (!this.showdownSafety || t < this.nextAutoCut) return;
    this.nextAutoCut = t + T.autoCutEvery;
    // 가장 오래된 실부터 저절로 끊어진다
    let owner: MutableBall | null = null;
    let at = -1;
    for (const b of this.balls) {
      if (b.out) continue;
      b.strings.forEach((s, k) => {
        const o = owner?.strings[at];
        if (!o || s.born < o.born || (s.born === o.born && s.id < o.id)) { owner = b; at = k; }
      });
    }
    const o = owner as MutableBall | null;
    if (!o || at < 0) {
      // 실이 하나도 없는 생존자들(이론상) — 가운데에서 먼 공부터 탈락
      const far = this.balls.filter((b) => !b.out).sort((a, b) => Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y) || a.index - b.index)[0];
      if (far && this.alive > 1) this.eliminate(far, 'safety', ev);
      return;
    }
    const s = o.strings[at];
    const R = this.ring.radius;
    this.cutString(o, at, null, (Math.cos(s.angle) * R + o.x) / 2, (Math.sin(s.angle) * R + o.y) / 2, ev);
  }

  private forceEscape(ev: BattleEvent[]) {
    const T = BATTLE_TUNING;
    if (this.time < this.nextForce) return;
    this.nextForce = this.time + T.escapeForceEvery;
    const count = Math.max(1, Math.ceil((this.alive - T.showdownSize) / 8));
    for (let i = 0; i < count && this.phase === 'escape' && this.alive > T.showdownSize; i++) {
      const far = this.balls.filter((b) => !b.out).sort((a, b) => Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y) || a.index - b.index)[0];
      if (!far) return;
      this.eliminate(far, 'safety', ev);
    }
  }
}

export function createBattleSim(entrants: readonly BattleEntrant[], random: () => number): BattleSim {
  return new FlagBattle(entrants, random);
}
