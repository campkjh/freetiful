'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { Check, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { matchApi } from '@/lib/api/match.api';
import { discoveryApi, type ProListItem } from '@/lib/api/discovery.api';
import { useAuthStore } from '@/lib/store/auth.store';
import { startOAuth } from '@/lib/auth/oauth';
import { captureUtm, trackLandingVisit, trackLandingConversion } from '@/lib/landing-track';
import GazeGame from './GazeGame';
import GuestLoginForm from '@/components/GuestLoginForm';

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

/* 폼 제출 후 설문(혜택 안내) 항목 */
/** 랜딩 점검용 계정 — 서버 match.service.ts 의 TEST_LEAD_USER_IDS 와 동일하게 유지할 것 */
const TEST_LEAD_USER_IDS = ['a7c23078-a2cd-4643-87c0-c9292321bc3b']; // 사회자 김정현

/** 서버(match.service.ts isTestLead)와 같은 규칙 — 공백 제거 후 정확히 '테스트'/'test' 일 때만 */
const isTestSubmission = (name: string, userId?: string | null) => {
  if (userId && TEST_LEAD_USER_IDS.includes(userId)) return true;
  const s = name.replace(/\s/g, '');
  return s === '테스트' || s.toLowerCase() === 'test';
};

const SURVEY_BENEFITS = ['웨딩홀 할인', '스튜디오 할인', '본식스냅 DVD 할인', '피부샵 할인', '신혼여행', '예복 한복'];

/* 개인정보 수집·이용 동의 전문 (모달 '내용 보기') */
const PRIVACY_CONSENT_TEXT = `개인정보 수집·이용 동의

1. 수집하는 개인정보 항목
수집 항목: 이메일, 성명, 연락처, 희망 행사일정

2. 개인정보 수집·이용 목적
프리티풀 서비스 제공 및 회원 관리
견적 제공 및 관리 담당자 연락
서비스 이용 관련 공지사항 전달

3. 개인정보 보유·이용 기간
회원 탈퇴 시 또는 서비스 종료 시까지 보유하며, 관련 법령에 따라 일정 기간 보관될 수 있습니다.

4. 동의 거부 권리 및 불이익
개인정보 수집·이용에 동의하지 않을 권리가 있으나, 동의를 거부하실 경우 서비스 이용이 제한될 수 있습니다.

5. 서비스 제공을 위한 개인정보 제3자 제공 동의
수집된 회원정보는 원칙적으로 외부에 제공하지 않습니다. 다만, 회원이 프리티풀을 통해 견적 요청, 섭외 상담, 매칭, 계약 진행, 일정 조율, 사후관리 등 서비스 이용을 요청한 경우, 해당 서비스 제공에 필요한 최소한의 범위 내에서 아래와 같이 개인정보를 제3자에게 제공할 수 있습니다.

가. 제공받는 자
프리티풀에 등록된 행사 전문가, 전문사회자, 아나운서, MC, 통번역사, 축가·공연자 등 서비스 제공 후보자 또는 확정 제공자, 제휴 웨딩홀, 행사대행사, 기업·기관 행사 담당자, 기타 회원이 요청한 서비스 제공을 위해 필요한 프리티풀 제휴·협력업체

나. 제공 목적
회원의 견적 산정, 전문가 추천 및 매칭, 가능 일정 확인, 상담 진행, 계약 및 예약 진행, 행사 준비를 위한 사전 조율, 서비스 제공 및 사후관리

다. 제공 항목
성명, 연락처, 이메일, 희망 행사일정, 행사 유형, 행사 지역, 요청사항, 예산 범위 등 회원이 견적 요청 또는 상담 과정에서 직접 입력하거나 제공한 정보 중 서비스 제공에 필요한 최소한의 정보

라. 보유 및 이용 기간
제공받는 자는 위 목적 달성 시까지 개인정보를 보유·이용하며, 관련 법령에 따라 보존이 필요한 경우에는 해당 법령에서 정한 기간 동안 보관할 수 있습니다.

마. 동의 거부 권리 및 불이익
회원은 개인정보 제3자 제공에 대한 동의를 거부할 권리가 있습니다. 다만, 동의를 거부할 경우 전문가 추천, 견적 제공, 일정 확인, 섭외 상담, 계약 진행 등 프리티풀의 일부 또는 전부 서비스 이용이 제한될 수 있습니다.

회사는 서비스 제공 목적과 무관하게 회원의 개인정보를 제3자에게 판매하거나 임의로 제공하지 않습니다.`;

