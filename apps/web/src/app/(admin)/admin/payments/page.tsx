'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../_components/ErrorPanel';
import { adminFetch } from '../_components/adminFetch';

interface PaymentItem {
  id: string;
  amount: number;
  status: string;
  userName: string;
  proName: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  completed: 'bg-green-50 text-green-600',
  pending: 'bg-yellow-50 text-yellow-600',
  failed: 'bg-red-50 text-red-600',
  refunded: 'bg-gray-100 text-gray-500',
};

const statusLabels: Record<string, string> = {
  completed: '완료',
  pending: '대기',
  failed: '실패',
  refunded: '환불',
};

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('전체');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [lastError, setLastError] = useState<AdminErrorInfo | null>(null);
  const LIMIT = 20;

  const fetchPayments = async (p = page, st = filterStatus) => {
    setLoading(true);
    setLastError(null);
    try {
      const params: any = { page: p, limit: LIMIT };
      if (st !== '전체') params.status = st;
      const data = await adminFetch('GET', `/api/v1/admin/payments?${new URLSearchParams(params).toString()}`);
      setPayments(data.data || []);
      setTotal(data.total || 0);
      const sum = (data.data || []).reduce((s: number, p: PaymentItem) => s + (p.amount || 0), 0);
      setTotalAmount(sum);
    } catch (e: any) {
      const err = extractAdminError(e);
      setLastError(err);
      toast.error(`결제 목록 로드 실패${err.status ? ` (${err.status})` : ''}: ${err.message}`, { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPayments(); }, []);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/admin" className="p-1 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></Link>
          <h1 className="text-lg font-bold text-gray-900">결제 관리</h1>
          <span className="ml-auto text-sm text-gray-400">총 {total}건 · ₩{totalAmount.toLocaleString()}</span>
          <button onClick={() => fetchPayments(page, filterStatus)} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        <AdminErrorPanel error={lastError} label="결제" />
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex gap-2 flex-wrap">
            {['전체', 'completed', 'pending', 'failed', 'refunded'].map((st) => (
              <button
                key={st}
                onClick={() => { setFilterStatus(st); setPage(1); fetchPayments(1, st); }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === st ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {st === '전체' ? '전체' : statusLabels[st] || st}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">유저</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">전문가</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">금액</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">상태</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">날짜</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-400">로딩 중...</td></tr>
                ) : payments.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-400">결제 내역이 없습니다</td></tr>
                ) : payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{payment.id.slice(0, 8)}...</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{payment.userName || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{payment.proName || '-'}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">₩{Number(payment.amount).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[payment.status] || 'bg-gray-100 text-gray-500'}`}>
                        {statusLabels[payment.status] || payment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                      {new Date(payment.createdAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
              <p className="text-xs text-gray-500">총 {total}건 ({page}/{totalPages} 페이지)</p>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); fetchPayments(p); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"><ChevronLeft size={16} /></button>
                <span className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg">{page}</span>
                <button disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); fetchPayments(p); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
