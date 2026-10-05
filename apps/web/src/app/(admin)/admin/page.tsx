'use client';

import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/auth.store';
import { adminFetch } from './_components/adminFetch';
import { LineChevron, useAdminRefresh } from './_components/adminRefresh';
import { AdminCollapse } from './_components/AdminCollapse';
import { AdminMoneyCalendar, type MoneyDay, type MoneySummary } from './_components/AdminMoneyCalendar';
import { RollingNumber } from './_components/AdminNumber';

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





const METRICS: Array<{ key: DailyMetricKey; label: string; money?: boolean; unit: string; color: string }> = [
  { key: 'revenue', label: '매출', money: true, unit: '', color: '#3182F6' },
  { key: 'users', label: '가입', unit: '명', color: '#03B26C' },
  { key: 'matchRequests', label: '견적 요청', unit: '건', color: '#F46A00' },
  { key: 'payments', label: '결제', unit: '건', color: '#7B4DFF' },
];

/** 14일 막대(261005 사장 시안) — 막대는 연회색(#F2F4F6), 고른 막대(기본 = 오늘, 올리면 그날)만 파란 방사 그라데이션.
 *  막대 위 값(고른 막대 #1B64DA · 나머지 #8B95A1), 아래 날짜(#6B7684). 지표를 바꾸면 차례로 다시 자라 오른다. */
function TrendChart({ points }: { points: DailyPoint[] }) {
  const [metric, setMetric] = useState<DailyMetricKey>('revenue');
  const m = METRICS.find((x) => x.key === metric) || METRICS[0];
  const values = points.map((p) => toNumber(p[metric]));
  const max = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);
  const fmt = (v: number) => (m.money ? formatMoney(v) : `${formatNumber(v)}${m.unit}`);
  // 막대 위 짧은 값 — 매출은 만원 단위
  const short = (v: number) => (m.money ? (v >= 10000 ? `${formatNumber(Math.round(v / 10000))}만` : formatNumber(v)) : formatNumber(v));
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? points.length - 1;
  return (
    <div className="adm-card">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title">최근 14일 {m.label}</h2>
          <p className="adm-card-sub">
            합계 <b className="text-[#191F28]">{fmt(total)}</b>
            {points[active] && <> · {points[active].date} <b className="text-[#1B64DA]">{fmt(values[active])}</b></>}
          </p>
        </div>
        <div className="adm-seg" role="tablist" aria-label="지표">
          {METRICS.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={x.key === metric} onClick={() => setMetric(x.key)} className={x.key === metric ? 'on' : ''}>
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <div className="adm-vbars" key={metric} onMouseLeave={() => setHover(null)}>
        {points.map((p, i) => {
          const v = values[i];
          const h = Math.max(4, (v / max) * 100);
          const on = i === active;
          return (
            <div key={`${p.date}-${i}`} className={`adm-vbar ${on ? 'on' : ''}`} onMouseEnter={() => setHover(i)} title={`${p.date} · ${fmt(v)}`}>
              <div className="adm-vbar-plot">
                <span className="adm-vbar-col" style={{ height: `${h}%`, animationDelay: `${i * 0.035}s` }}>
                  <span className="adm-vbar-val" style={{ animationDelay: `${0.25 + i * 0.035}s` }}>{short(v)}</span>
                  <span className="adm-vbar-fill" />
                </span>
              </div>
              <span className="adm-vbar-label">{p.date}</span>
            </div>
          );
        })}
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
        {items.map((it) => {
          // 0명·0건이면 회색 점(할 일이 없다는 뜻 — 261005 사장)
          const none = /^0\D*$/.test(it.value.replace(/,/g, '').trim());
          return (
          <Link key={it.label} href={it.href} className="adm-todo-row">
            <span className={`adm-todo-dot ${none ? 'gray' : it.tone} ${it.urgent && !none ? 'pulse' : ''}`} />
            <span className="min-w-0 flex-1">
              <span className="adm-todo-label">{it.label}</span>
              {it.sub && <span className="adm-todo-sub">{it.sub}</span>}
            </span>
            <span className={`adm-todo-value ${it.urgent && !none ? it.tone : ''}`}>{it.value}</span>
            <LineChevron />
          </Link>
          );
        })}
      </div>
    </div>
  );
}

