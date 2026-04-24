'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, Clock, Users, User, MessageCircle, ChevronRight, MapPin, Calendar, DollarSign } from 'lucide-react';
import { chatApi, type ChatRoomItem } from '@/lib/api/chat.api';
import { matchApi } from '@/lib/api/match.api';
import { useAuthStore } from '@/lib/store/auth.store';

type Filter = 'all' | 'pending' | 'replied' | 'match';

interface InquiryView {
  id: string;
  userName: string;
  image: string;
  message: string;
  receivedAt: string;
  unread: number;
  hasQuote: boolean;
}

interface MatchDeliveryView {
  id: string; // delivery id
  matchRequestId: string;
  status: string;
  customerId: string;
  customerName: string;
  customerImage: string;
  categoryName: string;
  eventCategoryName: string;
  eventDate: string | null;
  eventTime: string | null;
  eventLocation: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  styles: string[];
  personalities: string[];
  deliveredAt: string;
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

function formatDate(iso: string | null): string {
  if (!iso) return '미정';
  const d = new Date(iso);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}/${d.getDate()} (${weekdays[d.getDay()]})`;
}

function formatBudget(min: number | null, max: number | null): string {
  const fmt = (n: number) => n >= 10000 ? `${(n / 10000).toFixed(0)}만` : `${n.toLocaleString()}`;
  if (min != null && max != null) return `${fmt(min)}원 ~ ${fmt(max)}원`;
  if (min != null) return `${fmt(min)}원 이상`;
  if (max != null) return `${fmt(max)}원 이하`;
  return '협의';
}

export default function InquiriesPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [inquiries, setInquiries] = useState<InquiryView[]>([]);
  const [matchDeliveries, setMatchDeliveries] = useState<MatchDeliveryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMatch, setLoadingMatch] = useState(true);
  const [initiatingChat, setInitiatingChat] = useState<string | null>(null);
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

  useEffect(() => {
    if (!authUser) { setLoadingMatch(false); return; }
    matchApi.getProRequests()
      .then((data: any) => {
        const items = Array.isArray(data) ? data : (data?.data || []);
        const mapped: MatchDeliveryView[] = items
          .filter((d: any) => d.status === 'pending' || d.status === 'viewed')
          .map((d: any) => ({
            id: d.id,
            matchRequestId: d.matchRequestId,
            status: d.status,
            customerId: d.matchRequest?.user?.id || '',
            customerName: d.matchRequest?.user?.name || '고객',
            customerImage: d.matchRequest?.user?.profileImageUrl || '/images/default-profile.svg',
            categoryName: d.matchRequest?.category?.name || '',
            eventCategoryName: d.matchRequest?.eventCategory?.name || '',
            eventDate: d.matchRequest?.eventDate || null,
            eventTime: d.matchRequest?.eventTime || null,
            eventLocation: d.matchRequest?.eventLocation || null,
            budgetMin: d.matchRequest?.budgetMin ?? null,
            budgetMax: d.matchRequest?.budgetMax ?? null,
            styles: (d.matchRequest?.styles || []).map((s: any) => s.styleOption?.name || s.styleOption?.label || '').filter(Boolean),
            personalities: (d.matchRequest?.personalities || []).map((p: any) => p.personalityOption?.name || p.personalityOption?.label || '').filter(Boolean),
            deliveredAt: d.deliveredAt,
          }));
        setMatchDeliveries(mapped);
      })
      .catch(() => {})
      .finally(() => setLoadingMatch(false));
  }, [authUser]);

  async function handleStartChat(m: MatchDeliveryView) {
    if (initiatingChat) return;
    setInitiatingChat(m.id);
    try {
      // 매칭 요청 수락 처리 (중복 허용 — 이미 replied면 실패해도 무시)
      matchApi.respond(m.id, 'accept').catch(() => {});
      // 먼저 채팅방 생성 (전문가→고객)
      const res = await chatApi.createRoomAsPro(m.customerId, m.matchRequestId);
      const roomId = (res as any)?.data?.id || (res as any)?.id;
      if (roomId) {
        router.push(`/chat/${roomId}`);
      } else {
        toast.error('채팅방 생성에 실패했습니다');
      }
    } catch (e: any) {
      toast.error(`채팅 연결 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setInitiatingChat(null);
    }
  }

  async function handleReject(deliveryId: string) {
    try {
      await matchApi.respond(deliveryId, 'reject');
      setMatchDeliveries((prev) => prev.filter((m) => m.id !== deliveryId));
      toast.success('거절 처리되었습니다');
    } catch (e: any) {
      toast.error(`거절 실패: ${e?.response?.data?.message || e?.message || ''}`);
    }
  }

  const filtered = inquiries.filter((i) =>
    filter === 'all' ? true : filter === 'pending' ? i.unread > 0 : filter === 'replied' ? i.unread === 0 : false
  );
  const pendingCount = inquiries.filter((i) => i.unread > 0).length;
  const matchCount = matchDeliveries.length;

  return (
    <div className="bg-gray-50 min-h-screen pb-24">
      <div className="bg-white px-4 pt-12 pb-3 sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.back()} className="p-1"><ArrowLeft size={22} /></button>
          <h1 className="text-lg font-bold">문의 관리</h1>
          {(pendingCount + matchCount) > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount + matchCount}</span>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto">
          {([
            { key: 'all' as Filter, label: '전체', icon: null, badge: 0 },
            { key: 'pending' as Filter, label: '미답변', icon: User, badge: pendingCount },
            { key: 'replied' as Filter, label: '답변완료', icon: Users, badge: 0 },
            { key: 'match' as Filter, label: '예약요청', icon: Calendar, badge: matchCount },
          ]).map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border shrink-0 transition-colors ${
                filter === key
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {Icon && <Icon size={12} />}
              {label}
              {badge > 0 && (
                <span className={`text-[9px] font-bold px-1.5 rounded-full ${filter === key ? 'bg-white text-primary-500' : 'bg-red-500 text-white'}`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 예약요청 탭 — 매칭 딜리버리 카드들 */}
      {filter === 'match' && (
        <div className="px-4 py-4 space-y-3">
          {loadingMatch ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="card p-4 animate-pulse h-40" />
              ))}
            </div>
          ) : matchDeliveries.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-400 text-sm">새 예약 요청이 없습니다</p>
              <p className="text-gray-300 text-[11px] mt-1">고객이 매칭 요청을 보내면 여기에 표시됩니다</p>
            </div>
          ) : (
            matchDeliveries.map((m) => (
              <div key={m.id} className="bg-white rounded-2xl border border-[#3180F7]/30 p-4 shadow-sm space-y-3">
                <div className="flex items-start gap-3">
                  <img src={m.customerImage} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#3180F7] text-white">예약 요청</span>
                      <p className="text-sm font-bold text-gray-900 truncate">{m.customerName}</p>
                      <span className="text-[10px] text-gray-300 ml-auto shrink-0">{timeAgo(m.deliveredAt)}</span>
                    </div>
                    <p className="text-[13px] text-gray-700 font-medium">
                      {[m.categoryName, m.eventCategoryName].filter(Boolean).join(' · ')}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(m.eventDate)}{m.eventTime ? ` ${m.eventTime}` : ''}</span>
                      {m.eventLocation && <span className="flex items-center gap-1"><MapPin size={10} /> {m.eventLocation}</span>}
                    </div>
                    <p className="text-[12px] font-bold text-[#3180F7] mt-1.5 flex items-center gap-1">
                      <DollarSign size={11} /> {formatBudget(m.budgetMin, m.budgetMax)}
                    </p>
                    {(m.styles.length > 0 || m.personalities.length > 0) && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {[...m.styles, ...m.personalities].slice(0, 6).map((tag, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-50">
                  <button
                    onClick={() => handleReject(m.id)}
                    disabled={initiatingChat === m.id}
                    className="flex-1 h-10 rounded-xl bg-gray-100 text-gray-600 text-[13px] font-bold active:scale-95 transition-transform disabled:opacity-50"
                  >
                    거절
                  </button>
                  <button
                    onClick={() => handleStartChat(m)}
                    disabled={initiatingChat === m.id}
                    className="flex-1 h-10 rounded-xl bg-[#3180F7] text-white text-[13px] font-bold active:scale-95 transition-transform disabled:opacity-60 flex items-center justify-center gap-1"
                  >
                    {initiatingChat === m.id ? (
                      <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> 연결 중…</>
                    ) : (
                      <><MessageCircle size={12} /> 채팅 걸기</>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 채팅 탭 (전체/미답변/답변완료) */}
      {filter !== 'match' && (
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
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
