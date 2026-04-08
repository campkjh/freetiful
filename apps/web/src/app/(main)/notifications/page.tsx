'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Search, Trash2, X } from 'lucide-react';

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

const typeBadgeMap: Record<NotifType, { label: string; color: string; bg: string }> = {
  chat:      { label: '채팅',     color: '#2563EB', bg: '#DBEAFE' },
  booking:   { label: '예약',     color: '#059669', bg: '#D1FAE5' },
  payment:   { label: '결제',     color: '#7C3AED', bg: '#EDE9FE' },
  review:    { label: '리뷰',     color: '#D97706', bg: '#FEF3C7' },
  system:    { label: '안내',     color: '#6B7280', bg: '#F3F4F6' },
  marketing: { label: '이벤트',   color: '#DC2626', bg: '#FEE2E2' },
};

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: '1', type: 'chat', title: '김민준 MC님의 새 메시지', body: '네, 4월 5일 결혼식 MC 가능합니다. 세부 사항 안내 드리겠습니다. 시간과 장소 알려주시면 맞춤 견적 보내드릴게요.', isRead: false, date: '5분 전', link: '/chat/1' },
  { id: '2', type: 'payment', title: '결제 완료', body: '웨딩 MC 패키지 500,000원 결제가 완료되었습니다. 영수증은 결제내역에서 확인하실 수 있습니다.', isRead: false, date: '30분 전', link: '/my/payment-history' },
  { id: '3', type: 'chat', title: '정하린 플로리스트님의 새 메시지', body: '부케 시안 보내드립니다 💐 확인 부탁드려요! 수정사항 있으시면 편하게 말씀해주세요.', isRead: false, date: '2시간 전', link: '/chat/5' },
  { id: '4', type: 'review', title: '리뷰를 작성해주세요', body: '김민준 MC님과의 행사는 어떠셨나요? 소중한 후기를 남겨주시면 다른 분들께 큰 도움이 됩니다.', isRead: true, date: '1일 전' },
  { id: '5', type: 'booking', title: '예약 확정', body: '4월 5일 김민준 MC님 예약이 확정되었습니다. 행사 당일 일정을 다시 한번 확인해 주세요.', isRead: true, date: '2일 전' },
  { id: '6', type: 'system', title: '서비스 업데이트 안내', body: '채팅 기능이 개선되었습니다. 예약 메시지, 이모지 리액션 기능이 추가되었어요.', isRead: true, date: '3일 전', link: '/my/announcements' },
  { id: '7', type: 'marketing', title: '오픈 기념 10% 할인 쿠폰 도착!', body: '첫 결제 시 사용 가능한 10% 할인 쿠폰이 발급되었습니다. 지금 바로 사용해보세요!', isRead: true, date: '5일 전', link: '/my/coupons' },
  { id: '8', type: 'chat', title: '박준혁 가수님의 새 메시지', body: '축가 3곡 기본이고, 추가 곡은 곡당 5만원입니다. 곡 목록 보내드릴까요?', isRead: true, date: '6일 전', link: '/chat/3' },
];

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>(MOCK_NOTIFICATIONS);
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
            const badge = typeBadgeMap[n.type];
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

function NotifContent({ n, badge }: { n: Notification; badge: { label: string; color: string; bg: string } }) {
  return (
    <>
      {/* Badge + Date row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded"
            style={{ color: badge.color, backgroundColor: badge.bg }}
          >
            {badge.label}
          </span>
          {!n.isRead && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
          )}
        </div>
        <span className="text-[12px] text-gray-400">{n.date}</span>
      </div>

      {/* Title */}
      <p className={`text-[16px] leading-snug mb-1.5 ${!n.isRead ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
        {n.title}
      </p>

      {/* Content preview with gradient fade */}
      <div className="relative max-h-[50px] overflow-hidden">
        <p className="text-[14px] text-gray-400 leading-[20px]">{n.body}</p>
        <div
          className="absolute bottom-0 left-0 right-0 h-[24px]"
          style={{
            background: !n.isRead
              ? 'linear-gradient(transparent, #F0F4FF)'
              : 'linear-gradient(transparent, #FFFFFF)',
          }}
        />
      </div>
    </>
  );
}
