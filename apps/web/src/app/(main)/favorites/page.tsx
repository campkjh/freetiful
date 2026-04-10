'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Heart, Star, MapPin, Building2, Trash2 } from 'lucide-react';

type Tab = 'service' | 'portfolio' | 'recent';
type ProCategory = '전체' | '사회자' | '쇼호스트' | '축가';
type BizCategory = '전체' | '웨딩홀' | '스튜디오' | '드레스' | '헤메샵';

const MOCK_FAVORITE_PROS = [
  { id: '1', name: '박인애', category: '사회자', badge: '', intro: '탄탄한 발성의 아나운서가 귀사에 품격을 더해 드립니다', rating: 4.9, reviews: 79, image: 'https://i.pravatar.cc/300?img=1', price: 450000, subName: '사회자 박인애' },
  { id: '2', name: '김서현', category: '사회자', badge: '', intro: '감동과 웃음을 동시에 선사하는 웨딩 전문 MC', rating: 4.9, reviews: 142, image: 'https://i.pravatar.cc/300?img=5', price: 550000, subName: '사회자 김서현' },
  { id: '3', name: '채안빈', category: '축가', badge: '', intro: '웨딩 축가 전문, 감동의 무대를 선사합니다', rating: 5.0, reviews: 67, image: 'https://i.pravatar.cc/300?img=9', price: 400000, subName: '축가 채안빈' },
];

