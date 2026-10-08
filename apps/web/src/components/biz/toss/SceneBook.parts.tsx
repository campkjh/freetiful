'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { useT } from '@/lib/biz/i18n';
import { BOOK, INTRO, MATCH, MOMENTS } from './content';
import { prefersReducedMotion } from './scene';

/*
 * 예약 장면 조각 — 폰 틀 · 결제 시트(토글 · 밀어서 결제 · 점 3개) · 완료 알림 · 모바일 카드.
 * 토스 측정값(크기 · 굵기 · 색 · 둥글기)만 따라 우리 마크업으로 새로 짰다(토스 코드 · 그림 없음).
 */

/** cubic-bezier(x1,y1,x2,y2) — 진행률 t(0~1) → 값 */
export function bez(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-5) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    // 뉴턴이 못 잡으면 이분법
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 20; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-5) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

export type Reg = (k: string) => (el: HTMLElement | null) => void;
const noReg: Reg = () => () => {};

/** 시트 가격(언어 무관 숫자) */
export const SHEET_PRICE = '₩550,000';

/* ── 아이콘(직접 그림) ── */
function IcoQuote() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="4" y="2.5" width="12" height="15" rx="2.6" fill="#3182F6" />
      <path d="M7 7h6M7 10h6M7 13h3.6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IcoShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 2.2 16.2 4.6v4.7c0 4-2.6 7-6.2 8.5-3.6-1.5-6.2-4.5-6.2-8.5V4.6L10 2.2Z" fill="#3182F6" />
      <path d="m7.2 9.9 2 2 3.8-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Check({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path d="m5.5 11.4 3.6 3.6 7.4-7.6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function Arrow({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2.5 7h9M7.8 3.2 11.6 7l-3.8 3.8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 폰 틀 — 350x762, 바깥 r60 은빛 테 + 검은 베젤, 화면 326x738 r48 */
export function PhoneShell({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`absolute inset-0 ${className}`} style={style}>
      <div
        className="absolute inset-0"
        style={{
          borderRadius: 60,
          padding: 3,
          background: 'linear-gradient(150deg,#eceef1 0%,#a7aab0 22%,#e2e4e7 48%,#8f9298 74%,#d6d8db 100%)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
        }}
      >
        <div className="h-full w-full" style={{ borderRadius: 57, background: '#0c0d0f' }} />
      </div>
      <div className="absolute overflow-hidden bg-white" style={{ left: 12, top: 12, width: 326, height: 738, borderRadius: 48, transform: 'translateZ(0)' }}>
        {children}
      </div>
    </div>
  );
}

/** 폰 화면 그림(780x1688 캡처) — 위 맞춤 cover */
export function ScreenImg({ src, eager = false }: { src: string; eager?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" draggable={false} loading={eager ? 'eager' : 'lazy'} decoding="async" className="absolute inset-0 h-full w-full select-none object-cover object-top" />;
}

/**
 * 결제 시트(딤 + 아래 붙은 시트) — 326x348 r31 #F2F4F7. final=true 면 정지 상태(토글 켜짐 · 체크 파랑).
 * reg 로 움직일 조각을 넘긴다: dim, check, tog, togKnob, slideBody, slideOver, knob, glow, label, dots, dot0~2
 */
export function CheckoutSheet({ reg = noReg, final = false }: { reg?: Reg; final?: boolean }) {
  const t = useT();
  return (
    <div ref={reg('dim')} className="absolute inset-0" style={{ opacity: final ? 1 : 0 }}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }} />
      <div
        className="absolute bottom-0 left-0 flex w-full flex-col"
        style={{ height: 348, borderRadius: '31px 31px 0 0', background: '#F2F4F7', padding: '13px 16px', gap: 17 }}
      >
        <div className="mx-auto shrink-0" style={{ width: 53, height: 4, borderRadius: 2, background: 'rgba(0,27,55,0.1)' }} />
        <div style={{ padding: '0 4px 0 11px' }}>
          <div style={{ fontSize: 32, fontWeight: 700, lineHeight: '41.6px', letterSpacing: -0.64, color: '#1C1F25' }}>{SHEET_PRICE}</div>
          <div className="truncate" style={{ fontSize: 14, fontWeight: 400, lineHeight: '19.6px', letterSpacing: -0.14, color: '#8F959E' }}>{t(INTRO.chatQuoteCard.sub)}</div>
        </div>
        <div style={{ width: 294, height: 148, borderRadius: 27, background: 'rgba(255,255,255,0.7)', padding: '9px 11px 11px 20px' }}>
          {/* 1줄 — 진행자 검증 완료 ✓ */}
          <div className="flex items-center" style={{ height: 64, padding: '11px 13px 11px 0' }}>
            <div className="grid shrink-0 place-items-center" style={{ width: 37, height: 37, borderRadius: 12, background: 'rgba(26,122,249,0.09)' }}><IcoShield /></div>
            <div className="min-w-0 flex-1" style={{ paddingLeft: 15 }}>
              <div className="truncate" style={{ fontSize: 13, lineHeight: '18.2px', color: '#8F959E' }}>{t(INTRO.chatHostName)}</div>
              <div className="truncate" style={{ fontSize: 17, fontWeight: 600, lineHeight: '23.8px', letterSpacing: -0.17, color: '#1C1F25' }}>{t(MOMENTS.tiles[0])}</div>
            </div>
            <div className="relative shrink-0" style={{ width: 24, height: 24 }}>
              <div className="absolute inset-px"><Check color="rgba(0,27,55,0.15)" /></div>
              <div ref={reg('check')} className="absolute inset-px" style={{ opacity: final ? 1 : 0 }}><Check color="#3182F6" /></div>
            </div>
          </div>
          {/* 2줄 — 안전결제 켜기 토글 */}
          <div className="flex items-center" style={{ height: 64, padding: '11px 13px 11px 0' }}>
            <div className="grid shrink-0 place-items-center" style={{ width: 37, height: 37, borderRadius: 12, background: 'rgba(26,122,249,0.09)' }}><IcoQuote /></div>
            <div className="min-w-0 flex-1" style={{ paddingLeft: 15 }}>
              <div className="truncate" style={{ fontSize: 13, lineHeight: '18.2px', color: '#8F959E' }}>{t(MOMENTS.tiles[2])}</div>
              <div className="truncate" style={{ fontSize: 17, fontWeight: 600, lineHeight: '23.8px', letterSpacing: -0.17, color: '#1C1F25' }}>{t(MOMENTS.tiles[3])}</div>
            </div>
            <div className="relative shrink-0 overflow-hidden" style={{ width: 52, height: 32, borderRadius: 999, background: 'rgba(0,27,55,0.1)', padding: 3 }}>
              <div ref={reg('tog')} className="absolute inset-0" style={{ background: '#3182F6', opacity: final ? 1 : 0 }} />
              <div ref={reg('togKnob')} className="relative" style={{ width: 26, height: 26, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', transform: `translateX(${final ? 20 : 0}px)` }} />
            </div>
          </div>
        </div>
        {/* 밀어서 결제하기 */}
        <div ref={reg('slideBody')} className="relative shrink-0 overflow-hidden" style={{ width: 294, height: 60, borderRadius: 31, background: '#3182F6' }}>
          <div ref={reg('slideOver')} className="absolute inset-0" style={{ background: '#1B64DA', opacity: 0 }} />
          {/* 글자=트랙 전체 가운데(토스 실측 오차 0.5px) · 좌우 80 대칭 여백=긴 번역도 손잡이(5~75) 밑으로 안 감 */}
          <div ref={reg('label')} className="absolute inset-0 flex items-center justify-center" style={{ paddingLeft: 80, paddingRight: 80 }}>
            <span className="truncate" style={{ fontSize: 16, fontWeight: 600, lineHeight: '25.6px', letterSpacing: -0.32, color: '#fff' }}>{t(BOOK.slideLabel)}</span>
          </div>
          <div ref={reg('glow')} className="pointer-events-none absolute" style={{ left: 40 - 106, top: 30 - 94, width: 213, height: 188, background: 'radial-gradient(closest-side, rgba(255,255,255,0.42), rgba(255,255,255,0))' }} />
          <div ref={reg('knob')} className="absolute grid place-items-center" style={{ left: 0, top: 5, width: 70, height: 50, borderRadius: 80, background: '#fff', transform: 'translateX(5px)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="m10 7 5 5-5 5" stroke="#3182F6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div ref={reg('dots')} className="absolute left-1/2 top-1/2 flex items-center" style={{ width: 44, height: 10, gap: 7, opacity: 0, transform: 'translate(-50%,-50%)' }}>
            {[0, 1, 2].map((i) => (
              <span key={i} ref={reg(`dot${i}`)} className="block shrink-0" style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', opacity: 0.2, transform: 'scale(0.8)' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 완료 알림 카드 — 파란 체크 + BOOK.done */
export function DoneToast() {
  const t = useT();
  return (
    <div
      className="flex items-center"
      style={{ gap: 10, padding: '14px 18px 14px 14px', borderRadius: 22, background: '#fff', boxShadow: 'rgba(3,31,63,0.16) 0px 12px 40px -14px, rgba(3,31,63,0.06) 0 1px 3px' }}
    >
      <span className="grid shrink-0 place-items-center" style={{ width: 28, height: 28, borderRadius: 14, background: '#3182F6' }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path d="m3 7.3 2.6 2.6L11 4.4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="min-w-0 truncate" style={{ fontSize: 16, fontWeight: 700, lineHeight: '22px', letterSpacing: -0.32, color: '#1C1F25' }}>{t(BOOK.done)}</span>
    </div>
  );
}

/** 토스식 CTA 알약 — 181x48 r136, 화살표 칩 28 */
export function CtaPill({ className = '', style, innerRef }: { className?: string; style?: CSSProperties; innerRef?: (el: HTMLElement | null) => void }) {
  const t = useT();
  return (
    <Link
      ref={innerRef as never}
      href={MATCH.cards[0].href}
      className={`group inline-flex items-center whitespace-nowrap bg-[rgba(7,25,76,0.05)] transition-colors duration-200 hover:bg-[rgba(7,25,76,0.09)] ${className}`}
      style={{ height: 48, borderRadius: 136, border: '1px solid rgba(13,25,74,0.04)', padding: '11px 0 11px 18px', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', ...style }}
    >
      {/* 글자 14/600/22.4(모바일, 토스 모바일 알약) → 768↑ 16/600/25.6 */}
      <span className="text-[14px] font-semibold leading-[22.4px] tracking-[-0.28px] text-[#1C1F25] md:text-[16px] md:leading-[25.6px] md:tracking-[-0.32px]">{t(MATCH.cards[0].cta)}</span>
      <span style={{ padding: '0 10px 0 12px' }}>
        <span className="relative block overflow-hidden" style={{ width: 28, height: 28, borderRadius: 80, background: '#1C1F25' }}>
          {/* 화살표 띠 28칸 2개 — 보이는 화살표 원 가운데(14), 대기 화살표 -14(완전히 가림) · 호버 28 밀기 */}
          <span className="absolute left-0 top-0 flex h-full items-center transition-transform duration-300 ease-out group-hover:translate-x-[28px]" style={{ width: 56, marginLeft: -28 }}>
            <span className="grid w-[28px] place-items-center"><Arrow /></span>
            <span className="grid w-[28px] place-items-center"><Arrow /></span>
          </span>
        </span>
      </span>
    </Link>
  );
}

/* ── 모바일 · 태블릿: 사진 카드 2장 + 알약(토스 모바일 쇼핑 블록 어법) ── */

/** 카드 폭에 맞춰 350 폭 폰을 줄이는 배율 */
function useFitScale(ratio: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [s, setS] = useState(0.47);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setS((el.clientWidth * ratio) / 350));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ratio]);
  return { ref, s };
}

function MobileCard({ kind, title, desc, delay }: { kind: 0 | 1; title: string; desc: string; delay: number }) {
  const { ref, s } = useFitScale(0.47);
  const liRef = useRef<HTMLLIElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (prefersReducedMotion()) { setShown(true); return undefined; }
    const el = liRef.current;
    if (!el) return undefined;
    // 카드 위 끝이 화면 위에서 약 640px(=아래 24%)에 닿을 때 한 번
    const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); ob.disconnect(); } }, { rootMargin: '0px 0px -24% 0px' });
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  return (
    <li
      ref={liRef}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translate3d(0,80px,0)',
        transition: `opacity 800ms cubic-bezier(0.33,1,0.68,1) ${delay}ms, transform 800ms cubic-bezier(0.33,1,0.68,1) ${delay}ms`,
      }}
    >
      <div ref={ref} className="relative aspect-square w-full overflow-hidden" style={{ borderRadius: 32, background: 'linear-gradient(180deg,#F5F6F7 0%,#ECEEF0 100%)' }}>
        {kind === 0 && (
          <>
            <Thumb src={BOOK.thumbs[1]} style={{ left: '-1%', top: '47%', width: '23%' }} />
            <Thumb src={BOOK.thumbs[0]} style={{ right: '-1%', top: '18%', width: '23%' }} />
          </>
        )}
        {/* 1번 = 폰 위쪽(아래 잘림), 2번 = 결제 시트가 보이게 폰 아래쪽(위 잘림) */}
        <div
          className="absolute left-1/2"
          style={kind === 0
            ? { top: '20%', width: 350, height: 762, transform: `translateX(-50%) scale(${s})`, transformOrigin: '50% 0' }
            : { bottom: '9%', width: 350, height: 762, transform: `translateX(-50%) scale(${s})`, transformOrigin: '50% 100%' }}
        >
          <PhoneShell>
            <ScreenImg src={kind === 0 ? BOOK.screens.profile : BOOK.screens.checkout} />
            {kind === 1 && <CheckoutSheet final />}
          </PhoneShell>
        </div>
      </div>
      <h3 className="mt-6" style={{ fontSize: 18, fontWeight: 700, lineHeight: '26.64px', letterSpacing: -0.36, color: 'rgb(51,56,64)' }}>{title}</h3>
      <p className="mt-1" style={{ fontSize: 14, fontWeight: 400, lineHeight: '22.4px', letterSpacing: -0.28, color: 'rgb(114,119,128)' }}>{desc}</p>
    </li>
  );
}

function Thumb({ src, style }: { src: string; style: CSSProperties }) {
  return (
    <div className="absolute overflow-hidden" style={{ aspectRatio: '200 / 238', borderRadius: 16, background: '#e5e7ea', ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
    </div>
  );
}

export function MobileBook() {
  const t = useT();
  return (
    <div className="mx-auto w-full max-w-[720px] px-5 pb-12 pt-2 md:px-6">
      <ul className="grid grid-cols-1 gap-[60px] md:grid-cols-2 md:gap-6">
        {BOOK.steps.map((st, i) => (
          <MobileCard key={i} kind={i as 0 | 1} title={`${t(st.title[0])} ${t(st.title[1])}`} desc={t(st.desc)} delay={0} />
        ))}
      </ul>
      <CtaPill className="mt-5 md:mt-8" />
    </div>
  );
}
