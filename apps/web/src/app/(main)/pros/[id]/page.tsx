'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Phone, Share2, Heart, Play, ChevronDown, ChevronRight, ArrowUpRight, X, Check, Copy, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';

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
  id: '31',
  name: '전해별',
  level: 'Level 1',
  profileImage: '/images/전해별/025209A2-09A8-4777-9A6A-DF4751F560A71772850104015.avif',
  mainImage: '/images/전해별/IMG_73341772850094485.avif',
  images: [
    '/images/전해별/025209A2-09A8-4777-9A6A-DF4751F560A71772850104015.avif',
    '/images/전해별/IMG_73341772850094485.avif',
    '/images/전해별/IMG_73391772850088429.avif',
    '/images/전해별/IMG_92281772850158117.avif',
  ],
  title: '사회자 전해별',
  isPrime: true,
  youtubeId: 'Aooj1e0Wu2I',
  youtubeVideos: [
    { id: 'Aooj1e0Wu2I', title: '전해별 아나운서 웨딩 MC 진행 영상' },
    { id: 'yjF1Im350yE', title: '기업 행사 진행 하이라이트' },
    { id: 'h9ckGqJHJJM', title: '공식 행사 MC 진행 영상' },
    { id: 'aGt6EZQmmOk', title: '이벤트 진행 영상' },
  ],
  rating: 4.9,
  reviewCount: 79,
  plans: [
    { id: 'premium', label: 'Premium', price: 450000, duration: '1시간', title: '행사, 영상 1시간 진행', desc: ['행사 및 홍보영상 등 각종 영상 콘텐츠\n 1시간 진행', '영상의 경우, 헤어메이크업 별도 추가'], workDays: 20, revisions: 1 },
    { id: 'superior', label: 'Superior', price: 800000, duration: '2시간', title: '행사, 영상 2시간 진행', desc: ['행사 및 홍보영상 등 각종 영상 콘텐츠\n 2시간 진행', '영상의 경우, 헤어메이크업 별도 추가'], workDays: 20, revisions: 1 },
    { id: 'enterprise', label: 'Enterprise', price: 1700000, duration: '6시간', title: '6시간 행사 및 촬영 (풀타임)', desc: ['행사 및 영상 진행 6시간 이상 진행', '행사 규모에 따라 조정될 수 있습니다.\n 문의 부탁드립니다'], workDays: 20, revisions: 1 },
  ],
  description: `안녕하세요. 아나운서 전해별입니다.

탄탄한 발성의 아나운서가 여러분을 빛내 드리겠습니다.

신뢰감 있는 목소리, 탄탄한 발성, 센스 있는 진행으로
첫 문장부터 시선을 이끌겠습니다.

주요 경력:
• 인천공항 아나운서
• 부평구청 아나운서
• <청중을 이끄는 스피치> 집필
• 크몽 Prime 전문가
• 영어 MC 가능`,
  expertStats: {
    totalDeals: 89,
    satisfaction: 100,
    memberType: '기업',
    taxInvoice: '프리티풀 발행',
    responseTime: '1시간 이내',
    contactTime: '언제나 가능',
  },
  otherServices: [
    { id: 'os1', title: '전문 아나운서가 특별한 날을 품격있게 꾸며드리...', price: 400000, rating: 5.0, reviewCount: 3, image: '/images/전해별/IMG_92281772850158117.avif' },
  ],
  reviews: [
    {
      id: 'r1',
      name: '나른********',
      rating: 5.0,
      date: '26.02.09 13:18',
      scores: { 경력: 5.0, 만족도: 5.0, 구성력: 5.0, 위트: 4.5, 발성: 5.0, 이미지: 5.0 },
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
      scores: { 경력: 4.5, 만족도: 5.0, 구성력: 5.0, 위트: 5.0, 발성: 4.5, 이미지: 5.0 },
      content: '꼼꼼하고 안정적으로 촬영 잘 마쳤습니다~',
      workDays: 3,
      orderRange: '80만원 ~ 90만원',
      badge: 'Biz·기업',
    },
  ],
  recommendedPros: [
    { id: '15', name: '박인애', role: '사회자', rating: 4.7, reviews: 134, experience: 13, image: '/images/박인애/IMG_0196.avif', tags: ['전국가능', '격식있는'], isPartner: true },
    { id: '23', name: '이승진', role: '사회자', rating: 4.8, reviews: 211, experience: 4, image: '/images/이승진/IMG_46511771924269213.avif', tags: ['서울/경기', '유머러스한'], isPartner: true },
    { id: '12', name: '문정은', role: '사회자', rating: 4.6, reviews: 216, experience: 10, image: '/images/문정은/IMG_27221772621229571.avif', tags: ['전국가능', '감동적인'], isPartner: true },
  ],
  alsoViewed: [
    { id: '25', title: '현직 아나운서의 고품격 진행', price: 400000, author: '이우영', image: '/images/이우영/2-11772248201484.avif' },
    { id: '35', title: '정이현 사회자 - 청춘의 에너지를 담은 MC', price: 300000, rating: 5.0, reviewCount: 34, author: '정이현', image: '/images/정이현/44561772622988798.avif' },
    { id: '5', title: '최고의 진행자 아나운서 김유석입니다', price: 550000, rating: 4.7, reviewCount: 65, author: '김유석', image: '/images/김유석/10000029811773033474612.avif' },
  ],
};

