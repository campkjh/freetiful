'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Search, Trash2, X } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { notificationApi } from '@/lib/api/notification.api';

type NotifType = 'chat' | 'booking' | 'payment' | 'review' | 'system' | 'marketing';

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  isRead: boolean;
  date: string;
  link?: string;
}

const typeIconMap: Record<NotifType, { icon: React.ReactNode }> = {
  chat: { icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M20 12c0 4-3.6 7.5-8.5 7.5-1.4 0-2.7-.3-3.8-.8L3 20l1.2-3.5C3.4 15.3 3 13.7 3 12c0-4 3.6-7.5 8.5-7.5S20 8 20 12z" fill="#4A8AF4"/>
      <circle cx="8.5" cy="12" r="1" fill="white"/><circle cx="11.5" cy="12" r="1" fill="white"/><circle cx="14.5" cy="12" r="1" fill="white"/>
    </svg>
  )},
  booking: { icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="2.5" fill="#E8E8E8"/>
      <rect x="3" y="4" width="18" height="6" rx="2.5" fill="#F5F5F5"/>
      <rect x="7" y="2" width="2" height="4" rx="1" fill="#BDBDBD"/>
      <rect x="15" y="2" width="2" height="4" rx="1" fill="#BDBDBD"/>
      <path d="M9 15l2 2 4-4" stroke="#E53935" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )},
  payment: { icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="1" y="5" width="22" height="15" rx="3" fill="#43A047"/>
      <text x="12" y="14.5" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">₩</text>
      <path d="M1 10h22" stroke="white" strokeWidth="0.8" opacity="0.3"/>
    </svg>
  )},
  review: { icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 2l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17l-5.8 3 1.1-6.5L2.6 8.8l6.5-.9L12 2z" fill="#FBC02D"/>
    </svg>
  )},
  system: { icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9.5" fill="#9E9E9E"/>
      <circle cx="12" cy="12" r="3.5" fill="#616161"/>
      <circle cx="12" cy="12" r="1.5" fill="#9E9E9E"/>
      <rect x="11" y="2" width="2" height="3" rx="1" fill="#9E9E9E"/><rect x="11" y="19" width="2" height="3" rx="1" fill="#9E9E9E"/>
      <rect x="19" y="11" width="3" height="2" rx="1" fill="#9E9E9E"/><rect x="2" y="11" width="3" height="2" rx="1" fill="#9E9E9E"/>
    </svg>
  )},
  marketing: { icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" fill="#5C6BC0"/>
      <path d="M7 8h4v4H7z" fill="#FFD54F"/>
      <rect x="7" y="14" width="10" height="1.5" rx="0.75" fill="white" opacity="0.5"/>
      <path d="M17 4l3-2v4l-3-2z" fill="#FFA726"/>
    </svg>
  )},
};

const MOCK_NOTIFICATIONS: Notification[] = [];

