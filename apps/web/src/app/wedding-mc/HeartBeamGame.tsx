'use client';

/* ═══════════════════════════════════════════════════════════════════
   하트 눈빛 게임 (Cupid Beam) — 매칭 대기(최대 3분) 동안 즐기는 미니게임.
   큐피드(하단 중앙)가 떠오르는 하트/부케에 "눈빛 빔"을 발사해 팝 → 점수.
   연속 히트로 콤보 배수 상승. 최고 점수는 localStorage에 저장.
   캔버스 기반·의존성 0·터치 전용. 화면 언마운트/탭 숨김 시 자동 정지.
   (원작 플래시 눈빛게임 beam_nagasa: 커서 방향으로 빔을 쏘는 조작을 계승)
   ═════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';

type Kind = 'heart' | 'gold' | 'bouquet' | 'ring';

type Target = {
  x: number; y: number; vy: number; drift: number; phase: number;
  r: number; kind: Kind; emoji: string; score: number; alive: boolean; born: number;
};
type Beam = { x1: number; y1: number; x2: number; y2: number; t: number; hue: string };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string };
type Float = { x: number; y: number; t: number; text: string; color: string };

const SPEC: Record<Kind, { emoji: string; score: number; weight: number; speed: number; r: number }> = {
  heart:   { emoji: '💗', score: 10, weight: 62, speed: 1.0, r: 24 },
  bouquet: { emoji: '💐', score: 20, weight: 22, speed: 1.15, r: 26 },
  ring:    { emoji: '💍', score: 30, weight: 10, speed: 1.35, r: 22 },
  gold:    { emoji: '💛', score: 50, weight: 6,  speed: 1.55, r: 22 },
};

const BEST_KEY = 'wmc_heartbeam_best';

function pickKind(): Kind {
  const total = Object.values(SPEC).reduce((s, k) => s + k.weight, 0);
  let r = Math.random() * total;
  for (const key of Object.keys(SPEC) as Kind[]) {
    r -= SPEC[key].weight;
    if (r <= 0) return key;
  }
  return 'heart';
}

export default function HeartBeamGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const [started, setStarted] = useState(false);

  // 게임 상태(리렌더 방지: ref에 보관)
  const stateRef = useRef({
    W: 0, H: 0, dpr: 1,
    targets: [] as Target[],
    beams: [] as Beam[],
    parts: [] as Particle[],
    floats: [] as Float[],
    score: 0, combo: 0, comboTimer: 0,
    spawnAcc: 0, spawnEvery: 1000, // ms
    last: 0, running: false, raf: 0,
    cupidBob: 0,
  });

  const startedRef = useRef(false);

  const commit = useCallback(() => {
    const s = stateRef.current;
    setScore(s.score);
    setCombo(s.combo);
  }, []);

  useEffect(() => {
    try {
      const b = Number(localStorage.getItem(BEST_KEY) || '0');
      if (Number.isFinite(b)) setBest(b);
    } catch {}
  }, []);

  const saveBest = useCallback((v: number) => {
    setBest((prev) => {
      if (v > prev) {
        try { localStorage.setItem(BEST_KEY, String(v)); } catch {}
        return v;
      }
      return prev;
    });
  }, []);

  /* ── 캔버스 리사이즈 (DPR 대응, 선명하게) ── */
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const s = stateRef.current;
    s.W = rect.width; s.H = rect.height; s.dpr = dpr;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  /* ── 타깃 생성 ── */
  const spawn = useCallback(() => {
    const s = stateRef.current;
    if (s.W === 0) return;
    const kind = pickKind();
    const spec = SPEC[kind];
    const margin = 30;
    s.targets.push({
      x: margin + Math.random() * (s.W - margin * 2),
      y: s.H + 24,
      vy: -(0.34 + Math.random() * 0.12) * spec.speed, // px/frame(60fps) 기준, dt로 보정
      drift: 0.5 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2,
      r: spec.r,
      kind,
      emoji: spec.emoji,
      score: spec.score,
      alive: true,
      born: performance.now(),
    });
  }, []);

  /* ── 팝(명중) 처리 ── */
  const popTarget = useCallback((t: Target, tapX: number, tapY: number) => {
    const s = stateRef.current;
    t.alive = false;
    s.combo += 1;
    s.comboTimer = 1600; // ms 안에 다음 히트 없으면 콤보 리셋
    const mult = Math.max(1, s.combo);
    const gained = t.score * mult;
    s.score += gained;

    // 눈빛 빔: 큐피드 → 타깃
    const hue = t.kind === 'gold' ? '#FFC53D' : t.kind === 'ring' ? '#8B5CF6' : '#FF5D8F';
    s.beams.push({ x1: s.W / 2, y1: s.H - 10, x2: t.x, y2: t.y, t: 1, hue });

    // 파티클 버스트
    const n = 8 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const sp = 1.2 + Math.random() * 2.2;
      s.parts.push({
        x: t.x, y: t.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6,
        life: 1, max: 460 + Math.random() * 220, size: 3 + Math.random() * 3,
        color: hue,
      });
    }
    // 점수 플로트
    s.floats.push({ x: t.x, y: t.y - 6, t: 1, text: `+${gained}${mult > 1 ? ` ×${mult}` : ''}`, color: hue });

    if (s.score > 0 && (s.score) > best) saveBest(s.score);
    try { (navigator as any).vibrate?.(t.kind === 'heart' ? 8 : 14); } catch {}
    commit();
  }, [best, commit, saveBest]);

  /* ── 탭 처리 ── */
  const onPointer = useCallback((clientX: number, clientY: number) => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    // 탭 지점에서 가장 가까운 생존 타깃(넉넉한 히트 반경)
    let hit: Target | null = null;
    let bestD = Infinity;
    for (const t of s.targets) {
      if (!t.alive) continue;
      const d = Math.hypot(t.x - px, t.y - py);
      const rad = t.r + 16;
      if (d < rad && d < bestD) { bestD = d; hit = t; }
    }
    if (hit) {
      popTarget(hit, px, py);
    } else {
      // 빗나감 → 콤보 리셋 + 작은 미스 빔
      if (s.combo > 0) { s.combo = 0; commit(); }
      s.beams.push({ x1: s.W / 2, y1: s.H - 10, x2: px, y2: py, t: 1, hue: 'rgba(150,160,180,0.5)' });
    }
  }, [commit, popTarget]);

  /* ── 메인 루프 ── */
  const loop = useCallback((now: number) => {
    const s = stateRef.current;
    if (!s.running) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) { s.raf = requestAnimationFrame(loop); return; }
    const dtMs = Math.min(48, now - (s.last || now));
    s.last = now;
    const dt = dtMs / 16.6667; // 60fps 기준 배속

    // 스폰
    s.spawnAcc += dtMs;
    // 난이도: 점수 오를수록 조금씩 빨라짐(하한 620ms)
    s.spawnEvery = Math.max(620, 1050 - Math.floor(s.score / 250) * 40);
    if (s.spawnAcc >= s.spawnEvery) { s.spawnAcc = 0; spawn(); }

    // 콤보 타이머
    if (s.comboTimer > 0) {
      s.comboTimer -= dtMs;
      if (s.comboTimer <= 0 && s.combo > 0) { s.combo = 0; commit(); }
    }

    s.cupidBob += dt * 0.06;

    // 타깃 업데이트
    for (const t of s.targets) {
      if (!t.alive) continue;
      t.phase += dt * 0.05;
      t.y += t.vy * dt * 3.4;
      t.x += Math.sin(t.phase) * t.drift * dt * 0.6;
      if (t.y < -30) {
        t.alive = false; // 이탈
        if (s.combo > 0) { s.combo = 0; commit(); }
      }
    }
    s.targets = s.targets.filter((t) => t.alive);

    // 파티클
    for (const p of s.parts) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.12 * dt; p.life -= dtMs / p.max;
    }
    s.parts = s.parts.filter((p) => p.life > 0);
    // 빔
    for (const b of s.beams) b.t -= dtMs / 260;
    s.beams = s.beams.filter((b) => b.t > 0);
    // 플로트
    for (const f of s.floats) { f.y -= dt * 0.7; f.t -= dtMs / 900; }
    s.floats = s.floats.filter((f) => f.t > 0);

    // ── 렌더 ──
    ctx.clearRect(0, 0, s.W, s.H);

    // 빔(먼저, 뒤에)
    for (const b of s.beams) {
      ctx.save();
      const grad = ctx.createLinearGradient(b.x1, b.y1, b.x2, b.y2);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(1, b.hue);
      ctx.strokeStyle = grad;
      ctx.globalAlpha = Math.max(0, b.t);
      ctx.lineWidth = 3.2 * b.t + 0.6;
      ctx.lineCap = 'round';
      ctx.shadowColor = b.hue;
      ctx.shadowBlur = 12 * b.t;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.restore();
    }

    // 타깃
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of s.targets) {
      const appear = Math.min(1, (now - t.born) / 220);
      ctx.save();
      ctx.globalAlpha = appear;
      ctx.font = `${Math.round(t.r * 1.6)}px "Apple Color Emoji","Segoe UI Emoji",system-ui,sans-serif`;
      ctx.translate(t.x, t.y);
      const wob = 1 + Math.sin(t.phase * 2) * 0.05;
      ctx.scale(wob, 1 / wob);
      ctx.fillText(t.emoji, 0, 0);
      ctx.restore();
    }

    // 파티클
    for (const p of s.parts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 점수 플로트
    for (const f of s.floats) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.t);
      ctx.fillStyle = f.color;
      ctx.font = '700 15px system-ui,-apple-system,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    // 큐피드(하단 중앙)
    ctx.save();
    ctx.font = '30px "Apple Color Emoji","Segoe UI Emoji",system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('😍', s.W / 2, s.H - 6 + Math.sin(s.cupidBob) * 2);
    ctx.restore();

    s.raf = requestAnimationFrame(loop);
  }, [commit, spawn]);

  /* ── 시작/정지 ── */
  const start = useCallback(() => {
    const s = stateRef.current;
    resize();
    s.targets = []; s.beams = []; s.parts = []; s.floats = [];
    s.score = 0; s.combo = 0; s.comboTimer = 0; s.spawnAcc = 0; s.last = 0;
    s.running = true;
    startedRef.current = true;
    setScore(0); setCombo(0);
    setStarted(true);
    // 초기 몇 개 미리 배치
    for (let i = 0; i < 3; i++) { spawn(); s.targets[s.targets.length - 1].y = s.H * (0.4 + i * 0.2); }
    cancelAnimationFrame(s.raf);
    s.raf = requestAnimationFrame(loop);
  }, [loop, resize, spawn]);

  /* ── 마운트 1회: 리사이즈 옵저버 + 탭 숨김 대응 + 정리 ──
     (started/loop를 deps에 넣으면 시작 순간 cleanup이 rAF를 취소해 버림 → ref로 처리) */
  const loopRef = useRef(loop);
  useEffect(() => { loopRef.current = loop; }, [loop]);

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(() => resize());
    if (wrapRef.current) ro.observe(wrapRef.current);
    const onVis = () => {
      const s = stateRef.current;
      if (document.hidden) {
        s.running = false;
        cancelAnimationFrame(s.raf);
      } else if (startedRef.current) {
        s.running = true;
        s.last = 0;
        cancelAnimationFrame(s.raf);
        s.raf = requestAnimationFrame(loopRef.current);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      const s = stateRef.current;
      s.running = false;
      startedRef.current = false;
      cancelAnimationFrame(s.raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mt-6 rounded-[30px] bg-white p-4 shadow-[0_0_18px_0_rgba(127,174,255,0.16)]">
      {/* 상단 바: 안내 + 최고점 */}
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[15px] font-bold text-[#191F28]">
          기다리는 동안 <span className="text-[#FF5D8F]">하트 눈빛</span> 게임 💘
        </p>
        <p className="text-[12px] font-semibold text-[#8B95A1]">최고 {best.toLocaleString()}</p>
      </div>

      {/* 점수 / 콤보 */}
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[22px] font-extrabold tabular-nums text-[#191F28]">
          {score.toLocaleString()}<span className="ml-1 text-[13px] font-bold text-[#8B95A1]">점</span>
        </p>
        {combo > 1 && (
          <span
            key={combo}
            className="wmc-combo rounded-full bg-[#FFF0F5] px-3 py-1 text-[13px] font-extrabold text-[#FF5D8F]"
          >
            {combo} COMBO 🔥
          </span>
        )}
      </div>

      {/* 플레이 영역 */}
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-[22px] bg-gradient-to-b from-[#FFF5F8] via-[#F7FAFF] to-[#EEF3FF]"
        style={{ height: 'clamp(180px, 26vh, 230px)', touchAction: 'manipulation' }}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
          onPointerDown={(e) => { e.preventDefault(); onPointer(e.clientX, e.clientY); }}
        />

        {/* 시작 오버레이 */}
        {!started && (
          <button
            type="button"
            onClick={start}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/70 backdrop-blur-[2px] active:bg-white/60"
          >
            <span className="text-[34px]">💘</span>
            <span className="text-[16px] font-extrabold text-[#191F28]">떠오르는 하트를 탭!</span>
            <span className="rounded-full bg-[#FF5D8F] px-5 py-2 text-[14px] font-bold text-white shadow-[0_6px_16px_rgba(255,93,143,0.35)]">
              게임 시작
            </span>
          </button>
        )}
      </div>

      <p className="mt-2 text-center text-[12px] leading-relaxed text-[#8B95A1]">
        하트·부케·반지·💛골든하트를 탭해 눈빛을 쏘세요. 연속 명중 시 콤보 배수 UP!
      </p>

      <style jsx>{`
        .wmc-combo { animation: wmcComboPop 0.3s cubic-bezier(0.22, 1, 0.36, 1); }
        @keyframes wmcComboPop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
