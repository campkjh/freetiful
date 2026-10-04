'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, Clock } from '@/app/(admin)/admin/_components/admin-icons';
import toast from 'react-hot-toast';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../_components/ErrorPanel';
import { AdminDateFilter, type AdminDateRange } from '../_components/AdminDateFilter';
import { adminFetch } from '../_components/adminFetch';
import BubbleTail, { TAIL_CORNER_CLASS } from '@/components/chat/BubbleTail';
import { useAdminRefresh } from '../_components/adminRefresh';

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

interface RespStat { proProfileId: string; proName: string; totalRooms: number; responded: number; declined: number; notResponded: number; repliedCount: number; quickCount?: number; quickRate?: number | null; avgSec: number | null; medianSec: number | null; category?: 'good' | 'attention'; hasData?: boolean; }

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

/* 대화 내역 = 앱 채팅방(chat/[id]) 그대로(261004 사장 '채팅창 UI 앱 채팅이랑 완전 동일하게') —
 *  사회자 말 = 오른쪽 파랑(#3180F7, 사회자 입장에서 보는 방), 고객 말 = 왼쪽 회색(#F2F3F5) + 묶음 첫 줄에 프사,
 *  같은 사람이 3분 안에 이어 보내면 한 묶음(꼬리는 묶음 마지막에만), 시간은 같은 분의 마지막 줄에만, 하루 바뀌면 날짜 줄 */
const kstDayKey = (d: string) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
const bubbleTime = (d: string) => new Date(d).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Seoul' });
const minuteKey = (d: string) => `${kstDayKey(d)} ${bubbleTime(d)}`;
const dateDivider = (d: string) => { const [y, m, dd] = kstDayKey(d).split('-'); return `${Number(y)}년 ${Number(m)}월 ${Number(dd)}일`; };

const MSG_TYPE_LABEL: Record<string, string> = { image: '[사진]', video: '[동영상]', file: '[파일]', audio: '[음성]', location: '[위치]', voice: '[음성]' };

