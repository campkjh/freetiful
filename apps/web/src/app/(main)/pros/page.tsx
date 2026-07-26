'use client';

import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BriefcaseBusiness,
  ChevronLeft,
  Star,
  ChevronDown,
  Search,
  X,
  ChevronUp,
  Grid2X2,
} from 'lucide-react';
import { Suspense } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { discoveryApi, getCachedProList, type ProListItem } from '@/lib/api/discovery.api';

interface ProItem {
  id: string;
  name: string;
  categories: string[];
  regions: string[];
  languages: string[];
  isNationwide: boolean;
  rating: number;
  reviews: number;
  rank: number;
  image: string;
  intro: string;
  price: number;
  experience: number;
  tags: string[];
}

const SORT_OPTIONS = [
  { value: 'popular', label: '추천순' },
  { value: 'avg_rating', label: '평점순' },
  { value: 'review_count', label: '리뷰순' },
  { value: 'experience', label: '경력순' },
];

const PC_NAV_ITEMS = ['결혼식 사회자', '행사 사회자', '외국어 사회자', '쇼호스트'];

const PAGE_SIZE = 10;
const INITIAL_PRO_LIST_PARAMS = { limit: 80, sort: 'reviews' as const, withTotal: true };
const FULL_PRO_LIST_PARAMS = { limit: 500, sort: 'reviews' as const, withTotal: true };
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

