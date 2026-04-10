'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Phone, Share2, Heart, Play, ChevronDown, ChevronRight, ArrowUpRight } from 'lucide-react';

// ─── Brand Color ────────────────────────────────────────────
const BRAND = '#3180F7';
const BRAND_LIGHT = '#EAF3FF';

// ─── Reveal Hook ────────────────────────────────────────────
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'translate-y-0 opacity-100 blur-0' : 'translate-y-8 opacity-0 blur-[4px]'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ─── CountUp ────────────────────────────────────────────────
function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const { ref, visible } = useReveal(0.3);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const dur = 1200;
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    tick();
  }, [visible, value]);
  return <span ref={ref}>{n.toLocaleString()}{suffix}</span>;
}

// ─── Mock Data ──────────────────────────────────────────────

const MOCK_PRO = {
  id: '1',
  name: '아나운서전해별',
  level: 'Level 1',
  profileImage: 'https://i.pravatar.cc/150?img=45',
  mainImage: 'https://i.pravatar.cc/800?img=45',
  images: [
    'https://i.pravatar.cc/800?img=45',
    'https://i.pravatar.cc/800?img=47',
    'https://i.pravatar.cc/800?img=48',
  ],
  title: '탄탄한 발성의 아나운서가 귀사에 품격을 더해 드립니다',
  isPrime: true,
  rating: 4.9,
  reviewCount: 79,
  plans: [
    { id: 'standard', label: 'STANDARD', price: 450000, duration: '1시간', title: '행사, 영상 1시간 진행', desc: ['행사 및 홍보영상 등 각종 영상 콘텐츠\n 1시간 진행', '영상의 경우, 헤어메이크업 별도 추가'], workDays: 20, revisions: 1 },
    { id: 'deluxe', label: 'DELUXE', price: 800000, duration: '2시간', title: '행사, 영상 2시간 진행', desc: ['행사 및 홍보영상 등 각종 영상 콘텐츠\n 2시간 진행', '영상의 경우, 헤어메이크업 별도 추가'], workDays: 20, revisions: 1 },
    { id: 'premium', label: 'PREMIUM', price: 1700000, duration: '6시간', title: '6시간 행사 및 촬영 (풀타임)', desc: ['행사 및 영상 진행 6시간 이상 진행', '행사 규모에 따라 조정될 수 있습니다.\n 문의 부탁드립니다'], workDays: 20, revisions: 1 },
  ],
  description: `안녕하세요.

신뢰감 있는 목소리, 탄탄한 발성, 센스 있는 진행
첫 문장부터 시선을 이끄는

아나운서 전해별입니다.

저는,
(사) 한국장애인공연예술단 홍보대사,`,
  expertStats: {
    totalDeals: 89,
    satisfaction: 100,
    memberType: '기업',
    taxInvoice: '크몽 발행',
    responseTime: '1시간 이내',
    contactTime: '언제나 가능',
  },
  otherServices: [
    { id: 'os1', title: '전문 아나운서가 특별한 날을 품격있게 꾸며드리...', price: 400000, rating: 5.0, reviewCount: 3, image: 'https://i.pravatar.cc/200?img=44' },
  ],
  reviews: [
    {
      id: 'r1',
      name: '나른********',
      rating: 5.0,
      date: '26.02.09 13:18',
      content: '상담과정부터 행사 진행, 마무리까지 모두 빠르고 친절하게 응대해 주셨어요! 진행도 상황에 맞게 톤 바꿔가시면서 잘 진행해 주셨습니다! 추운데 고생 많으셨습니다. 감사합니다!',
      workDays: 13,
      orderRange: '100만원 ~ 200만원',
      badge: '대행사/에이전시',
      proReply: {
        date: '26.02.09',
        content: '어머 매니저님 빠른 후기 감사합니다 +_+!!\n이런 큰 행사의 진행을 맡을 수 있어 기뻤고 영광이었습니다.\n다음에도 불러주시면 정말 기쁜 마음으로 달려가겠습니다 :)\n그럼 오늘 남은 하루도 행복하게 보내시기 바랍니다.\n새해 복 많이 받으세요!ㅎㅎ',
      },
    },
    {
      id: 'r2',
      name: '스트********',
      rating: 5.0,
      date: '25.06.10 12:00',
      content: '꼼꼼하고 안정적으로 촬영 잘 마쳤습니다~',
      workDays: 3,
      orderRange: '80만원 ~ 90만원',
      badge: 'Biz·기업',
    },
  ],
  popularServices: [
    { id: 'p1', title: '풍부한 경력을 갖춘 전문 아나운서의 고급스러운...', price: 400000, image: 'https://i.pravatar.cc/300?img=25' },
    { id: 'p2', title: '성우MC 남기희 현직 성우의 품격있는 고급스...', price: 350000, image: 'https://i.pravatar.cc/300?img=33' },
    { id: 'p3', title: '아나운서 MC 리포터 홍보영상의 품격을 높이...', price: 300000, image: 'https://i.pravatar.cc/300?img=47', isPrime: true },
  ],
  alsoViewed: [
    { id: 'av1', title: '아리랑 국제방송-통역사 출신 영어 아나운서 I 한영...', price: 400000, author: '오유진', image: 'https://i.pravatar.cc/300?img=20' },
    { id: 'av2', title: '김혜연 아나운서/행사진행, MC, 쇼호스트, 결혼식사회', price: 300000, rating: 5.0, reviewCount: 1, author: '김anna', image: 'https://i.pravatar.cc/300?img=26' },
    { id: 'av3', title: '비타민 가득 에너지보이 김다솜 아나운서입니다', price: 200000, rating: 5.0, reviewCount: 1, author: '김다솜아나운서', image: 'https://i.pravatar.cc/300?img=48' },
  ],
};

