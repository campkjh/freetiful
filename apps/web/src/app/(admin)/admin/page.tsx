'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/auth.store';
import { AdminTerm } from './_components/AdminHelpTooltip';
import { adminFetch } from './_components/adminFetch';
import { LineChevron, useAdminRefresh } from './_components/adminRefresh';

type DailyMetricKey = 'users' | 'matchRequests' | 'payments' | 'chats' | 'messages' | 'revenue';

interface DailyPoint {
  date: string;
  users: number;
  matchRequests: number;
  payments: number;
  chats: number;
  messages: number;
  revenue: number;
}

interface TopListItem {
  id: string;
  name: string;
  value: number;
  count?: number;
}

interface Stats {
  totalUsers: number;
  allUsers?: number;
  activeUsers?: number;
  inactiveUsers?: number;
  bannedUsers?: number;
  newUsersToday?: number;
  newUsers7d?: number;
  newUsers30d?: number;
  userRoles?: {
    general?: number;
    pro?: number;
    business?: number;
    admin?: number;
  };
  totalPros: number;
  pendingPros: number;
  totalReviews: number;
  visibleReviews?: number;
  thisMonthRevenue: number;
  totalRevenue: number;
  revenue?: {
    today?: number;
    last7d?: number;
    last30d?: number;
    thisMonth?: number;
    total?: number;
  };
  profiles?: {
    proViews?: number;
    businessViews?: number;
    totalViews?: number;
    avgRating?: number;
    avgResponseRate?: number;
    proStatus?: Record<string, number>;
    businessTotal?: number;
    businessStatus?: Record<string, number>;
    businessTypes?: Array<{ type: string; count: number }>;
  };
  engagement?: {
    chatRooms?: number;
    chatRooms7d?: number;
    messages?: number;
    messages7d?: number;
    notifications?: number;
    unreadNotifications?: number;
    sentPushNotifications?: number;
    activePushTokens?: number;
    pushSubscriptions?: number;
  };
  funnel?: {
    profileViews?: number;
    matchRequests?: number;
    deliveries?: number;
    viewedDeliveries?: number;
    repliedDeliveries?: number;
    chatRooms?: number;
    quotations?: number;
    paidQuotations?: number;
    payments?: number;
    completedPayments?: number;
    reviews?: number;
  };
  rates?: {
    chatCtr?: number;
    deliveryViewRate?: number;
    deliveryReplyRate?: number;
    quotationPaidRate?: number;
    paymentSuccessRate?: number;
    reviewWriteRate?: number;
    pushSendRate?: number;
  };
  matchRequests?: Record<string, number>;
  quotations?: Record<string, number>;
  payments?: Record<string, number>;
  settlements?: {
    pending?: number;
    settled?: number;
    cancelled?: number;
    pendingAmount?: number;
    settledAmount?: number;
  };
  dailySeries?: DailyPoint[];
  topLists?: {
    viewedPros?: TopListItem[];
    revenuePros?: TopListItem[];
  };
  degraded?: boolean;
}


const toNumber = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumber = (value: unknown) => toNumber(value).toLocaleString('ko-KR');
const formatMoney = (value: unknown) => `₩${formatNumber(value)}`;
const formatRate = (value: unknown) => `${toNumber(value).toFixed(1)}%`;

const sumBy = <T,>(items: T[], picker: (item: T) => unknown) => (
  items.reduce((sum, item) => sum + toNumber(picker(item)), 0)
);

const countByStatus = (items: Array<{ status?: string }>, status: string) => (
  items.filter((item) => item.status === status).length
);

const getKstDayKey = (date = new Date()) => new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

const getKstStartDate = (dayOffset: number) => {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const key = new Date(now + 9 * 60 * 60 * 1000 - dayOffset * dayMs).toISOString().slice(0, 10);
  return key;
};

const createEmptyDailySeries = () => (
  Array.from({ length: 14 }, (_, idx) => {
    const key = getKstStartDate(13 - idx);
    return {
      date: key.slice(5).replace('-', '.'),
      users: 0,
      matchRequests: 0,
      payments: 0,
      chats: 0,
      messages: 0,
      revenue: 0,
    };
  })
);

async function adminFetchSafe(path: string, fallback: any) {
  try {
    return await adminFetch('GET', path, undefined, { cache: false });
  } catch (error) {
    console.warn('[admin] fallback stats source failed', path, error);
    return fallback;
  }
}

