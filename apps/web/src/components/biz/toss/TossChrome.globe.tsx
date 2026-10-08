'use client';

import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from './scene';

/*
 * 바닥글 점 지구본(캔버스, 절차 생성) — 위선 · 경선 격자는 고정, 대륙 점만 극축을 따라 천천히 돈다(≈1.2°/s).
 * 대륙 모양은 손으로 잡은 거친 다각형(경도, 위도) — 점 무늬라 이 정도면 충분하다. 외부 지도 데이터 · 그림 없음.
 */

type P = [number, number];
const LANDS: P[][] = [
  // 북아메리카
  [[-168, 66], [-162, 70], [-140, 70], [-125, 70], [-95, 72], [-80, 73], [-65, 62], [-56, 52], [-66, 45], [-70, 42], [-76, 35], [-81, 31], [-80, 25], [-83, 29], [-90, 30], [-97, 27], [-97, 21], [-90, 21], [-87, 15], [-83, 10], [-79, 8], [-85, 12], [-92, 15], [-105, 20], [-112, 30], [-117, 33], [-124, 40], [-125, 48], [-135, 58], [-150, 60], [-165, 60]],
  // 그린란드
  [[-73, 78], [-60, 82], [-30, 83], [-20, 75], [-22, 70], [-42, 60], [-50, 64], [-56, 72]],
  // 남아메리카
  [[-80, 9], [-72, 12], [-62, 10], [-50, 0], [-35, -6], [-38, -13], [-40, -22], [-48, -26], [-53, -34], [-58, -38], [-65, -42], [-68, -52], [-72, -50], [-75, -40], [-72, -30], [-70, -18], [-76, -14], [-81, -5], [-80, 1]],
  // 유럽(스칸디나비아 포함)
  [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [2, 51], [5, 53], [8, 57], [10, 54], [12, 56], [18, 60], [22, 65], [15, 68], [25, 71], [40, 68], [45, 60], [40, 48], [30, 45], [28, 41], [23, 37], [18, 40], [12, 44], [13, 38], [8, 44], [3, 43], [-2, 37]],
  // 영국
  [[-6, 50], [1, 51], [2, 53], [-1, 58], [-5, 58], [-6, 54]],
  // 아프리카
  [[-17, 21], [-10, 30], [-5, 36], [10, 37], [20, 32], [32, 31], [35, 28], [43, 12], [51, 12], [42, -2], [40, -10], [35, -23], [32, -29], [20, -35], [17, -30], [12, -17], [13, -6], [9, 4], [-5, 5], [-12, 8], [-17, 14]],
  // 마다가스카르
  [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17]],
  // 아라비아
  [[35, 28], [38, 20], [43, 13], [53, 16], [59, 22], [56, 26], [50, 30], [48, 30], [40, 32]],
  // 아시아
  [[26, 41], [40, 42], [45, 40], [48, 30], [56, 26], [62, 25], [67, 24], [72, 20], [77, 8], [80, 15], [88, 22], [92, 22], [98, 16], [100, 5], [104, 1], [104, 10], [109, 12], [108, 20], [117, 24], [122, 30], [121, 37], [126, 38], [129, 35], [130, 43], [140, 48], [142, 54], [135, 55], [140, 60], [160, 62], [163, 70], [180, 68], [180, 72], [140, 73], [110, 77], [100, 78], [80, 73], [70, 73], [60, 69], [45, 68], [40, 68], [45, 60], [40, 48], [30, 45]],
  // 일본
  [[130, 31], [135, 34], [140, 36], [142, 40], [141, 45], [145, 44], [140, 41], [137, 37], [132, 34]],
  // 수마트라 · 자바
  [[95, 5], [105, -6], [115, -8], [120, -9], [125, -8], [120, -5], [106, -3], [100, 2]],
  // 보르네오
  [[109, 2], [117, 7], [119, 1], [116, -4], [110, -3]],
  // 뉴기니
  [[131, -1], [141, -3], [150, -10], [141, -9], [135, -4]],
  // 오스트레일리아
  [[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [145, -15], [153, -25], [150, -37], [140, -38], [135, -34], [130, -32], [115, -34], [113, -26]],
];

