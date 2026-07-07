'use client';

/**
 * GLOBAL MC NETWORK — 블랙 풀스크린 테이크오버.
 * 섹션 진입 → 화면 전체 블랙 → 스크롤에 따라 ENGLISH → 中文 → 日本語 대형 타이포가
 * 순차로 떠올랐다 사라지고, 마지막에 블랙 위로 점 지구본이 서서히 떠오르며(자전) 헤딩 등장.
 */

import { useEffect, useRef } from 'react';
import { WORLD_LL } from './worldDots';

const N = WORLD_LL.length;
const DEG = Math.PI / 180;
const DOT_COLOR = '#7CA6F2';
const WORDS = ['ENGLISH', '中文', '日本語'];

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export default function GlobalMcNetwork() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wordRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const sticky = stickyRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !sticky || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ---- 지구본 점 데이터 ----
    const lon = new Float32Array(N), clat = new Float32Array(N), slat = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const lo = WORLD_LL[i][0] * DEG, la = WORLD_LL[i][1] * DEG;
      lon[i] = lo; clat[i] = Math.cos(la); slat[i] = Math.sin(la);
    }

    const TAU = Math.PI * 2;
    let W = 0, H = 0, dpr = 1;
    const PHI0 = 20 * DEG, cPHI0 = Math.cos(PHI0), sPHI0 = Math.sin(PHI0);

    const measure = () => {
      const r = sticky.getBoundingClientRect();
      W = r.width; H = r.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
    };

    const scrollP = () => {
      const total = wrap.offsetHeight - window.innerHeight;
      const scrolled = -wrap.getBoundingClientRect().top;
      return total > 0 ? Math.min(1, Math.max(0, scrolled / total)) : 0;
    };

    // 언어 타이포 구간(스크롤 진행도 p 기준)
    const PHASES: [number, number][] = [[0.03, 0.26], [0.26, 0.49], [0.49, 0.72]];

    let raf = 0, visible = true;
    const t0 = performance.now();

    const frame = (now: number) => {
      const p = scrollP();

      // ---- 언어 타이포: 아래에서 떠올라 → 위로 흘러 사라짐(블러+자간 확장) ----
      for (let i = 0; i < WORDS.length; i++) {
        const el = wordRefs.current[i];
        if (!el) continue;
        const [a, b] = PHASES[i];
        const q = (p - a) / (b - a);
        if (q <= 0 || q >= 1) { el.style.opacity = '0'; continue; }
        const inT = smooth(0, 0.32, q), outT = smooth(0.68, 1, q);
        const op = inT * (1 - outT);
        const ty = (1 - inT) * 46 - outT * 46;
        const blur = (1 - inT) * 12 + outT * 12;
        const ls = 0.14 + 0.06 * q;
        el.style.opacity = op.toFixed(3);
        el.style.transform = `translateY(${ty.toFixed(1)}px)`;
        el.style.filter = `blur(${blur.toFixed(1)}px)`;
        el.style.letterSpacing = `${ls.toFixed(3)}em`;
      }

      // ---- 지구본 등장(g) + 헤딩/글로우 ----
      const g = smooth(0.70, 0.86, p);
      if (headRef.current) {
        headRef.current.style.opacity = g.toFixed(3);
        headRef.current.style.transform = `translateY(${((1 - g) * 26).toFixed(1)}px)`;
      }
      if (glowRef.current) glowRef.current.style.opacity = (g * 0.9).toFixed(3);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (g > 0.01) {
        const cx = W / 2, cy = H * 0.58;
        const Rg = Math.min(W, H * 0.86) * 0.42 * (0.88 + 0.12 * g);
        const lam0 = -127 * DEG + (now - t0) * 0.00016; // 서울 정면에서 시작, 천천히 자전
        ctx.fillStyle = DOT_COLOR;
        for (let i = 0; i < N; i++) {
          const lam = lon[i] + lam0;
          const cl = Math.cos(lam), sl = Math.sin(lam);
          const gx = cx + Rg * clat[i] * sl;
          const gy = cy - Rg * (cPHI0 * slat[i] - sPHI0 * clat[i] * cl);
          const cosc = sPHI0 * slat[i] + cPHI0 * clat[i] * cl;
          const front = smooth(-0.08, 0.16, cosc);
          const alpha = Math.max(front, 0.12) * g;
          if (alpha <= 0.02) continue;
          const s = 1.9 + 1.5 * (0.4 + 0.6 * front);
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(gx, gy, s, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      if (visible) raf = requestAnimationFrame(frame);
    };

    measure();
    const ro = new ResizeObserver(() => { measure(); });
    ro.observe(sticky);

    const io = new IntersectionObserver((ents) => {
      const nowVis = ents[0].isIntersecting;
      if (nowVis && !visible) { visible = true; raf = requestAnimationFrame(frame); }
      visible = nowVis;
    }, { rootMargin: '120px' });
    io.observe(wrap);

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className="relative" style={{ height: '400vh', width: '100vw', marginLeft: 'calc(50% - 50vw)' }}>
      <div ref={stickyRef} className="sticky top-0 h-[100svh] overflow-hidden bg-[#05070D]">
        {/* 지구본 뒤 라디얼 글로우 */}
        <div
          ref={glowRef}
          className="pointer-events-none absolute inset-0 opacity-0"
          style={{ background: 'radial-gradient(ellipse 62% 52% at 50% 58%, rgba(49,130,246,0.22), rgba(49,130,246,0.06) 55%, transparent 75%)' }}
        />
        {/* 지구본 캔버스 */}
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="글로벌 MC 네트워크 지구본" />

        {/* 상단 라벨(항상) */}
        <p className="cmc-condor absolute inset-x-0 top-[44px] text-center text-[16px] md:text-[20px] uppercase tracking-[0.22em] leading-none text-[#5E90E8]">Global MC Network</p>

        {/* 언어 대형 타이포 */}
        {WORDS.map((w, i) => (
          <div
            key={w}
            ref={(el) => { wordRefs.current[i] = el; }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0"
          >
            <span className="select-none text-center font-thin text-white/95" style={{ fontSize: 'clamp(56px, 11vw, 150px)', fontWeight: 200, letterSpacing: '0.14em', textShadow: '0 0 60px rgba(124,166,242,0.35)' }}>{w}</span>
          </div>
        ))}

        {/* 지구본 페이즈 헤딩 */}
        <div ref={headRef} className="pointer-events-none absolute inset-x-0 top-[84px] px-5 text-center opacity-0 md:top-[96px]">
          <h2 className="text-[22px] md:text-[38px] font-extrabold leading-[1.34] tracking-[-0.02em] text-white">국제 행사도 프리티풀은 전부 가능합니다</h2>
          <p className="mx-auto mt-3 max-w-[660px] text-[14px] md:text-[18px] leading-[1.7] text-white/55">언어와 문화의 경계를 넘어, 글로벌 행사에 최적화된 전문 MC와 함께 완성도 높은 무대를 만들어갑니다</p>
        </div>
      </div>
    </div>
  );
}
