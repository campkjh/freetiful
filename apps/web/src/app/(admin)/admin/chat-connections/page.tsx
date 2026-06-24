'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, RefreshCw, MessageSquare, ArrowLeftRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../_components/ErrorPanel';
import { AdminDateFilter, type AdminDateRange } from '../_components/AdminDateFilter';
import { adminFetch } from '../_components/adminFetch';

interface ConnRow {
  id: string;
  userId: string | null;
  userName: string;
  userContact: string;
  proProfileId: string | null;
  proName: string;
  fromMatch: boolean;
  messageCount: number;
  twoWay: boolean;
  quotationStatus: string | null;
  quotationAmount: number | null;
  paid: boolean;
  createdAt: string;
  lastMessageAt: string | null;
}

interface ConnStats {
  totalConnections: number;
  chatted: number; chatRate: number;
  quoted: number; quoteRate: number;
  paid: number; paidRate: number;
}

const STATUS_TABS: { id: string; label: string }[] = [
  { id: '전체', label: '전체' },
  { id: 'chatted', label: '대화함' },
  { id: 'quoted', label: '견적발송' },
  { id: 'paid', label: '결제완료' },
];

const QUOTE_LABEL: Record<string, string> = {
  pending: '견적대기', accepted: '수락', paid: '결제완료', cancelled: '취소', refunded: '환불', expired: '만료',
};

const LIMIT = 20;

