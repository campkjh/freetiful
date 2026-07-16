'use client';

/* ═══════════════════════════════════════════════════════════════════
   큐피드 눈빛 — 프리티풀 오리지널 미니게임 (매칭 대기 중 즐기기)
   조작감 컨셉: 하단 큐피드 사회자가 커서/터치 방향으로 "눈빛 빔"을 조준·발사,
   지나가는 하객에게 빔을 유지하면 설렘 게이지가 차오르고 → 매혹되면 득점.
   시간이 지날수록 애정 게이지가 줄고(0이면 종료), 연속 매혹 시 콤보 배수 UP.
   ※ 모든 캐릭터·그래픽·코드는 캔버스로 직접 그린 오리지널 창작물(파스텔 애니풍).
   ═════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';

type Kind = 'bride' | 'groom' | 'guest' | 'grumpy';
type Guest = {
  x: number; y: number; vx: number; lane: number; scale: number; dir: number;
  kind: Kind; outfit: string; outfitDark: string; skin: number; hair: number;
  charge: number; alive: boolean; charmed: boolean; grumpy: boolean;
  walk: number; base: number; scoreVal: number; pop: number;
};
type Heart = { x: number; y: number; vx: number; vy: number; life: number; size: number; hue: string; rot: number; vr: number };
type FloatTxt = { x: number; y: number; t: number; text: string; color: string };
type Spark = { x: number; y: number; t: number; r: number };
type Bokeh = { x: number; y: number; r: number; a: number; vy: number; hue: string };

const BEST_KEY = 'wmc_gaze_best';
const LANES = [0.58, 0.74, 0.92];

/* 파스텔 애니 팔레트 */
const SKIN = [
  { base: '#FFE3D3', shad: '#F6C9B4', hi: '#FFF4EC' },
  { base: '#FBD3AE', shad: '#EDBE97', hi: '#FFF0E3' },
  { base: '#F5C6A8', shad: '#E4AE8C', hi: '#FDE7D6' },
];
const HAIR = [
  { base: '#F4C87B', hi: '#FFE1A8' }, // 금발
  { base: '#6B4F4A', hi: '#8A6A62' }, // 브라운
  { base: '#FFB3C7', hi: '#FFD0DE' }, // 핑크
  { base: '#3E3644', hi: '#5C5266' }, // 다크
];
const GUEST_OUTFITS = [
  { c: '#B8E6D2', d: '#96D2B8' }, // 민트
  { c: '#FFD3B6', d: '#F3B892' }, // 피치
  { c: '#D6C8FF', d: '#BCA8F0' }, // 라벤더
  { c: '#FFE9A8', d: '#F3D480' }, // 버터
  { c: '#AFCBFF', d: '#8EB0F0' }, // 파스텔블루
];
const PINK = '#FF5D8F';
const PINK_SOFT = '#FFC2D6';

