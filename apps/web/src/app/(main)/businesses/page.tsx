'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ChevronLeft, ChevronDown, ChevronUp, SlidersHorizontal, Heart, X, MapPin, ArrowUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api/client';

// ─── Types ─────────────────────────────────────────────────
interface RankItem {
  id: string;
  rank: number;
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
  verifiedBadge?: string;
}

// ─── Mock Data ─────────────────────────────────────────────
const REGIONS = ['전국', '경기', '서울', '부산', '인천', '대구', '충남/세종'];

const SUB_CATEGORIES = ['전체', '웨딩홀', '스튜디오', '드레스', '헤메샵', '스냅영상', '피부과'];

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

const MOCK_RANK_ITEMS: RankItem[] = [
  {
    id: 'b1',
    rank: 1,
    title: '클레오르 진심 입술필러',
    region: '경기 의정부역',
    clinic: '클레오르의원-의정부점',
    rating: 9.7,
    reviewCount: 14,
    originalPrice: 77000,
    discountPercent: 44,
    finalPrice: 42900,
    hasAppPay: true,
    hasAppBooking: true,
    image: '/images/default-profile.svg',
  },
  {
    id: 'b2',
    rank: 2,
    title: '필러',
    region: '경기 의정부역',
    clinic: '쏘울성형외과의원',
    rating: 9.8,
    reviewCount: 9,
    originalPrice: 165000,
    discountPercent: 40,
    finalPrice: 99000,
    hasAppPay: false,
    hasAppBooking: true,
    image: '/images/default-profile.svg',
    verifiedBadge: '고객평가우수병원',
  },
  {
    id: 'b3',
    rank: 3,
    title: '볼륨 가득 입술필러, 입술전체, 입술 입꼬리 리버스클리닉 분당',
    region: '경기 서현역',
    clinic: '리버스의원-분당점',
    rating: 9.0,
    reviewCount: 15,
    finalPrice: 99000,
    hasAppPay: true,
    hasAppBooking: true,
    image: '/images/default-profile.svg',
  },
  {
    id: 'b4',
    rank: 4,
    title: '화수목 평일 한정 리버스 EVENT_보톡스 여드름관리 슈링크유니버스 볼뉴머 필러',
    region: '경기 수원시청역',
    clinic: '리버스의원-수원점',
    rating: 8.7,
    reviewCount: 3,
    originalPrice: 50000,
    discountPercent: 13,
    finalPrice: 43500,
    hasAppPay: true,
    hasAppBooking: true,
    image: '/images/default-profile.svg',
  },
  {
    id: 'b5',
    rank: 5,
    title: '프리미엄 입술 필러 패키지',
    region: '경기 성남역',
    clinic: '뷰티클리닉-성남점',
    rating: 9.2,
    reviewCount: 28,
    originalPrice: 120000,
    discountPercent: 38,
    finalPrice: 74400,
    hasAppPay: true,
    hasAppBooking: true,
    image: '/images/default-profile.svg',
  },
  {
    id: 'b6',
    rank: 6,
    title: '웨딩 촬영 프리미엄 패키지',
    region: '경기 분당역',
    clinic: '무드스튜디오-분당점',
    rating: 9.5,
    reviewCount: 42,
    originalPrice: 2000000,
    discountPercent: 35,
    finalPrice: 1300000,
    hasAppPay: true,
    hasAppBooking: true,
    image: '/images/default-profile.svg',
  },
];

