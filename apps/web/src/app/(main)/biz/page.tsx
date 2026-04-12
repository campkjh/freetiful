'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ChevronRight, ChevronDown, ChevronLeft, Shield, BarChart3, Users, Building2,
  CheckCircle, Award, Download, MapPin, Phone, Mail,
  Clock, FileText, Send, User, Briefcase, Globe,
  Target, Heart, Star, Zap, X, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ─── Kakao Map ──────────────────────────────────────────── */
declare global { interface Window { kakao?: any; } }

function BizKakaoMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const initMap = () => {
      if (!window.kakao?.maps || !mapRef.current) return;
      window.kakao.maps.load(() => {
        const map = new window.kakao.maps.Map(mapRef.current, {
          center: new window.kakao.maps.LatLng(37.5715, 126.9918), // 종로3가 근처
          level: 3,
        });
        // 주소로 검색
        const ps = new window.kakao.maps.services.Places();
        ps.keywordSearch(COMPANY_INFO.address.split(' ').slice(0, 3).join(' '), (data: any[], status: string) => {
          if (status === window.kakao.maps.services.Status.OK && data[0]) {
            const pos = new window.kakao.maps.LatLng(data[0].y, data[0].x);
            map.setCenter(pos);
            new window.kakao.maps.Marker({ map, position: pos });
          }
        });
      });
    };
    const existing = document.querySelector('script[src*="dapi.kakao.com/v2/maps"]');
    if (existing) { if (window.kakao?.maps) initMap(); else existing.addEventListener('load', initMap); }
    else {
      const s = document.createElement('script');
      s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=dca1b472188890116c81a55eff590885&libraries=services&autoload=false';
      s.async = true;
      s.onload = initMap;
      document.head.appendChild(s);
    }
  }, []);
  return <div ref={mapRef} className="w-full h-full" />;
}

/* ─── Scroll-Reveal ───────────────────────────────────────── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.15 },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'translate-y-0 opacity-100 blur-0' : 'translate-y-10 opacity-0 blur-[4px]'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── CountUp ─────────────────────────────────────────────── */
function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const { ref, visible } = useReveal();
  useEffect(() => {
    if (!visible) return;
    const dur = 1500;
    const st = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - st) / dur);
      setVal(Math.round(target * p));
      if (p < 1) requestAnimationFrame(tick);
    };
    tick();
  }, [visible, target]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

/* ─── Freetiful Symbol (bounce on reveal) ────────────────── */
function FreetifulSymbol({ visible }: { visible: boolean }) {
  return (
    <div className="flex items-center justify-center">
      <svg width="30" height="60" viewBox="0 0 30 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[14px] h-[28px]">
        <path d="M12.9337 43.4863C12.8426 43.6767 12.889 43.8822 12.889 44.0794C12.889 47.6437 12.889 51.208 12.889 54.7724C12.8932 55.6676 12.6726 56.5493 12.2478 57.3353C11.7305 58.2858 10.9282 59.0469 9.95574 59.5094C8.98329 59.972 7.89063 60.1124 6.83425 59.9104C5.77787 59.7084 4.81197 59.1745 4.0749 58.3851C3.33783 57.5957 2.8674 56.5913 2.73101 55.5159C2.7001 55.2586 2.68406 54.9997 2.68296 54.7406C2.68296 46.3683 2.65811 37.9961 2.69124 29.6238C2.7045 25.8579 4.10783 22.6483 6.80846 20.0386C8.34268 18.5566 10.1403 17.4856 12.097 16.6703C14.0601 15.8717 16.1118 15.3157 18.2074 15.0146C20.2102 14.7234 22.2313 14.5788 24.2548 14.5818C25.5738 14.5926 26.8372 15.1184 27.7797 16.0489C28.7223 16.9793 29.2705 18.2418 29.3094 19.5713C29.3482 20.9008 28.8745 22.1937 27.9879 23.1785C27.1013 24.1632 25.8707 24.7631 24.5547 24.8521C24.0047 24.8822 23.4529 24.8822 22.8979 24.9022C21.0211 24.9452 19.1564 25.2167 17.3442 25.7109C16.5807 25.9216 15.8415 26.2134 15.139 26.5813C14.7643 26.7801 14.4097 27.0151 14.0803 27.2831C13.3065 27.913 12.8642 28.7133 12.8708 29.7341C12.8664 30.0131 12.8797 30.2922 12.9105 30.5695C13.0119 31.3128 13.3912 31.9888 13.9709 32.4591C14.6571 33.0231 15.4447 33.4486 16.2905 33.7122C17.566 34.1408 18.9025 34.3564 20.247 34.3505C20.5038 34.3505 20.7606 34.312 21.0174 34.2953C23.2259 34.1416 24.9606 34.9803 26.0475 36.9335C26.4315 37.6247 26.6512 38.3963 26.6894 39.1877C26.7276 39.979 26.5833 40.7685 26.2678 41.4941C25.9522 42.2197 25.4741 42.8616 24.871 43.3693C24.2679 43.877 23.5562 44.2368 22.7919 44.4202C22.3078 44.5319 21.8137 44.594 21.3173 44.6057C20.1015 44.6671 18.8829 44.6335 17.6723 44.5054C16.2108 44.3385 14.7684 44.032 13.3645 43.5899C13.2292 43.5268 13.0827 43.4916 12.9337 43.4863Z" fill="#0C7BFF"/>
        <path
          d="M6.87733 14.0793C3.28202 14.1445 -0.00181093 11.1287 0.00315955 7.14728C-0.0247608 6.21861 0.132599 5.29373 0.4659 4.42755C0.799201 3.56137 1.30165 2.77154 1.94343 2.10492C2.58522 1.43829 3.35325 0.908469 4.20196 0.546887C5.05068 0.185304 5.96277 -0.000669829 6.88412 1.81273e-06C7.80546 0.000673454 8.71729 0.187975 9.56548 0.550795C10.4137 0.913615 11.181 1.44456 11.8218 2.11211C12.4626 2.77967 12.9639 3.57024 13.296 4.43691C13.628 5.30357 13.7841 6.22867 13.7548 7.15731C13.7532 11.1338 10.4975 14.1478 6.87733 14.0793Z"
          fill="#66DEFF"
          className={`origin-center transition-all duration-700 ${visible ? 'animate-[dotBounce_0.8s_ease-out]' : 'opacity-0'}`}
        />
      </svg>
    </div>
  );
}

/* ─── Constants ───────────────────────────────────────────── */
const COMPANY_INFO = {
  name: '프리티풀',
  nameEn: 'Freetiful',
  ceo: '서나웅',
  established: '2024년',
  business: '프리랜서 진행자 매칭 플랫폼',
  experts: '1,000여 명',
  address: '서울특별시 종로구 율곡로 294, 2층(종로6가)',
  phone: '02-765-8882',
  email: 'freetiful2025@gmail.com',
  website: 'https://freetiful.com',
  blog: 'https://blog.naver.com/freetiful2025',
  instagram: 'freetiful_',
  youtube: 'https://www.youtube.com/@freetiful',
  tiktok: 'https://www.tiktok.com/@freetiful',
};

const NAV_SECTIONS = ['회사소개', '핵심서비스', '연혁', '자료실', '오시는길', '문의'];

/* ─── Expert Marquee Images ──────────────────────────────── */
const EXPERT_IMAGES_ROW1 = Array.from({ length: 11 }, (_, i) => `/images/Group ${1707482282 + i}.png`);
const EXPERT_IMAGES_ROW2 = Array.from({ length: 11 }, (_, i) => `/images/Group ${1707482293 + i}.png`);

const INTRO_IMAGES = [
  '/images/소개이미지1.png',
  '/images/소개ios2.png',
  '/images/소개ios3.png',
  '/images/소개ios5.png',
  '/images/소개ios6.png',
  '/images/소개ios7.png',
  '/images/소개ios8.png',
  '/images/소개ios9.png',
];

