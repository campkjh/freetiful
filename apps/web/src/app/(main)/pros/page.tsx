'use client';

import { useState, useMemo, useEffect, useLayoutEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BriefcaseBusiness,
  ChevronLeft,
  Star,
  ChevronDown,
  Search,
  SlidersHorizontal,
  X,
  ChevronUp,
  Heart,
  Grid2X2,
  Zap,
} from 'lucide-react';
import { Suspense } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { discoveryApi, getCachedProList, type ProListItem } from '@/lib/api/discovery.api';
import { useAuthStore } from '@/lib/store/auth.store';
import {
  applyFavoriteCountToLocalCaches,
  emitFavoriteChange,
  favoriteApi,
  readStoredFavoriteIds,
  subscribeFavoriteChanges,
  syncStoredFavoriteId,
} from '@/lib/api/favorite.api';

interface ProItem {
  id: string;
  name: string;
  categories: string[];
  regions: string[];
  languages: string[];
  isNationwide: boolean;
  rating: number;
  reviews: number;
  favoriteCount: number;
  puddingRank: number;
  image: string;
  intro: string;
  price: number;
  experience: number;
}

const REGIONS = ['전체', '서울/경기', '강원', '충청', '전라', '경상', '제주'];
const SORT_OPTIONS = [
  { value: 'pudding_rank', label: '인기순' },
  { value: 'avg_rating', label: '평점순' },
  { value: 'review_count', label: '리뷰순' },
  { value: 'price_low', label: '가격 낮은순' },
  { value: 'price_high', label: '가격 높은순' },
  { value: 'experience', label: '경력순' },
];

const PRICE_RANGES = [
  { label: '전체', min: 0, max: Infinity },
  { label: '30만원 이하', min: 0, max: 300000 },
  { label: '30~50만원', min: 300000, max: 500000 },
  { label: '50만원 이상', min: 500000, max: Infinity },
];

const LANGUAGES = ['전체', '영어', '일본어', '중국어'];
const MC_TYPES = ['전체', '사회자', '쇼호스트', '축가/연주', '외국어사회자'];
const PC_NAV_ITEMS = ['결혼식 사회자', '행사 사회자', '외국어 사회자', '쇼호스트', '다수견적'];
const PC_SIDEBAR_GROUPS = [
  { title: '사회자', items: ['전체', '사회자', '외국어사회자'] },
  { title: '행사 진행', items: ['쇼호스트', '축가/연주'] },
  { title: '지역', items: REGIONS },
  { title: '외국어', items: LANGUAGES },
];
const PC_QUOTE_CATEGORY_LABELS = ['결혼식 사회자', '행사 사회자', '외국어 사회자'];

const PAGE_SIZE = 10;
const INITIAL_PRO_LIST_PARAMS = { limit: 24, sort: 'pudding' as const, withTotal: false };
const FULL_PRO_LIST_PARAMS = { limit: 80, sort: 'pudding' as const, withTotal: false };
const TAB_SPRING = { type: 'spring' as const, stiffness: 520, damping: 36, mass: 0.75 };
const PANEL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function runListIdle(cb: () => void, timeout = 900) {
  if (typeof window === 'undefined') return 0;
  const win = window as typeof window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  return win.requestIdleCallback ? win.requestIdleCallback(cb, { timeout }) : window.setTimeout(cb, 250);
}

function cancelListIdle(handle: number) {
  if (typeof window === 'undefined' || !handle) return;
  const win = window as typeof window & { cancelIdleCallback?: (handle: number) => void };
  if (win.cancelIdleCallback) win.cancelIdleCallback(handle);
  window.clearTimeout(handle);
}

function getRegionAliases(region: string) {
  if (region === '전체') return [];
  if (region === '서울/경기') return ['서울/경기', '서울', '경기', '인천', '수도권'];
  if (region === '충청') return ['충청', '충북', '충남', '대전', '세종'];
  if (region === '경상') return ['경상', '경북', '경남', '부산', '대구', '울산'];
  if (region === '전라') return ['전라', '전북', '전남', '광주'];
  return [region];
}

function matchesRegion(pro: ProItem, region: string) {
  if (region === '전체') return true;
  if (pro.isNationwide) return true;
  const aliases = getRegionAliases(region);
  return (pro.regions || []).some((r) => aliases.includes(r));
}

function FilterPill({
  active,
  children,
  onClick,
  layoutId,
  className = '',
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
  layoutId: string;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className={`relative isolate shrink-0 overflow-hidden rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
        active ? 'border-transparent text-white' : 'border-gray-200 bg-white text-gray-600'
      } ${className}`}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-full bg-[#2B313D]"
          transition={TAB_SPRING}
        />
      )}
      <span className="relative">{children}</span>
    </motion.button>
  );
}

