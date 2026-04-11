'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Search, SlidersHorizontal, Star, MapPin, X, Clock, ChevronDown } from 'lucide-react';
import { Suspense } from 'react';

const MOCK_PROS = [
  { id: '1', name: '강도현', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 117, puddingRank: 1, image: '/images/강도현/10000133881772850005043.avif', intro: '신뢰감 있는 보이스의 현직 아나운서', price: 500000, experience: 14, tags: ['전국가능', '우아한', '위트있는'] },
  { id: '2', name: '김동현', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 165, puddingRank: 2, image: '/images/김동현/10000365351773046135169.avif', intro: 'MC 김동현', price: 400000, experience: 8, tags: ['서울/경기', '감동적인', '유머러스한'] },
  { id: '3', name: '김민지', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 96, puddingRank: 3, image: '/images/김민지/IMG_06781773894450803.avif', intro: '꼼꼼하고 부드러운 진행', price: 550000, experience: 4, tags: ['전국가능', '섬세한', '전문적인'] },
  { id: '4', name: '김솔', category: 'MC', role: '사회자', region: '전국', rating: 4.7, reviews: 36, puddingRank: 4, image: '/images/김솔/IMG_23601771788594274.avif', intro: '자연스럽고 편안한 분위기의 웨딩 전문 MC', price: 450000, experience: 8, tags: ['서울/경기', '격식있는', '유쾌한'] },
  { id: '5', name: '김유석', category: 'MC', role: '사회자', region: '전국', rating: 4.7, reviews: 65, puddingRank: 5, image: '/images/김유석/10000029811773033474612.avif', intro: '최고의 진행자 아나운서 김유석', price: 550000, experience: 8, tags: ['전국가능', '따뜻한', '차분한'] },
  { id: '6', name: '김재성', category: 'MC', role: '사회자', region: '충청', rating: 4.5, reviews: 235, puddingRank: 6, image: '/images/김재성/10000602271772960706687.avif', intro: '순간을 기억으로 만드는 사회자', price: 450000, experience: 7, tags: ['경상권', '에너지넘치는', '위트있는'] },
  { id: '7', name: '김진아', category: 'MC', role: '사회자', region: '경상', rating: 4.6, reviews: 170, puddingRank: 7, image: '/images/김진아/IMG_53011772965035335.avif', intro: '아나운서 김진아', price: 300000, experience: 6, tags: ['서울/경기', '프리미엄', '세련된'] },
  { id: '8', name: '김호중', category: 'MC', role: '사회자', region: '전라', rating: 4.6, reviews: 232, puddingRank: 8, image: '/images/김호중/0DBA6E02-BBC8-4660-8464-5B5162FAD2461773045822216.avif', intro: '기획에서 진행까지, 무대를 완성하다', price: 300000, experience: 12, tags: ['서울/경기', '밝은', '에너지넘치는'] },
  { id: '9', name: '나연지', category: 'MC', role: '사회자', region: '강원', rating: 4.9, reviews: 239, puddingRank: 9, image: '/images/나연지/Facetune_10-02-2026-21-07-511772438130235.avif', intro: '공식행사 전문 MC', price: 300000, experience: 3, tags: ['충청권', '친근한', '안정적인'] },
  { id: '10', name: '노유재', category: 'MC', role: '사회자', region: '제주', rating: 4.7, reviews: 197, puddingRank: 10, image: '/images/노유재/10000016211774440274171.avif', intro: '신뢰와 감동이 공존하는 진행', price: 600000, experience: 16, tags: ['전국가능', '베테랑', '감동적인'] },
  { id: '11', name: '도준석', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 163, puddingRank: 11, image: '/images/도준석/1-1231772850030951.avif', intro: '격 있는 사회자', price: 550000, experience: 2, tags: ['서울/경기', '깔끔한', '아나운서출신'] },
  { id: '12', name: '문정은', category: 'MC', role: '사회자', region: '서울/경기', rating: 5.0, reviews: 242, puddingRank: 12, image: '/images/문정은/IMG_27221772621229571.avif', intro: '품격있고 고급스러운 진행', price: 550000, experience: 10, tags: ['전라권', '다정한', '유머러스한'] },
  { id: '13', name: '박상설', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 43, puddingRank: 13, image: '/images/박상설/10000077391773050357628.avif', intro: '10년 경력, 2000번의 행사 경력', price: 600000, experience: 10, tags: ['서울/경기', '전문적인', '격식있는'] },
  { id: '14', name: '박은결', category: 'MC', role: '사회자', region: '전국', rating: 4.6, reviews: 156, puddingRank: 14, image: '/images/박은결/IMG_02661773035503788.avif', intro: '아나운서 사회자 박은결', price: 550000, experience: 9, tags: ['전국가능', '국제행사전문', '프로페셔널'] },
  { id: '15', name: '박인애', category: 'MC', role: '사회자', region: '전국', rating: 4.6, reviews: 119, puddingRank: 15, image: '/images/박인애/IMG_0196.avif', intro: '13년 생방송 뉴스 진행으로 다져진 품격', price: 550000, experience: 13, tags: ['서울/경기', '돌잔치전문', '따뜻한'] },
  { id: '16', name: '박주은', category: 'MC', role: '사회자', region: '충청', rating: 4.8, reviews: 225, puddingRank: 16, image: '/images/박주은/IMG_01621772973118334.avif', intro: 'SBS Sports 아나운서', price: 450000, experience: 4, tags: ['전국가능', '방송인출신', '전문적인'] },
  { id: '17', name: '배유정', category: 'MC', role: '사회자', region: '경상', rating: 4.8, reviews: 92, puddingRank: 17, image: '/images/배유정/IMG_21541773026472716.avif', intro: '믿고 맡기는 행사', price: 550000, experience: 4, tags: ['전국가능', '우아한', '위트있는'] },
  { id: '18', name: '성연채', category: 'MC', role: '사회자', region: '전라', rating: 4.7, reviews: 241, puddingRank: 18, image: '/images/성연채/20161016_161406_IMG_5921.avif', intro: '따뜻하고 다정한 아나운서', price: 500000, experience: 10, tags: ['서울/경기', '감동적인', '유머러스한'] },
  { id: '19', name: '송지은', category: 'MC', role: '사회자', region: '강원', rating: 4.8, reviews: 86, puddingRank: 19, image: '/images/송지은/DE397232-C3A6-4FD0-80C8-0251D66A66AF1772092441240.avif', intro: '믿고 맡기는 아나운서', price: 350000, experience: 10, tags: ['전국가능', '섬세한', '전문적인'] },
  { id: '20', name: '유하늘', category: 'MC', role: '사회자', region: '제주', rating: 4.9, reviews: 34, puddingRank: 20, image: '/images/유하늘/D54BC1BA-3BF2-4827-AA76-096D4056BCDB1773030157943.avif', intro: '따뜻하고 사랑스러운 결혼식 전문 사회자', price: 550000, experience: 4, tags: ['서울/경기', '격식있는', '유쾌한'] },
  { id: '21', name: '유하영', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 54, puddingRank: 21, image: '/images/유하영/22712e20f03327c2843673c063c881f432f6af591772967031477.avif', intro: 'KBS 캐스터 유하영', price: 300000, experience: 9, tags: ['전국가능', '따뜻한', '차분한'] },
  { id: '22', name: '이강문', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 210, puddingRank: 22, image: '/images/이강문/10000353831773035180593.avif', intro: '10년 베테랑 사회자의 안정적인 진행', price: 350000, experience: 11, tags: ['경상권', '에너지넘치는', '위트있는'] },
  { id: '23', name: '이승진', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 133, puddingRank: 23, image: '/images/이승진/IMG_46511771924269213.avif', intro: '따뜻하고 깔끔한 진행의 사회자', price: 500000, experience: 4, tags: ['서울/경기', '프리미엄', '세련된'] },
  { id: '24', name: '이용석', category: 'MC', role: '사회자', region: '전국', rating: 4.9, reviews: 117, puddingRank: 24, image: '/images/이용석/10001176941772847263491.avif', intro: '1000회 이상 결혼식사회 경력', price: 600000, experience: 11, tags: ['서울/경기', '밝은', '에너지넘치는'] },
  { id: '25', name: '이우영', category: 'MC', role: '사회자', region: '전국', rating: 4.7, reviews: 222, puddingRank: 25, image: '/images/이우영/2-11772248201484.avif', intro: '현직 아나운서의 고품격 진행', price: 400000, experience: 8, tags: ['충청권', '친근한', '안정적인'] },
  { id: '26', name: '이원영', category: 'MC', role: '사회자', region: '충청', rating: 4.5, reviews: 94, puddingRank: 26, image: '/images/이원영/1-1231772531708677.avif', intro: 'KBS 춘천방송총국 기상캐스터', price: 350000, experience: 6, tags: ['전국가능', '베테랑', '감동적인'] },
  { id: '27', name: '이재원', category: 'MC', role: '사회자', region: '경상', rating: 4.9, reviews: 24, puddingRank: 27, image: '/images/이재원/17230390916981773388202648.avif', intro: '영어MC / 영어아나운서 이재원', price: 400000, experience: 11, tags: ['서울/경기', '깔끔한', '아나운서출신'] },
  { id: '28', name: '이한나', category: 'MC', role: '사회자', region: '전라', rating: 4.6, reviews: 68, puddingRank: 28, image: '/images/이한나/IMG_002209_01772081523241.avif', intro: '생방송 4년차, 현직 아나운서', price: 350000, experience: 4, tags: ['전라권', '다정한', '유머러스한'] },
  { id: '29', name: '임하람', category: 'MC', role: '사회자', region: '강원', rating: 4.8, reviews: 166, puddingRank: 29, image: '/images/임하람/10000118841772968813129.avif', intro: '남들과 다른 특별한 예식을 진행', price: 300000, experience: 8, tags: ['서울/경기', '전문적인', '격식있는'] },
  { id: '30', name: '장윤영', category: 'MC', role: '사회자', region: '제주', rating: 4.8, reviews: 225, puddingRank: 30, image: '/images/장윤영/IMG_27051772976548211.avif', intro: '아나운서 장윤영', price: 300000, experience: 1, tags: ['전국가능', '국제행사전문', '프로페셔널'] },
  { id: '31', name: '전해별', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.5, reviews: 201, puddingRank: 31, image: '/images/전해별/025209A2-09A8-4777-9A6A-DF4751F560A71772850104015.avif', intro: '탄탄한 발성의 아나운서', price: 500000, experience: 10, tags: ['서울/경기', '돌잔치전문', '따뜻한'] },
  { id: '32', name: '전혜인', category: 'MC', role: '사회자', region: '서울/경기', rating: 5.0, reviews: 152, puddingRank: 32, image: '/images/전혜인/IMG_19181773027236141.avif', intro: '믿고 맡기는 아나운서 전혜인', price: 600000, experience: 3, tags: ['전국가능', '방송인출신', '전문적인'] },
  { id: '33', name: '정미정', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 48, puddingRank: 33, image: '/images/정미정/0533d0a3d5f361ad511e32dafb775319b26ce7541772100346528.avif', intro: '경력 13년차 아나운서 및 사회자', price: 550000, experience: 13, tags: ['전국가능', '우아한', '위트있는'] },
  { id: '34', name: '정애란', category: 'MC', role: '사회자', region: '전국', rating: 4.9, reviews: 226, puddingRank: 34, image: '/images/정애란/IMG_2920.avif', intro: '임기응변에 강한 따뜻한 목소리', price: 300000, experience: 10, tags: ['서울/경기', '감동적인', '유머러스한'] },
  { id: '35', name: '정이현', category: 'MC', role: '사회자', region: '전국', rating: 4.8, reviews: 129, puddingRank: 35, image: '/images/정이현/44561772622988798.avif', intro: '10년차 전문 사회자', price: 600000, experience: 10, tags: ['전국가능', '섬세한', '전문적인'] },
  { id: '36', name: '조하늘', category: 'MC', role: '사회자', region: '충청', rating: 4.9, reviews: 152, puddingRank: 36, image: '/images/조하늘/IMG_27041773036338469.avif', intro: '아이돌 같은 아나운서 조하늘', price: 350000, experience: 5, tags: ['서울/경기', '격식있는', '유쾌한'] },
  { id: '37', name: '최진선', category: 'MC', role: '사회자', region: '경상', rating: 4.9, reviews: 204, puddingRank: 37, image: '/images/최진선/10001059551772371340253.avif', intro: '최진선', price: 550000, experience: 5, tags: ['전국가능', '따뜻한', '차분한'] },
  { id: '38', name: '한가람', category: 'MC', role: '사회자', region: '전라', rating: 4.7, reviews: 62, puddingRank: 38, image: '/images/한가람/IMG_34281772111635068.avif', intro: '고급스럽고 따뜻한 보이스 사회자', price: 550000, experience: 8, tags: ['경상권', '에너지넘치는', '위트있는'] },
  { id: '39', name: '함현지', category: 'MC', role: '사회자', region: '강원', rating: 4.6, reviews: 115, puddingRank: 39, image: '/images/함현지/11773004544652.avif', intro: '깔끔하고 격식있는 진행', price: 450000, experience: 4, tags: ['서울/경기', '프리미엄', '세련된'] },
  { id: '40', name: '허수빈', category: 'MC', role: '사회자', region: '제주', rating: 5.0, reviews: 97, puddingRank: 40, image: '/images/허수빈/IMG_01991772961130928.avif', intro: '센스와 따뜻한 진행의 전문 사회자', price: 300000, experience: 8, tags: ['서울/경기', '밝은', '에너지넘치는'] },
  { id: '41', name: '홍현미', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 222, puddingRank: 41, image: '/images/홍현미/IMG_12201772513865121.avif', intro: '정부/기업 공식행사 전문아나운서', price: 450000, experience: 10, tags: ['충청권', '친근한', '안정적인'] },
];