function AppScreenMarquee({ images, speed = 40 }: { images: string[]; speed?: number }) {
  const doubled = [...images, ...images, ...images];
  return (
    <div className="relative overflow-clip py-6">
      {/* 좌우 그라데이션 페이드 */}
      <div className="absolute left-0 top-0 bottom-0 w-40 bg-gradient-to-r from-gray-50 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-40 bg-gradient-to-l from-gray-50 to-transparent z-10 pointer-events-none" />
      <div
        className="flex items-center gap-6 px-4"
        style={{
          animation: `marquee-left ${speed}s linear infinite`,
          width: 'max-content',
        }}
      >
        {doubled.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className="relative flex-shrink-0"
          >
            <div
              className="rounded-[20px] overflow-hidden shadow-xl border border-gray-200/50 bg-white transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:z-20"
              style={{ width: 200, height: 420 }}
            >
              <Image
                src={src}
                alt="App Screen"
                width={200}
                height={420}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Netflix-style tilted grid row ───────────────────────── */
function TiltedRow({ images, direction = 'left', speed = 35 }: { images: string[]; direction?: 'left' | 'right'; speed?: number }) {
  const tripled = [...images, ...images, ...images];
  return (
    <div
      className="flex gap-4"
      style={{
        animation: `marquee-${direction} ${speed}s linear infinite`,
        width: 'max-content',
      }}
    >
      {tripled.map((src, i) => (
        <div
          key={`${src}-${i}`}
          className="flex-shrink-0 w-[180px] h-[240px] md:w-[220px] md:h-[290px] rounded-xl overflow-hidden"
        >
          <Image
            src={src}
            alt="Expert"
            width={220}
            height={290}
            className="w-full h-full object-cover"
          />
        </div>
      ))}
    </div>
  );
}

const HISTORY = [
  { year: '2026', events: [
    '01월 프리티풀 브랜드 공식 론칭',
    '01월 전문 행사인력 매칭 플랫폼 출시',
    '02월 전문투자기관으로부터 Seed 투자 유치',
    '02월 제휴업체 300여 곳과 전략적 파트너십 체결',
    '03월 벤처기업 인증 획득',
    '03월 프리티풀 정식 서비스 운영 개시',
  ]},
  { year: '2025', events: ['12월 주식회사 커넥트풀 설립'] },
];

/* ─── Page ─────────────────────────────────────────────────── */
export default function BizPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('회사소개');
  const [inquiry, setInquiry] = useState({ company: '', name: '', phone: '', email: '', type: '', message: '' });
  const [sending, setSending] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [bizNavExpanding, setBizNavExpanding] = useState(false);
  const [bizNavCollapsing, setBizNavCollapsing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [receptionFullscreen, setReceptionFullscreen] = useState(false);
  const [receptionExiting, setReceptionExiting] = useState(false);
  const receptionRef = useRef<HTMLElement>(null);
  const receptionVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  // 스크롤 위치에 따라 activeSection 자동 업데이트
  useEffect(() => {
    const sectionIds = ['회사소개', '핵심서비스', '연혁', '자료실', '오시는길', '문의폼'];
    const ob = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id === '문의폼' ? '문의' : entry.target.id);
          }
        });
      },
      { threshold: 0.3 },
    );
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) ob.observe(el);
    });
    return () => ob.disconnect();
  }, []);

  // 송년회 섹션 진입 감지 → 풀스크린 + 영상 자동재생
  useEffect(() => {
    const el = receptionRef.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !sessionStorage.getItem('biz-overlay-shown')) {
          sessionStorage.setItem('biz-overlay-shown', '1');
          setReceptionFullscreen(true);
          setReceptionExiting(false);
          setTimeout(() => {
            receptionVideoRef.current?.play().catch(() => {});
          }, 300);
        }
      },
      { threshold: 0.15 },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  // 풀스크린 상태에서 스크롤 → 해제
  useEffect(() => {
    if (!receptionFullscreen || receptionExiting) return;
    let touchStartY = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY > 30) {
        setReceptionExiting(true);
        setTimeout(() => setReceptionFullscreen(false), 500);
      }
    };
    const onTouchStart = (e: TouchEvent) => { touchStartY = e.touches[0].clientY; };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartY - e.changedTouches[0].clientY > 50) {
        setReceptionExiting(true);
        setTimeout(() => setReceptionFullscreen(false), 500);
      }
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [receptionFullscreen, receptionExiting]);

  // 풀스크린 시 body 스크롤 잠금
  useEffect(() => {
    if (receptionFullscreen && !receptionExiting) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [receptionFullscreen, receptionExiting]);

  // 플랫폼에서 비즈로 왔을 때 펼쳐지는 애니메이션
  useEffect(() => {
    const from = sessionStorage.getItem('nav-transition');
    if (from === 'from-platform') {
      setBizNavExpanding(true);
      sessionStorage.removeItem('nav-transition');
      const t = setTimeout(() => setBizNavExpanding(false), 600);
      return () => clearTimeout(t);
    }
  }, []);

  function scrollTo(id: string) {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleInquiry(e: React.FormEvent) {
    e.preventDefault();
    if (!inquiry.name || !inquiry.phone || !inquiry.message) {
      toast.error('필수 항목을 입력해주세요');
      return;
    }
    setSending(true);
    await new Promise((r) => setTimeout(r, 1000));
    toast.success('문의가 접수되었습니다. 1~2영업일 내 연락드리겠습니다.');
    setInquiry({ company: '', name: '', phone: '', email: '', type: '', message: '' });
    setSending(false);
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">

      {/* ─── Floating Header ─────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex justify-center transition-all duration-700 ease-out"
        style={{
          padding: scrollY > 80 ? '12px 16px 0' : '0',
          transform: receptionFullscreen ? 'translateY(-100%)' : 'translateY(0)',
          opacity: receptionFullscreen ? 0 : 1,
        }}
      >
        <div
          className={`flex items-center justify-between transition-all duration-700 ease-out ${
            scrollY > 80
              ? 'max-w-[720px] w-full h-[52px] px-4 bg-white/80 backdrop-blur-2xl shadow-lg border border-gray-200/60 rounded-full'
              : 'max-w-[1200px] w-full h-[60px] px-6 bg-transparent'
          }`}
        >
          <Link href="/biz" className="transition-all duration-700">
            <Image
              src="/images/logo-prettyful.svg"
              alt="Freetiful"
              width={scrollY > 80 ? 100 : 120}
              height={scrollY > 80 ? 30 : 35}
              className="transition-all duration-700"
              style={{ width: scrollY > 80 ? 100 : 120, height: 'auto' }}
            />
          </Link>

          <nav className={`hidden items-center gap-0.5 md:flex transition-all duration-700 ${scrollY > 80 ? 'gap-0' : 'gap-1'}`}>
            {NAV_SECTIONS.map((n) => (
              <button
                key={n}
                onClick={() => scrollTo(n)}
                className={`font-medium rounded-full transition-all ${
                  scrollY > 80 ? 'text-[11px] px-2.5 py-1.5' : 'text-[13px] px-4 py-2'
                } ${
                  activeSection === n
                    ? 'bg-gray-900/5 text-gray-900'
                    : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                {n}
              </button>
            ))}
          </nav>

          {/* 햄버거 메뉴 버튼 */}
          <button
            className="flex flex-col items-center justify-center gap-[5px] w-9 h-9"
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className="block w-5 h-[2px] rounded-full bg-gray-900 transition-all duration-300" />
            <span className="block w-5 h-[2px] rounded-full bg-gray-900 transition-all duration-300" />
            <span className="block w-3.5 h-[2px] rounded-full bg-gray-900 transition-all duration-300" />
          </button>

        </div>
      </header>

      {/* ═══ 모바일 메뉴 패널 ═══════════════════════════════════ */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60]">
          {/* 배경 오버레이 */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            style={{ animation: 'menuOverlayIn 0.3s ease-out' }}
          />
          {/* 슬라이드 패널 */}
          <div
            className="absolute top-0 right-0 w-[280px] h-full bg-white shadow-2xl flex flex-col"
            style={{ animation: 'menuSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            {/* 닫기 버튼 */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <span className="text-[14px] font-bold text-gray-900">메뉴</span>
              <button onClick={() => setMobileMenuOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="h-px bg-gray-100 mx-6" />
            {/* 메뉴 항목 */}
            <div className="flex-1 px-6 py-4 flex flex-col gap-1">
              {[
                { label: 'CEO 인사말', href: '/biz/ceo' },
                { label: '연혁', href: '/biz/history' },
                { label: '인재채용', href: '/careers' },
                { label: '주요소식', action: () => { scrollTo('자료실'); setMobileMenuOpen(false); } },
                { label: '자주묻는질문', href: '/biz/faq' },
                { label: '고객사', href: '/biz/clients' },
              ].map((item) =>
                item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center justify-between py-3.5 px-2 rounded-xl text-[15px] font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    onClick={item.action}
                    className="flex items-center justify-between py-3.5 px-2 rounded-xl text-[15px] font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                  >
                    {item.label}
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </button>
                )
              )}
            </div>
            {/* 하단 문의 버튼 */}
            <div className="px-6 pb-8">
              <button
                onClick={() => { scrollTo('문의폼'); setMobileMenuOpen(false); }}
                className="w-full py-3 bg-gray-900 text-white text-[14px] font-bold rounded-full active:scale-95 transition-transform"
              >
                문의하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Hero (Netflix-style tilted grid) ═══════════════════ */}
      <section className="relative flex min-h-screen items-center justify-center pt-[60px] overflow-hidden">
        {/* 기울어진 전문가 그리드 배경 */}
        <div
          className="absolute inset-0 flex flex-col gap-4 justify-center"
          style={{
            transform: 'rotate(-12deg) scale(1.4)',
            transformOrigin: 'center center',
          }}
        >
          <TiltedRow images={EXPERT_IMAGES_ROW1} direction="left" speed={80} />
          <TiltedRow images={EXPERT_IMAGES_ROW2} direction="right" speed={90} />
          <TiltedRow images={[...EXPERT_IMAGES_ROW1].reverse()} direction="left" speed={85} />
          <TiltedRow images={[...EXPERT_IMAGES_ROW2].reverse()} direction="right" speed={95} />
          <TiltedRow images={EXPERT_IMAGES_ROW1} direction="left" speed={88} />
        </div>

        {/* 화이트 오버레이 */}
        <div className="absolute inset-0 bg-white/75" />
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white/60 to-white" />

        {/* 콘텐츠 */}
        <div className="relative z-10 text-center px-6">
          <Reveal>
            <p className="mb-5 text-[11px] font-bold tracking-[0.4em] text-gray-400">FREELANCER MC MATCHING PLATFORM</p>
          </Reveal>
          <Reveal delay={200}>
            <h1 className="text-[40px] font-black leading-[1.1] tracking-tight md:text-[72px]">
              <span className="text-gray-900">소중한 시간을</span><br />
              <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">아름다운 순간으로</span>
            </h1>
          </Reveal>
          <Reveal delay={400}>
            <p className="mx-auto mt-6 max-w-[520px] text-[15px] leading-relaxed text-gray-500">
              KBS · SBS · MBC 방송사 출신 검증된 아나운서, MC, 쇼호스트<br />
              전국 1,000여 명의 전문 진행자와 맞춤 매칭합니다.
            </p>
          </Reveal>
          <Reveal delay={600}>
            <div className="mt-10 flex justify-center gap-3">
              <button onClick={() => scrollTo('문의')} className="bg-gray-900 px-8 py-3.5 text-[14px] font-bold text-white rounded-full transition-all hover:bg-gray-800 active:scale-95">
                기업 문의하기
              </button>
              <button onClick={() => scrollTo('핵심서비스')} className="border border-gray-200 bg-white/80 backdrop-blur px-8 py-3.5 text-[14px] font-bold text-gray-500 rounded-full transition-all hover:border-gray-300 hover:text-gray-800 hover:bg-white">
                서비스 알아보기
              </button>
            </div>
          </Reveal>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce z-10">
          <ChevronDown className="h-5 w-5 text-gray-300" />
        </div>
      </section>

      {/* Marquee keyframes */}
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        @keyframes dotBounce {
          0% { transform: translateY(-40px); opacity: 0; }
          40% { transform: translateY(4px); opacity: 1; }
          60% { transform: translateY(-8px); }
          75% { transform: translateY(2px); }
          90% { transform: translateY(-3px); }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes ripple1 {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes ripple2 {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes ripple3 {
          0% { transform: scale(1); opacity: 0.3; }
          100% { transform: scale(2.0); opacity: 0; }
        }
      `}} />

      {/* ═══ 모바일 사이드 섹션 인디케이터 ═══════════════════════ */}
      <div
        className="md:hidden fixed right-3 top-1/2 -translate-y-1/2 z-40 flex flex-col items-end gap-3 transition-opacity duration-700"
        style={{ opacity: receptionFullscreen ? 0 : 1, pointerEvents: receptionFullscreen ? 'none' : 'auto' }}
      >
        {NAV_SECTIONS.map((name) => {
          const isActive = activeSection === name;
          return (
            <button
              key={name}
              onClick={() => scrollTo(name === '문의' ? '문의폼' : name)}
              className="flex items-center gap-2 transition-all duration-300"
            >
              {isActive && (
                <span className="text-[10px] font-bold text-gray-700 bg-white/90 backdrop-blur-sm shadow-sm rounded-full px-2 py-0.5 border border-gray-100">
                  {name}
                </span>
              )}
              <span
                className={`block rounded-full transition-all duration-300 ${
                  isActive
                    ? 'w-[6px] h-[18px] bg-gray-900'
                    : 'w-[5px] h-[5px] bg-gray-300'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* ═══ 회사소개 ═══════════════════════════════════════════ */}
      <section id="회사소개" className="py-28">
        <div className="mx-auto max-w-[1100px] px-6">
          <Reveal><p className="text-[11px] font-bold tracking-[0.4em] text-blue-500">ABOUT US</p></Reveal>
          <Reveal delay={100}>
            <h2 className="mt-3 text-[34px] font-black tracking-tight md:text-[42px]">
              프리티풀을<br />소개합니다
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-6 max-w-[680px] text-[15px] leading-[1.9] text-gray-400">
              프리랜서 진행자 전문 매칭플랫폼 프리티풀입니다.
              프리티풀은 <strong className="text-gray-600">Freelancer, Beautiful, 그리고 Pool</strong>이라는 세 단어에서 유래된 이름처럼,
              여러분의 소중한 시간을 아름다운 순간으로 만들어드리는 프리랜서 진행자들이 모여 있는 플랫폼입니다.
            </p>
            <p className="mt-4 max-w-[680px] text-[15px] leading-[1.9] text-gray-400">
              결혼식·돌잔치 등의 가족행사부터 기업행사·국제행사, 체육대회·레크리에이션 진행까지
              전국 <strong className="text-gray-600">1,000여 명의 아나운서, MC, 쇼호스트</strong>들과 함께하고 있습니다.
              KBS, SBS, MBC 지상파 3사를 포함하여 각 방송사 출신의 검증된 사회자만을 고객과 연결합니다.
            </p>
          </Reveal>

          {/* 핵심 수치 */}
          <div className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { num: 1000, suffix: '+', label: '검증된 진행자', icon: <Users className="h-4 w-4" /> },
              { num: 13000, suffix: '+', label: '결혼식 사회 경력', icon: <Star className="h-4 w-4" /> },
              { num: 8, suffix: '개', label: '서비스 분야', icon: <Briefcase className="h-4 w-4" /> },
              { num: 3, suffix: '사', label: '지상파 방송사 출신', icon: <Zap className="h-4 w-4" /> },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="border border-gray-100 rounded-2xl bg-white p-5 transition-all hover:border-gray-200 hover:shadow-sm">
                  <div className="flex items-center gap-2 text-gray-300 mb-3">{s.icon}<span className="text-[10px] tracking-wider font-medium">{s.label}</span></div>
                  <p className="text-[28px] font-black text-gray-900">
                    <CountUp target={s.num} suffix={s.suffix} />
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* 프리티풀 전문가들과 함께한 기업 */}
          <Reveal delay={100}>
            <div className="mt-20">
              <p className="text-[11px] font-bold tracking-[0.4em] text-blue-500">OUR PARTNERS</p>
              <h3 className="mt-3 text-[28px] font-bold tracking-tight">프리티풀 전문가들과<br />함께한 기업</h3>
            </div>
          </Reveal>
          <div className="mt-10 space-y-3 overflow-hidden -mx-6">
            {[0,1,2,3,4,5].map((row) => {
              const allLogos = [
                '/images/기업로고/ARxaH4OpVaUc1UjpOv2UhQ8hgPGt-JH64gkcWcIAGz4XfVyiy1LAog-99r2v_a3zax4EEZzaMKE5l2tFcQ7i7A.svg',
                '/images/기업로고/BRqtD2yZxxRP08TEpNXXNlHvXxtA9Dck7kO4rNAiyud7WyX1EudEU0Y7XpRaIi0eGipOIqU1iZRx06TjD87Bu_8PuSHC-vYi2expOi_ie9INQgZ_8lkfsq7WCiYGssRZvARyM-hmOKkZEOhr4vxl6Q.svg',
                '/images/기업로고/BzBaSlPhUQvUgTbep2YBg19b6coNL8iXPJp-BBD6f4z-rfsdylm8zOJnrkRmUWdJoQgJIDNuh7LnNaUeJ_B8Q32S11shONnXjdlQTFLz_5LSzLoW5D7pmuYXc99y6tWUOByfVz00-KNaJ9YAXRk2Eg.svg',
                '/images/기업로고/CTCL5r-2Lrik1gBj6n7B0qyIP13vlZUsO_9YpcjuK8Hr8gUiNH33HhuUpwYDmywHYEBZencD5-2p_cJIfunWiqJXR16H5tsIW3hL6qiUK4o3afLmSrpCAf85-c-TDMmsTZRiKr9kWrRUGmMuKFNXlQ.svg',
                '/images/기업로고/D8d0CAJYg56wMGb2nqUnU5thBBSBSisClhYH5WA_KfgBzdgzgn4Tb-Wd8VtH17Nsal4NkSk9XZ2SwUgLUuhVVg.svg',
                '/images/기업로고/EL-GmGKqmm_1_UI1I1HmCwdRis9GIdUfq0tBhZlKnvvB51kv2Wn0hFOfrApbJwh68wKSsYejtF7VN4Htuk2beb2mBOKIBpIM7NphrfKxnZWtfymCW5185hIVDb5q1_GmhJPNTV4GXIWat2Uw7SUHcw.svg',
                '/images/기업로고/FIN9iKw1Cdlcw0qdsLudvODTjrdndKbpbhu2rrzXy_MHd5LgMZBsbXaErtn_kNzWxM6iTiR7rJlKDcOV0TJ5UO7kwpWLap2PqskFK8q7Lb4kbHzAlpLii3vrpXzQbKneH9d2GEmKXMNl6VrkeepcXQ.svg',
                '/images/기업로고/Fbc3OBO5lnF_aljwIte4mbdQIFVsutSyv5oZ3_JZ5vZ5_Ez_Se0pe47JqRTjOZBqtlFGxYQXYzlG820nGt_M4of6r_OTf2hzjBGAa4UbekunDcLTFOXnG8Moc_cIMDhrABFn_g42rUoQk6FTMBErqg.svg',
                '/images/기업로고/Fbe6yAmPhTGyBpbFnJrzWROlvct5aNx2TBIUKqyiunO_iZdfvBKbFzh7FVPmqRQpeRfEKA-pz-QeTLTsfVj7NxKMy8mEN8NUKbf9r0p4VlGyHGibJqXQKEBS-4NE0QWMgj4CvofMTvCYXMovp3WWNg.svg',
                '/images/기업로고/GwHvDSCNafSHnRiZNqDMJOvThTG4_8QJgEFMZC3jlpTg_e_IMR2WWQcB4W641zxOwU219ER8opVMfaK8uhdrl-F69hJn02bChdq-cAheQjLEjDthTLEr4gaXwc4V8ZDNYdfj319zkwONKucgD_G05w.svg',
                '/images/기업로고/Kl7O19oIwFHCfL2QV05oLVVoL684vmbcbpFHyQCiQRiYr7Dgb18bXQM9qY__l0rm0dlPJKRTqAcwaqRcmvg_m0mVOvVfkrcdjER-1QOvtudPOP8len_6uFgfriIGYpYVBjmCyJ0RAHKe7JjZ1soeWw.svg',
                '/images/기업로고/N_7oK9jBqgd4o6MM1imyAIM0lZK2Rsr_oc9HDG8WRllhnrld37ChFRXkVZA5aMK-PSrkr9Y9LBrKuF0mQCMGP09WApahFXbjqTh-Rpw7fYqHkc2f7CKt7xCTc2OG0y1e1LPxvAqnwH4XOpxyWIyMMg.svg',
                '/images/기업로고/PV5QhQJrjCNrlEkK4HE-Myx-FNqaklavtwzZAzm_tVkUiX5U0kp-Ujm4vqKipQmsZj86CgDo_HVBtEEFgMCWIyrR7zWurNboYJJdW60duDKqWBF0ci_KpyXJ2-goGoXSB2_RmNotjMlducSl0kt_aA.svg',
                '/images/기업로고/Qqb24ODKcfgDz0dpJRti2CqDr9MThAod9YacFPOKifdbjvhBkviT1LgksZ5bxp92WDj3AsUa0h214Ln6fv3ejj1UxiP4hJfpPfq_u5Ae217Thzzkv3FqP9hDDBDGaNNBHJ1ypWViORlHmkucr_Elng.svg',
                '/images/기업로고/RDynDFYidWJ6Plgi-NOQnlBIMy3xfHiR0zgdLhyrv0PKCdBdstgmskNWU9s6MZ9iKGqbCRe8kK1zELijChT4yyIT285FNArduGoMzOK6nr3Jia0qu7Prqzk2awOznbMlKYQyxTaA_eSLDVRDyQFZpg.svg',
                '/images/기업로고/0kIrqSx6FQ6AZtryR8Rii4lXBGrvITgNfRhhiLfi2aVr-Uqg1l5bOMa4Vi3THlnZYVns6hi5Y75mBhXXS4r6dBfKvn1HPMRq10Gh8NrRBcZE0Pd7zOeDm9WYfDEvAaCZSVD12nCLfeJdkz9WXPnZ3w.svg',
                '/images/기업로고/1GPWKc37T7Qz08E07p9sDg0F4rYPxg_qbmh5CSSxrdDTQoy6hCl6k-UgoySwKANqEm0jCWiZjyMqaLUxX31_3RyRiW1yQ2L5zYtA6WzN7s5Zxy31rQSDGIotP0yP2rU6jhAVfxvxFl__q_NPEuRKAg.svg',
                '/images/기업로고/4nJH1a9BfVA9ilPdwu120VbDd-ERloXHcOus1u88Xhvpql-0zhgPSW9dj3zZKGKlGVEfqJwFPQLWwtXGYmft8KGikSA2N0n3yojcWKfrmKWyZ3dLtYmBFcKkeTn8CDL7HarNcbkEmB8AYP76lHFDTg.svg',
                '/images/기업로고/5bZLn7_cvlKQnqzT0_0hMSHeq0y1K-YgT4X40IT9qxQClHZTU3fHCuuIyI7JSjm7MmtDrWs1KBx7VtHyTk4rrbhhAhWa-EpxfAJwkoVV9vrn7DLNFlXNy6zNfET5B7ohb0ULDDwO99agnC9QOW7lKA.svg',
                '/images/기업로고/7JPcHcbSryZEH9UhI0PnkdfR30SZvvoSyV7ynaBncTLEwBYWfUrG4IdzrpmjvAKS2a06vY7ReLjl6MGktfk6NaRQrN-tHBcs3GbLIDJ4x5s_O4NXZYGeNFUdkjS5iJJidsmP7fXHqWo7RlGL9mbNgg.svg',
                '/images/기업로고/7K5Bmcq7qiQ6Eud7OD2A2hTmRHTxkShb8lmf3EVD4alegph6WnxOEzfOYxM0LDCXkfT_vVZ9_Hjk_XXaRJlTsMPB9epfyN8kUFonEnB4GTiHlonXo_oKqJs4AR9MJhtmsVX8j90IdFvH1Ujko6XLOQ.svg',
                '/images/기업로고/8iC8ebMvPPfZeTUkj9VBmsrPUw4lPJp9ITlR115EWv0ULvgo-S_CtNWa2TNlKwzqNS_KGPNo6xFnF_UxcRLylG-HIYXXoRmhDQUjoZvi8kTTM3-1l5hd558xNYS5PlZxUCI3j1XXJbcotsBxfHIeNQ.svg',
                '/images/기업로고/SRrqBgHlAil9jg2n7I4SZkLRwUcDf3bN51-iBsr1XI6-4a52MvSjP0EHo3CZVsDIXLkpG2FF-yj5P50n6D37IdfQdt-VN7OqAuH4QnmjXnD76Tomw6YDwsCJzUz29pBTReqT3XzKyXDg1V7bUd7ESQ.svg',
                '/images/기업로고/U4btAF6fKzlMyx9V0YciDz02RYAMbqpypTkUZjxYxE2LTOl9GYED7b76bOg8IXDfq16Er1Lc9ugCJpjWkovcWHgVfqHBd_TvxltZBFYmSSV1m8QMnkoIHR6Tywr3rwxBl48dWmnpOcgI9H9TeSFsow.svg',
              ];
              // 각 줄마다 다른 시작 위치 + 방향
              const start = row * 4;
              const rowLogos = [...allLogos.slice(start), ...allLogos.slice(0, start)];
              const repeated = [...rowLogos, ...rowLogos];
              const direction = row % 2 === 0 ? 'normal' : 'reverse';
              const speed = 80 + row * 10;
              return (
                <div key={row} className="flex items-center gap-6" style={{ width: 'max-content', animation: `bizLogoScroll ${speed}s linear infinite ${direction}` }}>
                  {repeated.map((logo, i) => (
                    <div key={i} className="shrink-0 h-[32px] w-[80px] flex items-center justify-center opacity-30 grayscale hover:opacity-80 hover:grayscale-0 transition-all duration-300">
                      <img src={encodeURI(logo)} alt="" className="max-h-full max-w-full object-contain" />
                    </div>
                  ))}
                </div>
              );
            })}
            <style>{`@keyframes bizLogoScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
          </div>

        </div>
      </section>

      {/* ═══ 핵심서비스 섹션 삭제됨 ═══════════════════════════════ */}
      <section id="핵심서비스" className="py-28 bg-gray-50/60">
        <div className="mx-auto max-w-[1100px] px-6">
          {/* CORE SERVICES 타이틀 + 카드 숨김 */}
          <div className="hidden">
          <Reveal><p className="text-[11px] font-bold tracking-[0.4em] text-blue-500">CORE SERVICES</p></Reveal>
          <Reveal delay={100}>
            <h2 className="mt-3 text-[34px] font-black tracking-tight md:text-[42px]">
              마이크가 필요한<br />모든 순간, 프리티풀
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: <Heart className="h-6 w-6" />, title: '결혼식 사회자', desc: 'KBS·SBS·MBC 방송사 출신 아나운서, 결혼식 사회 13,000회 이상 경력의 전문 사회자가 함께합니다.', color: 'bg-rose-50 text-rose-500' },
              { icon: <Building2 className="h-6 w-6" />, title: '공식행사 / 기업행사', desc: '정부기관, 관공서, 대기업 행사 등 공적인 자리에서 격에 맞는 진행으로 행사의 품격을 높여드립니다.', color: 'bg-blue-50 text-blue-500' },
              { icon: <Star className="h-6 w-6" />, title: '방송 / 온라인 콘텐츠', desc: '아나운서, 쇼호스트, 인플루언서가 TV방송, 유튜브 콘텐츠, 라이브커머스에서 활약합니다.', color: 'bg-violet-50 text-violet-500' },
              { icon: <Globe className="h-6 w-6" />, title: '통번역', desc: '국제포럼, 국제스포츠행사 등 글로벌 행사를 위한 통번역 전문가, 언어 전문가가 함께합니다.', color: 'bg-emerald-50 text-emerald-500' },
              { icon: <Users className="h-6 w-6" />, title: '팀빌딩 / 레크리에이션', desc: '전국 상위 1%의 MC들이 모두가 하나 되는 순간, 즐길 수 있는 시간을 만들어 드립니다.', color: 'bg-amber-50 text-amber-500' },
              { icon: <Zap className="h-6 w-6" />, title: '체육대회', desc: '기업·학교 체육대회에서 함께 뛰고 응원하며 즐기는 역동적인 시간을 베테랑 MC가 이끕니다.', color: 'bg-orange-50 text-orange-500' },
              { icon: <Award className="h-6 w-6" />, title: '대학축제 / 지역축제', desc: '수도권 20곳 이상 대학 및 지역축제 진행자가 전국 각지 대규모 축제를 진행합니다.', color: 'bg-pink-50 text-pink-500' },
              { icon: <BarChart3 className="h-6 w-6" />, title: '기업 PT', desc: '전문 프리젠터가 회사 성장을 위한 중요한 자리에서 비전을 담은 PT를 진행합니다.', color: 'bg-cyan-50 text-cyan-500' },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="group bg-white border border-gray-100 rounded-2xl p-6 transition-all duration-300 hover:border-gray-200 hover:shadow-md">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.color} transition-transform duration-300 group-hover:scale-110`}>
                    {item.icon}
                  </div>
                  <h3 className="mt-4 text-[16px] font-bold text-gray-900">{item.title}</h3>
                  <p className="mt-2 text-[12px] leading-[1.8] text-gray-400">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* 일반 플랫폼 vs 프리티풀 비교 */}
          <Reveal delay={100}>
            <h3 className="mt-20 text-[11px] font-bold tracking-[0.4em] text-gray-300">WHY FREETIFUL</h3>
            <p className="mt-3 text-[20px] font-bold text-gray-900">왜 프리티풀이어야만 할까요?</p>
          </Reveal>
          {(() => {
            const compare = useReveal();
            return (
              <div ref={compare.ref} className={`mt-8 transition-all duration-700 ${compare.visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                <div className="border border-gray-100 rounded-2xl overflow-hidden">
                  {/* 헤더: 로고 포함 (h-[48px]) */}
                  <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-100 h-[48px]">
                    <div />
                    <div className="flex items-center justify-center gap-2 border-x border-gray-100">
                      {/* 경쟁사 로고 (은은한 블러) */}
                      <div className="relative w-[48px] h-[28px] filter blur-[2px] opacity-50">
                        <Image src="/images/Group 1707481883.png" alt="" width={48} height={28} className="w-full h-full object-contain" />
                      </div>
                      <span className="text-[12px] font-bold text-gray-400">일반 플랫폼</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      {/* 프리티풀 심볼 (바운스) */}
                      <FreetifulSymbol visible={compare.visible} />
                      <span className="text-[12px] font-bold text-blue-500">프리티풀</span>
                    </div>
                  </div>
                  {[
                    { label: '진행자 등록', general: '누구나 자유롭게 가능', freetiful: '직접 심사·검증을 통한 입점' },
                    { label: '경력 인증', general: '미비 또는 자율 기재', freetiful: '포트폴리오 및 실제 경력 검증 필수' },
                    { label: '품질 보증', general: '무관여 (후기 중심)', freetiful: '진행자 관리 및 사후 피드백 시스템' },
                    { label: '전문성', general: '아마추어/초보자 존재', freetiful: '방송·행사 경력 보유 전문가만 선발' },
                    { label: '위험요소', general: '후기 조작, 무경험자 섭외 가능', freetiful: '검증되지 않은 진행자는 등록 불가' },
                  ].map((row, i) => (
                    <div key={i} className={`grid grid-cols-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                      <div className="p-4 text-[13px] font-semibold text-gray-600">{row.label}</div>
                      <div className="p-4 text-[12px] text-gray-400 text-center border-x border-gray-50">{row.general}</div>
                      <div className="p-4 text-[12px] text-blue-600 font-medium text-center">{row.freetiful}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          </div>{/* hidden 끝 */}

          {/* 홍보 영상 */}
          <div className="mt-16">
            <Reveal delay={100}>
              <p className="text-[11px] font-bold tracking-[0.4em] text-gray-300 text-center">PROMOTION VIDEO</p>
              <p className="mt-2 mb-8 text-[20px] font-bold text-gray-900 text-center">프리티풀을 영상으로 만나보세요</p>
            </Reveal>

            <div className="space-y-6">
              {/* 영상 1 — 플랫폼 */}
              <Reveal delay={200}>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                  <video className="w-full aspect-video bg-black" controls playsInline preload="none" muted poster="">
                    <source src="/images/KakaoTalk_Video_2026-04-08-23-05-28.mp4" type="video/mp4" />
                  </video>
                  <div className="p-4">
                    <span className="inline-block px-2.5 py-1 text-[10px] font-bold tracking-wider text-violet-500 bg-violet-50 rounded-full mb-2">PLATFORM</span>
                    <h4 className="text-[16px] font-bold text-gray-900">프리티풀 플랫폼 소개</h4>
                    <p className="mt-1 text-[13px] text-gray-400 leading-relaxed">KBS·SBS·MBC 방송사 출신 검증된 진행자, 전국 1,000여 명과 함께하는 매칭 플랫폼</p>
                  </div>
                </div>
              </Reveal>

              {/* 영상 2 — 어플리케이션 */}
              <Reveal delay={300}>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                  <video className="w-full aspect-video bg-black" controls playsInline preload="none" muted poster="">
                    <source src="/images/KakaoTalk_Video_2026-04-08-23-05-41.mp4" type="video/mp4" />
                  </video>
                  <div className="p-4">
                    <span className="inline-block px-2.5 py-1 text-[10px] font-bold tracking-wider text-[#3180F7] bg-blue-50 rounded-full mb-2">APPLICATION</span>
                    <h4 className="text-[16px] font-bold text-gray-900">프리티풀 어플리케이션 소개</h4>
                    <p className="mt-1 text-[13px] text-gray-400 leading-relaxed">검증된 사회자를 직관적으로 비교하고, 실시간 소통으로 간편하게 매칭하세요</p>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>

          {/* 서비스 소개 스크린 */}
          <Reveal delay={100}>
            <h3 className="mt-24 text-[11px] font-bold tracking-[0.4em] text-gray-300">APP SCREENS</h3>
            <p className="mt-2 mb-8 text-[20px] font-bold text-gray-900">직관적인 앱으로 간편하게</p>
          </Reveal>
        </div>
        <Reveal delay={200}>
          <AppScreenMarquee images={INTRO_IMAGES} speed={90} />
        </Reveal>
      </section>

      {/* ═══ 2025 송년회 RECEPTION ═════════════════════════════ */}
      <section ref={receptionRef} className="relative overflow-hidden bg-[#0a0a0a] text-white">
        {/* 배경 이미지 (옅게) */}
        <div className="absolute inset-0">
          <Image src="/images/IMG_8838 1.png" alt="" fill className="object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-[#0a0a0a]/40 to-[#0a0a0a]" />
        </div>

        <div className="relative z-10 mx-auto max-w-[1100px] px-6 py-32">
          <div className="flex flex-col items-center gap-10">
            <Reveal>
              <Image src="/images/Frame 1707488417.svg" alt="2025 Year-End Reception" width={272} height={161} className="w-[300px] md:w-[400px] brightness-0 invert opacity-90" />
            </Reveal>
            <Reveal delay={300}>
              <Image src="/images/Group 1707482062.svg" alt="Freetiful" width={176} height={30} className="w-[160px] md:w-[200px] brightness-0 invert opacity-50" />
            </Reveal>
          </div>
          <Reveal delay={300}>
            <div className="mt-16 rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(255,255,255,0.05)] border border-white/10 bg-black">
              <video className="w-full aspect-video" controls playsInline preload="none">
                <source src="/images/KakaoTalk_Video_2026-04-08-21-53-11-1.mp4" type="video/mp4" />
              </video>
            </div>
          </Reveal>
          <div className="mt-16 flex items-center gap-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-white/10" />
            <span className="text-[10px] tracking-[0.5em] text-white/20 font-medium">FREETIFUL 2025</span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-white/10" />
          </div>
        </div>

      </section>

      {/* ═══ 모바일 송년회 풀스크린 오버레이 ═══════════════════ */}
      {receptionFullscreen && (
        <div
          className="md:hidden fixed inset-0 z-[100] bg-[#0a0a0a] overflow-hidden"
          style={{
            animation: receptionExiting
              ? 'receptionFadeOut 0.5s ease-out forwards'
              : 'receptionFadeIn 0.5s ease-out forwards',
          }}
        >
          <div className="absolute inset-0">
            <Image src="/images/IMG_8838 1.png" alt="" fill className="object-cover opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-[#0a0a0a]/40 to-[#0a0a0a]" />
          </div>
          <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-10">
            <Image src="/images/Frame 1707488417.svg" alt="2025 Year-End Reception" width={272} height={161} className="w-[280px] brightness-0 invert opacity-90" />
            <Image src="/images/Group 1707482062.svg" alt="Freetiful" width={176} height={30} className="w-[150px] brightness-0 invert opacity-50 mt-8" />
            <div className="mt-10 w-full rounded-xl overflow-hidden bg-black">
              <video ref={receptionVideoRef} className="w-full aspect-video" autoPlay muted playsInline controls>
                <source src="/images/KakaoTalk_Video_2026-04-08-21-53-11-1.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
          <div className="absolute bottom-8 left-0 right-0 flex justify-center animate-bounce z-30">
            <span className="text-white/40 text-[11px] font-medium">아래로 스와이프하여 닫기</span>
          </div>
        </div>
      )}

      {/* ═══ 연혁 ═══════════════════════════════════════════════ */}
      <section id="연혁" className="py-28">
        <div className="mx-auto max-w-[1000px] px-6">
          <Reveal><p className="text-[11px] font-bold tracking-[0.4em] text-blue-500">MILESTONES</p></Reveal>
          <Reveal delay={100}><h2 className="mt-3 text-[34px] font-black tracking-tight">성장의 발자취</h2></Reveal>

          <div className="mt-14 space-y-6">
            {HISTORY.map((h, hi) => (
              <Reveal key={h.year} delay={hi * 120}>
                <div className="flex items-start gap-8 border-l-2 border-blue-500 pl-8 py-3 transition-all hover:pl-10">
                  <span className="text-[36px] font-black text-blue-100 shrink-0 w-[80px]">{h.year}</span>
                  <div className="space-y-3 pt-2">
                    {h.events.map((event, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <CheckCircle className="h-4 w-4 shrink-0 text-blue-400" />
                        <span className="text-[14px] text-gray-500">{event}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Roadmap */}
          <Reveal delay={100}>
            <h3 className="mt-20 text-[11px] font-bold tracking-[0.4em] text-gray-300">ROADMAP</h3>
          </Reveal>
          <div className="mt-6 space-y-4">
            {[
              { phase: '01', title: '전문가 매칭 플랫폼 고도화', desc: 'AI 매칭 정확도 향상, 전문가 카테고리 확장' },
              { phase: '02', title: '전국 서비스 확대', desc: '수도권 중심에서 전국 서비스 커버리지 확장' },
              { phase: '03', title: '종합 행사 솔루션', desc: '기획·공간·전문가·장비까지 원스톱 행사 플랫폼으로 진화' },
            ].map((p, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="flex items-start gap-6 border border-gray-100 rounded-2xl p-6 transition-all hover:border-gray-200 hover:shadow-sm">
                  <span className="text-[32px] font-black text-blue-100">{p.phase}</span>
                  <div>
                    <h3 className="text-[16px] font-bold text-gray-900">{p.title}</h3>
                    <p className="mt-1 text-[13px] text-gray-400">{p.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 자료실 ═══════════════════════════════════════════ */}
      <section id="자료실" className="py-28 bg-gray-50/60">
        <div className="mx-auto max-w-[1000px] px-6">
          <Reveal><p className="text-[11px] font-bold tracking-[0.4em] text-blue-500">RESOURCES</p></Reveal>
          <Reveal delay={100}><h2 className="mt-3 text-[34px] font-black">자료실</h2></Reveal>

          <div className="mt-12 grid gap-3 md:grid-cols-2">
            {[
              { icon: <FileText className="h-5 w-5" />, title: '회사소개서', desc: 'PDF', action: () => window.open('/images/2025 프리티풀 회사소개서.pdf', '_blank') },
              { icon: <Download className="h-5 w-5" />, title: 'CI 가이드라인', desc: 'ZIP · 12.8MB', action: () => toast('곧 제공될 예정입니다') },
              { icon: <FileText className="h-5 w-5" />, title: '서비스 이용가이드', desc: 'PDF · 3.1MB', action: () => toast('곧 제공될 예정입니다') },
              { icon: <Briefcase className="h-5 w-5" />, title: '파트너 제안서', desc: 'PDF · 4.7MB', action: () => toast('곧 제공될 예정입니다') },
              { icon: <Shield className="h-5 w-5" />, title: '개인정보처리방침', desc: '', action: () => setShowPrivacy(true) },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 80}>
                <button onClick={item.action} className="group flex w-full items-center gap-4 bg-white border border-gray-100 rounded-2xl p-5 text-left transition-all hover:border-gray-200 hover:shadow-sm">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500 transition-transform group-hover:scale-110">{item.icon}</div>
                  <div className="flex-1"><p className="text-[15px] font-bold text-gray-900">{item.title}</p></div>
                  {item.desc && <span className="text-[11px] text-gray-300">{item.desc}</span>}
                  <ChevronRight className="h-4 w-4 text-gray-200 transition-transform group-hover:translate-x-1" />
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 오시는길 ═══════════════════════════════════════════ */}
      <section id="오시는길" className="py-28">
        <div className="mx-auto max-w-[1000px] px-6">
          <Reveal><p className="text-[11px] font-bold tracking-[0.4em] text-blue-500">LOCATION</p></Reveal>
          <Reveal delay={100}><h2 className="mt-3 text-[34px] font-black">오시는길</h2></Reveal>

          <Reveal delay={200}>
            <div className="mt-12 w-full h-[300px] border border-gray-100 rounded-2xl overflow-hidden">
              <BizKakaoMap />
            </div>
          </Reveal>

          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {[
              { icon: <MapPin className="h-5 w-5" />, label: '주소', value: COMPANY_INFO.address },
              { icon: <Phone className="h-5 w-5" />, label: '대표전화', value: COMPANY_INFO.phone },
              { icon: <Mail className="h-5 w-5" />, label: '이메일', value: COMPANY_INFO.email },
              { icon: <Clock className="h-5 w-5" />, label: '업무시간', value: '평일 09:00 - 18:00 (주말/공휴일 휴무)' },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="flex items-start gap-4 border border-gray-100 rounded-2xl p-5 transition-all hover:border-gray-200 hover:shadow-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500">{item.icon}</div>
                  <div>
                    <p className="text-[11px] font-bold text-gray-300">{item.label}</p>
                    <p className="mt-1 text-[14px] text-gray-700">{item.value}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <div className="mt-8 bg-gray-50 rounded-2xl p-6">
              <p className="text-[11px] font-bold tracking-[0.3em] text-gray-300 mb-4">교통편 안내</p>
              <div className="space-y-3 text-[13px] text-gray-500">
                <p><span className="text-blue-500 font-bold">지하철</span> — 1호선·3호선·5호선 종로3가역 도보 5분</p>
                <p><span className="text-emerald-500 font-bold">버스</span> — 종로6가 정류장 하차</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 기업문의 (CTA + 캐릭터) ══════════════════════════ */}
      <section className="relative py-32 overflow-hidden bg-gradient-to-b from-white via-blue-50/30 to-white">
        {/* 배경 글로우 */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-200/20 rounded-full blur-[120px]" />

        <div className="relative z-10 mx-auto max-w-[900px] px-6">
          <div className="flex flex-col items-center md:flex-row md:items-center md:gap-12">
            {/* MC 캐릭터 */}
            <Reveal>
              <div className="shrink-0 mb-8 md:mb-0">
                <Image
                  src="/images/mc-characters.png"
                  alt="MC Characters"
                  width={400}
                  height={300}
                  className="w-[280px] md:w-[340px] drop-shadow-2xl"
                />
              </div>
            </Reveal>

            {/* CTA 영역 */}
            <div className="flex-1 text-center md:text-left">
              <Reveal delay={100}>
                <p className="text-[11px] font-bold tracking-[0.4em] text-blue-400 mb-3">CONTACT US</p>
                <h2 className="text-[32px] font-black tracking-tight leading-[1.2] md:text-[40px]">
                  당신의 특별한 순간,<br />
                  <span className="text-blue-500">프리티풀</span>과 함께하세요
                </h2>
                <p className="mt-4 text-[14px] leading-[1.8] text-gray-400">
                  아나운서·MC 섭외부터 행사기획까지<br />
                  검증된 전문가가 함께합니다.
                </p>
              </Reveal>

              {/* 파동 버튼 */}
              <Reveal delay={300}>
                <div className="mt-8 flex justify-center md:justify-start">
                  <button
                    onClick={() => scrollTo('문의폼')}
                    className="group relative px-10 py-4 text-[16px] font-bold text-white rounded-full overflow-hidden transition-all duration-300 active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB, #1D4ED8)' }}
                  >
                    {/* 파동 링 1 */}
                    <span className="absolute inset-0 rounded-full border-2 border-blue-400/40 animate-[ripple1_2.5s_ease-out_infinite]" />
                    {/* 파동 링 2 */}
                    <span className="absolute inset-0 rounded-full border-2 border-blue-300/30 animate-[ripple2_2.5s_ease-out_0.8s_infinite]" />
                    {/* 파동 링 3 */}
                    <span className="absolute inset-0 rounded-full border border-blue-200/20 animate-[ripple3_2.5s_ease-out_1.6s_infinite]" />
                    {/* 쉬머 */}
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    {/* 글로우 */}
                    <span className="absolute -inset-1 rounded-full bg-blue-500/30 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <span className="relative z-10 flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      지금 문의하기
                    </span>
                  </button>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 문의 폼 ═══════════════════════════════════════════ */}
      <section id="문의폼" className="py-28 bg-gray-50/60">
        <div id="문의" className="mx-auto max-w-[600px] px-6">
          <Reveal><p className="text-[11px] font-bold tracking-[0.4em] text-blue-500">INQUIRY FORM</p></Reveal>
          <Reveal delay={100}><h2 className="mt-3 text-[34px] font-black">기업 문의</h2></Reveal>

          <Reveal delay={200}>
            <form onSubmit={handleInquiry} className="mt-10 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input className="h-12 w-full border border-gray-200 rounded-xl bg-white px-4 text-[14px] text-gray-900 outline-none transition-all placeholder-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-50" placeholder="회사명" value={inquiry.company} onChange={(e) => setInquiry({ ...inquiry, company: e.target.value })} />
                <input className="h-12 w-full border border-gray-200 rounded-xl bg-white px-4 text-[14px] text-gray-900 outline-none transition-all placeholder-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-50" placeholder="담당자명 *" value={inquiry.name} onChange={(e) => setInquiry({ ...inquiry, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className="h-12 w-full border border-gray-200 rounded-xl bg-white px-4 text-[14px] text-gray-900 outline-none transition-all placeholder-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-50" placeholder="연락처 *" value={inquiry.phone} onChange={(e) => setInquiry({ ...inquiry, phone: e.target.value })} required />
                <input className="h-12 w-full border border-gray-200 rounded-xl bg-white px-4 text-[14px] text-gray-900 outline-none transition-all placeholder-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-50" placeholder="이메일" value={inquiry.email} onChange={(e) => setInquiry({ ...inquiry, email: e.target.value })} />
              </div>
              <select
                value={inquiry.type}
                onChange={(e) => setInquiry({ ...inquiry, type: e.target.value })}
                className="h-12 w-full border border-gray-200 rounded-xl bg-white px-4 text-[14px] text-gray-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
              >
                <option value="">문의유형 선택</option>
                <option value="wedding">결혼식 사회자 섭외</option>
                <option value="enterprise">기업행사 / 공식행사</option>
                <option value="festival">축제 / 체육대회</option>
                <option value="broadcast">방송 / 라이브커머스</option>
                <option value="partnership">제휴 / 파트너십</option>
                <option value="other">기타</option>
              </select>
              <textarea className="h-32 w-full resize-none border border-gray-200 rounded-xl bg-white px-4 py-3 text-[14px] text-gray-900 outline-none transition-all placeholder-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-50" placeholder="문의 내용 *" value={inquiry.message} onChange={(e) => setInquiry({ ...inquiry, message: e.target.value })} required />
              <button
                type="submit"
                disabled={sending}
                className="group relative flex w-full items-center justify-center gap-2 py-4 text-[15px] font-bold text-white rounded-xl overflow-hidden transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB, #1D4ED8)' }}
              >
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <span className="relative z-10 flex items-center gap-2">
                  <Send className="h-4 w-4" /> {sending ? '전송 중...' : '문의하기'}
                </span>
              </button>
              <p className="text-[11px] text-gray-300 text-center">문의 접수 후 영업일 기준 1~2일 내 담당자가 연락드립니다</p>
            </form>
          </Reveal>
        </div>
      </section>

      {/* ═══ Footer ═══════════════════════════════════════════ */}
      <footer className="border-t border-gray-100 py-12 pb-28 md:pb-12 bg-white">
        <div className="mx-auto max-w-[1000px] px-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[16px] font-black text-gray-900">Freetiful <span className="text-gray-300 font-normal text-[12px]">for Business</span></p>
              <p className="mt-1 text-[11px] text-gray-300">{COMPANY_INFO.name} | 대표 {COMPANY_INFO.ceo} | T {COMPANY_INFO.phone} | E {COMPANY_INFO.email}</p>
              <p className="text-[10px] text-gray-200">Copyright &copy; Freetiful Inc. All rights reserved.</p>
            </div>
            <div className="flex flex-wrap gap-4 text-[12px] text-gray-300">
              <a href={COMPANY_INFO.blog} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-gray-500">블로그</a>
              <a href={`https://instagram.com/${COMPANY_INFO.instagram}`} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-gray-500">인스타그램</a>
              <a href={COMPANY_INFO.youtube} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-gray-500">유튜브</a>
              <a href={COMPANY_INFO.tiktok} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-gray-500">틱톡</a>
              <button onClick={() => setShowPrivacy(true)} className="transition-colors hover:text-gray-500">개인정보처리방침</button>
              <Link href="/careers" className="transition-colors hover:text-gray-500">인재채용</Link>
              <Link href="/main" className="transition-colors hover:text-gray-500">홈으로</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ═══ 모바일 바텀 네비게이션 ═══════════════════════════ */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe transition-all duration-700"
        style={{
          transform: receptionFullscreen ? 'translateY(100%)' : 'translateY(0)',
          opacity: receptionFullscreen ? 0 : 1,
        }}
      >
        <div
          className="max-w-lg mx-auto mb-2"
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
          }}
        >
          <div
            className="bg-white/90 backdrop-blur-2xl shadow-[0_-4px_30px_rgba(0,0,0,0.08)] border border-gray-100/60 transition-all duration-500"
            style={{
              width: bizNavCollapsing ? 60 : '100%',
              maxWidth: bizNavCollapsing ? 60 : 512,
              height: 60,
              borderRadius: 9999,
              overflow: 'hidden',
              transition: bizNavCollapsing
                ? 'width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), max-width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                : 'none',
              ...(bizNavExpanding ? { animation: 'bizPillExpand 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' } : {}),
            }}
          >
            <div className="flex items-center h-full px-2">
              {/* 홈 이동 버튼 */}
              <button
                onClick={() => {
                  sessionStorage.setItem('nav-transition', 'from-biz');
                  setBizNavCollapsing(true);
                  setTimeout(() => router.push('/main'), 500);
                }}
                className={`flex items-center justify-center w-[48px] h-[48px] shrink-0 -ml-1 rounded-full transition-all duration-500 active:scale-90 ${bizNavCollapsing ? 'bg-transparent text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              {/* 네비 아이템들 */}
              <div className="flex-1 flex items-center justify-around overflow-hidden">
                {[
                  { id: '회사소개', iconSrc: '/images/회사소개.svg', label: '회사소개' },
                  { id: '핵심서비스', iconSrc: '/images/서비스.svg', label: '서비스' },
                  { id: '자료실', iconSrc: '/images/자료실.svg', label: '자료실' },
                  { id: '문의', iconSrc: '/images/문의.svg', label: '문의' },
                ].map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => scrollTo(item.id === '문의' ? '문의폼' : item.id)}
                    className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl text-gray-400 hover:text-gray-700 transition-all active:scale-90"
                    style={{
                      opacity: bizNavCollapsing ? 0 : 1,
                      transform: bizNavCollapsing ? 'scale(0.5)' : (bizNavExpanding ? undefined : 'scale(1)'),
                      filter: bizNavCollapsing ? 'blur(4px)' : 'blur(0px)',
                      transition: bizNavCollapsing
                        ? `opacity 0.25s ease ${idx * 0.03}s, transform 0.25s ease ${idx * 0.03}s, filter 0.25s ease ${idx * 0.03}s`
                        : 'opacity 0.3s ease, transform 0.3s ease, filter 0.3s ease',
                      ...(bizNavExpanding ? { animation: `bizIconAppear 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.25 + idx * 0.08}s both` } : {}),
                    }}
                  >
                    <Image src={item.iconSrc} alt={item.label} width={20} height={20} className="opacity-60" />
                    <span className="text-[9px] font-medium whitespace-nowrap">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Biz nav transition keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bizPillExpand {
          0% { width: 60px; max-width: 60px; filter: blur(0px); }
          15% { filter: blur(3px); }
          50% { filter: blur(1px); }
          70% { width: 105%; max-width: 530px; filter: blur(0px); }
          100% { width: 100%; max-width: 512px; filter: blur(0px); }
        }
        @keyframes bizIconAppear {
          0% { opacity: 0; transform: scale(0.3) translateY(4px); filter: blur(4px); }
          60% { opacity: 1; transform: scale(1.1) translateY(-1px); filter: blur(0px); }
          100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0px); }
        }
        @keyframes receptionFadeIn {
          0% { opacity: 0; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes receptionFadeOut {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.95); }
        }
        @keyframes menuSlideIn {
          0% { transform: translateX(100%); }
          100% { transform: translateX(0); }
        }
        @keyframes menuOverlayIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}} />

      {/* ═══ 개인정보처리방침 모달 ═══════════════════════════ */}
      {showPrivacy && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowPrivacy(false)}>
          <div className="relative w-full max-w-[700px] max-h-[80vh] overflow-auto bg-white rounded-2xl border border-gray-100 p-8 shadow-xl animate-[scaleIn_0.2s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowPrivacy(false)} className="absolute top-4 right-4 text-gray-300 hover:text-gray-600 transition-colors"><X className="h-5 w-5" /></button>
            <h2 className="text-[22px] font-black text-gray-900 mb-6">개인정보처리방침</h2>
            <div className="space-y-4 text-[13px] leading-[1.8] text-gray-500">
              <p><strong className="text-gray-800">제1조 (목적)</strong><br />주식회사 프리티풀(이하 &quot;회사&quot;)은 개인정보 보호법 제30조에 따라 정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 하기 위하여 다음과 같이 개인정보 처리방침을 수립·공개합니다.</p>
              <p><strong className="text-gray-800">제2조 (수집하는 개인정보)</strong><br />필수항목: 이메일, 비밀번호 / 선택항목: 이름, 연락처, 프로필 사진 / 자동수집: 접속 IP, 접속 일시, 서비스 이용기록</p>
              <p><strong className="text-gray-800">제3조 (처리목적)</strong><br />회원 가입 및 관리, 서비스 제공, 고객 문의 처리, 서비스 개선</p>
              <p><strong className="text-gray-800">제4조 (보유·파기)</strong><br />개인정보 보유기간 경과 시 지체 없이 파기합니다.</p>
              <p><strong className="text-gray-800">제5조 (제3자 제공)</strong><br />동의 없이 제3자에게 제공하지 않습니다. 법령에 의한 경우 예외.</p>
              <p><strong className="text-gray-800">제6조 (안전성 확보)</strong><br />암호화, 접근 권한 관리, 접속기록 보관, 데이터 최소화 원칙 적용.</p>
              <p><strong className="text-gray-800">제7조 (정보주체 권리)</strong><br />열람·정정·삭제·처리정지를 요구할 수 있습니다.</p>
              <p><strong className="text-gray-800">제8조 (보호책임자)</strong><br />{COMPANY_INFO.ceo} / {COMPANY_INFO.phone} / {COMPANY_INFO.email}</p>
              <p className="text-gray-300">시행일자: 2024년 3월 1일</p>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}
