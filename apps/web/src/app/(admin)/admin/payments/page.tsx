'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../_components/ErrorPanel';
import { AdminDateFilter, type AdminDateRange } from '../_components/AdminDateFilter';
import { AdminExportButton, exportRowsToXls, fetchAllAdminRows, formatExportDate } from '../_components/AdminExportButton';
import { AdminTerm } from '../_components/AdminHelpTooltip';
import { AdminInfiniteScroll, appendUniqueById } from '../_components/AdminInfiniteScroll';
import { adminFetch } from '../_components/adminFetch';
import { useAdminRefresh } from '../_components/adminRefresh';
import {
  AdminEventCell,
  AdminPartyCell,
  daysBetween,
  formatKstDateTime,
  formatPhone,
  formatYmd,
  kstToday,
  kstYmd,
  type AdminEvent,
} from '../_components/adminEvent';

/** 환불 가능 기간 — 서버가 cancelPayment 와 같은 함수(refund-policy.ts)로 계산해 준다(완료 결제만) */
type RefundVerdict =
  | { ok: true; day: number; rate: 100 | 50; until: string }
  | { ok: false; day: number; reason: 'event_within_7' | 'expired' };

interface PaymentItem {
  id: string;
  amount: number;
  status: string;
  method?: string | null;
  userName: string | null;
  proName: string | null;
  /** 결제 시 입력받은 연락처 우선, 없으면 계정 번호 */
  customerPhone?: string | null;
  createdAt: string;
  /** 입금일(환불 규정 기준일) — 가상계좌는 입금 확인 시각 */
  paidAt?: string;
  /** 입금일로부터 며칠 지났나(0 = 오늘, KST) */
  elapsedDays?: number;
  event?: AdminEvent;
  refund?: RefundVerdict | null;
  refundAmount?: number | null;
  refundReason?: string | null;
  refundedAt?: string | null;
  settlement?: { status: 'pending' | 'settled' | 'cancelled'; settledAt: string | null } | null;
}

/** 상태 뱃지 색(adm-badge) */
const statusColors: Record<string, string> = {
  completed: 'green',
  waiting_for_deposit: 'orange',
  pending: 'orange',
  failed: 'red',
  refunded: '',
  escrowed: 'blue',
  settled: 'blue',
};

const statusLabels: Record<string, string> = {
  completed: '완료',
  waiting_for_deposit: '입금 대기',
  pending: '대기',
  failed: '실패',
  refunded: '환불',
  escrowed: '보관',
  settled: '정산됨',
};

const SETTLE_LABELS: Record<string, string> = { pending: '정산 대기', settled: '정산 완료', cancelled: '정산 취소' };
const BLOCK_LABELS: Record<string, string> = { expired: '입금 7일 지남', event_within_7: '행사가 입금 7일 이내' };

const paidAtOf = (p: PaymentItem) => p.paidAt || p.createdAt;
/** 입금일로부터 며칠 지났나 — 옛 서버면 결제 시각으로 계산 */
const elapsedOf = (p: PaymentItem) => p.elapsedDays ?? daysBetween(kstYmd(paidAtOf(p)), kstToday());
const elapsedLabel = (n: number) => (n <= 0 ? '오늘' : `${n}일 지남`);

