'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, TrendingUp, TrendingDown, Gift, Zap, Star } from 'lucide-react';
import { getPudding, getPuddingHistory, initWelcomePudding, type PuddingTransaction as StoredPuddingTransaction } from '@/lib/pudding';

interface PuddingTransaction {
  id: string;
  type: 'earn' | 'use';
  description: string;
  amount: number;
  createdAt: number;
  category: string;
}

const MOCK_TRANSACTIONS: PuddingTransaction[] = [
  { id: 'p1', type: 'use', description: '랭킹 부스트 사용', amount: -50, createdAt: Date.now() - 86400000 * 1, category: 'boost' },
  { id: 'p2', type: 'earn', description: '프로모션 코드 적립', amount: 100, createdAt: Date.now() - 86400000 * 3, category: 'promo' },
  { id: 'p3', type: 'use', description: '프로필 상단 노출', amount: -30, createdAt: Date.now() - 86400000 * 5, category: 'boost' },
  { id: 'p4', type: 'earn', description: '월간 활동 보너스', amount: 50, createdAt: Date.now() - 86400000 * 7, category: 'bonus' },
  { id: 'p5', type: 'earn', description: '리뷰 응답 보너스', amount: 20, createdAt: Date.now() - 86400000 * 10, category: 'review' },
  { id: 'p6', type: 'use', description: '랭킹 부스트 사용', amount: -50, createdAt: Date.now() - 86400000 * 14, category: 'boost' },
  { id: 'p7', type: 'earn', description: '푸딩 충전', amount: 200, createdAt: Date.now() - 86400000 * 20, category: 'charge' },
  { id: 'p8', type: 'earn', description: '가입 환영 푸딩', amount: 100, createdAt: Date.now() - 86400000 * 30, category: 'welcome' },
];

const CATEGORY_ICONS: Record<string, { icon: typeof Gift; color: string }> = {
  boost: { icon: Zap, color: '#F59E0B' },
  promo: { icon: Gift, color: '#8B5CF6' },
  bonus: { icon: Star, color: '#3B82F6' },
  review: { icon: Star, color: '#10B981' },
  charge: { icon: TrendingUp, color: '#06B6D4' },
  welcome: { icon: Gift, color: '#EC4899' },
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}. ${d.getDate()}.`;
}

export default function PuddingHistoryPage() {
  const router = useRouter();
  const [totalPudding, setTotalPudding] = useState(0);
  const [transactions, setTransactions] = useState<PuddingTransaction[]>(MOCK_TRANSACTIONS);

  useEffect(() => {
    window.scrollTo(0, 0);
    // Initialize welcome pudding if needed
    initWelcomePudding();
    // Read from localStorage
    const storedPudding = getPudding();
    const storedHistory = getPuddingHistory();
    if (storedPudding > 0) {
      setTotalPudding(storedPudding);
    } else {
      // Fallback to mock total if no stored data
      const mockTotal = MOCK_TRANSACTIONS.reduce((sum, tx) => sum + tx.amount, 0);
      setTotalPudding(mockTotal);
    }
    if (storedHistory.length > 0) {
      // Merge stored history with mock for display
      const convertedHistory: PuddingTransaction[] = storedHistory.map((tx) => ({
        id: tx.id,
        type: tx.amount > 0 ? 'earn' as const : 'use' as const,
        description: tx.description,
        amount: tx.amount,
        createdAt: tx.createdAt,
        category: tx.category,
      }));
      setTransactions([...convertedHistory, ...MOCK_TRANSACTIONS]);
    }
  }, []);

  return (
    <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white">
        <div className="flex items-center justify-between h-[52px] px-4">
          <div className="flex items-center">
            <button onClick={() => router.back()} className="p-1 -ml-1 active:scale-90 transition-transform">
              <ChevronLeft size={24} className="text-gray-900" />
            </button>
            <h1 className="text-[18px] font-bold text-gray-900 ml-1">푸딩 내역</h1>
          </div>
        </div>
      </div>

      {/* Total Pudding */}
      <div className="px-4 pt-2 pb-5">
        <p className="text-[28px] font-bold text-gray-900">{totalPudding.toLocaleString()}개</p>
        <p className="text-[13px] text-gray-400 mt-1">보유 푸딩</p>
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-200" />

      {/* Transaction History */}
      <div className="px-4 pt-5">
        <p className="text-[16px] font-bold text-gray-900 mb-4">사용/적립 내역</p>

        {transactions.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <Gift size={40} className="mb-3 text-gray-300" />
            <p className="text-[14px]">푸딩 내역이 없습니다</p>
          </div>
        ) : (
          transactions.map((tx) => {
            const catConfig = CATEGORY_ICONS[tx.category] || CATEGORY_ICONS.bonus;
            const IconComp = catConfig.icon;
            const isPositive = tx.amount > 0;
            return (
              <div key={tx.id} className="pb-4 mb-4 border-b border-gray-100">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: `${catConfig.color}15` }}
                    >
                      <IconComp size={16} style={{ color: catConfig.color }} />
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-gray-900">{tx.description}</p>
                      <p className="text-[13px] text-gray-400 mt-1">{formatDate(tx.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-[16px] font-bold"
                      style={{ color: isPositive ? '#F59E0B' : '#6B7280' }}
                    >
                      {isPositive ? '+' : ''}{tx.amount.toLocaleString()}개
                    </p>
                    <p className="text-[13px] text-gray-400 mt-0.5">
                      {isPositive ? '적립' : '사용'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
