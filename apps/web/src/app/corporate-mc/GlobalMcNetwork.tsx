'use client';

/**
 * GLOBAL MC NETWORK — 점(dot) 월드맵.
 * · 마우스 호버 시 점들이 먼지처럼 흩어지고, 떼면 제자리로 복귀(스프링).
 * · 스크롤을 내리면 평면 점 지도가 3D 점 지구본으로 감기며 천천히 자전.
 * 캔버스 렌더(점 3200개 개별 물리) — 스프라이트 drawImage 로 경량화.
 */

import { useEffect, useRef } from 'react';
import { WORLD_DOTS, MAP_W, MAP_H, LON_MIN, LON_MAX, LAT_MAX, LAT_MIN } from './worldDots';

const N = WORLD_DOTS.length;
const DEG = Math.PI / 180;
const DOT_COLOR = '#5E90E8';

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export default function GlobalMcNetwork() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const area = areaRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !area || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ---- 점별 베이스 데이터 ----
    const nx = new Float32Array(N), ny = new Float32Array(N);
    const lon = new Float32Array(N), lat = new Float32Array(N);
    const clat = new Float32Array(N), slat = new Float32Array(N);
    const px = new Float32Array(N), py = new Float32Array(N); // 현재 위치(CSS px)
    const vx = new Float32Array(N), vy = new Float32Array(N);
    const rnd = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const X = WORLD_DOTS[i][0], Y = WORLD_DOTS[i][1];
      nx[i] = X / MAP_W; ny[i] = Y / MAP_H;
      const lo = (LON_MIN + (X / MAP_W) * (LON_MAX - LON_MIN)) * DEG;
      const la = (LAT_MAX - (Y / MAP_H) * (LAT_MAX - LAT_MIN)) * DEG;
      lon[i] = lo; lat[i] = la; clat[i] = Math.cos(la); slat[i] = Math.sin(la);
      rnd[i] = Math.random();
    }

    // ---- 점 스프라이트(부드러운 원) ----
    const SP = 16;
    const sprite = document.createElement('canvas');
    sprite.width = SP; sprite.height = SP;
    const sctx = sprite.getContext('2d')!;
    const g = sctx.createRadialGradient(SP / 2, SP / 2, 0, SP / 2, SP / 2, SP / 2);
    g.addColorStop(0, DOT_COLOR);
    g.addColorStop(0.62, DOT_COLOR);
    g.addColorStop(1, 'rgba(94,144,232,0)');
    sctx.fillStyle = g;
    sctx.beginPath(); sctx.arc(SP / 2, SP / 2, SP / 2, 0, Math.PI * 2); sctx.fill();

    let W = 0, H = 0, dpr = 1;
    const PHI0 = 20 * DEG, cPHI0 = Math.cos(PHI0), sPHI0 = Math.sin(PHI0);
    let inited = false;

    const measure = () => {
      const r = area.getBoundingClientRect();
      W = r.width; H = r.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
    };

    // 평면 맵 배치(영역에 맞춰 fit, 확대)
    const flatBox = () => {
      const ar = MAP_W / MAP_H;
      let mw = W, mh = W / ar;
      if (mh > H) { mh = H; mw = H * ar; }
      mw *= 1.0; mh *= 1.0;
      return { mw, mh, ox: (W - mw) / 2, oy: (H - mh) / 2 };
    };

    let mouse: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onLeave = () => { mouse = null; };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);

    const scrollP = () => {
      const total = wrap.offsetHeight - window.innerHeight;
      const scrolled = -wrap.getBoundingClientRect().top;
      return total > 0 ? Math.min(1, Math.max(0, scrolled / total)) : 0;
    };

    let raf = 0, visible = true;
    const t0 = performance.now();

    const frame = (now: number) => {
      const p = scrollP();
      const e = smooth(0.22, 0.55, p);        // 평면→지구본 모프
      const dust = 1 - e;                       // 먼지 인터랙션은 평면일 때
      const { mw, mh, ox, oy } = flatBox();

      // 지구본 파라미터
      const cx = W / 2, cy = H / 2;
      const Rg = Math.min(W, H) * 0.46;
      const lam0 = (now - t0) * 0.00016;        // 천천히 자전(라디안)

      const R = Math.min(W, H) * 0.24, R2 = R * R, MAXP = R * 0.9;
      const STIFF = 0.12, DAMP = 0.82;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      for (let i = 0; i < N; i++) {
        // 평면 목표
        const fx = ox + nx[i] * mw;
        const fy = oy + ny[i] * mh;
        // 지구본 목표(정사영)
        const lam = lon[i] + lam0;
        const cl = Math.cos(lam), sl = Math.sin(lam);
        const gx = cx + Rg * clat[i] * sl;
        const gy = cy - Rg * (cPHI0 * slat[i] - sPHI0 * clat[i] * cl);
        const cosc = sPHI0 * slat[i] + cPHI0 * clat[i] * cl; // >0 앞면
        const front = smooth(-0.08, 0.16, cosc);

        let tx = fx + (gx - fx) * e;
        let ty = fy + (gy - fy) * e;
        let alpha = 1 - (1 - front) * e;        // 뒷면은 지구본일수록 사라짐

        // 먼지 흩어짐(마우스 반발 + 각도 지터로 흩날리는 느낌)
        if (mouse && dust > 0.02) {
          const dx = tx - mouse.x, dy = ty - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            const d = Math.sqrt(d2) || 1;
            const f = 1 - d / R;
            const push = f * MAXP * dust * (0.5 + rnd[i]);
            const ang = Math.atan2(dy, dx) + (rnd[i] - 0.5) * 1.1 * f;
            tx += Math.cos(ang) * push;
            ty += Math.sin(ang) * push;
          }
        }

        if (!inited) { px[i] = tx; py[i] = ty; }
        const ax = (tx - px[i]) * STIFF, ay = (ty - py[i]) * STIFF;
        vx[i] = (vx[i] + ax) * DAMP; vy[i] = (vy[i] + ay) * DAMP;
        px[i] += vx[i]; py[i] += vy[i];

        if (alpha <= 0.02) continue;
        const s = (2.4 + 2.2 * (0.4 + 0.6 * front)) ; // 지름(앞면 살짝 큼)
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprite, px[i] - s, py[i] - s, s * 2, s * 2);
      }
      ctx.globalAlpha = 1;
      inited = true;
      if (visible) raf = requestAnimationFrame(frame);
    };

    measure();
    const ro = new ResizeObserver(() => { measure(); });
    ro.observe(area);

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
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div ref={wrapRef} className="relative" style={{ height: '240vh' }}>
      <div className="sticky top-0 flex h-[100svh] flex-col items-center justify-center overflow-hidden">
        <div className="cmc-pop px-5 text-center">
          <p className="cmc-condor mb-3 text-[16px] md:text-[20px] uppercase tracking-[0.18em] leading-none text-[#3182F6]">Global MC Network</p>
          <h2 className="text-[22px] md:text-[38px] font-extrabold leading-[1.34] tracking-[-0.02em] text-[#1B2A4A]">국제 행사 및 이벤트에 최적화된<br className="hidden md:block" /> 전문 사회자를 프리티풀이 연결합니다</h2>
          <p className="mx-auto mt-4 max-w-[660px] text-[15px] md:text-[19px] leading-[1.7] text-[#6B7684]">언어와 문화의 경계를 넘어, 글로벌 행사에 최적화된 전문 MC와 함께 완성도 높은 무대를 만들어갑니다</p>
        </div>
        <div ref={areaRef} className="relative mt-4 w-full flex-1" style={{ minHeight: 0, touchAction: 'pan-y' }}>
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="글로벌 MC 네트워크 지도" />
        </div>
      </div>
    </div>
  );
}
