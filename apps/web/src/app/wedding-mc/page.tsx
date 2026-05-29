'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { matchApi } from '@/lib/api/match.api';
import { useAuthStore } from '@/lib/store/auth.store';

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

const Q1_OPTIONS = [
  '네, 전문 사회자를 알아보고 있어요',
  '아직 고민 중이에요',
  '지인에게 부탁할 예정이에요',
];

const BENEFITS = [
  { value: '웨딩홀', label: '🏛 웨딩홀 할인' },
  { value: '스튜디오', label: '📸 스튜디오 할인' },
  { value: '본식스냅', label: '🎥 본식 스냅·DVD' },
  { value: '피부샵', label: '✨ 피부샵 할인' },
  { value: '신혼여행', label: '✈️ 신혼여행' },
  { value: '예복한복', label: '👗 예복·한복' },
];

function CountUp({ target, decimals = 0, suffix }: { target: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [shown, setShown] = useState(target === 0);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.5 },
    );
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
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.9s ease, transform 0.9s ease',
      }}
    >
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
    html2canvas?: any;
  }
}

export default function WeddingMcLandingPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState(1);
  const total = 4;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [q1, setQ1] = useState('');
  const [weddingDate, setWeddingDate] = useState('');
  const [dateUndecided, setDateUndecided] = useState(false);
  const [weddingTime, setWeddingTime] = useState('');
  const [timeUndecided, setTimeUndecided] = useState(false);
  const [region, setRegion] = useState('');
  const [benefits, setBenefits] = useState<string[]>([]);
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [coupon, setCoupon] = useState<{ code: string; expiry: string } | null>(null);

  const formStartFiredRef = useRef(false);
  const stickyCtaRef = useRef<HTMLDivElement | null>(null);
  const registerRef = useRef<HTMLDivElement | null>(null);
  const couponBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (authUser?.name && !name) setName(authUser.name);
    if ((authUser as any)?.phone && !phone) setPhone(formatPhoneInput((authUser as any).phone));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  // UTM 보존
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((k) => {
        const v = sp.get(k);
        if (v) sessionStorage.setItem(k, v);
      });
      if (document.referrer && !sessionStorage.getItem('referrer'))
        sessionStorage.setItem('referrer', document.referrer);
      if (!sessionStorage.getItem('landing_url'))
        sessionStorage.setItem('landing_url', window.location.href);
    } catch {}
  }, []);

  // Sticky CTA: 30% 스크롤 → 알림, 폼 노출 시 숨김
  useEffect(() => {
    const sticky = stickyCtaRef.current;
    const register = registerRef.current;
    if (!sticky || !register) return;
    let noticeShown = false;
    let viewContentFired = false;

    const formIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          sticky.classList.toggle('hide', e.isIntersecting);
        });
      },
      { threshold: 0.05 },
    );
    formIo.observe(register);

    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = total > 0 ? window.scrollY / total : 0;
      if (!noticeShown && ratio > 0.3) {
        noticeShown = true;
        sticky.classList.add('show-notice');
      }
      if (!viewContentFired && ratio > 0.5) {
        viewContentFired = true;
        if (typeof window.fbq === 'function')
          window.fbq('track', 'ViewContent', { content_name: 'Wedding MC Landing - 50% scroll' });
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      formIo.disconnect();
    };
  }, []);

  const fireFormStart = useCallback(() => {
    if (formStartFiredRef.current) return;
    formStartFiredRef.current = true;
    if (typeof window.fbq === 'function')
      window.fbq('track', 'InitiateCheckout', { content_name: 'Wedding MC Form Start' });
  }, []);

  const goStep = (n: number) => {
    setStep(n);
    setTimeout(() => {
      registerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const validateStep = (n: number): boolean => {
    if (n === 1) {
      if (!name.trim()) {
        window.alert('성함을 입력해주세요.');
        return false;
      }
      if (!phone.trim()) {
        window.alert('연락처를 입력해주세요.');
        return false;
      }
    }
    if (n === 2 && !q1) {
      window.alert('전문 사회자 섭외 상황을 선택해주세요.');
      return false;
    }
    if (n === 3) {
      if (!weddingDate && !dateUndecided) {
        window.alert('결혼 예정일을 선택하거나 "아직 정해지지 않았어요"를 체크해주세요.');
        return false;
      }
      if (!weddingTime && !timeUndecided) {
        window.alert('예식 시간을 선택하거나 "아직 정해지지 않았어요"를 체크해주세요.');
        return false;
      }
      if (!region.trim()) {
        window.alert('예식 지역을 입력해주세요.');
        return false;
      }
    }
    return true;
  };

  const onNext = () => {
    if (validateStep(step)) goStep(step + 1);
  };
  const onPrev = () => goStep(step - 1);

  const toggleBenefit = (v: string) =>
    setBenefits((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!agree) {
      window.alert('개인정보 수집·이용에 동의해주세요.');
      return;
    }
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      window.alert('연락처 형식을 확인해주세요. (예: 010-1234-1234)');
      return;
    }
    setPhone(normalizedPhone);

    // 쿠폰 (등록일 + 1년)
    const today = new Date();
    const exp = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
    const pad = (n: number) => String(n).padStart(2, '0');
    const expStr = `${exp.getFullYear()}.${pad(exp.getMonth() + 1)}.${pad(exp.getDate())}`;
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const couponCode = `MC-${exp.getFullYear()}-${rand}`;

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

    // 1) Google Sheets 리드 수집 (no-cors, fire-and-forget)
    fetch(GOOGLE_SHEET_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        name: name.trim(),
        phone: normalizedPhone,
        q1,
        weddingDate: weddingDate || (dateUndecided ? '미정' : ''),
        weddingTime: weddingTime || (timeUndecided ? '미정' : ''),
        region: region.trim(),
        benefits,
        couponCode,
        source: 'freetiful-mc-wedding',
        ...utm,
      }),
    }).catch(() => undefined);

    // 2) Freetiful 백엔드 — 다수견적 + 간이 회원가입 + 토큰 발급
    try {
      const digits = normalizedPhone.replace(/\D/g, '');
      const res = await matchApi.quickRequest({
        name: name.trim() || undefined,
        phone: digits,
        categoryId: '결혼식사회자',
        type: 'multi',
        eventLocation: region.trim(),
        eventDate: dateUndecided ? undefined : weddingDate || undefined,
        eventTime: timeUndecided ? undefined : weddingTime || undefined,
        rawUserInput: {
          source: 'landing_wedding_mc_v2',
          q1,
          benefits,
          couponCode,
          ...utm,
        },
      });
      if (res?.accessToken && res?.refreshToken && res?.user) {
        setAuth(res.user, res.accessToken, res.refreshToken);
      }
      window.dispatchEvent(new Event('freetiful:match-requests-changed'));
    } catch {
      // 백엔드 실패해도 리드는 시트로 갔으니 흐름 계속
    }

    // Meta Pixel Lead 전환
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'Lead', {
        content_name: 'Wedding MC Consultation',
        content_category: 'wedding-mc',
        currency: 'KRW',
      });
    }

    setCoupon({ code: couponCode, expiry: expStr });
    setDone(true);
    setSubmitting(false);
    setTimeout(() => registerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const captureCoupon = async () => {
    const target = couponBoxRef.current;
    if (!target || !window.html2canvas) {
      window.alert('캡처 기능을 불러오지 못했습니다.');
      return;
    }
    try {
      const canvas = await window.html2canvas(target, {
        backgroundColor: '#0E1320',
        scale: 2,
        useCORS: true,
      });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'freetiful-coupon.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.alert('캡처에 실패했어요.');
    }
  };

  const progressPct = Math.round((step / total) * 100);

  return (
    <main className="bg-white text-[#181C24] pb-24" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
      {/* Meta Pixel */}
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
      <Script
        src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"
        strategy="lazyOnload"
      />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-[#181C24]/10">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <span className="text-[11px] tracking-[0.28em] uppercase text-[#6B6F78]">FREETIFUL · WEDDING MC</span>
          <a href="#register" className="text-sm font-semibold text-[#181C24] hover:text-[#2A5BFF] transition">
            할인쿠폰 받기 →
          </a>
        </div>
      </header>

      {/* §1 HERO */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(60% 40% at 50% 0%, rgba(42,91,255,0.10), transparent 70%)' }}
        />
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
                KBS · SBS · MBC 출신 아나운서 중심,
                <br />
                우리 예식에 맞는 검증된 사회자를 안내해드립니다.
              </p>
            </div>

            <div className="md:row-start-1 md:col-start-2 md:row-span-2">
              <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
                <img src={HERO_IMG} alt="결혼식 진행 중인 프리티풀 전문 사회자" className="w-full h-full object-cover" />
              </div>
            </div>

            <div className="md:row-start-2 md:col-start-1">
              <a
                href="#register"
                className="inline-block bg-[#2A5BFF] hover:bg-[#5478FF] text-white font-extrabold px-8 py-4 rounded-full transition shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
              >
                전문 사회자 섭외 할인쿠폰 받기 →
              </a>
              <p className="mt-4 text-xs md:text-sm text-[#6B6F78]">🎫 할인쿠폰 + 📕 결혼식 진행대본 PDF 무료 제공</p>
            </div>
          </div>

          {/* 수치 카드 3개 */}
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

      {/* §2 REAL VOICES */}
      <section className="bg-[#F5F6FA] border-y border-[#181C24]/10">
        <FadeUp className="max-w-6xl mx-auto px-5 py-20 md:py-28">
          <p className="text-[11px] tracking-[0.28em] uppercase text-[#2A5BFF] text-center mb-4">Real Voices</p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-center mb-5" style={{ letterSpacing: '-0.035em', lineHeight: 1.3 }}>
            사회자 때문에 <span className="text-[#2A5BFF]">후회했어요</span>
          </h2>
          <p className="text-[#6B6F78] text-center text-base md:text-lg mt-6 mb-14 leading-relaxed">
            인스타·네이버카페 <span className="text-[#181C24] font-bold text-lg md:text-xl">실제 후기 278건</span> 중
          </p>

          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {[
              {
                tag: '친구 부탁',
                body: (
                  <>
                    친구가 해주긴 했는데,
                    <br />
                    계속 챙겨주고 해야 해서
                    <br />
                    <span className="text-[#2A5BFF]">오히려 미안하고 신경 쓰이더라고요.</span>
                  </>
                ),
              },
              {
                tag: '웨딩홀 배정',
                body: (
                  <>
                    웨딩홀에서 배정해준 사회자였는데,
                    <br />
                    <span className="text-[#2A5BFF]">대량배정이라 대본도 적고 </span>
                    <br />
                    중얼대더라고요.
                  </>
                ),
              },
              {
                tag: '재능플랫폼',
                body: (
                  <>
                    재능플랫폼에서 섭외했는데
                    <br />
                    <span className="text-[#2A5BFF]">레퍼런스가 없으니까</span>
                    <br />
                    너무 불안하더라고요.
                  </>
                ),
              },
              {
                tag: '연락 두절',
                body: (
                  <>
                    답장이 너무 늦어요…
                    <br />
                    <span className="text-[#2A5BFF]">결혼식 1주일 전</span>에야
                    <br />
                    겨우 연락이 되었어요.
                  </>
                ),
              },
            ].map((v) => (
              <article key={v.tag} className="bg-white rounded-2xl border border-[#181C24]/10 p-6 md:p-8">
                <span className="inline-block bg-red-500/10 text-red-600 text-[11px] font-bold tracking-wider px-3 py-1 rounded-full mb-4">
                  {v.tag}
                </span>
                <p className="text-[#181C24] text-base md:text-lg leading-relaxed font-medium">{v.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-16 md:mt-20 relative">
            <div
              className="absolute -inset-x-5 -inset-y-8 md:-inset-y-12 -z-10 opacity-50"
              style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(42,91,255,0.12), transparent 70%)' }}
            />
            <p className="text-center text-[#2A5BFF] text-sm md:text-base font-bold tracking-wider mb-4">
              ⚠️ 놀랍게도 이런 경우가 <u>정말 많습니다.</u>
            </p>
            <h3 className="text-xl md:text-3xl font-extrabold text-center" style={{ letterSpacing: '-0.035em', lineHeight: 1.55 }}>
              결혼식은 <span className="text-[#2A5BFF]">다시 할 수 없습니다.</span>
              <br />
              사회자 한 명이 전체를 결정합니다.
            </h3>
          </div>
        </FadeUp>
      </section>

      {/* §3 ROSTER */}
      <section>
        <FadeUp className="max-w-6xl mx-auto px-5 py-20 md:py-28">
          <p className="text-[11px] tracking-[0.28em] uppercase text-[#2A5BFF] text-center mb-4">Verified MCs</p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-center mb-5" style={{ letterSpacing: '-0.035em', lineHeight: 1.3 }}>
            그래서 <span className="text-[#2A5BFF]">전문 사회자</span>가
            <br />
            필요합니다.
          </h2>
          <p className="text-[#181C24]/90 text-center text-lg md:text-2xl font-semibold mt-6 mb-14">
            아나운서 출신 사회자를 만나보세요
          </p>

          <div className="overflow-hidden" style={{ maskImage: 'linear-gradient(90deg, transparent 0%, #000 6%, #000 94%, transparent 100%)', WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 6%, #000 94%, transparent 100%)', pointerEvents: 'none' }}>
            <div className="flex gap-4" style={{ width: 'max-content', animation: 'wmcScrollX 60s linear infinite' }}>
              {[...MC_IMAGES, ...MC_IMAGES].map((src, i) => (
                <div key={i} className="w-[200px] md:w-[240px] flex-none rounded-[14px] overflow-hidden">
                  <img src={src} alt="" className="w-full h-full object-cover" style={{ aspectRatio: '9/16' }} loading="lazy" />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14 overflow-hidden border-y border-[#181C24]/10 py-5">
            <div className="flex gap-3 text-[#6B6F78] text-sm md:text-base font-semibold tracking-widest" style={{ width: 'max-content', animation: 'wmcScrollX 32s linear infinite' }}>
              {Array.from({ length: 2 }).map((_, n) => (
                <span key={n} className="contents">
                  {['KBS', 'SBS', 'MBC', 'YTN', 'JTBC', 'TV조선', '홈쇼핑 쇼호스트', '호텔 · 컨벤션 본식 경험'].map((label) => (
                    <span key={`${n}-${label}`} className="contents">
                      <span className="px-8">{label}</span>
                      <span className="text-[#2A5BFF]/40">·</span>
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </FadeUp>
      </section>

      {/* §4 WHY FREETIFUL */}
      <section className="bg-[#F5F6FA] border-y border-[#181C24]/10">
        <FadeUp className="max-w-6xl mx-auto px-5 py-20 md:py-28">
          <p className="text-[11px] tracking-[0.28em] uppercase text-[#2A5BFF] text-center mb-4">Why Freetiful</p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-center mb-5" style={{ letterSpacing: '-0.035em', lineHeight: 1.3 }}>
            프리티풀만의
            <br />
            <span className="text-[#2A5BFF]">3가지 차별점</span>
          </h2>
          <p className="text-[#6B6F78] text-center text-sm md:text-base mt-6 mb-14">
            왜 프리티풀이어야 하는지, <span className="text-[#181C24] font-semibold">3가지 이유</span>
          </p>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              { no: '01', title: '철저하게\n검증된 사회자', desc: '방송사 아나운서 출신 또는 충분한 경력이 검증된 사회자만 선별하여 예식사회자로 활동할 수 있습니다.' },
              { no: '02', title: '우리 예식 분위기에\n맞게 제안', desc: '차분한 톤, 밝은 톤, 감동 중심 — 원하는 분위기에 맞는 사회자를 골라서 추천해드려요.' },
              { no: '03', title: '예식 3~4주 전\n확정 배정', desc: '당일 대량배정 없이, 미리 사회자와 직접 소통하고 대본을 맞출 수 있어요.', highlight: true },
            ].map((d) => (
              <article
                key={d.no}
                className={`rounded-2xl p-6 md:p-8 ${
                  d.highlight ? 'bg-white border-2 border-[#2A5BFF]/40' : 'bg-white border border-[#181C24]/10'
                }`}
              >
                <p
                  className={`text-[11px] tracking-[0.28em] uppercase font-bold mb-3 ${
                    d.highlight ? 'text-[#2A5BFF]' : 'text-[#2A5BFF]/50'
                  }`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {d.no}
                </p>
                <h3 className="font-bold text-xl mb-3 whitespace-pre-line">{d.title}</h3>
                <p className="text-[#6B6F78] text-sm leading-relaxed">{d.desc}</p>
              </article>
            ))}
          </div>
        </FadeUp>
      </section>

      {/* §5 PROOF / REVIEWS */}
      <section>
        <FadeUp className="max-w-6xl mx-auto px-5 py-20 md:py-28">
          <p className="text-[11px] tracking-[0.28em] uppercase text-[#2A5BFF] text-center mb-4">Reviews</p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-center mb-5" style={{ letterSpacing: '-0.035em', lineHeight: 1.3 }}>
            예식이 끝난 뒤
            <br />
            <span className="text-[#2A5BFF]">더 분명히 기억됩니다</span>
          </h2>
          <p className="text-[#6B6F78] text-center text-sm md:text-base mt-6 mb-14">실제 고객 후기</p>

          <div className="overflow-hidden mb-14" style={{ maskImage: 'linear-gradient(90deg, transparent 0%, #000 5%, #000 95%, transparent 100%)', WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 5%, #000 95%, transparent 100%)', pointerEvents: 'none' }}>
            <div className="flex gap-3.5" style={{ width: 'max-content', animation: 'wmcScrollX 50s linear infinite' }}>
              {[...COMMENT_IMAGES, ...COMMENT_IMAGES].map((src, i) => (
                <div key={i} className="w-[220px] md:w-[280px] flex-none rounded-[14px] overflow-hidden shadow-[0_8px_24px_rgba(24,28,36,0.08)]">
                  <img src={src} alt="" className="w-full h-full object-cover" style={{ aspectRatio: '9/16' }} loading="lazy" />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14 overflow-hidden">
            <div className="flex gap-3 text-[#6B6F78] text-sm" style={{ width: 'max-content', animation: 'wmcScrollX 32s linear infinite' }}>
              {Array.from({ length: 2 }).map((_, n) => (
                <span key={n} className="contents">
                  {[
                    '"부모님도 진행이 깔끔하다고 좋아하셨어요"',
                    '"분위기에 맞는 분을 추천해줘서 선택이 쉬웠어요"',
                    '"과하지 않고 자연스러워서 예식 분위기에 잘 맞았어요"',
                    '"섭외부터 조율까지 정리해줘서 부담이 줄었습니다"',
                  ].map((q) => (
                    <span key={`${n}-${q}`} className="contents">
                      <span className="px-6">{q}</span>
                      <span className="text-[#2A5BFF]/40">·</span>
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </FadeUp>
      </section>

      {/* §5.5 PROCESS */}
      <section className="bg-[#F5F6FA] border-y border-[#181C24]/10">
        <FadeUp className="max-w-6xl mx-auto px-5 py-20 md:py-28">
          <p className="text-[11px] tracking-[0.28em] uppercase text-[#2A5BFF] text-center mb-4">Process</p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-center mb-5" style={{ letterSpacing: '-0.035em', lineHeight: 1.3 }}>
            복잡한 섭외,
            <br />
            <span className="text-[#2A5BFF]">이렇게 간편하게</span> 진행됩니다.
          </h2>
          <p className="text-[#181C24]/90 text-center text-base md:text-xl font-semibold mt-6 mb-14 leading-relaxed">
            상담을 신청해 주세요.
            <br className="md:hidden" />
            프리티풀이 알아서 다 해드립니다.
          </p>

          <ol className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 auto-rows-fr">
            {[
              { step: 'STEP 01', title: '상담 접수', desc: '전문 MD와 예식 일정·예산·분위기·예상안을 확인합니다.' },
              { step: 'STEP 02', title: '사회자 제안 & 선택', desc: '검증된 진행자를 영상·프로필로 비교해 두 분이 직접 고릅니다.' },
              { step: 'STEP 03', title: '계약 · 사전 소통', desc: '예식 3~4주 전 확정 배정 후, 사회자와 직접 예상·요청을 맞춥니다.' },
              { step: 'STEP 04', title: '당일 진행 & 마무리', desc: '사회자가 미리 도착해 진행하고, 정산·후기인증까지 마무리합니다.', highlight: true },
            ].map((p, i) => (
              <li
                key={p.step}
                className={`rounded-2xl p-6 md:p-7 relative ${
                  p.highlight ? 'bg-[#2A5BFF]/10 border-2 border-[#2A5BFF]/50' : 'bg-white border border-[#181C24]/10'
                }`}
              >
                <span
                  className={`absolute top-5 right-5 text-3xl font-extrabold ${p.highlight ? 'text-[#2A5BFF]/30' : 'text-[#181C24]/10'}`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className={`text-[11px] tracking-[0.28em] uppercase font-bold mb-3 ${p.highlight ? 'text-[#2A5BFF]' : 'text-[#2A5BFF]/70'}`}>
                  {p.step}
                </p>
                <h3 className="font-bold text-lg mb-2">{p.title}</h3>
                <p className={`text-sm leading-relaxed ${p.highlight ? 'text-[#181C24]/80' : 'text-[#6B6F78]'}`}>{p.desc}</p>
              </li>
            ))}
          </ol>
        </FadeUp>
      </section>

      {/* §5.7 SOCIAL PROOF */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(50% 60% at 50% 50%, rgba(42,91,255,0.08), transparent 70%)' }}
        />
        <FadeUp className="relative max-w-5xl mx-auto px-5 py-20 md:py-28 text-center">
          <p className="text-[11px] tracking-[0.28em] uppercase text-[#2A5BFF] mb-6">Together</p>
          <p
            className="font-extrabold text-[#2A5BFF] leading-none mb-6"
            style={{ fontSize: 'clamp(64px, 12vw, 140px)', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}
          >
            <CountUp target={2000} suffix="쌍+" />
          </p>
          <h2 className="text-2xl md:text-4xl font-extrabold mb-4" style={{ letterSpacing: '-0.035em', lineHeight: 1.3 }}>
            이미 <span className="text-[#2A5BFF]">2,000쌍</span>의 결혼식이
            <br />
            프리티풀의 사회자와 함께였습니다.
          </h2>
          <p className="text-[#6B6F78] text-base md:text-lg mt-6 leading-relaxed">
            이제 <span className="text-[#181C24] font-semibold">두 분 차례</span>입니다.
          </p>

          <div
            className="mt-14 overflow-hidden"
            style={{ maskImage: 'linear-gradient(90deg, transparent 0%, #000 4%, #000 96%, transparent 100%)', WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 4%, #000 96%, transparent 100%)', pointerEvents: 'none' }}
          >
            <div className="flex gap-3" style={{ width: 'max-content', animation: 'wmcScrollX 55s linear infinite' }}>
              {[...WED_IMAGES, ...WED_IMAGES].map((src, i) => (
                <div key={i} className="w-[220px] md:w-[260px] flex-none rounded-[12px] overflow-hidden">
                  <img src={src} alt="" className="w-full h-full object-cover" style={{ aspectRatio: '4/5' }} loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        </FadeUp>
      </section>

      {/* §6 CTA + FORM */}
      <section id="register" ref={registerRef} className="bg-[#F5F6FA] border-t border-[#181C24]/10">
        <FadeUp className="max-w-3xl mx-auto px-5 py-20 md:py-28">
          <p className="text-[11px] tracking-[0.28em] uppercase text-[#2A5BFF] text-center mb-4">지금 바로 받아가세요</p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-center mb-5" style={{ letterSpacing: '-0.035em', lineHeight: 1.3 }}>
            지금 바로 <span className="text-[#2A5BFF]">챙겨가세요</span>
          </h2>
          <p className="text-[#6B6F78] text-center text-sm md:text-base mt-6 mb-12">
            예식 일정이 없어도 괜찮아요.
            <br />
            미리 받아두세요.
          </p>

          <div className="grid md:grid-cols-2 gap-3 mb-8">
            <div className="bg-white border border-[#2A5BFF]/30 rounded-2xl px-5 py-5">
              <p className="font-bold text-base md:text-lg mb-1">🎫 전문사회자 10% 할인쿠폰</p>
              <p className="text-[#6B6F78] text-xs md:text-sm leading-relaxed">지금 미리 받아두세요.</p>
            </div>
            <div className="bg-white border border-[#2A5BFF]/30 rounded-2xl px-5 py-5">
              <p className="font-bold text-base md:text-lg mb-1">📕 결혼식 진행대본 PDF</p>
              <p className="text-[#6B6F78] text-xs md:text-sm leading-relaxed">Top 전문사회자가 만든 3년 노하우 자료</p>
            </div>
          </div>

          <div className="bg-white border border-[#181C24]/10 rounded-2xl p-6 md:p-8">
            {!done ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#6B6F78]">{step} / {total} 단계</span>
                  <span className="text-xs text-[#6B6F78]">{progressPct}% 완료</span>
                </div>
                <div className="h-[3px] bg-[#181C24]/10 rounded-full overflow-hidden mb-6">
                  <div
                    className="h-full bg-gradient-to-r from-[#2A5BFF] to-[#5478FF] transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <form onSubmit={submit} onInput={fireFormStart}>
                  {step === 1 && (
                    <div>
                      <h3 className="font-extrabold text-xl mb-1">입력하고, 할인쿠폰 받아가기</h3>
                      <p className="text-[#6B6F78] text-sm mb-6">먼저 연락처를 알려주세요.</p>

                      <div className="mb-4">
                        <label className="text-sm font-semibold text-[#181C24] block mb-2.5">성함</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="이름"
                          className="w-full px-3.5 py-3.5 border-[1.5px] border-[#181C24]/10 rounded-xl text-sm bg-white text-[#181C24] focus:border-[#2A5BFF] outline-none"
                        />
                      </div>
                      <div className="mb-2">
                        <label className="text-sm font-semibold text-[#181C24] block mb-2.5">연락처</label>
                        <input
                          type="tel"
                          inputMode="numeric"
                          value={phone}
                          onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                          placeholder="010-0000-0000"
                          className="w-full px-3.5 py-3.5 border-[1.5px] border-[#181C24]/10 rounded-xl text-sm bg-white text-[#181C24] focus:border-[#2A5BFF] outline-none"
                        />
                      </div>

                      <button type="button" onClick={onNext} className="w-full mt-6 bg-[#2A5BFF] hover:bg-[#5478FF] text-white font-extrabold py-4 rounded-full transition">
                        다음 →
                      </button>
                      <p className="mt-3 text-center text-xs text-[#6B6F78]">개인정보는 사회자 상담 목적으로만 사용됩니다</p>
                    </div>
                  )}

                  {step === 2 && (
                    <div>
                      <h3 className="font-extrabold text-xl mb-1">사회자 섭외 상황을 알려주세요</h3>
                      <p className="text-[#6B6F78] text-sm mb-6">두 분에게 맞는 도움을 드릴게요.</p>

                      <div className="mb-6">
                        <label className="text-sm font-semibold text-[#181C24] block mb-2.5">전문 사회자 섭외를 생각하고 계세요?</label>
                        <div className="grid gap-2">
                          {Q1_OPTIONS.map((opt) => (
                            <label
                              key={opt}
                              className="flex items-center gap-2.5 px-4 py-3.5 border-[1.5px] rounded-xl bg-white cursor-pointer text-sm text-[#181C24] transition-all hover:border-[#2A5BFF]"
                              style={{ borderColor: q1 === opt ? '#2A5BFF' : 'rgba(24,28,36,0.12)', background: q1 === opt ? 'rgba(42,91,255,0.06)' : '#fff' }}
                            >
                              <input
                                type="radio"
                                name="q1"
                                value={opt}
                                checked={q1 === opt}
                                onChange={() => setQ1(opt)}
                                style={{ accentColor: '#2A5BFF', width: 18, height: 18 }}
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2 mt-8">
                        <button type="button" onClick={onPrev} className="flex-1 bg-[#EDEFF4] hover:bg-white text-[#181C24] font-semibold py-4 rounded-full transition border border-[#181C24]/10">
                          ← 이전
                        </button>
                        <button type="button" onClick={onNext} className="flex-[2] bg-[#2A5BFF] hover:bg-[#5478FF] text-white font-extrabold py-4 rounded-full transition">
                          다음 →
                        </button>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div>
                      <h3 className="font-extrabold text-xl mb-1">예식 정보를 알려주세요</h3>
                      <p className="text-[#6B6F78] text-sm mb-6">예식일·지역을 알면 더 잘 맞는 분을 추천할 수 있어요.</p>

                      <div className="mb-6">
                        <label className="text-sm font-semibold text-[#181C24] block mb-2.5">결혼 예정일</label>
                        <input
                          type="date"
                          value={weddingDate}
                          onChange={(e) => {
                            setWeddingDate(e.target.value);
                            if (e.target.value) setDateUndecided(false);
                          }}
                          className="w-full px-3.5 py-3.5 border-[1.5px] border-[#181C24]/10 rounded-xl text-sm bg-white text-[#181C24] focus:border-[#2A5BFF] outline-none mb-2"
                        />
                        <label
                          className="flex items-center gap-2.5 px-4 py-3.5 border-[1.5px] rounded-xl cursor-pointer text-sm transition-all"
                          style={{ borderColor: dateUndecided ? '#2A5BFF' : 'rgba(24,28,36,0.12)', background: dateUndecided ? 'rgba(42,91,255,0.06)' : '#fff' }}
                        >
                          <input
                            type="checkbox"
                            checked={dateUndecided}
                            onChange={(e) => {
                              setDateUndecided(e.target.checked);
                              if (e.target.checked) setWeddingDate('');
                            }}
                            style={{ accentColor: '#2A5BFF', width: 18, height: 18 }}
                          />
                          <span>아직 정해지지 않았어요</span>
                        </label>
                      </div>

                      <div className="mb-6">
                        <label className="text-sm font-semibold text-[#181C24] block mb-2.5">행사 시간</label>
                        <input
                          type="time"
                          value={weddingTime}
                          onChange={(e) => {
                            setWeddingTime(e.target.value);
                            if (e.target.value) setTimeUndecided(false);
                          }}
                          className="w-full px-3.5 py-3.5 border-[1.5px] border-[#181C24]/10 rounded-xl text-sm bg-white text-[#181C24] focus:border-[#2A5BFF] outline-none mb-2"
                        />
                        <label
                          className="flex items-center gap-2.5 px-4 py-3.5 border-[1.5px] rounded-xl cursor-pointer text-sm transition-all"
                          style={{ borderColor: timeUndecided ? '#2A5BFF' : 'rgba(24,28,36,0.12)', background: timeUndecided ? 'rgba(42,91,255,0.06)' : '#fff' }}
                        >
                          <input
                            type="checkbox"
                            checked={timeUndecided}
                            onChange={(e) => {
                              setTimeUndecided(e.target.checked);
                              if (e.target.checked) setWeddingTime('');
                            }}
                            style={{ accentColor: '#2A5BFF', width: 18, height: 18 }}
                          />
                          <span>아직 정해지지 않았어요</span>
                        </label>
                      </div>

                      <div className="mb-2">
                        <label className="text-sm font-semibold text-[#181C24] block mb-2.5">예식 지역</label>
                        <input
                          type="text"
                          value={region}
                          onChange={(e) => setRegion(e.target.value)}
                          placeholder="예) 서울 강남 프리츠웨딩홀 / 경기 분당 키아컨벤션"
                          className="w-full px-3.5 py-3.5 border-[1.5px] border-[#181C24]/10 rounded-xl text-sm bg-white text-[#181C24] focus:border-[#2A5BFF] outline-none"
                        />
                      </div>

                      <div className="flex gap-2 mt-8">
                        <button type="button" onClick={onPrev} className="flex-1 bg-[#EDEFF4] hover:bg-white text-[#181C24] font-semibold py-4 rounded-full transition border border-[#181C24]/10">
                          ← 이전
                        </button>
                        <button type="button" onClick={onNext} className="flex-[2] bg-[#2A5BFF] hover:bg-[#5478FF] text-white font-extrabold py-4 rounded-full transition">
                          다음 →
                        </button>
                      </div>
                    </div>
                  )}

                  {step === 4 && (
                    <div>
                      <h3 className="font-extrabold text-xl mb-1">마지막이에요!</h3>
                      <p className="text-[#6B6F78] text-sm mb-6">필요한 혜택을 함께 안내드릴게요.</p>

                      <div className="mb-6 bg-[#F5F6FA] rounded-xl p-5 border border-[#181C24]/10">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-bold text-base">💡 이런 혜택도 받아보실래요?</p>
                          <button
                            type="button"
                            onClick={() => {
                              if (benefits.length === BENEFITS.length) setBenefits([]);
                              else setBenefits(BENEFITS.map((b) => b.value));
                            }}
                            className="text-xs text-[#2A5BFF] font-semibold hover:underline"
                          >
                            {benefits.length === BENEFITS.length ? '전체해제' : '전체선택'}
                          </button>
                        </div>
                        <p className="text-[#6B6F78] text-xs mb-4">선택하신 항목만 카카오톡 또는 문자로 안내드려요</p>
                        <div className="grid grid-cols-2 gap-2">
                          {BENEFITS.map((b) => (
                            <label
                              key={b.value}
                              className="flex items-center gap-2.5 px-4 py-3.5 border-[1.5px] rounded-xl cursor-pointer text-sm transition-all"
                              style={{
                                borderColor: benefits.includes(b.value) ? '#2A5BFF' : 'rgba(24,28,36,0.12)',
                                background: benefits.includes(b.value) ? 'rgba(42,91,255,0.06)' : '#fff',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={benefits.includes(b.value)}
                                onChange={() => toggleBenefit(b.value)}
                                style={{ accentColor: '#2A5BFF', width: 18, height: 18 }}
                              />
                              <span>{b.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <label
                        className="flex items-center gap-2.5 px-4 py-3.5 border-[1.5px] rounded-xl cursor-pointer text-sm transition-all mb-2"
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

                      <div className="flex gap-2 mt-8">
                        <button type="button" onClick={onPrev} className="flex-1 bg-[#EDEFF4] hover:bg-white text-[#181C24] font-semibold py-4 rounded-full transition border border-[#181C24]/10">
                          ← 이전
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="flex-[2] bg-[#2A5BFF] hover:bg-[#5478FF] text-white font-extrabold py-4 rounded-full transition disabled:opacity-60"
                        >
                          {submitting ? '전송 중...' : '상담 신청 후 쿠폰 받기 🎫'}
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              </>
            ) : (
              <div className="text-center">
                <div className="text-5xl mb-4">🎉</div>
                <h3 className="font-extrabold text-2xl mb-2">신청 완료!</h3>
                <p className="text-[#6B6F78] text-sm md:text-base leading-relaxed mb-8">
                  1영업일 내에 우리 예식에 맞는
                  <br />
                  사회자를 안내드릴게요.
                </p>

                <div
                  ref={couponBoxRef}
                  className="relative text-left mb-6 text-white rounded-2xl p-6 overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #0E1320 0%, #1F2638 100%)',
                    border: '1px solid rgba(42,91,255,0.35)',
                  }}
                >
                  <p className="text-[11px] tracking-[0.28em] uppercase text-[#2A5BFF] mb-2">Freetiful Wedding MC</p>
                  <p className="font-extrabold text-2xl md:text-3xl mb-1">
                    전문사회자 <span className="text-[#2A5BFF]">10% 할인권</span>
                  </p>
                  <p className="text-white/60 text-xs leading-relaxed">
                    유효기간: <span>{coupon?.expiry}</span> 까지
                    <br />
                    코드: <b className="text-[#2A5BFF]">{coupon?.code}</b>
                  </p>
                </div>

                <a
                  href="https://drive.google.com/uc?export=download&id=1dUavbGTFyn6zwWOy_bYtEJQFe0AEOdSY"
                  target="_blank"
                  rel="noopener"
                  className="block w-full bg-[#2A5BFF] hover:bg-[#5478FF] text-white font-extrabold py-4 rounded-full transition mb-3"
                >
                  📕 결혼식 진행대본 PDF 다운로드
                </a>
                <button
                  type="button"
                  onClick={captureCoupon}
                  className="block w-full bg-[#EDEFF4] hover:bg-white text-[#181C24] font-semibold py-4 rounded-full transition border border-[#181C24]/10"
                >
                  쿠폰 캡처해서 저장하기
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/chat')}
                  className="block w-full mt-3 text-sm font-semibold text-[#2A5BFF] hover:underline"
                >
                  사회자 견적이 도착했어요 — 채팅 보러가기
                </button>

                <p className="mt-6 text-xs text-[#6B6F78]">완료된 쿠폰은 입력하신 연락처로도 발송됩니다.</p>
              </div>
            )}
          </div>
        </FadeUp>
      </section>

      <footer className="border-t border-[#181C24]/10">
        <div className="max-w-6xl mx-auto px-5 py-10 text-center text-xs text-[#6B6F78] leading-relaxed">
          © FREETIFUL · WEDDING MC
          <br />본 페이지의 후기는 실제 고객 사례를 바탕으로 재구성되었습니다.
        </div>
      </footer>

      {/* Sticky CTA */}
      <div
        ref={stickyCtaRef}
        className="wmc-sticky-cta fixed left-0 right-0 bottom-0 z-40 px-4 py-3 bg-white/90 backdrop-blur border-t border-[#181C24]/10"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', transition: 'transform .35s ease, opacity .35s ease' }}
      >
        <div className="max-w-[720px] mx-auto relative">
          <div className="wmc-cta-notice absolute right-3.5 bottom-[calc(100%+6px)] max-w-[240px] bg-[#181C24] text-white text-[11.5px] leading-[1.4] px-3 py-2 rounded-[10px] shadow-[0_6px_18px_rgba(24,28,36,0.18)] opacity-0 pointer-events-none" style={{ transition: 'opacity .4s ease, transform .4s ease', transform: 'translateY(6px) scale(0.96)' }}>
            <b className="text-[#FFD60A]">2,000명+ 커플</b>이 프리티풀의<br />사회자와 함께 결혼했어요.
          </div>
          <a href="#register" className="block bg-[#2A5BFF] hover:bg-[#5478FF] text-white text-center font-extrabold py-3.5 md:py-4 rounded-full text-sm md:text-base">
            🎫 할인쿠폰 + 대본 무료로 받기
          </a>
        </div>
      </div>

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
        .wmc-sticky-cta.show-notice .wmc-cta-notice {
          opacity: 1 !important;
          transform: translateY(0) scale(1) !important;
        }
      `}</style>
    </main>
  );
}
