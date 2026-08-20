'use client';

import { useState, useEffect, useMemo } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Calendar } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { apiClient } from '@/lib/api/client';

type Status = 'all' | 'paid' | 'upcoming' | 'completed' | 'refunded';

interface PurchaseItem {
  id: string;
  proName: string;
  service: string;
  amount: number;
  eventDate: string;
  status: string;
  image: string;
  hasReview: boolean;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  paid: { label: '결제완료', color: 'bg-blue-50 text-blue-600' },
  upcoming: { label: '행사 예정', color: 'bg-green-50 text-green-600' },
  completed: { label: '행사 완료', color: 'bg-gray-100 text-gray-600' },
  refunded: { label: '환불됨', color: 'bg-red-50 text-red-500' },
};

const CACHE_KEY = 'freetiful-purchase-cache';

function getCache(): PurchaseItem[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function setCache(data: PurchaseItem[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
}

function Skeleton() {
  return (
    <div className="px-4 py-4 space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="border border-gray-100 p-4" style={{ borderRadius: 12 }}>
          <div className="flex gap-3">
            <div className="w-14 h-14 rounded-xl bg-gray-100 shrink-0 animate-pulse" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                <div className="h-5 w-14 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="h-3 w-40 bg-gray-100 rounded animate-pulse mb-3" />
              <div className="flex items-center justify-between">
                <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PurchaseHistoryPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<Status>('all');
  const [hasDemoData, setHasDemoData] = useState(false);

  // 캐시에서 즉시 표시
  const cached = useMemo(() => getCache(), []);
  const [purchases, setPurchases] = useState<PurchaseItem[] | null>(cached);
  const [isLoading, setIsLoading] = useState(cached === null);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (authUser) {
      apiClient.get('/api/v1/payment', { params: { limit: 50 } })
        .then((res) => {
          // 구매내역 = 실제 결제된 건만. pending(결제창까지만 가고 미완료/취소)·failed 는 제외해야
          // '결제완료' 오표시를 막는다. (결제대기는 마이페이지 '결제/환불내역'에서 확인)
          const data = (res.data?.data || []).filter((p: any) =>
            ['completed', 'escrowed', 'settled', 'refunded'].includes(p.status),
          );
          const mapped: PurchaseItem[] = data.map((p: any) => {
            const q = Array.isArray(p.quotations) ? p.quotations[0] : p.quotation;
            const eventDate = q?.eventDate ? new Date(q.eventDate) : new Date(p.createdAt);
            const now = new Date();
            let status: PurchaseItem['status'];
            if (p.status === 'refunded') status = 'refunded';
            else if (p.status === 'completed') status = eventDate < now ? 'completed' : 'upcoming';
            else status = 'paid'; // escrowed/settled = 결제완료 (pending/failed 는 위에서 제외됨)
            return {
              id: p.id,
              proName: q?.proProfile?.user?.name || '',
              service: p.description || q?.title || '결제',
              amount: Number(p.amount ?? 0),
              eventDate: eventDate.toISOString().slice(0, 10),
              status,
              image: q?.proProfile?.user?.profileImageUrl || q?.proProfile?.images?.[0]?.imageUrl || '',
              hasReview: false,
            };
          });
          setPurchases(mapped);
          setCache(mapped);
        })
        .catch(() => { setPurchases([]); })
        .finally(() => setIsLoading(false));
    } else {
      setPurchases([]);
      setIsLoading(false);
    }
  }, [authUser]);

  // 결제 후 진입 시 WKWebView 히스토리에 외부 결제 URL/소비된 페이지가 남아, 뒤로 스와이프하면
  // 그 죽은 페이지로 가서 "페이지를 찾을 수 없습니다"(404)가 났다. 구매내역은 /my 의 하위 페이지이므로
  // 뒤로가기(스와이프)를 가로채 안전한 /my 로 보낸다.
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const onPop = () => { router.replace('/my'); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [router]);

  const filtered = (purchases || []).filter((p) => filter === 'all' || p.status === filter);

  return (
    <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white" data-native-back-header>
        <div className="flex items-center h-[52px] px-4">
          <button onClick={() => router.replace('/my')} className="p-1 -ml-1">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[18px] font-bold ml-2">구매 내역</h1>
        </div>
        {/* 탭 — PC 헤더 네비와 같은 세그먼트(회색 트랙 + 흰 알약이 미끄러진다) */}
        <LayoutGroup id="purchase-tabs">
        <div className="mx-4 mb-3 flex gap-1 overflow-x-auto rounded-2xl bg-[#F2F3F5] p-1 scrollbar-hide">
          {(['all', 'paid', 'upcoming', 'completed', 'refunded'] as Status[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`relative shrink-0 flex-1 rounded-[13px] px-3 py-2 text-[13px] transition-colors ${
                filter === s ? 'font-bold text-[#2B313D]' : 'font-semibold text-[#A4ABBA] hover:text-[#51535C]'
              }`}
            >
              {filter === s && (
                <motion.span
                  layoutId="purchase-tab-pill"
                  className="absolute inset-0 rounded-[13px] bg-white shadow-sm"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">{s === 'all' ? '전체' : STATUS_MAP[s].label}</span>
            </button>
          ))}
        </div>
        </LayoutGroup>
      </div>

      {/* Divider */}
      <div className="h-1.5 bg-gray-50" />

      {isLoading && !cached ? (
        <Skeleton />
      ) : (
        <div className="px-4 py-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-400 text-sm">구매 내역이 없습니다</p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="border border-gray-100 p-4"
                style={{ borderRadius: 12 }}
              >
                <div className="flex gap-3">
                  <img src={item.image} alt={item.proName} className="w-14 h-14 rounded-xl object-cover shrink-0 bg-gray-100" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold text-gray-900">{item.proName}</p>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 ${STATUS_MAP[item.status]?.color || 'bg-gray-100 text-gray-500'}`}
                        style={{ borderRadius: 6 }}
                      >
                        {STATUS_MAP[item.status]?.label || item.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{item.service}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar size={10} /> {item.eventDate}
                      </span>
                      <span className="text-sm font-bold text-gray-900">{item.amount.toLocaleString()}원</span>
                    </div>
                  </div>
                </div>
                {item.status === 'completed' && !item.hasReview && (
                  <button
                    className="w-full mt-3 py-2.5 text-sm font-bold text-white"
                    style={{ backgroundColor: '#2B313D', borderRadius: 12 }}
                  >
                    리뷰 작성하기
                  </button>
                )}
                {item.status === 'upcoming' && (
                  <button
                    className="w-full mt-3 py-2.5 text-sm font-bold text-gray-500 bg-gray-100"
                    style={{ borderRadius: 12 }}
                  >
                    일정 변경 요청
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
