'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronDown, ChevronRight, HelpCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/auth.store';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';
import { apiClient } from '@/lib/api/client';
import { discoveryApi } from '@/lib/api/discovery.api';

const PRO_NAMES: Record<string, { name: string; image: string }> = {
  '1': { name: '강도현', image: '/images/pro-01/10000133881772850005043.avif' },
  '2': { name: '김동현', image: '/images/pro-02/10000365351773046135169.avif' },
  '3': { name: '김민지', image: '/images/pro-03/IMG_06781773894450803.avif' },
  '4': { name: '김솔', image: '/images/pro-04/IMG_23601771788594274.avif' },
  '5': { name: '김유석', image: '/images/pro-05/10000029811773033474612.avif' },
  '6': { name: '김재성', image: '/images/pro-06/10000602271772960706687.avif' },
  '7': { name: '김진아', image: '/images/pro-07/IMG_53011772965035335.avif' },
  '8': { name: '김호중', image: '/images/pro-08/0DBA6E02-BBC8-4660-8464-5B5162FAD2461773045822216.avif' },
  '9': { name: '나연지', image: '/images/pro-09/Facetune_10-02-2026-21-07-511772438130235.avif' },
  '10': { name: '노유재', image: '/images/pro-10/10000016211774440274171.avif' },
  '11': { name: '도준석', image: '/images/pro-11/1-1231772850030951.avif' },
  '12': { name: '문정은', image: '/images/pro-12/IMG_27221772621229571.avif' },
  '13': { name: '박상설', image: '/images/pro-13/10000077391773050357628.avif' },
  '14': { name: '박은결', image: '/images/pro-14/IMG_02661773035503788.avif' },
  '15': { name: '박인애', image: '/images/pro-15/IMG_0196.avif' },
  '16': { name: '박주은', image: '/images/pro-16/IMG_01621772973118334.avif' },
  '17': { name: '배유정', image: '/images/pro-17/IMG_21541773026472716.avif' },
  '18': { name: '성연채', image: '/images/pro-18/20161016_161406_IMG_5921.avif' },
  '19': { name: '송지은', image: '/images/pro-19/DE397232-C3A6-4FD0-80C8-0251D66A66AF1772092441240.avif' },
  '20': { name: '유하늘', image: '/images/pro-20/D54BC1BA-3BF2-4827-AA76-096D4056BCDB1773030157943.avif' },
  '21': { name: '유하영', image: '/images/pro-21/22712e20f03327c2843673c063c881f432f6af591772967031477.avif' },
  '22': { name: '이강문', image: '/images/pro-22/10000353831773035180593.avif' },
  '23': { name: '이승진', image: '/images/pro-23/IMG_46511771924269213.avif' },
  '24': { name: '이용석', image: '/images/pro-24/10001176941772847263491.avif' },
  '25': { name: '이우영', image: '/images/pro-25/2-11772248201484.avif' },
  '26': { name: '이원영', image: '/images/pro-26/1-1231772531708677.avif' },
  '27': { name: '이재원', image: '/images/pro-27/17230390916981773388202648.avif' },
  '28': { name: '이한나', image: '/images/pro-28/IMG_002209_01772081523241.avif' },
  '29': { name: '임하람', image: '/images/pro-29/10000118841772968813129.avif' },
  '30': { name: '장윤영', image: '/images/pro-30/IMG_27051772976548211.avif' },
  '31': { name: '전해별', image: '/images/pro-31/025209A2-09A8-4777-9A6A-DF4751F560A71772850104015.avif' },
  '32': { name: '전혜인', image: '/images/pro-32/IMG_19181773027236141.avif' },
  '33': { name: '정미정', image: '/images/pro-33/0533d0a3d5f361ad511e32dafb775319b26ce7541772100346528.avif' },
  '34': { name: '정애란', image: '/images/pro-34/IMG_2920.avif' },
  '35': { name: '정이현', image: '/images/pro-35/44561772622988798.avif' },
  '36': { name: '조하늘', image: '/images/pro-36/IMG_27041773036338469.avif' },
  '37': { name: '최진선', image: '/images/pro-37/10001059551772371340253.avif' },
  '38': { name: '한가람', image: '/images/pro-38/IMG_34281772111635068.avif' },
  '39': { name: '함현지', image: '/images/pro-39/11773004544652.avif' },
  '40': { name: '허수빈', image: '/images/pro-40/IMG_01991772961130928.avif' },
  '41': { name: '홍현미', image: '/images/pro-41/IMG_12201772513865121.avif' },
};

