'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { Check, ChevronLeft, Star } from 'lucide-react';
import { matchApi } from '@/lib/api/match.api';
import { discoveryApi } from '@/lib/api/discovery.api';
import { useAuthStore } from '@/lib/store/auth.store';
import { startOAuth } from '@/lib/auth/oauth';

/* 전문사회자 프로필 카드 (방송사 출신 아나운서 시안 카드) */
const MC_IMAGES = Array.from({ length: 18 }, (_, i) => {
  const suffix = i === 0 ? '' : `_${String(i).padStart(2, '0')}`;
  return `/images/wedding-mc/mc/KakaoTalk_20260508_171140870${suffix}.jpg`;
});

/* 실제 결혼식 후기 스크린샷 */
const COMMENT_IMAGES = Array.from({ length: 8 }, (_, i) => {
  const suffix = i === 0 ? '' : `_${String(i).padStart(2, '0')}`;
  return `/images/wedding-mc/comment/KakaoTalk_20260508_175607251${suffix}.jpg`;
});

/* 히어로 슬라이드쇼 (2초마다 페이드 전환) */
const HERO_SLIDES = [
  '/images/wedding-mc/wed/KakaoTalk_20260508_181443595_01.jpg',
  '/images/wedding-mc/wed/KakaoTalk_20260508_181443595_02.jpg',
  '/images/wedding-mc/wed/KakaoTalk_20260508_181443595_04.jpg',
  '/images/wedding-mc/wed/KakaoTalk_20260508_181443595_05.jpg',
  '/images/wedding-mc/wed/KakaoTalk_20260508_181443595.jpg',
];

const GOOGLE_SHEET_URL =
  'https://script.google.com/macros/s/AKfycbwGOi4e1J2Q1w8x-5UEe-czB3uy6mET90xBhP9OG82fl4jRPEyYdBfqJkmDZuYJMFuc/exec';

const ACTIVE_MATCH_STORAGE_KEY = 'wmc-active-match-v1';

const OX_QUIZ_BANK: { q: string; answer: 'O' | 'X'; reveal: string }[] = [
  { q: '프리티풀의 사회자는 모두 방송사 출신 또는 검증된 경력자다.', answer: 'O', reveal: 'KBS·SBS·MBC·YTN 등 방송 출신 사회자만 등록되어 있어요.' },
  { q: '결혼식 사회자 미팅은 예식 당일에만 진행한다.', answer: 'X', reveal: '예식 3~4주 전 사전 미팅을 진행해요. 흐름을 미리 맞춥니다.' },
  { q: '프리티풀은 사회자 노쇼·당일사고 0건을 유지하고 있다.', answer: 'O', reveal: '운영 시작 이후 노쇼·당일사고 0건. 사고 발생 시 대체 사회자 즉시 투입.' },
  { q: '사회자는 한 명만 골라야 한다.', answer: 'X', reveal: '여러 사회자에게 동시에 견적을 받고 비교 후 선택할 수 있어요.' },
  { q: '신랑신부 톤·분위기에 맞춰 사회자를 추천한다.', answer: 'O', reveal: '차분/밝은/감성/유쾌 등 원하시는 결혼식 톤에 맞춰 큐레이션해 드려요.' },
];

/* ─── Small helpers ─── */
function formatPhoneInput(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

function normalizePhone(raw: string): string | null {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('82')) d = '0' + d.slice(2);
  if (d.length === 10 && !d.startsWith('0')) d = '0' + d;
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) {
    if (d.startsWith('02')) return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return null;
}

/* 스크롤 진입 시 0→target 카운트업 */
function CountUp({ target, decimals = 0, suffix = '' }: { target: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [val, setVal] = useState(0);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { setStarted(true); io.unobserve(el); } }),
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!started) return;
    const duration = 1700;
    const t0 = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - t0) / duration, 1);
      setVal(target * ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setVal(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, target]);
  return <span ref={ref}>{val.toFixed(decimals)}{suffix}</span>;
}

/* 히어로 1:1 슬라이드쇼 — 2초마다 크로스페이드 */
function HeroSlides() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % HERO_SLIDES.length), 2000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative mt-7 aspect-square overflow-hidden rounded-[30px] bg-[#EEF1F6]">
      {HERO_SLIDES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt="프리티풀 전문 사회자"
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[900ms] ease-in-out"
          style={{ opacity: i === idx ? 1 : 0 }}
        />
      ))}
    </div>
  );
}

/* 계속 올라가는 카운터 (말풍선용) */
function CountTicker({ start, suffix = '' }: { start: number; suffix?: string }) {
  const [n, setN] = useState(start);
  useEffect(() => {
    const t = setInterval(() => setN((v) => v + 1), 2500);
    return () => clearInterval(t);
  }, []);
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{n}{suffix}</span>;
}

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

type Stage = 'form' | 'matching';

type ActiveMatchSnapshot = {
  matchRequestId: string;
  createdAt: number;
};

