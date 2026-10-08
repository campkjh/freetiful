'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/*
 * ⑪ 무대 장면 조각 — 둥근 사각(Figma 모서리 부드럽게 0.6) 경로 · 프레임 불러오기 · '자세히 보기' 알약 · 전체 화면 영상.
 * 토스에서 잰 값(모양 · 시간 · 곡선)만 옮겨 우리 코드로 짠 것 — 토스 코드 · CSS · 그림은 쓰지 않는다.
 */

const rad = (d: number) => (d * Math.PI) / 180;
const f2 = (v: number) => (Math.abs(v) < 0.005 ? '0' : v.toFixed(2));

/**
 * 가운데 (cx, cy) · w×h · 반지름 r 의 부드러운 둥근 사각 경로(Figma 'corner smoothing').
 * 직선은 모서리에서 (1+ξ)r 떨어진 곳부터, 원호 반지름 r. 폭이 좁으면 r ≤ min(w,h)/2 로 줄고 부드러움도 줄어 알약이 된다.
 */
export function squirclePath(cx: number, cy: number, w: number, h: number, r: number, smoothing = 0.6): string {
  if (w < 0.05 || h < 0.05) return '';
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  const budget = Math.min(w, h) / 2;
  const R = Math.min(Math.max(r, 0), budget);
  if (R < 0.05) return `M${f2(x0)} ${f2(y0)}H${f2(x0 + w)}V${f2(y0 + h)}H${f2(x0)}Z`;
  let xi = smoothing;
  let p = (1 + xi) * R;
  if (p > budget) {
    xi = Math.max(0, Math.min(xi, budget / R - 1));
    p = Math.min(p, budget);
  }
  const arcDeg = 90 * (1 - xi);
  const arc = Math.sin(rad(arcDeg / 2)) * R * Math.SQRT2;
  const alpha = (90 - arcDeg) / 2;
  const p34 = R * Math.tan(rad(alpha / 2));
  const beta = 45 * xi;
  const c = p34 * Math.cos(rad(beta));
  const d = c * Math.tan(rad(beta));
  const b = (p - arc - c - d) / 3;
  const a = 2 * b;
  const ab = a + b;
  const abc = a + b + c;
  const bc = b + c;
  const A = `a${f2(R)} ${f2(R)} 0 0 1`;
  return [
    `M${f2(x0 + p)} ${f2(y0)}H${f2(x0 + w - p)}`,
    `c${f2(a)} 0 ${f2(ab)} 0 ${f2(abc)} ${f2(d)}${A} ${f2(arc)} ${f2(arc)}c${f2(d)} ${f2(c)} ${f2(d)} ${f2(bc)} ${f2(d)} ${f2(abc)}`,
    `V${f2(y0 + h - p)}`,
    `c0 ${f2(a)} 0 ${f2(ab)} ${f2(-d)} ${f2(abc)}${A} ${f2(-arc)} ${f2(arc)}c${f2(-c)} ${f2(d)} ${f2(-bc)} ${f2(d)} ${f2(-abc)} ${f2(d)}`,
    `H${f2(x0 + p)}`,
    `c${f2(-a)} 0 ${f2(-ab)} 0 ${f2(-abc)} ${f2(-d)}${A} ${f2(-arc)} ${f2(-arc)}c${f2(-d)} ${f2(-c)} ${f2(-d)} ${f2(-bc)} ${f2(-d)} ${f2(-abc)}`,
    `V${f2(y0 + p)}`,
    `c0 ${f2(-a)} 0 ${f2(-ab)} ${f2(d)} ${f2(-abc)}${A} ${f2(arc)} ${f2(-arc)}c${f2(c)} ${f2(-d)} ${f2(bc)} ${f2(-d)} ${f2(abc)} ${f2(-d)}Z`,
  ].join('');
}

/* ─── 프레임 불러오기 — 첫 장 먼저, 나머지는 듬성듬성 → 촘촘히(스크럽 중에도 가까운 장이 늘 있게) ─── */
export type FrameLoader = {
  first: () => void;
  all: () => void;
  /** i 에서 가장 가까운 불러온 장(없으면 null) */
  nearest: (i: number) => HTMLImageElement | null;
  ready: (i: number) => boolean;
  dispose: () => void;
};

function coarseToFine(n: number): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (let step = 2 ** Math.ceil(Math.log2(Math.max(2, n))); step >= 1; step /= 2) {
    for (let i = 0; i < n; i += step) {
      if (!seen.has(i)) {
        seen.add(i);
        out.push(i);
      }
    }
    if (!seen.has(n - 1)) {
      seen.add(n - 1);
      out.push(n - 1);
    }
  }
  return out;
}

