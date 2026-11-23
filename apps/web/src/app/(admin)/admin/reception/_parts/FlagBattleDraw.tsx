'use client';

/* 체스타필드 배틀 — 링 안 공 배틀 추첨 무대(우리 구현). 물리가 실시간으로 우승자를 정하고, 끝나면 onFinish 로 알린다.
 *  · 탈출전: 도는 링의 구멍으로 빠지면 탈락(조용하면 구멍이 넓어지고 링이 좁혀진다) → 3명 남으면
 *  · 결승(실 끊기): 각자 자기 구역에 실을 박고, 남의 실에 닿으면 끊는다. 마지막 실을 쥔 사람이 우승.
 *  · 부모 크기를 꽉 채우는 캔버스(DPR · ResizeObserver). 모듈 최상단에서 window 안 씀(SSR 안전).
 *  · running=false = 준비 화면. true 가 되면 시작(무작위는 crypto.getRandomValues). 진행 중 부모가 다시 그려도 재시작 안 함.
 *  · onFinish 는 판마다 정확히 한 번(우승 결정 1.2초 뒤, StrictMode 이중 마운트에도 한 번).
 *  · 소리: 작은 WebAudio 합성 — 탈락 · 실 끊김마다 5음계 멜로디 다음 음. running 이 된 뒤에만 만든다. */
import { useEffect, useMemo, useRef } from 'react';
import { BATTLE_TUNING, createBattleSim, type BattleEntrant, type BattleEvent, type BattleSim } from './flag-battle-sim';

export type { BattleEntrant } from './flag-battle-sim';

type Props = {
  entrants: readonly BattleEntrant[];
  running: boolean;
  onFinish: (winner: BattleEntrant) => void;
  muted?: boolean;
  title?: string;
};

const STEP = 1 / 120;
const MAX_STEPS_PER_FRAME = 10;
const FINISH_DELAY_MS = 1200;
/** 이 인원 이하로 남으면 모든 공에 이름표 */
const NAMES_ALL_AT = 40;
/** 링이 좁혀질 때 화면 확대 정도(1=링 크기 고정, 0=확대 없음) */
const ZOOM = 0.8;
const BG = '#0b0d14';
const GOLD = '#ffd27a';
const TAU = Math.PI * 2;

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; confetti: boolean; rot: number; vr: number };
type FeedRow = { number: number; name: string; color: string; at: number };
type Pin = { x: number; y: number; at: number; color: string };
type Run = {
  sim: BattleSim;
  key: string;
  byNumber: Map<number, BattleEntrant>;
  startedAt: number | null;
  showdownAt: number | null;
  finalists: number[];
  winAt: number | null;
  feed: FeedRow[];
  particles: Particle[];
  pins: Pin[];
};
type Layout = { w: number; h: number; cx: number; cy: number; pxR: number; u: number; wide: boolean; scale: number };

function cryptoRandom(): () => number {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (!c || typeof c.getRandomValues !== 'function') return Math.random;
  const buf = new Uint32Array(256);
  let i = buf.length;
  return () => {
    if (i >= buf.length) {
      c.getRandomValues(buf);
      i = 0;
    }
    return buf[i++] / 4294967296;
  };
}

const entrantKey = (entrants: readonly BattleEntrant[]) => entrants.map((e) => `${e.number}\u0001${e.name}`).join('\u0002');

function makeRun(entrants: readonly BattleEntrant[], key: string): Run {
  const byNumber = new Map<number, BattleEntrant>();
  for (const e of entrants) if (!byNumber.has(e.number)) byNumber.set(e.number, e);
  return { sim: createBattleSim(entrants, cryptoRandom()), key, byNumber, startedAt: null, showdownAt: null, finalists: [], winAt: null, feed: [], particles: [], pins: [] };
}