export default function WeddingMcLandingPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);

  /* ── 폼 상태 ── */
  const [stage, setStage] = useState<Stage>('form');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [eventDateTime, setEventDateTime] = useState('');
  const [agree, setAgree] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeMatch, setActiveMatch] = useState<ActiveMatchSnapshot | null>(null);

  const stickyCtaRef = useRef<HTMLDivElement | null>(null);
  const registerRef = useRef<HTMLDivElement | null>(null);
  const formStartFiredRef = useRef(false);

  useEffect(() => {
    if (authUser?.name && !name) setName(authUser.name);
    const userPhone = (authUser as any)?.phone;
    if (userPhone && !phone) setPhone(formatPhoneInput(userPhone));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  /* ── UTM 보존 ── */
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((k) => {
        const v = sp.get(k);
        if (v) sessionStorage.setItem(k, v);
      });
      if (document.referrer && !sessionStorage.getItem('referrer')) sessionStorage.setItem('referrer', document.referrer);
      if (!sessionStorage.getItem('landing_url')) sessionStorage.setItem('landing_url', window.location.href);
    } catch {}
  }, []);

  /* ── 활성 매칭 복원 — /wedding-mc 재진입 시 진행 화면 그대로 ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACTIVE_MATCH_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as ActiveMatchSnapshot;
      // 24시간 이상 지났으면 폐기
      if (Date.now() - saved.createdAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(ACTIVE_MATCH_STORAGE_KEY);
        return;
      }
      setActiveMatch(saved);
      setStage('matching');
    } catch {}
  }, []);

  /* ── 뒤로가기는 헤더 버튼으로 — 브라우저 뒤로가기 차단 제거 ── */

  /* ── Sticky CTA: 폼 진입 시 자동 숨김 ── */
  useEffect(() => {
    const sticky = stickyCtaRef.current;
    const register = registerRef.current;
    if (!sticky || !register) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => sticky.classList.toggle('hide', e.isIntersecting));
    }, { threshold: 0.05 });
    io.observe(register);
    return () => io.disconnect();
  }, []);

  /* ── 스크롤 진입 시 섹션 등장(고급 fade-up) ── */
  useEffect(() => {
    if (stage !== 'form') return;
    const els = Array.from(document.querySelectorAll<HTMLElement>('.wmc-reveal'));
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('wmc-in'); io.unobserve(e.target); }
      }),
      { threshold: 0.12, rootMargin: '0px 0px -7% 0px' },
    );
    els.forEach((el) => io.observe(el));
    // 고민 카드: 화면에 충분히 들어왔을 때만 한 줄씩 써지기 시작
    const cards = document.querySelector('.wmc-cards');
    let io2: IntersectionObserver | null = null;
    if (cards) {
      io2 = new IntersectionObserver(
        (entries) => entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('wmc-cards-in'); io2?.unobserve(e.target); }
        }),
        { threshold: 0.4 },
      );
      io2.observe(cards);
    }
    return () => { io.disconnect(); io2?.disconnect(); };
  }, [stage]);

  const fireFormStart = useCallback(() => {
    if (formStartFiredRef.current) return;
    formStartFiredRef.current = true;
    if (typeof window.fbq === 'function') window.fbq('track', 'InitiateCheckout', { content_name: 'Wedding MC Form Start' });
  }, []);

  /* ── 폼 제출 ── */
  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const normalizedPhone = normalizePhone(phone);
    if (!name.trim() || !normalizedPhone || !addressDetail.trim() || !eventDateTime || !agree) {
      setShowErrors(true);
      return;
    }

    setPhone(normalizedPhone);

    setSubmitting(true);
    const utm = {
      utm_source: sessionStorage.getItem('utm_source') || '',
      utm_medium: sessionStorage.getItem('utm_medium') || '',
      utm_campaign: sessionStorage.getItem('utm_campaign') || '',
      utm_term: sessionStorage.getItem('utm_term') || '',
      utm_content: sessionStorage.getItem('utm_content') || '',
      referrer: sessionStorage.getItem('referrer') || '',
      landing_url: sessionStorage.getItem('landing_url') || window.location.href,
    };

    // datetime-local 값: "2026-08-15T14:30" 형식. 분리해서 백엔드로
    const [datePart, timePart] = eventDateTime.split('T');
    const fullLocation = addressDetail.trim();

    // 1) Google Sheets (기존 리드 시트) — fire-and-forget
    fetch(GOOGLE_SHEET_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        name: name.trim(),
        phone: normalizedPhone,
        region: fullLocation,
        weddingDate: datePart || '',
        weddingTime: timePart || '',
        addressDetail,
        source: 'freetiful-mc-wedding-v3',
        ...utm,
      }),
    }).catch(() => undefined);

    // 2) Freetiful 백엔드 — 다수견적 + 간이 회원가입 + 토큰
    let createdMatchRequestId: string | null = null;
    try {
      const digits = normalizedPhone.replace(/\D/g, '');
      const res = await matchApi.quickRequest({
        name: name.trim() || undefined,
        phone: digits,
        categoryId: '결혼식사회자',
        type: 'multi',
        eventLocation: fullLocation,
        eventDate: datePart || undefined,
        eventTime: timePart || undefined,
        rawUserInput: {
          source: 'landing_wedding_mc_v3',
          name: name.trim(),
          phone: normalizedPhone,
          addressDetail,
          eventDateTime,
          ...utm,
        },
      });
      if (res?.accessToken && res?.refreshToken && res?.user) {
        setAuth(res.user, res.accessToken, res.refreshToken);
      }
      createdMatchRequestId = res?.matchRequest?.id || null;
      window.dispatchEvent(new Event('freetiful:match-requests-changed'));
    } catch (err: any) {
      window.alert(`제출에 실패했어요. ${err?.response?.data?.message || err?.message || ''}`);
      setSubmitting(false);
      return;
    }

    if (typeof window.fbq === 'function') {
      window.fbq('track', 'Lead', {
        content_name: 'Wedding MC Consultation',
        content_category: 'wedding-mc',
        currency: 'KRW',
      });
    }

    const snapshot: ActiveMatchSnapshot = {
      matchRequestId: createdMatchRequestId || '',
      createdAt: Date.now(),
    };
    try {
      localStorage.setItem(ACTIVE_MATCH_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {}
    setActiveMatch(snapshot);
    setStage('matching');
    setSubmitting(false);
  };

  return (
    <main className="bg-white text-[#181C24]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'SF Pro', 'Apple SD Gothic Neo', Pretendard, system-ui, sans-serif", paddingBottom: stage === 'form' ? 'calc(210px + env(safe-area-inset-bottom))' : 0 }}>
      <Script id="meta-pixel" strategy="afterInteractive">{`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '4542157089361204');
        fbq('track', 'PageView');
      `}</Script>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Allura&display=swap" />

      {stage === 'matching' && activeMatch ? (
        <MatchingScreen
          matchRequestId={activeMatch.matchRequestId}
          onResolved={() => {
            try {
              localStorage.removeItem(ACTIVE_MATCH_STORAGE_KEY);
            } catch {}
            router.push('/chat');
          }}
          onStop={() => {
            try {
              localStorage.removeItem(ACTIVE_MATCH_STORAGE_KEY);
            } catch {}
            setActiveMatch(null);
            setStage('form');
          }}
        />
      ) : (
        <>
          {/* Header */}
          <header className="sticky top-0 z-30 bg-white">
            <div className="max-w-md mx-auto px-3 h-14 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (window.history.length > 1) router.back();
                  else router.push('/main');
                }}
                aria-label="뒤로 가기"
                className="flex h-10 w-10 items-center justify-center -ml-1 rounded-full text-[#181C24] hover:bg-[#181C24]/5 active:bg-[#181C24]/10"
              >
                <ChevronLeft size={24} strokeWidth={2.2} />
              </button>
              <img src="/images/logo-freetiful-wordmark.svg" alt="Freetiful" className="h-6 w-auto" />
              <div className="w-10" />
            </div>
          </header>

          <div className="max-w-md mx-auto">
            {/* ───────── 히어로 ───────── */}
            <section className="wmc-reveal px-5 pt-6 pb-10 text-center">
              <h1 className="text-[32px] leading-[1.2] font-extrabold tracking-[-0.03em] text-[#1A1A1A]">
                {Array.from('결혼식 사회자').map((ch, i) => (
                  <span key={i} className="wmc-char" style={{ animationDelay: `${i * 0.05}s` }}>{ch === ' ' ? ' ' : ch}</span>
                ))}
                <br />
                {Array.from('아무나 구하세요?').map((ch, i) => (
                  <span key={`b${i}`} className="wmc-char text-[#3182F6]" style={{ animationDelay: `${(7 + i) * 0.05}s` }}>{ch === ' ' ? ' ' : ch}</span>
                ))}
              </h1>
              <p className="wmc-grad-text mt-4 text-[18px] leading-[1.45] font-bold">
                사회자 한 명이,<br />평생의 장면을 결정합니다.
              </p>
              <HeroSlides />
            </section>

            {/* ───────── 추천 대상 ───────── */}
            <section className="wmc-reveal wmc-cards px-5 pb-12">
              <div className="grid grid-cols-2 gap-2.5">
                {['지인의 사회가\n괜찮을지 고민되는\n예비부부', '결혼식장 연계 사회\n진행 방식이\n걱정되는 예비부부', '웃음과 감동이 있는\n특별한 예식을\n원하는 분'].map((t, i) => (
                  <div key={i} className="flex aspect-square flex-col items-center justify-center rounded-[30px] bg-[#F2F5F9] px-3 py-5 text-center text-[17px] font-semibold leading-[1.45]">
                    {t.split('\n').map((line, li) => (
                      <span key={li} className="wmc-writeline" style={{ animationDelay: `${li * 0.62}s` }}>{line}</span>
                    ))}
                  </div>
                ))}
                <div className="flex aspect-square flex-col items-center justify-center rounded-[30px] bg-[#333D4B] px-3 py-5 text-center text-[17px] font-semibold leading-[1.45]">
                  {['하객들에게 오래', '기억될 결혼식을', '꿈꾸는 분'].map((line, li) => (
                    <span key={li} className="wmc-writeline-w" style={{ animationDelay: `${li * 0.62}s` }}>{line}</span>
                  ))}
                </div>
              </div>
            </section>

            {/* ───────── Certificate / 방송사 인증 ───────── */}
            <section className="wmc-reveal px-5 pb-12 text-center">
              <p className="-mb-3 text-[40px] leading-none text-[#D7DEE8]" style={{ fontFamily: "'Allura', cursive" }}>Certificate</p>
              <h2 className="text-[32px] font-extrabold leading-[1.25] text-[#1A1A1A]">
                검증된 <span className="text-[#3182F6]">프리티풀</span>의<br />사회자들!
              </h2>
              <p className="mt-2 text-[13px] text-[#9AA4B2]">방송 3사 및 JTBC YTN등 공인</p>
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <img src="/images/wedding-mc/redesign/proof-kbs-gangwon.png" alt="KBS 강원 날씨 캐스터" className="aspect-square w-full rounded-[30px] object-cover" />
                <img src="/images/wedding-mc/redesign/proof-yonhap.jpg" alt="연합뉴스TV 함현지 캐스터" className="aspect-square w-full rounded-[30px] object-cover" />
              </div>
              <div className="my-4 rounded-2xl bg-[#F9FAFB] px-4 py-6">
                <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-4">
                  <img src="/images/wedding-mc/redesign/logos/kbs.svg" alt="KBS" style={{ height: 26, width: 'auto' }} />
                  <img src="/images/wedding-mc/redesign/logos/sbs.svg" alt="SBS" style={{ height: 28, width: 'auto' }} />
                  <img src="/images/wedding-mc/redesign/logos/mbc.svg" alt="MBC" style={{ height: 20, width: 'auto' }} />
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-4">
                  <img src="/images/wedding-mc/redesign/logos/ytn.svg" alt="YTN" style={{ height: 16, width: 'auto' }} />
                  <img src="/images/wedding-mc/redesign/logos/jtbc.svg" alt="JTBC" style={{ height: 30, width: 'auto' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <img src="/images/wedding-mc/redesign/proof-mbc.jpg" alt="MBC 정미정 아나운서" className="aspect-square w-full rounded-[30px] object-cover" />
                <img src="/images/wedding-mc/redesign/proof-kbs.jpg" alt="KBS 이원영 기상캐스터" className="aspect-square w-full rounded-[30px] object-cover" />
              </div>
              <a href="#register" className="mt-6 inline-flex min-h-[32px] min-w-[52px] items-center justify-center gap-2.5 rounded-full px-[18px] py-3 text-[17px] font-semibold transition active:scale-[0.98]" style={{ color: 'rgba(3,18,40,0.70)', backgroundColor: 'rgba(7,25,76,0.05)' }}>
                더 많은 사회자 프로필 보기
              </a>
            </section>

            {/* ───────── satisfaction (다크) ───────── */}
            <section className="wmc-reveal relative overflow-hidden bg-[#333D4B] px-5 py-14 text-center text-white">
              <img src="/images/wedding-mc/redesign/rings.png" alt="" className="wmc-float pointer-events-none absolute right-3 top-4 w-32" style={{ filter: 'drop-shadow(0 16px 22px rgba(0,0,0,0.45))' }} />
              <p className="-mb-2 text-[38px] leading-none text-white/15" style={{ fontFamily: "'Allura', cursive" }}>satisfaction</p>
              <h2 className="relative text-[32px] font-extrabold leading-[1.25]">예식에서도<br />전문성있는 만족도</h2>
              <div className="mt-5 flex items-center justify-center gap-1.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} size={32} className="wmc-star fill-[#FFC42E] text-[#FFC42E]" style={{ animationDelay: `${0.2 + i * 0.13}s` }} />
                ))}
                <span className="ml-2 text-[18px] font-bold">5</span>
              </div>
              <p className="mt-2 text-[14px] text-white/70">실제 결혼식 후기</p>
              <div className="mt-8 grid grid-cols-2 gap-3">
                <div><p className="text-[30px] font-bold">0건</p><p className="mt-1 text-[12px] text-white/60">노쇼 당일사고</p></div>
                <div><p className="text-[30px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}><CountUp target={99.7} decimals={1} suffix="%" /></p><p className="mt-1 text-[12px] text-white/60">아나운서 출신 사회자</p></div>
              </div>
              <div className="mt-8 -mx-5 overflow-hidden" style={{ maskImage: 'linear-gradient(90deg, transparent 0%, #000 7%, #000 93%, transparent 100%)', WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 7%, #000 93%, transparent 100%)' }}>
                <div className="flex gap-3 px-5" style={{ width: 'max-content', animation: 'wmcScrollX 45s linear infinite' }}>
                  {[...COMMENT_IMAGES, ...COMMENT_IMAGES].map((src, i) => (
                    <div key={i} className="w-[176px] flex-none overflow-hidden rounded-2xl shadow-[0_10px_28px_rgba(0,0,0,0.3)]">
                      <img src={src} alt="실제 결혼식 후기" loading="lazy" className="h-full w-full object-cover" style={{ aspectRatio: '9/16' }} />
                    </div>
                  ))}
                </div>
              </div>
              {/* 텍스트 리뷰 카드 (반대 방향 흐름) */}
              <div className="mt-3 -mx-5 overflow-hidden" style={{ maskImage: 'linear-gradient(90deg, transparent 0%, #000 7%, #000 93%, transparent 100%)', WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 7%, #000 93%, transparent 100%)' }}>
                <div className="flex gap-3 px-5" style={{ width: 'max-content', animation: 'wmcScrollX 36s linear infinite reverse' }}>
                  {[1, 2, 3, 4, 5, 1, 2, 3, 4, 5].map((n, i) => (
                    <div key={i} className="w-[270px] flex-none overflow-hidden rounded-[20px] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.28)]">
                      <img src={`/images/wedding-mc/redesign/rev-${n}.png`} alt="실제 고객 리뷰" loading="lazy" className="block w-full" />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ───────── 2000쌍 ───────── */}
            <section className="wmc-reveal px-5 py-14 text-center">
              <p className="-mb-1 text-[30px] leading-none text-[#BFD6FF]" style={{ fontFamily: "'Allura', cursive" }}>With Freetiful</p>
              <p className="text-[64px] font-bold leading-none tracking-[-0.03em] text-[#3182F6]" style={{ fontVariantNumeric: 'tabular-nums' }}><CountUp target={2000} suffix="쌍+" /></p>
              <h2 className="mt-4 text-[18px] font-bold leading-[1.5] text-[#1A1A1A]">
                이미 <span className="text-[#3182F6]">2,000쌍</span>의 결혼식이<br />프리티풀의 사회자와 함께였습니다.
              </h2>
              <div className="mt-7 grid grid-cols-2 gap-3">
                <img src="/images/wedding-mc/redesign/mc-1.jpg" alt="프리티풀 전문 사회자" className="w-full rounded-2xl object-cover" style={{ aspectRatio: '3/4' }} />
                <img src="/images/wedding-mc/redesign/mc-2.jpg" alt="프리티풀 전문 사회자" className="w-full rounded-2xl object-cover" style={{ aspectRatio: '3/4' }} />
              </div>
            </section>

            {/* ───────── 1위 Instagram (시안 + 릴스 원 주위 배치) ───────── */}
            <section className="wmc-reveal relative overflow-hidden">
              <img
                src="/images/wedding-mc/redesign/insta-section.jpg"
                alt="프리티풀 — Instagram 결혼식 컨텐츠 부문 조회수 1위 · 1억뷰 돌파, 프리티풀이 인기있는 이유"
                className="block w-full select-none"
                draggable={false}
                style={{ filter: 'saturate(1.18) contrast(1.04)' }}
              />
              {/* 인기 릴스 — 1위 원 주위 흩뿌려 배치 */}
              {[
                { n: 1, left: '43%', top: '2%', w: '40%', r: 2 },
                { n: 6, left: '6%', top: '12%', w: '24%', r: -5 },
                { n: 2, left: '0%', top: '31%', w: '29%', r: 3 },
                { n: 5, left: '70%', top: '34%', w: '30%', r: 5 },
                { n: 4, left: '11%', top: '55%', w: '23%', r: -3 },
                { n: 3, left: '61%', top: '53%', w: '25%', r: 3 },
              ].map((r) => (
                <img
                  key={r.n}
                  src={`/images/wedding-mc/redesign/reel-${r.n}.jpg`}
                  alt=""
                  loading="lazy"
                  className="absolute rounded-[14px] shadow-[0_12px_26px_rgba(0,18,55,0.3)]"
                  style={{ left: r.left, top: r.top, width: r.w, transform: `rotate(${r.r}deg)` }}
                />
              ))}
            </section>

            {/* ───────── 방송 진행 경력 전문 사회자 (캐러셀) ───────── */}
            <section className="wmc-reveal bg-white py-12">
              <div className="mb-6 px-5 text-center">
                <h2 className="text-[32px] font-extrabold leading-[1.25] text-[#1A1A1A]">
                  방송 진행 경력 <span className="text-[#3182F6]">전문 사회자</span>
                </h2>
              </div>
              <div className="overflow-hidden" style={{ maskImage: 'linear-gradient(90deg, transparent 0%, #000 6%, #000 94%, transparent 100%)', WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 6%, #000 94%, transparent 100%)' }}>
                <div className="flex gap-3" style={{ width: 'max-content', animation: 'wmcScrollX 60s linear infinite' }}>
                  {[...MC_IMAGES, ...MC_IMAGES].map((src, i) => (
                    <div key={i} className="w-[168px] flex-none overflow-hidden rounded-2xl shadow-[0_8px_24px_rgba(24,40,80,0.12)]">
                      <img src={src} alt="프리티풀 전문 사회자" loading="lazy" className="h-full w-full object-cover" style={{ aspectRatio: '9/16' }} />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* 신청 폼 — 시안 디자인 */}
          <section id="register" ref={registerRef} className="wmc-reveal bg-white">
            <div className="max-w-md mx-auto px-5 pt-1 pb-14">
              <form onSubmit={submit} onInput={fireFormStart} className="space-y-6">
                {/* 성함 — 언더라인 */}
                <div>
                  <label className="block text-[15px] font-bold text-[#1A1A1A]">성함</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="홍길동"
                    autoComplete="name"
                    className={`mt-2 w-full border-b-2 bg-transparent pb-2.5 text-[21px] text-[#1A1A1A] placeholder:text-[#9AA3B0] outline-none ${showErrors && !name.trim() ? 'border-[#FF4D4F] focus:border-[#FF4D4F]' : 'border-[#E5E8EE] focus:border-[#3182F6]'}`}
                  />
                  <p className={`mt-2.5 text-[14px] ${showErrors && !name.trim() ? 'text-[#FF4D4F]' : 'text-[#9AA3B0]'}`}>
                    {showErrors && !name.trim() ? '예비 신랑 신부 둘 중 한 분의 성함을 입력해주세요' : '예비 신랑 신부 둘 중 한분의 성함'}
                  </p>
                </div>

                {/* 연락처 — 언더라인 */}
                <div>
                  <label className="block text-[15px] font-bold text-[#1A1A1A]">연락처</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                    placeholder="010-0000-0000"
                    autoComplete="tel"
                    className={`mt-2 w-full border-b-2 bg-transparent pb-2.5 text-[21px] text-[#1A1A1A] placeholder:text-[#9AA3B0] outline-none ${showErrors && !normalizePhone(phone) ? 'border-[#FF4D4F] focus:border-[#FF4D4F]' : 'border-[#E5E8EE] focus:border-[#3182F6]'}`}
                  />
                  <p className={`mt-2.5 text-[14px] ${showErrors && !normalizePhone(phone) ? 'text-[#FF4D4F]' : 'text-[#9AA3B0]'}`}>
                    {showErrors && !normalizePhone(phone) ? '예비 신랑 신부 둘 중 한 분의 연락처를 입력해주세요' : '예비 신랑 신부 둘 중 한분의 연락처'}
                  </p>
                </div>

                {/* 행사 위치 */}
                <div className="space-y-2.5">
                  <input
                    type="text"
                    value={addressDetail}
                    onChange={(e) => setAddressDetail(e.target.value)}
                    placeholder="예식장 상세위치"
                    className={`w-full h-[54px] rounded-[16px] border-2 bg-white px-[18px] text-[20px] text-[#1A1A1A] placeholder:text-[#9AA3B0] outline-none ${showErrors && !addressDetail.trim() ? 'border-[#FF4D4F] focus:border-[#FF4D4F]' : 'border-[#ECEEF2] focus:border-[#3182F6]'}`}
                  />
                  {showErrors && !addressDetail.trim() && (
                    <p className="text-[14px] text-[#FF4D4F]">예식장 위치를 입력해주세요</p>
                  )}
                </div>

                {/* 행사일시 — 언더라인 */}
                <div>
                  <label className="block text-[15px] font-bold text-[#1A1A1A]">행사일시</label>
                  <input
                    type="datetime-local"
                    value={eventDateTime}
                    onChange={(e) => setEventDateTime(e.target.value)}
                    className={`mt-2 w-full border-b-2 bg-transparent pb-2.5 text-[21px] text-[#1A1A1A] outline-none ${showErrors && !eventDateTime ? 'border-[#FF4D4F] focus:border-[#FF4D4F]' : 'border-[#E5E8EE] focus:border-[#3182F6]'}`}
                    style={{ colorScheme: 'light' }}
                  />
                  {showErrors && !eventDateTime && (
                    <p className="mt-2.5 text-[14px] text-[#FF4D4F]">행사 일시를 선택해주세요</p>
                  )}
                </div>

                {/* 동의 — 파란 체크 동그라미 */}
                <div>
                  <label className="flex cursor-pointer items-center justify-center gap-3 pt-1">
                    <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="sr-only" />
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 transition-colors" style={{ borderColor: agree ? '#3182F6' : (showErrors ? '#FF4D4F' : '#D5DAE2'), backgroundColor: agree ? '#3182F6' : 'transparent' }}>
                      {agree && <Check size={16} strokeWidth={3} className="text-white" />}
                    </span>
                    <span className={`text-[16px] ${showErrors && !agree ? 'text-[#FF4D4F]' : 'text-[#3A3F49]'}`}>개인정보 수집 및 이용에 동의합니다.</span>
                  </label>
                  {showErrors && !agree && (
                    <p className="mt-1.5 text-center text-[14px] text-[#FF4D4F]">개인정보 수집·이용에 동의해주세요</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className={`w-full h-[56px] text-[17px] font-bold rounded-[16px] transition active:scale-[0.98] disabled:opacity-60 ${name.trim() && normalizePhone(phone) && addressDetail.trim() && eventDateTime && agree ? 'bg-[#3182F6] hover:bg-[#4E83F6] text-white' : 'bg-[#F2F4F6] text-[#333D4B]'}`}
                >
                  {submitting ? '전송 중...' : '비회원 의뢰하기'}
                </button>

                {/* 가입 유도 말풍선 — 카카오 로그인 위로 플로팅 (z 위로, 살짝 겹침) */}
                <div className="relative z-10 mt-4 -mb-[10px] flex justify-center">
                  <div className="wmc-bob relative w-fit">
                    <div className="rounded-[14px] bg-white px-4 py-2 text-[14px] font-bold text-[#333D4B] shadow-[0_8px_22px_rgba(0,20,60,0.16)]">
                      가입만 해도 <span className="wmc-money-grad">5,000원</span> 지급
                    </div>
                    <div className="absolute left-1/2 top-full -translate-x-1/2" style={{ width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '8px solid white' }} />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => startOAuth('kakao')}
                  style={{ marginTop: '36px' }}
                  className="flex w-full h-[56px] items-center justify-center gap-2 rounded-[16px] bg-[#FEE500] text-[17px] font-bold text-[#191600] transition active:scale-[0.98]"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#191600" aria-hidden="true"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.9 1.9 5.4 4.7 6.8-.2.7-.7 2.6-.8 3-.1.5.2.5.4.3.2-.1 2.6-1.8 3.6-2.5.7.1 1.4.2 2.1.2 5.5 0 10-3.6 10-8s-4.5-8-10-8z" /></svg>
                  카카오 로그인
                </button>
              </form>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-[#181C24]/10">
            <div className="max-w-6xl mx-auto px-5 py-10 text-center text-xs text-[#6B6F78] leading-relaxed">
              © FREETIFUL · WEDDING MC<br />
              본 페이지의 후기는 실제 고객 사례를 바탕으로 재구성되었습니다.
            </div>
          </footer>

          {/* 플로팅 푸터 (Bottom CTA 시안) */}
          <div
            ref={stickyCtaRef}
            className="wmc-sticky-cta fixed inset-x-0 bottom-0 z-40"
            style={{ transition: 'transform .35s ease, opacity .35s ease' }}
          >
            {/* 이미지 + 말풍선 — 버튼 위로 내려서 겹치게 (z 높여 버튼 위에 표시) */}
            <div className="relative z-20 -mb-[44px] px-5">
              <div className="mx-auto max-w-md">
                <div className="wmc-bob mx-auto w-fit">
                  <img src="/images/wedding-mc/redesign/money-5000.png" alt="가입만 해도 5,000원 지급" className="mx-auto -mb-1 h-[72px] w-auto" />
                  <div className="relative mx-auto w-fit">
                    <div className="rounded-[16px] bg-white px-4 py-2.5 text-[15px] font-bold text-[#333D4B] shadow-[0_8px_22px_rgba(0,20,60,0.16)]">
                      가입만 해도 <span className="wmc-money-grad">5,000원</span> 지급
                    </div>
                    <div className="absolute left-1/2 top-full -translate-x-1/2" style={{ width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '9px solid white' }} />
                  </div>
                </div>
              </div>
            </div>
            {/* 그라데이션 페이드 — 무료견적 받기 버튼 직전부터 흰색 시작 */}
            <div className="h-9 bg-gradient-to-b from-white/0 to-white" />
            <div className="bg-white px-5" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
              <div className="mx-auto max-w-md">
                <a href="#register" className="wmc-cta-bounce flex h-[56px] items-center justify-center rounded-[16px] bg-[#3182F6] hover:bg-[#4E83F6] text-[17px] font-bold text-white">
                  30초 무료견적 받기
                </a>
                <p className="mt-3 text-center text-[13px] leading-[1.5] text-[#00132B]/[0.58]">
                  이미 13000명의 예신예랑이<br />프리티풀 사회자와 함께 했어요
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx global>{`
        @keyframes wmcScrollX {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .wmc-sticky-cta.hide {
          transform: translateY(110%);
          opacity: 0;
          pointer-events: none;
        }
        .wmc-reveal {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.95s cubic-bezier(0.22, 1, 0.36, 1), transform 0.95s cubic-bezier(0.22, 1, 0.36, 1);
          will-change: opacity, transform;
        }
        .wmc-reveal.wmc-in {
          opacity: 1;
          transform: none;
        }
        @keyframes wmcGradFlow {
          0% { background-position: 0% center; }
          100% { background-position: -200% center; }
        }
        .wmc-grad-text {
          background-image: linear-gradient(90deg, #8B95A1 0%, #3182F6 25%, #8B95A1 50%, #3182F6 75%, #8B95A1 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          animation: wmcGradFlow 5s linear infinite;
        }
        .wmc-money-grad {
          background-image: linear-gradient(90deg, #1A1A1A 0%, #F5871F 25%, #1A1A1A 50%, #F5871F 75%, #1A1A1A 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          animation: wmcGradFlow 4.5s linear infinite;
        }
        @keyframes wmcCharBounce {
          0% { opacity: 0; transform: translateY(0.55em); }
          55% { opacity: 1; transform: translateY(-0.2em); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .wmc-char { display: inline-block; opacity: 0; animation: wmcCharBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        @keyframes wmcWrite {
          from { background-position: 100% 0; }
          to { background-position: 0% 0; }
        }
        .wmc-writeline, .wmc-writeline-w {
          display: block;
          background-size: 300% 100%;
          background-position: 100% 0;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        .wmc-writeline { background-image: linear-gradient(90deg, #191F28 0%, #191F28 38%, #3182F6 48%, #7FB0FF 50%, #3182F6 52%, #B0B8C1 62%, #B0B8C1 100%); }
        .wmc-writeline-w { background-image: linear-gradient(90deg, #FFFFFF 0%, #FFFFFF 38%, #7FB0FF 48%, #BBD9FF 50%, #7FB0FF 52%, #5C6678 62%, #5C6678 100%); }
        .wmc-cards-in .wmc-writeline, .wmc-cards-in .wmc-writeline-w { animation: wmcWrite 1.15s cubic-bezier(0.45, 0, 0.25, 1) forwards; }
        @keyframes wmcBreathe {
          0% { background-position: 175% 0; }
          100% { background-position: -75% 0; }
        }
        @keyframes wmcMsgFade {
          from { opacity: 0; transform: translateY(7px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .wmc-breathe {
          background-image: linear-gradient(90deg, #2A5BFF 0%, #2A5BFF 36%, #8FB8FF 48%, #D5E4FF 50%, #8FB8FF 52%, #2A5BFF 64%, #2A5BFF 100%);
          background-size: 250% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          animation: wmcMsgFade 0.55s ease both, wmcBreathe 3.6s ease-in-out infinite;
        }
        .wmc-msgfade { display: inline-block; animation: wmcMsgFade 0.5s ease both; }
        @keyframes wmcAvatarPop {
          0% { opacity: 0; transform: scale(0.3); }
          10% { opacity: 1; transform: scale(1); }
          55% { opacity: 1; transform: scale(1); }
          66% { opacity: 0; transform: scale(0.3); }
          100% { opacity: 0; transform: scale(0.3); }
        }
        .wmc-avatar-pop { opacity: 0; animation: wmcAvatarPop 3.6s ease-in-out infinite; will-change: opacity, transform; }
        @keyframes wmcCenterReveal {
          0% { opacity: 0; transform: scale(0.55); }
          55% { opacity: 1; transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }
        .wmc-center-reveal { animation: wmcCenterReveal 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes wmcFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-13px) rotate(-4deg); }
        }
        .wmc-float { animation: wmcFloat 4.5s ease-in-out infinite; will-change: transform; }
        @keyframes wmcBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .wmc-bob { animation: wmcBob 3s ease-in-out infinite; }
        @keyframes wmcCtaBounce {
          0%, 70%, 100% { transform: translateY(0); }
          80% { transform: translateY(-7px); }
          88% { transform: translateY(0); }
          93% { transform: translateY(-3px); }
          98% { transform: translateY(0); }
        }
        .wmc-cta-bounce { animation: wmcCtaBounce 2.6s ease-in-out infinite; }
        @keyframes wmcStarPop {
          0% { opacity: 0; transform: scale(0.2); }
          70% { opacity: 1; transform: scale(1.28); }
          100% { opacity: 1; transform: scale(1); }
        }
        .wmc-star { opacity: 0; transform: scale(0.2); transform-origin: center; }
        .wmc-in .wmc-star { animation: wmcStarPop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        @media (prefers-reduced-motion: reduce) {
          .wmc-reveal { opacity: 1 !important; transform: none !important; }
          .wmc-grad-text { animation: none; -webkit-text-fill-color: #7A828F; color: #7A828F; }
          .wmc-money-grad { animation: none; -webkit-text-fill-color: #F5871F; color: #F5871F; }
          .wmc-char { animation: none; opacity: 1; transform: none; }
          .wmc-writeline { animation: none; -webkit-text-fill-color: #191F28; color: #191F28; }
          .wmc-writeline-w { animation: none; -webkit-text-fill-color: #FFFFFF; color: #FFFFFF; }
          .wmc-breathe { animation: none; -webkit-text-fill-color: #2A5BFF; color: #2A5BFF; }
          .wmc-avatar-pop { animation: none; opacity: 1; transform: none; }
          .wmc-center-reveal { animation: none; }
          .wmc-float { animation: none; }
          .wmc-cta-bounce { animation: none; }
          .wmc-star { opacity: 1 !important; transform: none !important; animation: none !important; }
          .wmc-bob { animation: none; }
        }
      `}</style>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   매칭 진행 화면 — 파장 애니메이션 + 사회자 확인 메시지 + OX퀴즈 +
   사회자 프로필 미리보기 (하단 시트), 채팅방 생기면 자동 종료
   ═══════════════════════════════════════════════════════════════════ */

type DeliveryItem = {
  id: string;
  status: string;
  proProfile?: {
    id: string;
    user?: { id: string; name: string | null; profileImageUrl: string | null };
    images?: { imageUrl: string }[];
  };
  viewedAt?: string | null;
  repliedAt?: string | null;
};

type ChatRoomItem = {
  id: string;
  proProfile?: {
    user?: { id: string; name: string | null; profileImageUrl: string | null };
  };
};

/* 실제 사회자 프로필 폴백(목록 API 실패 시) */
const FALLBACK_PRO_IMAGES = [
  '/images/pro-15/IMG_0196.avif',
  '/images/pro-23/IMG_46511771924269213.avif',
  '/images/pro-12/IMG_27221772621229571.avif',
  '/images/pro-31/025209A2-09A8-4777-9A6A-DF4751F560A71772850104015.avif',
];

const MATCHING_HEADLINES = [
  '사회자를 찾는 중입니다…',
  '예식 톤에 맞는 사회자를 고르고 있어요',
  '방송 경력 사회자에게 견적을 보내고 있어요',
  '검증된 사회자들을 매칭하는 중이에요',
];

function MatchingScreen({
  matchRequestId,
  onResolved,
  onStop,
}: {
  matchRequestId: string;
  onResolved: () => void;
  onStop: () => void;
}) {
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [hasReply, setHasReply] = useState(false);
  const [showProSheet, setShowProSheet] = useState(false);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizPicked, setQuizPicked] = useState<null | 'O' | 'X'>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const [centerIdx, setCenterIdx] = useState(0);
  const [proImages, setProImages] = useState<string[]>(FALLBACK_PRO_IMAGES);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const router = useRouter();

  /* ── 헤드라인 문구 10초마다 순환 ── */
  useEffect(() => {
    const id = setInterval(() => setMsgIdx((i) => (i + 1) % MATCHING_HEADLINES.length), 10000);
    return () => clearInterval(id);
  }, []);

  /* ── 중앙 사회자 프로필 2.6초마다 교체(팝업) ── */
  useEffect(() => {
    const id = setInterval(() => setCenterIdx((i) => i + 1), 2600);
    return () => clearInterval(id);
  }, []);

  /* ── 실제 사회자 프로필 목록 로드(폴백: 실제 사회자) ── */
  useEffect(() => {
    let stop = false;
    discoveryApi.getProList()
      .then((res: any) => {
        const list = Array.isArray(res) ? res : res?.data;
        if (stop || !Array.isArray(list)) return;
        const imgs = list
          .map((p: any) => p.profileImageUrl || (Array.isArray(p.images) ? p.images[0] : undefined))
          .filter(Boolean) as string[];
        if (imgs.length > 0) setProImages(imgs.slice(0, 12));
      })
      .catch(() => {});
    return () => { stop = true; };
  }, []);

  /* ── 매칭 상태 폴링 (5초마다) ── */
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const list = await matchApi.getMyRequests();
        const target = Array.isArray(list)
          ? (matchRequestId
              ? list.find((r: any) => r.id === matchRequestId) ||
                list[0]
              : list[0])
          : null;
        if (!stop && target) {
          setDeliveries(Array.isArray(target.deliveries) ? target.deliveries : []);
          const chatRooms: ChatRoomItem[] = Array.isArray(target.chatRooms) ? target.chatRooms : [];
          const replied = (target.deliveries || []).some(
            (d: any) => d.status === 'replied' || d.repliedAt,
          );
          if (chatRooms.length > 0 || replied) {
            setHasReply(true);
          }
        }
      } catch {}
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [matchRequestId]);

  /* ── 답장 감지 시 채팅으로 이동 ── */
  useEffect(() => {
    if (!hasReply) return;
    const t = setTimeout(onResolved, 1200);
    return () => clearTimeout(t);
  }, [hasReply, onResolved]);

  /* ── OX 퀴즈 진행 ── */
  const quiz = OX_QUIZ_BANK[quizIdx % OX_QUIZ_BANK.length];
  const onPickQuiz = (pick: 'O' | 'X') => {
    if (quizPicked) return;
    setQuizPicked(pick);
    setTimeout(() => {
      setQuizPicked(null);
      setQuizIdx((i) => i + 1);
    }, 2500);
  };

  /* ── 사회자가 요청 확인했다는 메시지 표시용 ── */

  const viewerAvatars = deliveries
    .filter((d) => d.status === 'viewed' || d.viewedAt)
    .map((d) => d.proProfile?.user?.profileImageUrl || d.proProfile?.images?.[0]?.imageUrl)
    .filter(Boolean) as string[];
  const centerAvatars = viewerAvatars.length > 0 ? viewerAvatars : proImages;

  return (
    <div className="h-[100dvh] flex flex-col bg-gradient-to-b from-[#EEF2FF] via-white to-white relative overflow-hidden">
      {/* 그만 찾기 확인 — window.confirm은 iOS WKWebView(WKUIDelegate 미구현)에서 표시되지 않아 인페이지 모달로 대체 */}
      {showStopConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-8"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setShowStopConfirm(false)}
        >
          <div
            className="w-full max-w-[320px] rounded-2xl bg-white p-6 text-center shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[17px] font-bold text-[#191F28]">정말로 그만 찾으시겠습니까?</p>
            <p className="mt-2 text-[14px] leading-[1.5] text-[#8B95A1]">지금 그만두면 진행 중인 매칭이 중단됩니다.</p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowStopConfirm(false)}
                className="flex-1 rounded-xl bg-[#F2F4F6] py-3 text-[15px] font-semibold text-[#4E5968] active:bg-[#E5E8EB]"
              >
                계속 찾기
              </button>
              <button
                type="button"
                onClick={() => { setShowStopConfirm(false); onStop(); }}
                className="flex-1 rounded-xl bg-[#2272EB] py-3 text-[15px] font-semibold text-white active:bg-[#1b5fd0]"
              >
                그만 찾기
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 상단 헤더 */}
      <header className="shrink-0 bg-white">
        <div className="max-w-2xl mx-auto px-3 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowStopConfirm(true)}
            aria-label="그만 찾기"
            className="flex h-10 w-10 items-center justify-center -ml-1 rounded-full text-[#181C24] hover:bg-[#181C24]/5 active:bg-[#181C24]/10"
          >
            <ChevronLeft size={24} strokeWidth={2.2} />
          </button>
          <img src="/images/logo-freetiful-wordmark.svg" alt="Freetiful" className="h-6 w-auto" />
          <div className="w-10" />
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col justify-center max-w-2xl w-full mx-auto px-5 py-3 text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-[#191F28]" style={{ letterSpacing: '-0.035em' }}>
          <span key={msgIdx} className="wmc-msgfade inline-block">{MATCHING_HEADLINES[msgIdx]}</span>
        </h1>
        {/* 파장 + 중앙 사회자 프로필 (견적 본 사회자가 팝업) */}
        <div className="relative mt-6 flex items-center justify-center shrink-0" style={{ height: 'clamp(150px, 26vh, 230px)' }}>
          <span className="wmc-ripple wmc-ripple-1" />
          <span className="wmc-ripple wmc-ripple-2" />
          <span className="wmc-ripple wmc-ripple-3" />
          <div className="relative z-10 h-[92px] w-[92px] rounded-full bg-white p-1.5 shadow-[0_12px_30px_rgba(34,114,235,0.22)]">
            <img
              key={centerIdx}
              src={centerAvatars[centerIdx % centerAvatars.length]}
              alt="사회자 프로필"
              className="wmc-center-reveal h-full w-full rounded-full object-cover bg-[#E9EEF6]"
              onError={(e) => { const t = e.currentTarget as HTMLImageElement; if (!t.dataset.fb) { t.dataset.fb = '1'; t.src = '/images/default-profile.png'; } }}
            />
          </div>
        </div>

        {/* OX 퀴즈 */}
        <div className="mt-8 bg-white rounded-[30px] p-5 text-center shadow-[0_0_18px_0_rgba(127,174,255,0.16)]">
          <p className="text-[16px] font-medium tracking-normal text-[#8B95A1] mb-2">기다리는 동안 OX 퀴즈</p>
          <p className="text-[20px] font-bold text-[#191F28] leading-snug min-h-[2.6em]">
            {quiz.q}
          </p>
          <div className="grid grid-cols-2 gap-3 mt-5">
            {(['O', 'X'] as const).map((mark) => {
              const isO = mark === 'O';
              const picked = quizPicked === mark;
              const correct = quizPicked && mark === quiz.answer;
              const wrong = quizPicked === mark && mark !== quiz.answer;
              const dim = quizPicked && !picked && !correct;
              return (
                <button
                  key={mark}
                  type="button"
                  onClick={() => onPickQuiz(mark)}
                  disabled={!!quizPicked}
                  className={`flex flex-col items-center justify-center gap-2.5 rounded-[24px] py-5 transition-all active:scale-[0.98] disabled:cursor-default ${isO ? 'bg-[#E9F3FF]' : 'bg-[#FED4D6]'} ${dim ? 'opacity-40' : ''} ${correct ? 'ring-2 ring-offset-2 ring-[#3787FF]' : ''} ${wrong ? 'ring-2 ring-offset-2 ring-[#FF6767]' : ''}`}
                >
                  <span className={`flex h-[68px] w-[68px] items-center justify-center rounded-full text-white ${isO ? 'bg-[#6EA0FF]' : 'bg-[#FF6767]'}`}>
                    {isO ? (
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="8" /></svg>
                    ) : (
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    )}
                  </span>
                  <span className={`text-[18px] font-bold ${isO ? 'text-[#3787FF]' : 'text-[#FF6767]'}`}>{isO ? '그렇다' : '아니다'}</span>
                </button>
              );
            })}
          </div>
          {quizPicked && (
            <p className="mt-4 text-[13px] text-[#4B5563] leading-relaxed" style={{ animation: 'wmcFadeIn 0.4s' }}>
              <b className="text-[#2A5BFF]">정답 {quiz.answer}</b> — {quiz.reveal}
            </p>
          )}
        </div>
      </div>


      {/* 사회자 리스트 모달 (위로 슬라이드 업) */}
      {showProSheet && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/45" onClick={() => setShowProSheet(false)} style={{ animation: 'wmcFadeIn 0.2s' }} />
          <div
            className="absolute left-0 right-0 bottom-0 bg-white rounded-t-3xl max-h-[85vh] flex flex-col"
            style={{ animation: 'wmcSheetUp 0.32s cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <div className="w-12 h-1 bg-[#D1D5DB] rounded-full mx-auto my-3" />
            <div className="px-5 pb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold">사회자 미리보기</h3>
              <button
                type="button"
                onClick={() => setShowProSheet(false)}
                className="text-[#6B6F78] text-sm font-semibold"
              >
                닫기
              </button>
            </div>
            <div className="px-5 pb-1 text-xs text-[#9DA1AA]">
              사회자를 살펴봐도 매칭은 계속 진행돼요. 답장이 오면 자동으로 채팅으로 이동합니다.
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {deliveries.length === 0 ? (
                <p className="text-center text-[#9DA1AA] text-sm py-12">아직 매칭된 사회자가 없습니다…</p>
              ) : (
                deliveries.map((d) => {
                  const proName = d.proProfile?.user?.name || '사회자';
                  const proId = d.proProfile?.id;
                  const src =
                    d.proProfile?.user?.profileImageUrl ||
                    d.proProfile?.images?.[0]?.imageUrl ||
                    '/images/default-profile.png';
                  const viewed = d.status === 'viewed' || !!d.viewedAt;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        if (proId) {
                          // 새 탭으로 사회자 상세 — 매칭 화면 보존
                          window.open(`/pros/${proId}`, '_blank');
                        }
                      }}
                      className="w-full flex items-center gap-3 bg-white border border-[#181C24]/10 rounded-2xl p-3 hover:border-[#2A5BFF]/30 transition-colors text-left"
                    >
                      <img
                        src={src}
                        alt={proName}
                        className="w-14 h-14 rounded-xl object-cover bg-gray-100 flex-none"
                        onError={(e) => {
                          const t = e.currentTarget as HTMLImageElement;
                          if (!t.dataset.fb) {
                            t.dataset.fb = '1';
                            t.src = '/images/default-profile.png';
                          }
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#181C24] truncate">{proName} 사회자</p>
                        <p className="text-xs text-[#6B6F78] mt-0.5">
                          {viewed ? '요청을 확인했어요' : '곧 확인할 예정이에요'}
                        </p>
                      </div>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9DA1AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {hasReply && (
        <div className="fixed inset-0 z-[60] bg-black/55 flex items-center justify-center p-5" style={{ animation: 'wmcFadeIn 0.25s' }}>
          <div className="bg-white rounded-3xl p-8 text-center max-w-sm w-full">
            <div className="text-5xl mb-3">🎉</div>
            <p className="text-xl font-bold text-[#181C24]">사회자가 답장했어요!</p>
            <p className="text-sm text-[#6B6F78] mt-2">채팅으로 이동합니다…</p>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes wmcRipple {
          0% { transform: translate(-50%, -50%) scale(0.45); opacity: 0; }
          12% { opacity: 0.5; }
          100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
        }
        @keyframes wmcSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes wmcFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes wmcSheetUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .wmc-ripple {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          background: rgba(34, 114, 235, 0.20);
          animation: wmcRipple 3.4s cubic-bezier(0.22, 0.61, 0.36, 1) infinite;
          pointer-events: none;
        }
        .wmc-ripple-2 { animation-delay: 1.13s; background: rgba(34, 114, 235, 0.15); }
        .wmc-ripple-3 { animation-delay: 2.26s; background: rgba(34, 114, 235, 0.1); }
      `}</style>
    </div>
  );
}
