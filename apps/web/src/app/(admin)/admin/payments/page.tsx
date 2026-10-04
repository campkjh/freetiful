'use client';

import { useState, useEffect } from 'react';
import { RefreshCw } from '@/app/(admin)/admin/_components/admin-icons';
import toast from 'react-hot-toast';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../_components/ErrorPanel';
import { AdminDateFilter, type AdminDateRange } from '../_components/AdminDateFilter';
import { AdminExportButton, exportRowsToXls, fetchAllAdminRows, formatExportDate } from '../_components/AdminExportButton';
import { AdminTerm } from '../_components/AdminHelpTooltip';
import { AdminInfiniteScroll, appendUniqueById } from '../_components/AdminInfiniteScroll';
import { adminFetch } from '../_components/adminFetch';

interface PaymentItem {
  id: string;
  amount: number;
  status: string;
  userName: string;
  proName: string;
  createdAt: string;
}

/** 상태 뱃지 색(adm-badge) */
const statusColors: Record<string, string> = {
  completed: 'green',
  pending: 'orange',
  failed: 'red',
  refunded: '',
  escrowed: 'blue',
  settled: 'blue',
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filterStatus, setFilterStatus] = useState('전체');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastError, setLastError] = useState<AdminErrorInfo | null>(null);
  const [dateRange, setDateRange] = useState<AdminDateRange>({ startDate: '', endDate: '' });
  const LIMIT = 20;

  const fetchPayments = async (p = page, st = filterStatus, range = dateRange, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setLastError(null);
    try {
      const params: any = { page: p, limit: LIMIT };
      if (st !== '전체') params.status = st;
      if (range.startDate) params.startDate = range.startDate;
      if (range.endDate) params.endDate = range.endDate;
      const data = await adminFetch('GET', `/api/v1/admin/payments?${new URLSearchParams(params).toString()}`);
      const nextPayments = data.data || [];
      setPayments((prev) => append ? appendUniqueById(prev, nextPayments) : nextPayments);
      setTotal(data.total || 0);
      setPage(p);
    } catch (e: any) {
      const err = extractAdminError(e);
      setLastError(err);
      toast.error(`결제 목록 로드 실패${err.status ? ` (${err.status})` : ''}: ${err.message}`, { duration: 6000 });
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  };

  useEffect(() => { fetchPayments(); }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await fetchAllAdminRows<PaymentItem>({
        fetchPage: async (p, limit) => {
          const params: any = { page: p, limit };
          if (filterStatus !== '전체') params.status = filterStatus;
          if (dateRange.startDate) params.startDate = dateRange.startDate;
          if (dateRange.endDate) params.endDate = dateRange.endDate;
          const data = await adminFetch('GET', `/api/v1/admin/payments?${new URLSearchParams(params).toString()}`, undefined, { cache: false });
          return { rows: data.data || [], total: data.total };
        },
      });

      exportRowsToXls('admin-payments', '결제 관리', rows, [
        { header: '순번', value: (_, index) => index + 1 },
        { header: '결제ID', value: (row) => row.id },
        { header: '유저', value: (row) => row.userName || '' },
        { header: '사회자', value: (row) => row.proName || '' },
        { header: '금액', value: (row) => row.amount },
        { header: '상태', value: (row) => statusLabels[row.status] || row.status },
        { header: '결제일', value: (row) => formatExportDate(row.createdAt, true) },
      ]);
      toast.success(`${rows.length.toLocaleString()}건 엑셀 다운로드 완료`);
    } catch (e: any) {
      toast.error(`엑셀 다운로드 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setExporting(false);
    }
  };

  const hasMore = payments.length < total;
  const visibleAmount = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);

  return (
    <div className="space-y-5">
      {/* 도구막대 — 제목은 레이아웃 머리(결제 조회) */}
      <div className="adm-toolbar">
        <div className="adm-chips">
          {['전체', 'completed', 'pending', 'failed', 'refunded'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => { setFilterStatus(st); setPage(1); fetchPayments(1, st, dateRange); }}
              className={`adm-chip ${filterStatus === st ? 'on' : ''}`}
            >
              {st === '전체' ? '전체' : statusLabels[st] || st}
            </button>
          ))}
        </div>
        <span className="grow" />
        <span className="adm-count">총 <b>{total.toLocaleString()}</b>건 · <b>₩{visibleAmount.toLocaleString()}</b></span>
        <AdminExportButton loading={exporting} onClick={handleExport} />
        <button
          type="button"
          onClick={() => fetchPayments(1, filterStatus, dateRange)}
          disabled={loading}
          className="adm-btn icon"
          title="새로고침"
          aria-label="새로고침"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

        <AdminErrorPanel error={lastError} label="결제" />

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
                  <th className="text-left px-4 py-3">고객 → 사회자</th>
                  <th className="text-right px-4 py-3">금액</th>
                  <th className="text-center px-4 py-3"><AdminTerm term="상태">상태</AdminTerm></th>
                  <th className="text-center px-4 py-3">결제일</th>
                  <th className="text-right px-4 py-3"><AdminTerm term="결제ID">결제 ID</AdminTerm></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-4 py-3">
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
                  <tr><td colSpan={5} className="adm-empty">결제 내역이 없어요</td></tr>
                ) : payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="adm-cell-main">{payment.userName || '-'}</span>
                      <span className="adm-cell-sub">→ {payment.proName || '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-right"><b className="adm-money text-[16px] text-[#191F28]">₩{Number(payment.amount).toLocaleString()}</b></td>
                    <td className="px-4 py-3 text-center">
                      <span className={`adm-badge ${statusColors[payment.status] || ''}`}>
                        {statusLabels[payment.status] || payment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap text-[13px] text-[#8B95A1]">
                      {new Date(payment.createdAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[12px] text-[#B0B8C1]">{payment.id.slice(0, 8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <AdminInfiniteScroll
            hasMore={hasMore}
            loading={loadingMore}
            loaded={payments.length}
            total={total}
            onLoadMore={() => {
              if (!hasMore || loading || loadingMore) return;
              fetchPayments(page + 1, filterStatus, dateRange, true);
            }}
          />
        </div>
    </div>
  );
}