const MOCK_FAVORITE_BIZ = [
  { id: '1', name: '시에나호텔 웨딩', category: '웨딩홀', image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&h=400&fit=crop', address: '서울 강남구', rating: 4.8, reviews: 234, price: 3500000 },
  { id: '2', name: '루미에스튜디오', category: '스튜디오', image: 'https://images.unsplash.com/photo-1554080353-a576cf803bda?w=400&h=400&fit=crop', address: '서울 마포구', rating: 4.9, reviews: 189, price: 1200000 },
  { id: '3', name: '라벨드레스', category: '드레스', image: 'https://images.unsplash.com/photo-1594552072238-b8a33785b261?w=400&h=400&fit=crop', address: '서울 청담동', rating: 5.0, reviews: 67, price: 800000 },
];

// 최근 본 전문가용 전체 목록
const ALL_PROS = [
  { id: '1', name: '박인애', category: 'MC', badge: 'premium', intro: '탄탄한 발성의 아나운서가 귀사에 품격을 더해 드립니다', rating: 4.9, reviews: 79, image: 'https://i.pravatar.cc/300?img=1', price: 450000, subName: '아나운서 박인애' },
  { id: '2', name: '김서현', category: 'MC', badge: 'premium', intro: '감동과 웃음을 동시에 선사하는 웨딩 전문 MC', rating: 4.9, reviews: 142, image: 'https://i.pravatar.cc/300?img=5', price: 550000, subName: '사회자 김서현' },
  { id: '3', name: '이하늘', category: 'MC', badge: '', intro: '섬세한 진행력으로 당신의 하루를 완성합니다', rating: 4.8, reviews: 98, image: 'https://i.pravatar.cc/300?img=9', price: 450000, subName: '사회자 이하늘' },
  { id: '4', name: '정다은', category: 'MC', badge: 'premium', intro: '격식과 유쾌함의 완벽한 밸런스', rating: 5.0, reviews: 67, image: 'https://i.pravatar.cc/300?img=10', price: 480000, subName: '사회자 정다은' },
  { id: '5', name: '최수아', category: 'MC', badge: '', intro: '따뜻한 목소리로 행사를 빛내드립니다', rating: 4.7, reviews: 55, image: 'https://i.pravatar.cc/300?img=12', price: 420000, subName: '사회자 최수아' },
  { id: '7', name: '윤지민', category: 'MC', badge: 'premium', intro: '프리미엄 웨딩 전문 사회자', rating: 4.9, reviews: 120, image: 'https://i.pravatar.cc/300?img=2', price: 600000, subName: '사회자 윤지민' },
  { id: '10', name: '오서진', category: 'MC', badge: 'premium', intro: '200회 이상 진행한 베테랑 사회자', rating: 5.0, reviews: 201, image: 'https://i.pravatar.cc/300?img=6', price: 700000, subName: '사회자 오서진' },
];

export default function FavoritesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('service');
  const [proCategory, setProCategory] = useState<ProCategory>('전체');
  const [bizCategory, setBizCategory] = useState<BizCategory>('전체');
  const [favPros, setFavPros] = useState(MOCK_FAVORITE_PROS);
  const [favBiz, setFavBiz] = useState(MOCK_FAVORITE_BIZ);
  const [recentPros, setRecentPros] = useState<typeof ALL_PROS>([]);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('viewed-pros') || '[]') as { id: string; time: number }[];
      const recent = stored
        .map((v) => ALL_PROS.find((p) => p.id === v.id) || null)
        .filter(Boolean) as typeof ALL_PROS;
      setRecentPros(recent);
    } catch {}
  }, []);

  const removePro = (id: string) => setFavPros((prev) => prev.filter((p) => p.id !== id));
  const removeBiz = (id: string) => setFavBiz((prev) => prev.filter((b) => b.id !== id));

  const filteredPros = proCategory === '전체'
    ? favPros
    : favPros.filter((p) => p.category === proCategory);

  const filteredBiz = bizCategory === '전체'
    ? favBiz
    : favBiz.filter((b) => b.category === bizCategory);

  const tabs: { key: Tab; label: string; badge?: string }[] = [
    { key: 'service', label: '전문가' },
    { key: 'portfolio', label: '웨딩파트너' },
    { key: 'recent', label: '최근 본', badge: recentPros.length > 0 ? 'NEW' : undefined },
  ];

  const proCategories: { key: ProCategory; count: number }[] = [
    { key: '전체', count: favPros.length },
    { key: '사회자', count: favPros.filter((p) => p.category === '사회자').length },
    { key: '쇼호스트', count: favPros.filter((p) => p.category === '쇼호스트').length },
    { key: '축가', count: favPros.filter((p) => p.category === '축가').length },
  ];

  const bizCategories: { key: BizCategory; count: number }[] = [
    { key: '전체', count: favBiz.length },
    { key: '웨딩홀', count: favBiz.filter((b) => b.category === '웨딩홀').length },
    { key: '스튜디오', count: favBiz.filter((b) => b.category === '스튜디오').length },
    { key: '드레스', count: favBiz.filter((b) => b.category === '드레스').length },
    { key: '헤메샵', count: favBiz.filter((b) => b.category === '헤메샵').length },
  ];

  return (
    <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
      {/* Header - sticky */}
      <div ref={headerRef} className="sticky top-0 z-20 bg-white border-b border-gray-100" style={{ willChange: 'contents' }}>
        <div className="h-[52px] flex items-center px-4 gap-3">
          <h1 className="text-[18px] font-bold text-gray-900 shrink-0">찜목록</h1>

          {/* 탭: 스크롤하면 칩 형태로 변신하며 헤더 우측에 붙음 */}
          <div
            className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide"
            style={{
              marginLeft: scrolled ? 0 : 'auto',
              transition: 'margin-left 0.3s ease',
            }}
          >
            {tabs.map((t) => {
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className="shrink-0 font-semibold whitespace-nowrap"
                  style={{
                    fontSize: scrolled ? 12 : 14,
                    padding: scrolled ? '4px 10px' : '4px 8px',
                    backgroundColor: scrolled && isActive ? '#2B313D' : 'transparent',
                    color: scrolled && isActive ? '#fff' : isActive ? '#111827' : '#9CA3AF',
                    borderRadius: scrolled ? 16 : 0,
                    border: scrolled && !isActive ? '1px solid #E5E7EB' : '1px solid transparent',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {t.label}
                  {t.badge && <span className="ml-0.5 text-[9px] font-bold text-red-500">{t.badge}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* 카테고리 칩 - 스크롤 시 접힘 */}
        <div
          className="overflow-hidden"
          style={{
            maxHeight: scrolled ? 0 : 48,
            opacity: scrolled ? 0 : 1,
            transition: 'max-height 0.3s ease, opacity 0.2s ease',
          }}
        >
          {activeTab === 'service' && (
            <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
              {proCategories.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setProCategory(c.key)}
                  className={`px-3.5 py-1.5 text-[13px] font-medium shrink-0 ${
                    proCategory === c.key ? 'bg-[#2B313D] text-white' : 'bg-white text-gray-600 border border-gray-200'
                  }`}
                  style={{ borderRadius: 20 }}
                >
                  {c.key} ({c.count})
                </button>
              ))}
            </div>
          )}
          {activeTab === 'portfolio' && (
            <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
              {bizCategories.filter((c) => c.count > 0 || c.key === '전체').map((c) => (
                <button
                  key={c.key}
                  onClick={() => setBizCategory(c.key)}
                  className={`px-3.5 py-1.5 text-[13px] font-medium shrink-0 ${
                    bizCategory === c.key ? 'bg-[#2B313D] text-white' : 'bg-white text-gray-600 border border-gray-200'
                  }`}
                  style={{ borderRadius: 20 }}
                >
                  {c.key} ({c.count})
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 전문가 탭 */}
      {activeTab === 'service' && (
        <div className="bg-white">
          {filteredPros.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {filteredPros.map((pro) => (
                <ProCard key={pro.id} pro={pro} onRemove={removePro} />
              ))}
            </div>
          ) : (
            <EmptyState message="찜한 전문가가 없습니다" linkText="전문가 찾아보기" linkHref="/pros" />
          )}
        </div>
      )}

      {/* 웨딩파트너 탭 */}
      {activeTab === 'portfolio' && (
        <div className="bg-white">
          {filteredBiz.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {filteredBiz.map((biz) => (
                <div key={biz.id} className="px-4 py-3">
                  <div className="flex gap-3">
                    <Link href={`/businesses/${biz.id}`} className="shrink-0">
                      <div className="w-[140px] h-[140px] rounded-lg overflow-hidden bg-gray-100">
                        <img src={biz.image} alt={biz.name} className="w-full h-full object-cover" />
                      </div>
                    </Link>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <Link href={`/businesses/${biz.id}`} className="flex-1">
                        <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded mb-1.5">
                          {biz.category}
                        </span>
                        <p className="text-[14px] font-medium text-gray-900 leading-snug">{biz.name}</p>
                        <p className="text-[12px] text-gray-400 mt-1 flex items-center gap-0.5">
                          <MapPin size={11} /> {biz.address}
                        </p>
                        <div className="flex items-center gap-0.5 mt-1.5">
                          <Star size={13} className="fill-yellow-400 text-yellow-400" />
                          <span className="text-[13px] font-bold text-gray-900">{biz.rating}</span>
                          <span className="text-[13px] text-gray-400">({biz.reviews})</span>
                        </div>
                        <p className="text-[16px] font-bold text-gray-900 mt-1">
                          {biz.price.toLocaleString()}원~
                        </p>
                      </Link>
                      <div className="flex justify-end">
                        <button onClick={() => removeBiz(biz.id)} className="p-1 active:scale-90 transition-transform">
                          <Heart size={22} className="fill-red-400 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="찜한 웨딩파트너가 없습니다" linkText="웨딩파트너 찾아보기" linkHref="/businesses" />
          )}
        </div>
      )}

      {/* 최근 본 탭 */}
      {activeTab === 'recent' && (
        <div className="bg-white">
          {recentPros.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {recentPros.map((pro) => (
                <SwipeToDelete key={pro.id} onDelete={() => {
                  setRecentPros((prev) => prev.filter((p) => p.id !== pro.id));
                  try {
                    const stored = JSON.parse(localStorage.getItem('viewed-pros') || '[]');
                    localStorage.setItem('viewed-pros', JSON.stringify(stored.filter((v: { id: string }) => v.id !== pro.id)));
                  } catch {}
                }}>
                  <ProCard pro={pro} />
                </SwipeToDelete>
              ))}
            </div>
          ) : (
            <EmptyState message="최근 본 전문가가 없습니다" linkText="전문가 찾아보기" linkHref="/pros" />
          )}
        </div>
      )}
    </div>
  );
}

function ProCard({ pro, onRemove }: { pro: { id: string; name: string; category: string; badge: string; intro: string; rating: number; reviews: number; image: string; price: number; subName: string }; onRemove?: (id: string) => void }) {
  return (
    <div className="px-4 py-3">
      <div className="flex gap-3">
        <Link href={`/pros/${pro.id}`} className="shrink-0">
          <div className="w-[105px] h-[140px] rounded-lg overflow-hidden bg-gray-100">
            <img src={pro.image} alt={pro.name} className="w-full h-full object-cover" />
          </div>
        </Link>
        <div className="flex-1 min-w-0 flex flex-col">
          <Link href={`/pros/${pro.id}`} className="flex-1">
            <p className="text-[16px] font-bold text-gray-900">{pro.category} {pro.name}</p>
            <div className="flex items-center gap-0.5 mt-1">
              <Star size={13} className="fill-yellow-400 text-yellow-400" />
              <span className="text-[13px] font-bold text-gray-900">{pro.rating}</span>
              <span className="text-[13px] text-gray-400">({pro.reviews})</span>
            </div>
            <p className="text-[15px] font-bold text-gray-900 mt-1">{pro.price.toLocaleString()}원~</p>
            <p className="text-[13px] text-gray-500 mt-2 line-clamp-2 leading-snug">&ldquo;{pro.intro}&rdquo;</p>
          </Link>
          {onRemove && (
            <div className="flex justify-end mt-auto">
              <button onClick={() => onRemove(pro.id)} className="p-1 active:scale-90 transition-transform">
                <Heart size={22} className="fill-red-400 text-red-400" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SwipeToDelete({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const startX = useRef(0);
  const [offsetX, setOffsetX] = useState(0);
  const [swiped, setSwiped] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; };
  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = startX.current - e.touches[0].clientX;
    if (diff > 0) setOffsetX(Math.min(diff, 80));
  };
  const handleTouchEnd = () => {
    if (offsetX > 50) { setSwiped(true); setOffsetX(80); }
    else { setSwiped(false); setOffsetX(0); }
  };

  return (
    <div className="relative overflow-hidden">
      <div
        className="absolute right-0 top-0 bottom-0 w-[80px] flex items-center justify-center bg-red-500"
        onClick={onDelete}
      >
        <Trash2 size={20} className="text-white" />
      </div>
      <div
        className="relative bg-white transition-transform"
        style={{ transform: `translateX(-${offsetX}px)`, transition: offsetX === 0 || swiped ? 'transform 0.2s ease' : 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

function EmptyState({ message, linkText, linkHref }: { message: string; linkText: string; linkHref: string }) {
  return (
    <div className="flex flex-col items-center py-24 text-gray-400">
      <Heart size={36} className="mb-3 text-gray-200" />
      <p className="text-[14px]">{message}</p>
      <Link href={linkHref} className="text-[13px] text-blue-500 font-medium mt-2">{linkText}</Link>
    </div>
  );
}
