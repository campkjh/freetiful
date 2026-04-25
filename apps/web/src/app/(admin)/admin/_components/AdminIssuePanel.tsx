'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  BellRing,
  CheckCircle2,
  Clock3,
  CreditCard,
  Inbox,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
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

export function AdminIssuePanel() {
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
        inquiryRes,
        paymentRes,
        pendingPaymentRes,
        failedPaymentRes,
        settlementRes,
        proRes,
      ] = await Promise.allSettled([
        adminFetch('GET', '/api/v1/admin/stats', undefined, { cache: false }),
        adminFetch('GET', '/api/v1/admin/business-inquiries?page=1&limit=5&status=new', undefined, { cache: false }),
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
      const responses = [statsRes, inquiryRes, paymentRes, pendingPaymentRes, failedPaymentRes, settlementRes, proRes];

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

      if (inquiryRes.status === 'fulfilled') {
        successfulIssueTypes.add('inquiry');
        const rows = Array.isArray(inquiryRes.value?.data) ? inquiryRes.value.data : [];
        nextStats.newInquiries = toNumber(inquiryRes.value?.total ?? rows.length);
        rows.forEach((row: any) => {
          nextIssues.push({
            id: `inquiry-${row.id}`,
            type: 'inquiry',
            title: row.company || row.name || '신규 문의',
            description: row.message || row.type || 'Biz 문의가 접수되었습니다',
            meta: `${row.name || '담당자'} · ${relativeTime(row.createdAt)}`,
            href: '/admin/inquiries',
            createdAt: row.createdAt,
            tone: 'blue',
          });
        });
      }

      if (paymentRes.status === 'fulfilled') {
        successfulIssueTypes.add('payment');
        const rows = Array.isArray(paymentRes.value?.data) ? paymentRes.value.data : [];
        nextStats.completedPayments = toNumber(paymentRes.value?.total ?? nextStats.completedPayments);
        rows.forEach((row: any) => {
          nextIssues.push({
            id: `payment-${row.id}`,
            type: 'payment',
            title: `${formatMoney(row.amount)} 결제 완료`,
            description: `${row.userName || '고객'} → ${row.proName || '전문가'}`,
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
            description: row.proProfile?.user?.name || '전문가 정산 처리 필요',
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
            title: `${row.name || '전문가'} 승인 대기`,
            description: row.email || '전문가 신청 검토 필요',
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
    { label: '신규 문의', value: stats.newInquiries, tone: 'blue' as IssueTone },
    { label: '결제 완료', value: stats.completedPayments, tone: 'green' as IssueTone },
    { label: '정산 대기', value: stats.pendingSettlements, tone: 'amber' as IssueTone },
    { label: '승인 대기', value: stats.pendingPros, tone: 'blue' as IssueTone },
  ], [stats]);

  return (
    <aside className="admin-issue-panel hidden w-[328px] shrink-0 border-l border-[#F2F4F6] bg-white xl:flex 2xl:w-[360px]">
      <div className="flex min-h-0 w-full flex-col">
        <div className="border-b border-[#F2F4F6] px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3180F7] opacity-40" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#3180F7]" />
                </span>
                <p className="text-[12px] font-bold text-[#3180F7]">실시간 이슈</p>
              </div>
              <h2 className="mt-2 text-[16px] font-bold text-[#191F28]">운영 이슈 패널</h2>
              <p className="mt-1 text-[12px] font-normal text-[#8B95A1]">
                {lastUpdated ? `${lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 갱신` : '데이터 동기화 중'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadIssues()}
              disabled={loading}
              className="admin-icon-button flex h-9 w-9 items-center justify-center rounded-full bg-[#F7F8FA] text-[#6B7684] hover:bg-[#F2F4F6] hover:text-[#3180F7] disabled:opacity-50"
              aria-label="이슈 새로고침"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {summary.map((item) => (
              <Link
                key={item.label}
                href={item.label === '신규 문의' ? '/admin/inquiries' : item.label === '결제 완료' ? '/admin/payments' : item.label === '정산 대기' ? '/admin/settlements' : '/admin/pros'}
                className="rounded-xl border border-[#F2F4F6] bg-white px-3 py-2.5 transition-colors hover:border-[#D6E8FF] hover:bg-[#F7FBFF]"
              >
                <p className="text-[11px] font-semibold text-[#8B95A1]">{item.label}</p>
                <p className={`mt-1 text-[16px] font-bold ${toneTextClass[item.tone]}`}>
                  {item.value.toLocaleString('ko-KR')}
                </p>
              </Link>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-[#F7F8FA] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-[#3180F7]" />
              <span className="text-[12px] font-bold text-[#333D4B]">현재 확인 대상</span>
            </div>
            <span className="text-[12px] font-bold text-[#3180F7]">
              표시 {issues.length.toLocaleString('ko-KR')}건
            </span>
          </div>

          {freshCount > 0 && (
            <div className="mt-3 rounded-xl bg-[#F3F8FF] px-3 py-2 text-[12px] font-bold text-[#3180F7]">
              새 이슈 {freshCount.toLocaleString('ko-KR')}건이 반영되었습니다
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-4">
              <div className="flex items-center gap-2 text-[13px] font-bold text-red-600">
                <ShieldAlert className="h-4 w-4" />
                이슈 로드 실패
              </div>
              <p className="mt-2 text-[12px] leading-5 text-red-500">{error}</p>
            </div>
          ) : loading && issues.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-[#F2F4F6] p-4">
                  <div className="flex items-start gap-3">
                    <div className="skeleton h-9 w-9 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <div className="skeleton mb-2 h-3.5 w-28 rounded" />
                      <div className="skeleton mb-2 h-3 w-full rounded" />
                      <div className="skeleton h-2.5 w-16 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : issues.length === 0 ? (
            <div className="rounded-2xl border border-[#F2F4F6] bg-white px-4 py-8 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-3 text-[13px] font-bold text-[#333D4B]">확인할 이슈가 없습니다</p>
              <p className="mt-1 text-[12px] leading-5 text-[#8B95A1]">신규 문의, 결제, 정산 대기가 생기면 여기에 표시됩니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {issues.map((issue) => {
                const Icon = issueIcon(issue.type);
                const tone = toneClass[issue.tone];
                return (
                  <Link
                    key={issue.id}
                    href={issue.href}
                    className="group block rounded-2xl border border-[#F2F4F6] bg-white p-4 transition-all hover:border-[#D6E8FF] hover:bg-[#F7FBFF]"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
                          <p className="truncate text-[13px] font-bold text-[#191F28]">{issue.title}</p>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[12px] font-normal leading-5 text-[#6B7684]">
                          {issue.description}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${tone.badge}`}>
                            {issue.type === 'inquiry'
                              ? '문의'
                              : issue.type === 'payment'
                                ? '결제'
                                : issue.type === 'settlement'
                                  ? '정산'
                                  : issue.type === 'pro'
                                    ? '전문가'
                                    : '결제 확인'}
                          </span>
                          <span className="truncate text-[11px] font-medium text-[#B0B8C1]">{issue.meta}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-[#F2F4F6] px-5 py-4">
          <Link
            href="/admin/inquiries"
            className="admin-icon-button flex h-10 items-center justify-center rounded-xl bg-[#3180F7] text-[13px] font-bold text-white hover:bg-[#1B64DA]"
          >
            문의 센터로 이동
          </Link>
        </div>
      </div>
    </aside>
  );
}