async function fetchFallbackStats(): Promise<Stats> {
  const todayKey = getKstDayKey();
  const sevenDayKey = getKstStartDate(6);
  const thirtyDayKey = getKstStartDate(29);
  const thisMonthKey = `${todayKey.slice(0, 7)}-01`;
  const emptyList = { data: [], total: 0, meta: { total: 0 } };

  const [
    users,
    generalUsers,
    proUsers,
    businessUsers,
    adminUsers,
    pros,
    approvedPros,
    pendingPros,
    businesses,
    bookings,
    reviews,
    payments,
    settlements,
  ] = await Promise.all([
    adminFetchSafe('/api/v1/admin/users?limit=1', emptyList),
    adminFetchSafe('/api/v1/admin/users?role=general&limit=1', emptyList),
    adminFetchSafe('/api/v1/admin/users?role=pro&limit=1', emptyList),
    adminFetchSafe('/api/v1/admin/users?role=business&limit=1', emptyList),
    adminFetchSafe('/api/v1/admin/users?role=admin&limit=1', emptyList),
    adminFetchSafe('/api/v1/admin/pros?limit=1', emptyList),
    adminFetchSafe('/api/v1/admin/pros?status=approved&limit=1', emptyList),
    adminFetchSafe('/api/v1/admin/pros?status=pending&limit=1', emptyList),
    adminFetchSafe('/api/v1/admin/businesses?limit=1', emptyList),
    adminFetchSafe('/api/v1/admin/bookings?limit=1000', emptyList),
    adminFetchSafe('/api/v1/admin/reviews?limit=1', emptyList),
    adminFetchSafe('/api/v1/admin/payments?limit=1000', emptyList),
    adminFetchSafe('/api/v1/admin/settlements?limit=1000', emptyList),
  ]);

  const paymentRows = Array.isArray(payments?.data) ? payments.data : [];
  const settlementRows = Array.isArray(settlements?.data) ? settlements.data : [];
  const bookingRows = Array.isArray(bookings?.data) ? bookings.data : [];
  const completedPayments = paymentRows.filter((payment: any) => payment.status === 'completed');
  const refundedPayments = paymentRows.filter((payment: any) => payment.status === 'refunded');
  const revenueToday = sumBy(completedPayments.filter((payment: any) => getKstDayKey(new Date(payment.createdAt)) === todayKey), (payment: any) => payment.amount);
  const revenue7d = sumBy(completedPayments.filter((payment: any) => getKstDayKey(new Date(payment.createdAt)) >= sevenDayKey), (payment: any) => payment.amount);
  const revenue30d = sumBy(completedPayments.filter((payment: any) => getKstDayKey(new Date(payment.createdAt)) >= thirtyDayKey), (payment: any) => payment.amount);
  const revenueThisMonth = sumBy(completedPayments.filter((payment: any) => getKstDayKey(new Date(payment.createdAt)) >= thisMonthKey), (payment: any) => payment.amount);
  const revenueTotal = sumBy(completedPayments, (payment: any) => payment.amount);
  const paidQuotations = bookingRows.filter((booking: any) => booking.source === 'quotation' && booking.status === 'paid').length;
  const matchRequests = bookingRows.filter((booking: any) => booking.source === 'matchRequest');
  const quotations = bookingRows.filter((booking: any) => booking.source === 'quotation');
  const pendingSettlementAmount = sumBy(settlementRows.filter((item: any) => item.status === 'pending'), (item: any) => item.netAmount);
  const settledSettlementAmount = sumBy(settlementRows.filter((item: any) => item.status === 'settled'), (item: any) => item.netAmount);

  return {
    totalUsers: toNumber(generalUsers?.total),
    allUsers: toNumber(users?.total),
    activeUsers: toNumber(users?.total),
    inactiveUsers: 0,
    bannedUsers: 0,
    newUsersToday: 0,
    newUsers7d: 0,
    newUsers30d: 0,
    userRoles: {
      general: toNumber(generalUsers?.total),
      pro: toNumber(proUsers?.total),
      business: toNumber(businessUsers?.total),
      admin: toNumber(adminUsers?.total),
    },
    totalPros: toNumber(approvedPros?.total ?? pros?.total),
    pendingPros: toNumber(pendingPros?.total),
    totalReviews: toNumber(reviews?.total),
    visibleReviews: toNumber(reviews?.total),
    thisMonthRevenue: revenueThisMonth,
    totalRevenue: revenueTotal,
    revenue: {
      today: revenueToday,
      last7d: revenue7d,
      last30d: revenue30d,
      thisMonth: revenueThisMonth,
      total: revenueTotal,
    },
    profiles: {
      proViews: 0,
      businessViews: 0,
      totalViews: 0,
      avgRating: 0,
      avgResponseRate: 0,
      proStatus: {
        approved: toNumber(approvedPros?.total),
        pending: toNumber(pendingPros?.total),
        draft: 0,
        rejected: 0,
        suspended: 0,
      },
      businessTotal: toNumber(businesses?.total),
      businessStatus: { approved: toNumber(businesses?.total), pending: 0, draft: 0, rejected: 0 },
    },
    engagement: {
      chatRooms: 0,
      chatRooms7d: 0,
      messages: 0,
      messages7d: 0,
      notifications: 0,
      unreadNotifications: 0,
      sentPushNotifications: 0,
      activePushTokens: 0,
      pushSubscriptions: 0,
    },
    funnel: {
      profileViews: 0,
      matchRequests: toNumber(bookings?.total) || matchRequests.length,
      deliveries: sumBy(matchRequests, (booking: any) => booking.deliveryCount),
      viewedDeliveries: 0,
      repliedDeliveries: 0,
      chatRooms: sumBy(matchRequests, (booking: any) => booking.chatRoomCount),
      quotations: quotations.length,
      paidQuotations,
      payments: toNumber(payments?.total ?? paymentRows.length),
      completedPayments: completedPayments.length,
      reviews: toNumber(reviews?.total),
    },
    rates: {
      chatCtr: 0,
      deliveryViewRate: 0,
      deliveryReplyRate: 0,
      quotationPaidRate: quotations.length ? Math.round((paidQuotations / quotations.length) * 1000) / 10 : 0,
      paymentSuccessRate: paymentRows.length ? Math.round((completedPayments.length / paymentRows.length) * 1000) / 10 : 0,
      reviewWriteRate: completedPayments.length ? Math.round((toNumber(reviews?.total) / completedPayments.length) * 1000) / 10 : 0,
      pushSendRate: 0,
    },
    matchRequests: {
      total: toNumber(bookings?.total) || matchRequests.length,
      open: countByStatus(matchRequests, 'open'),
      matched: countByStatus(matchRequests, 'matched'),
      cancelled: countByStatus(matchRequests, 'cancelled'),
      expired: countByStatus(matchRequests, 'expired'),
    },
    quotations: {
      total: quotations.length,
      pending: countByStatus(quotations, 'pending'),
      accepted: countByStatus(quotations, 'accepted'),
      paid: paidQuotations,
      cancelled: countByStatus(quotations, 'cancelled'),
      refunded: countByStatus(quotations, 'refunded'),
      expired: countByStatus(quotations, 'expired'),
    },
    payments: {
      total: toNumber(payments?.total ?? paymentRows.length),
      pending: countByStatus(paymentRows, 'pending'),
      completed: completedPayments.length,
      failed: countByStatus(paymentRows, 'failed'),
      refunded: refundedPayments.length,
      escrowed: countByStatus(paymentRows, 'escrowed'),
      settled: countByStatus(paymentRows, 'settled'),
      completedAmount: revenueTotal,
      refundedAmount: sumBy(refundedPayments, (payment: any) => payment.amount),
    },
    settlements: {
      pending: countByStatus(settlementRows, 'pending'),
      settled: countByStatus(settlementRows, 'settled'),
      cancelled: countByStatus(settlementRows, 'cancelled'),
      pendingAmount: pendingSettlementAmount,
      settledAmount: settledSettlementAmount,
    },
    dailySeries: createEmptyDailySeries(),
    topLists: { viewedPros: [], revenuePros: [] },
    degraded: true,
  };
}

