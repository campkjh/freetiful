'use client';

import { useState, useEffect, useMemo } from 'react';
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

const MOCK_PURCHASES: PurchaseItem[] = [
  { id: '1', proName: '김민준 MC', service: '웨딩 MC 패키지', amount: 500000, eventDate: '2026-04-05', status: 'upcoming', image: 'https://i.pravatar.cc/150?img=1', hasReview: false },
  { id: '2', proName: '박준혁 가수', service: '웨딩 축가 3곡', amount: 300000, eventDate: '2026-03-15', status: 'completed', image: 'https://i.pravatar.cc/150?img=3', hasReview: true },
  { id: '3', proName: '이서연 MC', service: '돌잔치 MC', amount: 400000, eventDate: '2026-02-28', status: 'completed', image: 'https://i.pravatar.cc/150?img=5', hasReview: false },
];

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
    const hasDemo = localStorage.getItem('freetiful-has-demo-data') === 'true';
    setHasDemoData(hasDemo);

    // 백그라운드 fetch
    if (authUser) {
      apiClient.get('/api/v1/payment', { params: { limit: 50 } })
        .then((res) => {
          const data = res.data?.data || [];
          if (data.length > 0) {
            const mapped: PurchaseItem[] = data.map((p: any) => ({
              id: p.id,
              proName: p.quotation?.proProfile?.user?.name || '',
              service: p.description || '결제',
              amount: p.amount,
              eventDate: p.quotation?.eventDate ? new Date(p.quotation.eventDate).toISOString().slice(0, 10) : new Date(p.createdAt).toISOString().slice(0, 10),
              status: p.status === 'completed' ? 'completed' : p.status === 'refunded' ? 'refunded' : 'upcoming',
              image: p.quotation?.proProfile?.user?.profileImageUrl || '',
              hasReview: false,
            }));
            setPurchases(mapped);
            setCache(mapped);
          } else if (hasDemo) {
            setPurchases(MOCK_PURCHASES);
            setCache(MOCK_PURCHASES);
          } else {
            setPurchases([]);
            setCache([]);
          }
        })
        .catch(() => {
          if (hasDemo) {
            setPurchases(MOCK_PURCHASES);
            setCache(MOCK_PURCHASES);
          } else {
            setPurchases([]);
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      if (hasDemo) {
        setPurchases(MOCK_PURCHASES);
        setCache(MOCK_PURCHASES);
      } else {
        setPurchases([]);
      }
      setIsLoading(false);
    }
  }, [authUser]);

  const filtered = (purchases || []).filter((p) => filter === 'all' || p.status === filter);

  return (
    <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white">
        <div className="flex items-center h-[52px] px-4">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[18px] font-bold ml-2">구매 내역</h1>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-3">
          {(['all', 'paid', 'upcoming', 'completed', 'refunded'] as Status[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`shrink-0 text-[12px] px-3 py-1.5 transition-colors ${
                filter === s
                  ? 'text-white font-bold'
                  : 'bg-gray-100 text-gray-600'
              }`}
              style={{
                borderRadius: 8,
                ...(filter === s ? { backgroundColor: '#2B313D' } : {}),
              }}
            >
              {s === 'all' ? '전체' : STATUS_MAP[s].label}
            </button>
          ))}
        </div>
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
