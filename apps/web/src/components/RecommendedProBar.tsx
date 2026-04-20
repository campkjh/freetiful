'use client';

import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { discoveryApi, type RecommendedPro } from '@/lib/api/discovery.api';

// 알약 부모의 사이즈를 측정해서 SVG로 라운드 사각형(알약) 윤곽선을 그리고
// 그 path를 따라 짧은 흰색 stroke가 흘러가는 효과 (Web Animations API)
function PillBorderTrain() {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 사이즈 변경 시마다 stroke-dashoffset 애니메이션 재시작
  useEffect(() => {
    const path = pathRef.current;
    if (!path || size.w === 0) return;
    const perimeter = path.getTotalLength();
    const trainLen = perimeter * 0.12;
    path.setAttribute('stroke-dasharray', `${trainLen} ${perimeter - trainLen}`);
    path.style.animation = `pillDash ${Math.max(2.5, perimeter / 80)}s linear infinite`;
  }, [size]);

  if (size.w === 0) {
    return <svg ref={svgRef} className="absolute inset-0 pointer-events-none" />;
  }

  const w = size.w;
  const h = size.h;
  const r = h / 2;

  // 알약 path - 시계방향, 1.5px 안쪽 (stroke가 박스 안에 보이도록)
  const inset = 1;
  const left = inset;
  const top = inset;
  const right = w - inset;
  const bottom = h - inset;
  const radius = (h - inset * 2) / 2;

  const path = `M ${left + radius},${top} L ${right - radius},${top} A ${radius},${radius} 0 0 1 ${right - radius},${bottom} L ${left + radius},${bottom} A ${radius},${radius} 0 0 1 ${left + radius},${top} Z`;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      style={{ overflow: 'visible' }}
    >
      <path
        ref={pathRef}
        d={path}
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        style={{
          filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.85)) drop-shadow(0 0 6px rgba(255,255,255,0.5))',
        }}
      />
    </svg>
  );
}

type Phase = 'init' | 'circleIn' | 'expanding' | 'expanded' | 'collapsing' | 'closed';

// Fallback data in case API is unreachable
const FALLBACK_PROS = [
  { id: '15', name: '박인애', image: '/images/pro-15/IMG_0196.avif' },
  { id: '23', name: '이승진', image: '/images/pro-23/IMG_46511771924269213.avif' },
  { id: '12', name: '문정은', image: '/images/pro-12/IMG_27221772621229571.avif' },
  { id: '31', name: '전해별', image: '/images/pro-31/025209A2-09A8-4777-9A6A-DF4751F560A71772850104015.avif' },
];

export default function RecommendedProBar() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('init');
  const [recommended, setRecommended] = useState<{ id: string; name: string; image: string } | null>(null);
  const [isScrolling, setIsScrolling] = useState(false); // 스크롤 중이면 원형 축소

  // Fetch daily recommendation from API
  useEffect(() => {
    discoveryApi.getDailyRecommendation()
      .then((data) => {
        if (data) setRecommended({ id: data.id, name: data.name, image: data.image });
      })
      .catch(() => {
        // Fallback to local rotation
        const idx = Math.floor(Date.now() / 86400000) % FALLBACK_PROS.length;
        setRecommended(FALLBACK_PROS[idx]);
      });
  }, []);

  useEffect(() => {
    // init(scale 0) → circleIn(scale 1, 원형 등장) → expanding(원→알약) → expanded
    const t1 = setTimeout(() => setPhase('circleIn'), 500);
    const t2 = setTimeout(() => setPhase('expanding'), 1200);
    const t3 = setTimeout(() => setPhase('expanded'), 1850);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // 스크롤 시 원형으로 축소, 멈추면 다시 알약으로 펼침
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let timer: NodeJS.Timeout | null = null;
    const onScroll = () => {
      const current = window.scrollY;
      const diff = Math.abs(current - lastScrollY);
      if (diff > 3) setIsScrolling(true);
      lastScrollY = current;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setIsScrolling(false), 300);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (phase === 'closed' || !recommended) return null;

  // 스크롤 중에는 원형 형태로 강제 (expanded 상태에서도)
  const isPillPhase = (phase === 'expanding' || phase === 'expanded') && !isScrolling;

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPhase('collapsing');
    setTimeout(() => setPhase('closed'), 600);
  };

  const handleClick = () => {
    if (phase !== 'expanded') return;
    router.push(`/pros/${recommended.id}`);
  };

  // 등장 애니메이션 - scale 0 → 1.1 → 1 바운스 + 모션블러
  const initStyle =
    phase === 'init'
      ? { transform: 'scale(0)', opacity: 0, filter: 'blur(12px)' }
      : phase === 'collapsing'
      ? { transform: 'scale(0)', opacity: 0, filter: 'blur(10px)' }
      : { transform: 'scale(1)', opacity: 1, filter: 'blur(0)' };

  return (
    <div
      className="lg:hidden fixed left-0 right-0 z-40 px-4 pointer-events-none"
      style={{ bottom: 'calc(80px + env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-lg mx-auto flex justify-start pointer-events-auto">
        <button
          type="button"
          onClick={handleClick}
          className="relative inline-flex items-center bg-black/90 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.18)] active:scale-[0.97] origin-left"
          style={{
            borderRadius: 9999,
            height: 52,
            paddingLeft: 6,
            paddingRight: isPillPhase ? 16 : 6,
            gap: isPillPhase ? 10 : 0,
            ...initStyle,
            transition:
              phase === 'circleIn'
                ? 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease, filter 0.6s ease'
                : phase === 'expanding'
                ? 'padding 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), gap 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
                : phase === 'collapsing'
                ? 'transform 0.55s cubic-bezier(0.7, 0, 0.84, 0), opacity 0.55s ease, filter 0.55s ease, padding 0.4s ease, gap 0.4s ease'
                : 'none',
            transformOrigin: 'left center',
          }}
        >
          {/* 보더 위를 도는 흰색 광선 - SVG 라운드 path stroke 따라 정확히 흐름 */}
          {phase === 'expanded' && <PillBorderTrain />}

          {/* 좌측 - 원형 프로필 */}
          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-700 shrink-0">
            <img
              src={recommended.image}
              alt={recommended.name}
              draggable={false}
              className="w-full h-full object-cover"
            />
          </div>

          {/* 텍스트 영역 - 알약 펼쳐졌을 때만 표시 */}
          {isPillPhase && (
            <div
              className="overflow-hidden text-left whitespace-nowrap"
              style={{
                opacity: phase === 'expanded' ? 1 : 0,
                transform: phase === 'expanded' ? 'translateX(0)' : 'translateX(-8px)',
                filter: phase === 'expanded' ? 'blur(0)' : 'blur(4px)',
                transition: 'opacity 0.4s ease 0.15s, transform 0.4s ease 0.15s, filter 0.4s ease 0.15s',
              }}
            >
              <p className="text-[10px] font-semibold text-white/60 leading-tight">
                사회자 {recommended.name}
              </p>
              <p className="text-[14px] font-bold text-white leading-tight">
                오늘의 추천 전문가
              </p>
            </div>
          )}

          {/* X 닫기 버튼 */}
          {isPillPhase && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all shrink-0 cursor-pointer"
              style={{
                opacity: phase === 'expanded' ? 1 : 0,
                transform: phase === 'expanded' ? 'scale(1)' : 'scale(0.5)',
                transition: 'opacity 0.3s ease 0.25s, transform 0.3s ease 0.25s',
                pointerEvents: phase === 'expanded' ? 'auto' : 'none',
              }}
              aria-label="닫기"
            >
              <X size={16} strokeWidth={2.5} />
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