// ─── Page ──────────────────────────────────────────────────
export default function BusinessListPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(() => typeof window !== 'undefined' ? !sessionStorage.getItem('visited-biz') : true);
  const [selectedRegion, setSelectedRegion] = useState('경기');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [rankItems, setRankItems] = useState<RankItem[]>(MOCK_RANK_ITEMS);

  // Fetch businesses from API
  useEffect(() => {
    apiClient.get('/api/v1/business')
      .then((res) => {
        const data = res.data;
        const items = Array.isArray(data) ? data : data?.items;
        if (Array.isArray(items) && items.length > 0) {
          setRankItems(items.map((b: any, i: number) => ({
            id: b.id || String(i),
            rank: b.rank || i + 1,
            title: b.title || b.name || '',
            region: b.region || '',
            clinic: b.clinic || b.businessName || '',
            rating: b.rating ?? 0,
            reviewCount: b.reviewCount ?? 0,
            originalPrice: b.originalPrice,
            discountPercent: b.discountPercent,
            finalPrice: b.finalPrice ?? b.price ?? 0,
            hasAppPay: b.hasAppPay ?? false,
            hasAppBooking: b.hasAppBooking ?? false,
            image: b.image || b.imageUrl || '/images/default-profile.svg',
            verifiedBadge: b.verifiedBadge,
          })));
        }
      })
      .catch(() => { /* fallback to MOCK_RANK_ITEMS */ });
  }, []);

  useEffect(() => { if (!loading) return; const t = setTimeout(() => { setLoading(false); sessionStorage.setItem('visited-biz', '1'); }, 300); return () => clearTimeout(t); }, [loading]);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(FILTER_GROUPS.map((g) => [g.key, new Set<string>()]))
  );

  const toggleFav = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFilterOption = (groupKey: string, option: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      const set = new Set(next[groupKey]);
      if (set.has(option)) set.delete(option);
      else set.add(option);
      next[groupKey] = set;
      return next;
    });
  };

  const clearAllFilters = () => {
    setFilters(Object.fromEntries(FILTER_GROUPS.map((g) => [g.key, new Set<string>()])));
  };

  const totalActiveFilters = Object.values(filters).reduce((sum, set) => sum + set.size, 0);

  if (loading) {
    return (
      <div className="bg-white min-h-screen pb-20">
        <div className="h-[52px] px-4 flex items-center gap-3">
          <div className="skeleton w-6 h-6 rounded" />
          <div className="skeleton h-5 w-24 rounded" />
        </div>
        <div className="px-4 py-2 flex gap-2">
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-8 w-16 rounded-full shrink-0" />)}
        </div>
        <div className="px-4 mt-4 space-y-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex gap-3">
              <div className="skeleton w-[100px] h-[100px] rounded-xl shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="skeleton h-4 w-20 rounded" />
                <div className="skeleton h-5 w-full rounded" />
                <div className="skeleton h-3 w-32 rounded" />
                <div className="skeleton h-4 w-24 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

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
        <div className="flex overflow-x-auto scrollbar-hide px-4 relative">
          {SUB_CATEGORIES.map((cat, idx) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                ref={(el) => { if (active && el) { const r = el.getBoundingClientRect(); const p = el.parentElement?.getBoundingClientRect(); if (p) { el.parentElement?.style.setProperty('--tab-left', `${r.left - p.left + 8}px`); el.parentElement?.style.setProperty('--tab-width', `${r.width - 16}px`); } } }}
                onClick={() => setSelectedCategory(cat)}
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
              left: 'var(--tab-left, 16px)',
              width: 'var(--tab-width, 32px)',
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
      <div className="divide-y divide-gray-50">
        {rankItems.map((item) => (
          <Link
            key={item.id}
            href={`/businesses/${item.id}`}
            className="flex gap-3 px-4 py-4 group active:bg-gray-50/50 transition-colors"
          >
            {/* Image with rank badge */}
            <div className="relative w-[120px] h-[120px] shrink-0 rounded-xl overflow-hidden bg-gray-100">
              <Image
                src={item.image}
                alt={item.title}
                fill
                className="object-cover"
                sizes="120px"
              />
              {/* Rank number badge */}
              <div className="absolute top-0 left-0 w-[28px] h-[28px] bg-[#3180F7] flex items-center justify-center rounded-br-xl">
                <span className="text-[15px] font-bold text-white">{item.rank}</span>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 flex flex-col">
              {/* Verified badge */}
              {item.verifiedBadge && (
                <div className="flex items-center gap-1 mb-0.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#3180F7">
                    <path d="M12 2l2.5 4.5 5 .5-3.5 3.5 1 5-5-2.5-5 2.5 1-5L4.5 7l5-.5L12 2z" />
                  </svg>
                  <span className="text-[11px] font-bold text-[#3180F7]">{item.verifiedBadge}</span>
                </div>
              )}

              {/* Title */}
              <p className="text-[15px] font-bold text-gray-900 leading-[1.3] line-clamp-2 pr-6">{item.title}</p>

              {/* Location */}
              <p className="text-[12px] text-gray-500 mt-0.5 leading-tight">
                {item.region} · {item.clinic}
              </p>

              {/* Rating */}
              <div className="flex items-center gap-1 mt-0.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#FFB800">
                  <path d="M12 2l2.9 6.5 7.1.8-5.3 4.9 1.5 7L12 17.8 5.8 21.2l1.5-7L2 9.3l7.1-.8L12 2z" />
                </svg>
                <span className="text-[13px] font-bold text-gray-900">{item.rating.toFixed(1)}</span>
                <span className="text-[12px] text-gray-400">({item.reviewCount})</span>
              </div>

              {/* Price */}
              <div className="mt-1">
                {item.originalPrice && item.discountPercent ? (
                  <>
                    <div className="flex items-center gap-1.5 leading-tight">
                      <span className="text-[11px] text-gray-400">VAT 포함 ·</span>
                      <span className="text-[12px] text-gray-400 line-through">{item.originalPrice.toLocaleString()}원</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 leading-tight">
                      <span className="text-[15px] font-bold text-[#3180F7]">{item.discountPercent}%</span>
                      <span className="text-[17px] font-bold text-gray-900">{item.finalPrice.toLocaleString()}원</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[11px] text-gray-400 leading-tight">VAT 포함</div>
                    <div className="text-[17px] font-bold text-gray-900 leading-tight">{item.finalPrice.toLocaleString()}원</div>
                  </>
                )}

                {/* App badges */}
                <div className="flex items-center gap-1.5 mt-1">
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
              </div>
            </div>

            {/* Heart */}
            <button
              onClick={(e) => { e.preventDefault(); toggleFav(item.id); }}
              className="shrink-0 self-start p-1 active:scale-90 transition-transform"
            >
              <Heart
                size={22}
                className={favorites.has(item.id) ? 'fill-[#FF4D4D] text-[#FF4D4D]' : 'text-gray-300'}
              />
            </button>
          </Link>
        ))}
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
