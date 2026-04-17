'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Star, MapPin, ChevronDown, Search, SlidersHorizontal, X, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { Suspense } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';
import { discoveryApi, type ProListItem } from '@/lib/api/discovery.api';

const MOCK_PROS: any[] = [];

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

const PRO_LANGUAGES: Record<string, string[]> = {};
const FOREIGN_LANG_PRO_IDS = Object.keys(PRO_LANGUAGES);
const LANGUAGES = ['전체', '영어', '일본어', '중국어'];
const MC_TYPES = ['전체', '사회자', '쇼호스트', '축가/연주'];

const SINGER_PRO_IDS: string[] = [];

const PAGE_SIZE = 50;

function getRegisteredPro() { return null; }

function ProsListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authUser = useAuthStore((s) => s.user);
  const registeredPro = getRegisteredPro();
  const [apiPros, setApiPros] = useState<typeof MOCK_PROS | null>(null);
  const [prosLoading, setProsLoading] = useState(true);

  useEffect(() => {
    setProsLoading(true);
    discoveryApi.getProList({ limit: 100, sort: 'newest' })
      .then((res) => {
        if (res?.data && res.data.length > 0) {
          const mapped = res.data.map((p: ProListItem, idx: number) => ({
            id: p.id,
            name: p.name,
            category: 'MC',
            role: '사회자',
            region: '전국',
            rating: p.avgRating || 4.5,
            reviews: p.reviewCount || 0,
            puddingRank: idx + 1,
            image: p.profileImageUrl || p.images?.[0] || '',
            intro: p.shortIntro || '',
            price: p.basePrice || 450000,
            experience: p.careerYears || 1,
          }));
          setApiPros(mapped);
        } else {
          setApiPros([]);
        }
      })
      .catch(() => { setApiPros([]); })
      .finally(() => setProsLoading(false));
  }, [authUser]);

  // API data only — empty fallback until loaded or on failure
  const basePros = apiPros || [];
  const ALL_PROS = registeredPro ? [registeredPro, ...basePros] : basePros;
  const initialRegion = searchParams.get('region') || '전체';
  const categoryParam = searchParams.get('category') || '';
  const isForeignFilter = categoryParam === '외국어사회자';

  // 카테고리 파라미터에 따라 초기 필터 설정
  const initialType = categoryParam === '축가·연주' ? '축가/연주' : categoryParam === '쇼호스트' ? '쇼호스트' : '전체';
  const initialLang = isForeignFilter ? '전체' : '전체'; // 외국어사회자는 별도 처리

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
      if (selectedLang !== '전체' && !(PRO_LANGUAGES[p.id]?.includes(selectedLang))) return false;
      if (selectedType === '축가/연주' && !SINGER_PRO_IDS.includes(p.id)) return false;
      if (selectedType !== '전체' && selectedType !== '축가/연주' && p.role !== selectedType && p.category !== selectedType) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.intro.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q)) return false;
      if (selectedRegion !== '전체' && p.region !== selectedRegion && p.region !== '전국') return false;
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
  }, [selectedRegion, sortBy, selectedPrice, searchQuery, selectedLang, selectedType]);

  const paginatedPros = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginatedPros.length < filtered.length;
  const hasActiveFilters = selectedRegion !== '전체' || selectedPrice !== 0 || selectedLang !== '전체' || selectedType !== '전체';
  const activeFilterCount = (selectedRegion !== '전체' ? 1 : 0) + (selectedPrice !== 0 ? 1 : 0) + (selectedLang !== '전체' ? 1 : 0) + (selectedType !== '전체' ? 1 : 0);

  const [loading, setLoading] = useState(() => typeof window !== 'undefined' ? !sessionStorage.getItem('visited-pros') : true);
  useEffect(() => { if (!loading) return; const t = setTimeout(() => { setLoading(false); sessionStorage.setItem('visited-pros', '1'); }, 300); return () => clearTimeout(t); }, [loading]);

  if (loading) {
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
    <div className="min-h-screen bg-white lg:max-w-7xl lg:mx-auto" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white">
        <div className="h-[52px] flex items-center px-4 lg:px-8 gap-3">
          <button onClick={() => router.back()} className="p-1 -ml-2 shrink-0 active:scale-90 transition-transform">
            <ChevronLeft size={24} className="text-gray-800" />
          </button>
          <AnimatePresence mode="wait">
            {showSearch ? (
              <motion.div
                key="search-input"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: '100%' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="flex-1 flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5 ml-1 lg:max-w-xl lg:mx-auto"
              >
                <Search size={16} className="text-gray-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="이름, 소개로 검색"
                  className="flex-1 bg-transparent text-[14px] text-gray-900 placeholder-gray-400 outline-none"
                />
                <button
                  onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                  className="p-0.5 active:scale-90 transition-transform"
                >
                  <X size={16} className="text-gray-500" />
                </button>
              </motion.div>
            ) : (
              <motion.h1
                key="title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[18px] font-bold text-gray-900 truncate"
              >
                {selectedLang !== '전체' ? `${selectedLang} 사회자` : selectedType !== '전체' ? selectedType : '사회자'}
              </motion.h1>
            )}
          </AnimatePresence>
          <div className="flex-1" />
          {!showSearch && (
            <button onClick={() => setShowSearch(true)} className="p-1 active:scale-90 transition-transform">
              <Search size={20} className="text-gray-600" />
            </button>
          )}
        </div>

        {/* Region filter chips + Filter button */}
        <div className="border-b border-gray-100">
          <div className="px-4 lg:px-8 py-2 flex gap-2 lg:gap-3 overflow-x-auto scrollbar-hide items-center">
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
              <motion.span
                animate={{ rotate: showFilter ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown size={12} />
              </motion.span>
            </button>

            <div className="w-px h-5 bg-gray-200 shrink-0" />

            {/* Region chips with layoutId animation */}
            <LayoutGroup id="pros-region-tabs">
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
                      <motion.span
                        layoutId="pros-region-bg"
                        className="absolute inset-0 bg-[#2B313D] rounded-full"
                        style={{ zIndex: -1 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span className="relative">{region}</span>
                  </button>
                );
              })}
            </LayoutGroup>
          </div>

          {/* Expandable filter panel */}
          <AnimatePresence>
            {showFilter && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
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
                    <motion.button
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => { setSelectedRegion('전체'); setSelectedPrice(0); setSortBy('pudding_rank'); setSelectedLang('전체'); setSelectedType('전체'); }}
                      className="text-[12px] text-red-500 font-medium flex items-center gap-1"
                    >
                      <X size={12} />
                      필터 초기화
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Result count + sort dropdown */}
      <div className="px-4 lg:px-8 py-3 flex items-center justify-between bg-white">
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
        {prosLoading && basePros.length === 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-4 lg:px-8 py-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-200 rounded-xl aspect-[3/4]" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div>
            <div className="divide-y divide-gray-100 lg:divide-y-0 lg:grid lg:grid-cols-4 lg:gap-4 lg:px-8 lg:pt-4">
              <AnimatePresence mode="popLayout">
                {paginatedPros.map((pro, i) => (
                  <motion.div
                    key={pro.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: i < PAGE_SIZE ? i * 0.03 : 0 }}
                  >
                    <div className="px-4 py-3 lg:px-0 lg:py-0">
                      <div className="flex gap-3 lg:flex-col lg:gap-0">
                        <Link href={`/pros/${pro.id}`} className="shrink-0 lg:w-full">
                          <div className="w-[105px] h-[140px] lg:w-full lg:h-auto lg:aspect-[3/4] rounded-lg overflow-hidden bg-gray-100">
                            <img src={pro.image || '/images/default-profile.svg'} alt={pro.name} loading="lazy" onError={(e) => { e.currentTarget.src = '/images/default-profile.svg'; }} className="w-full h-full object-cover" />
                          </div>
                        </Link>
                        <div className="flex-1 min-w-0 flex flex-col lg:mt-2">
                          <Link href={`/pros/${pro.id}`} className="flex-1">
                            <p className="text-[16px] font-bold text-gray-900">{pro.role} {pro.name}</p>
                            <div className="flex items-center gap-0.5 mt-1">
                              <Star size={13} className="fill-yellow-400 text-yellow-400" />
                              <span className="text-[13px] font-bold text-gray-900">{pro.rating}</span>
                              <span className="text-[13px] text-gray-400">({pro.reviews})</span>
                            </div>
                            <p className="text-[15px] font-bold text-gray-900 mt-1">{pro.price.toLocaleString()}원~</p>
                            <p className="text-[13px] text-gray-500 mt-2 line-clamp-2 leading-snug">&ldquo;{pro.intro}&rdquo;</p>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="px-4 lg:px-8 pb-6 pt-2 lg:col-span-4">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setPage(p => p + 1)}
                  className="w-full py-3.5 flex items-center justify-center gap-1.5 text-[14px] font-semibold text-gray-500 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  더보기
                  <ChevronDown size={16} />
                  <span className="text-[12px] text-gray-400 ml-1">
                    {paginatedPros.length}/{filtered.length}
                  </span>
                </motion.button>
              </div>
            )}

            {!hasMore && filtered.length > PAGE_SIZE && (
              <p className="text-center text-[13px] text-gray-400 py-6 lg:col-span-4">
                모든 전문가를 확인했습니다
              </p>
            )}

            <div className="h-20 lg:h-0" />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
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
          </motion.div>
        )}
      </div>

      {/* Scroll to top FAB */}
      <AnimatePresence>
        {scrolled && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-24 right-4 z-30 w-10 h-10 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center"
          >
            <ChevronUp size={18} className="text-gray-600" />
          </motion.button>
        )}
      </AnimatePresence>
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
