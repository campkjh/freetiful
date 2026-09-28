'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUp,
  ChevronLeft,
  ChevronUp,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { LayoutGroup, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api/client';
import { WEDDING_PARTNER_CATEGORY_ICONS, WEDDING_PARTNER_CATEGORY_TABS, type WeddingPartnerCategory } from '@/lib/business-categories';
import { SortArrowsIcon } from '@/components/community/TossIcons';
import { popItemDelay } from '@/lib/pop-menu';
import {
  isPopularBusinessPartner,
  sortPopularPartnersFirst,
} from '@/lib/business-popularity';
import {
  getRelevantBusinessCategories,
  isBusinessRelevantToAnyCategory,
  isBusinessRelevantToCategory,
  sanitizeBusinessImageUrls,
} from '@/lib/business-quality';
import { deriveBusinessTagSuggestions, extractBusinessTagsFromHtml, normalizeBusinessTags } from '@/lib/business-tags';
import VilladegdHero from '@/components/VilladegdHero';
import PartnerToneCard, { type PartnerToneCardData } from '@/components/business/PartnerToneCard';
import {
  getWeddingPartnerImageSet,
  getWeddingPartnerSectionCategories,
  mergeWeddingPartnerImages,
} from '@/lib/wedding-partner-images';

// ─── Types ─────────────────────────────────────────────────
interface RankItem {
  id: string;
  rank: number;
  category: string;
  title: string;
  region: string;
  clinic: string;
  rating: number;
  reviewCount: number;
  originalPrice?: number;
  discountPercent?: number;
  finalPrice: number;
  hasAppPay: boolean;
  hasAppBooking: boolean;
  image: string;
  imageFallback: string;
  /** 웨딩숲 카드 사진 모음(앞 4장) — 옛 캐시엔 없을 수 있다 */
  images?: string[];
  /** 사진 총 장수 */
  photoCount?: number;
  tags: string[];
  verifiedBadge?: string;
  isPopular?: boolean;
}

interface ListBanner {
  id: string;
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  linkUrl?: string | null;
  bgColor?: string | null;
  placement?: string;
}

// ─── Mock Data ─────────────────────────────────────────────
const REGIONS = ['전국', '경기', '서울', '부산', '인천', '대구', '충남/세종'];

const SUB_CATEGORIES = WEDDING_PARTNER_CATEGORY_TABS;
/** PC 정렬 — 사회자 목록 '추천순 ⇅' 칩 + 알림 메뉴 어법 */
const BUSINESS_SORT_OPTIONS = [
  { value: 'popular', label: '추천순', icon: 'medal-check' },
  { value: 'name', label: '이름순', icon: 'list' },
  { value: 'recent', label: '최근 등록순', icon: 'clock' },
] as const;
type BusinessSort = (typeof BUSINESS_SORT_OPTIONS)[number]['value'];

// ─── Advanced Filter Groups ───────────────────────────────
const FILTER_GROUPS = [
  { key: 'region_sido', label: '지역 (시/도)', options: ['서울', '경기', '인천', '부산', '경남', '경북', '대구', '충남', '전북', '충북', '전남', '강원', '제주', '세종'] },
  { key: 'region_gugun', label: '지역 (시/군/구)', options: ['강남구', '영등포구', '중구', '서초구', '강서구', '송파구', '구로구', '마포구', '용산구', '종로구', '성동구', '광진구'] },
  { key: 'hall_type', label: '홀타입', options: ['일반', '컨벤션', '호텔', '하우스', '레스토랑', '한옥', '교회/성당', '게스트하우스', '야외'] },
  { key: 'hall_concept', label: '홀컨셉', options: ['채플', '스몰', '야외/가든', '전통혼례'] },
  { key: 'meal', label: '식사메뉴', options: ['뷔페', '양식', '한식', '중식', '퓨전'] },
  { key: 'meal_price', label: '식대', options: ['3만9천원이하', '4만원~4만9천원', '5만원~5만9천원', '6만원~6만9천원', '7만원이상'] },
  { key: 'guest_count', label: '보증인원', options: ['49명이하', '50~99명', '100~199명', '200~299명', '300~499명', '500명이상'] },
  { key: 'hall_time', label: '홀사용시간', options: ['60분이하', '70~90분', '100~120분', '130~180분', '240분이상'] },
  { key: 'ceremony_type', label: '예식형태', options: ['분리예식', '동시예식'] },
  { key: 'subway', label: '노선별', options: ['1호선', '2호선', '3호선', '4호선', '5호선', '6호선', '7호선', '8호선', '9호선', '경의중앙선', '분당선', '신분당선'] },
  { key: 'recommend', label: '추천포인트', options: ['이벤트', '잔여타임', '긴버진로드', '높은천고', '역세권', '어두운홀', '신축홀', '단독홀', '주차편리'] },
];

// 실제 비즈 데이터는 /api/v1/business 에서 로드 (목업 데이터 제거됨)
const MOCK_RANK_ITEMS: RankItem[] = [];
const BUSINESS_CACHE_KEY = 'freetiful-business-list-cache-v9';
const BUSINESS_BANNER_CACHE_KEY = 'freetiful-business-list-banners-cache-v1';
const BUSINESS_CACHE_TTL = 5 * 60_000;
const BUSINESS_PAGE_SIZE = 24;
const BUSINESS_PREVIEW_LIMIT = 8;
const BUSINESS_LEGACY_FALLBACK_LIMIT = 100;
const BUSINESS_REQUEST_VERSION = '20260429-category-quality';

interface BusinessCachePayload {
  data: RankItem[];
  total: number;
  page: number;
  ts: number;
}

function getInitialBusinessCategory() {
  if (typeof window === 'undefined') return '전체';
  const category = new URLSearchParams(window.location.search).get('category');
  return category && SUB_CATEGORIES.includes(category) ? category : '전체';
}

function getBusinessCacheKey(category: string) {
  return `${BUSINESS_CACHE_KEY}:${category}`;
}

function readBusinessCache(category: string): BusinessCachePayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(getBusinessCacheKey(category));
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.ts > BUSINESS_CACHE_TTL || !Array.isArray(parsed.data)) return null;
    return {
      data: parsed.data,
      total: Number(parsed.total) || parsed.data.length,
      page: Number(parsed.page) || 1,
      ts: parsed.ts,
    };
  } catch {
    return null;
  }
}

