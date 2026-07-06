'use client';

import { useEffect, useMemo, useRef } from 'react';
import { WORLD_DOTS, MAP_W, MAP_H, projectLL } from './worldDots';

type City = { name: string; lon: number; lat: number; hub?: boolean };

// 허브(서울)로 아크가 수렴 — 레퍼런스처럼 유럽 클러스터 + 전세계 분포
const CITIES: City[] = [
  { name: 'Seoul', lon: 126.98, lat: 37.57, hub: true },
  { name: 'Tokyo', lon: 139.69, lat: 35.68 },
  { name: 'Beijing', lon: 116.4, lat: 39.9 },
  { name: 'Shanghai', lon: 121.47, lat: 31.23 },
  { name: 'Singapore', lon: 103.82, lat: 1.35 },
  { name: 'Bangkok', lon: 100.5, lat: 13.75 },
  { name: 'New Delhi', lon: 77.21, lat: 28.61 },
  { name: 'Dubai', lon: 55.27, lat: 25.2 },
  { name: 'London', lon: -0.13, lat: 51.51 },
  { name: 'Paris', lon: 2.35, lat: 48.86 },
  { name: 'Amsterdam', lon: 4.9, lat: 52.37 },
  { name: 'Frankfurt', lon: 8.68, lat: 50.11 },
  { name: 'Berlin', lon: 13.4, lat: 52.52 },
  { name: 'Milan', lon: 9.19, lat: 45.46 },
  { name: 'Rome', lon: 12.5, lat: 41.9 },
  { name: 'Madrid', lon: -3.7, lat: 40.42 },
  { name: 'New York', lon: -74.0, lat: 40.71 },
  { name: 'Toronto', lon: -79.38, lat: 43.65 },
  { name: 'Los Angeles', lon: -118.24, lat: 34.05 },
  { name: 'Sao Paulo', lon: -46.63, lat: -23.55 },
  { name: 'Sydney', lon: 151.21, lat: -33.87 },
  { name: 'Auckland', lon: 174.76, lat: -36.85 },
];

const DOT_COLOR = '#8FB3E8';
const LINE_COLOR = '#3182F6';
const PIN_BODY = '#2E6BE3';
const PIN_HUB = '#1E56D6';

function PinShape({ hub }: { hub?: boolean }) {
  const body = hub ? PIN_HUB : PIN_BODY;
  return (
    <>
      {/* 그림자 */}
      <ellipse cx="0" cy="1.5" rx="7" ry="2.4" fill="#1B2A4A" opacity="0.16" />
      {/* 물방울 핀 (팁 = 0,0) */}
      <path
        d="M0 0 C-2 -4 -6 -9 -10 -14 C-14.5 -19.5 -17.5 -24 -17.5 -31 A17.5 17.5 0 1 1 17.5 -31 C17.5 -24 14.5 -19.5 10 -14 C6 -9 2 -4 0 0 Z"
        fill={body}
      />
      {/* 내부 창(체커) */}
      <rect x="-7.6" y="-38.6" width="15.2" height="15.2" rx="2.6" fill="#fff" />
      <rect x="-7.2" y="-38.2" width="7" height="7" rx="1" fill={body} />
      <rect x="0.2" y="-30.8" width="7" height="7" rx="1" fill={body} />
    </>
  );
}

