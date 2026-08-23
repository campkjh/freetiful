'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';
import { ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api/client';
import { discoveryApi } from '@/lib/api/discovery.api';
import { useAuthStore } from '@/lib/store/auth.store';
import { getWeddingPlanTemplate, normalizeWeddingPlanKey } from '@/lib/wedding-plans';

const formatKRW = (value: number) => value.toLocaleString('ko-KR') + '원';

/** 입력 중 자동 하이픈 — 010-1234-5678 */
const formatPhone = (raw: string) => {
  const d = raw.replace(/[^0-9]/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
};
const phoneDigits = (raw: string) => raw.replace(/[^0-9]/g, '');
const isValidPhone = (raw: string) => /^01[016789][0-9]{7,8}$/.test(phoneDigits(raw));

export default function CheckoutClient({
  proId,
  amount,
  quotationId,
  plan,
  clientKey,
}: {
  proId: string;
  amount: number;
  quotationId: string;
  plan: string;
  clientKey: string;
}) {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const authHydrated = useAuthStore((s) => s.hasHydrated);
  const [pro, setPro] = useState<any>(null);
  const [quoteDetail, setQuoteDetail] = useState<any>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [widgetsReady, setWidgetsReady] = useState(false);
  // 결제 시 받는 고객 연락처 — 정산·환불 안내에 쓰이므로 필수
  const [phone, setPhone] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const widgetsRef = useRef<any>(null);
  const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  const finalAmount = Number(quoteDetail?.amount || safeAmount || 0);
  // 견적 금액 = 공급가액. 실제 결제는 부가세(10%) 포함 총액으로 진행. (예: 30만 → 33만)
  const VAT_RATE = 0.1;
  const supplyAmount = Math.max(0, finalAmount);
  const vatAmount = Math.round(supplyAmount * VAT_RATE);
  const displayAmount = supplyAmount + vatAmount; // 부가세 포함 총 결제금액(위젯·주문·표시 공통)
  const proName = pro?.user?.name || pro?.name || '사회자';
  // plan 은 'premium' 같은 원본 키라 그대로 두면 소문자 영문이 그대로 보인다
  const planLabel = getWeddingPlanTemplate(normalizeWeddingPlanKey(plan))?.label
    || (plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : '');
  const planName = quoteDetail?.title || planLabel || '견적 결제';
  const orderName = useMemo(() => `${proName} 사회자 - ${planName}`.slice(0, 100), [planName, proName]);

  useEffect(() => {
    if (!proId) return;
    let alive = true;
    discoveryApi.getProDetail(proId)
      .then((data) => { if (alive) setPro(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [proId]);

  // 계정에 등록된 번호가 있으면 미리 채워둔다(대부분 그대로 결제 → 입력 부담 없음)
  useEffect(() => {
    if (!authHydrated) return;
    const saved = (authUser as any)?.phone;
    if (saved && !phone) setPhone(formatPhone(String(saved)));
  }, [authHydrated, authUser, phone]);

  useEffect(() => {
    if (!quotationId) return;
    let alive = true;
    apiClient.get(`/api/v1/quotation/${quotationId}`)
      .then((res) => { if (alive) setQuoteDetail(res.data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [quotationId]);

  useEffect(() => {
    if (!clientKey || !authHydrated || widgetsRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const tossPayments = await loadTossPayments(clientKey);
        const customerKey = authUser?.id
          ? String(authUser.id).slice(0, 50)
          : `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const widgets = (tossPayments as any).widgets({ customerKey });
        if (cancelled) return;
        widgetsRef.current = widgets;
        await widgets.setAmount({ currency: 'KRW', value: Math.max(100, displayAmount) });
        await Promise.all([
          widgets.renderPaymentMethods({ selector: '#toss-payment-methods', variantKey: 'DEFAULT' }),
          widgets.renderAgreement({ selector: '#toss-agreement', variantKey: 'AGREEMENT' }),
        ]);
        if (!cancelled) setWidgetsReady(true);
      } catch (error) {
        console.error('[toss widgets init]', error);
        if (!cancelled) toast.error('결제창을 불러오지 못했습니다');
      }
    })();
    return () => { cancelled = true; };
  }, [authHydrated, authUser?.id, clientKey, displayAmount]);

  useEffect(() => {
    if (!widgetsRef.current || !widgetsReady) return;
    widgetsRef.current.setAmount({ currency: 'KRW', value: Math.max(100, displayAmount) }).catch(() => {});
  }, [displayAmount, widgetsReady]);

  const startPayment = useCallback(async () => {
    if (payLoading) return;
    if (!displayAmount) {
      toast.error('결제 금액이 올바르지 않습니다');
      return;
    }
    if (!clientKey) {
      toast.error('결제 설정을 확인할 수 없습니다');
      return;
    }
    if (!authUser?.id) {
      try { window.dispatchEvent(new Event('freetiful:show-login')); } catch {}
      toast.error('로그인 후 결제할 수 있습니다');
      return;
    }
    if (!widgetsRef.current || !widgetsReady) {
      toast.error('결제창 초기화 중입니다. 잠시 후 다시 시도해주세요');
      return;
    }
    if (!isValidPhone(phone)) {
      setPhoneTouched(true);
      toast.error('연락받으실 휴대폰번호를 입력해주세요');
      document.getElementById('customer-phone')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (document.getElementById('customer-phone') as HTMLInputElement | null)?.focus();
      return;
    }

    setPayLoading(true);
    try {
      const orderRes = await apiClient.post('/api/v1/payment/order', {
        quotationId: quotationId || undefined,
        amount: displayAmount,
        orderName,
        proProfileId: proId,
        customerPhone: phoneDigits(phone),
      });
      const order = orderRes.data || {};
      const orderId = order.orderId as string;
      await widgetsRef.current.requestPayment({
        orderId,
        orderName: String(order.orderName || orderName).slice(0, 100),
        successUrl: `${window.location.origin}/payment/success?proId=${encodeURIComponent(proId)}`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerName: authUser.name || undefined,
        customerEmail: (authUser as any).email || undefined,
        // 가상계좌 입금 안내 문자 등 토스 쪽 안내에도 쓰인다
        customerMobilePhone: phoneDigits(phone) || undefined,
      });
    } catch (error: any) {
      const code = error?.code;
      const message = error?.response?.data?.message || error?.message || '결제를 시작하지 못했습니다';
      if (code === 'USER_CANCEL') toast('결제가 취소되었습니다');
      else toast.error(message);
    } finally {
      setPayLoading(false);
    }
    // phone 이 빠지면 stale closure 로 예전(빈) 번호가 전송된다
  }, [authUser, clientKey, displayAmount, orderName, payLoading, phone, proId, quotationId, widgetsReady]);

  return (
    <main className="min-h-[100dvh] bg-white px-5 pb-32 pt-safe">
      <div className="mx-auto flex max-w-[480px] flex-col py-4">
        <button
          type="button"
          data-native-back-header
          onClick={() => router.back()}
          className="-ml-2 mb-5 flex h-10 w-10 items-center justify-center rounded-full text-[#2B313D] transition-colors active:bg-[#F2F3F5]"
          aria-label="뒤로가기"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="pb-8">
          <p className="text-[13px] font-bold text-[#3180F7]">프리티풀 안전결제</p>
          <h1 className="mt-1.5 text-[24px] font-bold leading-tight text-[#2B313D]">견적 결제</h1>
          <p className="mt-1.5 text-[13px] leading-[1.7] text-[#8B95A1]">
            행사 진행이 끝난 뒤 대금이 사회자에게 전달됩니다.
          </p>

          <section className="mt-6 rounded-[24px] border-[0.6px] border-[#F1F3F6] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <p className="text-[13px] font-bold text-[#A4ABBA]">선택 서비스</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-14 w-14 overflow-hidden rounded-[18px] bg-[#F2F3F5]">
                <img
                  src={pro?.images?.[0]?.imageUrl || pro?.user?.profileImageUrl || '/images/default-profile.png'}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => { e.currentTarget.src = '/images/default-profile.png'; }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-bold text-[#2B313D]">{proName}</p>
                <p className="mt-0.5 truncate text-[13px] font-medium text-[#8B95A1]">{planName}</p>
              </div>
            </div>
          </section>

          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[17px] font-bold text-[#2B313D]">연락처</h2>
              <span className="text-[13px] font-bold text-[#3180F7]">필수</span>
            </div>
            <input
              id="customer-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              onBlur={() => setPhoneTouched(true)}
              placeholder="010-1234-5678"
              aria-label="휴대폰번호"
              className={`h-14 w-full rounded-[14px] px-4 text-[16px] font-medium text-[#2B313D] outline-none transition-colors placeholder:font-normal placeholder:text-[#A4ABBA] ${
                phoneTouched && !isValidPhone(phone)
                  ? 'bg-[#FFF0F0] ring-1 ring-[#E5484D]'
                  : 'bg-[#F2F3F5] focus:bg-[#EDEFF2]'
              }`}
            />
            <p className={`mt-2 text-[13px] font-medium ${phoneTouched && !isValidPhone(phone) ? 'text-[#E5484D]' : 'text-[#A4ABBA]'}`}>
              {phoneTouched && !isValidPhone(phone)
                ? '휴대폰번호를 정확히 입력해주세요'
                : '결제·환불 안내와 행사 확인을 위해 사용됩니다'}
            </p>
          </section>

          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[17px] font-bold text-[#2B313D]">결제 수단</h2>
              <span className="text-[13px] font-bold text-[#3180F7]">필수</span>
            </div>
            <div id="toss-payment-methods" />
            <div id="toss-agreement" className="mt-3" />
            {!widgetsReady && (
              <div className="mt-3 rounded-[16px] bg-[#F7F8FA] px-4 py-5 text-center text-[13px] font-semibold text-[#A4ABBA]">
                결제창을 불러오는 중입니다...
              </div>
            )}
          </section>

          <section className="mt-6 rounded-[24px] border-[0.6px] border-[#F1F3F6] bg-white px-5 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between text-[14px] text-[#8B95A1]">
              <span>공급가액</span>
              <span className="tabular-nums">{formatKRW(supplyAmount)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[14px] text-[#8B95A1]">
              <span>부가세 (10%)</span>
              <span className="tabular-nums">{formatKRW(vatAmount)}</span>
            </div>
            <div className="mt-3.5 flex items-center justify-between border-t border-[#F2F4F7] pt-3.5">
              <span className="text-[15px] font-bold text-[#2B313D]">총 결제금액</span>
              <span className="text-[24px] font-bold tabular-nums text-[#2B313D]">{formatKRW(displayAmount)}</span>
            </div>
          </section>

          <button
            type="button"
            onClick={startPayment}
            disabled={payLoading || !widgetsReady}
            className="fixed bottom-0 left-0 right-0 z-40 mx-auto h-[80px] max-w-[480px] bg-white px-5 pb-safe pt-3 disabled:opacity-70"
          >
            <span className="flex h-[52px] items-center justify-center rounded-[14px] bg-[#3180F7] text-[16px] font-bold text-white transition-transform active:scale-[0.99]">
              {payLoading ? '결제 진행 중...' : `${formatKRW(displayAmount)} 결제하기`}
            </span>
          </button>
        </div>
      </div>
    </main>
  );
}