export default function ChatConnectionsPage() {
  const [rows, setRows] = useState<ConnRow[]>([]);
  const [stats, setStats] = useState<ConnStats | null>(null);
  const [respStats, setRespStats] = useState<RespStat[] | null>(null);
  /** 응답 현황 — 평소엔 접어 두고 한 줄 요약만(261004 사장 '접어줘') */
  const [respOpen, setRespOpen] = useState(false);
  const respGroups = useMemo(() => {
    if (!respStats) return null;
    const isGood = (r: RespStat) => (r.category ? r.category === 'good' : (r.medianSec != null && r.medianSec <= 300));
    // 통상 답장시간(median) 빠른 순 → 빨리 답장하는 사회자가 위로. 답장이력 없으면 맨 뒤.
    const byMedian = (a: RespStat, b: RespStat) => {
      const ma = a.medianSec ?? Infinity, mb = b.medianSec ?? Infinity;
      if (ma !== mb) return ma - mb;
      return (b.repliedCount ?? 0) - (a.repliedCount ?? 0);
    };
    return {
      good: respStats.filter(isGood).sort(byMedian),
      attention: respStats.filter((r) => !isGood(r)).sort(byMedian),
      // 요청은 받았는데 답장이 하나도 없는 사회자 = '갈리오<'(사장 표기)
      galio: respStats.filter((r) => r.repliedCount === 0 && r.totalRooms > 0).length,
    };
  }, [respStats]);
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

  // 머리 오른쪽 새로고침(종 옆) — 목록 + 응답 현황
  useAdminRefresh(() => { fetchData(1, search, status, dateRange); fetchRespStats(); });

  return (
    <div className="space-y-5">
      {/* 도구막대 — 제목은 레이아웃 머리(채팅 매칭) */}
      <div className="adm-toolbar">
        <label className="adm-search grow">
          <Search size={17} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchData(1, search, status, dateRange); } }}
            placeholder="고객 이름·연락처 또는 사회자 이름 (Enter)"
            className="adm-input"
          />
        </label>
        <div className="adm-chips">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setStatus(t.id); setPage(1); fetchData(1, search, t.id, dateRange); }}
              className={`adm-chip ${status === t.id ? 'on' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="adm-count">총 <b>{total.toLocaleString()}</b>건</span>
      </div>

      <AdminErrorPanel error={lastError} label="채팅 매칭" />

      {/* 매칭률 카드 */}
      <div className="adm-grid adm-rise grid-cols-2 lg:grid-cols-4">
        {statCards.map((c) => (
          <div key={c.label} className="adm-stat">
            <p className="adm-stat-label">{c.label}</p>
            <p className={`adm-stat-value ${c.tone}`}>{c.value}</p>
            <p className="adm-stat-sub">{c.sub}</p>
          </div>
        ))}
        {!stats && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="adm-skel h-[118px] rounded-[20px]" />
        ))}
      </div>

      {/* 사회자별 응답 현황 — 평균 5분 기준 2분류(잘하고 있음 / 단도리), 승인된 전 사회자. 접어 두고 머리를 누르면 펼친다 */}
      <div className="adm-card">
        <button type="button" className="adm-resp-head" onClick={() => setRespOpen((v) => !v)} aria-expanded={respOpen}>
          <span className="min-w-0 flex-1">
            <span className="adm-card-title block">사회자별 응답 현황</span>
            <span className="adm-card-sub block">최근 1주일 · 견적 도착→답장 <b>통상 시간(median)</b> 5분 기준 · 승인된 전 사회자</span>
          </span>
          {respGroups && (
            <span className="adm-resp-sum">
              <span className="adm-badge green">잘하고 있음 {respGroups.good.length}</span>
              <span className="adm-badge red">단도리 필요 {respGroups.attention.length}</span>
              {respGroups.galio > 0 && <span className="adm-badge">갈리오&lt; {respGroups.galio}</span>}
            </span>
          )}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`adm-resp-chev ${respOpen ? 'on' : ''}`}>
            <path d="M6 9l6 6 6-6" stroke="#8B95A1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {respOpen && (
          <div className="adm-resp-body">
            {respGroups == null ? (
              <div className="py-8 text-center text-[13px] text-[#8B95A1]">불러오는 중…</div>
            ) : respGroups.good.length + respGroups.attention.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-[#8B95A1]">승인된 사회자가 없어요</div>
            ) : (() => {
              const Card = ({ r, tone }: { r: RespStat; tone: 'good' | 'attention' }) => (
                <div className="flex flex-col rounded-[12px] bg-white px-3 py-2.5">
                  <span className="truncate text-[12.5px] font-bold text-[#191F28]" title={r.proName}>{r.proName}</span>
                  <span className="mt-0.5 text-[11px] font-bold" style={{ color: tone === 'good' ? '#0E9F6E' : '#E02424' }}>
                    {r.repliedCount === 0
                      ? (r.totalRooms === 0
                        ? <span className="font-medium text-[#B0B8C1]">요청 없음</span>
                        : <span className="font-bold text-[#6B7684]">갈리오&lt;</span>)
                      : <>보통 {fmtSec(r.medianSec)}<span className="font-medium opacity-60"> · {r.repliedCount}건</span></>}
                  </span>
                </div>
              );
              const Grid = ({ items, tone, empty }: { items: RespStat[]; tone: 'good' | 'attention'; empty: string }) => (
                items.length === 0
                  ? <p className="py-4 text-center text-[12px] opacity-60">{empty}</p>
                  : <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">{items.map((r) => <Card key={r.proProfileId} r={r} tone={tone} />)}</div>
              );
              return (
                <div className="space-y-3">
                  {/* 잘하고 있음 */}
                  <div className="rounded-[16px] bg-[#E5F8EF] p-3.5">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-[14px] font-bold text-emerald-700">잘하고 있음</span>
                      <span className="text-[12px] font-bold text-emerald-600">{respGroups.good.length}명</span>
                      <span className="text-[11px] font-medium text-emerald-500/70">통상 답장 5분 이내</span>
                    </div>
                    <div className="text-emerald-700"><Grid items={respGroups.good} tone="good" empty="아직 없음" /></div>
                  </div>
                  {/* 단도리 */}
                  <div className="rounded-[16px] bg-[#FFEEEF] p-3.5">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-[14px] font-bold text-red-700">단도리 필요</span>
                      <span className="text-[12px] font-bold text-red-600">{respGroups.attention.length}명</span>
                      <span className="text-[11px] font-medium text-red-500/70">통상 답장 5분 초과 · 갈리오&lt;(답장 없음)</span>
                    </div>
                    <div className="text-red-700"><Grid items={respGroups.attention} tone="attention" empty="아직 없음" /></div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <AdminDateFilter
        value={dateRange}
        onApply={(range) => { setDateRange(range); setPage(1); fetchData(1, search, status, range); }}
      />

      {/* 연결 목록 (행 클릭 → 대화 내역) */}
      <div className="adm-card flush">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left">
            <thead>
              <tr>
                <th className="px-4 py-3">고객</th>
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
                <tr key={r.id} onClick={() => openHistory(r)} className="cursor-pointer">
                  <td className="px-4 py-3">
                    <span className="adm-cell-main">{r.userName}</span>
                    {r.userContact && <span className="adm-cell-sub">{r.userContact}</span>}
                  </td>
                  <td className="px-4 py-3"><span className="adm-cell-main">{r.proName}</span></td>
                  <td className="px-4 py-3">
                    <span className={`adm-badge ${r.matchType === 'multi' ? 'blue' : 'orange'}`}>
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
                      ? <span className="adm-badge green">완료</span>
                      : <span className="text-[#C4CCD4]">-</span>}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={9} className="adm-empty">연결된 채팅이 없어요</td></tr>
              )}
              {loading && (
                <tr><td colSpan={9} className="px-4 py-4"><div className="adm-skel h-[44px]" /></td></tr>
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
            className="adm-btn bg-white px-6"
          >
            {loadingMore ? '불러오는 중…' : `더 보기 (${rows.length}/${total.toLocaleString()})`}
          </button>
        </div>
      )}

      {/* 대화 내역 — 앱 채팅방과 같은 화면(document.body 포털: 어드민 레이아웃 밖에서 화면 전체 오버레이) */}
      {historyRow && typeof document !== 'undefined' && createPortal(
        <div className="adm-pop-dim fixed inset-0 z-[9999] flex items-stretch justify-center bg-black/45 sm:items-center sm:p-6" onClick={() => setHistoryRow(null)}>
          <div
            className="adm-pop flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[88vh] sm:max-w-[680px] sm:rounded-[28px]"
            style={{ letterSpacing: '-0.02em' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 머리 — 앱 채팅방처럼: ‹ 닫기 · 가운데 이름 + 알약 / 부제(행사) · 오른쪽 빈칸 */}
            <div className="relative flex h-14 shrink-0 items-center px-1" style={{ marginTop: 'env(safe-area-inset-top)' }}>
              <button
                type="button"
                onClick={() => setHistoryRow(null)}
                aria-label="닫기"
                className="relative z-[1] flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#191F28] transition-colors hover:bg-[#F7F8FA] active:bg-[#F2F3F5]"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" stroke="#191F28" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="absolute left-1/2 top-1/2 flex max-w-[66%] -translate-x-1/2 -translate-y-1/2 flex-col items-center leading-tight">
                <span className="flex min-w-0 max-w-full items-center gap-1.5">
                  <span className="truncate text-[17px] font-bold text-[#191F28]">{historyRow.userName}</span>
                  <span className="shrink-0 rounded-full bg-[#E8F3FF] px-2 py-[2px] text-[12.5px] font-bold text-[#3182F6]">고객</span>
                  <span className="shrink-0 text-[13px] text-[#B0B8C1]">↔</span>
                  <span className="truncate text-[17px] font-bold text-[#191F28]">{historyRow.proName}</span>
                </span>
                <span className="mt-[3px] max-w-full truncate text-[12.5px] text-[#8B95A1]">
                  {[
                    historyRow.matchType === 'multi' ? '모두에게' : '1:1문의',
                    fmtEventDate(historyRow.eventDate, historyRow.eventTime) || null,
                    historyRow.eventLabel,
                    historyRow.eventLocation,
                  ].filter(Boolean).join(' · ')}
                </span>
              </div>
              <span className="ml-auto w-11 shrink-0" aria-hidden="true" />
            </div>
            {/* 요약 줄 — 응답 · 견적 · 메시지 수 */}
            <div className="flex shrink-0 flex-wrap items-center justify-center gap-1.5 border-b border-[#F2F4F6] px-4 pb-3">
              {historyRow.responseMs != null && <span className="rounded-full bg-[#F2F4F6] px-2.5 py-1 text-[12.5px] font-semibold text-[#4E5968]">응답 {fmtDuration(historyRow.responseMs)}</span>}
              {historyRow.quotationAmount != null && <span className="rounded-full bg-[#F2F4F6] px-2.5 py-1 text-[12.5px] font-semibold text-[#4E5968]">견적 {historyRow.quotationAmount.toLocaleString()}원</span>}
              <span className="rounded-full bg-[#F2F4F6] px-2.5 py-1 text-[12.5px] font-semibold text-[#4E5968]">메시지 {historyRow.messageCount}개</span>
            </div>
            {/* 대화 */}
            <div className="flex-1 overflow-y-auto bg-white px-4 pb-6" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
              {historyLoading || historyMsgs == null ? (
                <p className="py-20 text-center text-[15px] text-[#8B95A1]">불러오는 중…</p>
              ) : historyMsgs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/default-profile.svg" alt="" className="mb-3 h-16 w-16 rounded-full object-cover" />
                  <p className="text-[15px] font-bold text-[#191F28]">{historyRow.userName}</p>
                  <p className="mt-1 text-[13px] text-[#B0B8C1]">아직 오간 대화가 없어요</p>
                </div>
              ) : historyMsgs.map((m, i) => {
                const prev = i > 0 ? historyMsgs[i - 1] : null;
                const next = historyMsgs[i + 1] || null;
                const showDate = !prev || kstDayKey(prev.createdAt) !== kstDayKey(m.createdAt);
                if (m.type === 'system') {
                  return (
                    <div key={m.id}>
                      {showDate && <div className="py-4 text-center"><span className="text-[13px] text-[#8B95A1]">{dateDivider(m.createdAt)}</span></div>}
                      <div className="my-2 flex justify-center">
                        <span className="max-w-[86%] whitespace-pre-wrap break-words rounded-[14px] bg-[#F7F8FA] px-3.5 py-2 text-center text-[13px] leading-[1.5] text-[#6B7684]">{m.content}</span>
                      </div>
                    </div>
                  );
                }
                const mine = m.fromPro;
                const same = (x: HistoryMsg | null) => !!x && x.type !== 'system' && x.fromPro === m.fromPro;
                const nextDayChange = !!next && kstDayKey(next.createdAt) !== kstDayKey(m.createdAt);
                const groupStart = showDate || !same(prev) || (!!prev && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > 3 * 60 * 1000);
                const groupEnd = !same(next) || nextDayChange || new Date(next!.createdAt).getTime() - new Date(m.createdAt).getTime() > 3 * 60 * 1000;
                const showTime = !same(next) || minuteKey(next!.createdAt) !== minuteKey(m.createdAt);
                const media = m.type === 'image' || m.type === 'video';
                const tailed = groupEnd && !media;
                const tailCorner = tailed ? ` ${mine ? TAIL_CORNER_CLASS.mine : TAIL_CORNER_CLASS.other}` : '';
                return (
                  <div key={m.id}>
                    {showDate && <div className="py-4 text-center"><span className="text-[13px] text-[#8B95A1]">{dateDivider(m.createdAt)}</span></div>}
                    <div className={`relative flex ${mine ? 'justify-end' : 'justify-start'} ${groupStart && i > 0 ? 'mt-3.5' : 'mt-1'}`}>
                      {!mine && (groupStart ? (
                        <span className="mr-2 h-10 w-10 shrink-0 self-start overflow-hidden rounded-full bg-[#F2F3F5]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/images/default-profile.svg" alt="" className="h-full w-full object-cover" />
                        </span>
                      ) : (
                        <span className="mr-2 w-10 shrink-0" aria-hidden="true" />
                      ))}
                      <div className={`flex min-w-0 max-w-[78%] items-end gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
                        <div className="relative min-w-0">
                          {/* 묶음 첫 줄 위에 보낸 사람 이름(관리자는 두 사람을 다 보므로) */}
                          {groupStart && <p className={`mb-1 px-1 text-[12px] font-semibold text-[#8B95A1] ${mine ? 'text-right' : ''}`}>{mine ? historyRow.proName : historyRow.userName}</p>}
                          {m.type === 'image' && m.content && /^(https?:)?\/\/|^\//.test(m.content) ? (
                            /* 사진 — 앱처럼 말풍선 없이 둥근 사진(누르면 새 창으로 크게) */
                            <a href={m.content} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[16px] bg-[#F2F3F5]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={m.content} alt="보낸 사진" loading="lazy" className="block max-h-[280px] max-w-[240px] object-cover" />
                            </a>
                          ) : (
                          <div
                            className={`max-w-full whitespace-pre-wrap break-words rounded-[20px] text-[16px] leading-[1.4] [overflow-wrap:anywhere] ${
                              mine ? 'bg-[#3180F7] text-white' : 'bg-[#F2F3F5] text-[#191F28]'
                            }${tailCorner}`}
                          >
                            <div className="px-4 py-[10px]">
                              {m.type === 'text'
                                ? m.content
                                : <span className="font-semibold opacity-90">{MSG_TYPE_LABEL[m.type] || `[${m.type}]`}{m.fileName ? ` ${m.fileName}` : ''}</span>}
                            </div>
                          </div>
                          )}
                          {tailed && !(m.type === 'image' && m.content) && <BubbleTail mine={mine} color={mine ? '#3180F7' : '#F2F3F5'} />}
                        </div>
                        {showTime && <span className="shrink-0 pb-[3px] text-[12px] tabular-nums text-[#8B95A1]">{bubbleTime(m.createdAt)}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
