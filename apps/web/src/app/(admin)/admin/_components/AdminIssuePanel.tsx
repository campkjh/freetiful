'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  Inbox,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  Wallet,
  XCircle,
} from '@/app/(admin)/admin/_components/admin-icons';

import { adminFetch } from './adminFetch';

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

const EMPTY_PANEL_STATS: PanelStats = {
  newInquiries: 0,
  completedPayments: 0,
  pendingPayments: 0,
  failedPayments: 0,
  pendingSettlements: 0,
  pendingPros: 0,
};

const toneClass: Record<IssueTone, { badge: string; icon: string; dot: string }> = {
  blue: {
    badge: 'bg-[#F3F8FF] text-[#3180F7]',
    icon: 'bg-[#F3F8FF] text-[#3180F7]',
    dot: 'bg-[#3180F7]',
  },
  green: {
    badge: 'bg-emerald-50 text-emerald-600',
    icon: 'bg-emerald-50 text-emerald-600',
    dot: 'bg-emerald-500',
  },
  amber: {
    badge: 'bg-amber-50 text-amber-700',
    icon: 'bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
  },
  red: {
    badge: 'bg-red-50 text-red-600',
    icon: 'bg-red-50 text-red-600',
    dot: 'bg-red-500',
  },
  gray: {
    badge: 'bg-[#F2F4F6] text-[#6B7684]',
    icon: 'bg-[#F2F4F6] text-[#6B7684]',
    dot: 'bg-[#8B95A1]',
  },
};

const toneTextClass: Record<IssueTone, string> = {
  blue: 'text-[#3180F7]',
  green: 'text-emerald-600',
  amber: 'text-amber-700',
  red: 'text-red-600',
  gray: 'text-[#6B7684]',
};

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

function relativeTime(value?: string) {
  if (!value) return '방금';
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '방금';
  const diff = Date.now() - time;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(value).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
}

function issueTimestamp(issue: IssueItem) {
  const time = issue.createdAt ? new Date(issue.createdAt).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function issueIcon(type: IssueItem['type']) {
  if (type === 'inquiry') return Inbox;
  if (type === 'payment') return CreditCard;
  if (type === 'payment-failed') return XCircle;
  if (type === 'payment-pending') return Clock3;
  if (type === 'settlement') return Wallet;
  return UserCheck;
}

/** 운영 이슈 — 어드민 2.0(261004): 오른쪽에 늘 붙어 본문을 좁히던 패널 → 머리의 종 버튼으로 여는 서랍.
 *  열려 있지 않아도 15초마다 받아 와서 종에 '할 일'(정산 대기 + 승인 대기) 수를 띄운다(onCount).
 *  Biz 문의는 메뉴에서 빠져(사장) 여기서도 뺐다. */
export function AdminIssuePanel({ open, onClose, onCount }: { open: boolean; onClose: () => void; onCount?: (n: number) => void }) {
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

  const summary = useMemo(() => [
    { label: '정산 대기', value: stats.pendingSettlements, tone: 'amber' as IssueTone, href: '/admin/settlements' },
    { label: '승인 대기', value: stats.pendingPros, tone: 'blue' as IssueTone, href: '/admin/pros' },
    { label: '결제 확인', value: stats.pendingPayments + stats.failedPayments, tone: 'red' as IssueTone, href: '/admin/payments' },
    { label: '결제 완료', value: stats.completedPayments, tone: 'green' as IssueTone, href: '/admin/payments' },
  ], [stats]);

  // 종 버튼 숫자 = 지금 손댈 일
  useEffect(() => { onCount?.(stats.pendingSettlements + stats.pendingPros); }, [stats.pendingSettlements, stats.pendingPros, onCount]);
  // Esc 로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div className={`adm-issue ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="adm-issue-dim" onClick={onClose} />
      <aside className="adm-issue-panel" role="dialog" aria-modal="true" aria-label="운영 이슈">
        <div className="adm-issue-head">
          <div className="min-w-0">
            <p className="adm-issue-live">
              <span className="adm-issue-dot" />
              실시간 이슈
            </p>
            <h2 className="adm-issue-title">운영 이슈</h2>
            <p className="adm-issue-time">
              {lastUpdated ? `${lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 갱신 · 15초마다` : '불러오는 중'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => loadIssues()} disabled={loading} className="adm-btn icon sm" aria-label="이슈 새로고침">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={onClose} className="adm-btn icon sm" aria-label="닫기">
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="adm-issue-sum">
          {summary.map((item) => (
            <Link key={item.label} href={item.href} onClick={onClose} className="adm-issue-tile">
              <p>{item.label}</p>
              <b className={toneTextClass[item.tone]}>{item.value.toLocaleString('ko-KR')}</b>
            </Link>
          ))}
        </div>

        {freshCount > 0 && <div className="adm-issue-fresh">새 이슈 {freshCount.toLocaleString('ko-KR')}건이 들어왔어요</div>}

        <div className="adm-issue-list">
          {error ? (
            <div className="rounded-[16px] bg-[#FFF5F5] px-4 py-4">
              <div className="flex items-center gap-2 text-[14px] font-bold text-red-600">
                <ShieldAlert className="h-4 w-4" />
                이슈를 불러오지 못했어요
              </div>
              <p className="mt-2 text-[13px] leading-5 text-red-500">{error}</p>
            </div>
          ) : loading && issues.length === 0 ? (
            <div className="space-y-2.5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="adm-skel h-[76px]" />
              ))}
            </div>
          ) : issues.length === 0 ? (
            <div className="adm-empty">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-3 text-[15px] font-bold text-[#333D4B]">확인할 이슈가 없어요</p>
              <p className="mt-1 text-[13px] text-[#8B95A1]">결제·정산 대기·승인 대기가 생기면 여기에 떠요</p>
            </div>
          ) : (
            <div className="adm-rise space-y-2">
              {issues.map((issue) => {
                const Icon = issueIcon(issue.type);
                const tone = toneClass[issue.tone];
                return (
                  <Link key={issue.id} href={issue.href} onClick={onClose} className="adm-issue-item">
                    <span className={`adm-issue-ic ${tone.icon}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="adm-issue-item-title">{issue.title}</span>
                      <span className="adm-issue-item-desc">{issue.description}</span>
                    </span>
                    <span className="adm-issue-item-meta">{issue.meta}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