// ─── Components ─────────────────────────────────────────────

function RadarChart({ scores }: { scores: { label: string; value: number }[] }) {
  const { ref, visible } = useReveal(0.3);
  const cx = 130;
  const cy = 130;
  const r = 95;
  const n = scores.length;
  const total = scores.reduce((sum, s) => sum + s.value * (100 / 5), 0);
  const maxValue = Math.max(...scores.map((s) => s.value));
  const bestIndices = scores.map((s, i) => s.value === maxValue ? i : -1).filter((i) => i >= 0);

  const getPoint = (i: number, scale: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x: cx + Math.cos(angle) * r * scale, y: cy + Math.sin(angle) * r * scale };
  };

  const bgPath = scores.map((_, i) => { const p = getPoint(i, 1); return `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`; }).join(' ') + ' Z';
  const dataPath = scores.map((s, i) => { const p = getPoint(i, visible ? s.value / 5 : 0); return `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`; }).join(' ') + ' Z';

  return (
    <div ref={ref} className="bg-gray-50 rounded-2xl p-5 mb-3">
      <div className="flex items-center gap-3">
        {/* Left: total + tags */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-gray-500">총 포텐셜점수</p>
          <p className="text-[28px] font-bold text-[#3180F7] leading-tight">{Math.round(total)}점</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {scores.map((s) => (
              <span key={s.label} className="px-2 h-[26px] rounded-full bg-white text-[10px] font-medium text-gray-600 flex items-center gap-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                {s.label} <span className="font-bold text-[#3180F7]">{s.value.toFixed(1)}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Right: radar chart SVG */}
        <div className="shrink-0">
          <svg width={160} height={160} viewBox="0 0 260 260" style={{ overflow: 'visible' }}>
            {/* Grid lines */}
            {[0.2, 0.4, 0.6, 0.8, 1].map((scale) => {
              const path = scores.map((_, i) => { const p = getPoint(i, scale); return `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`; }).join(' ') + ' Z';
              return <path key={scale} d={path} fill="none" stroke="#E5E7EB" strokeWidth="0.8" />;
            })}

            {/* Axis lines */}
            {scores.map((_, i) => {
              const p = getPoint(i, 1);
              return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#E5E7EB" strokeWidth="0.8" />;
            })}

            {/* Data fill */}
            <path
              d={dataPath}
              fill="rgba(49,128,247,0.2)"
              stroke="#3180F7"
              strokeWidth="2"
              strokeLinejoin="round"
              style={{ transition: 'all 1.2s cubic-bezier(0.22, 1, 0.36, 1)' }}
            />

            {/* Data dots */}
            {scores.map((s, i) => {
              const p = getPoint(i, visible ? s.value / 5 : 0);
              return (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={3}
                  fill="#3180F7"
                  style={{ transition: `all 1.2s cubic-bezier(0.22, 1, 0.36, 1) ${i * 80}ms` }}
                />
              );
            })}

            {/* Labels + BEST badge */}
            {scores.map((s, i) => {
              const p = getPoint(i, 1.22);
              const isBest = bestIndices.includes(i);
              return (
                <g key={i}>
                  <text
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[13px] font-semibold"
                    fill={isBest ? '#1a1a1a' : '#6B7280'}
                  >
                    {s.label}
                  </text>
                  {isBest && visible && (
                    <g style={{ animation: `bestBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.8 + i * 0.1}s both` }}>
                      <g style={{ animation: 'bestFloat 2s ease-in-out infinite', transformOrigin: `${p.x}px ${p.y - 22}px` }}>
                        <rect x={p.x - 24} y={p.y - 32} width={48} height={22} rx={11} fill="#1a1a1a" />
                        <polygon points={`${p.x - 5},${p.y - 10} ${p.x + 5},${p.y - 10} ${p.x},${p.y - 5}`} fill="#1a1a1a" />
                        <text x={p.x} y={p.y - 21} textAnchor="middle" dominantBaseline="central" fill="white" fontSize="10" fontWeight="700" letterSpacing="0.5">BEST</text>
                      </g>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

      </div>
    </div>
  );
}

function ScoreBars() {
  const { ref, visible } = useReveal(0.3);
  const items = [
    { label: '경력', value: 5.0 },
    { label: '만족도', value: 4.9 },
    { label: '구성력', value: 5.0 },
    { label: '위트', value: 4.8 },
    { label: '발성', value: 5.0 },
    { label: '이미지', value: 4.9 },
  ];
  return (
    <div ref={ref} className="mb-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {items.map((item, i) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="text-[12px] text-gray-500 w-14 shrink-0">{item.label}</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: visible ? `${(item.value / 5) * 100}%` : '0%',
                  background: 'linear-gradient(90deg, #3180F7, #6BA5FA)',
                  transition: `width 1.2s cubic-bezier(0.22, 1, 0.36, 1) ${i * 150}ms`,
                }}
              />
            </div>
            <span className="text-[12px] font-bold text-gray-900 tabular-nums">{item.value}</span>
          </div>
        ))}
      </div>
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
  const [headerSolid, setHeaderSolid] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);
  const [favoriteItems, setFavoriteItems] = useState<Set<string>>(new Set());
  const [imageModal, setImageModal] = useState<string | null>(null);
  const [shareModal, setShareModal] = useState(false);
  const [purchaseModal, setPurchaseModal] = useState(false);
  const [reviewsModal, setReviewsModal] = useState(false);
  const [phoneModal, setPhoneModal] = useState(false);
  const [reviewMenu, setReviewMenu] = useState<string | null>(null);

  const descRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const plan = pro.plans[activePlan];

  // 방문 기록 저장
  useEffect(() => {
    try {
      const key = 'viewed-pros';
      const stored = JSON.parse(localStorage.getItem(key) || '[]') as { id: string; time: number }[];
      const filtered = stored.filter((v) => v.id !== id);
      filtered.unshift({ id, time: Date.now() });
      localStorage.setItem(key, JSON.stringify(filtered.slice(0, 20)));
    } catch {}
  }, [id]);

  // Active section auto-tracking on scroll + header solid bg
  useEffect(() => {
    const sections: Array<{ id: 'desc' | 'info' | 'reviews'; ref: React.RefObject<HTMLDivElement> }> = [
      { id: 'desc', ref: descRef },
      { id: 'info', ref: infoRef },
      { id: 'reviews', ref: reviewsRef },
    ];
    const onScroll = () => {
      const scrollY = window.scrollY + 120;
      let current: 'desc' | 'info' | 'reviews' = 'desc';
      sections.forEach(({ id, ref }) => {
        if (ref.current && ref.current.offsetTop <= scrollY) current = id;
      });
      setActiveSection(current);
      setScrollY(window.scrollY);
      // Solid header when gallery's bottom passes the top of viewport
      if (galleryRef.current) {
        const galleryBottom = galleryRef.current.offsetTop + galleryRef.current.offsetHeight;
        setHeaderSolid(window.scrollY > galleryBottom - 60);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Body scroll lock when modals open
  useEffect(() => {
    const anyModal = imageModal || shareModal || purchaseModal || reviewsModal || phoneModal;
    if (anyModal) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [imageModal, shareModal, purchaseModal, reviewsModal, phoneModal]);

  // Toggle carousel favorite
  const toggleCarouselFav = (id: string) => {
    setFavoriteItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast('찜 해제', { icon: '💙' });
      } else {
        next.add(id);
        toast('찜 목록에 추가됨', { icon: '❤️' });
      }
      return next;
    });
  };

  // Handlers
  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: pro.title, url: window.location.href });
      } catch {
        setShareModal(true);
      }
    } else {
      setShareModal(true);
    }
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      toast.success('링크가 복사되었습니다');
      setShareModal(false);
    }
  };

  const handleToggleFavorite = () => {
    setIsFavorited((v) => {
      toast(v ? '찜 해제' : '찜 목록에 추가됨', { icon: v ? '💙' : '❤️' });
      return !v;
    });
  };

  const handlePurchase = () => {
    router.push(`/pros/${pro.id}/booking`);
  };

  const confirmPurchase = () => {
    setPurchaseModal(false);
    router.push(`/pros/${pro.id}/booking`);
  };

  const scrollToSection = (section: 'desc' | 'info' | 'reviews') => {
    setActiveSection(section);
    const target = section === 'desc' ? descRef.current : section === 'info' ? infoRef.current : reviewsRef.current;
    if (target) {
      const y = target.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-white min-h-screen pb-24" style={{ letterSpacing: '-0.02em' }}>
      {/* ─── Top Header (Floating → Solid with thumbnail on scroll) ─── */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 flex items-center gap-2 px-3 transition-all duration-300 ${
          headerSolid ? 'bg-white border-b border-gray-100 h-[60px] py-0' : 'justify-between pt-3 pb-3 px-4'
        }`}
      >
        <button
          onClick={() => router.back()}
          className={`flex items-center justify-center shrink-0 active:scale-90 transition-all ${
            headerSolid
              ? 'w-9 h-9 text-gray-900'
              : 'w-9 h-9 rounded-full bg-white/90 backdrop-blur-md shadow-sm'
          }`}
        >
          <ChevronLeft size={22} className="text-gray-900" />
        </button>

        {/* Scrolled state: Thumbnail + Title + Price */}
        <div
          className={`flex-1 min-w-0 flex items-center gap-2.5 transition-all duration-300 ${
            headerSolid ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{
            transform: headerSolid ? 'translateY(0)' : 'translateY(6px)',
          }}
        >
          <img
            src={pro.images[0]}
            alt=""
            className="w-10 h-10 rounded-xl object-cover shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-gray-900 truncate leading-tight">
              <span className="text-[#3180F7]">{pro.plans[activePlan].label}</span> {pro.title}
            </p>
            <p className="text-[12px] leading-tight mt-0.5">
              <span className="font-bold text-gray-900">{pro.plans[activePlan].price.toLocaleString()}원</span>
              <span className="text-gray-400 ml-1">(VAT 포함)</span>
            </p>
          </div>
        </div>

        <div className={`flex items-center gap-2 shrink-0 ${headerSolid ? '' : 'ml-auto'}`}>
          <button
            onClick={handleShare}
            className={`flex items-center justify-center active:scale-90 transition-all ${
              headerSolid
                ? 'w-9 h-9 text-gray-900'
                : 'w-9 h-9 rounded-full bg-white/90 backdrop-blur-md shadow-sm'
            }`}
          >
            <Share2 size={18} className="text-gray-900" />
          </button>
        </div>
      </div>

      {/* ─── Image Gallery with swipe ─── */}
      <div
        ref={galleryRef}
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
        {/* Parallax wrapper: shrinks + moves up on scroll */}
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            transform: `translateY(${scrollY * 0.35}px) scale(${Math.max(0.88, 1 - scrollY / 1600)})`,
            transformOrigin: 'center center',
            opacity: Math.max(0, 1 - scrollY / 600),
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
              <button
                key={i}
                onClick={() => setImageModal(src)}
                className="relative w-full h-full shrink-0 block"
              >
                <Image src={src} alt={pro.name} fill className="object-cover" priority={i === 0} />
              </button>
            ))}
          </div>
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

        {/* YouTube 영상 썸네일 (우측 하단) */}
        {pro.youtubeId && (
          <div
            className="absolute bottom-4 right-4 w-[130px] aspect-[5/3] rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.4)] border-2 border-white/90 bg-black z-10"
          >
            <iframe
              className="w-full h-full pointer-events-none"
              src={`https://www.youtube.com/embed/${pro.youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${pro.youtubeId}&playsinline=1&modestbranding=1&rel=0&showinfo=0`}
              title="YouTube preview"
              allow="autoplay; encrypted-media"
            />
          </div>
        )}
      </div>

      {/* ─── Main Content ─── */}
      <div className="px-2.5 pt-4">
        {/* Pro row + prime */}
        <Reveal>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2.5">
              <img src={pro.profileImage} alt="" className="w-10 h-10 rounded-xl object-cover" />
              <p className="text-[18px] font-bold text-gray-900">사회자 {pro.name}</p>
            </div>
            {pro.isPrime && (
              <img src="/images/partners-badge.svg" alt="Partners" className="h-[24px]" />
            )}
          </div>
        </Reveal>

        {/* Rating */}
        <Reveal delay={100}>
          <div className="flex items-center gap-2 mb-4">
            <StarRating value={pro.rating} size={16} />
            <span className="text-[16px] font-bold text-gray-900">{pro.rating}</span>
            <span className="text-[14px] text-gray-400">({pro.reviewCount})</span>
          </div>
        </Reveal>

        {/* ─── Plan Tabs ─── */}
        <div className="flex border-b border-gray-200 -mx-2.5 relative">
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
          <div className="flex items-baseline gap-1.5">
            <span className="text-[28px] font-bold text-gray-900 tabular-nums">
              {plan.price.toLocaleString()}원
            </span>
            <span className="text-[14px] text-gray-400">(VAT 포함)</span>
          </div>
          <p className="text-[12px] text-gray-400 mt-1">결제 시 수수료 10%(VAT포함)가 추가돼요.</p>

          {/* Service title */}
          <div className="mt-6 mb-3">
            <h3 className="text-[17px] font-bold text-gray-900">{plan.title}</h3>
          </div>

          {/* Description */}
          <ul className="space-y-1 text-[14px] text-gray-700 leading-relaxed">
            {plan.desc.map((line, i) => (
              <li key={i} className="whitespace-pre-line">{i === 0 ? '- ' : '* '}{line}</li>
            ))}
          </ul>

        </div>
      </div>

      {/* ─── Divider ─── */}
      <div className="h-2 bg-gray-50" />

      {/* ─── Section Tabs (Sticky below header) ─── */}
      <div className="sticky top-[60px] z-30 bg-white border-b border-gray-200">
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
      <div ref={descRef} className="px-2.5 pt-8">
        <Reveal>
          <h2 className="text-[20px] font-bold text-gray-900 mb-5">서비스 설명</h2>
        </Reveal>

        {pro.isPrime && (
          <Reveal delay={100}>
            <div className="relative overflow-hidden rounded-xl p-5 mb-6 border border-[#3180F7]/15 bg-gradient-to-br from-[#EAF3FF]/40 via-white to-white">
              {/* Glow accent */}
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-[#3180F7]/10 blur-3xl pointer-events-none" />
              <img src="/images/partners-badge.svg" alt="Partners" className="h-[26px] mb-3 relative" />
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
            className="mt-4 w-full py-3.5 border border-gray-200 rounded-xl text-[18px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            더보기
          </button>
        )}

        {/* Image expand notice */}
        <div className="mt-8 bg-gray-50 rounded-xl py-3 flex items-center justify-center gap-2 text-[13px] text-gray-400">
          이미지를 클릭해서 확대 할 수 있어요
          <ArrowUpRight size={14} />
        </div>

        {/* YouTube 영상 리스트 */}
        {pro.youtubeVideos && pro.youtubeVideos.length > 0 && (
          <Reveal delay={200}>
            <div className="mt-8">
              <h3 className="text-[16px] font-bold text-gray-900 mb-3">영상</h3>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x ml-[-2.5px] pl-[2.5px] pr-4">
                {pro.youtubeVideos.map((video) => (
                  <div key={video.id} className="shrink-0 w-[260px] snap-start">
                    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
                      <iframe
                        className="w-full h-full"
                        src={`https://www.youtube.com/embed/${video.id}?modestbranding=1&rel=0&playsinline=1`}
                        title={video.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    <p className="mt-2 text-[13px] font-medium text-gray-700 leading-tight line-clamp-1">{video.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        )}
      </div>

      {/* ─── 프리티풀의 다른 검증된 전문가 ─── */}
      <div className="px-4 pt-10">
        <Reveal>
          <h3 className="text-[17px] font-bold text-gray-900 leading-tight mb-4"><span className="text-[#3180F7]">프리티풀</span>의 다른<br />검증된 전문가를 살펴보세요</h3>
        </Reveal>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x pr-4">
          {pro.alsoViewed.map((item) => (
            <Link
              key={item.id}
              href={`/pros/${item.id}`}
              className="shrink-0 w-[130px] snap-start group"
            >
              <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '3/4' }}>
                <Image src={item.image} alt="" fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                <button
                  onClick={(e) => { e.preventDefault(); toggleCarouselFav(item.id); }}
                  className="absolute top-1.5 right-1.5 active:scale-90 transition-transform"
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M1.85156 7.75662C1.85156 11.7173 5.12524 13.8279 7.52163 15.717C8.36726 16.3836 9.18173 17.0113 9.99619 17.0113C10.8107 17.0113 11.6251 16.3836 12.4707 15.717C14.8671 13.8279 18.1408 11.7173 18.1408 7.75662C18.1408 3.79594 13.6611 0.987106 9.99619 4.79486C6.33124 0.987106 1.85156 3.79594 1.85156 7.75662Z" fill={favoriteItems.has(item.id) ? '#FF4D4D' : 'rgba(0,0,0,0.3)'}/></svg>
                </button>
              </div>
              <div className="mt-1.5">
                <img src="/images/partners-badge.svg" alt="Partners" className="h-[18px] mb-0.5" />
                <p className="text-[13px] font-semibold text-gray-900 leading-tight">사회자 {item.author}</p>
                {item.rating && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <StarRating value={item.rating} size={10} />
                    <span className="text-[11px] font-bold text-gray-900">{item.rating}</span>
                    <span className="text-[10px] text-gray-400">({item.reviewCount})</span>
                  </div>
                )}
                <p className="text-[13px] font-bold text-gray-900 mt-0.5">{item.price.toLocaleString()}원~</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ─── Divider ─── */}
      <div className="h-2 bg-gray-50 mt-8" />

      {/* ─── 전문가 정보 Section ─── */}
      <div ref={infoRef} className="px-2.5 pt-8">
        <h2 className="text-[20px] font-bold text-gray-900 mb-5">전문가 정보</h2>

        <div className="flex items-center gap-4 mb-5">
          <img src={pro.profileImage} alt="" className="w-[60px] h-[60px] rounded-xl object-cover" />
          <div className="flex-1">
            <p className="text-[15px] font-bold text-gray-900">{pro.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <StarRating value={pro.rating} size={12} />
              <span className="text-[12px] font-semibold text-gray-900">{pro.rating} ({pro.reviewCount + 3})</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">연락 가능 시간: {pro.expertStats.contactTime}</p>
            <p className="text-[11px] text-gray-400">평균 응답 시간: {pro.expertStats.responseTime}</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* 총 거래 건수 */}
          <div className="bg-gray-50 rounded-xl px-3 py-3">
            <p className="text-[11px] text-gray-400 mb-2">총 거래 건수</p>
            <div className="flex items-end gap-1 h-[32px] mb-1.5">
              {[35, 52, 68, 75, 82, 89].map((v, i) => (
                <div key={i} className="flex-1 rounded-sm" style={{ height: `${(v / 89) * 100}%`, background: i === 5 ? '#3180F7' : '#E5E7EB' }} />
              ))}
            </div>
            <p className="text-[16px] font-bold text-gray-900">{pro.expertStats.totalDeals}건</p>
          </div>
          {/* 만족도 */}
          <div className="bg-gray-50 rounded-xl px-3 py-3">
            <p className="text-[11px] text-gray-400 mb-2">만족도</p>
            <div className="relative w-full h-[32px] flex items-center justify-center mb-1.5">
              <svg width="48" height="32" viewBox="0 0 48 32">
                <circle cx="24" cy="24" r="20" fill="none" stroke="#E5E7EB" strokeWidth="5" strokeDasharray="94.2 125.7" transform="rotate(-210 24 24)" />
                <circle cx="24" cy="24" r="20" fill="none" stroke="#3180F7" strokeWidth="5" strokeDasharray={`${94.2 * (pro.expertStats.satisfaction / 100)} 125.7`} strokeLinecap="round" transform="rotate(-210 24 24)" />
              </svg>
            </div>
            <p className="text-[16px] font-bold text-gray-900">{pro.expertStats.satisfaction}%</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 rounded-xl px-3 py-3">
            <p className="text-[11px] text-gray-400 mb-1">회원구분</p>
            <p className="text-[16px] font-bold text-gray-900">{pro.expertStats.memberType}</p>
          </div>
          <div className="bg-gray-50 rounded-xl px-3 py-3">
            <p className="text-[11px] text-gray-400 mb-1">세금계산서</p>
            <p className="text-[16px] font-bold text-gray-900">{pro.expertStats.taxInvoice}</p>
          </div>
        </div>

      </div>

      {/* ─── Divider ─── */}
      <div className="h-2 bg-gray-50 mt-10" />

      {/* ─── 리뷰 Section ─── */}
      <div ref={reviewsRef} className="px-2.5 pt-6">
        <h2 className="text-[20px] font-bold text-gray-900 mb-2">리뷰</h2>

        <div className="flex items-center gap-2 mb-2">
          <StarRating value={pro.rating} size={20} />
          <span className="text-[24px] font-bold text-gray-900">{pro.rating}</span>
          <span className="text-[14px] text-gray-400">({pro.reviewCount})</span>
        </div>

        {/* Radar Chart */}
        <RadarChart scores={[
          { label: '경력', value: 5.0 },
          { label: '만족도', value: 4.9 },
          { label: '위트', value: 4.8 },
          { label: '발성', value: 5.0 },
          { label: '이미지', value: 4.9 },
          { label: '구성력', value: 5.0 },
        ]} />

        {/* Score bars */}
        <ScoreBars />


        {/* Reviews list */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-bold text-gray-900">전체 리뷰 {pro.reviewCount}건</h3>
          <button><ChevronRight size={20} className="text-gray-400" /></button>
        </div>

        <div className="space-y-6">
          {pro.reviews.map((review) => (
            <div key={review.id} className="pb-6 border-b border-gray-100 last:border-0 relative">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-[14px]">🚀</div>
                  <span className="text-[14px] text-gray-600">{review.name}</span>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setReviewMenu(reviewMenu === review.id ? null : review.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-[16px] text-gray-400 leading-none">⋯</span>
                  </button>
                  {reviewMenu === review.id && (
                    <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20 min-w-[120px]">
                      <button onClick={() => { toast('리뷰를 신고했습니다', { icon: '🚨' }); setReviewMenu(null); }} className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50">신고하기</button>
                      <button onClick={() => { toast('리뷰를 차단했습니다', { icon: '🚫' }); setReviewMenu(null); }} className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50">차단하기</button>
                      <button onClick={() => { navigator.clipboard.writeText(review.content); toast.success('복사됨'); setReviewMenu(null); }} className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50">복사하기</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 mb-2">
                <StarRating value={review.rating} size={14} />
                <span className="text-[13px] font-bold text-gray-900">{review.rating}</span>
                <span className="text-[12px] text-gray-300">|</span>
                <span className="text-[12px] text-gray-400">{review.date}</span>
              </div>
              {(review as typeof review & { scores?: Record<string, number> }).scores && (
                <div className="flex flex-wrap gap-1 mb-2.5">
                  {Object.entries((review as typeof review & { scores: Record<string, number> }).scores).map(([key, val]) => (
                    <span key={key} className="text-[10px] font-medium px-1.5 rounded-[5px] bg-gray-100 text-gray-600 flex items-center" style={{ height: 22 }}>
                      {key} <span className="font-bold text-[#3180F7] ml-1">{val}</span>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[14px] leading-[1.7] text-gray-800 mb-3 whitespace-pre-line">{review.content}</p>
              <p className="text-[12px] text-gray-400 mb-2">
                행사일 : {review.workDays}일 | 주문 금액 : <span className="font-bold text-gray-600">{review.orderRange}</span>
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

        <button
          onClick={() => router.push(`/pros/${pro.id}/reviews`)}
          className="w-full py-3.5 border border-gray-200 rounded-xl text-[14px] font-medium text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all mt-5"
        >
          리뷰 전체보기
        </button>
      </div>

      {/* ─── Expandable panels ─── */}
      <div className="px-2.5 pt-8">
        {[
          { id: 'info', label: '서비스 정보', content: `• 카테고리: MC / 아나운서\n• 평균 작업 기간: 20일 이내\n• 커뮤니케이션: 1시간 이내 응답\n• 수정 횟수: 1회 포함\n• 취소·환불 정책: 환불 규정 참고` },
          { id: 'revision', label: '수정 및 재진행', content: `• 상품 구매 후 수정 횟수는 1회입니다.\n• 수정 요청은 작업 완료 전 요청 가능합니다.\n• 추가 수정이 필요한 경우 별도 협의가 필요합니다.` },
          { id: 'cancel', label: '취소 및 환불 규정', content: `• 작업 시작 전: 100% 환불\n• 작업 진행 중: 진행률에 따른 일부 환불\n• 작업 완료 후: 환불 불가\n※ 상세 규정은 프리티풀 이용약관을 따릅니다.` },
          { id: 'notice', label: '상품정보고시', content: `• 제공자: ${pro.name}\n• 서비스 제공방식: 온/오프라인\n• 결제 후 계약 내용 변경은 상호 협의에 의해서만 가능합니다.` },
        ].map((panel) => {
          const isOpen = expandedPanel === panel.id;
          return (
            <div key={panel.id} className="border-b border-gray-100 last:border-0">
              <button
                onClick={() => setExpandedPanel(isOpen ? null : panel.id)}
                className="w-full flex items-center justify-between py-4 text-left"
              >
                <span className="text-[15px] font-medium text-gray-900">{panel.label}</span>
                <ChevronDown size={20} className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#3180F7]' : ''}`} />
              </button>
              <div
                className="overflow-hidden transition-all duration-500"
                style={{
                  maxHeight: isOpen ? 400 : 0,
                  opacity: isOpen ? 1 : 0,
                  transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <div className="pb-4 text-[13px] text-gray-500 leading-[1.8] whitespace-pre-line">{panel.content}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Divider ─── */}
      <div className="h-2 bg-gray-50 mt-2" />

      {/* ─── 추천 사회자 ─── */}
      <div className="px-2.5 pt-8 pb-10">
        <h2 className="text-[17px] font-bold text-gray-900 leading-tight mb-4">사회자<br />인기 전문가 어때요?</h2>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-2.5 px-2.5">
          {pro.recommendedPros.map((item) => (
            <Link key={item.id} href={`/pros/${item.id}`} className="shrink-0 w-[130px] group">
              <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '3/4' }}>
                <Image src={item.image} alt={item.name} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                <button
                  onClick={(e) => { e.preventDefault(); toggleCarouselFav(item.id); }}
                  className="absolute top-1.5 right-1.5 active:scale-90 transition-transform"
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M1.85156 7.75662C1.85156 11.7173 5.12524 13.8279 7.52163 15.717C8.36726 16.3836 9.18173 17.0113 9.99619 17.0113C10.8107 17.0113 11.6251 16.3836 12.4707 15.717C14.8671 13.8279 18.1408 11.7173 18.1408 7.75662C18.1408 3.79594 13.6611 0.987106 9.99619 4.79486C6.33124 0.987106 1.85156 3.79594 1.85156 7.75662Z" fill={favoriteItems.has(item.id) ? '#FF4D4D' : 'rgba(0,0,0,0.3)'}/></svg>
                </button>
              </div>
              <div className="mt-1.5">
                {item.isPartner && <img src="/images/partners-badge.svg" alt="Partners" className="h-[18px] mb-0.5" />}
                <p className="text-[13px] font-semibold text-gray-900 leading-tight">{item.role} {item.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <StarRating value={item.rating} size={10} />
                  <span className="text-[11px] font-bold text-gray-900">{item.rating}</span>
                  <span className="text-[10px] text-gray-400">({item.reviews})</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-[9px] font-bold px-1.5 rounded-[4px] bg-primary-50 text-primary-600 flex items-center" style={{ height: 18 }}>경력{item.experience}년</span>
                  {item.tags.slice(0, 1).map((tag) => (
                    <span key={tag} className="text-[9px] font-medium px-1.5 rounded-[4px] bg-gray-100 text-gray-500 flex items-center" style={{ height: 18 }}>{tag}</span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ─── Bottom Fixed Bar ─── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
        style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 12 }}
      >
        {/* 블러 배경 (별도 레이어로 분리) */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, white 30%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.5) 70%, rgba(255,255,255,0) 100%)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            maskImage: 'linear-gradient(to top, black 55%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to top, black 55%, transparent 100%)',
          }}
        />
      <div className="relative pointer-events-auto pt-10">
        <div className="flex items-center gap-3 max-w-[680px] mx-auto">
          {/* Heart (원형) */}
          <button
            onClick={handleToggleFavorite}
            className="w-12 h-12 rounded-full border border-gray-200 bg-white flex items-center justify-center active:scale-90 transition-transform shrink-0 shadow-sm"
          >
            <Heart
              size={20}
              className={isFavorited ? 'fill-[#3180F7] text-[#3180F7]' : 'text-gray-400'}
              style={{ animation: isFavorited ? 'heartPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined }}
            />
          </button>

          {/* 문의하기 + 구매하기 묶음 (알약) */}
          <div className="relative flex-1">
            {/* 말풍선 — overflow-hidden 바깥 */}
            {showTooltip && (
              <div
                className="absolute -top-8 left-[25%] -translate-x-1/2 z-10"
                style={{ animation: 'tooltipBounce 2s ease-in-out infinite' }}
              >
                <div className="bg-[#3180F7] text-white text-[11px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap relative shadow-[0_4px_16px_rgba(49,128,247,0.4)]">
                  평균 응답 1시간 이내
                  <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[#3180F7] rotate-45" />
                </div>
              </div>
            )}
            <div className="flex h-12 rounded-full overflow-hidden shadow-sm">
              <button
                onClick={() => { setShowTooltip(false); router.push(`/chat/${pro.id}`); }}
                className="flex-1 bg-white border border-gray-200 border-r-0 rounded-l-full text-[14px] font-semibold text-gray-700 active:bg-gray-50 transition-colors"
              >
                문의하기
              </button>
              <button
                onClick={handlePurchase}
                className="flex-1 bg-[#3180F7] rounded-r-full text-[14px] font-bold text-white active:scale-[0.98] transition-transform"
              >
                구매하기
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* ─── Image Modal (확대) ─── */}
      {imageModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={() => setImageModal(null)}
          style={{ animation: 'modalFade 0.3s ease-out' }}
        >
          <button
            onClick={() => setImageModal(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white"
          >
            <X size={24} />
          </button>
          <Image src={imageModal} alt="" width={1200} height={1200} className="max-w-[95vw] max-h-[90vh] object-contain rounded-xl" />
        </div>
      )}

      {/* ─── Share Modal ─── */}
      {shareModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setShareModal(false)}
          style={{ animation: 'modalFade 0.3s ease-out' }}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-safe"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'sheetUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4 sm:hidden" />
            <h3 className="text-[18px] font-bold text-gray-900 mb-5">공유하기</h3>
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-3 py-4 px-4 hover:bg-gray-50 rounded-xl transition-colors"
            >
              <div className="w-11 h-11 rounded-full bg-[#EAF3FF] flex items-center justify-center">
                <Link2 size={20} className="text-[#3180F7]" />
              </div>
              <span className="text-[15px] font-medium text-gray-900">링크 복사</span>
            </button>
            <button
              onClick={() => setShareModal(false)}
              className="w-full mt-2 py-3.5 bg-gray-100 rounded-xl text-[14px] font-semibold text-gray-700"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* ─── Phone Modal ─── */}
      {phoneModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setPhoneModal(false)}
          style={{ animation: 'modalFade 0.3s ease-out' }}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-safe"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'sheetUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4 sm:hidden" />
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-[#EAF3FF] flex items-center justify-center mx-auto mb-4">
                <Phone size={28} className="text-[#3180F7]" />
              </div>
              <h3 className="text-[18px] font-bold text-gray-900 mb-2">전화 상담</h3>
              <p className="text-[14px] text-gray-500 mb-6">
                채팅으로 먼저 문의하시면<br />더 빠른 답변을 받을 수 있어요
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPhoneModal(false)}
                  className="flex-1 py-3.5 bg-gray-100 rounded-xl text-[14px] font-semibold text-gray-700"
                >
                  취소
                </button>
                <button
                  onClick={() => { setPhoneModal(false); router.push(`/chat/${pro.id}`); }}
                  className="flex-1 py-3.5 rounded-xl text-[14px] font-bold text-white bg-[#3180F7]"
                >
                  채팅 문의
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Purchase Modal ─── */}
      {purchaseModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setPurchaseModal(false)}
          style={{ animation: 'modalFade 0.3s ease-out' }}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-safe"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'sheetUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4 sm:hidden" />
            <h3 className="text-[18px] font-bold text-gray-900 mb-4">구매 확인</h3>
            <div className="bg-gray-50 rounded-xl p-4 mb-5">
              <p className="text-[12px] text-gray-400 mb-1">{plan.label}</p>
              <p className="text-[15px] font-bold text-gray-900 mb-2">{plan.title}</p>
              <div className="flex items-end justify-between pt-3 border-t border-gray-200">
                <span className="text-[13px] text-gray-500">결제 금액</span>
                <span className="text-[22px] font-bold text-[#3180F7]">{plan.price.toLocaleString()}원</span>
              </div>
            </div>
            <p className="text-[12px] text-gray-400 mb-5 text-center">결제 시 수수료 10%(VAT포함)가 추가돼요</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPurchaseModal(false)}
                className="flex-1 py-3.5 bg-gray-100 rounded-xl text-[14px] font-semibold text-gray-700"
              >
                취소
              </button>
              <button
                onClick={confirmPurchase}
                className="flex-1 py-3.5 rounded-xl text-[14px] font-bold text-white bg-[#3180F7]"
              >
                결제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Reviews Full Modal ─── */}
      {reviewsModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setReviewsModal(false)}
          style={{ animation: 'modalFade 0.3s ease-out' }}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto pb-safe"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'sheetUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
              <h3 className="text-[17px] font-bold text-gray-900">전체 리뷰 ({pro.reviewCount})</h3>
              <button onClick={() => setReviewsModal(false)}>
                <X size={22} className="text-gray-500" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-6">
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
                  <p className="text-[12px] text-gray-400">행사일 : {review.workDays}일 | 주문 금액 : {review.orderRange}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Premium animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes modalFade {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes sheetUp {
          0% { transform: translateY(100%); }
          100% { transform: translateY(0); }
        }
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
        @keyframes bestBounce {
          0% { opacity: 0; transform: translateY(8px) scale(0.5); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bestFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
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
