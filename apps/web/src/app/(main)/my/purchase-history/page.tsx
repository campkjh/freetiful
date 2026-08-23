'use client';

import { useState, useEffect, useMemo } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { apiClient } from '@/lib/api/client';
import { CalendarIcon } from '@/components/icons/mono';
import { EmptyDocumentIcon } from '@/components/icons/color';
import { MY_CARD, MyDetailHeader } from '../_components/detail-ui';

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
  paid: { label: '결제완료', color: 'bg-[#EAF2FF] text-[#3182F6]' },
  upcoming: { label: '행사 예정', color: 'bg-[#E9F8EF] text-[#12B76A]' },
  completed: { label: '행사 완료', color: 'bg-[#F2F3F5] text-[#51535C]' },
  refunded: { label: '환불됨', color: 'bg-[#FFF0F0] text-[#E5484D]' },
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
    <div className="space-y-3 px-4 pt-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[116px] animate-pulse rounded-[24px] bg-[#F7F8FA]" />
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
    <div className="mx-auto min-h-screen max-w-lg bg-white pb-10" style={{ letterSpacing: '-0.02em' }}>
      <div className="sticky top-0 z-20 bg-white" data-native-back-header>
        <MyDetailHeader title="구매 내역" onBack={() => router.replace('/my')} />
        {/* 탭 — PC 헤더 네비와 같은 세그먼트(회색 트랙 + 흰 알약이 미끄러진다) */}
        <LayoutGroup id="purchase-tabs">
        <div className="scrollbar-hide mx-4 mb-2 flex gap-1 overflow-x-auto rounded-2xl bg-[#F2F3F5] p-1">
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

      {isLoading && !cached ? (
        <Skeleton />
      ) : (
        <div
          key={filter}
          className="space-y-3 px-4 pt-2"
          style={{ animation: 'proPageExpand 0.32s cubic-bezier(0.16, 1, 0.3, 1) both' }}
        >
          {filtered.length === 0 ? (
            <div className={`${MY_CARD} flex flex-col items-center justify-center px-6 py-16 text-center`}>
              <EmptyDocumentIcon size={64} className="mb-3" />
              <p className="text-[15px] font-bold text-[#2B313D]">구매 내역이 없습니다</p>
              <p className="mt-1.5 text-[13px] text-[#A4ABBA]">사회자를 섭외하면 이곳에서 확인할 수 있어요.</p>
            </div>
          ) : (
            filtered.map((item) => (
              <div key={item.id} className={`${MY_CARD} p-5`}>
                <div className="flex gap-3">
                  <img
                    src={item.image}
                    alt={item.proName}
                    className="h-14 w-14 shrink-0 rounded-[18px] bg-[#F2F3F5] object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="truncate text-[15px] font-bold text-[#2B313D]">{item.proName}</p>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-[5px] text-[11.5px] font-bold ${
                          STATUS_MAP[item.status]?.color || 'bg-[#F2F3F5] text-[#51535C]'
                        }`}
                      >
                        {STATUS_MAP[item.status]?.label || item.status}
                      </span>
                    </div>
                    <p className="truncate text-[13px] font-medium text-[#8B95A1]">{item.service}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[12px] text-[#A4ABBA]">
                        <CalendarIcon size={13} className="text-[#C8CEDA]" /> {item.eventDate}
                      </span>
                      <span className="text-[15px] font-bold tabular-nums text-[#2B313D]">
                        {item.amount.toLocaleString()}원
                      </span>
                    </div>
                  </div>
                </div>
                {item.status === 'completed' && !item.hasReview && (
                  <button className="mt-4 h-11 w-full rounded-[14px] bg-[#3180F7] text-[14px] font-bold text-white transition-colors active:scale-[0.99] lg:hover:bg-[#2470E6]">
                    리뷰 작성하기
                  </button>
                )}
                {item.status === 'upcoming' && (
                  <button className="mt-4 h-11 w-full rounded-[14px] bg-[#F2F3F5] text-[14px] font-bold text-[#51535C] transition-colors active:scale-[0.99] lg:hover:bg-[#E9EBEF]">
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
