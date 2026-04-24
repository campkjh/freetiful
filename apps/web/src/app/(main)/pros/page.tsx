'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Star, ChevronDown, Search, SlidersHorizontal, X, ChevronUp } from 'lucide-react';
import { Suspense } from 'react';
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

const PAGE_SIZE = 10;
const PRO_LIST_PARAMS = { limit: 80, sort: 'pudding' as const, withTotal: false };

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

function ProListCard({ pro, index }: { pro: ProItem; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
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

  return (
    <div
      ref={ref}
      className={`px-4 py-3 transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
      }`}
      style={{ transitionDelay: `${Math.min(index % PAGE_SIZE, 6) * 35}ms` }}
    >
      <Link href={`/pros/${pro.id}`} className="group flex gap-3 rounded-xl active:scale-[0.985] transition-transform">
        <div className="relative w-[105px] h-[140px] rounded-lg overflow-hidden bg-gray-100 shrink-0">
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
        <div className="flex-1 min-w-0 flex flex-col py-0.5">
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
          <div className="flex items-center gap-0.5 mt-1">
            <Star size={13} className="fill-yellow-400 text-yellow-400" />
            <span className="text-[13px] font-bold text-gray-900">{pro.rating}</span>
            <span className="text-[13px] text-gray-400">({pro.reviews})</span>
          </div>
          <p className="text-[15px] font-bold text-gray-900 mt-1">
            {pro.price ? `${pro.price.toLocaleString()}원~` : '가격 협의'}
          </p>
          <p className="text-[13px] text-gray-500 mt-2 line-clamp-2 leading-snug">
            &ldquo;{pro.intro || '프리티풀 인증 전문가입니다'}&rdquo;
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
      </Link>
    </div>
  );
}

// localStorage에서 등록된 사회자 데이터 가져오기
function getRegisteredPro(): ProItem | null {
  if (typeof window === 'undefined') return null;
  const isApproved = localStorage.getItem('proRegistrationComplete');
  if (isApproved !== 'true' && isApproved !== 'approved' && isApproved !== 'pending') return null;
  const name = localStorage.getItem('proRegister_name');
  if (!name) return null;
  const photos = JSON.parse(localStorage.getItem('proRegister_photos') || '[]');
  const mainPhotoIndex = parseInt(localStorage.getItem('proRegister_mainPhotoIndex') || '0') || 0;
  const regions = JSON.parse(localStorage.getItem('proRegister_selectedRegions') || '[]');
  const category = localStorage.getItem('proRegister_category') || '';
  const languages = JSON.parse(localStorage.getItem('proRegister_languages') || '[]');
  return {
    id: 'my-pro',
    name,
    categories: category ? [category] : [],
    regions: regions,
    languages: Array.isArray(languages) ? languages : [],
    isNationwide: regions.length === 0,
    rating: 5.0,
    reviews: 0,
    puddingRank: 0,
    image: photos[mainPhotoIndex] || photos[0] || '',
    intro: localStorage.getItem('proRegister_intro') || '프리티풀 인증 전문가',
    price: 450000,
    experience: parseInt(localStorage.getItem('proRegister_careerYears') || '1'),
  };
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
  const registeredPro = getRegisteredPro();
  const initialCachedProsRef = useRef<ProItem[] | null>(null);
  if (initialCachedProsRef.current === null) {
    const cached = getCachedProList(PRO_LIST_PARAMS);
    initialCachedProsRef.current = cached?.data?.length ? mapApiPros(cached.data) : [];
  }
  const [apiPros, setApiPros] = useState<ProItem[]>(() => initialCachedProsRef.current || []);
  const [apiLoaded, setApiLoaded] = useState(() => Boolean(initialCachedProsRef.current?.length));

  useEffect(() => {
    let cancelled = false;
    discoveryApi.getProList(PRO_LIST_PARAMS)
      .then((res) => {
        if (cancelled) return;
        if (res?.data && res.data.length > 0) {
          setApiPros(mapApiPros(res.data));
        }
        setApiLoaded(true);
      })
      .catch(() => { if (!cancelled) setApiLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  // API에 프로들이 있으면 localStorage 본인 프로(my-pro) 중복 표시 안함
  // 본인 프로는 API에서 자동으로 나오므로 localStorage 버전 제거
  const ALL_PROS = apiPros.length > 0
    ? apiPros
    : (registeredPro ? [registeredPro] : []);
  const initialRegion = searchParams.get('region') || '전체';
  const categoryParam = searchParams.get('category') || '';
  const isForeignFilter = categoryParam === '외국어사회자';

  // 카테고리 파라미터에 따라 초기 필터 설정
  const initialType = categoryParam === '축가·연주' ? '축가/연주' : categoryParam === '쇼호스트' ? '쇼호스트' : isForeignFilter ? '외국어사회자' : '전체';

  const [selectedRegion, setSelectedRegion] = useState(initialRegion);
  const [sortBy, setSortBy] = useState('pudding_rank');
  const [showFilter, setShowFilter] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState(0);
  const [selectedLang, setSelectedLang] = useState(isForeignFilter ? '영어' : '전체');
  const [selectedType, setSelectedType] = useState(initialType);
  const [page, setPage] = useState(1);
  const [scrolled, setScrolled] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setPage(1); }, [selectedRegion, sortBy, selectedPrice, searchQuery, selectedLang, selectedType]);

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
    <div className="min-h-screen bg-white" style={{ letterSpacing: '-0.02em' }}>
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
            <button
              onClick={() => setShowFilter(!showFilter)}
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
              >
                <ChevronDown size={12} />
              </span>
            </button>

            <div className="w-px h-5 bg-gray-200 shrink-0" />

            {/* Region chips with animation */}
            <>
              {REGIONS.map((region) => {
                const active = selectedRegion === region;
                return (
                  <button
                    key={region}
                    onClick={() => setSelectedRegion(region)}
                    className={`relative isolate px-3 py-1.5 text-[13px] font-medium shrink-0 rounded-full transition-colors active:scale-95 ${
                      active ? 'text-white' : 'text-gray-600 border border-gray-200'
                    }`}
                  >
                    {active && (
                      <span
                        className="absolute inset-0 bg-[#2B313D] rounded-full"
                        style={{ zIndex: -1 }}
                      />
                    )}
                    <span className="relative">{region}</span>
                  </button>
                );
              })}
            </>
          </div>

          {/* Expandable filter panel */}
          <>
            {showFilter && (
              <div
                className="overflow-hidden"
              >
                <div className="px-4 pt-2 pb-4 space-y-4 bg-gray-50/50">
                  {/* Price range */}
                  <div>
                    <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">가격대</p>
                    <div className="flex flex-wrap gap-2">
                      {PRICE_RANGES.map((range, i) => (
                        <button
                          key={range.label}
                          onClick={() => setSelectedPrice(i)}
                          className={`text-[12px] font-medium px-3 py-1.5 rounded-full transition-all active:scale-95 ${
                            selectedPrice === i
                              ? 'bg-[#2B313D] text-white'
                              : 'bg-white text-gray-500 border border-gray-200'
                          }`}
                        >
                          {range.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sort */}
                  <div>
                    <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">정렬</p>
                    <div className="flex flex-wrap gap-2">
                      {SORT_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setSortBy(opt.value)}
                          className={`text-[12px] font-medium px-3 py-1.5 rounded-full transition-all active:scale-95 ${
                            sortBy === opt.value
                              ? 'bg-[#2B313D] text-white'
                              : 'bg-white text-gray-500 border border-gray-200'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* MC Type */}
                  <div>
                    <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">전문가 유형</p>
                    <div className="flex flex-wrap gap-2">
                      {MC_TYPES.map(t => (
                        <button
                          key={t}
                          onClick={() => setSelectedType(t)}
                          className={`text-[12px] font-medium px-3 py-1.5 rounded-full transition-all active:scale-95 ${
                            selectedType === t
                              ? 'bg-[#2B313D] text-white'
                              : 'bg-white text-gray-500 border border-gray-200'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Language */}
                  <div>
                    <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">외국어</p>
                    <div className="flex flex-wrap gap-2">
                      {LANGUAGES.map(lang => (
                        <button
                          key={lang}
                          onClick={() => setSelectedLang(lang)}
                          className={`text-[12px] font-medium px-3 py-1.5 rounded-full transition-all active:scale-95 ${
                            selectedLang === lang
                              ? 'bg-[#2B313D] text-white'
                              : 'bg-white text-gray-500 border border-gray-200'
                          }`}
                        >
                          {lang}
                        </button>
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
                </div>
              </div>
            )}
          </>
        </div>
      </div>

      {/* Result count + sort dropdown */}
      <div className="px-4 py-3 flex items-center justify-between bg-white">
        <p className="text-[13px] text-gray-500">
          전문가 <span className="font-bold text-gray-900">{filtered.length}</span>명
        </p>
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

      {/* Pro List — 찜목록 스타일 (가로형 카드) */}
      <div ref={listRef}>
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
                모든 전문가를 확인했습니다
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
            <p className="text-gray-400 text-[14px] mb-1">해당 조건의 전문가가 없습니다</p>
            <button
              onClick={() => { setSelectedRegion('전체'); setSelectedPrice(0); setSortBy('pudding_rank'); setSelectedLang('전체'); setSelectedType('전체'); }}
              className="text-primary-500 text-[13px] font-semibold mt-2"
            >
              필터 초기화
            </button>
          </div>
        )}
      </div>

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
  );
}

export default function ProsListPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <ProsListContent />
    </Suspense>
  );
}
