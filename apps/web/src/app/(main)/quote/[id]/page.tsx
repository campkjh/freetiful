'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Calendar, Clock, MapPin, User } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { quotationApi } from '@/lib/api/quotation.api';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '대기중', color: '#D97706', bg: '#FFFBEB' },
  accepted: { label: '수락됨', color: '#059669', bg: '#ECFDF5' },
  rejected: { label: '거절됨', color: '#DC2626', bg: '#FEF2F2' },
  paid: { label: '결제완료', color: '#2563EB', bg: '#EFF6FF' },
  cancelled: { label: '취소됨', color: '#6B7280', bg: '#F3F4F6' },
  expired: { label: '만료됨', color: '#6B7280', bg: '#F3F4F6' },
};

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    quotationApi.getDetail(String(id))
      .then((data) => setQuote(data))
      .catch(() => setError('견적서를 찾을 수 없습니다'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-3">
        <p className="text-gray-400">{error || '견적서를 찾을 수 없습니다'}</p>
        <button onClick={() => router.back()} className="text-[13px] text-blue-500">돌아가기</button>
      </div>
    );
  }

  const status = STATUS_MAP[quote.status] || STATUS_MAP.pending;
  const proUser = quote.proProfile?.user;
  const proImage = quote.proProfile?.images?.[0]?.imageUrl || proUser?.profileImageUrl || '/images/default-profile.svg';
  const eventDate = quote.eventDate ? new Date(quote.eventDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }) : '-';
  const eventTime = quote.eventTime ? new Date(quote.eventTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-';
  const isMyQuote = authUser?.role === 'pro' && quote.proProfile?.userId === authUser.id;
  const canPay = !isMyQuote && quote.status === 'pending';

  return (
    <div className="bg-gray-50 min-h-screen pb-32" style={{ letterSpacing: '-0.02em' }}>
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="flex items-center px-3 h-[52px]">
          <button onClick={() => router.back()} className="p-1.5 active:scale-90 transition-transform">
            <ChevronLeft size={24} className="text-gray-900" />
          </button>
          <h1 className="ml-1 text-[18px] font-bold text-gray-900">견적서 상세</h1>
        </div>
      </div>

      <div className="px-5 py-4 bg-white">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold px-3 py-1 rounded-full" style={{ color: status.color, backgroundColor: status.bg }}>
            {status.label}
          </span>
        </div>
      </div>

      <div className="h-2 bg-gray-50" />

      <div className="bg-white px-5 py-4">
        <p className="text-[12px] text-gray-400 mb-3">전문가</p>
        <div className="flex items-center gap-3">
          <img src={proImage} alt={proUser?.name} className="w-[56px] h-[72px] rounded-xl object-cover shrink-0" />
          <div className="flex-1">
            <p className="text-[18px] font-bold text-gray-900">{proUser?.name || '전문가'}</p>
            <p className="text-[13px] text-gray-400 mt-0.5">
              {quote.proProfile?.categories?.[0]?.category?.name || '사회자'}
            </p>
          </div>
        </div>
      </div>

      <div className="h-2 bg-gray-50" />

      <div className="bg-white px-5 py-4">
        <p className="text-[12px] text-gray-400 mb-3">견적 내용</p>
        {quote.title && (
          <p className="text-[16px] font-bold text-gray-900 mb-2">{quote.title}</p>
        )}
        {quote.description && (
          <p className="text-[14px] text-gray-600 leading-relaxed whitespace-pre-wrap">{quote.description}</p>
        )}
      </div>

      <div className="h-2 bg-gray-50" />

      <div className="bg-white px-5 py-4">
        <p className="text-[12px] text-gray-400 mb-3">행사 정보</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-400" />
            <span className="text-[14px] text-gray-700">{eventDate}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-gray-400" />
            <span className="text-[14px] text-gray-700">{eventTime}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-gray-400" />
            <span className="text-[14px] text-gray-700">{quote.eventLocation || '-'}</span>
          </div>
        </div>
      </div>

      <div className="h-2 bg-gray-50" />

      <div className="bg-white px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-bold text-gray-900">견적 금액</span>
          <span className="text-[22px] font-bold text-gray-900">{Number(quote.amount || 0).toLocaleString()}원</span>
        </div>
        {quote.validUntil && (
          <p className="text-[12px] text-gray-400 mt-2">
            유효기간: {new Date(quote.validUntil).toLocaleDateString('ko-KR')}까지
          </p>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 px-4 pt-3 pb-safe">
        {canPay ? (
          <button
            onClick={() => router.push(`/payment?quotationId=${quote.id}`)}
            className="w-full h-[52px] text-[16px] font-bold text-white active:scale-[0.98] transition-transform"
            style={{ backgroundColor: '#2B313D', borderRadius: 14 }}
          >
            결제하기
          </button>
        ) : (
          <button
            onClick={() => router.back()}
            className="w-full h-[52px] text-[16px] font-bold text-gray-700 border border-gray-200 active:scale-[0.98] transition-transform"
            style={{ borderRadius: 14 }}
          >
            돌아가기
          </button>
        )}
      </div>
    </div>
  );
}
