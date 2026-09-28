'use client';

import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  Search,
  X,
  ChevronUp,
} from 'lucide-react';
import { Suspense } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { discoveryApi, getCachedProList, type ProListItem } from '@/lib/api/discovery.api';
import { HeaderSearchIcon } from '@/components/icons/HeaderIcons';
import { EmptySearchIcon } from '@/components/icons/color';
import { SortArrowsIcon } from '@/components/community/TossIcons';
import { popItemDelay } from '@/lib/pop-menu';
import ProReviewsSheet, { type ReviewSheetPro } from '@/components/pros/ProReviewsSheet';
import ProFeedCard, { matchesGender, mapProFeedItems, PRO_FEED_LIST_PARAMS, type ProFeedItem } from '@/components/pros/ProFeedCard';
import ProToneCard, { type ProToneCardData } from '@/components/pros/ProToneCard';
import ProQuickView, { type QuickViewPro } from '@/components/ProQuickView';
import TitleFilterMenu, { type TitleFilterOption } from '@/components/ui/TitleFilterMenu';

type ProItem = ProFeedItem;

const SORT_OPTIONS = [
  { value: 'popular', label: '추천순', icon: 'medal-check' },
  { value: 'avg_rating', label: '평점순', icon: 'star' },
  { value: 'review_count', label: '리뷰순', icon: 'chat' },
  { value: 'experience', label: '경력순', icon: 'calendar-check' },
];

/** 결혼식 · 행사 사회자 — 홈 섹션(isWeddingTaggedPro · isEventMcPro)과 같은 낱말로 가린다. 아무도 빼지 않고 해당되는 사람을 앞으로만 올린다 */
type McKind = '' | 'wedding' | 'event';
const MC_KIND_WORDS: Record<Exclude<McKind, ''>, string[]> = {
  wedding: ['결혼식'],
  event: ['행사', '기업', '컨퍼런스', '컨벤션', '쇼호스트', 'event'],
};
function proHasWord(pro: ProItem, words: string[]) {
  return [...(pro.categories || []), ...(pro.tags || [])].some((v) => {
    const value = String(v).toLowerCase();
    return words.some((w) => value.includes(w));
  });
}

/** PC 큰 제목 ⌄ 메뉴(알림 ⌄ 어법) — 고르면 주소(?category=)도 같이 바뀐다 */
type PcKind = 'all' | 'wedding' | 'event' | 'foreign' | 'showhost';
const PC_KIND: Record<PcKind, { type: string; mcKind: McKind; category: string }> = {
  all: { type: '전체', mcKind: '', category: '' },
  wedding: { type: '사회자', mcKind: 'wedding', category: '결혼식사회자' },
  event: { type: '사회자', mcKind: 'event', category: '전문행사사회자' },
  foreign: { type: '외국어사회자', mcKind: '', category: '외국어사회자' },
  showhost: { type: '쇼호스트', mcKind: '', category: '쇼호스트' },
};
const kindIcon = (src: string) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt="" className="h-6 w-6 object-contain" draggable={false} />
);
const PC_KIND_OPTIONS: TitleFilterOption<PcKind>[] = [
  { key: 'all', label: '전체 사회자', title: '전체 사회자', icon: kindIcon('/icons/toss/user.svg') },
  { key: 'wedding', label: '결혼식 사회자', title: '결혼식 사회자', icon: kindIcon('/images/category-icons/wedding-mc-icon.png') },
  { key: 'event', label: '행사 사회자', title: '행사 사회자', icon: kindIcon('/images/category-icons/event-mc-icon.png') },
  { key: 'foreign', label: '외국어 사회자', title: '외국어 사회자', icon: kindIcon('/images/category-icons/foreign-mc.png') },
  { key: 'showhost', label: '쇼호스트', title: '쇼호스트', icon: kindIcon('/icons/toss/headphone.svg') },
];

