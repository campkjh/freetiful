'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Check, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../_components/ErrorPanel';
import { AdminDateFilter, type AdminDateRange } from '../_components/AdminDateFilter';
import { AdminExportButton, exportRowsToXls, fetchAllAdminRows, formatExportDate } from '../_components/AdminExportButton';
import { AdminTerm } from '../_components/AdminHelpTooltip';
import { AdminInfiniteScroll, appendUniqueById } from '../_components/AdminInfiniteScroll';
import { adminFetch } from '../_components/adminFetch';

interface SettlementLogItem {
  id: string;
  paymentId: string;
  proProfileId: string;
  amount: number;
  platformFee: number;
  netAmount: number;
  status: 'pending' | 'settled' | 'cancelled';
  settledAt: string | null;
  note: string | null;
  createdAt: string;
  proProfile: { id: string; user: { id: string; name: string; email: string } };
  payment: {
    id: string;
    amount: number;
    createdAt: string;
    user: { id: string; name: string };
    quotations: { title: string; eventDate: string | null }[];
  };
  settledBy: { id: string; name: string } | null;
}

interface ListResponse {
  data: SettlementLogItem[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
  summary: { pendingCount: number; pendingAmount: number; settledCount: number; settledAmount: number };
}

const STATUS_LABELS: Record<string, string> = {
  pending: '정산 대기',
  settled: '정산 완료',
  cancelled: '취소',
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  settled: 'bg-green-50 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function AdminSettlementsPage() {
  const [items, setItems] = useState<SettlementLogItem[]>([]);
  const [meta, setMeta] = useState<ListResponse['meta']>({ total: 0, page: 1, limit: 30, hasMore: false });
  const [summary, setSummary] = useState<ListResponse['summary']>({ pendingCount: 0, pendingAmount: 0, settledCount: 0, settledAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'settled'>('pending');
  const [page, setPage] = useState(1);
  const [lastError, setLastError] = useState<AdminErrorInfo | null>(null);
  const [dateRange, setDateRange] = useState<AdminDateRange>({ startDate: '', endDate: '' });

  async function fetchList(p = page, f = filter, range = dateRange, append = false) {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setLastError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '30' });
      if (f !== 'all') params.set('status', f);
      if (range.startDate) params.set('startDate', range.startDate);
      if (range.endDate) params.set('endDate', range.endDate);
      const data: ListResponse = await adminFetch('GET', `/api/v1/admin/settlements?${params.toString()}`);
      const nextItems = data.data || [];
      setItems((prev) => append ? appendUniqueById(prev, nextItems) : nextItems);
      setMeta(data.meta);
      setSummary(data.summary);
      setPage(data.meta?.page || p);
    } catch (e: any) {
      const err = extractAdminError(e);
      setLastError(err);
      toast.error(`정산 목록 로드 실패${err.status ? ` (${err.status})` : ''}: ${err.message}`, { duration: 6000 });
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }

  useEffect(() => { fetchList(1, filter, dateRange); setPage(1); }, [filter]);

  async function handleSettle(id: string) {
    if (!confirm('정산 완료로 처리하시겠습니까? 전문가에게 알림이 발송됩니다.')) return;
    setProcessingId(id);
    try {
      await adminFetch('POST', `/api/v1/admin/settlements/${id}/settle`, {});
      toast.success('정산 완료로 처리되었습니다');
      fetchList(1, filter, dateRange);
    } catch (e: any) {
      const err = extractAdminError(e);
      toast.error(`정산 처리 실패: ${err.message}`, { duration: 6000 });
    } finally {
      setProcessingId(null);
    }
  }

  async function handleUnsettle(id: string) {
    if (!confirm('정산을 취소(되돌리기) 하시겠습니까?')) return;
    setProcessingId(id);
    try {
      await adminFetch('POST', `/api/v1/admin/settlements/${id}/unsettle`, {});
      toast.success('정산이 취소되었습니다');
      fetchList(1, filter, dateRange);
    } catch (e: any) {
      const err = extractAdminError(e);
      toast.error(`취소 실패: ${err.message}`, { duration: 6000 });
    } finally {
      setProcessingId(null);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const rows = await fetchAllAdminRows<SettlementLogItem>({
        fetchPage: async (p, limit) => {
          const params = new URLSearchParams({ page: String(p), limit: String(limit) });
          if (filter !== 'all') params.set('status', filter);
          if (dateRange.startDate) params.set('startDate', dateRange.startDate);
          if (dateRange.endDate) params.set('endDate', dateRange.endDate);
          const data: ListResponse = await adminFetch('GET', `/api/v1/admin/settlements?${params.toString()}`, undefined, { cache: false });
          return { rows: data.data || [], total: data.meta?.total, hasMore: data.meta?.hasMore };
        },
      });

      exportRowsToXls('admin-settlements', '정산 관리', rows, [
        { header: '순번', value: (_, index) => index + 1 },
        { header: '정산ID', value: (row) => row.id },
        { header: '결제ID', value: (row) => row.paymentId },
        { header: '프로', value: (row) => row.proProfile?.user?.name || '' },
        { header: '프로이메일', value: (row) => row.proProfile?.user?.email || '' },
        { header: '고객', value: (row) => row.payment?.user?.name || '' },
        { header: '행사', value: (row) => row.payment?.quotations?.[0]?.title || '' },
        { header: '행사일', value: (row) => formatExportDate(row.payment?.quotations?.[0]?.eventDate) },
        { header: '금액', value: (row) => row.amount },
        { header: '플랫폼수수료', value: (row) => row.platformFee },
        { header: '정산액', value: (row) => row.netAmount },
        { header: '상태', value: (row) => STATUS_LABELS[row.status] || row.status },
        { header: '정산일', value: (row) => formatExportDate(row.settledAt, true) },
        { header: '처리자', value: (row) => row.settledBy?.name || '' },
        { header: '메모', value: (row) => row.note || '' },
        { header: '생성일', value: (row) => formatExportDate(row.createdAt, true) },
      ]);
      toast.success(`${rows.length.toLocaleString()}건 엑셀 다운로드 완료`);
    } catch (e: any) {
      toast.error(`엑셀 다운로드 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/admin" className="p-1 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></Link>
          <h1 className="text-lg font-bold text-gray-900">정산 관리</h1>
          <div className="ml-auto flex items-center gap-2">
            <AdminExportButton loading={exporting} onClick={handleExport} />
            <button onClick={() => fetchList(1, filter, dateRange)} className="p-2 hover:bg-gray-100 rounded-lg">
              <RefreshCw size={16} className="text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-4">
        {/* 요약 */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-xs text-gray-400 mb-1"><AdminTerm term="정산 대기 건수">정산 대기 건수</AdminTerm></p>
            <p className="text-2xl font-bold text-amber-600">{summary.pendingCount}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-xs text-gray-400 mb-1"><AdminTerm term="정산 대기 금액">정산 대기 금액</AdminTerm></p>
            <p className="text-2xl font-bold text-amber-600">₩{summary.pendingAmount.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-xs text-gray-400 mb-1"><AdminTerm term="정산 완료 건수">정산 완료 건수</AdminTerm></p>
            <p className="text-2xl font-bold text-green-600">{summary.settledCount}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-xs text-gray-400 mb-1"><AdminTerm term="정산 완료 금액">정산 완료 금액</AdminTerm></p>
            <p className="text-2xl font-bold text-green-600">₩{summary.settledAmount.toLocaleString()}</p>
          </div>
        </div>

        {/* 필터 */}
        <div className="flex gap-2">
          {(['pending', 'all', 'settled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-medium border ${
                filter === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {f === 'all' ? '전체' : f === 'pending' ? '정산 대기' : '정산 완료'}
            </button>
          ))}
        </div>

        <AdminDateFilter
          value={dateRange}
          onApply={(range) => {
            setDateRange(range);
            setPage(1);
            fetchList(1, filter, range);
          }}
        />

        {lastError && <AdminErrorPanel error={lastError} />}

        {/* 목록 */}
        <div className="bg-white rounded-xl overflow-hidden border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="text-left px-4 py-3">프로</th>
                <th className="text-left px-4 py-3">고객</th>
                <th className="text-left px-4 py-3">행사</th>
                <th className="text-left px-4 py-3">행사일</th>
                <th className="text-right px-4 py-3">금액</th>
                <th className="text-right px-4 py-3"><AdminTerm term="정산액">정산액</AdminTerm></th>
                <th className="text-center px-4 py-3"><AdminTerm term="상태">상태</AdminTerm></th>
                <th className="text-center px-4 py-3">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">불러오는 중…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">정산 내역이 없습니다</td></tr>
              ) : items.map((it) => {
                const quote = it.payment.quotations[0];
                return (
                  <tr key={it.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{it.proProfile?.user?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{it.payment.user?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 truncate max-w-[180px]">{quote?.title || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(quote?.eventDate || null)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">₩{it.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">₩{it.netAmount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[it.status]}`}>
                        {STATUS_LABELS[it.status]}
                      </span>
                      {it.settledAt && <p className="text-[10px] text-gray-400 mt-1">{formatDate(it.settledAt)}</p>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {it.status === 'pending' ? (
                        <button
                          onClick={() => handleSettle(it.id)}
                          disabled={processingId === it.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#3180F7] text-white text-xs font-bold hover:bg-[#2563EB] disabled:opacity-50"
                        >
                          {processingId === it.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          정산
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnsettle(it.id)}
                          disabled={processingId === it.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 disabled:opacity-50"
                        >
                          {processingId === it.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                          취소
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <AdminInfiniteScroll
          hasMore={meta.hasMore || items.length < meta.total}
          loading={loadingMore}
          loaded={items.length}
          total={meta.total}
          onLoadMore={() => {
            const hasMore = meta.hasMore || items.length < meta.total;
            if (!hasMore || loading || loadingMore) return;
            fetchList(page + 1, filter, dateRange, true);
          }}
        />
      </div>
    </div>
  );
}
