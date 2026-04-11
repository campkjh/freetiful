'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── SVG Icons (flat-color, solid fill, no strokes) ─── */

const BellIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C8.69 2 6 4.69 6 8V12L4 16H20L18 12V8C18 4.69 15.31 2 12 2Z" fill="#9CA3AF" />
    <rect x="10" y="18" width="4" height="3" rx="1.5" fill="#9CA3AF" />
    <circle cx="17" cy="5" r="3.5" fill="#EF4444" />
  </svg>
);

const DocumentIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <rect x="5" y="2" width="18" height="24" rx="3" fill="#3180F7" />
    <rect x="9" y="7" width="10" height="2" rx="1" fill="#fff" />
    <rect x="9" y="12" width="7" height="2" rx="1" fill="#fff" />
    <rect x="9" y="17" width="10" height="2" rx="1" fill="#fff" />
  </svg>
);

const MoneyIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <rect x="2" y="6" width="24" height="16" rx="3" fill="#22C55E" />
    <circle cx="14" cy="14" r="5" fill="#16A34A" />
    <text x="14" y="17.5" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold">W</text>
  </svg>
);

const EyeIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <path d="M14 8C8 8 3 14 3 14C3 14 8 20 14 20C20 20 25 14 25 14C25 14 20 8 14 8Z" fill="#9CA3AF" />
    <circle cx="14" cy="14" r="4" fill="#fff" />
    <circle cx="14" cy="14" r="2" fill="#6B7280" />
  </svg>
);

const StarIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <path d="M14 3L17.09 9.26L24 10.27L19 15.14L20.18 22.02L14 18.77L7.82 22.02L9 15.14L4 10.27L10.91 9.26L14 3Z" fill="#FACC15" />
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
    <path d="M2 18C2 14 5.58 11 10 11C14.42 11 18 14 18 18H2Z" fill="#93C5FD" />
  </svg>
);

const CalendarBadgeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="2" y="3" width="16" height="15" rx="3" fill="#3180F7" />
    <rect x="2" y="3" width="16" height="5" rx="3" fill="#2563EB" />
    <rect x="5" y="10" width="3" height="2" rx="0.5" fill="#fff" />
    <rect x="9" y="10" width="3" height="2" rx="0.5" fill="#fff" />
    <rect x="5" y="14" width="3" height="2" rx="0.5" fill="#BFDBFE" />
  </svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="7" fill="#E5E7EB" />
    <circle cx="8" cy="8" r="5.5" fill="#fff" />
    <rect x="7.5" y="4" width="1" height="4.5" rx="0.5" fill="#6B7280" />
    <rect x="7.5" y="7.5" width="3" height="1" rx="0.5" fill="#6B7280" />
  </svg>
);

const LocationIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1C4.51 1 2.5 3.01 2.5 5.5C2.5 9.12 7 13 7 13C7 13 11.5 9.12 11.5 5.5C11.5 3.01 9.49 1 7 1Z" fill="#3180F7" />
    <circle cx="7" cy="5.5" r="1.5" fill="#fff" />
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
  status: 'pending' | 'accepted' | 'rejected';
  rejectionReason?: string;
}

/* ─── Mock Data ─── */

const INITIAL_QUOTES: Quote[] = [
  { id: 'q1', clientName: '홍**', eventType: '결혼식', eventDate: '2026-05-17', plan: 'Premium', budget: '₩1,800,000', status: 'pending' },
  { id: 'q2', clientName: '김**', eventType: '돌잔치', eventDate: '2026-05-24', plan: 'Superior', budget: '₩1,200,000', status: 'pending' },
  { id: 'q3', clientName: '박**', eventType: '기업행사', eventDate: '2026-06-01', plan: 'Enterprise', budget: '₩3,500,000', status: 'pending' },
  { id: 'q4', clientName: '이**', eventType: '결혼식', eventDate: '2026-06-14', plan: 'Premium', budget: '₩2,000,000', status: 'pending' },
];

const UPCOMING_EVENTS = [
  { date: '4/19', day: '토', eventType: '웨딩 MC', client: '최**', venue: '시에나호텔 그랜드홀', time: '11:00' },
  { date: '4/26', day: '토', eventType: '돌잔치 MC', client: '장**', venue: '그랜드하얏트 볼룸', time: '12:00' },
  { date: '5/03', day: '토', eventType: '웨딩 MC', client: '서**', venue: 'JW메리어트 가든', time: '14:00' },
];

const RECENT_REVIEWS = [
  { author: '김**', rating: 5, text: '정말 프로페셔널하시고, 분위기를 완벽하게 이끌어주셨어요. 하객분들 모두 만족하셨습니다!', date: '2026-04-05' },
  { author: '이**', rating: 5, text: '아이 돌잔치를 정말 따뜻하고 감동적으로 진행해주셔서 감사합니다.', date: '2026-03-29' },
  { author: '박**', rating: 4, text: '전문적인 진행과 세심한 배려가 인상적이었습니다. 다음에도 부탁드릴게요.', date: '2026-03-22' },
];

