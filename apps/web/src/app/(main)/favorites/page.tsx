'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Heart, Star, MapPin, Building2, Trash2 } from 'lucide-react';
import { motion, LayoutGroup } from 'framer-motion';
import { useAuthStore } from '@/lib/store/auth.store';
import { favoriteApi } from '@/lib/api/favorite.api';
import { discoveryApi } from '@/lib/api/discovery.api';

type Tab = 'service' | 'portfolio' | 'recent';
type ProCategory = '전체' | '사회자' | '쇼호스트' | '축가';
type BizCategory = '전체' | '웨딩홀' | '스튜디오' | '드레스' | '헤메샵';

const MOCK_FAVORITE_PROS: any[] = [];

const MOCK_FAVORITE_BIZ: any[] = [];

// Complete pro data for favorites + recent lookup
const ALL_PROS: any[] = [];

export default function FavoritesPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('service');
  const [proCategory, setProCategory] = useState<ProCategory>('전체');
  const [bizCategory, setBizCategory] = useState<BizCategory>('전체');
  const [favPros, setFavPros] = useState<typeof MOCK_FAVORITE_PROS>([]);
  const [favBiz, setFavBiz] = useState<typeof MOCK_FAVORITE_BIZ>([]);
  const authUser = useAuthStore((s) => s.user);

  // Login check + load favorites
  useEffect(() => {
    const loggedIn = authUser !== null || localStorage.getItem('freetiful-logged-in') === 'true';
    setIsLoggedIn(loggedIn);
    if (!loggedIn) return;

    // API 에서 찜 목록 가져오기 (로그인 시) — 응답: { items: [{ id, createdAt, proProfile }], total }
    if (authUser) {
      favoriteApi.getList({ limit: 50 })
        .then((res: any) => {
          const items = res?.items || res?.data || [];
          if (items.length > 0) {
            setFavPros(items.map((f: any) => ({
              id: f.proProfile?.id || f.targetId || f.proProfileId,
              name: f.proProfile?.user?.name || '',
              category: '사회자',
              badge: '',
              intro: f.proProfile?.shortIntro || '',
              rating: Number(f.proProfile?.avgRating || 0),
              reviews: f.proProfile?.reviewCount || 0,
              image: f.proProfile?.images?.[0]?.imageUrl || '',
              price: f.proProfile?.services?.[0]?.basePrice || 450000,
              subName: `사회자 ${f.proProfile?.user?.name || ''}`,
            })));
          }
        })
        .catch(() => {
          // API 실패 시 localStorage 폴백
          loadFavoritesFromLocal();
        });
    } else {
      // 비로그인 → localStorage 만
      loadFavoritesFromLocal();
    }

    function loadFavoritesFromLocal() {
      try {
        const stored: string[] = JSON.parse(localStorage.getItem('freetiful-favorites') || '[]');
        if (stored.length > 0) {
          const mapped = stored
            .map((id) => ALL_PROS.find((p) => p.id === id))
            .filter(Boolean) as typeof ALL_PROS;
          setFavPros(mapped);
        }
      } catch {}
    }

    // Load demo biz data if available
    const hasDemoData = localStorage.getItem('freetiful-has-demo-data') === 'true';
    if (hasDemoData) {
      setFavBiz(MOCK_FAVORITE_BIZ);
    }
  }, [authUser]);
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

  // 최근 본 전문가: localStorage 의 viewed-pros ID 들을 API 데이터와 매칭
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('viewed-pros') || '[]') as { id: string; time: number }[];
      if (stored.length === 0) return;
      // 먼저 MOCK 에서 찾고, 없으면 API 에서 찾기
      const mockMatched = stored
        .map((v) => ALL_PROS.find((p) => p.id === v.id) || null)
        .filter(Boolean) as typeof ALL_PROS;
      if (mockMatched.length > 0) setRecentPros(mockMatched);
      // API 프로 데이터에서도 매칭 (UUID 기반 실데이터)
      discoveryApi.getProList({ limit: 100, sort: 'newest' })
        .then((res) => {
          if (!res?.data?.length) return;
          const viewedIds = new Set(stored.map((v) => v.id));
          const apiMatched = res.data
            .filter((p: any) => viewedIds.has(p.id))
            .map((p: any) => ({
              id: p.id,
              name: p.name,
              category: '사회자',
              badge: '',
              intro: p.shortIntro || '',
              rating: Number(p.avgRating || 0),
              reviews: p.reviewCount || 0,
              image: p.images?.[0] || p.profileImageUrl || '',
              price: p.basePrice || 450000,
              subName: `사회자 ${p.name}`,
            }));
          if (apiMatched.length > 0) {
            // MOCK + API 합치고 중복 제거
            setRecentPros((prev) => {
              const map = new Map(prev.map((p) => [p.id, p]));
              apiMatched.forEach((p: any) => map.set(p.id, p));
              return Array.from(map.values());
            });
          }
        })
        .catch(() => {});
    } catch {}
  }, []);

  const removePro = (id: string) => {
    setFavPros((prev) => prev.filter((p) => p.id !== id));
    try {
      const stored: string[] = JSON.parse(localStorage.getItem('freetiful-favorites') || '[]');
      localStorage.setItem('freetiful-favorites', JSON.stringify(stored.filter((s) => s !== id)));
    } catch {}
  };
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
    <div className="bg-white min-h-screen lg:max-w-4xl lg:mx-auto lg:px-8" style={{ letterSpacing: '-0.02em' }}>
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
            <LayoutGroup id="fav-tabs">
              {tabs.map((t) => {
                const isActive = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`relative shrink-0 font-semibold whitespace-nowrap pb-2 transition-colors ${isActive ? 'text-gray-900' : 'text-gray-400'}`}
                    style={{ fontSize: scrolled ? 12 : 14, padding: scrolled ? '4px 10px 8px' : '4px 8px 8px' }}
                  >
                    {t.label}
                    {t.badge && <span className="ml-0.5 text-[9px] font-bold text-red-500">{t.badge}</span>}
                    {isActive && (
                      <motion.span
                        layoutId="fav-tab-line"
                        className="absolute bottom-0 left-1 right-1 h-[2px] bg-gray-900 rounded-full"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </LayoutGroup>
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
            <LayoutGroup id="fav-pro-cats">
              <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
                {proCategories.map((c) => {
                  const active = proCategory === c.key;
                  return (
                    <button key={c.key} onClick={() => setProCategory(c.key)} className={`relative isolate px-3.5 py-1.5 text-[13px] font-medium shrink-0 rounded-full ${active ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                      {active && <motion.span layoutId="fav-pro-cat-bg" className="absolute inset-0 bg-[#2B313D] rounded-full" style={{ zIndex: -1 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
                      <span className="relative">{c.key} ({c.count})</span>
                    </button>
                  );
                })}
              </div>
            </LayoutGroup>
          )}
          {activeTab === 'portfolio' && (
            <LayoutGroup id="fav-biz-cats">
              <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
                {bizCategories.filter((c) => c.count > 0 || c.key === '전체').map((c) => {
                  const active = bizCategory === c.key;
                  return (
                    <button key={c.key} onClick={() => setBizCategory(c.key)} className={`relative isolate px-3.5 py-1.5 text-[13px] font-medium shrink-0 rounded-full ${active ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                      {active && <motion.span layoutId="fav-biz-cat-bg" className="absolute inset-0 bg-[#2B313D] rounded-full" style={{ zIndex: -1 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
                      <span className="relative">{c.key} ({c.count})</span>
                    </button>
                  );
                })}
              </div>
            </LayoutGroup>
          )}
        </div>
      </div>

      {/* 전문가 탭 */}
      {activeTab === 'service' && (
        <div className="bg-white">
          {filteredPros.length > 0 ? (
            <div className="divide-y divide-gray-100 lg:divide-y-0 lg:grid lg:grid-cols-3 lg:gap-4 lg:p-4">
              {filteredPros.map((pro) => (
                <ProCard key={pro.id} pro={pro} onRemove={removePro} />
              ))}
            </div>
          ) : (
            <>
              <EmptyState message={isLoggedIn ? "찜한 전문가가 없습니다" : "로그인 후 찜한 전문가를 확인하세요"} linkText={isLoggedIn ? "전문가 찾아보기" : "로그인하기"} linkHref={isLoggedIn ? "/pros" : "/"} />
              {isLoggedIn && favPros.length === 0 && (
                <div className="flex justify-center -mt-16 pb-8">
                  <button
                    onClick={() => { localStorage.setItem('freetiful-has-demo-data', 'true'); setFavPros(MOCK_FAVORITE_PROS); setFavBiz(MOCK_FAVORITE_BIZ); }}
                    className="text-[13px] text-blue-500 font-medium px-4 py-2 rounded-full border border-blue-200 hover:bg-blue-50 transition-colors"
                  >
                    데모 데이터 로드
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 웨딩파트너 탭 */}
      {activeTab === 'portfolio' && (
        <div className="bg-white">
          {filteredBiz.length > 0 ? (
            <div className="divide-y divide-gray-100 lg:divide-y-0 lg:grid lg:grid-cols-3 lg:gap-4 lg:p-4">
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
            <div className="divide-y divide-gray-100 lg:divide-y-0 lg:grid lg:grid-cols-4 lg:gap-4 lg:p-4">
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
            <img src={pro.image || '/images/default-profile.svg'} alt={pro.name} loading="lazy" onError={(e) => { e.currentTarget.src = '/images/default-profile.svg'; }} className="w-full h-full object-cover" />
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
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mb-3">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#FBBF24"/>
      </svg>
      <p className="text-[14px]">{message}</p>
      <Link href={linkHref} className="text-[13px] text-blue-500 font-medium mt-2">{linkText}</Link>
    </div>
  );
}
