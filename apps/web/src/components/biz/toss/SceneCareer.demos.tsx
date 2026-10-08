'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { clamp01, ease, lerp, prefersReducedMotion } from './scene';

/*
 * 경력 장면 검은 카드 3장의 움직이는 화면(토스 '증권' 검은 카드 자리 — 우리 코드로 새로 짠 것).
 * 모두 500x600 설계 무대(stage px) 기준 — 카드 폭/500 배율로 줄여 그린다. 화면에 보일 때만 돈다.
 */

/** 요소가 화면 근처에 있을 때만 rAF 로 cb(경과 ms) — 줄인 움직임이면 안 돈다 */
function useLoop(ref: React.RefObject<HTMLElement>, cb: (t: number) => void) {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return undefined;
    let raf = 0;
    let start = -1;
    let paused = 0;
    let pausedAt = 0;
    const tick = (now: number) => {
      if (start < 0) start = now;
      cbRef.current(now - start - paused);
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (!raf) {
          if (pausedAt) paused += performance.now() - pausedAt;
          raf = requestAnimationFrame(tick);
        }
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        pausedAt = performance.now();
      }
    }, { rootMargin: '120px 0px' });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [ref]);
}

const FONT = 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif';

/* ───────── ① 영어 진행 — 원문 타이핑 → 번역 훑기 ───────── */

const T_TYPE_CPS = 26; // 초당 글자
const T_PAUSE = 400;
const T_SWEEP = 1600;
const T_HOLD = 1200;
const T_FADE = 300;
const T_GAP = 300;
const RAMP = 5; // 커서 뒤 흰→회색 글자 수
const C_DONE = [246, 247, 249];
const C_PEND = [115, 115, 115];
const mix = (t: number) => `rgb(${C_DONE.map((v, i) => Math.round(lerp(v, C_PEND[i], t))).join(',')})`;

