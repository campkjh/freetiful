'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/auth.store';
import { quotationApi } from '@/lib/api/quotation.api';
import { prosApi } from '@/lib/api/pros.api';
import { reviewApi } from '@/lib/api/review.api';
import { scheduleApi } from '@/lib/api/schedule.api';
import { matchApi } from '@/lib/api/match.api';
import { apiClient } from '@/lib/api/client';
import { chatApi } from '@/lib/api/chat.api';
import { archiveMatchRequest, splitArchivedMatchRequests } from '@/lib/pro-request-archive';
import {
  ProCardListSkeleton,
  ProMiniCardGridSkeleton,
  ProReviewListSkeleton,
  ProRevenueSkeleton,
  ProStatGridSkeleton,
  ProScheduleCardSkeleton,
} from './_components/ProSkeletons';
import { SwipeArchiveCard } from './_components/SwipeArchiveCard';

/* ─── Detailed SVG Icons (multi-layered, flat-color, premium) ─── */

const BellIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <rect x="3" y="3" width="22" height="22" rx="11" fill="#EFF6FF" />
    <path
      d="M14 7.5C11.65 7.5 9.75 9.4 9.75 11.75V15.4L8.2 18.25H19.8L18.25 15.4V11.75C18.25 9.4 16.35 7.5 14 7.5Z"
      fill="#3180F7"
    />
    <path
      d="M14 7.5C11.65 7.5 9.75 9.4 9.75 11.75V15.4L8.2 18.25H14V7.5Z"
      fill="#60A5FA"
    />
    <path d="M12.2 19.25C12.45 20.1 13.15 20.7 14 20.7C14.85 20.7 15.55 20.1 15.8 19.25H12.2Z" fill="#2563EB" />
    <path d="M7.4 10.5C7.75 9.1 8.65 7.9 9.85 7.15" stroke="#93C5FD" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M20.6 10.5C20.25 9.1 19.35 7.9 18.15 7.15" stroke="#93C5FD" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="20.5" cy="7.5" r="3" fill="#EF4444" stroke="white" strokeWidth="1.4" />
  </svg>
);

const DocumentDetailedIcon = () => (
  <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
    <rect x="5" y="2" width="20" height="26" rx="3" fill="#3180F7" />
    <path d="M18 2H22C23.66 2 25 3.34 25 5V2L18 2Z" fill="#2563EB" />
    <path d="M18 2V7C18 7.55 18.45 8 19 8H25L18 2Z" fill="#93C5FD" />
    <rect x="9" y="11" width="12" height="2" rx="1" fill="#BFDBFE" />
    <rect x="9" y="15" width="8" height="2" rx="1" fill="#DBEAFE" />
    <rect x="9" y="19" width="10" height="2" rx="1" fill="#BFDBFE" />
    <rect x="9" y="23" width="6" height="2" rx="1" fill="#DBEAFE" />
  </svg>
);

const MoneyDetailedIcon = () => (
  <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
    <rect x="2" y="6" width="26" height="18" rx="4" fill="#22C55E" />
    <rect x="2" y="6" width="26" height="6" rx="4" fill="#16A34A" />
    <circle cx="15" cy="16" r="5.5" fill="#15803D" />
    <circle cx="15" cy="16" r="4" fill="#22C55E" />
    <text x="15" y="19.5" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">₩</text>
    <circle cx="5" cy="16" r="1.5" fill="#15803D" opacity="0.4" />
    <circle cx="25" cy="16" r="1.5" fill="#15803D" opacity="0.4" />
  </svg>
);

const EyeDetailedIcon = () => (
  <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
    <path d="M15 8C8 8 3 15 3 15C3 15 8 22 15 22C22 22 27 15 27 15C27 15 22 8 15 8Z" fill="#A78BFA" />
    <path d="M15 8C8 8 3 15 3 15C3 15 8 22 15 22V8Z" fill="#C4B5FD" />
    <circle cx="15" cy="15" r="5" fill="#fff" />
    <circle cx="15" cy="15" r="3" fill="#7C3AED" />
    <circle cx="13.5" cy="13.5" r="1" fill="#fff" opacity="0.8" />
    <path d="M3 15C3 15 5 10 10 8.5" stroke="#C4B5FD" strokeWidth="0.5" fill="none" opacity="0.5" />
  </svg>
);

const StarDetailedIcon = () => (
  <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
    <path d="M15 3L18.54 10.16L26.5 11.33L20.75 16.92L22.08 24.84L15 21.1L7.92 24.84L9.25 16.92L3.5 11.33L11.46 10.16L15 3Z" fill="#FACC15" />
    <path d="M15 3L18.54 10.16L26.5 11.33L20.75 16.92L22.08 24.84L15 21.1V3Z" fill="#EAB308" />
    <circle cx="15" cy="14" r="2" fill="#FDE68A" opacity="0.6" />
  </svg>
);

const SmallStarIcon = ({ filled = true }: { filled?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M7 1L8.55 4.63L12.5 5.13L9.75 7.57L10.49 11.47L7 9.39L3.51 11.47L4.25 7.57L1.5 5.13L5.45 4.63L7 1Z"
      fill={filled ? '#FACC15' : '#E5E7EB'}
    />
  </svg>
);

const PersonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="6" r="4" fill="#93C5FD" />
    <circle cx="10" cy="6" r="2.5" fill="#60A5FA" />
    <path d="M2 18C2 14 5.58 11 10 11C14.42 11 18 14 18 18H2Z" fill="#93C5FD" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M6 3L11 8L6 13" stroke="#3180F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#F3F4F6" />
    <path d="M8 8L16 16M16 8L8 16" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const BarChartIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <rect x="2" y="12" width="4" height="8" rx="1" fill="#93C5FD" />
    <rect x="9" y="6" width="4" height="14" rx="1" fill="#3180F7" />
    <rect x="16" y="9" width="4" height="11" rx="1" fill="#60A5FA" />
    <rect x="2" y="12" width="4" height="3" rx="1" fill="#BFDBFE" />
    <rect x="9" y="6" width="4" height="3" rx="1" fill="#60A5FA" />
    <rect x="16" y="9" width="4" height="3" rx="1" fill="#93C5FD" />
  </svg>
);

const ArchiveIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="2" y="2" width="14" height="4" rx="1.5" fill="#6B7280" />
    <path d="M3 6H15V15C15 15.55 14.55 16 14 16H4C3.45 16 3 15.55 3 15V6Z" fill="#9CA3AF" />
    <rect x="7" y="9" width="4" height="2" rx="1" fill="#fff" />
  </svg>
);

const ReplyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M6 4L2 8L6 12V9.5C10 9.5 12.5 10.5 14 13C13.5 9 11 6.5 6 6V4Z" fill="#3180F7" />
  </svg>
);

/* ─── Types ─── */

interface Quote {
  id: string;
  clientName: string;
  eventType: string;
  eventDate: string;
  plan: 'Premium' | 'Superior' | 'Enterprise';
  budget: string;
  status: 'pending' | 'accepted' | 'rejected' | 'archived';
  rejectionReason?: string;
}

/* ─── Types ─── */

interface UpcomingEvent {
  date: string;
  day: string;
  eventType: string;
  venue: string;
  status: string;
}

interface RecentReview {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
  badge: '개인' | 'Biz' | '에이전시';
  scores: { 경력: number; 만족도: number; 구성력: number; 위트: number; 발성: number; 이미지: number };
}

