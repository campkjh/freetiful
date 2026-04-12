'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Info, Gift, Star, Users, CalendarCheck, FileText, CreditCard, ShieldCheck } from 'lucide-react';
import { getPoints, getPointHistory, getPointsAsync, getPointHistoryAsync, type PointType, type PointTransaction } from '@/lib/points';
import { useAuthStore } from '@/lib/store/auth.store';

const TYPE_CONFIG: Record<PointType, { icon: typeof Gift; color: string; label: string }> = {
  signup_bonus: { icon: Gift, color: '#10B981', label: '가입 보너스' },
  review_write: { icon: Star, color: '#F59E0B', label: '리뷰 적립' },
  invite_friend: { icon: Users, color: '#8B5CF6', label: '친구 초대' },
  daily_check: { icon: CalendarCheck, color: '#3B82F6', label: '출석 체크' },
  quote_request: { icon: FileText, color: '#06B6D4', label: '견적 요청' },
  payment_use: { icon: CreditCard, color: '#EF4444', label: '포인트 사용' },
  admin_grant: { icon: ShieldCheck, color: '#6366F1', label: '관리자 지급' },
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}. ${d.getDate()}.`;
}

function formatYear(ts: number): string {
  return `${new Date(ts).getFullYear()}년`;
}

export default function PointsPage() {
  const router = useRouter();
  const [totalPoints, setTotalPoints] = useState(0);
  const [history, setHistory] = useState<PointTransaction[]>([]);

  const authUser = useAuthStore((s) => s.user);

  useEffect(() => {
    window.scrollTo(0, 0);
    // Immediate from localStorage
    setTotalPoints(getPoints());
    setHistory(getPointHistory());
    // Then fetch from API
    getPointsAsync().then(setTotalPoints).catch(() => {});
    getPointHistoryAsync().then(setHistory).catch(() => {});
  }, [authUser]);

  // Group transactions by year
  const grouped = history.reduce<Record<string, PointTransaction[]>>((acc, tx) => {
    const year = formatYear(tx.createdAt);
    if (!acc[year]) acc[year] = [];
    acc[year].push(tx);
    return acc;
  }, {});

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

      {/* Transaction History */}
      <div className="px-4 pt-5">
        <p className="text-[16px] font-bold text-gray-900 mb-4">사용 내역</p>

        {history.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <Gift size={40} className="mb-3 text-gray-300" />
            <p className="text-[14px]">포인트 내역이 없습니다</p>
            <p className="text-[13px] mt-1">활동을 통해 포인트를 적립해보세요!</p>
          </div>
        ) : (
          Object.entries(grouped).map(([year, txs]) => (
            <div key={year}>
              <p className="text-[14px] font-bold text-gray-500 mb-4">{year}</p>
              {txs.map((tx) => {
                const config = TYPE_CONFIG[tx.type];
                const IconComp = config.icon;
                const isPositive = tx.amount > 0;
                return (
                  <div key={tx.id} className="pb-4 mb-4 border-b border-gray-100">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                          style={{ backgroundColor: `${config.color}15` }}
                        >
                          <IconComp size={16} style={{ color: config.color }} />
                        </div>
                        <div>
                          <p className="text-[15px] font-bold text-gray-900">{tx.description}</p>
                          <p className="text-[13px] text-gray-400 mt-1">
                            {formatDate(tx.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className="text-[16px] font-bold"
                          style={{ color: isPositive ? '#E8590C' : '#6B7280' }}
                        >
                          {isPositive ? '+' : ''} {tx.amount.toLocaleString()} P
                        </p>
                        <p className="text-[13px] text-gray-400 mt-0.5">
                          {isPositive ? '적립' : '사용'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