function ProListCard({
  pro,
  index,
  isFavorited,
  onToggleFavorite,
}: {
  pro: ProItem;
  index: number;
  isFavorited: boolean;
  onToggleFavorite: (event: MouseEvent, proId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const prefetchStarted = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px 0px', threshold: 0.08 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const warmDetail = () => {
    if (prefetchStarted.current || pro.id === 'my-pro') return;
    prefetchStarted.current = true;
    discoveryApi.getProDetail(pro.id).catch(() => {});
  };

  return (
    <motion.div
      layout="position"
      ref={ref}
      className={`px-4 py-3 transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
      }`}
      style={{ transitionDelay: `${Math.min(index % PAGE_SIZE, 6) * 35}ms` }}
      transition={{ layout: { duration: 0.22, ease: PANEL_EASE } }}
    >
      <div
        onMouseEnter={warmDetail}
        onTouchStart={warmDetail}
        className="group relative flex gap-3 rounded-xl active:scale-[0.985] transition-transform"
      >
        <Link href={`/pros/${pro.id}`} onFocus={warmDetail} className="absolute inset-0 z-0 rounded-xl" aria-label={`${pro.name} 상세보기`} />
        <div className="pointer-events-none relative z-10 w-[105px] h-[140px] rounded-lg overflow-hidden bg-gray-100 shrink-0">
          <img
            src={pro.image || '/images/default-profile.svg'}
            alt={pro.name}
            loading={index < 4 ? 'eager' : 'lazy'}
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {pro.isNationwide && (
            <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[#3180F7] shadow-sm">
              전국
            </span>
          )}
        </div>
        <div className="pointer-events-none relative z-10 flex-1 min-w-0 flex flex-col py-0.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[16px] font-bold text-gray-900 leading-tight">
              {pro.categories[0] || '사회자'} {pro.name}
            </p>
            {pro.puddingRank > 0 && pro.puddingRank <= 10 && (
              <span className="shrink-0 rounded-full bg-[#EAF3FF] px-2 py-0.5 text-[10px] font-bold text-[#3180F7]">
                TOP {pro.puddingRank}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-0.5">
              <Star size={13} className="fill-yellow-400 text-yellow-400" />
              <span className="text-[13px] font-bold text-gray-900">{pro.rating}</span>
              <span className="text-[13px] text-gray-400">({pro.reviews})</span>
            </div>
            <div className="flex items-center gap-0.5">
              <Heart size={12} className="fill-[#FF4D4D] text-[#FF4D4D]" />
              <span className="text-[12px] font-semibold text-gray-500">{pro.favoriteCount.toLocaleString()}</span>
            </div>
          </div>
          <p className="text-[15px] font-bold text-gray-900 mt-1">
            {pro.price ? `${pro.price.toLocaleString()}원~` : '가격 협의'}
          </p>
          <p className="text-[13px] text-gray-500 mt-2 line-clamp-2 leading-snug">
            &ldquo;{pro.intro || '프리티풀 인증 사회자입니다'}&rdquo;
          </p>
          <div className="mt-auto pt-2 flex flex-wrap gap-1">
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
        <button
          type="button"
          onClick={(event) => onToggleFavorite(event, pro.id)}
          className="relative z-20 -mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full active:scale-90 transition-transform"
          aria-label={isFavorited ? '찜 해제' : '찜하기'}
        >
          <Heart
            size={22}
            className={isFavorited ? 'fill-[#3180F7] text-[#3180F7]' : 'text-gray-300'}
          />
        </button>
      </div>
    </motion.div>
  );
}

function DesktopProsHeader({
  searchQuery,
  setSearchQuery,
  selectedType,
  setSelectedType,
}: {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedType: string;
  setSelectedType: (value: string) => void;
}) {
  const applyNav = (label: string) => {
    if (label === '다수견적') return;
    if (label === '외국어 사회자') {
      setSelectedType('외국어사회자');
      return;
    }
    if (label === '쇼호스트') {
      setSelectedType('쇼호스트');
      return;
    }
    setSelectedType('사회자');
  };

  const isActive = (label: string) => {
    if (label === '외국어 사회자') return selectedType === '외국어사회자';
    if (label === '쇼호스트') return selectedType === '쇼호스트';
    if (label === '결혼식 사회자' || label === '행사 사회자') return selectedType === '사회자';
    return false;
  };

  return (
    <header className="border-b border-[#EEF1F5] bg-white">
      <div className="mx-auto flex h-[86px] max-w-[1540px] items-center gap-8 px-8">
        <Link href="/main" className="shrink-0" aria-label="Freetiful 홈">
          <img src="/images/logo-freetiful-wordmark.svg" alt="Freetiful" className="h-[34px] w-auto" />
        </Link>
        <div className="relative h-[60px] w-full max-w-[640px]">
          <Search className="absolute right-7 top-1/2 h-7 w-7 -translate-y-1/2 text-gray-900" strokeWidth={2.4} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="어떤 사회자가 필요하세요?"
            className="h-full w-full rounded-full border border-[#D9DEE7] bg-white pl-8 pr-20 text-[22px] font-semibold text-gray-900 shadow-[0_8px_24px_rgba(15,23,42,0.07)] outline-none transition focus:border-[#3180F7] focus:shadow-[0_10px_30px_rgba(49,128,247,0.12)] placeholder:text-[#A4AAB5]"
          />
        </div>
        <nav className="ml-auto flex items-center gap-8 text-[16px] font-bold text-gray-900">
          <Link href="/biz" className="whitespace-nowrap transition hover:text-[#3180F7]">비즈문의</Link>
          <Link href="/pro-register" className="whitespace-nowrap transition hover:text-[#3180F7]">사회자 등록</Link>
          <Link href="/my" className="whitespace-nowrap transition hover:text-[#3180F7]">마이페이지</Link>
          <Link href="/quote" className="rounded-[14px] bg-[#111318] px-6 py-4 text-white shadow-[0_12px_24px_rgba(17,19,24,0.14)] transition hover:bg-[#3180F7]">
            다수견적
          </Link>
        </nav>
      </div>
      <div className="border-t border-[#F2F4F7]">
        <div className="mx-auto flex h-[72px] max-w-[1540px] items-center gap-9 px-8 text-[18px] font-bold text-gray-900">
          <button type="button" className="flex items-center gap-3 text-[#3180F7]">
            <BriefcaseBusiness className="h-6 w-6" />
            업종별
          </button>
          <span className="h-7 w-px bg-[#E5E8EF]" />
          <button type="button" onClick={() => setSelectedType('전체')} className="flex items-center gap-3 transition hover:text-[#3180F7]">
            <Grid2X2 className="h-5 w-5" />
            전체
            <ChevronDown className="h-5 w-5 text-gray-500" />
          </button>
          {PC_NAV_ITEMS.map((item) => item === '다수견적' ? (
            <Link key={item} href="/quote" className="ml-auto rounded-full bg-[#EAF3FF] px-5 py-2.5 text-[15px] font-extrabold text-[#3180F7] transition hover:bg-[#3180F7] hover:text-white">
              {item}
            </Link>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => applyNav(item)}
              className={`whitespace-nowrap transition ${isActive(item) ? 'text-[#3180F7]' : 'hover:text-[#3180F7]'}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

function DesktopProsSidebar({
  selectedRegion,
  selectedLang,
  selectedType,
  setSelectedRegion,
  setSelectedLang,
  setSelectedType,
}: {
  selectedRegion: string;
  selectedLang: string;
  selectedType: string;
  setSelectedRegion: (value: string) => void;
  setSelectedLang: (value: string) => void;
  setSelectedType: (value: string) => void;
}) {
  const handleClick = (groupTitle: string, item: string) => {
    if (groupTitle === '지역') setSelectedRegion(item);
    else if (groupTitle === '외국어') setSelectedLang(item);
    else setSelectedType(item);
  };
  const isActive = (groupTitle: string, item: string) => {
    if (groupTitle === '지역') return selectedRegion === item;
    if (groupTitle === '외국어') return selectedLang === item;
    return selectedType === item;
  };

  return (
    <aside className="sticky top-8 self-start">
      <h2 className="text-[34px] font-extrabold tracking-[-0.04em] text-gray-950">사회자 마켓</h2>
      <div className="mt-9 space-y-9">
        {PC_SIDEBAR_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-4 text-[17px] font-extrabold text-gray-950">{group.title}</p>
            <div className="space-y-3">
              {group.items.map((item) => (
                <button
                  key={`${group.title}-${item}`}
                  type="button"
                  onClick={() => handleClick(group.title, item)}
                  className={`block text-left text-[16px] font-semibold leading-6 transition ${
                    isActive(group.title, item) ? 'text-[#3180F7]' : 'text-[#5B6270] hover:text-[#3180F7]'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function DesktopProMarketCard({
  pro,
  index,
  isFavorited,
  onToggleFavorite,
}: {
  pro: ProItem;
  index: number;
  isFavorited: boolean;
  onToggleFavorite: (event: MouseEvent, proId: string) => void;
}) {
  const displayCategory = pro.categories[0] || '사회자';
  const tagItems = [
    pro.experience > 0 ? `경력 ${pro.experience}년` : '',
    ...(pro.isNationwide ? ['전국가능'] : pro.regions.slice(0, 2)),
  ].filter(Boolean);

  return (
    <article className="group min-w-0">
      <div className="relative aspect-[16/12] overflow-hidden rounded-[10px] bg-[#F2F4F7]">
        <Link href={`/pros/${pro.id}`} onMouseEnter={() => discoveryApi.getProDetail(pro.id).catch(() => {})} className="block h-full w-full">
          <img
            src={pro.image || '/images/default-profile.svg'}
            alt={pro.name}
            loading={index < 8 ? 'eager' : 'lazy'}
            decoding="async"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
          />
        </Link>
        <button
          type="button"
          onClick={(event) => onToggleFavorite(event, pro.id)}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-[0_8px_18px_rgba(15,23,42,0.12)] transition active:scale-90"
          aria-label={isFavorited ? '찜 해제' : '찜하기'}
        >
          <Heart size={21} className={isFavorited ? 'fill-[#3180F7] text-[#3180F7]' : 'text-gray-400'} />
        </button>
        {pro.puddingRank > 0 && pro.puddingRank <= 12 && (
          <span className="absolute left-3 top-3 rounded-[4px] bg-[#111318] px-2.5 py-1 text-[13px] font-extrabold italic text-white">
            BEST
          </span>
        )}
      </div>
      <Link href={`/pros/${pro.id}`} className="mt-4 block">
        <p className="line-clamp-2 min-h-[54px] text-[19px] font-extrabold leading-[1.42] tracking-[-0.035em] text-gray-950 transition group-hover:text-[#3180F7]">
          {displayCategory} {pro.name}의 프리미엄 진행 서비스
        </p>
        <div className="mt-3 flex items-center gap-1.5 text-[16px]">
          <Star size={16} className="fill-[#5AD36A] text-[#5AD36A]" />
          <span className="font-bold text-gray-950">{pro.rating.toFixed(1)}</span>
          <span className="font-medium text-gray-400">({pro.reviews.toLocaleString()})</span>
        </div>
        <p className="mt-2 text-[20px] font-extrabold tracking-[-0.03em] text-gray-950">
          {pro.price ? `${pro.price.toLocaleString()}원~` : '가격 협의'}
        </p>
        <p className="mt-3 text-[15px] font-semibold text-[#6B7280]">{displayCategory} {pro.name}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tagItems.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-[6px] bg-[#F2F4F7] px-2 py-1 text-[13px] font-semibold text-[#5B6270]">
              {tag}
            </span>
          ))}
        </div>
      </Link>
    </article>
  );
}

function mapApiPros(items: ProListItem[]): ProItem[] {
  const seen = new Set<string>();
  return items
    .filter((p) => {
      const key = p.userId || p.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((p, idx) => ({
      id: p.id,
      name: p.name,
      categories: p.categories || [],
      regions: p.regions || [],
      languages: p.languages || [],
      isNationwide: p.isNationwide ?? false,
      rating: p.avgRating || 0,
      reviews: p.reviewCount || 0,
      favoriteCount: p.favoriteCount ?? 0,
      puddingRank: idx + 1,
      image: p.profileImageUrl || p.images?.[0] || '',
      intro: p.shortIntro || '',
      price: (typeof p.basePrice === 'number' && p.basePrice > 0) ? p.basePrice : 0,
      experience: p.careerYears || 1,
    }));
}

function ProsListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCachedProsRef = useRef<ProItem[] | null>(null);
  if (initialCachedProsRef.current === null) {
    const cached = getCachedProList(FULL_PRO_LIST_PARAMS) || getCachedProList(INITIAL_PRO_LIST_PARAMS);
    initialCachedProsRef.current = cached?.data?.length ? mapApiPros(cached.data) : [];
  }
  const [apiPros, setApiPros] = useState<ProItem[]>(() => initialCachedProsRef.current || []);
  const [apiLoaded, setApiLoaded] = useState(() => Boolean(initialCachedProsRef.current?.length));
  const authUser = useAuthStore((s) => s.user);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(readStoredFavoriteIds()));

  const updateFavoriteCount = (proId: string, valueOrDelta: number, mode: 'set' | 'delta' = 'delta') => {
    applyFavoriteCountToLocalCaches(proId, mode === 'set' ? { favoriteCount: valueOrDelta } : { delta: valueOrDelta });
    setApiPros((prev) => prev.map((item) => {
      if (item.id !== proId) return item;
      const next = mode === 'set' ? valueOrDelta : item.favoriteCount + valueOrDelta;
      return { ...item, favoriteCount: Math.max(0, next) };
    }));
  };

  useEffect(() => {
    return subscribeFavoriteChanges((detail) => {
      if (!detail?.proProfileId || detail.source === 'pros-list-optimistic' || detail.source === 'pros-list-revert') return;
      setFavorites(new Set(readStoredFavoriteIds()));
      if (typeof detail.favoriteCount === 'number') {
        updateFavoriteCount(detail.proProfileId, detail.favoriteCount, 'set');
      } else if (typeof detail.delta === 'number') {
        updateFavoriteCount(detail.proProfileId, detail.delta, 'delta');
      }
    });
  }, []);

  const toggleFavorite = (event: MouseEvent, proId: string) => {
    event.preventDefault();
    event.stopPropagation();
    const isAdding = !favorites.has(proId);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isAdding) next.add(proId);
      else next.delete(proId);
      return next;
    });
    syncStoredFavoriteId(proId, isAdding);
    updateFavoriteCount(proId, isAdding ? 1 : -1);
    emitFavoriteChange({
      proProfileId: proId,
      isFavorited: isAdding,
      delta: isAdding ? 1 : -1,
      source: 'pros-list-optimistic',
    });

    if (authUser) {
      favoriteApi.toggle(proId).catch(() => {
        setFavorites((prev) => {
          const next = new Set(prev);
          if (isAdding) next.delete(proId);
          else next.add(proId);
          return next;
        });
        syncStoredFavoriteId(proId, !isAdding);
        updateFavoriteCount(proId, isAdding ? -1 : 1);
        emitFavoriteChange({
          proProfileId: proId,
          isFavorited: !isAdding,
          delta: isAdding ? -1 : 1,
          source: 'pros-list-revert',
        });
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    let idleHandle = 0;
    const apply = (res: { data?: ProListItem[] } | null | undefined) => {
      if (cancelled) return;
      if (res?.data && res.data.length > 0) setApiPros(mapApiPros(res.data));
    };
    const loadFull = () => {
      discoveryApi.getProList(FULL_PRO_LIST_PARAMS).then(apply).catch(() => {});
    };

    if (initialCachedProsRef.current?.length) {
      setApiLoaded(true);
      idleHandle = runListIdle(loadFull);
    } else {
      discoveryApi.getProList(INITIAL_PRO_LIST_PARAMS)
        .then((res) => {
          apply(res);
          if (!cancelled) idleHandle = runListIdle(loadFull);
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setApiLoaded(true); });
    }

    return () => {
      cancelled = true;
      cancelListIdle(idleHandle);
    };
  }, []);

  // 프로 목록은 서버 데이터만 사용한다. localStorage 등록 캐시는 계정 전환 시 stale 권한을 만들 수 있다.
  const ALL_PROS = useMemo(() => apiPros, [apiPros]);
  const initialRegion = searchParams.get('region') || '전체';
  const categoryParam = searchParams.get('category') || '';
  const initialQuery = searchParams.get('q') || searchParams.get('keyword') || '';
  const normalizedCategoryParam = categoryParam.replace(/[\s/·-]/g, '');
  const isForeignFilter = normalizedCategoryParam === '외국어사회자';

  // 카테고리 파라미터에 따라 초기 필터 설정
  const initialType = categoryParam === '축가·연주' || categoryParam === '축가/연주'
    ? '축가/연주'
    : normalizedCategoryParam === '쇼호스트'
      ? '쇼호스트'
      : isForeignFilter
        ? '외국어사회자'
        : ['사회자', 'MC', '결혼식사회자', '전문결혼식사회자', '전문행사사회자', '행사MC'].includes(normalizedCategoryParam)
          ? '사회자'
          : '전체';

  const [selectedRegion, setSelectedRegion] = useState(initialRegion);
  const [sortBy, setSortBy] = useState('pudding_rank');
  const [showFilter, setShowFilter] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState(0);
  const [selectedLang, setSelectedLang] = useState(isForeignFilter ? '영어' : '전체');
  const [selectedType, setSelectedType] = useState(initialType);
  const [page, setPage] = useState(1);
  const [scrolled, setScrolled] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [listSettled, setListSettled] = useState(true);
  const tabSignature = `${selectedRegion}|${sortBy}|${selectedPrice}|${selectedLang}|${selectedType}`;
  const didMountTabMotion = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const desktopLoadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setPage(1); }, [selectedRegion, sortBy, selectedPrice, searchQuery, selectedLang, selectedType]);

  useLayoutEffect(() => {
    if (!didMountTabMotion.current) {
      didMountTabMotion.current = true;
      return;
    }
    setListSettled(false);
    const frame = window.requestAnimationFrame(() => setListSettled(true));
    return () => window.cancelAnimationFrame(frame);
  }, [tabSignature]);

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Scroll tracker
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 60);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const filtered = useMemo(() => {
    const priceRange = PRICE_RANGES[selectedPrice];
    const q = searchQuery.trim().toLowerCase();
    let results = ALL_PROS.filter((p) => {
      if (selectedLang !== '전체' && !(p.languages || []).includes(selectedLang)) return false;
      if (selectedType === '외국어사회자' && (!p.languages || p.languages.length === 0)) return false;
      if (selectedType !== '전체' && selectedType !== '외국어사회자' && !(p.categories || []).includes(selectedType)) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.intro.toLowerCase().includes(q) && !(p.categories || []).some((c) => c.toLowerCase().includes(q))) return false;
      if (!matchesRegion(p, selectedRegion)) return false;
      if (p.price < priceRange.min || p.price > priceRange.max) return false;
      return true;
    });

    switch (sortBy) {
      case 'avg_rating':
        results = [...results].sort((a, b) => b.rating - a.rating);
        break;
      case 'review_count':
        results = [...results].sort((a, b) => b.reviews - a.reviews);
        break;
      case 'price_low':
        results = [...results].sort((a, b) => a.price - b.price);
        break;
      case 'price_high':
        results = [...results].sort((a, b) => b.price - a.price);
        break;
      case 'experience':
        results = [...results].sort((a, b) => b.experience - a.experience);
        break;
      default:
        results = [...results].sort((a, b) => a.puddingRank - b.puddingRank);
        break;
    }

    return results;
  }, [selectedRegion, sortBy, selectedPrice, searchQuery, selectedLang, selectedType, ALL_PROS]);

  const paginatedPros = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginatedPros.length < filtered.length;
  const hasActiveFilters = selectedRegion !== '전체' || selectedPrice !== 0 || selectedLang !== '전체' || selectedType !== '전체';
  const activeFilterCount = (selectedRegion !== '전체' ? 1 : 0) + (selectedPrice !== 0 ? 1 : 0) + (selectedLang !== '전체' ? 1 : 0) + (selectedType !== '전체' ? 1 : 0);
  const showDualQuoteButtons =
    isForeignFilter
    || selectedType === '외국어사회자'
    || ['전문행사사회자', '행사사회자', '행사MC'].includes(normalizedCategoryParam);

  useEffect(() => {
    if (!hasMore) return;
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setPage((p) => p + 1);
      },
      { rootMargin: '480px 0px', threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, paginatedPros.length]);

  useEffect(() => {
    if (!hasMore) return;
    const el = desktopLoadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setPage((p) => p + 1);
      },
      { rootMargin: '640px 0px', threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, paginatedPros.length]);

  if (!apiLoaded && ALL_PROS.length === 0) {
    return (
      <div className="min-h-screen bg-white px-4 pt-14" style={{ letterSpacing: '-0.02em' }}>
        {/* Header skeleton */}
        <div className="flex items-center gap-3 mb-4">
          <div className="skeleton" style={{ width: 24, height: 24 }} />
          <div className="skeleton" style={{ width: 80, height: 20 }} />
        </div>
        {/* Filter chips skeleton */}
        <div className="flex gap-2 mb-5">
          {[50, 70, 50, 50, 50].map((w, i) => (
            <div key={i} className="skeleton" style={{ width: w, height: 32, borderRadius: 16 }} />
          ))}
        </div>
        {/* List item skeletons */}
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="skeleton shrink-0" style={{ width: 100, height: 100, borderRadius: 12 }} />
              <div className="flex-1 py-1">
                <div className="skeleton mb-2" style={{ width: '60%', height: 16 }} />
                <div className="skeleton mb-2" style={{ width: '80%', height: 12 }} />
                <div className="skeleton mb-2" style={{ width: '40%', height: 12 }} />
                <div className="skeleton" style={{ width: '30%', height: 14 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <LayoutGroup id="pros-list-tabs">
    <>
    <div className="relative left-1/2 hidden min-h-screen w-screen -translate-x-1/2 bg-white lg:block" style={{ letterSpacing: '-0.02em' }}>
      <DesktopProsHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
      />

      <div className="mx-auto grid max-w-[1540px] grid-cols-[230px_minmax(0,1fr)] gap-16 px-8 py-14">
        <DesktopProsSidebar
          selectedRegion={selectedRegion}
          selectedLang={selectedLang}
          selectedType={selectedType}
          setSelectedRegion={setSelectedRegion}
          setSelectedLang={setSelectedLang}
          setSelectedType={setSelectedType}
        />

        <section className="min-w-0">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedType}
                onChange={(event) => setSelectedType(event.target.value)}
                className="h-[46px] rounded-[10px] border border-[#DDE2EA] bg-white px-5 text-[16px] font-bold text-gray-900 outline-none transition focus:border-[#3180F7]"
              >
                {MC_TYPES.map((type) => (
                  <option key={type} value={type}>{type === '전체' ? '카테고리 선택' : type}</option>
                ))}
              </select>
              <select
                value={selectedPrice}
                onChange={(event) => setSelectedPrice(Number(event.target.value))}
                className="h-[46px] rounded-[10px] border border-[#DDE2EA] bg-white px-5 text-[16px] font-bold text-gray-900 outline-none transition focus:border-[#3180F7]"
              >
                {PRICE_RANGES.map((range, index) => (
                  <option key={range.label} value={index}>{range.label === '전체' ? '예산' : range.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="inline-flex h-[46px] items-center gap-2 rounded-[10px] border border-[#DDE2EA] bg-white px-5 text-[16px] font-extrabold italic text-[#6B7280] transition hover:border-[#3180F7] hover:text-[#3180F7]"
              >
                verified
              </button>
              <button
                type="button"
                className="inline-flex h-[46px] items-center gap-2 rounded-[10px] border border-[#DDE2EA] bg-white px-5 text-[16px] font-bold text-gray-900 transition hover:border-[#3180F7] hover:text-[#3180F7]"
              >
                <Zap className="h-4 w-4 fill-[#3180F7] text-[#3180F7]" />
                빠른 응답
              </button>
              <div className="ml-1 flex items-center gap-2">
                {PC_QUOTE_CATEGORY_LABELS.map((label, index) => (
                  <Link
                    key={label}
                    href={index === 1 ? '/quote?mode=event' : '/quote'}
                    className={`h-[46px] rounded-[12px] px-5 text-[15px] font-extrabold leading-[46px] transition ${
                      index === 0
                        ? 'bg-[#3180F7] text-white shadow-[0_12px_24px_rgba(49,128,247,0.22)] hover:bg-[#176CE6]'
                        : 'bg-[#EAF3FF] text-[#3180F7] hover:bg-[#DDEEFF]'
                    }`}
                  >
                    {label} 다수견적
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-5">
              <p className="text-[16px] font-semibold text-[#4B5563]">
                <span className="font-extrabold text-gray-950">{filtered.length.toLocaleString()}</span>개의 서비스
              </p>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="h-[42px] rounded-[9px] border-none bg-white text-[16px] font-bold text-gray-900 outline-none"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <motion.div
            animate={{
              opacity: listSettled ? 1 : 0.72,
              y: listSettled ? 0 : 8,
              filter: listSettled ? 'blur(0px)' : 'blur(1.5px)',
            }}
            transition={{ duration: 0.22, ease: PANEL_EASE }}
          >
            {filtered.length > 0 ? (
              <>
                <motion.div layout className="grid grid-cols-4 gap-x-8 gap-y-12">
                  {paginatedPros.map((pro, index) => (
                    <DesktopProMarketCard
                      key={pro.id}
                      pro={pro}
                      index={index}
                      isFavorited={favorites.has(pro.id)}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </motion.div>
                {hasMore && (
                  <div ref={desktopLoadMoreRef} className="py-12 text-center">
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#F2F6FF] px-4 py-2 text-[14px] font-bold text-[#3180F7]">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-[#3180F7]" />
                      {paginatedPros.length}/{filtered.length} 불러오는 중
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[18px] bg-[#F8FAFC] text-center">
                <Search size={38} className="text-gray-300" />
                <p className="mt-5 text-[18px] font-bold text-gray-500">해당 조건의 사회자가 없습니다</p>
                <button
                  onClick={() => { setSelectedRegion('전체'); setSelectedPrice(0); setSortBy('pudding_rank'); setSelectedLang('전체'); setSelectedType('전체'); }}
                  className="mt-5 rounded-full bg-[#3180F7] px-5 py-3 text-[15px] font-bold text-white"
                >
                  필터 초기화
                </button>
              </div>
            )}
          </motion.div>
        </section>
      </div>
    </div>

    <div className="min-h-screen bg-white lg:hidden" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white">
        <div className="h-[52px] flex items-center px-4 gap-3">
          <button onClick={() => router.back()} className="p-1 -ml-2 shrink-0 active:scale-90 transition-transform">
            <ChevronLeft size={24} className="text-gray-800" />
          </button>
          <>
            {showSearch ? (
              <div
                key="search-input"
                className="flex-1 flex items-center gap-2 bg-gray-100 rounded-full px-3.5 py-2 ml-1"
              >
                <Search size={18} className="text-gray-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="이름, 소개로 검색"
                  className="flex-1 bg-transparent text-[16px] text-gray-900 placeholder-gray-400 outline-none"
                />
                <button
                  onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                  className="p-0.5 active:scale-90 transition-transform"
                >
                  <X size={16} className="text-gray-500" />
                </button>
              </div>
            ) : (
              <h1
                key="title"
                className="text-[18px] font-bold text-gray-900 truncate"
              >
                {isForeignFilter ? '외국어 사회자 통번역' : selectedLang !== '전체' ? `${selectedLang} 사회자` : selectedType !== '전체' ? selectedType : '사회자'}
              </h1>
            )}
          </>
          <div className="flex-1" />
          {!showSearch && (
            <button onClick={() => setShowSearch(true)} className="p-1 active:scale-90 transition-transform">
              <Search size={20} className="text-gray-600" />
            </button>
          )}
        </div>

        {/* Region filter chips + Filter button */}
        <div className="border-b border-gray-100">
          <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide items-center">
            {/* Filter toggle */}
            <motion.button
              type="button"
              onClick={() => setShowFilter(!showFilter)}
              whileTap={{ scale: 0.95 }}
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 text-[13px] font-medium rounded-full border transition-all active:scale-95 ${
                hasActiveFilters
                  ? 'bg-[#2B313D] text-white border-[#2B313D]'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              <SlidersHorizontal size={13} />
              필터
              {activeFilterCount > 0 && (
                <span className="ml-0.5 w-4 h-4 rounded-full bg-white/20 text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              <span
                className={`transition-transform duration-300 ${showFilter ? 'rotate-180' : ''}`}
              >
                <ChevronDown size={12} />
              </span>
            </motion.button>

            <div className="w-px h-5 bg-gray-200 shrink-0" />

            {/* Region chips with animation */}
            {REGIONS.map((region) => (
              <FilterPill
                key={region}
                active={selectedRegion === region}
                onClick={() => setSelectedRegion(region)}
                layoutId="pros-region-active-pill"
              >
                {region}
              </FilterPill>
            ))}
          </div>

          {/* Expandable filter panel */}
          <AnimatePresence initial={false}>
            {showFilter && (
              <motion.div
                key="pros-filter-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.24, ease: PANEL_EASE }}
                className="overflow-hidden"
              >
                <motion.div
                  initial={{ y: -6 }}
                  animate={{ y: 0 }}
                  exit={{ y: -4 }}
                  transition={{ duration: 0.2, ease: PANEL_EASE }}
                  className="px-4 pt-2 pb-4 space-y-4 bg-gray-50/50"
                >
                  {/* Price range */}
                  <div>
                    <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">가격대</p>
                    <div className="flex flex-wrap gap-2">
                      {PRICE_RANGES.map((range, i) => (
                        <FilterPill
                          key={range.label}
                          active={selectedPrice === i}
                          onClick={() => setSelectedPrice(i)}
                          layoutId="pros-price-active-pill"
                          className="text-[12px]"
                        >
                          {range.label}
                        </FilterPill>
                      ))}
                    </div>
                  </div>

                  {/* Sort */}
                  <div>
                    <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">정렬</p>
                    <div className="flex flex-wrap gap-2">
                      {SORT_OPTIONS.map(opt => (
                        <FilterPill
                          key={opt.value}
                          active={sortBy === opt.value}
                          onClick={() => setSortBy(opt.value)}
                          layoutId="pros-sort-active-pill"
                          className="text-[12px]"
                        >
                          {opt.label}
                        </FilterPill>
                      ))}
                    </div>
                  </div>

                  {/* MC Type */}
                  <div>
                    <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">사회자 유형</p>
                    <div className="flex flex-wrap gap-2">
                      {MC_TYPES.map(t => (
                        <FilterPill
                          key={t}
                          active={selectedType === t}
                          onClick={() => setSelectedType(t)}
                          layoutId="pros-type-active-pill"
                          className="text-[12px]"
                        >
                          {t}
                        </FilterPill>
                      ))}
                    </div>
                  </div>

                  {/* Language */}
                  <div>
                    <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">외국어</p>
                    <div className="flex flex-wrap gap-2">
                      {LANGUAGES.map(lang => (
                        <FilterPill
                          key={lang}
                          active={selectedLang === lang}
                          onClick={() => setSelectedLang(lang)}
                          layoutId="pros-lang-active-pill"
                          className="text-[12px]"
                        >
                          {lang}
                        </FilterPill>
                      ))}
                    </div>
                  </div>

                  {/* Reset + Apply */}
                  {hasActiveFilters && (
                    <button
                      onClick={() => { setSelectedRegion('전체'); setSelectedPrice(0); setSortBy('pudding_rank'); setSelectedLang('전체'); setSelectedType('전체'); }}
                      className="text-[12px] text-red-500 font-medium flex items-center gap-1"
                    >
                      <X size={12} />
                      필터 초기화
                    </button>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Result count + sort dropdown */}
      <div className="px-4 py-3 flex items-center justify-between gap-3 bg-white">
        <p className="text-[13px] text-gray-500">
          사회자{' '}
          <motion.span
            key={filtered.length}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: PANEL_EASE }}
            className="inline-block font-bold text-gray-900"
          >
            {filtered.length}
          </motion.span>
          명
        </p>
        <div className="flex items-center gap-2">
          {showDualQuoteButtons ? (
            <>
              <Link href="/quote" className="rounded-full bg-[#F3F8FF] px-3 py-1.5 text-[12px] font-bold text-[#3180F7] active:scale-95 transition-transform">
                결혼식 다수견적
              </Link>
              <Link href="/quote?mode=event" className="rounded-full bg-[#3180F7] px-3 py-1.5 text-[12px] font-bold text-white shadow-[0_6px_14px_rgba(49,128,247,0.18)] active:scale-95 transition-transform">
                행사 다수견적
              </Link>
            </>
          ) : (
            <Link href="/quote" className="rounded-full bg-[#3180F7] px-3 py-1.5 text-[12px] font-bold text-white shadow-[0_6px_14px_rgba(49,128,247,0.18)] active:scale-95 transition-transform">
              다수견적
            </Link>
          )}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-[12px] text-gray-500 bg-transparent outline-none cursor-pointer"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Pro List — 찜목록 스타일 (가로형 카드) */}
      <motion.div
        ref={listRef}
        animate={{
          opacity: listSettled ? 1 : 0.72,
          y: listSettled ? 0 : 8,
          filter: listSettled ? 'blur(0px)' : 'blur(1.5px)',
        }}
        transition={{ duration: 0.22, ease: PANEL_EASE }}
      >
        {filtered.length > 0 ? (
          <div>
            <motion.div layout className="divide-y divide-gray-100">
              {paginatedPros.map((pro, i) => (
                <ProListCard
                  key={pro.id}
                  pro={pro}
                  index={i}
                  isFavorited={favorites.has(pro.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </motion.div>

            {hasMore && (
              <div ref={loadMoreRef} className="px-4 py-5">
                <div className="flex items-center justify-center gap-2 text-[12px] font-medium text-gray-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-pulse" />
                  {paginatedPros.length}/{filtered.length} 불러오는 중
                </div>
              </div>
            )}

            {!hasMore && filtered.length > PAGE_SIZE && (
              <p className="text-center text-[13px] text-gray-400 py-6">
                모든 사회자를 확인했습니다
              </p>
            )}

            <div className="h-20 lg:h-0" />
          </div>
        ) : (
          <div
            className="flex flex-col items-center py-20"
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-gray-100">
              <Search size={28} className="text-gray-300" />
            </div>
            <p className="text-gray-400 text-[14px] mb-1">해당 조건의 사회자가 없습니다</p>
            <button
              onClick={() => { setSelectedRegion('전체'); setSelectedPrice(0); setSortBy('pudding_rank'); setSelectedLang('전체'); setSelectedType('전체'); }}
              className="text-primary-500 text-[13px] font-semibold mt-2"
            >
              필터 초기화
            </button>
          </div>
        )}
      </motion.div>

      {/* Scroll to top FAB */}
      <>
        {scrolled && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-24 right-4 z-30 w-10 h-10 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center"
          >
            <ChevronUp size={18} className="text-gray-600" />
          </button>
        )}
      </>
    </div>
    </>
    </LayoutGroup>
  );
}

export default function ProsListPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <ProsListContent />
    </Suspense>
  );
}