function fmtDate(s: string | null) {
  if (!s) return '-';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function ChatConnectionsPage() {
  const [rows, setRows] = useState<ConnRow[]>([]);
  const [stats, setStats] = useState<ConnStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('전체');
  const [dateRange, setDateRange] = useState<AdminDateRange>({ startDate: '', endDate: '' });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastError, setLastError] = useState<AdminErrorInfo | null>(null);

  const fetchData = useCallback(async (p = 1, s = search, st = status, range = dateRange, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setLastError(null);
    try {
      const params: Record<string, string> = { page: String(p), limit: String(LIMIT) };
      if (s) params.search = s;
      if (st !== '전체') params.status = st;
      if (range.startDate) params.startDate = range.startDate;
      if (range.endDate) params.endDate = range.endDate;
      const data = await adminFetch('GET', `/api/v1/admin/chat-connections?${new URLSearchParams(params).toString()}`, undefined, { cache: false });
      const nextRows: ConnRow[] = Array.isArray(data?.data) ? data.data : [];
      setRows((prev) => (append ? [...prev, ...nextRows] : nextRows));
      setTotal(Number(data?.total ?? nextRows.length));
      if (data?.stats) setStats(data.stats);
      setPage(p);
    } catch (e: any) {
      const err = extractAdminError(e);
      setLastError(err);
      toast.error(`채팅 매칭 로드 실패${err.status ? ` (${err.status})` : ''}: ${err.message}`, { duration: 6000 });
    } finally {
      if (append) setLoadingMore(false); else setLoading(false);
    }
  }, [search, status, dateRange]);

  useEffect(() => { fetchData(1, '', '전체', { startDate: '', endDate: '' }); /* eslint-disable-next-line */ }, []);

  const statCards = stats ? [
    { label: '전체 연결', value: stats.totalConnections.toLocaleString(), sub: '사회자↔유저 채팅방', tone: 'text-[#191F28]' },
    { label: '대화 성사율', value: `${stats.chatRate}%`, sub: `${stats.chatted.toLocaleString()}건 대화 오감`, tone: 'text-[#3182F6]' },
    { label: '견적 전환율', value: `${stats.quoteRate}%`, sub: `${stats.quoted.toLocaleString()}건 견적 발송`, tone: 'text-[#8B5CF6]' },
    { label: '결제 전환율', value: `${stats.paidRate}%`, sub: `${stats.paid.toLocaleString()}건 결제 완료`, tone: 'text-[#16A34A]' },
  ] : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 px-1">
        <Link href="/admin" className="admin-icon-button flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6B7684] shadow-[0_6px_16px_rgba(2,32,71,0.04)] hover:bg-[#F2F4F6]">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <p className="text-[12px] font-bold text-[#3182F6]">매칭 운영</p>
          <h1 className="mt-1 text-[24px] font-black text-[#191F28] tracking-tight">채팅 매칭</h1>
        </div>
        <span className="ml-auto rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-[#6B7684] shadow-[0_6px_16px_rgba(2,32,71,0.04)]">총 {total.toLocaleString()}건</span>
        <button
          onClick={() => fetchData(1, search, status, dateRange)}
          disabled={loading}
          className="admin-icon-button flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6B7684] shadow-[0_6px_16px_rgba(2,32,71,0.04)] hover:bg-[#F2F4F6] disabled:opacity-50"
          title="새로고침"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <AdminErrorPanel error={lastError} label="채팅 매칭" />

      {/* 매칭률 카드 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((c) => (
          <div key={c.label} className="admin-card-soft p-4">
            <p className="text-[12px] font-bold text-[#6B7684]">{c.label}</p>
            <p className={`mt-1.5 text-[26px] font-black tracking-tight ${c.tone}`}>{c.value}</p>
            <p className="mt-0.5 text-[11px] font-medium text-[#8B95A1]">{c.sub}</p>
          </div>
        ))}
        {!stats && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="admin-card-soft h-[104px] animate-pulse bg-[#F2F4F6]" />
        ))}
      </div>

      {/* 검색 + 상태 필터 */}
      <div className="admin-toolbar p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchData(1, search, status, dateRange); } }}
              placeholder="유저 이름·연락처 또는 사회자 이름 (Enter)"
              className="h-11 w-full rounded-2xl border border-[#E5E8EB] bg-[#F7F8FA] pl-9 pr-4 text-sm font-semibold text-[#191F28] placeholder:text-[#B0B8C1] focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            {STATUS_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => { setStatus(t.id); setPage(1); fetchData(1, search, t.id, dateRange); }}
                className={`admin-chip px-3.5 text-sm ${status === t.id ? 'bg-[#191F28] text-white shadow-[0_8px_18px_rgba(25,31,40,0.14)]' : 'bg-[#F2F4F6] text-[#6B7684] hover:bg-[#E5E8EB] hover:text-[#191F28]'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AdminDateFilter
        value={dateRange}
        onApply={(range) => { setDateRange(range); setPage(1); fetchData(1, search, status, range); }}
      />

      {/* 연결 목록 */}
      <div className="admin-card-soft overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#EEF1F4] bg-[#FAFBFC] text-[11px] font-bold uppercase tracking-wide text-[#8B95A1]">
                <th className="px-4 py-3">유저</th>
                <th className="px-4 py-3">사회자</th>
                <th className="px-4 py-3">매칭경로</th>
                <th className="px-4 py-3 text-center">메시지</th>
                <th className="px-4 py-3 text-center">양방향</th>
                <th className="px-4 py-3">견적</th>
                <th className="px-4 py-3 text-center">결제</th>
                <th className="px-4 py-3">최근 대화</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#F2F4F6] hover:bg-[#FAFBFC]">
                  <td className="px-4 py-3">
                    {r.userId ? (
                      <Link href={`/admin/users/${r.userId}`} className="font-bold text-[#191F28] hover:text-[#3182F6]">{r.userName}</Link>
                    ) : <span className="font-bold text-[#191F28]">{r.userName}</span>}
                    {r.userContact && <p className="text-[11px] text-[#8B95A1]">{r.userContact}</p>}
                  </td>
                  <td className="px-4 py-3 font-bold text-[#191F28]">{r.proName}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${r.fromMatch ? 'bg-[#EBF2FF] text-[#3182F6]' : 'bg-[#F2F4F6] text-[#6B7684]'}`}>
                      {r.fromMatch ? '매칭요청' : '직접문의'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 font-semibold text-[#4E5968]">
                      <MessageSquare size={12} className="text-[#B0B8C1]" />{r.messageCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.twoWay
                      ? <span className="inline-flex items-center gap-1 rounded-md bg-[#E7F7EE] px-2 py-0.5 text-[11px] font-bold text-[#16A34A]"><ArrowLeftRight size={11} />성사</span>
                      : <span className="text-[11px] font-semibold text-[#B0B8C1]">{r.messageCount > 0 ? '일방' : '대화없음'}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.quotationStatus
                      ? <span className="font-semibold text-[#4E5968]">{QUOTE_LABEL[r.quotationStatus] || r.quotationStatus}{r.quotationAmount ? ` · ${r.quotationAmount.toLocaleString()}원` : ''}</span>
                      : <span className="text-[#C4CCD4]">-</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.paid
                      ? <span className="rounded-md bg-[#E7F7EE] px-2 py-0.5 text-[11px] font-bold text-[#16A34A]">완료</span>
                      : <span className="text-[#C4CCD4]">-</span>}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#6B7684]">{fmtDate(r.lastMessageAt)}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-[14px] text-[#8B95A1]">연결된 채팅이 없습니다</td></tr>
              )}
              {loading && (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-[14px] text-[#8B95A1]">불러오는 중…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {rows.length < total && (
        <div className="flex justify-center">
          <button
            onClick={() => fetchData(page + 1, search, status, dateRange, true)}
            disabled={loadingMore}
            className="admin-chip bg-white px-6 text-sm font-bold text-[#4E5968] shadow-[0_6px_16px_rgba(2,32,71,0.06)] hover:bg-[#F2F4F6] disabled:opacity-50"
          >
            {loadingMore ? '불러오는 중…' : `더 보기 (${rows.length}/${total.toLocaleString()})`}
          </button>
        </div>
      )}
    </div>
  );
}
