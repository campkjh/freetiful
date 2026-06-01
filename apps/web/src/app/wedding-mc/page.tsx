'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { ChevronLeft } from 'lucide-react';
import { matchApi } from '@/lib/api/match.api';
import { useAuthStore } from '@/lib/store/auth.store';

/* ─── Assets ─── */
const MC_IMAGES = Array.from({ length: 18 }, (_, i) => {
  const suffix = i === 0 ? '' : `_${String(i).padStart(2, '0')}`;
  return `/images/wedding-mc/mc/KakaoTalk_20260508_171140870${suffix}.jpg`;
});
const COMMENT_IMAGES = Array.from({ length: 8 }, (_, i) => {
  const suffix = i === 0 ? '' : `_${String(i).padStart(2, '0')}`;
  return `/images/wedding-mc/comment/KakaoTalk_20260508_175607251${suffix}.jpg`;
});
const WED_IMAGES = [
  '/images/wedding-mc/wed/KakaoTalk_20260508_181443595.jpg',
  '/images/wedding-mc/wed/KakaoTalk_20260508_181443595_01.jpg',
  '/images/wedding-mc/wed/KakaoTalk_20260508_181443595_02.jpg',
  '/images/wedding-mc/wed/KakaoTalk_20260508_181443595_04.jpg',
  '/images/wedding-mc/wed/KakaoTalk_20260508_181443595_05.jpg',
];
const HERO_IMG = '/images/wedding-mc/wed/KakaoTalk_20260508_181443595.jpg';

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
function CountUp({ target, decimals = 0, suffix }: { target: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [shown, setShown] = useState(target === 0);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { setShown(true); io.unobserve(el); } });
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!shown) return;
    const start = performance.now();
    const duration = 1400;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setVal(target * ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setVal(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shown, target]);
  return (
    <>
      <span ref={ref}>{val.toFixed(decimals)}</span>
      {suffix && <span className="text-[#2A5BFF]/70">{suffix}</span>}
    </>
  );
}

