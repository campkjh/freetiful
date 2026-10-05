'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from '@/app/(admin)/admin/_components/admin-icons';
import toast from 'react-hot-toast';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../_components/ErrorPanel';
import { AdminDateFilter, type AdminDateRange } from '../_components/AdminDateFilter';
import { AdminExportButton, exportRowsToXls, fetchAllAdminRows, formatExportDate } from '../_components/AdminExportButton';
import { AdminTerm } from '../_components/AdminHelpTooltip';
import { AdminInfiniteScroll, appendUniqueById } from '../_components/AdminInfiniteScroll';
import { adminFetch } from '../_components/adminFetch';
import { useAdminRefresh } from '../_components/adminRefresh';
import { AdminEventCell, AdminPartyCell, formatPhone, type AdminEvent } from '../_components/adminEvent';
import { adminConfirm } from '../_components/adminDialog';
import { AdminListCard, AdminTableScroll } from '../_components/AdminListCard';
import { RollingNumber } from '../_components/AdminNumber';
import { AdminBillModal } from '../_components/AdminBillModal';
import { AdminRadioGroup } from '../_components/AdminRadioGroup';

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
    user: { id: string; name: string; phone?: string | null };
    /** 결제 시 입력받은 연락처 우선, 없으면 계정 번호 폴백(서버에서 계산) */
    customerPhone?: string | null;
    quotations: { title: string; eventDate: string | null }[];
    /** 어떤 행사였는지 — 견적 일시·장소 우선, 없으면 매칭 요청에서(서버 계산, 261004) */
    event?: AdminEvent;
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
/** 상태 뱃지 색(adm-badge) */
const STATUS_COLORS: Record<string, string> = {
  pending: 'orange',
  settled: 'green',
  cancelled: '',
};
/** 행사 정보 — 새 서버는 event 를 주고, 옛 서버면 견적 제목·날짜로 */
function eventOf(it: SettlementLogItem): AdminEvent {
  const q = it.payment?.quotations?.[0];
  const e = it.payment?.event;
  return {
    title: e?.title || q?.title || null,
    kind: e?.kind || null,
    date: e?.date || (q?.eventDate ? String(q.eventDate).slice(0, 10) : null),
    time: e?.time || null,
    location: e?.location || null,
  };
}

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
  /** 정산 명세서(빌지) 창 — 정산하기 뒤 바로(fresh), 줄의 '빌지'로 다시 */
  const [bill, setBill] = useState<{ id: string; fresh: boolean } | null>(null);
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
    if (!(await adminConfirm('정산 완료로 처리하시겠습니까? 사회자에게 알림이 발송됩니다.'))) return;
    setProcessingId(id);
    try {
      await adminFetch('POST', `/api/v1/admin/settlements/${id}/settle`, {});
      toast.success('정산 완료로 처리되었습니다');
      fetchList(1, filter, dateRange);
      // 바로 빌지를 띄운다 — 사회자에게 카톡으로 이미지 보내기(261005 사장)
      setBill({ id, fresh: true });
    } catch (e: any) {
      const err = extractAdminError(e);
      toast.error(`정산 처리 실패: ${err.message}`, { duration: 6000 });
    } finally {
      setProcessingId(null);
    }
  }

  async function handleUnsettle(id: string) {
    if (!(await adminConfirm('정산을 취소(되돌리기) 하시겠습니까?'))) return;
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
        { header: '고객연락처', value: (row) => formatPhone(row.payment?.customerPhone || row.payment?.user?.phone) },
        { header: '행사', value: (row) => eventOf(row).title },
        { header: '행사 종류', value: (row) => eventOf(row).kind },
        { header: '행사일', value: (row) => formatExportDate(eventOf(row).date) },
        { header: '행사 시간', value: (row) => eventOf(row).time || '' },
        { header: '행사 장소', value: (row) => eventOf(row).location },
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

  // 머리 오른쪽 새로고침(종 옆)
  useAdminRefresh(() => fetchList(1, filter, dateRange));

  return (
    <div className="adm-stack">
      {/* 요약 — 제목은 레이아웃 머리(정산 내역) */}
      <div className="adm-grid adm-rise grid-cols-2 lg:grid-cols-4">
        <div className="adm-stat">
          <p className="adm-stat-label"><AdminTerm term="정산 대기 건수">정산 대기</AdminTerm></p>
          <p className="adm-stat-value" style={{ color: '#F46A00' }}><RollingNumber value={summary.pendingCount} /><small>건</small></p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label"><AdminTerm term="정산 대기 금액">보낼 금액</AdminTerm></p>
          <p className="adm-stat-value adm-money">₩<RollingNumber value={summary.pendingAmount} /></p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label"><AdminTerm term="정산 완료 건수">정산 완료</AdminTerm></p>
          <p className="adm-stat-value" style={{ color: '#03B26C' }}><RollingNumber value={summary.settledCount} /><small>건</small></p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label"><AdminTerm term="정산 완료 금액">보낸 금액</AdminTerm></p>
          <p className="adm-stat-value adm-money">₩<RollingNumber value={summary.settledAmount} /></p>
        </div>
      </div>

      {lastError && <AdminErrorPanel error={lastError} />}

      {/* 거르기·조회기간 + 정산 표 = 한 카드(261005 사장 '테이블이랑 필터링 패널이랑 합쳐줘').
          목록 — 누가(사회자 → 고객) · 어떤 행사를 언제 어디서 · 얼마 */}
      <AdminListCard
        filter={<>
          <div className="adm-toolbar">
            <AdminRadioGroup
              value={filter}
              options={[{ value: 'pending', label: '정산 대기' }, { value: 'all', label: '전체' }, { value: 'settled', label: '정산 완료' }]}
              ariaLabel="정산 상태"
              onChange={(f) => setFilter(f)}
            />
            <span className="grow" />
            <span className="adm-count">총 <b><RollingNumber value={meta.total} /></b>건</span>
            <AdminExportButton loading={exporting} onClick={handleExport} />
          </div>
          <AdminDateFilter
            value={dateRange}
            onApply={(range) => {
              setDateRange(range);
              setPage(1);
              fetchList(1, filter, range);
            }}
          />
        </>}
      >
        <AdminTableScroll>
          <table className="adm-table">
            <thead>
              <tr>
                <th>사회자 · 고객</th>
                <th>행사</th>
                <th className="r">결제 금액</th>
                <th className="r"><AdminTerm term="정산액">정산액</AdminTerm></th>
                <th className="c"><AdminTerm term="상태">상태</AdminTerm></th>
                <th className="c" aria-label="처리" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={6}><div className="adm-skel h-[44px]" /></td></tr>
                ))
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="adm-empty">정산 내역이 없어요</td></tr>
              ) : items.map((it) => {
                return (
                  <tr key={it.id}>
                    <td>
                      <AdminPartyCell pro={it.proProfile?.user?.name} customer={it.payment.user?.name} phone={it.payment.customerPhone || it.payment.user?.phone} />
                    </td>
                    <td className="adm-ev"><AdminEventCell ev={eventOf(it)} /></td>
                    <td className="r">
                      <span className="adm-money">₩{it.amount.toLocaleString()}</span>
                      <span className="adm-cell-sub">수수료 ₩{(it.platformFee || 0).toLocaleString()}</span>
                    </td>
                    <td className="r"><b className="adm-money text-[16px] text-[#191F28]">₩{it.netAmount.toLocaleString()}</b></td>
                    <td className="c">
                      <span className={`adm-badge ${STATUS_COLORS[it.status] || ''}`}>{STATUS_LABELS[it.status]}</span>
                      {it.settledAt && <span className="adm-cell-sub">{formatDate(it.settledAt)}</span>}
                    </td>
                    <td className="c">
                      <span className="inline-flex gap-1.5">
                        <button type="button" onClick={() => setBill({ id: it.id, fresh: false })} className="adm-btn sm" title="정산 명세서(빌지) · 카카오톡 이미지 공유">
                          빌지
                        </button>
                        {it.status === 'pending' ? (
                          <button type="button" onClick={() => handleSettle(it.id)} disabled={processingId === it.id} className="adm-btn primary sm">
                            {processingId === it.id ? <Loader2 size={13} className="animate-spin" /> : null}
                            정산하기
                          </button>
                        ) : (
                          <button type="button" onClick={() => handleUnsettle(it.id)} disabled={processingId === it.id} className="adm-btn sm">
                            {processingId === it.id ? <Loader2 size={13} className="animate-spin" /> : null}
                            되돌리기
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminTableScroll>

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
      </AdminListCard>
      <AdminBillModal id={bill?.id || null} fresh={bill?.fresh} onClose={() => setBill(null)} />
    </div>
  );
}
