'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  matchType: 'multi' | 'single';
  eventLabel: string | null;
  eventDate: string | null;
  eventTime: string | null;
  eventLocation: string | null;
  messageCount: number;
  twoWay: boolean;
  quotationStatus: string | null;
  quotationAmount: number | null;
  paid: boolean;
  createdAt: string;
  lastMessageAt: string | null;
  firstCustomerAt: string | null;
  firstProReplyAt: string | null;
  matchStatus: string | null;
  responseMs: number | null;
}

interface ConnStats {
  totalConnections: number;
  chatted: number; chatRate: number;
  quoted: number; quoteRate: number;
  paid: number; paidRate: number;
}

interface RespStat { proProfileId: string; proName: string; totalRooms: number; responded: number; declined: number; notResponded: number; repliedCount: number; avgSec: number | null; medianSec: number | null; }

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

// 행사일: '몇월 몇일'(+시간) — 고객이 입력한 DB값 그대로. eventDate는 @db.Date 라 UTC 자정 → KST 변환 시 하루 밀리지 않게 UTC 필드 사용.
function fmtEventDate(s: string | null, time: string | null): string {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const md = `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
  if (time) {
    const t = new Date(time);
    if (!Number.isNaN(t.getTime())) return `${md} ${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
  }
  return md;
}

