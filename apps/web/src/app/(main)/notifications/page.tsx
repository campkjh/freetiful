'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, MessageCircle, CreditCard, Star, Bell,
  Megaphone, Settings, CheckCheck,
} from 'lucide-react';

type NotifType = 'chat' | 'booking' | 'payment' | 'review' | 'system' | 'marketing';

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
}

const TYPE_CONFIG: Record<NotifType, { icon: typeof Bell; color: string; bg: string }> = {
  chat:      { icon: MessageCircle, color: 'text-primary-500', bg: 'bg-primary-50' },
  booking:   { icon: Bell,          color: 'text-emerald-500', bg: 'bg-emerald-50' },
  payment:   { icon: CreditCard,    color: 'text-violet-500',  bg: 'bg-violet-50' },
  review:    { icon: Star,          color: 'text-amber-500',   bg: 'bg-amber-50' },
  system:    { icon: Bell,          color: 'text-gray-500',    bg: 'bg-gray-100' },
  marketing: { icon: Megaphone,     color: 'text-rose-500',    bg: 'bg-rose-50' },
};

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1', type: 'chat', title: '김민준 MC님의 새 메시지',
    body: '네, 4월 5일 결혼식 MC 가능합니다. 세부 사항 안내 드리겠습니다.',
    isRead: false, createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), link: '/chat/1',
  },
  {
    id: '2', type: 'payment', title: '결제 완료',
    body: '웨딩 MC 패키지 500,000원 결제가 완료되었습니다.',
    isRead: false, createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), link: '/my/payment-history',
  },
  {
    id: '3', type: 'chat', title: '정하린 플로리스트님의 새 메시지',
    body: '부케 시안 보내드립니다 💐 확인 부탁드려요!',
    isRead: false, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), link: '/chat/5',
  },
  {
    id: '4', type: 'review', title: '리뷰를 작성해주세요',
    body: '김민준 MC님과의 행사는 어떠셨나요? 리뷰를 남겨주세요.',
    isRead: true, createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5', type: 'booking', title: '예약 확정',
    body: '4월 5일 김민준 MC님 예약이 확정되었습니다.',
    isRead: true, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '6', type: 'system', title: '서비스 업데이트 안내',
    body: '채팅 기능이 개선되었습니다. 예약 메시지, 이모지 리액션 기능이 추가되었어요.',
    isRead: true, createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), link: '/my/announcements',
  },
  {
    id: '7', type: 'marketing', title: '오픈 기념 10% 할인 쿠폰 도착!',
    body: '첫 결제 시 사용 가능한 10% 할인 쿠폰이 발급되었습니다.',
    isRead: true, createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), link: '/my/coupons',
  },
  {
    id: '8', type: 'chat', title: '박준혁 가수님의 새 메시지',
    body: '축가 3곡 기본이고, 추가 곡은 곡당 5만원입니다.',
    isRead: true, createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), link: '/chat/3',
  },
];

function formatRelativeTime(dateStr: string) {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  // Group by date
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();

  const grouped = notifications.reduce<{ label: string; items: Notification[] }[]>((acc, n) => {
    const date = new Date(n.createdAt).toDateString();
    let label = '';
    if (date === today) label = '오늘';
    else if (date === yesterday) label = '어제';
    else {
      const d = new Date(n.createdAt);
      label = `${d.getMonth() + 1}월 ${d.getDate()}일`;
    }

    const group = acc.find((g) => g.label === label);
    if (group) group.items.push(n);
    else acc.push({ label, items: [n] });
    return acc;
  }, []);

  return (
    <div className="bg-surface-50 min-h-screen max-w-lg mx-auto lg:max-w-3xl">
      {/* Header */}
      <div className="glass sticky top-0 z-10 border-b border-gray-100/50">
        <div className="flex items-center justify-between px-5 h-14">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1">
              <ArrowLeft size={22} />
            </button>
            <h1 className="text-[17px] font-bold tracking-tight">알림</h1>
            {unreadCount > 0 && (
              <span className="bg-primary-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-[13px] text-primary-500 font-medium px-3 py-1.5 rounded-full hover:bg-primary-50 active:scale-[0.97]"
                style={{ transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
              >
                <CheckCheck size={14} />
                모두 읽음
              </button>
            )}
            <Link
              href="/my/notifications"
              className="p-2 rounded-full hover:bg-surface-100"
              style={{ transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              <Settings size={18} className="text-gray-400" />
            </Link>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {notifications.length === 0 && (
        <div className="text-center py-28">
          <div className="w-20 h-20 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Bell size={32} className="text-gray-300" />
          </div>
          <p className="text-gray-400 text-[15px]">알림이 없습니다</p>
        </div>
      )}

      {/* Notification Groups */}
      <div className="px-4 py-3 space-y-6">
        {grouped.map((group) => (
          <div key={group.label}>
            <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider px-1 mb-2">
              {group.label}
            </p>
            <div className="space-y-1.5">
              {group.items.map((n, i) => {
                const config = TYPE_CONFIG[n.type];
                const Icon = config.icon;

                const inner = (
                  <div
                    className={`card flex gap-3.5 p-4 opacity-0 animate-fade-in ${
                      !n.isRead ? 'bg-white ring-1 ring-primary-100/50' : 'bg-white'
                    }`}
                    style={{
                      animationDelay: `${i * 60}ms`,
                      animationFillMode: 'forwards',
                      transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    onClick={() => markAsRead(n.id)}
                  >
                    {/* Icon */}
                    <div className={`shrink-0 w-10 h-10 ${config.bg} rounded-2xl flex items-center justify-center`}>
                      <Icon size={18} className={config.color} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-[14px] leading-snug ${!n.isRead ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {n.title}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] text-gray-400">{formatRelativeTime(n.createdAt)}</span>
                          {!n.isRead && (
                            <span className="w-2 h-2 bg-primary-500 rounded-full shrink-0" />
                          )}
                        </div>
                      </div>
                      <p className={`text-[13px] mt-0.5 line-clamp-2 leading-relaxed ${!n.isRead ? 'text-gray-600' : 'text-gray-400'}`}>
                        {n.body}
                      </p>
                    </div>
                  </div>
                );

                return n.link ? (
                  <Link key={n.id} href={n.link} className="block hover:opacity-90" style={{ transition: 'opacity 0.2s' }}>
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id} className="cursor-pointer">{inner}</div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
