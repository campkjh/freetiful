'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { apiClient } from '@/lib/api/client';

const MOCK_PAYMENTS: { id: string; title: string; proName: string; amount: number; status: string; date: string; method: string; refundAmount?: number }[] = [];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  completed: { label: '결제완료', color: 'text-green-600 bg-green-50' },
  escrowed: { label: '에스크로', color: 'text-blue-600 bg-blue-50' },
  refunded: { label: '환불완료', color: 'text-red-500 bg-red-50' },
  pending: { label: '결제대기', color: 'text-yellow-600 bg-yellow-50' },
};

export default function PaymentHistoryPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const [apiPayments, setApiPayments] = useState<typeof MOCK_PAYMENTS | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (authUser) {
      apiClient.get('/api/v1/payment', { params: { limit: 50 } })
        .then((res) => {
          const data = res.data?.data || [];
          if (data.length > 0) {
            setApiPayments(data.map((p: any) => ({
              id: p.id,
              title: p.description || '결제',
              proName: p.quotation?.proProfile?.user?.name || '',
              amount: p.amount,
              status: p.status,
              date: new Date(p.createdAt).toLocaleDateString('ko-KR'),
              method: p.paymentMethod || '',
              refundAmount: p.refundAmount,
            })));
          }
        })
        .catch(() => {});
    }
  }, [authUser]);

  const payments = apiPayments || [];

  return (
    <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white">
        <div className="flex items-center h-[52px] px-4">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[18px] font-bold ml-2">결제/환불 내역</h1>
        </div>
      </div>

      {/* Divider */}
      <div className="h-1.5 bg-gray-50" />

      <div className="px-4 py-4 space-y-3">
        {payments.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm">결제 내역이 없습니다</p>
          </div>
        ) : payments.map((p) => {
          const status = STATUS_MAP[p.status] || STATUS_MAP.pending;
          return (
            <div
              key={p.id}
              className="border border-gray-100 p-4 space-y-2"
              style={{ borderRadius: 12 }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{p.date}</span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 ${status.color}`}
                  style={{ borderRadius: 6 }}
                >
                  {status.label}
                </span>
              </div>
              <p className="text-sm font-bold text-gray-900">{p.title}</p>
              <p className="text-xs text-gray-500">{p.proName} · {p.method}</p>
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400">결제금액</span>
                <span className="text-base font-bold text-gray-900">{p.amount.toLocaleString()}원</span>
              </div>
              {p.refundAmount && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-red-400">환불금액</span>
                  <span className="text-sm font-bold text-red-500">{p.refundAmount.toLocaleString()}원</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

