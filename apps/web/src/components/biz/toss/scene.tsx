'use client';

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useMotionValueEvent, useScroll, type MotionValue } from 'framer-motion';
import Lenis from 'lenis';

/*
 * 비즈 페이지 스크롤 장면 엔진(261008 사장 '토스 홈페이지 완전 똑같이 — 애니메이션 · 카드 · 폰트 · CSS').
 * 토스 홈의 장면 구조(높은 부모 + 화면 높이 sticky 무대, 부모를 지나는 동안 진행률 0→1 로 연출)를 우리 코드로 다시 짠 것 —
 * 토스의 코드 · CSS · 그림 · 글꼴은 쓰지 않는다. 진행률은 framer-motion useScroll(MotionValue)로 받아 리렌더 없이 스타일을 직접 쓴다.
 */

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** p 가 [a, b] 를 지나는 동안 0 → 1 */
export const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const ease = {
  linear: (t: number) => t,
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  in: (t: number) => t * t * t,
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  /** cubic-bezier(0.22, 1, 0.36, 1) 근사 */
  smooth: (t: number) => 1 - Math.pow(1 - t, 3.2),
};

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** 장면 진행률 — 부모 위 끝이 화면 위에 닿을 때 0, 부모 아래 끝이 화면 아래에 닿을 때 1(sticky 무대가 붙어 있는 동안) */
export function useSceneProgress(ref: RefObject<HTMLElement>): MotionValue<number> {
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  return scrollYProgress;
}

/** 요소가 화면을 지나는 진행률 — 아래 끝이 화면 아래에 들어올 때 0, 위 끝이 화면 위로 나갈 때 1 */
export function usePassProgress(ref: RefObject<HTMLElement>, offset: [string, string] = ['start end', 'end start']): MotionValue<number> {
  const { scrollYProgress } = useScroll({ target: ref, offset: offset as never });
  return scrollYProgress;
}

/** 진행률이 바뀔 때마다 cb(p) — 처음 한 번 + 이후 변화마다(리렌더 없이 DOM 스타일을 직접 쓰는 용도) */
export function useFrame(progress: MotionValue<number>, cb: (p: number) => void) {
  const ref = useRef(cb);
  ref.current = cb;
  useIsoLayoutEffect(() => { ref.current(progress.get()); }, [progress]);
  useMotionValueEvent(progress, 'change', (v) => ref.current(v));
}

export function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

declare global {
  interface Window { __bizLenis?: Lenis }
}

/**
 * 부드러운 휠 스크롤(Lenis, 토스 홈과 같은 감) — 휠만 부드럽게, 터치는 기기 기본. 줄인 움직임 설정이면 끈다(설정이 바뀌면 바로 따라감).
 * rAF 는 필요할 때만 돈다 — 휠 · scrollTo 로 부드러운 이동이 시작되면 깨어나고, 멈춘 뒤 몇 프레임이면 쉰다
 * (예전엔 가만히 있어도 초당 60번 · 터치폰에서도 돌았다). 터치폰도 인스턴스는 둔다 — 섹션 이동(scrollTo)과 window.__bizLenis 를 쓰는 곳이 있다.
 */
export function SmoothScroll() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mq: MediaQueryList | null = null;
    try { mq = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch { return undefined; }
    const on = () => setReduced(!!mq?.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq?.removeEventListener?.('change', on);
  }, []);

  useEffect(() => {
    if (reduced) return undefined;
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
    window.__bizLenis = lenis;
    document.documentElement.classList.add('lenis', 'lenis-smooth');
    let raf = 0;
    let quiet = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      if (lenis.isScrolling === 'smooth') quiet = 0;
      else quiet += 1;
      if (quiet > 8) { raf = 0; return; }
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      quiet = 0;
      if (raf) return;
      lenis.time = 0; // 쉬는 동안 흐른 시간을 한 프레임에 몰아 넣지 않게(첫 프레임 Δt = 0)
      raf = requestAnimationFrame(loop);
    };
    // 휠 스크롤도 안에서 this.scrollTo 를 부르므로 이것 하나로 모든 부드러운 이동이 깨운다
    const origScrollTo = lenis.scrollTo.bind(lenis);
    lenis.scrollTo = ((...args: Parameters<Lenis['scrollTo']>) => {
      origScrollTo(...args);
      if (lenis.isScrolling === 'smooth') wake();
    }) as Lenis['scrollTo'];
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      if (window.__bizLenis === lenis) delete window.__bizLenis;
      document.documentElement.classList.remove('lenis', 'lenis-smooth');
    };
  }, [reduced]);
  return null;
}

/** 섹션으로 이동 — Lenis 가 있으면 그걸로(네이티브 smooth 와 섞이면 끊긴다) */
export function scrollToElement(el: HTMLElement, offset = 0) {
  const top = el.getBoundingClientRect().top + window.scrollY + offset;
  if (window.__bizLenis) window.__bizLenis.scrollTo(top, { duration: 1.2 });
  else window.scrollTo({ top, behavior: 'smooth' });
}