/* ─────────────────────────────────────────────────────────────
 * 어드민 홈 2.0 — 퀵매칭·앱과 같은 토스 톤(261004 사장 '어드민도 디자인·UI·인터랙션 격변').
 *  인사 → 핵심 숫자 4칸(숫자가 차오르고 14일 추이선이 그려진다) → 할 일 · 14일 막대(지표 바꿔 보기, 막대가 자라 오른다)
 *  → 전환 퍼널(단계 사이 전환율) · 사회자 TOP · 랜딩 유입. 카드는 차례로 올라온다(adm-rise).
 *  관리 메뉴 바둑판은 왼쪽 메뉴와 겹쳐 뺐다.
 * ──────────────────────────────────────────────────────────── */

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** 숫자가 0 에서 목표까지 차오른다(0.9초). 값이 바뀌면 지금 값에서 이어서 */
function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { from.current = target; setV(target); return; }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const cur = start + (target - start) * ease(k);
      from.current = cur;
      setV(cur);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function CountUp({ value, money = false, suffix = '' }: { value: number; money?: boolean; suffix?: string }) {
  const v = useCountUp(value);
  const n = Math.round(v).toLocaleString('ko-KR');
  return (
    <>
      {money ? `₩${n}` : n}
      {suffix && <small>{suffix}</small>}
    </>
  );
}

