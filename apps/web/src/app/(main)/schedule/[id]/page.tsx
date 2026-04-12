'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Clock, MapPin, Phone, MessageCircle, AlertTriangle, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

const MOCK_BOOKINGS: Record<string, {
  proName: string; proImage: string; category: string;
  date: string; eventDate: string; time: string; location: string;
  plan: string; price: number; status: 'confirmed' | 'pending' | 'completed' | 'cancelled';
}> = {
  '1': { proName: '박인애', proImage: '/images/박인애/IMG_0196.avif', category: 'MC', date: '2026. 4. 10 (금)', eventDate: '2026-04-10', time: '14:00 - 16:00', location: '그랜드 웨딩홀', plan: 'Premium 패키지', price: 450000, status: 'confirmed' },
  '2': { proName: '성연채', proImage: '/images/이승진/IMG_46511771924269213.avif', category: '축가', date: '2026. 4. 10 (금)', eventDate: '2026-04-10', time: '14:30 - 15:00', location: '그랜드 웨딩홀', plan: 'Superior 패키지', price: 800000, status: 'confirmed' },
  '3': { proName: '조하늘', proImage: '/images/전해별/IMG_73341772850094485.avif', category: '스튜디오', date: '2026. 4. 15 (수)', eventDate: '2026-04-15', time: '10:00 - 13:00', location: '강남 스튜디오', plan: 'Premium 패키지', price: 550000, status: 'pending' },
  '4': { proName: '김진아', proImage: '/images/박인애/IMG_0196.avif', category: '드레스', date: '2026. 4. 18 (토)', eventDate: '2026-04-18', time: '15:00 - 17:00', location: '청담 쇼룸', plan: 'Enterprise 패키지', price: 1700000, status: 'pending' },
  '5': { proName: '유하영', proImage: '/images/김동현/10000365351773046135169.avif', category: '헤메샵', date: '2026. 4. 22 (수)', eventDate: '2026-04-22', time: '11:00 - 13:00', location: '압구정 살롱', plan: 'Premium 패키지', price: 450000, status: 'pending' },
  '6': { proName: '함현지', proImage: '/images/박인애/IMG_0196.avif', category: '웨딩홀', date: '2026. 4. 5 (토)', eventDate: '2026-04-05', time: '14:00 - 15:30', location: '청담동', plan: 'Superior 패키지', price: 800000, status: 'completed' },
  '7': { proName: '문정은', proImage: '/images/박인애/IMG_0196.avif', category: 'MC', date: '2026. 4. 3 (목)', eventDate: '2026-04-03', time: '16:00 - 17:00', location: '카페', plan: 'Premium 패키지', price: 450000, status: 'completed' },
};

const STATUS_MAP = {
  confirmed: { label: '예약 확정', color: '#3B82F6', bg: '#EFF6FF' },
  pending: { label: '확인 대기', color: '#D97706', bg: '#FFFBEB' },
  completed: { label: '이용 완료', color: '#6B7280', bg: '#F3F4F6' },
  cancelled: { label: '취소 완료', color: '#EF4444', bg: '#FEF2F2' },
};