export function TranslateDemo({ source, target, badge, kicker }: { source: string; target: string; badge: string; kicker: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLSpanElement>(null);
  const rampRef = useRef<HTMLSpanElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const pendRef = useRef<HTMLSpanElement>(null);
  const last = useRef('');
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = prefersReducedMotion();
    if (reduce.current && doneRef.current) {
      doneRef.current.textContent = target;
      doneRef.current.style.color = mix(0);
      if (caretRef.current) caretRef.current.style.opacity = '0';
    }
  }, [target]);

  useLoop(rootRef, (t) => {
    const src = Array.from(source);
    const tgt = Array.from(target);
    const tType = (src.length / T_TYPE_CPS) * 1000;
    const total = tType + T_PAUSE + T_SWEEP + T_HOLD + T_FADE + T_GAP;
    const c = t % total;
    let done = '';
    let doneColor = mix(0);
    let ramp: string[] = [];
    let pend = '';
    let caret = 1;
    let op = 1;
    if (c < tType) {
      // 원문 타이핑(회색)
      done = src.slice(0, Math.floor((c / tType) * src.length) + 1).join('');
      doneColor = mix(1);
    } else if (c < tType + T_PAUSE) {
      done = source;
      doneColor = mix(1);
      caret = Math.floor(c / 260) % 2 ? 0 : 1;
    } else if (c < tType + T_PAUSE + T_SWEEP) {
      // 번역 훑기 — 커서가 지나간 자리부터 번역문
      const s = ease.inOut((c - tType - T_PAUSE) / T_SWEEP);
      const nt = Math.round(s * tgt.length);
      const ns = Math.round(s * src.length);
      const head = tgt.slice(0, nt);
      ramp = head.slice(Math.max(0, nt - RAMP));
      done = head.slice(0, Math.max(0, nt - RAMP)).join('');
      pend = src.slice(ns).join('');
    } else {
      done = target;
      caret = 0;
      const h = c - tType - T_PAUSE - T_SWEEP - T_HOLD;
      if (h > 0) op = 1 - clamp01(h / T_FADE);
      if (h > T_FADE) done = '';
    }
    const key = `${done}|${ramp.join('')}|${pend}|${caret}|${doneColor}|${op.toFixed(2)}`;
    if (key === last.current) return;
    last.current = key;
    if (doneRef.current) { doneRef.current.textContent = done; doneRef.current.style.color = doneColor; }
    if (rampRef.current) {
      const n = ramp.length;
      rampRef.current.innerHTML = '';
      ramp.forEach((ch, i) => {
        const sp = document.createElement('span');
        sp.textContent = ch;
        sp.style.color = mix((RAMP - n + i + 1) / (RAMP + 1));
        rampRef.current!.appendChild(sp);
      });
    }
    if (caretRef.current) caretRef.current.style.opacity = String(caret);
    if (pendRef.current) pendRef.current.textContent = pend;
    if (bodyRef.current) bodyRef.current.style.opacity = String(op);
  });

  return (
    <div ref={rootRef} style={{ position: 'absolute', inset: 0 }}>
      {/* 아래쪽 흰 고리 빛 */}
      <div aria-hidden style={{ position: 'absolute', left: -85, top: 360, width: 670, height: 670, borderRadius: '50%', border: '34px solid #fff', filter: 'blur(56px)', opacity: 0.92 }} />
      <div
        style={{
          position: 'absolute', left: 50, top: 180, width: 400, height: 240, borderRadius: '6.09% / 10.2%', overflow: 'hidden',
          background: 'linear-gradient(131.44deg, rgba(0,0,0,.286) 18.55%, rgba(0,0,0,.39) 80.75%)',
          backdropFilter: 'blur(21px)', WebkitBackdropFilter: 'blur(21px)', border: '1.1px solid rgb(51,56,64)', fontFamily: FONT,
        }}
      >
        <div aria-hidden style={{ position: 'absolute', left: -60, top: 10, width: 584, height: 262, borderRadius: 999, background: 'rgba(255,255,255,.016)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', left: 27, top: 27, fontSize: 17.9, fontWeight: 500, lineHeight: '26px', color: 'rgba(246,247,249,.5)' }}>{kicker}</div>
        <div style={{ position: 'absolute', right: 20, top: 15, height: 35, padding: '0 11px 0 14px', display: 'flex', alignItems: 'center', gap: 4, borderRadius: 22, border: '1.1px solid rgba(78,77,76,.44)', background: 'rgba(217,217,217,.03)', fontSize: 16.4, fontWeight: 500, color: 'rgba(255,255,255,.45)', whiteSpace: 'nowrap' }}>
          {badge}
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div ref={bodyRef} style={{ position: 'absolute', left: 27, right: 27, top: 92, fontSize: 22.3, fontWeight: 600, lineHeight: '35.8px', letterSpacing: '-0.01em', wordBreak: 'keep-all' }}>
          <span ref={doneRef} />
          <span ref={rampRef} />
          <span ref={caretRef} style={{ display: 'inline-block', width: 2.2, height: 22, margin: '0 1px', borderRadius: 1, background: 'rgba(255,255,255,.85)', verticalAlign: '-3px' }} />
          <span ref={pendRef} style={{ color: mix(1) }} />
        </div>
        {/* 말하는 중 막대 */}
        <div aria-hidden className="cr-eq" style={{ position: 'absolute', left: '50%', top: 196, transform: 'translateX(-50%)', display: 'flex', gap: 4, alignItems: 'center', height: 20 }}>
          {[0, 1, 2, 3].map((i) => <i key={i} style={{ animationDelay: `${i * 130}ms` }} />)}
        </div>
      </div>
    </div>
  );
}

/* ───────── ② 식순 — 시간표 + 진행 표시 ───────── */

const Q_STEP = 1500;
const Q_MOVE = 520;
const Q_CREEP = 0.24;
const Q_HOLD = 2600;
const Q_RESET = 900;
const ROW_H = 34;
const ROW_TOP = 64;

function RollDigit({ d }: { d: number }) {
  return (
    <span style={{ display: 'inline-block', height: '1em', overflow: 'hidden', verticalAlign: 'top' }}>
      <span style={{ display: 'flex', flexDirection: 'column', transform: `translateY(${-d}em)`, transition: 'transform 420ms cubic-bezier(0.22,1,0.36,1)' }}>
        {Array.from({ length: 10 }, (_, i) => <span key={i} style={{ height: '1em', lineHeight: '1em' }}>{i}</span>)}
      </span>
    </span>
  );
}

