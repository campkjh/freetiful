'use client';

/* ═══════════════════════════════════════════════════════════════════
   큐피드 눈빛 — 프리티풀 오리지널 미니게임 (매칭 대기 중 즐기기)
   조작감 컨셉: 하단 큐피드 사회자가 커서/터치 방향으로 "눈빛 빔"을 조준·발사,
   지나가는 하객에게 빔을 유지하면 설렘 게이지가 차오르고 → 매혹되면 득점.
   시간이 지날수록 애정 게이지가 줄고(0이면 종료), 연속 매혹 시 콤보 배수 UP.
   ※ 모든 캐릭터·그래픽·코드는 캔버스로 직접 그린 오리지널 창작물.
   ═════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';

type Guest = {
  x: number; y: number; vx: number; lane: number; scale: number;
  outfit: string; skin: string; hat: 'veil' | 'tux' | 'flower' | 'none';
  charge: number; alive: boolean; charmed: boolean; grumpy: boolean;
  bob: number; base: number; scoreVal: number;
};
type Heart = { x: number; y: number; vx: number; vy: number; life: number; size: number; hue: string };
type FloatTxt = { x: number; y: number; t: number; text: string; color: string };

const BEST_KEY = 'wmc_gaze_best';
const LANES = [0.56, 0.72, 0.9]; // 화면 높이 비율(뒤→앞)
const OUTFITS = ['#F4B6C2', '#A7C7FF', '#FCD9A6', '#C6B8FF', '#9FE0C9', '#FFC1A6'];
const SKINS = ['#FFE0C4', '#FBD3AE', '#F0C39B'];

function rint(a: number, b: number) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pick<T>(arr: T[]) { return arr[Math.floor(Math.random() * arr.length)]; }

/* 점-선분 최단거리 (빔 라인과 하객 충돌 판정) */
function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
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
    guests: [] as Guest[], hearts: [] as Heart[], floats: [] as FloatTxt[],
    aimX: 0, aimY: 0, firing: false,
    score: 0, combo: 0, comboTimer: 0, love: 100,
    spawnAcc: 0, last: 0, raf: 0, running: false, t: 0, eyeGlow: 0,
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
    g.aimX = r.width / 2; g.aimY = r.height * 0.4;
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    c.style.width = `${r.width}px`; c.style.height = `${r.height}px`;
    const ctx = c.getContext('2d'); if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  const spawnGuest = useCallback(() => {
    const g = s.current;
    if (g.W === 0) return;
    const lane = rint(0, LANES.length - 1);
    const fromLeft = Math.random() < 0.5;
    const scale = 0.66 + lane * 0.19;                // 앞 레인일수록 큼
    const speed = (0.55 + Math.random() * 0.3) * (1.25 - lane * 0.18);
    const grumpy = Math.random() < 0.16;             // 심술 하객(방해꾼)
    g.guests.push({
      x: fromLeft ? -30 : g.W + 30,
      y: g.H * LANES[lane],
      vx: (fromLeft ? 1 : -1) * speed,
      lane, scale,
      outfit: grumpy ? '#8B95A1' : pick(OUTFITS),
      skin: pick(SKINS),
      hat: grumpy ? 'none' : pick(['veil', 'tux', 'flower', 'none'] as const),
      charge: 0, alive: true, charmed: false, grumpy,
      bob: Math.random() * Math.PI * 2, base: g.H * LANES[lane],
      scoreVal: (lane + 1) * 100,
    });
  }, []);

  /* ── 캐릭터 드로잉 (오리지널) ── */
  const drawGuest = useCallback((ctx: CanvasRenderingContext2D, gt: Guest) => {
    const sc = gt.scale;
    const bodyW = 26 * sc, bodyH = 30 * sc, headR = 11 * sc;
    ctx.save();
    ctx.translate(gt.x, gt.y + Math.sin(gt.bob) * 1.5 * sc);
    // 그림자
    ctx.fillStyle = 'rgba(60,60,90,0.12)';
    ctx.beginPath(); ctx.ellipse(0, bodyH * 0.62, bodyW * 0.55, 4 * sc, 0, 0, Math.PI * 2); ctx.fill();
    // 몸(라운드 드레스/정장)
    ctx.fillStyle = gt.outfit;
    ctx.beginPath();
    ctx.moveTo(-bodyW / 2, bodyH * 0.5);
    ctx.quadraticCurveTo(-bodyW / 2, -bodyH * 0.2, 0, -bodyH * 0.35);
    ctx.quadraticCurveTo(bodyW / 2, -bodyH * 0.2, bodyW / 2, bodyH * 0.5);
    ctx.closePath(); ctx.fill();
    // 머리
    ctx.fillStyle = gt.skin;
    ctx.beginPath(); ctx.arc(0, -bodyH * 0.45 - headR * 0.6, headR, 0, Math.PI * 2); ctx.fill();
    const hy = -bodyH * 0.45 - headR * 0.6;
    // 눈/표정
    ctx.fillStyle = '#3A3A48';
    if (gt.grumpy) {
      ctx.save(); ctx.translate(-headR * 0.4, hy - headR * 0.1); ctx.rotate(0.3);
      ctx.fillRect(-2 * sc, -0.8 * sc, 4 * sc, 1.6 * sc); ctx.restore();
      ctx.save(); ctx.translate(headR * 0.4, hy - headR * 0.1); ctx.rotate(-0.3);
      ctx.fillRect(-2 * sc, -0.8 * sc, 4 * sc, 1.6 * sc); ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(-headR * 0.38, hy, 1.5 * sc, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(headR * 0.38, hy, 1.5 * sc, 0, Math.PI * 2); ctx.fill();
      // 볼터치
      ctx.fillStyle = 'rgba(255,120,150,0.5)';
      ctx.beginPath(); ctx.arc(-headR * 0.55, hy + headR * 0.35, 1.8 * sc, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(headR * 0.55, hy + headR * 0.35, 1.8 * sc, 0, Math.PI * 2); ctx.fill();
    }
    // 모자/베일/부케
    if (gt.hat === 'veil') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(0, hy - headR * 0.7, headR * 0.95, Math.PI, 0); ctx.fill();
    } else if (gt.hat === 'tux') {
      ctx.fillStyle = '#2A2E39';
      ctx.beginPath(); ctx.arc(0, hy - headR * 0.75, headR * 0.85, Math.PI, 0); ctx.fill();
      ctx.fillRect(-headR, hy - headR * 0.75, headR * 2, 2 * sc);
    } else if (gt.hat === 'flower') {
      ctx.fillStyle = '#FF7BA6';
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * 3 * sc, hy - headR + Math.sin(a) * 3 * sc, 2 * sc, 0, Math.PI * 2); ctx.fill(); }
    }
    // 설렘 게이지 링
    if (gt.charge > 0.02 && !gt.charmed) {
      ctx.strokeStyle = '#FF5D8F'; ctx.lineWidth = 2.4 * sc; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, hy, headR + 5 * sc, -Math.PI / 2, -Math.PI / 2 + gt.charge * Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }, []);

  const drawPlayer = useCallback((ctx: CanvasRenderingContext2D, g: typeof s.current) => {
    const px = g.W / 2, py = g.H - 8;
    ctx.save();
    ctx.translate(px, py);
    // 몸
    ctx.fillStyle = '#3182F6';
    ctx.beginPath(); ctx.moveTo(-16, 4); ctx.quadraticCurveTo(-16, -18, 0, -22); ctx.quadraticCurveTo(16, -18, 16, 4); ctx.closePath(); ctx.fill();
    // 나비넥타이(사회자)
    ctx.fillStyle = '#FF5D8F';
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(-6, -18); ctx.lineTo(-6, -10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(6, -18); ctx.lineTo(6, -10); ctx.closePath(); ctx.fill();
    // 머리
    ctx.fillStyle = '#FFE0C4';
    ctx.beginPath(); ctx.arc(0, -30, 12, 0, Math.PI * 2); ctx.fill();
    // 빛나는 눈(눈빛)
    const glow = 0.6 + Math.sin(g.eyeGlow) * 0.4;
    ctx.fillStyle = `rgba(255,93,143,${g.firing ? 1 : glow})`;
    ctx.shadowColor = '#FF5D8F'; ctx.shadowBlur = g.firing ? 10 : 5;
    ctx.beginPath(); ctx.arc(-4, -31, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -31, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // 큐피드 하트 머리장식
    ctx.fillStyle = '#FF5D8F';
    ctx.font = '12px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('♥', 0, -44);
    ctx.restore();
  }, []);

  const drawBeam = useCallback((ctx: CanvasRenderingContext2D, g: typeof s.current) => {
    const px = g.W / 2, py = g.H - 34;
    const dx = g.aimX - px, dy = g.aimY - py;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;
    const len = Math.min(dist, g.H * 1.1);
    const ex = px + ux * len, ey = py + uy * len;
    ctx.save();
    const grad = ctx.createLinearGradient(px, py, ex, ey);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.5, 'rgba(255,93,143,0.85)');
    grad.addColorStop(1, 'rgba(255,93,143,0)');
    ctx.strokeStyle = grad;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#FF5D8F'; ctx.shadowBlur = 14;
    ctx.lineWidth = 7; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey); ctx.stroke();
    // 조준 하트
    ctx.shadowBlur = 8; ctx.fillStyle = '#FF3D77'; ctx.font = '13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('♥', g.aimX, g.aimY);
    ctx.restore();
    return { px, py, ex, ey };
  }, []);

  const charm = useCallback((gt: Guest) => {
    const g = s.current;
    gt.charmed = true; gt.alive = false;
    g.combo += 1; g.comboTimer = 1700;
    const mult = Math.max(1, g.combo);
    const gained = gt.scoreVal * mult;
    g.score += gained;
    g.love = Math.min(100, g.love + 8);
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.4;
      g.hearts.push({ x: gt.x, y: gt.y - 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 1, size: 6 + Math.random() * 6, hue: pick(['#FF5D8F', '#FF9DBB', '#FFC53D']) });
    }
    g.floats.push({ x: gt.x, y: gt.y - 20, t: 1, text: `+${gained}${mult > 1 ? ` ×${mult}` : ''}`, color: '#FF3D77' });
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
    const r = sc >= 8000 ? 'S' : sc >= 4500 ? 'A' : sc >= 2000 ? 'B' : 'C';
    setRank(r); setPhase('over');
  }, []);

  const loop = useCallback((now: number) => {
    const g = s.current;
    if (!g.running) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) { g.raf = requestAnimationFrame(loop); return; }
    const dtMs = Math.min(48, now - (g.last || now));
    g.last = now; const dt = dtMs / 16.6667;
    g.t += dt; g.eyeGlow += dt * 0.12;

    // 스폰
    g.spawnAcc += dtMs;
    const every = Math.max(560, 1150 - Math.floor(g.score / 400) * 40);
    if (g.spawnAcc >= every) { g.spawnAcc = 0; spawnGuest(); }

    // 애정 게이지 자연 감소(시간 압박)
    g.love -= dt * 0.16;
    if (g.love <= 0) { g.love = 0; commit(); gameOver(); return; }

    // 콤보 타이머
    if (g.comboTimer > 0) { g.comboTimer -= dtMs; if (g.comboTimer <= 0 && g.combo > 0) { g.combo = 0; commit(); } }

    // 빔 좌표
    const px = g.W / 2, py = g.H - 34;

    // 하객 업데이트
    for (const gt of g.guests) {
      if (!gt.alive) continue;
      gt.x += gt.vx * dt * 1.4;
      gt.bob += dt * 0.18;
      // 빔 명중 판정
      if (g.firing) {
        const d = distToSeg(gt.x, gt.y - 8 * gt.scale, px, py, g.aimX, g.aimY);
        const hitR = 16 * gt.scale;
        if (d < hitR) {
          if (gt.grumpy) {
            // 방해꾼에 눈빛 → 애정 감소 + 콤보 리셋(원본 先生 컨셉의 오리지널 변주)
            g.love -= 18; if (g.combo > 0) g.combo = 0;
            gt.alive = false;
            g.floats.push({ x: gt.x, y: gt.y - 18, t: 1, text: '-18 💢', color: '#5A6473' });
            commit();
          } else {
            gt.charge += dt * 0.03;
            if (gt.charge >= 1) charm(gt);
          }
        }
      }
      // 화면 이탈
      if (gt.alive && (gt.x < -40 || gt.x > g.W + 40)) {
        gt.alive = false;
        if (!gt.grumpy && g.combo > 0) { g.combo = 0; commit(); }
      }
    }
    g.guests = g.guests.filter((gt) => gt.alive);

    // 하트/플로트
    for (const h of g.hearts) { h.x += h.vx * dt; h.y += h.vy * dt; h.vy += 0.1 * dt; h.life -= dtMs / 780; }
    g.hearts = g.hearts.filter((h) => h.life > 0);
    for (const f of g.floats) { f.y -= dt * 0.7; f.t -= dtMs / 950; }
    g.floats = g.floats.filter((f) => f.t > 0);

    // ── 렌더 ──
    ctx.clearRect(0, 0, g.W, g.H);
    // 배경(웨딩홀 그라데이션 + 바닥)
    const bg = ctx.createLinearGradient(0, 0, 0, g.H);
    bg.addColorStop(0, '#FFF4F8'); bg.addColorStop(0.6, '#FDF7FF'); bg.addColorStop(1, '#EFE6FF');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, g.W, g.H);
    // 바닥 러너(카펫)
    ctx.fillStyle = 'rgba(255,180,205,0.18)';
    ctx.beginPath(); ctx.moveTo(g.W * 0.32, g.H * 0.5); ctx.lineTo(g.W * 0.68, g.H * 0.5); ctx.lineTo(g.W, g.H); ctx.lineTo(0, g.H); ctx.closePath(); ctx.fill();

    // 하객(뒤→앞, y 순 정렬)
    [...g.guests].sort((a, b) => a.y - b.y).forEach((gt) => drawGuest(ctx, gt));

    // 빔(발사 중일 때)
    if (g.firing) drawBeam(ctx, g);

    // 플레이어
    drawPlayer(ctx, g);

    // 하트 파티클
    for (const h of g.hearts) {
      ctx.save(); ctx.globalAlpha = Math.max(0, h.life); ctx.fillStyle = h.hue;
      ctx.font = `${Math.round(h.size)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('♥', h.x, h.y); ctx.restore();
    }
    // 점수 플로트
    for (const f of g.floats) {
      ctx.save(); ctx.globalAlpha = Math.max(0, f.t); ctx.fillStyle = f.color;
      ctx.font = '700 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText(f.text, f.x, f.y); ctx.restore();
    }

    g.raf = requestAnimationFrame(loop);
  }, [charm, commit, drawBeam, drawGuest, drawPlayer, gameOver, spawnGuest]);

  const start = useCallback(() => {
    const g = s.current;
    resize();
    g.guests = []; g.hearts = []; g.floats = [];
    g.score = 0; g.combo = 0; g.comboTimer = 0; g.love = 100; g.spawnAcc = 0; g.last = 0; g.t = 0;
    g.firing = false; g.running = true; startedRef.current = true;
    setScore(0); setCombo(0); setLove(100); setPhase('play');
    for (let i = 0; i < 3; i++) spawnGuest();
    cancelAnimationFrame(g.raf);
    g.raf = requestAnimationFrame(loop);
  }, [loop, resize, spawnGuest]);

  /* 포인터 → 조준/발사 */
  const pt = useCallback((clientX: number, clientY: number) => {
    const c = canvasRef.current; if (!c) return;
    const r = c.getBoundingClientRect();
    const g = s.current;
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
      {/* 헤더 */}
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[15px] font-bold text-[#191F28]">기다리는 동안 <span className="text-[#FF5D8F]">큐피드 눈빛</span> 💘</p>
        <p className="text-[12px] font-semibold text-[#8B95A1]">최고 {best.toLocaleString()}</p>
      </div>

      {/* HUD: 점수/콤보 + 애정 게이지 */}
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

      {/* 플레이 영역 (2:1) */}
      <div ref={wrapRef} className="relative w-full overflow-hidden rounded-[22px] bg-[#FFF4F8]" style={{ aspectRatio: '2 / 1', touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
          onPointerMove={(e) => { pt(e.clientX, e.clientY); }}
          onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); pt(e.clientX, e.clientY); s.current.firing = true; }}
          onPointerUp={(e) => { s.current.firing = false; }}
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