/** 14일 추이선 — 면 + 선, 선은 그려지듯 나타난다 */
function Spark({ values, color }: { values: number[]; color: string }) {
  const W = 120;
  const H = 40;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => [values.length <= 1 ? W : (i / (values.length - 1)) * W, H - 3 - ((v - min) / span) * (H - 8)] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const id = `sp${color.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="adm-spark" aria-hidden preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {pts.length > 1 && <polygon points={`0,${H} ${line} ${W},${H}`} fill={`url(#${id})`} className="adm-spark-area" />}
      {pts.length > 1 && <polyline points={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="adm-spark-line" />}
    </svg>
  );
}

function Kpi({ label, value, money, suffix, sub, series, color, href }: {
  label: string;
  value: number;
  money?: boolean;
  suffix?: string;
  sub: ReactNode;
  series?: number[];
  color: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="adm-stat-label">{label}</p>
      <p className="adm-stat-value"><CountUp value={value} money={money} suffix={suffix} /></p>
      <div className="adm-kpi-foot">
        <p className="adm-stat-sub">{sub}</p>
        {series && series.length > 1 && <Spark values={series} color={color} />}
      </div>
    </>
  );
  return href ? <Link href={href} className="adm-stat adm-kpi adm-card-link">{body}</Link> : <div className="adm-stat adm-kpi">{body}</div>;
}

const METRICS: Array<{ key: DailyMetricKey; label: string; money?: boolean; unit: string; color: string }> = [
  { key: 'revenue', label: '매출', money: true, unit: '', color: '#3182F6' },
  { key: 'users', label: '가입', unit: '명', color: '#03B26C' },
  { key: 'matchRequests', label: '견적 요청', unit: '건', color: '#F46A00' },
  { key: 'payments', label: '결제', unit: '건', color: '#7B4DFF' },
];

/** 14일 막대 — 지표를 바꾸면 막대가 다시 자라 오른다. 막대에 올리면 그날 값 */
function TrendChart({ points }: { points: DailyPoint[] }) {
  const [metric, setMetric] = useState<DailyMetricKey>('revenue');
  const m = METRICS.find((x) => x.key === metric) || METRICS[0];
  const values = points.map((p) => toNumber(p[metric]));
  const max = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);
  const fmt = (v: number) => (m.money ? formatMoney(v) : `${formatNumber(v)}${m.unit}`);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="adm-card">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title">최근 14일 {m.label}</h2>
          <p className="adm-card-sub">합계 <b className="text-[#191F28]">{fmt(total)}</b></p>
        </div>
        <div className="adm-seg" role="tablist" aria-label="지표">
          {METRICS.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={x.key === metric} onClick={() => setMetric(x.key)} className={x.key === metric ? 'on' : ''}>
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <div className="adm-bars" key={metric} onMouseLeave={() => setHover(null)}>
        {points.map((p, i) => {
          const v = values[i];
          const h = Math.max(3, (v / max) * 100);
          const on = hover === i;
          return (
            <div key={`${p.date}-${i}`} className={`adm-bar ${on ? 'on' : ''}`} onMouseEnter={() => setHover(i)}>
              {on && <span className={`adm-bar-tip ${i < 2 ? 'l' : i > points.length - 3 ? 'r' : ''}`} style={{ bottom: `calc(${h}% + 8px)` }}>{p.date} · {fmt(v)}</span>}
              <span className="adm-bar-fill" style={{ height: `${h}%`, background: m.color, animationDelay: `${i * 0.035}s` }} />
            </div>
          );
        })}
      </div>
      <div className="adm-bars-axis">
        <span>{points[0]?.date || ''}</span>
        <span>{points[points.length - 1]?.date || ''}</span>
      </div>
    </div>
  );
}

/** 할 일 — 지금 손댈 것만, 누르면 그 화면으로 */
function TodoCard({ items }: { items: Array<{ label: string; value: string; sub?: string; href: string; tone: 'orange' | 'blue' | 'red' | 'gray'; urgent?: boolean }> }) {
  return (
    <div className="adm-card">
      <div className="adm-card-head">
        <h2 className="adm-card-title">할 일</h2>
      </div>
      <div className="adm-todo">
        {items.map((it) => (
          <Link key={it.label} href={it.href} className="adm-todo-row">
            <span className={`adm-todo-dot ${it.tone} ${it.urgent ? 'pulse' : ''}`} />
            <span className="min-w-0 flex-1">
              <span className="adm-todo-label">{it.label}</span>
              {it.sub && <span className="adm-todo-sub">{it.sub}</span>}
            </span>
            <span className={`adm-todo-value ${it.urgent ? it.tone : ''}`}>{it.value}</span>
            <LineChevron />
          </Link>
        ))}
      </div>
    </div>
  );
}

