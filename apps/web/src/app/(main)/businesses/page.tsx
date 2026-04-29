'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent, type WheelEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronDown, ChevronUp, SlidersHorizontal, Heart, X, MapPin, ArrowUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api/client';
import { WEDDING_PARTNER_CATEGORY_TABS } from '@/lib/business-categories';
import {
  getBusinessCategoryNames,
  isPopularBusinessPartner,
  sortPopularPartnersFirst,
} from '@/lib/business-popularity';
import { deriveBusinessTagSuggestions, extractBusinessTagsFromHtml, normalizeBusinessTags } from '@/lib/business-tags';
import {
  getWeddingPartnerImageSet,
  getWeddingPartnerSectionCategories,
  mergeWeddingPartnerImages,
  WEDDING_PARTNER_IMAGE_SETS,
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
const BUSINESS_CACHE_KEY = 'freetiful-business-list-cache-v8';
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

const CATEGORY_FALLBACK_IMAGES = Object.values(WEDDING_PARTNER_IMAGE_SETS).reduce<Record<string, string>>((acc, set) => {
  const firstImage = set.images[0];
  if (firstImage && !acc[set.category]) acc[set.category] = firstImage;
  if (firstImage && set.images.some((image) => image.includes('/hair-makeup/'))) {
    acc.헤어 ||= firstImage;
    acc.메이크업 ||= firstImage;
  }
  return acc;
}, {});

function getBusinessFallbackImage(categories: string[], businessType?: string | null) {
  const candidates = [...categories, businessType, '웨딩홀'].filter(Boolean) as string[];
  for (const category of candidates) {
    if (CATEGORY_FALLBACK_IMAGES[category]) return CATEGORY_FALLBACK_IMAGES[category];
  }
  return '/images/default-profile.svg';
}

function rerankBusinessItems(items: RankItem[], rankOffset = 0) {
  return sortPopularPartnersFirst(items).map((item, index) => ({
    ...item,
    rank: rankOffset + index + 1,
  }));
}

function mapBusinessToRankItem(b: any, index: number, rankOffset = 0): RankItem {
  const categories = getBusinessCategoryNames(b);
  const businessName = b.title || b.name || b.businessName || '';
  const partnerImageSet = getWeddingPartnerImageSet(businessName, b.businessName, b.name, b.title);
  const apiImages = Array.isArray(b.images)
    ? b.images.map((image: any) => image?.imageUrl).filter(Boolean)
    : [];
  const displayCategories = Array.from(new Set([
    ...categories.filter((name: string) => name !== '인기'),
    ...getWeddingPartnerSectionCategories(partnerImageSet),
  ]));
  const displayCategory = displayCategories[0] || b.businessType || '전체';
  const imageFallback = getBusinessFallbackImage(displayCategories, b.businessType || displayCategory);
  const mergedImages = mergeWeddingPartnerImages(
    partnerImageSet?.images,
    [b.image, b.imageUrl],
    apiImages,
    [imageFallback],
  );
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
    image: mergedImages[0] || '/images/default-profile.svg',
    imageFallback,
    tags,
    verifiedBadge: b.verifiedBadge,
    isPopular,
  };
}

function mapBusinesses(items: any[], rankOffset = 0) {
  return rerankBusinessItems(
    items.map((business, index) => mapBusinessToRankItem(business, index, rankOffset)),
    rankOffset,
  );
}

function matchesBusinessCategory(item: RankItem, category: string) {
  if (category === '전체') return true;
  return item.category === category || item.clinic.includes(category) || item.tags.some((tag) => tag.includes(category));
}