const REJECTION_REASONS = ['일정 불가', '지역 불가', '금액 불일치', '전문 분야 불일치', '기타'];

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  Premium: { bg: 'bg-blue-100', text: 'text-blue-700' },
  Superior: { bg: 'bg-purple-100', text: 'text-purple-700' },
  Enterprise: { bg: 'bg-amber-100', text: 'text-amber-700' },
};

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  '개인': { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  'Biz': { bg: 'bg-blue-50', text: 'text-blue-600' },
  '에이전시': { bg: 'bg-purple-50', text: 'text-purple-600' },
};

const CATEGORY_LABELS = ['경력', '만족도', '구성력', '위트', '발성', '이미지'] as const;
const DASHBOARD_CACHE_KEY = 'freetiful-pro-dashboard-cache-v2';
const DASHBOARD_CACHE_TTL = 5 * 60_000;

type DashboardCache = {
  ts: number;
  puddingCount?: number;
  reviewCount?: number;
  avgRating?: string;
  monthlyRevenue?: number;
  lastMonthRevenue?: number;
  profileViews?: number;
  upcomingEvents?: UpcomingEvent[];
  recentReviews?: RecentReview[];
  inquiryRooms?: { id: string; userName: string; image: string; message: string; receivedAt: string; unread: number }[];
  scheduleRequests?: any[];
  matchRequests?: any[];
  quotes?: Quote[];
};

function readDashboardCache(): DashboardCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardCache;
    if (!parsed?.ts || Date.now() - parsed.ts > DASHBOARD_CACHE_TTL) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDashboardCache(patch: Omit<Partial<DashboardCache>, 'ts'>) {
  if (typeof window === 'undefined') return;
  try {
    const prevRaw = localStorage.getItem(DASHBOARD_CACHE_KEY);
    const prev = prevRaw ? JSON.parse(prevRaw) : {};
    localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify({ ...prev, ...patch, ts: Date.now() }));
  } catch {}
}

/* ─── Animation ─── */

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const modalOverlay = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalSheet = {
  hidden: { y: '100%' },
  visible: { y: 0, transition: { type: 'spring', damping: 28, stiffness: 300 } },
  exit: { y: '100%', transition: { duration: 0.25 } },
};

const TOSS_CARD_MOTION = 'toss-pressable transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out active:scale-[0.985] hover:-translate-y-0.5 hover:border-[#3180F7]/35 hover:shadow-[0_10px_28px_rgba(15,23,42,0.08)]';
const TOSS_BUTTON_MOTION = 'toss-pressable transition-[transform,box-shadow,background-color,color] duration-200 ease-out active:scale-[0.97]';
const TOSS_ICON_MOTION = 'toss-pressable transition-[transform,background-color] duration-200 ease-out active:scale-[0.9] hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3180F7]/25';

function tossDelay(index: number, base = 0) {
  return { animationDelay: `${base + index * 45}ms` };
}

/* ─── Helpers ─── */

