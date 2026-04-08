'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ChevronRight, ChevronDown, Shield, BarChart3, Users, Building2,
  CheckCircle, Award, Download, MapPin, Phone, Mail,
  Clock, FileText, Send, User, Briefcase, Globe,
  Target, Heart, Star, Zap, X, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

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
  { year: '2025', events: ['모바일 앱 출시 (App Store / Play Store)', '전국 1,000여 명 전문 진행자 등록', 'AI 매칭 시스템 고도화', 'SNS 채널 확대 (인스타그램 10,000+ 팔로워)'] },
  { year: '2024', events: ['프리티풀 서비스 정식 런칭', '결혼식 사회자 매칭 서비스 시작', '법인 설립', '아나운서 교육기관·협회 파트너십 체결'] },
];

/* ─── Page ─────────────────────────────────────────────────── */
export default function BizPage() {
  const [activeSection, setActiveSection] = useState('회사소개');
  const [inquiry, setInquiry] = useState({ company: '', name: '', phone: '', email: '', type: '', message: '' });
  const [sending, setSending] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
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
        style={{ padding: scrollY > 80 ? '12px 16px 0' : '0' }}
      >
        <div
          className={`flex items-center justify-between transition-all duration-700 ease-out ${
            scrollY > 80
              ? 'max-w-[720px] w-full h-[52px] px-4 bg-white/80 backdrop-blur-2xl shadow-lg border border-gray-200/60 rounded-full'
              : 'max-w-[1200px] w-full h-[60px] px-6 bg-transparent'
          }`}
        >
          <Link href="/home" className="transition-all duration-700">
            <Image
              src="/images/logo-prettyful.svg"
              alt="Prettyful"
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

          <button
            onClick={() => scrollTo('문의')}
            className={`bg-gray-900 font-bold text-white rounded-full transition-all hover:bg-gray-800 active:scale-95 ${
              scrollY > 80 ? 'text-[11px] px-4 py-1.5' : 'text-[13px] px-5 py-2'
            }`}
          >
            문의하기
          </button>
        </div>
      </header>

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
      `}} />

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

          {/* 우리가 만드는 가치 (3 Values) */}
          <Reveal delay={100}>
            <p className="mt-20 text-[11px] font-bold tracking-[0.4em] text-blue-500">OUR VALUE</p>
            <h3 className="mt-3 text-[28px] font-black tracking-tight">우리가 만드는 가치</h3>
          </Reveal>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { icon: <Shield className="h-6 w-6" />, title: '검증 시스템', desc: '좋은 진행자는 운이 아니라 시스템에서 나옵니다. 프리티풀은 모든 진행자를 직접 검토하고 검증합니다. 누구나 등록할 수 있는 열린 플랫폼과는 다릅니다.', color: 'bg-blue-50 text-blue-500' },
              { icon: <Award className="h-6 w-6" />, title: '맞춤 연결', desc: '진행자의 품격은 곧 고객의 브랜드가 됩니다. 고객의 니즈, 행사 성격을 파악하여 단순 섭외가 아닌 맞춤 연결을 추구합니다.', color: 'bg-violet-50 text-violet-500' },
              { icon: <Heart className="h-6 w-6" />, title: '진행자 생태계', desc: '흩어져 있던 재능, 프리티풀이 모읍니다. 진행자라는 직업의 전문성을 인정하고, 안심하고 일하며 성장할 수 있는 환경을 만듭니다.', color: 'bg-rose-50 text-rose-500' },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="group border border-gray-100 rounded-2xl p-6 transition-all duration-300 hover:border-gray-200 hover:shadow-sm">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${item.color} transition-transform duration-300 group-hover:scale-110`}>{item.icon}</div>
                  <h3 className="mt-4 text-[17px] font-bold text-gray-900">{item.title}</h3>
                  <p className="mt-2 text-[13px] leading-[1.8] text-gray-400">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* 기업 정보 테이블 */}
          <Reveal delay={100}>
            <div className="mt-16 border border-gray-100 rounded-2xl overflow-hidden">
              {[
                ['회사명', COMPANY_INFO.name],
                ['영문명', COMPANY_INFO.nameEn],
                ['대표이사', COMPANY_INFO.ceo],
                ['설립', COMPANY_INFO.established],
                ['사업분야', COMPANY_INFO.business],
                ['등록 전문가', COMPANY_INFO.experts],
                ['주소', COMPANY_INFO.address],
                ['대표전화', COMPANY_INFO.phone],
                ['이메일', COMPANY_INFO.email],
                ['웹사이트', COMPANY_INFO.website],
              ].map(([label, value], i) => (
                <div key={label} className={`flex px-6 py-4 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                  <span className="text-[13px] font-semibold text-gray-400 w-[90px] shrink-0">{label}</span>
                  <span className="text-[13px] text-gray-700">{value}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 핵심서비스 ═══════════════════════════════════════ */}
      <section id="핵심서비스" className="py-28 bg-gray-50/60">
        <div className="mx-auto max-w-[1100px] px-6">
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

          {/* 서비스 소개 스크린 */}
          <Reveal delay={100}>
            <h3 className="mt-20 text-[11px] font-bold tracking-[0.4em] text-gray-300">APP SCREENS</h3>
            <p className="mt-2 mb-8 text-[20px] font-bold text-gray-900">직관적인 앱으로 간편하게</p>
          </Reveal>
        </div>
        <Reveal delay={200}>
          <AppScreenMarquee images={INTRO_IMAGES} speed={90} />
        </Reveal>
      </section>

      {/* ═══ 2025 송년회 RECEPTION ═════════════════════════════ */}
      <section className="relative overflow-hidden bg-[#0a0a0a] text-white">
        {/* 배경 이미지 (옅게) */}
        <div className="absolute inset-0">
          <Image
            src="/images/IMG_8838 1.png"
            alt=""
            fill
            className="object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-[#0a0a0a]/40 to-[#0a0a0a]" />
        </div>

        <div className="relative z-10 mx-auto max-w-[1100px] px-6 py-32">
          {/* 아티클 SVG + 워드마크 */}
          <div className="flex flex-col items-center gap-10">
            <Reveal>
              <Image
                src="/images/Frame 1707488417.svg"
                alt="2025 Year-End Reception"
                width={272}
                height={161}
                className="w-[300px] md:w-[400px] brightness-0 invert opacity-90"
              />
            </Reveal>
            <Reveal delay={300}>
              <Image
                src="/images/Group 1707482062.svg"
                alt="Freetiful"
                width={176}
                height={30}
                className="w-[160px] md:w-[200px] brightness-0 invert opacity-50"
              />
            </Reveal>
          </div>

          {/* 영상 */}
          <Reveal delay={300}>
            <div className="mt-16 rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(255,255,255,0.05)] border border-white/10 bg-black">
              <video
                className="w-full aspect-video"
                controls
                playsInline
                preload="metadata"
              >
                <source src="/images/KakaoTalk_Video_2026-04-08-21-53-11-1.mp4" type="video/mp4" />
              </video>
            </div>
          </Reveal>

          {/* 하단 장식선 */}
          <div className="mt-16 flex items-center gap-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-white/10" />
            <span className="text-[10px] tracking-[0.5em] text-white/20 font-medium">FREETIFUL 2025</span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-white/10" />
          </div>
        </div>
      </section>

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
              { icon: <Download className="h-5 w-5" />, title: 'CI 가이드라인', desc: 'ZIP · 12.8MB', action: () => toast('준비 중입니다') },
              { icon: <FileText className="h-5 w-5" />, title: '서비스 이용가이드', desc: 'PDF · 3.1MB', action: () => toast('준비 중입니다') },
              { icon: <Briefcase className="h-5 w-5" />, title: '파트너 제안서', desc: 'PDF · 4.7MB', action: () => toast('준비 중입니다') },
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
            <div className="mt-12 w-full h-[280px] border border-gray-100 rounded-2xl bg-gray-50 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-[13px] text-gray-300">지도 영역</p>
              </div>
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

      {/* ═══ 기업문의 ═══════════════════════════════════════════ */}
      <section id="문의" className="py-28 bg-gray-50/60">
        <div className="mx-auto max-w-[600px] px-6">
          <Reveal><p className="text-[11px] font-bold tracking-[0.4em] text-blue-500">CONTACT</p></Reveal>
          <Reveal delay={100}><h2 className="mt-3 text-[34px] font-black">기업 문의</h2></Reveal>
          <Reveal delay={150}><p className="mt-3 text-[14px] text-gray-400">아나운서·MC 섭외, 행사진행·행사기획 등 문의해 주세요</p></Reveal>

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
              <button type="submit" disabled={sending} className="flex w-full items-center justify-center gap-2 bg-gray-900 py-3.5 text-[15px] font-bold text-white rounded-xl transition-all hover:bg-gray-800 active:scale-[0.98] disabled:opacity-50">
                <Send className="h-4 w-4" /> {sending ? '전송 중...' : '문의하기'}
              </button>
              <p className="text-[11px] text-gray-300 text-center">문의 접수 후 영업일 기준 1~2일 내 담당자가 연락드립니다</p>
            </form>
          </Reveal>
        </div>
      </section>

      {/* ═══ Footer ═══════════════════════════════════════════ */}
      <footer className="border-t border-gray-100 py-12 bg-white">
        <div className="mx-auto max-w-[1000px] px-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[16px] font-black text-gray-900">Prettyful <span className="text-gray-300 font-normal text-[12px]">for Business</span></p>
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
              <Link href="/home" className="transition-colors hover:text-gray-500">홈으로</Link>
            </div>
          </div>
        </div>
      </footer>

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
