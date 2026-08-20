'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { notificationApi, getCachedNotifications } from '@/lib/api/notification.api';
import { AlarmIcon, CloseIcon, ChevronRightIcon } from '@/components/icons/mono';
import { EmptyAlarmIcon } from '@/components/icons/color';

/**
 * PC 헤더의 알림 서랍.
 *
 * 예전엔 종을 누르면 /notifications 전체 화면으로 넘어가 보던 화면이 통째로 사라졌다.
 * 홈을 그대로 두고 오른쪽만 살짝 덮도록 서랍으로 바꿨다. (모바일은 기존 전체 화면 유지)
 */

type Notif = {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  date: string;
  link?: string;
};

function resolveLink(type: string, data: any): string | undefined {
  const explicit = data?.link || data?.url || data?.deepLink || data?.deeplink;
  if (typeof explicit === 'string' && explicit.trim()) return explicit;
  const roomId = data?.chatRoomId || data?.roomId || data?.chat_room_id || data?.room_id;
  if (roomId) return `/chat/${roomId}`;
  if (data?.paymentId) return '/my/payment-history';
  if (data?.quotationId) return '/my/purchase-history';
  if (data?.proProfileId) return `/pros/${data.proProfileId}`;
  if (type === 'chat') return '/chat';
  if (type === 'payment') return '/my/payment-history';
  if (type === 'review') return '/my/purchase-history';
  if (type === 'system') return '/my/announcements';
  return undefined;
}

function mapNotif(n: any): Notif {
  return {
    id: String(n.id),
    title: n.title || '',
    body: n.body || '',
    isRead: !!n.isRead,
    date: n.createdAt ? new Date(n.createdAt).toLocaleDateString('ko-KR') : '',
    link: resolveLink(String(n.type || ''), n.data),
  };
}

export default function NotificationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(false);

  // 열릴 때마다 캐시부터 즉시 보여주고, 서버 응답이 오면 갈아끼운다
  const load = useCallback(async () => {
    if (!authUser) { setItems([]); return; }
    const cached: any = getCachedNotifications();
    const cachedItems = Array.isArray(cached?.data) ? cached.data : Array.isArray(cached) ? cached : [];
    if (cachedItems.length) setItems(cachedItems.map(mapNotif));
    setLoading(true);
    try {
      const res: any = await notificationApi.getList({ limit: 30 });
      const next = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setItems(next.map(mapNotif));
    } catch {
      // 실패해도 캐시된 목록은 그대로 둔다
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    if (open) load().catch(() => {});
  }, [open, load]);

  // ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const unread = items.filter((n) => !n.isRead).length;

  const openItem = (n: Notif) => {
    if (!n.isRead) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      notificationApi.markAsRead(n.id).catch(() => {});
    }
    if (n.link) { onClose(); router.push(n.link); }
  };

  return (
    <>
      {/* 딤 — 홈이 비쳐 보일 정도로만 */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-black/25 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!open}
      />
      <aside
        className={`fixed right-0 top-0 z-[61] flex h-full w-[400px] max-w-[92vw] flex-col bg-white shadow-[-12px_0_40px_rgba(15,23,42,0.12)] transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-gray-100 px-5">
          <div className="flex items-center gap-2">
            <AlarmIcon size={20} className="text-[#2B313D]" />
            <span className="text-[17px] font-bold text-[#2B313D]">알림</span>
            {unread > 0 && (
              <span className="rounded-full bg-[#3180F7] px-2 py-[2px] text-[11px] font-bold text-white">{unread}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <button
                type="button"
                onClick={() => {
                  setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
                  notificationApi.markAllAsRead().catch(() => {});
                }}
                className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-[#A4ABBA] transition-colors hover:bg-[#F2F3F5] hover:text-[#2B313D]"
              >
                모두 읽음
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="알림 닫기"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#A4ABBA] transition-colors hover:bg-[#F2F3F5] hover:text-[#2B313D]"
            >
              <CloseIcon size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!authUser ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <EmptyAlarmIcon size={64} />
              <p className="text-[14px] text-[#A4ABBA]">로그인하면 알림을 받아볼 수 있어요</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <EmptyAlarmIcon size={64} />
              <p className="text-[14px] text-[#A4ABBA]">{loading ? '알림을 불러오는 중이에요' : '아직 받은 알림이 없어요'}</p>
            </div>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className="flex w-full items-start gap-3 border-b border-gray-50 px-5 py-4 text-left transition-colors hover:bg-[#FAFBFC]"
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-[#3180F7]'}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[14px] ${n.isRead ? 'font-medium text-[#51535C]' : 'font-bold text-[#2B313D]'}`}>
                        {n.title}
                      </span>
                      {n.body && <span className="mt-0.5 block line-clamp-2 text-[13px] text-[#8B93A1]">{n.body}</span>}
                      <span className="mt-1 block text-[11px] text-[#C7CBD3]">{n.date}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => { onClose(); router.push('/notifications'); }}
          className="flex h-[56px] shrink-0 items-center justify-center gap-1 border-t border-gray-100 text-[13px] font-semibold text-[#A4ABBA] transition-colors hover:text-[#2B313D]"
        >
          알림 전체보기 <ChevronRightIcon size={14} />
        </button>
      </aside>
    </>
  );
}
