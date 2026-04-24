'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { notificationApi, getCachedNotifications } from '@/lib/api/notification.api';

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

const ChatNotifIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M20 12c0 4-3.6 7.5-8.5 7.5-1.4 0-2.7-.3-3.8-.8L3 20l1.2-3.5C3.4 15.3 3 13.7 3 12c0-4 3.6-7.5 8.5-7.5S20 8 20 12z" fill="#4A8AF4"/>
    <circle cx="8.5" cy="12" r="1" fill="white"/><circle cx="11.5" cy="12" r="1" fill="white"/><circle cx="14.5" cy="12" r="1" fill="white"/>
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

/* ─── Types ─── */

type NotifType = 'chat' | 'booking' | 'payment' | 'review' | 'system' | 'marketing';

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  time: string;
  read: boolean;
  data?: any;
}

const ICON_MAP: Record<NotifType, React.ReactNode> = {
  chat: <ChatNotifIcon />,
  booking: <CalendarNotifIcon />,
  payment: <PaymentNotifIcon />,
  review: <StarNotifIcon />,
  system: <InfoNotifIcon />,
  marketing: <DocumentNotifIcon />,
};

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

function resolveLink(type: NotifType, data: any): string | undefined {
  if (data?.link) return data.link;
  if (data?.chatRoomId) return `/chat/${data.chatRoomId}`;
  if (data?.quotationId) return '/pro-dashboard/inquiries';
  if (data?.matchRequestId) return '/pro-dashboard/inquiries';
  if (type === 'chat') return '/chat';
  if (type === 'booking') return '/schedule';
  if (type === 'review') return '/pro-dashboard/reviews';
  if (type === 'payment') return '/pro-dashboard/revenue';
  if (type === 'system') return '/my/announcements';
  return undefined;
}

function mapFromApi(n: any): Notification {
  return {
    id: n.id,
    type: (n.type || 'system') as NotifType,
    title: n.title || '',
    body: n.body || '',
    time: formatRelativeTime(n.createdAt || new Date().toISOString()),
    read: !!n.isRead,
    data: n.data,
  };
}

export default function NotificationsPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  // 캐시 즉시 표시
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const cached: any = getCachedNotifications();
    if (cached && Array.isArray(cached.data)) return cached.data.map(mapFromApi);
    if (Array.isArray(cached)) return cached.map(mapFromApi);
    return [];
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authUser && localStorage.getItem('freetiful-logged-in') !== 'true') return;
    setLoading(true);
    notificationApi.getList({ page: 1, limit: 50 })
      .then((res: any) => {
        const items = res?.data || (Array.isArray(res) ? res : []);
        setNotifications(items.map(mapFromApi));
      })
      .catch(() => { /* keep cache */ })
      .finally(() => setLoading(false));
  }, [authUser]);

  async function handleDelete(id: string) {
    // Optimistic
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await notificationApi.deleteOne(id);
    } catch { /* 실패 시 재로드 */ }
  }

  async function handleNotifClick(notif: Notification) {
    if (!notif.read) {
      setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, read: true } : n));
      notificationApi.markAsRead(notif.id).catch(() => {});
    }
    const link = resolveLink(notif.type, notif.data);
    if (link) router.push(link);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="bg-gray-50 min-h-screen pb-28">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="px-4 pt-12 pb-3 flex items-center gap-3">
          <Link href="/pro-dashboard">
            <div><BackIcon /></div>
          </Link>
          <h1 className="text-lg font-bold text-gray-900">알림</h1>
          {unreadCount > 0 && (
            <span className="bg-[#EF4444] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
          {unreadCount > 0 && (
            <button
              onClick={() => {
                setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                notificationApi.markAllAsRead().catch(() => {});
              }}
              className="ml-auto text-[11px] text-[#3180F7] font-medium"
            >
              모두 읽음
            </button>
          )}
        </div>
      </div>

      {/* Notification List */}
      <div className="px-4 mt-2">
        {loading && notifications.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-400">불러오는 중…</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center">
            <div className="flex justify-center mb-3">
              <img src="/images/notification-settings.svg" alt="" width={48} height={48} className="shrink-0" />
            </div>
            <p className="text-sm text-gray-400">알림이 없습니다</p>
          </div>
        ) : (
          notifications.map((notif, idx) => (
            <div key={notif.id} className="relative overflow-hidden">
              <div className={`relative bg-gray-50 flex items-start ${idx < notifications.length - 1 ? 'border-b border-gray-100' : ''} ${!notif.read ? 'bg-blue-50/30' : ''}`}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNotifClick(notif)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleNotifClick(notif); }}
                  className="flex-1 text-left py-4 flex items-start gap-3 cursor-pointer"
                >
                  <div className="shrink-0 mt-0.5">{ICON_MAP[notif.type]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${!notif.read ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {notif.title}
                      </p>
                      {!notif.read && <div className="w-1.5 h-1.5 rounded-full bg-[#3180F7] shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{notif.body}</p>
                    <p className="text-[10px] text-gray-300 mt-1">{notif.time}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(notif.id)}
                  className="shrink-0 p-3 opacity-50 hover:opacity-100 self-center"
                  aria-label="삭제"
                >
                  <TrashMiniIcon />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
