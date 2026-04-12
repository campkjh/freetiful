'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

/* ─── Icons ─── */

const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M15 19L8 12L15 5" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DocumentNotifIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="2" width="16" height="20" rx="3" fill="#3180F7" />
    <path d="M14 2V7C14 7.55 14.45 8 15 8H20L14 2Z" fill="#93C5FD" />
    <rect x="7" y="10" width="10" height="1.5" rx="0.75" fill="#BFDBFE" />
    <rect x="7" y="13" width="7" height="1.5" rx="0.75" fill="#DBEAFE" />
    <rect x="7" y="16" width="9" height="1.5" rx="0.75" fill="#BFDBFE" />
  </svg>
);

const PaymentNotifIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="5" width="20" height="14" rx="3" fill="#22C55E" />
    <rect x="2" y="5" width="20" height="5" rx="3" fill="#16A34A" />
    <circle cx="12" cy="14" r="3" fill="#15803D" />
    <text x="12" y="16.5" textAnchor="middle" fill="#fff" fontSize="6" fontWeight="bold">W</text>
  </svg>
);

const StarNotifIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 2L14.72 7.52L20.78 8.4L16.39 12.67L17.44 18.71L12 15.85L6.56 18.71L7.61 12.67L3.22 8.4L9.28 7.52L12 2Z" fill="#FACC15" />
    <path d="M12 2L14.72 7.52L20.78 8.4L16.39 12.67L17.44 18.71L12 15.85V2Z" fill="#EAB308" />
  </svg>
);

const CalendarNotifIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="17" rx="3" fill="#3180F7" />
    <rect x="3" y="4" width="18" height="6" rx="3" fill="#2563EB" />
    <rect x="7" y="2" width="2" height="4" rx="1" fill="#60A5FA" />
    <rect x="15" y="2" width="2" height="4" rx="1" fill="#60A5FA" />
    <rect x="6" y="12" width="3" height="2.5" rx="0.5" fill="#fff" />
    <rect x="10.5" y="12" width="3" height="2.5" rx="0.5" fill="#fff" />
    <rect x="15" y="12" width="3" height="2.5" rx="0.5" fill="#BFDBFE" />
    <rect x="6" y="16" width="3" height="2.5" rx="0.5" fill="#BFDBFE" />
  </svg>
);

const InfoNotifIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#6B7280" />
    <circle cx="12" cy="12" r="8" fill="#9CA3AF" />
    <circle cx="12" cy="8" r="1.2" fill="#fff" />
    <rect x="11" y="10.5" width="2" height="6" rx="1" fill="#fff" />
  </svg>
);

const TrashMiniIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="3" y="4" width="10" height="1.5" rx="0.75" fill="#EF4444" />
    <path d="M4.5 5.5H11.5L10.9 13C10.85 13.55 10.4 14 9.85 14H6.15C5.6 14 5.15 13.55 5.1 13L4.5 5.5Z" fill="#FCA5A5" />
    <rect x="6.5" y="2" width="3" height="2" rx="0.75" fill="#EF4444" />
  </svg>
);

/* ─── Data ─── */

interface Notification {
  id: string;
  type: 'quote' | 'payment' | 'review' | 'schedule' | 'system';
  title: string;
  body: string;
  time: string;
  read: boolean;
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: 'n1', type: 'quote', title: '새 견적 요청', body: '홍** 님이 결혼식 MC 견적을 요청했습니다.', time: '10분 전', read: false },
  { id: 'n2', type: 'payment', title: '결제 완료', body: '최** 님의 웨딩 MC 결제가 완료되었습니다. ₩1,800,000', time: '2시간 전', read: false },
  { id: 'n3', type: 'review', title: '새 리뷰', body: '김** 님이 5점 리뷰를 남겼습니다.', time: '3시간 전', read: false },
  { id: 'n4', type: 'schedule', title: '일정 리마인더', body: '4/19(토) 시에나호텔 웨딩 MC가 일주일 남았습니다.', time: '5시간 전', read: true },
  { id: 'n5', type: 'system', title: '시스템 공지', body: '프로필 인증 마감일이 7일 남았습니다. 서류를 업로드해주세요.', time: '1일 전', read: true },
  { id: 'n6', type: 'quote', title: '새 견적 요청', body: '김** 님이 돌잔치 MC 견적을 요청했습니다.', time: '1일 전', read: true },
  { id: 'n7', type: 'payment', title: '정산 완료', body: '3월 정산금 ₩5,900,000이 입금되었습니다.', time: '2일 전', read: true },
  { id: 'n8', type: 'system', title: '시스템 공지', body: '새로운 기능이 추가되었습니다. 대시보드를 확인해보세요.', time: '3일 전', read: true },
];

const ICON_MAP: Record<string, React.ReactNode> = {
  quote: <DocumentNotifIcon />,
  payment: <PaymentNotifIcon />,
  review: <StarNotifIcon />,
  schedule: <CalendarNotifIcon />,
  system: <InfoNotifIcon />,
};

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);

  function handleDelete(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  function handleDragEnd(id: string, info: PanInfo) {
    if (info.offset.x < -100) {
      handleDelete(id);
    }
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-28">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="px-4 pt-12 pb-3 flex items-center gap-3">
          <Link href="/pro-dashboard">
            <motion.div whileTap={{ scale: 0.9 }}><BackIcon /></motion.div>
          </Link>
          <h1 className="text-lg font-bold text-gray-900">알림</h1>
          {notifications.filter((n) => !n.read).length > 0 && (
            <span className="bg-[#EF4444] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {notifications.filter((n) => !n.read).length}
            </span>
          )}
        </div>
      </div>

      {/* Notification List */}
      <div className="px-4 mt-2">
        <motion.div variants={stagger} initial="hidden" animate="show">
          <AnimatePresence>
            {notifications.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 text-center">
                <div className="flex justify-center mb-3">
                  <img src="/images/알림 설정.svg" alt="" width={48} height={48} className="shrink-0" />
                </div>
                <p className="text-sm text-gray-400">알림이 없습니다</p>
              </motion.div>
            ) : (
              notifications.map((notif, idx) => (
                <motion.div
                  key={notif.id}
                  variants={fadeUp}
                  exit={{ opacity: 0, x: -200, transition: { duration: 0.3 } }}
                  layout
                  className="relative overflow-hidden"
                >
                  {/* Delete background */}
                  <div className="absolute inset-0 bg-red-50 flex items-center justify-end pr-5 rounded-xl">
                    <TrashMiniIcon />
                  </div>

                  {/* Swipeable card */}
                  <motion.div
                    drag="x"
                    dragConstraints={{ left: -120, right: 0 }}
                    dragElastic={0.1}
                    onDragEnd={(_, info) => handleDragEnd(notif.id, info)}
                    className={`relative bg-gray-50 ${idx < notifications.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    <div className={`py-4 flex items-start gap-3 ${!notif.read ? 'bg-blue-50/30' : ''}`}>
                      {/* Icon */}
                      <div className="shrink-0 mt-0.5">
                        {ICON_MAP[notif.type]}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm ${!notif.read ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                            {notif.title}
                          </p>
                          {!notif.read && (
                            <div className="w-1.5 h-1.5 rounded-full bg-[#3180F7] shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{notif.body}</p>
                        <p className="text-[10px] text-gray-300 mt-1">{notif.time}</p>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
