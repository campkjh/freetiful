'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Clock } from 'lucide-react';
import { MyDetailHeader } from '../_components/detail-ui';
import { useAuthStore } from '@/lib/store/auth.store';
import { apiClient } from '@/lib/api/client';

interface SettlementRecord {
  id: string;
  month: string;
  amount: number;
  status: '정산완료' | '정산예정';
  date: string;
}

export default function SettlementPage() {
  const authUser = useAuthStore((s) => s.user);
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!authUser) { setLoading(false); return; }
    apiClient.get<SettlementRecord[]>('/api/v1/pro/settlements')
      .then((res) => {
        setSettlements(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => setSettlements([]))
      .finally(() => setLoading(false));
  }, [authUser]);

  const totalSettled = settlements
    .filter(s => s.status === '정산완료')
    .reduce((acc, s) => acc + s.amount, 0);

  return (
    <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
      <MyDetailHeader title="정산 내역" sub="매달 정산된 금액을 확인하세요" />

      {/* Total */}
      <div className="qd-body px-6 pb-10 pt-1">
      <div className="qd-card mb-6 px-[18px] py-5">
        <p className="text-[13px] text-[#8B95A1]">누적 정산 금액</p>
        <p className="mt-1 text-[28px] font-bold text-[#191F28]">₩{totalSettled.toLocaleString()}</p>
      </div>

      {/* Settlement List */}
      <div>
        <p className="mb-3 text-[17px] font-semibold text-[#333D4B]">월별 정산</p>
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-[16px] bg-[#F7F8FA]" />
            ))}
          </div>
        ) : settlements.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-[14px]">아직 정산 내역이 없습니다</div>
        ) : (
        <div className="space-y-2.5">
          {settlements.map((s) => (
            <div key={s.id} className="qd-card flex min-h-[60px] items-center gap-3 px-[18px] py-3.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: s.status === '정산완료' ? '#D1FAE515' : '#FEF3C715' }}
              >
                {s.status === '정산완료' ? (
                  <CheckCircle size={18} className="text-green-500" />
                ) : (
                  <Clock size={18} className="text-amber-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[17px] font-semibold text-[#333D4B]">{s.month}</p>
                <p className="text-[12px] text-gray-400 mt-0.5">{s.date} {s.status === '정산완료' ? '지급' : '지급 예정'}</p>
              </div>
              <div className="text-right">
                <p className="text-[15px] font-bold text-gray-900">₩{s.amount.toLocaleString()}</p>
                <span
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: s.status === '정산완료' ? '#D1FAE5' : '#FEF3C7',
                    color: s.status === '정산완료' ? '#059669' : '#D97706',
                  }}
                >
                  {s.status}
                </span>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
      </div>
    </div>
  );
}
