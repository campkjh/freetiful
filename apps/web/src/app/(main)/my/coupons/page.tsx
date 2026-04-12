'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Clock } from 'lucide-react';

const MOCK_COUPONS = [
  { id: '1', code: 'WELCOME10', type: 'percentage', value: 10, minOrder: 300000, maxDiscount: 50000, validUntil: '2026-04-30', isUsed: false, title: '신규 회원 10% 할인' },
  { id: '2', code: 'SPRING2026', type: 'fixed', value: 30000, minOrder: 500000, maxDiscount: 30000, validUntil: '2026-05-31', isUsed: false, title: '봄맞이 3만원 할인' },
  { id: '3', code: 'FIRST50', type: 'percentage', value: 5, minOrder: 300000, maxDiscount: 20000, validUntil: '2026-02-28', isUsed: true, title: '첫 결제 5% 할인' },
];

export default function CouponsPage() {
  const router = useRouter();
  const [hasDemoData, setHasDemoData] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); setHasDemoData(localStorage.getItem('freetiful-has-demo-data') === 'true'); }, []);
  const [couponCode, setCouponCode] = useState('');

  const coupons = useMemo(() => hasDemoData ? MOCK_COUPONS : [], [hasDemoData]);
  const available = coupons.filter((c) => !c.isUsed);
  const used = coupons.filter((c) => c.isUsed);

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
          {/* Divider */}
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
    </div>
  );
}
