'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Search, SlidersHorizontal, Star, MapPin, X, Clock } from 'lucide-react';

const MOCK_PROS = [
  { id: '1', name: '김민준', category: 'MC', region: '서울/경기', rating: 4.9, reviews: 142, puddingRank: 1, image: 'https://i.pravatar.cc/300?img=1', intro: '10년 경력 웨딩/기업행사 전문 MC', price: 500000 },
  { id: '2', name: '이서연', category: 'MC', region: '서울/경기', rating: 4.8, reviews: 98, puddingRank: 2, image: 'https://i.pravatar.cc/300?img=5', intro: '감동과 유머를 함께하는 행사 MC', price: 450000 },
  { id: '3', name: '박준혁', category: '가수', region: '전국', rating: 5.0, reviews: 67, puddingRank: 3, image: 'https://i.pravatar.cc/300?img=3', intro: '발라드 전문 웨딩 축가 가수', price: 400000 },
  { id: '4', name: '최지은', category: '쇼호스트', region: '서울/경기', rating: 4.7, reviews: 55, puddingRank: 4, image: 'https://i.pravatar.cc/300?img=9', intro: '명랑하고 전문적인 쇼호스트', price: 350000 },
  { id: '5', name: '정대현', category: 'MC', region: '경상', rating: 4.9, reviews: 89, puddingRank: 5, image: 'https://i.pravatar.cc/300?img=11', intro: '부산 경남 지역 웨딩 전문 MC', price: 400000 },
  { id: '6', name: '한소희', category: '가수', region: '서울/경기', rating: 4.6, reviews: 43, puddingRank: 6, image: 'https://i.pravatar.cc/300?img=20', intro: '팝&재즈 웨딩 축가 전문', price: 350000 },
];

const CATEGORIES = ['전체', 'MC', '가수', '쇼호스트'];
const REGIONS = ['전체', '서울/경기', '강원', '충청', '전라', '경상', '제주'];
const SORT_OPTIONS = [
  { value: 'pudding_rank', label: '인기순' },
  { value: 'avg_rating', label: '평점순' },
  { value: 'review_count', label: '리뷰 많은순' },
  { value: 'newest', label: '최신순' },
];

const POPULAR_SEARCHES = [
  '결혼식 MC', '웨딩 축가', '사회자', '기업행사 MC',
  '돌잔치 MC', '쇼호스트', '영어 MC', '부산 MC',
  '피로연 사회자', '송년회 MC',
];

const RECOMMENDED_TAGS = ['결혼식MC', '축가가수', '기업행사', '돌잔치', '쇼호스트', '영어가능', '전국출장'];

export default function ProsListPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedRegion, setSelectedRegion] = useState('전체');
  const [sortBy, setSortBy] = useState('pudding_rank');
  const [showFilter, setShowFilter] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(['웨딩 MC', '축가 가수']);

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
  };

  const filtered = MOCK_PROS.filter((p) => {
    if (selectedCategory !== '전체' && p.category !== selectedCategory) return false;
    if (selectedRegion !== '전체' && p.region !== selectedRegion && p.region !== '전국') return false;
    if (hasSearched && search && !p.name.includes(search) && !p.intro.includes(search) && !p.category.includes(search)) return false;
    return true;
  });

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

          {/* Result Count */}
          <div className="px-4 py-3">
            <p className="text-[13px] text-gray-500">
              &apos;{search}&apos; 검색결과 <span className="font-bold text-gray-900">{filtered.length}</span>명
            </p>
          </div>

          {/* Pro Grid */}
          {filtered.length > 0 ? (
            <div className="px-4 grid grid-cols-2 lg:grid-cols-4 gap-3 pb-28 lg:pb-12">
              {filtered.map((pro, i) => (
                <Link
                  key={pro.id}
                  href={`/pros/${pro.id}`}
                  className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                >
                  <div className="relative">
                    <img src={pro.image} alt={pro.name} className="w-full aspect-square object-cover" />
                    {pro.puddingRank <= 3 && (
                      <span className="absolute top-2.5 left-2.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-sm text-gray-800 shadow-sm">
                        {pro.puddingRank === 1 ? '🥇' : pro.puddingRank === 2 ? '🥈' : '🥉'} TOP {pro.puddingRank}
                      </span>
                    )}
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
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-20">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-gray-100">
                <Search size={28} className="text-gray-300" />
              </div>
              <p className="text-gray-400 text-[14px] mb-1">&apos;{search}&apos; 검색 결과가 없습니다</p>
              <button
                onClick={() => { setSelectedCategory('전체'); setSelectedRegion('전체'); }}
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
