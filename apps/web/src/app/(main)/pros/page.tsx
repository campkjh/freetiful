'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Star, MapPin, ChevronDown, Search, SlidersHorizontal, X, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { Suspense } from 'react';

const MOCK_PROS = [
  { id: '1', name: '강도현', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 117, puddingRank: 1, image: '/images/강도현/10000133881772850005043.avif', intro: '신뢰감 있는 보이스의 현직 아나운서', price: 500000, experience: 14 },
  { id: '2', name: '김동현', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 165, puddingRank: 2, image: '/images/김동현/10000365351773046135169.avif', intro: 'MC 김동현', price: 400000, experience: 8 },
  { id: '3', name: '김민지', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 96, puddingRank: 3, image: '/images/김민지/IMG_06781773894450803.avif', intro: '꼼꼼하고 부드러운 진행', price: 550000, experience: 4 },
  { id: '4', name: '김솔', category: 'MC', role: '사회자', region: '전국', rating: 4.7, reviews: 36, puddingRank: 4, image: '/images/김솔/IMG_23601771788594274.avif', intro: '자연스럽고 편안한 분위기의 웨딩 전문 MC', price: 450000, experience: 8 },
  { id: '5', name: '김유석', category: 'MC', role: '사회자', region: '전국', rating: 4.7, reviews: 65, puddingRank: 5, image: '/images/김유석/10000029811773033474612.avif', intro: '최고의 진행자 아나운서 김유석', price: 550000, experience: 8 },
  { id: '6', name: '김재성', category: 'MC', role: '사회자', region: '충청', rating: 4.5, reviews: 235, puddingRank: 6, image: '/images/김재성/10000602271772960706687.avif', intro: '순간을 기억으로 만드는 사회자', price: 450000, experience: 7 },
  { id: '7', name: '김진아', category: 'MC', role: '사회자', region: '경상', rating: 4.6, reviews: 170, puddingRank: 7, image: '/images/김진아/IMG_53011772965035335.avif', intro: '아나운서 김진아', price: 300000, experience: 6 },
  { id: '8', name: '김호중', category: 'MC', role: '사회자', region: '전라', rating: 4.6, reviews: 232, puddingRank: 8, image: '/images/김호중/0DBA6E02-BBC8-4660-8464-5B5162FAD2461773045822216.avif', intro: '기획에서 진행까지, 무대를 완성하다', price: 300000, experience: 12 },
  { id: '9', name: '나연지', category: 'MC', role: '사회자', region: '강원', rating: 4.9, reviews: 239, puddingRank: 9, image: '/images/나연지/Facetune_10-02-2026-21-07-511772438130235.avif', intro: '공식행사 전문 MC', price: 300000, experience: 3 },
  { id: '10', name: '노유재', category: 'MC', role: '사회자', region: '제주', rating: 4.7, reviews: 197, puddingRank: 10, image: '/images/노유재/10000016211774440274171.avif', intro: '신뢰와 감동이 공존하는 진행', price: 600000, experience: 16 },
  { id: '11', name: '도준석', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 163, puddingRank: 11, image: '/images/도준석/1-1231772850030951.avif', intro: '격 있는 사회자', price: 550000, experience: 2 },
  { id: '12', name: '문정은', category: 'MC', role: '사회자', region: '서울/경기', rating: 5.0, reviews: 242, puddingRank: 12, image: '/images/문정은/IMG_27221772621229571.avif', intro: '품격있고 고급스러운 진행', price: 550000, experience: 10 },
  { id: '13', name: '박상설', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 43, puddingRank: 13, image: '/images/박상설/10000077391773050357628.avif', intro: '10년 경력, 2000번의 행사 경력', price: 600000, experience: 10 },
  { id: '14', name: '박은결', category: 'MC', role: '사회자', region: '전국', rating: 4.6, reviews: 156, puddingRank: 14, image: '/images/박은결/IMG_02661773035503788.avif', intro: '아나운서 사회자 박은결', price: 550000, experience: 9 },
  { id: '15', name: '박인애', category: 'MC', role: '사회자', region: '전국', rating: 4.6, reviews: 119, puddingRank: 15, image: '/images/박인애/IMG_0196.avif', intro: '13년 생방송 뉴스 진행으로 다져진 품격', price: 550000, experience: 13 },
  { id: '16', name: '박주은', category: 'MC', role: '사회자', region: '충청', rating: 4.8, reviews: 225, puddingRank: 16, image: '/images/박주은/IMG_01621772973118334.avif', intro: 'SBS Sports 아나운서', price: 450000, experience: 4 },
  { id: '17', name: '배유정', category: 'MC', role: '사회자', region: '경상', rating: 4.8, reviews: 92, puddingRank: 17, image: '/images/배유정/IMG_21541773026472716.avif', intro: '믿고 맡기는 행사', price: 550000, experience: 4 },
  { id: '18', name: '성연채', category: 'MC', role: '사회자', region: '전라', rating: 4.7, reviews: 241, puddingRank: 18, image: '/images/성연채/20161016_161406_IMG_5921.avif', intro: '따뜻하고 다정한 아나운서', price: 500000, experience: 10 },
  { id: '19', name: '송지은', category: 'MC', role: '사회자', region: '강원', rating: 4.8, reviews: 86, puddingRank: 19, image: '/images/송지은/DE397232-C3A6-4FD0-80C8-0251D66A66AF1772092441240.avif', intro: '믿고 맡기는 아나운서', price: 350000, experience: 10 },
  { id: '20', name: '유하늘', category: 'MC', role: '사회자', region: '제주', rating: 4.9, reviews: 34, puddingRank: 20, image: '/images/유하늘/D54BC1BA-3BF2-4827-AA76-096D4056BCDB1773030157943.avif', intro: '따뜻하고 사랑스러운 결혼식 전문 사회자', price: 550000, experience: 4 },
  { id: '21', name: '유하영', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 54, puddingRank: 21, image: '/images/유하영/22712e20f03327c2843673c063c881f432f6af591772967031477.avif', intro: 'KBS 캐스터 유하영', price: 300000, experience: 9 },
  { id: '22', name: '이강문', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 210, puddingRank: 22, image: '/images/이강문/10000353831773035180593.avif', intro: '10년 베테랑 사회자의 안정적인 진행', price: 350000, experience: 11 },
  { id: '23', name: '이승진', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 133, puddingRank: 23, image: '/images/이승진/IMG_46511771924269213.avif', intro: '따뜻하고 깔끔한 진행의 사회자', price: 500000, experience: 4 },
  { id: '24', name: '이용석', category: 'MC', role: '사회자', region: '전국', rating: 4.9, reviews: 117, puddingRank: 24, image: '/images/이용석/10001176941772847263491.avif', intro: '1000회 이상 결혼식사회 경력', price: 600000, experience: 11 },
  { id: '25', name: '이우영', category: 'MC', role: '사회자', region: '전국', rating: 4.7, reviews: 222, puddingRank: 25, image: '/images/이우영/2-11772248201484.avif', intro: '현직 아나운서의 고품격 진행', price: 400000, experience: 8 },
  { id: '26', name: '이원영', category: 'MC', role: '사회자', region: '충청', rating: 4.5, reviews: 94, puddingRank: 26, image: '/images/이원영/1-1231772531708677.avif', intro: 'KBS 춘천방송총국 기상캐스터', price: 350000, experience: 6 },
  { id: '27', name: '이재원', category: 'MC', role: '사회자', region: '경상', rating: 4.9, reviews: 24, puddingRank: 27, image: '/images/이재원/17230390916981773388202648.avif', intro: '영어MC / 영어아나운서 이재원', price: 400000, experience: 11 },
  { id: '28', name: '이한나', category: 'MC', role: '사회자', region: '전라', rating: 4.6, reviews: 68, puddingRank: 28, image: '/images/이한나/IMG_002209_01772081523241.avif', intro: '생방송 4년차, 현직 아나운서', price: 350000, experience: 4 },
  { id: '29', name: '임하람', category: 'MC', role: '사회자', region: '강원', rating: 4.8, reviews: 166, puddingRank: 29, image: '/images/임하람/10000118841772968813129.avif', intro: '남들과 다른 특별한 예식을 진행', price: 300000, experience: 8 },
  { id: '30', name: '장윤영', category: 'MC', role: '사회자', region: '제주', rating: 4.8, reviews: 225, puddingRank: 30, image: '/images/장윤영/IMG_27051772976548211.avif', intro: '아나운서 장윤영', price: 300000, experience: 1 },
  { id: '31', name: '전해별', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.5, reviews: 201, puddingRank: 31, image: '/images/전해별/025209A2-09A8-4777-9A6A-DF4751F560A71772850104015.avif', intro: '탄탄한 발성의 아나운서', price: 500000, experience: 10 },
  { id: '32', name: '전혜인', category: 'MC', role: '사회자', region: '서울/경기', rating: 5.0, reviews: 152, puddingRank: 32, image: '/images/전혜인/IMG_19181773027236141.avif', intro: '믿고 맡기는 아나운서 전혜인', price: 600000, experience: 3 },
  { id: '33', name: '정미정', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 48, puddingRank: 33, image: '/images/정미정/0533d0a3d5f361ad511e32dafb775319b26ce7541772100346528.avif', intro: '경력 13년차 아나운서 및 사회자', price: 550000, experience: 13 },
  { id: '34', name: '정애란', category: 'MC', role: '사회자', region: '전국', rating: 4.9, reviews: 226, puddingRank: 34, image: '/images/정애란/IMG_2920.avif', intro: '임기응변에 강한 따뜻한 목소리', price: 300000, experience: 10 },
  { id: '35', name: '정이현', category: 'MC', role: '사회자', region: '전국', rating: 4.8, reviews: 129, puddingRank: 35, image: '/images/정이현/44561772622988798.avif', intro: '10년차 전문 사회자', price: 600000, experience: 10 },
  { id: '36', name: '조하늘', category: 'MC', role: '사회자', region: '충청', rating: 4.9, reviews: 152, puddingRank: 36, image: '/images/조하늘/IMG_27041773036338469.avif', intro: '아이돌 같은 아나운서 조하늘', price: 350000, experience: 5 },
  { id: '37', name: '최진선', category: 'MC', role: '사회자', region: '경상', rating: 4.9, reviews: 204, puddingRank: 37, image: '/images/최진선/10001059551772371340253.avif', intro: '최진선', price: 550000, experience: 5 },
  { id: '38', name: '한가람', category: 'MC', role: '사회자', region: '전라', rating: 4.7, reviews: 62, puddingRank: 38, image: '/images/한가람/IMG_34281772111635068.avif', intro: '고급스럽고 따뜻한 보이스 사회자', price: 550000, experience: 8 },
  { id: '39', name: '함현지', category: 'MC', role: '사회자', region: '강원', rating: 4.6, reviews: 115, puddingRank: 39, image: '/images/함현지/11773004544652.avif', intro: '깔끔하고 격식있는 진행', price: 450000, experience: 4 },
  { id: '40', name: '허수빈', category: 'MC', role: '사회자', region: '제주', rating: 5.0, reviews: 97, puddingRank: 40, image: '/images/허수빈/IMG_01991772961130928.avif', intro: '센스와 따뜻한 진행의 전문 사회자', price: 300000, experience: 8 },
  { id: '41', name: '홍현미', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 222, puddingRank: 41, image: '/images/홍현미/IMG_12201772513865121.avif', intro: '정부/기업 공식행사 전문아나운서', price: 450000, experience: 10 },
];

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