// ─── Components ─────────────────────────────────────────────

function ScoreBars() {
  const { ref, visible } = useReveal(0.3);
  const items = [
    { label: '결과물 만족도', value: 4.9 },
    { label: '친절한 상담', value: 4.9 },
    { label: '신속한 대응', value: 4.9 },
  ];
  return (
    <div ref={ref} className="bg-gradient-to-br from-[#EAF3FF]/30 to-gray-50 rounded-xl px-5 py-5 space-y-3 mb-6 border border-gray-100">
      {items.map((item, i) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-[13px] text-gray-600 w-20 shrink-0">{item.label}</span>
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: visible ? `${(item.value / 5) * 100}%` : '0%',
                background: 'linear-gradient(90deg, #3180F7, #6BA5FA)',
                transition: `width 1.2s cubic-bezier(0.22, 1, 0.36, 1) ${i * 150}ms`,
              }}
            />
          </div>
          <span className="text-[13px] font-bold text-gray-900 tabular-nums">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function StarRating({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0" style={{ fontSize: size }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i < Math.floor(value) ? BRAND : '#E5E7EB'}>
          <path d="M12 2l2.9 6.5 7.1.8-5.3 4.9 1.5 7L12 17.8 5.8 21.2l1.5-7L2 9.3l7.1-.8L12 2z" />
        </svg>
      ))}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────

export default function ProDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pro = { ...MOCK_PRO, id: id || MOCK_PRO.id };

  const [activeImage, setActiveImage] = useState(0);
  const [activePlan, setActivePlan] = useState(1); // default deluxe
  const [activeSection, setActiveSection] = useState<'desc' | 'info' | 'reviews'>('desc');
  const [isFavorited, setIsFavorited] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);

  const descRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const [priceFlash, setPriceFlash] = useState(false);

  const plan = pro.plans[activePlan];

  // Price flash animation on plan switch
  useEffect(() => {
    setPriceFlash(true);
    const t = setTimeout(() => setPriceFlash(false), 400);
    return () => clearTimeout(t);
  }, [activePlan]);

  const scrollToSection = (section: 'desc' | 'info' | 'reviews') => {
    setActiveSection(section);
    const target = section === 'desc' ? descRef.current : section === 'info' ? infoRef.current : reviewsRef.current;
    if (target) {
      const y = target.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-white min-h-screen pb-24">
      {/* ─── Top Header (Floating) ─── */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 pt-3 pb-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center shadow-sm">
          <ChevronLeft size={22} className="text-gray-900" />
        </button>
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center shadow-sm">
            <Phone size={18} className="text-gray-900" />
          </button>
          <button
            onClick={() => navigator.share?.({ url: typeof window !== 'undefined' ? window.location.href : '' })}
            className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center shadow-sm"
          >
            <Share2 size={18} className="text-gray-900" />
          </button>
        </div>
      </div>

      {/* ─── Image Gallery with swipe ─── */}
      <div
        className="relative w-full aspect-square bg-gray-100 overflow-hidden"
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          if (dx > 50) setActiveImage((i) => Math.max(0, i - 1));
          if (dx < -50) setActiveImage((i) => Math.min(pro.images.length - 1, i + 1));
          touchStartX.current = null;
        }}
      >
        <div
          className="flex h-full transition-transform duration-[600ms] will-change-transform"
          style={{
            transform: `translateX(-${activeImage * 100}%)`,
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {pro.images.map((src, i) => (
            <div key={i} className="relative w-full h-full shrink-0">
              <Image src={src} alt={pro.name} fill className="object-cover" priority={i === 0} />
            </div>
          ))}
        </div>

        {/* Play button with pulse */}
        <button
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
          <span className="absolute inset-0 rounded-full" style={{ animation: 'playPulse 2.4s ease-out infinite' }} />
          <Play size={20} className="text-white fill-white ml-0.5 relative z-10" />
        </button>

        {/* Page indicator */}
        <div className="absolute bottom-4 right-4 bg-black/60 text-white text-[12px] font-medium px-2.5 py-1 rounded-full backdrop-blur-sm">
          {activeImage + 1} / {pro.images.length}
        </div>

        {/* Dot navigation */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
          {pro.images.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveImage(i)}
              className="rounded-full transition-all duration-500"
              style={{
                width: i === activeImage ? 22 : 6,
                height: 6,
                backgroundColor: i === activeImage ? 'white' : 'rgba(255,255,255,0.5)',
                transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          ))}
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div className="px-5 pt-5">
        {/* Pro row + prime */}
        <Reveal>
          <div className="flex items-center justify-between mb-3">
            <Link href={`/pros/${pro.id}`} className="flex items-center gap-2.5 group">
              <div className="relative">
                <img src={pro.profileImage} alt="" className="w-10 h-10 rounded-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 rounded-full ring-2 ring-transparent group-hover:ring-[#3180F7]/30 transition-all duration-500" />
              </div>
              <div>
                <span className="inline-block text-[10px] font-bold text-[#3180F7] bg-[#EAF3FF] px-1.5 py-0.5 rounded mb-0.5">{pro.level}</span>
                <p className="text-[13px] font-medium text-gray-700 leading-tight">{pro.name}</p>
              </div>
            </Link>
            {pro.isPrime && (
              <div
                className="bg-black text-white text-[11px] font-black italic px-2 py-1 rounded relative overflow-hidden"
                style={{ animation: 'primeShine 3s ease-in-out infinite' }}
              >
                <span className="relative z-10">prime</span>
                <span
                  className="absolute top-0 left-0 h-full w-1/3 pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                    animation: 'primeShineMove 3s ease-in-out infinite',
                  }}
                />
              </div>
            )}
          </div>
        </Reveal>

        {/* Title */}
        <Reveal delay={100}>
          <h1 className="text-[20px] font-bold text-gray-900 leading-tight mb-3">{pro.title}</h1>
        </Reveal>

        {/* Rating */}
        <Reveal delay={200}>
          <div className="flex items-center gap-2 mb-6">
            <StarRating value={pro.rating} size={16} />
            <span className="text-[16px] font-bold text-gray-900">{pro.rating}</span>
            <span className="text-[14px] text-gray-400">({pro.reviewCount})</span>
          </div>
        </Reveal>

        {/* ─── Plan Tabs ─── */}
        <div className="flex border-b border-gray-200 -mx-5 relative">
          {pro.plans.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActivePlan(i)}
              className={`flex-1 py-3 text-[14px] font-bold relative transition-colors duration-300 ${
                activePlan === i ? 'text-[#3180F7]' : 'text-gray-300 hover:text-gray-500'
              }`}
            >
              {p.label}
            </button>
          ))}
          {/* Animated indicator */}
          <span
            className="absolute bottom-[-1px] h-[2px] bg-[#3180F7] transition-all duration-500"
            style={{
              left: `${(activePlan * 100) / pro.plans.length}%`,
              width: `${100 / pro.plans.length}%`,
              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </div>

        {/* ─── Plan Content ─── */}
        <div className="py-5">
          {/* Price */}
          <div
            key={activePlan}
            className="flex items-baseline gap-1.5"
            style={{ animation: priceFlash ? 'priceFadeUp 0.5s ease-out' : undefined }}
          >
            <span className="text-[28px] font-black text-gray-900 tabular-nums">
              <CountUp key={`${activePlan}-${plan.price}`} value={plan.price} />원
            </span>
            <span className="text-[14px] text-gray-400">(VAT 포함)</span>
          </div>
          <p className="text-[12px] text-gray-400 mt-1">결제 시 수수료 4.5%(VAT포함)가 추가돼요.</p>

          {/* Service title */}
          <div key={`title-${activePlan}`} className="mt-6 mb-3" style={{ animation: 'priceFadeUp 0.5s ease-out' }}>
            <h3 className="text-[17px] font-bold text-gray-900">{plan.title}</h3>
          </div>

          {/* Description */}
          <ul key={`desc-${activePlan}`} className="space-y-1 text-[14px] text-gray-700 leading-relaxed" style={{ animation: 'priceFadeUp 0.6s ease-out' }}>
            {plan.desc.map((line, i) => (
              <li key={i} className="whitespace-pre-line">{i === 0 ? '- ' : '* '}{line}</li>
            ))}
          </ul>

          {/* Info box */}
          <div className="mt-6 bg-[#EAF3FF]/50 rounded-xl px-5 py-4 flex items-start justify-between border border-[#3180F7]/10">
            <div className="space-y-1.5">
              <p className="text-[13px] text-gray-500">작업일</p>
              <p className="text-[13px] text-gray-500">수정 횟수</p>
            </div>
            <div className="space-y-1.5 text-right">
              <p className="text-[13px] font-semibold text-gray-900">{plan.workDays}일</p>
              <p className="text-[13px] font-semibold text-gray-900">{plan.revisions}회</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Divider ─── */}
      <div className="h-2 bg-gray-50" />

      {/* ─── Section Tabs (Sticky) ─── */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200">
        <div className="flex relative">
          {[
            { id: 'desc', label: '서비스 설명' },
            { id: 'info', label: '전문가 정보' },
            { id: 'reviews', label: `리뷰 (${pro.reviewCount})` },
          ].map((tab) => {
            const tabs = ['desc', 'info', 'reviews'];
            const idx = tabs.indexOf(activeSection);
            return (
              <button
                key={tab.id}
                onClick={() => scrollToSection(tab.id as 'desc' | 'info' | 'reviews')}
                className={`flex-1 py-4 text-[15px] font-semibold relative transition-colors duration-300 ${
                  activeSection === tab.id ? 'text-[#3180F7]' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
          <span
            className="absolute bottom-[-1px] h-[2px] bg-[#3180F7] transition-all duration-500"
            style={{
              left: `${(['desc', 'info', 'reviews'].indexOf(activeSection) * 100) / 3}%`,
              width: `${100 / 3}%`,
              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </div>
      </div>

      {/* ─── 서비스 설명 Section ─── */}
      <div ref={descRef} className="px-5 pt-8">
        <Reveal>
          <h2 className="text-[20px] font-bold text-gray-900 mb-5">서비스 설명</h2>
        </Reveal>

        {pro.isPrime && (
          <Reveal delay={100}>
            <div className="relative overflow-hidden rounded-xl p-5 mb-6 border border-[#3180F7]/15 bg-gradient-to-br from-[#EAF3FF]/40 via-white to-white">
              {/* Glow accent */}
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-[#3180F7]/10 blur-3xl pointer-events-none" />
              <div className="inline-block bg-black text-white text-[13px] font-black italic px-2 py-0.5 rounded mb-3 relative">prime</div>
              <p className="text-[15px] font-bold text-gray-900 mb-3">
                이 서비스는 프리티풀 엄선 <span className="text-[#3180F7]">상위 2% 전문가</span>가 제공해요
              </p>
              <ul className="space-y-1.5">
                {['포트폴리오와 고객 후기로 검증된 퀄리티', '경력·이력 인증 심사를 통과한 서비스', '다양한 고객의 요청에 맞춘 전문성'].map((item, i) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-[13px] text-gray-700 opacity-0"
                    style={{ animation: `slideInLeft 0.6s ease-out ${300 + i * 100}ms forwards` }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3180F7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        )}

        {/* Description text */}
        <div className={`whitespace-pre-line text-[15px] leading-[1.8] text-gray-800 text-center ${descExpanded ? '' : 'max-h-[400px] overflow-hidden relative'}`}>
          {pro.description}
          {!descExpanded && (
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none" />
          )}
        </div>

        {!descExpanded && (
          <button
            onClick={() => setDescExpanded(true)}
            className="mt-4 w-full py-3.5 border border-gray-200 rounded-lg text-[14px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            더보기
          </button>
        )}

        {/* Image expand notice */}
        <div className="mt-8 bg-gray-50 rounded-lg py-3 flex items-center justify-center gap-2 text-[13px] text-gray-400">
          이미지를 클릭해서 확대 할 수 있어요
          <ArrowUpRight size={14} />
        </div>
      </div>

      {/* ─── 다른 회원들이 함께 보고 있어요 ─── */}
      <div className="px-5 pt-10">
        <h3 className="text-[17px] font-bold text-gray-900 leading-tight mb-4">다른 회원들이<br />함께 보고 있어요</h3>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5">
          {pro.alsoViewed.map((item) => (
            <div key={item.id} className="shrink-0 w-[150px]">
              <div className="relative aspect-square rounded-xl overflow-hidden mb-2 bg-gray-100">
                <Image src={item.image} alt="" fill className="object-cover" />
                <button className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center">
                  <Heart size={14} className="text-gray-400" />
                </button>
              </div>
              <p className="text-[12px] font-semibold text-gray-900 leading-tight line-clamp-2 mb-1">{item.title}</p>
              <p className="text-[14px] font-bold text-gray-900">{item.price.toLocaleString()}원~</p>
              {item.rating && (
                <div className="flex items-center gap-1 mt-1">
                  <StarRating value={item.rating} size={10} />
                  <span className="text-[11px] text-gray-500 font-semibold">{item.rating} ({item.reviewCount})</span>
                </div>
              )}
              <p className="text-[11px] text-gray-400 mt-0.5">{item.author}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Divider ─── */}
      <div className="h-2 bg-gray-50 mt-8" />

      {/* ─── 전문가 정보 Section ─── */}
      <div ref={infoRef} className="px-5 pt-8">
        <h2 className="text-[20px] font-bold text-gray-900 mb-5">전문가 정보</h2>

        <div className="flex items-center gap-4 mb-5">
          <img src={pro.profileImage} alt="" className="w-[60px] h-[60px] rounded-full object-cover" />
          <div className="flex-1">
            <span className="inline-block text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded mb-1">{pro.level}</span>
            <p className="text-[15px] font-bold text-gray-900">{pro.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <StarRating value={pro.rating} size={12} />
              <span className="text-[12px] font-semibold text-gray-900">{pro.rating} ({pro.reviewCount + 3})</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">연락 가능 시간: {pro.expertStats.contactTime}</p>
            <p className="text-[11px] text-gray-400">평균 응답 시간: {pro.expertStats.responseTime}</p>
          </div>
        </div>

        <button className="w-full py-3.5 border border-gray-200 rounded-lg text-[14px] font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-5">
          문의하기
        </button>

        {/* Stats grid */}
        <div className="bg-gray-50 rounded-xl px-5 py-5 grid grid-cols-4 gap-3">
          <div className="text-center">
            <p className="text-[11px] text-gray-400 mb-1">총 거래 건수</p>
            <p className="text-[16px] font-bold text-gray-900">{pro.expertStats.totalDeals}건</p>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-gray-400 mb-1">만족도</p>
            <p className="text-[16px] font-bold text-gray-900">{pro.expertStats.satisfaction}%</p>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-gray-400 mb-1">회원구분</p>
            <p className="text-[16px] font-bold text-gray-900">{pro.expertStats.memberType}</p>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-gray-400 mb-1">세금계산서</p>
            <p className="text-[16px] font-bold text-gray-900">{pro.expertStats.taxInvoice}</p>
          </div>
        </div>

        {/* Other services */}
        <h3 className="text-[17px] font-bold text-gray-900 leading-tight mt-10 mb-4">이 전문가의<br />다른 서비스예요</h3>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5">
          {pro.otherServices.map((item) => (
            <Link key={item.id} href={`/pros/${item.id}`} className="shrink-0 w-[180px]">
              <div className="relative aspect-square rounded-xl overflow-hidden mb-2 bg-gradient-to-br from-pink-100 to-rose-100">
                <Image src={item.image} alt="" fill className="object-cover" />
                <button className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center">
                  <Heart size={14} className="text-gray-400" />
                </button>
              </div>
              <p className="text-[13px] font-semibold text-gray-900 leading-tight line-clamp-2 mb-1">{item.title}</p>
              <p className="text-[15px] font-bold text-gray-900">{item.price.toLocaleString()}원</p>
              <div className="flex items-center gap-1 mt-1">
                <StarRating value={item.rating} size={10} />
                <span className="text-[11px] text-gray-500 font-semibold">{item.rating} ({item.reviewCount})</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">{pro.name}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ─── Divider ─── */}
      <div className="h-2 bg-gray-50 mt-10" />

      {/* ─── 리뷰 Section ─── */}
      <div ref={reviewsRef} className="px-5 pt-8">
        <h2 className="text-[20px] font-bold text-gray-900 mb-5">리뷰</h2>

        <div className="flex items-center gap-2 mb-5">
          <StarRating value={pro.rating} size={20} />
          <span className="text-[24px] font-black text-gray-900">{pro.rating}</span>
          <span className="text-[14px] text-gray-400">({pro.reviewCount})</span>
        </div>

        {/* Score bars */}
        <ScoreBars />


        {/* Reviews list */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-bold text-gray-900">전체 리뷰 {pro.reviewCount}건</h3>
          <button><ChevronRight size={20} className="text-gray-400" /></button>
        </div>

        <div className="space-y-6">
          {pro.reviews.map((review) => (
            <div key={review.id} className="pb-6 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-[14px]">🚀</div>
                <span className="text-[14px] text-gray-600">{review.name}</span>
              </div>
              <div className="flex items-center gap-1.5 mb-3">
                <StarRating value={review.rating} size={14} />
                <span className="text-[13px] font-bold text-gray-900">{review.rating}</span>
                <span className="text-[12px] text-gray-300">|</span>
                <span className="text-[12px] text-gray-400">{review.date}</span>
              </div>
              <p className="text-[14px] leading-[1.7] text-gray-800 mb-3 whitespace-pre-line">{review.content}</p>
              <p className="text-[12px] text-gray-400 mb-2">
                작업일 : {review.workDays}일 | 주문 금액 : {review.orderRange}
              </p>
              {review.badge && (
                <span className="inline-block text-[11px] text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{review.badge}</span>
              )}
              {review.proReply && (
                <div className="mt-3 bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[13px] font-semibold text-gray-800">{pro.name}</span>
                    <span className="text-[12px] text-gray-400">{review.proReply.date}</span>
                  </div>
                  <p className="text-[13px] leading-[1.7] text-gray-700 whitespace-pre-line">{review.proReply.content}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <button className="w-full py-3.5 border border-gray-200 rounded-lg text-[14px] font-medium text-gray-700 hover:bg-gray-50 transition-colors mt-5">
          리뷰 전체보기
        </button>
      </div>

      {/* ─── Expandable panels ─── */}
      <div className="px-5 pt-8 space-y-1">
        {[
          { id: 'info', label: '서비스 정보' },
          { id: 'revision', label: '수정 및 재진행' },
          { id: 'cancel', label: '취소 및 환불 규정' },
          { id: 'notice', label: '상품정보고시' },
        ].map((panel) => (
          <button
            key={panel.id}
            onClick={() => setExpandedPanel(expandedPanel === panel.id ? null : panel.id)}
            className="w-full flex items-center justify-between py-4 text-left"
          >
            <span className="text-[15px] font-medium text-gray-900">{panel.label}</span>
            <ChevronDown size={20} className={`text-gray-400 transition-transform ${expandedPanel === panel.id ? 'rotate-180' : ''}`} />
          </button>
        ))}
      </div>

      {/* ─── Divider ─── */}
      <div className="h-2 bg-gray-50 mt-2" />

      {/* ─── MC 인기 서비스 ─── */}
      <div className="px-5 pt-8 pb-10">
        <h2 className="text-[17px] font-bold text-gray-900 leading-tight mb-4">MC<br />인기 서비스 어때요?</h2>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5">
          {pro.popularServices.map((item) => (
            <div key={item.id} className="shrink-0 w-[180px]">
              <div className="relative aspect-square rounded-xl overflow-hidden mb-2 bg-gray-100">
                <Image src={item.image} alt="" fill className="object-cover" />
                <button className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center">
                  <Heart size={14} className="text-gray-400" />
                </button>
                {item.isPrime && (
                  <div className="absolute bottom-2 left-2 bg-black text-white text-[10px] font-black italic px-1.5 py-0.5 rounded">prime</div>
                )}
              </div>
              <p className="text-[13px] font-semibold text-gray-900 leading-tight line-clamp-2 mb-1">{item.title}</p>
              <p className="text-[15px] font-bold text-gray-900">{item.price.toLocaleString()}원~</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Bottom Fixed Bar ─── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-100 px-4 py-3 pb-safe">
        <div className="flex items-stretch gap-2 max-w-[680px] mx-auto">
          {/* Heart */}
          <button
            onClick={() => setIsFavorited(!isFavorited)}
            className="relative w-12 border border-gray-200 rounded-lg flex items-center justify-center active:scale-90 transition-transform overflow-hidden"
          >
            <Heart
              size={20}
              className={isFavorited ? 'fill-[#3180F7] text-[#3180F7]' : 'text-gray-400'}
              style={{ animation: isFavorited ? 'heartPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined }}
            />
          </button>

          {/* 문의하기 with tooltip */}
          <div className="relative flex-1">
            {showTooltip && (
              <div
                className="absolute -top-11 left-0 right-0 flex justify-center"
                style={{ animation: 'tooltipBounce 2s ease-in-out infinite' }}
              >
                <div className="bg-[#3180F7] text-white text-[11px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap relative shadow-[0_4px_16px_rgba(49,128,247,0.4)]">
                  평균 응답 1시간 이내
                  <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[#3180F7] rotate-45" />
                </div>
              </div>
            )}
            <button
              onClick={() => { setShowTooltip(false); router.push(`/chat/${pro.id}`); }}
              className="w-full h-12 border-2 border-[#3180F7]/20 rounded-lg text-[14px] font-semibold text-[#3180F7] active:scale-95 transition-all hover:border-[#3180F7]/40 hover:bg-[#EAF3FF]/30"
            >
              문의하기
            </button>
          </div>

          {/* 구매하기 */}
          <button
            className="relative flex-1 h-12 rounded-lg text-[14px] font-bold text-white active:scale-95 transition-transform overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #3180F7 0%, #1A68E0 100%)',
              boxShadow: '0 4px 14px rgba(49,128,247,0.35)',
            }}
          >
            <span className="relative z-10">구매하기</span>
            <span
              className="absolute top-0 left-0 h-full w-1/3 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                animation: 'buttonShine 3s ease-in-out infinite',
              }}
            />
          </button>
        </div>
      </div>

      {/* Premium animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes tooltipBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes priceFadeUp {
          0% { opacity: 0; transform: translateY(8px); filter: blur(3px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes slideInLeft {
          0% { opacity: 0; transform: translateX(-12px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes primeShine {
          0%, 100% { box-shadow: 0 0 0 rgba(49,128,247,0); }
          50% { box-shadow: 0 0 16px rgba(49,128,247,0.4); }
        }
        @keyframes primeShineMove {
          0% { transform: translateX(-100%); }
          50%, 100% { transform: translateX(400%); }
        }
        @keyframes playPulse {
          0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.5); }
          100% { box-shadow: 0 0 0 18px rgba(255,255,255,0); }
        }
        @keyframes heartPop {
          0% { transform: scale(1); }
          50% { transform: scale(1.4); }
          100% { transform: scale(1); }
        }
        @keyframes buttonShine {
          0% { transform: translateX(-100%) skewX(-15deg); }
          50%, 100% { transform: translateX(450%) skewX(-15deg); }
        }
      `}} />
    </div>
  );
}
