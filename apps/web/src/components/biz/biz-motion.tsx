'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/*
 * 비즈 페이지 움직임 조각(261008 사장 '토스 홈페이지처럼') — 토스 홈의 어법(큰 글자 · 넉넉한 여백 · 스크롤에 맞춰 차오르는 문장 ·
 * 아래에서 천천히 떠오르기 · 폰 화면 보여 주기)만 따르고, 그림 · 영상 · 글꼴 · 문구는 전부 프리티풀 것.
 */

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** 화면에 들어왔는지 — 기본은 한 번 보이면 계속 true */
export function useInView<T extends Element>({ threshold = 0.18, rootMargin = '0px 0px -8% 0px', once = true }: { threshold?: number; rootMargin?: string; once?: boolean } = {}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ob = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setInView(true);
        if (once) ob.disconnect();
      } else if (!once) {
        setInView(false);
      }
    }, { threshold, rootMargin });
    ob.observe(el);
    return () => ob.disconnect();
  }, [threshold, rootMargin, once]);
  return { ref, inView };
}

/** 아래에서 천천히 떠오르기 — 0.9초 감속, 흐림 없이 */
export function FadeUp({ children, delay = 0, y = 36, className = '', style }: { children: ReactNode; delay?: number; y?: number; className?: string; style?: CSSProperties }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [still, setStill] = useState(false);
  useEffect(() => { setStill(prefersReducedMotion()); }, []);
  const shown = inView || still;
  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : `translate3d(0, ${y}px, 0)`,
        transition: `opacity .9s ${EASE} ${delay}ms, transform .9s ${EASE} ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/**
 * 스크롤에 맞춰 글자가 연회색 → 검정으로 차오르는 문장. 위 끝이 화면 아래쪽(85%)에 닿을 때 시작해
 * 문장 아래 끝이 화면 35% 쯤 올라오면 다 찬다. 읽기 프로그램에는 문장 전체를 한 번에 준다.
 */
export function ScrollFillText({ lines, className = '', base = '#D1D6DB', fill = '#191F28', as: Tag = 'h2' }: { lines: string[]; className?: string; base?: string; fill?: string; as?: 'h2' | 'h3' | 'p' }) {
  const ref = useRef<HTMLHeadingElement & HTMLParagraphElement>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setP(1);
      return undefined;
    }
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const start = vh * 0.85;
        const end = vh * 0.35;
        const total = r.height + (start - end);
        setP(Math.max(0, Math.min(1, (start - r.top) / total)));
      });
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
    };
  }, []);
  const total = lines.join('').replace(/\s/g, '').length || 1;
  let k = 0;
  return (
    <Tag ref={ref} className={className}>
      <span className="sr-only">{lines.join(' ')}</span>
      {lines.map((line, li) => (
        <span key={li} className="block" aria-hidden="true">
          {Array.from(line).map((ch, ci) => {
            if (/\s/.test(ch)) return <span key={ci}>{ch}</span>;
            const on = p * total > k;
            k += 1;
            return (
              <span key={ci} style={{ color: on ? fill : base, transition: 'color .3s ease' }}>
                {ch}
              </span>
            );
          })}
        </span>
      ))}
    </Tag>
  );
}

/** 화면에 들어오면 0 → 목표값으로 세어 올라간다(감속) */
export function CountUp({ target, suffix = '', duration = 1400 }: { target: number; suffix?: string; duration?: number }) {
  const { ref, inView } = useInView<HTMLSpanElement>({ threshold: 0.4 });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return undefined;
    if (prefersReducedMotion()) {
      setVal(target);
      return undefined;
    }
    let raf = 0;
    const st = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - st) / duration);
      setVal(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, duration]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

/**
 * 폰 틀 — 위 상태 줄(9:41) + 다이내믹 아일랜드 + 화면(390×844 캡처). screens 여러 장이면 active 장만 보이고 서로 스르르 바뀐다.
 */
export function PhoneFrame({ screens, active = 0, className = '', eager = false }: { screens: { src: string; alt: string }[]; active?: number; className?: string; eager?: boolean }) {
  return (
    <div className={className}>
      <div className="relative bg-[#101114] p-[3.2%] shadow-[0_50px_100px_-30px_rgba(0,25,60,0.45)]" style={{ borderRadius: '15% / 7%' }}>
        <div className="relative overflow-hidden bg-white" style={{ aspectRatio: '390 / 888', borderRadius: '12% / 5.4%' }}>
          {/* 상태 줄 */}
          <div className="absolute inset-x-0 top-0 z-[2] flex h-[4.95%] items-center justify-between bg-white px-[9%] pt-[1.2%]">
            <span className="text-[11px] font-semibold tracking-[-0.2px] text-[#191F28]">9:41</span>
            <span className="flex items-center gap-[3px] text-[#191F28]" aria-hidden="true">
              <svg width="15" height="10" viewBox="0 0 15 10" fill="currentColor"><rect x="0" y="6" width="2.6" height="4" rx=".7" /><rect x="4" y="4" width="2.6" height="6" rx=".7" /><rect x="8" y="2" width="2.6" height="8" rx=".7" /><rect x="12" y="0" width="2.6" height="10" rx=".7" /></svg>
              <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor"><path d="M7 2.2c2 0 3.8.8 5.1 2.1l1-1A8.6 8.6 0 0 0 7 .8 8.6 8.6 0 0 0 .9 3.3l1 1A7.2 7.2 0 0 1 7 2.2Zm0 2.9c1.2 0 2.3.5 3.1 1.3l1-1A5.8 5.8 0 0 0 7 3.7a5.8 5.8 0 0 0-4.1 1.7l1 1C4.7 5.6 5.8 5.1 7 5.1Zm0 2.9c.5 0 .9.2 1.2.5L7 9.7 5.8 8.5c.3-.3.7-.5 1.2-.5Z" /></svg>
              <svg width="22" height="10" viewBox="0 0 22 10" fill="none"><rect x=".5" y=".5" width="18" height="9" rx="2.6" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="15" height="6" rx="1.4" fill="currentColor" /><path d="M20.2 3.4v3.2c.6-.2 1-.8 1-1.6s-.4-1.4-1-1.6Z" fill="currentColor" opacity=".45" /></svg>
            </span>
          </div>
          {/* 다이내믹 아일랜드 */}
          <div className="absolute left-1/2 top-[1.1%] z-[3] h-[3.3%] w-[30%] -translate-x-1/2 rounded-full bg-[#101114]" aria-hidden="true" />
          {screens.map((s, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- public 정적 캡처
            <img
              key={s.src}
              src={s.src}
              alt={i === active ? s.alt : ''}
              aria-hidden={i === active ? undefined : true}
              loading={eager ? 'eager' : 'lazy'}
              decoding="async"
              draggable={false}
              className="absolute inset-x-0 bottom-0 top-[4.95%] h-[95.05%] w-full select-none object-cover object-top"
              style={{ opacity: i === active ? 1 : 0, transition: `opacity .55s ${EASE}` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
