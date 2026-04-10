'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronDown, ChevronRight, HelpCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const planName = searchParams.get('plan') || 'Premium 패키지';
  const price = Number(searchParams.get('price') || '450000');
  const slots = searchParams.get('slots')?.split(',') || ['11:30'];
  const day = searchParams.get('day') || '14';
  const month = searchParams.get('month') || '4';

  const [payMethod, setPayMethod] = useState('bank');
  const [maxDiscount, setMaxDiscount] = useState(true);
  const [agreedCancel, setAgreedCancel] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [checkNoConsult, setCheckNoConsult] = useState(false);
  const [checkPrevious, setCheckPrevious] = useState(false);
  const [showScheduleDetail, setShowScheduleDetail] = useState(false);
  const [usePoints, setUsePoints] = useState(true);

  const pointAmount = 5000;
  const couponAmount = 0;
  const discountAmount = maxDiscount ? pointAmount : 0;
  const finalPrice = price - discountAmount - couponAmount;

  const handlePayment = () => {
    if (!agreedCancel) { toast.error('취소/환불 규정에 동의해주세요'); return; }
    toast.success('결제가 완료되었습니다!');
    setTimeout(() => router.push(`/pros/${id}`), 1500);
  };

  const PAY_METHODS = [
    { id: 'bank', label: '퀵계좌이체', badge: '0.3% 즉시할인' },
    { id: 'card', label: '신용·체크카드' },
    { id: 'npay', label: 'N pay', icon: '🟢' },
    { id: 'kakaopay', label: 'kakao pay', icon: '🟡' },
    { id: 'tosspay', label: 'toss pay', badge: '혜택', icon: '🔵' },
  ];

  return (
    <div className="bg-white min-h-screen pb-36" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-50">
        <div className="flex items-center px-3 h-[52px]">
          <button onClick={() => router.back()} className="p-1.5 active:scale-90 transition-transform">
            <ChevronLeft size={26} className="text-gray-900" />
          </button>
          <h1 className="ml-1 text-[18px] font-bold text-gray-900">결제</h1>
        </div>
      </div>

      {/* ═══ 예약 정보 ═══ */}
      <div className="px-4 pt-6">
        <h2 className="text-[17px] font-bold text-gray-900 mb-3">예약 정보</h2>
        <div className="border border-gray-200 rounded-2xl p-4">
          {/* 선택 서비스 */}
          <p className="text-[12px] text-gray-400 mb-2">선택 서비스</p>
          <div className="flex gap-3 mb-4">
            <div className="w-[80px] h-[80px] rounded-xl bg-gray-100 shrink-0 overflow-hidden">
              <img src={`https://i.pravatar.cc/160?img=45`} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-gray-900">사회자 전해별</p>
              <p className="text-[12px] text-gray-500 mt-0.5">{planName}</p>
              <p className="text-[15px] font-bold text-gray-900 mt-1">{price.toLocaleString()}원 <span className="text-[12px] font-normal text-gray-400 ml-1">1개</span></p>
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* 예약자 */}
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-[12px] text-gray-400 mb-0.5">예약자</p>
              <p className="text-[14px] font-medium text-gray-900">김정훈 / 010-9433-5674</p>
            </div>
            <button className="px-3 h-[30px] border border-gray-200 rounded-lg text-[12px] font-medium text-gray-700">변경</button>
          </div>

          <div className="h-px bg-gray-100" />

          {/* 희망 예약 일정 */}
          <div className="py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] text-gray-400 mb-0.5">희망 예약 일정</p>
                <p className="text-[14px] font-medium text-gray-900">
                  1순위: 2026. {month}. {day} (화) 오전 {slots[0]}
                </p>
              </div>
              <button
                onClick={() => setShowScheduleDetail(!showScheduleDetail)}
                className="flex items-center gap-1 text-[12px] text-gray-400"
              >
                더보기
                <ChevronDown size={14} className={`transition-transform ${showScheduleDetail ? 'rotate-180' : ''}`} />
              </button>
            </div>
            {showScheduleDetail && slots.length > 1 && (
              <div className="mt-2 space-y-1">
                {slots.slice(1).map((s, i) => (
                  <p key={i} className="text-[13px] text-gray-600 pl-0.5">{i + 2}순위: 2026. {month}. {day} (화) 오전 {s}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ 할인 ═══ */}
      <div className="px-4 pt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[17px] font-bold text-gray-900">할인</h2>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-gray-500">최대 할인 적용</span>
            <button
              onClick={() => setMaxDiscount(!maxDiscount)}
              className={`w-[44px] h-[24px] rounded-full transition-colors ${maxDiscount ? 'bg-[#3180F7]' : 'bg-gray-200'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${maxDiscount ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
            </button>
          </div>
        </div>

        <div className="border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
            <div className="flex items-center gap-1">
              <span className="text-[13px] text-gray-600">최대 할인 가능 금액</span>
              <HelpCircle size={13} className="text-gray-300" />
            </div>
            <span className="text-[14px] font-bold text-gray-900">- {pointAmount.toLocaleString()}원</span>
          </div>

          <div className="px-4 py-3 border-t border-gray-100">
            <p className="text-[12px] text-gray-500 mb-2">쿠폰</p>
            <button className="w-full flex items-center justify-between px-3 h-[40px] border border-gray-200 rounded-xl text-[13px] text-gray-400">
              사용할 수 있는 쿠폰이 없어요
              <ChevronRight size={16} className="text-gray-300" />
            </button>
          </div>

          <div className="px-4 py-3 border-t border-gray-100">
            <p className="text-[12px] text-gray-500 mb-2">포인트</p>
            <div className="flex items-center justify-between px-3 h-[40px] border border-gray-200 rounded-xl">
              <span className="text-[13px] text-gray-700">사용</span>
              {usePoints ? (
                <button onClick={() => setUsePoints(false)} className="flex items-center gap-1 text-[14px] font-bold text-[#3180F7]">
                  -{pointAmount.toLocaleString()} P
                  <X size={14} className="text-gray-400" />
                </button>
              ) : (
                <button onClick={() => setUsePoints(true)} className="text-[13px] text-gray-400">적용하기</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 결제 수단 ═══ */}
      <div className="px-4 pt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[17px] font-bold text-gray-900">결제 수단</h2>
          <span className="text-[13px] font-bold text-[#3180F7]">필수</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {PAY_METHODS.map((m) => (
            <button
              key={m.id}
              onClick={() => setPayMethod(m.id)}
              className={`relative h-[52px] rounded-xl border text-[13px] font-medium flex items-center justify-center transition-all active:scale-95 ${
                payMethod === m.id
                  ? 'border-gray-900 text-gray-900 bg-white'
                  : 'border-gray-200 text-gray-600 bg-white'
              }`}
            >
              {m.badge && (
                <span className="absolute -top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#3180F7] text-white">{m.badge}</span>
              )}
              {m.label}
            </button>
          ))}
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mt-3">
          <p className="text-[12px] font-bold text-gray-700">퀵계좌이체 안내</p>
          <p className="text-[11px] text-gray-500 mt-1">• 결제 금액 상관 없이 0.3% 즉시 할인</p>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">퀵계좌이체 · 결제 시 0.3% 즉시할인</p>
        <p className="text-[11px] text-gray-500">신용카드 무이자 할부 안내 &gt;</p>
      </div>

      {/* ═══ 결제 금액 ═══ */}
      <div className="px-4 pt-8">
        <h2 className="text-[17px] font-bold text-gray-900 mb-3">결제 금액</h2>
        <div className="border border-gray-200 rounded-2xl p-4">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[13px] text-gray-600">서비스 금액</span>
            <span className="text-[14px] font-medium text-gray-900">{price.toLocaleString()} 원</span>
          </div>
          {couponAmount > 0 && (
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[13px] text-gray-600">쿠폰 사용 금액</span>
              <span className="text-[14px] font-medium text-gray-900">{couponAmount.toLocaleString()} 원</span>
            </div>
          )}
          {usePoints && (
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[13px] text-gray-600">포인트 사용 금액</span>
              <span className="text-[14px] font-medium text-[#3180F7]">- {pointAmount.toLocaleString()} 원</span>
            </div>
          )}

          <div className="h-px bg-gray-200 my-2" />

          <div className="flex items-center justify-between py-1.5">
            <span className="text-[14px] font-bold text-gray-900">총 결제 금액 <span className="font-normal text-gray-400">(VAT포함)</span></span>
            <span className="text-[18px] font-bold text-gray-900">{finalPrice.toLocaleString()} 원</span>
          </div>

          <div className="flex items-center justify-between px-3 h-[36px] bg-gray-100 rounded-lg mt-2">
            <span className="text-[12px] text-gray-500">예상 적립 포인트</span>
            <div className="flex items-center gap-1">
              <span className="text-[13px] font-bold text-gray-700">8,000 P</span>
              <ChevronDown size={14} className="text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 전달할 내용 ═══ */}
      <div className="px-4 pt-8">
        <h2 className="text-[17px] font-bold text-gray-900 mb-3">사회자에 전달할 내용</h2>
        <div className="border border-gray-200 rounded-2xl p-4 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${checkNoConsult ? 'bg-[#2B313D] border-[#2B313D]' : 'border-gray-300'}`}>
              {checkNoConsult && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <span className="text-[14px] text-gray-700">사전 미팅 없이 바로 진행하고 싶어요</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer" onClick={() => setCheckPrevious(!checkPrevious)}>
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${checkPrevious ? 'bg-[#2B313D] border-[#2B313D]' : 'border-gray-300'}`}>
              {checkPrevious && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <span className="text-[14px] text-gray-700">이 사회자와 이전에 행사를 진행한 적이 있어요</span>
          </label>
        </div>
      </div>

      {/* ═══ 취소/환불 규정 ═══ */}
      <div className="px-4 pt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[17px] font-bold text-gray-900">취소/환불 규정</h2>
          <span className="text-[13px] font-bold text-[#3180F7]">필수</span>
        </div>
        <div className="border border-gray-200 rounded-2xl p-4">
          <p className="text-[13px] text-gray-700 leading-relaxed">
            <span className="font-bold text-[#3180F7]">행사 3일 전까지</span> 앱에서 취소하면 100% 환불돼요. 당일 취소는 사회자에 직접 연락해 주세요.
          </p>
          <p className="text-[12px] text-gray-400 underline mt-2">결제 취소 정책 전문</p>
          <label className="flex items-center gap-3 mt-4 cursor-pointer" onClick={() => setAgreedCancel(!agreedCancel)}>
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${agreedCancel ? 'bg-[#2B313D] border-[#2B313D]' : 'border-gray-300'}`}>
              {agreedCancel && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <span className="text-[14px] text-gray-700">확인했어요</span>
          </label>
        </div>
      </div>

      {/* ═══ 개인정보 동의 ═══ */}
      <div className="px-4 pt-6 pb-4">
        <div className="h-px bg-gray-100 mb-4" />
        <button className="flex items-center justify-between w-full py-2">
          <div>
            <p className="text-[13px] text-gray-700">서비스 이용에 관한 개인정보 수집 동의</p>
            <p className="text-[11px] text-gray-400">(개인정보 및 민감정보 수집 이용, 개인정보 제3자 제공 동의)</p>
          </div>
          <ChevronDown size={18} className="text-gray-400" />
        </button>
        <p className="text-[10px] text-gray-400 leading-relaxed mt-2">
          프리티풀은 고객 편의를 위해 예약·앱에서결제 기능을 제공하며, 이 기능에 대해 전문가로부터 대가를 받지 않습니다. 거래의 당사자는 고객과 사회자이며, 프리티풀은 이를 중개하지 않습니다. 위 내용을 확인하였으며, 결제에 동의합니다.
        </p>
      </div>

      {/* ═══ 하단 고정 ═══ */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 px-4 pt-3 pb-safe">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[14px] font-bold text-gray-900">총 결제 금액</span>
          <div className="flex items-baseline gap-2">
            {discountAmount > 0 && (
              <span className="text-[13px] text-gray-400 line-through">{price.toLocaleString()}원</span>
            )}
            <span className="text-[22px] font-bold text-gray-900">{finalPrice.toLocaleString()}원</span>
          </div>
        </div>
        <button
          onClick={handlePayment}
          className="w-full h-[52px] rounded-2xl text-[16px] font-bold text-white bg-[#3180F7] active:scale-[0.98] transition-transform"
        >
          결제하기
        </button>
      </div>
    </div>
  );
}
