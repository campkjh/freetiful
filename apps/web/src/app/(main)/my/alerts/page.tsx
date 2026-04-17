'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { notificationApi } from '@/lib/api/notification.api';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  data?: any;
}

export default function AlertsPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser) return;
    setLoading(true);
    notificationApi.getList({ limit: 50 })
      .then((res: any) => {
        const items = res?.data || res?.notifications || (Array.isArray(res) ? res : []);
        setNotifications(items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authUser]);

  const markRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    notificationApi.markAsRead(id).catch(() => {});
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    notificationApi.markAllAsRead().catch(() => {});
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="bg-white min-h-screen max-w-lg mx-auto" style={{ letterSpacing: '-0.02em' }}>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-4 h-[52px]">
          <div className="flex items-center">
            <button onClick={() => router.back()} className="p-1"><ChevronLeft size={24} /></button>
            <h1 className="text-[18px] font-bold ml-3">알림</h1>
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-[11px] font-bold rounded-full">{unreadCount}</span>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-[13px] text-blue-500 font-medium">모두 읽음</button>
          )}
        </div>
      </div>

      <div className="px-4 py-2">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[40px] mb-3">🔔</p>
            <p className="text-[16px] font-bold text-gray-900 mb-1">알림이 없어요</p>
            <p className="text-[13px] text-gray-400">새로운 알림이 오면 여기에 표시됩니다</p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n.id)}
                className={`w-full text-left px-4 py-3.5 rounded-xl transition-colors ${
                  n.isRead ? 'bg-white' : 'bg-blue-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.isRead ? 'bg-transparent' : 'bg-blue-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-gray-900">{n.title}</p>
                    <p className="text-[13px] text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[11px] text-gray-300 mt-1">
                      {new Date(n.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