// 환불 정책 계산
function getRefundPolicy(eventDate: string, price: number) {
  const now = new Date();
  const event = new Date(eventDate);
  const diffMs = event.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays >= 7) return { rate: 100, refundAmount: price, penalty: 0, label: '행사 7일 전 이상', description: '전액 환불', canCancel: true };
  if (diffDays >= 3) return { rate: 90, refundAmount: Math.round(price * 0.9), penalty: Math.round(price * 0.1), label: '행사 3~6일 전', description: '수수료 제외 환불 (10% 수수료)', canCancel: true };
  if (diffDays >= 1) return { rate: 50, refundAmount: Math.round(price * 0.5), penalty: Math.round(price * 0.5), label: '행사 1~2일 전', description: '50% 환불', canCancel: true };
  return { rate: 0, refundAmount: 0, penalty: price, label: '행사 당일', description: '환불 불가', canCancel: false };
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const bookingData = MOCK_BOOKINGS[id];
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [bookingStatus, setBookingStatus] = useState(bookingData?.status || 'pending');
  const [agreedPolicy, setAgreedPolicy] = useState(false);

  if (!bookingData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-400">예약 정보를 찾을 수 없습니다</p>
      </div>
    );
  }

  const booking = { ...bookingData, status: bookingStatus as typeof bookingData.status };
  const status = STATUS_MAP[booking.status];
  const pointUsed = 5000;
  const finalPrice = booking.price - pointUsed;
  const refundPolicy = getRefundPolicy(booking.eventDate, finalPrice);

  const CANCEL_REASONS = [
    '일정이 변경되었어요',
    '다른 전문가를 찾았어요',
    '행사가 취소되었어요',
    '전문가와 협의가 안 되었어요',
    '단순 변심이에요',
    '기타',
  ];

  const handleCancelConfirm = () => {
    if (!cancelReason) { toast.error('취소 사유를 선택해주세요'); return; }
    if (!agreedPolicy) { toast.error('환불 규정에 동의해주세요'); return; }

    setBookingStatus('cancelled');
    setShowCancelModal(false);
    setShowCompleteModal(true);
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-36" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="flex items-center px-3 h-[52px]">
          <button onClick={() => router.back()} className="p-1.5 active:scale-90 transition-transform">
            <ChevronLeft size={24} className="text-gray-900" />
          </button>
          <h1 className="ml-1 text-[18px] font-bold text-gray-900">예약 상세</h1>
        </div>
      </div>

      {/* 상태 배너 */}
      <div className="px-5 py-4 bg-white">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold px-3 py-1 rounded-full" style={{ color: status.color, backgroundColor: status.bg }}>
            {status.label}
          </span>
          <span className="text-[13px] text-gray-400">
            {booking.status === 'confirmed' && '전문가가 예약을 확정했어요'}
            {booking.status === 'pending' && '전문가 확인을 기다리고 있어요'}
            {booking.status === 'completed' && '이용이 완료된 예약이에요'}
            {booking.status === 'cancelled' && '예약이 취소되었어요'}
          </span>
        </div>
      </div>

      <div className="h-2 bg-gray-50" />

      {/* 전문가 정보 */}
      <div className="bg-white px-5 py-4">
        <p className="text-[12px] text-gray-400 mb-3">전문가</p>
        <div className="flex items-center gap-3">
          <img src={booking.proImage} alt={booking.proName} className="w-[56px] h-[72px] rounded-xl object-cover shrink-0" />
          <div className="flex-1">
            <p className="text-[18px] font-bold text-gray-900">{booking.category} {booking.proName}</p>
            <p className="text-[13px] text-gray-400 mt-0.5">{booking.plan}</p>
          </div>
        </div>
        {booking.status !== 'cancelled' && (
          <div className="flex gap-2 mt-3 relative z-10">
            <a href="tel:010-0000-0000" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-gray-200 text-[13px] font-medium text-gray-700 active:bg-gray-50 transition-colors" style={{ borderRadius: 10 }}>
              <Phone size={14} /> 전화하기
            </a>
            <button onClick={() => router.push('/chat')} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-gray-200 text-[13px] font-medium text-gray-700 active:bg-gray-50 transition-colors" style={{ borderRadius: 10 }}>
              <MessageCircle size={14} /> 채팅하기
            </button>
          </div>
        )}
      </div>

      <div className="h-2 bg-gray-50" />

      {/* 예약 일정 */}
      <div className="bg-white px-5 py-4">
        <p className="text-[12px] text-gray-400 mb-3">예약 일정</p>
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-[13px] font-medium text-gray-700" style={{ borderRadius: 8 }}>
            <Clock size={13} className="text-gray-400" />{booking.date}
          </span>
          <div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-[13px] font-medium text-gray-700" style={{ borderRadius: 8 }}>
              <Clock size={13} className="text-gray-400" />{booking.time}
            </span>
          </div>
          <div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-[13px] font-medium text-gray-700" style={{ borderRadius: 8 }}>
              <MapPin size={13} className="text-gray-400" />{booking.location}
            </span>
          </div>
        </div>
      </div>

      <div className="h-2 bg-gray-50" />

      {/* 결제 정보 */}
      <div className="bg-white px-5 py-4">
        <p className="text-[12px] text-gray-400 mb-3">결제 정보</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-gray-600">서비스 금액</span>
            <span className="text-[14px] font-medium text-gray-900">{booking.price.toLocaleString()}원</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-gray-600">포인트 사용</span>
            <span className="text-[14px] font-medium text-blue-600">-{pointUsed.toLocaleString()}원</span>
          </div>
          <div className="h-px bg-gray-100 my-1" />
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold text-gray-900">총 결제 금액</span>
            <span className="text-[18px] font-bold text-gray-900">{finalPrice.toLocaleString()}원</span>
          </div>
          {booking.status === 'cancelled' && (
            <>
              <div className="h-px bg-gray-100 my-1" />
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-red-500 font-bold">환불 금액</span>
                <span className="text-[16px] font-bold text-red-500">{refundPolicy.refundAmount.toLocaleString()}원</span>
              </div>
              {refundPolicy.penalty > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-400">위약금</span>
                  <span className="text-[13px] text-gray-400">{refundPolicy.penalty.toLocaleString()}원</span>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg mt-3">
          <span className="text-[12px] text-gray-500">결제 수단</span>
          <span className="text-[12px] font-medium text-gray-700">퀵계좌이체</span>
        </div>
      </div>

      <div className="h-2 bg-gray-50" />

      {/* 취소/환불 규정 */}
      <div className="bg-white px-5 py-4">
        <p className="text-[12px] text-gray-400 mb-3">취소/환불 규정</p>
        <table className="w-full border border-gray-200 text-[13px]" style={{ borderRadius: 8, overflow: 'hidden', borderCollapse: 'separate' }}>
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200">취소 시점</th>
              <th className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200">환불 비율</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['행사 7일 전', '100% 환불'],
              ['행사 3~6일 전', '수수료 제외 환불'],
              ['행사 1~2일 전', '50% 환불'],
              ['행사 당일', '환불 불가'],
            ].map(([time, refund], i) => (
              <tr key={i} className="border-b border-gray-100 last:border-0">
                <td className="px-3 py-2 text-gray-900 font-medium">{time}</td>
                <td className="px-3 py-2 text-gray-600">{refund}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[12px] text-gray-400 mt-2">
          현재 기준: <span className="font-bold text-gray-600">{refundPolicy.label}</span> — {refundPolicy.description}
        </p>
      </div>

      {/* 하단 고정 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 px-4 pt-3 pb-safe">
        {booking.status === 'completed' ? (
          <button
            onClick={() => router.push(`/pros/${id}/reviews/write`)}
            className="w-full h-[52px] text-[16px] font-bold text-white active:scale-[0.98] transition-transform"
            style={{ backgroundColor: '#2B313D', borderRadius: 14 }}
          >
            리뷰 작성하기
          </button>
        ) : booking.status === 'cancelled' ? (
          <button
            onClick={() => router.push('/main')}
            className="w-full h-[52px] text-[16px] font-bold text-white active:scale-[0.98] transition-transform"
            style={{ backgroundColor: '#2B313D', borderRadius: 14 }}
          >
            홈으로 돌아가기
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setShowCancelModal(true)}
              className="flex-1 h-[52px] text-[16px] font-bold text-gray-700 border border-gray-200 active:scale-[0.98] transition-transform"
              style={{ borderRadius: 14 }}
            >
              예약 취소
            </button>
            <button
              onClick={() => router.push('/chat')}
              className="flex-1 h-[52px] text-[16px] font-bold text-white active:scale-[0.98] transition-transform"
              style={{ backgroundColor: '#2B313D', borderRadius: 14 }}
            >
              채팅하기
            </button>
          </div>
        )}
      </div>

      {/* ═══ 취소/환불 모달 ═══ */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ animation: 'modalBgIn 0.2s ease' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCancelModal(false)} />
          <div
            className="relative w-full max-w-lg bg-white rounded-t-3xl px-5 pt-5 pb-8 max-h-[85vh] overflow-y-auto"
            style={{ animation: 'sheetUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            {/* Handle bar */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[18px] font-bold text-gray-900">예약 취소</h2>
              <button onClick={() => setShowCancelModal(false)} className="p-1">
                <X size={22} className="text-gray-400" />
              </button>
            </div>

            {/* 환불 정보 요약 */}
            <div className="p-4 bg-gray-50 mb-4" style={{ borderRadius: 12 }}>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-amber-500" />
                <span className="text-[14px] font-bold text-gray-900">{refundPolicy.label}</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-500">결제 금액</span>
                  <span className="text-[13px] font-medium text-gray-900">{finalPrice.toLocaleString()}원</span>
                </div>
                {refundPolicy.penalty > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-gray-500">위약금 ({100 - refundPolicy.rate}%)</span>
                    <span className="text-[13px] font-medium text-red-500">-{refundPolicy.penalty.toLocaleString()}원</span>
                  </div>
                )}
                <div className="h-px bg-gray-200 my-1" />
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-bold text-gray-900">환불 예정 금액</span>
                  <span className="text-[16px] font-bold text-blue-600">{refundPolicy.refundAmount.toLocaleString()}원</span>
                </div>
              </div>
            </div>

            {!refundPolicy.canCancel ? (
              <div className="p-4 bg-red-50 mb-4 text-center" style={{ borderRadius: 12 }}>
                <p className="text-[14px] font-bold text-red-600">행사 당일에는 취소가 불가합니다</p>
                <p className="text-[12px] text-red-400 mt-1">전문가에게 직접 연락해 주세요</p>
              </div>
            ) : (
              <>
                {/* 취소 사유 */}
                <p className="text-[14px] font-bold text-gray-900 mb-2">취소 사유</p>
                <div className="space-y-2 mb-4">
                  {CANCEL_REASONS.map((reason) => (
                    <button
                      key={reason}
                      onClick={() => setCancelReason(reason)}
                      className={`w-full text-left px-4 py-3 text-[14px] border transition-colors ${
                        cancelReason === reason
                          ? 'border-[#2B313D] bg-gray-50 text-gray-900 font-medium'
                          : 'border-gray-200 text-gray-600'
                      }`}
                      style={{ borderRadius: 10 }}
                    >
                      {reason}
                    </button>
                  ))}
                </div>

                {/* 환불 규정 동의 */}
                <label className="flex items-start gap-3 mb-5 cursor-pointer" onClick={() => setAgreedPolicy(!agreedPolicy)}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${agreedPolicy ? 'bg-[#2B313D] border-[#2B313D]' : 'border-gray-300'}`}>
                    {agreedPolicy && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span className="text-[13px] text-gray-600 leading-relaxed">
                    위 환불 규정을 확인했으며, <span className="font-bold text-gray-900">환불 예정 금액 {refundPolicy.refundAmount.toLocaleString()}원</span>에 동의합니다.
                  </span>
                </label>

                {/* 취소 버튼 */}
                <button
                  onClick={handleCancelConfirm}
                  disabled={!cancelReason || !agreedPolicy}
                  className={`w-full h-[52px] text-[16px] font-bold text-white active:scale-[0.98] transition-all ${
                    cancelReason && agreedPolicy ? 'opacity-100' : 'opacity-40'
                  }`}
                  style={{ backgroundColor: '#EF4444', borderRadius: 14 }}
                >
                  예약 취소하기
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ 취소 완료 모달 ═══ */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ animation: 'modalBgIn 0.2s ease' }}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-sm bg-white p-6 text-center"
            style={{ borderRadius: 20, animation: 'modalScaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={28} className="text-green-500" />
            </div>
            <h3 className="text-[18px] font-bold text-gray-900 mb-1">취소가 완료되었습니다</h3>
            <p className="text-[14px] text-gray-500 mb-1">
              환불 금액: <span className="font-bold text-gray-900">{refundPolicy.refundAmount.toLocaleString()}원</span>
            </p>
            <p className="text-[12px] text-gray-400 mb-5">
              환불은 결제 수단에 따라 3~5영업일 소요될 수 있습니다
            </p>
            <button
              onClick={() => { setShowCompleteModal(false); router.push('/schedule'); }}
              className="w-full h-[48px] text-[15px] font-bold text-white active:scale-[0.98] transition-transform"
              style={{ backgroundColor: '#2B313D', borderRadius: 12 }}
            >
              확인
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes modalBgIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes modalScaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      `}} />
    </div>
  );
}
