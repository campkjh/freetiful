'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';
import { ChevronLeft } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth.store';

type CheckoutStatus = 'idle' | 'ready' | 'loading' | 'error';

const formatKRW = (value: number) => value.toLocaleString('ko-KR') + '원';

export default function CheckoutClient({
  proId,
  amount,
  quotationId,
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
  const [status, setStatus] = useState<CheckoutStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const startedRef = useRef(false);

  const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;

  const startPayment = useCallback(async () => {
    if (status === 'loading') return;
    if (!safeAmount) {
      setStatus('error');
      setErrorMessage('결제 금액이 올바르지 않습니다.');
      return;
    }
    if (!clientKey) {
      setStatus('error');
      setErrorMessage('결제 설정을 확인할 수 없습니다.');
      return;
    }
    if (!authUser?.id) {
      setStatus('error');
      setErrorMessage('로그인 후 결제할 수 있습니다.');
      try { window.dispatchEvent(new Event('freetiful:show-login')); } catch {}
      return;
    }

    setStatus('loading');
    setErrorMessage('');
    try {
      const orderRes = await apiClient.post('/api/v1/payment/order', {
        quotationId: quotationId || undefined,
        amount: safeAmount,
        orderName: '프리티풀 견적 결제',
        proProfileId: proId,
      });
      const order = orderRes.data || {};
      const orderId = order.orderId as string;
      const orderAmount = Number(order.amount || safeAmount);
      const orderName = String(order.orderName || '프리티풀 견적 결제').slice(0, 100);

      const tossPayments = await loadTossPayments(clientKey);
      const payment = tossPayments.payment({
        customerKey: String(authUser.id).slice(0, 50),
      });

      await payment.requestPayment({
        method: 'CARD',
        amount: {
          currency: 'KRW',
          value: orderAmount,
        },
        orderId,
        orderName,
        successUrl: `${window.location.origin}/payment/success?proId=${encodeURIComponent(proId)}`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerName: authUser.name || undefined,
        customerEmail: (authUser as any).email || undefined,
        windowTarget: 'self',
      } as any);
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error?.response?.data?.message || error?.message || '결제를 시작하지 못했습니다.');
    }
  }, [authUser, clientKey, proId, quotationId, safeAmount, status]);

  useEffect(() => {
    if (!authHydrated || startedRef.current) return;
    startedRef.current = true;
    setStatus('ready');
    const timer = window.setTimeout(() => {
      startPayment();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [authHydrated, startPayment]);

  return (
    <main className="min-h-[100dvh] bg-white px-5 pt-safe">
      <div className="mx-auto flex max-w-[420px] flex-col py-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-8 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 active:scale-95"
          aria-label="뒤로가기"
        >
          <ChevronLeft size={24} className="text-gray-700" />
        </button>

        <div className="flex flex-1 flex-col justify-center py-10">
          <p className="text-[13px] font-bold text-[#3180F7]">프리티풀 안전결제</p>
          <h1 className="mt-2 text-[26px] font-extrabold leading-tight text-gray-950">
            견적 결제를<br />진행합니다
          </h1>
          <div className="mt-8 rounded-[22px] bg-gray-50 px-5 py-5">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-gray-500">총 결제금액</span>
              <span className="text-[24px] font-extrabold text-gray-950 tabular-nums">{formatKRW(safeAmount)}</span>
            </div>
          </div>

          {status === 'loading' && (
            <p className="mt-5 text-center text-[14px] font-semibold text-gray-500">결제창을 여는 중입니다...</p>
          )}
          {status === 'error' && (
            <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-[14px] font-semibold leading-6 text-red-500">
              {errorMessage}
            </p>
          )}

          <button
            type="button"
            onClick={startPayment}
            disabled={status === 'loading'}
            className="mt-6 h-14 rounded-2xl bg-[#3180F7] text-[16px] font-bold text-white active:scale-[0.98] disabled:opacity-70"
          >
            {status === 'loading' ? '결제 준비 중' : status === 'error' ? '다시 결제하기' : '결제 진행하기'}
          </button>
        </div>
      </div>
    </main>
  );
}