function formatDate(iso: string) {
  const d = new Date(iso);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${m}/${day} (${weekday})`;
}

function timeAgo(dateStr?: string | null) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const days = Math.floor(hr / 24);
  return days < 7 ? `${days}일 전` : `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatMatchTime(value?: string | null) {
  if (!value) return '';
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  const isoTime = String(value).match(/T(\d{2}:\d{2})/);
  if (isoTime) return isoTime[1];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatMatchBudget(min?: number | null, max?: number | null) {
  const fmt = (n: number) => n >= 10000 ? `${Math.round(n / 10000)}만` : n.toLocaleString();
  if (min != null && max != null) return `${fmt(min)}원 ~ ${fmt(max)}원`;
  if (min != null) return `${fmt(min)}원 이상`;
  if (max != null) return `${fmt(max)}원 이하`;
  return '협의';
}

function getMatchRaw(delivery: any) {
  const raw = delivery?.matchRequest?.rawUserInput;
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/* ─── Component ─── */

export default function ProDashboardPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const [initialDashboardCache] = useState<DashboardCache | null>(() => readDashboardCache());
  const hasCachedScheduleRequests = initialDashboardCache?.scheduleRequests != null;
  const hasCachedMatchRequests = initialDashboardCache?.matchRequests != null;
  const hasCachedInquiryRooms = initialDashboardCache?.inquiryRooms != null;
  const hasCachedQuotes = initialDashboardCache?.quotes != null;
  const hasCachedReviews =
    initialDashboardCache?.recentReviews != null ||
    initialDashboardCache?.reviewCount != null ||
    initialDashboardCache?.avgRating != null;
  const hasCachedUpcoming = initialDashboardCache?.upcomingEvents != null;
  const hasCachedPudding = initialDashboardCache?.puddingCount != null;
  const hasCachedRevenue =
    initialDashboardCache?.monthlyRevenue != null ||
    initialDashboardCache?.lastMonthRevenue != null ||
    initialDashboardCache?.profileViews != null;
  const [name, setName] = useState(() => {
    if (typeof window === 'undefined') return '프로';
    return localStorage.getItem('proRegister_name') || '프로';
  });
  const [quotes, setQuotes] = useState<Quote[]>(() => initialDashboardCache?.quotes ?? []);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [confirmAccept, setConfirmAccept] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [savedReplies, setSavedReplies] = useState<Record<string, string>>({});
  const [puddingCount, setPuddingCount] = useState(() => initialDashboardCache?.puddingCount ?? 0);
  const [reviewCount, setReviewCount] = useState(() => initialDashboardCache?.reviewCount ?? 0);
  const [avgRating, setAvgRating] = useState(() => initialDashboardCache?.avgRating ?? '0.0');
  const [monthlyRevenue, setMonthlyRevenue] = useState(() => initialDashboardCache?.monthlyRevenue ?? 0);
  const [lastMonthRevenue, setLastMonthRevenue] = useState(() => initialDashboardCache?.lastMonthRevenue ?? 0);
  const [profileViews, setProfileViews] = useState(() => initialDashboardCache?.profileViews ?? 0);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>(() => initialDashboardCache?.upcomingEvents ?? []);
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>(() => initialDashboardCache?.recentReviews ?? []);
  const [inquiryRooms, setInquiryRooms] = useState<{ id: string; userName: string; image: string; message: string; receivedAt: string; unread: number }[]>(() => initialDashboardCache?.inquiryRooms ?? []);
  const [scheduleRequests, setScheduleRequests] = useState<any[]>(() => initialDashboardCache?.scheduleRequests ?? []);
  const [matchRequests, setMatchRequests] = useState<any[]>(() => {
    const cached = initialDashboardCache?.matchRequests ?? [];
    return splitArchivedMatchRequests(cached).active;
  });
  const [scheduleRequestsLoading, setScheduleRequestsLoading] = useState(!hasCachedScheduleRequests);
  const [matchRequestsLoading, setMatchRequestsLoading] = useState(!hasCachedMatchRequests);
  const [inquiryRoomsLoading, setInquiryRoomsLoading] = useState(!hasCachedInquiryRooms);
  const [quotesLoading, setQuotesLoading] = useState(!hasCachedQuotes);
  const [reviewsLoading, setReviewsLoading] = useState(!hasCachedReviews);
  const [upcomingLoading, setUpcomingLoading] = useState(!hasCachedUpcoming);
  const [puddingLoading, setPuddingLoading] = useState(!hasCachedPudding);
  const [revenueLoading, setRevenueLoading] = useState(!hasCachedRevenue);
  const [rejectSched, setRejectSched] = useState<{ id: string; userName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [initiatingMatchChat, setInitiatingMatchChat] = useState<string | null>(null);
  // 새 요청 페이지 마지막 방문 시각 — 홈 대시보드 카운트 배지를 0 으로 만들기 위함.
  const [inquiriesViewedAt, setInquiriesViewedAt] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const v = localStorage.getItem('freetiful-pro-inquiries-viewed-at');
    return v ? Number(v) || 0 : 0;
  });
  useEffect(() => {
    const onViewed = () => {
      const v = localStorage.getItem('freetiful-pro-inquiries-viewed-at');
      setInquiriesViewedAt(v ? Number(v) || 0 : 0);
    };
    window.addEventListener('freetiful:inquiries-viewed', onViewed);
    window.addEventListener('focus', onViewed);
    return () => {
      window.removeEventListener('freetiful:inquiries-viewed', onViewed);
      window.removeEventListener('focus', onViewed);
    };
  }, []);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cachedSectionsRef = useRef({
    scheduleRequests: hasCachedScheduleRequests,
    matchRequests: hasCachedMatchRequests,
    inquiryRooms: hasCachedInquiryRooms,
    quotes: hasCachedQuotes,
    reviews: hasCachedReviews,
    upcoming: hasCachedUpcoming,
    pudding: hasCachedPudding,
    revenue: hasCachedRevenue,
  });

  useEffect(() => {
    const storedName = localStorage.getItem('proRegister_name') || '프로';
    setName(storedName);

    const cached = readDashboardCache();
    if (cached) {
      if (cached.puddingCount != null) {
        setPuddingCount(cached.puddingCount);
        cachedSectionsRef.current.pudding = true;
        setPuddingLoading(false);
      }
      if (cached.reviewCount != null) setReviewCount(cached.reviewCount);
      if (cached.avgRating != null) setAvgRating(cached.avgRating);
      if (cached.recentReviews) {
        setRecentReviews(cached.recentReviews);
        cachedSectionsRef.current.reviews = true;
        setReviewsLoading(false);
      }
      if (cached.monthlyRevenue != null) setMonthlyRevenue(cached.monthlyRevenue);
      if (cached.lastMonthRevenue != null) setLastMonthRevenue(cached.lastMonthRevenue);
      if (cached.profileViews != null) setProfileViews(cached.profileViews);
      if (cached.monthlyRevenue != null || cached.lastMonthRevenue != null || cached.profileViews != null) {
        cachedSectionsRef.current.revenue = true;
        setRevenueLoading(false);
      }
      if (cached.upcomingEvents) {
        setUpcomingEvents(cached.upcomingEvents);
        cachedSectionsRef.current.upcoming = true;
        setUpcomingLoading(false);
      }
      if (cached.inquiryRooms) {
        setInquiryRooms(cached.inquiryRooms);
        cachedSectionsRef.current.inquiryRooms = true;
        setInquiryRoomsLoading(false);
      }
      if (cached.scheduleRequests) {
        setScheduleRequests(cached.scheduleRequests);
        cachedSectionsRef.current.scheduleRequests = true;
        setScheduleRequestsLoading(false);
      }
      if (cached.matchRequests) {
        setMatchRequests(splitArchivedMatchRequests(cached.matchRequests).active);
        cachedSectionsRef.current.matchRequests = true;
        setMatchRequestsLoading(false);
      }
      if (cached.quotes) {
        setQuotes(cached.quotes);
        cachedSectionsRef.current.quotes = true;
        setQuotesLoading(false);
      }
    }

    const storedReplies = localStorage.getItem('pro-review-replies');
    if (storedReplies) {
      try { setSavedReplies(JSON.parse(storedReplies)); } catch { /* ignore */ }
    }

    try {
      const storedPudding = localStorage.getItem('freetiful-pudding');
      if (cached?.puddingCount == null) setPuddingCount(storedPudding ? Number(storedPudding) : 0);
    } catch { /* ignore */ }
  }, []);

  // 스케줄 요청 조회 (고객이 구매해서 대기중인 요청)
  useEffect(() => {
    if (!authUser) { setScheduleRequestsLoading(false); return; }
    if (!cachedSectionsRef.current.scheduleRequests) setScheduleRequestsLoading(true);
    prosApi.getScheduleRequests()
      .then((data: any) => {
        const next = Array.isArray(data) ? data : [];
        setScheduleRequests(next);
        cachedSectionsRef.current.scheduleRequests = true;
        writeDashboardCache({ scheduleRequests: next });
      })
      .catch(() => {})
      .finally(() => setScheduleRequestsLoading(false));
  }, [authUser]);

  // 사회자/사회자 매치 요청 (홈 > 전문결혼식사회자 찾기 에서 고객이 보낸 요청들)
  useEffect(() => {
    if (!authUser) { setMatchRequestsLoading(false); return; }
    let cancelled = false;
    const load = (silent = false) => {
      if (!silent && !cachedSectionsRef.current.matchRequests) setMatchRequestsLoading(true);
      matchApi.getProRequests()
        .then((data: any) => {
          if (cancelled) return;
          const items = Array.isArray(data) ? data : (data?.data || []);
          // pending 또는 viewed 상태의 요청만 "새 요청" 카운트
          const visible = items.filter((m: any) => m.status === 'pending' || m.status === 'viewed');
          const { active } = splitArchivedMatchRequests(visible);
          setMatchRequests(active);
          cachedSectionsRef.current.matchRequests = true;
          writeDashboardCache({ matchRequests: active });
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setMatchRequestsLoading(false);
        });
    };
    load();
    const refresh = () => load(true);
    const interval = window.setInterval(() => load(true), 15000);
    window.addEventListener('focus', refresh);
    window.addEventListener('freetiful:match-requests-changed', refresh);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('freetiful:match-requests-changed', refresh);
    };
  }, [authUser]);

  const refreshScheduleRequests = () => {
    prosApi.getScheduleRequests()
      .then((data: any) => {
        const next = Array.isArray(data) ? data : [];
        setScheduleRequests(next);
        writeDashboardCache({ scheduleRequests: next });
      })
      .catch(() => {});
  };

  const refreshMatchRequests = () => {
    matchApi.getProRequests()
      .then((data: any) => {
        const items = Array.isArray(data) ? data : (data?.data || []);
        const visible = items.filter((m: any) => m.status === 'pending' || m.status === 'viewed');
        const { active } = splitArchivedMatchRequests(visible);
        setMatchRequests(active);
        writeDashboardCache({ matchRequests: active });
        window.dispatchEvent(new Event('freetiful:match-requests-changed'));
      })
      .catch(() => {});
  };

  const handleAcceptSchedule = async (id: string, goToChat = true) => {
    try {
      await prosApi.acceptScheduleRequest(id);
      toast.success('예약이 확정되었습니다');
      const req = scheduleRequests.find((r) => r.id === id);
      setScheduleRequests((prev) => {
        const next = prev.filter((r) => r.id !== id);
        writeDashboardCache({ scheduleRequests: next });
        return next;
      });
      if (goToChat && req?.clientId) {
        // 사회자→고객 측 룸 생성/조회 (createRoom 은 고객 측 API 라 proProfileId 를 요구하므로 잘못 — pro 가 먼저 거는 createRoomAsPro 사용)
        const { chatApi } = await import('@/lib/api/chat.api');
        const room = await chatApi.createRoomAsPro(req.clientId).catch((e: any) => {
          // 매칭 검증이 필요한 케이스(matchRequestId 누락 등)에 대한 폴백: 일반 createRoom 시도
          return null;
        });
        const roomId = (room as any)?.data?.id || (room as any)?.id;
        if (roomId) router.push(`/chat/${roomId}`);
        else { toast.error('채팅방 연결 실패 — 채팅 탭에서 직접 진입해주세요'); refreshScheduleRequests(); }
      } else {
        refreshScheduleRequests();
      }
    } catch (e: any) {
      toast.error(`수락 실패: ${e?.response?.data?.message || e?.message || ''}`);
    }
  };

  const handleRejectSchedule = async () => {
    if (!rejectSched) return;
    try {
      await prosApi.rejectScheduleRequest(rejectSched.id, rejectReason.trim() || undefined);
      toast.success('스케줄 요청이 거절되었습니다');
      setScheduleRequests((prev) => {
        const next = prev.filter((r) => r.id !== rejectSched.id);
        writeDashboardCache({ scheduleRequests: next });
        return next;
      });
      setRejectSched(null);
      setRejectReason('');
    } catch (e: any) {
      toast.error(`거절 실패: ${e?.response?.data?.message || e?.message || ''}`);
    }
  };

  const handleStartMatchChat = async (delivery: any) => {
    if (initiatingMatchChat) return;
    const customerId = delivery?.matchRequest?.user?.id;
    if (!customerId) {
      toast.error('고객 정보를 확인할 수 없습니다.');
      return;
    }
    setInitiatingMatchChat(delivery.id);
    try {
      // 응답 실패 (이미 응답한 경우 등) 는 무시 가능 — 채팅 룸 생성이 본질
      try { await matchApi.respond(delivery.id, 'accept'); } catch (e: any) {
        const msg = e?.response?.data?.message;
        // 이미 응답된 케이스가 아니면 사용자에게 알림 (조용히 진행)
        if (msg && !/이미 응답/.test(msg)) console.warn('match respond:', msg);
      }
      const res = await chatApi.createRoomAsPro(customerId, delivery.matchRequestId);
      const roomId = (res as any)?.data?.id || (res as any)?.id;
      setMatchRequests((prev) => {
        const next = prev.filter((m) => m.id !== delivery.id);
        writeDashboardCache({ matchRequests: next });
        return next;
      });
      window.dispatchEvent(new Event('freetiful:match-requests-changed'));
      if (roomId) router.push(`/chat/${roomId}`);
      else toast.error('채팅방 생성에 실패했습니다');
    } catch (e: any) {
      toast.error(`채팅 연결 실패: ${e?.response?.data?.message || e?.message || ''}`);
      refreshMatchRequests();
    } finally {
      setInitiatingMatchChat(null);
    }
  };

  const handleRejectMatch = async (deliveryId: string) => {
    try {
      await matchApi.respond(deliveryId, 'reject');
      setMatchRequests((prev) => {
        const next = prev.filter((m) => m.id !== deliveryId);
        writeDashboardCache({ matchRequests: next });
        return next;
      });
      window.dispatchEvent(new Event('freetiful:match-requests-changed'));
      toast.success('고객에게 추천 안내를 보냈습니다');
    } catch (e: any) {
      toast.error(`거절 실패: ${e?.response?.data?.message || e?.message || ''}`);
    }
  };

  const handleArchiveMatch = (deliveryId: string) => {
    archiveMatchRequest(deliveryId);
    setMatchRequests((prev) => {
      const next = prev.filter((m) => m.id !== deliveryId);
      writeDashboardCache({ matchRequests: next });
      return next;
    });
    window.dispatchEvent(new Event('freetiful:match-requests-changed'));
    toast.success('요청을 보관했습니다');
  };

  // Fetch chat inquiries (customer 견적 요청) - 견적 요청 메시지 포함된 채팅방
  useEffect(() => {
    if (!authUser) { setInquiryRoomsLoading(false); return; }
    if (!cachedSectionsRef.current.inquiryRooms) setInquiryRoomsLoading(true);
    apiClient.get('/api/v1/chat/rooms', { params: { page: 1, limit: 20, withTotal: false } })
      .then((res: any) => {
        const rooms = (res?.data?.data || []) as any[];
        const mapped = rooms
          .filter((r) => (
            r.iAmPro &&
            (
              r.hasQuoteInquiry ||
              r.matchRequestId ||
              r.latestQuotationStatus ||
              /견적|문의/.test(r.lastMessage?.content || '')
            )
          ))
          .map((r) => {
            const d = r.lastMessageAt ? new Date(r.lastMessageAt) : null;
            const diff = d ? Date.now() - d.getTime() : 0;
            const min = Math.floor(diff / 60000);
            const ago = !d ? '' : min < 1 ? '방금' : min < 60 ? `${min}분 전` : Math.floor(min / 60) < 24 ? `${Math.floor(min / 60)}시간 전` : `${Math.floor(min / 1440)}일 전`;
            return {
              id: r.id,
              userName: r.otherUser?.name || '고객',
              image: r.otherUser?.profileImageUrl || '/images/default-profile.svg',
              message: (r.lastMessage?.content || '').replace('📋 견적 요청', '').split('\n').find((l: string) => l.trim())?.trim() || '견적 요청',
              receivedAt: ago,
              unread: r.unreadCount || 0,
            };
          });
        setInquiryRooms(mapped);
        cachedSectionsRef.current.inquiryRooms = true;
        writeDashboardCache({ inquiryRooms: mapped });
      })
      .catch(() => {})
      .finally(() => setInquiryRoomsLoading(false));
  }, [authUser]);

  // Fetch quotation requests for pro
  useEffect(() => {
    if (!authUser) { setQuotesLoading(false); return; }
    if (!cachedSectionsRef.current.quotes) setQuotesLoading(true);
    quotationApi.getForPro({ limit: 20 })
      .then((data: any) => {
        const items = data?.data || (Array.isArray(data) ? data : []);
        const mapped: Quote[] = items.map((q: any) => ({
          id: q.id,
          clientName: q.user?.name ? q.user.name.slice(0, 1) + '**' : '고객**',
          eventType: q.title || '행사',
          eventDate: q.eventDate || new Date().toISOString(),
          plan: (q.planName as Quote['plan']) || 'Premium',
          budget: q.amount ? `₩${Number(q.amount).toLocaleString()}` : '협의',
          status: q.status === 'cancelled' ? 'rejected' : ((q.status || 'pending') as Quote['status']),
        }));
        setQuotes(mapped);
        cachedSectionsRef.current.quotes = true;
        writeDashboardCache({ quotes: mapped });
      })
      .catch(() => {})
      .finally(() => setQuotesLoading(false));
  }, [authUser]);

  // Fetch review stats + recent reviews
  useEffect(() => {
    if (!authUser) { setReviewsLoading(false); return; }
    if (!cachedSectionsRef.current.reviews) setReviewsLoading(true);
    reviewApi.getMine({ page: 1, limit: 5 })
      .then((data: any) => {
        const items = data?.data || (Array.isArray(data) ? data : []);
        const total = data?.total ?? items.length;
        if (total != null) setReviewCount(total);
        if (data?.avgRating != null) setAvgRating(Number(data.avgRating).toFixed(1));
        let nextAvgRating = data?.avgRating != null ? Number(data.avgRating).toFixed(1) : undefined;
        let mapped: RecentReview[] = [];
        if (items.length > 0) {
          const avg = (items.reduce((s: number, r: any) => s + (r.avgRating || r.ratingSatisfaction || 0), 0) / items.length).toFixed(1);
          if (data?.avgRating == null) {
            nextAvgRating = avg;
            setAvgRating(avg);
          }
          mapped = items.slice(0, 2).map((r: any) => ({
            id: r.id,
            author: r.reviewer?.name ? r.reviewer.name.slice(0, 1) + '**' : '고객**',
            rating: Math.round((r.avgRating || r.ratingSatisfaction || 0) * 10) / 10,
            text: r.comment || '',
            date: r.createdAt || new Date().toISOString(),
            badge: '개인' as const,
            scores: {
              경력: r.ratingExperience || 0,
              만족도: r.ratingSatisfaction || 0,
              구성력: r.ratingComposition || 0,
              위트: r.ratingWit || 0,
              발성: r.ratingVoice || 0,
              이미지: r.ratingAppearance || 0,
            },
          }));
          setRecentReviews(mapped);
        }
        cachedSectionsRef.current.reviews = true;
        writeDashboardCache({
          reviewCount: total,
          ...(nextAvgRating ? { avgRating: nextAvgRating } : {}),
          recentReviews: mapped,
        });
      })
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  }, [authUser]);

  // Fetch upcoming scheduled events
  useEffect(() => {
    if (!authUser) { setUpcomingLoading(false); return; }
    if (!cachedSectionsRef.current.upcoming) setUpcomingLoading(true);
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

    const toUpcoming = (rows: any[]) => rows
        .filter((s: any) => s.status === 'booked' && new Date(s.date) >= now)
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 3)
        .map((s: any) => {
          const d = new Date(s.date);
          return {
            date: `${d.getMonth() + 1}/${d.getDate()}`,
            day: weekdays[d.getDay()],
            eventType: s.eventTitle || '일정',
            venue: s.eventLocation || '',
            status: '확정',
          };
        });

    Promise.allSettled([
      scheduleApi.getMySchedule(thisMonth),
      scheduleApi.getMySchedule(nextMonth),
    ]).then(([thisResult, nextResult]) => {
      const thisRows = thisResult.status === 'fulfilled' && Array.isArray(thisResult.value) ? thisResult.value : [];
      const nextRows = nextResult.status === 'fulfilled' && Array.isArray(nextResult.value) ? nextResult.value : [];
      const upcoming = toUpcoming([...thisRows, ...nextRows]);
      setUpcomingEvents(upcoming);
      cachedSectionsRef.current.upcoming = true;
      writeDashboardCache({ upcomingEvents: upcoming });
    }).finally(() => setUpcomingLoading(false));
  }, [authUser]);

  // Fetch pudding from API + 일일 출석체크 (하루 1회 +50)
  useEffect(() => {
    if (!authUser) { setPuddingLoading(false); return; }
    if (!cachedSectionsRef.current.pudding) setPuddingLoading(true);
    apiClient.get('/api/v1/pro/pudding')
      .then((res) => {
        if (res.data?.balance != null) {
          setPuddingCount(res.data.balance);
          cachedSectionsRef.current.pudding = true;
          writeDashboardCache({ puddingCount: res.data.balance });
        }
      })
      .catch(() => {})
      .finally(() => setPuddingLoading(false));

    apiClient.post('/api/v1/pro/pudding/attendance')
      .then((res) => {
        if (res.data?.granted) {
          toast.success('출석체크 완료! +50 푸딩 🍮', { duration: 2500 });
          setPuddingCount((prev) => {
            const next = prev + 50;
            writeDashboardCache({ puddingCount: next });
            return next;
          });
        }
      })
      .catch(() => { /* silently ignore */ });
  }, [authUser]);

  // Fetch revenue stats
  useEffect(() => {
    if (!authUser) { setRevenueLoading(false); return; }
    if (!cachedSectionsRef.current.revenue) setRevenueLoading(true);
    apiClient.get('/api/v1/pro/revenue')
      .then((res) => {
        const d = res.data;
        if (d?.thisMonth != null) setMonthlyRevenue(d.thisMonth);
        if (d?.lastMonth != null) setLastMonthRevenue(d.lastMonth);
        if (d?.profileViews != null) setProfileViews(d.profileViews);
        cachedSectionsRef.current.revenue = true;
        writeDashboardCache({
          ...(d?.thisMonth != null ? { monthlyRevenue: d.thisMonth } : {}),
          ...(d?.lastMonth != null ? { lastMonthRevenue: d.lastMonth } : {}),
          ...(d?.profileViews != null ? { profileViews: d.profileViews } : {}),
        });
      })
      .catch(() => { /* fallback */ })
      .finally(() => setRevenueLoading(false));
  }, [authUser]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  function saveQuotes(updated: Quote[]) {
    setQuotes(updated);
    localStorage.setItem('pro-quotes', JSON.stringify(updated));
    writeDashboardCache({ quotes: updated });
  }

  function handleAccept(id: string) {
    const updated = quotes.map((q) => (q.id === id ? { ...q, status: 'accepted' as const } : q));
    saveQuotes(updated);
    setConfirmAccept(null);
    // 채팅방으로 이동하여 견적서 발송
    toast.success('수락되었습니다. 채팅에서 견적서를 발송해주세요.');
    setTimeout(() => router.push('/chat/c1'), 500);
  }

  function handleReject() {
    if (!rejectTarget) return;
    const reason = selectedReason === '기타' ? customReason : selectedReason;
    const updated = quotes.map((q) =>
      q.id === rejectTarget ? { ...q, status: 'rejected' as const, rejectionReason: reason } : q,
    );
    saveQuotes(updated);
    setRejectTarget(null);
    setSelectedReason('');
    setCustomReason('');
  }

  function handleArchive(id: string) {
    const updated = quotes.map((q) => (q.id === id ? { ...q, status: 'archived' as const } : q));
    saveQuotes(updated);
    setContextMenu(null);
  }

  const handlePointerDown = useCallback((id: string, e: React.PointerEvent) => {
    const x = e.clientX;
    const y = e.clientY;
    longPressTimer.current = setTimeout(() => {
      setContextMenu({ id, x, y });
    }, 600);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  function saveReply(reviewId: string) {
    const text = replyTexts[reviewId];
    if (!text?.trim()) return;
    const updated = { ...savedReplies, [reviewId]: text };
    setSavedReplies(updated);
    localStorage.setItem('pro-review-replies', JSON.stringify(updated));
    setReplyingTo(null);
    setReplyTexts((prev) => ({ ...prev, [reviewId]: '' }));
  }

  const pendingQuotes = quotes.filter((q) => q.status === 'pending');

  const thisMonth = monthlyRevenue;
  const lastMonth = lastMonthRevenue;
  const maxRevenue = Math.max(thisMonth, lastMonth);
  // 각 섹션을 병렬로 갱신하되, 상단 지표 전체를 마지막 API 하나 때문에 막지 않는다.
  const quickStatsLoading = false;

  return (
    <div className="bg-gray-50 min-h-screen pb-28">
      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="px-5 pt-12 pb-4 flex items-center justify-between">
          <div>
            <h1
              className="text-xl font-bold text-gray-900"
            >
              안녕하세요, {name}님
            </h1>
            <p
              className="text-xs text-gray-400 mt-0.5"
            >
              {todayString()}
            </p>
          </div>
          <Link
            href="/pro-dashboard/notifications"
            aria-label="알림"
            className={`relative flex h-11 w-11 items-center justify-center rounded-full ${TOSS_ICON_MOTION}`}
          >
            <Bell size={22} strokeWidth={2.1} className="text-[#3180F7]" />
          </Link>
        </div>
      </div>
      {/* ── Quick Stats — 4-up row, 컴팩트 ── */}
      {quickStatsLoading ? (
        <ProStatGridSkeleton />
      ) : (
        <div
          className="px-4 mt-5 grid grid-cols-4 gap-2"
        >
          {[
            { icon: <img src="/images/monthly-revenue.svg" alt="" width={18} height={18} />, label: '이번달 매출', value: `₩${monthlyRevenue.toLocaleString()}`, bg: 'bg-green-50', href: '/pro-dashboard/revenue' },
            { icon: <img src="/images/profile-views.svg" alt="" width={18} height={18} />, label: '프로필 조회', value: `${profileViews}`, bg: 'bg-purple-50', href: '/pro-dashboard/views' },
            { icon: <img src="/images/avg-rating.svg" alt="" width={18} height={18} />, label: '평균 평점', value: avgRating, bg: 'bg-yellow-50', href: '/pro-dashboard/reviews' },
            { icon: <img src="/images/pro-mypage-icons/pudding-history.svg" alt="" width={18} height={18} />, label: '보유 푸딩', value: `${puddingCount.toLocaleString()}`, bg: 'bg-amber-50', href: '/my/pudding-history' },
          ].map((stat, i) => (
            <div key={i}>
              <Link href={stat.href}>
                <div
                  className={`toss-fade-up group rounded-xl bg-white p-2.5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] ${TOSS_CARD_MOTION}`}
                  style={tossDelay(i, 70)}
                >
                  <div className={`w-7 h-7 ${stat.bg} rounded-lg flex items-center justify-center mb-1.5 transition-transform duration-200 ease-out group-hover:scale-105 group-active:scale-95`}>
                    {stat.icon}
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium leading-tight">{stat.label}</p>
                  <p className="text-[13px] font-bold text-gray-900 mt-0.5 leading-tight truncate">{stat.value}</p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* ── 새 예약 (고객 결제 후 대기중) ── */}
      <div className="px-4 mt-6">
        <div className="mb-3">
          <h2 className="text-[18px] font-semibold text-[#2B313D]">새 예약</h2>
          <p className="text-[14px] font-medium text-[#8A909C]" style={{ marginTop: 2 }}>
            결제된 행사 · 수락 시 확정, 거절 시 환불
          </p>
        </div>

        {scheduleRequestsLoading ? (
          <ProScheduleCardSkeleton count={2} />
        ) : scheduleRequests.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-400">대기 중인 행사 예약이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {scheduleRequests.map((req, i) => {
              const d = new Date(req.date);
              const dateLabel = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
              const timeLabel = req.eventTime
                ? (() => { try { const t = new Date(req.eventTime); return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`; } catch { return ''; } })()
                : '';
              const paidLabel = req.paidAt
                ? (() => { const p = new Date(req.paidAt); return `${String(p.getMonth() + 1).padStart(2, '0')}.${String(p.getDate()).padStart(2, '0')} ${String(p.getHours()).padStart(2, '0')}:${String(p.getMinutes()).padStart(2, '0')}`; })()
                : '';
              return (
                <div
                  key={`sched-${req.id}`}
                  className={`toss-fade-up bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)] ${TOSS_CARD_MOTION}`}
                  style={{ ...tossDelay(i, 140), borderRadius: 24 }}
                >
                  {/* 품목 (행사 제목) */}
                  <p className="text-[15px] font-semibold text-[#2B313D] truncate">{req.title || '행사'}</p>
                  {/* 행사 주소 */}
                  {req.eventLocation && (
                    <p className="mt-1 text-[13px] text-[#51535C]">📍 {req.eventLocation}</p>
                  )}
                  {/* 행사 일시 */}
                  <p className="mt-0.5 text-[13px] text-[#51535C]">📅 {dateLabel}{timeLabel ? ` ${timeLabel}` : ''}</p>

                  {/* 가격 + 결제일시 */}
                  <div className="flex items-end justify-between mt-2.5">
                    <p className="text-[18px] font-semibold text-[#2B313D] tabular-nums">
                      {(req.amount || 0).toLocaleString()}원
                    </p>
                    {paidLabel && (
                      <p className="text-[12px] text-[#8A909C]">결제 {paidLabel}</p>
                    )}
                  </div>

                  {/* 액션 버튼 (좌: 상세보기 파란색 / 우: 수락 회색) */}
                  <div className="flex gap-2 mt-3">
                    <Link
                      href={req.paymentId ? `/schedule/${req.paymentId}` : '#'}
                      className={`flex-1 h-11 leading-[44px] text-center text-[14px] font-semibold ${TOSS_BUTTON_MOTION}`}
                      style={{ borderRadius: 12, backgroundColor: '#3787FF', color: '#FFFFFF', fontWeight: 600 }}
                    >
                      상세보기
                    </Link>
                    <button
                      onClick={() => handleAcceptSchedule(req.id, true)}
                      className={`flex-1 h-11 text-[14px] ${TOSS_BUTTON_MOTION}`}
                      style={{ borderRadius: 12, backgroundColor: '#F2F3F5', color: '#51535C', fontWeight: 600 }}
                    >
                      수락
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 새 요청 (전문결혼식사회자찾기에서 전달된 매칭 요청) ── */}
      <div className="px-4 mt-6">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-[18px] font-semibold text-[#2B313D]">새 요청</h2>
            <p className="text-[14px] font-medium text-[#8A909C]" style={{ marginTop: 2 }}>
              고객이 선택해서 보낸 견적 요청 · 수락 시 채팅으로 연결
            </p>
          </div>
          <Link href="/pro-dashboard/inquiries" className="flex items-center gap-0.5 text-[12px] font-medium text-[#3787FF]">
            전체 <ChevronRightIcon />
          </Link>
        </div>

        {matchRequestsLoading ? (
          <ProCardListSkeleton count={2} actions className="space-y-3" />
        ) : (
          <div className="space-y-2">
            {matchRequests.slice(0, 3).map((delivery: any, i: number) => {
              const request = delivery.matchRequest || {};
              const raw = getMatchRaw(delivery);
              const customer = request.user || {};
              const eventDate = request.eventDate || raw.date || null;
              const eventTime = raw.timeStart || request.eventTime || null;
              const eventTimeEnd = raw.timeEnd || null;
              const tags = [
                ...(Array.isArray(raw.moods) ? raw.moods : []),
                ...(request.styles || []).map((s: any) => s.styleOption?.name || '').filter(Boolean),
                ...(request.personalities || []).map((p: any) => p.personalityOption?.name || '').filter(Boolean),
              ].filter(Boolean);

              return (
                <SwipeArchiveCard
                  key={`match-${delivery.id}`}
                  onArchive={() => handleArchiveMatch(delivery.id)}
                  className={`toss-fade-up rounded-2xl border border-[#3180F7]/30 bg-white p-4 shadow-sm space-y-3 ${TOSS_CARD_MOTION}`}
                >
                  <div style={tossDelay(i, 160)}>
                  <div className="flex items-start gap-3">
                    <img src={customer.profileImageUrl || '/images/default-profile.svg'} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#3180F7] text-white">새 요청</span>
                        <p className="text-sm font-bold text-gray-900 truncate">{customer.name || '고객'}</p>
                        <span className="text-[10px] text-gray-300 ml-auto shrink-0">{timeAgo(delivery.deliveredAt)}</span>
                      </div>
                      <p className="text-[13px] text-gray-700 font-medium">
                        {[request.category?.name || raw.categoryName, request.eventCategory?.name || raw.eventType || raw.eventName].filter(Boolean).join(' · ') || '행사 요청'}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500 flex-wrap">
                        <span>📅 {eventDate ? formatDate(eventDate) : '미정'}{eventTime ? ` ${formatMatchTime(eventTime)}${eventTimeEnd ? ` ~ ${formatMatchTime(eventTimeEnd)}` : ''}` : ''}</span>
                        {(request.eventLocation || raw.location) && <span>📍 {request.eventLocation || raw.location}</span>}
                      </div>
                      {raw.planLabel && (
                        <p className="text-[12px] font-bold text-gray-700 mt-1.5">선택 플랜: {raw.planLabel}</p>
                      )}
                      <p className="text-[12px] font-bold text-[#3180F7] mt-1.5">
                        {formatMatchBudget(request.budgetMin ?? null, request.budgetMax ?? null)}
                      </p>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {tags.slice(0, 6).map((tag: string, i: number) => (
                            <span key={`${tag}-${i}`} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {raw.note && (
                        <p className="text-[12px] text-gray-600 mt-2 bg-gray-50 rounded-xl px-3 py-2 line-clamp-2">
                          {raw.note}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-gray-50">
                    <button
                      onClick={() => handleRejectMatch(delivery.id)}
                      disabled={initiatingMatchChat === delivery.id}
                      className={`flex-1 h-10 rounded-xl bg-gray-100 text-gray-600 text-[13px] font-bold hover:bg-gray-200 disabled:opacity-50 ${TOSS_BUTTON_MOTION}`}
                    >
                      거절
                    </button>
                    <button
                      onClick={() => handleStartMatchChat(delivery)}
                      disabled={initiatingMatchChat === delivery.id}
                      className={`flex-1 h-10 rounded-xl bg-[#3180F7] text-white text-[13px] font-bold shadow-[0_6px_14px_rgba(49,128,247,0.18)] hover:bg-blue-600 disabled:opacity-60 ${TOSS_BUTTON_MOTION}`}
                    >
                      {initiatingMatchChat === delivery.id ? '연결 중…' : '수락 + 채팅'}
                    </button>
                  </div>
                  </div>
                </SwipeArchiveCard>
              );
            })}

            {matchRequests.length === 0 && (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">새로 도착한 견적 요청이 없습니다</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Context Menu ── */}
      <>
        {contextMenu && (
          <div
            className="toss-soft-pop fixed z-50 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
            style={{ top: contextMenu.y, left: Math.min(contextMenu.x, window.innerWidth - 140) }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => handleArchive(contextMenu.id)}
              className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 font-medium hover:bg-gray-50 w-full"
            >
              <ArchiveIcon />
              보관
            </button>
          </div>
        )}
      </>

      {/* ── 다가오는 일정 ── */}
      <div className="px-4 mt-6">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-[18px] font-semibold text-[#2B313D]">다가오는 일정</h2>
            <p className="text-[14px] font-medium text-[#8A909C]" style={{ marginTop: 2 }}>
              확정된 다음 행사들
            </p>
          </div>
          <Link href="/schedule" className="flex items-center gap-0.5 text-[12px] font-medium text-[#3787FF]">
            전체 <ChevronRightIcon />
          </Link>
        </div>

        {upcomingLoading ? (
          <ProScheduleCardSkeleton count={2} />
        ) : upcomingEvents.length === 0 ? (
          <p className="text-[13px] text-[#8A909C] text-center py-8">예정된 일정이 없습니다</p>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map((ev, i) => {
              const ua: any = ev as any;
              return (
              <div
                key={i}
                className={`toss-fade-up bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)] ${TOSS_CARD_MOTION}`}
                style={{ ...tossDelay(i, 170), borderRadius: 24, border: '0.6px solid #F9F9F9' }}
              >
                {/* 품목 */}
                <p className="text-[15px] font-semibold text-[#2B313D] truncate">{ev.eventType || '일정'}</p>
                {/* 행사 주소 */}
                {ev.venue && (
                  <p className="mt-1 text-[13px] text-[#51535C]">📍 {ev.venue}</p>
                )}
                {/* 행사 일시 */}
                <p className="mt-0.5 text-[13px] text-[#51535C]">📅 {ev.date}{ev.day ? ` (${ev.day})` : ''}{ua.time ? ` ${ua.time}` : ''}</p>

                {/* 가격 + 결제일시 */}
                <div className="flex items-end justify-between mt-2.5">
                  {ua.amount != null ? (
                    <p className="text-[18px] font-semibold text-[#2B313D] tabular-nums">
                      {Number(ua.amount).toLocaleString()}원
                    </p>
                  ) : <span />}
                  {ua.paidAt && (
                    <p className="text-[14px] text-[#8A909C]">
                      {(() => { const p = new Date(ua.paidAt); return `결제 ${String(p.getMonth() + 1).padStart(2, '0')}.${String(p.getDate()).padStart(2, '0')}`; })()}
                    </p>
                  )}
                </div>

                {/* 액션 버튼 */}
                <div className="flex gap-2 mt-3">
                  <Link
                    href={ua.paymentId ? `/schedule/${ua.paymentId}` : '/schedule'}
                    className={`flex-1 h-11 leading-[44px] text-center text-[18px] ${TOSS_BUTTON_MOTION}`}
                    style={{ borderRadius: 12, backgroundColor: '#3787FF', color: '#FFFFFF', fontWeight: 600 }}
                  >
                    상세보기
                  </Link>
                  <Link
                    href="/schedule"
                    className={`flex-1 h-11 leading-[44px] text-center text-[18px] ${TOSS_BUTTON_MOTION}`}
                    style={{ borderRadius: 12, backgroundColor: '#F2F3F5', color: '#51535C', fontWeight: 600 }}
                  >
                    일정 보기
                  </Link>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 최근 리뷰 (with 6 category scores) ── */}
      <div
        className="px-4 mt-6"
      >
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-[18px] font-semibold text-[#2B313D]">최근 리뷰</h2>
            <p className="text-[14px] font-medium text-[#8A909C]" style={{ marginTop: 2 }}>
              고객의 솔직한 후기
            </p>
          </div>
          <Link href="/pro-dashboard/reviews" className="flex items-center gap-0.5 text-[12px] font-medium text-[#3787FF]">
            전체 <ChevronRightIcon />
          </Link>
        </div>
        <div className="space-y-4">
          {reviewsLoading ? (
            <ProReviewListSkeleton count={2} />
          ) : recentReviews.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">아직 리뷰가 없습니다</p>
          ) : recentReviews.map((review, i) => (
            <div
              key={review.id}
              className={`toss-fade-up rounded-2xl border border-gray-100 bg-white p-4 shadow-sm ${TOSS_CARD_MOTION}`}
              style={tossDelay(i, 190)}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">{review.author}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <SmallStarIcon key={s} filled={s <= review.rating} />
                    ))}
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${BADGE_COLORS[review.badge].bg} ${BADGE_COLORS[review.badge].text}`}>
                    {review.badge}
                  </span>
                </div>
                <span className="text-[11px] text-gray-300">{formatDate(review.date)}</span>
              </div>

              {/* Category Scores */}
              <div className="flex gap-2 flex-wrap mb-2">
                {CATEGORY_LABELS.map((cat) => (
                  <span key={cat} className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                    {cat} <span className="font-bold text-gray-600">{review.scores[cat]}</span>
                  </span>
                ))}
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">{review.text}</p>

              {/* Reply */}
              {savedReplies[review.id] ? (
                <div className="mt-2 bg-blue-50 rounded-lg px-3 py-2">
                  <p className="text-[11px] text-blue-600 font-medium">내 답글</p>
                  <p className="text-xs text-blue-800 mt-0.5">{savedReplies[review.id]}</p>
                </div>
              ) : (
                <>
                  {replyingTo === review.id ? (
                    <div
                      className="mt-2"
                    >
                      <textarea
                        value={replyTexts[review.id] || ''}
                        onChange={(e) => setReplyTexts((prev) => ({ ...prev, [review.id]: e.target.value }))}
                        placeholder="답글을 입력하세요..."
                        className="w-full border border-gray-200 rounded-lg p-2.5 text-[16px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#3180F7] focus:ring-1 focus:ring-[#3180F7] resize-none h-16"
                      />
                      <div className="flex gap-2 mt-1.5">
                        <button
                          onClick={() => setReplyingTo(null)}
                          className={`px-3 py-1.5 text-[11px] text-gray-400 font-medium ${TOSS_BUTTON_MOTION}`}
                        >
                          취소
                        </button>
                        <button
                          onClick={() => saveReply(review.id)}
                          className={`px-3 py-1.5 bg-[#3180F7] text-white text-[11px] font-bold rounded-lg shadow-[0_6px_14px_rgba(49,128,247,0.14)] hover:bg-blue-600 ${TOSS_BUTTON_MOTION}`}
                        >
                          등록
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setReplyingTo(review.id)}
                      className={`flex items-center gap-1 mt-2 text-[11px] text-[#3180F7] font-medium ${TOSS_BUTTON_MOTION}`}
                    >
                      <ReplyIcon /> 답글 작성
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 수익 현황 섹션 제거됨 (메뉴 → 수익관리 페이지로 이동) ── */}
      <div className="h-6" />

      {/* ── Accept Confirmation Modal ── */}
      <>
        {confirmAccept && (
          <div
            key="accept-overlay"
            className="toss-modal-fade fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-6"
            onClick={() => setConfirmAccept(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="toss-soft-pop bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"
            >
              <h3 className="text-base font-bold text-gray-900 text-center mb-2">견적 수락</h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                이 견적 요청을 수락하시겠습니까?<br />수락 후 고객에게 알림이 발송됩니다.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmAccept(null)}
                  className={`flex-1 py-3 rounded-xl bg-gray-100 text-sm font-bold text-gray-500 hover:bg-gray-200 ${TOSS_BUTTON_MOTION}`}
                >
                  취소
                </button>
                <button
                  onClick={() => handleAccept(confirmAccept)}
                  className={`flex-1 py-3 rounded-xl bg-[#3180F7] text-sm font-bold text-white shadow-[0_6px_14px_rgba(49,128,247,0.18)] hover:bg-blue-600 ${TOSS_BUTTON_MOTION}`}
                >
                  수락하기
                </button>
              </div>
            </div>
          </div>
        )}
      </>

      {/* ── 행사 예약 거절 (사유 입력 + 전액 환불) ── */}
      {rejectSched && (
        <div className="toss-modal-fade fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => { setRejectSched(null); setRejectReason(''); }}>
          <div onClick={(e) => e.stopPropagation()} className="toss-bottom-sheet bg-white rounded-t-3xl w-full shadow-xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 pt-3 pb-8">
              <h3 className="text-base font-bold text-gray-900 mb-1">행사 예약 거절</h3>
              <p className="text-[13px] text-gray-500 mb-2">{rejectSched.userName}님의 행사 예약을 거절합니다.</p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-4">
                <p className="text-[12px] text-amber-700 font-medium">
                  거절 즉시 고객에게 <b>전액 환불</b>됩니다. 입력한 사유는 운영 참고용으로만 보관됩니다.
                </p>
              </div>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="운영 참고용 메모 (예: 해당 날짜에 이미 다른 예약이 있어 수락이 어렵습니다)"
                className="w-full h-28 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[16px] outline-none focus:border-[#3180F7] resize-none"
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => { setRejectSched(null); setRejectReason(''); }}
                  className={`flex-1 h-12 rounded-xl bg-gray-100 text-gray-600 text-[15px] font-bold hover:bg-gray-200 ${TOSS_BUTTON_MOTION}`}
                >
                  취소
                </button>
                <button
                  onClick={handleRejectSchedule}
                  disabled={!rejectReason.trim()}
                  className={`flex-1 h-12 rounded-xl bg-red-500 text-white text-[15px] font-bold shadow-[0_6px_14px_rgba(239,68,68,0.18)] hover:bg-red-600 disabled:opacity-40 ${TOSS_BUTTON_MOTION}`}
                >
                  안내 보내기 · 환불
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Rejection Reason Modal ── */}
      <>
        {rejectTarget && (
          <div
            key="reject-overlay"
            className="toss-modal-fade fixed inset-0 z-50 bg-black/40 flex items-end"
            onClick={() => { setRejectTarget(null); setSelectedReason(''); setCustomReason(''); }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="toss-bottom-sheet bg-white rounded-t-3xl w-full max-h-[80vh] overflow-y-auto shadow-xl"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-200 rounded-full" />
              </div>
              <div className="px-5 pt-3 pb-8">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-bold text-gray-900">거절 사유 선택</h3>
                  <button
                    onClick={() => { setRejectTarget(null); setSelectedReason(''); setCustomReason(''); }}
                  >
                    <CloseIcon />
                  </button>
                </div>
                <div className="space-y-2 mb-5">
                  {REJECTION_REASONS.map((reason) => (
                    <button
                      key={reason}
                      onClick={() => setSelectedReason(reason)}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium ${TOSS_BUTTON_MOTION} ${
                        selectedReason === reason
                          ? 'bg-[#3180F7] text-white'
                          : 'bg-gray-50 text-gray-700 active:bg-gray-100'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                {selectedReason === '기타' && (
                  <div className="mb-5">
                    <textarea
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="거절 사유를 입력해주세요..."
                      className="w-full border border-gray-200 rounded-xl p-3 text-[16px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#3180F7] focus:ring-1 focus:ring-[#3180F7] resize-none h-24"
                    />
                  </div>
                )}
                <button
                  onClick={handleReject}
                  disabled={!selectedReason || (selectedReason === '기타' && !customReason.trim())}
                  className={`w-full py-3.5 rounded-xl bg-[#3180F7] text-white text-sm font-bold shadow-[0_6px_14px_rgba(49,128,247,0.18)] hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed ${TOSS_BUTTON_MOTION}`}
                >
                  거절하기
                </button>
              </div>
            </div>
          </div>
        )}
      </>

      <style jsx global>{`
        @keyframes toss-fade-up {
          from {
            opacity: 0;
            transform: translate3d(0, 12px, 0) scale(0.99);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @keyframes toss-soft-pop {
          from {
            opacity: 0;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes toss-bottom-sheet {
          from {
            opacity: 0;
            transform: translate3d(0, 18px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        @keyframes toss-modal-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .toss-pressable {
          -webkit-tap-highlight-color: transparent;
          will-change: transform;
        }

        .toss-fade-up {
          animation: toss-fade-up 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .toss-soft-pop {
          animation: toss-soft-pop 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .toss-bottom-sheet {
          animation: toss-bottom-sheet 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .toss-modal-fade {
          animation: toss-modal-fade 160ms ease-out both;
        }

        @media (prefers-reduced-motion: reduce) {
          .toss-fade-up,
          .toss-soft-pop,
          .toss-bottom-sheet,
          .toss-modal-fade {
            animation: none !important;
          }

          .toss-pressable {
            transition-duration: 0ms !important;
          }
        }
      `}</style>
    </div>
  );
}