function rint(a: number, b: number) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pick<T>(a: T[]) { return a[Math.floor(Math.random() * a.length)]; }

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export default function GazeGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [love, setLove] = useState(100);
  const [best, setBest] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'play' | 'over'>('idle');
  const [rank, setRank] = useState('');
  const startedRef = useRef(false);

  const s = useRef({
    W: 0, H: 0, dpr: 1,
    guests: [] as Guest[], hearts: [] as Heart[], floats: [] as FloatTxt[], sparks: [] as Spark[], bokeh: [] as Bokeh[],
    aimX: 0, aimY: 0, firing: false,
    score: 0, combo: 0, comboTimer: 0, love: 100,
    spawnAcc: 0, last: 0, raf: 0, running: false, t: 0, eyeGlow: 0, shake: 0,
  });

  const commit = useCallback(() => {
    const g = s.current;
    setScore(g.score); setCombo(g.combo); setLove(Math.max(0, Math.round(g.love)));
  }, []);

  useEffect(() => {
    try { const b = Number(localStorage.getItem(BEST_KEY) || '0'); if (Number.isFinite(b)) setBest(b); } catch {}
  }, []);

  const resize = useCallback(() => {
    const c = canvasRef.current, w = wrapRef.current;
    if (!c || !w) return;
    const r = w.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const g = s.current;
    g.W = r.width; g.H = r.height; g.dpr = dpr;
    if (!g.aimX) { g.aimX = r.width / 2; g.aimY = r.height * 0.42; }
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    c.style.width = `${r.width}px`; c.style.height = `${r.height}px`;
    const ctx = c.getContext('2d'); if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  const initBokeh = useCallback(() => {
    const g = s.current; g.bokeh = [];
    for (let i = 0; i < 9; i++) {
      g.bokeh.push({
        x: Math.random() * g.W, y: Math.random() * g.H,
        r: 5 + Math.random() * 12, a: 0.04 + Math.random() * 0.07,
        vy: -(0.05 + Math.random() * 0.12), hue: Math.random() < 0.5 ? PINK_SOFT : '#AFCBFF',
      });
    }
  }, []);

  const spawnGuest = useCallback(() => {
    const g = s.current;
    if (g.W === 0) return;
    const lane = rint(0, LANES.length - 1);
    const fromLeft = Math.random() < 0.5;
    const scale = 0.7 + lane * 0.2;
    const speed = (0.5 + Math.random() * 0.28) * (1.28 - lane * 0.16);
    const grumpy = Math.random() < 0.15;
    let kind: Kind;
    let outfit = '#FFFFFF', outfitDark = '#EAD9EF';
    if (grumpy) { kind = 'grumpy'; outfit = '#B9C0CC'; outfitDark = '#97A0AE'; }
    else {
      kind = pick<Kind>(['bride', 'groom', 'guest', 'guest']);
      if (kind === 'bride') { outfit = '#FFF3FA'; outfitDark = '#E4D2E4'; }
      else if (kind === 'groom') { outfit = '#2E3350'; outfitDark = '#20233B'; }
      else { const o = pick(GUEST_OUTFITS); outfit = o.c; outfitDark = o.d; }
    }
    g.guests.push({
      x: fromLeft ? -34 : g.W + 34, y: g.H * LANES[lane], dir: fromLeft ? 1 : -1,
      vx: (fromLeft ? 1 : -1) * speed, lane, scale, kind, outfit, outfitDark,
      skin: rint(0, SKIN.length - 1), hair: grumpy ? 3 : rint(0, HAIR.length - 1),
      charge: 0, alive: true, charmed: false, grumpy,
      walk: Math.random() * Math.PI * 2, base: g.H * LANES[lane],
      scoreVal: (lane + 1) * 100, pop: 0,
    });
  }, []);

  /* ── 하객 캐릭터 (오리지널 파스텔 애니) ── */
  const drawGuest = useCallback((ctx: CanvasRenderingContext2D, gt: Guest) => {
    const sc = gt.scale;
    const skin = SKIN[gt.skin], hair = HAIR[gt.hair];
    const detail = sc > 0.82;
    const headR = 11 * sc;
    const bodyW = 22 * sc, bodyH = 26 * sc;
    const bob = Math.sin(gt.walk) * 1.4 * sc;
    const squash = 1 + Math.sin(gt.walk) * 0.03;
    ctx.save();
    ctx.translate(gt.x, gt.y + bob);
    ctx.scale(gt.dir, 1); // 진행 방향
    if (gt.pop > 0) { const p = 1 + gt.pop * 0.25; ctx.scale(p, p); }

    // 바닥 그림자
    ctx.fillStyle = 'rgba(80,70,110,0.13)';
    ctx.beginPath(); ctx.ellipse(0, bodyH * 0.5 + 2, bodyW * 0.5, 3.4 * sc, 0, 0, Math.PI * 2); ctx.fill();

    // 다리(걷기)
    const legSwing = Math.sin(gt.walk) * 3 * sc;
    ctx.strokeStyle = gt.kind === 'groom' ? '#20233B' : skin.shad;
    ctx.lineWidth = 3 * sc; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-3 * sc, bodyH * 0.42); ctx.lineTo(-3 * sc + legSwing, bodyH * 0.62); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3 * sc, bodyH * 0.42); ctx.lineTo(3 * sc - legSwing, bodyH * 0.62); ctx.stroke();

    // 몸통(드레스/정장)
    const bodyTop = -bodyH * 0.32;
    const grad = ctx.createLinearGradient(0, bodyTop, 0, bodyH * 0.5);
    grad.addColorStop(0, gt.outfit); grad.addColorStop(1, gt.outfitDark);
    ctx.fillStyle = grad;
    ctx.save(); ctx.scale(squash, 1 / squash);
    ctx.beginPath();
    if (gt.kind === 'bride') {
      ctx.moveTo(-bodyW * 0.28, bodyTop); ctx.lineTo(bodyW * 0.28, bodyTop);
      ctx.quadraticCurveTo(bodyW * 0.42, bodyH * 0.1, bodyW * 0.56, bodyH * 0.48);
      ctx.lineTo(-bodyW * 0.56, bodyH * 0.48);
      ctx.quadraticCurveTo(-bodyW * 0.42, bodyH * 0.1, -bodyW * 0.28, bodyTop);
    } else {
      ctx.moveTo(-bodyW * 0.4, bodyTop);
      ctx.quadraticCurveTo(-bodyW * 0.5, bodyH * 0.2, -bodyW * 0.42, bodyH * 0.48);
      ctx.lineTo(bodyW * 0.42, bodyH * 0.48);
      ctx.quadraticCurveTo(bodyW * 0.5, bodyH * 0.2, bodyW * 0.4, bodyTop);
    }
    ctx.closePath(); ctx.fill();
    ctx.lineWidth = 0.9 * sc; ctx.strokeStyle = 'rgba(120,95,140,0.20)'; ctx.stroke();
    // 정장 셔츠/넥타이 or 드레스 하이라이트
    if (gt.kind === 'groom') {
      ctx.fillStyle = '#F4F6FF';
      ctx.beginPath(); ctx.moveTo(0, bodyTop); ctx.lineTo(-3.2 * sc, bodyH * 0.4); ctx.lineTo(3.2 * sc, bodyH * 0.4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = PINK; ctx.beginPath(); ctx.moveTo(0, bodyTop + 2 * sc); ctx.lineTo(-2.4 * sc, bodyTop + 6 * sc); ctx.lineTo(0, bodyTop + 9 * sc); ctx.lineTo(2.4 * sc, bodyTop + 6 * sc); ctx.closePath(); ctx.fill();
    } else if (gt.kind === 'bride') {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1 * sc;
      ctx.beginPath(); ctx.moveTo(-bodyW * 0.2, bodyH * 0.05); ctx.quadraticCurveTo(0, bodyH * 0.16, bodyW * 0.2, bodyH * 0.05); ctx.stroke();
    }
    ctx.restore();

    // 머리
    const hy = bodyTop - headR * 0.72;
    // 신부 베일(머리 뒤로 → 얼굴 가리지 않게)
    if (gt.kind === 'bride') {
      ctx.save(); ctx.globalAlpha = 0.72; ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(-headR * 1.05, hy);
      ctx.quadraticCurveTo(0, hy - headR * 1.5, headR * 1.05, hy);
      ctx.quadraticCurveTo(headR * 1.55, hy + headR * 2.2, 0, hy + headR * 2.5);
      ctx.quadraticCurveTo(-headR * 1.55, hy + headR * 2.2, -headR * 1.05, hy);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(232,201,121,0.5)'; ctx.lineWidth = 0.8 * sc; ctx.stroke();
      ctx.restore();
    }
    // 뒤 머리카락
    ctx.fillStyle = hair.base;
    ctx.beginPath(); ctx.arc(0, hy, headR * 1.18, Math.PI * 0.05, Math.PI * 0.95); ctx.fill();
    // 얼굴
    const fg = ctx.createLinearGradient(0, hy - headR, 0, hy + headR);
    fg.addColorStop(0, skin.hi); fg.addColorStop(0.5, skin.base); fg.addColorStop(1, skin.shad);
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0, hy, headR, 0, Math.PI * 2); ctx.fill();
    // 앞머리 뱅
    ctx.fillStyle = hair.base;
    ctx.beginPath();
    ctx.arc(0, hy - headR * 0.15, headR, Math.PI * 1.03, Math.PI * 1.97);
    ctx.quadraticCurveTo(headR * 0.5, hy - headR * 0.2, headR * 0.9, hy - headR * 0.05);
    ctx.quadraticCurveTo(headR * 0.2, hy - headR * 0.55, 0, hy - headR * 0.2);
    ctx.quadraticCurveTo(-headR * 0.2, hy - headR * 0.55, -headR * 0.9, hy - headR * 0.05);
    ctx.quadraticCurveTo(-headR * 0.5, hy - headR * 0.2, 0, hy - headR * 0.15);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = hair.hi;
    ctx.beginPath(); ctx.ellipse(-headR * 0.35, hy - headR * 0.62, headR * 0.34, headR * 0.12, -0.5, 0, Math.PI * 2); ctx.fill();

    // 얼굴 요소
    const ex = headR * 0.4, ey = hy + headR * 0.12;
    if (gt.grumpy) {
      ctx.strokeStyle = '#5C6270'; ctx.lineWidth = 1.6 * sc; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-ex - 1.6 * sc, ey - 1.6 * sc); ctx.lineTo(-ex + 1.6 * sc, ey + 0.4 * sc); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex + 1.6 * sc, ey - 1.6 * sc); ctx.lineTo(ex - 1.6 * sc, ey + 0.4 * sc); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-2 * sc, hy + headR * 0.55); ctx.quadraticCurveTo(0, hy + headR * 0.4, 2 * sc, hy + headR * 0.55); ctx.stroke();
    } else if (detail) {
      // 큰 눈(흰자+홍채+동공+하이라이트)
      for (const sx of [-ex, ex]) {
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.ellipse(sx, ey, 2.6 * sc, 3.1 * sc, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5B8DEF'; ctx.beginPath(); ctx.arc(sx, ey + 0.3 * sc, 2.0 * sc, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2A2340'; ctx.beginPath(); ctx.arc(sx, ey + 0.4 * sc, 1.1 * sc, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(sx - 0.7 * sc, ey - 0.7 * sc, 0.8 * sc, 0, Math.PI * 2); ctx.fill();
      }
      // 미소
      ctx.strokeStyle = '#C8607A'; ctx.lineWidth = 1.1 * sc; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-1.6 * sc, hy + headR * 0.5); ctx.quadraticCurveTo(0, hy + headR * 0.66, 1.6 * sc, hy + headR * 0.5); ctx.stroke();
    } else {
      ctx.fillStyle = '#2A2340';
      ctx.beginPath(); ctx.arc(-ex, ey, 1.4 * sc, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex, ey, 1.4 * sc, 0, Math.PI * 2); ctx.fill();
    }
    // 볼터치
    if (!gt.grumpy) {
      ctx.fillStyle = 'rgba(255,158,184,0.6)';
      ctx.beginPath(); ctx.arc(-headR * 0.62, ey + headR * 0.28, 1.7 * sc, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(headR * 0.62, ey + headR * 0.28, 1.7 * sc, 0, Math.PI * 2); ctx.fill();
    }

    // 액세서리
    if (gt.kind === 'bride') {
      // 티아라(골드)
      ctx.strokeStyle = '#E8C979'; ctx.lineWidth = 1.5 * sc; ctx.shadowColor = '#E8C979'; ctx.shadowBlur = 4;
      ctx.beginPath(); ctx.arc(0, hy - headR * 0.5, headR * 0.92, Math.PI * 1.18, Math.PI * 1.82); ctx.stroke();
      ctx.shadowBlur = 0; ctx.fillStyle = '#FFE08A';
      ctx.beginPath(); ctx.arc(0, hy - headR * 1.02, 1.7 * sc, 0, Math.PI * 2); ctx.fill();
    } else if (gt.kind === 'groom') {
      // 정장 머리(깔끔) + 나비넥타이는 몸에
      ctx.fillStyle = hair.base; ctx.beginPath(); ctx.arc(0, hy - headR * 0.55, headR * 0.9, Math.PI * 1.1, Math.PI * 1.9); ctx.fill();
    } else if (!gt.grumpy) {
      // 꽃 화관
      for (let i = 0; i < 3; i++) { const a = -0.7 + i * 0.7; ctx.fillStyle = i === 1 ? PINK : PINK_SOFT; ctx.beginPath(); ctx.arc(Math.sin(a) * headR * 0.85, hy - headR * 0.85 - Math.cos(a) * 1.5 * sc, 1.8 * sc, 0, Math.PI * 2); ctx.fill(); }
    } else {
      // 심술: 먹구름
      ctx.fillStyle = '#8A93A3';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc((-1 + i) * 3 * sc, hy - headR * 1.05, 2.2 * sc, 0, Math.PI * 2); ctx.fill(); }
    }

    // 설렘 게이지 링
    if (gt.charge > 0.02 && !gt.charmed) {
      ctx.save(); ctx.scale(gt.dir, 1);
      ctx.strokeStyle = PINK; ctx.lineWidth = 2.4 * sc; ctx.lineCap = 'round';
      ctx.shadowColor = PINK; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(0, hy, headR + 5.5 * sc, -Math.PI / 2, -Math.PI / 2 + gt.charge * Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }, []);

  /* ── 큐피드 사회자(플레이어) ── */
  const drawPlayer = useCallback((ctx: CanvasRenderingContext2D, g: typeof s.current) => {
    const px = g.W / 2, py = g.H - 6;
    const glow = 0.55 + Math.sin(g.eyeGlow) * 0.45;
    ctx.save();
    ctx.translate(px, py);
    // 날개
    ctx.fillStyle = 'rgba(240,245,255,0.9)';
    for (const dir of [-1, 1]) {
      ctx.save(); ctx.scale(dir, 1);
      ctx.beginPath(); ctx.moveTo(14, -30);
      ctx.quadraticCurveTo(30, -40, 34, -24); ctx.quadraticCurveTo(30, -20, 16, -22); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // 그림자
    ctx.fillStyle = 'rgba(80,70,110,0.15)'; ctx.beginPath(); ctx.ellipse(0, 4, 20, 4, 0, 0, Math.PI * 2); ctx.fill();
    // 몸(브랜드 블루 턱시도)
    const bg = ctx.createLinearGradient(0, -24, 0, 6);
    bg.addColorStop(0, '#3182F6'); bg.addColorStop(1, '#1B64DA');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.moveTo(-17, 4); ctx.quadraticCurveTo(-19, -18, -6, -24); ctx.lineTo(6, -24); ctx.quadraticCurveTo(19, -18, 17, 4); ctx.closePath(); ctx.fill();
    // 흰 셔츠 V
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(-5, 3); ctx.lineTo(5, 3); ctx.closePath(); ctx.fill();
    // 라펠
    ctx.fillStyle = '#1B64DA';
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(-7.5, -20); ctx.lineTo(-2, -9); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(7.5, -20); ctx.lineTo(2, -9); ctx.closePath(); ctx.fill();
    // 골드 보타이
    ctx.fillStyle = '#C9A24B';
    ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(-6, -22); ctx.lineTo(-6, -16); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(6, -22); ctx.lineTo(6, -16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#E8C979'; ctx.beginPath(); ctx.arc(0, -19, 1.5, 0, Math.PI * 2); ctx.fill();
    // 핑크 부토니에르
    ctx.fillStyle = PINK; ctx.beginPath(); ctx.arc(-8, -13, 1.9, 0, Math.PI * 2); ctx.fill();
    // 뒷머리
    ctx.fillStyle = HAIR[0].base; ctx.beginPath(); ctx.arc(0, -32, 13.5, Math.PI * 0.05, Math.PI * 0.95); ctx.fill();
    // 머리
    const fg = ctx.createLinearGradient(0, -44, 0, -20);
    fg.addColorStop(0, '#FFF4EC'); fg.addColorStop(1, '#FFE3D3');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0, -32, 12, 0, Math.PI * 2); ctx.fill();
    // 앞머리
    ctx.fillStyle = HAIR[0].base;
    ctx.beginPath(); ctx.arc(0, -34, 12, Math.PI * 1.02, Math.PI * 1.98);
    ctx.quadraticCurveTo(6, -40, 11, -33); ctx.quadraticCurveTo(3, -44, 0, -37); ctx.quadraticCurveTo(-3, -44, -11, -33); ctx.quadraticCurveTo(-6, -40, 0, -34); ctx.closePath(); ctx.fill();
    ctx.fillStyle = HAIR[0].hi; ctx.beginPath(); ctx.ellipse(-4, -40, 3.5, 1.3, -0.5, 0, Math.PI * 2); ctx.fill();
    // 헤드셋 마이크(사회자)
    ctx.strokeStyle = '#3A3A48'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, -33, 12.5, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.strokeStyle = '#3A3A48'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(9.5, -30); ctx.quadraticCurveTo(11, -26, 6, -25); ctx.stroke();
    ctx.fillStyle = PINK; ctx.beginPath(); ctx.arc(6, -25, 1.6, 0, Math.PI * 2); ctx.fill();
    // 빛나는 하트 눈빛
    ctx.fillStyle = PINK; ctx.shadowColor = PINK; ctx.shadowBlur = g.firing ? 12 : 6;
    ctx.globalAlpha = g.firing ? 1 : glow;
    for (const sx of [-4.2, 4.2]) {
      ctx.beginPath();
      ctx.moveTo(sx, -30.5);
      ctx.bezierCurveTo(sx - 2.2, -33, sx - 3.2, -29.8, sx, -28);
      ctx.bezierCurveTo(sx + 3.2, -29.8, sx + 2.2, -33, sx, -30.5);
      ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    // 볼터치 + 미소
    ctx.fillStyle = 'rgba(255,158,184,0.6)';
    ctx.beginPath(); ctx.arc(-6.5, -27, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6.5, -27, 1.8, 0, Math.PI * 2); ctx.fill();
    // 헤일로
    ctx.strokeStyle = '#FFDF9E'; ctx.lineWidth = 2; ctx.shadowColor = '#FFDF9E'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.ellipse(0, -46, 8, 3, 0, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.restore();
  }, []);

  /* ── 눈빛 빔 ── */
  const drawBeam = useCallback((ctx: CanvasRenderingContext2D, g: typeof s.current) => {
    const px = g.W / 2, py = g.H - 34;
    const dx = g.aimX - px, dy = g.aimY - py;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;
    const len = Math.min(dist, g.H * 1.15);
    const ex = px + ux * len, ey = py + uy * len;
    ctx.save();
    const grad = ctx.createLinearGradient(px, py, ex, ey);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.45, 'rgba(255,93,143,0.8)');
    grad.addColorStop(1, 'rgba(255,93,143,0)');
    ctx.lineCap = 'round'; ctx.strokeStyle = grad;
    ctx.shadowColor = PINK; ctx.shadowBlur = 16;
    ctx.lineWidth = 8; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.lineWidth = 2.6; ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey); ctx.stroke();
    // 빔을 따라 흐르는 반짝임
    ctx.shadowBlur = 8; ctx.fillStyle = '#FFF';
    for (let k = 0; k < 3; k++) {
      const f = ((g.t * 0.05 + k / 3) % 1);
      ctx.globalAlpha = 0.8 * (1 - f);
      ctx.beginPath(); ctx.arc(px + ux * len * f, py + uy * len * f, 1.6 + f * 1.4, 0, Math.PI * 2); ctx.fill();
    }
    // 조준 하트 리티클(펄스)
    ctx.globalAlpha = 1; ctx.shadowBlur = 10; ctx.fillStyle = '#FF3D77';
    const pulse = 1 + Math.sin(g.t * 0.2) * 0.15;
    ctx.save(); ctx.translate(g.aimX, g.aimY); ctx.scale(pulse, pulse);
    ctx.beginPath(); ctx.moveTo(0, 1.5); ctx.bezierCurveTo(-4, -3, -6, 2, 0, 5.5); ctx.bezierCurveTo(6, 2, 4, -3, 0, 1.5); ctx.fill();
    ctx.restore();
    ctx.restore();
  }, []);

  const charm = useCallback((gt: Guest) => {
    const g = s.current;
    gt.charmed = true; gt.alive = false;
    g.combo += 1; g.comboTimer = 1700;
    const mult = Math.max(1, g.combo);
    const gained = gt.scoreVal * mult;
    g.score += gained;
    g.love = Math.min(100, g.love + 8);
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.6;
      g.hearts.push({ x: gt.x, y: gt.y - 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.1, life: 1, size: 6 + Math.random() * 7, hue: pick(['#FF5D8F', '#FF9DBB', '#FFC53D', '#FFFFFF']), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4 });
    }
    for (let i = 0; i < 3; i++) g.sparks.push({ x: gt.x, y: gt.y - 8, t: 1, r: 6 + i * 8 });
    g.floats.push({ x: gt.x, y: gt.y - 22, t: 1, text: `+${gained}${mult > 1 ? ` ×${mult}` : ''}`, color: '#FF3D77' });
    g.shake = Math.min(6, 2 + mult * 0.6);
    try { (navigator as any).vibrate?.(12); } catch {}
    try { if (g.score > Number(localStorage.getItem(BEST_KEY) || '0')) localStorage.setItem(BEST_KEY, String(g.score)); } catch {}
    setBest((p) => (g.score > p ? g.score : p));
    commit();
  }, [commit]);

  const gameOver = useCallback(() => {
    const g = s.current;
    g.running = false; startedRef.current = false;
    cancelAnimationFrame(g.raf);
    const sc = g.score;
    setRank(sc >= 8000 ? 'S' : sc >= 4500 ? 'A' : sc >= 2000 ? 'B' : 'C');
    setPhase('over');
  }, []);

  const loop = useCallback((now: number) => {
    const g = s.current;
    if (!g.running) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) { g.raf = requestAnimationFrame(loop); return; }
    const dtMs = Math.min(48, now - (g.last || now));
    g.last = now; const dt = dtMs / 16.6667;
    g.t += dt; g.eyeGlow += dt * 0.12;
    if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 0.6);

    g.spawnAcc += dtMs;
    const every = Math.max(560, 1150 - Math.floor(g.score / 400) * 40);
    if (g.spawnAcc >= every) { g.spawnAcc = 0; spawnGuest(); }

    g.love -= dt * 0.16;
    if (g.love <= 0) { g.love = 0; commit(); gameOver(); return; }

    if (g.comboTimer > 0) { g.comboTimer -= dtMs; if (g.comboTimer <= 0 && g.combo > 0) { g.combo = 0; commit(); } }

    const px = g.W / 2, py = g.H - 34;
    for (const gt of g.guests) {
      if (!gt.alive) continue;
      gt.x += gt.vx * dt * 1.4;
      gt.walk += dt * (0.18 + Math.abs(gt.vx) * 0.05);
      if (gt.pop > 0) gt.pop = Math.max(0, gt.pop - dt * 0.1);
      if (g.firing) {
        const d = distToSeg(gt.x, gt.y - 8 * gt.scale, px, py, g.aimX, g.aimY);
        if (d < 16 * gt.scale) {
          if (gt.grumpy) {
            g.love -= 18; if (g.combo > 0) g.combo = 0; gt.alive = false; g.shake = 5;
            g.floats.push({ x: gt.x, y: gt.y - 18, t: 1, text: '-18 💢', color: '#5A6473' });
            commit();
          } else {
            gt.charge += dt * 0.03; gt.pop = Math.min(0.5, gt.pop + dt * 0.05);
            if (gt.charge >= 1) charm(gt);
          }
        }
      }
      if (gt.alive && (gt.x < -44 || gt.x > g.W + 44)) { gt.alive = false; if (!gt.grumpy && g.combo > 0) { g.combo = 0; commit(); } }
    }
    g.guests = g.guests.filter((gt) => gt.alive);

    for (const h of g.hearts) { h.x += h.vx * dt; h.y += h.vy * dt; h.vy += 0.09 * dt; h.rot += h.vr * dt; h.life -= dtMs / 820; }
    g.hearts = g.hearts.filter((h) => h.life > 0);
    for (const f of g.floats) { f.y -= dt * 0.7; f.t -= dtMs / 950; }
    g.floats = g.floats.filter((f) => f.t > 0);
    for (const sp of g.sparks) { sp.r += dt * 1.6; sp.t -= dtMs / 380; }
    g.sparks = g.sparks.filter((sp) => sp.t > 0);
    for (const bk of g.bokeh) { bk.y += bk.vy * dt; if (bk.y < -bk.r) { bk.y = g.H + bk.r; bk.x = Math.random() * g.W; } }

    // ── 렌더 ──
    ctx.save();
    if (g.shake > 0.3) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
    ctx.clearRect(-10, -10, g.W + 20, g.H + 20);

    // 배경 그라데이션
    const bgG = ctx.createLinearGradient(0, 0, 0, g.H);
    bgG.addColorStop(0, '#FFF6FB'); bgG.addColorStop(0.55, '#FDEDF7'); bgG.addColorStop(1, '#F1E8FF');
    ctx.fillStyle = bgG; ctx.fillRect(0, 0, g.W, g.H);

    // 상단 조명 글로우
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const rg1 = ctx.createRadialGradient(g.W * 0.3, 0, 0, g.W * 0.3, 0, g.H * 0.7);
    rg1.addColorStop(0, 'rgba(255,194,214,0.28)'); rg1.addColorStop(1, 'rgba(255,194,214,0)');
    ctx.fillStyle = rg1; ctx.fillRect(0, 0, g.W, g.H);
    const rg2 = ctx.createRadialGradient(g.W * 0.72, 0, 0, g.W * 0.72, 0, g.H * 0.6);
    rg2.addColorStop(0, 'rgba(175,203,255,0.22)'); rg2.addColorStop(1, 'rgba(175,203,255,0)');
    ctx.fillStyle = rg2; ctx.fillRect(0, 0, g.W, g.H);
    ctx.restore();

    // 보케
    for (const bk of g.bokeh) { ctx.save(); ctx.globalAlpha = bk.a; ctx.fillStyle = bk.hue; ctx.beginPath(); ctx.arc(bk.x, bk.y, bk.r, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }

    // 버진로드(원근 사다리꼴)
    ctx.save();
    const road = ctx.createLinearGradient(0, g.H * 0.5, 0, g.H);
    road.addColorStop(0, 'rgba(255,255,255,0.5)'); road.addColorStop(1, 'rgba(255,232,241,0.85)');
    ctx.fillStyle = road; ctx.beginPath();
    ctx.moveTo(g.W * 0.38, g.H * 0.5); ctx.lineTo(g.W * 0.62, g.H * 0.5); ctx.lineTo(g.W * 1.02, g.H); ctx.lineTo(-g.W * 0.02, g.H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(g.W * 0.5, g.H * 0.5); ctx.lineTo(g.W * 0.5, g.H); ctx.stroke();
    ctx.restore();

    // 하객(뒤→앞)
    [...g.guests].sort((a, b) => a.y - b.y).forEach((gt) => drawGuest(ctx, gt));
    // 빔
    if (g.firing) drawBeam(ctx, g);
    // 플레이어
    drawPlayer(ctx, g);

    // 매혹 링
    for (const sp of g.sparks) { ctx.save(); ctx.globalAlpha = Math.max(0, sp.t) * 0.7; ctx.strokeStyle = PINK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    // 하트 파티클
    for (const h of g.hearts) {
      ctx.save(); ctx.globalAlpha = Math.max(0, h.life); ctx.translate(h.x, h.y); ctx.rotate(h.rot); ctx.fillStyle = h.hue;
      const z = h.size / 12; ctx.scale(z, z);
      ctx.beginPath(); ctx.moveTo(0, 3); ctx.bezierCurveTo(-7, -5, -11, 3, 0, 10); ctx.bezierCurveTo(11, 3, 7, -5, 0, 3); ctx.fill();
      ctx.restore();
    }
    // 점수 플로트
    for (const f of g.floats) { ctx.save(); ctx.globalAlpha = Math.max(0, f.t); ctx.fillStyle = f.color; ctx.font = '800 14px system-ui,-apple-system,sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y); ctx.restore(); }

    ctx.restore();
    g.raf = requestAnimationFrame(loop);
  }, [charm, commit, drawBeam, drawGuest, drawPlayer, gameOver, spawnGuest]);

  const start = useCallback(() => {
    const g = s.current;
    resize();
    g.guests = []; g.hearts = []; g.floats = []; g.sparks = [];
    g.score = 0; g.combo = 0; g.comboTimer = 0; g.love = 100; g.spawnAcc = 0; g.last = 0; g.t = 0; g.shake = 0;
    g.firing = false; g.running = true; startedRef.current = true;
    initBokeh();
    setScore(0); setCombo(0); setLove(100); setPhase('play');
    for (let i = 0; i < 3; i++) spawnGuest();
    cancelAnimationFrame(g.raf);
    g.raf = requestAnimationFrame(loop);
  }, [initBokeh, loop, resize, spawnGuest]);

  const pt = useCallback((clientX: number, clientY: number) => {
    const c = canvasRef.current; if (!c) return;
    const r = c.getBoundingClientRect(); const g = s.current;
    g.aimX = Math.max(0, Math.min(g.W, clientX - r.left));
    g.aimY = Math.max(0, Math.min(g.H, clientY - r.top));
  }, []);

  const loopRef = useRef(loop);
  useEffect(() => { loopRef.current = loop; }, [loop]);

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(() => resize());
    if (wrapRef.current) ro.observe(wrapRef.current);
    const onVis = () => {
      const g = s.current;
      if (document.hidden) { g.running = false; cancelAnimationFrame(g.raf); }
      else if (startedRef.current) { g.running = true; g.last = 0; cancelAnimationFrame(g.raf); g.raf = requestAnimationFrame(loopRef.current); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      ro.disconnect(); document.removeEventListener('visibilitychange', onVis);
      const g = s.current; g.running = false; startedRef.current = false; cancelAnimationFrame(g.raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lovePct = Math.max(0, Math.min(100, love));

  return (
    <div className="mt-6 rounded-[30px] bg-white p-4 shadow-[0_0_18px_0_rgba(127,174,255,0.16)]">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[15px] font-bold text-[#191F28]">기다리는 동안 <span className="text-[#FF5D8F]">큐피드 눈빛</span> 💘</p>
        <p className="text-[12px] font-semibold text-[#8B95A1]">최고 {best.toLocaleString()}</p>
      </div>

      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[22px] font-extrabold tabular-nums text-[#191F28]">{score.toLocaleString()}<span className="ml-1 text-[13px] font-bold text-[#8B95A1]">점</span></p>
        {combo > 1 && <span key={combo} className="wmc-combo rounded-full bg-[#FFF0F5] px-3 py-1 text-[13px] font-extrabold text-[#FF5D8F]">{combo} COMBO 🔥</span>}
      </div>
      {phase === 'play' && (
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="text-[11px] font-bold text-[#FF5D8F]">애정</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#FFE1EC]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#FF9DBB] to-[#FF3D77] transition-[width] duration-200" style={{ width: `${lovePct}%` }} />
          </div>
        </div>
      )}

      <div ref={wrapRef} className="relative w-full overflow-hidden rounded-[22px] bg-[#FDEDF7]" style={{ aspectRatio: '2 / 1', touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
          onPointerMove={(e) => { pt(e.clientX, e.clientY); }}
          onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); pt(e.clientX, e.clientY); s.current.firing = true; }}
          onPointerUp={() => { s.current.firing = false; }}
          onPointerLeave={() => { s.current.firing = false; }}
        />

        {phase !== 'play' && (
          <button
            type="button"
            onClick={start}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/72 backdrop-blur-[2px] active:bg-white/60"
          >
            {phase === 'over' ? (
              <>
                <span className="text-[13px] font-bold text-[#8B95A1]">애정이 다 식었어요…</span>
                <span className="text-[30px] font-black text-[#FF5D8F]">{rank}</span>
                <span className="text-[15px] font-extrabold text-[#191F28]">{score.toLocaleString()}점</span>
                <span className="mt-1 rounded-full bg-[#FF5D8F] px-5 py-2 text-[14px] font-bold text-white shadow-[0_6px_16px_rgba(255,93,143,0.35)]">다시 하기</span>
              </>
            ) : (
              <>
                <span className="text-[32px]">💘</span>
                <span className="text-[15px] font-extrabold text-[#191F28]">지나가는 하객에게 눈빛을!</span>
                <span className="text-[11.5px] leading-snug text-[#8B95A1]">누르고 있는 동안 눈빛 발사 · 설렘 채우면 매혹</span>
                <span className="mt-1 rounded-full bg-[#FF5D8F] px-5 py-2 text-[14px] font-bold text-white shadow-[0_6px_16px_rgba(255,93,143,0.35)]">게임 시작</span>
              </>
            )}
          </button>
        )}
      </div>

      <p className="mt-2 text-center text-[12px] leading-relaxed text-[#8B95A1]">
        커서/터치로 눈빛을 조준하고 <b className="text-[#FF5D8F]">꾹 눌러</b> 발사! 심술 하객(회색)은 피하세요.
      </p>

      <style jsx>{`
        .wmc-combo { animation: wmcComboPop 0.3s cubic-bezier(0.22,1,0.36,1); }
        @keyframes wmcComboPop { 0%{transform:scale(.6);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
      `}</style>
    </div>
  );
}