const REJECTION_REASONS = ['일정 불가', '지역 불가', '금액 불일치', '전문 분야 불일치', '기타'];

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  Premium: { bg: 'bg-blue-100', text: 'text-blue-700' },
  Superior: { bg: 'bg-purple-100', text: 'text-purple-700' },
  Enterprise: { bg: 'bg-amber-100', text: 'text-amber-700' },
};

/* ─── Animation variants ─── */

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
  const [name, setName] = useState('');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [confirmAccept, setConfirmAccept] = useState<string | null>(null);

  // Load from localStorage
  useEffect(() => {
    const storedName = localStorage.getItem('proRegister_name') || '프로';
    setName(storedName);

    const stored = localStorage.getItem('pro-quotes');
    if (stored) {
      try {
        setQuotes(JSON.parse(stored));
      } catch {
        setQuotes(INITIAL_QUOTES);
        localStorage.setItem('pro-quotes', JSON.stringify(INITIAL_QUOTES));
      }
    } else {
      setQuotes(INITIAL_QUOTES);
      localStorage.setItem('pro-quotes', JSON.stringify(INITIAL_QUOTES));
    }
  }, []);

  function saveQuotes(updated: Quote[]) {
    setQuotes(updated);
    localStorage.setItem('pro-quotes', JSON.stringify(updated));
  }

  function handleAccept(id: string) {
    const updated = quotes.map((q) => (q.id === id ? { ...q, status: 'accepted' as const } : q));
    saveQuotes(updated);
    setConfirmAccept(null);
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

  const pendingQuotes = quotes.filter((q) => q.status === 'pending');

  /* ─── Revenue data ─── */
  const thisMonth = 2400000;
  const lastMonth = 1800000;
  const maxRevenue = Math.max(thisMonth, lastMonth);

  return (
    <div className="bg-gray-50 min-h-screen pb-28">
      {/* ── Fixed Header ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="px-5 pt-12 pb-4 flex items-center justify-between">
          <div>
            <motion.h1
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="text-xl font-bold text-gray-900"
            >
              안녕하세요, {name}님
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-xs text-gray-400 mt-0.5"
            >
              {todayString()}
            </motion.p>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            className="relative p-2"
          >
            <BellIcon />
          </motion.button>
        </div>
      </div>

      {/* ── Quick Stats ── */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="px-4 mt-5 grid grid-cols-2 gap-3"
      >
        {[
          { icon: <DocumentIcon />, label: '새 견적요청', value: `${pendingQuotes.length}건`, bg: 'bg-blue-50' },
          { icon: <MoneyIcon />, label: '이번달 매출', value: '₩2,400,000', bg: 'bg-green-50' },
          { icon: <EyeIcon />, label: '프로필 조회', value: '328회', bg: 'bg-gray-50' },
          { icon: <StarIcon />, label: '평균 평점', value: '4.8', bg: 'bg-yellow-50' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            variants={fadeUp}
            className="bg-white rounded-2xl p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
          >
            <div className={`w-11 h-11 ${stat.bg} rounded-xl flex items-center justify-center mb-3`}>
              {stat.icon}
            </div>
            <p className="text-[11px] text-gray-400 font-medium">{stat.label}</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{stat.value}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* ── 견적 요청 관리 ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
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

        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
          <AnimatePresence mode="popLayout">
            {pendingQuotes.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-2xl p-8 text-center shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
              >
                <p className="text-sm text-gray-400">대기 중인 견적 요청이 없습니다</p>
              </motion.div>
            )}
            {pendingQuotes.map((quote) => (
              <motion.div
                key={quote.id}
                layout
                variants={fadeUp}
                exit={{ opacity: 0, x: -100, transition: { duration: 0.3 } }}
                className="bg-white rounded-2xl p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
              >
                {/* Top row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <PersonIcon />
                    <span className="text-sm font-bold text-gray-900">{quote.clientName}</span>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${PLAN_COLORS[quote.plan].bg} ${PLAN_COLORS[quote.plan].text}`}
                  >
                    {quote.plan}
                  </span>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="flex items-center gap-1.5">
                    <CalendarBadgeIcon />
                    <div>
                      <p className="text-[10px] text-gray-400">행사 종류</p>
                      <p className="text-xs font-semibold text-gray-700">{quote.eventType}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ClockIcon />
                    <div>
                      <p className="text-[10px] text-gray-400">행사 날짜</p>
                      <p className="text-xs font-semibold text-gray-700">{formatDate(quote.eventDate)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl px-3 py-2 mb-4 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">예산</span>
                  <span className="text-sm font-bold text-gray-900">{quote.budget}</span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setRejectTarget(quote.id)}
                    className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-bold text-gray-500 transition-colors active:bg-gray-200"
                  >
                    거절
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setConfirmAccept(quote.id)}
                    className="flex-1 py-2.5 rounded-xl bg-[#3180F7] text-sm font-bold text-white transition-colors active:bg-[#2060D0]"
                  >
                    수락
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* ── 다가오는 일정 ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="px-4 mt-8"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">다가오는 일정</h2>
          <Link href="/schedule" className="flex items-center gap-0.5 text-xs font-medium text-[#3180F7]">
            전체보기 <ChevronRightIcon />
          </Link>
        </div>
        <div className="space-y-3">
          {UPCOMING_EVENTS.map((ev, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 + i * 0.08 }}
              className="bg-white rounded-2xl p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)] flex items-center gap-3"
            >
              {/* Date badge */}
              <div className="w-14 h-14 bg-[#3180F7] rounded-xl flex flex-col items-center justify-center shrink-0">
                <span className="text-xs font-bold text-white">{ev.date}</span>
                <span className="text-[10px] text-blue-200 font-medium">({ev.day})</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">{ev.eventType}</p>
                <div className="flex items-center gap-1 mt-1">
                  <PersonIcon />
                  <span className="text-xs text-gray-500">{ev.client}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-0.5">
                    <LocationIcon />
                    <span className="text-[11px] text-gray-400">{ev.venue}</span>
                  </div>
                  <span className="text-[11px] text-gray-400">|</span>
                  <span className="text-[11px] text-gray-400">{ev.time}</span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full shrink-0">
                확정
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── 최근 리뷰 ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
        className="px-4 mt-8"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">최근 리뷰</h2>
          <Link href="/reviews" className="flex items-center gap-0.5 text-xs font-medium text-[#3180F7]">
            전체보기 <ChevronRightIcon />
          </Link>
        </div>
        <div className="space-y-3">
          {RECENT_REVIEWS.map((review, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.08 }}
              className="bg-white rounded-2xl p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">{review.author}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <SmallStarIcon key={s} filled={s <= review.rating} />
                    ))}
                  </div>
                </div>
                <span className="text-[11px] text-gray-300">{formatDate(review.date)}</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{review.text}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── 수익 현황 ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="px-4 mt-8 mb-8"
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChartIcon />
          <h2 className="text-base font-bold text-gray-900">수익 현황</h2>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          {/* This month */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-500">이번 달</span>
              <span className="text-sm font-bold text-gray-900">₩{thisMonth.toLocaleString()}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(thisMonth / maxRevenue) * 100}%` }}
                transition={{ delay: 1, duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-[#3180F7] rounded-full"
              />
            </div>
          </div>
          {/* Last month */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-500">지난 달</span>
              <span className="text-sm font-bold text-gray-400">₩{lastMonth.toLocaleString()}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(lastMonth / maxRevenue) * 100}%` }}
                transition={{ delay: 1.1, duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-gray-300 rounded-full"
              />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[11px] text-gray-400">전월 대비</span>
            <span className="text-xs font-bold text-green-500">
              +{Math.round(((thisMonth - lastMonth) / lastMonth) * 100)}% 증가
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── Accept Confirmation Modal ── */}
      <AnimatePresence>
        {confirmAccept && (
          <motion.div
            key="accept-overlay"
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-6"
            onClick={() => setConfirmAccept(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, transition: { type: 'spring', damping: 24, stiffness: 300 } }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"
            >
              <h3 className="text-base font-bold text-gray-900 text-center mb-2">견적 수락</h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                이 견적 요청을 수락하시겠습니까?<br />수락 후 고객에게 알림이 발송됩니다.
              </p>
              <div className="flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setConfirmAccept(null)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-sm font-bold text-gray-500"
                >
                  취소
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleAccept(confirmAccept)}
                  className="flex-1 py-3 rounded-xl bg-[#3180F7] text-sm font-bold text-white"
                >
                  수락하기
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Rejection Reason Modal (bottom sheet) ── */}
      <AnimatePresence>
        {rejectTarget && (
          <motion.div
            key="reject-overlay"
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 bg-black/40 flex items-end"
            onClick={() => {
              setRejectTarget(null);
              setSelectedReason('');
              setCustomReason('');
            }}
          >
            <motion.div
              variants={modalSheet}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl w-full max-h-[80vh] overflow-y-auto shadow-xl"
            >
              {/* Handle bar */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-200 rounded-full" />
              </div>

              <div className="px-5 pt-3 pb-8">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-bold text-gray-900">거절 사유 선택</h3>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      setRejectTarget(null);
                      setSelectedReason('');
                      setCustomReason('');
                    }}
                  >
                    <CloseIcon />
                  </motion.button>
                </div>

                <div className="space-y-2 mb-5">
                  {REJECTION_REASONS.map((reason) => (
                    <motion.button
                      key={reason}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setSelectedReason(reason)}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                        selectedReason === reason
                          ? 'bg-[#3180F7] text-white'
                          : 'bg-gray-50 text-gray-700 active:bg-gray-100'
                      }`}
                    >
                      {reason}
                    </motion.button>
                  ))}
                </div>

                {selectedReason === '기타' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-5"
                  >
                    <textarea
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="거절 사유를 입력해주세요..."
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#3180F7] focus:ring-1 focus:ring-[#3180F7] resize-none h-24"
                    />
                  </motion.div>
                )}

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleReject}
                  disabled={!selectedReason || (selectedReason === '기타' && !customReason.trim())}
                  className="w-full py-3.5 rounded-xl bg-[#3180F7] text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  거절하기
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