/** 환불 — 지금 고객이 취소하면 몇 %, 언제까지 / 이미 환불된 건 얼마·언제·왜 */
function refundText(p: PaymentItem): { badge: string; tone: string; sub: string } | null {
  if (p.status === 'refunded') {
    const amt = p.refundAmount ?? p.amount;
    const rate = p.amount ? Math.round((amt / p.amount) * 100) : 0;
    const when = p.refundedAt ? ` · ${formatYmd(kstYmd(p.refundedAt))}` : '';
    return { badge: '환불 완료', tone: '', sub: `₩${amt.toLocaleString()}${rate && rate !== 100 ? ` (${rate}%)` : ''}${when}` };
  }
  const r = p.refund;
  if (!r) return null;
  if ('reason' in r) return { badge: '환불 불가', tone: '', sub: BLOCK_LABELS[r.reason] || '' };
  const left = daysBetween(kstToday(), r.until);
  return {
    badge: r.rate === 100 ? '전액 환불 가능' : '50% 환불 가능',
    tone: r.rate === 100 ? 'green' : 'orange',
    sub: left <= 0 ? '오늘까지' : `${formatYmd(r.until)}까지 · ${left}일 남음`,
  };
}

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

      exportRowsToXls('admin-payments', '결제 조회', rows, [
        { header: '순번', value: (_, index) => index + 1 },
        { header: '결제ID', value: (row) => row.id },
        { header: '사회자', value: (row) => row.proName || '' },
        { header: '고객', value: (row) => row.userName || '' },
        { header: '고객연락처', value: (row) => formatPhone(row.customerPhone) },
        { header: '행사', value: (row) => row.event?.title || '' },
        { header: '행사 종류', value: (row) => row.event?.kind || '' },
        { header: '행사일', value: (row) => formatExportDate(row.event?.date) },
        { header: '행사 시간', value: (row) => row.event?.time || '' },
        { header: '행사 장소', value: (row) => row.event?.location || '' },
        { header: '금액', value: (row) => row.amount },
        { header: '결제 수단', value: (row) => row.method || '' },
        { header: '상태', value: (row) => statusLabels[row.status] || row.status },
        { header: '결제일', value: (row) => formatExportDate(paidAtOf(row), true) },
        { header: '경과일', value: (row) => elapsedOf(row) },
        { header: '환불', value: (row) => refundText(row)?.badge || '' },
        { header: '환불 기한·내역', value: (row) => refundText(row)?.sub || '' },
        { header: '환불 사유', value: (row) => row.refundReason || '' },
        { header: '정산', value: (row) => (row.settlement ? SETTLE_LABELS[row.settlement.status] || row.settlement.status : '') },
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

  // 머리 오른쪽 새로고침(종 옆)
  useAdminRefresh(() => fetchPayments(1, filterStatus, dateRange));

  return (
    <div className="space-y-5">
      {/* 도구막대 — 제목은 레이아웃 머리(결제 조회) */}
      {/* 검색·거르기 + 조회기간 = 한 덩어리(261004 사장 '조회기간 섹션이랑 합쳐져야 해') */}
      <div className="adm-filter">
        <div className="adm-toolbar">
          <div className="adm-chips">
            {['전체', 'completed', 'waiting_for_deposit', 'pending', 'failed', 'refunded'].map((st) => (
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
        </div>
        <AdminDateFilter
          value={dateRange}
          onApply={(range) => {
            setDateRange(range);
            setPage(1);
            fetchPayments(1, filterStatus, range);
          }}
        />
      </div>

      <AdminErrorPanel error={lastError} label="결제" />

      {/* 목록 — 정산 내역과 같은 칸(누가 · 어떤 행사를 언제 어디서) + 결제 며칠째 · 지금 환불되나(261004 사장) */}
      <div className="adm-card flush">
        <div className="overflow-x-auto">
          <table className="adm-table">
            <thead>
              <tr>
                <th>사회자 · 고객</th>
                <th>행사</th>
                <th className="r">결제 금액</th>
                <th>결제일</th>
                <th>환불</th>
                <th className="c"><AdminTerm term="상태">상태</AdminTerm></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={6}><div className="adm-skel h-[44px]" /></td></tr>
                ))
              ) : payments.length === 0 ? (
                <tr><td colSpan={6} className="adm-empty">결제 내역이 없어요</td></tr>
              ) : payments.map((payment) => {
                const refund = refundText(payment);
                return (
                  <tr key={payment.id}>
                    <td>
                      <AdminPartyCell pro={payment.proName} customer={payment.userName} phone={payment.customerPhone} />
                    </td>
                    <td className="adm-ev">
                      {payment.event ? <AdminEventCell ev={payment.event} /> : <span className="text-[#D1D6DB]">—</span>}
                    </td>
                    <td className="r">
                      <b className="adm-money text-[16px] text-[#191F28]">₩{Number(payment.amount).toLocaleString()}</b>
                      {payment.method && <span className="adm-cell-sub">{payment.method}</span>}
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="adm-cell-main adm-paid-at">{formatKstDateTime(paidAtOf(payment))}</span>
                      <span className="adm-cell-sub">{elapsedLabel(elapsedOf(payment))}</span>
                    </td>
                    <td className="adm-refund" title={payment.refundReason ? `환불 사유: ${payment.refundReason}` : undefined}>
                      {refund ? (
                        <>
                          <span className={`adm-badge ${refund.tone}`}>{refund.badge}</span>
                          {refund.sub && <span className="adm-cell-sub">{refund.sub}</span>}
                          {payment.status === 'refunded' && payment.refundReason && <span className="adm-cell-sub">{payment.refundReason}</span>}
                        </>
                      ) : (
                        <span className="text-[#D1D6DB]">—</span>
                      )}
                    </td>
                    <td className="c" title={`결제 ID ${payment.id}`}>
                      <span className={`adm-badge ${statusColors[payment.status] || ''}`}>
                        {statusLabels[payment.status] || payment.status}
                      </span>
                      {payment.settlement && payment.status !== 'refunded' && (
                        <span className="adm-cell-sub">{SETTLE_LABELS[payment.settlement.status] || payment.settlement.status}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="adm-table-foot">
          환불 = 플랫폼 환불 규정 제1조 · 입금일(당일 포함) 4일 이내 전액 · 5~7일 50% · 그 뒤엔 불가 · 행사일이 입금 7일 이내면 불가 · 사전미팅을 했으면 불가(시스템은 모름)
        </p>
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
  );
}
