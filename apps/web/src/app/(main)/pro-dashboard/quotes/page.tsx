'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

/* ─── Icons ─── */

const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M15 19L8 12L15 5" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PersonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="6" r="4" fill="#93C5FD" />
    <circle cx="10" cy="6" r="2.5" fill="#60A5FA" />
    <path d="M2 18C2 14 5.58 11 10 11C14.42 11 18 14 18 18H2Z" fill="#93C5FD" />
  </svg>
);

const ArchiveIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="2" y="2" width="14" height="4" rx="1.5" fill="#6B7280" />
    <path d="M3 6H15V15C15 15.55 14.55 16 14 16H4C3.45 16 3 15.55 3 15V6Z" fill="#9CA3AF" />
    <rect x="7" y="9" width="4" height="2" rx="1" fill="#fff" />
  </svg>
);

const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="3" y="4" width="12" height="2" rx="1" fill="#EF4444" />
    <path d="M5 6H13L12.2 15C12.1 15.55 11.6 16 11.05 16H6.95C6.4 16 5.9 15.55 5.8 15L5 6Z" fill="#FCA5A5" />
    <rect x="7" y="2" width="4" height="2.5" rx="1" fill="#EF4444" />
    <rect x="7.5" y="8" width="1" height="5" rx="0.5" fill="#EF4444" opacity="0.5" />
    <rect x="9.5" y="8" width="1" height="5" rx="0.5" fill="#EF4444" opacity="0.5" />
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#F3F4F6" />
    <path d="M8 8L16 16M16 8L8 16" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const EmptyIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <rect x="8" y="4" width="32" height="40" rx="5" fill="#E5E7EB" />
    <rect x="14" y="12" width="20" height="3" rx="1.5" fill="#D1D5DB" />
    <rect x="14" y="19" width="14" height="3" rx="1.5" fill="#D1D5DB" />
    <rect x="14" y="26" width="18" height="3" rx="1.5" fill="#D1D5DB" />
    <path d="M30 4H35C37.76 4 40 6.24 40 9V4H30Z" fill="#D1D5DB" />
    <path d="M30 4V10C30 11.1 30.9 12 32 12H40L30 4Z" fill="#F3F4F6" />
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

const INITIAL_QUOTES: Quote[] = [
  { id: 'q1', clientName: '홍**', eventType: '결혼식', eventDate: '2026-05-17', plan: 'Premium', budget: '₩1,800,000', status: 'pending' },
  { id: 'q2', clientName: '김**', eventType: '돌잔치', eventDate: '2026-05-24', plan: 'Superior', budget: '₩1,200,000', status: 'pending' },
  { id: 'q3', clientName: '박**', eventType: '기업행사', eventDate: '2026-06-01', plan: 'Enterprise', budget: '₩3,500,000', status: 'pending' },
  { id: 'q4', clientName: '이**', eventType: '결혼식', eventDate: '2026-06-14', plan: 'Premium', budget: '₩2,000,000', status: 'accepted' },
  { id: 'q5', clientName: '최**', eventType: '돌잔치', eventDate: '2026-04-05', plan: 'Superior', budget: '₩900,000', status: 'rejected', rejectionReason: '일정 불가' },
];

const REJECTION_REASONS = ['일정 불가', '지역 불가', '금액 불일치', '전문 분야 불일치', '기타'];

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  Premium: { bg: 'bg-blue-100', text: 'text-blue-700' },
  Superior: { bg: 'bg-purple-100', text: 'text-purple-700' },
  Enterprise: { bg: 'bg-amber-100', text: 'text-amber-700' },
};

const TABS = [
  { key: 'pending', label: '대기중' },
  { key: 'accepted', label: '수락' },
  { key: 'rejected', label: '거절' },
] as const;

/* ─── Helpers ─── */

