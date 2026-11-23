'use client';

/* 슈트패브릭 'Freetiful Fight' 화면(261123 사장 '진짜 싸우는 느낌이 아닌데 잘 구현해줘') — fight-sim 이 미리 계산한 싸움을 캔버스로 그린다.
 *  · 카메라: 처음엔 무대 전체(전원 입장) → 사람이 줄수록 남은 사람들 쪽으로 다가가고 → 결승은 둘만 크게 → K.O. 뒤 이긴 사람.
 *  · 맞으면 하얗게 번쩍 · 불꽃 · 숫자 · 밀려남, 무거운 한 방은 화면 흔들림. 탈락은 오른쪽 위 K.O. 목록에 이름이 뜬다.
 *  · 당첨은 서버가 이미 정했다 — 시뮬레이션이 이긴 '자리'에 당첨 응모권을 앉힌다(나머지 자리는 그대로 섞인 순서). */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { RevealPlan, RevealTicket } from './draw-reveal';
import { ARENA_D, ARENA_W, FIGHT_HZ, FIGHT_STRIDE, MOVE, POSE, fightSimTime, simulateFight, type FightEvent } from './fight-sim';

const ART = '/reception/draw';
const SPRITE_RATIO = 246 / 274;
/** 깊이 1배일 때 사람 키(세계 단위) */
const BASE_H = 70;
const COLOR = ['#ff676e', '#50dfa6', '#65a7ff', '#ffcf6e', '#c485fa', '#48e7f2', '#d7e2ed', '#ff9c52', '#ff709f', '#afda70', '#92b5ff', '#fd8053', '#ff96d4', '#c5bccc', '#69edbb'];
const FONT = 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
const DISPLAY = "Impact, 'Arial Black', Pretendard, system-ui, sans-serif";
const START_SPAN = ARENA_W + 150;

type Sheet = { img: HTMLImageElement; white: HTMLCanvasElement | null; ready: boolean };
const sheets: Sheet[] = [];
let backdrop: HTMLImageElement | null = null;
const redraws = new Set<() => void>();

function silhouette(img: HTMLImageElement) {
  try {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    if (!g) return null;
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    return c;
  } catch {
    return null;
  }
}

function loadArt() {
  if (typeof window === 'undefined' || sheets.length) return;
  for (let i = 0; i < 15; i++) {
    const img = new Image();
    img.decoding = 'async';
    const sheet: Sheet = { img, white: null, ready: false };
    img.onload = () => {
      sheet.ready = true;
      sheet.white = silhouette(img);
      redraws.forEach((f) => f());
    };
    img.src = `${ART}/fighter-${i + 1}.webp`;
    sheets.push(sheet);
  }
  const bg = new Image();
  bg.decoding = 'async';
  bg.onload = () => redraws.forEach((f) => f());
  bg.src = `${ART}/fight.webp`;
  backdrop = bg;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => 1 - (1 - clamp(t, 0, 1)) ** 3;
const smooth = (t: number) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };
const no = (ticket: RevealTicket | null | undefined) => (ticket ? `#${String(ticket.number).padStart(3, '0')}` : '');
const short = (name: string, max = 6) => ([...name].length > max ? `${[...name].slice(0, max - 1).join('')}…` : name);
const label = (ticket: RevealTicket | null | undefined, max = 6) => (ticket ? `${no(ticket)} ${short(ticket.name, max)}` : '');

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

