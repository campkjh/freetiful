'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../_components/ErrorPanel';
import { AdminDateFilter, type AdminDateRange } from '../_components/AdminDateFilter';
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
  const [dateRange, setDateRange] = useState<AdminDateRange>({ startDate: '', endDate: '' });
  const LIMIT = 20;

  const fetchPayments = async (p = page, st = filterStatus, range = dateRange) => {
    setLoading(true);
    setLastError(null);
    try {
      const params: any = { page: p, limit: LIMIT };
      if (st !== '전체') params.status = st;
      if (range.startDate) params.startDate = range.startDate;
      if (range.endDate) params.endDate = range.endDate;
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
    <div className="space-y-5">
      <div className="flex items-center gap-3 px-1">
        <Link href="/admin" className="admin-icon-button flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6B7684] shadow-[0_6px_16px_rgba(2,32,71,0.04)] hover:bg-[#F2F4F6]">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <p className="text-[12px] font-bold text-[#3182F6]">매출 운영</p>
          <h1 className="mt-1 text-[24px] font-black text-[#191F28] tracking-tight">결제 관리</h1>
        </div>
        <span className="ml-auto rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-[#6B7684] shadow-[0_6px_16px_rgba(2,32,71,0.04)]">
          총 {total.toLocaleString()}건 · ₩{totalAmount.toLocaleString()}
        </span>
        <button
          onClick={() => fetchPayments(page, filterStatus, dateRange)}
          disabled={loading}
          className="admin-icon-button flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6B7684] shadow-[0_6px_16px_rgba(2,32,71,0.04)] hover:bg-[#F2F4F6] disabled:opacity-50"
          title="새로고침"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

        <AdminErrorPanel error={lastError} label="결제" />
        <div className="admin-toolbar p-4">
          <div className="flex gap-2 flex-wrap">
            {['전체', 'completed', 'pending', 'failed', 'refunded'].map((st) => (
              <button
                key={st}
                onClick={() => { setFilterStatus(st); setPage(1); fetchPayments(1, st, dateRange); }}
                className={`admin-chip px-3.5 text-sm ${filterStatus === st ? 'bg-[#191F28] text-white shadow-[0_8px_18px_rgba(25,31,40,0.14)]' : 'bg-[#F2F4F6] text-[#6B7684] hover:bg-[#E5E8EB] hover:text-[#191F28]'}`}
              >
                {st === '전체' ? '전체' : statusLabels[st] || st}
              </button>
            ))}
          </div>
        </div>

        <AdminDateFilter
          value={dateRange}
          onApply={(range) => {
            setDateRange(range);
            setPage(1);
            fetchPayments(1, filterStatus, range);
          }}
        />

        <div className="admin-list-card">
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
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="skeleton h-3 w-24" />
                          <div className="skeleton h-3 w-32" />
                          <div className="skeleton h-3 w-32" />
                          <div className="ml-auto skeleton h-8 w-24" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : payments.length === 0 ? (
                  <tr><td colSpan={6} className="admin-empty-state text-center py-14 text-sm font-semibold">결제 내역이 없습니다</td></tr>
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
            <div className="border-t border-[#F2F4F6] px-4 py-3 flex items-center justify-between">
              <p className="text-xs text-gray-500">총 {total}건 ({page}/{totalPages} 페이지)</p>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); fetchPayments(p, filterStatus, dateRange); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"><ChevronLeft size={16} /></button>
                <span className="px-3 py-1 text-xs font-bold bg-blue-50 text-blue-600 rounded-full">{page}</span>
                <button disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); fetchPayments(p, filterStatus, dateRange); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