// 응답 속도 등급 (중앙값 기준): 5분↓ 최고 / 20분↓ 양호 / 30분↓ 관심 / 1시간↓ 유저이탈 / 2시간↓ 주의 / 그이상 단도리
function respGrade(sec: number | null): { label: string; hex: string } {
  if (sec == null) return { label: '-', hex: '#B0B8C1' };
  const min = sec / 60;
  if (min < 5) return { label: '최고', hex: '#16A34A' };
  if (min < 20) return { label: '양호', hex: '#0EA5E9' };
  if (min < 30) return { label: '관심', hex: '#EAB308' };
  if (min < 60) return { label: '유저이탈', hex: '#F97316' };
  if (min < 120) return { label: '주의', hex: '#EF4444' };
  return { label: '단도리', hex: '#B91C1C' };
}
const GRADE_LEGEND = [
  { label: '최고', sub: '5분↓', hex: '#16A34A' },
  { label: '양호', sub: '20분↓', hex: '#0EA5E9' },
  { label: '관심', sub: '30분↓', hex: '#EAB308' },
  { label: '유저이탈', sub: '1시간↓', hex: '#F97316' },
  { label: '주의', sub: '2시간↓', hex: '#EF4444' },
  { label: '단도리', sub: '2시간↑', hex: '#B91C1C' },
];

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

  // 대화 팝업 열릴 때: ESC 로 닫기 + 배경 스크롤 잠금
  useEffect(() => {
    if (!historyRow) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setHistoryRow(null); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [historyRow]);

  useEffect(() => { fetchData(1, '', '전체', { startDate: '', endDate: '' }); fetchRespStats(); /* eslint-disable-next-line */ }, []);

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
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Zap size={16} className="text-[#3182F6]" />
          <h2 className="text-[15px] font-black text-[#191F28]">사회자별 응답 현황</h2>
          <span className="text-[11px] font-medium text-[#8B95A1]">매칭의뢰 도착 → 답장 기준 · 응답률 + 통상 응답시간(중앙값) · 요청 많은 순</span>
        </div>
        {/* 등급 범례 */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {GRADE_LEGEND.map((g) => (
            <span key={g.label} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-bold" style={{ color: g.hex, backgroundColor: g.hex + '1a' }}>
              {g.label}<span className="font-medium opacity-70">{g.sub}</span>
            </span>
          ))}
        </div>
        {respStats == null ? (
          <div className="py-8 text-center text-[13px] text-[#8B95A1]">불러오는 중…</div>
        ) : respStats.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-[#8B95A1]">응답 데이터가 아직 없습니다</div>
        ) : (
          <div className="mt-1 space-y-2">
            {/* 컬럼 헤더 */}
            <div className="flex items-center gap-2.5 px-0.5 text-[10px] font-bold text-[#B0B8C1]">
              <div className="w-16 shrink-0">사회자</div>
              <div className="flex-1">응답률 (응답 / 요청)</div>
              <div className="w-[150px] shrink-0 text-right">거절 · 미응답</div>
              <div className="w-16 shrink-0 text-right">응답시간</div>
              <div className="w-[66px] shrink-0 text-center">등급</div>
            </div>
            {respStats.map((r) => {
              const g = respGrade(r.medianSec);
              const rate = r.totalRooms ? Math.round((r.responded / r.totalRooms) * 100) : 0;
              const ignored = Math.max(0, r.notResponded - (r.declined || 0));
              return (
                <div key={r.proProfileId} className="flex items-center gap-2.5">
                  <div className="w-16 shrink-0 truncate text-[12.5px] font-bold text-[#191F28]" title={r.proName}>{r.proName}</div>
                  <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-[#F2F4F6]">
                    <div className="h-full rounded-md bg-[#3182F6] transition-all" style={{ width: `${Math.max(rate === 0 ? 0 : 6, rate)}%` }} />
                    <span className="absolute inset-0 flex items-center px-2 text-[10.5px] font-bold text-[#191F28]">
                      응답 {r.responded}/{r.totalRooms} · {rate}%
                    </span>
                  </div>
                  <div className="flex w-[150px] shrink-0 items-center justify-end gap-1 text-[10.5px] font-bold">
                    <span className="rounded px-1.5 py-0.5" style={{ color: '#B45309', backgroundColor: '#FEF3C7' }}>거절 {r.declined || 0}</span>
                    <span className="rounded px-1.5 py-0.5" style={{ color: ignored > 0 ? '#B91C1C' : '#B0B8C1', backgroundColor: ignored > 0 ? '#FEE2E2' : '#F2F4F6' }}>무응답 {ignored}</span>
                  </div>
                  <div className="w-16 shrink-0 text-right text-[12.5px] font-bold" style={{ color: g.hex }}>{fmtSec(r.medianSec)}</div>
                  <div className="w-[66px] shrink-0 text-center">
                    <span className="rounded-md px-2 py-0.5 text-[11px] font-black" style={{ color: g.hex, backgroundColor: g.hex + '1a' }}>{g.label}</span>
                  </div>
                </div>
              );
            })}
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
          <table className="w-full min-w-[1150px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#EEF1F4] bg-[#FAFBFC] text-[11px] font-bold uppercase tracking-wide text-[#8B95A1]">
                <th className="px-4 py-3">유저</th>
                <th className="px-4 py-3">사회자</th>
                <th className="px-4 py-3">문의유형</th>
                <th className="px-4 py-3">행사 정보</th>
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
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${r.matchType === 'multi' ? 'bg-[#EBF2FF] text-[#3182F6]' : 'bg-[#FFF1E9] text-[#F97316]'}`}>
                      {r.matchType === 'multi' ? '모두에게' : '1:1문의'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.eventDate || r.eventLabel ? (
                      <div className="text-[12px] leading-tight">
                        <span className="font-bold text-[#191F28]">{fmtEventDate(r.eventDate, r.eventTime) || '날짜미정'}</span>
                        {r.eventLabel && <span className="ml-1 text-[#6B7684]">· {r.eventLabel}</span>}
                        {r.eventLocation && <p className="text-[11px] text-[#8B95A1]">{r.eventLocation}</p>}
                      </div>
                    ) : <span className="text-[#C4CCD4]">-</span>}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#4E5968]">{fmtDate(r.firstCustomerAt || r.createdAt)}</td>
                  <td className="px-4 py-3 text-[12px] text-[#4E5968]">{fmtDate(r.firstProReplyAt)}</td>
                  <td className="px-4 py-3 text-center">
                    {r.responseMs != null
                      ? (() => { const g = respGrade(r.responseMs / 1000); return (
                          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ color: g.hex, backgroundColor: g.hex + '1a' }}>
                            <Clock size={11} />{fmtDuration(r.responseMs)} · {g.label}
                          </span>
                        ); })()
                      : r.matchStatus === 'declined'
                        ? <span className="rounded-md bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-bold text-[#B45309]">거절</span>
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

      {/* 대화 내역 — 전체 팝업 (document.body 로 포털: 어드민 레이아웃 밖에서 화면 전체 오버레이) */}
      {historyRow && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-stretch justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => setHistoryRow(null)}>
          <div
            className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[90vh] sm:max-w-[860px] sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-start gap-3 border-b border-[#EEF1F4] px-5 py-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
              <MessageSquare size={20} className="mt-0.5 shrink-0 text-[#3182F6]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-black text-[#191F28]">
                  {historyRow.userName} <span className="text-[#B0B8C1]">↔</span> {historyRow.proName}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-medium text-[#8B95A1]">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${historyRow.matchType === 'multi' ? 'bg-[#EBF2FF] text-[#3182F6]' : 'bg-[#FFF1E9] text-[#F97316]'}`}>
                    {historyRow.matchType === 'multi' ? '모두에게' : '1:1문의'}
                  </span>
                  {(historyRow.eventDate || historyRow.eventLabel) && (
                    <span>{fmtEventDate(historyRow.eventDate, historyRow.eventTime)}{historyRow.eventLabel ? ` · ${historyRow.eventLabel}` : ''}</span>
                  )}
                  {historyRow.responseMs != null && <span>· 응답 {fmtDuration(historyRow.responseMs)}</span>}
                  {historyRow.quotationAmount != null && <span>· 견적 {historyRow.quotationAmount.toLocaleString()}원</span>}
                  <span>· 메시지 {historyRow.messageCount}개</span>
                </div>
              </div>
              <button onClick={() => setHistoryRow(null)} className="-mr-1 shrink-0 rounded-full p-2 text-[#8B95A1] transition hover:bg-[#F2F4F6]" aria-label="닫기"><X size={22} /></button>
            </div>
            {/* 대화 */}
            <div className="flex-1 space-y-3 overflow-y-auto bg-[#F7F8FA] px-4 py-5 sm:px-6" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
              {historyLoading || historyMsgs == null ? (
                <p className="py-20 text-center text-[14px] text-[#8B95A1]">불러오는 중…</p>
              ) : historyMsgs.length === 0 ? (
                <p className="py-20 text-center text-[14px] text-[#8B95A1]">대화 내역이 없습니다</p>
              ) : historyMsgs.map((m) => (
                <div key={m.id} className={`flex ${m.fromPro ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex max-w-[80%] flex-col ${m.fromPro ? 'items-end' : 'items-start'}`}>
                    <span className="mb-1 px-1 text-[11px] font-bold text-[#8B95A1]">{m.fromPro ? historyRow.proName : historyRow.userName}</span>
                    <div className={`rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${m.fromPro ? 'bg-[#3182F6] text-white' : 'bg-white text-[#191F28] shadow-sm'}`}>
                      {m.type === 'text' || m.type === 'system'
                        ? <span className="whitespace-pre-wrap break-words">{m.content}</span>
                        : <span className="font-semibold opacity-90">{MSG_TYPE_LABEL[m.type] || `[${m.type}]`}{m.fileName ? ` ${m.fileName}` : ''}</span>}
                    </div>
                    <span className="mt-1 px-1 text-[10.5px] text-[#B0B8C1]">{fmtDate(m.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