function inPoly(lon: number, lat: number, poly: P[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 다각형 경계 상자(점 판정 전에 빠르게 거른다) */
const BOXES = LANDS.map((poly) => {
  let a = 180, b = -180, c = 90, d = -90;
  for (const [x, y] of poly) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, y); d = Math.max(d, y); }
  return [a, b, c, d] as const;
});

/**
 * 대륙 점(위도 행마다 같은 호 길이 간격) — [cosLat, sinLat, lonRad] 묶음.
 * 한 번에 다 만들면 50ms+ 긴 태스크(스크롤 끊김) → 위도 행 단위로 쪼개 쉬는 틈(requestIdleCallback)에 조금씩 만든다.
 */
const STEP = 1.05;
const LAT0 = -58;
const LAT1 = 84;
const SLICE_MS = 6; // 한 조각 최대 시간
let DOTS: Float32Array | null = null;
let job: { lat: number; out: number[]; cbs: Set<() => void>; h: number; idle: boolean } | null = null;

function buildRow(lat: number, out: number[]) {
  const c = Math.cos((lat * Math.PI) / 180);
  const sn = Math.sin((lat * Math.PI) / 180);
  const dLon = STEP / Math.max(0.12, c);
  // 이 위도를 지나는 다각형만
  const cand: number[] = [];
  for (let k = 0; k < LANDS.length; k++) if (lat >= BOXES[k][2] && lat <= BOXES[k][3]) cand.push(k);
  if (!cand.length) return;
  for (let lon = -180; lon < 180; lon += dLon) {
    let land = false;
    for (let q = 0; q < cand.length && !land; q++) {
      const k = cand[q];
      if (lon >= BOXES[k][0] && lon <= BOXES[k][1]) land = inPoly(lon, lat, LANDS[k]);
    }
    if (land) out.push(c, sn, (lon * Math.PI) / 180);
  }
}

function buildChunk() {
  const j = job;
  if (!j) return;
  const t0 = performance.now();
  // 최소 한 행은 진행(타임아웃으로 불려 남은 시간 0 이어도 멈추지 않게)
  do {
    buildRow(j.lat, j.out);
    j.lat += STEP;
  } while (j.lat <= LAT1 && performance.now() - t0 < SLICE_MS);
  if (j.lat <= LAT1) { schedule(j); return; }
  DOTS = new Float32Array(j.out);
  job = null;
  j.cbs.forEach((cb) => cb());
}

function schedule(j: NonNullable<typeof job>) {
  const ric = typeof window !== 'undefined' ? window.requestIdleCallback : undefined;
  if (ric) { j.idle = true; j.h = ric(buildChunk, { timeout: 120 }); } else { j.idle = false; j.h = window.setTimeout(buildChunk, 16); }
}

/** 점 준비 요청 — 다 되면 cb. 반환값 = 구독 해제(마지막 구독자가 빠지면 작업도 멈춘다; 진행분은 남겨 이어서) */
function ensureDots(cb: () => void): () => void {
  if (DOTS) return () => {};
  if (!job) job = { lat: LAT0, out: [], cbs: new Set(), h: 0, idle: false };
  const j = job;
  j.cbs.add(cb);
  if (!j.h) schedule(j);
  return () => {
    j.cbs.delete(cb);
    if (j.cbs.size || !j.h || job !== j) return;
    if (j.idle) window.cancelIdleCallback?.(j.h); else clearTimeout(j.h);
    j.h = 0;
  };
}

const TILT = (24.5 * Math.PI) / 180; // 북극이 보는 쪽으로 기운 각(토스 프레임에서 잰 극 위치)
const CT = Math.cos(TILT);
const ST = Math.sin(TILT);

