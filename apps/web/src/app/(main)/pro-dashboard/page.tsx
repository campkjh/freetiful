'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/auth.store';
import { quotationApi } from '@/lib/api/quotation.api';
import { reviewApi } from '@/lib/api/review.api';
import { scheduleApi } from '@/lib/api/schedule.api';
import { apiClient } from '@/lib/api/client';

/* ─── Detailed SVG Icons (multi-layered, flat-color, premium) ─── */

const BellIcon = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
    <path d="M13 2C9.13 2 6 5.13 6 9V13.5L4 17.5H22L20 13.5V9C20 5.13 16.87 2 13 2Z" fill="#D1D5DB" />
    <path d="M13 2C9.13 2 6 5.13 6 9V13.5L4 17.5H13V2Z" fill="#E5E7EB" />
    <rect x="10.5" y="19" width="5" height="3.5" rx="1.75" fill="#9CA3AF" />
    <circle cx="19" cy="5" r="4" fill="#EF4444" />
    <text x="19" y="7" textAnchor="middle" fill="#fff" fontSize="6" fontWeight="bold">3</text>
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

/* ─── Helpers ─── */

function formatDate(iso: string) {
  const d = new Date(iso);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${m}/${day} (${weekday})`;
}

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/* ─── Component ─── */

export default function ProDashboardPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const [name, setName] = useState('');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [confirmAccept, setConfirmAccept] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [savedReplies, setSavedReplies] = useState<Record<string, string>>({});
  const [puddingCount, setPuddingCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [avgRating, setAvgRating] = useState('0.0');
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [lastMonthRevenue, setLastMonthRevenue] = useState(0);
  const [profileViews, setProfileViews] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
  const [inquiryRooms, setInquiryRooms] = useState<{ id: string; userName: string; image: string; message: string; receivedAt: string; unread: number }[]>([]);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const storedName = localStorage.getItem('proRegister_name') || '프로';
    setName(storedName);

    const storedReplies = localStorage.getItem('pro-review-replies');
    if (storedReplies) {
      try { setSavedReplies(JSON.parse(storedReplies)); } catch { /* ignore */ }
    }

    try {
      const storedPudding = localStorage.getItem('freetiful-pudding');
      setPuddingCount(storedPudding ? Number(storedPudding) : 0);
    } catch { /* ignore */ }
  }, []);

  // Fetch chat inquiries (customer 견적 요청) - 견적 요청 메시지 포함된 채팅방
  useEffect(() => {
    if (!authUser) return;
    apiClient.get('/api/v1/chat/rooms', { params: { page: 1 } })
      .then((res: any) => {
        const rooms = (res?.data?.data || []) as any[];
        const mapped = rooms
          .filter((r) => r.lastMessage?.content?.includes('📋 견적 요청'))
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
      })
      .catch(() => {});
  }, [authUser]);

  // Fetch quotation requests for pro
  useEffect(() => {
    if (!authUser) return;
    quotationApi.getForPro({ limit: 20 })
      .then((data: any) => {
        const items = data?.data || (Array.isArray(data) ? data : []);
        if (items.length > 0) {
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
        }
      })
      .catch(() => {});
  }, [authUser]);

  // Fetch review stats + recent reviews
  useEffect(() => {
    if (!authUser) return;
    reviewApi.getMine({ page: 1, limit: 5 })
      .then((data: any) => {
        const items = data?.data || (Array.isArray(data) ? data : []);
        const total = data?.total ?? items.length;
        if (total != null) setReviewCount(total);
        if (data?.avgRating != null) setAvgRating(Number(data.avgRating).toFixed(1));
        if (items.length > 0) {
          const avg = (items.reduce((s: number, r: any) => s + (r.avgRating || r.ratingSatisfaction || 0), 0) / items.length).toFixed(1);
          if (data?.avgRating == null) setAvgRating(avg);
          const mapped: RecentReview[] = items.slice(0, 2).map((r: any) => ({
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
      })
      .catch(() => {});
  }, [authUser]);

  // Fetch upcoming scheduled events
  useEffect(() => {
    if (!authUser) return;
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

    Promise.all([
      scheduleApi.getMySchedule(thisMonth),
      scheduleApi.getMySchedule(nextMonth),
    ]).then(([thisData, nextData]: [any, any]) => {
      const all = [...(Array.isArray(thisData) ? thisData : []), ...(Array.isArray(nextData) ? nextData : [])];
      const upcoming: UpcomingEvent[] = all
        .filter((s: any) => s.status === 'booked' && new Date(s.date) >= now)
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
      setUpcomingEvents(upcoming);
    }).catch(() => {});
  }, [authUser]);

  // Fetch pudding from API
  useEffect(() => {
    if (!authUser) return;
    apiClient.get('/api/v1/pro/pudding')
      .then((res) => {
        if (res.data?.balance != null) setPuddingCount(res.data.balance);
      })
      .catch(() => { /* fallback */ });
  }, [authUser]);

  // Fetch revenue stats
  useEffect(() => {
    if (!authUser) return;
    apiClient.get('/api/v1/pro/revenue')
      .then((res) => {
        const d = res.data;
        if (d?.thisMonth != null) setMonthlyRevenue(d.thisMonth);
        if (d?.lastMonth != null) setLastMonthRevenue(d.lastMonth);
        if (d?.profileViews != null) setProfileViews(d.profileViews);
      })
      .catch(() => { /* fallback */ });
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
          <Link href="/pro-dashboard/notifications">
            <div className="relative p-2">
              <BellIcon />
            </div>
          </Link>
        </div>
      </div>

      {/* ── Quick Stats (clickable Links) ── */}
      <div
        className="px-4 mt-5 grid grid-cols-2 gap-3"
      >
        {[
          { icon: <img src="/images/new-quote.svg" alt="" width={24} height={24} />, label: '새 견적요청', value: `${pendingQuotes.length + inquiryRooms.length}건`, bg: 'bg-blue-50', href: '/pro-dashboard/inquiries' },
          { icon: <img src="/images/monthly-revenue.svg" alt="" width={24} height={24} />, label: '이번달 매출', value: `₩${monthlyRevenue.toLocaleString()}`, bg: 'bg-green-50', href: '/pro-dashboard/revenue' },
          { icon: <img src="/images/profile-views.svg" alt="" width={24} height={24} />, label: '프로필 조회', value: `${profileViews}회`, bg: 'bg-purple-50', href: '/pro-dashboard/views' },
          { icon: <img src="/images/avg-rating.svg" alt="" width={24} height={24} />, label: '평균 평점', value: avgRating, bg: 'bg-yellow-50', href: '/pro-dashboard/reviews' },
          { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#F59E0B" /><circle cx="12" cy="12" r="7" fill="#FBBF24" /><text x="12" y="16" textAnchor="middle" fill="#92400E" fontSize="11" fontWeight="bold">P</text></svg>, label: '보유 푸딩', value: `${puddingCount.toLocaleString()}개`, bg: 'bg-amber-50', href: '/my/pudding-history' },
        ].map((stat, i) => (
          <div key={i}>
            <Link href={stat.href}>
              <div
                className="bg-white rounded-2xl p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)] active:bg-gray-50 transition-colors"
              >
                <div className={`w-11 h-11 ${stat.bg} rounded-xl flex items-center justify-center mb-3`}>
                  {stat.icon}
                </div>
                <p className="text-[11px] text-gray-400 font-medium">{stat.label}</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5">{stat.value}</p>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {/* ── 견적 요청 ── */}
      <div
        className="px-4 mt-8"
      >
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-base font-bold text-gray-900">새로운 견적 요청</h2>
          {pendingQuotes.length > 0 && (
            <span className="bg-[#3180F7] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
              {pendingQuotes.length}
            </span>
          )}
        </div>

        <div className="space-y-3">
          {/* 채팅 기반 견적 요청 (고객이 보낸 📋 견적 요청 메시지) */}
          {inquiryRooms.map((inq) => (
            <Link
              key={`inq-${inq.id}`}
              href={`/chat/${inq.id}`}
              className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm block active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start gap-3">
                <img src={inq.image} alt={inq.userName} className="w-10 h-10 rounded-full object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#3180F7]">견적요청</span>
                    <p className="text-sm font-bold text-gray-900 truncate">{inq.userName}</p>
                    {inq.unread > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white ml-auto shrink-0">{inq.unread}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">{inq.message}</p>
                  <p className="text-[10px] text-gray-400 mt-2">{inq.receivedAt}</p>
                </div>
              </div>
            </Link>
          ))}
          <>
            {pendingQuotes.length === 0 && inquiryRooms.length === 0 && (
              <div
                className="py-10 text-center"
              >
                <p className="text-sm text-gray-400">대기 중인 견적 요청이 없습니다</p>
              </div>
            )}
            {pendingQuotes.map((quote, idx) => (
              <div
                key={quote.id}
                onPointerDown={(e) => handlePointerDown(quote.id, e)}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm select-none mb-3 last:mb-0"
              >
                {/* Top row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <PersonIcon />
                    <span className="text-sm font-bold text-gray-900">{quote.clientName}</span>
                    <span className="text-xs text-gray-400">{quote.eventType}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PLAN_COLORS[quote.plan].bg} ${PLAN_COLORS[quote.plan].text}`}
                  >
                    {quote.plan}
                  </span>
                </div>

                {/* Details row */}
                <div className="flex items-center gap-3 mb-3 text-xs text-gray-500">
                  <span>{formatDate(quote.eventDate)}</span>
                  <span className="text-gray-200">|</span>
                  <span className="font-bold text-gray-900">{quote.budget}</span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setRejectTarget(quote.id)}
                    className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-bold text-gray-500 transition-colors active:bg-gray-200"
                  >
                    거절
                  </button>
                  <button
                    onClick={() => setConfirmAccept(quote.id)}
                    className="flex-1 py-2.5 rounded-xl bg-[#3180F7] text-sm font-bold text-white transition-colors active:bg-[#2060D0]"
                  >
                    수락
                  </button>
                </div>
              </div>
            ))}
          </>
        </div>
      </div>

      {/* ── Context Menu ── */}
      <>
        {contextMenu && (
          <div
            className="fixed z-50 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
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

      {/* ── 다가오는 일정 (timeline style) ── */}
      <div
        className="px-4 mt-8"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">다가오는 일정</h2>
          <Link href="/schedule" className="flex items-center gap-0.5 text-xs font-medium text-[#3180F7]">
            전체보기 <ChevronRightIcon />
          </Link>
        </div>

        <div className="relative">
          {upcomingEvents.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">예정된 일정이 없습니다</p>
          )}
          {upcomingEvents.map((ev, i) => (
            <div
              key={i}
              className="flex gap-4 pb-5 last:pb-0 relative"
            >
              {/* Timeline line + dot */}
              <div className="flex flex-col items-center shrink-0 w-3">
                <div className="w-3 h-3 rounded-full bg-[#3180F7] mt-1.5 shrink-0 relative">
                  <div className="absolute inset-0 rounded-full bg-[#3180F7] animate-ping opacity-20" />
                </div>
                {i < upcomingEvents.length - 1 && (
                  <div className="w-0.5 flex-1 bg-blue-100 mt-1" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 flex items-start justify-between min-w-0">
                <div>
                  <p className="text-sm font-bold text-gray-900">{ev.date} ({ev.day})</p>
                  <p className="text-xs text-gray-700 mt-0.5">{ev.eventType}</p>
                  {ev.venue && <p className="text-[11px] text-gray-400 mt-0.5">{ev.venue}</p>}
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ml-2 ${
                  ev.status === '확정' ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50'
                }`}>
                  {ev.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 최근 리뷰 (with 6 category scores) ── */}
      <div
        className="px-4 mt-8"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">최근 리뷰</h2>
          <Link href="/pro-dashboard/reviews" className="flex items-center gap-0.5 text-xs font-medium text-[#3180F7]">
            전체보기 <ChevronRightIcon />
          </Link>
        </div>
        <div className="space-y-4">
          {recentReviews.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">아직 리뷰가 없습니다</p>
          )}
          {recentReviews.map((review, i) => (
            <div
              key={review.id}
              className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
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
                          className="px-3 py-1.5 text-[11px] text-gray-400 font-medium"
                        >
                          취소
                        </button>
                        <button
                          onClick={() => saveReply(review.id)}
                          className="px-3 py-1.5 bg-[#3180F7] text-white text-[11px] font-bold rounded-lg"
                        >
                          등록
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setReplyingTo(review.id)}
                      className="flex items-center gap-1 mt-2 text-[11px] text-[#3180F7] font-medium"
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

      {/* ── 수익 현황 ── */}
      <div
        className="px-4 mt-8 mb-8"
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChartIcon />
          <h2 className="text-base font-bold text-gray-900">수익 현황</h2>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-500">이번 달</span>
              <span className="text-sm font-bold text-gray-900">₩{thisMonth.toLocaleString()}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#3180F7] rounded-full transition-all duration-700"
                style={{ width: maxRevenue > 0 ? `${(thisMonth / maxRevenue) * 100}%` : '0%' }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-500">지난 달</span>
              <span className="text-sm font-bold text-gray-400">₩{lastMonth.toLocaleString()}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-300 rounded-full transition-all duration-700"
                style={{ width: maxRevenue > 0 ? `${(lastMonth / maxRevenue) * 100}%` : '0%' }}
              />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[11px] text-gray-400">전월 대비</span>
            <span className={`text-xs font-bold ${thisMonth >= lastMonth ? 'text-green-500' : 'text-red-400'}`}>
              {lastMonth > 0
                ? `${thisMonth >= lastMonth ? '+' : ''}${Math.round(((thisMonth - lastMonth) / lastMonth) * 100)}% ${thisMonth >= lastMonth ? '증가' : '감소'}`
                : thisMonth > 0 ? '첫 달 매출' : '매출 없음'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Accept Confirmation Modal ── */}
      <>
        {confirmAccept && (
          <div
            key="accept-overlay"
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-6"
            onClick={() => setConfirmAccept(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"
            >
              <h3 className="text-base font-bold text-gray-900 text-center mb-2">견적 수락</h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                이 견적 요청을 수락하시겠습니까?<br />수락 후 고객에게 알림이 발송됩니다.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmAccept(null)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-sm font-bold text-gray-500"
                >
                  취소
                </button>
                <button
                  onClick={() => handleAccept(confirmAccept)}
                  className="flex-1 py-3 rounded-xl bg-[#3180F7] text-sm font-bold text-white"
                >
                  수락하기
                </button>
              </div>
            </div>
          </div>
        )}
      </>

      {/* ── Rejection Reason Modal ── */}
      <>
        {rejectTarget && (
          <div
            key="reject-overlay"
            className="fixed inset-0 z-50 bg-black/40 flex items-end"
            onClick={() => { setRejectTarget(null); setSelectedReason(''); setCustomReason(''); }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl w-full max-h-[80vh] overflow-y-auto shadow-xl"
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
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
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
                  className="w-full py-3.5 rounded-xl bg-[#3180F7] text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  거절하기
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    </div>
  );
}
