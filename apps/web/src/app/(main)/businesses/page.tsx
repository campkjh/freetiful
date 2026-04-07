'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, MapPin, Heart, Play } from 'lucide-react';

const CATEGORIES = ['전체', '웨딩홀', '스튜디오', '드레스', '메이크업/헤어', '스냅/영상', '피부과', '공연'];

const MOCK_BUSINESSES = [
  { id: '1', name: '시에나호텔 웨딩', category: '웨딩홀', address: '서울 강남구 역삼동', image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&h=250&fit=crop', videoUrl: null, views: 3420, isFavorited: false },
  { id: '2', name: '루미에스튜디오', category: '스튜디오', address: '서울 마포구 합정동', image: 'https://images.unsplash.com/photo-1554080353-a576cf803bda?w=400&h=250&fit=crop', videoUrl: 'video.mp4', views: 1890, isFavorited: true },
  { id: '3', name: '라비앙로제 드레스', category: '드레스', address: '서울 강남구 청담동', image: 'https://images.unsplash.com/photo-1594463750939-ebb28c3f7f75?w=400&h=250&fit=crop', videoUrl: null, views: 2150, isFavorited: false },
  { id: '4', name: '글로우업 메이크업', category: '메이크업/헤어', address: '서울 성동구 성수동', image: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=400&h=250&fit=crop', videoUrl: null, views: 1230, isFavorited: false },
];

export default function BusinessListPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');

  const filtered = MOCK_BUSINESSES.filter((b) => {
    if (selectedCategory !== '전체' && b.category !== selectedCategory) return false;
    if (search && !b.name.includes(search)) return false;
    return true;
  });

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white px-4 pt-12 pb-3 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.back()} className="p-1"><ArrowLeft size={22} /></button>
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="비즈니스 검색"
              className="w-full bg-gray-100 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                selectedCategory === cat
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3">
        <p className="text-xs text-gray-500">{filtered.length}개의 비즈니스</p>
      </div>

      <div className="px-4 space-y-4 pb-24">
        {filtered.map((biz) => (
          <Link key={biz.id} href={`/businesses/${biz.id}`} className="card block overflow-hidden hover:shadow-md transition-shadow">
            <div className="relative">
              <img src={biz.image} alt={biz.name} className="w-full h-44 object-cover" />
              {biz.videoUrl && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                    <Play size={20} className="text-gray-900 fill-gray-900 ml-0.5" />
                  </div>
                </div>
              )}
              <button
                onClick={(e) => e.preventDefault()}
                className="absolute top-3 right-3 bg-white/80 backdrop-blur-sm p-1.5 rounded-full"
              >
                <Heart size={16} className={biz.isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-600'} />
              </button>
            </div>
            <div className="p-3.5">
              <span className="text-[10px] text-primary-500 font-bold">{biz.category}</span>
              <p className="text-sm font-bold text-gray-900 mt-0.5">{biz.name}</p>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <MapPin size={10} /> {biz.address}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">조회 {biz.views.toLocaleString()}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
