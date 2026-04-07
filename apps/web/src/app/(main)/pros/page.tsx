'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, SlidersHorizontal, Star, MapPin, X } from 'lucide-react';

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

export default function ProsListPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedRegion, setSelectedRegion] = useState('전체');
  const [sortBy, setSortBy] = useState('pudding_rank');
  const [showFilter, setShowFilter] = useState(false);

  const filtered = MOCK_PROS.filter((p) => {
    if (selectedCategory !== '전체' && p.category !== selectedCategory) return false;
    if (selectedRegion !== '전체' && p.region !== selectedRegion && p.region !== '전국') return false;
    if (search && !p.name.includes(search) && !p.intro.includes(search)) return false;
    return true;
  });

  const hasActiveFilters = selectedCategory !== '전체' || selectedRegion !== '전체';

  return (
    <div className="bg-surface-50 min-h-screen">
      {/* Header */}
      <div className="glass sticky top-0 lg:top-[72px] z-10 px-5 pt-12 lg:pt-5 pb-4 border-b border-gray-100/50">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.back()} className="p-1 lg:hidden">
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="전문가 검색"
              className="w-full bg-surface-100 rounded-2xl pl-11 pr-10 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary-200/60 border border-transparent focus:border-primary-300"
              style={{ transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-surface-200" style={{ transition: 'all 0.2s' }}>
                <X size={14} className="text-gray-400" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`p-2.5 relative rounded-xl ${showFilter ? 'bg-primary-50 text-primary-500' : 'hover:bg-surface-100'}`}
            style={{ transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <SlidersHorizontal size={20} className={showFilter ? 'text-primary-500' : 'text-gray-600'} />
            {hasActiveFilters && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-primary-500 rounded-full ring-2 ring-white" />
            )}
          </button>
        </div>

        {/* Category Chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5 lg:mx-0 lg:px-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={selectedCategory === cat ? 'chip-active' : 'chip-inactive'}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilter && (
        <div className="bg-white border-b border-gray-100/80 px-5 py-6 space-y-6 animate-slide-up" style={{ animationFillMode: 'forwards' }}>
          <div>
            <p className="eyebrow mb-3">지역</p>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedRegion(r)}
                  className={selectedRegion === r ? 'chip-active text-[12px]' : 'chip-inactive text-[12px]'}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow mb-3">정렬</p>
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  className={sortBy === opt.value ? 'chip-active text-[12px]' : 'chip-inactive text-[12px]'}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Result Count */}
      <div className="px-5 lg:px-0 lg:max-w-7xl lg:mx-auto lg:px-8 py-4">
        <p className="text-[13px] text-gray-500">전문가 <span className="font-bold text-gray-900">{filtered.length}</span>명</p>
      </div>

      {/* Pro Grid */}
      <div className="px-5 lg:px-0 lg:max-w-7xl lg:mx-auto lg:px-8 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-5 pb-28 lg:pb-12">
        {filtered.map((pro, i) => (
          <Link
            key={pro.id}
            href={`/pros/${pro.id}`}
            className="card-interactive opacity-0 animate-fade-in"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'forwards' }}
          >
            <div className="relative">
              <img src={pro.image} alt={pro.name} className="w-full aspect-square object-cover" />
              {pro.puddingRank <= 3 && (
                <span className="absolute top-2.5 left-2.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-sm text-gray-800 shadow-sm">
                  {pro.puddingRank === 1 ? '🥇' : pro.puddingRank === 2 ? '🥈' : '🥉'} TOP {pro.puddingRank}
                </span>
              )}
            </div>
            <div className="p-3.5 lg:p-4">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="tag-primary text-[10px]">{pro.category}</span>
                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                  <MapPin size={8} /> {pro.region}
                </span>
              </div>
              <p className="text-[14px] font-bold text-gray-900">{pro.name}</p>
              <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-1">{pro.intro}</p>
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100/60">
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

      {filtered.length === 0 && (
        <div className="text-center py-24">
          <div className="w-20 h-20 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Search size={28} className="text-gray-300" />
          </div>
          <p className="text-gray-400 text-[15px] mb-2">조건에 맞는 전문가가 없습니다</p>
          <button
            onClick={() => { setSelectedCategory('전체'); setSelectedRegion('전체'); setSearch(''); }}
            className="text-primary-500 text-[14px] font-semibold hover:text-primary-600"
            style={{ transition: 'color 0.3s' }}
          >
            필터 초기화
          </button>
        </div>
      )}
    </div>
  );
}
