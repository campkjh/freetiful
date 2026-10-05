'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { popItemDelay } from '@/lib/pop-menu';
import { adminFetch } from './adminFetch';
import { ADMIN_REFRESH_EVENT, LineRefreshIcon } from './adminRefresh';

/* ════════════════════════════════════════════════════════════════
 * 운영 이슈 서랍 — 프리티풀 홈 알림창(NotificationDrawer + NotificationsView) 그대로(261004 사장 '홈 알림창 UI 랑 완전 동일하게').
 *  · 오른쪽 420 서랍 · 딤 25% · 300ms 미끄럼. 위 바 = ‹ 닫기 … 새로고침(홈의 톱니 자리, 라인 아이콘).
 *  · 큰 제목 '운영 이슈 ⌄' → 종류 거르기(전체·결제·정산·사회자 승인) + 모두 확인. 메뉴는 공통 .pop-menu(작게→정비율, 촤라락).
 *  · 새 이슈 = 연한 파랑 바탕(이 서랍을 마지막으로 닫은 뒤 생긴 것), 그 아래 '지난 이슈'. 한 줄 = 둥근 아이콘 칸 · 제목 · 본문 · 시간.
 *  · 등장: 제목 아래→위, 줄은 오른쪽→왼쪽 차례로. 닫으면 지금 보이던 이슈는 '지난 이슈'로.
 *  · 어드민 셸(.admin-shell)의 옛 글자 덮어쓰기에 안 걸리게 body 로 포털.
 *  열려 있지 않아도 15초마다 받아 와서 새 이슈 수를 종(빨간 점)에 알린다(onUnseen). Biz 문의는 메뉴에서 빠져(사장) 뺐다.
 * ════════════════════════════════════════════════════════════════ */

type IssueTone = 'blue' | 'green' | 'amber' | 'red' | 'gray';

type IssueItem = {
  id: string;
  type: 'inquiry' | 'payment' | 'settlement' | 'pro' | 'payment-failed' | 'payment-pending';
  title: string;
  description: string;
  meta: string;
  href: string;
  createdAt?: string;
  tone: IssueTone;
};

type PanelStats = {
  newInquiries: number;
  completedPayments: number;
  pendingPayments: number;
  failedPayments: number;
  pendingSettlements: number;
  pendingPros: number;
};

const POLL_MS = 15_000;
const SEEN_KEY = 'admin_issue_seen_v1';
const UNREAD_BG = '#F2F6FC';

const EMPTY_PANEL_STATS: PanelStats = {
  newInquiries: 0,
  completedPayments: 0,
  pendingPayments: 0,
  failedPayments: 0,
  pendingSettlements: 0,
  pendingPros: 0,
};

// 토스 컬러 아이콘(public/icons/toss) — 홈 알림처럼 종류마다 색이 달라 한눈에 갈린다
const TYPE_ICON: Record<IssueItem['type'], string> = {
  payment: 'coin',
  'payment-pending': 'clock',
  'payment-failed': 'siren',
  settlement: 'ledger',
  pro: 'user',
  inquiry: 'document',
};

const FILTERS: { k: string; label: string; title: string; icon: string; types: IssueItem['type'][] | null }[] = [
  { k: 'all', label: '전체', title: '운영 이슈', icon: 'list', types: null },
  { k: 'pay', label: '결제', title: '결제 이슈', icon: 'coin', types: ['payment', 'payment-pending', 'payment-failed'] },
  { k: 'settle', label: '정산', title: '정산 대기', icon: 'ledger', types: ['settlement'] },
  { k: 'pro', label: '사회자 승인', title: '승인 대기', icon: 'user', types: ['pro'] },
];

