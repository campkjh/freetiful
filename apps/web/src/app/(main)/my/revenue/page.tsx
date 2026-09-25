'use client';

import { useEffect, useMemo, useState } from 'react';
import { MyDetailHeader } from '../_components/detail-ui';
import { CircleDollarSign, Clock, CheckCircle2, TrendingUp } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth.store';

type RevenueSummary = {
  thisMonth: number;
  lastMonth: number;
  profileViews: number;
  avgRating: number;
  reviewCount: number;
};

type Settlement = {
  id: string;
  month: string;
  amount: number;
  status: string;
  date: string;
};

function won(value: number) {
  return `₩${Number(value || 0).toLocaleString()}`;
}

export default function RevenuePage() {
  const authUser = useAuthStore((s) => s.user);
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    Promise.allSettled([
      apiClient.get<RevenueSummary>('/api/v1/pro/revenue'),
      apiClient.get<Settlement[]>('/api/v1/pro/settlements'),
    ]).then(([revenue, settlement]) => {
      if (!alive) return;
      if (revenue.status === 'fulfilled') setSummary(revenue.value.data);
      if (settlement.status === 'fulfilled') setSettlements(Array.isArray(settlement.value.data) ? settlement.value.data : []);
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [authUser]);

  const change = (summary?.thisMonth || 0) - (summary?.lastMonth || 0);
  const monthly = useMemo(() => settlements.slice(0, 6).reverse(), [settlements]);
  const maxAmount = Math.max(1, ...monthly.map((m) => m.amount || 0));
  const pendingAmount = settlements
    .filter((s) => s.status.includes('예정'))
    .reduce((sum, s) => sum + (s.amount || 0), 0);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white pb-24" style={{ letterSpacing: '-0.02em' }}>
      <MyDetailHeader title="매출 내역" sub="이번 달 매출과 정산 흐름이에요" />

      <div className="qd-body space-y-6 px-6 pt-1">
      <section>
        <div className="rounded-[16px] bg-[#191F28] p-5 text-white">
          <p className="text-[12px] text-white/60">이번 달 매출</p>
          <p className="mt-1 text-[30px] font-black">{loading ? '...' : won(summary?.thisMonth || 0)}</p>
          <div className="mt-3 flex items-center gap-2 text-[12px] text-white/70">
            <TrendingUp size={14} />
            <span>전월 대비 {change >= 0 ? '+' : ''}{won(change).replace('₩', '')}</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        {[
          { label: '전월 매출', value: won(summary?.lastMonth || 0), icon: CircleDollarSign, color: 'text-blue-500' },
          { label: '정산 예정', value: won(pendingAmount), icon: Clock, color: 'text-amber-500' },
          { label: '리뷰', value: `${summary?.reviewCount || 0}개`, icon: CheckCircle2, color: 'text-emerald-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="qd-card p-3">
            <Icon size={17} className={color} />
            <p className="mt-2 text-[11px] text-gray-400">{label}</p>
            <p className="mt-0.5 text-[13px] font-bold text-gray-900">{loading ? '...' : value}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-[17px] font-semibold text-[#333D4B]">월별 정산 흐름</h2>
        <div className="qd-card px-[18px] py-4">
          {monthly.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-gray-400">결제 완료된 매출이 생기면 차트가 표시됩니다</p>
          ) : (
            <div className="flex h-36 items-end gap-2">
              {monthly.map((item, index) => (
                <div key={item.id} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[9px] font-bold text-gray-500">{Math.round(item.amount / 10000)}만</span>
                  <div className="flex h-24 w-full items-end">
                    <div
                      className={`w-full rounded-t-lg ${index === monthly.length - 1 ? 'bg-[#3180F7]' : 'bg-blue-100'}`}
                      style={{ height: `${Math.max(6, (item.amount / maxAmount) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400">{item.month.replace(/^\d+년 /, '')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[17px] font-semibold text-[#333D4B]">정산 내역</h2>
        {loading ? (
          <div className="qd-card p-5 text-[14px] text-[#8B95A1]">매출 데이터를 불러오는 중...</div>
        ) : settlements.length === 0 ? (
          <div className="qd-card p-6 text-center">
            <p className="text-[14px] font-semibold text-gray-600">아직 매출 내역이 없습니다</p>
            <p className="mt-1 text-[12px] text-gray-400">고객 결제가 완료되면 월별 정산 내역이 생성됩니다</p>
          </div>
        ) : (
          <div className="qd-card overflow-hidden">
            {settlements.map((item, index) => (
              <div key={item.id} className={`flex items-center justify-between p-4 ${index > 0 ? 'border-t border-gray-100' : ''}`}>
                <div>
                  <p className="text-[14px] font-bold text-gray-900">{item.month}</p>
                  <p className="mt-0.5 text-[11px] text-gray-400">지급 예정일 {item.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-bold text-gray-900">{won(item.amount)}</p>
                  <p className={`mt-0.5 text-[11px] font-bold ${item.status.includes('완료') ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {item.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
