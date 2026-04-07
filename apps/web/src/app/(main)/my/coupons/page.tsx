'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Ticket, Clock } from 'lucide-react';

const MOCK_COUPONS = [
  { id: '1', code: 'WELCOME10', type: 'percentage', value: 10, minOrder: 300000, maxDiscount: 50000, validUntil: '2026-04-30', isUsed: false, title: '신규 회원 10% 할인' },
  { id: '2', code: 'SPRING2026', type: 'fixed', value: 30000, minOrder: 500000, maxDiscount: 30000, validUntil: '2026-05-31', isUsed: false, title: '봄맞이 3만원 할인' },
  { id: '3', code: 'FIRST50', type: 'percentage', value: 5, minOrder: 300000, maxDiscount: 20000, validUntil: '2026-02-28', isUsed: true, title: '첫 결제 5% 할인' },
];

export default function CouponsPage() {
  const router = useRouter();
  const [couponCode, setCouponCode] = useState('');

  const available = MOCK_COUPONS.filter((c) => !c.isUsed);
  const used = MOCK_COUPONS.filter((c) => c.isUsed);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white px-4 pt-12 pb-4 sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1"><ArrowLeft size={22} /></button>
          <h1 className="text-lg font-bold">쿠폰</h1>
        </div>
      </div>

      {/* Redeem */}
      <div className="bg-white px-4 py-4 border-b border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="쿠폰 코드 입력"
            className="input flex-1"
          />
          <button disabled={!couponCode.trim()} className="bg-primary-500 text-white text-sm font-bold px-4 rounded-xl disabled:opacity-50">
            등록
          </button>
        </div>
      </div>

      {/* Available */}
      <div className="px-4 py-4">
        <p className="text-xs font-bold text-gray-400 mb-3">사용 가능 ({available.length})</p>
        <div className="space-y-3">
          {available.map((coupon) => (
            <div key={coupon.id} className="card overflow-hidden">
              <div className="flex">
                <div className="bg-primary-500 w-24 flex flex-col items-center justify-center text-white shrink-0">
                  <p className="text-2xl font-black">
                    {coupon.type === 'percentage' ? `${coupon.value}%` : `${(coupon.value / 10000).toFixed(0)}만`}
                  </p>
                  <p className="text-[10px] opacity-80">할인</p>
                </div>
                <div className="flex-1 p-3">
                  <p className="text-sm font-bold text-gray-900">{coupon.title}</p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {coupon.minOrder.toLocaleString()}원 이상 주문 시
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    <Clock size={10} className="text-gray-400" />
                    <p className="text-[10px] text-gray-400">{coupon.validUntil}까지</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Used */}
      {used.length > 0 && (
        <div className="px-4 py-4">
          <p className="text-xs font-bold text-gray-400 mb-3">사용 완료 ({used.length})</p>
          <div className="space-y-3 opacity-50">
            {used.map((coupon) => (
              <div key={coupon.id} className="card overflow-hidden">
                <div className="flex">
                  <div className="bg-gray-400 w-24 flex flex-col items-center justify-center text-white shrink-0">
                    <p className="text-2xl font-black">
                      {coupon.type === 'percentage' ? `${coupon.value}%` : `${(coupon.value / 10000).toFixed(0)}만`}
                    </p>
                    <p className="text-[10px]">사용완료</p>
                  </div>
                  <div className="flex-1 p-3">
                    <p className="text-sm font-bold text-gray-900">{coupon.title}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{coupon.validUntil}까지</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
