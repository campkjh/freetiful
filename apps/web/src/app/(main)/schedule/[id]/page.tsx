'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Clock, MapPin, Phone, MessageCircle, AlertTriangle, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

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

  if (diffDays >= 14) return { rate: 100, refundAmount: price, penalty: 0, label: '행사 14일 전 이상', description: '전액 환불', canCancel: true };
  if (diffDays >= 7) return { rate: 90, refundAmount: Math.round(price * 0.9), penalty: Math.round(price * 0.1), label: '행사 7~13일 전', description: '수수료 제외 환불 (10% 수수료)', canCancel: true };
  if (diffDays >= 1) return { rate: 50, refundAmount: Math.round(price * 0.5), penalty: Math.round(price * 0.5), label: '행사 1~6일 전', description: '50% 환불', canCancel: true };
  return { rate: 0, refundAmount: 0, penalty: price, label: '행사 당일', description: '환불 불가', canCancel: false };
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [apiBooking, setApiBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // id 는 UUID 단독이거나 "paymentUuid__quotationUuid" 형태일 수 있음.
    // UUID 자체에 하이픈을 포함하므로 split('-')[0] 같은 단순 split 은 안전하지 않다.
    const rawId = String(id);
    const composite = rawId.includes('__') ? rawId.split('__') : [rawId];
    const paymentId = composite[0];
    const targetQuotationId = composite[1] || null;
    import('@/lib/api/client').then(({ apiClient }) => {
      apiClient.get(`/api/v1/payment/${paymentId}`)
        .then((res: any) => {
          const p = res.data;
          const qs = Array.isArray(p?.quotations) ? p.quotations : (p?.quotation ? [p.quotation] : []);
          // composite id 의 quotationId 로 정확한 견적을 찾고, 없으면 가장 최신 견적을 사용.
          const q = (targetQuotationId && qs.find((x: any) => x.id === targetQuotationId)) || qs[0] || {};
          const proUser = q.proProfile?.user || {};
          const proImg = q.proProfile?.images?.[0]?.imageUrl || proUser.profileImageUrl || '';
          const eventDate = q.eventDate || p.createdAt;
          const dateStr = new Date(eventDate).toISOString().slice(0, 10);
          const dateFmt = new Date(eventDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
          const eventDateObj = new Date(eventDate);
          const now = new Date();
          const status: 'confirmed' | 'pending' | 'completed' | 'cancelled' =
            p.status === 'refunded' ? 'cancelled'
            : p.status === 'completed' && eventDateObj < now ? 'completed'
            : p.status === 'completed' ? 'confirmed'
            : 'pending';
          setApiBooking({
            proName: proUser.name || '',
            proImage: proImg,
            proPhone: proUser.phone || '',
            category: q.category || q.proProfile?.categories?.[0]?.category?.name || '사회자',
            date: dateFmt,
            eventDate: dateStr,
            time: q.eventTime ? new Date(q.eventTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '',
            location: q.eventLocation || '',
            plan: q.title || p.description || '패키지',
            price: p.amount || 0,
            status,
          });
        })
        .catch(() => { /* 실데이터 없음 → 아래에서 안내 화면으로 떨어뜨림 */ })
        .finally(() => setLoading(false));
    });
  }, [id]);

  const bookingData = apiBooking;
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [bookingStatus, setBookingStatus] = useState<'confirmed' | 'pending' | 'completed' | 'cancelled'>(bookingData?.status || 'pending');
  const [agreedPolicy, setAgreedPolicy] = useState(false);

  useEffect(() => {
    if (bookingData?.status) setBookingStatus(bookingData.status);
  }, [bookingData?.status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (!bookingData) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-3">
        <p className="text-gray-400">예약 정보를 찾을 수 없습니다</p>
        <button onClick={() => router.back()} className="text-[13px] text-blue-500">돌아가기</button>
      </div>
    );
  }

  const booking = { ...bookingData, status: bookingStatus };
  const status = STATUS_MAP[booking.status];
  const pointUsed = 5000;
  const finalPrice = booking.price - pointUsed;
  const refundPolicy = getRefundPolicy(booking.eventDate, finalPrice);

  const CANCEL_REASONS = [
    '일정이 변경되었어요',
    '다른 사회자를 찾았어요',
    '행사가 취소되었어요',
    '사회자와 협의가 안 되었어요',
    '단순 변심이에요',
    '기타',
  ];

  const handleCancelConfirm = async () => {
    if (!cancelReason) { toast.error('취소 사유를 선택해주세요'); return; }
    if (!agreedPolicy) { toast.error('환불 규정에 동의해주세요'); return; }

    try {
      const { apiClient } = await import('@/lib/api/client');
      const paymentId = id.split('-')[0];
      await apiClient.post(`/api/v1/payment/${paymentId}/cancel`, { reason: cancelReason });
      setBookingStatus('cancelled');
      setShowCancelModal(false);
      setShowCompleteModal(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || '취소 처리 중 오류가 발생했습니다';
      toast.error(msg);
    }
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
            {booking.status === 'confirmed' && '사회자가 예약을 확정했어요'}
            {booking.status === 'pending' && '사회자 확인을 기다리고 있어요'}
            {booking.status === 'completed' && '이용이 완료된 예약이에요'}
            {booking.status === 'cancelled' && '예약이 취소되었어요'}
          </span>
        </div>
      </div>

      <div className="h-2 bg-gray-50" />

      {/* 사회자 정보 */}
      <div className="bg-white px-5 py-4">
        <p className="text-[12px] text-gray-400 mb-3">사회자</p>
        <div className="flex items-center gap-3">
          <img src={booking.proImage} alt={booking.proName} className="w-[56px] h-[72px] rounded-xl object-cover shrink-0" />
          <div className="flex-1">
            <p className="text-[18px] font-bold text-gray-900">{booking.category} {booking.proName}</p>
            <p className="text-[13px] text-gray-400 mt-0.5">{booking.plan}</p>
          </div>
        </div>
        {booking.status !== 'cancelled' && (
          <div className="flex gap-2 mt-3 relative z-10">
            {booking.proPhone ? (
              <a href={`tel:${booking.proPhone}`} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-gray-200 text-[13px] font-medium text-gray-700 active:bg-gray-50 transition-colors" style={{ borderRadius: 10 }}>
                <Phone size={14} /> 전화하기
              </a>
            ) : (
              <button
                onClick={() => router.push('/chat')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-gray-200 text-[13px] font-medium text-gray-400 cursor-pointer"
                style={{ borderRadius: 10 }}
                title="전화번호 미등록 — 채팅으로 연결됩니다"
              >
                <Phone size={14} /> 전화하기
              </button>
            )}
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
              ['행사 14일 전', '100% 환불'],
              ['행사 7~13일 전', '수수료 제외 환불'],
              ['행사 1~6일 전', '50% 환불'],
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
                <p className="text-[12px] text-red-400 mt-1">사회자에게 직접 연락해 주세요</p>
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
