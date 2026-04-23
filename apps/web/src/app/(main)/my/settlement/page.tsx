'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, CheckCircle, Clock } from 'lucide-react';
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
  const router = useRouter();
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
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white">
        <div className="flex items-center h-[52px] px-4">
          <button onClick={() => router.back()} className="p-1 -ml-1 active:scale-90 transition-transform">
            <ChevronLeft size={24} className="text-gray-900" />
          </button>
          <h1 className="text-[18px] font-bold text-gray-900 ml-1">정산 내역</h1>
        </div>
      </div>

      {/* Total */}
      <div className="px-4 pt-2 pb-5">
        <p className="text-[13px] text-gray-400">누적 정산 금액</p>
        <p className="text-[28px] font-bold text-gray-900 mt-1">₩{totalSettled.toLocaleString()}</p>
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-200" />

      {/* Settlement List */}
      <div className="px-4 pt-5 pb-10">
        <p className="text-[16px] font-bold text-gray-900 mb-4">월별 정산</p>
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : settlements.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-[14px]">아직 정산 내역이 없습니다</div>
        ) : (
        <div className="space-y-3">
          {settlements.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-gray-50">
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
                <p className="text-[15px] font-bold text-gray-900">{s.month}</p>
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
  );
}