function FadeUp({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { setShown(true); io.unobserve(el); } });
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{ opacity: shown ? 1 : 0, transform: shown ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity 0.9s ease, transform 0.9s ease' }}>
      {children}
    </div>
  );
}

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

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    daum?: { Postcode: new (opts: { oncomplete: (data: any) => void; onclose?: () => void }) => { open: () => void } };
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
  const [zonecode, setZonecode] = useState('');
  const [address, setAddress] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [eventDateTime, setEventDateTime] = useState('');
  const [agree, setAgree] = useState(false);
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

  const fireFormStart = useCallback(() => {
    if (formStartFiredRef.current) return;
    formStartFiredRef.current = true;
    if (typeof window.fbq === 'function') window.fbq('track', 'InitiateCheckout', { content_name: 'Wedding MC Form Start' });
  }, []);

  /* ── Daum 우편번호 ── */
  const openPostcode = useCallback(() => {
    if (!window.daum?.Postcode) {
      window.alert('주소 검색을 불러오는 중입니다. 잠시 후 다시 눌러주세요.');
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data: any) => {
        setZonecode(data.zonecode || '');
        // roadAddress 우선, 없으면 jibunAddress
        setAddress(data.roadAddress || data.jibunAddress || data.address || '');
      },
    }).open();
  }, []);

  /* ── 폼 제출 ── */
  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!agree) return window.alert('개인정보 수집·이용에 동의해주세요.');
    if (!name.trim()) return window.alert('성함을 입력해주세요.');
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return window.alert('연락처 형식을 확인해주세요. (예: 010-1234-1234)');
    if (!address.trim()) return window.alert('행사 위치를 입력해주세요.');
    if (!eventDateTime) return window.alert('행사 일시를 선택해주세요.');

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
    const fullLocation = `${address}${addressDetail ? ' ' + addressDetail.trim() : ''}${zonecode ? ` (${zonecode})` : ''}`.trim();

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
        zonecode,
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
          zonecode,
          address,
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
    <main className="bg-white text-[#181C24]" style={{ paddingBottom: stage === 'form' ? 'calc(96px + env(safe-area-inset-bottom))' : 0 }}>
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
      <Script src="https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js" strategy="lazyOnload" />

      {stage === 'matching' && activeMatch ? (
        <MatchingScreen
          matchRequestId={activeMatch.matchRequestId}
          onResolved={() => {
            try {
              localStorage.removeItem(ACTIVE_MATCH_STORAGE_KEY);
            } catch {}
            router.push('/chat');
          }}
        />
      ) : (
        <>
          {/* Header */}
          <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-[#181C24]/10">
            <div className="max-w-6xl mx-auto px-3 md:px-5 h-14 flex items-center justify-between">
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
              <img src="/images/logo-freetiful-wordmark.svg" alt="Freetiful" className="h-6 md:h-7 w-auto" />
              <div className="w-10" />
            </div>
          </header>

          {/* §1 HERO */}
          <section className="relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(60% 40% at 50% 0%, rgba(42,91,255,0.10), transparent 70%)' }} />
            <FadeUp className="relative max-w-6xl mx-auto px-5 pt-16 pb-14 md:pt-24 md:pb-20">
              <div className="grid md:grid-cols-2 gap-8 md:gap-12 md:items-center text-center md:text-left">
                <div className="md:row-start-1 md:col-start-1">
                  <p className="text-[11px] tracking-[0.28em] uppercase text-[#2A5BFF] mb-6">Wedding MC</p>
                  <h1 className="text-[36px] md:text-[60px] font-extrabold mb-6" style={{ letterSpacing: '-0.035em', lineHeight: 1.25 }}>
                    결혼식 사회자,<br />
                    <span className="text-[#2A5BFF]">아무나 구하세요?</span>
                  </h1>
                  <p className="text-[#181C24] text-xl md:text-3xl font-extrabold mb-6" style={{ lineHeight: 1.4 }}>
                    사회자 한 명이,<br />
                    <span className="text-[#2A5BFF]">평생의 장면</span>을 결정합니다.
                  </p>
                  <p className="text-[#6B6F78] text-sm md:text-base leading-relaxed">
                    KBS · SBS · MBC 출신 아나운서 중심,<br />
                    우리 예식에 맞는 검증된 사회자를 안내해드립니다.
                  </p>
                </div>
                <div className="md:row-start-1 md:col-start-2 md:row-span-2">
                  <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
                    <img src={HERO_IMG} alt="결혼식 진행 중인 프리티풀 전문 사회자" className="w-full h-full object-cover" />
                  </div>
                </div>
                <div className="md:row-start-2 md:col-start-1">
                  <a href="#register" className="inline-block bg-[#2A5BFF] hover:bg-[#5478FF] text-white font-extrabold px-8 py-4 rounded-full transition shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
                    무료 견적 받기 →
                  </a>
                  <p className="mt-4 text-xs md:text-sm text-[#6B6F78]">⚡ 1분이면 신청 끝 · 검증된 사회자들에게 동시 견적</p>
                </div>
              </div>
              <div className="mt-14 md:mt-20 grid grid-cols-3 gap-3 max-w-3xl mx-auto">
                <div className="bg-[#F5F6FA] border border-[#181C24]/10 rounded-2xl p-4 md:p-6 text-center">
                  <p className="text-2xl md:text-4xl font-extrabold text-[#181C24]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <CountUp target={120} suffix="+" />
                  </p>
                  <p className="text-[#6B6F78] text-[11px] md:text-xs mt-2 tracking-wider">아나운서 출신 사회자</p>
                </div>
                <div className="bg-[#F5F6FA] border border-[#181C24]/10 rounded-2xl p-4 md:p-6 text-center">
                  <p className="text-2xl md:text-4xl font-extrabold text-[#181C24]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <CountUp target={99.7} decimals={1} suffix="%" />
                  </p>
                  <p className="text-[#6B6F78] text-[11px] md:text-xs mt-2 tracking-wider">예식 만족도</p>
                </div>
                <div className="bg-[#F5F6FA] border border-[#181C24]/10 rounded-2xl p-4 md:p-6 text-center">
                  <p className="text-2xl md:text-4xl font-extrabold text-[#181C24]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <CountUp target={0} />
                  </p>
                  <p className="text-[#6B6F78] text-[11px] md:text-xs mt-2 tracking-wider">노쇼 · 당일사고</p>
                </div>
              </div>
            </FadeUp>
          </section>

          {/* §2 ROSTER (compact) */}
          <section className="border-y border-[#181C24]/10 py-12 md:py-16 bg-[#F5F6FA]">
            <FadeUp className="max-w-6xl mx-auto">
              <div className="text-center px-5 mb-6">
                <p className="text-[11px] tracking-[0.28em] uppercase text-[#2A5BFF] mb-3">Verified MCs</p>
                <h2 className="text-2xl md:text-4xl font-extrabold" style={{ letterSpacing: '-0.035em', lineHeight: 1.3 }}>
                  방송 진행 경력 <span className="text-[#2A5BFF]">전문 사회자</span>
                </h2>
              </div>
              <div className="overflow-hidden" style={{ maskImage: 'linear-gradient(90deg, transparent 0%, #000 6%, #000 94%, transparent 100%)', WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 6%, #000 94%, transparent 100%)' }}>
                <div className="flex gap-3" style={{ width: 'max-content', animation: 'wmcScrollX 60s linear infinite' }}>
                  {[...MC_IMAGES, ...MC_IMAGES].map((src, i) => (
                    <div key={i} className="w-[160px] md:w-[200px] flex-none rounded-[14px] overflow-hidden">
                      <img src={src} alt="" className="w-full h-full object-cover" style={{ aspectRatio: '9/16' }} loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            </FadeUp>
          </section>

          {/* §3 Reviews (compact) */}
          <section>
            <FadeUp className="max-w-6xl mx-auto px-5 py-14 md:py-20">
              <p className="text-[11px] tracking-[0.28em] uppercase text-[#2A5BFF] text-center mb-3">Reviews</p>
              <h2 className="text-2xl md:text-4xl font-extrabold text-center mb-8" style={{ letterSpacing: '-0.035em', lineHeight: 1.3 }}>
                실제 결혼식 후기
              </h2>
              <div className="overflow-hidden" style={{ maskImage: 'linear-gradient(90deg, transparent 0%, #000 5%, #000 95%, transparent 100%)', WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 5%, #000 95%, transparent 100%)' }}>
                <div className="flex gap-3" style={{ width: 'max-content', animation: 'wmcScrollX 50s linear infinite' }}>
                  {[...COMMENT_IMAGES, ...COMMENT_IMAGES].map((src, i) => (
                    <div key={i} className="w-[200px] md:w-[260px] flex-none rounded-[14px] overflow-hidden shadow-[0_8px_24px_rgba(24,28,36,0.08)]">
                      <img src={src} alt="" className="w-full h-full object-cover" style={{ aspectRatio: '9/16' }} loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            </FadeUp>
          </section>

          {/* §4 Social proof */}
          <section className="bg-[#F5F6FA] border-y border-[#181C24]/10">
            <FadeUp className="relative max-w-5xl mx-auto px-5 py-14 md:py-20 text-center">
              <p className="text-[11px] tracking-[0.28em] uppercase text-[#2A5BFF] mb-4">Together</p>
              <p className="font-extrabold text-[#2A5BFF] leading-none mb-4" style={{ fontSize: 'clamp(56px, 11vw, 120px)', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
                <CountUp target={2000} suffix="쌍+" />
              </p>
              <h2 className="text-xl md:text-3xl font-extrabold mb-4" style={{ letterSpacing: '-0.035em', lineHeight: 1.3 }}>
                이미 <span className="text-[#2A5BFF]">2,000쌍</span>의 결혼식이<br />
                프리티풀의 사회자와 함께였습니다.
              </h2>
              <div className="mt-10 overflow-hidden" style={{ maskImage: 'linear-gradient(90deg, transparent 0%, #000 4%, #000 96%, transparent 100%)', WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 4%, #000 96%, transparent 100%)' }}>
                <div className="flex gap-3" style={{ width: 'max-content', animation: 'wmcScrollX 55s linear infinite' }}>
                  {[...WED_IMAGES, ...WED_IMAGES].map((src, i) => (
                    <div key={i} className="w-[180px] md:w-[220px] flex-none rounded-[12px] overflow-hidden">
                      <img src={src} alt="" className="w-full h-full object-cover" style={{ aspectRatio: '4/5' }} loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            </FadeUp>
          </section>

          {/* §5 FORM */}
          <section id="register" ref={registerRef} className="bg-[#F5F6FA] border-t border-[#181C24]/10">
            <FadeUp className="max-w-2xl mx-auto px-5 py-16 md:py-24">
              <p className="text-[11px] tracking-[0.28em] uppercase text-[#2A5BFF] text-center mb-3">무료 견적 신청</p>
              <h2 className="text-2xl md:text-4xl font-extrabold text-center mb-3" style={{ letterSpacing: '-0.035em', lineHeight: 1.3 }}>
                1분이면 끝.<br />
                <span className="text-[#2A5BFF]">검증된 사회자들</span>에게 동시에 견적 요청
              </h2>
              <p className="text-[#6B6F78] text-center text-sm md:text-base mt-3 mb-10">
                4개 정보만 입력하면 사회자들이 직접 연락드려요.
              </p>

              <form
                onSubmit={submit}
                onInput={fireFormStart}
                className="bg-white border border-[#181C24]/10 rounded-2xl p-6 md:p-8 space-y-5"
              >
                {/* 이름 */}
                <div>
                  <label className="text-sm font-semibold text-[#181C24] block mb-2">성함 *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="홍길동"
                    autoComplete="name"
                    className="w-full px-4 py-3.5 border-[1.5px] border-[#181C24]/10 rounded-xl text-[15px] bg-white text-[#181C24] focus:border-[#2A5BFF] outline-none"
                  />
                </div>

                {/* 전화 */}
                <div>
                  <label className="text-sm font-semibold text-[#181C24] block mb-2">연락처 *</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                    placeholder="010-0000-0000"
                    autoComplete="tel"
                    className="w-full px-4 py-3.5 border-[1.5px] border-[#181C24]/10 rounded-xl text-[15px] bg-white text-[#181C24] focus:border-[#2A5BFF] outline-none"
                  />
                </div>

                {/* 행사 위치 (Daum 우편번호) */}
                <div>
                  <label className="text-sm font-semibold text-[#181C24] block mb-2">행사 위치 *</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={zonecode}
                      readOnly
                      placeholder="우편번호"
                      className="w-[120px] px-4 py-3.5 border-[1.5px] border-[#181C24]/10 rounded-xl text-[14px] bg-[#F5F6FA] text-[#181C24]"
                    />
                    <button
                      type="button"
                      onClick={openPostcode}
                      className="flex-1 px-4 py-3.5 border-[1.5px] border-[#2A5BFF]/30 rounded-xl text-[14px] font-semibold bg-white text-[#2A5BFF] hover:bg-[#2A5BFF]/5 active:bg-[#2A5BFF]/10"
                    >
                      📍 주소 검색
                    </button>
                  </div>
                  <input
                    type="text"
                    value={address}
                    readOnly
                    placeholder="주소를 검색해주세요"
                    className="w-full px-4 py-3.5 border-[1.5px] border-[#181C24]/10 rounded-xl text-[15px] bg-[#F5F6FA] text-[#181C24] mb-2"
                  />
                  <input
                    type="text"
                    value={addressDetail}
                    onChange={(e) => setAddressDetail(e.target.value)}
                    placeholder="상세 위치 (웨딩홀명, 층, 홀 이름 등)"
                    className="w-full px-4 py-3.5 border-[1.5px] border-[#181C24]/10 rounded-xl text-[15px] bg-white text-[#181C24] focus:border-[#2A5BFF] outline-none"
                  />
                </div>

                {/* 행사 일시 */}
                <div>
                  <label className="text-sm font-semibold text-[#181C24] block mb-2">행사 일시 *</label>
                  <input
                    type="datetime-local"
                    value={eventDateTime}
                    onChange={(e) => setEventDateTime(e.target.value)}
                    className="w-full px-4 py-3.5 border-[1.5px] border-[#181C24]/10 rounded-xl text-[15px] bg-white text-[#181C24] focus:border-[#2A5BFF] outline-none"
                    style={{ colorScheme: 'light' }}
                  />
                </div>

                {/* 동의 */}
                <label
                  className="flex items-center gap-3 px-4 py-3.5 border-[1.5px] rounded-xl cursor-pointer text-sm transition-all"
                  style={{ borderColor: agree ? '#2A5BFF' : 'rgba(24,28,36,0.12)', background: agree ? 'rgba(42,91,255,0.06)' : '#fff' }}
                >
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                    style={{ accentColor: '#2A5BFF', width: 18, height: 18 }}
                  />
                  <span>
                    개인정보 수집·이용에 동의합니다 <a href="#" className="text-[#2A5BFF] underline">자세히</a>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-[56px] bg-[#2A5BFF] hover:bg-[#5478FF] text-white text-[16px] font-extrabold rounded-full transition shadow-[0_14px_30px_rgba(42,91,255,0.28)] active:scale-[0.98] disabled:opacity-60"
                >
                  {submitting ? '전송 중...' : '무료 견적 요청하기 →'}
                </button>

                <p className="text-center text-xs text-[#6B6F78]">
                  접수 즉시 검증된 사회자들이 직접 견적을 보내드려요.
                </p>
              </form>
            </FadeUp>
          </section>

          {/* Footer */}
          <footer className="border-t border-[#181C24]/10">
            <div className="max-w-6xl mx-auto px-5 py-10 text-center text-xs text-[#6B6F78] leading-relaxed">
              © FREETIFUL · WEDDING MC<br />
              본 페이지의 후기는 실제 고객 사례를 바탕으로 재구성되었습니다.
            </div>
          </footer>

          {/* Sticky CTA */}
          <div
            ref={stickyCtaRef}
            className="wmc-sticky-cta fixed left-0 right-0 bottom-0 z-40 px-4 py-3 bg-white/90 backdrop-blur border-t border-[#181C24]/10"
            style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', transition: 'transform .35s ease, opacity .35s ease' }}
          >
            <div className="max-w-[720px] mx-auto">
              <a href="#register" className="block bg-[#2A5BFF] hover:bg-[#5478FF] text-white text-center font-extrabold py-3.5 md:py-4 rounded-full text-sm md:text-base">
                ⚡ 1분이면 끝 — 무료 견적 받기
              </a>
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

function MatchingScreen({
  matchRequestId,
  onResolved,
}: {
  matchRequestId: string;
  onResolved: () => void;
}) {
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [hasReply, setHasReply] = useState(false);
  const [showProSheet, setShowProSheet] = useState(false);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizPicked, setQuizPicked] = useState<null | 'O' | 'X'>(null);
  const router = useRouter();

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
  const recentlyViewed = deliveries.filter((d) => d.status === 'viewed' || d.viewedAt).slice(0, 6);
  const totalCount = deliveries.length;
  const viewedCount = deliveries.filter((d) => d.status === 'viewed' || d.viewedAt).length;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-[#EEF2FF] via-white to-white relative overflow-hidden">
      {/* 상단 헤더 */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-[#181C24]/10">
        <div className="max-w-2xl mx-auto px-3 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/main')}
            aria-label="홈으로"
            className="flex h-10 w-10 items-center justify-center -ml-1 rounded-full text-[#181C24] hover:bg-[#181C24]/5 active:bg-[#181C24]/10"
          >
            <ChevronLeft size={24} strokeWidth={2.2} />
          </button>
          <img src="/images/logo-freetiful-wordmark.svg" alt="Freetiful" className="h-6 w-auto" />
          <div className="w-10" />
        </div>
      </header>

      <div className="relative max-w-2xl mx-auto px-5 pt-10 pb-40 text-center">
        {/* 파장 애니메이션 */}
        <div className="relative h-[280px] flex items-center justify-center">
          <span className="wmc-ripple wmc-ripple-1" />
          <span className="wmc-ripple wmc-ripple-2" />
          <span className="wmc-ripple wmc-ripple-3" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-[#2A5BFF] text-white flex items-center justify-center shadow-[0_18px_40px_rgba(42,91,255,0.32)]">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 21l-4.35-4.35" />
                <circle cx="11" cy="11" r="7" />
              </svg>
            </div>
          </div>
        </div>

        <h1 className="text-2xl md:text-3xl font-extrabold mt-2" style={{ letterSpacing: '-0.035em' }}>
          사회자를 찾는 중입니다…
        </h1>
        <p className="text-[#6B6F78] mt-3 text-sm md:text-base">
          잠시만 기다려주세요. 검증된 사회자분들에게 동시에 견적 요청이 전달되고 있어요.
        </p>

        {/* 사회자 확인 메시지 */}
        <div className="mt-8 space-y-2 min-h-[120px]">
          {recentlyViewed.length === 0 ? (
            <p className="text-[#9DA1AA] text-sm">
              곧 사회자분들이 요청을 확인할 거예요…
            </p>
          ) : (
            recentlyViewed.map((d) => {
              const proName = d.proProfile?.user?.name || '사회자';
              const avatar =
                d.proProfile?.user?.profileImageUrl ||
                d.proProfile?.images?.[0]?.imageUrl ||
                '/images/default-profile.png';
              return (
                <div
                  key={d.id}
                  className="flex items-center justify-center gap-3 bg-white border border-[#181C24]/10 rounded-full pl-1 pr-4 py-1 mx-auto w-fit shadow-[0_4px_14px_rgba(24,28,36,0.06)]"
                  style={{ animation: 'wmcSlideUp 0.5s ease-out both' }}
                >
                  <img
                    src={avatar}
                    alt={proName}
                    className="w-7 h-7 rounded-full object-cover bg-gray-100"
                    onError={(e) => {
                      const t = e.currentTarget as HTMLImageElement;
                      if (!t.dataset.fb) {
                        t.dataset.fb = '1';
                        t.src = '/images/default-profile.png';
                      }
                    }}
                  />
                  <span className="text-sm font-semibold text-[#181C24]">
                    <b>{proName}</b> 사회자가 요청을 확인했어요
                  </span>
                </div>
              );
            })
          )}
        </div>

        <p className="mt-6 text-[12px] text-[#9DA1AA]">
          {totalCount > 0 ? `${viewedCount} / ${totalCount} 명 확인` : '사회자분들 알림 발송 중'}
        </p>

        {/* OX 퀴즈 */}
        <div className="mt-10 bg-white rounded-2xl border border-[#181C24]/10 p-6 text-left shadow-[0_8px_22px_rgba(24,28,36,0.04)]">
          <p className="text-[11px] tracking-[0.28em] uppercase text-[#2A5BFF] mb-2">기다리는 동안 OX 퀴즈</p>
          <p className="text-[15px] md:text-[16px] font-bold text-[#181C24] leading-snug min-h-[3.2em]">
            {quiz.q}
          </p>
          <div className="grid grid-cols-2 gap-3 mt-5">
            {(['O', 'X'] as const).map((mark) => {
              const picked = quizPicked === mark;
              const correct = quizPicked && mark === quiz.answer;
              const wrong = quizPicked === mark && mark !== quiz.answer;
              return (
                <button
                  key={mark}
                  type="button"
                  onClick={() => onPickQuiz(mark)}
                  disabled={!!quizPicked}
                  className={`h-16 rounded-2xl text-2xl font-extrabold border-2 transition-all ${
                    correct
                      ? 'bg-[#22C55E] text-white border-[#22C55E]'
                      : wrong
                        ? 'bg-[#EF4444] text-white border-[#EF4444]'
                        : picked
                          ? 'bg-[#181C24] text-white border-[#181C24]'
                          : 'bg-white text-[#181C24] border-[#181C24]/15 active:scale-[0.98]'
                  } disabled:opacity-90`}
                >
                  {mark}
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

      {/* 하단 사회자 프로필 미리보기 핸들 */}
      <button
        type="button"
        onClick={() => setShowProSheet(true)}
        className="fixed left-1/2 -translate-x-1/2 bottom-0 z-30 w-full max-w-2xl bg-white border-t border-[#181C24]/10 px-5 pt-3 pb-4"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
      >
        <div className="w-10 h-1 bg-[#D1D5DB] rounded-full mx-auto mb-3" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {deliveries.slice(0, 4).map((d) => {
                const src =
                  d.proProfile?.user?.profileImageUrl ||
                  d.proProfile?.images?.[0]?.imageUrl ||
                  '/images/default-profile.png';
                return (
                  <img
                    key={d.id}
                    src={src}
                    alt=""
                    className="w-7 h-7 rounded-full border-2 border-white object-cover bg-gray-100"
                    onError={(e) => {
                      const t = e.currentTarget as HTMLImageElement;
                      if (!t.dataset.fb) {
                        t.dataset.fb = '1';
                        t.src = '/images/default-profile.png';
                      }
                    }}
                  />
                );
              })}
            </div>
            <span className="text-sm font-semibold text-[#181C24]">
              요청 받은 사회자 미리보기 <b className="text-[#2A5BFF]">{totalCount}</b>명
            </span>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2A5BFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </div>
      </button>

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
              <h3 className="text-lg font-extrabold">사회자 미리보기</h3>
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
            <p className="text-xl font-extrabold text-[#181C24]">사회자가 답장했어요!</p>
            <p className="text-sm text-[#6B6F78] mt-2">채팅으로 이동합니다…</p>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes wmcRipple {
          0% { transform: translate(-50%, -50%) scale(0.4); opacity: 0.6; }
          80% { opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
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
          background: rgba(42, 91, 255, 0.18);
          animation: wmcRipple 2.6s ease-out infinite;
          pointer-events: none;
        }
        .wmc-ripple-2 { animation-delay: 0.8s; background: rgba(42, 91, 255, 0.14); }
        .wmc-ripple-3 { animation-delay: 1.6s; background: rgba(42, 91, 255, 0.1); }
      `}</style>
    </div>
  );
}
