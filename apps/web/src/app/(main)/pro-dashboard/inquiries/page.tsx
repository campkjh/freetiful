'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, Users, User, MessageCircle, ChevronRight } from 'lucide-react';
import { chatApi, type ChatRoomItem } from '@/lib/api/chat.api';
import { useAuthStore } from '@/lib/store/auth.store';

type Filter = 'all' | 'pending' | 'replied';

interface InquiryView {
  id: string;
  userName: string;
  image: string;
  message: string;
  receivedAt: string;
  unread: number;
  hasQuote: boolean;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}일 전`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function InquiriesPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [inquiries, setInquiries] = useState<InquiryView[]>([]);
  const [loading, setLoading] = useState(true);
  const authUser = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!authUser) { setLoading(false); return; }
    chatApi.getRooms({ page: 1 })
      .then((res) => {
        const rooms = (res.data.data || []) as ChatRoomItem[];
        setInquiries(rooms.map((r) => ({
          id: r.id,
          userName: r.otherUser.name,
          image: r.otherUser.profileImageUrl || '/images/default-profile.svg',
          message: r.lastMessage?.content?.split('\n')[0] || '(대화를 시작해보세요)',
          receivedAt: timeAgo(r.lastMessageAt),
          unread: r.unreadCount,
          hasQuote: (r.lastMessage?.content || '').includes('📋 견적 요청'),
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authUser]);

  const filtered = inquiries.filter((i) =>
    filter === 'all' ? true : filter === 'pending' ? i.unread > 0 : i.unread === 0
  );
  const pendingCount = inquiries.filter((i) => i.unread > 0).length;

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white px-4 pt-12 pb-3 sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.back()} className="p-1"><ArrowLeft size={22} /></button>
          <h1 className="text-lg font-bold">문의 관리</h1>
          {pendingCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
          )}
        </div>

        <div className="flex gap-2">
          {([
            { key: 'all' as Filter, label: '전체', icon: null },
            { key: 'pending' as Filter, label: '미답변', icon: User },
            { key: 'replied' as Filter, label: '답변완료', icon: Users },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === key
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {Icon && <Icon size={12} />}
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-24" />
                    <div className="h-3 bg-gray-100 rounded w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm">문의가 없습니다</p>
          </div>
        ) : (
          filtered.map((inq) => (
            <Link key={inq.id} href={`/chat/${inq.id}`} className="card p-4 block hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <img src={inq.image} alt={inq.userName} className="w-10 h-10 rounded-full object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {inq.hasQuote && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">견적요청</span>
                    )}
                    <p className="text-sm font-bold text-gray-900 truncate">{inq.userName}</p>
                    {inq.unread > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white ml-auto shrink-0">{inq.unread}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">{inq.message}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={10} /> {inq.receivedAt}</span>
                    <span className="ml-auto"><ChevronRight size={14} className="text-gray-300" /></span>
                  </div>

                  {inq.unread > 0 && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={(e) => e.preventDefault()}
                        className="flex-1 py-2 text-xs font-bold text-white bg-primary-500 rounded-xl flex items-center justify-center gap-1"
                      >
                        <MessageCircle size={12} /> 답변하기
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