function prepareBusinessItems(rawItems: any[], category: string, rankOffset = 0) {
  const mapped = mapBusinesses(rawItems, rankOffset);
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

interface BusinessRankListProps {
  items: RankItem[];
  favorites: Set<string>;
  onToggleFav?: (id: string) => void;
  muted?: boolean;
}

function BusinessRankList({ items, favorites, onToggleFav, muted = false }: BusinessRankListProps) {
  return (
    <div className={`divide-y divide-gray-50 bg-white ${muted ? 'pointer-events-none opacity-70' : ''}`}>
      {items.map((item, index) => (
        <Link
          key={item.id}
          href={`/businesses/${item.id}`}
          tabIndex={muted ? -1 : 0}
          aria-hidden={muted}
          className="flex gap-3 px-4 py-4 group active:bg-gray-50/50 transition-colors"
        >
          <div className="relative w-[120px] h-[120px] shrink-0 rounded-xl overflow-hidden bg-gray-100">
            <img
              src={item.image}
              alt={item.title}
              loading={!muted && index < 2 ? 'eager' : 'lazy'}
              decoding="async"
              className="h-full w-full object-cover"
              onError={(event) => {
                const image = event.currentTarget;
                if (image.dataset.fallbackUsed === 'true') {
                  image.src = '/images/default-profile.svg';
                  return;
                }
                image.dataset.fallbackUsed = 'true';
                image.src = item.imageFallback || '/images/default-profile.svg';
              }}
            />
          </div>

          <div className="flex-1 min-w-0 flex flex-col">
            {item.verifiedBadge && (
              <div className="flex items-center gap-1 mb-0.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#3180F7">
                  <path d="M12 2l2.5 4.5 5 .5-3.5 3.5 1 5-5-2.5-5 2.5 1-5L4.5 7l5-.5L12 2z" />
                </svg>
                <span className="text-[11px] font-bold text-[#3180F7]">{item.verifiedBadge}</span>
              </div>
            )}

            <p className="text-[15px] font-bold text-gray-900 leading-[1.3] line-clamp-2 pr-6">{item.title}</p>
            <p className="text-[12px] text-gray-500 mt-0.5 leading-tight">
              {item.region} · {item.clinic}
            </p>

            {item.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {item.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-[5px] bg-[#F2F4F6] px-2 py-0.5 text-[10px] font-medium text-[#4E5968]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {(item.hasAppPay || item.hasAppBooking) && (
              <div className="flex items-center gap-1.5 mt-2">
                {item.hasAppPay && (
                  <span className="inline-flex items-center gap-1 px-2 h-[22px] rounded bg-[#EAF3FF] text-[10px] font-bold text-[#3180F7]">
                    <span className="w-3 h-3 rounded-sm bg-[#3180F7] flex items-center justify-center text-white text-[8px]">$</span>
                    앱결제
                  </span>
                )}
                {item.hasAppBooking && (
                  <span className="inline-flex items-center gap-1 px-2 h-[22px] rounded bg-[#E7F9EC] text-[10px] font-bold text-[#00A550]">
                    <span className="w-3 h-3 rounded-sm bg-[#00A550] flex items-center justify-center text-white text-[8px]">✓</span>
                    앱예약
                  </span>
                )}
              </div>
            )}
          </div>

          {!muted && onToggleFav && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); onToggleFav(item.id); }}
              className="shrink-0 self-start p-1 active:scale-90 transition-transform"
              aria-label={favorites.has(item.id) ? '찜 해제' : '찜하기'}
            >
              <Heart
                size={22}
                className={favorites.has(item.id) ? 'fill-[#FF4D4D] text-[#FF4D4D]' : 'text-gray-300'}
              />
            </button>
          )}
        </Link>
      ))}
    </div>
  );
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
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeOffsetRef = useRef(0);
  const lastWheelSwipeAtRef = useRef(0);
  const [tabIndicator, setTabIndicator] = useState({ left: 28, width: 36 });
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [rankItems, setRankItems] = useState<RankItem[]>(() => initialBusinessSnapshot.cache?.data ?? MOCK_RANK_ITEMS);
  const [businessPage, setBusinessPage] = useState(() => initialBusinessSnapshot.cache?.page ?? 1);
  const [businessTotal, setBusinessTotal] = useState(() => initialBusinessSnapshot.cache?.total ?? initialBusinessSnapshot.cache?.data.length ?? 0);
  const [categoryPreviewItems, setCategoryPreviewItems] = useState<Record<string, RankItem[]>>(() => {
    const cache = initialBusinessSnapshot.cache;
    return cache?.data.length ? { [initialBusinessSnapshot.category]: cache.data.slice(0, BUSINESS_PREVIEW_LIMIT) } : {};
  });
  const [listBanners, setListBanners] = useState<ListBanner[]>(() => readBusinessBannerCache());
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [listViewportWidth, setListViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 360));
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(FILTER_GROUPS.map((g) => [g.key, new Set<string>()]))
  );

  const currentCategoryIndex = SUB_CATEGORIES.indexOf(selectedCategory);
  const previousCategory = currentCategoryIndex > 0 ? SUB_CATEGORIES[currentCategoryIndex - 1] : null;
  const nextCategory = currentCategoryIndex >= 0 && currentCategoryIndex < SUB_CATEGORIES.length - 1
    ? SUB_CATEGORIES[currentCategoryIndex + 1]
    : null;

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

  const updateTabIndicator = useCallback(() => {
    const activeTab = activeTabRef.current;
    if (!activeTab) return;
    setTabIndicator({
      left: activeTab.offsetLeft + 12,
      width: Math.max(28, activeTab.offsetWidth - 24),
    });
  }, []);

  const selectCategory = useCallback((category: string) => {
    setSelectedCategory(category);
    swipeOffsetRef.current = 0;
    setSwipeOffset(0);
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
    let cancelled = false;
    const categories = [previousCategory, nextCategory].filter((category): category is string => Boolean(category));

    categories.forEach((category) => {
      if (category in categoryPreviewItems) return;

      const cached = readBusinessCache(category);
      if (cached?.data.length) {
        setCategoryPreviewItems((prev) => ({
          ...prev,
          [category]: cached.data.slice(0, BUSINESS_PREVIEW_LIMIT),
        }));
        return;
      }

      fetchBusinessPage(category, 1, BUSINESS_PREVIEW_LIMIT)
        .then(({ items }) => {
          if (cancelled) return;
          setCategoryPreviewItems((prev) => ({
            ...prev,
            [category]: items.slice(0, BUSINESS_PREVIEW_LIMIT),
          }));
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
    };
  }, [previousCategory, nextCategory, categoryPreviewItems]);

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

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      updateTabIndicator();
      activeTabRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedCategory, updateTabIndicator]);

  useEffect(() => {
    window.addEventListener('resize', updateTabIndicator);
    return () => window.removeEventListener('resize', updateTabIndicator);
  }, [updateTabIndicator]);

  useEffect(() => {
    const element = listViewportRef.current;
    if (!element || typeof window === 'undefined') return;
    const updateWidth = () => setListViewportWidth(element.clientWidth || window.innerWidth);

    updateWidth();
    let resizeObserver: ResizeObserver | null = null;
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(updateWidth);
      resizeObserver.observe(element);
    }
    window.addEventListener('resize', updateWidth);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleFav = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
  const visibleRankItems = useMemo(() => rankItems.filter((item) => {
    const categoryMatched = selectedCategory === '전체' || item.category === selectedCategory || item.clinic.includes(selectedCategory);
    const regionMatched = selectedRegion === '전국' || selectedRegion === '내 위치' || item.region.includes(selectedRegion);
    const detailMatched = activeFilterValues.length === 0 || activeFilterValues.some((value) => {
      const target = `${item.title} ${item.region} ${item.clinic} ${item.category} ${item.tags.join(' ')}`;
      return target.includes(value);
    });
    return categoryMatched && regionMatched && detailMatched;
  }), [activeFilterValues, rankItems, selectedCategory, selectedRegion]);

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

  const goToAdjacentCategory = useCallback((direction: -1 | 1) => {
    const currentIndex = SUB_CATEGORIES.indexOf(selectedCategory);
    const targetCategory = SUB_CATEGORIES[currentIndex + direction];
    if (targetCategory) selectCategory(targetCategory);
  }, [selectCategory, selectedCategory]);

  const handleSwipeStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    swipeOffsetRef.current = 0;
    setSwipeOffset(0);
  }, []);

  const handleSwipeMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    if (!start || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 8 || Math.abs(deltaX) < Math.abs(deltaY)) return;

    const hasTarget = deltaX > 0 ? Boolean(previousCategory) : Boolean(nextCategory);
    const nextOffset = hasTarget
      ? Math.max(-112, Math.min(112, deltaX * 0.42))
      : Math.max(-26, Math.min(26, deltaX * 0.12));
    swipeOffsetRef.current = nextOffset;
    setSwipeOffset(nextOffset);
  }, [nextCategory, previousCategory]);

  const handleSwipeEnd = useCallback(() => {
    const offset = swipeOffsetRef.current;
    if (offset <= -38 && nextCategory) goToAdjacentCategory(1);
    if (offset >= 38 && previousCategory) goToAdjacentCategory(-1);
    swipeStartRef.current = null;
    swipeOffsetRef.current = 0;
    setSwipeOffset(0);
  }, [goToAdjacentCategory, nextCategory, previousCategory]);

  const handleHorizontalWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaX) < 48 || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    const now = Date.now();
    if (now - lastWheelSwipeAtRef.current < 650) return;
    lastWheelSwipeAtRef.current = now;
    event.preventDefault();
    goToAdjacentCategory(event.deltaX > 0 ? 1 : -1);
  }, [goToAdjacentCategory]);

  const renderPreviewPane = useCallback((category: string | null) => (
    <div className="h-full overflow-hidden rounded-[18px] border border-gray-100 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      {category ? (
        <>
          <div className="px-4 py-3 border-b border-gray-50">
            <span className="text-[13px] font-bold text-gray-900">{category}</span>
          </div>
          <BusinessRankList
            items={(categoryPreviewItems[category] || []).slice(0, 3)}
            favorites={favorites}
            muted
          />
        </>
      ) : (
        <div className="h-[220px]" />
      )}
    </div>
  ), [categoryPreviewItems, favorites]);

  const paneWidth = Math.max(280, listViewportWidth - 72);
  const paneGap = 12;
  const baseTranslate = -(paneWidth + paneGap) + 24;
  const showListSkeleton = loading && rankItems.length === 0;

  return (
    <div className="bg-white min-h-screen pb-20" style={{ letterSpacing: '-0.02em' }}>
      {/* ─── Header ─── */}
      <div className="sticky top-0 z-30 bg-white">
        <div className="flex items-center px-3 h-[52px]">
          <button onClick={() => router.back()} className="p-1.5 active:scale-90 transition-transform">
            <ChevronLeft size={26} className="text-gray-900" />
          </button>
          <h1 className="ml-1 text-[18px] font-bold text-gray-900">웨딩파트너</h1>
        </div>
      </div>

      {/* ─── Category Tabs (underline slide, sticky below header) ─── */}
      <div className="border-b border-gray-100 sticky top-[52px] z-20 bg-white">
        <div ref={categoryTabsRef} className="flex overflow-x-auto scrollbar-hide pl-4 pr-8 scroll-px-4 relative">
          {SUB_CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                ref={active ? activeTabRef : undefined}
                onClick={() => selectCategory(cat)}
                className={`shrink-0 px-4 py-3 text-[14px] font-medium transition-colors duration-300 ${
                  active ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {cat}
              </button>
            );
          })}
          {/* Sliding indicator */}
          <span
            className="absolute bottom-0 h-[2px] bg-gray-900 rounded-full pointer-events-none"
            style={{
              left: tabIndicator.left,
              width: tabIndicator.width,
              transition: 'left 0.35s cubic-bezier(0.22, 1, 0.36, 1), width 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </div>
      </div>

      {/* ─── Region + Filter Row ─── */}
      <div className="px-4 py-2.5 flex items-center gap-2">
        <div className="relative flex-1 overflow-hidden">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {/* 내 위치 버튼 */}
          <button
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.geolocation) {
                setSelectedRegion('내 위치');
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    toast.success(`현재 위치 기반으로 검색합니다 (${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)})`);
                  },
                  () => {
                    toast.success('현재 위치 기반으로 검색합니다');
                  },
                  { enableHighAccuracy: false, timeout: 5000 }
                );
              } else {
                setSelectedRegion('내 위치');
                toast.success('현재 위치 기반으로 검색합니다');
              }
            }}
            className={`shrink-0 px-3 h-[30px] rounded-full text-[12px] font-semibold border flex items-center gap-1 transition-all active:scale-95 ${
              selectedRegion === '내 위치'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200'
            }`}
          >
            <MapPin size={11} />
            내 위치
          </button>
          {REGIONS.map((region) => {
            const active = selectedRegion === region;
            return (
              <button
                key={region}
                onClick={() => setSelectedRegion(region)}
                className={`shrink-0 px-3.5 h-[30px] rounded-full text-[12px] font-semibold border transition-all active:scale-95 ${
                  active
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                {region}
              </button>
            );
          })}
          </div>
          {/* 우측 페이드 그라데이션 */}
          <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none" />
        </div>

        {/* 상세 필터 버튼 */}
        <button
          onClick={() => setFilterOpen(true)}
          className={`shrink-0 inline-flex items-center gap-1 px-3 h-[30px] rounded-full text-[12px] font-medium transition-all active:scale-95 ${
            totalActiveFilters > 0
              ? 'bg-[#2B313D] text-white'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          <SlidersHorizontal size={12} />
          필터
          {totalActiveFilters > 0 && (
            <span className="min-w-[16px] h-[16px] px-1 rounded-full bg-white text-[#2B313D] text-[10px] font-bold flex items-center justify-center">
              {totalActiveFilters}
            </span>
          )}
        </button>
      </div>

      {/* ─── Active Filter Tags ─── */}
      {totalActiveFilters > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {FILTER_GROUPS.map((group) =>
            Array.from(filters[group.key] || []).map((opt) => (
              <button
                key={`${group.key}-${opt}`}
                onClick={() => toggleFilterOption(group.key, opt)}
                className="inline-flex items-center gap-1 px-2 rounded-[5px] bg-gray-100 text-gray-600 text-[10px] font-medium active:scale-95 transition-transform"
                style={{ height: 22 }}
              >
                {opt}
                <X size={10} className="text-gray-400" />
              </button>
            ))
          )}
        </div>
      )}

      <WeddingPartnerListBanner banners={listBanners} />

      {/* ─── Filter Floating Modal ─── */}
      {filterOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setFilterOpen(false)}
          style={{ animation: 'modalFadeIn 0.25s ease-out' }}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[80vh] overflow-y-auto pb-safe"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'sheetSlideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            {/* Handle + Header */}
            <div className="sticky top-0 bg-white z-10 rounded-t-3xl">
              <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mt-3" />
              <div className="flex items-center justify-between px-5 pt-4 pb-3">
                <h3 className="text-[17px] font-bold text-gray-900">상세 필터</h3>
                <button onClick={() => setFilterOpen(false)} className="active:scale-90 transition-transform">
                  <X size={22} className="text-gray-500" />
                </button>
              </div>
            </div>

            {/* Filter Groups */}
            <div className="divide-y divide-gray-100 px-5">
              {FILTER_GROUPS.map((group) => (
                <div key={group.key} className="flex items-start gap-3 py-3">
                  <div className="w-[90px] shrink-0 pt-1">
                    <span className="text-[13px] font-bold text-gray-900">{group.label}</span>
                  </div>
                  <div className="flex-1 flex gap-1.5 flex-wrap">
                    {group.options.map((opt) => {
                      const active = filters[group.key]?.has(opt);
                      return (
                        <button
                          key={opt}
                          onClick={() => toggleFilterOption(group.key, opt)}
                          className={`px-3 h-[28px] rounded-full text-[12px] font-medium border transition-all duration-200 active:scale-90 ${
                            active
                              ? 'bg-[#2B313D] text-white border-[#2B313D]'
                              : 'bg-white text-gray-500 border-gray-200'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 flex gap-3">
              <button
                onClick={clearAllFilters}
                className="flex-1 h-[44px] rounded-xl border border-gray-200 text-[14px] font-medium text-gray-700 active:scale-[0.98] transition-transform"
              >
                초기화
              </button>
              <button
                onClick={() => setFilterOpen(false)}
                className="flex-[2] h-[44px] rounded-xl bg-[#2B313D] text-[14px] font-bold text-white active:scale-[0.98] transition-transform"
              >
                {totalActiveFilters > 0 ? `${totalActiveFilters}개 필터 적용` : '필터 적용'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter modal animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes modalFadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes sheetSlideUp { 0% { transform: translateY(100%); } 100% { transform: translateY(0); } }
      `}} />

      {/* ─── Rank Items ─── */}
      <div
        ref={listViewportRef}
        className="overflow-hidden touch-pan-y"
        onTouchStart={handleSwipeStart}
        onTouchMove={handleSwipeMove}
        onTouchCancel={handleSwipeEnd}
        onTouchEnd={handleSwipeEnd}
        onWheel={handleHorizontalWheel}
      >
        <div
          className="flex items-start will-change-transform"
          style={{
            gap: paneGap,
            transform: `translate3d(${baseTranslate + swipeOffset}px, 0, 0)`,
            transition: swipeOffset === 0 ? 'transform 0.34s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
          }}
        >
          <div className="shrink-0" style={{ width: paneWidth }} aria-hidden>
            {renderPreviewPane(previousCategory)}
          </div>

          <div className="shrink-0 bg-white" style={{ width: paneWidth }}>
            {showListSkeleton ? (
              <div className="px-4 mt-4 space-y-4">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="flex gap-3">
                    <div className="skeleton w-[120px] h-[120px] rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="skeleton h-4 w-20 rounded" />
                      <div className="skeleton h-5 w-full rounded" />
                      <div className="skeleton h-3 w-32 rounded" />
                      <div className="skeleton h-4 w-24 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : visibleRankItems.length > 0 ? (
              <>
                <BusinessRankList
                  items={visibleRankItems}
                  favorites={favorites}
                  onToggleFav={toggleFav}
                />
                {hasMoreBusinesses && (
                  <div ref={loadMoreRef} className="px-4 py-5">
                    {loadingMore ? (
                      <div className="flex gap-3">
                        <div className="skeleton w-[96px] h-[96px] rounded-xl shrink-0" />
                        <div className="flex-1 space-y-2 py-1">
                          <div className="skeleton h-4 w-20 rounded" />
                          <div className="skeleton h-5 w-full rounded" />
                          <div className="skeleton h-3 w-32 rounded" />
                        </div>
                      </div>
                    ) : (
                      <div className="h-8" />
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="px-4 py-16 text-center">
                <p className="text-[14px] font-semibold text-gray-500">조건에 맞는 업체가 없습니다</p>
                <button
                  onClick={() => {
                    selectCategory('전체');
                    setSelectedRegion('전국');
                    clearAllFilters();
                  }}
                  className="mt-3 px-4 h-[36px] rounded-full bg-gray-900 text-white text-[13px] font-bold active:scale-95 transition-transform"
                >
                  필터 초기화
                </button>
              </div>
            )}
          </div>

          <div className="shrink-0" style={{ width: paneWidth }} aria-hidden>
            {renderPreviewPane(nextCategory)}
          </div>
        </div>
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
  );
}