/** 전환 퍼널(261005 사장) — 홈 방문 → 퀵매칭 페이지 → 견적 요청 → 사회자와 대화 → 견적 받음 → 결제 완료.
 *  단계마다 앞 단계에서 몇 %가 넘어오고 몇 명이 빠지는지 위에서부터 차례로. 견적 요청부터는 같은 사람들을 따라간다(서버 admin-funnel). */
type FunnelStep = { key: string; label: string; unit: string; basis: 'session' | 'user'; value: number; sub: string };
type FunnelData = { days: number; from: string; steps: FunnelStep[]; paidOutsideFunnel: number; trackingSince: { home: string | null; quickMatch: string | null } };

/** 단계 이름 — 시안 '여섯 글자 이내' */
const STEP_SHORT: Record<string, string> = { home: '홈 방문', quickMatch: '퀵매칭', request: '견적 요청', talk: '사회자 대화', quote: '견적 받음', paid: '결제 완료' };

/** 단계 그림(261005 사장 제공 6장, 3:2 → public/admin/funnel/*.webp 960×640) + 막 색 = 그림 아래쪽(4:3 으로 자른 아래 절반) 평균 색.
 *  key·sub·ink = 그림의 키 컬러(가장 많이 보이는 뚜렷한 색 — lib/image-tone 과 같은 셈: 홈 보라 260° · 퀵매칭 연두 84° · 요청 파랑 213° ·
 *  대화 분홍 339° · 견적 초록 157° · 결제 남색 229°)로 칠한 글자 — 홈 사회자 카드처럼(261005 사장 '퍼센트랑 텍스트를 이미지의 키컬러로').
 *  key = 비율(흰 반투명 알약 위 4.5:1 이상) · sub = 단계 이름·단위(막 위 7:1) · ink = 사람 수. */
const FUNNEL_ART: Record<string, { src: string; tint: string; key: string; sub: string; ink: string }> = {
  home: { src: '/admin/funnel/01-home.webp', tint: '#E6DEFA', key: '#6530CF', sub: '#503E74', ink: '#2A1C45' },
  quickMatch: { src: '/admin/funnel/02-quick-match.webp', tint: '#EAF0E0', key: '#587B24', sub: '#44532D', ink: '#35451C' },
  request: { src: '/admin/funnel/03-request.webp', tint: '#DFECFB', key: '#2E70C2', sub: '#374D67', ink: '#1C2E45' },
  talk: { src: '/admin/funnel/04-talk.webp', tint: '#F6E7EB', key: '#CF3068', sub: '#713D4F', ink: '#451C2A' },
  quote: { src: '/admin/funnel/05-quote.webp', tint: '#DEECE6', key: '#257E5C', sub: '#2D5344', ink: '#1C4535' },
  paid: { src: '/admin/funnel/06-paid.webp', tint: '#D7DDF7', key: '#304DCF', sub: '#39426A', ink: '#1C2445' },
};
const FUNNEL_TINT_FALLBACK = '#E8F3FF';

