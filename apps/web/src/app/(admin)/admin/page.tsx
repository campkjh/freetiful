'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRightLeft,
  Building2,
  Calendar,
  ChevronRight,
  CreditCard,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminTerm } from './_components/AdminHelpTooltip';
import { adminFetch } from './_components/adminFetch';

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
  };
  engagement?: {
    favorites?: number;
    proFavorites?: number;
    businessFavorites?: number;
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
    favorites?: number;
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
    favoriteCtr?: number;
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
  pudding?: {
    total?: number;
    last30d?: number;
    profileBalance?: number;
  };
  dailySeries?: DailyPoint[];
  topLists?: {
    viewedPros?: TopListItem[];
    puddingPros?: TopListItem[];
    revenuePros?: TopListItem[];
  };
}

const BLUE = '#3180F7';
const GREEN = '#21C463';
const ORANGE = '#FF9F1C';
const RED = '#F04452';
const GRAY = '#8B95A1';

const toNumber = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumber = (value: unknown) => toNumber(value).toLocaleString('ko-KR');
const formatMoney = (value: unknown) => `₩${formatNumber(value)}`;
const formatRate = (value: unknown) => `${toNumber(value).toFixed(1)}%`;

function AdminSection({
  eyebrow,
  title,
  aside,
  children,
}: {
  eyebrow?: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          {eyebrow && <p className="text-[12px] font-normal text-[#B0B8C1]">{eyebrow}</p>}
          <h2 className={eyebrow ? 'mt-2 text-[16px] font-bold text-[#191F28]' : 'text-[16px] font-bold text-[#191F28]'}>
            <AdminTerm term={title}>{title}</AdminTerm>
          </h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function MetricBand({
  items,
  minWidth = 860,
}: {
  items: Array<{ label: string; value: string; sub?: string; tone?: 'blue' | 'green' | 'red' | 'gray' }>;
  minWidth?: number;
}) {
  const toneMap = {
    blue: 'text-[#3180F7]',
    green: 'text-[#21C463]',
    red: 'text-[#F04452]',
    gray: 'text-[#6B7684]',
  };

  return (
    <div className="admin-list-card overflow-x-auto">
      <table className="w-full" style={{ minWidth }}>
        <thead>
          <tr>
            {items.map((item) => (
              <th key={item.label} className="px-6 text-center">
                <AdminTerm term={item.label}>{item.label}</AdminTerm>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {items.map((item) => (
              <td key={item.label} className="px-6 text-center">
                <span className={`font-semibold ${item.tone ? toneMap[item.tone] : 'text-[#333D4B]'}`}>
                  {item.value}
                </span>
                {item.sub && (
                  <span className="mt-0.5 block text-[12px] font-normal text-[#8B95A1]">{item.sub}</span>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Sparkline({
  points,
  dataKey,
  color = BLUE,
}: {
  points: DailyPoint[];
  dataKey: DailyMetricKey;
  color?: string;
}) {
  const values = points.map((point) => toNumber(point[dataKey]));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const width = 240;
  const height = 74;
  const coordinates = values.map((value, index) => {
    const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 10) - 5;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[74px] w-full overflow-visible" aria-hidden>
      <line x1="0" y1={height - 5} x2={width} y2={height - 5} stroke="#E5E8EB" strokeWidth="1" />
      <polyline
        points={coordinates}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      {values.length > 0 && (
        <circle
          cx={values.length <= 1 ? 0 : width}
          cy={height - ((values[values.length - 1] - min) / range) * (height - 10) - 5}
          r="4"
          fill={color}
        />
      )}
    </svg>
  );
}

function BarStrip({
  points,
  dataKey,
  color = BLUE,
  formatter = formatNumber,
}: {
  points: DailyPoint[];
  dataKey: DailyMetricKey;
  color?: string;
  formatter?: (value: unknown) => string;
}) {
  const values = points.map((point) => toNumber(point[dataKey]));
  const max = Math.max(...values, 1);

  return (
    <div className="flex h-[86px] items-end gap-1.5 border-b border-[#E5E8EB] px-1 pb-1">
      {points.map((point, index) => {
        const value = toNumber(point[dataKey]);
        return (
          <div key={`${point.date}-${index}`} className="group flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md transition-all duration-300 group-hover:opacity-80"
              style={{
                height: `${Math.max(5, (value / max) * 72)}px`,
                backgroundColor: color,
                opacity: 0.9,
              }}
              title={`${point.date} ${formatter(value)}`}
            />
          </div>
        );
      })}
    </div>
  );
}

function ChartPanel({
  title,
  value,
  points,
  dataKey,
  color = BLUE,
  formatter = formatNumber,
  chart = 'line',
}: {
  title: string;
  value: string;
  points: DailyPoint[];
  dataKey: DailyMetricKey;
  color?: string;
  formatter?: (value: unknown) => string;
  chart?: 'line' | 'bar';
}) {
  return (
    <div className="admin-metric-card border-y border-[#E5E8EB] bg-white px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-[#4E5968]">
          <AdminTerm term={title}>{title}</AdminTerm>
        </span>
        <span className="text-[13px] font-semibold text-[#191F28]">{value}</span>
      </div>
      {chart === 'line' ? (
        <Sparkline points={points} dataKey={dataKey} color={color} />
      ) : (
        <BarStrip points={points} dataKey={dataKey} color={color} formatter={formatter} />
      )}
      <div className="mt-2 flex justify-between text-[12px] font-normal text-[#B0B8C1]">
        <span>{points[0]?.date || '-'}</span>
        <span>{points[points.length - 1]?.date || '-'}</span>
      </div>
    </div>
  );
}

function ProgressList({
  items,
  suffix = '',
}: {
  items: Array<{ label: string; value: number; detail?: string; color?: string }>;
  suffix?: string;
}) {
  return (
    <div className="space-y-3 border-y border-[#E5E8EB] py-4">
      {items.map((item) => {
        const width = Math.min(100, Math.max(0, item.value));
        return (
          <div key={item.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-[#333D4B]">
                <AdminTerm term={item.label}>{item.label}</AdminTerm>
              </span>
              <span className="text-[13px] font-semibold text-[#191F28]">
                {suffix ? `${item.value.toFixed(1)}${suffix}` : formatNumber(item.value)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#F2F4F6]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${width}%`, backgroundColor: item.color || BLUE }}
              />
            </div>
            {item.detail && <p className="mt-1 text-[12px] font-normal text-[#8B95A1]">{item.detail}</p>}
          </div>
        );
      })}
    </div>
  );
}

function FunnelList({
  items,
}: {
  items: Array<{ label: string; value: number; color?: string }>;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-3 border-y border-[#E5E8EB] py-4">
      {items.map((item, index) => (
        <div key={item.label} className="grid grid-cols-[112px_1fr_96px] items-center gap-3">
          <span className="text-[12px] font-semibold text-[#4E5968]">
            <AdminTerm term={item.label}>{item.label}</AdminTerm>
          </span>
          <div className="h-8 overflow-hidden rounded-lg bg-[#F7F8FA]">
            <div
              className="flex h-full items-center rounded-lg px-3 text-[12px] font-semibold text-white transition-all duration-500"
              style={{
                width: `${Math.max(7, (item.value / max) * 100)}%`,
                backgroundColor: item.color || BLUE,
                transitionDelay: `${index * 35}ms`,
              }}
            />
          </div>
          <span className="text-right text-[13px] font-semibold text-[#191F28]">{formatNumber(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

function BreakdownList({
  items,
}: {
  items: Array<{ label: string; value: number; color?: string }>;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="space-y-3 border-y border-[#E5E8EB] py-4">
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[96px_1fr_72px] items-center gap-3">
          <span className="text-[12px] font-semibold text-[#4E5968]">
            <AdminTerm term={item.label}>{item.label}</AdminTerm>
          </span>
          <div className="h-2 overflow-hidden rounded-full bg-[#F2F4F6]">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(3, (item.value / max) * 100)}%`, backgroundColor: item.color || BLUE }}
            />
          </div>
          <span className="text-right text-[13px] font-semibold text-[#191F28]">{formatNumber(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

function TopList({
  title,
  items,
  valueLabel,
  formatter = formatNumber,
}: {
  title: string;
  items: TopListItem[];
  valueLabel: string;
  formatter?: (value: unknown) => string;
}) {
  return (
    <div className="admin-list-card overflow-x-auto">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[16px] font-bold text-[#191F28]">
          <AdminTerm term={title}>{title}</AdminTerm>
        </h3>
        <span className="text-[12px] font-normal text-[#8B95A1]">
          <AdminTerm term={valueLabel}>{valueLabel}</AdminTerm>
        </span>
      </div>
      <table className="w-full min-w-[360px]">
        <thead>
          <tr>
            <th className="px-4 text-left">순위</th>
            <th className="px-4 text-left">전문가</th>
            <th className="px-4 text-right"><AdminTerm term={valueLabel}>{valueLabel}</AdminTerm></th>
          </tr>
        </thead>
        <tbody>
          {(items.length ? items : [{ id: 'empty', name: '-', value: 0 }]).map((item, index) => (
            <tr key={item.id}>
              <td className="px-4 text-[#8B95A1]">{index + 1}</td>
              <td className="px-4 font-semibold text-[#333D4B]">{item.name}</td>
              <td className="px-4 text-right font-semibold text-[#191F28]">
                {formatter(item.value)}
                {item.count != null && item.count > 0 && (
                  <span className="ml-1 text-[12px] font-normal text-[#8B95A1]">({formatNumber(item.count)}건)</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferSource, setTransferSource] = useState('');
  const [transferTarget, setTransferTarget] = useState('');
  const [transferring, setTransferring] = useState(false);

  const fetchStats = async (force = false) => {
    setLoading(true);
    try {
      const data = await adminFetch('GET', '/api/v1/admin/stats', undefined, {
        cache: !force,
        cacheTtl: 6000,
      });
      setStats(data);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '알 수 없는 오류';
      const status = e?.response?.status;
      toast.error(`통계 로드 실패${status ? ` (${status})` : ''}: ${msg}`, { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const handleCleanup = async () => {
    if (!confirm('이미지 0장인 approved 프로필을 전부 draft 로 강등하시겠습니까? (공개 목록에서 사라짐)')) return;
    try {
      const data = await adminFetch('POST', '/api/v1/admin/cleanup-empty-profiles');
      toast.success(`${data.archivedCount}개 빈 프로필이 draft 로 강등됨`);
      if (data.archivedCount > 0) {
        console.log('archived:', data.archived);
      }
    } catch (e: any) {
      toast.error(`정리 실패: ${e?.response?.data?.message || e?.message || ''}`);
    }
  };

  const handleTransfer = async () => {
    if (!transferSource || !transferTarget) { toast.error('이메일을 모두 입력하세요'); return; }
    if (!confirm(`${transferSource} 의 모든 프로필/이미지/서비스를 ${transferTarget} 계정으로 이관합니다.\n\n이 작업은 되돌릴 수 없습니다. 계속할까요?`)) return;
    setTransferring(true);
    try {
      const data = await adminFetch('POST', '/api/v1/admin/transfer-pro-profile', {
        sourceEmail: transferSource,
        targetEmail: transferTarget,
      });
      toast.success(`이관 완료: ${data.transferredProfileId}`);
      setTransferOpen(false);
      fetchStats(true);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '알 수 없는 오류';
      toast.error(`이관 실패: ${msg}`, { duration: 6000 });
    } finally {
      setTransferring(false);
    }
  };

  const dailySeries = stats?.dailySeries || [];
  const allUsers = stats ? toNumber(stats.allUsers ?? stats.totalUsers) : 0;
  const profileViews = toNumber(stats?.profiles?.totalViews ?? stats?.funnel?.profileViews);

  const navItems = [
    { href: '/admin/pros', icon: UserCheck, label: '전문가 관리', desc: '승인 · 반려 · 프로필', count: stats?.pendingPros ? `대기 ${formatNumber(stats.pendingPros)}` : undefined, countTone: 'warn' as const },
    { href: '/admin/users', icon: Users, label: '유저 관리', desc: '회원 목록 · 권한', count: stats ? `${formatNumber(allUsers)}명` : undefined },
    { href: '/admin/bookings', icon: Calendar, label: '의뢰 · 예약', desc: '예약 현황', count: stats?.matchRequests?.total != null ? `${formatNumber(stats.matchRequests.total)}건` : undefined },
    { href: '/admin/payments', icon: CreditCard, label: '결제 관리', desc: '결제 내역 · 매출', count: stats?.revenue?.thisMonth != null ? formatMoney(stats.revenue.thisMonth) : undefined },
    { href: '/admin/settlements', icon: Wallet, label: '정산 관리', desc: '전문가 정산 처리', count: stats?.settlements?.pending != null ? `대기 ${formatNumber(stats.settlements.pending)}` : undefined },
    { href: '/admin/reviews', icon: Star, label: '리뷰 관리', desc: '리뷰 목록 · 삭제', count: stats?.totalReviews != null ? `${formatNumber(stats.totalReviews)}건` : undefined },
    { href: '/admin/businesses', icon: Building2, label: 'Biz 고객사', desc: '비즈니스 계정', count: stats?.profiles?.businessTotal != null ? `${formatNumber(stats.profiles.businessTotal)}개` : undefined },
  ];

  const summaryItems = stats
    ? [
        { label: '오늘 매출', value: formatMoney(stats.revenue?.today), sub: '결제완료', tone: 'blue' as const },
        { label: '7일 매출', value: formatMoney(stats.revenue?.last7d), sub: '최근 7일', tone: 'blue' as const },
        { label: '30일 매출', value: formatMoney(stats.revenue?.last30d), sub: '최근 30일', tone: 'blue' as const },
        { label: '이번달 매출', value: formatMoney(stats.revenue?.thisMonth ?? stats.thisMonthRevenue), sub: '월 누적', tone: 'blue' as const },
        { label: '누적 매출', value: formatMoney(stats.revenue?.total ?? stats.totalRevenue), sub: '전체 기간', tone: 'gray' as const },
      ]
    : [];

  const userItems = stats
    ? [
        { label: '전체 계정', value: `${formatNumber(allUsers)}명`, sub: '모든 역할' },
        { label: '일반 유저', value: `${formatNumber(stats.userRoles?.general ?? stats.totalUsers)}명`, sub: '고객 계정' },
        { label: '신규 오늘', value: `${formatNumber(stats.newUsersToday)}명`, sub: 'KST 기준', tone: 'blue' as const },
        { label: '신규 7일', value: `${formatNumber(stats.newUsers7d)}명`, sub: '최근 유입', tone: 'blue' as const },
        { label: '신규 30일', value: `${formatNumber(stats.newUsers30d)}명`, sub: '월간 유입', tone: 'blue' as const },
        { label: '활성 계정', value: `${formatNumber(stats.activeUsers)}명`, sub: 'isActive', tone: 'green' as const },
        { label: '비활성 계정', value: `${formatNumber(stats.inactiveUsers)}명`, sub: '휴면/비활성' },
        { label: '차단 계정', value: `${formatNumber(stats.bannedUsers)}명`, sub: 'isBanned', tone: 'red' as const },
      ]
    : [];

  const roleItems = useMemo(() => {
    if (!stats) return [];
    return [
      { label: '고객', value: toNumber(stats.userRoles?.general), color: BLUE },
      { label: '프로', value: toNumber(stats.userRoles?.pro), color: GREEN },
      { label: '업체', value: toNumber(stats.userRoles?.business), color: ORANGE },
      { label: '관리자', value: toNumber(stats.userRoles?.admin), color: GRAY },
    ];
  }, [stats]);

  const ctrItems = useMemo(() => {
    if (!stats) return [];
    return [
      {
        label: '찜 CTR',
        value: toNumber(stats.rates?.favoriteCtr),
        detail: `${formatNumber(stats.engagement?.favorites)} / ${formatNumber(profileViews)} 프로필 조회`,
        color: BLUE,
      },
      {
        label: '채팅 진입 CTR',
        value: toNumber(stats.rates?.chatCtr),
        detail: `${formatNumber(stats.engagement?.chatRooms)} / ${formatNumber(profileViews)} 프로필 조회`,
        color: GREEN,
      },
      {
        label: '요청 열람률',
        value: toNumber(stats.rates?.deliveryViewRate),
        detail: `${formatNumber(stats.funnel?.viewedDeliveries)} / ${formatNumber(stats.funnel?.deliveries)} 전달`,
        color: ORANGE,
      },
      {
        label: '요청 응답률',
        value: toNumber(stats.rates?.deliveryReplyRate),
        detail: `${formatNumber(stats.funnel?.repliedDeliveries)} / ${formatNumber(stats.funnel?.deliveries)} 전달`,
        color: BLUE,
      },
      {
        label: '견적 결제전환',
        value: toNumber(stats.rates?.quotationPaidRate),
        detail: `${formatNumber(stats.funnel?.paidQuotations)} / ${formatNumber(stats.funnel?.quotations)} 견적`,
        color: GREEN,
      },
      {
        label: '결제 성공률',
        value: toNumber(stats.rates?.paymentSuccessRate),
        detail: `${formatNumber(stats.funnel?.completedPayments)} / ${formatNumber(stats.funnel?.payments)} 결제`,
        color: BLUE,
      },
      {
        label: '리뷰 작성률',
        value: toNumber(stats.rates?.reviewWriteRate),
        detail: `${formatNumber(stats.totalReviews)} / ${formatNumber(stats.funnel?.completedPayments)} 완료 결제`,
        color: ORANGE,
      },
      {
        label: '푸시 발송률',
        value: toNumber(stats.rates?.pushSendRate),
        detail: `${formatNumber(stats.engagement?.sentPushNotifications)} / ${formatNumber(stats.engagement?.notifications)} 알림`,
        color: RED,
      },
    ];
  }, [stats, profileViews]);

  const funnelItems = useMemo(() => {
    if (!stats) return [];
    return [
      { label: '프로필 조회', value: toNumber(stats.funnel?.profileViews), color: BLUE },
      { label: '찜', value: toNumber(stats.funnel?.favorites), color: BLUE },
      { label: '요청 생성', value: toNumber(stats.funnel?.matchRequests), color: GREEN },
      { label: '전달', value: toNumber(stats.funnel?.deliveries), color: GREEN },
      { label: '열람', value: toNumber(stats.funnel?.viewedDeliveries), color: ORANGE },
      { label: '응답', value: toNumber(stats.funnel?.repliedDeliveries), color: ORANGE },
      { label: '채팅방', value: toNumber(stats.funnel?.chatRooms), color: BLUE },
      { label: '견적', value: toNumber(stats.funnel?.quotations), color: GREEN },
      { label: '결제완료', value: toNumber(stats.funnel?.completedPayments), color: RED },
      { label: '리뷰', value: toNumber(stats.funnel?.reviews), color: GRAY },
    ];
  }, [stats]);

  const operationItems = stats
    ? [
        { label: '프로 조회수', value: `${formatNumber(stats.profiles?.proViews)}회`, sub: '사회자 프로필' },
        { label: '업체 조회수', value: `${formatNumber(stats.profiles?.businessViews)}회`, sub: '웨딩파트너' },
        { label: '평균 평점', value: toNumber(stats.profiles?.avgRating).toFixed(2), sub: '승인 프로 기준', tone: 'blue' as const },
        { label: '평균 응답률', value: formatRate(stats.profiles?.avgResponseRate), sub: '프로 응답 지표', tone: 'green' as const },
        { label: '찜', value: `${formatNumber(stats.engagement?.favorites)}건`, sub: `프로 ${formatNumber(stats.engagement?.proFavorites)} · 업체 ${formatNumber(stats.engagement?.businessFavorites)}` },
        { label: '채팅방', value: `${formatNumber(stats.engagement?.chatRooms)}개`, sub: `7일 ${formatNumber(stats.engagement?.chatRooms7d)}` },
        { label: '메시지', value: `${formatNumber(stats.engagement?.messages)}개`, sub: `7일 ${formatNumber(stats.engagement?.messages7d)}` },
        { label: '리뷰 노출', value: `${formatNumber(stats.visibleReviews)}건`, sub: `전체 ${formatNumber(stats.totalReviews)}` },
      ]
    : [];

  const commerceItems = stats
    ? [
        { label: '견적 전체', value: `${formatNumber(stats.quotations?.total)}건`, sub: `대기 ${formatNumber(stats.quotations?.pending)}` },
        { label: '견적 수락', value: `${formatNumber(stats.quotations?.accepted)}건`, sub: `결제 ${formatNumber(stats.quotations?.paid)}`, tone: 'green' as const },
        { label: '결제 전체', value: `${formatNumber(stats.payments?.total)}건`, sub: `성공 ${formatNumber(stats.payments?.completed)}` },
        { label: '환불/실패', value: `${formatNumber(toNumber(stats.payments?.refunded) + toNumber(stats.payments?.failed))}건`, sub: `환불액 ${formatMoney(stats.payments?.refundedAmount)}`, tone: 'red' as const },
        { label: '정산 대기', value: `${formatNumber(stats.settlements?.pending)}건`, sub: formatMoney(stats.settlements?.pendingAmount), tone: 'blue' as const },
        { label: '정산 완료', value: `${formatNumber(stats.settlements?.settled)}건`, sub: formatMoney(stats.settlements?.settledAmount), tone: 'green' as const },
        { label: '푸딩 총량', value: `${formatNumber(stats.pudding?.profileBalance)}개`, sub: `거래누적 ${formatNumber(stats.pudding?.total)}` },
        { label: '푸딩 30일', value: `${formatNumber(stats.pudding?.last30d)}개`, sub: '최근 변동', tone: 'blue' as const },
      ]
    : [];

  const notificationItems = stats
    ? [
        { label: '알림 전체', value: `${formatNumber(stats.engagement?.notifications)}건`, sub: 'Notification' },
        { label: '읽지 않음', value: `${formatNumber(stats.engagement?.unreadNotifications)}건`, sub: '미확인', tone: 'red' as const },
        { label: '푸시 발송', value: `${formatNumber(stats.engagement?.sentPushNotifications)}건`, sub: 'sentPush', tone: 'blue' as const },
        { label: '푸시 토큰', value: `${formatNumber(stats.engagement?.activePushTokens)}개`, sub: `구독 ${formatNumber(stats.engagement?.pushSubscriptions)}`, tone: 'green' as const },
      ]
    : [];

  const proStatusItems = useMemo(() => {
    if (!stats) return [];
    const labels: Record<string, string> = {
      approved: '승인',
      pending: '대기',
      draft: '작성중',
      rejected: '반려',
      suspended: '정지',
    };
    return Object.entries(labels).map(([key, label]) => ({
      label,
      value: toNumber(stats.profiles?.proStatus?.[key]),
      color: key === 'approved' ? BLUE : key === 'pending' ? ORANGE : key === 'rejected' || key === 'suspended' ? RED : GRAY,
    }));
  }, [stats]);

  const businessStatusItems = useMemo(() => {
    if (!stats) return [];
    const labels: Record<string, string> = {
      approved: '승인',
      pending: '대기',
      draft: '작성중',
      rejected: '반려',
    };
    return Object.entries(labels).map(([key, label]) => ({
      label,
      value: toNumber(stats.profiles?.businessStatus?.[key]),
      color: key === 'approved' ? BLUE : key === 'pending' ? ORANGE : key === 'rejected' ? RED : GRAY,
    }));
  }, [stats]);

  const matchStatusItems = useMemo(() => {
    if (!stats) return [];
    const labels: Record<string, string> = {
      open: '진행',
      matched: '매칭',
      cancelled: '취소',
      expired: '만료',
    };
    return Object.entries(labels).map(([key, label]) => ({
      label,
      value: toNumber(stats.matchRequests?.[key]),
      color: key === 'matched' ? GREEN : key === 'open' ? BLUE : RED,
    }));
  }, [stats]);

  const quotationStatusItems = useMemo(() => {
    if (!stats) return [];
    const labels: Record<string, string> = {
      pending: '대기',
      accepted: '수락',
      paid: '결제',
      cancelled: '취소',
      refunded: '환불',
      expired: '만료',
    };
    return Object.entries(labels).map(([key, label]) => ({
      label,
      value: toNumber(stats.quotations?.[key]),
      color: key === 'paid' || key === 'accepted' ? GREEN : key === 'pending' ? BLUE : RED,
    }));
  }, [stats]);

  const paymentStatusItems = useMemo(() => {
    if (!stats) return [];
    return [
      { label: '완료', value: toNumber(stats.payments?.completed), color: BLUE },
      { label: '대기', value: toNumber(stats.payments?.pending), color: ORANGE },
      { label: '에스크로', value: toNumber(stats.payments?.escrowed), color: GREEN },
      { label: '정산', value: toNumber(stats.payments?.settled), color: GRAY },
      { label: '환불', value: toNumber(stats.payments?.refunded), color: RED },
      { label: '실패', value: toNumber(stats.payments?.failed), color: RED },
    ];
  }, [stats]);

  const settlementStatusItems = useMemo(() => {
    if (!stats) return [];
    return [
      { label: '대기', value: toNumber(stats.settlements?.pending), color: BLUE },
      { label: '완료', value: toNumber(stats.settlements?.settled), color: GREEN },
      { label: '취소', value: toNumber(stats.settlements?.cancelled), color: RED },
    ];
  }, [stats]);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-normal text-[#B0B8C1]">운영 센터</p>
          <h1 className="mt-3 text-[16px] font-bold text-[#191F28]">관리자 홈</h1>
        </div>
        <button
          onClick={() => fetchStats(true)}
          disabled={loading}
          className="admin-icon-button flex h-10 w-10 items-center justify-center rounded-lg bg-[#F7F8FA] text-[#6B7684] hover:bg-[#F2F4F6] disabled:opacity-50"
          title="새로고침"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="admin-list-card animate-pulse">
          <div className="grid grid-cols-4 border-y border-[#E5E8EB] bg-[#F7F8FA]">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-[54px] px-6 py-4"><div className="h-3 w-20 rounded bg-gray-100" /></div>)}
          </div>
          <div className="grid grid-cols-4 border-b border-[#E5E8EB]">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-[54px] px-6 py-4"><div className="h-4 w-24 rounded bg-gray-100" /></div>)}
          </div>
        </div>
      ) : stats && (
        <>
          <AdminSection
            eyebrow="페이먼츠 센터"
            title="매출 요약"
            aside={<span className="text-[12px] font-normal text-[#8B95A1]">실제 결제완료 기준</span>}
          >
            <MetricBand items={summaryItems} />
          </AdminSection>

          <AdminSection
            eyebrow="유저 센터"
            title="유저 진입 · 계정 상태"
            aside={<span className="text-[12px] font-normal text-[#8B95A1]">오늘 · 7일 · 30일 신규 유입</span>}
          >
            <MetricBand items={userItems} minWidth={1120} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_0.8fr]">
              <ChartPanel
                title="일별 신규 유저"
                value={`${formatNumber(dailySeries.reduce((sum, point) => sum + toNumber(point.users), 0))}명`}
                points={dailySeries}
                dataKey="users"
                color={BLUE}
                chart="bar"
              />
              <div className="admin-list-card">
                <div className="mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#3180F7]" />
                  <h3 className="text-[16px] font-bold text-[#191F28]"><AdminTerm term="역할 분포">역할 분포</AdminTerm></h3>
                </div>
                <BreakdownList items={roleItems} />
              </div>
            </div>
          </AdminSection>

          <AdminSection
            eyebrow="전환 센터"
            title="CTR · 전환율"
            aside={<span className="text-[12px] font-normal text-[#8B95A1]">프로필 조회 이후 행동 기준</span>}
          >
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="admin-list-card">
                <div className="mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#3180F7]" />
                  <h3 className="text-[16px] font-bold text-[#191F28]"><AdminTerm term="핵심 비율">핵심 비율</AdminTerm></h3>
                </div>
                <ProgressList items={ctrItems} suffix="%" />
              </div>
              <div className="admin-list-card">
                <div className="mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#3180F7]" />
                  <h3 className="text-[16px] font-bold text-[#191F28]"><AdminTerm term="전환 퍼널">전환 퍼널</AdminTerm></h3>
                </div>
                <FunnelList items={funnelItems} />
              </div>
            </div>
          </AdminSection>

          <AdminSection
            eyebrow="활동 센터"
            title="프로필 · 채팅 · 알림"
            aside={<span className="text-[12px] font-normal text-[#8B95A1]">사용자 행동 데이터</span>}
          >
            <MetricBand items={operationItems} minWidth={1120} />
            <MetricBand items={notificationItems} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <ChartPanel
                title="요청 생성"
                value={`${formatNumber(dailySeries.reduce((sum, point) => sum + toNumber(point.matchRequests), 0))}건`}
                points={dailySeries}
                dataKey="matchRequests"
                color={GREEN}
                chart="bar"
              />
              <ChartPanel
                title="채팅방"
                value={`${formatNumber(dailySeries.reduce((sum, point) => sum + toNumber(point.chats), 0))}개`}
                points={dailySeries}
                dataKey="chats"
                color={ORANGE}
              />
              <ChartPanel
                title="메시지"
                value={`${formatNumber(dailySeries.reduce((sum, point) => sum + toNumber(point.messages), 0))}개`}
                points={dailySeries}
                dataKey="messages"
                color={BLUE}
              />
            </div>
          </AdminSection>

          <AdminSection
            eyebrow="거래 센터"
            title="견적 · 결제 · 정산 · 푸딩"
            aside={<span className="text-[12px] font-normal text-[#8B95A1]">거래 흐름 전체</span>}
          >
            <MetricBand items={commerceItems} minWidth={1120} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ChartPanel
                title="일별 결제 건수"
                value={`${formatNumber(dailySeries.reduce((sum, point) => sum + toNumber(point.payments), 0))}건`}
                points={dailySeries}
                dataKey="payments"
                color={GREEN}
                chart="bar"
              />
              <ChartPanel
                title="일별 매출"
                value={formatMoney(dailySeries.reduce((sum, point) => sum + toNumber(point.revenue), 0))}
                points={dailySeries}
                dataKey="revenue"
                color={BLUE}
                formatter={formatMoney}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
              <div className="admin-list-card">
                <div className="mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#3180F7]" />
                  <h3 className="text-[16px] font-bold text-[#191F28]"><AdminTerm term="요청 상태">요청 상태</AdminTerm></h3>
                </div>
                <BreakdownList items={matchStatusItems} />
              </div>
              <div className="admin-list-card">
                <div className="mb-3 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-[#3180F7]" />
                  <h3 className="text-[16px] font-bold text-[#191F28]"><AdminTerm term="견적 상태">견적 상태</AdminTerm></h3>
                </div>
                <BreakdownList items={quotationStatusItems} />
              </div>
              <div className="admin-list-card">
                <div className="mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[#3180F7]" />
                  <h3 className="text-[16px] font-bold text-[#191F28]"><AdminTerm term="결제 상태">결제 상태</AdminTerm></h3>
                </div>
                <BreakdownList items={paymentStatusItems} />
              </div>
              <div className="admin-list-card">
                <div className="mb-3 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-[#3180F7]" />
                  <h3 className="text-[16px] font-bold text-[#191F28]"><AdminTerm term="정산 상태">정산 상태</AdminTerm></h3>
                </div>
                <BreakdownList items={settlementStatusItems} />
              </div>
            </div>
          </AdminSection>

          <AdminSection
            eyebrow="프로 센터"
            title="승인 상태 · 랭킹"
            aside={<span className="text-[12px] font-normal text-[#8B95A1]">조회수 · 푸딩 · 매출 TOP</span>}
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="admin-list-card">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#3180F7]" />
                  <h3 className="text-[16px] font-bold text-[#191F28]"><AdminTerm term="전문가 상태">전문가 상태</AdminTerm></h3>
                </div>
                <BreakdownList items={proStatusItems} />
              </div>
              <div className="admin-list-card">
                <div className="mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#3180F7]" />
                  <h3 className="text-[16px] font-bold text-[#191F28]"><AdminTerm term="웨딩파트너 상태">웨딩파트너 상태</AdminTerm></h3>
                </div>
                <BreakdownList items={businessStatusItems} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <TopList
                title="조회수 TOP"
                items={stats.topLists?.viewedPros || []}
                valueLabel="조회"
              />
              <TopList
                title="푸딩 TOP"
                items={stats.topLists?.puddingPros || []}
                valueLabel="푸딩"
              />
              <TopList
                title="매출 TOP"
                items={stats.topLists?.revenuePros || []}
                valueLabel="매출"
                formatter={formatMoney}
              />
            </div>
          </AdminSection>
        </>
      )}

      <AdminSection
        title="관리 메뉴"
        aside={<span className="text-[12px] font-normal text-[#8B95A1]">총 {navItems.length}개 센터</span>}
      >
        <div className="admin-list-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr>
                  <th className="px-6 text-left">센터</th>
                  <th className="px-6 text-left">관리범위</th>
                  <th className="px-6 text-center">현황</th>
                  <th className="px-6 text-center">이동</th>
                </tr>
              </thead>
              <tbody>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const countClass = item.countTone === 'warn'
                    ? 'bg-[#FFF3F3] text-[#F04452]'
                    : 'bg-[#F3F8FF] text-[#3180F7]';
                  return (
                    <tr key={item.href}>
                      <td className="px-6">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F3F8FF] text-[#3180F7]">
                            <Icon size={16} />
                          </span>
                          <span className="font-semibold text-[#191F28]">{item.label}</span>
                        </div>
                      </td>
                      <td className="px-6 text-[#6B7684]">{item.desc}</td>
                      <td className="px-6 text-center">
                        {item.count ? (
                          <span className={`inline-flex rounded-lg px-2.5 py-1 text-[12px] font-semibold ${countClass}`}>
                            {item.count}
                          </span>
                        ) : (
                          <span className="text-[#B0B8C1]">-</span>
                        )}
                      </td>
                      <td className="px-6 text-center">
                        <Link
                          href={item.href}
                          className="admin-icon-button inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#8B95A1] hover:bg-[#F3F8FF] hover:text-[#3180F7]"
                          aria-label={`${item.label}로 이동`}
                        >
                          <ChevronRight size={16} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </AdminSection>

      <AdminSection title="관리자 도구">
        <div className="admin-list-card">
          <div className="grid grid-cols-1 gap-2 border-y border-[#E5E8EB] py-3 sm:grid-cols-2">
            <button
              onClick={handleCleanup}
              className="rounded-lg bg-[#F7F8FA] px-4 py-3 text-left hover:bg-[#F2F4F6]"
            >
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#191F28]">
                <Search size={13} /> 빈 프로필 정리
              </span>
              <span className="mt-0.5 block text-[12px] font-normal text-[#8B95A1]">이미지 0 → draft 강등</span>
            </button>
            <button
              onClick={() => setTransferOpen(true)}
              className="rounded-lg bg-[#F7F8FA] px-4 py-3 text-left hover:bg-[#F2F4F6]"
            >
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#191F28]">
                <ArrowRightLeft size={13} /> 프로필 이관
              </span>
              <span className="mt-0.5 block text-[12px] font-normal text-[#8B95A1]">계정 연결 정리</span>
            </button>
          </div>
        </div>
      </AdminSection>

      {transferOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
          onClick={() => setTransferOpen(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-lg bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-[16px] font-bold text-[#191F28]">프로필 이관</h2>
              <p className="mt-1 text-[12px] font-normal text-[#8B95A1]">기존 계정 → 대상 계정</p>
            </div>
            <div className="space-y-4 px-6 py-4">
              <p className="text-[12px] font-normal leading-relaxed text-[#6B7684]">
                기존 계정의 프로 프로필(이미지·서비스·리뷰·채팅 등)을 대상 계정으로 통째로 이관합니다.
                대상 계정에 기존 프로필이 있으면 삭제되고, 기존 계정은 비활성화됩니다.
              </p>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-[#8B95A1]">
                  기존 계정 이메일
                </label>
                <input
                  type="email"
                  value={transferSource}
                  onChange={(e) => setTransferSource(e.target.value)}
                  className="w-full rounded-lg bg-[#F9FAFB] px-4 py-3 text-[13px] text-[#191F28] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3180F7]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-[#8B95A1]">
                  대상 계정 이메일
                </label>
                <input
                  type="email"
                  value={transferTarget}
                  onChange={(e) => setTransferTarget(e.target.value)}
                  className="w-full rounded-lg bg-[#F9FAFB] px-4 py-3 text-[13px] text-[#191F28] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3180F7]"
                />
              </div>
            </div>
            <div className="flex gap-2 px-6 pb-6">
              <button
                onClick={() => setTransferOpen(false)}
                className="flex-1 rounded-lg bg-[#F2F4F6] py-3 text-[13px] font-semibold text-[#191F28] hover:bg-[#E5E8EB]"
              >
                취소
              </button>
              <button
                onClick={handleTransfer}
                disabled={transferring}
                className="flex-1 rounded-lg bg-[#3180F7] py-3 text-[13px] font-semibold text-white hover:bg-[#1B64DA] disabled:opacity-50"
              >
                {transferring ? '이관 중...' : '이관 실행'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