export default function CheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fallbackInfo = PRO_NAMES[id || ''] || { name: '사회자', image: '' };
  const [pro, setPro] = useState<any>(null);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    discoveryApi
      .getProDetail(id)
      .then((data) => { if (alive) setPro(data); })
      .catch(() => { /* fallback */ });
    return () => { alive = false; };
  }, [id]);
  const proInfo = {
    name: pro?.name || fallbackInfo.name,
    image: pro?.images?.[0] || pro?.profileImageUrl || fallbackInfo.image,
  };

  const planName = searchParams.get('plan') || 'Premium 패키지';
  const price = Number(searchParams.get('price') || '450000');
  const slots = searchParams.get('slots')?.split(',') || ['11:30'];
  const day = searchParams.get('day') || '14';
  const month = searchParams.get('month') || '4';

  const authUser = useAuthStore((s) => s.user);
  const [bookerInfo, setBookerInfo] = useState('');
  useEffect(() => {
    try {
      const name = authUser?.name || JSON.parse(localStorage.getItem('freetiful-user') || '{}').name || '';
      const phone = authUser?.phone || JSON.parse(localStorage.getItem('freetiful-user') || '{}').phone || '';
      setBookerInfo(name && phone ? `${name} / ${phone}` : name || phone || '');
    } catch { /* ignore */ }
  }, [authUser]);

  const [maxDiscount, setMaxDiscount] = useState(true);
  const [agreedCancel, setAgreedCancel] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [checkNoConsult, setCheckNoConsult] = useState(false);
  const [checkPrevious, setCheckPrevious] = useState(false);
  const [showScheduleDetail, setShowScheduleDetail] = useState(false);
  const [showPrivacyDetail, setShowPrivacyDetail] = useState(false);
  const [usePoints, setUsePoints] = useState(true);

  const pointAmount = 5000;
  const couponAmount = 0;
  const discountAmount = maxDiscount ? pointAmount : 0;
  // Toss 최소 결제 금액 100원 보장 — 할인으로 음수가 되지 않도록 clamp
  const finalPrice = Math.max(100, price - discountAmount - couponAmount);

  const [payLoading, setPayLoading] = useState(false);
  const widgetsRef = useRef<any>(null);
  const [widgetsReady, setWidgetsReady] = useState(false);

  // Toss 결제위젯 초기화 (gck_ 키는 widgets API 전용)
  useEffect(() => {
    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
    if (!clientKey) return;
    let cancelled = false;
    (async () => {
      try {
        const tossPayments = await loadTossPayments(clientKey);
        const customerKey = authUser?.id || `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const widgets = (tossPayments as any).widgets({ customerKey });
        if (cancelled) return;
        widgetsRef.current = widgets;
        await widgets.setAmount({ currency: 'KRW', value: finalPrice });
        await Promise.all([
          widgets.renderPaymentMethods({ selector: '#toss-payment-methods', variantKey: 'DEFAULT' }),
          widgets.renderAgreement({ selector: '#toss-agreement', variantKey: 'AGREEMENT' }),
        ]);
        setWidgetsReady(true);
      } catch (e) {
        console.error('[toss widgets init]', e);
      }
    })();
    return () => { cancelled = true; };
  }, [authUser?.id]);

  // 금액 변경 시 위젯 setAmount 재호출
  useEffect(() => {
    if (widgetsRef.current && widgetsReady) {
      widgetsRef.current.setAmount({ currency: 'KRW', value: finalPrice }).catch(() => {});
    }
  }, [finalPrice, widgetsReady]);
  const [consented, setConsented] = useState(false);
  const [buttonPulse, setButtonPulse] = useState(false);

  const handleConsent = () => {
    setAgreedCancel(true);
    setAgreedPrivacy(true);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    setButtonPulse(true);
    setTimeout(() => {
      setConsented(true);
      setTimeout(() => setButtonPulse(false), 500);
    }, 150);
  };

  const handlePayment = async () => {
    if (!agreedCancel) { toast.error('취소/환불 규정에 동의해주세요'); return; }
    if (!agreedPrivacy) { toast.error('개인정보 수집에 동의해주세요'); return; }

    setPayLoading(true);
    try {
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!clientKey) {
        alert('결제 설정이 필요합니다: NEXT_PUBLIC_TOSS_CLIENT_KEY 환경 변수 미설정. 관리자에게 문의해 주세요.');
        setPayLoading(false);
        return;
      }

      const orderName = `${proInfo.name} 사회자 - ${planName}`;

      // 1. 주문 생성 — 서버가 orderId 발급 (DB 에 pending Payment 레코드 남김)
      let orderId: string;
      try {
        const { data: order } = await apiClient.post<{ orderId: string }>('/api/v1/payment/order', {
          amount: finalPrice,
          orderName,
          proProfileId: id,
        });
        orderId = order.orderId;
      } catch (e: any) {
        alert('주문 생성에 실패했습니다: ' + (e?.response?.data?.message || e?.message || '알 수 없는 오류'));
        setPayLoading(false);
        return;
      }

      // 2. 토스 위젯으로 결제 요청 — 서버 orderId 사용
      if (!widgetsRef.current) {
        alert('결제 위젯 초기화 중입니다. 잠시 후 다시 시도해 주세요.');
        setPayLoading(false);
        return;
      }
      await widgetsRef.current.requestPayment({
        orderId,
        orderName,
        customerName: authUser?.name || bookerInfo.split('/')[0]?.trim() || '고객',
        customerEmail: authUser?.email || undefined,
        successUrl: `${window.location.origin}/payment/success?proId=${id}`,
        failUrl: `${window.location.origin}/payment/fail`,
      });
    } catch (e: any) {
      // 상세 로그 (Toss 는 code + message 포함)
      console.error('[toss requestPayment]', e);
      const code = e?.code;
      const message = e?.message || '결제 중 오류가 발생했습니다';
      if (code === 'USER_CANCEL') {
        toast('결제가 취소되었습니다', { icon: '🔙' });
      } else if (code) {
        alert(`결제 실패\n[${code}] ${message}`);
      } else {
        toast.error(message);
      }
    } finally {
      setPayLoading(false);
    }
  };


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
              <img src={proInfo.image} alt={proInfo.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-gray-900">사회자 {proInfo.name}</p>
              <p className="text-[12px] text-gray-500 mt-0.5">{planName}</p>
              <p className="text-[15px] font-bold text-gray-900 mt-1">{price.toLocaleString()}원 <span className="text-[12px] font-normal text-gray-400 ml-1">1개</span></p>
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* 예약자 */}
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-[12px] text-gray-400 mb-0.5">예약자</p>
              <p className="text-[14px] font-medium text-gray-900">{bookerInfo}</p>
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

        {/* Toss 결제위젯: 결제수단 UI 가 여기에 렌더링됨 */}
        <div id="toss-payment-methods" />
        {/* Toss 약관 위젯 */}
        <div id="toss-agreement" className="mt-3" />
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
          <label className="flex items-center gap-3 cursor-pointer" onClick={() => setCheckNoConsult(!checkNoConsult)}>
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
      <div className="px-4 pt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[17px] font-bold text-gray-900">서비스 이용 동의</h2>
          <span className="text-[13px] font-bold text-[#3180F7]">필수</span>
        </div>
        <div className="border border-gray-200 rounded-2xl p-4">
          <button
            type="button"
            onClick={() => setShowPrivacyDetail((v) => !v)}
            className="flex items-center justify-between w-full"
          >
            <div className="text-left">
              <p className="text-[13px] text-gray-700">서비스 이용에 관한 개인정보 수집 동의</p>
              <p className="text-[11px] text-gray-400 mt-0.5">(개인정보 및 민감정보 수집·이용, 개인정보 제3자 제공 동의)</p>
            </div>
            <ChevronDown size={18} className={`text-gray-400 shrink-0 ml-2 transition-transform ${showPrivacyDetail ? 'rotate-180' : ''}`} />
          </button>
          {showPrivacyDetail && (
            <p className="text-[11px] text-gray-500 leading-relaxed mt-3 bg-gray-50 rounded-lg p-3">
              프리티풀은 고객 편의를 위해 예약·결제 기능을 제공하며, 이 기능에 대해 전문가로부터 대가를 받지 않습니다. 거래의 당사자는 고객과 사회자이며, 프리티풀은 이를 중개하지 않습니다. 수집 항목: 이름·연락처·결제정보. 보유 기간: 관련 법령에 따른 보관 기간. 위 내용을 확인하였으며, 결제에 동의합니다.
            </p>
          )}
          <label className="flex items-center gap-3 mt-4 cursor-pointer" onClick={() => setAgreedPrivacy(!agreedPrivacy)}>
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${agreedPrivacy ? 'bg-[#2B313D] border-[#2B313D]' : 'border-gray-300'}`}>
              {agreedPrivacy && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <span className="text-[14px] text-gray-700">위 내용에 동의합니다</span>
          </label>
        </div>
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
          onClick={() => { if (!consented) { handleConsent(); } else { handlePayment(); } }}
          disabled={payLoading}
          style={{ transition: 'background 500ms ease-out, transform 500ms ease-out, box-shadow 500ms ease-out' }}
          className={`w-full h-[52px] rounded-2xl text-[16px] font-bold text-white active:scale-[0.98] disabled:opacity-60 ${
            consented
              ? 'bg-gradient-to-r from-[#1E5FD1] to-[#2B6FE8] shadow-lg shadow-blue-500/30'
              : 'bg-gradient-to-r from-[#3180F7] to-[#5A9BFF]'
          } ${buttonPulse ? 'scale-[1.03]' : 'scale-100'}`}
        >
          {payLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              결제 진행 중...
            </span>
          ) : consented ? (
            `${finalPrice.toLocaleString()}원 결제하기`
          ) : (
            '결제 내용에 동의합니다'
          )}
        </button>
      </div>
    </div>
  );
}