export function CuesheetDemo({ title, steps, now }: { title: string; steps: { time: string; label: string }[]; now: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(2);
  const activeRef = useRef(2);
  const N = steps.length;

  useEffect(() => {
    if (!prefersReducedMotion()) { activeRef.current = 0; setActive(0); }
  }, []);

  const place = (pos: number) => {
    const y = pos * ROW_H;
    if (markRef.current) markRef.current.style.transform = `translate3d(0,${y}px,0)`;
    if (fillRef.current) fillRef.current.style.transform = `scaleY(${clamp01(pos / (N - 1))})`;
  };

  useLoop(rootRef, (t) => {
    const last = N - 1;
    const total = last * Q_STEP + Q_HOLD + Q_RESET;
    const c = t % total;
    let pos: number;
    let idx: number;
    if (c < last * Q_STEP + Q_HOLD) {
      idx = Math.min(last, Math.floor(c / Q_STEP));
      const local = c - idx * Q_STEP;
      const from = idx === 0 ? 0 : idx - 1 + Q_CREEP;
      const move = idx === 0 ? idx : lerp(from, idx, ease.outQuart(clamp01(local / Q_MOVE)));
      const creep = idx < last ? Q_CREEP * clamp01((local - Q_MOVE) / (Q_STEP - Q_MOVE)) : 0;
      pos = move + creep;
    } else {
      idx = 0;
      pos = lerp(last, 0, ease.inOut(clamp01((c - last * Q_STEP - Q_HOLD) / Q_RESET)));
    }
    place(pos);
    if (idx !== activeRef.current) { activeRef.current = idx; setActive(idx); }
  });

  useEffect(() => { if (prefersReducedMotion()) place(2); }, []);

  const time = steps[active]?.time ?? '00:00';
  return (
    <div ref={rootRef} style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute', left: 85, top: 110, width: 330, height: 380, borderRadius: 26, overflow: 'hidden', fontFamily: FONT,
          background: 'linear-gradient(90deg, rgba(0,0,0,.48), rgba(0,0,0,.65)), rgba(79,82,93,.44)',
          backdropFilter: 'blur(19px)', WebkitBackdropFilter: 'blur(19px)', border: '1px solid rgba(51,56,64,.5)',
        }}
      >
        <div aria-hidden style={{ position: 'absolute', left: -40, top: 60, width: 410, height: 220, borderRadius: 999, background: 'rgba(255,255,255,.016)', filter: 'blur(60px)' }} />
        {/* 머리 — 제목 + 생방송 점 */}
        <div style={{ position: 'absolute', left: 24, right: 24, top: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 18, fontWeight: 700, lineHeight: '25.2px', color: 'rgba(255,255,255,.9)' }}>{title}</span>
          <span aria-hidden style={{ position: 'relative', width: 36, height: 20, borderRadius: 11, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.06)' }}>
            <span className="cr-ping" style={{ position: 'absolute', right: 6, top: 5, width: 8, height: 8, borderRadius: 4, background: '#F04251', color: 'rgba(240,66,81,.45)' }} />
          </span>
        </div>
        {/* 시간표 */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: ROW_TOP }}>
          {/* 줄 강조 — 한 칸씩 째깍 */}
          <div aria-hidden style={{ position: 'absolute', left: 16, right: 16, top: 0, height: ROW_H - 2, borderRadius: 10, background: 'rgba(255,255,255,.07)', transform: `translateY(${active * ROW_H}px)`, transition: 'transform 380ms cubic-bezier(0.25,1,0.5,1)' }} />
          {/* 세로 길 + 채움 */}
          <div aria-hidden style={{ position: 'absolute', left: 31, top: ROW_H / 2 - 1, width: 2, height: (N - 1) * ROW_H, borderRadius: 1, background: 'rgba(255,255,255,.1)' }}>
            <div ref={fillRef} style={{ position: 'absolute', inset: 0, borderRadius: 1, transformOrigin: '50% 0', transform: 'scaleY(0)', background: 'linear-gradient(180deg, rgba(240,66,81,.15), #F04251)' }} />
          </div>
          {steps.map((s, i) => {
            const state = i < active ? 'past' : i === active ? 'now' : 'next';
            return (
              <div key={i} style={{ position: 'relative', height: ROW_H, display: 'flex', alignItems: 'center' }}>
                <span aria-hidden style={{ position: 'absolute', left: 29, top: ROW_H / 2 - 4, width: 6, height: 6, borderRadius: 3, background: state === 'next' ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.55)', transition: 'background .3s' }} />
                <span style={{ position: 'absolute', left: 50, fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: state === 'now' ? 'rgba(232,235,240,.8)' : state === 'past' ? 'rgba(232,235,240,.45)' : 'rgba(232,235,240,.27)', transition: 'color .3s' }}>{s.time}</span>
                <span style={{ position: 'absolute', left: 104, right: 24, fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: state === 'now' ? '#fff' : state === 'past' ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.3)', transition: 'color .3s' }}>{s.label}</span>
              </div>
            );
          })}
          {/* 지금 표시 */}
          <div ref={markRef} aria-hidden style={{ position: 'absolute', left: 27, top: ROW_H / 2 - 5, width: 10, height: 10, willChange: 'transform' }}>
            <span className="cr-ping" style={{ position: 'absolute', inset: 0, borderRadius: 5, background: '#F04251', boxShadow: '0 0 0 2px rgba(0,0,0,.5)', color: 'rgba(240,66,81,.4)' }} />
          </div>
        </div>
        {/* 아래 — 진행 중 시각(굴러가는 숫자) */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: 'rgba(246,247,249,.5)' }}>{now}</span>
          <span
            aria-label={time}
            style={{
              display: 'inline-flex', fontSize: 30, fontWeight: 700, lineHeight: '39px', height: 39, alignItems: 'center', color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
              WebkitMaskImage: 'linear-gradient(transparent 0, #000 15%, #000 75%, transparent 100%)', maskImage: 'linear-gradient(transparent 0, #000 15%, #000 75%, transparent 100%)',
            }}
          >
            {Array.from(time).map((ch, i) => (/\d/.test(ch) ? <RollDigit key={i} d={Number(ch)} /> : <span key={i} style={{ padding: '0 1px' }}>{ch}</span>))}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ───────── ③ 전국 — 점 지도 + 도시 핀 ───────── */

// 대한민국 윤곽(경도, 위도) — 대충 그린 다각형
const KR: [number, number][] = [
  [126.55, 37.76], [126.42, 37.5], [126.62, 37.22], [126.85, 36.96], [126.48, 36.92], [126.15, 36.75], [126.38, 36.55], [126.52, 36.3],
  [126.7, 36.0], [126.48, 35.62], [126.42, 35.3], [126.33, 35.0], [126.38, 34.72], [126.3, 34.38], [126.6, 34.4], [126.9, 34.42],
  [127.25, 34.5], [127.45, 34.62], [127.75, 34.72], [128.05, 34.85], [128.4, 34.84], [128.68, 34.75], [128.75, 35.0], [129.05, 35.05],
  [129.3, 35.32], [129.45, 35.7], [129.57, 36.08], [129.42, 36.5], [129.38, 37.0], [129.2, 37.35], [128.95, 37.72], [128.62, 38.12],
  [128.36, 38.6], [128.1, 38.33], [127.75, 38.3], [127.3, 38.3], [127.05, 38.12], [126.85, 37.95], [126.68, 37.92],
];
const JEJU = { lon: 126.55, lat: 33.38, rx: 0.34, ry: 0.15 };
const CITY_LL: [number, number][] = [[126.98, 37.57], [126.66, 37.46], [127.38, 36.35], [128.6, 35.87], [126.85, 35.16], [129.06, 35.18], [126.53, 33.47]];
const M_S = 84; // 1도 = 72 stage px
const M_LON0 = 127.85;
const M_LAT0 = 35.95;
const M_CX = 258;
const M_CY = 250;
const proj = (lon: number, lat: number): [number, number] => [(lon - M_LON0) * 0.81 * M_S, (M_LAT0 - lat) * M_S];

function inPoly(x: number, y: number, poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

type Dot = { x: number; y: number; edge: boolean };
let DOTS: Dot[] | null = null;
function mapDots(): Dot[] {
  if (DOTS) return DOTS;
  const poly = KR.map(([lo, la]) => proj(lo, la));
  const [jx, jy] = proj(JEJU.lon, JEJU.lat);
  const jrx = JEJU.rx * 0.81 * M_S;
  const jry = JEJU.ry * M_S;
  const inside = (x: number, y: number) => inPoly(x, y, poly) || ((x - jx) / jrx) ** 2 + ((y - jy) / jry) ** 2 <= 1;
  const G = 6.0;
  const out: Dot[] = [];
  for (let y = -260; y <= 270; y += G) {
    for (let x = -150; x <= 150; x += G) {
      if (!inside(x, y)) continue;
      const edge = !inside(x + G, y) || !inside(x - G, y) || !inside(x, y + G) || !inside(x, y - G);
      out.push({ x, y, edge });
    }
  }
  DOTS = out;
  return out;
}

const PIN_COLORS = ['#3182F6', '#F04251'];
// 이름표 차례 — 붙어 있는 도시가 같이 뜨지 않게(서울→부산→인천→대구→제주→대전→광주)
const LABEL_ORDER = [0, 5, 1, 3, 6, 2, 4];
const LABEL_EVERY = 1700;
const LABEL_LIFE = 3400;

export function MapDemo({ cities, pill }: { cities: string[]; pill: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pinRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scale = useRef(1);
  const cityXY = CITY_LL.map(([lo, la]) => proj(lo, la));

  // 3D 기울임 + 투영(무대 px)
  const view = (t: number) => {
    const ay = (Math.sin((t / 16000) * Math.PI * 2) * 9 * Math.PI) / 180;
    const ax = ((16 + Math.sin((t / 11000) * Math.PI * 2) * 3) * Math.PI) / 180;
    const az = (Math.sin((t / 21000) * Math.PI * 2) * 1.6 * Math.PI) / 180;
    const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax), cz = Math.cos(az), sz = Math.sin(az);
    return (x0: number, y0: number) => {
      const x = x0 * cz - y0 * sz;
      const y = x0 * sz + y0 * cz;
      const x1 = x * cy;
      const z1 = -x * sy;
      const y2 = y * cx - z1 * sx;
      const z2 = y * sx + z1 * cx;
      const p = 900 / (900 + z2);
      return [M_CX + x1 * p, M_CY + y2 * p, z2, p] as const;
    };
  };

  const draw = (t: number) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const k = scale.current;
    const W = Math.round(500 * k * dpr);
    const H = Math.round(600 * k * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    ctx.setTransform(k * dpr, 0, 0, k * dpr, 0, 0);
    ctx.clearRect(0, 0, 500, 600);
    const P = view(t);
    const sweep = ((t / 5200) % 1) * 760 - 380; // 대각선 빛 띠
    for (const d of mapDots()) {
      const [sx, sy, z, p] = P(d.x, d.y);
      const band = d.x * 0.55 + d.y - sweep;
      const hl = Math.exp(-(band * band) / 2600) * 0.45;
      const depth = clamp01(0.5 - z / 260);
      const a = Math.min(1, (d.edge ? 0.82 : 0.34 + depth * 0.3) + hl);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#E6E8EC';
      ctx.beginPath();
      ctx.arc(sx, sy, (d.edge ? 1.7 : 1.45) * p, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // 핀 · 이름표
    const cycle = cities.length * LABEL_EVERY;
    cityXY.forEach(([x, y], i) => {
      const [sx, sy] = P(x, y);
      const pin = pinRefs.current[i];
      if (pin) pin.style.transform = `translate3d(${sx.toFixed(1)}px,${sy.toFixed(1)}px,0)`;
      const lab = labelRefs.current[i];
      if (lab) {
        // 차례로 2개씩 떠 있다
        const age = (((t - LABEL_ORDER.indexOf(i) * LABEL_EVERY) % cycle) + cycle) % cycle;
        const on = age < LABEL_LIFE;
        lab.style.transform = `translate3d(${(sx + 10).toFixed(1)}px,${(sy - 12).toFixed(1)}px,0) translateY(-100%)`;
        lab.dataset.on = on ? '1' : '0';
      }
    });
  };

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return undefined;
    const measure = () => {
      const w = cv.getBoundingClientRect().width;
      if (w > 0) scale.current = w / 500;
    };
    measure();
    const ro = new ResizeObserver(() => {
      measure();
      if (prefersReducedMotion()) staticDraw();
    });
    ro.observe(cv);
    const staticDraw = () => {
      draw(0);
      labelRefs.current.forEach((l, i) => { if (l) l.dataset.on = i === 0 || i === 5 ? '1' : '0'; });
    };
    if (prefersReducedMotion()) staticDraw();
    return () => ro.disconnect();
  }, []);

  useLoop(rootRef, draw);

  return (
    <div ref={rootRef} style={{ position: 'absolute', inset: 0, fontFamily: FONT }}>
      {/* 그늘진 구 */}
      <div aria-hidden style={{ position: 'absolute', left: M_CX - 300, top: M_CY - 290, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle at 38% 32%, rgba(83,86,96,.42) 0, rgba(39,41,47,.6) 34%, rgba(12,13,16,.9) 72%, rgba(5,5,6,0) 100%)', boxShadow: '0 0 52px rgba(102,108,125,.14)' }} />
      <canvas ref={canvasRef} aria-hidden style={{ position: 'absolute', left: 0, top: 0, width: 500, height: 600 }} />
      {/* 아래 어둡게 */}
      <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 130, background: 'linear-gradient(0deg, #111317 25%, rgba(17,19,23,0))' }} />
      {cities.map((c, i) => (
        <div key={`p${i}`} ref={(el) => { pinRefs.current[i] = el; }} aria-hidden style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, willChange: 'transform' }}>
          <span className="cr-ping" style={{ position: 'absolute', left: -4, top: -4, width: 8, height: 8, borderRadius: 4, background: PIN_COLORS[i % 2], color: i % 2 ? 'rgba(240,66,81,.3)' : 'rgba(49,130,246,.3)' }} />
        </div>
      ))}
      {cities.map((c, i) => (
        <div key={`l${i}`} ref={(el) => { labelRefs.current[i] = el; }} className="cr-maplabel" data-on="0" style={{ position: 'absolute', left: 0, top: 0, willChange: 'transform' }}>
          <span
            style={{
              display: 'block', padding: '9px 13px', borderRadius: 12, whiteSpace: 'nowrap', fontSize: 15, fontWeight: 700, lineHeight: '19px', color: 'rgb(228,228,229)',
              background: i % 2 ? 'rgba(240,66,81,.14)' : 'rgba(49,130,246,.14)', backdropFilter: 'blur(25px)', WebkitBackdropFilter: 'blur(25px)',
              boxShadow: 'inset 0 0 43.6px rgba(0,0,0,.18), inset 0 0 0 .6px rgba(255,255,255,.07)', border: '.5px solid rgba(0,0,0,.16)',
            }}
          >
            {c}
          </span>
        </div>
      ))}
      {/* 생방송 알약 */}
      <div style={{ position: 'absolute', left: 196, bottom: 40, transform: 'translateX(-50%)', height: 48, padding: '0 17px', display: 'flex', alignItems: 'center', gap: 7, borderRadius: 453, whiteSpace: 'nowrap', background: 'rgba(217,217,255,.03)', backdropFilter: 'blur(11px)', WebkitBackdropFilter: 'blur(11px)', boxShadow: 'inset -0.69px 2.77px 28.7px rgba(72,75,82,.5)' } as CSSProperties}>
        <span className="cr-ping" aria-hidden style={{ position: 'relative', width: 7, height: 7, borderRadius: 4, background: 'rgba(255,255,255,.86)', color: 'rgba(255,255,255,.3)' }} />
        <span style={{ fontSize: 18.2, fontWeight: 600, lineHeight: '22.6px', letterSpacing: '-0.15px', backgroundImage: 'linear-gradient(92deg, rgba(255,255,255,.86) 30%, rgba(170,170,170,.62) 72%, rgba(200,200,200,.62) 133%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{pill}</span>
      </div>
    </div>
  );
}