const PAGE_SIZE = 12;

function ProsListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRegion = searchParams.get('region') || '전체';

  const [selectedRegion, setSelectedRegion] = useState(initialRegion);
  const [sortBy, setSortBy] = useState('pudding_rank');
  const [showFilter, setShowFilter] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState(0); // index into PRICE_RANGES
  const [page, setPage] = useState(1);
  const [scrolled, setScrolled] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setPage(1); }, [selectedRegion, sortBy, selectedPrice]);

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
    let results = MOCK_PROS.filter((p) => {
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
  }, [selectedRegion, sortBy, selectedPrice]);

  const paginatedPros = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginatedPros.length < filtered.length;
  const hasActiveFilters = selectedRegion !== '전체' || selectedPrice !== 0;
  const activeFilterCount = (selectedRegion !== '전체' ? 1 : 0) + (selectedPrice !== 0 ? 1 : 0);

  return (
    <div className="min-h-screen bg-white" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white">
        <div className="h-[52px] flex items-center px-4 gap-3">
          <button onClick={() => router.back()} className="p-1 -ml-2 shrink-0 active:scale-90 transition-transform">
            <ChevronLeft size={24} className="text-gray-800" />
          </button>
          <h1 className="text-[18px] font-bold text-gray-900">사회자</h1>
          <div className="flex-1" />
          <Link href="/pros/search" className="p-1 active:scale-90 transition-transform">
            <Search size={20} className="text-gray-600" />
          </Link>
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

                  {/* Reset + Apply */}
                  {hasActiveFilters && (
                    <motion.button
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => { setSelectedRegion('전체'); setSelectedPrice(0); setSortBy('pudding_rank'); }}
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
                    <div className="px-4 py-3">
                      <div className="flex gap-3">
                        <Link href={`/pros/${pro.id}`} className="shrink-0">
                          <div className="w-[105px] h-[140px] rounded-lg overflow-hidden bg-gray-100">
                            <img src={pro.image} alt={pro.name} className="w-full h-full object-cover" />
                          </div>
                        </Link>
                        <div className="flex-1 min-w-0 flex flex-col">
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
              <div className="px-4 pb-6 pt-2">
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
              <p className="text-center text-[13px] text-gray-400 py-6">
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
              onClick={() => { setSelectedRegion('전체'); setSelectedPrice(0); setSortBy('pudding_rank'); }}
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