const AI_CSS = `
@keyframes aiFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes aiSlideIn { from { opacity: 0; transform: translateX(22px); } to { opacity: 1; transform: translateX(0); } }
.ai-a-title { animation: aiFadeUp .5s cubic-bezier(.22,.61,.36,1) both; }
.ai-a-sub { animation: aiFadeUp .5s cubic-bezier(.22,.61,.36,1) .18s both; }
.ai-a-item { animation: aiSlideIn .46s cubic-bezier(.22,.61,.36,1) backwards; }
@keyframes aiSpin { to { transform: rotate(360deg); } }
.adm-spin { animation: aiSpin .8s linear infinite; transform-origin: 50% 50%; }
@media (prefers-reduced-motion: reduce) { .ai-a-title, .ai-a-sub, .ai-a-item { animation: none !important; } }
`;

function toNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasNumberValue(value: unknown) {
  return value !== undefined && value !== null;
}

function formatMoney(value: unknown) {
  return `₩${toNumber(value).toLocaleString('ko-KR')}`;
}

/** 목록 데이터용(옛 메타 줄) */
function relativeTime(value?: string) {
  if (!value) return '방금';
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '방금';
  const min = Math.floor((Date.now() - time) / 60_000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(value).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
}

/** 홈 알림과 같은 시간 — 방금 전 · N분 전 · N시간 전 · M월 D일(올해가 아니면 YY년 M월 D일) */
function relTime(iso?: string): string {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(t)) return '';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const [y, m, d] = new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).split('-').map(Number);
  const thisYear = Number(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).slice(0, 4));
  return y === thisYear ? `${m}월 ${d}일` : `${String(y).slice(-2)}년 ${m}월 ${d}일`;
}

function issueTimestamp(issue: IssueItem) {
  const time = issue.createdAt ? new Date(issue.createdAt).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}
function writeSeen(set: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(set).slice(-400)));
  } catch {}
}