// ── 소리 ──
// 직접 만든 5음계(도레미솔라) 멜로디. 탈락 · 실 끊김마다 한 음씩 나아간다.
const MELODY = [76, 79, 81, 84, 81, 79, 76, 74, 72, 74, 76, 79, 76, 74, 72, 67, 69, 72, 74, 76, 79, 81, 79, 76, 74, 76, 72, 74, 69, 72, 74, 72];
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class BattleSound {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private idx = 0;
  private nextAt = 0;
  muted = false;

  /** running 이 된 뒤에만 부른다(사용자 클릭 뒤라 자동재생 정책 통과) */
  ensure(): boolean {
    if (this.muted || typeof window === 'undefined') return false;
    if (!this.ctx) {
      const AC: typeof AudioContext | undefined = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return false;
      try {
        this.ctx = new AC();
      } catch {
        return false;
      }
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 6;
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.55;
      this.out.connect(comp).connect(this.ctx.destination);
      this.nextAt = 0;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    return this.ctx.state !== 'closed';
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (!this.ctx || !this.out || this.ctx.state === 'closed') return;
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), now);
    this.out.gain.exponentialRampToValueAtTime(m ? 0.0001 : 0.55, now + 0.12);
  }

  private tone(freq: number, when: number, dur: number, peak: number, type: OscillatorType, slideTo?: number) {
    const c = this.ctx;
    const out = this.out;
    if (!c || !out) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(out);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  note(accent = false) {
    if (!this.ensure() || !this.ctx) return;
    const now = this.ctx.currentTime;
    const at = Math.max(now + 0.01, this.nextAt);
    if (at - now > 0.35) return; // 한꺼번에 몰리면 건너뛴다(밀리지 않게)
    const f = hz(MELODY[this.idx++ % MELODY.length]);
    this.tone(f, at, 0.45, accent ? 0.22 : 0.15, 'triangle');
    this.tone(f * 2, at, 0.16, 0.045, 'sine');
    this.nextAt = at + 0.075;
  }

  thud() {
    if (!this.ensure() || !this.ctx) return;
    this.tone(150, this.ctx.currentTime + 0.01, 0.22, 0.28, 'sine', 55);
  }

  chord() {
    if (!this.ensure() || !this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    [60, 67, 72, 76].forEach((m, i) => this.tone(hz(m), t + i * 0.07, 0.9, 0.11, 'triangle'));
  }

  fanfare() {
    if (!this.ensure() || !this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    [72, 76, 79, 84].forEach((m, i) => this.tone(hz(m), t + i * 0.12, 0.42, 0.2, 'square'));
    [72, 76, 79, 84].forEach((m) => this.tone(hz(m), t + 0.52, 1.3, 0.1, 'triangle'));
  }

  close() {
    const c = this.ctx;
    this.ctx = null;
    this.out = null;
    if (c && c.state !== 'closed') void c.close().catch(() => {});
  }
}

// ── 그리기 도우미 ──
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeBack = (t: number) => {
  const x = clamp(t, 0, 1);
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};
const shortName = (name: string, max = 8) => ([...name].length > max ? `${[...name].slice(0, max - 1).join('')}…` : name);

function computeLayout(w: number, h: number, ringR: number): Layout {
  const wide = w >= h * 1.25;
  let pxR: number;
  let cx: number;
  let cy: number;
  if (wide) {
    pxR = Math.min(h * 0.43, w * 0.29);
    cx = w / 2;
    cy = h / 2 + h * 0.015;
  } else {
    const top = Math.max(84, h * 0.17);
    const bottom = Math.max(44, h * 0.08);
    pxR = Math.max(40, Math.min(w * 0.45, (h - top - bottom) * 0.5));
    cx = w / 2;
    cy = top + (h - top - bottom) / 2;
  }
  const u = clamp((wide ? h : Math.min(w * 1.35, h)) / 1080, 0.5, 1.8);
  return { w, h, cx, cy, pxR, u, wide, scale: pxR / Math.pow(Math.max(0.2, ringR), ZOOM) };
}

export function FlagBattleDraw({ entrants, running, onFinish, muted = false, title = '체스타필드 배틀' }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const key = useMemo(() => entrantKey(entrants), [entrants]);

  const runRef = useRef<Run | null>(null);
  const finishedRef = useRef<Run | null>(null);
  const prevRunningRef = useRef(false);
  const runningRef = useRef(running);
  const entrantsRef = useRef(entrants);
  const keyRef = useRef(key);
  const onFinishRef = useRef(onFinish);
  const titleRef = useRef(title);
  const mutedRef = useRef(muted);
  const soundRef = useRef<BattleSound | null>(null);
  if (!soundRef.current) soundRef.current = new BattleSound();

  // 최신 props 를 ref 로(그리기 루프가 읽는다) — 다른 effect 보다 먼저
  useEffect(() => {
    entrantsRef.current = entrants;
    keyRef.current = key;
    onFinishRef.current = onFinish;
    titleRef.current = title;
  });

  useEffect(() => {
    mutedRef.current = muted;
    soundRef.current?.setMuted(muted);
  }, [muted]);

  // 판 만들기: 멈춰 있을 때 명단이 바뀌면 새 판. 다시 시작(false→true)이면 새 무작위 판. 진행 중엔 절대 안 바꾼다.
  useEffect(() => {
    runningRef.current = running;
    const prev = prevRunningRef.current;
    prevRunningRef.current = running;
    const current = runRef.current;
    if (!running) {
      if (!current || current.key !== key) runRef.current = makeRun(entrantsRef.current, key);
      return;
    }
    if (!current || (!prev && (current.sim.time > 0 || current.key !== key))) runRef.current = makeRun(entrantsRef.current, key);
    if (!prev && runRef.current) {
      runRef.current.startedAt = performance.now();
      if (!mutedRef.current) soundRef.current?.ensure();
    }
  }, [key, running]);

  // 그리기 루프(마운트 동안 계속 — 준비 화면 흔들림 · 우승 연출 포함). 시뮬은 running 일 때만 진행.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const g0 = canvas.getContext('2d');
    if (!g0) return;
    const g: CanvasRenderingContext2D = g0;
    const sound: BattleSound = soundRef.current ?? (soundRef.current = new BattleSound());
    let w = 1;
    let h = 1;
    let dpr = 1;
    let family = 'system-ui, sans-serif';
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    /** 첫 프레임을 그린 뒤 true — 그 전엔 resize 에서 다시 그리지 않는다(draw 가 아직 없음) */
    let drawn = false;

    const readDpr = () => Math.min(2, window.devicePixelRatio || 1);
    // 캔버스 크기 맞추기. width/height 대입은 그림을 지우므로 실제로 바뀔 때만 넣고, 바뀌었으면 바로 다시 그린다
    // (ResizeObserver 콜백은 rAF 뒤 · 화면 찍기 전에 돌아서, 안 그리면 그 프레임이 빈 배경으로 보인다).
    const resize = (repaint: boolean) => {
      const rect = wrap.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      dpr = readDpr();
      family = getComputedStyle(wrap).fontFamily || family;
      const cw = Math.max(1, Math.round(w * dpr));
      const ch = Math.max(1, Math.round(h * dpr));
      if (canvas.width === cw && canvas.height === ch) return;
      canvas.width = cw;
      canvas.height = ch;
      if (repaint && drawn) draw(ensureRun(), performance.now(), 0);
    };
    const ro = new ResizeObserver(() => resize(true));
    ro.observe(wrap);
    resize(false);

    const font = (weight: number, px: number) => `${weight} ${Math.max(1, Math.round(px))}px ${family}`;
    const fit = (text: string, weight: number, px: number, maxW: number) => {
      g.font = font(weight, px);
      const tw = g.measureText(text).width;
      return tw > maxW && tw > 0 ? Math.max(8, (px * maxW) / tw) : px;
    };

    const ensureRun = () => {
      if (!runRef.current) runRef.current = makeRun(entrantsRef.current, keyRef.current);
      return runRef.current;
    };

    const burst = (run: Run, x: number, y: number, color: string, count: number, speed: number, life: number, size: number) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * TAU;
        const s = speed * (0.4 + Math.random() * 0.8);
        run.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size: size * (0.6 + Math.random() * 0.6), confetti: false, rot: 0, vr: 0 });
      }
    };
    const confetti = (run: Run, L: Layout, colors: string[]) => {
      for (let i = 0; i < 220; i++) {
        const life = 3.5 + Math.random() * 2.5;
        run.particles.push({
          x: Math.random() * L.w, y: -20 - Math.random() * L.h * 0.4,
          vx: (Math.random() - 0.5) * 160 * L.u, vy: (120 + Math.random() * 220) * L.u,
          life, max: life, color: colors[i % colors.length], size: (7 + Math.random() * 8) * L.u, confetti: true,
          rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 10,
        });
      }
    };

    const handle = (run: Run, events: BattleEvent[], now: number, L: Layout) => {
      const sim = run.sim;
      const toX = (x: number) => L.cx + x * L.scale;
      const toY = (y: number) => L.cy + y * L.scale;
      for (const e of events) {
        if (e.type === 'out') {
          const ball = sim.balls.find((b) => b.number === e.number);
          const color = ball?.color ?? '#fff';
          run.feed.unshift({ number: e.number, name: ball?.name ?? '', color, at: now });
          if (run.feed.length > 8) run.feed.length = 8;
          if (e.reason === 'gap') {
            burst(run, toX(e.x), toY(e.y), color, 9, 260 * L.u, 0.55, 4 * L.u);
            if (!mutedRef.current) sound.note();
          } else {
            burst(run, toX(e.x), toY(e.y), color, 22, 320 * L.u, 0.8, 5 * L.u);
            if (!mutedRef.current) sound.thud();
          }
        } else if (e.type === 'cut') {
          burst(run, toX(e.x), toY(e.y), '#ffffff', 10, 280 * L.u, 0.45, 3.5 * L.u);
          if (!mutedRef.current) sound.note(true);
        } else if (e.type === 'bounce') {
          if (e.pinned) {
            const ball = sim.balls.find((b) => b.number === e.number);
            run.pins.push({ x: e.x, y: e.y, at: sim.time, color: ball?.color ?? '#fff' });
            if (run.pins.length > 24) run.pins.shift();
          }
        } else if (e.type === 'showdown') {
          run.showdownAt = now;
          run.finalists = e.survivors.slice();
          if (!mutedRef.current) sound.chord();
        } else if (e.type === 'win') {
          run.winAt = now;
          const ball = sim.balls.find((b) => b.number === e.number);
          confetti(run, L, [ball?.color ?? GOLD, GOLD, '#ffffff', '#7fd3ff', '#ff8fb1', '#9dffa8']);
          if (ball) burst(run, toX(ball.x), toY(ball.y), ball.color, 40, 520 * L.u, 1.1, 6 * L.u);
          if (!mutedRef.current) sound.fanfare();
        }
      }
    };

    // ── 한 프레임 그리기 ──
    const draw = (run: Run, now: number, dt: number) => {
      const sim = run.sim;
      const ring = sim.ring;
      const L = computeLayout(w, h, ring.radius);
      const { cx, cy, u, scale } = L;
      const R = ring.radius;
      const ringPx = R * scale;
      const rBall = sim.ballRadius * scale;
      const X = (x: number) => cx + x * scale;
      const Y = (y: number) => cy + y * scale;
      const ready = !runningRef.current && sim.time === 0 && sim.total > 0;
      const showdown = sim.phase === 'showdown' || (sim.phase === 'done' && sim.showdownAt !== null);
      const winK = run.winAt !== null ? (now - run.winAt) / 1000 : -1;

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalAlpha = 1;
      g.fillStyle = BG;
      g.fillRect(0, 0, w, h);
      const vg = g.createRadialGradient(cx, cy, ringPx * 0.2, cx, cy, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'rgba(40,48,78,0.55)');
      vg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = vg;
      g.fillRect(0, 0, w, h);

      // 바닥
      const floor = g.createRadialGradient(cx, cy - ringPx * 0.3, ringPx * 0.1, cx, cy, ringPx);
      floor.addColorStop(0, 'rgba(255,255,255,0.06)');
      floor.addColorStop(1, 'rgba(255,255,255,0.015)');
      g.fillStyle = floor;
      g.beginPath();
      g.arc(cx, cy, ringPx, 0, TAU);
      g.fill();

      // 링 바깥 눈금(돌아가는 게 보이게)
      g.strokeStyle = 'rgba(255,255,255,0.13)';
      g.lineWidth = 2 * u;
      g.beginPath();
      for (let i = 0; i < 72; i++) {
        const a = ring.rotation + (i * TAU) / 72;
        const r0 = ringPx + 12 * u;
        const r1 = ringPx + (i % 6 === 0 ? 24 : 17) * u;
        g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      }
      g.stroke();

      // 탈락해 떨어지는 공(링 아래층)
      const labelOut = sim.alive <= 80;
      for (const b of sim.balls) {
        if (!b.out) continue;
        const age = sim.time - b.outAt;
        if (age > 1.6) continue;
        const a = clamp(1 - age / 1.6, 0, 1);
        const rp = rBall * (1 - 0.35 * (age / 1.6));
        drawBall(b.x, b.y, rp, b.color, b.hue, a * 0.9);
        if (rp >= 9) drawNumber(X(b.x), Y(b.y), rp, b.number, a);
        if ((labelOut || b.outReason !== 'gap') && age < 1.3) drawTag(X(b.x), Y(b.y) + rp + 6 * u, b.name, clamp(rp * 0.7, 13 * u, 24 * u), a, 'rgba(120,20,30,0.82)');
      }

      // 끊긴 실(튕겨 말려 들어감)
      for (const s of sim.snaps) {
        const age = clamp((sim.time - s.at) / BATTLE_TUNING.snapLife, 0, 1);
        const e = easeOut(age);
        g.globalAlpha = 1 - age;
        g.strokeStyle = `hsl(${s.hue.toFixed(0)} 85% 68%)`;
        g.lineWidth = 2.6 * u;
        g.beginPath();
        g.moveTo(X(s.ax), Y(s.ay));
        g.lineTo(X(s.cx + (s.ax - s.cx) * e), Y(s.cy + (s.ay - s.cy) * e));
        g.moveTo(X(s.bx), Y(s.by));
        g.lineTo(X(s.cx + (s.bx - s.cx) * e), Y(s.cy + (s.by - s.cy) * e));
        g.stroke();
        if (age < 0.3) {
          g.globalAlpha = 1 - age / 0.3;
          g.fillStyle = '#ffffff';
          g.beginPath();
          g.arc(X(s.cx), Y(s.cy), (6 + 14 * age) * u, 0, TAU);
          g.fill();
        }
      }
      g.globalAlpha = 1;

      // 실(앵커 → 공 중심)
      for (const b of sim.balls) {
        if (b.out || !b.strings.length) continue;
        const bx = X(b.x);
        const by = Y(b.y);
        g.beginPath();
        for (const s of b.strings) {
          g.moveTo(cx + Math.cos(s.angle) * ringPx, cy + Math.sin(s.angle) * ringPx);
          g.lineTo(bx, by);
        }
        // 어두운 밑줄 + 공 색 실(프로젝터에서도 또렷하게)
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.lineWidth = 7 * u;
        g.stroke();
        g.strokeStyle = b.color;
        g.lineWidth = 3.6 * u;
        g.stroke();
        for (const s of b.strings) {
          const ax = cx + Math.cos(s.angle) * ringPx;
          const ay = cy + Math.sin(s.angle) * ringPx;
          g.fillStyle = b.color;
          g.beginPath();
          g.arc(ax, ay, 5.5 * u, 0, TAU);
          g.fill();
          g.strokeStyle = '#ffffff';
          g.lineWidth = 2 * u;
          g.stroke();
        }
      }

      // 살아 있는 공
      const winnerBall = sim.winner !== null ? sim.balls.find((b) => b.number === sim.winner) : undefined;
      for (const b of sim.balls) {
        if (b.out || (winK >= 0 && b === winnerBall)) continue;
        let x = b.x;
        let y = b.y;
        if (ready) {
          // 준비 화면: 살짝 둥실
          x += (Math.sin(now / 700 + b.index * 1.7) * 0.12 * sim.ballRadius);
          y += (Math.cos(now / 830 + b.index * 2.3) * 0.12 * sim.ballRadius);
        }
        drawBall(x, y, rBall, b.color, b.hue, 1);
        if (rBall >= 9) drawNumber(X(x), Y(y), rBall, b.number, 1);
      }

      // 링(공 위에 — 구멍을 지나는 공이 링 선 아래로 사라지게)
      const gold = showdown ? clamp(sim.showdownAt !== null ? (sim.time - sim.showdownAt) / 0.6 : 1, 0, 1) : 0;
      const ringColor = gold > 0 ? mix('#eef2fa', GOLD, gold) : '#eef2fa';
      const gaps = ring.gaps.filter((gp) => gp.end - gp.start > 0.004);
      g.lineCap = 'round';
      g.lineWidth = 7 * u;
      g.strokeStyle = ringColor;
      g.shadowColor = gold > 0 ? 'rgba(255,200,110,0.6)' : 'rgba(170,190,255,0.55)';
      g.shadowBlur = 18 * u;
      g.beginPath();
      if (!gaps.length) g.arc(cx, cy, ringPx, 0, TAU);
      else {
        for (let i = 0; i < gaps.length; i++) {
          const from = gaps[i].end;
          let to = gaps[(i + 1) % gaps.length].start;
          while (to <= from) to += TAU;
          g.moveTo(cx + Math.cos(from) * ringPx, cy + Math.sin(from) * ringPx);
          g.arc(cx, cy, ringPx, from, to);
        }
      }
      g.stroke();
      g.shadowBlur = 0;
      if (gaps.length) {
        // 구멍 = 붉은 점선으로 눈에 띄게 + 끝 기둥
        g.setLineDash([6 * u, 9 * u]);
        g.lineWidth = 3 * u;
        g.strokeStyle = 'rgba(255,96,96,0.55)';
        for (const gp of gaps) {
          g.beginPath();
          g.arc(cx, cy, ringPx, gp.start, gp.end);
          g.stroke();
        }
        g.setLineDash([]);
        g.fillStyle = '#ffffff';
        for (const gp of gaps) {
          for (const a of [gp.start, gp.end]) {
            g.beginPath();
            g.arc(cx + Math.cos(a) * ringPx, cy + Math.sin(a) * ringPx, 6.5 * u, 0, TAU);
            g.fill();
          }
        }
      }
      g.lineCap = 'butt';

      // 새로 박힌 실 자리 반짝
      for (const p of run.pins) {
        const age = (sim.time - p.at) / 0.45;
        if (age > 1 || age < 0) continue;
        g.globalAlpha = 1 - age;
        g.strokeStyle = p.color;
        g.lineWidth = 3 * u;
        g.beginPath();
        g.arc(X(p.x), Y(p.y), (6 + 22 * age) * u, 0, TAU);
        g.stroke();
      }
      g.globalAlpha = 1;

      // 이름표: 40명 이하면 모두, 결승은 크게
      if (winK < 0) {
        const all = sim.alive <= NAMES_ALL_AT || showdown;
        if (all) {
          const px = showdown ? 26 * u : sim.alive <= 12 ? 22 * u : clamp(rBall * 0.68, 14 * u, 22 * u);
          for (const b of sim.balls) {
            if (b.out) continue;
            drawTag(X(b.x), Y(b.y) + rBall + 6 * u, b.name, px, 1, 'rgba(8,10,16,0.78)', b.color);
          }
        }
      }

      // 입자
      for (let i = run.particles.length - 1; i >= 0; i--) {
        const p = run.particles[i];
        p.life -= dt;
        if (p.life <= 0) { run.particles.splice(i, 1); continue; }
        if (p.confetti) {
          p.vy += 260 * u * dt;
          p.vx *= 1 - 0.6 * dt;
          p.x += (p.vx + Math.sin(p.rot) * 40 * u) * dt;
        } else {
          p.vx *= 1 - 3 * dt;
          p.vy *= 1 - 3 * dt;
          p.x += p.vx * dt;
        }
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const a = clamp(p.life / Math.min(p.max, p.confetti ? 1 : p.max), 0, 1);
        g.globalAlpha = a;
        g.fillStyle = p.color;
        if (p.confetti) {
          g.save();
          g.translate(p.x, p.y);
          g.rotate(p.rot);
          g.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6 * Math.abs(Math.cos(p.rot * 1.3)) + 1);
          g.restore();
        } else {
          g.beginPath();
          g.arc(p.x, p.y, p.size * a, 0, TAU);
          g.fill();
        }
      }
      g.globalAlpha = 1;

      drawHud(run, L);

      // 준비 · 시작 · 결승 안내
      if (sim.total === 0) {
        centerText('응모자가 없어요', 700, 56 * u, cy, '#ffffff', 1);
      } else if (ready) {
        // 1명 판도 시뮬은 처음부터 'done' 이지만, 시작 전엔 똑같이 '준비'
        g.fillStyle = 'rgba(8,10,16,0.55)';
        g.beginPath();
        g.arc(cx, cy, Math.min(ringPx * 0.42, 210 * u), 0, TAU);
        g.fill();
        centerText('준비', 700, 92 * u, cy - 6 * u, '#ffffff', 1);
        centerText(`${sim.total}명 참가`, 600, 30 * u, cy + 58 * u, GOLD, 1);
      } else if (run.startedAt !== null && run.showdownAt === null && run.winAt === null && now - run.startedAt < 1100) {
        // (1명 판은 시작하자마자 우승 연출 — '시작!' 과 겹치지 않게 winAt 이 있으면 안 띄운다)
        const k = (now - run.startedAt) / 1100;
        centerText('시작!', 700, 120 * u * (0.8 + 0.25 * easeBack(k * 2)), cy, '#ffffff', 1 - clamp((k - 0.55) / 0.45, 0, 1));
      }
      if (run.showdownAt !== null && winK < 0) {
        const k = (now - run.showdownAt) / 2200;
        if (k < 1) {
          const a = clamp(k / 0.12, 0, 1) * (1 - clamp((k - 0.72) / 0.28, 0, 1));
          g.globalAlpha = a * 0.42;
          g.fillStyle = '#05060a';
          g.fillRect(0, cy - 92 * u, w, 184 * u);
          g.globalAlpha = 1;
          centerText('결승전', 700, 92 * u * (0.85 + 0.15 * easeBack(k * 5)), cy - 18 * u, GOLD, a);
          centerText(`실 끊기 · ${run.finalists.length}명 · 실이 모두 끊기면 탈락`, 600, 28 * u, cy + 52 * u, '#ffffff', a);
        }
      }

      // 우승 연출
      if (winK >= 0 && winnerBall) {
        const k = winK;
        g.globalAlpha = 0.62 * easeOut(k / 0.9);
        g.fillStyle = '#05060a';
        g.fillRect(0, 0, w, h);
        g.globalAlpha = 1;
        const bx = X(winnerBall.x);
        const by = Y(winnerBall.y);
        const big = rBall * (1 + 1.5 * easeBack(k / 1.1));
        // 빛줄기
        g.save();
        g.translate(bx, by);
        g.rotate(now / 4000);
        g.globalAlpha = 0.13 * easeOut(k / 0.8);
        g.fillStyle = winnerBall.color;
        for (let i = 0; i < 14; i++) {
          g.rotate(TAU / 14);
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(Math.max(w, h), -big * 0.6);
          g.lineTo(Math.max(w, h), big * 0.6);
          g.closePath();
          g.fill();
        }
        g.restore();
        g.globalAlpha = 1;
        g.shadowColor = winnerBall.color;
        g.shadowBlur = 40 * u;
        drawBallPx(bx, by, big, winnerBall.color, winnerBall.hue, 1);
        g.shadowBlur = 0;
        drawNumber(bx, by, big, winnerBall.number, 1);
        const a = easeOut((k - 0.15) / 0.5);
        centerText('우승', 700, 44 * u, by - big - 34 * u, GOLD, a, bx);
        const namePx = fit(winnerBall.name, 700, 112 * u, w * 0.9);
        centerText(winnerBall.name, 700, namePx, by + big + 26 * u + namePx * 0.55, '#ffffff', a, bx);
        centerText(`No. ${winnerBall.number}`, 600, 42 * u, by + big + 26 * u + namePx * 1.1 + 30 * u, 'rgba(255,255,255,0.75)', a, bx);
      }

      // ── 내부 그리기 함수 ──
      function drawBall(x: number, y: number, rp: number, color: string, hue: number, alpha: number) {
        drawBallPx(X(x), Y(y), rp, color, hue, alpha);
      }
      function drawBallPx(px: number, py: number, rp: number, color: string, hue: number, alpha: number) {
        if (rp <= 0.5) return;
        g.globalAlpha = alpha;
        g.fillStyle = color;
        g.beginPath();
        g.arc(px, py, rp, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.3)';
        g.beginPath();
        g.arc(px - rp * 0.32, py - rp * 0.36, rp * 0.4, 0, TAU);
        g.fill();
        const lw = Math.max(1, rp * 0.09);
        g.lineWidth = lw;
        g.strokeStyle = `hsl(${hue.toFixed(0)} 70% 26% / 0.9)`;
        g.beginPath();
        g.arc(px, py, Math.max(0.5, rp - lw / 2), 0, TAU);
        g.stroke();
        g.globalAlpha = 1;
      }
      function drawNumber(px: number, py: number, rp: number, n: number, alpha: number) {
        const text = String(n);
        const size = clamp(rp * (text.length >= 4 ? 0.6 : text.length === 3 ? 0.74 : 0.9), 8, 120);
        g.globalAlpha = alpha;
        g.font = font(700, size);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        g.lineWidth = Math.max(2, size * 0.22);
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.strokeText(text, px, py + size * 0.04);
        g.fillStyle = '#ffffff';
        g.fillText(text, px, py + size * 0.04);
        g.globalAlpha = 1;
      }
      function drawTag(px: number, top: number, name: string, size: number, alpha: number, bg: string, edge?: string) {
        if (!name) return;
        const text = shortName(name);
        g.font = font(600, size);
        const tw = g.measureText(text).width;
        const padX = size * 0.45;
        const hgt = size * 1.45;
        const left = px - tw / 2 - padX;
        g.globalAlpha = alpha;
        g.fillStyle = bg;
        roundRect(left, top, tw + padX * 2, hgt, hgt / 2);
        g.fill();
        if (edge) {
          g.strokeStyle = edge;
          g.lineWidth = Math.max(1, size * 0.09);
          g.stroke();
        }
        g.fillStyle = '#ffffff';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text, px, top + hgt / 2 + size * 0.04);
        g.globalAlpha = 1;
      }
      function centerText(text: string, weight: number, size: number, y: number, color: string, alpha: number, x = cx) {
        if (alpha <= 0) return;
        g.globalAlpha = alpha;
        g.font = font(weight, size);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        g.lineWidth = Math.max(3, size * 0.12);
        g.strokeStyle = 'rgba(0,0,0,0.55)';
        g.strokeText(text, x, y);
        g.fillStyle = color;
        g.fillText(text, x, y);
        g.globalAlpha = 1;
      }
    };

    function roundRect(x: number, y: number, rw: number, rh: number, r: number) {
      const rr = Math.min(r, rw / 2, rh / 2);
      g.beginPath();
      g.moveTo(x + rr, y);
      g.arcTo(x + rw, y, x + rw, y + rh, rr);
      g.arcTo(x + rw, y + rh, x, y + rh, rr);
      g.arcTo(x, y + rh, x, y, rr);
      g.arcTo(x, y, x + rw, y, rr);
      g.closePath();
    }

    function mix(a: string, b: string, t: number) {
      const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
      const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
      return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
    }

    // ── 화면 옆 정보판: 제목 · 남은 인원 · 결승 실 개수 · 방금 탈락 ──
    function drawHud(run: Run, L: Layout) {
      const sim = run.sim;
      const { u, cx, pxR } = L;
      const ttl = titleRef.current || '체스타필드 배틀';
      const notStarted = !runningRef.current && sim.time === 0;
      const phaseText = sim.total === 0 ? ''
        : notStarted && sim.phase === 'done' ? '참가자 1명 · 시작하면 바로 우승'
        : sim.phase === 'done' ? (sim.winner !== null ? '우승자가 정해졌어요' : '')
        : sim.phase === 'showdown' ? '결승 · 남의 실에 닿으면 끊겨요' : '탈출전 · 구멍으로 빠지면 탈락';
      const left = 56 * u;
      const panelW = cx - pxR - left - 52 * u;
      g.textBaseline = 'alphabetic';
      if (L.wide && panelW >= 240 * u) {
        let y = 100 * u;
        g.textAlign = 'left';
        const tp = fit(ttl, 700, 50 * u, panelW);
        g.font = font(700, tp);
        g.fillStyle = '#ffffff';
        g.fillText(ttl, left, y);
        y += 40 * u;
        g.font = font(500, 22 * u);
        g.fillStyle = 'rgba(255,255,255,0.62)';
        g.fillText(phaseText, left, y);
        y += 80 * u;
        g.font = font(600, 21 * u);
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.fillText('남은 인원', left, y);
        y += 92 * u;
        const aliveText = String(sim.alive);
        g.font = font(700, 100 * u);
        g.fillStyle = GOLD;
        g.fillText(aliveText, left, y);
        let x = left + g.measureText(aliveText).width + 8 * u;
        g.font = font(600, 38 * u);
        g.fillStyle = '#ffffff';
        g.fillText('명', x, y);
        x += g.measureText('명').width + 12 * u;
        g.font = font(500, 30 * u);
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.fillText(`/ ${sim.total}명`, x, y);
        y += 30 * u;
        const frac = sim.total ? sim.alive / sim.total : 0;
        g.fillStyle = 'rgba(255,255,255,0.1)';
        roundRect(left, y, panelW, 12 * u, 6 * u);
        g.fill();
        const bar = g.createLinearGradient(left, 0, left + panelW, 0);
        bar.addColorStop(0, '#ff8f6b');
        bar.addColorStop(1, GOLD);
        g.fillStyle = bar;
        roundRect(left, y, Math.max(12 * u, panelW * frac), 12 * u, 6 * u);
        g.fill();
        y += 52 * u;
        if (sim.phase !== 'done' && sim.total > 0) {
          g.font = font(500, 20 * u);
          g.fillStyle = 'rgba(255,255,255,0.5)';
          g.fillText(`속도 ×${sim.speed.toFixed(1)}${sim.noNewStrings && sim.phase === 'showdown' ? ' · 새 실 없음' : ''}`, left, y);
          y += 54 * u;
        }
        // 결승 진출자 · 실 개수
        if (run.finalists.length) {
          g.font = font(600, 21 * u);
          g.fillStyle = 'rgba(255,255,255,0.55)';
          g.fillText('결승 진출', left, y);
          y += 16 * u;
          for (const num of run.finalists) {
            const b = sim.balls.find((ball) => ball.number === num);
            if (!b) continue;
            y += 48 * u;
            g.globalAlpha = b.out ? 0.38 : 1;
            g.fillStyle = b.color;
            g.beginPath();
            g.arc(left + 12 * u, y - 10 * u, 12 * u, 0, TAU);
            g.fill();
            const status = b.place === 1 ? '우승' : b.out ? '탈락' : `실 ${b.strings.length}`;
            g.font = font(600, 22 * u);
            const sw = g.measureText(status).width;
            g.fillStyle = b.place === 1 ? GOLD : '#ffffff';
            g.textAlign = 'right';
            g.fillText(status, left + panelW, y);
            g.textAlign = 'left';
            const np = fit(shortName(b.name, 10), 700, 28 * u, panelW - sw - 56 * u);
            g.font = font(700, np);
            g.fillStyle = '#ffffff';
            g.fillText(shortName(b.name, 10), left + 36 * u, y);
            g.globalAlpha = 1;
          }
        }
        // 오른쪽: 방금 탈락
        const rx = cx + pxR + 52 * u;
        const rw = L.w - rx - 56 * u;
        if (rw >= 200 * u && run.feed.length) {
          let ry = 100 * u;
          g.textAlign = 'left';
          g.font = font(600, 21 * u);
          g.fillStyle = 'rgba(255,255,255,0.55)';
          g.fillText('방금 탈락', rx, ry);
          ry += 18 * u;
          const nowMs = performance.now();
          run.feed.forEach((row, i) => {
            const appear = easeOut((nowMs - row.at) / 260);
            ry += 58 * u;
            g.globalAlpha = appear * (1 - i * 0.09);
            g.fillStyle = row.color;
            g.beginPath();
            g.arc(rx + 11 * u, ry - 10 * u, 10 * u, 0, TAU);
            g.fill();
            g.font = font(600, 20 * u);
            g.fillStyle = 'rgba(255,255,255,0.55)';
            const tag = `No.${row.number}`;
            g.fillText(tag, rx + 32 * u, ry);
            const tw = g.measureText(tag).width;
            const np = fit(shortName(row.name, 10), 700, 28 * u, rw - tw - 48 * u);
            g.font = font(700, np);
            g.fillStyle = '#ffffff';
            g.fillText(shortName(row.name, 10), rx + 44 * u + tw, ry);
            g.globalAlpha = 1;
          });
        }
      } else {
        // 좁은 화면: 위 띠
        const pad = 20 * u;
        // 오른쪽 위는 크게 보기 판의 닫기 단추(오른쪽 16 + 폭 48~52px) 자리 — 남은 인원은 그 왼쪽에
        const padR = Math.max(pad, 84);
        g.textAlign = 'left';
        const counter = sim.total ? `남은 ${sim.alive} / ${sim.total}명` : '';
        g.font = font(700, 30 * u);
        const cw = g.measureText(counter).width;
        const tp = fit(ttl, 700, 30 * u, L.w - pad * 2 - padR - cw);
        g.font = font(700, tp);
        g.fillStyle = '#ffffff';
        g.fillText(ttl, pad, 44 * u);
        g.font = font(500, 17 * u);
        g.fillStyle = 'rgba(255,255,255,0.62)';
        g.fillText(phaseText, pad, 70 * u);
        g.textAlign = 'right';
        g.font = font(700, 30 * u);
        g.fillStyle = GOLD;
        g.fillText(counter, L.w - padR, 44 * u);
        const last = run.feed[0];
        if (last) {
          g.textAlign = 'center';
          g.font = font(600, 19 * u);
          g.fillStyle = 'rgba(255,255,255,0.75)';
          g.fillText(`방금 탈락 · No.${last.number} ${shortName(last.name, 10)}`, L.w / 2, L.h - 18 * u);
        }
      }
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // 창을 배율 다른 화면(노트북 ↔ 프로젝터)으로 옮기거나 확대/축소하면 CSS 크기는 그대로라
      // ResizeObserver 가 안 불린다 — 배율만 매 프레임 확인(값 읽기만이라 싸다). 아래에서 곧 그리므로 repaint 안 함.
      if (readDpr() !== dpr) resize(false);
      const run = ensureRun();
      let dt = (now - last) / 1000;
      last = now;
      if (!(dt > 0)) dt = 0;
      if (dt > 0.1) dt = 0.1;
      if (runningRef.current) {
        acc += dt;
        let steps = 0;
        const L = computeLayout(w, h, run.sim.ring.radius);
        while (acc >= STEP && steps < MAX_STEPS_PER_FRAME) {
          handle(run, run.sim.step(STEP), now, L);
          acc -= STEP;
          steps++;
        }
        if (steps >= MAX_STEPS_PER_FRAME) acc = 0;
      } else {
        acc = 0;
      }
      if (run.winAt !== null && finishedRef.current !== run && now - run.winAt >= FINISH_DELAY_MS) {
        finishedRef.current = run;
        const winner = run.sim.winner !== null ? run.byNumber.get(run.sim.winner) : undefined;
        if (winner) onFinishRef.current(winner);
      }
      draw(run, now, dt);
      drawn = true;
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      sound.close();
    };
  }, []);

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: BG }}>
      <canvas ref={canvasRef} role="img" aria-label={title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}
