'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Clock, MessageCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { matchApi } from '@/lib/api/match.api';
import { useAuthStore } from '@/lib/store/auth.store';
import { getProfileImageUrl } from '@/lib/default-profile';

type InquiryStatus = '요청중' | '요청승인' | '거래완료';

type InquiryCard = {
  id: string;
  requestId: string;
  roomId?: string;
  proName: string;
  proImage?: string | null;
  category: string;
  location: string;
  eventDate: string;
  eventTime: string;
  createdAt: string;
  status: InquiryStatus;
};

function formatDate(value?: string | null) {
  if (!value) return '일자 미정';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '일자 미정';
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
}

function formatTime(value?: string | null) {
  if (!value) return '시간 미정';
  const time = value.includes('T') ? new Date(value).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : value.slice(0, 5);
  return time || '시간 미정';
}

function getStatusTone(status: InquiryStatus) {
  if (status === '거래완료') return 'bg-[#EAF7EF] text-[#159947]';
  if (status === '요청승인') return 'bg-[#EAF3FF] text-[#3180F7]';
  return 'bg-gray-100 text-gray-500';
}

function getStatusIcon(status: InquiryStatus) {
  if (status === '거래완료') return CheckCircle2;
  if (status === '요청승인') return MessageCircle;
  return Clock;
}

function buildCards(requests: any[]): InquiryCard[] {
  return requests.flatMap((request) => {
    const rooms = Array.isArray(request.chatRooms) ? request.chatRooms : [];
    const deliveries = Array.isArray(request.deliveries) ? request.deliveries : [];
    const base = {
      requestId: request.id,
      category: request.eventCategory?.name || request.category?.name || '사회자 문의',
      location: request.eventLocation || '장소 미정',
      eventDate: formatDate(request.eventDate),
      eventTime: formatTime(request.eventTime),
      createdAt: formatDate(request.createdAt),
    };

    const deliveryCards = deliveries.map((delivery: any) => {
      const room = rooms.find((item: any) => item.proProfileId === delivery.proProfileId);
      const latestQuotation = Array.isArray(room?.quotations) ? room.quotations[0] : null;
      const paid = latestQuotation?.payment?.status === 'completed' || latestQuotation?.status === 'paid';
      const approved = Boolean(room?.id) || delivery.status === 'replied';
      const proProfile = delivery.proProfile || room?.proProfile;
      const proUser = proProfile?.user;
      const proImage = proProfile?.images?.[0]?.imageUrl || proUser?.profileImageUrl || null;
      return {
        ...base,
        id: delivery.id,
        roomId: room?.id,
        proName: proUser?.name || '사회자',
        proImage,
        status: paid ? '거래완료' : approved ? '요청승인' : '요청중',
      } as InquiryCard;
    });

    if (deliveryCards.length > 0) return deliveryCards;

    const room = rooms[0];
    const latestQuotation = Array.isArray(room?.quotations) ? room.quotations[0] : null;
    const paid = latestQuotation?.payment?.status === 'completed' || latestQuotation?.status === 'paid';
    const proUser = room?.proProfile?.user;
    return [{
      ...base,
      id: request.id,
      roomId: room?.id,
      proName: proUser?.name || '사회자',
      proImage: room?.proProfile?.images?.[0]?.imageUrl || proUser?.profileImageUrl || null,
      status: paid ? '거래완료' : room?.id ? '요청승인' : '요청중',
    } as InquiryCard];
  });
}

export default function CustomerInquiriesPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    matchApi.getMyRequests()
      .then((data) => {
        if (!cancelled) setRequests(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) toast.error('문의목록을 불러오지 못했습니다');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [authUser?.id]);

  const cards = useMemo(() => buildCards(requests), [requests]);

  const openInquiry = (item: InquiryCard) => {
    if (item.roomId) {
      router.push(`/chat/${item.roomId}`);
      return;
    }
    toast('사회자가 문의를 승인하면 채팅방이 열립니다');
  };

  return (
    <div className="min-h-screen bg-white pb-28 lg:mx-auto lg:max-w-3xl">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 bg-white/90 px-4 backdrop-blur">
        <button type="button" onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100" aria-label="뒤로가기">
          <ChevronLeft size={24} className="text-gray-800" />
        </button>
        <h1 className="text-[18px] font-bold text-gray-950">문의목록</h1>
      </header>

      <main className="px-4 pt-3">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-[118px] animate-pulse rounded-3xl bg-gray-50" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
              <MessageCircle size={28} className="text-gray-300" />
            </div>
            <p className="text-[17px] font-bold text-gray-900">아직 문의한 사회자가 없습니다</p>
            <p className="mt-2 text-[14px] leading-6 text-gray-400">마음에 드는 사회자 상세페이지에서 문의를 보내면 이곳에 표시됩니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cards.map((item) => {
              const StatusIcon = getStatusIcon(item.status);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openInquiry(item)}
                  className="w-full rounded-3xl border border-[#F2F4F7] bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)] active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={getProfileImageUrl(item.proImage, item.proName)}
                      alt=""
                      className="h-14 w-14 rounded-2xl object-cover bg-gray-50"
                      loading="lazy"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[16px] font-bold text-[#2B313D]">{item.proName}</p>
                          <p className="mt-0.5 truncate text-[13px] font-medium text-gray-400">{item.category}</p>
                        </div>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold ${getStatusTone(item.status)}`}>
                          <StatusIcon size={13} />
                          {item.status}
                        </span>
                      </div>
                      <div className="mt-3 rounded-2xl bg-gray-50 px-3 py-2">
                        <p className="truncate text-[13px] font-semibold text-gray-700">{item.location}</p>
                        <p className="mt-0.5 text-[12px] font-medium text-gray-400">{item.eventDate} · {item.eventTime}</p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="mt-9 shrink-0 text-gray-300" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