export function createFrameLoader(srcs: string[], onReady: (i: number) => void): FrameLoader {
  const n = srcs.length;
  const imgs: (HTMLImageElement | null)[] = new Array(n).fill(null);
  const state = new Array<number>(n).fill(0); // 0 없음 · 1 받는 중 · 2 준비
  const queue: number[] = [];
  let busy = 0;
  let dead = false;
  const MAX = 6;
  const pump = () => {
    while (!dead && busy < MAX && queue.length) {
      const i = queue.shift() as number;
      if (state[i] !== 0) continue;
      state[i] = 1;
      busy += 1;
      const img = new Image();
      img.decoding = 'async';
      img.src = srcs[i];
      const done = (ok: boolean) => {
        busy -= 1;
        if (dead) return;
        if (ok) {
          imgs[i] = img;
          state[i] = 2;
          onReady(i);
        } else state[i] = 0;
        pump();
      };
      const wait = typeof img.decode === 'function'
        ? img.decode()
        : new Promise<void>((res, rej) => {
            img.onload = () => res();
            img.onerror = () => rej(new Error('img'));
          });
      wait.then(() => done(true), () => done(img.complete && img.naturalWidth > 0));
    }
  };
  return {
    first: () => {
      if (state[0] === 0) queue.unshift(0);
      pump();
    },
    all: () => {
      coarseToFine(n).forEach((i) => {
        if (state[i] === 0 && !queue.includes(i)) queue.push(i);
      });
      pump();
    },
    nearest: (i: number) => {
      const k = Math.max(0, Math.min(n - 1, Math.round(i)));
      if (imgs[k]) return imgs[k];
      for (let dd = 1; dd < n; dd++) {
        if (k - dd >= 0 && imgs[k - dd]) return imgs[k - dd];
        if (k + dd < n && imgs[k + dd]) return imgs[k + dd];
      }
      return null;
    },
    ready: (i: number) => state[i] === 2,
    dispose: () => {
      dead = true;
      queue.length = 0;
    },
  };
}

/* ─── '자세히 보기' 알약 — 글자 굴림 + 화살표 바꿔 끼우기(토스 실측: 450ms 스프링, 글자마다 5ms) ─── */

/** 감쇠 스프링(넘침 ≈ 0.3%, 60% 쯤 자리잡음)을 linear() 로 굳힌 것 */
export const CTA_SPRING = (() => {
  const zeta = 0.88;
  const w = 12.5;
  const wd = w * Math.sqrt(1 - zeta * zeta);
  const pts: string[] = [];
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const v = i === N ? 1 : 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
    pts.push(v.toFixed(4));
  }
  return `linear(${pts.join(', ')})`;
})();

function Arrow() {
  return (
    <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden>
      <path d="M2.2 7h9.2M7.6 3.2 11.4 7l-3.8 3.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StageCta({ label, onClick, compact }: { label: string; onClick: () => void; compact?: boolean }) {
  const chars = Array.from(label);
  const row = (k: string) => chars.map((ch, i) => (
    <span key={`${k}${i}`} style={{ transitionDelay: `${i * 5}ms` }}>{ch}</span>
  ));
  return (
    <button type="button" className="stg-cta" data-compact={compact ? '' : undefined} onClick={onClick}>
      <span className="stg-cta-lbl" aria-hidden>
        <span className="stg-cta-r1">{row('a')}</span>
        <span className="stg-cta-r2">{row('b')}</span>
      </span>
      <span className="sr-only">{label}</span>
      <span className="stg-cta-ico" aria-hidden>
        <span className="stg-cta-dot">
          <span className="stg-cta-trk"><Arrow /><Arrow /></span>
        </span>
      </span>
    </button>
  );
}

/* ─── 전체 화면 영상(블록 1 '영상 보기') — ✕ · Esc · 바깥 눌러 닫기, 열린 동안 스크롤 멈춤 ─── */
export function VideoOverlay({ src, title, closeLabel, onClose }: { src: string; title: string; closeLabel: string; onClose: () => void }) {
  const [shown, setShown] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const vRef = useRef<HTMLVideoElement>(null);
  const cbRef = useRef(onClose);
  cbRef.current = onClose;

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const lenis = window.__bizLenis;
    lenis?.stop();
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => setShown(true));
    closeRef.current?.focus({ preventScroll: true });
    const v = vRef.current;
    if (v) {
      const p = v.play();
      if (p) p.catch(() => {});
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cbRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      html.style.overflow = prevOverflow;
      lenis?.start();
      prevFocus?.focus?.({ preventScroll: true });
    };
  }, []);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="stg-vo"
      data-shown={shown ? '' : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button ref={closeRef} type="button" className="stg-vo-x" aria-label={closeLabel} onClick={onClose}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <video ref={vRef} className="stg-vo-v" src={src} controls playsInline autoPlay preload="auto" />
    </div>,
    document.body,
  );
}