/* 사회자 목록(API) 로드 실패 시 폴백 — 결혼식사회자 리스트페이지 카드와 동일한 데이터 형태 */
const FALLBACK_PROS = [
  { id: 'fb-1', name: '김도현', categories: ['결혼식사회자'], regions: ['서울', '경기'], isNationwide: false, rating: 5.0, reviews: 132, rank: 1, image: '/images/pro-01/10000133881772850005043.avif', intro: '신랑신부의 톤에 맞춘 따뜻하고 단정한 예식 진행을 약속드립니다.', experience: 9 },
  { id: 'fb-2', name: '이서연', categories: ['결혼식사회자'], regions: ['서울'], isNationwide: false, rating: 4.9, reviews: 98, rank: 2, image: '/images/pro-02/10000365351773046135169.avif', intro: '방송 아나운서 출신, 또렷한 전달력과 감성적인 멘트로 진행합니다.', experience: 7 },
  { id: 'fb-3', name: '박지훈', categories: ['결혼식사회자'], regions: [], isNationwide: true, rating: 4.9, reviews: 87, rank: 3, image: '/images/pro-03/IMG_06781773894450803.avif', intro: '전국 어디든 가능합니다. 유쾌하면서도 품격 있는 진행이 강점이에요.', experience: 11 },
  { id: 'fb-4', name: '최유나', categories: ['결혼식사회자'], regions: ['서울', '인천'], isNationwide: false, rating: 5.0, reviews: 76, rank: 4, image: '/images/pro-05/10000029811773033474612.avif', intro: '하객 모두가 편안한 분위기 속에서 몰입하는 예식을 만들어 드립니다.', experience: 6 },
  { id: 'fb-5', name: '정민석', categories: ['결혼식사회자'], regions: ['경기', '서울'], isNationwide: false, rating: 4.8, reviews: 64, rank: 5, image: '/images/pro-07/IMG_53011772965035335.avif', intro: '차분하고 안정적인 진행을 원하시는 신랑신부님께 추천드립니다.', experience: 8 },
  { id: 'fb-6', name: '한예진', categories: ['결혼식사회자'], regions: ['서울'], isNationwide: false, rating: 4.9, reviews: 120, rank: 6, image: '/images/pro-09/Facetune_10-02-2026-21-07-511772438130235.avif', intro: '감동과 위트의 밸런스, 예식의 흐름을 섬세하게 이끌어 드려요.', experience: 5 },
  { id: 'fb-7', name: '오세훈', categories: ['결혼식사회자'], regions: [], isNationwide: true, rating: 4.8, reviews: 53, rank: 7, image: '/images/pro-15/IMG_0196.avif', intro: '베테랑 사회자. 어떤 돌발상황도 자연스럽게 리드합니다.', experience: 12 },
  { id: 'fb-8', name: '윤지아', categories: ['결혼식사회자'], regions: ['서울', '경기'], isNationwide: false, rating: 5.0, reviews: 91, rank: 8, image: '/images/pro-20/D54BC1BA-3BF2-4827-AA76-096D4056BCDB1773030157943.avif', intro: '결혼식 톤앤매너에 맞춘 맞춤형 대본으로 진행해 드립니다.', experience: 6 },
  { id: 'fb-9', name: '강태우', categories: ['결혼식사회자'], regions: ['인천', '서울'], isNationwide: false, rating: 4.9, reviews: 70, rank: 9, image: '/images/pro-23/IMG_46511771924269213.avif', intro: '신뢰감 있는 목소리로 예식의 격을 한층 높여 드립니다.', experience: 7 },
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

type Stage = 'form' | 'survey' | 'tier' | 'matching';

/** 설문 다음에 고르는 사회자 등급 */
type McTier = '스탠다드 사회자' | '프리미엄 사회자';

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

  // 개발 중 화면 확인용: /wedding-mc?preview=tier 로 등급 선택 화면만 바로 띄운다.
  // 프로덕션 빌드에선 무시된다(실사용자가 URL 로 단계를 건너뛰지 못하게).
  // useState 초기값으로 넣으면 서버('form')와 클라이언트가 달라져 하이드레이션 에러가 난다 → 마운트 후 전환.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const p = new URLSearchParams(window.location.search).get('preview');
    if (p === 'tier' || p === 'survey') setStage(p as Stage);
  }, []);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [eventDateTime, setEventDateTime] = useState('');
  const [agree, setAgree] = useState(false);
  const [eventPartChoice, setEventPartChoice] = useState<'1부예식' | '2부예식' | ''>('');
  const [benefits, setBenefits] = useState<string[]>([]);   // 설문에서 고른 관심혜택 — 등급까지 고른 뒤 함께 기록
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeMatch, setActiveMatch] = useState<ActiveMatchSnapshot | null>(null);
  const [showProModal, setShowProModal] = useState(false);
  const [proList, setProList] = useState<ProListItem[]>([]);
  const [proLoading, setProLoading] = useState(false);
  const proLoadedRef = useRef(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacyExpanded, setPrivacyExpanded] = useState(false);

  /* ── 사회자 프로필 모달: 열릴 때 1회 실제 사회자 목록 로드 ── */
  useEffect(() => {
    if (!showProModal || proLoadedRef.current) return;
    proLoadedRef.current = true;
    setProLoading(true);
    discoveryApi
      .getProList({ limit: 30, sort: 'rating' })
      .then((res: any) => {
        const list: ProListItem[] = Array.isArray(res) ? res : res?.data ?? [];
        setProList(list.filter((p) => p && (p.profileImageUrl || (Array.isArray(p.images) && p.images[0]))));
      })
      .catch(() => {})
      .finally(() => setProLoading(false));
  }, [showProModal]);

  /* ── 모달 열림: 바디 스크롤 잠금 + ESC 닫기 ── */
  useEffect(() => {
    if (!showProModal && !showPrivacyModal) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowProModal(false); setShowPrivacyModal(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [showProModal, showPrivacyModal]);

  const stickyCtaRef = useRef<HTMLDivElement | null>(null);
  const registerRef = useRef<HTMLDivElement | null>(null);
  const formStartFiredRef = useRef(false);

  useEffect(() => {
    if (authUser?.name && !name) setName(authUser.name);
    const userPhone = (authUser as any)?.phone;
    if (userPhone && !phone) setPhone(formatPhoneInput(userPhone));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  /* ── UTM 보존 + 방문 추적 ── */
  useEffect(() => {
    captureUtm();
    trackLandingVisit('wedding-mc');
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
    const isTest = isTestSubmission(name.trim(), authUser?.id);
    const eventPart = eventPartChoice;

    // 시트 기록은 설문(관심혜택)까지 받은 뒤 proceedFromSurvey에서 폼+혜택을 한 행으로 전송

    // Freetiful 백엔드 — 다수견적 + 간이 회원가입 + 토큰
    let createdMatchRequestId: string | null = null;
    try {
      const digits = normalizedPhone.replace(/\D/g, '');
      const rawUserInput = {
        source: 'landing_wedding_mc_v3',
        name: name.trim(),
        phone: normalizedPhone,
        addressDetail,
        eventPart,
        eventDateTime,
        ...utm,
      };
      // 로그인 상태면 인증 의뢰(createRequest), 비로그인이면 간이가입+의뢰(quickRequest)
      let res: any;
      if (authUser) {
        res = await matchApi.createRequest({
          categoryId: '결혼식사회자',
          type: 'multi',
          eventLocation: fullLocation,
          eventDate: datePart || undefined,
          eventTime: timePart || undefined,
          rawUserInput,
        });
      } else {
        res = await matchApi.quickRequest({
          name: name.trim() || undefined,
          phone: digits,
          categoryId: '결혼식사회자',
          type: 'multi',
          eventLocation: fullLocation,
          eventDate: datePart || undefined,
          eventTime: timePart || undefined,
          rawUserInput,
        });
        if (res?.accessToken && res?.refreshToken && res?.user) {
          setAuth(res.user, res.accessToken, res.refreshToken);
        }
      }
      createdMatchRequestId = res?.matchRequest?.id || res?.id || null;
      // 테스트 제출은 전환으로 세지 않는다 — 어드민 광고효율의 견적신청수·전환당비용이 왜곡된다
      if (!isTest) trackLandingConversion('wedding-mc');
      window.dispatchEvent(new Event('freetiful:match-requests-changed'));
      // iOS: 다이나믹 아일랜드 "사회자 찾는 중" 라이브 액티비티 시작
      try { (window as any).webkit?.messageHandlers?.nativeMCSearch?.postMessage({ action: 'start', category: '결혼식 사회자' }); } catch {}
    } catch (err: any) {
      window.alert(`제출에 실패했어요. ${err?.response?.data?.message || err?.message || ''}`);
      setSubmitting(false);
      return;
    }

    // 테스트 제출은 메타 픽셀 Lead 도 보내지 않는다 — 광고 최적화 학습이 가짜 전환으로 오염된다
    if (!isTest && typeof window.fbq === 'function') {
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
    setStage('survey');
    setSubmitting(false);
  };

  /* ── 설문(관심혜택) 선택 → 등급 선택 화면으로 (시트 기록은 등급까지 고른 뒤 한 번에) ── */
  const proceedFromSurvey = (benefitList: string[]) => {
    setBenefits(benefitList);
    setStage('tier');
  };

  /* ── 등급 선택 → 폼+혜택+등급을 한 행으로 시트 기록 후 OX 매칭 화면으로 ── */
  const proceedFromTier = (tier: McTier) => {
    // 시트의 [관심혜택] 칸에 등급도 함께 남긴다.
    // Apps Script 는 고정 순서로 컬럼을 쓰고 benefits 배열만 읽으므로,
    // 새 키(tier)만 보내면 시트에는 안 찍힌다. 접두어를 붙여 나중에 분리하기 쉽게 했다.
    const benefitList = [...benefits, `희망등급: ${tier}`];
    const benefit = benefitList.join(', ');
    const np = normalizePhone(phone) || phone;
    const [datePart, timePart] = eventDateTime.split('T');
    const utm = {
      utm_source: sessionStorage.getItem('utm_source') || '',
      utm_medium: sessionStorage.getItem('utm_medium') || '',
      utm_campaign: sessionStorage.getItem('utm_campaign') || '',
      utm_term: sessionStorage.getItem('utm_term') || '',
      utm_content: sessionStorage.getItem('utm_content') || '',
      referrer: sessionStorage.getItem('referrer') || '',
      landing_url: sessionStorage.getItem('landing_url') || window.location.href,
    };
    // 폼 데이터 + 선택한 관심혜택을 한 행으로 구글 시트에 기록 — fire-and-forget
    fetch(GOOGLE_SHEET_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        name: name.trim(),
        phone: np,
        region: addressDetail.trim(),
        // Apps Script 의 [결혼예정일] 칸은 data.weddingDate 만 기록하고 weddingTime 은 읽지 않는다.
        // 기존 컬럼 순서를 바꾸면 과거 데이터가 밀리므로, 날짜+시간을 한 값으로 합쳐 보낸다. (예: "2026-10-10 13:00")
        weddingDate: [datePart, timePart].filter(Boolean).join(' '),
        weddingTime: timePart || '',   // 시트에 '예식시간' 컬럼을 추가할 경우 대비
        addressDetail,
        eventPart: eventPartChoice,
        // ★ Apps Script 는 (data.benefits || []).join(', ') 로 [관심혜택] 칸을 채운다 →
        //   반드시 배열 키 `benefits` 로 보내야 기록됨. `benefit`(문자열)은 하위호환용.
        benefits: benefitList,
        benefit,
        // 시트에 [희망등급] 컬럼을 추가할 경우 대비 (현재 Apps Script 는 이 키를 읽지 않는다)
        tier,
        source: 'freetiful-mc-wedding-v3',
        ...utm,
      }),
    }).catch(() => undefined);
    setStage('matching');
  };

  const proCards =
    proList.length > 0
      ? proList
          .map((p, idx) => ({
            id: p.id,
            name: p.name || '',
            categories: p.categories || [],
            regions: p.regions || [],
            isNationwide: p.isNationwide ?? false,
            rating: p.avgRating || 0,
            reviews: p.reviewCount || 0,
            rank: idx + 1,
            image: p.profileImageUrl || (Array.isArray(p.images) ? p.images[0] : '') || '',
            intro: p.shortIntro || '',
            experience: p.careerYears || 1,
          }))
          .filter((c) => c.image)
      : FALLBACK_PROS;

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

      {stage === 'survey' ? (
        <SurveyScreen onSelect={proceedFromSurvey} onBack={() => setStage('form')} />
      ) : stage === 'tier' ? (
        <TierScreen onSelect={proceedFromTier} onBack={() => setStage('survey')} />
      ) : stage === 'matching' && activeMatch ? (
        <MatchingScreen
          matchRequestId={activeMatch.matchRequestId}
          onResolved={(roomId) => {
            try {
              localStorage.removeItem(ACTIVE_MATCH_STORAGE_KEY);
            } catch {}
            router.push(roomId ? `/chat/${roomId}` : '/chat');
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
                <img src="/images/wedding-mc/redesign/proof-kim-yuseok.jpg" alt="김유석 아나운서" className="aspect-square w-full rounded-[30px] object-cover" />
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
              <button type="button" onClick={() => setShowProModal(true)} className="mt-6 inline-flex min-h-[32px] min-w-[52px] items-center justify-center gap-2.5 rounded-full px-[18px] py-3 text-[17px] font-semibold transition active:scale-[0.98]" style={{ color: 'rgba(3,18,40,0.70)', backgroundColor: 'rgba(7,25,76,0.05)' }}>
                더 많은 사회자 프로필 보기
              </button>
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

                {/* 예식 구분 — 1부/2부 (단일 선택) */}
                <div>
                  <label className="block text-[15px] font-bold text-[#1A1A1A]">예식 구분</label>
                  <div className="mt-2 grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setEventPartChoice((v) => (v === '1부예식' ? '' : '1부예식'))}
                      className="flex h-[54px] items-center justify-center gap-2 rounded-[16px] border-2 text-[17px] font-semibold transition active:scale-[0.98]"
                      style={{ borderColor: eventPartChoice === '1부예식' ? '#3182F6' : '#ECEEF2', backgroundColor: eventPartChoice === '1부예식' ? 'rgba(49,130,246,0.06)' : '#fff', color: eventPartChoice === '1부예식' ? '#3182F6' : '#4E5968' }}
                    >
                      {eventPartChoice === '1부예식' && <Check size={18} strokeWidth={3} />}
                      1부예식
                    </button>
                    <button
                      type="button"
                      onClick={() => setEventPartChoice((v) => (v === '2부예식' ? '' : '2부예식'))}
                      className="flex h-[54px] items-center justify-center gap-2 rounded-[16px] border-2 text-[17px] font-semibold transition active:scale-[0.98]"
                      style={{ borderColor: eventPartChoice === '2부예식' ? '#3182F6' : '#ECEEF2', backgroundColor: eventPartChoice === '2부예식' ? 'rgba(49,130,246,0.06)' : '#fff', color: eventPartChoice === '2부예식' ? '#3182F6' : '#4E5968' }}
                    >
                      {eventPartChoice === '2부예식' && <Check size={18} strokeWidth={3} />}
                      2부예식
                    </button>
                  </div>
                  <p className="mt-2.5 text-[14px] text-[#9AA3B0]">예식 형태를 선택해주세요</p>
                </div>

                {/* 동의 — 파란 체크 동그라미 */}
                <div>
                  <label className="flex cursor-pointer items-center justify-center gap-3 pt-1">
                    <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="sr-only" />
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 transition-colors" style={{ borderColor: agree ? '#3182F6' : (showErrors ? '#FF4D4F' : '#D5DAE2'), backgroundColor: agree ? '#3182F6' : 'transparent' }}>
                      {agree && <Check size={16} strokeWidth={3} className="text-white" />}
                    </span>
                    <span className={`text-[16px] ${showErrors && !agree ? 'text-[#FF4D4F]' : 'text-[#3A3F49]'}`}>
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowPrivacyModal(true); }} className="underline underline-offset-2 font-semibold text-[#3182F6]">개인정보 수집 및 이용</button>에 동의합니다.
                    </span>
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
                  {submitting ? '전송 중...' : (authUser ? '의뢰하기' : '비회원 의뢰하기')}
                </button>

                {/* 비로그인일 때만 가입 유도 + 카카오 로그인 노출 (로그인 상태에선 숨김) */}
                {!authUser && (
                  <>
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
                    {/* 이미 여기서 견적을 신청한 분 — 소셜 계정 없이 전화번호+이름으로 로그인 */}
                    <div className="mt-2">
                      <GuestLoginForm compact onSuccess={() => window.location.reload()} />
                    </div>
                  </>
                )}
              </form>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-[#181C24]/10">
            <div className="max-w-6xl mx-auto px-5 py-10 text-center text-xs text-[#6B6F78] leading-relaxed">
              © FREETIFUL · WEDDING MC<br />
              본 페이지의 후기는 실제 고객 사례를 바탕으로 재구성되었습니다.
              <div className="mt-5">
                <div className="inline-block text-left text-[11px] leading-[1.75] text-[#8B8F98]">
                  업체명 : 주식회사커넥트풀<br />
                  대표자명 : 서나웅<br />
                  사업자번호 : 391-86-03659<br />
                  사업장주소 : 서울 중구 퇴계로36길2, 본관 130호
                </div>
              </div>
            </div>
          </footer>

          {/* 플로팅 푸터 (Bottom CTA 시안) */}
          <div
            ref={stickyCtaRef}
            className="wmc-sticky-cta fixed inset-x-0 bottom-0 z-40"
            style={{ transition: 'transform .35s ease, opacity .35s ease' }}
          >
            {/* 이미지 + 말풍선 — 버튼 위로 내려서 겹치게 (z 높여 버튼 위에 표시). 로그인 시 가입 유도 숨김 */}
            {!authUser && (
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
            )}
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

      {showProModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="전문 사회자 프로필">
          <div className="wmc-overlay-in absolute inset-0 bg-black/50" onClick={() => setShowProModal(false)} />
          <div className="wmc-sheet-up relative z-10 flex w-full max-w-lg flex-col rounded-t-[28px] bg-white shadow-[0_-12px_40px_rgba(0,0,0,0.18)]" style={{ height: '86dvh', maxHeight: '86dvh' }}>
            <div className="flex justify-center pb-1 pt-3"><span className="h-1.5 w-10 rounded-full bg-[#E1E5EC]" /></div>
            <div className="flex items-start justify-between px-5 pb-3 pt-1">
              <div>
                <h3 className="text-[21px] font-extrabold leading-tight text-[#191F28]">검증된 전문 사회자</h3>
                <p className="mt-1 text-[13px] text-[#8A94A6]">방송 경력 · 프리티풀 인증 사회자</p>
              </div>
              <button type="button" onClick={() => setShowProModal(false)} aria-label="닫기" className="-mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#F2F4F7] text-[18px] leading-none text-[#5A6473] transition active:scale-95">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
              {proLoading && proList.length === 0 ? (
                <div className="divide-y divide-[#F2F4F7]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-3 px-4 py-3">
                      <div className="h-[140px] w-[105px] shrink-0 animate-pulse rounded-lg bg-[#EEF1F6]" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-4 w-2/3 animate-pulse rounded bg-[#EEF1F6]" />
                        <div className="h-3 w-1/3 animate-pulse rounded bg-[#EEF1F6]" />
                        <div className="h-3 w-full animate-pulse rounded bg-[#EEF1F6]" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-[#EEF1F6]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-[#F2F4F7]">
                  {proCards.map((pro) => {
                    const isRealPro = pro.id && !String(pro.id).startsWith('fb-');
                    const goDetail = () => { if (!isRealPro) return; setShowProModal(false); router.push(`/pros/${pro.id}`); };
                    return (
                    <div
                      key={pro.id}
                      onClick={goDetail}
                      role={isRealPro ? 'button' : undefined}
                      tabIndex={isRealPro ? 0 : undefined}
                      onKeyDown={isRealPro ? (e) => { if (e.key === 'Enter') goDetail(); } : undefined}
                      className={`px-4 py-3 ${isRealPro ? 'cursor-pointer transition active:bg-[#F7F9FC]' : ''}`}
                    >
                      <div className="relative flex gap-3 rounded-xl">
                        <div className="relative h-[140px] w-[105px] shrink-0 overflow-hidden rounded-lg bg-gray-100">
                          <img
                            src={pro.image || '/images/default-profile.png'}
                            alt={pro.name}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                          {pro.isNationwide && (
                            <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[#3180F7] shadow-sm">
                              전국
                            </span>
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col py-0.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[16px] font-bold leading-tight text-gray-900">
                              {pro.categories[0] || '사회자'} {pro.name}
                            </p>
                            {pro.rank > 0 && pro.rank <= 10 && (
                              <span className="shrink-0 rounded-full bg-[#EAF3FF] px-2 py-0.5 text-[10px] font-bold text-[#3180F7]">
                                TOP {pro.rank}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="flex items-center gap-0.5">
                              <Star size={13} className="fill-yellow-400 text-yellow-400" />
                              <span className="text-[13px] font-bold text-gray-900">{pro.rating}</span>
                              <span className="text-[13px] text-gray-400">({pro.reviews})</span>
                            </div>
                          </div>
                          <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-gray-500">
                            &ldquo;{pro.intro || '프리티풀 인증 사회자입니다'}&rdquo;
                          </p>
                          <div className="mt-auto flex flex-wrap gap-1 pt-2">
                            {pro.experience > 0 && (
                              <span className="rounded-[5px] bg-gray-100 px-1.5 py-1 text-[10px] font-semibold text-gray-600">
                                경력 {pro.experience}년
                              </span>
                            )}
                            {(pro.isNationwide ? ['전국가능'] : pro.regions.slice(0, 2)).map((tag) => (
                              <span key={tag} className="rounded-[5px] bg-gray-100 px-1.5 py-1 text-[10px] font-medium text-gray-500">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="border-t border-[#F0F2F5] px-5 pt-3" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
              <button type="button" onClick={() => { setShowProModal(false); setTimeout(() => registerRef.current?.scrollIntoView({ behavior: 'smooth' }), 80); }} className="w-full rounded-2xl bg-[#3182F6] py-4 text-[16px] font-bold text-white transition active:scale-[0.99]">
                30초 무료견적 받기
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrivacyModal && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="개인정보 수집·이용 동의">
          <div className="wmc-overlay-in absolute inset-0 bg-black/50" onClick={() => { setShowPrivacyModal(false); setPrivacyExpanded(false); }} />
          <div className="wmc-sheet-up relative z-10 flex w-full max-w-lg flex-col rounded-t-[28px] bg-white" style={{ maxHeight: '88dvh' }}>
            <div className="flex justify-center pb-1 pt-3"><span className="h-1.5 w-10 rounded-full bg-[#E1E5EC]" /></div>
            <div className="flex items-center justify-between px-5 pb-2 pt-1">
              <h3 className="text-[18px] font-extrabold text-[#191F28]">약관 동의</h3>
              <button type="button" onClick={() => { setShowPrivacyModal(false); setPrivacyExpanded(false); }} aria-label="닫기" className="-mr-1 grid h-9 w-9 place-items-center rounded-full bg-[#F2F4F7] text-[18px] leading-none text-[#5A6473] transition active:scale-95">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="rounded-2xl border border-[#EEF1F6] p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[14px] font-bold leading-snug text-[#333D4B]">
                    <span className="text-[#3182F6]">[필수]</span> 개인정보 수집·이용 및 서비스 제공을 위한 제3자 제공 동의
                  </p>
                  <button type="button" onClick={() => setPrivacyExpanded((v) => !v)} className="shrink-0 whitespace-nowrap text-[13px] font-semibold text-[#8B95A1] underline underline-offset-2">
                    {privacyExpanded ? '접기' : '내용 보기'}
                  </button>
                </div>
                {privacyExpanded && (
                  <p className="mt-3 whitespace-pre-line border-t border-[#F2F4F6] pt-3 text-[12.5px] leading-relaxed text-[#5A6473]">
                    {PRIVACY_CONSENT_TEXT}
                  </p>
                )}
              </div>
            </div>
            <div className="border-t border-[#F0F2F5] px-5 pt-3" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
              <button type="button" onClick={() => { setAgree(true); setShowPrivacyModal(false); setPrivacyExpanded(false); }} className="w-full rounded-2xl bg-[#3182F6] py-4 text-[16px] font-bold text-white transition active:scale-[0.99]">
                동의합니다
              </button>
            </div>
          </div>
        </div>
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
        @keyframes wmcOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        .wmc-overlay-in { animation: wmcOverlayIn 0.25s ease both; }
        @keyframes wmcSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .wmc-sheet-up { animation: wmcSheetUp 0.34s cubic-bezier(0.32, 0.72, 0, 1) both; will-change: transform; }
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
          .wmc-overlay-in { animation: none; }
          .wmc-sheet-up { animation: none; }
        }
      `}</style>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   설문 화면 — 폼 제출 후 혜택 선택 (고급 선택 애니메이션) → OX 매칭
   ═══════════════════════════════════════════════════════════════════ */
function SurveyScreen({ onSelect, onBack }: { onSelect: (benefits: string[]) => void; onBack: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [going, setGoing] = useState(false);
  const toggle = (benefit: string) => {
    if (going) return;
    setSelected((prev) => (prev.includes(benefit) ? prev.filter((x) => x !== benefit) : [...prev, benefit]));
  };
  const proceed = () => {
    if (going) return;
    setGoing(true);
    setTimeout(() => onSelect(selected), 350);
  };
  return (
    <div className="min-h-[100dvh] bg-white" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'SF Pro', 'Apple SD Gothic Neo', Pretendard, system-ui, sans-serif" }}>
      <header className="sticky top-0 z-30 bg-white">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-3">
          <button type="button" onClick={onBack} aria-label="뒤로 가기" className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full text-[#181C24] hover:bg-[#181C24]/5 active:bg-[#181C24]/10">
            <ChevronLeft size={24} strokeWidth={2.2} />
          </button>
          <img src="/images/logo-freetiful-wordmark.svg" alt="Freetiful" className="h-6 w-auto" />
          <div className="w-10" />
        </div>
      </header>

      <div className="mx-auto max-w-md px-6 pt-16 text-center">
        <h1 className="text-[28px] font-extrabold leading-[1.3] text-[#1A1A1A]">이런 혜택도<br />무료로 받아보실래요?</h1>
        <p className="mt-3 text-[15px] text-[#9AA3B0]">선택하신 항목의 할인정보를 안내드려요!</p>
        <p className="mt-1 text-[13px] text-[#B0B8C1]">여러 개 선택할 수 있어요</p>
      </div>

      <div className="mx-auto mt-9 max-w-md px-5 pb-40">
        {SURVEY_BENEFITS.map((b) => {
          const on = selected.includes(b);
          return (
            <button
              key={b}
              type="button"
              onClick={() => toggle(b)}
              className={`wmc-survey-row relative flex h-[58px] w-full items-center justify-center overflow-hidden border-b border-[#EEF1F6] text-[17px] font-semibold transition-all duration-300 ${on ? 'wmc-survey-on' : ''}`}
              style={{ color: on ? '#3182F6' : '#333D4B' }}
            >
              <span className="relative z-10 inline-flex items-center gap-1.5">
                {on && <Check size={18} strokeWidth={3} className="wmc-survey-check" />}
                {b}
              </span>
            </button>
          );
        })}
      </div>

      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 px-5 pb-[calc(18px+env(safe-area-inset-bottom))] pt-6" style={{ background: 'linear-gradient(to top, #fff 70%, rgba(255,255,255,0))' }}>
        <button type="button" onClick={proceed} disabled={going} className="h-[56px] w-full rounded-[16px] bg-[#3182F6] text-[17px] font-bold text-white transition active:scale-[0.98] disabled:opacity-70">
          {selected.length > 0 ? `다음 · ${selected.length}개 선택` : '건너뛰고 시작하기'}
        </button>
      </div>

      <style jsx global>{`
        .wmc-survey-row::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, rgba(49,130,246,0) 0%, rgba(49,130,246,0.16) 50%, rgba(49,130,246,0) 100%);
          transform: translateX(-120%);
          opacity: 0;
          pointer-events: none;
        }
        .wmc-survey-on::before { animation: wmcSurveySweep 0.95s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        @keyframes wmcSurveySweep {
          0% { transform: translateX(-120%); opacity: 0; }
          35% { opacity: 1; }
          100% { transform: translateX(120%); opacity: 0; }
        }
        .wmc-survey-on {
          background: linear-gradient(180deg, rgba(49,130,246,0.10), rgba(49,130,246,0.03));
          box-shadow: 0 6px 18px rgba(49,130,246,0.13);
          border-radius: 14px;
          border-bottom-color: transparent !important;
        }
        .wmc-survey-check { display: inline-block; animation: wmcSurveyCheck 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        @keyframes wmcSurveyCheck { 0% { opacity: 0; transform: scale(0.2); } 100% { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) {
          .wmc-survey-row, .wmc-survey-on { transition: none !important; }
          .wmc-survey-on::before, .wmc-survey-check { animation: none; }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   등급 선택 — 좌/우 풀사이즈 버튼 (스탠다드 · 프리미엄)
   ═══════════════════════════════════════════════════════════════════ */

/** 프리미엄 배경 — 빌라드지디 히어로 영상 (VilladegdEventOverlay 와 동일 소스) */
const TIER_PREMIUM_VIDEO =
  'https://jnhwlzeyberhyv7s.public.blob.vercel-storage.com/villadegd/villadegd-hero.mp4';

/** 금색 파티클 — 랜덤이면 하이드레이션 불일치가 나므로 좌표를 고정한다 */
const TIER_PARTICLES: { left: number; size: number; dur: number; delay: number; opacity: number }[] = [
  { left: 6, size: 3, dur: 15, delay: 0, opacity: 0.75 },
  { left: 14, size: 2, dur: 19, delay: 3.2, opacity: 0.55 },
  { left: 22, size: 4, dur: 13, delay: 6.5, opacity: 0.85 },
  { left: 31, size: 2, dur: 21, delay: 1.4, opacity: 0.5 },
  { left: 39, size: 3, dur: 16, delay: 8.1, opacity: 0.7 },
  { left: 47, size: 2, dur: 18, delay: 4.6, opacity: 0.6 },
  { left: 55, size: 4, dur: 14, delay: 10.3, opacity: 0.8 },
  { left: 63, size: 2, dur: 20, delay: 2.2, opacity: 0.5 },
  { left: 71, size: 3, dur: 17, delay: 7.4, opacity: 0.72 },
  { left: 79, size: 2, dur: 22, delay: 5.0, opacity: 0.55 },
  { left: 87, size: 4, dur: 15, delay: 11.6, opacity: 0.82 },
  { left: 94, size: 2, dur: 19, delay: 9.0, opacity: 0.6 },
];

const TIER_OPTIONS: {
  key: McTier;
  eyebrow: string;
  title: string;
  price: string;
  /** 취소선으로 보여줄 정가 — 있으면 '특가' 배지가 함께 붙는다 */
  strikePrice?: string;
  desc: string;
  image: string;
  /** 인물 이미지 높이(화면 대비). 프리미엄 78% 는 크게 보이는 대신 양옆 두 사람이 잘린다(의도된 선택) */
  imageHeight: string;
}[] = [
  {
    key: '스탠다드 사회자',
    eyebrow: 'STANDARD',
    title: '스탠다드',
    price: '19만 9,000원',
    desc: '프리티풀이 엄선한\n스탠다드 사회자',
    image: '/images/wedding-mc/tier-standard.webp',
    imageHeight: '78%',
  },
  {
    key: '프리미엄 사회자',
    eyebrow: 'PREMIUM',
    title: '프리미엄',
    price: '29만 9,000원',
    strikePrice: '49만 9,000원',
    desc: '어디서도 만나볼 수 없는\n방송사 3사 출신 포함\n경력 7년 이상의 베테랑\n프리미엄 사회자',
    image: '/images/wedding-mc/tier-premium.webp',
    imageHeight: '78%',
  },
];

function TierScreen({ onSelect, onBack }: { onSelect: (tier: McTier) => void; onBack: () => void }) {
  const [picked, setPicked] = useState<McTier | null>(null);
  const [going, setGoing] = useState(false);

  const confirm = () => {
    if (!picked || going) return;
    setGoing(true);
    setTimeout(() => onSelect(picked), 260);
  };

  return (
    <div
      className="relative flex h-[100dvh] w-full overflow-hidden bg-black"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'SF Pro', 'Apple SD Gothic Neo', Pretendard, system-ui, sans-serif" }}
    >
      {TIER_OPTIONS.map((opt) => {
        const premium = opt.key === '프리미엄 사회자';
        const dimmed = picked !== null && picked !== opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => setPicked(opt.key)}
            aria-label={opt.key}
            aria-pressed={picked === opt.key}
            className={`wmc-tier relative h-full flex-1 overflow-hidden text-center ${
              premium ? 'bg-[#0B0D11]' : 'bg-[#E7EAEE]'
            }`}
          >
            {/* ── 배경 ── */}
            {premium ? (
              <>
                {/* preload='auto' 로 두면 이 화면에 오지도 않은 사람까지 29MB 를 내려받는다.
                    metadata 만 먼저 받고 재생 시점에 스트리밍한다. */}
                <video
                  src={TIER_PREMIUM_VIDEO}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                />
                {/* 영상 톤 정리 — 알록달록해지지 않게 금색으로 가라앉힌다 */}
                <span className="pointer-events-none absolute inset-0 bg-[#3A2A08] mix-blend-color opacity-70" />
                <span className="pointer-events-none absolute inset-0 bg-black/45" />
                <span className="wmc-gold-glow pointer-events-none absolute inset-0" />
                <span className="pointer-events-none absolute inset-0 overflow-hidden">
                  {TIER_PARTICLES.map((p, i) => (
                    <span
                      key={i}
                      className="wmc-gold-dot"
                      style={{
                        left: `${p.left}%`,
                        width: p.size,
                        height: p.size,
                        animationDuration: `${p.dur}s`,
                        animationDelay: `${p.delay}s`,
                        opacity: p.opacity,
                      }}
                    />
                  ))}
                </span>
              </>
            ) : (
              <>
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#FBFCFD] via-[#E4E8ED] to-[#C9D0D8]" />
                {/* 은빛 파동 — 사선으로 은은하게 지나간다 */}
                <span className="wmc-silver-wave pointer-events-none absolute inset-0" />
                <span className="wmc-silver-wave wmc-silver-wave-2 pointer-events-none absolute inset-0" />
              </>
            )}

            {/* ── 인물 — 화면의 70%, 좌우·아래는 잘려도 된다 ── */}
            <span
              className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2"
              style={{ height: opt.imageHeight }}
            >
              <img
                src={opt.image}
                alt=""
                className={`h-full w-auto max-w-none object-contain ${
                  premium ? 'drop-shadow-[0_0_34px_rgba(201,162,39,0.30)]' : 'drop-shadow-[0_0_26px_rgba(90,105,125,0.22)]'
                }`}
                loading="eager"
              />
            </span>

            {/* ── 하단 딤드 ── */}
            <span
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[64%]"
              style={{
                background: premium
                  ? 'linear-gradient(to top, #05070A 30%, rgba(5,7,10,0.88) 52%, rgba(5,7,10,0.45) 74%, rgba(5,7,10,0))'
                  : 'linear-gradient(to top, #10141A 30%, rgba(16,20,26,0.86) 52%, rgba(16,20,26,0.42) 74%, rgba(16,20,26,0))',
              }}
            />

            {/* ── 소개글 — 하단 ── */}
            <span
              className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center px-3"
              style={{ paddingBottom: 'calc(112px + env(safe-area-inset-bottom))' }}
            >
              <span
                className={`text-[10px] font-bold tracking-[0.28em] ${
                  premium ? 'text-[#E3C577]' : 'text-[#AFBAC7]'
                }`}
              >
                {opt.eyebrow}
              </span>

              {/* 프리미엄은 제목 좌우에 금색 월계수 */}
              <span className="mt-2 flex items-center justify-center gap-2">
                {premium && (
                  <img src="/images/wedding-mc/tier-ornament-left.svg" alt="" className="h-[30px] w-auto" />
                )}
                <span
                  className={`text-[24px] font-extrabold leading-tight ${
                    premium ? 'wmc-gold-text' : 'wmc-silver-text'
                  }`}
                >
                  {opt.title}
                </span>
                {premium && (
                  <img src="/images/wedding-mc/tier-ornament-right.svg" alt="" className="h-[30px] w-auto" />
                )}
              </span>

              <span className={`mt-3.5 h-px w-8 ${premium ? 'bg-[#C9A227]/50' : 'bg-white/25'}`} />

              {/* 가격 */}
              <span className="mt-3.5 flex flex-col items-center leading-none">
                {/* 특가 줄은 프리미엄에만 있지만, 자리는 양쪽 다 차지해야 좌우 높이가 맞는다 */}
                <span className="mb-2 flex h-[19px] items-center gap-1.5">
                  {opt.strikePrice && (
                    <>
                      <span className="rounded-[3px] bg-[#C9302C] px-1.5 py-[3px] text-[9.5px] font-bold tracking-wide text-white">
                        특가
                      </span>
                      <span className="text-[12px] font-semibold text-white/40 line-through">{opt.strikePrice}</span>
                    </>
                  )}
                </span>
                <span className="text-[19px] font-extrabold text-white">{opt.price}</span>
                <span className="mt-1.5 text-[11.5px] font-semibold text-white/50">부터~</span>
              </span>

              {/* 4줄분(12px * 1.6 * 4) 높이를 고정 — 줄 수가 달라도 위쪽 요소들이 같은 높이에 온다 */}
              <span className="mt-4 flex min-h-[77px] items-start whitespace-pre-line text-[12px] font-medium leading-[1.6] text-white/70">
                {opt.desc}
              </span>
            </span>

            {premium && (
              <span
                className="absolute right-2.5 z-10 rounded-full bg-[#C9A227] px-2.5 py-1 text-[10px] font-bold tracking-wide text-white shadow-[0_2px_12px_rgba(201,162,39,0.55)]"
                style={{ top: 'calc(14px + env(safe-area-inset-top))' }}
              >
                추천
              </span>
            )}

            {/* 딤드 — 고르지 않은 쪽 (체크 표시 없이 이걸로 구분) */}
            <span
              className={`pointer-events-none absolute inset-0 z-20 bg-black transition-opacity duration-300 ${
                dimmed ? 'opacity-60' : 'opacity-0'
              }`}
            />
          </button>
        );
      })}

      {/* 뒤로가기 */}
      <button
        type="button"
        onClick={onBack}
        aria-label="뒤로 가기"
        className="absolute left-2 z-30 flex h-10 w-10 items-center justify-center rounded-full text-[#5A6472] active:bg-black/10"
        style={{ top: 'calc(8px + env(safe-area-inset-top))' }}
      >
        <ChevronLeft size={24} strokeWidth={2.2} />
      </button>

      {/* 하단 확정 버튼 */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 px-5 pt-10 transition-all duration-300 ${
          picked ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
        }`}
        style={{
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
          background: 'linear-gradient(to top, rgba(0,0,0,0.95) 45%, rgba(0,0,0,0))',
        }}
      >
        <button
          type="button"
          onClick={confirm}
          disabled={!picked || going}
          className="h-[56px] w-full rounded-[16px] bg-white text-[17px] font-bold text-[#111] transition active:scale-[0.98] disabled:opacity-70"
        >
          {going ? '잠시만요...' : `${picked ? picked.replace(' 사회자', '') : ''} 선택하기`}
        </button>
      </div>

      <style jsx global>{`
        .wmc-gold-text {
          background: linear-gradient(180deg, #F9E7B4 0%, #E3C169 45%, #C9A227 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .wmc-silver-text {
          background: linear-gradient(180deg, #FFFFFF 0%, #DCE3EB 45%, #A9B4C2 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .wmc-gold-glow {
          background:
            radial-gradient(120% 45% at 50% 0%, rgba(201, 162, 39, 0.32), transparent 70%),
            radial-gradient(90% 40% at 50% 100%, rgba(201, 162, 39, 0.20), transparent 70%);
        }
        .wmc-gold-dot {
          position: absolute;
          bottom: -12px;
          border-radius: 9999px;
          background: radial-gradient(circle, #FFF6DA 0%, #EBCB78 45%, rgba(201, 162, 39, 0) 75%);
          box-shadow: 0 0 10px rgba(240, 214, 140, 0.95), 0 0 22px rgba(201, 162, 39, 0.5);
          animation-name: wmcGoldRise;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform, opacity;
        }
        @keyframes wmcGoldRise {
          0%   { transform: translate3d(0, 0, 0) scale(0.7); opacity: 0; }
          12%  { opacity: 1; }
          50%  { transform: translate3d(10px, -46vh, 0) scale(1); }
          88%  { opacity: 1; }
          100% { transform: translate3d(-8px, -96vh, 0) scale(0.75); opacity: 0; }
        }
        /* 신비로운 은빛 파동 — 사선 그라데이션이 천천히 흐른다 */
        .wmc-silver-wave {
          background: linear-gradient(
            115deg,
            transparent 0%,
            rgba(255, 255, 255, 0) 32%,
            rgba(255, 255, 255, 0.85) 46%,
            rgba(196, 214, 236, 0.55) 52%,
            rgba(255, 255, 255, 0) 68%,
            transparent 100%
          );
          background-size: 260% 260%;
          animation: wmcSilverFlow 7.5s ease-in-out infinite;
          mix-blend-mode: screen;
          opacity: 0.75;
          will-change: background-position;
        }
        .wmc-silver-wave-2 {
          animation-duration: 11s;
          animation-delay: 2.4s;
          opacity: 0.45;
          filter: blur(6px);
        }
        @keyframes wmcSilverFlow {
          0%   { background-position: 120% 0%; }
          100% { background-position: -60% 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .wmc-gold-dot { animation: none; opacity: 0.35 !important; }
          .wmc-silver-wave { animation: none; opacity: 0.3; }
        }
      `}</style>
    </div>
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
  onResolved: (roomId?: string) => void;
  onStop: () => void;
}) {
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [hasReply, setHasReply] = useState(false);
  const [showProSheet, setShowProSheet] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const [centerIdx, setCenterIdx] = useState(0);
  const [proImages, setProImages] = useState<string[]>(FALLBACK_PRO_IMAGES);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const router = useRouter();
  const resolvedRoomIdRef = useRef<string | null>(null);
  const onResolvedRef = useRef(onResolved);
  useEffect(() => { onResolvedRef.current = onResolved; }, [onResolved]);
  const onStopRef = useRef(onStop);
  useEffect(() => { onStopRef.current = onStop; }, [onStop]);
  const [timedOut, setTimedOut] = useState(false);

  /* ── 매칭 3분 초과 시 자동 종료 ── */
  useEffect(() => {
    if (hasReply) return;
    const t = setTimeout(() => setTimedOut(true), 180000);
    return () => clearTimeout(t);
  }, [hasReply]);

  /* ── 타임아웃 안내 후 5초 뒤 자동으로 폼으로 복귀 ── */
  useEffect(() => {
    if (!timedOut) return;
    const t = setTimeout(() => onStopRef.current(), 5000);
    return () => clearTimeout(t);
  }, [timedOut]);

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
          if (chatRooms.length > 0 && chatRooms[0]?.id) {
            resolvedRoomIdRef.current = chatRooms[0].id;
          }
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

  /* ── 채팅 연결(방 생성) 감지 시 해당 채팅방으로 이동 ── */
  useEffect(() => {
    if (!hasReply) return;
    const t = setTimeout(() => onResolvedRef.current(resolvedRoomIdRef.current || undefined), 1200);
    return () => clearTimeout(t);
  }, [hasReply]);

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

      {/* 매칭 3분 초과 — 자동 종료 안내 */}
      {timedOut && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center px-8"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => onStopRef.current()}
        >
          <div
            className="w-full max-w-[320px] rounded-2xl bg-white p-6 text-center shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[17px] font-bold text-[#191F28]">매칭 시간이 초과되었어요</p>
            <p className="mt-2 text-[14px] leading-[1.5] text-[#8B95A1]">3분 안에 연결되지 않아 매칭을 자동 종료했어요. 등록하신 연락처로 사회자가 곧 연락드릴 수 있어요.</p>
            <button
              type="button"
              onClick={() => onStopRef.current()}
              className="mt-5 w-full rounded-xl bg-[#2272EB] py-3 text-[15px] font-semibold text-white active:bg-[#1b5fd0]"
            >
              확인
            </button>
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

        {/* 큐피드 눈빛 — 프리티풀 오리지널 미니게임 (기다리는 동안) */}
        <GazeGame />
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
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          22% { opacity: 0.5; }
          100% { transform: translate(-50%, -50%) scale(2.6); opacity: 0; }
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
          width: 220px;
          height: 220px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(34, 114, 235, 0.30) 0%, rgba(34, 114, 235, 0.14) 52%, rgba(34, 114, 235, 0) 74%);
          filter: blur(9px);
          animation: wmcRipple 4.2s cubic-bezier(0.16, 0.6, 0.3, 1) infinite;
          will-change: transform, opacity;
          pointer-events: none;
        }
        .wmc-ripple-2 { animation-delay: 1.4s; }
        .wmc-ripple-3 { animation-delay: 2.8s; }
        @media (prefers-reduced-motion: reduce) {
          .wmc-ripple { animation-duration: 6s; }
        }
      `}</style>
    </div>
  );
}