/** 전환 퍼널 — 단계마다 막대(첫 단계 대비) + 앞 단계 대비 전환율 */
function Funnel({ steps }: { steps: Array<{ label: string; value: number }> }) {
  const top = Math.max(steps[0]?.value || 0, 1);
  return (
    <div className="adm-card">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title">전환 퍼널</h2>
          <p className="adm-card-sub">프로필 조회부터 결제까지, 앞 단계 대비 몇 %가 넘어왔는지</p>
        </div>
      </div>
      <div className="adm-funnel">
        {steps.map((s, i) => {
          const prev = i > 0 ? steps[i - 1].value : 0;
          const rate = i > 0 && prev > 0 ? (s.value / prev) * 100 : null;
          return (
            <div key={s.label} className="adm-funnel-row">
              <span className="adm-funnel-label"><AdminTerm term={s.label}>{s.label}</AdminTerm></span>
              <span className="adm-funnel-track">
                <span className="adm-funnel-fill" style={{ width: `${Math.max(2, (s.value / top) * 100)}%`, animationDelay: `${0.1 + i * 0.06}s` }} />
              </span>
              <span className="adm-funnel-n">{formatNumber(s.value)}</span>
              {/* 한 요청이 여러 사회자에게 전달돼 100% 를 넘으면 배수로(전달 ×5.1) */}
              <span className="adm-funnel-rate">{rate == null ? '' : rate > 100 ? `×${(rate / 100).toFixed(1)}` : `${rate.toFixed(1)}%`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 답장 시간 — 초 → '40초' · '3분' · '1시간 20분' */
function fmtSec(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec)) return null;
  if (sec < 60) return `${Math.max(1, Math.round(sec))}초`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}시간 ${mm}분` : `${h}시간`;
}

/** 사회자별 답장 속도(최근 7일, 견적 도착 → 답장 통상 시간 median) — 채팅 매칭 '응답 현황'과 같은 값 */
type RespInfo = { name: string; medianSec: number | null; repliedCount: number; totalRooms: number };
const GOOD_REPLY_SEC = 300;

function ReplyChip({ r }: { r?: RespInfo }) {
  if (!r) return null;
  const t = fmtSec(r.medianSec);
  if (!t) return <span className="adm-reply none">{r.totalRooms ? '답장 기록 없음' : '요청 없음'}</span>;
  return <span className={`adm-reply ${(r.medianSec ?? 0) <= GOOD_REPLY_SEC ? 'good' : 'slow'}`}>답장 보통 {t}</span>;
}

/** 사회자 TOP 5 — 매출 / 조회 / 응답 빠른 순(261004 사장 '얼마 만에 응답하는지도') */
function TopPros({ viewed, revenue, resp }: { viewed: TopListItem[]; revenue: TopListItem[]; resp: Map<string, RespInfo> | null }) {
  const [tab, setTab] = useState<'revenue' | 'viewed' | 'reply'>('revenue');
  const replyTop = useMemo(() => {
    if (!resp) return [];
    return Array.from(resp.entries())
      .filter(([, r]) => r.medianSec != null && r.repliedCount > 0)
      .sort((a, b) => (a[1].medianSec! - b[1].medianSec!) || (b[1].repliedCount - a[1].repliedCount))
      .slice(0, 5)
      .map(([id, r]) => ({ id, name: r.name, value: r.medianSec || 0, count: r.repliedCount }));
  }, [resp]);
  const items: TopListItem[] = (tab === 'viewed' ? viewed : tab === 'revenue' ? revenue : replyTop).slice(0, 5);
  const max = Math.max(...items.map((x) => toNumber(x.value)), 1);
  const fastest = Math.max(1, Math.min(...replyTop.map((x) => x.value || 1)));
  return (
    <div className="adm-card">
      <div className="adm-card-head">
        <h2 className="adm-card-title">사회자 TOP 5</h2>
        <div className="adm-seg" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'revenue'} className={tab === 'revenue' ? 'on' : ''} onClick={() => setTab('revenue')}>매출</button>
          <button type="button" role="tab" aria-selected={tab === 'viewed'} className={tab === 'viewed' ? 'on' : ''} onClick={() => setTab('viewed')}>조회</button>
          <button type="button" role="tab" aria-selected={tab === 'reply'} className={tab === 'reply' ? 'on' : ''} onClick={() => setTab('reply')}>응답</button>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="adm-empty">{tab === 'reply' && !resp ? '응답 기록을 불러오는 중이에요' : '아직 데이터가 없어요'}</p>
      ) : (
        <div className="adm-top" key={tab}>
          {items.map((it, i) => {
            const r = resp?.get(it.id);
            const w = tab === 'reply' ? (fastest / Math.max(1, toNumber(it.value))) * 100 : (toNumber(it.value) / max) * 100;
            return (
              <div key={it.id} className="adm-top-row" style={{ animationDelay: `${i * 0.05}s` }}>
                <span className={`adm-top-rank ${i < 3 ? 'hi' : ''}`}>{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="adm-top-name">
                    {it.name}
                    {tab !== 'reply' && <ReplyChip r={r} />}
                  </span>
                  <span className={`adm-top-bar ${tab === 'reply' ? 'green' : ''}`}><span style={{ width: `${Math.max(4, w)}%` }} /></span>
                </span>
                <span className="adm-top-val">
                  {tab === 'revenue' ? formatMoney(it.value) : tab === 'viewed' ? `${formatNumber(it.value)}회` : `보통 ${fmtSec(toNumber(it.value))}`}
                  {tab === 'revenue' && it.count ? <small>{formatNumber(it.count)}건</small> : null}
                  {tab === 'reply' && it.count ? <small>답장 {formatNumber(it.count)}건</small> : null}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <p className="adm-top-foot">답장 시간 = 최근 7일 견적 요청 도착 → 첫 답장까지 걸린 통상 시간</p>
    </div>
  );
}

/** 랜딩 유입 요약 — 자체 로드 */
function LandingCard() {
  const [d, setD] = useState<{ today?: { visits: number; conversions: number }; totalVisits?: number; totalConversions?: number } | null>(null);
  useEffect(() => {
    const from = new Date(Date.now() - 7 * 86400000).toISOString();
    adminFetch('GET', `/api/v1/admin/landing-analytics?from=${encodeURIComponent(from)}`, undefined, { cache: false })
      .then(setD).catch(() => setD(null));
  }, []);
  const rows = [
    { label: '오늘 방문', value: d?.today?.visits ?? 0, unit: '회' },
    { label: '오늘 견적', value: d?.today?.conversions ?? 0, unit: '건' },
    { label: '7일 방문', value: d?.totalVisits ?? 0, unit: '회' },
    { label: '7일 견적', value: d?.totalConversions ?? 0, unit: '건' },
  ];
  return (
    <Link href="/admin/landing-analytics" className="adm-card adm-card-link">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title">랜딩 유입</h2>
          <p className="adm-card-sub">wedding-mc · corporate-mc</p>
        </div>
        <LineChevron size={20} />
      </div>
      <div className="adm-mini-grid">
        {rows.map((r) => (
          <div key={r.label} className="adm-mini">
            <p>{r.label}</p>
            <b>{d ? <CountUp value={r.value} suffix={r.unit} /> : '…'}</b>
          </div>
        ))}
      </div>
    </Link>
  );
}

/* ── 지출 · 수입 줄 — 토스 지출/수입 화면 그대로, 박스 없이(261004 사장 '홈에 이거 넣어줘 UI 그대로 · 섹션 풀어서') ──
 *  수입 = 결제 완료, 지출 = 사회자 정산 지급 + 환불(서버 money-summary, 지난달 1일 ~ 오늘 KST 날마다).
 *  '지난달보다 N만원 더(덜) 버는 중' = 이번 달 오늘까지 수입 누적 − 지난달 같은 날까지 누적. 오른쪽 작은 선 = 지난달 누적(회색)
 *  위에 이번 달 누적(색) + 오늘 점. 아래 = 이번 주 요일·날짜(오늘 칸 강조) + 날마다 순액(수입 − 지출), ⌄ 로 이번 달 달력. */
type MoneyDay = { date: string; income: number; expense: number };
type MoneySummary = { today: string; thisMonth: string; lastMonth: string; daily: MoneyDay[] };

const WEEK_KO = ['일', '월', '화', '수', '목', '금', '토'];
const won = (n: number) => `${Math.round(Math.abs(n)).toLocaleString('ko-KR')}`;
const signed = (n: number) => (n > 0 ? `+${won(n)}` : n < 0 ? `-${won(n)}` : '0');
const ymdUTC = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

function MoneySpark({ last, cur, color }: { last: number[]; cur: number[]; color: string }) {
  const W = 150;
  const H = 66;
  const n = Math.max(last.length, cur.length, 2);
  const max = Math.max(...last, ...cur, 1);
  const x = (i: number) => 4 + (i / (n - 1)) * (W - 8);
  const y = (v: number) => H - 6 - (v / max) * (H - 16);
  const path = (arr: number[]) => arr.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const lastPts = path(last);
  const curPts = path(cur);
  const ex = cur.length ? x(cur.length - 1) : 0;
  const ey = cur.length ? y(cur[cur.length - 1]) : 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="adm-money-spark" aria-hidden>
      <defs>
        <linearGradient id="admMoneyArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B0B8C1" stopOpacity=".22" />
          <stop offset="100%" stopColor="#B0B8C1" stopOpacity="0" />
        </linearGradient>
      </defs>
      {last.length > 1 && <polygon points={`${x(0)},${H} ${lastPts} ${x(last.length - 1)},${H}`} fill="url(#admMoneyArea)" />}
      {last.length > 1 && <polyline points={lastPts} fill="none" stroke="#D1D6DB" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
      {cur.length > 1 && <polyline points={curPts} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="adm-spark-line" />}
      {cur.length > 0 && (
        <>
          <circle cx={ex} cy={ey} r="12" fill={color} opacity=".18" className="adm-money-halo" />
          <circle cx={ex} cy={ey} r="5" fill={color} />
        </>
      )}
    </svg>
  );
}

function MoneyBlock({ data }: { data: MoneySummary }) {
  const [open, setOpen] = useState(false);
  const byDate = useMemo(() => new Map(data.daily.map((d) => [d.date, d])), [data]);
  const [ty, tm, td] = data.today.split('-').map(Number);
  const thisDays = data.daily.filter((d) => d.date.startsWith(data.thisMonth));
  const lastDays = data.daily.filter((d) => d.date.startsWith(data.lastMonth));
  const income = thisDays.reduce((a, d) => a + d.income, 0);
  const expense = thisDays.reduce((a, d) => a + d.expense, 0);
  const cum = (arr: MoneyDay[]) => { let c = 0; return arr.map((d) => (c += d.income)); };
  const curCum = cum(thisDays);
  const lastCum = cum(lastDays);
  const sameDay = Math.min(td, lastCum.length) - 1;
  const diff = (curCum[curCum.length - 1] || 0) - (sameDay >= 0 ? lastCum[sameDay] : 0);
  const man = Math.round(Math.abs(diff) / 10000);
  const up = diff >= 0;
  const color = up ? '#3182F6' : '#F04452';

  // 이번 주(일~토) — 오늘이 든 주
  const todayUTC = Date.UTC(ty, tm - 1, td);
  const weekStart = todayUTC - new Date(todayUTC).getUTCDay() * 86400000;
  const week = Array.from({ length: 7 }, (_, i) => new Date(weekStart + i * 86400000));
  // 이번 달 달력(⌄ 펼치면)
  const firstDow = new Date(Date.UTC(ty, tm - 1, 1)).getUTCDay();
  const daysIn = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  const monthCells = Array.from({ length: Math.ceil((firstDow + daysIn) / 7) * 7 }, (_, k) => {
    const day = k - firstDow + 1;
    return day >= 1 && day <= daysIn ? new Date(Date.UTC(ty, tm - 1, day)) : null;
  });

  const Cell = ({ d, showLabel }: { d: Date | null; showLabel?: boolean }) => {
    if (!d) return <span className="adm-money-cell" />;
    const key = ymdUTC(d);
    const row = byDate.get(key);
    const isToday = key === data.today;
    const future = key > data.today;
    const net = row ? row.income - row.expense : 0;
    return (
      <span className={`adm-money-cell ${isToday ? 'today' : ''} ${future ? 'future' : ''}`}>
        <span className="adm-money-day">
          {showLabel && <span className="adm-money-wd">{WEEK_KO[d.getUTCDay()]}</span>}
          <span className="adm-money-date">{d.getUTCDate()}</span>
        </span>
        <span className={`adm-money-net ${net > 0 ? 'plus' : ''}`}>{!future && row && net !== 0 ? signed(net) : ''}</span>
      </span>
    );
  };

  return (
    <section className="adm-money" aria-label="이번 달 지출·수입">
      <div className="adm-money-top">
        <div className="adm-money-col" title="사회자 정산 지급 + 환불">
          <p className="adm-money-label">지출</p>
          <p className="adm-money-value">{expense ? '-' : ''}<CountUp value={expense} />원</p>
        </div>
        <div className="adm-money-col" title="결제 완료 금액">
          <p className="adm-money-label">수입</p>
          <p className="adm-money-value">{income ? '+' : ''}<CountUp value={income} />원</p>
        </div>
      </div>
      <div className="adm-money-line" />
      <div className="adm-money-mid">
        <div className="min-w-0">
          <p className="adm-money-say">
            {man === 0 ? (
              <>지난달과 비슷하게 버는 중</>
            ) : (
              <>지난달보다 <b style={{ color }}>{man.toLocaleString('ko-KR')}만원</b> {up ? '더' : '덜'} 버는 중</>
            )}
          </p>
          <Link href="/admin/payments" className="adm-money-link">
            결제·정산 내역 보기 <LineChevron size={18} color="#8B95A1" />
          </Link>
        </div>
        <MoneySpark last={lastCum} cur={curCum} color={color} />
      </div>

      {!open ? (
        <div className="adm-money-week" key="week">
          {week.map((d) => <Cell key={ymdUTC(d)} d={d} showLabel />)}
        </div>
      ) : (
        <div className="adm-money-month" key="month">
          <div className="adm-money-week head">
            {WEEK_KO.map((w) => <span key={w} className="adm-money-cell"><span className="adm-money-wd">{w}</span></span>)}
          </div>
          {Array.from({ length: monthCells.length / 7 }, (_, r) => (
            <div key={r} className="adm-money-week row" style={{ animationDelay: `${r * 0.05}s` }}>
              {monthCells.slice(r * 7, r * 7 + 7).map((d, i) => <Cell key={d ? ymdUTC(d) : `e${r}-${i}`} d={d} />)}
            </div>
          ))}
        </div>
      )}
      <button type="button" className={`adm-money-more ${open ? 'on' : ''}`} onClick={() => setOpen((v) => !v)} aria-label={open ? '이번 주만 보기' : '이번 달 달력 보기'} aria-expanded={open}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="#6B7684" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </section>
  );
}

export default function AdminDashboardPage() {
  const authUser = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async (force = false) => {
    setLoading(true);
    try {
      const data = await adminFetch('GET', '/api/v1/admin/stats', undefined, {
        cache: !force,
        cacheTtl: 6000,
      });
      setStats(data);
    } catch (e: any) {
      try {
        const fallbackStats = await fetchFallbackStats();
        setStats(fallbackStats);
        if (force) toast.success('대체 통계로 새로고침했어요');
      } catch (fallbackError: any) {
        const msg = fallbackError?.response?.data?.message || fallbackError?.message || e?.response?.data?.message || e?.message || '알 수 없는 오류';
        const status = fallbackError?.response?.status || e?.response?.status;
        toast.error(`통계 로드 실패${status ? ` (${status})` : ''}: ${msg}`, { duration: 6000 });
      }
    } finally {
      setLoading(false);
    }
  };

  // 사회자별 답장 속도 — TOP 5 에 붙인다(채팅 매칭 응답 현황과 같은 API)
  const [resp, setResp] = useState<Map<string, RespInfo> | null>(null);
  const fetchResp = async () => {
    try {
      const d: any = await adminFetch('GET', '/api/v1/admin/chat-response-stats?limit=60', undefined, { cache: false });
      const rows: any[] = Array.isArray(d?.data) ? d.data : [];
      setResp(new Map(rows.map((r) => [String(r.proProfileId), {
        name: r.proName || '-',
        medianSec: r.medianSec ?? null,
        repliedCount: Number(r.repliedCount ?? r.responded ?? 0),
        totalRooms: Number(r.totalRooms ?? 0),
      }])));
    } catch {
      setResp(new Map());
    }
  };

  // 지출·수입 줄(서버 money-summary) — 실패(옛 서버 등)면 줄을 숨긴다
  const [money, setMoney] = useState<MoneySummary | null | 'error'>(null);
  const fetchMoney = async () => {
    try {
      const d: any = await adminFetch('GET', '/api/v1/admin/money-summary', undefined, { cache: false });
      setMoney(Array.isArray(d?.daily) && d?.today ? d : 'error');
    } catch {
      setMoney('error');
    }
  };

  useEffect(() => { fetchStats(); fetchResp(); fetchMoney(); }, []);
  // 머리 오른쪽 새로고침(종 옆)
  useAdminRefresh(() => { fetchStats(true); fetchResp(); fetchMoney(); });

  const series = stats?.dailySeries?.length ? stats.dailySeries : createEmptyDailySeries();
  const pick = (k: DailyMetricKey) => series.map((p) => toNumber(p[k]));
  const today = new Date();
  const dateLine = `${today.getMonth() + 1}월 ${today.getDate()}일 ${['일', '월', '화', '수', '목', '금', '토'][today.getDay()]}요일`;

  const todo = useMemo(() => {
    if (!stats) return [];
    const pendingPros = toNumber(stats.pendingPros);
    const pendingSet = toNumber(stats.settlements?.pending);
    const payCheck = toNumber(stats.payments?.pending) + toNumber(stats.payments?.failed);
    const openReq = toNumber(stats.matchRequests?.open);
    return [
      { label: '사회자 승인 대기', value: `${formatNumber(pendingPros)}명`, sub: '프로필 검토 후 승인·반려', href: '/admin/pros', tone: 'orange' as const, urgent: pendingPros > 0 },
      { label: '정산 대기', value: `${formatNumber(pendingSet)}건`, sub: formatMoney(stats.settlements?.pendingAmount), href: '/admin/settlements', tone: 'orange' as const, urgent: pendingSet > 0 },
      { label: '결제 확인', value: `${formatNumber(payCheck)}건`, sub: '결제 대기 · 실패', href: '/admin/payments', tone: 'red' as const, urgent: false },
      { label: '진행 중인 견적 요청', value: `${formatNumber(openReq)}건`, sub: '사회자 답장을 기다리는 요청', href: '/admin/chat-connections', tone: 'blue' as const, urgent: false },
    ];
  }, [stats]);

  const funnel = useMemo(() => {
    if (!stats) return [];
    return [
      { label: '프로필 조회', value: toNumber(stats.funnel?.profileViews) },
      { label: '요청 생성', value: toNumber(stats.funnel?.matchRequests) },
      { label: '전달', value: toNumber(stats.funnel?.deliveries) },
      { label: '응답', value: toNumber(stats.funnel?.repliedDeliveries) },
      { label: '채팅방', value: toNumber(stats.funnel?.chatRooms) },
      { label: '견적', value: toNumber(stats.funnel?.quotations) },
      { label: '결제완료', value: toNumber(stats.funnel?.completedPayments) },
    ];
  }, [stats]);

  return (
    <div className="adm-home">
      {/* 인사 */}
      <div className="adm-hello">
        <div>
          <p className="adm-hello-date">{dateLine}</p>
          <h1 className="adm-hello-title">안녕하세요, {authUser?.name || '관리자'}님</h1>
          <p className="adm-hello-sub">오늘의 프리티풀 운영 현황이에요</p>
        </div>
      </div>

      {money === null ? (
        <div className="adm-skel h-[300px] rounded-[20px]" />
      ) : money !== 'error' ? (
        <MoneyBlock data={money} />
      ) : null}

      {loading && !stats ? (
        <div className="adm-grid grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="adm-skel h-[150px] rounded-[20px]" />)}
        </div>
      ) : stats && (
        <>
          {stats.degraded && (
            <p className="adm-note">통계 서버 응답이 없어 목록 데이터로 대신 계산했어요(일부 숫자는 0 으로 보일 수 있어요)</p>
          )}
          <div className="adm-grid grid-cols-2 xl:grid-cols-4">
            <Kpi label="오늘 매출" value={toNumber(stats.revenue?.today)} money sub={<>7일 {formatMoney(stats.revenue?.last7d)}</>} series={pick('revenue')} color="#3182F6" href="/admin/payments" />
            <Kpi label="오늘 신규 가입" value={toNumber(stats.newUsersToday)} suffix="명" sub={<>7일 {formatNumber(stats.newUsers7d)}명</>} series={pick('users')} color="#03B26C" href="/admin/users" />
            <Kpi label="누적 매출" value={toNumber(stats.revenue?.total ?? stats.totalRevenue)} money sub={<>결제 완료 {formatNumber(stats.payments?.completed)}건</>} series={pick('payments')} color="#7B4DFF" href="/admin/payments" />
            <Kpi label="정산 대기" value={toNumber(stats.settlements?.pending)} suffix="건" sub={<>보낼 금액 {formatMoney(stats.settlements?.pendingAmount)}</>} color="#F46A00" href="/admin/settlements" />
          </div>

          <div className="adm-grid adm-home-row">
            <TodoCard items={todo} />
            <TrendChart points={series} />
          </div>

          <div className="adm-grid adm-home-row2">
            <Funnel steps={funnel} />
            <div className="adm-stack">
              <TopPros viewed={stats.topLists?.viewedPros || []} revenue={stats.topLists?.revenuePros || []} resp={resp} />
              <LandingCard />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
