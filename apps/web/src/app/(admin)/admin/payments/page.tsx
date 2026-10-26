'use client';

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../_components/ErrorPanel';
import { AdminDateFilter, type AdminDateRange } from '../_components/AdminDateFilter';
import { AdminExportButton, exportRowsToXls, fetchAllAdminRows, formatExportDate } from '../_components/AdminExportButton';
import { AdminTerm } from '../_components/AdminHelpTooltip';
import { AdminInfiniteScroll, appendUniqueById } from '../_components/AdminInfiniteScroll';
import { adminFetch } from '../_components/adminFetch';
import { useAdminRefresh } from '../_components/adminRefresh';
import { AdminListCard, AdminTableScroll } from '../_components/AdminListCard';
import { RollingNumber } from '../_components/AdminNumber';
import { AdminMoneyCalendar, type MoneySummary } from '../_components/AdminMoneyCalendar';
import { AdminRadioGroup } from '../_components/AdminRadioGroup';
import { AdminSearchField } from '../_components/AdminSearchField';
import { AdminSortMenu, AdminSortTh, type AdminPaySort } from '../_components/AdminSortMenu';
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

/** 상태 거르기 — 라디오 버튼(261005 사장 '탭 말고 라디오 버튼으로') */
const STATUS_OPTIONS = [
  { value: '전체', label: '전체' },
  ...['completed', 'waiting_for_deposit', 'pending', 'failed', 'refunded'].map((st) => ({ value: st, label: statusLabels[st] || st })),
];

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

/** 지금 목록 조건 — 상태 · 조회기간 · 돋보기 · 정렬(261026 운영팀 '검색 · 결제일/예식일 정렬') */
interface PayQuery {
  status: string;
  range: AdminDateRange;
  search: string;
  sort: AdminPaySort;
}

