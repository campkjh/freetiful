'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Heart, Star, MapPin, Building2, Trash2 } from 'lucide-react';
import { motion, LayoutGroup } from 'framer-motion';
import { useAuthStore } from '@/lib/store/auth.store';
import { favoriteApi, getCachedFavoritesList } from '@/lib/api/favorite.api';
import { discoveryApi, type ProListItem } from '@/lib/api/discovery.api';

type Tab = 'service' | 'portfolio' | 'recent';
type ProCategory = '전체' | '사회자' | '쇼호스트' | '축가';
type BizCategory = '전체' | '웨딩홀' | '드레스' | '피부과' | '스튜디오' | '헤어' | '메이크업' | '스냅';

type FavProItem = { id: string; name: string; category: string; badge: string; intro: string; rating: number; reviews: number; image: string; price: number; subName: string };
type FavBizItem = { id: string; name: string; category: string; image: string; address: string; rating: number; reviews: number; price: number };

export default function FavoritesPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('service');
  const [proCategory, setProCategory] = useState<ProCategory>('전체');
  const [bizCategory, setBizCategory] = useState<BizCategory>('전체');
  // 세션 캐시에서 initial state 생성 (재방문 시 skeleton 안 보임)
  const cached = typeof window !== 'undefined' ? getCachedFavoritesList() : null;
  const cachedPros: FavProItem[] = cached?.items?.length > 0
    ? cached.items.map((f: any) => {
        const cat = f.proProfile?.categories?.[0]?.category?.name || '사회자';
        const name = f.proProfile?.user?.name || '';
        return {
          id: f.proProfile?.id || f.proProfileId,
          name,
          category: cat,
          badge: '',
          intro: f.proProfile?.shortIntro || '',
          rating: Number(f.proProfile?.avgRating || 0),
          reviews: f.proProfile?.reviewCount || 0,
          image: f.proProfile?.images?.[0]?.imageUrl || f.proProfile?.user?.profileImageUrl || '',
          price: f.proProfile?.services?.[0]?.basePrice || 0,
          subName: `${cat} ${name}`,
        };
      })
    : [];
  const [favPros, setFavPros] = useState<FavProItem[]>(cachedPros);
  const [favBiz, setFavBiz] = useState<FavBizItem[]>([]);
  const [favLoading, setFavLoading] = useState(cachedPros.length === 0);
  const authUser = useAuthStore((s) => s.user);

  // Login check + load favorites
  useEffect(() => {
    const loggedIn = authUser !== null || localStorage.getItem('freetiful-logged-in') === 'true';
    setIsLoggedIn(loggedIn);
    if (!loggedIn || !authUser) { setFavLoading(false); return; }

    // 캐시된 데이터가 없으면 skeleton 유지, 있으면 이미 initial state로 표시 중
    favoriteApi.getList({ limit: 50 })
      .then((res: any) => {
        if (res?.items) {
          setFavPros(res.items.map((f: any) => {
            const cat = f.proProfile?.categories?.[0]?.category?.name || '사회자';
            const name = f.proProfile?.user?.name || '';
            return {
              id: f.proProfile?.id || f.proProfileId,
              name,
              category: cat,
              badge: '',
              intro: f.proProfile?.shortIntro || '',
              rating: Number(f.proProfile?.avgRating || 0),
              reviews: f.proProfile?.reviewCount || 0,
              image: f.proProfile?.images?.[0]?.imageUrl || f.proProfile?.user?.profileImageUrl || '',
              price: f.proProfile?.services?.[0]?.basePrice || 0,
              subName: `${cat} ${name}`,
            };
          }));
        }
      })
      .catch(() => {})
      .finally(() => setFavLoading(false));
  }, [authUser]);
  const [recentPros, setRecentPros] = useState<FavProItem[]>([]);
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
    let stored: { id: string; time: number }[] = [];
    try {
      stored = JSON.parse(localStorage.getItem('viewed-pros') || '[]');
    } catch {}
    if (stored.length === 0) return;

    discoveryApi.getProList({ limit: 100 })
      .then((res) => {
        const byId = new Map<string, ProListItem>((res.data || []).map((p) => [p.id, p]));
        const recent = stored
          .map((v) => {
            const p = byId.get(v.id);
            if (!p) return null;
            const cat = p.categories?.[0] || '사회자';
            return {
              id: p.id,
              name: p.name,
              category: cat,
              badge: '',
              intro: p.shortIntro || '',
              rating: p.avgRating || 0,
              reviews: p.reviewCount || 0,
              image: p.profileImageUrl || p.images?.[0] || '',
              price: p.basePrice || 0,
              subName: `${cat} ${p.name}`,
            } as FavProItem;
          })
          .filter((p): p is FavProItem => p !== null);
        setRecentPros(recent);
      })
      .catch(() => {});
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
    { key: '드레스', count: favBiz.filter((b) => b.category === '드레스').length },
    { key: '피부과', count: favBiz.filter((b) => b.category === '피부과').length },
    { key: '스튜디오', count: favBiz.filter((b) => b.category === '스튜디오').length },
    { key: '헤어', count: favBiz.filter((b) => b.category === '헤어').length },
    { key: '메이크업', count: favBiz.filter((b) => b.category === '메이크업').length },
    { key: '스냅', count: favBiz.filter((b) => b.category === '스냅').length },
  ];

  return (
    <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
      {/* Header - sticky */}
      <div ref={headerRef} className="sticky top-0 z-20 bg-white border-b border-gray-100" style={{ willChange: 'contents' }}>
        <div className="h-[52px] flex items-center px-4 gap-3">
          <h1 className="text-[18px] font-bold text-gray-900 shrink-0">찜목록</h1>

          {/* 탭: 스크롤하면 칩 형태로 변신하며 헤더 우측에 붙음 */}
          <LayoutGroup id="favorites-top-tabs">
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
                    className={`relative isolate shrink-0 font-semibold whitespace-nowrap active:scale-95 ${isActive ? 'text-white' : 'text-gray-500'}`}
                    style={{
                      fontSize: scrolled ? 12 : 13,
                      padding: scrolled ? '4px 10px' : '6px 14px',
                      borderRadius: 999,
                      transition: 'color 0.25s ease, font-size 0.3s ease, padding 0.3s ease, transform 0.15s ease',
                    }}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="fav-top-pill"
                        className="absolute inset-0 bg-gray-900 rounded-full"
                        style={{ zIndex: -1 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      />
                    )}
                    <span className="relative">
                      {t.label}
                      {t.badge && <span className="ml-0.5 text-[9px] font-bold text-red-400">{t.badge}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </LayoutGroup>
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
            <LayoutGroup id="fav-pro-subtabs">
              <div className="px-4 pt-1 flex gap-4 overflow-x-auto scrollbar-hide">
                {proCategories.map((c) => {
                  const active = proCategory === c.key;
                  return (
                    <button
                      key={c.key}
                      onClick={() => setProCategory(c.key)}
                      className={`relative shrink-0 py-2.5 text-[13px] whitespace-nowrap ${active ? 'font-bold text-gray-900' : 'font-medium text-gray-400'}`}
                      style={{ transition: 'color 0.25s ease' }}
                    >
                      <span>{c.key} <span className={active ? 'text-[#3180F7]' : 'text-gray-300'}>{c.count}</span></span>
                      {active && (
                        <motion.span
                          layoutId="fav-pro-underline"
                          className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#3180F7] rounded-full"
                          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </LayoutGroup>
          )}
          {activeTab === 'portfolio' && (
            <LayoutGroup id="fav-biz-subtabs">
              <div className="px-4 pt-1 flex gap-4 overflow-x-auto scrollbar-hide">
                {bizCategories.filter((c) => c.count > 0 || c.key === '전체').map((c) => {
                  const active = bizCategory === c.key;
                  return (
                    <button
                      key={c.key}
                      onClick={() => setBizCategory(c.key)}
                      className={`relative shrink-0 py-2.5 text-[13px] whitespace-nowrap ${active ? 'font-bold text-gray-900' : 'font-medium text-gray-400'}`}
                      style={{ transition: 'color 0.25s ease' }}
                    >
                      <span>{c.key} <span className={active ? 'text-[#3180F7]' : 'text-gray-300'}>{c.count}</span></span>
                      {active && (
                        <motion.span
                          layoutId="fav-biz-underline"
                          className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#3180F7] rounded-full"
                          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        />
                      )}
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
          {favLoading && filteredPros.length === 0 ? (
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 4 }).map((_, i) => (
                <ProCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredPros.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {filteredPros.map((pro) => (
                <ProCard key={pro.id} pro={pro} onRemove={removePro} />
              ))}
            </div>
          ) : (
            <EmptyState message={isLoggedIn ? "찜한 전문가가 없습니다" : "로그인 후 찜한 전문가를 확인하세요"} linkText={isLoggedIn ? "전문가 찾아보기" : "로그인하기"} linkHref={isLoggedIn ? "/pros" : "/"} />
          )}
        </div>
      )}

      {/* 웨딩파트너 탭 */}
      {activeTab === 'portfolio' && (
        <div className="bg-white">
          {favLoading && filteredBiz.length === 0 ? (
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 3 }).map((_, i) => (
                <BizCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredBiz.length > 0 ? (
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
            <p className="text-[15px] font-bold text-gray-900 mt-1">{pro.price ? `${pro.price.toLocaleString()}원~` : '가격 협의'}</p>
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

function ProCardSkeleton() {
  return (
    <div className="px-4 py-3">
      <div className="flex gap-3">
        <div className="w-[105px] h-[140px] rounded-lg bg-gray-200 animate-pulse shrink-0" />
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="h-4 w-28 bg-gray-200 rounded-full animate-pulse" />
          <div className="flex items-center gap-0.5 mt-2">
            <div className="h-3 w-20 bg-gray-100 rounded-full animate-pulse" />
          </div>
          <div className="h-4 w-24 bg-gray-200 rounded-full animate-pulse mt-2" />
          <div className="h-3 w-full bg-gray-100 rounded-full animate-pulse mt-3" />
          <div className="h-3 w-3/4 bg-gray-100 rounded-full animate-pulse mt-1.5" />
        </div>
      </div>
    </div>
  );
}

function BizCardSkeleton() {
  return (
    <div className="px-4 py-3">
      <div className="flex gap-3">
        <div className="w-[140px] h-[140px] rounded-lg bg-gray-200 animate-pulse shrink-0" />
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="h-4 w-10 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-32 bg-gray-200 rounded-full animate-pulse mt-2" />
          <div className="h-3 w-24 bg-gray-100 rounded-full animate-pulse mt-1.5" />
          <div className="h-3 w-20 bg-gray-100 rounded-full animate-pulse mt-2" />
          <div className="h-4 w-28 bg-gray-200 rounded-full animate-pulse mt-2" />
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