export function AdminIssuePanel({ open, onClose, onUnseen }: { open: boolean; onClose: () => void; onUnseen?: (n: number) => void }) {
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [stats, setStats] = useState<PanelStats>({ ...EMPTY_PANEL_STATS });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [freshCount, setFreshCount] = useState(0);
  const knownIssueIdsRef = useRef<Set<string>>(new Set());
  const issuesRef = useRef<IssueItem[]>([]);
  const statsRef = useRef<PanelStats>({ ...EMPTY_PANEL_STATS });
  const requestSeqRef = useRef(0);

  const loadIssues = useCallback(async (silent = false) => {
    const requestSeq = ++requestSeqRef.current;
    if (!silent) {
      setLoading(true);
      setError('');
    }

    try {
      const [
        statsRes,
        paymentRes,
        pendingPaymentRes,
        failedPaymentRes,
        settlementRes,
        proRes,
      ] = await Promise.allSettled([
        adminFetch('GET', '/api/v1/admin/stats', undefined, { cache: false }),
        adminFetch('GET', '/api/v1/admin/payments?page=1&limit=5&status=completed', undefined, { cache: false }),
        adminFetch('GET', '/api/v1/admin/payments?page=1&limit=3&status=pending', undefined, { cache: false }),
        adminFetch('GET', '/api/v1/admin/payments?page=1&limit=3&status=failed', undefined, { cache: false }),
        adminFetch('GET', '/api/v1/admin/settlements?page=1&limit=5&status=pending', undefined, { cache: false }),
        adminFetch('GET', '/api/v1/admin/pros?page=1&limit=5&status=pending', undefined, { cache: false }),
      ]);

      if (requestSeq !== requestSeqRef.current) return;

      const nextIssues: IssueItem[] = [];
      const nextStats: PanelStats = { ...statsRef.current };
      const successfulIssueTypes = new Set<IssueItem['type']>();
      const responses = [statsRes, paymentRes, pendingPaymentRes, failedPaymentRes, settlementRes, proRes];

      if (statsRes.status === 'fulfilled') {
        const completedPayments = statsRes.value?.payments?.completed;
        const pendingPayments = statsRes.value?.payments?.pending;
        const failedPayments = statsRes.value?.payments?.failed;
        const pendingPros = statsRes.value?.pendingPros;
        if (hasNumberValue(completedPayments)) nextStats.completedPayments = toNumber(completedPayments);
        if (hasNumberValue(pendingPayments)) nextStats.pendingPayments = toNumber(pendingPayments);
        if (hasNumberValue(failedPayments)) nextStats.failedPayments = toNumber(failedPayments);
        if (hasNumberValue(pendingPros)) nextStats.pendingPros = toNumber(pendingPros);
      }

      if (paymentRes.status === 'fulfilled') {
        successfulIssueTypes.add('payment');
        // 0원 결제는 실제 결제가 아니라 '관리자 리뷰 등록' 더미 결제이므로 로그에서 제외
        const rows = (Array.isArray(paymentRes.value?.data) ? paymentRes.value.data : []).filter((r: any) => Number(r?.amount) > 0);
        nextStats.completedPayments = toNumber(paymentRes.value?.total ?? nextStats.completedPayments);
        rows.forEach((row: any) => {
          nextIssues.push({
            id: `payment-${row.id}`,
            type: 'payment',
            title: `${formatMoney(row.amount)} 결제 완료`,
            description: `${row.userName || '고객'} → ${row.proName || '사회자'}`,
            meta: relativeTime(row.createdAt),
            href: '/admin/payments',
            createdAt: row.createdAt,
            tone: 'green',
          });
        });
      }

      if (pendingPaymentRes.status === 'fulfilled') {
        successfulIssueTypes.add('payment-pending');
        const rows = Array.isArray(pendingPaymentRes.value?.data) ? pendingPaymentRes.value.data : [];
        nextStats.pendingPayments = toNumber(pendingPaymentRes.value?.total ?? nextStats.pendingPayments);
        rows.forEach((row: any) => {
          nextIssues.push({
            id: `payment-pending-${row.id}`,
            type: 'payment-pending',
            title: `${formatMoney(row.amount)} 결제 대기`,
            description: `${row.userName || '고객'} 결제 확인 필요`,
            meta: relativeTime(row.createdAt),
            href: '/admin/payments',
            createdAt: row.createdAt,
            tone: 'amber',
          });
        });
      }

      if (failedPaymentRes.status === 'fulfilled') {
        successfulIssueTypes.add('payment-failed');
        const rows = Array.isArray(failedPaymentRes.value?.data) ? failedPaymentRes.value.data : [];
        nextStats.failedPayments = toNumber(failedPaymentRes.value?.total ?? nextStats.failedPayments);
        rows.forEach((row: any) => {
          nextIssues.push({
            id: `payment-failed-${row.id}`,
            type: 'payment-failed',
            title: `${formatMoney(row.amount)} 결제 실패`,
            description: `${row.userName || '고객'} 결제 실패 내역`,
            meta: relativeTime(row.createdAt),
            href: '/admin/payments',
            createdAt: row.createdAt,
            tone: 'red',
          });
        });
      }

      if (settlementRes.status === 'fulfilled') {
        successfulIssueTypes.add('settlement');
        const rows = Array.isArray(settlementRes.value?.data) ? settlementRes.value.data : [];
        const pendingCount = settlementRes.value?.summary?.pendingCount;
        if (hasNumberValue(pendingCount)) nextStats.pendingSettlements = toNumber(pendingCount);
        rows.forEach((row: any) => {
          nextIssues.push({
            id: `settlement-${row.id}`,
            type: 'settlement',
            title: `${formatMoney(row.netAmount)} 정산 대기`,
            description: row.proProfile?.user?.name || '사회자 정산 처리 필요',
            meta: relativeTime(row.createdAt),
            href: '/admin/settlements',
            createdAt: row.createdAt,
            tone: 'amber',
          });
        });
      }

      if (proRes.status === 'fulfilled') {
        successfulIssueTypes.add('pro');
        const rows = Array.isArray(proRes.value?.data) ? proRes.value.data : [];
        nextStats.pendingPros = toNumber(proRes.value?.total ?? nextStats.pendingPros);
        rows.forEach((row: any) => {
          nextIssues.push({
            id: `pro-${row.id}`,
            type: 'pro',
            title: `${row.name || '사회자'} 승인 대기`,
            description: row.email || '사회자 신청 검토 필요',
            meta: relativeTime(row.createdAt),
            href: '/admin/pros',
            createdAt: row.createdAt,
            tone: 'blue',
          });
        });
      }

      if (responses.every((res) => res.status === 'rejected')) {
        throw new Error('관리자 이슈 데이터를 불러오지 못했습니다.');
      }

      const retainedIssues = issuesRef.current.filter((issue) => !successfulIssueTypes.has(issue.type));
      const mergedIssues = successfulIssueTypes.size > 0 ? [...nextIssues, ...retainedIssues] : issuesRef.current;
      const sorted = mergedIssues
        .sort((a, b) => issueTimestamp(b) - issueTimestamp(a))
        .slice(0, 12);
      if (successfulIssueTypes.size > 0) {
        const previousIds = knownIssueIdsRef.current;
        const newCount = sorted.filter((issue) => !previousIds.has(issue.id)).length;
        if (previousIds.size > 0) setFreshCount(newCount);
        knownIssueIdsRef.current = new Set(sorted.map((issue) => issue.id));
      }

      issuesRef.current = sorted;
      statsRef.current = nextStats;
      setIssues(sorted);
      setStats(nextStats);
      setError('');
      setLastUpdated(new Date());
    } catch (err: any) {
      if (requestSeq === requestSeqRef.current && !silent) {
        setError(err?.message || '이슈 패널을 불러오지 못했습니다.');
      }
    } finally {
      if (requestSeq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadIssues();
    const timer = window.setInterval(() => loadIssues(true), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadIssues(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadIssues]);

  useEffect(() => {
    if (freshCount <= 0) return;
    const timer = window.setTimeout(() => setFreshCount(0), 3500);
    return () => window.clearTimeout(timer);
  }, [freshCount]);


  // 'admin:refresh' 이벤트가 오면 같이 다시 받는다(화면 새로고침을 가로채지 않게 preventDefault 는 안 한다).
  // 지금은 쏘는 곳이 없다 — 머리 새로고침 버튼(종 옆)은 261005 사장 요청으로 뺐다. 서랍은 15초마다 스스로 받는다.
  useEffect(() => {
    const on = () => { loadIssues(); };
    window.addEventListener(ADMIN_REFRESH_EVENT, on);
    return () => window.removeEventListener(ADMIN_REFRESH_EVENT, on);
  }, [loadIssues]);

  // 본 이슈 — 서랍을 닫을 때 그때 보이던 것을 '지난 이슈'로
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  useEffect(() => { setSeen(readSeen()); }, []);
  const markAllSeen = useCallback(() => {
    setSeen((prev) => {
      const next = new Set(prev);
      issuesRef.current.forEach((it) => next.add(it.id));
      writeSeen(next);
      return next;
    });
  }, []);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) markAllSeen();
    wasOpen.current = open;
  }, [open, markAllSeen]);
  const unseenCount = issues.filter((it) => !seen.has(it.id)).length;
  useEffect(() => { onUnseen?.(unseenCount); }, [unseenCount, onUnseen]);

  // 서랍 — 열 때마다 새로 그려 등장 애니가 다시 돌고, 닫힐 땐 밀려 나가는 동안(300ms) 내용을 둔다(홈 알림 서랍과 같게)
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  const [filter, setFilter] = useState('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      scrollRef.current?.scrollTo({ top: 0 });
      return;
    }
    setMenuOpen(false);
    const t = window.setTimeout(() => setMounted(false), 320);
    return () => window.clearTimeout(t);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const onScroll = () => setScrolled(root.scrollTop > 4);
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [mounted]);

  const current = FILTERS.find((f) => f.k === filter) || FILTERS[0];
  const { fresh, past } = useMemo(() => {
    const visible = issues.filter((it) => !current.types || current.types.includes(it.type));
    return { fresh: visible.filter((it) => !seen.has(it.id)), past: visible.filter((it) => seen.has(it.id)) };
  }, [issues, current, seen]);

  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  useEffect(() => { setPortalEl(document.body); }, []);

  let order = 0;
  const renderIssue = (it: IssueItem, unseen: boolean) => {
    const delay = `${0.3 + Math.min(order++, 12) * 0.06}s`;
    return (
      <Link
        key={it.id}
        href={it.href}
        draggable={false}
        onClick={onClose}
        className="ai-a-item flex gap-3 px-5 py-3.5 transition-colors hover:brightness-[0.985] active:bg-black/[0.03]"
        style={{ animationDelay: delay, backgroundColor: unseen ? UNREAD_BG : '#FFFFFF' }}
      >
        <span className={`mt-[2px] flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${unseen ? 'bg-white' : 'bg-[#F2F4F6]'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- public 정적 SVG, 컬러 그대로 */}
          <img src={`/icons/toss/${TYPE_ICON[it.type] || 'alarm'}.svg`} alt="" draggable={false} className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold leading-[1.45] text-[#333D4B]">{it.title}</span>
          {it.description && (
            <span className={`mt-0.5 line-clamp-3 whitespace-pre-line text-[16px] leading-[1.5] ${unseen ? 'text-[#4E5968]' : 'text-[#6B7684]'}`}>
              {it.description}
            </span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-2 pt-[3px]">
          <span className="text-[13px] leading-none text-[#B0B8C1]">{relTime(it.createdAt)}</span>
        </span>
      </Link>
    );
  };

  const empty = fresh.length === 0 && past.length === 0;

  const drawer = (
    <>
      <style dangerouslySetInnerHTML={{ __html: AI_CSS }} />
      {/* 딤 — 화면이 비쳐 보일 정도로만 */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-black/25 transition-opacity duration-300 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        aria-hidden={!open}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="운영 이슈"
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-[61] flex h-full w-[420px] max-w-[92vw] flex-col bg-white shadow-[-12px_0_40px_rgba(15,23,42,0.12)] ease-out ${
          open
            ? 'visible translate-x-0 [transition:transform_300ms_cubic-bezier(0,0,0.2,1),visibility_0s]'
            : 'invisible translate-x-full [transition:transform_300ms_cubic-bezier(0,0,0.2,1),visibility_0s_linear_300ms]'
        }`}
      >
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {mounted && (
            <div className="min-h-full bg-white pb-10" style={{ letterSpacing: '-0.02em' }}>
              {/* 위 바 — ‹ 닫기 … 새로고침 */}
              <header className="sticky top-0 z-30 bg-white">
                <div className="flex h-[52px] items-center justify-between px-2">
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="운영 이슈 닫기"
                    className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-[#F7F8FA] active:bg-[#F2F4F6]"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M15 5l-7 7 7 7" stroke="#191F28" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => loadIssues()}
                    disabled={loading}
                    aria-label="이슈 새로고침"
                    title={lastUpdated ? `${lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 갱신 · 15초마다 자동` : '새로고침'}
                    className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-[#F7F8FA] active:bg-[#F2F4F6]"
                  >
                    <LineRefreshIcon spinning={loading} />
                  </button>
                </div>
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-x-0 top-full h-6 bg-gradient-to-b from-white to-white/0 transition-opacity duration-300 ${scrolled ? 'opacity-100' : 'opacity-0'}`}
                />
              </header>

              {/* 큰 제목 '운영 이슈 ⌄' — 종류 거르기 · 모두 확인 */}
              <div className="relative px-5 pb-3 pt-1">
                <h2 className="ai-a-title">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-expanded={menuOpen}
                    className="flex items-center gap-1.5 rounded-[10px] text-[26px] font-bold tracking-[-0.02em] text-[#191F28] active:opacity-70"
                  >
                    {current.title}
                    <svg
                      width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                      className="mt-[3px] transition-transform duration-200"
                      style={{ transform: menuOpen ? 'rotate(180deg)' : 'none' }}
                    >
                      <path d="M6 9l6 6 6-6" stroke="#8B95A1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </h2>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div className="pop-menu absolute left-2 top-full z-50 w-max min-w-[184px] overflow-hidden py-2" style={{ transformOrigin: '32px 0', borderRadius: 24 }} role="menu">
                      {FILTERS.map((f, i) => {
                        const on = filter === f.k;
                        return (
                          <button
                            key={f.k}
                            type="button"
                            role="menuitemradio"
                            aria-checked={on}
                            onClick={() => { setFilter(f.k); setMenuOpen(false); }}
                            className="pop-menu-item flex w-full items-center gap-3.5 py-[9px] pl-5 pr-7 text-left transition-colors active:bg-[#F2F4F6] lg:hover:bg-[#F9FAFB]"
                            style={popItemDelay(i)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/icons/toss/${f.icon}.svg`} alt="" className="h-6 w-6 shrink-0" />
                            <span className={`text-[17px] leading-[24px] ${on ? 'font-semibold text-[#191F28]' : 'text-[#333D4B]'}`}>{f.label}</span>
                          </button>
                        );
                      })}
                      <div className="pop-menu-item mx-5 my-1.5 h-px bg-[#F2F4F6]" style={popItemDelay(FILTERS.length)} />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setMenuOpen(false); markAllSeen(); }}
                        className="pop-menu-item flex w-full items-center gap-3.5 py-[9px] pl-5 pr-7 text-left transition-colors active:bg-[#F2F4F6] lg:hover:bg-[#F9FAFB]"
                        style={popItemDelay(FILTERS.length + 1)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/icons/toss/check-circle.svg" alt="" className="h-6 w-6 shrink-0" />
                        <span className="text-[17px] leading-[24px] text-[#333D4B]">모두 확인</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {error ? (
                <p className="ai-a-sub px-5 pt-6 text-[15px] text-[#F04452]">이슈를 불러오지 못했어요 · {error}</p>
              ) : loading && issues.length === 0 ? (
                <div className="space-y-1 px-5 pt-2">
                  {Array.from({ length: 4 }).map((_, i) => <div key={i} className="adm-skel h-[64px]" />)}
                </div>
              ) : empty ? (
                <div className="ai-a-sub flex flex-col items-center px-5 pt-24 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#F2F4F6]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icons/toss/alarm.svg" alt="" className="h-9 w-9" />
                  </span>
                  <p className="mt-4 text-[17px] font-semibold text-[#333D4B]">{filter === 'all' ? '확인할 이슈가 없어요' : `${current.label} 이슈가 없어요`}</p>
                  <p className="mt-1.5 text-[14px] text-[#8B95A1]">결제·정산 대기·승인 대기가 생기면 여기에서 알려 드릴게요</p>
                </div>
              ) : (
                <>
                  {/* 새 이슈 — 연한 파랑 바탕 */}
                  {fresh.length > 0 && <div className="pt-1">{fresh.map((it) => renderIssue(it, true))}</div>}
                  {past.length > 0 && (
                    <>
                      <h3
                        className={`ai-a-item px-5 pb-1 text-[17px] font-bold text-[#191F28] ${fresh.length > 0 ? 'pt-8' : 'pt-3'}`}
                        style={{ animationDelay: `${0.3 + Math.min(order++, 12) * 0.06}s` }}
                      >
                        지난 이슈
                      </h3>
                      <div>{past.map((it) => renderIssue(it, false))}</div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );

  return portalEl ? createPortal(drawer, portalEl) : null;
}