export default function GlobalMcNetwork() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pinRefs = useRef<(SVGGElement | null)[]>([]);
  const arcRefs = useRef<(SVGPathElement | null)[]>([]);

  const origins = useMemo<[number, number][]>(() => CITIES.map((c) => projectLL(c.lon, c.lat)), []);
  const hubIdx = useMemo(() => CITIES.findIndex((c) => c.hub), []);
  const arcCities = useMemo(() => CITIES.map((_, i) => i).filter((i) => i !== hubIdx), [hubIdx]);

  const dotsPath = useMemo(() => {
    const r = 4.1;
    let d = '';
    for (const [x, y] of WORLD_DOTS) {
      d += `M${x} ${y}m-${r} 0a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
    }
    return d;
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const pos = origins.map((o) => [o[0], o[1]] as [number, number]);
    const vel = origins.map(() => [0, 0] as [number, number]);
    let mouse: [number, number] | null = null;
    let raf = 0;
    let running = false;
    const R = 300, MAXP = 155, STIFF = 0.14, DAMP = 0.78;

    const arcD = (a: [number, number], b: [number, number]) => {
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      let px = -dy / len, py = dx / len;
      if (py > 0) { px = -px; py = -py; } // 항상 위로 아치
      const bow = Math.min(Math.max(len * 0.17, 40), 250);
      return `M${a[0].toFixed(1)} ${a[1].toFixed(1)} Q${(mx + px * bow).toFixed(1)} ${(my + py * bow).toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
    };

    const updateArcs = () => {
      arcCities.forEach((ci, k) => {
        const p = arcRefs.current[k];
        if (p) p.setAttribute('d', arcD(pos[hubIdx], pos[ci]));
      });
    };

    const frame = () => {
      let moving = false;
      for (let i = 0; i < CITIES.length; i++) {
        let tx = origins[i][0], ty = origins[i][1];
        if (mouse) {
          const ddx = origins[i][0] - mouse[0];
          const ddy = origins[i][1] - mouse[1];
          const d = Math.hypot(ddx, ddy);
          if (d < R) {
            const push = (1 - d / R) * MAXP;
            const n = d || 1;
            tx += (ddx / n) * push;
            ty += (ddy / n) * push;
          }
        }
        const ax = (tx - pos[i][0]) * STIFF;
        const ay = (ty - pos[i][1]) * STIFF;
        vel[i][0] = (vel[i][0] + ax) * DAMP;
        vel[i][1] = (vel[i][1] + ay) * DAMP;
        pos[i][0] += vel[i][0];
        pos[i][1] += vel[i][1];
        if (Math.abs(vel[i][0]) + Math.abs(vel[i][1]) > 0.04 || Math.abs(tx - pos[i][0]) + Math.abs(ty - pos[i][1]) > 0.06) moving = true;
        const g = pinRefs.current[i];
        if (g) g.setAttribute('transform', `translate(${pos[i][0].toFixed(1)} ${pos[i][1].toFixed(1)})`);
      }
      updateArcs();
      if (moving || mouse) raf = requestAnimationFrame(frame);
      else running = false;
    };

    const ensure = () => { if (!running) { running = true; raf = requestAnimationFrame(frame); } };

    const toSvg = (cx: number, cy: number): [number, number] => {
      const r = svg.getBoundingClientRect();
      return [((cx - r.left) / r.width) * MAP_W, ((cy - r.top) / r.height) * MAP_H];
    };
    const onMove = (e: PointerEvent) => { mouse = toSvg(e.clientX, e.clientY); ensure(); };
    const onLeave = () => { mouse = null; ensure(); };

    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerleave', onLeave);
    updateArcs(); // 초기 아크

    return () => {
      cancelAnimationFrame(raf);
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerleave', onLeave);
    };
  }, [origins, hubIdx, arcCities]);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="h-auto w-full select-none"
        style={{ touchAction: 'pan-y' }}
        aria-label="글로벌 MC 네트워크 지도"
      >
        {/* 대륙 점 */}
        <path d={dotsPath} fill={DOT_COLOR} />
        {/* 연결 아크 (허브로 수렴) */}
        <g fill="none" strokeLinecap="round">
          {arcCities.map((ci, k) => (
            <path
              key={CITIES[ci].name}
              ref={(el) => { arcRefs.current[k] = el; }}
              stroke={LINE_COLOR}
              strokeWidth={2.4}
              opacity={0.24 + (k % 5) * 0.1}
            />
          ))}
        </g>
        {/* 핀 */}
        {CITIES.map((c, i) => (
          <g
            key={c.name}
            ref={(el) => { pinRefs.current[i] = el; }}
            transform={`translate(${origins[i][0]} ${origins[i][1]})`}
          >
            <g transform={`scale(${c.hub ? 1.45 : 1.05})`}>
              <PinShape hub={c.hub} />
            </g>
          </g>
        ))}
      </svg>
      {/* 코너 라벨 박스 (레퍼런스 스타일) */}
      <div className="pointer-events-none absolute bottom-[5%] right-[2%] rounded-[14px] border border-[#3182F6]/45 bg-white/70 px-4 py-2 text-right backdrop-blur-sm md:px-5 md:py-2.5">
        <div className="text-[15px] font-extrabold leading-tight text-[#3182F6] md:text-[20px]">Global Hub</div>
        <div className="text-[10px] tracking-[0.06em] text-[#3182F6]/80 md:text-[12px]">Seoul · Korea</div>
      </div>
    </div>
  );
}
