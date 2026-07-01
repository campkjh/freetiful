'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, RefreshCw, MessageSquare, Clock, X, Zap } from 'lucide-react';
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
  firstCustomerAt: string | null;
  firstProReplyAt: string | null;
  responseMs: number | null;
}

interface ConnStats {
  totalConnections: number;
  chatted: number; chatRate: number;
  quoted: number; quoteRate: number;
  paid: number; paidRate: number;
}

interface RespStat { proProfileId: string; proName: string; repliedCount: number; avgSec: number | null; medianSec: number | null; }

interface HistoryMsg { id: string; fromPro: boolean; type: string; content: string | null; fileName: string | null; createdAt: string; }

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

function fmtDuration(ms: number | null): string {
  if (ms == null) return '-';
  const sec = Math.round(ms / 1000);
  if (sec < 60) return '즉시';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}분`;
  const hr = Math.floor(min / 60); const rem = min % 60;
  if (hr < 24) return rem ? `${hr}시간 ${rem}분` : `${hr}시간`;
  const day = Math.floor(hr / 24); const hrem = hr % 24;
  return hrem ? `${day}일 ${hrem}시간` : `${day}일`;
}
const fmtSec = (sec: number | null) => (sec == null ? '-' : fmtDuration(sec * 1000));

// 응답 속도 색상 — 10분 내=초록, 1시간 내=파랑, 6시간 내=주황, 그 외=회색
function respTone(ms: number | null): string {
  if (ms == null) return 'bg-[#F2F4F6] text-[#B0B8C1]';
  const min = ms / 60000;
  if (min <= 10) return 'bg-[#E7F7EE] text-[#16A34A]';
  if (min <= 60) return 'bg-[#EBF2FF] text-[#3182F6]';
  if (min <= 360) return 'bg-[#FFF3E0] text-[#E8850C]';
  return 'bg-[#F2F4F6] text-[#6B7684]';
}

const MSG_TYPE_LABEL: Record<string, string> = { image: '[사진]', video: '[동영상]', file: '[파일]', audio: '[음성]', location: '[위치]', voice: '[음성]' };

export default function ChatConnectionsPage() {
  const [rows, setRows] = useState<ConnRow[]>([]);
  const [stats, setStats] = useState<ConnStats | null>(null);
  const [respStats, setRespStats] = useState<RespStat[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('전체');
  const [dateRange, setDateRange] = useState<AdminDateRange>({ startDate: '', endDate: '' });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastError, setLastError] = useState<AdminErrorInfo | null>(null);

  // 채팅 히스토리 모달
  const [historyRow, setHistoryRow] = useState<ConnRow | null>(null);
  const [historyMsgs, setHistoryMsgs] = useState<HistoryMsg[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  const fetchRespStats = useCallback(async () => {
    try {
      const data = await adminFetch('GET', '/api/v1/admin/chat-response-stats?limit=15', undefined, { cache: false });
      setRespStats(Array.isArray(data?.data) ? data.data : []);
    } catch { setRespStats([]); }
  }, []);

  const openHistory = useCallback(async (row: ConnRow) => {
    setHistoryRow(row);
    setHistoryMsgs(null);
    setHistoryLoading(true);
    try {
      const data = await adminFetch('GET', `/api/v1/admin/chat-connections/${row.id}/messages`, undefined, { cache: false });
      setHistoryMsgs(Array.isArray(data?.messages) ? data.messages : []);
    } catch (e: any) {
      toast.error(`대화 내역 로드 실패: ${extractAdminError(e).message}`);
      setHistoryMsgs([]);
    } finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => { fetchData(1, '', '전체', { startDate: '', endDate: '' }); fetchRespStats(); /* eslint-disable-next-line */ }, []);

  const statCards = stats ? [
    { label: '전체 연결', value: stats.totalConnections.toLocaleString(), sub: '사회자↔유저 채팅방', tone: 'text-[#191F28]' },
    { label: '대화 성사율', value: `${stats.chatRate}%`, sub: `${stats.chatted.toLocaleString()}건 대화 오감`, tone: 'text-[#3182F6]' },
    { label: '견적 전환율', value: `${stats.quoteRate}%`, sub: `${stats.quoted.toLocaleString()}건 견적 발송`, tone: 'text-[#8B5CF6]' },
    { label: '결제 전환율', value: `${stats.paidRate}%`, sub: `${stats.paid.toLocaleString()}건 결제 완료`, tone: 'text-[#16A34A]' },
  ] : [];

  const maxMedian = respStats && respStats.length ? Math.max(...respStats.map((r) => r.medianSec || 0), 1) : 1;

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
          onClick={() => { fetchData(1, search, status, dateRange); fetchRespStats(); }}
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

      {/* 사회자별 응답시간 분석 그래프 (통상 얼마 만에 답장하는지 — 중앙값) */}
      <div className="admin-card-soft p-5">
        <div className="mb-1 flex items-center gap-2">
          <Zap size={16} className="text-[#3182F6]" />
          <h2 className="text-[15px] font-black text-[#191F28]">사회자별 응답 속도</h2>
          <span className="text-[11px] font-medium text-[#8B95A1]">고객 첫 요청 → 사회자 첫 답장 (중앙값, 빠른 순)</span>
        </div>
        {respStats == null ? (
          <div className="py-8 text-center text-[13px] text-[#8B95A1]">불러오는 중…</div>
        ) : respStats.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-[#8B95A1]">응답 데이터가 아직 없습니다</div>
        ) : (
          <div className="mt-3 space-y-2">
            {respStats.map((r) => (
              <div key={r.proProfileId} className="flex items-center gap-3">
                <div className="w-20 shrink-0 truncate text-[12.5px] font-bold text-[#191F28]" title={r.proName}>{r.proName}</div>
                <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-[#F2F4F6]">
                  <div
                    className="h-full rounded-md bg-gradient-to-r from-[#3182F6] to-[#6EA8FF]"
                    style={{ width: `${Math.max(4, Math.round(((r.medianSec || 0) / maxMedian) * 100))}%` }}
                  />
                </div>
                <div className="w-24 shrink-0 text-right text-[12.5px] font-bold text-[#3182F6]">{fmtSec(r.medianSec)}</div>
                <div className="w-16 shrink-0 text-right text-[11px] font-medium text-[#8B95A1]">{r.repliedCount}건</div>
              </div>
            ))}
          </div>
        )}
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

      {/* 연결 목록 (행 클릭 → 대화 내역) */}
      <div className="admin-card-soft overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#EEF1F4] bg-[#FAFBFC] text-[11px] font-bold uppercase tracking-wide text-[#8B95A1]">
                <th className="px-4 py-3">유저</th>
                <th className="px-4 py-3">사회자</th>
                <th className="px-4 py-3">매칭경로</th>
                <th className="px-4 py-3">요청 시각</th>
                <th className="px-4 py-3">답장 시각</th>
                <th className="px-4 py-3 text-center">응답시간</th>
                <th className="px-4 py-3">견적</th>
                <th className="px-4 py-3 text-center">결제</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => openHistory(r)} className="cursor-pointer border-b border-[#F2F4F6] hover:bg-[#F4F8FF]">
                  <td className="px-4 py-3">
                    <span className="font-bold text-[#191F28]">{r.userName}</span>
                    {r.userContact && <p className="text-[11px] text-[#8B95A1]">{r.userContact}</p>}
                  </td>
                  <td className="px-4 py-3 font-bold text-[#191F28]">{r.proName}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${r.fromMatch ? 'bg-[#EBF2FF] text-[#3182F6]' : 'bg-[#F2F4F6] text-[#6B7684]'}`}>
                      {r.fromMatch ? '모두에게' : '1:1문의'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#4E5968]">{fmtDate(r.firstCustomerAt)}</td>
                  <td className="px-4 py-3 text-[12px] text-[#4E5968]">{fmtDate(r.firstProReplyAt)}</td>
                  <td className="px-4 py-3 text-center">
                    {r.responseMs != null
                      ? <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${respTone(r.responseMs)}`}><Clock size={11} />{fmtDuration(r.responseMs)}</span>
                      : <span className="text-[11px] font-semibold text-[#C4CCD4]">{r.twoWay ? '-' : (r.messageCount > 0 ? '무응답' : '대화없음')}</span>}
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

      {/* 대화 내역 모달 */}
      {historyRow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setHistoryRow(null)}>
          <div className="flex max-h-[86vh] w-full max-w-[560px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-[#EEF1F4] px-5 py-4">
              <MessageSquare size={18} className="text-[#3182F6]" />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-black text-[#191F28]">{historyRow.userName} <span className="text-[#B0B8C1]">↔</span> {historyRow.proName}</p>
                <p className="text-[11px] font-medium text-[#8B95A1]">
                  {historyRow.responseMs != null ? `응답시간 ${fmtDuration(historyRow.responseMs)} · ` : ''}메시지 {historyRow.messageCount}개
                </p>
              </div>
              <button onClick={() => setHistoryRow(null)} className="ml-auto rounded-full p-1.5 text-[#8B95A1] hover:bg-[#F2F4F6]"><X size={20} /></button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto bg-[#F7F8FA] px-4 py-4">
              {historyLoading || historyMsgs == null ? (
                <p className="py-16 text-center text-[13px] text-[#8B95A1]">불러오는 중…</p>
              ) : historyMsgs.length === 0 ? (
                <p className="py-16 text-center text-[13px] text-[#8B95A1]">대화 내역이 없습니다</p>
              ) : historyMsgs.map((m) => (
                <div key={m.id} className={`flex ${m.fromPro ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[76%] ${m.fromPro ? 'items-end' : 'items-start'} flex flex-col`}>
                    <span className="mb-0.5 px-1 text-[10px] font-bold text-[#B0B8C1]">{m.fromPro ? historyRow.proName : historyRow.userName}</span>
                    <div className={`rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${m.fromPro ? 'bg-[#3182F6] text-white' : 'bg-white text-[#191F28] shadow-sm'}`}>
                      {m.type === 'text' || m.type === 'system'
                        ? <span className="whitespace-pre-wrap break-words">{m.content}</span>
                        : <span className="font-semibold opacity-90">{MSG_TYPE_LABEL[m.type] || `[${m.type}]`}{m.fileName ? ` ${m.fileName}` : ''}</span>}
                    </div>
                    <span className="mt-0.5 px-1 text-[9.5px] text-[#B0B8C1]">{fmtDate(m.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
