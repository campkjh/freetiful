'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Clock } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { apiClient } from '@/lib/api/client';

interface Coupon {
  id: string;
  code: string;
  type: string;
  value: number;
  minOrder: number;
  maxDiscount: number;
  validUntil: string;
  isUsed: boolean;
  title: string;
}

const CACHE_KEY = 'freetiful-coupon-cache';

function getCache(): Coupon[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function setCache(data: Coupon[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
}

function Skeleton() {
  return (
    <div className="px-4 py-4 space-y-3">
      {[0, 1].map((i) => (
        <div key={i} className="border border-gray-100 overflow-hidden" style={{ borderRadius: 12 }}>
          <div className="flex">
            <div className="w-24 h-[88px] bg-gray-100 animate-pulse shrink-0" />
            <div className="flex-1 p-3 space-y-2">
              <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
              <div className="h-3 w-40 bg-gray-100 rounded animate-pulse" />
              <div className="h-3 w-28 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CouponsPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const [couponCode, setCouponCode] = useState('');

  const cached = useMemo(() => getCache(), []);
  const [coupons, setCoupons] = useState<Coupon[] | null>(cached);
  const [isLoading, setIsLoading] = useState(cached === null);

  useEffect(() => {
    window.scrollTo(0, 0);
    const hasDemo = localStorage.getItem('freetiful-has-demo-data') === 'true';

    if (authUser) {
      apiClient.get('/api/v1/users/coupons')
        .then((res) => {
          const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
          const mapped: Coupon[] = data.map((c: any) => ({
            id: c.id,
            code: c.code || '',
            type: c.type || 'fixed',
            value: c.value ?? 0,
            minOrder: c.minOrderAmount ?? 0,
            maxDiscount: c.maxDiscountAmount ?? 0,
            validUntil: c.validUntil ? new Date(c.validUntil).toISOString().slice(0, 10) : '',
            isUsed: !!c.isUsed,
            title: c.title || '쿠폰',
          }));
          setCoupons(mapped);
          setCache(mapped);
        })
        .catch(() => { setCoupons([]); })
        .finally(() => setIsLoading(false));
    } else {
      setCoupons([]);
      setIsLoading(false);
    }
    // hasDemo 플래그 사용 안 함 — 실제 DB 기반
    void hasDemo;
  }, [authUser]);

  const available = (coupons || []).filter((c) => !c.isUsed);
  const used = (coupons || []).filter((c) => c.isUsed);

  return (
    <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white">
        <div className="flex items-center h-[52px] px-4">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[18px] font-bold ml-2">쿠폰</h1>
        </div>
      </div>

      {/* Redeem */}
      <div className="px-4 py-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="쿠폰 코드 입력"
            className="flex-1 h-[44px] px-3 text-[14px] border border-gray-100 bg-white outline-none"
            style={{ borderRadius: 12 }}
          />
          <button
            disabled={!couponCode.trim()}
            className="text-sm font-bold px-4 text-white disabled:opacity-50"
            style={{ backgroundColor: '#2B313D', borderRadius: 12 }}
          >
            등록
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="h-1.5 bg-gray-50" />

      {isLoading && !cached ? (
        <Skeleton />
      ) : (
        <>
          {/* Available */}
          <div className="px-4 py-4">
            <p className="text-[12px] font-bold text-gray-400 mb-3">사용 가능 ({available.length})</p>
            {available.length === 0 && used.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400 text-sm">보유 쿠폰이 없습니다</p>
              </div>
            )}
            <div className="space-y-3">
              {available.map((coupon) => (
                <div
                  key={coupon.id}
                  className="border border-gray-100 overflow-hidden"
                  style={{ borderRadius: 12 }}
                >
                  <div className="flex">
                    <div
                      className="w-24 flex flex-col items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: '#2B313D' }}
                    >
                      <p className="text-2xl font-bold">
                        {coupon.type === 'percentage' ? `${coupon.value}%` : `${(coupon.value / 10000).toFixed(0)}만`}
                      </p>
                      <p className="text-[11px] opacity-80">할인</p>
                    </div>
                    <div className="flex-1 p-3">
                      <p className="text-sm font-bold text-gray-900">{coupon.title}</p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {coupon.minOrder.toLocaleString()}원 이상 주문 시
                      </p>
                      <div className="flex items-center gap-1 mt-2">
                        <Clock size={10} className="text-gray-400" />
                        <p className="text-[11px] text-gray-400">{coupon.validUntil}까지</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Used */}
          {used.length > 0 && (
            <>
              <div className="h-1.5 bg-gray-50" />
              <div className="px-4 py-4">
                <p className="text-[12px] font-bold text-gray-400 mb-3">사용 완료 ({used.length})</p>
                <div className="space-y-3 opacity-50">
                  {used.map((coupon) => (
                    <div
                      key={coupon.id}
                      className="border border-gray-100 overflow-hidden"
                      style={{ borderRadius: 12 }}
                    >
                      <div className="flex">
                        <div className="bg-gray-400 w-24 flex flex-col items-center justify-center text-white shrink-0">
                          <p className="text-2xl font-bold">
                            {coupon.type === 'percentage' ? `${coupon.value}%` : `${(coupon.value / 10000).toFixed(0)}만`}
                          </p>
                          <p className="text-[11px]">사용완료</p>
                        </div>
                        <div className="flex-1 p-3">
                          <p className="text-sm font-bold text-gray-900">{coupon.title}</p>
                          <p className="text-[11px] text-gray-500 mt-1">{coupon.validUntil}까지</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