export default function NotificationsPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const authUser = useAuthStore((s) => s.user);
  useEffect(() => {
    const loggedIn = authUser !== null || localStorage.getItem('freetiful-logged-in') === 'true';
    setIsLoggedIn(loggedIn);

    // Fetch from API first
    if (authUser) {
      notificationApi.getList({ limit: 50 })
        .then((res: any) => {
          if (res.data?.length > 0) {
            setItems(res.data.map((n: any) => ({
              id: n.id,
              type: n.type as NotifType,
              title: n.title || '',
              body: n.body || '',
              isRead: n.isRead,
              date: new Date(n.createdAt).toLocaleDateString('ko-KR'),
              link: n.data?.link,
            })));
            return;
          }
        })
        .catch(() => {});
    }

    // No mock fallback
  }, [authUser]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [swipeStates, setSwipeStates] = useState<Record<string, number>>({});
  const touchStartX = useRef<Record<string, number>>({});
  const touchCurrentX = useRef<Record<string, number>>({});
  const mouseDown = useRef<Record<string, boolean>>({});

  const filteredItems = searchQuery
    ? items.filter(n => n.title.includes(searchQuery) || n.body.includes(searchQuery))
    : items;

  const handleDeleteAll = () => {
    setItems([]);
    setShowDeleteConfirm(false);
  };

  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(n => n.id !== id));
    setSwipeStates(prev => { const next = { ...prev }; delete next[id]; return next; });
  };

  const handleTouchStart = useCallback((id: string, e: React.TouchEvent) => {
    touchStartX.current[id] = e.touches[0].clientX;
    touchCurrentX.current[id] = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((id: string, e: React.TouchEvent) => {
    touchCurrentX.current[id] = e.touches[0].clientX;
    const diff = touchStartX.current[id] - touchCurrentX.current[id];
    setSwipeStates(prev => ({ ...prev, [id]: Math.max(0, Math.min(diff, 100)) }));
  }, []);

  const handleTouchEnd = useCallback((id: string) => {
    const diff = touchStartX.current[id] - touchCurrentX.current[id];
    setSwipeStates(prev => ({ ...prev, [id]: diff > 80 ? 80 : 0 }));
  }, []);

  const handleMouseDown = useCallback((id: string, e: React.MouseEvent) => {
    mouseDown.current[id] = true;
    touchStartX.current[id] = e.clientX;
  }, []);

  const handleMouseMove = useCallback((id: string, e: React.MouseEvent) => {
    if (!mouseDown.current[id]) return;
    touchCurrentX.current[id] = e.clientX;
    const diff = touchStartX.current[id] - touchCurrentX.current[id];
    setSwipeStates(prev => ({ ...prev, [id]: Math.max(0, Math.min(diff, 100)) }));
  }, []);

  const handleMouseUp = useCallback((id: string) => {
    if (!mouseDown.current[id]) return;
    mouseDown.current[id] = false;
    const diff = touchStartX.current[id] - (touchCurrentX.current[id] ?? touchStartX.current[id]);
    setSwipeStates(prev => ({ ...prev, [id]: diff > 80 ? 80 : 0 }));
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between h-12 px-2.5">
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="p-1 -ml-1">
              <ChevronLeft size={24} className="text-gray-800" />
            </button>
            <h1 className="text-[18px] font-bold text-gray-800">알림</h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <Search size={20} className="text-gray-800" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <Trash2 size={20} className="text-gray-400" />
            </button>
          </div>
        </div>

        {showSearch && (
          <div className="px-2.5 pb-3 animate-fade-in">
            <div className="flex items-center gap-2 px-3 h-10 bg-gray-100 rounded-lg border border-gray-200">
              <Search size={16} className="text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="알림 검색"
                autoFocus
                className="flex-1 bg-transparent outline-none text-[14px] text-gray-800 placeholder-gray-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}>
                  <X size={16} className="text-gray-400" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Notification List */}
      {filteredItems.length > 0 ? (
        <div>
          {filteredItems.map((n) => {
            const badge = typeIconMap[n.type];
            const swipeX = swipeStates[n.id] ?? 0;

            return (
              <div key={n.id} className="relative overflow-hidden border-b border-gray-100">
                {/* Delete button behind */}
                <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center w-[80px] bg-red-500">
                  <button onClick={() => handleDelete(n.id)} className="flex flex-col items-center gap-1 text-white">
                    <Trash2 size={18} />
                    <span className="text-[11px]">삭제</span>
                  </button>
                </div>

                {/* Swipeable content */}
                <div
                  className="relative block"
                  style={{
                    transform: `translateX(-${swipeX}px)`,
                    transition: swipeX === 0 ? 'transform 0.3s ease' : 'none',
                    backgroundColor: !n.isRead ? '#F0F4FF' : '#FFFFFF',
                    boxShadow: '4px 0 0 0 ' + (!n.isRead ? '#F0F4FF' : '#FFFFFF'),
                  }}
                  onTouchStart={(e) => handleTouchStart(n.id, e)}
                  onTouchMove={(e) => handleTouchMove(n.id, e)}
                  onTouchEnd={() => handleTouchEnd(n.id)}
                  onMouseDown={(e) => handleMouseDown(n.id, e)}
                  onMouseMove={(e) => handleMouseMove(n.id, e)}
                  onMouseUp={() => handleMouseUp(n.id)}
                  onMouseLeave={() => handleMouseUp(n.id)}
                >
                  {n.link ? (
                    <Link
                      href={n.link}
                      className="block px-4 py-4"
                      onClick={(e) => { if (swipeX > 20) { e.preventDefault(); setSwipeStates(prev => ({ ...prev, [n.id]: 0 })); } }}
                    >
                      <NotifContent n={n} badge={badge} />
                    </Link>
                  ) : (
                    <div className="px-4 py-4">
                      <NotifContent n={n} badge={badge} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-gray-100">
            <Search size={28} className="text-gray-400" />
          </div>
          <p className="text-gray-400 text-[14px]">
            {searchQuery ? '검색 결과가 없습니다' : '알림이 없습니다'}
          </p>
        </div>
      )}

      {/* Delete All Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setShowDeleteConfirm(false)}>
          <div
            className="w-[340px] rounded-3xl bg-white p-5 flex flex-col gap-5"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h3 className="text-[20px] font-semibold text-gray-800">전체 삭제하시겠습니까?</h3>
              <p className="text-[15px] text-gray-500 mt-1">삭제된 알림은 복구할 수 없습니다.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAll}
                className="flex-1 h-12 rounded-xl bg-primary-500 text-white text-[16px] font-semibold"
              >
                네
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 h-12 rounded-xl bg-gray-100 text-gray-600 text-[16px] font-semibold"
              >
                아니요
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NotifContent({ n, badge }: { n: Notification; badge: { icon: React.ReactNode } }) {
  return (
    <div>
      {/* Title row: icon + title + unread dot + date */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="shrink-0 flex items-center">{badge.icon}</span>
          <p className={`text-[15px] leading-snug truncate ${!n.isRead ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
            {n.title}
          </p>
          {!n.isRead && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />
          )}
        </div>
        <span className="text-[11px] text-gray-400 shrink-0">{n.date}</span>
      </div>

      {/* Content preview */}
      <p className="text-[13px] text-gray-400 leading-[18px] mt-1.5 ml-[26px] line-clamp-2">{n.body}</p>
    </div>
  );
}