function ProListCard({
  pro,
  index,
}: {
  pro: ProItem;
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const prefetchStarted = useRef(false);
  // 처음에 false 로 두면(=opacity-0) IntersectionObserver 가 안 뜨거나 8% 교차에
  // 도달 못한 카드(Android WebView/빠른 스크롤)가 영구히 투명 → 이미지가 부분적으로
  // 안 보임. 첫 화면에 들어오는 카드는 바로 보이게 하고, 관찰자는 "등장 모션"만 담당.
  const [visible, setVisible] = useState(index < PAGE_SIZE);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    // IntersectionObserver 미지원 환경 안전장치
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px 0px', threshold: 0 },
    );
    observer.observe(el);
    // 관찰자가 어떤 이유로든 콜백을 못 쏘는 경우(레이아웃 타이밍/WebView 버그)에도
    // 카드가 영구 투명으로 남지 않도록 한 번 강제 노출.
    const fallback = window.setTimeout(() => setVisible(true), 600);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, [visible]);

  const warmDetail = () => {
    if (prefetchStarted.current || pro.id === 'my-pro') return;
    prefetchStarted.current = true;
    discoveryApi.getProDetail(pro.id).catch(() => {});
  };

  return (
    <div
      ref={ref}
      className={`px-4 py-3 transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
      }`}
      style={{ transitionDelay: `${Math.min(index % PAGE_SIZE, 6) * 35}ms` }}
    >
      <div
        onMouseEnter={warmDetail}
        onTouchStart={warmDetail}
        className="group relative flex gap-3 rounded-xl active:scale-[0.985] transition-transform"
      >
        <Link href={`/pros/${pro.id}`} onFocus={warmDetail} className="absolute inset-0 z-0 rounded-xl" aria-label={`${pro.name} 상세보기`} />
        <div className="pointer-events-none relative z-10 w-[105px] h-[140px] rounded-lg overflow-hidden bg-gray-100 shrink-0">
          <img
            src={pro.image || '/images/default-profile.png'}
            alt={pro.name}
            loading={index < 4 ? 'eager' : 'lazy'}
            decoding="async"
            onError={(e) => { const el = e.currentTarget; if (el.dataset.fb) return; const base = (pro.image || '').split('?')[0]; if (!el.dataset.retry && base) { el.dataset.retry = '1'; setTimeout(() => { el.src = `${base}?r=1`; }, 500); } else { el.dataset.fb = '1'; el.src = '/images/default-profile.png'; } }}
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
            {pro.rank > 0 && pro.rank <= 10 && (
              <span className="shrink-0 rounded-full bg-[#EAF3FF] px-2 py-0.5 text-[10px] font-bold text-[#3180F7]">
                TOP {pro.rank}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-0.5">
              <Star size={13} className="fill-yellow-400 text-yellow-400" />
              <span className="text-[13px] font-bold text-gray-900">{pro.rating}</span>
              <span className="text-[13px] text-gray-400">({pro.reviews})</span>
            </div>
          </div>
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
      </div>
    </div>
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
          {PC_NAV_ITEMS.map((item) => (
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

function DesktopProMarketCard({
  pro,
  index,
}: {
  pro: ProItem;
  index: number;
}) {
  const displayCategory = pro.categories[0] || '사회자';
  const tagItems = [
    pro.experience > 0 ? `경력 ${pro.experience}년` : '',
    ...(pro.isNationwide ? ['전국가능'] : pro.regions.slice(0, 2)),
  ].filter(Boolean);

  return (
    <article className="group min-w-0">
      <div className="relative aspect-[3/4] overflow-hidden rounded-[10px] bg-[#F2F4F7]">
        <Link href={`/pros/${pro.id}`} onMouseEnter={() => discoveryApi.getProDetail(pro.id).catch(() => {})} className="block h-full w-full">
          <img
            src={pro.image || '/images/default-profile.png'}
            alt={pro.name}
            loading={index < 8 ? 'eager' : 'lazy'}
            decoding="async"
            onError={(e) => { const el = e.currentTarget; if (el.dataset.fb) return; const base = (pro.image || '').split('?')[0]; if (!el.dataset.retry && base) { el.dataset.retry = '1'; setTimeout(() => { el.src = `${base}?r=1`; }, 500); } else { el.dataset.fb = '1'; el.src = '/images/default-profile.png'; } }}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
          />
        </Link>
        {pro.rank > 0 && pro.rank <= 12 && (
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
      rank: idx + 1,
      image: p.profileImageUrl || p.images?.[0] || '',
      intro: p.shortIntro || '',
      price: 0,
      experience: p.careerYears || 1,
      tags: (p as any).tags || [],
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
  const [sortBy, setSortBy] = useState('popular');
  // 외국어 사회자 진입 시 언어를 '영어'로 고정하면 안 된다.
  // 언어를 바꿀 UI가 없어 영구 숨김 필터가 되고(중국어/스페인어 전용 사회자가 통째로 사라짐),
  // 홈(languages 보유 여부)과 판정이 갈려 같은 버튼이 화면마다 다른 목록을 냈다.
  // 외국어 여부는 아래 selectedType==='외국어사회자' 조건이 담당한다.
  const [selectedLang, setSelectedLang] = useState('전체');
  const [selectedType, setSelectedType] = useState(initialType);
  const [page, setPage] = useState(1);
  const [scrolled, setScrolled] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [listSettled, setListSettled] = useState(true);
  const tabSignature = `${selectedRegion}|${sortBy}|${selectedLang}|${selectedType}`;
  const didMountTabMotion = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const desktopLoadMoreRef = useRef<HTMLDivElement>(null);

  // 필터/검색 변경 시 1페이지로 + 저장된 스크롤 위치 무효화
  useEffect(() => {
    setPage(1);
    try {
      sessionStorage.removeItem('pros-list-scroll-v1');
    } catch {}
  }, [selectedRegion, sortBy, searchQuery, selectedLang, selectedType]);

  // 스크롤 위치/페이지 상태를 sessionStorage 에 저장 — 상세 다녀온 후 복원
  const scrollSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const save = () => {
      try {
        sessionStorage.setItem(
          'pros-list-scroll-v1',
          JSON.stringify({ page, scrollY: window.scrollY, t: Date.now() }),
        );
      } catch {}
    };
    const onScroll = () => {
      if (scrollSaveTimerRef.current) return;
      scrollSaveTimerRef.current = setTimeout(() => {
        save();
        scrollSaveTimerRef.current = null;
      }, 250);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', save);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', save);
      if (scrollSaveTimerRef.current) clearTimeout(scrollSaveTimerRef.current);
      save();
    };
  }, [page]);

  // 상세 페이지에서 복귀 시 저장된 page/scrollY 로 복원
  // — pros-list-scroll-v1 가 있고 30분 이내면 적용
  const scrollRestoredRef = useRef(false);
  useEffect(() => {
    if (scrollRestoredRef.current) return;
    let saved: { page?: number; scrollY?: number; t?: number } | null = null;
    try {
      const raw = sessionStorage.getItem('pros-list-scroll-v1');
      if (raw) saved = JSON.parse(raw);
    } catch {}
    if (!saved || typeof saved.scrollY !== 'number') return;
    if (saved.t && Date.now() - saved.t > 30 * 60 * 1000) {
      sessionStorage.removeItem('pros-list-scroll-v1');
      return;
    }
    scrollRestoredRef.current = true;
    if (saved.page && saved.page > 1) setPage(saved.page);
    const target = saved.scrollY;
    // 무한스크롤 + 이미지 lazy load 때문에 여러 번 시도
    const stamps = [50, 200, 500, 900];
    const timers = stamps.map((ms) =>
      setTimeout(() => {
        if (Math.abs(window.scrollY - target) > 8) {
          window.scrollTo({ top: target, behavior: 'auto' });
        }
      }, ms),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

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
    const q = searchQuery.trim().toLowerCase();
    let results = ALL_PROS.filter((p) => {
      if (selectedLang !== '전체' && !(p.languages || []).includes(selectedLang)) return false;
      if (selectedType === '외국어사회자' && (!p.languages || p.languages.length === 0)) return false;
      // 결혼식/행사(사회자)는 승인+비숨김 전체 노출 (카테고리 제한 없음)
      if (selectedType !== '전체' && selectedType !== '외국어사회자' && selectedType !== '사회자' && !(p.categories || []).includes(selectedType)) return false;
      // 검색어는 이름·소개·카테고리뿐 아니라 전문분야 태그(주례없는 예식 등)도 대상으로.
      // 태그 표기 흔들림("주례없는"/"주례 없는")을 흡수하려고 공백 제거 후 비교한다.
      if (q) {
        const nq = q.replace(/\s+/g, '');
        const hay = [p.name, p.intro, ...(p.categories || []), ...(p.tags || []), ...(p.languages || [])]
          .filter(Boolean)
          .map((v) => String(v).toLowerCase().replace(/\s+/g, ''));
        if (!hay.some((v) => v.includes(nq))) return false;
      }
      if (!matchesRegion(p, selectedRegion)) return false;
      return true;
    });

    switch (sortBy) {
      case 'avg_rating':
        results = [...results].sort((a, b) => b.rating - a.rating);
        break;
      case 'review_count':
        results = [...results].sort((a, b) => b.reviews - a.reviews);
        break;
      case 'experience':
        results = [...results].sort((a, b) => b.experience - a.experience);
        break;
      default:
        results = [...results].sort((a, b) => a.rank - b.rank);
        break;
    }

    return results;
  }, [selectedRegion, sortBy, searchQuery, selectedLang, selectedType, ALL_PROS]);

  const paginatedPros = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginatedPros.length < filtered.length;
  const maxPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    if (!hasMore) return;
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setPage((p) => Math.min(maxPage, p + 1));
      },
      { rootMargin: '480px 0px', threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, maxPage]);

  useEffect(() => {
    if (!hasMore) return;
    const el = desktopLoadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setPage((p) => Math.min(maxPage, p + 1));
      },
      { rootMargin: '640px 0px', threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, maxPage]);

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

      <div className="mx-auto max-w-[1540px] px-8 py-14">
        <section className="min-w-0">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-5">
            <div />

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
                <div className="grid grid-cols-4 gap-x-8 gap-y-12">
                  {paginatedPros.map((pro, index) => (
                    <DesktopProMarketCard key={pro.id} pro={pro} index={index} />
                  ))}
                </div>
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
                  onClick={() => { setSelectedRegion('전체'); setSortBy('popular'); setSelectedLang('전체'); setSelectedType('전체'); }}
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

    <div className="min-h-screen bg-white lg:hidden" style={{ letterSpacing: '-0.02em', overscrollBehaviorY: 'contain' }}>
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
                className="flex-1 min-w-0 flex items-center gap-2 bg-gray-100 rounded-full px-3.5 py-2 ml-1"
              >
                <Search size={18} className="text-gray-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="이름, 소개로 검색"
                  className="flex-1 min-w-0 w-full bg-transparent text-[16px] text-gray-900 placeholder-gray-400 outline-none"
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
          {!showSearch && <div className="flex-1" />}
          {!showSearch && (
            <button onClick={() => setShowSearch(true)} className="p-1 active:scale-90 transition-transform">
              <Search size={20} className="text-gray-600" />
            </button>
          )}
        </div>

      </div>

      {/* Result count + sort dropdown */}
      <div className="px-4 py-3 flex items-center justify-between gap-3 bg-white">
        <span />
        <div className="flex items-center gap-2">
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

      {/* Pro List */}
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
            <div className="divide-y divide-gray-100">
              {paginatedPros.map((pro, i) => (
                <ProListCard key={pro.id} pro={pro} index={i} />
              ))}
            </div>

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
              onClick={() => { setSelectedRegion('전체'); setSortBy('popular'); setSelectedLang('전체'); setSelectedType('전체'); }}
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
