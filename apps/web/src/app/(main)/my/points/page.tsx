'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, Info } from 'lucide-react';

const MOCK_TRANSACTIONS = [
  { id: '1', type: 'earn', reason: '신규 가입 포인트', amount: 5000, date: '2. 9.', expiry: '2026.05.10까지 사용 가능', label: '적립' },
];

export default function PointsPage() {
  const router = useRouter();
  const totalPoints = 5000;

  return (
    <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white">
        <div className="flex items-center justify-between h-[52px] px-4">
          <div className="flex items-center">
            <button onClick={() => router.back()} className="p-1 -ml-1 active:scale-90 transition-transform">
              <ChevronLeft size={24} className="text-gray-900" />
            </button>
            <h1 className="text-[18px] font-bold text-gray-900 ml-1">내 포인트</h1>
          </div>
          <button className="p-1">
            <Info size={20} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Total Points */}
      <div className="px-4 pt-2 pb-5">
        <p className="text-[28px] font-bold text-gray-900">{totalPoints.toLocaleString()}P</p>
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-200" />

      {/* 사용 내역 */}
      <div className="px-4 pt-5">
        <p className="text-[16px] font-bold text-gray-900 mb-4">사용 내역</p>

        <p className="text-[14px] font-bold text-gray-500 mb-4">2026년</p>

        {MOCK_TRANSACTIONS.map((tx) => (
          <div key={tx.id} className="pb-4 border-b border-gray-100">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[15px] font-bold text-gray-900">{tx.reason}</p>
                <p className="text-[13px] text-gray-400 mt-1">
                  {tx.date}<span className="mx-1.5 text-gray-300">|</span>{tx.expiry}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[16px] font-bold" style={{ color: '#E8590C' }}>
                  + {tx.amount.toLocaleString()} P
                </p>
                <p className="text-[13px] text-gray-400 mt-0.5">{tx.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
