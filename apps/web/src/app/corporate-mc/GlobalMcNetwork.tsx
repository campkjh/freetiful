'use client';

/**
 * GLOBAL MC NETWORK — 점(dot) 월드맵 (밀러 투영, 실제 세계지도 비율).
 * · 마우스 호버 시 점들이 먼지처럼 촤라락 흩어지고, 떼면 부드럽게 제자리 복귀(바운스 없는 lerp, 점마다 속도 다름).
 * · 스크롤을 내리면 지도가 보이는 상태에서 3D 점 지구본으로 감기며 천천히 자전.
 */

import { useEffect, useRef } from 'react';
import { WORLD_DOTS, WORLD_LL, MAP_W, MAP_H } from './worldDots';

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
    const lon = new Float32Array(N), clat = new Float32Array(N), slat = new Float32Array(N);
    const px = new Float32Array(N), py = new Float32Array(N); // 현재 위치(CSS px)
    const rate = new Float32Array(N);                          // 점마다 다른 이동 속도(촤라락)
    const rnd = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      nx[i] = WORLD_DOTS[i][0] / MAP_W; ny[i] = WORLD_DOTS[i][1] / MAP_H;
      const lo = WORLD_LL[i][0] * DEG, la = WORLD_LL[i][1] * DEG;
      lon[i] = lo; clat[i] = Math.cos(la); slat[i] = Math.sin(la);
      rnd[i] = Math.random();
      rate[i] = 0.07 + 0.12 * rnd[i];
    }

    const TAU = Math.PI * 2;
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

    // 평면 맵 배치(영역에 맞춰 contain, 세로는 상단 붙임 — 헤딩과의 갭 최소화)
    const flatBox = () => {
      const ar = MAP_W / MAP_H;
      let mw = W, mh = W / ar;
      if (mh > H) { mh = H; mw = H * ar; }
      return { mw, mh, ox: (W - mw) / 2, oy: Math.min((H - mh) / 2, H * 0.04) };
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
      const e = smooth(0.08, 0.52, p);          // 지도가 보일 때 일찍 모프 시작
      const dust = 1 - e;
      const { mw, mh, ox, oy } = flatBox();

      const cx = W / 2, cy = H / 2;
      const Rg = Math.min(W, H) * 0.46;
      const lam0 = -127 * DEG + (now - t0) * 0.00016; // 서울(127°E) 정면에서 시작, 천천히 자전

      const R = Math.min(W, H) * 0.24, R2 = R * R, MAXP = R * 0.9;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = DOT_COLOR;

      for (let i = 0; i < N; i++) {
        const fx = ox + nx[i] * mw;
        const fy = oy + ny[i] * mh;
        const lam = lon[i] + lam0;
        const cl = Math.cos(lam), sl = Math.sin(lam);
        const gx = cx + Rg * clat[i] * sl;
        const gy = cy - Rg * (cPHI0 * slat[i] - sPHI0 * clat[i] * cl);
        const cosc = sPHI0 * slat[i] + cPHI0 * clat[i] * cl;
        const front = smooth(-0.08, 0.16, cosc);

        let tx = fx + (gx - fx) * e;
        let ty = fy + (gy - fy) * e;
        // 뒷면은 옅게(0.14) 남겨 어느 회전각에서도 구 실루엣 유지
        const alpha = Math.max(1 - (1 - front) * e, 0.14 * e);

        // 먼지 흩어짐(반발 + 각도 지터) — 바운스 없이 촤라락
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
        // 오버슈트 없는 지수 추종 — 점마다 속도가 달라 좌→우 촤라락 느낌
        px[i] += (tx - px[i]) * rate[i];
        py[i] += (ty - py[i]) * rate[i];

        if (alpha <= 0.02) continue;
        const s = 1.9 + 1.5 * (0.4 + 0.6 * front);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(px[i], py[i], s, 0, TAU);
        ctx.fill();
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
    <div ref={wrapRef} className="relative" style={{ height: '180vh' }}>
      <div className="sticky top-0 flex h-[100svh] flex-col items-center justify-center overflow-hidden">
        <div className="cmc-pop px-5 pt-6 text-center md:pt-8">
          <p className="cmc-condor mb-3 text-[16px] md:text-[20px] uppercase tracking-[0.18em] leading-none text-[#3182F6]">Global MC Network</p>
          <h2 className="text-[22px] md:text-[38px] font-extrabold leading-[1.34] tracking-[-0.02em] text-[#1B2A4A]">국제 행사도 프리티풀은 전부 가능합니다</h2>
          <p className="mx-auto mt-4 max-w-[660px] text-[15px] md:text-[19px] leading-[1.7] text-[#6B7684]">언어와 문화의 경계를 넘어, 글로벌 행사에 최적화된 전문 MC와 함께 완성도 높은 무대를 만들어갑니다</p>
        </div>
        <div ref={areaRef} className="relative w-full flex-1" style={{ minHeight: 0, touchAction: 'pan-y' }}>
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="글로벌 MC 네트워크 지도" />
        </div>
      </div>
    </div>
  );
}
