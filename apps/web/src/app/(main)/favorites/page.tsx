'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, Star, MapPin, Building2 } from 'lucide-react';

type Tab = 'pro' | 'business';

const MOCK_FAVORITE_PROS = [
  { id: '1', name: '김민준', category: 'MC', region: '서울/경기', rating: 4.9, reviews: 142, image: 'https://i.pravatar.cc/300?img=1', intro: '10년 경력 웨딩/기업행사 전문 MC', price: 500000 },
  { id: '3', name: '박준혁', category: '가수', region: '전국', rating: 5.0, reviews: 67, image: 'https://i.pravatar.cc/300?img=3', intro: '발라드 전문 웨딩 축가 가수', price: 400000 },
];

const MOCK_FAVORITE_BIZ = [
  { id: '1', name: '시에나호텔 웨딩', category: '웨딩홀', image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&h=250&fit=crop', address: '서울 강남구' },
  { id: '2', name: '루미에스튜디오', category: '스튜디오', image: 'https://images.unsplash.com/photo-1554080353-a576cf803bda?w=400&h=250&fit=crop', address: '서울 마포구' },
];

export default function FavoritesPage() {
  const [tab, setTab] = useState<Tab>('pro');
  const [favPros, setFavPros] = useState(MOCK_FAVORITE_PROS);
  const [favBiz, setFavBiz] = useState(MOCK_FAVORITE_BIZ);

  const removePro = (id: string) => setFavPros((prev) => prev.filter((p) => p.id !== id));
  const removeBiz = (id: string) => setFavBiz((prev) => prev.filter((b) => b.id !== id));

  return (
    <div className="bg-surface-50 min-h-screen">
      {/* Header */}
      <div className="bg-white px-5 pt-12 lg:pt-6 pb-0 sticky top-0 lg:top-[72px] z-10 border-b border-gray-100/50">
        <h1 className="text-[22px] font-bold tracking-tight mb-5">찜 목록</h1>
        <div className="flex">
          {[
            { key: 'pro' as Tab, label: '전문가', count: favPros.length },
            { key: 'business' as Tab, label: '비즈니스', count: favBiz.length },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-3.5 text-[14px] font-semibold text-center border-b-2 ${
                tab === key ? 'text-gray-900 border-gray-900' : 'text-gray-400 border-transparent hover:text-gray-600'
              }`}
              style={{ transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              {label} <span className={tab === key ? 'text-gray-400' : 'text-gray-300'}>{count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 lg:px-0 lg:max-w-7xl lg:mx-auto lg:px-8 py-6">
        {tab === 'pro' ? (
          favPros.length === 0 ? (
            <EmptyState icon="💝" message="찜한 전문가가 없습니다" linkText="전문가 찾아보기" linkHref="/pros" />
          ) : (
            <>
              {/* Mobile */}
              <div className="space-y-3 lg:hidden">
                {favPros.map((pro, i) => (
                  <div
                    key={pro.id}
                    className="card-interactive flex gap-4 p-4 relative opacity-0 animate-fade-in"
                    style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'forwards' }}
                  >
                    <Link href={`/pros/${pro.id}`} className="flex gap-4 flex-1 min-w-0">
                      <img src={pro.image} alt={pro.name} className="w-[72px] h-[72px] rounded-2xl object-cover shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="tag-primary text-[10px]">{pro.category}</span>
                          <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
                            <MapPin size={10} /> {pro.region}
                          </span>
                        </div>
                        <p className="text-[15px] font-bold text-gray-900">{pro.name}</p>
                        <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-1">{pro.intro}</p>
                        <div className="flex items-center justify-between mt-1.5">
                          <div className="flex items-center gap-0.5">
                            <Star size={12} className="fill-yellow-400 text-yellow-400" />
                            <span className="text-[12px] font-bold">{pro.rating}</span>
                            <span className="text-[10px] text-gray-400">({pro.reviews})</span>
                          </div>
                          <span className="text-[13px] font-black text-primary-500">{(pro.price / 10000).toFixed(0)}만~</span>
                        </div>
                      </div>
                    </Link>
                    <button
                      onClick={() => removePro(pro.id)}
                      className="shrink-0 p-2 self-start rounded-full hover:bg-red-50 active:scale-[0.9]"
                      style={{ transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
                    >
                      <Heart size={20} className="fill-red-500 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
              {/* Desktop */}
              <div className="hidden lg:grid lg:grid-cols-3 gap-6">
                {favPros.map((pro, i) => (
                  <div
                    key={pro.id}
                    className="card-interactive relative opacity-0 animate-fade-in"
                    style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'forwards' }}
                  >
                    <Link href={`/pros/${pro.id}`}>
                      <img src={pro.image} alt={pro.name} className="w-full aspect-[4/3] object-cover" />
                      <div className="p-5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="tag-primary">{pro.category}</span>
                          <span className="text-[12px] text-gray-400 flex items-center gap-0.5"><MapPin size={10} /> {pro.region}</span>
                        </div>
                        <p className="text-[17px] font-bold text-gray-900">{pro.name}</p>
                        <p className="text-[13px] text-gray-500 mt-0.5 line-clamp-1">{pro.intro}</p>
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100/60">
                          <div className="flex items-center gap-0.5">
                            <Star size={13} className="fill-yellow-400 text-yellow-400" />
                            <span className="text-[13px] font-bold">{pro.rating}</span>
                            <span className="text-[11px] text-gray-400">({pro.reviews})</span>
                          </div>
                          <span className="text-[15px] font-black text-primary-500">{(pro.price / 10000).toFixed(0)}만원~</span>
                        </div>
                      </div>
                    </Link>
                    <button
                      onClick={() => removePro(pro.id)}
                      className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm p-2.5 rounded-full hover:bg-white active:scale-[0.9] shadow-sm"
                      style={{ transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
                    >
                      <Heart size={18} className="fill-red-500 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )
        ) : (
          favBiz.length === 0 ? (
            <EmptyState icon="🏢" message="찜한 비즈니스가 없습니다" linkText="비즈니스 찾아보기" linkHref="/businesses" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
              {favBiz.map((biz, i) => (
                <div
                  key={biz.id}
                  className="card-interactive relative opacity-0 animate-fade-in"
                  style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'forwards' }}
                >
                  <Link href={`/businesses/${biz.id}`} className="block">
                    <img src={biz.image} alt={biz.name} className="w-full h-44 lg:h-52 object-cover" />
                    <div className="p-4">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Building2 size={12} className="text-gray-400" />
                        <span className="text-[12px] text-gray-400 font-medium">{biz.category}</span>
                      </div>
                      <p className="text-[16px] font-bold text-gray-900">{biz.name}</p>
                      <p className="text-[13px] text-gray-500 mt-1 flex items-center gap-1">
                        <MapPin size={12} /> {biz.address}
                      </p>
                    </div>
                  </Link>
                  <button
                    onClick={() => removeBiz(biz.id)}
                    className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm p-2.5 rounded-full hover:bg-white active:scale-[0.9] shadow-sm"
                    style={{ transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
                  >
                    <Heart size={18} className="fill-red-500 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, message, linkText, linkHref }: { icon: string; message: string; linkText: string; linkHref: string }) {
  return (
    <div className="text-center py-28">
      <div className="w-20 h-20 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-5">
        <span className="text-4xl">{icon}</span>
      </div>
      <p className="text-gray-400 text-[15px] mb-3">{message}</p>
      <Link
        href={linkHref}
        className="text-primary-500 text-[14px] font-semibold hover:text-primary-600"
        style={{ transition: 'color 0.3s' }}
      >
        {linkText}
      </Link>
    </div>
  );
}