function formatDate(iso: string) {
  const d = new Date(iso);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${m}/${day} (${weekday})`;
}

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

const modalOverlay = { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } };
const modalSheet = {
  hidden: { y: '100%' },
  visible: { y: 0, transition: { type: 'spring', damping: 28, stiffness: 300 } },
  exit: { y: '100%', transition: { duration: 0.25 } },
};

export default function QuotesPage() {
  const [tab, setTab] = useState<'pending' | 'accepted' | 'rejected'>('pending');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [confirmAccept, setConfirmAccept] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('pro-quotes');
    if (stored) {
      try { setQuotes(JSON.parse(stored)); } catch { setQuotes(INITIAL_QUOTES); localStorage.setItem('pro-quotes', JSON.stringify(INITIAL_QUOTES)); }
    } else {
      setQuotes(INITIAL_QUOTES);
      localStorage.setItem('pro-quotes', JSON.stringify(INITIAL_QUOTES));
    }
  }, []);

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
    saveQuotes(quotes.map((q) => (q.id === id ? { ...q, status: 'accepted' as const } : q)));
    setConfirmAccept(null);
  }

  function handleReject() {
    if (!rejectTarget) return;
    const reason = selectedReason === '기타' ? customReason : selectedReason;
    saveQuotes(quotes.map((q) => q.id === rejectTarget ? { ...q, status: 'rejected' as const, rejectionReason: reason } : q));
    setRejectTarget(null); setSelectedReason(''); setCustomReason('');
  }

  function handleArchive(id: string) {
    saveQuotes(quotes.map((q) => (q.id === id ? { ...q, status: 'archived' as const } : q)));
    setContextMenu(null);
  }

  function handleDelete(id: string) {
    saveQuotes(quotes.filter((q) => q.id !== id));
    setContextMenu(null);
  }

  const handlePointerDown = useCallback((id: string, e: React.PointerEvent) => {
    const x = e.clientX; const y = e.clientY;
    longPressTimer.current = setTimeout(() => setContextMenu({ id, x, y }), 600);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  const filtered = quotes.filter((q) => q.status === tab);

  return (
    <div className="bg-gray-50 min-h-screen pb-28">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="px-4 pt-12 pb-3 flex items-center gap-3">
          <Link href="/pro-dashboard">
            <motion.div whileTap={{ scale: 0.9 }}><BackIcon /></motion.div>
          </Link>
          <h1 className="text-lg font-bold text-gray-900">견적 요청 관리</h1>
        </div>

        {/* Tabs */}
        <div className="px-4 pb-3 flex gap-2">
          {TABS.map((t) => (
            <motion.button
              key={t.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTab(t.key)}
              className={`relative px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                tab === t.key ? 'text-white' : 'text-gray-400 bg-gray-100'
              }`}
            >
              {tab === t.key && (
                <motion.div
                  layoutId="quote-tab"
                  className="absolute inset-0 bg-[#3180F7] rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{t.label}</span>
              {t.key === 'pending' && quotes.filter((q) => q.status === 'pending').length > 0 && (
                <span className="relative z-10 ml-1 text-[10px]">
                  ({quotes.filter((q) => q.status === 'pending').length})
                </span>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-4 mt-4">
        {filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 text-center">
            <div className="flex justify-center mb-3"><EmptyIcon /></div>
            <p className="text-sm text-gray-400">해당하는 견적이 없습니다</p>
          </motion.div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show" key={tab} className="space-y-0">
            <AnimatePresence mode="popLayout">
              {filtered.map((quote, idx) => (
                <motion.div
                  key={quote.id}
                  layout
                  variants={fadeUp}
                  exit={{ opacity: 0, x: -100, transition: { duration: 0.3 } }}
                  onPointerDown={(e) => handlePointerDown(quote.id, e)}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className={`py-4 select-none ${idx < filtered.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <PersonIcon />
                      <span className="text-sm font-bold text-gray-900">{quote.clientName}</span>
                      <span className="text-xs text-gray-400">{quote.eventType}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PLAN_COLORS[quote.plan].bg} ${PLAN_COLORS[quote.plan].text}`}>
                      {quote.plan}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mb-3 text-xs text-gray-500">
                    <span>{formatDate(quote.eventDate)}</span>
                    <span className="text-gray-200">|</span>
                    <span className="font-bold text-gray-900">{quote.budget}</span>
                  </div>

                  {quote.status === 'pending' && (
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.95 }} onClick={() => setRejectTarget(quote.id)}
                        className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-bold text-gray-500">거절</motion.button>
                      <motion.button whileTap={{ scale: 0.95 }} onClick={() => setConfirmAccept(quote.id)}
                        className="flex-1 py-2.5 rounded-xl bg-[#3180F7] text-sm font-bold text-white">수락</motion.button>
                    </div>
                  )}

                  {quote.status === 'accepted' && (
                    <span className="text-[11px] font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">수락 완료</span>
                  )}

                  {quote.status === 'rejected' && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-red-500 bg-red-50 px-2.5 py-1 rounded-full">거절됨</span>
                      {quote.rejectionReason && <span className="text-[11px] text-gray-400">{quote.rejectionReason}</span>}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="fixed z-50 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
            style={{ top: contextMenu.y, left: Math.min(contextMenu.x, (typeof window !== 'undefined' ? window.innerWidth : 300) - 140) }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleArchive(contextMenu.id)}
              className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 font-medium hover:bg-gray-50 w-full border-b border-gray-50">
              <ArchiveIcon /> 보관
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleDelete(contextMenu.id)}
              className="flex items-center gap-2 px-4 py-3 text-sm text-red-500 font-medium hover:bg-red-50 w-full">
              <TrashIcon /> 삭제
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Accept Modal */}
      <AnimatePresence>
        {confirmAccept && (
          <motion.div key="accept" variants={modalOverlay} initial="hidden" animate="visible" exit="exit"
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-6" onClick={() => setConfirmAccept(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
              <h3 className="text-base font-bold text-gray-900 text-center mb-2">견적 수락</h3>
              <p className="text-sm text-gray-500 text-center mb-6">이 견적 요청을 수락하시겠습니까?</p>
              <div className="flex gap-3">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setConfirmAccept(null)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-sm font-bold text-gray-500">취소</motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleAccept(confirmAccept)}
                  className="flex-1 py-3 rounded-xl bg-[#3180F7] text-sm font-bold text-white">수락하기</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {rejectTarget && (
          <motion.div key="reject" variants={modalOverlay} initial="hidden" animate="visible" exit="exit"
            className="fixed inset-0 z-50 bg-black/40 flex items-end"
            onClick={() => { setRejectTarget(null); setSelectedReason(''); setCustomReason(''); }}>
            <motion.div variants={modalSheet} initial="hidden" animate="visible" exit="exit"
              onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-3xl w-full max-h-[80vh] overflow-y-auto shadow-xl">
              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
              <div className="px-5 pt-3 pb-8">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-bold text-gray-900">거절 사유 선택</h3>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setRejectTarget(null); setSelectedReason(''); setCustomReason(''); }}>
                    <CloseIcon />
                  </motion.button>
                </div>
                <div className="space-y-2 mb-5">
                  {REJECTION_REASONS.map((reason) => (
                    <motion.button key={reason} whileTap={{ scale: 0.97 }} onClick={() => setSelectedReason(reason)}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                        selectedReason === reason ? 'bg-[#3180F7] text-white' : 'bg-gray-50 text-gray-700'
                      }`}>{reason}</motion.button>
                  ))}
                </div>
                {selectedReason === '기타' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-5">
                    <textarea value={customReason} onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="거절 사유를 입력해주세요..."
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#3180F7] resize-none h-24" />
                  </motion.div>
                )}
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleReject}
                  disabled={!selectedReason || (selectedReason === '기타' && !customReason.trim())}
                  className="w-full py-3.5 rounded-xl bg-[#3180F7] text-white text-sm font-bold disabled:opacity-40 transition-opacity">
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