/** 서버 쿼리(목록·엑셀 공용) */
function payParams(q: PayQuery, p: number, limit: number): string {
  const params: Record<string, string> = { page: String(p), limit: String(limit), sort: q.sort };
  if (q.status !== '전체') params.status = q.status;
  if (q.range.startDate) params.startDate = q.range.startDate;
  if (q.range.endDate) params.endDate = q.range.endDate;
  if (q.search) params.search = q.search;
  return new URLSearchParams(params).toString();
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [query, setQuery] = useState<PayQuery>({ status: '전체', range: { startDate: '', endDate: '' }, search: '', sort: 'paid_desc' });
  /** 검색칸에 치는 중인 글자 — Enter 를 눌러야 query.search 로 */
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastError, setLastError] = useState<AdminErrorInfo | null>(null);
  /** 위 달력(홈과 같은 날마다 결제 완료 — 서버 money-summary). 못 받으면 달력만 안 보인다 */
  const [money, setMoney] = useState<MoneySummary | null | 'error'>(null);
  /** 늦게 온 옛 응답이 새 검색 결과를 덮지 않게 — 마지막 요청만 반영 */
  const reqSeq = useRef(0);
  const LIMIT = 20;

  const fetchPayments = async (p: number, q: PayQuery, append = false) => {
    const seq = ++reqSeq.current;
    if (append) setLoadingMore(true);
    else { setLoading(true); setLoadingMore(false); }
    setLastError(null);
    try {
      const data = await adminFetch('GET', `/api/v1/admin/payments?${payParams(q, p, LIMIT)}`);
      if (seq !== reqSeq.current) return;
      const nextPayments = data.data || [];
      setPayments((prev) => append ? appendUniqueById(prev, nextPayments) : nextPayments);
      setTotal(data.total || 0);
      setPage(p);
    } catch (e: any) {
      if (seq !== reqSeq.current) return;
      const err = extractAdminError(e);
      setLastError(err);
      toast.error(`결제 목록 로드 실패${err.status ? ` (${err.status})` : ''}: ${err.message}`, { duration: 6000 });
    } finally {
      if (seq === reqSeq.current) {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    }
  };

  /** 조건 하나 바꾸고 첫 페이지부터 다시 — 검색칸에 쳐 둔 글자도 같이(Enter 를 안 눌렀어도 목록·건수·엑셀이 칸과 어긋나지 않게) */
  const applyQuery = (patch: Partial<PayQuery>) => {
    const next = { ...query, search: searchInput.trim(), ...patch };
    if (next.search !== searchInput) setSearchInput(next.search);
    setQuery(next);
    setPage(1);
    fetchPayments(1, next);
  };

  const fetchMoney = async () => {
    try {
      const d: any = await adminFetch('GET', '/api/v1/admin/money-summary', undefined, { cache: false });
      setMoney(Array.isArray(d?.daily) && d?.today ? d : 'error');
    } catch {
      setMoney('error');
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchPayments(1, query); fetchMoney(); }, []);

  // 달력 날짜 누름 = 그날 결제만(조회기간 그날~그날). 고른 날을 다시 누르면 전체로
  const pickedDay = query.range.startDate && query.range.startDate === query.range.endDate ? query.range.startDate : null;
  const pickDay = (day: string) => {
    applyQuery({ range: pickedDay === day ? { startDate: '', endDate: '' } : { startDate: day, endDate: day } });
  };
  const monthIncome = money && money !== 'error' ? money.daily.filter((d) => d.date.startsWith(money.thisMonth)).reduce((a, d) => a + d.income, 0) : 0;
  const monthNo = money && money !== 'error' ? Number(money.thisMonth.split('-')[1]) : null;

  const handleExport = async () => {
    setExporting(true);
    try {
      // 화면과 같은 조건·순서(검색·정렬 포함) — 검색칸에 쳐 두고 Enter 를 안 눌렀으면 목록도 그 검색으로 맞춘다
      const q = { ...query, search: searchInput.trim() };
      if (q.search !== query.search) applyQuery({});
      const rows = await fetchAllAdminRows<PaymentItem>({
        fetchPage: async (p, limit) => {
          const data = await adminFetch('GET', `/api/v1/admin/payments?${payParams(q, p, limit)}`, undefined, { cache: false });
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
  useAdminRefresh(() => { fetchPayments(1, query); fetchMoney(); });

  return (
    <div className="space-y-5">
      {/* 위 달력 — 홈처럼 이번 주(⌄ 이번 달) 날마다 결제 완료 금액. 날짜를 누르면 아래 표가 그날 결제만(261005 사장 '결제 조회도 상단에 달력') */}
      {money === null ? (
        <div className="adm-paycal-skel" aria-hidden="true" />
      ) : money !== 'error' ? (
        <section className="adm-moneyblock adm-paycal" aria-label="날마다 결제 완료">
          <div className="adm-paycal-head">
            <div className="min-w-0">
              <p className="adm-money-label">{monthNo}월 결제 완료</p>
              <p className="adm-money-value"><RollingNumber value={monthIncome} />원</p>
            </div>
            <p className={`adm-paycal-hint ${pickedDay ? 'on' : ''}`}>
              {pickedDay
                ? <>{Number(pickedDay.slice(5, 7))}월 {Number(pickedDay.slice(8, 10))}일 결제만 보는 중 · 다시 누르면 전체</>
                : '날짜를 누르면 그날 결제만 봐요'}
            </p>
          </div>
          <AdminMoneyCalendar data={money} selected={pickedDay} onPick={pickDay} />
        </section>
      ) : null}

      <AdminErrorPanel error={lastError} label="결제" />

      {/* 거르기·조회기간 + 결제 표 = 한 카드(261005 사장 '테이블이랑 필터링 패널이랑 합쳐줘').
          목록 = 정산 내역과 같은 칸(누가 · 어떤 행사를 언제 어디서) + 결제 며칠째 · 지금 환불되나(261004 사장) */}
      <AdminListCard
        filter={<>
          {/* 돋보기 + 정렬(261026 운영팀 — 채팅 매칭에서 고객을 찾아 날짜를 알아낸 뒤 결제 조회에서 일일이 찾던 것) */}
          <div className="adm-toolbar adm-toolbar-search">
            <AdminSearchField
              className="grow"
              value={searchInput}
              onChange={setSearchInput}
              onSubmit={(v) => applyQuery({ search: v.trim() })}
              placeholder="고객·사회자 이름, 연락처, 행사로 찾기"
            />
            <AdminSortMenu value={query.sort} onChange={(sort) => applyQuery({ sort })} />
          </div>
          <div className="adm-toolbar adm-toolbar-sub">
            <AdminRadioGroup
              value={query.status}
              options={STATUS_OPTIONS}
              ariaLabel="결제 상태"
              onChange={(status) => applyQuery({ status })}
            />
            <span className="grow" />
            <span className="adm-count">총 <b><RollingNumber value={total} /></b>건 · <b>₩<RollingNumber value={visibleAmount} /></b></span>
            <AdminExportButton loading={exporting} onClick={handleExport} />
          </div>
          <AdminDateFilter value={query.range} onApply={(range) => applyQuery({ range })} />
        </>}
      >
        <AdminTableScroll>
          <table className="adm-table">
            <thead>
              <tr>
                <th>사회자 · 고객</th>
                <AdminSortTh field="event" value={query.sort} onChange={(sort) => applyQuery({ sort })}>행사</AdminSortTh>
                <th className="r">결제 금액</th>
                <AdminSortTh field="paid" value={query.sort} onChange={(sort) => applyQuery({ sort })}>결제일</AdminSortTh>
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
                <tr><td colSpan={6} className="adm-empty">
                  {query.search ? `'${query.search}'에 맞는 결제가 없어요` : '결제 내역이 없어요'}
                  {/* 상태·기간(달력 날짜 포함)에 걸려 비었으면 — 풀고 같은 검색어로 */}
                  {query.search && (query.status !== '전체' || query.range.startDate || query.range.endDate) && (
                    <button type="button" className="adm-btn sm adm-empty-act" onClick={() => applyQuery({ status: '전체', range: { startDate: '', endDate: '' } })}>
                      전체에서 다시 찾기
                    </button>
                  )}
                </td></tr>
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
        </AdminTableScroll>
        <p className="adm-table-foot">
          환불 = 플랫폼 환불 규정 제1조 · 입금일(당일 포함) 4일 이내 전액 · 5~7일 50% · 그 뒤엔 불가 · 행사일이 입금 7일 이내면 불가 · 사전미팅을 했으면 불가(시스템은 모름)
        </p>

        <AdminInfiniteScroll
          hasMore={hasMore}
          loading={loadingMore}
          loaded={payments.length}
          total={total}
          onLoadMore={() => {
            if (!hasMore || loading || loadingMore) return;
            fetchPayments(page + 1, query, true);
          }}
        />
      </AdminListCard>
    </div>
  );
}