export function GlobeCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return undefined;
    const ctx = cv.getContext('2d');
    if (!ctx) return undefined;
    const reduce = prefersReducedMotion();
    let W = 0;
    let H = 0;
    let dpr = 1;
    let grid: HTMLCanvasElement | null = null;
    let raf = 0;
    let visible = false;
    let rot = 0.6;
    let last = 0;

    // 화면 좌표: 지름 ≈ 가로의 1.017배, 구 위끝 = 캔버스 위끝
    const geo = () => {
      const R = W * 0.5083;
      return { R, cx: W / 2, cy: R + 1 };
    };

    const drawGrid = () => {
      grid = document.createElement('canvas');
      grid.width = Math.round(W * dpr);
      grid.height = Math.round(H * dpr);
      const g = grid.getContext('2d');
      if (!g) return;
      g.scale(dpr, dpr);
      const { R, cx, cy } = geo();
      g.strokeStyle = 'rgba(255,255,255,0.42)';
      g.lineWidth = 1;
      const line = (pts: [number, number, number][]) => {
        g.beginPath();
        let pen = false;
        for (const [x, y, z] of pts) {
          if (z < 0) { pen = false; continue; }
          const X = cx + R * x;
          const Y = cy - R * y;
          if (!pen) { g.moveTo(X, Y); pen = true; } else g.lineTo(X, Y);
        }
        g.stroke();
      };
      const proj = (latD: number, lonD: number): [number, number, number] => {
        const la = (latD * Math.PI) / 180;
        const lo = (lonD * Math.PI) / 180;
        const x = Math.cos(la) * Math.sin(lo);
        const y = Math.sin(la);
        const z = Math.cos(la) * Math.cos(lo);
        return [x, y * CT - z * ST, y * ST + z * CT];
      };
      // 경선 10°
      for (let lon = 0; lon < 360; lon += 10) {
        const pts: [number, number, number][] = [];
        for (let lat = -90; lat <= 90; lat += 2) pts.push(proj(lat, lon));
        line(pts);
      }
      // 위선 15°
      for (let lat = -75; lat <= 75; lat += 15) {
        const pts: [number, number, number][] = [];
        for (let lon = -180; lon <= 180; lon += 2) pts.push(proj(lat, lon));
        line(pts);
      }
    };

    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (grid) ctx.drawImage(grid, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { R, cx, cy } = geo();
      const d = DOTS; // 아직 만드는 중이면 격자만
      if (!d) return;
      const s = Math.max(1.1, W / 720);
      const half = s / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      for (let i = 0; i < d.length; i += 3) {
        const c = d[i];
        const y = d[i + 1];
        const lo = d[i + 2] + rot;
        const x = c * Math.sin(lo);
        const z = c * Math.cos(lo);
        const z2 = y * ST + z * CT;
        if (z2 <= 0.02) continue;
        const Y = cy - R * (y * CT - z * ST);
        if (Y > H) continue;
        ctx.fillRect(cx + R * x - half, Y - half, s, s);
      }
    };

    // 화면에 실제로 걸쳐 있고(여백 0) 탭이 보일 때만 돈다
    const live = () => visible && !document.hidden && !reduce;

    const loop = (now: number) => {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      rot += dt * ((1.2 * Math.PI) / 180);
      draw();
      raf = live() ? requestAnimationFrame(loop) : 0;
    };

    const sync = () => {
      if (live()) {
        if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
      } else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    };

    const resize = () => {
      const r = cv.getBoundingClientRect();
      if (!r.width) return;
      W = r.width;
      H = r.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      drawGrid();
      draw();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(cv);
    // 한 화면 앞부터 점을 조금씩 만들어 둔다(다 되면 한 번 그림 — 멈춘 상태 · 줄인 움직임에서도 점이 보이게)
    let unsub: (() => void) | null = null;
    const near = new IntersectionObserver((es) => {
      if (!es[es.length - 1].isIntersecting || DOTS || unsub) return;
      unsub = ensureDots(() => { unsub = null; if (W) draw(); });
    }, { rootMargin: '100% 0px' });
    near.observe(cv);
    const io = new IntersectionObserver((es) => {
      visible = es[es.length - 1].isIntersecting;
      sync();
    });
    io.observe(cv);
    document.addEventListener('visibilitychange', sync);
    return () => {
      ro.disconnect();
      near.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
      unsub?.();
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={ref} />;
}
