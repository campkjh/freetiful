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
import { HeaderSearchIcon } from '@/components/icons/HeaderIcons';
import { EmptySearchIcon } from '@/components/icons/color';
import { TossCommentIcon, TossShareIcon, SortArrowsIcon } from '@/components/community/TossIcons';
import { popItemDelay } from '@/lib/pop-menu';
import toast from 'react-hot-toast';

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
  /** 'male'·'female' 또는 '남성'·'여성'(가입 시기마다 표기가 다름) · 빈 값 */
  gender: string;
  /** 포트폴리오 사진(목록 API 최대 4장, 첫 장은 보통 프로필) */
  images: string[];
  /** 소개 영상 — 여러 개면 줄바꿈으로 이어 붙어 온다 */
  youtubeUrl: string;
}

/** 남성/여성 사회자 거르기 — DB 값이 male/female 과 남성/여성 두 가지라 둘 다 본다 */
function matchesGender(value: string, want: 'male' | 'female') {
  const v = (value || '').trim().toLowerCase();
  return want === 'male' ? v === 'male' || v.includes('남') : v === 'female' || v.includes('여');
}

const SORT_OPTIONS = [
  { value: 'popular', label: '추천순', icon: 'medal-check' },
  { value: 'avg_rating', label: '평점순', icon: 'star' },
  { value: 'review_count', label: '리뷰순', icon: 'chat' },
  { value: 'experience', label: '경력순', icon: 'calendar-check' },
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

/** 소개 영상 첫 주소(여러 개면 줄바꿈으로 이어 붙어 온다) */
function firstVideoUrl(value: string) {
  return String(value || '').split(/\s+/).find((u) => /^https?:\/\//i.test(u)) || '';
}

/** '수도권(서울/인천/경기)' → '수도권' */
function shortRegionLabel(region?: string) {
  return String(region || '').replace(/\(.*?\)/g, '').trim();
}

/**
 * 사회자 한 줄 — 웨딩숲 글 카드(.tcard) 계층(260926 사장 "사회자 리스트도 웨딩숲 느낌으로").
 *  프사 42 · 이름 16 굵게 + TOP 뱃지('열혈 작가' 노랑 톤) · 한 줄 정보 14 회색 · 오른쪽 '문의'(팔로우 버튼 톤) ·
 *  소개 16.5 · 사진 3장(세로 3:4 · 모서리 16 · 3px 틈 — 웨딩숲 사진 모음) · 행사 태그 칩(회색 · 모서리 6) · 아래 리뷰·영상·공유 줄.
 *  카드 전체가 상세로 가는 링크(바닥에 깔고), 버튼·링크만 위로 누를 수 있게 둔다.
 */
function ProFeedCard({
  pro,
  index,
}: {
  pro: ProItem;
  index: number;
}) {
  const prefetchStarted = useRef(false);
  const warmDetail = () => {
    if (prefetchStarted.current || pro.id === 'my-pro') return;
    prefetchStarted.current = true;
    discoveryApi.getProDetail(pro.id).catch(() => {});
  };
  const detailHref = `/pros/${pro.id}`;
  const avatar = pro.image || pro.images[0] || '/images/default-profile.png';
  // 사진 모음 — 프로필과 같은 첫 장은 빼고 최대 3장
  const photos = pro.images.filter((src) => src && src !== pro.image).slice(0, 3);
  const region = pro.isNationwide ? '전국' : shortRegionLabel(pro.regions[0]);
  const chips = Array.from(new Set([
    ...pro.tags.slice(0, 3),
    ...pro.languages.filter((l) => /[가-힣]/.test(l) && l !== '한국어').slice(0, 1).map((l) => `${l} 진행`),
  ])).slice(0, 4);
  const video = firstVideoUrl(pro.youtubeUrl);
  const share = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const url = `${window.location.origin}${detailHref}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${pro.name} 사회자 · 프리티풀`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast('링크를 복사했어요');
      }
    } catch { /* 공유 창을 닫았다 */ }
  };
  const actCls = 'pointer-events-auto inline-flex items-center gap-1.5 px-0.5 py-1 text-[16px] font-medium tracking-[-0.2px] text-[#6B7684] transition-transform active:scale-[0.92]';
  // 사진이 한 번 실패하면 0.5초 뒤 한 번 더(안드 웹뷰 일시 실패), 그래도 안 되면 기본 그림 — 옛 카드의 처리 유지
  const onImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    if (el.dataset.fb) return;
    const base = (el.getAttribute('src') || '').split('?')[0];
    if (!el.dataset.retry && base && !base.includes('default-profile')) {
      el.dataset.retry = '1';
      window.setTimeout(() => { el.src = `${base}?r=1`; }, 500);
      return;
    }
    el.dataset.fb = '1';
    el.src = '/images/default-profile.png';
  };

  return (
    <article
      className="qd-a-item relative flex gap-2.5 border-b border-[#F2F4F6] px-4 pb-3.5 pt-[18px] transition-colors active:bg-[#FAFBFC]"
      style={{ animationDelay: `${0.06 + (index % PAGE_SIZE) * 0.045}s` }}
      onMouseEnter={warmDetail}
      onTouchStart={warmDetail}
    >
      <Link href={detailHref} onFocus={warmDetail} className="absolute inset-0 z-0" aria-label={`${pro.name} 사회자 보기`} />
      {/* 왼쪽 — 프사 42 */}
      <div className="pointer-events-none relative z-[1] w-[42px] shrink-0">
        <div className="h-[42px] w-[42px] overflow-hidden rounded-full bg-[#F2F4F6]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatar} alt="" loading={index < 6 ? 'eager' : 'lazy'} decoding="async" onError={onImgError} className="h-full w-full object-cover" />
        </div>
      </div>
      <div className="pointer-events-none relative z-[1] min-w-0 flex-1">
        {/* 이름 줄 + 한 줄 정보 / 오른쪽 '문의' */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 pt-px">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-[16px] font-bold tracking-[-0.3px] text-[#191F28]">{pro.name}</span>
              {pro.rank > 0 && pro.rank <= 10 && (
                <span className="inline-flex h-6 shrink-0 items-center rounded-[6px] bg-[#FFF6DB] px-[7px] text-[13.5px] font-semibold tracking-[-0.2px] text-[#D99A00]">
                  TOP {pro.rank}
                </span>
              )}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-1 text-[14px] tracking-[-0.2px] text-[#8B95A1]">
              {pro.reviews > 0 ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
                    <path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill="#FFC933" />
                  </svg>
                  <span className="font-semibold text-[#4E5968]">{Number(pro.rating || 0).toFixed(1)}</span>
                  <span>· 리뷰 {pro.reviews}</span>
                </>
              ) : (
                <span className="font-semibold text-[#3182F6]">새로 온 사회자</span>
              )}
              {pro.experience > 0 && <span>· 경력 {pro.experience}년</span>}
              {region && <span>· {region}</span>}
            </p>
          </div>
          {/* 웨딩숲 '팔로우' 자리 — 문의(상세의 문의 창을 바로 연다) */}
          <Link
            href={`${detailHref}?inquiry=1`}
            onClick={warmDetail}
            className="pointer-events-auto flex h-[34px] shrink-0 items-center rounded-[10px] bg-[#E8F3FF] px-3 text-[15px] font-semibold tracking-[-0.2px] text-[#3182F6] transition active:scale-[0.97] active:bg-[#D6E9FF]"
          >
            문의
          </Link>
        </div>

        {/* 본문 — 소개 */}
        <p className="mt-3 line-clamp-2 whitespace-pre-line break-words text-[16.5px] leading-[1.65] tracking-[-0.3px] text-[#191F28]">
          {pro.intro || '프리티풀 인증 사회자예요'}
        </p>

        {/* 사진 모음 — 웨딩숲 사진 칸(모서리 16 · 3px 틈), 세로 3:4 */}
        {photos.length > 0 && (
          <div className="mt-3.5 grid max-w-[420px] grid-cols-3 gap-[3px] overflow-hidden rounded-[16px]">
            {photos.map((src, i) => (
              <div key={src + i} className="aspect-[3/4] overflow-hidden bg-[#F2F4F6]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" loading={index < 3 ? 'eager' : 'lazy'} decoding="async" onError={onImgError} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* 태그 칩 — 웨딩숲 카테고리 칩 */}
        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {chips.map((chip) => (
              <span key={chip} className="rounded-[6px] bg-[#F2F4F6] px-[9px] py-1 text-[13px] font-semibold text-[#6B7684]">{chip}</span>
            ))}
          </div>
        )}

        {/* 아래 줄 — 리뷰 · 영상 · 공유(웨딩숲 좋아요·댓글·공유 줄 어법) */}
        <div className="mt-3.5 flex items-center gap-5">
          <Link href={`${detailHref}/reviews`} className={actCls} aria-label={`리뷰 ${pro.reviews}개 보기`}>
            <TossCommentIcon />
            {pro.reviews}
          </Link>
          {video && (
            <a href={video} target="_blank" rel="noopener noreferrer" className={actCls} onClick={(e) => e.stopPropagation()}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
                <rect x="3.6" y="5.6" width="16.8" height="12.8" rx="3.4" stroke="currentColor" strokeWidth="1.8" />
                <path d="M10.4 9.4v5.2l4.4-2.6-4.4-2.6Z" fill="currentColor" />
              </svg>
              영상
            </a>
          )}
          <button type="button" onClick={share} className={actCls} aria-label="공유하기">
            <TossShareIcon />
            공유
          </button>
        </div>
      </div>
    </article>
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
          {/* pointer-events-none — 아이콘이 input 위에 겹쳐 그려져 그 부분 클릭이 먹히지 않던 문제 */}
          <Search className="pointer-events-none absolute right-7 top-1/2 h-7 w-7 -translate-y-1/2 text-gray-900" strokeWidth={2.4} />
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
      gender: p.gender || '',
      images: Array.isArray(p.images) ? p.images.filter(Boolean) : [],
      youtubeUrl: p.youtubeUrl || '',
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
  const [page, setPage] = useState(1);
  const [scrolled, setScrolled] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
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
      if (genderFilter && !matchesGender(p.gender, genderFilter)) return false;
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
  }, [selectedRegion, sortBy, searchQuery, selectedLang, selectedType, genderFilter, ALL_PROS]);

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
                {genderFilter ? (genderFilter === 'male' ? '남성 사회자' : '여성 사회자') : isForeignFilter ? '외국어 사회자 통번역' : selectedLang !== '전체' ? `${selectedLang} 사회자` : selectedType !== '전체' ? selectedType : '사회자'}
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

      {/* 정렬 — 웨딩숲 '최신순 ⇅' 칩 + 알림 메뉴 어법, 오른쪽에 몇 명인지 */}
      <div className="flex items-center justify-between gap-3 bg-white px-4 pb-1 pt-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setSortOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={sortOpen}
            className="inline-flex h-[42px] items-center gap-1 rounded-[12px] bg-[#F2F4F6] px-3.5 text-[16px] font-semibold tracking-[-0.3px] text-[#333D4B] transition-colors active:bg-[#E8EBED]"
          >
            {SORT_OPTIONS.find((o) => o.value === sortBy)?.label || '추천순'}
            <SortArrowsIcon />
          </button>
          {sortOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} />
              <div className="pop-menu nt-menu absolute left-0 top-[calc(100%+6px)] z-50" style={{ transformOrigin: 'top left' }} role="menu">
                {SORT_OPTIONS.map((opt, i) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={sortBy === opt.value}
                    onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
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
        <span className="text-[14px] tracking-[-0.2px] text-[#8B95A1]">사회자 {filtered.length}명</span>
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
                <ProFeedCard key={pro.id} pro={pro} index={i} />
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