function writeBusinessCache(category: string, payload: Omit<BusinessCachePayload, 'ts'>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getBusinessCacheKey(category), JSON.stringify({ ...payload, ts: Date.now() }));
  } catch {}
}

function readBusinessBannerCache(): ListBanner[] {
  if (typeof window === 'undefined') return [];
  try {
    const cached = localStorage.getItem(BUSINESS_BANNER_CACHE_KEY);
    if (!cached) return [];
    const parsed = JSON.parse(cached);
    if (!parsed || Date.now() - Number(parsed.ts || 0) > BUSINESS_CACHE_TTL || !Array.isArray(parsed.data)) return [];
    return parsed.data;
  } catch {
    return [];
  }
}

function writeBusinessBannerCache(data: ListBanner[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BUSINESS_BANNER_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

function getBusinessListParams(category: string, page: number, limit: number) {
  return {
    page,
    limit,
    _v: BUSINESS_REQUEST_VERSION,
    ...(category !== '전체' ? { category } : {}),
  };
}

function rerankBusinessItems(items: RankItem[], rankOffset = 0) {
  return sortPopularPartnersFirst(items).map((item, index) => ({
    ...item,
    rank: rankOffset + index + 1,
  }));
}

function mapBusinessToRankItem(b: any, index: number, rankOffset = 0): RankItem {
  const categories = getRelevantBusinessCategories(b);
  const businessName = b.title || b.name || b.businessName || '';
  const partnerImageSet = getWeddingPartnerImageSet(businessName, b.businessName, b.name, b.title);
  const apiImages = Array.isArray(b.images)
    ? b.images.map((image: any) => image?.imageUrl).filter(Boolean)
    : [];
  const displayCategories = Array.from(new Set([
    ...categories,
    ...getWeddingPartnerSectionCategories(partnerImageSet),
  ]));
  const displayCategory = displayCategories[0] || b.businessType || '전체';
  const mergedImages = sanitizeBusinessImageUrls(mergeWeddingPartnerImages(
    partnerImageSet?.images,
    [b.image, b.imageUrl],
    apiImages,
  ));
  const address = b.address || '';
  const markerTags = extractBusinessTagsFromHtml(b.descriptionHtml);
  const isPopular = isPopularBusinessPartner(b, categories);
  const tags = normalizeBusinessTags(
    Array.isArray(b.tags) && b.tags.length > 0
      ? b.tags
      : markerTags.length > 0
        ? markerTags
        : deriveBusinessTagSuggestions({
          businessName,
          businessType: b.businessType,
          address,
          categoryNames: displayCategories,
        }),
    5,
  );
  const region = address.split(' ')[0] || displayCategory || '';

  return {
    id: b.id || String(rankOffset + index),
    rank: b.rank || rankOffset + index + 1,
    category: displayCategory,
    title: businessName,
    region: b.region || region,
    clinic: b.clinic || displayCategories.join(' · ') || region || b.businessType || '',
    rating: b.rating ?? 0,
    reviewCount: b.reviewCount ?? 0,
    originalPrice: b.originalPrice,
    discountPercent: b.discountPercent,
    finalPrice: b.finalPrice ?? b.price ?? 0,
    hasAppPay: b.hasAppPay ?? false,
    hasAppBooking: b.hasAppBooking ?? false,
    image: mergedImages[0] || '',
    imageFallback: '',
    images: mergedImages.slice(0, 4),
    photoCount: mergedImages.length,
    tags,
    verifiedBadge: b.verifiedBadge,
    isPopular,
  };
}

function mapBusinesses(items: any[], rankOffset = 0) {
  return rerankBusinessItems(
    items
      .map((business, index) => mapBusinessToRankItem(business, index, rankOffset))
      .filter((item) => Boolean(item.image)),
    rankOffset,
  );
}

function matchesBusinessCategory(item: RankItem, category: string) {
  if (category === '전체') return true;
  return item.category === category || item.clinic.includes(category) || item.tags.some((tag) => tag.includes(category));
}

function prepareBusinessItems(rawItems: any[], category: string, rankOffset = 0) {
  const filtered = rawItems.filter((item) => {
    if (!isBusinessRelevantToAnyCategory(item)) return false;
    if (category === '전체') return true;
    return isBusinessRelevantToCategory(item, category);
  });
  const mapped = mapBusinesses(filtered, rankOffset);
  if (category === '전체') return { items: mapped, backendScoped: true };

  const scopedItems = mapped.filter((item) => matchesBusinessCategory(item, category));
  return {
    items: scopedItems.length === mapped.length ? mapped : scopedItems,
    backendScoped: mapped.length === 0 || scopedItems.length === mapped.length,
  };
}

async function fetchBusinessPage(category: string, page: number, limit: number, allowLegacyFallback = true) {
  const res = await apiClient.get('/api/v1/business', {
    params: getBusinessListParams(category, page, limit),
  });
  const data = res.data;
  const rawItems = Array.isArray(data) ? data : data?.items;
  const rawList = Array.isArray(rawItems) ? rawItems : [];
  const prepared = prepareBusinessItems(rawList, category, (page - 1) * limit);

  if (category !== '전체' && !prepared.backendScoped && allowLegacyFallback && page === 1) {
    const fallbackRes = await apiClient.get('/api/v1/business', {
      params: { page: 1, limit: BUSINESS_LEGACY_FALLBACK_LIMIT, _v: BUSINESS_REQUEST_VERSION },
    });
    const fallbackData = fallbackRes.data;
    const fallbackRawItems = Array.isArray(fallbackData) ? fallbackData : fallbackData?.items;
    const fallbackList = Array.isArray(fallbackRawItems) ? fallbackRawItems : [];
    const fallbackPrepared = prepareBusinessItems(fallbackList, category);
    return {
      items: fallbackPrepared.items,
      total: fallbackPrepared.items.length,
      page: 1,
    };
  }

  return {
    items: prepared.items,
    total: prepared.backendScoped ? Number(data?.total) || prepared.items.length : prepared.items.length,
    page,
  };
}

/** 목록 항목 → 홈 웨딩파트너 카드(components/business/PartnerToneCard) 값 */
function toToneCard(item: RankItem): PartnerToneCardData {
  const images = item.images && item.images.length > 0 ? item.images : [item.image];
  return {
    id: item.id,
    name: item.title,
    location: item.region,
    images,
    photoCount: item.photoCount,
    tags: item.tags,
    discountPercent: item.discountPercent,
  };
}

function WeddingPartnerListBanner({ banners }: { banners: ListBanner[] }) {
  const [current, setCurrent] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const pointerStartRef = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const swipeLockRef = useRef(false);

  const move = useCallback((direction: 1 | -1) => {
    if (banners.length <= 1) return;
    setCurrent((index) => (index + direction + banners.length) % banners.length);
  }, [banners.length]);

  const finishSwipe = useCallback((dx: number, dy: number) => {
    setDragOffset(0);
    if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy) || banners.length <= 1) return;
    swipeLockRef.current = true;
    move(dx < 0 ? 1 : -1);
    window.setTimeout(() => { swipeLockRef.current = false; }, 260);
  }, [banners.length, move]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = window.setInterval(() => {
      if (!pointerStartRef.current?.active) move(1);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [banners.length, move]);

  useEffect(() => {
    if (current >= banners.length) setCurrent(0);
  }, [banners.length, current]);

  if (banners.length === 0) return null;

  return (
    <section className="px-4 pb-3 pt-1 lg:px-0">
      <div
        className="relative mx-auto aspect-[1170/300] w-full max-w-[1170px] overflow-hidden rounded-2xl bg-[#F2F4F6] shadow-[0_10px_28px_rgba(15,23,42,0.08)]"
        onPointerDown={(event) => {
          if (banners.length <= 1) return;
          pointerStartRef.current = { x: event.clientX, y: event.clientY, active: true };
          setDragOffset(0);
        }}
        onPointerMove={(event) => {
          const start = pointerStartRef.current;
          if (!start?.active) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
          setDragOffset(Math.max(-110, Math.min(110, dx)));
        }}
        onPointerUp={(event) => {
          const start = pointerStartRef.current;
          pointerStartRef.current = null;
          if (!start) return;
          finishSwipe(event.clientX - start.x, event.clientY - start.y);
        }}
        onPointerCancel={() => {
          pointerStartRef.current = null;
          setDragOffset(0);
        }}
      >
        <div
          className="flex h-full will-change-transform"
          style={{
            width: `${banners.length * 100}%`,
            transform: `translateX(-${current * (100 / banners.length)}%) translateX(${dragOffset}px)`,
            transition: dragOffset === 0 ? 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
          }}
        >
          {banners.map((banner) => {
            const openLink = () => {
              if (swipeLockRef.current || !banner.linkUrl) return;
              window.location.href = banner.linkUrl;
            };

            return (
              <button
                key={banner.id}
                type="button"
                aria-label={banner.title || '웨딩파트너 배너'}
                aria-disabled={!banner.linkUrl}
                tabIndex={banner.linkUrl ? 0 : -1}
                onClick={openLink}
                className="relative h-full shrink-0 overflow-hidden text-left"
                style={{
                  width: `${100 / banners.length}%`,
                  backgroundColor: banner.bgColor || '#2B313D',
                  cursor: banner.linkUrl ? 'pointer' : 'default',
                }}
              >
                {banner.imageUrl ? (
                  <img
                    src={banner.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                    decoding="async"
                    loading="eager"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col justify-end p-5">
                    {banner.subtitle && <p className="text-[12px] font-semibold text-white/75">{banner.subtitle}</p>}
                    {banner.title && <p className="mt-1 text-[18px] font-bold text-white">{banner.title}</p>}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {banners.length > 1 && (
          <div className="absolute bottom-2 right-2 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
            {current + 1} / {banners.length}
          </div>
        )}
      </div>
    </section>
  );
}

/** '전체' 아이콘 — 네 칸(웨딩숲 사이드바 '전체'와 같은 결) */
function AllCategoriesIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" fill="#C5CBD3" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" fill="#DDE1E6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" fill="#DDE1E6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" fill="#C5CBD3" />
    </svg>
  );
}

/**
 * PC 왼쪽 분야 카드 — 웨딩숲 PC 사이드바와 같은 흰 카드(모서리 32 · 아주 옅게 퍼지는 그림자, 260928 사장 '웨딩파트너도 지금 톤앤매너로').
 * 분야 아이콘(홈 카테고리 아이콘) + 이름, 고른 분야는 옅은 회색 알약이 미끄러져 옮겨 간다.
 */
function DesktopBusinessSidebar({
  selectedCategory,
  selectCategory,
}: {
  selectedCategory: string;
  selectCategory: (value: string) => void;
}) {
  return (
    <aside
      className="sticky top-[97px] self-start overflow-y-auto rounded-[32px] bg-white px-3 pb-3 pt-6 shadow-[0_12px_48px_rgba(17,24,39,0.06),0_2px_10px_rgba(17,24,39,0.025)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ maxHeight: 'calc(100vh - 121px)', overscrollBehavior: 'contain' }}
    >
      <h2 className="mb-2.5 px-3.5 text-[19px] font-bold tracking-[-0.3px] text-[#191F28]">웨딩파트너</h2>
      <LayoutGroup id="biz-pc-cats">
        <nav className="flex flex-col gap-0.5" aria-label="분야">
          {SUB_CATEGORIES.map((category) => {
            const active = selectedCategory === category;
            const icon = category === '전체' ? null : WEDDING_PARTNER_CATEGORY_ICONS[category as WeddingPartnerCategory];
            return (
              <button
                key={category}
                type="button"
                onClick={() => selectCategory(category)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex w-full items-center gap-2.5 rounded-[14px] px-3.5 py-[9px] text-left text-[15px] tracking-[-0.3px] transition-colors ${
                  active ? 'font-bold text-[#191F28]' : 'font-medium text-[#4E5968] hover:bg-[#F9FAFB]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="biz-pc-cat-pill"
                    className="absolute inset-0 rounded-[14px] bg-[#F2F4F6]"
                    transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                  />
                )}
                <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                  {icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/images/category-icons/${icon}`} alt="" className="h-6 w-6 object-contain" draggable={false} />
                  ) : (
                    <AllCategoriesIcon />
                  )}
                </span>
                <span className="relative min-w-0 truncate">{category}</span>
              </button>
            );
          })}
        </nav>
      </LayoutGroup>
      {/* 예전 PC 머리줄의 '입점문의'(전체 헤더로 바꾸며 자리를 옮겼다) */}
      <Link
        href="/biz"
        className="mt-3 flex items-center justify-between rounded-[16px] bg-[#F2F7FF] px-3.5 py-3 text-[14px] font-semibold tracking-[-0.2px] text-[#3182F6] transition-colors hover:bg-[#E8F1FF]"
      >
        우리 업체도 입점하기
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </aside>
  );
}

/** PC 칩 + 팝 메뉴(지역 · 정렬) — 사회자 목록 '추천순 ⇅' 칩과 같은 모양(높이 42 · 모서리 12 · 16 굵게) */
function DesktopPopChip<V extends string>({
  label,
  trailing,
  value,
  options,
  onChange,
}: {
  label: string;
  trailing: React.ReactNode;
  value: V;
  options: readonly { value: V; label: string; icon: string }[];
  onChange: (value: V) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-[42px] items-center gap-1 rounded-[12px] bg-[#F2F4F6] px-3.5 text-[16px] font-semibold tracking-[-0.3px] text-[#333D4B] transition-colors hover:bg-[#EAECEF] active:bg-[#E8EBED]"
      >
        {label}
        {trailing}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="pop-menu nt-menu absolute left-0 top-[calc(100%+6px)] z-50" style={{ transformOrigin: 'top left' }} role="menu">
            {options.map((opt, i) => (
              <button
                key={opt.value}
                type="button"
                role="menuitemradio"
                aria-checked={value === opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`pop-menu-item nt-menu-item${value === opt.value ? ' on' : ''}`}
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

const REGION_OPTIONS = REGIONS.map((region) => ({ value: region, label: region, icon: 'pin' }));

function ChevronGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-px shrink-0">
      <path d="M6 9l6 6 6-6" stroke="#8B95A1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Page ──────────────────────────────────────────────────
export default function BusinessListPage() {
  const router = useRouter();
  const [initialBusinessSnapshot] = useState(() => {
    const category = getInitialBusinessCategory();
    const cache = readBusinessCache(category);
    return { category, cache };
  });
  const [loading, setLoading] = useState(() => !initialBusinessSnapshot.cache?.data.length);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('전국');
  const [selectedCategory, setSelectedCategory] = useState(initialBusinessSnapshot.category);
  const categoryTabsRef = useRef<HTMLDivElement | null>(null);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);
  const listViewportRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const desktopLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [rankItems, setRankItems] = useState<RankItem[]>(() => initialBusinessSnapshot.cache?.data ?? MOCK_RANK_ITEMS);
  const [businessPage, setBusinessPage] = useState(() => initialBusinessSnapshot.cache?.page ?? 1);
  const [businessTotal, setBusinessTotal] = useState(() => initialBusinessSnapshot.cache?.total ?? initialBusinessSnapshot.cache?.data.length ?? 0);
  const [categoryPreviewItems, setCategoryPreviewItems] = useState<Record<string, RankItem[]>>(() => {
    const cache = initialBusinessSnapshot.cache;
    return cache?.data.length ? { [initialBusinessSnapshot.category]: cache.data.slice(0, BUSINESS_PREVIEW_LIMIT) } : {};
  });
  const [listBanners, setListBanners] = useState<ListBanner[]>(() => readBusinessBannerCache());
  const [businessSearch, setBusinessSearch] = useState('');
  const [businessSort, setBusinessSort] = useState<BusinessSort>('popular');
  // PC 제목·분야 카드의 '고른 분야' — 서버는 주소(?category=)를 몰라 '전체'로 그리므로 붙은 뒤에 바꾼다(첫 화면 글자·모양 어긋남 방지)
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  const pcCategory = hydrated ? selectedCategory : '전체';
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(FILTER_GROUPS.map((g) => [g.key, new Set<string>()]))
  );

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/banners?placement=businesses')
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (cancelled) return;
        const banners = Array.isArray(data)
          ? data
              .filter((banner: ListBanner) => banner.placement === 'businesses')
              .map((banner: ListBanner) => ({
                ...banner,
                imageUrl: banner.imageUrl || '',
                linkUrl: banner.linkUrl || null,
              }))
          : [];
        setListBanners(banners);
        writeBusinessBannerCache(banners);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const selectCategory = useCallback((category: string) => {
    setSelectedCategory(category);
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (category === '전체') params.delete('category');
    else params.set('category', category);
    const search = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cached = readBusinessCache(selectedCategory);
    if (cached?.data.length) {
      setRankItems(cached.data);
      setBusinessTotal(cached.total);
      setBusinessPage(cached.page);
      setLoading(false);
      setCategoryPreviewItems((prev) => ({
        ...prev,
        [selectedCategory]: cached.data.slice(0, BUSINESS_PREVIEW_LIMIT),
      }));
    } else {
      setRankItems([]);
      setBusinessTotal(0);
      setBusinessPage(1);
      setLoading(true);
    }

    fetchBusinessPage(selectedCategory, 1, BUSINESS_PAGE_SIZE)
      .then(({ items: mapped, total }) => {
        if (cancelled) return;
        setRankItems(mapped);
        setBusinessTotal(total);
        setBusinessPage(1);
        setCategoryPreviewItems((prev) => ({
          ...prev,
          [selectedCategory]: mapped.slice(0, BUSINESS_PREVIEW_LIMIT),
        }));
        writeBusinessCache(selectedCategory, { data: mapped, total, page: 1 });
      })
      .catch(() => {
        if (!cached?.data.length) setRankItems(MOCK_RANK_ITEMS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCategory]);

  useEffect(() => {
    const syncCategoryFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const category = params.get('category');
      setSelectedCategory(category && SUB_CATEGORIES.includes(category) ? category : '전체');
    };
    syncCategoryFromUrl();
    window.addEventListener('popstate', syncCategoryFromUrl);
    return () => window.removeEventListener('popstate', syncCategoryFromUrl);
  }, []);

  // 고른 분류 칩이 보이게 가운데로(밑줄 표시는 없앴다 — 칩 색으로 고른 것 표시, 260926)
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      activeTabRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedCategory]);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleFilterOption = useCallback((groupKey: string, option: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      const set = new Set(next[groupKey]);
      if (set.has(option)) set.delete(option);
      else set.add(option);
      next[groupKey] = set;
      return next;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters(Object.fromEntries(FILTER_GROUPS.map((g) => [g.key, new Set<string>()])));
  }, []);

  const totalActiveFilters = useMemo(
    () => Object.values(filters).reduce((sum, set) => sum + set.size, 0),
    [filters],
  );
  const activeFilterValues = useMemo(
    () => Object.values(filters).flatMap((set) => Array.from(set)),
    [filters],
  );
  const visibleRankItems = useMemo(() => {
    const query = businessSearch.trim().toLowerCase();
    const filteredItems = rankItems.filter((item) => {
      const categoryMatched = selectedCategory === '전체' || item.category === selectedCategory || item.clinic.includes(selectedCategory);
      const regionMatched = selectedRegion === '전국' || selectedRegion === '내 위치' || item.region.includes(selectedRegion);
      const detailMatched = activeFilterValues.length === 0 || activeFilterValues.some((value) => {
        const target = `${item.title} ${item.region} ${item.clinic} ${item.category} ${item.tags.join(' ')}`;
        return target.includes(value);
      });
      const searchMatched = !query || `${item.title} ${item.region} ${item.clinic} ${item.category} ${item.tags.join(' ')}`.toLowerCase().includes(query);
      return categoryMatched && regionMatched && detailMatched && searchMatched;
    });

    if (businessSort === 'name') {
      return [...filteredItems].sort((a, b) => a.title.localeCompare(b.title, 'ko'));
    }
    if (businessSort === 'recent') {
      return [...filteredItems].sort((a, b) => b.rank - a.rank);
    }
    return [...filteredItems].sort((a, b) => {
      if (a.isPopular !== b.isPopular) return a.isPopular ? -1 : 1;
      return a.rank - b.rank;
    });
  }, [activeFilterValues, businessSearch, businessSort, rankItems, selectedCategory, selectedRegion]);

  const hasMoreBusinesses = businessTotal > rankItems.length;

  const loadMoreBusinesses = useCallback(async () => {
    if (loading || loadingMore || !hasMoreBusinesses) return;
    const nextPage = businessPage + 1;
    setLoadingMore(true);

    try {
      const { items: mapped, total } = await fetchBusinessPage(
        selectedCategory,
        nextPage,
        BUSINESS_PAGE_SIZE,
        false,
      );
      const ids = new Set(rankItems.map((item) => item.id));
      const merged = [...rankItems, ...mapped.filter((item) => !ids.has(item.id))];

      setBusinessTotal(total);
      setBusinessPage(nextPage);
      setRankItems(merged);
      writeBusinessCache(selectedCategory, { data: merged, total, page: nextPage });
      setCategoryPreviewItems((preview) => ({
        ...preview,
        [selectedCategory]: merged.slice(0, BUSINESS_PREVIEW_LIMIT),
      }));
    } catch {
      toast.error('목록을 더 불러오지 못했습니다');
    } finally {
      setLoadingMore(false);
    }
  }, [businessPage, businessTotal, hasMoreBusinesses, loading, loadingMore, rankItems, selectedCategory]);

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element || !hasMoreBusinesses || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void loadMoreBusinesses();
      },
      { rootMargin: '560px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMoreBusinesses, loadMoreBusinesses, loading, loadingMore, visibleRankItems.length]);

  useEffect(() => {
    const element = desktopLoadMoreRef.current;
    if (!element || !hasMoreBusinesses || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void loadMoreBusinesses();
      },
      { rootMargin: '720px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMoreBusinesses, loadMoreBusinesses, loading, loadingMore, visibleRankItems.length]);

  const showListSkeleton = loading && rankItems.length === 0;

  return (
    <>
    {/* ─── PC — 전체 헤더 아래(260928 사장 '웨딩파트너도 지금 톤앤매너로') ───
        왼쪽 = 웨딩숲 사이드바와 같은 흰 분야 카드 · 오른쪽 = 큰 제목(고른 분야) · 검색칸 · 지역/정렬 칩(팝 메뉴) · 상세 필터 · 배너 ·
        홈 웨딩파트너 사진 색 카드(가로형) 격자, 등장 = 퀵매칭 차례. */}
    <div className="hidden min-h-screen bg-white pb-24 lg:block" style={{ letterSpacing: '-0.02em' }}>
      <div className="grid grid-cols-[240px_minmax(0,1fr)] gap-10 pt-10 xl:grid-cols-[256px_minmax(0,1fr)]">
        <DesktopBusinessSidebar selectedCategory={pcCategory} selectCategory={selectCategory} />

        <section className="min-w-0">
          <div className="flex items-end justify-between gap-8 pb-6">
            <div key={pcCategory} className="min-w-0">
              <h1 className="qd-a-title m-0 text-[30px] font-bold leading-[1.3] tracking-[-0.6px] text-[#191F28]">
                {pcCategory === '전체' ? '웨딩파트너' : pcCategory}
              </h1>
              <p className="qd-a-sub mt-1.5 text-[15px] tracking-[-0.2px] text-[#8B95A1]">
                {!hydrated || showListSkeleton ? '파트너를 불러오고 있어요' : (
                  <>파트너 <b className="font-semibold text-[#4E5968]">{visibleRankItems.length.toLocaleString()}</b>곳{hasMoreBusinesses ? ' 이상' : ''}</>
                )}
              </p>
            </div>
            <label className="qd-a-sub flex h-12 w-[320px] shrink-0 items-center gap-2 rounded-[14px] bg-[#F2F4F6] pl-4 pr-2 transition-colors focus-within:bg-[#EAECEF] xl:w-[360px]">
              <Search size={18} className="shrink-0 text-[#8B95A1]" />
              <input
                value={businessSearch}
                onChange={(event) => setBusinessSearch(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Escape') setBusinessSearch(''); }}
                placeholder="업체 이름, 지역, 분위기로 검색"
                aria-label="웨딩파트너 검색"
                className="h-full min-w-0 flex-1 bg-transparent text-[16px] font-medium text-[#191F28] outline-none placeholder:font-normal placeholder:text-[#8B95A1]"
              />
              {businessSearch && (
                <button
                  type="button"
                  onClick={() => setBusinessSearch('')}
                  aria-label="검색어 지우기"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#C9CED6] text-white transition-transform active:scale-90"
                >
                  <X size={13} strokeWidth={3} />
                </button>
              )}
            </label>
          </div>

          <div className="qd-a-item flex items-center gap-2" style={{ animationDelay: '0.1s' }}>
            <DesktopPopChip<BusinessSort>
              label={BUSINESS_SORT_OPTIONS.find((o) => o.value === businessSort)?.label || '추천순'}
              trailing={<SortArrowsIcon />}
              value={businessSort}
              options={BUSINESS_SORT_OPTIONS}
              onChange={setBusinessSort}
            />
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-[#E5E8EB]" />
            <DesktopPopChip
              label={selectedRegion === '전국' ? '지역 전체' : selectedRegion}
              trailing={<ChevronGlyph />}
              value={selectedRegion}
              options={REGION_OPTIONS}
              onChange={setSelectedRegion}
            />
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              aria-expanded={filterOpen}
              className={`inline-flex h-[42px] items-center gap-1.5 rounded-[12px] px-3.5 text-[16px] font-semibold tracking-[-0.3px] transition-colors active:scale-[0.97] ${
                totalActiveFilters > 0 || filterOpen ? 'bg-[#4E5968] text-white' : 'bg-[#F2F4F6] text-[#333D4B] hover:bg-[#EAECEF]'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" strokeWidth={2.2} />
              상세 필터
              {totalActiveFilters > 0 && <span className="tabular-nums">{totalActiveFilters}</span>}
            </button>
          </div>

          {/* 상세 필터 — 흰 카드가 스프링으로 펼쳐지고 칩은 사회자 목록 성별 탭과 같은 칩(고른 칩 쿨그레이) */}
          <motion.div
            initial={false}
            animate={{ height: filterOpen ? 'auto' : 0, opacity: filterOpen ? 1 : 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 40 }}
            className="overflow-hidden"
            aria-hidden={!filterOpen}
          >
            <div className="mt-4 rounded-[24px] bg-white p-6 shadow-[0_12px_48px_rgba(17,24,39,0.07),0_2px_10px_rgba(17,24,39,0.03)]">
              <div className="space-y-4">
                {FILTER_GROUPS.map((group) => (
                  <div key={group.key} className="grid grid-cols-[112px_minmax(0,1fr)] items-start gap-4">
                    <p className="pt-2 text-[14px] font-semibold tracking-[-0.2px] text-[#4E5968]">{group.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.options.map((option) => {
                        const active = filters[group.key]?.has(option);
                        return (
                          <button
                            key={option}
                            type="button"
                            tabIndex={filterOpen ? 0 : -1}
                            onClick={() => toggleFilterOption(group.key, option)}
                            className={`h-9 rounded-[10px] px-3 text-[14px] font-semibold tracking-[-0.2px] transition-colors active:scale-[0.97] ${
                              active ? 'bg-[#4E5968] text-white' : 'bg-[#F2F4F6] text-[#6B7684] hover:bg-[#EAECEF]'
                            }`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" tabIndex={filterOpen ? 0 : -1} onClick={clearAllFilters} className="h-11 rounded-[12px] bg-[#F2F4F6] px-4 text-[15px] font-semibold text-[#4E5968] transition hover:bg-[#EAECEF] active:scale-[0.97]">
                  초기화
                </button>
                <button type="button" tabIndex={filterOpen ? 0 : -1} onClick={() => setFilterOpen(false)} className="h-11 rounded-[12px] bg-[#3182F6] px-5 text-[15px] font-semibold text-white transition hover:bg-[#2272EB] active:scale-[0.97]">
                  적용
                </button>
              </div>
            </div>
          </motion.div>

          <div className="mt-6">
            <WeddingPartnerListBanner banners={listBanners} />
          </div>

          <div className="mt-4">
            {showListSkeleton ? (
              <div aria-hidden="true" className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="overflow-hidden rounded-[20px] bg-[#F7F8FA]">
                    <div className="skeleton aspect-[16/9] w-full" style={{ borderRadius: 0 }} />
                    <div className="px-4 pb-4 pt-3">
                      <div className="skeleton h-[17px] w-40" style={{ borderRadius: 6 }} />
                      <div className="skeleton mt-2 h-3 w-28" style={{ borderRadius: 5 }} />
                      <div className="skeleton mt-3 h-[26px] w-44" style={{ borderRadius: 8 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : visibleRankItems.length > 0 ? (
              <>
                <div key={`${selectedCategory}|${selectedRegion}|${businessSort}`} className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                  {visibleRankItems.map((item, index) => (
                    <PartnerToneCard
                      key={item.id}
                      biz={toToneCard(item)}
                      index={index}
                      wrapperClassName="qd-a-item"
                      wrapperStyle={{ animationDelay: `${0.12 + (index % 12) * 0.04}s` }}
                    />
                  ))}
                </div>
                {hasMoreBusinesses && (
                  <div ref={desktopLoadMoreRef} className="flex justify-center py-12">
                    {loadingMore ? (
                      <span className="inline-flex items-center gap-2 text-[14px] font-medium text-[#8B95A1]">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#B0B8C1]" />
                        파트너를 더 불러오는 중
                      </span>
                    ) : (
                      <span className="inline-block h-8" />
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center py-24 text-center">
                <p className="qd-a-title text-[19px] font-bold text-[#191F28]">조건에 맞는 업체가 없어요</p>
                <p className="qd-a-sub mt-1.5 text-[15px] text-[#8B95A1]">분야나 지역, 상세 필터를 바꿔 다시 찾아보세요</p>
                <button
                  type="button"
                  onClick={() => {
                    selectCategory('전체');
                    setSelectedRegion('전국');
                    clearAllFilters();
                    setBusinessSearch('');
                  }}
                  className="qd-a-sub mt-5 inline-flex h-[44px] items-center rounded-[12px] bg-[#E8F3FF] px-5 text-[16px] font-bold tracking-[-0.3px] text-[#3182F6] transition hover:bg-[#DCEBFF] active:scale-[0.97]"
                >
                  조건 초기화
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>

    <div className="bg-white min-h-screen pb-20 lg:hidden" style={{ letterSpacing: '-0.02em' }}>
      {/* ─── 머리줄 — 사회자 목록과 같은 결(뒤로 · 제목 18), 퀵매칭 등장(제목 아래→위) ─── */}
      <div className="sticky top-0 z-30 bg-white">
        <div className="flex h-[52px] items-center gap-3 px-4">
          <button onClick={() => router.back()} className="-ml-2 shrink-0 p-1 transition-transform active:scale-90" aria-label="뒤로">
            <ChevronLeft size={24} className="text-gray-800" />
          </button>
          {/* 제목은 고정 — 고른 분류는 아래 칩 색으로 보인다(분류를 넣으면 서버는 주소를 몰라 '웨딩파트너'로 그려 첫 화면 글자가 어긋난다) */}
          <h1 className="qd-a-title truncate text-[18px] font-bold tracking-[-0.3px] text-[#191F28]">웨딩파트너</h1>
        </div>

        {/* ─── 분류 — 사회자 목록 '추천순' 칩 모양(높이 42 · 모서리 12 · 16), 고른 분류 쿨그레이 · 밑줄/아래 선 없음 · 오른쪽 흰 그라데이션(260926) ─── */}
        <div className="qd-a-sub relative">
          <div
            ref={categoryTabsRef}
            className="flex items-center gap-1.5 overflow-x-auto px-4 pb-2.5 pt-1 scrollbar-hide"
            style={{ maskImage: 'linear-gradient(to right, #000 calc(100% - 32px), transparent)', WebkitMaskImage: 'linear-gradient(to right, #000 calc(100% - 32px), transparent)' }}
            role="tablist"
            aria-label="분야"
          >
            {SUB_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  ref={active ? activeTabRef : undefined}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectCategory(cat)}
                  className={`h-[42px] shrink-0 rounded-[12px] px-3.5 text-[16px] font-semibold tracking-[-0.3px] transition-colors duration-200 active:scale-[0.97] ${
                    active ? 'bg-[#4E5968] text-white' : 'bg-[#F2F4F6] text-[#6B7684]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── 웨딩홀 히어로 (빌라드지디) ─── */}
      {selectedCategory === '웨딩홀' && <VilladegdHero />}

      <WeddingPartnerListBanner banners={listBanners} />

      {/* ─── 목록 — 홈 웨딩파트너 카드(사진 색 카드 · 가로형) 한 줄에 하나, 좌우 여백 16
          (260926 사장: 옆 분류가 비치던 좌우 미리보기 칸·그림자 없이 깔끔하게, 내 위치·지역·필터 줄 없이) · 등장 = 퀵매칭 차례 ─── */}
      <div ref={listViewportRef} className="px-4 pt-2">
        {showListSkeleton ? (
          <div aria-hidden="true" className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="overflow-hidden rounded-[20px] bg-[#F7F8FA]">
                <div className="skeleton aspect-[16/9] w-full" style={{ borderRadius: 0 }} />
                <div className="px-4 pb-4 pt-3">
                  <div className="skeleton h-[17px] w-40" style={{ borderRadius: 6 }} />
                  <div className="skeleton mt-2 h-3 w-28" style={{ borderRadius: 5 }} />
                  <div className="skeleton mt-3 h-[26px] w-44" style={{ borderRadius: 8 }} />
                </div>
              </div>
            ))}
          </div>
        ) : visibleRankItems.length > 0 ? (
          <>
            <div key={selectedCategory} className="space-y-3">
              {visibleRankItems.map((item, index) => (
                <PartnerToneCard
                  key={item.id}
                  biz={toToneCard(item)}
                  index={index}
                  wrapperClassName="qd-a-item"
                  wrapperStyle={{ animationDelay: `${0.06 + (index % 10) * 0.05}s` }}
                />
              ))}
            </div>
            {hasMoreBusinesses && (
              <div ref={loadMoreRef} className="py-5">
                {loadingMore ? (
                  <div className="skeleton aspect-[16/9] w-full" style={{ borderRadius: 20 }} />
                ) : (
                  <div className="h-8" />
                )}
              </div>
            )}
          </>
        ) : (
          <div className="px-4 py-16 text-center">
            <p className="text-[15px] font-semibold text-[#6B7684]">조건에 맞는 업체가 없어요</p>
            <button
              onClick={() => {
                selectCategory('전체');
                setSelectedRegion('전국');
                clearAllFilters();
              }}
              className="mt-3 h-[40px] rounded-[12px] bg-[#F2F4F6] px-4 text-[15px] font-semibold text-[#4E5968] transition-transform active:scale-95"
            >
              전체 보기
            </button>
          </div>
        )}
      </div>

      {/* ─── Scroll to Top ─── */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-6 right-4 w-11 h-11 rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.12)] border border-gray-100 flex items-center justify-center active:scale-90 transition-all z-30"
        style={{
          opacity: showScrollTop ? 1 : 0,
          transform: showScrollTop ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.8)',
          pointerEvents: showScrollTop ? 'auto' : 'none',
          transition: 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <ArrowUp size={18} className="text-gray-700" />
      </button>
    </div>
    </>
  );
}
