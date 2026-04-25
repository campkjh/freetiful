'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth.store';
import { ProCardListSkeleton, ProChartSkeleton, ProMetricGridSkeleton } from '../_components/ProSkeletons';

/* ─── Icons ─── */

const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M15 19L8 12L15 5" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const WalletIcon = () => (
  <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
    <rect x="2" y="6" width="24" height="18" rx="4" fill="#22C55E" />
    <rect x="2" y="6" width="24" height="6" rx="4" fill="#16A34A" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="8" fill="#22C55E" />
    <path d="M7 10L9.5 12.5L13.5 7.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="8" fill="#F59E0B" />
    <rect x="9.25" y="6" width="1.5" height="4.5" rx="0.75" fill="#fff" />
    <rect x="9.25" y="9.5" width="3.5" height="1.5" rx="0.75" fill="#fff" />
  </svg>
);

const MoneyBagIcon = () => (
  <img src="/images/monthly-revenue.svg" alt="" width={20} height={20} className="shrink-0" />
);

interface SettlementLog {
  id: string;
  paymentId: string;
  amount: number;
  netAmount: number;
  platformFee: number;
  status: 'pending' | 'settled' | 'cancelled';
  settledAt: string | null;
  createdAt: string;
  payment: {
    id: string;
    amount: number;
    user: { id: string; name: string };
    quotations: { title: string; eventDate: string | null }[];
  };
}

interface LogsResponse {
  data: SettlementLog[];
  meta: {
    total: number;
    pending: number;
    settled: number;
    totalAmount: number;
    pendingAmount: number;
    settledAmount: number;
  };
}

function formatCurrency(n: number) {
  return '₩' + n.toLocaleString();
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function RevenuePage() {
  const authUser = useAuthStore((s) => s.user);
  const [logs, setLogs] = useState<SettlementLog[]>([]);
  const [meta, setMeta] = useState<LogsResponse['meta']>({ total: 0, pending: 0, settled: 0, totalAmount: 0, pendingAmount: 0, settledAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'pending' | 'settled'>('all');

  useEffect(() => {
    if (!authUser) { setLoading(false); return; }
    setLoading(true);
    const params = new URLSearchParams({ limit: '100' });
    if (tab !== 'all') params.set('status', tab);
    apiClient.get<LogsResponse>(`/api/v1/pro/settlements?${params.toString()}`)
      .then((res) => {
        setLogs(res.data.data || []);
        if (res.data.meta) setMeta(res.data.meta);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authUser, tab]);

  // 월별 매출 집계 (행사일 기준)
  const monthlyMap = new Map<string, number>();
  logs.forEach((l) => {
    const ed = l.payment.quotations[0]?.eventDate;
    const date = ed ? new Date(ed) : new Date(l.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap.set(key, (monthlyMap.get(key) || 0) + l.netAmount);
  });
  const monthlyData = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-6)
    .map(([k, amount]) => ({ month: `${Number(k.split('-')[1])}월`, amount }));

  const maxAmount = Math.max(1, ...monthlyData.map((d) => d.amount));

  return (
    <div className="bg-gray-50 min-h-screen pb-28">
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="px-4 pt-12 pb-3 flex items-center gap-3">
          <Link href="/pro-dashboard">
            <div><BackIcon /></div>
          </Link>
          <h1 className="text-lg font-bold text-gray-900">매출 · 정산</h1>
        </div>
      </div>

      {/* Summary */}
      {loading ? (
        <ProMetricGridSkeleton count={3} />
      ) : (
      <div className="px-4 mt-5 grid grid-cols-3 gap-2">
        {[
          { icon: <MoneyBagIcon />, label: '총 매출', value: formatCurrency(meta.totalAmount), color: 'text-gray-900' },
          { icon: <CheckCircleIcon />, label: '정산 완료', value: formatCurrency(meta.settledAmount), color: 'text-green-600' },
          { icon: <ClockIcon />, label: '정산 예정', value: formatCurrency(meta.pendingAmount), color: 'text-amber-600' },
        ].map((item, i) => (
          <div key={i} className="bg-white rounded-xl p-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <div className="mb-2">{item.icon}</div>
            <p className="text-[10px] text-gray-400 font-medium">{item.label}</p>
            <p className={`text-sm font-bold mt-0.5 ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>
      )}

      {/* Chart */}
      {loading ? (
        <ProChartSkeleton />
      ) : monthlyData.length > 0 && (
        <div className="px-4 mt-6">
          <h2 className="text-[15px] font-bold text-gray-900 mb-3">월별 매출 추이</h2>
          <div className="bg-white rounded-2xl p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <div className="flex items-end gap-2 h-32">
              {monthlyData.map((d, i) => {
                const h = (d.amount / maxAmount) * 100;
                const isLast = i === monthlyData.length - 1;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] font-bold text-gray-500">{(d.amount / 10000).toFixed(0)}만</span>
                    <div className="w-full flex items-end" style={{ height: '90px' }}>
                      <div className={`w-full rounded-t-lg ${isLast ? 'bg-[#3180F7]' : 'bg-blue-100'}`} style={{ height: `${h}%` }} />
                    </div>
                    <span className={`text-[10px] font-medium ${isLast ? 'text-[#3180F7] font-bold' : 'text-gray-400'}`}>{d.month}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 mt-6 flex gap-2">
        {(['all', 'pending', 'settled'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium border ${
              tab === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'
            }`}
          >
            {t === 'all' ? '전체' : t === 'pending' ? '정산 예정' : '정산 완료'}
          </button>
        ))}
      </div>

      {/* Transaction List */}
      <div className="px-4 mt-3">
        {loading ? (
          <ProCardListSkeleton count={5} avatar className="space-y-3" />
        ) : logs.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-400">정산 내역이 없습니다</p>
            <p className="text-[11px] text-gray-300 mt-1">고객이 결제하면 여기에 나타납니다</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl divide-y divide-gray-100 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            {logs.map((l) => {
              const q = l.payment.quotations[0];
              const ed = q?.eventDate;
              return (
                <div key={l.id} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                      <WalletIcon />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-gray-900 truncate">
                        {(l.payment.user?.name || '고객').slice(0, 1)}** · {q?.title || '행사'}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        행사 {formatDate(ed)} · 결제 {formatDate(l.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-[13px] font-bold text-gray-900">{formatCurrency(l.netAmount)}</p>
                    <p className={`text-[10px] font-bold mt-0.5 ${
                      l.status === 'settled' ? 'text-green-600' : l.status === 'pending' ? 'text-amber-600' : 'text-gray-400'
                    }`}>
                      {l.status === 'settled' ? '정산 완료' : l.status === 'pending' ? '정산 예정' : '취소'}
                      {l.status === 'settled' && l.settledAt && ` · ${formatDate(l.settledAt)}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