const CATEGORIES = ['전체', 'MC', '가수', '쇼호스트'];
const REGIONS = ['전체', '서울/경기', '강원', '충청', '전라', '경상', '제주', '전국'];
const SORT_OPTIONS = [
  { value: 'pudding_rank', label: '인기순' },
  { value: 'avg_rating', label: '평점순' },
  { value: 'review_count', label: '리뷰 많은순' },
  { value: 'price_low', label: '가격 낮은순' },
  { value: 'price_high', label: '가격 높은순' },
  { value: 'experience', label: '경력순' },
];

const POPULAR_SEARCHES = [
  '결혼식 MC', '웨딩 축가', '사회자', '기업행사 MC',
  '돌잔치 MC', '쇼호스트', '영어 MC', '부산 MC',
  '피로연 사회자', '송년회 MC',
];

const RECOMMENDED_TAGS = ['결혼식MC', '축가가수', '기업행사', '돌잔치', '쇼호스트', '영어가능', '전국출장'];

const PAGE_SIZE = 10;

function ProsListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') || '전체';

  const [search, setSearch] = useState('');
  const [hasSearched, setHasSearched] = useState(!!initialCategory && initialCategory !== '전체');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedRegion, setSelectedRegion] = useState('전체');
  const [sortBy, setSortBy] = useState('pudding_rank');
  const [showFilter, setShowFilter] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(['웨딩 MC', '축가 가수']);
  const [page, setPage] = useState(1);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [selectedCategory, selectedRegion, sortBy, search]);

  // If category comes from URL, auto-show results
  useEffect(() => {
    if (initialCategory && initialCategory !== '전체') {
      setHasSearched(true);
    }
  }, [initialCategory]);

  const submitSearch = (term?: string) => {
    const q = term ?? search;
    if (!q.trim()) return;
    setSearch(q);
    setHasSearched(true);
    setRecentSearches(prev => [q, ...prev.filter(s => s !== q)].slice(0, 10));
  };

  const removeRecent = (term: string) => {
    setRecentSearches(prev => prev.filter(s => s !== term));
  };

  const clearSearch = () => {
    setSearch('');
    setHasSearched(false);
    setSelectedCategory('전체');
  };

  const filtered = useMemo(() => {
    let results = MOCK_PROS.filter((p) => {
      if (selectedCategory !== '전체' && p.category !== selectedCategory) return false;
      if (selectedRegion !== '전체' && p.region !== selectedRegion && p.region !== '전국') return false;
      if (hasSearched && search && !p.name.includes(search) && !p.intro.includes(search) && !p.category.includes(search) && !p.tags.some(t => t.includes(search))) return false;
      return true;
    });

    // Sort
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
      default: // pudding_rank
        results = [...results].sort((a, b) => a.puddingRank - b.puddingRank);
        break;
    }

    return results;
  }, [selectedCategory, selectedRegion, sortBy, hasSearched, search]);

  const paginatedPros = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginatedPros.length < filtered.length;
  const hasActiveFilters = selectedCategory !== '전체' || selectedRegion !== '전체';

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2 px-2.5 h-12">
          <button onClick={() => router.back()} className="p-1 -ml-1 shrink-0">
            <ChevronLeft size={24} className="text-gray-800" />
          </button>
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); if (!e.target.value) setHasSearched(false); }}
              onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
              placeholder="어떤 전문가를 찾으시나요?"
              autoFocus
              className="w-full h-10 bg-gray-100 rounded-lg pl-9 pr-9 text-[14px] text-gray-800 placeholder-gray-400 outline-none focus:ring-1 focus:ring-primary-300"
            />
            {search && (
              <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X size={16} className="text-gray-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      {!hasSearched ? (
        /* ─── Before Search ─────────────────────────────────────── */
        <div className="px-4 pt-5">
          {/* Recommended Tags */}
          <div className="flex flex-wrap gap-2 mb-8">
            {RECOMMENDED_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => submitSearch(tag)}
                className="text-[13px] font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[15px] font-bold text-gray-900">최근 검색</h3>
                <button onClick={() => setRecentSearches([])} className="text-[12px] text-gray-400">
                  전체 삭제
                </button>
              </div>
              <div className="space-y-0">
                {recentSearches.map(term => (
                  <div key={term} className="flex items-center justify-between py-3 border-b border-gray-50">
                    <button
                      onClick={() => submitSearch(term)}
                      className="flex items-center gap-2.5 text-[14px] text-gray-700"
                    >
                      <Clock size={14} className="text-gray-300" />
                      {term}
                    </button>
                    <button onClick={() => removeRecent(term)} className="p-1">
                      <X size={14} className="text-gray-300" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Popular Searches */}
          <div>
            <h3 className="text-[15px] font-bold text-gray-900 mb-3">인기 검색어</h3>
            <div className="grid grid-cols-2 gap-x-4">
              {POPULAR_SEARCHES.map((term, i) => (
                <button
                  key={term}
                  onClick={() => submitSearch(term)}
                  className="flex items-center gap-2.5 py-2.5 text-left border-b border-gray-50"
                >
                  <span className={`text-[14px] font-bold w-5 text-center ${i < 3 ? 'text-primary-500' : 'text-gray-400'}`}>
                    {i + 1}
                  </span>
                  <span className="text-[14px] text-gray-700">{term}</span>
                </button>
              ))}
            </div>
          </div>

          {/* All Pros - 전체 전문가 리스트 */}
          <div className="mt-10">
            <h3 className="text-[15px] font-bold text-gray-900 mb-4">전체 전문가</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pb-28 lg:pb-12">
              {MOCK_PROS.slice(0, page * PAGE_SIZE).map((pro) => (
                <ProCard key={pro.id} pro={pro} />
              ))}
            </div>
            {page * PAGE_SIZE < MOCK_PROS.length && (
              <button
                onClick={() => setPage(p => p + 1)}
                className="w-full py-3.5 mb-28 flex items-center justify-center gap-1.5 text-[14px] font-semibold text-gray-500 bg-gray-50 rounded-xl hover:bg-gray-100 active:scale-[0.98] transition-all"
              >
                더보기
                <ChevronDown size={16} />
                <span className="text-[12px] text-gray-400 ml-1">
                  {Math.min(page * PAGE_SIZE, MOCK_PROS.length)}/{MOCK_PROS.length}
                </span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ─── After Search ──────────────────────────────────────── */
        <>
          {/* Filter Bar */}
          <div className="sticky top-12 z-[9] bg-white border-b border-gray-100">
            <div className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto scrollbar-hide">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-full transition-colors ${
                    selectedCategory === cat
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {cat}
                </button>
              ))}
              <div className="w-px h-5 bg-gray-200 shrink-0 mx-1" />
              <button
                onClick={() => setShowFilter(!showFilter)}
                className={`shrink-0 flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  hasActiveFilters ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                <SlidersHorizontal size={12} />
                필터
              </button>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilter && (
            <div className="bg-white border-b border-gray-100 px-4 py-5 space-y-5">
              <div>
                <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">지역</p>
                <div className="flex flex-wrap gap-2">
                  {REGIONS.map(r => (
                    <button
                      key={r}
                      onClick={() => setSelectedRegion(r)}
                      className={`text-[12px] font-medium px-3 py-1.5 rounded-full transition-colors ${
                        selectedRegion === r ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">정렬</p>
                <div className="flex flex-wrap gap-2">
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSortBy(opt.value)}
                      className={`text-[12px] font-medium px-3 py-1.5 rounded-full transition-colors ${
                        sortBy === opt.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Result Count + Sort */}
          <div className="px-4 py-3 flex items-center justify-between">
            <p className="text-[13px] text-gray-500">
              {search ? (
                <>&apos;{search}&apos; 검색결과 <span className="font-bold text-gray-900">{filtered.length}</span>명</>
              ) : (
                <>전문가 <span className="font-bold text-gray-900">{filtered.length}</span>명</>
              )}
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

          {/* Pro Grid */}
          {filtered.length > 0 ? (
            <div className="px-4 pb-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {paginatedPros.map((pro) => (
                  <ProCard key={pro.id} pro={pro} />
                ))}
              </div>

              {/* Load More Button */}
              {hasMore && (
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="w-full mt-5 py-3.5 flex items-center justify-center gap-1.5 text-[14px] font-semibold text-gray-500 bg-gray-50 rounded-xl hover:bg-gray-100 active:scale-[0.98] transition-all"
                >
                  더보기
                  <ChevronDown size={16} />
                  <span className="text-[12px] text-gray-400 ml-1">
                    {paginatedPros.length}/{filtered.length}
                  </span>
                </button>
              )}

              {/* All loaded indicator */}
              {!hasMore && filtered.length > PAGE_SIZE && (
                <p className="text-center text-[13px] text-gray-400 mt-6 pb-20">
                  모든 전문가를 확인했습니다
                </p>
              )}

              {/* Bottom spacer for tab bar */}
              <div className="h-20 lg:h-0" />
            </div>
          ) : (
            <div className="flex flex-col items-center py-20">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-gray-100">
                <Search size={28} className="text-gray-300" />
              </div>
              <p className="text-gray-400 text-[14px] mb-1">
                {search ? <>&apos;{search}&apos; 검색 결과가 없습니다</> : '검색 결과가 없습니다'}
              </p>
              <button
                onClick={() => { setSelectedCategory('전체'); setSelectedRegion('전체'); setSortBy('pudding_rank'); }}
                className="text-primary-500 text-[13px] font-semibold mt-2"
              >
                필터 초기화
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProCard({ pro }: { pro: typeof MOCK_PROS[0] }) {
  return (
    <Link
      href={`/pros/${pro.id}`}
      className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
    >
      <div className="relative">
        <img src={pro.image} alt={pro.name} className="w-full aspect-square object-cover" />
        {pro.puddingRank <= 3 && (
          <span className="absolute top-2.5 left-2.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-sm text-gray-800 shadow-sm">
            {pro.puddingRank === 1 ? '\u{1F947}' : pro.puddingRank === 2 ? '\u{1F948}' : '\u{1F949}'} TOP {pro.puddingRank}
          </span>
        )}
        {/* Mini radar graph */}
        <div className="absolute bottom-2 right-2 w-[42px] h-[42px] bg-white/90 backdrop-blur-sm rounded-lg shadow-sm flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 32 32">
            {(() => {
              const scores = [pro.rating / 5, Math.min(pro.reviews / 200, 1), Math.min(pro.price / 700000, 1), Math.min(pro.experience / 15, 1), 0.85, 0.75];
              const cx = 16, cy = 16, r = 12, n = 6;
              const bgPts = Array.from({ length: n }, (_, i) => {
                const a = (Math.PI * 2 * i) / n - Math.PI / 2;
                return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
              }).join(' ');
              const dataPts = scores.map((s, i) => {
                const a = (Math.PI * 2 * i) / n - Math.PI / 2;
                return `${cx + r * s * Math.cos(a)},${cy + r * s * Math.sin(a)}`;
              }).join(' ');
              return (
                <>
                  <polygon points={bgPts} fill="none" stroke="#E5E7EB" strokeWidth="0.5" />
                  <polygon points={dataPts} fill="rgba(49,128,247,0.2)" stroke="#3180F7" strokeWidth="1" />
                </>
              );
            })()}
          </svg>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center gap-1 mb-0.5">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary-50 text-primary-600">{pro.category}</span>
          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
            <MapPin size={8} /> {pro.region}
          </span>
        </div>
        <p className="text-[14px] font-bold text-gray-900">{pro.name}</p>
        <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-1">{pro.intro}</p>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
          <div className="flex items-center gap-0.5">
            <Star size={12} className="fill-yellow-400 text-yellow-400" />
            <span className="text-[12px] font-bold">{pro.rating}</span>
            <span className="text-[10px] text-gray-400">({pro.reviews})</span>
          </div>
          <p className="text-[13px] font-black text-primary-500">{(pro.price / 10000).toFixed(0)}만~</p>
        </div>
      </div>
    </Link>
  );
}

export default function ProsListPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <ProsListContent />
    </Suspense>
  );
}