/** '수도권(서울/인천/경기)' → '수도권' */
function toneRegion(pro: ProItem) {
  if (pro.isNationwide) return '전국';
  return String(pro.regions[0] || '').replace(/\(.*?\)/g, '').trim();
}
/** 목록 값 → 홈 사회자 사진 색 카드 값 */
function toToneCard(pro: ProItem): ProToneCardData {
  return {
    id: pro.id,
    name: pro.name,
    image: pro.images[0] || pro.image,
    experience: pro.experience,
    isPartner: pro.isPartner,
    rating: pro.rating,
    reviews: pro.reviews,
    region: toneRegion(pro),
    intro: pro.intro,
    tags: pro.tags,
  };
}

const PAGE_SIZE = 10;
const INITIAL_PRO_LIST_PARAMS = { limit: 80, sort: 'reviews' as const, withTotal: true };
const FULL_PRO_LIST_PARAMS = PRO_FEED_LIST_PARAMS;
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



/** 정렬 칩 — 웨딩숲 '최신순 ⇅' 칩 + 알림 메뉴 어법(모바일 · PC 같이 쓴다) */
function SortMenuChip({
  sortBy,
  onChange,
  open,
  setOpen,
}: {
  sortBy: string;
  onChange: (value: string) => void;
  open: boolean;
  setOpen: (next: boolean | ((prev: boolean) => boolean)) => void;
}) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-[42px] items-center gap-1 rounded-[12px] bg-[#F2F4F6] px-3.5 text-[16px] font-semibold tracking-[-0.3px] text-[#333D4B] transition-colors active:bg-[#E8EBED] lg:hover:bg-[#EAECEF]"
      >
        {SORT_OPTIONS.find((o) => o.value === sortBy)?.label || '추천순'}
        <SortArrowsIcon />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="pop-menu nt-menu absolute left-0 top-[calc(100%+6px)] z-50" style={{ transformOrigin: 'top left' }} role="menu">
            {SORT_OPTIONS.map((opt, i) => (
              <button
                key={opt.value}
                type="button"
                role="menuitemradio"
                aria-checked={sortBy === opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`pop-menu-item nt-menu-item${sortBy === opt.value ? ' on' : ''}`}
                style={popItemDelay(i)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/icons/toss/${opt.icon}.svg`} alt="" />
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const GENDER_TABS = [
  { key: '', label: '전체' },
  { key: 'male', label: '남성사회자' },
  { key: 'female', label: '여성사회자' },
] as const;

/** 성별 탭 — '추천순' 칩과 같은 모양(높이 42 · 모서리 12 · 16 굵게), 고른 탭은 쿨그레이(260926 사장) */
function GenderTabButtons({ value, onChange }: { value: '' | 'male' | 'female'; onChange: (next: '' | 'male' | 'female') => void }) {
  return (
    <>
      {GENDER_TABS.map((t) => {
        const on = value === t.key;
        return (
          <button
            key={t.key || 'all'}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => { if (!on) onChange(t.key); }}
            className={`h-[42px] shrink-0 rounded-[12px] px-3.5 text-[16px] font-semibold tracking-[-0.3px] transition-colors duration-200 active:scale-[0.97] ${
              on ? 'bg-[#4E5968] text-white' : 'bg-[#F2F4F6] text-[#6B7684] active:bg-[#E8EBED] lg:hover:bg-[#EAECEF]'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </>
  );
}

function ProsListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCachedProsRef = useRef<ProItem[] | null>(null);
  if (initialCachedProsRef.current === null) {
    const cached = getCachedProList(FULL_PRO_LIST_PARAMS) || getCachedProList(INITIAL_PRO_LIST_PARAMS);
    initialCachedProsRef.current = cached?.data?.length ? mapProFeedItems(cached.data) : [];
  }
  const [apiPros, setApiPros] = useState<ProItem[]>(() => initialCachedProsRef.current || []);
  const [apiLoaded, setApiLoaded] = useState(() => Boolean(initialCachedProsRef.current?.length));
  useEffect(() => {
    let cancelled = false;
    let idleHandle = 0;
    const apply = (res: { data?: ProListItem[] } | null | undefined) => {
      if (cancelled) return;
      if (res?.data && res.data.length > 0) setApiPros(mapProFeedItems(res.data));
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
  // 남성/여성 사회자(홈 카테고리 칸, 사장 지시 260925) — ?gender=male|female 또는 ?category=남성사회자|여성사회자
  const genderParam = (searchParams.get('gender') || '').toLowerCase();
  const genderFilter: 'male' | 'female' | '' =
    genderParam === 'male' || normalizedCategoryParam === '남성사회자'
      ? 'male'
      : genderParam === 'female' || normalizedCategoryParam === '여성사회자'
        ? 'female'
        : '';

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
  // 결혼식 / 행사 사회자 — 둘 다 전체 사회자를 보여 주되 해당되는 사람을 앞으로(홈 섹션과 같은 낱말)
  const [mcKind, setMcKind] = useState<McKind>(() =>
    ['결혼식사회자', '전문결혼식사회자'].includes(normalizedCategoryParam)
      ? 'wedding'
      : ['전문행사사회자', '행사MC', '행사사회자'].includes(normalizedCategoryParam)
        ? 'event'
        : '',
  );
  const pcKind: PcKind =
    selectedType === '외국어사회자' ? 'foreign'
      : selectedType === '쇼호스트' ? 'showhost'
        : selectedType === '사회자' && mcKind ? mcKind
          : 'all';
  const applyKind = (key: PcKind) => {
    const next = PC_KIND[key];
    setSelectedType(next.type);
    setMcKind(next.mcKind);
    // 주소도 맞춘다(새로고침·공유해도 같은 목록) — 페이지 이동 없이
    try {
      const params = new URLSearchParams(window.location.search);
      if (next.category) params.set('category', next.category);
      else params.delete('category');
      const qs = params.toString();
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
    } catch {}
    window.scrollTo({ top: 0 });
  };
  // PC — 카드를 누르면 목록을 두고 오른쪽 미리보기(홈과 같은 ProQuickView)
  const [quickPro, setQuickPro] = useState<QuickViewPro | null>(null);
  const [preloadId, setPreloadId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [scrolled, setScrolled] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  // 성별 탭(260926 사장 "추천순 옆에 남성사회자·여성사회자 탭") — 처음 값은 ?gender= / ?category=남성·여성사회자
  const [genderTab, setGenderTab] = useState<'' | 'male' | 'female'>(genderFilter);
  // 리뷰 시트(카드 '리뷰')
  const [reviewPro, setReviewPro] = useState<ReviewSheetPro | null>(null);
  const openReviews = (pro: ProItem) => setReviewPro({ id: pro.id, name: pro.name, image: pro.image, rating: pro.rating, reviews: pro.reviews });
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [listSettled, setListSettled] = useState(true);
  const tabSignature = `${selectedRegion}|${sortBy}|${selectedLang}|${selectedType}|${mcKind}|${genderTab}`;
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
  }, [selectedRegion, sortBy, searchQuery, selectedLang, selectedType, genderTab]);

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
      if (genderTab && !matchesGender(p.gender, genderTab)) return false;
      // 결혼식/행사(사회자)는 승인+비숨김 전체 노출 (카테고리 제한 없음)
      // 쇼호스트는 분류가 대부분 '사회자'라 전문 분야 태그로도 본다(분류에만 있으면 1명뿐이었다)
      if (selectedType === '쇼호스트') {
        if (!proHasWord(p, ['쇼호스트'])) return false;
      } else if (selectedType !== '전체' && selectedType !== '외국어사회자' && selectedType !== '사회자' && !(p.categories || []).includes(selectedType)) return false;
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

    // 결혼식 / 행사 사회자 — 해당 낱말이 있는 사람을 앞으로(고른 정렬 순서는 그 안에서 그대로)
    if (selectedType === '사회자' && mcKind) {
      const words = MC_KIND_WORDS[mcKind];
      results = [...results.filter((p) => proHasWord(p, words)), ...results.filter((p) => !proHasWord(p, words))];
    }

    return results;
  }, [selectedRegion, sortBy, searchQuery, selectedLang, selectedType, mcKind, genderTab, ALL_PROS]);

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
        {/* 필터 칩 스켈레톤은 두지 않는다 — 실제 /pros 화면에는 필터 칩 UI가 없어서
            로딩 중에만 칩 5개가 떴다가 사라지며 레이아웃이 튀고, 홈 필터와 달라 보였다. */}
        {/* 카드 뼈대 — 웨딩숲 글 카드 모양(프사 · 이름 · 한 줄 정보 · 소개 · 사진 3장) */}
        <div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-2.5 border-b border-[#F2F4F6] pb-3.5 pt-[18px]">
              <div className="skeleton shrink-0" style={{ width: 42, height: 42, borderRadius: 9999 }} />
              <div className="min-w-0 flex-1">
                <div className="skeleton" style={{ width: '38%', height: 16, borderRadius: 6 }} />
                <div className="skeleton mt-2" style={{ width: '62%', height: 13, borderRadius: 6 }} />
                <div className="skeleton mt-3.5" style={{ width: '82%', height: 15, borderRadius: 6 }} />
                <div className="mt-3.5 grid max-w-[420px] grid-cols-3 gap-[3px] overflow-hidden rounded-[16px]">
                  {[0, 1, 2].map((k) => <div key={k} className="skeleton aspect-[3/4]" style={{ borderRadius: 0 }} />)}
                </div>
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
      {/* ─── PC — 전체 헤더 아래 한 화면(260928 사장 'PC 결혼식·행사 사회자 페이지 카드·화면을 지금 톤앤매너로') ───
          큰 제목 ⌄(분류 — 알림 ⌄ 어법) · 오른쪽 검색칸 · 정렬 칩 + 성별 탭(모바일과 같은 칩) · 홈 사회자 사진 색 카드 격자.
          카드를 누르면 홈처럼 목록을 두고 오른쪽 미리보기. */}
      <div className="hidden min-h-screen bg-white pb-24 lg:block" style={{ letterSpacing: '-0.02em' }}>
        <div className="flex items-end justify-between gap-8 pb-6 pt-10">
          <div className="min-w-0">
            <TitleFilterMenu
              value={pcKind}
              options={PC_KIND_OPTIONS}
              onChange={applyKind}
              titleClassName="text-[30px] leading-[1.3]"
              enterClassName="qd-a-title"
            />
            <p className="qd-a-sub mt-1.5 text-[15px] tracking-[-0.2px] text-[#8B95A1]">
              사회자 <b className="font-semibold text-[#4E5968]">{filtered.length.toLocaleString()}</b>명
              {genderTab ? ` · ${genderTab === 'male' ? '남성' : '여성'}` : ''}
              {searchQuery.trim() ? ` · '${searchQuery.trim()}' 검색 결과` : ''}
            </p>
          </div>
          <label className="qd-a-sub flex h-12 w-[320px] shrink-0 items-center gap-2 rounded-[14px] bg-[#F2F4F6] pl-4 pr-2 transition-colors focus-within:bg-[#EAECEF] xl:w-[360px]">
            <Search size={18} className="shrink-0 text-[#8B95A1]" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Escape') setSearchQuery(''); }}
              placeholder="이름, 소개, 전문 분야로 검색"
              aria-label="사회자 검색"
              className="h-full min-w-0 flex-1 bg-transparent text-[16px] font-medium text-[#191F28] outline-none placeholder:font-normal placeholder:text-[#8B95A1]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="검색어 지우기"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#C9CED6] text-white transition-transform active:scale-90"
              >
                <X size={13} strokeWidth={3} />
              </button>
            )}
          </label>
        </div>

        <div className="qd-a-item flex items-center gap-2" style={{ animationDelay: '0.1s' }} role="tablist" aria-label="정렬 · 성별">
          <SortMenuChip sortBy={sortBy} onChange={setSortBy} open={sortOpen} setOpen={setSortOpen} />
          <span aria-hidden="true" className="mx-1 h-5 w-px bg-[#E5E8EB]" />
          <GenderTabButtons value={genderTab} onChange={(next) => { setGenderTab(next); window.scrollTo({ top: 0 }); }} />
        </div>

        <motion.div
          className="mt-6"
          animate={{
            opacity: listSettled ? 1 : 0.72,
            y: listSettled ? 0 : 8,
          }}
          transition={{ duration: 0.22, ease: PANEL_EASE }}
        >
          {filtered.length > 0 ? (
            <>
              <div key={tabSignature} className="grid grid-cols-4 gap-x-4 gap-y-5 xl:grid-cols-5">
                {paginatedPros.map((pro, index) => (
                  <ProToneCard
                    key={pro.id}
                    pro={toToneCard(pro)}
                    index={index}
                    className="qd-a-item"
                    style={{ animationDelay: `${0.14 + (index % PAGE_SIZE) * 0.04}s` }}
                    onPreload={setPreloadId}
                    onQuickView={(p) => setQuickPro({ id: p.id, name: p.name, image: p.image })}
                  />
                ))}
              </div>
              {hasMore && (
                <div ref={desktopLoadMoreRef} className="flex justify-center py-12">
                  <span className="inline-flex items-center gap-2 text-[14px] font-medium text-[#8B95A1]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#B0B8C1]" />
                    {paginatedPros.length}/{filtered.length} 불러오는 중
                  </span>
                </div>
              )}
              {!hasMore && (
                <div className="flex flex-col items-center gap-3 py-12">
                  {filtered.length > PAGE_SIZE && <p className="text-[14px] text-[#B0B8C1]">모든 사회자를 확인했어요</p>}
                  {/* 예전 PC 머리줄의 '사회자 등록'(전체 헤더로 바꾸며 자리를 옮겼다) */}
                  <Link href="/pro-register" className="inline-flex items-center gap-0.5 text-[14px] font-semibold text-[#6B7684] transition-colors hover:text-[#3182F6]">
                    사회자로 활동하고 싶다면 등록하기
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center py-28 text-center">
              <div className="srch-pop"><EmptySearchIcon size={72} /></div>
              <p className="qd-a-title mt-5 text-[19px] font-bold text-[#191F28]">조건에 맞는 사회자가 없어요</p>
              <p className="qd-a-sub mt-1.5 text-[15px] text-[#8B95A1]">검색어나 조건을 바꿔 다시 찾아보세요</p>
              <button
                type="button"
                onClick={() => { setSelectedRegion('전체'); setSortBy('popular'); setSelectedLang('전체'); applyKind('all'); setGenderTab(''); setSearchQuery(''); }}
                className="qd-a-sub mt-5 inline-flex h-[44px] items-center rounded-[12px] bg-[#E8F3FF] px-5 text-[16px] font-bold tracking-[-0.3px] text-[#3182F6] transition hover:bg-[#DCEBFF] active:scale-[0.97]"
              >
                조건 초기화
              </button>
            </div>
          )}
        </motion.div>

        <ProQuickView pro={quickPro} preloadId={preloadId} onClose={() => setQuickPro(null)} />
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
              // 돋보기 자리(오른쪽)에서 칸이 왼쪽으로 벌어진다 — 검색 화면과 같은 .srch-field(260926 "검색 버튼 홈 것으로 통일")
              <div key="search-input" className="ml-1 flex min-w-0 flex-1 justify-end">
                <div className="srch-field relative flex h-11 w-full items-center gap-2 overflow-hidden rounded-[14px] bg-[#F2F4F6] pl-3.5 pr-2">
                  <Search size={18} className="shrink-0 text-[#8B95A1]" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="이름, 소개로 검색"
                    className="srch-input min-w-0 w-full flex-1 bg-transparent text-[16px] font-medium text-[#191F28] outline-none placeholder:font-normal placeholder:text-[#8B95A1]"
                  />
                  <button
                    onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                    aria-label="검색 닫기"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#C9CED6] text-white transition-transform active:scale-90"
                  >
                    <X size={13} strokeWidth={3} />
                  </button>
                </div>
              </div>
            ) : (
              <h1
                key="title"
                className="text-[18px] font-bold text-gray-900 truncate"
              >
                {genderTab ? (genderTab === 'male' ? '남성 사회자' : '여성 사회자') : isForeignFilter ? '외국어 사회자 통번역' : selectedLang !== '전체' ? `${selectedLang} 사회자` : selectedType === '사회자' && mcKind ? (mcKind === 'wedding' ? '결혼식 사회자' : '행사 사회자') : selectedType !== '전체' ? selectedType : '사회자'}
              </h1>
            )}
          </>
          {!showSearch && <div className="flex-1" />}
          {!showSearch && (
            // 홈 헤더 돋보기와 같은 아이콘(260926 사장 "검색 버튼 홈 것으로 다 통일")
            <button
              onClick={() => setShowSearch(true)}
              aria-label="검색"
              className="-mr-1.5 flex h-11 w-11 shrink-0 items-center justify-center transition-transform active:scale-90"
            >
              <HeaderSearchIcon />
            </button>
          )}
        </div>

      </div>

      {/* 정렬 — 웨딩숲 '최신순 ⇅' 칩 + 알림 메뉴 어법, 옆에 성별 탭(같은 칩 모양 · 고른 탭은 쿨그레이) */}
      <div className="flex items-center gap-2 bg-white px-4 pb-1 pt-2">
        <SortMenuChip sortBy={sortBy} onChange={setSortBy} open={sortOpen} setOpen={setSortOpen} />
        <div
          className="-mr-4 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ maskImage: 'linear-gradient(to right, #000 calc(100% - 24px), transparent)', WebkitMaskImage: 'linear-gradient(to right, #000 calc(100% - 24px), transparent)' }}
          role="tablist"
          aria-label="성별"
        >
          <GenderTabButtons value={genderTab} onChange={(next) => { setGenderTab(next); window.scrollTo({ top: 0 }); }} />
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
                <ProFeedCard key={pro.id} pro={pro} index={i} onOpenReviews={openReviews} />
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
          <div className="flex flex-col items-center px-8 py-20 text-center">
            <div className="srch-pop"><EmptySearchIcon size={64} /></div>
            <p className="qd-a-title mt-4 text-[17px] font-bold text-[#191F28]">조건에 맞는 사회자가 없어요</p>
            <p className="qd-a-sub mt-1 text-[14px] text-[#8B95A1]">검색어나 조건을 바꿔 다시 찾아보세요</p>
            <button
              type="button"
              onClick={() => { setSelectedRegion('전체'); setSortBy('popular'); setSelectedLang('전체'); setSelectedType('전체'); setSearchQuery(''); }}
              className="qd-a-sub mt-4 inline-flex h-[42px] items-center rounded-[11px] bg-[#E8F3FF] px-[18px] text-[16px] font-bold tracking-[-0.3px] text-[#3182F6] transition active:scale-[0.97] active:bg-[#DCEBFF]"
            >
              조건 초기화
            </button>
          </div>
        )}
      </motion.div>

      {/* 리뷰 — 페이지 이동 없이 댓글처럼(260926) */}
      <ProReviewsSheet pro={reviewPro} onClose={() => setReviewPro(null)} />

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