/** 큰 글씨(FIGHT! · K.O.) — 진한 테두리 + 금색 */
function banner(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, alpha: number, scale = 1, fill = '#ffe08a') {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha = clamp(alpha, 0, 1);
  g.translate(x, y);
  g.scale(scale, scale);
  g.font = `italic 700 ${size}px ${DISPLAY}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = size * 0.16;
  g.strokeStyle = '#140d1c';
  g.strokeText(text, 0, size * 0.06);
  g.lineWidth = size * 0.07;
  g.strokeStyle = '#7a2330';
  g.strokeText(text, 0, 0);
  g.fillStyle = fill;
  g.fillText(text, 0, 0);
  g.restore();
}

function pill(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, opts: { align?: 'left' | 'right' | 'center'; color?: string; bg?: string; border?: string; alpha?: number; weight?: number } = {}) {
  const { align = 'center', color = '#fff', bg = '#0b1020d9', border, alpha = 1, weight = 700 } = opts;
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha = clamp(alpha, 0, 1);
  g.font = `${weight} ${size}px ${FONT}`;
  const w = g.measureText(text).width + size * 0.9;
  const h = size * 1.55;
  const left = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  roundRect(g, left, y - h / 2, w, h, size * 0.35);
  g.fillStyle = bg;
  g.fill();
  if (border) { g.lineWidth = Math.max(1, size * 0.08); g.strokeStyle = border; g.stroke(); }
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, left + w / 2, y + size * 0.04);
  g.restore();
}

export function FightArena({ plan, t }: { plan: RevealPlan; t: number }) {
  const n = plan.lineup.length;
  const sim = useMemo(() => simulateFight(n, plan.seed), [n, plan.seed]);
  // 서버가 뽑은 당첨 응모권을 시뮬레이션이 이긴 자리로
  const tickets = useMemo(() => {
    const list = [...plan.lineup];
    const w = plan.winnerIndex;
    if (w >= 0 && w < list.length && sim.winner !== w) [list[w], list[sim.winner]] = [list[sim.winner], list[w]];
    return list;
  }, [plan.lineup, plan.winnerIndex, sim.winner]);
  const events = useMemo(() => [...sim.events].sort((a, b) => a.s - b.s), [sim]);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const tRef = useRef(t);
  tRef.current = t;

  const draw = useCallback(() => {
    const cvs = canvas.current;
    const wrap = box.current;
    if (!cvs || !wrap) return;
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    if (cvs.width !== pw || cvs.height !== ph) { cvs.width = pw; cvs.height = ph; }
    const g = cvs.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, W, H);

    const { tl, frames, cam } = sim;
    let real = (tRef.current * plan.duration) / 1000;
    // 개발 서버에서만 — 장면 확인용 시각 고정(window.__fightSeek = 초)
    if (process.env.NODE_ENV !== 'production') {
      const seek = (window as Window & { __fightSeek?: number }).__fightSeek;
      if (typeof seek === 'number') real = seek;
    }
    const s = fightSimTime(real, tl);
    const fpos = clamp(s * FIGHT_HZ, 0, sim.ticks - 1.001);
    const i0 = Math.floor(fpos);
    const i1 = Math.min(sim.ticks - 1, i0 + 1);
    const fr = fpos - i0;
    const U = Math.min(W / 960, H / 540);

    // ── 카메라 ──
    const cx = lerp(cam[i0 * 3], cam[i1 * 3], fr);
    const cy = lerp(cam[i0 * 3 + 1], cam[i1 * 3 + 1], fr);
    const span = lerp(cam[i0 * 3 + 2], cam[i1 * 3 + 2], fr);
    const k = Math.min(W / span, H / (span * 0.5625));
    const zoomed = clamp(Math.log(START_SPAN / span) / Math.log(START_SPAN / 330), 0, 1);
    const anchor = lerp(0.72, 0.5, smooth(zoomed));
    let shakeX = 0, shakeY = 0;
    for (const e of events) {
      if (e.s > s) break;
      const age = s - e.s;
      if (age > 0.3) continue;
      const amp = e.type === 'ko' ? (sim.finalists && (e.d === sim.finalists[0] || e.d === sim.finalists[1]) ? 16 : 5) : e.type === 'clash' ? 6 : e.type === 'hit' && e.heavy ? 3 + zoomed * 3 : 0;
      if (!amp) continue;
      const fade = 1 - age / 0.3;
      shakeX += Math.sin(age * 95 + e.s * 17) * amp * fade * U;
      shakeY += Math.cos(age * 83 + e.s * 11) * amp * 0.6 * fade * U;
    }
    const toX = (x: number) => (x - cx) * k + W / 2 + shakeX;
    const toY = (y: number) => (y - cy) * k + H * anchor + shakeY;
    const depth = (z: number) => 0.86 + 0.28 * (z / ARENA_D);

    // ── 배경(조금 따라 움직이는 원경) ──
    if (backdrop?.complete && backdrop.naturalWidth) {
      const bz = 1 + 0.16 * Math.log(START_SPAN / span);
      const base = Math.max(W / backdrop.naturalWidth, H / backdrop.naturalHeight) * bz;
      const bw = backdrop.naturalWidth * base;
      const bh = backdrop.naturalHeight * base;
      const pan = clamp((cx - ARENA_W / 2) / ARENA_W, -0.5, 0.5) * Math.max(0, bw - W) * 0.8;
      g.imageSmoothingEnabled = true;
      g.drawImage(backdrop, (W - bw) / 2 - pan + shakeX * 0.3, H - bh * (0.5 + 0.5 / bz) + shakeY * 0.3, bw, bh);
      g.imageSmoothingEnabled = false;
    } else {
      g.fillStyle = '#10162b';
      g.fillRect(0, 0, W, H);
    }
    g.fillStyle = `rgba(8, 10, 24, ${0.22 + zoomed * 0.18})`;
    g.fillRect(0, 0, W, H);

    // 무대 바닥 테두리
    g.save();
    g.beginPath();
    g.ellipse(toX(ARENA_W / 2), toY(ARENA_D / 2), (ARENA_W / 2 + 40) * k, (ARENA_D / 2 + 34) * k, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(10, 12, 28, 0.3)';
    g.fill();
    g.lineWidth = Math.max(1.5, 2.2 * k);
    g.strokeStyle = 'rgba(246, 220, 147, 0.45)';
    g.stroke();
    g.restore();

    // ── 사람들 ──
    const order: number[] = [];
    const base0 = i0 * n * FIGHT_STRIDE;
    const base1 = i1 * n * FIGHT_STRIDE;
    for (let i = 0; i < n; i++) if (frames[base0 + i * FIGHT_STRIDE + 7] > 0.01 || frames[base1 + i * FIGHT_STRIDE + 7] > 0.01) order.push(i);
    order.sort((a, b) => frames[base0 + a * FIGHT_STRIDE + 1] - frames[base0 + b * FIGHT_STRIDE + 1]);
    const duel = !!sim.finalists && sim.duelStart >= 0 && s >= sim.duelStart;
    const tags: (() => void)[] = [];
    const standing = sim.alive[Math.min(sim.ticks - 1, Math.round(fpos))];
    // 이름표는 사람이 적거나 크게 보일 때만(많으면 화면이 이름으로 덮인다)
    const nameTags = standing <= 28 || BASE_H * k >= 110;

    for (const i of order) {
      const o0 = base0 + i * FIGHT_STRIDE;
      const o1 = base1 + i * FIGHT_STRIDE;
      const x = lerp(frames[o0], frames[o1], fr);
      const z = lerp(frames[o0 + 1], frames[o1 + 1], fr);
      const h = lerp(frames[o0 + 2], frames[o1 + 2], fr);
      const hp = frames[o0 + 3];
      const pose = frames[o0 + 4];
      const pt = frames[o0 + 5];
      const face = frames[o0 + 6] || 1;
      const alpha = lerp(frames[o0 + 7], frames[o1 + 7], fr);
      const flash = frames[o0 + 8];
      const kind = frames[o0 + 9];
      if (alpha <= 0.01) continue;
      const ds = depth(z);
      const hp_px = BASE_H * ds * k;
      const w_px = hp_px * SPRITE_RATIO;
      const fx = toX(x);
      const fy = toY(z);
      const lift = h * k * ds;
      const art = sim.art[i];
      const color = COLOR[art];

      // 그림자
      g.save();
      g.globalAlpha = 0.38 * alpha;
      g.fillStyle = '#05060d';
      g.beginPath();
      const shrink = 1 - clamp(h / 420, 0, 0.6);
      g.ellipse(fx, fy, w_px * 0.34 * shrink, w_px * 0.09 * shrink, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();

      // 자세 → 기울기 · 밀림
      let rot = 0, offX = 0, offY = 0, sx = 1, sy = 1;
      const wob = Math.sin(s * 5.2 + i * 1.7);
      if (pose === POSE.idle) { offY = -Math.abs(wob) * 0.012; sy = 1 + wob * 0.012; }
      else if (pose === POSE.walk) { const ph = pt * Math.PI * 2; offY = -Math.abs(Math.sin(ph)) * 0.04; rot = Math.sin(ph) * 3.5; }
      else if (pose === POSE.windup) { rot = -10 * pt; offX = -0.06 * pt; sy = 1 - 0.05 * pt; sx = 1 + 0.04 * pt; }
      else if (pose === POSE.strike) { rot = kind === MOVE.upper ? 4 : kind === MOVE.wave ? 6 : 13; offX = kind === MOVE.kick ? 0.1 : kind === MOVE.wave ? 0.04 : 0.15; offY = kind === MOVE.upper ? -0.12 : 0; sx = 1.05; }
      else if (pose === POSE.recover) { rot = 9 * (1 - pt); offX = 0.1 * (1 - pt); }
      else if (pose === POSE.hit) { rot = -16 * (1 - pt * 0.7); offX = -0.08 * (1 - pt) + Math.sin(s * 80) * 0.012 * (1 - pt); }
      else if (pose === POSE.block) { rot = -6; offX = -0.04; }
      else if (pose === POSE.down) {
        rot = pt < 0.32 ? -88 * ease(pt / 0.32) : pt < 0.72 ? -88 : -88 * (1 - smooth((pt - 0.72) / 0.28));
      }
      else if (pose === POSE.ko) { rot = -Math.min(88, 30 + pt * 260); }
      else if (pose === POSE.win) { offY = -Math.abs(Math.sin(pt * 5)) * 0.14; sx = sy = 1.06; rot = Math.sin(pt * 9) * 3; }
      else if (pose === POSE.enter) { sy = 1.06; sx = 0.96; }
      else if (pose === POSE.charge) { rot = -5; offX = -0.03; sy = 1 - Math.sin(s * 30) * 0.01; }

      const sheet = sheets[art];
      g.save();
      g.globalAlpha = alpha;
      g.translate(fx + offX * hp_px * face, fy - lift + offY * hp_px);
      g.scale(face * sx, sy);
      g.rotate((rot * Math.PI) / 180);
      if (sheet?.ready) {
        g.drawImage(sheet.img, -w_px / 2, -hp_px, w_px, hp_px);
        if (flash > 0.02 && sheet.white) {
          g.globalAlpha = alpha * flash * 0.85;
          g.drawImage(sheet.white, -w_px / 2, -hp_px, w_px, hp_px);
          g.globalAlpha = alpha;
        }
      } else {
        g.fillStyle = color;
        roundRect(g, -w_px * 0.25, -hp_px, w_px * 0.5, hp_px, w_px * 0.2);
        g.fill();
      }
      // 기술 효과(몸 기준)
      if (hp_px >= 24 && (pose === POSE.strike || pose === POSE.charge || pose === POSE.block)) {
        g.lineCap = 'round';
        if (pose === POSE.block) {
          g.globalAlpha = alpha * 0.7;
          g.strokeStyle = '#9fd0ff';
          g.lineWidth = hp_px * 0.05;
          g.beginPath();
          g.arc(w_px * 0.05, -hp_px * 0.55, hp_px * 0.42, -0.9, 0.9);
          g.stroke();
        } else if (pose === POSE.charge) {
          const r = hp_px * (0.05 + 0.08 * pt);
          g.globalAlpha = alpha;
          g.fillStyle = color;
          g.beginPath(); g.arc(w_px * 0.46, -hp_px * 0.56, r * 1.5, 0, Math.PI * 2); g.globalAlpha = alpha * 0.35; g.fill();
          g.globalAlpha = alpha; g.beginPath(); g.arc(w_px * 0.46, -hp_px * 0.56, r, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#fff'; g.beginPath(); g.arc(w_px * 0.46, -hp_px * 0.56, r * 0.5, 0, Math.PI * 2); g.fill();
        } else if (kind === MOVE.jab) {
          g.globalAlpha = alpha * (1 - pt * 0.6);
          g.strokeStyle = '#fff';
          g.lineWidth = hp_px * 0.05;
          g.beginPath(); g.moveTo(w_px * 0.12, -hp_px * 0.66); g.lineTo(w_px * 0.62, -hp_px * 0.68); g.stroke();
          g.strokeStyle = color;
          g.lineWidth = hp_px * 0.025;
          g.beginPath(); g.moveTo(w_px * 0.2, -hp_px * 0.6); g.lineTo(w_px * 0.56, -hp_px * 0.61); g.stroke();
        } else if (kind === MOVE.kick) {
          g.globalAlpha = alpha * (1 - pt * 0.5);
          g.strokeStyle = color;
          g.lineWidth = hp_px * 0.07;
          g.beginPath(); g.arc(0, -hp_px * 0.42, hp_px * 0.5, -0.7, 0.55); g.stroke();
          g.strokeStyle = '#fff';
          g.lineWidth = hp_px * 0.025;
          g.beginPath(); g.arc(0, -hp_px * 0.42, hp_px * 0.5, -0.5, 0.45); g.stroke();
        } else if (kind === MOVE.upper) {
          g.globalAlpha = alpha * (1 - pt * 0.5);
          g.strokeStyle = color;
          g.lineWidth = hp_px * 0.08;
          g.beginPath(); g.arc(w_px * 0.05, -hp_px * 0.55, hp_px * 0.5, 1.2, -1.35, true); g.stroke();
          g.strokeStyle = '#fff';
          g.lineWidth = hp_px * 0.03;
          g.beginPath(); g.arc(w_px * 0.05, -hp_px * 0.55, hp_px * 0.5, 0.9, -1.2, true); g.stroke();
        }
      }
      g.restore();

      // 머리 위 이름 · 체력(결승은 위쪽 큰 막대가 대신)
      if (!duel && pose !== POSE.ko && pose !== POSE.enter) {
        const ticket = tickets[i];
        const top = fy - lift - hp_px * 1.02;
        if (nameTags && hp_px >= 44 && ticket) {
          tags.push(() => {
            const size = clamp(hp_px * 0.15, 10, 17);
            pill(g, label(ticket, 5), fx, top - size * 1.6, size, { border: color, weight: 700 });
            const bw = Math.max(34, w_px * 0.7);
            g.fillStyle = '#0b1020d9';
            g.fillRect(fx - bw / 2, top - size * 0.45, bw, Math.max(3, size * 0.32));
            g.fillStyle = hp > 50 ? '#7be08f' : hp > 25 ? '#ffd34d' : '#ff5a5a';
            g.fillRect(fx - bw / 2, top - size * 0.45, (bw * clamp(hp, 0, 100)) / 100, Math.max(3, size * 0.32));
          });
        } else if (hp_px >= 20) {
          tags.push(() => {
            const bw = Math.max(14, w_px * 0.6);
            g.fillStyle = '#0b1020cc';
            g.fillRect(fx - bw / 2, top - 4, bw, 3);
            g.fillStyle = hp > 50 ? '#7be08f' : hp > 25 ? '#ffd34d' : '#ff5a5a';
            g.fillRect(fx - bw / 2, top - 4, (bw * clamp(hp, 0, 100)) / 100, 3);
          });
        }
      }
    }
    tags.forEach((f) => f());

    // ── 타격 효과 ──
    const fighterH = (z: number) => BASE_H * depth(z) * k;
    for (const e of events as FightEvent[]) {
      if (e.s > s + 1e-6) break;
      const age = s - e.s;
      if (e.type === 'wave') continue;
      if (age > 1.2) continue;
      const hz = fighterH(e.z);
      if (e.type === 'land') {
        if (age > 0.5) continue;
        const u = age / 0.5;
        g.save();
        g.globalAlpha = (1 - u) * 0.55;
        g.fillStyle = '#d9d2c3';
        for (const side of [-1, 1]) {
          g.beginPath();
          g.ellipse(toX(e.x) + side * hz * (0.2 + u * (e.big ? 0.5 : 0.3)), toY(e.z) - hz * 0.04, hz * (0.12 + u * 0.12), hz * 0.05, 0, 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
        continue;
      }
      if (e.type === 'ko') {
        if (age > 1.1 || hz < 26) continue;
        const isFinal = sim.finalists && (e.d === sim.finalists[0] || e.d === sim.finalists[1]);
        if (isFinal) continue;
        pill(g, 'K.O.', toX(e.x), toY(e.z) - hz * (1.25 + age * 0.4), clamp(hz * 0.2, 11, 20), { color: '#ffe08a', bg: '#7a2330e6', alpha: 1 - smooth((age - 0.7) / 0.4) });
        continue;
      }
      const isClash = e.type === 'clash';
      const heavy = isClash || (e.type === 'hit' && e.heavy);
      const blocked = e.type === 'hit' && e.blocked;
      const life = heavy ? 0.32 : 0.22;
      const px = toX(e.x);
      const py = toY(e.z) - e.h * depth(e.z) * k;
      if (age <= life) {
        const u = age / life;
        const r = hz * (heavy ? 0.5 : 0.32) * (0.5 + ease(u) * 0.8);
        g.save();
        g.globalAlpha = 1 - u;
        g.lineCap = 'round';
        if (blocked) {
          g.strokeStyle = '#bfe3ff';
          g.lineWidth = Math.max(2, hz * 0.05);
          g.beginPath(); g.arc(px, py, r * 0.8, 0, Math.PI * 2); g.stroke();
        } else {
          const rays = heavy ? 10 : 7;
          const ac = e.type === 'hit' && e.a >= 0 ? COLOR[sim.art[e.a]] : '#ffd781';
          for (let r0 = 0; r0 < rays; r0++) {
            const ang = (r0 / rays) * Math.PI * 2 + e.s * 7;
            const inner = r * 0.3;
            const outer = r * (r0 % 2 ? 0.8 : 1.15);
            g.strokeStyle = r0 % 2 ? ac : '#fff7cf';
            g.lineWidth = Math.max(1.5, hz * (heavy ? 0.05 : 0.035));
            g.beginPath();
            g.moveTo(px + Math.cos(ang) * inner, py + Math.sin(ang) * inner);
            g.lineTo(px + Math.cos(ang) * outer, py + Math.sin(ang) * outer);
            g.stroke();
          }
          g.fillStyle = '#ffffff';
          g.beginPath(); g.arc(px, py, r * 0.28 * (1 - u), 0, Math.PI * 2); g.fill();
          if (heavy) {
            g.strokeStyle = isClash ? '#ffe08a' : ac;
            g.lineWidth = Math.max(1.5, hz * 0.03);
            g.beginPath(); g.arc(px, py, r * 1.25, 0, Math.PI * 2); g.stroke();
          }
        }
        g.restore();
      }
      // 피해 숫자(가까이 볼 때만)
      if (e.type === 'hit' && !e.blocked && hz >= 70 && age < 0.75 && !e.final) {
        const u = age / 0.75;
        g.save();
        g.globalAlpha = 1 - smooth((u - 0.55) / 0.45);
        g.font = `italic 700 ${clamp(hz * 0.16, 14, 34)}px ${DISPLAY}`;
        g.textAlign = 'center';
        g.lineWidth = clamp(hz * 0.03, 3, 6);
        g.strokeStyle = '#140d1c';
        const txt = `-${Math.max(1, Math.round(e.dmg))}`;
        const ty = py - hz * (0.25 + ease(u) * 0.35);
        g.strokeText(txt, px, ty);
        g.fillStyle = e.heavy ? '#ffb14d' : '#fff3c4';
        g.fillText(txt, px, ty);
        g.restore();
      }
    }
    // 장풍
    for (const e of events) {
      if (e.type !== 'wave' || s < e.s || s > e.s1 + 0.05) continue;
      const u = clamp((s - e.s) / (e.s1 - e.s), 0, 1);
      const hz = fighterH(e.z);
      const wx = lerp(e.x0, e.x1, u);
      const py = toY(e.z) - 46 * depth(e.z) * k;
      const col = e.a >= 0 ? COLOR[sim.art[e.a]] : '#7fd8ff';
      const dir = Math.sign(e.x1 - e.x0) || 1;
      g.save();
      for (let tr = 4; tr >= 0; tr--) {
        g.globalAlpha = 0.18 + (4 - tr) * 0.16;
        g.fillStyle = tr === 0 ? '#ffffff' : col;
        g.beginPath();
        g.arc(toX(wx - dir * tr * 14), py, hz * (tr === 0 ? 0.08 : 0.15 - tr * 0.018), 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }

    // ── 화면 글씨 ──
    const left = standing;
    const pad = 22 * U;
    const hudTop = 58 * U;
    if (s < tl.ko + 0.2 && !duel) {
      g.save();
      g.textBaseline = 'top';
      g.font = `700 ${15 * U}px ${FONT}`;
      g.fillStyle = '#f6dc93';
      g.lineWidth = 4 * U;
      g.strokeStyle = '#0b1020';
      g.strokeText('FREETIFUL FIGHT', pad, hudTop);
      g.fillText('FREETIFUL FIGHT', pad, hudTop);
      g.font = `700 ${34 * U}px ${FONT}`;
      g.fillStyle = '#ffffff';
      const countText = `남은 ${left}명`;
      g.strokeText(countText, pad, hudTop + 22 * U);
      g.fillText(countText, pad, hudTop + 22 * U);
      g.restore();
      // K.O. 목록 — 방금 떨어진 사람들
      const recent = events.filter((e): e is Extract<FightEvent, { type: 'ko' }> => e.type === 'ko' && e.s <= s && s - e.s < 3.2).slice(-6);
      recent.forEach((e, idx) => {
        const age = s - e.s;
        const y = 78 * U + (recent.length - 1 - idx) * 30 * U;
        pill(g, `${label(tickets[e.d], 6)} K.O.`, W - pad, y, 14 * U, { align: 'right', alpha: Math.min(ease(age / 0.15), 1 - smooth((age - 2.6) / 0.6)), border: COLOR[sim.art[e.d]] });
      });
    }

    // 결승 체력 막대
    if (duel && sim.finalists && s < tl.end) {
      const [a, b] = sim.finalists;
      const hpOf = (i: number) => frames[base0 + i * FIGHT_STRIDE + 3];
      const show = ease((s - sim.duelStart) / 0.5);
      const barW = Math.min(W * 0.38, 420 * U);
      const barH = 16 * U;
      const y = pad + 6 * U - (1 - show) * 60 * U;
      ([[a, -1], [b, 1]] as const).forEach(([i, side]) => {
        const x0 = side < 0 ? W / 2 - 44 * U - barW : W / 2 + 44 * U;
        g.save();
        g.fillStyle = '#0b1020e6';
        roundRect(g, x0 - 3 * U, y - 3 * U, barW + 6 * U, barH + 6 * U, 5 * U);
        g.fill();
        g.fillStyle = '#4a1620';
        g.fillRect(x0, y, barW, barH);
        const fill = (barW * clamp(hpOf(i), 0, 100)) / 100;
        g.fillStyle = hpOf(i) > 30 ? '#ffd34d' : '#ff5a5a';
        g.fillRect(side < 0 ? x0 + barW - fill : x0, y, fill, barH);
        g.font = `700 ${17 * U}px ${FONT}`;
        g.textBaseline = 'top';
        g.textAlign = side < 0 ? 'right' : 'left';
        g.lineWidth = 4 * U;
        g.strokeStyle = '#0b1020';
        const name = label(tickets[i], 8);
        const nx = side < 0 ? x0 + barW : x0;
        g.strokeText(name, nx, y + barH + 8 * U);
        g.fillStyle = '#ffffff';
        g.fillText(name, nx, y + barH + 8 * U);
        g.restore();
      });
      banner(g, 'VS', W / 2, y + barH / 2, 26 * U, show);
    }

    // 큰 글씨
    if (s < tl.fight) {
      const inA = ease((s - 0.2) / 0.4);
      const outA = 1 - smooth((s - (tl.fight - 0.5)) / 0.35);
      banner(g, 'FREETIFUL FIGHT', W / 2, H * 0.3, 64 * U, inA * outA, 0.9 + inA * 0.1);
      pill(g, n > 1 ? `참가자 ${n}명 전원 입장` : '단독 출전', W / 2, H * 0.3 + 56 * U, 20 * U, { alpha: inA * outA, color: '#f6dc93' });
    }
    if (n > 1 && s >= tl.fight - 0.3 && s < tl.fight + 0.9) {
      const u = (s - (tl.fight - 0.3)) / 1.2;
      banner(g, 'FIGHT!', W / 2, H * 0.36, 110 * U, 1 - smooth((u - 0.7) / 0.3), lerp(1.6, 1, ease(u / 0.18)));
    }
    if (duel && sim.duelStart >= 0 && s < sim.duelStart + tl.walk + 0.5 && n > 2) {
      const u = (s - sim.duelStart) / (tl.walk + 0.5);
      banner(g, 'FINAL ROUND', W / 2, H * 0.36, 84 * U, ease(u / 0.15) * (1 - smooth((u - 0.75) / 0.25)), lerp(1.4, 1, ease(u / 0.2)));
    }
    if (n > 1 && s >= tl.ko && s < tl.end) {
      const u = s - tl.ko;
      banner(g, 'K.O.', W / 2, H * 0.34, 150 * U, ease(u / 0.12) * (1 - smooth((u - 1.6) / 0.4)), lerp(2.2, 1, ease(u / 0.25)), '#ffd34d');
    }
    if (s >= tl.ko + 1.4 || n === 1) {
      const u = n === 1 ? (s - tl.fight) / 0.6 : (s - (tl.ko + 1.4)) / 0.5;
      const win = tickets[sim.winner];
      banner(g, 'WINNER', W / 2, H * 0.2, 70 * U, ease(u), lerp(1.3, 1, ease(u)));
      if (win) pill(g, `${no(win)} ${win.name}`, W / 2, H * 0.2 + 62 * U, 26 * U, { alpha: ease(u), color: '#ffe08a', border: '#f6dc93' });
    }
  }, [sim, tickets, events, n, plan.duration]);

  useLayoutEffect(() => { draw(); }, [t, draw]);

  useEffect(() => {
    loadArt();
    redraws.add(draw);
    const wrap = box.current;
    const ro = typeof ResizeObserver !== 'undefined' && wrap ? new ResizeObserver(() => draw()) : null;
    if (ro && wrap) ro.observe(wrap);
    draw();
    return () => {
      redraws.delete(draw);
      ro?.disconnect();
    };
  }, [draw]);

  return (
    <div ref={box} className="rdv-art rdv-fight-art rdv-fight-canvas">
      <canvas ref={canvas} />
    </div>
  );
}