/** '#RRGGBB' → rgba(…, a) */
function tintAlpha(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** 앞 단계 대비 — '×1.2' · '21%' · '4.5%' */
function fmtRate(rate: number): string {
  return rate > 100 ? `×${(rate / 100).toFixed(1)}` : `${rate.toFixed(rate < 10 ? 1 : 0)}%`;
}

/** 전환 퍼널 카드(261005 사장 '각 단계마다 이 이미지 — 프리티풀 공지사항 카드처럼, 하단에 그라데이션 블러').
 *  공지 뉴스룸 카드 어법: 4:3 · 그림 가득(cover) · 아래 그라데이션 블러(backdrop blur + 위로 옅어지는 마스크) + 카드 자기 색 막.
 *  카드 = 단계 이름 · 앞 단계 대비 % · 사람 수(다이얼 숫자). 글자·비율은 그 그림의 키 컬러(FUNNEL_ART key·sub·ink).
 *  고르기는 없다(같은 날 사장 '123456 선택하는 거 없애고 · 아래 상세 칸 빼고') — 여섯 칸을 그대로 보여 준다.
 *  배치 = 카드 칸 폭(컨테이너 쿼리) — 넓으면 3×2, 좁으면 2열, 폰 폭이면 옆으로 넘기는 줄.
 *  애니메이션은 '보일 때' 시작한다 — 퍼널은 늘 첫 화면 아래라 마운트 때 돌리면 내려왔을 땐 다 끝나 있었다.
 *   · 카드 등장 = 그 카드가 조금이라도 보이면(같이 들어온 카드끼리만 차례 지연)
 *   · 다이얼 숫자 = 그 카드가 거의 다(80%) 보이면 0 에서 굴러감(그 전엔 숫자 칸을 비워 둠 — 줄 모드에서 옆 카드가 살짝 보일 때도)
 *  visitsPartial = 방문 기록이 기간 중간부터(261005~) — 방문(세션) → 견적 요청(사람) 비율은 뜻이 없어 '기록 중'. */
const FC_ROLL_RATIO = 0.8;
function FunnelCards({ steps, visitsPartial }: { steps: FunnelStep[]; visitsPartial: boolean }) {
  const reduce = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
  const gridRef = useRef<HTMLDivElement>(null);
  // 카드별 — reveal[i] = 등장 지연(초, null = 아직 안 보임) · rolled[i] = 숫자까지 보여 다이얼을 굴렸다. 동작 줄이기면 처음부터 다 보임.
  const [reveal, setReveal] = useState<(number | null)[]>(() => steps.map(() => (reduce ? 0 : null)));
  const [rolled, setRolled] = useState<boolean[]>(() => steps.map(() => reduce));
  useEffect(() => {
    if (reduce) return;
    const grid = gridRef.current;
    if (!grid) return;
    if (typeof IntersectionObserver === 'undefined') {
      setReveal(steps.map(() => 0));
      setRolled(steps.map(() => true));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      const shown: number[] = [];
      const full: number[] = [];
      entries.forEach((e) => {
        const i = Number((e.target as HTMLElement).dataset.i);
        if (!e.isIntersecting || !Number.isInteger(i)) return;
        shown.push(i);
        if (e.intersectionRatio >= FC_ROLL_RATIO - 0.01) full.push(i);
      });
      if (shown.length) {
        setReveal((prev) => {
          let k = 0;
          const next = prev.slice();
          shown.sort((a, b) => a - b).forEach((i) => { if (next[i] == null) next[i] = 0.04 + 0.06 * k++; });
          return k ? next : prev;
        });
      }
      if (full.length) {
        setRolled((prev) => {
          if (full.every((i) => prev[i])) return prev;
          const next = prev.slice();
          full.forEach((i) => { next[i] = true; });
          return next;
        });
      }
    }, { root: grid.closest('.adm-main'), threshold: [0, FC_ROLL_RATIO] });
    Array.from(grid.children).forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [reduce, steps]);
  if (!steps.length) return null;
  return (
    <div className="adm-fc-wrap">
      <div ref={gridRef} className="adm-fc-grid">
        {steps.map((s, i) => {
          const art = FUNNEL_ART[s.key];
          const tint = art?.tint || FUNNEL_TINT_FALLBACK;
          const p = i > 0 ? steps[i - 1] : null;
          const visitGap = !!p && p.basis === 'session' && s.basis === 'user' && visitsPartial;
          const r = p && p.value > 0 && !visitGap ? (s.value / p.value) * 100 : null;
          const rateText = !p ? null : visitGap || (p.value === 0 && p.basis === 'session') ? '기록 중' : r == null ? null : fmtRate(r);
          const name = STEP_SHORT[s.key] || s.label;
          const style: Record<string, string> = {};
          if (art) { style['--fc-key'] = art.key; style['--fc-sub'] = art.sub; style['--fc-ink'] = art.ink; }
          if (reveal[i] != null) style.animationDelay = `${reveal[i]}s`;
          return (
            <div
              key={s.key}
              className="adm-fc"
              data-i={i}
              data-shown={reveal[i] != null ? '' : undefined}
              style={style}
              role="group"
              aria-label={`${i + 1}단계 ${s.label} ${formatNumber(s.value)}${s.unit}${rateText && r != null ? ` · 앞 단계의 ${rateText}` : ''}`}
            >
              <span className="adm-fc-box" style={{ backgroundColor: tint }}>
                {art && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="adm-fc-img" src={art.src} alt="" draggable={false} decoding="async" />
                )}
                <span className="adm-fc-blur" aria-hidden="true" />
                <span
                  className="adm-fc-veil"
                  aria-hidden="true"
                  style={{ background: `linear-gradient(to bottom, ${tintAlpha(tint, 0)} 0%, ${tintAlpha(tint, 0.5)} 48%, ${tintAlpha(tint, 0.72)} 100%)` }}
                />
                <span className="adm-fc-text" aria-hidden="true">
                  <span className="adm-fc-meta">
                    <span className="adm-fc-name">{name}</span>
                    {rateText && <span className="adm-fc-rate" title={r != null ? `앞 단계(${STEP_SHORT[p!.key] || p!.label})의 ${rateText}` : undefined}>{rateText}</span>}
                  </span>
                  {/* 숫자는 카드가 거의 다 보일 때 0 에서 굴러온다(그 전엔 칸만 차지 — 줄 높이 그대로) */}
                  <span className="adm-fc-value" style={rolled[i] ? undefined : { visibility: 'hidden' }}>
                    {rolled[i] ? <RollingNumber value={s.value} /> : <span className="adm-roll">{formatNumber(s.value)}</span>}
                    <small>{s.unit}</small>
                  </span>
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 전환 퍼널 — 박스 없이 풀어서 한 줄 전체(261005 사장 '섹션 풀어 주고'). 아래 요약·방문 기록 안내 칸은 뺐다(같은 날 '캡처한 부분 없애 주고'). */
function JourneyFunnel() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<FunnelData | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback((d: number) => {
    setError(false);
    adminFetch('GET', `/api/v1/admin/funnel?days=${d}`, undefined, { cache: false })
      .then((r: FunnelData) => setData(r))
      .catch(() => setError(true));
  }, []);
  useEffect(() => { load(days); }, [days, load]);
  useAdminRefresh(() => load(days));

  const steps = data?.steps || [];
  // 방문 기록은 261005 부터 — 기간 시작보다 늦게 시작했으면 방문 → 견적 요청 비율은 '기록 중'
  const since = data?.trackingSince?.home || data?.trackingSince?.quickMatch || null;
  const visitsPartial = !!data && (!since || new Date(since) > new Date(data.from));

  return (
    <section className="adm-jf2" aria-label="전환 퍼널">
      <div className="adm-jf2-head">
        <div className="min-w-0">
          <h2 className="adm-jf2-title">전환 퍼널</h2>
          <p className="adm-jf2-sub">단계마다 몇 명이 남고 몇 명이 빠지는지 — 최근 {days}일</p>
        </div>
        <div className="adm-seg on-bg" role="tablist" aria-label="기간">
          {[7, 30, 90].map((d) => (
            <button key={d} type="button" role="tab" aria-selected={days === d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{d}일</button>
          ))}
        </div>
      </div>
      {error ? (
        <p className="adm-empty">퍼널을 불러오지 못했어요</p>
      ) : !data ? (
        <div className="adm-fc-wrap"><div className="adm-fc-grid">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="adm-fc-skel" />)}</div></div>
      ) : (
        <FunnelCards key={days} steps={steps} visitsPartial={visitsPartial} />
      )}
    </section>
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
  /** 펼치기 — 기본 5명, 펼치면 20명까지(261005 사장) */
  const [open, setOpen] = useState(false);
  const replyTop = useMemo(() => {
    if (!resp) return [];
    return Array.from(resp.entries())
      .filter(([, r]) => r.medianSec != null && r.repliedCount > 0)
      .sort((a, b) => (a[1].medianSec! - b[1].medianSec!) || (b[1].repliedCount - a[1].repliedCount))
      .slice(0, 20)
      .map(([id, r]) => ({ id, name: r.name, value: r.medianSec || 0, count: r.repliedCount }));
  }, [resp]);
  const all: TopListItem[] = (tab === 'viewed' ? viewed : tab === 'revenue' ? revenue : replyTop).slice(0, 20);
  const topRow = (it: TopListItem, i: number) => {
    const r = resp?.get(it.id);
    return (
      <div key={it.id} className="adm-top-row" style={{ animationDelay: `${(i < 5 ? i : i - 5) * 0.04}s` }}>
        <span className={`adm-top-rank ${i < 3 ? 'hi' : ''}`}>{i + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="adm-top-name">
            {it.name}
            {tab !== 'reply' && <ReplyChip r={r} />}
          </span>
        </span>
        <span className="adm-top-val">
          {tab === 'revenue' ? formatMoney(it.value) : tab === 'viewed' ? `${formatNumber(it.value)}회` : `보통 ${fmtSec(toNumber(it.value))}`}
          {tab === 'revenue' && it.count ? <small>{formatNumber(it.count)}건</small> : null}
          {tab === 'reply' && it.count ? <small>답장 {formatNumber(it.count)}건</small> : null}
        </span>
      </div>
    );
  };
  return (
    <div className="adm-card">
      <div className="adm-card-head">
        <h2 className="adm-card-title">사회자 TOP {open ? all.length : Math.min(5, all.length) || 5}</h2>
        <div className="adm-seg" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'revenue'} className={tab === 'revenue' ? 'on' : ''} onClick={() => setTab('revenue')}>매출</button>
          <button type="button" role="tab" aria-selected={tab === 'viewed'} className={tab === 'viewed' ? 'on' : ''} onClick={() => setTab('viewed')}>조회</button>
          <button type="button" role="tab" aria-selected={tab === 'reply'} className={tab === 'reply' ? 'on' : ''} onClick={() => setTab('reply')}>응답</button>
        </div>
      </div>
      {all.length === 0 ? (
        <p className="adm-empty">{tab === 'reply' && !resp ? '응답 기록을 불러오는 중이에요' : '아직 데이터가 없어요'}</p>
      ) : (
        <div className="adm-top" key={tab}>
          {all.slice(0, 5).map((it, i) => topRow(it, i))}
          {/* 6위부터 — 펼치기·접기 둘 다 부드럽게(높이 감속) */}
          <AdminCollapse open={open} className="adm-top-rest-wrap">
            <div className="adm-top-rest">{all.slice(5).map((it, j) => topRow(it, j + 5))}</div>
          </AdminCollapse>
        </div>
      )}
      {all.length > 5 && (
        <button type="button" className={`adm-top-more ${open ? 'on' : ''}`} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? '접기' : `펼치기 · ${all.length}명까지`}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}
    </div>
  );
}


/** 새로운 퀵매칭(261005 사장 '사회자 TOP 5 옆에 퀵매칭 리스트') — /quick-match 로 들어온 견적 요청, 최근 순.
 *  고객 · 행사(날짜·시간·장소·부) · 사회자 답장 몇 명 · 견적·결제. 누르면 채팅 매칭에서 그 요청의 대화만. */
type QuickMatchItem = {
  id: string;
  createdAt: string;
  status: string;
  test: boolean;
  customer: { id: string | null; name: string; phone: string | null };
  event: { date: string | null; time: string | null; region: string | null; venue: string | null; location: string | null; part: string | null };
  contactMethod: string | null;
  batch: string | null;
  pros: { sent: number; replied: number; declined: number };
  quotes: number;
  paid: boolean;
};
type QuickMatchData = { today: number; last7d: number; data: QuickMatchItem[] };

/** '방금' · '12분 전' · '3시간 전' · '2일 전' · 일주일 넘으면 '9.21' */
function agoText(iso: string) {
  const t = new Date(iso).getTime();
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}시간 전`;
  if (m < 60 * 24 * 7) return `${Math.floor(m / (60 * 24))}일 전`;
  const d = new Date(t);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

/** 행사 한 줄 — '4월 25일(일) 12:10 · 충청권 라포르테 · 1부'(올해가 아니면 '27년 ') */
function qmEventLine(e: QuickMatchItem['event']) {
  const parts: string[] = [];
  const m = e.date ? /^(\d{4})-(\d{2})-(\d{2})/.exec(e.date) : null;
  if (m) {
    const y = Number(m[1]);
    const day = WEEK_KO[new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[3]))).getUTCDay()];
    const yy = y !== new Date().getFullYear() ? `${String(y).slice(2)}년 ` : '';
    parts.push(`${yy}${Number(m[2])}월 ${Number(m[3])}일(${day})${e.time ? ` ${e.time.slice(0, 5)}` : ''}`);
  } else if (e.time) parts.push(e.time.slice(0, 5));
  const place = e.location || [e.region, e.venue].filter(Boolean).join(' ');
  if (place) parts.push(place);
  if (e.part) parts.push(e.part.replace(/\s*\(.*?\)\s*/g, '').trim());
  return parts.join(' · ') || '행사 정보 없음';
}

/** 상태 칩 — 결제 > 견적 > 답장 > 답장 대기 */
function QuickMatchChip({ r }: { r: QuickMatchItem }) {
  if (r.test) return <span className="adm-reply none">테스트</span>;
  if (r.paid) return <span className="adm-reply paid">결제 완료</span>;
  if (r.quotes > 0) return <span className="adm-reply blue">견적 {formatNumber(r.quotes)}건</span>;
  if (!r.pros.sent) return <span className="adm-reply none">보낸 사회자 없음</span>;
  if (r.pros.replied > 0) return <span className="adm-reply good">답장 {r.pros.replied}/{r.pros.sent}</span>;
  return <span className="adm-reply slow">답장 대기 0/{r.pros.sent}</span>;
}

function QuickMatchList() {
  const [data, setData] = useState<QuickMatchData | null>(null);
  const [error, setError] = useState(false);
  /** 펼치기 — 기본 5건, 펼치면 20건까지(사회자 TOP 과 같은 모양) */
  const [open, setOpen] = useState(false);
  const load = useCallback(() => {
    setError(false);
    adminFetch('GET', '/api/v1/admin/quick-matches?limit=20', undefined, { cache: false })
      .then((r: QuickMatchData) => setData(r))
      .catch(() => setError(true));
  }, []);
  useEffect(() => { load(); }, [load]);
  useAdminRefresh(load);

  const all = data?.data || [];
  const row = (r: QuickMatchItem, i: number) => {
    const fresh = Date.now() - new Date(r.createdAt).getTime() < 86400000;
    return (
      <Link key={r.id} href={`/admin/chat-connections?mr=${r.id}`} className="adm-top-row adm-qm-row" style={{ animationDelay: `${(i < 5 ? i : i - 5) * 0.04}s` }}>
        <span className="min-w-0 flex-1">
          <span className="adm-top-name">
            {fresh && <span className="adm-qm-new" aria-label="새 요청" />}
            <span className="adm-qm-name">{r.customer.name}</span>
            <QuickMatchChip r={r} />
          </span>
          <span className="adm-qm-sub">{qmEventLine(r.event)}</span>
        </span>
        <span className="adm-top-val">
          {agoText(r.createdAt)}
          {r.contactMethod && <small>{r.contactMethod}</small>}
        </span>
      </Link>
    );
  };
  return (
    <div className="adm-card">
      <div className="adm-card-head">
        <h2 className="adm-card-title">새로운 퀵매칭</h2>
        {data && <span className="adm-qm-count">오늘 <b>{formatNumber(data.today)}</b> · 7일 <b>{formatNumber(data.last7d)}</b></span>}
      </div>
      {error ? (
        <p className="adm-empty">퀵매칭을 불러오지 못했어요</p>
      ) : !data ? (
        <div className="space-y-3">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="adm-skel h-[42px]" />)}</div>
      ) : all.length === 0 ? (
        <p className="adm-empty">아직 퀵매칭 요청이 없어요</p>
      ) : (
        <div className="adm-top">
          {all.slice(0, 5).map((r, i) => row(r, i))}
          <AdminCollapse open={open} className="adm-top-rest-wrap">
            <div className="adm-top-rest">{all.slice(5).map((r, j) => row(r, j + 5))}</div>
          </AdminCollapse>
        </div>
      )}
      {all.length > 5 && (
        <button type="button" className={`adm-top-more ${open ? 'on' : ''}`} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? '접기' : `펼치기 · ${all.length}건까지`}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}
    </div>
  );
}

/* ── 지출 · 수입 줄 — 토스 지출/수입 화면 그대로, 박스 없이(261004 사장 '홈에 이거 넣어줘 UI 그대로 · 섹션 풀어서') ──
 *  수입 = 결제 완료, 지출 = 사회자 정산 지급 + 환불(서버 money-summary, 지난달 1일 ~ 오늘 KST 날마다).
 *  '지난달보다 N만원 더(덜) 버는 중' = 이번 달 오늘까지 수입 누적 − 지난달 같은 날까지 누적. 오른쪽 작은 선 = 지난달 누적(회색)
 *  위에 이번 달 누적(색) + 오늘 점. 아래 = 이번 주 요일·날짜(오늘 칸 강조) + 날마다 순액(수입 − 지출), ⌄ 로 이번 달 달력. */
/* 날마다 수입 달력(이번 주 · ⌄ 이번 달)은 _components/AdminMoneyCalendar.tsx — 결제 조회 위에도 같은 달력(261005) */
const WEEK_KO = ['일', '월', '화', '수', '목', '금', '토'];

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

/* 다이얼 숫자(RollingNumber)는 _components/AdminNumber.tsx 로 옮겼다 — 다른 화면 숫자 칸도 같은 것을 쓴다(261005) */

/** 수입 옆 숫자 칸 — 오늘 매출·신규 가입·한 달 누적 매출·정산 대기(261005 사장 '수입이랑 나란히, 달력 아래 말고') */
type TopKpi = { label: string; value: number | null; unit: string; sub: ReactNode; href: string; tone?: string };

function TopNumbers({ income, kpis }: { income?: number; kpis: TopKpi[] }) {
  return (
    <div className="adm-money-top kpis">
      {income !== undefined && (
        <Link href="/admin/payments" className="adm-money-col" title="이번 달 결제 완료 금액">
          <p className="adm-money-label">수입</p>
          <p className="adm-money-value">{income ? '+' : ''}<RollingNumber value={income} />원</p>
          <p className="adm-money-sub">이번 달 결제 완료</p>
        </Link>
      )}
      {kpis.map((k) => (
        <Link key={k.label} href={k.href} className="adm-money-col">
          <p className="adm-money-label">{k.label}</p>
          <p className="adm-money-value" style={k.tone ? { color: k.tone } : undefined}>
            {k.value == null ? <span className="adm-money-wait">—</span> : <><RollingNumber value={k.value} />{k.unit}</>}
          </p>
          <p className="adm-money-sub">{k.sub}</p>
        </Link>
      ))}
    </div>
  );
}

function MoneyBlock({ data, kpis }: { data: MoneySummary; kpis: TopKpi[] }) {
  const td = Number(data.today.split('-')[2]);
  const thisDays = data.daily.filter((d) => d.date.startsWith(data.thisMonth));
  const lastDays = data.daily.filter((d) => d.date.startsWith(data.lastMonth));
  const income = thisDays.reduce((a, d) => a + d.income, 0);
  const cum = (arr: MoneyDay[]) => { let c = 0; return arr.map((d) => (c += d.income)); };
  const curCum = cum(thisDays);
  const lastCum = cum(lastDays);
  const sameDay = Math.min(td, lastCum.length) - 1;
  const diff = (curCum[curCum.length - 1] || 0) - (sameDay >= 0 ? lastCum[sameDay] : 0);
  const man = Math.round(Math.abs(diff) / 10000);
  const up = diff >= 0;
  const color = up ? '#3182F6' : '#F04452';

  return (
    <section className="adm-moneyblock" aria-label="이번 달 수입과 오늘 운영 숫자">
      <TopNumbers income={income} kpis={kpis} />
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

      <AdminMoneyCalendar data={data} />
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

  // 오늘 방문(홈페이지·앱, 기기 세션) — 261005
  const [visits, setVisits] = useState<{ today: number; todayWeb: number; todayApp: number; yesterday: number; last7d: number } | null>(null);
  const fetchVisits = async () => {
    try {
      setVisits(await adminFetch('GET', '/api/v1/admin/visits', undefined, { cache: false }));
    } catch {
      setVisits(null);
    }
  };
  useEffect(() => { fetchStats(); fetchResp(); fetchMoney(); fetchVisits(); }, []);
  // 'admin:refresh' 이벤트(지금은 쏘는 곳 없음 — 머리 새로고침 버튼은 261005 에 뺐다)
  useAdminRefresh(() => { fetchStats(true); fetchResp(); fetchMoney(); fetchVisits(); });

  const series = stats?.dailySeries?.length ? stats.dailySeries : createEmptyDailySeries();
  const today = new Date();
  const dateLine = `${today.getMonth() + 1}월 ${today.getDate()}일 ${['일', '월', '화', '수', '목', '금', '토'][today.getDay()]}요일`;

  // 수입 옆 숫자 4칸 — 통계가 오기 전엔 '—'
  const kpis: TopKpi[] = [
    { label: '오늘 매출', value: stats ? toNumber(stats.revenue?.today) : null, unit: '원', sub: stats ? <>7일 {formatNumber(stats.revenue?.last7d)}원</> : '불러오는 중', href: '/admin/payments' },
    {
      label: '오늘 방문',
      value: visits ? visits.today : null,
      unit: '명',
      sub: visits ? <>웹 {formatNumber(visits.todayWeb)} · 앱 {formatNumber(visits.todayApp)} · 어제 {formatNumber(visits.yesterday)}</> : '불러오는 중',
      href: '/admin/landing-analytics',
    },
    { label: '오늘 신규 가입', value: stats ? toNumber(stats.newUsersToday) : null, unit: '명', sub: stats ? <>7일 {formatNumber(stats.newUsers7d)}명</> : '불러오는 중', href: '/admin/users' },
    { label: '한 달 누적 매출', value: stats ? toNumber(stats.revenue?.last30d) : null, unit: '원', sub: '최근 30일 결제 완료', href: '/admin/payments' },
    {
      label: '정산 대기',
      value: stats ? toNumber(stats.settlements?.pending) : null,
      unit: '건',
      sub: stats ? <>보낼 금액 {formatNumber(stats.settlements?.pendingAmount)}원</> : '불러오는 중',
      href: '/admin/settlements',
      tone: stats && toNumber(stats.settlements?.pending) > 0 ? '#F46A00' : undefined,
    },
  ];

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
        <MoneyBlock data={money} kpis={kpis} />
      ) : (
        // 수입 줄을 못 받았을 때(옛 서버 등)도 숫자 칸은 보이게
        <section className="adm-moneyblock" aria-label="오늘 운영 숫자">
          <TopNumbers kpis={kpis} />
        </section>
      )}

      {loading && !stats ? (
        <div className="adm-grid adm-home-row">
          {[0, 1].map((i) => <div key={i} className="adm-skel h-[280px] rounded-[20px]" />)}
        </div>
      ) : stats && (
        <>
          {stats.degraded && (
            <p className="adm-note">통계 서버 응답이 없어 목록 데이터로 대신 계산했어요(일부 숫자는 0 으로 보일 수 있어요)</p>
          )}
          <div className="adm-grid adm-home-row">
            <TodoCard items={todo} />
            <TrendChart points={series} />
          </div>

          {/* 전환 퍼널 — 박스 없이 한 줄 전체(261005) */}
          <JourneyFunnel />

          {/* 사회자 TOP 옆에 새로운 퀵매칭(261005 사장) */}
          <div className="adm-grid adm-home-row2">
            <TopPros viewed={stats.topLists?.viewedPros || []} revenue={stats.topLists?.revenuePros || []} resp={resp} />
            <QuickMatchList />
          </div>
        </>
      )}
    </div>
  );
}
