'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';

function PaymentSuccessInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [chatRoomId, setChatRoomId] = useState<string | null>(null);

  const paymentKey = searchParams.get('paymentKey');
  const orderId = searchParams.get('orderId');
  const amount = searchParams.get('amount');
  const proId = searchParams.get('proId');

  useEffect(() => {
    if (!paymentKey || !orderId || !amount) {
      setStatus('error');
      setErrorMessage('결제 정보가 올바르지 않습니다.');
      return;
    }

    // 결제 승인 요청
    apiClient.post('/api/v1/payment/confirm', {
      paymentKey,
      orderId,
      amount: Number(amount),
    })
      .then((res: any) => {
        setStatus('success');
        const cid = res?.data?.chatRoomId;
        if (cid) {
          setChatRoomId(cid);
          // 1.2초 후 채팅방으로 자동 이동
          setTimeout(() => { router.replace(`/chat/${cid}`); }, 1200);
        }
      })
      .catch((e) => {
        setStatus('error');
        setErrorMessage(e.response?.data?.message || '결제 승인에 실패했습니다.');
      });
  }, [paymentKey, orderId, amount, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[16px] font-bold text-gray-900">결제 승인 중...</p>
          <p className="text-[13px] text-gray-400 mt-1">잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="#FEE2E2" />
              <path d="M15 9l-6 6M9 9l6 6" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-[20px] font-bold text-gray-900 mb-2">결제 실패</h1>
          <p className="text-[14px] text-gray-500 mb-6">{errorMessage}</p>
          <button onClick={() => router.back()} className="bg-gray-900 text-white font-semibold text-[14px] px-6 py-3 rounded-xl">
            다시 시도하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#DCFCE7" />
            <path d="M8 12l3 3 5-5" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-[22px] font-bold text-gray-900 mb-1">결제 완료!</h1>
        <p className="text-[14px] text-gray-500 mb-2">스케줄이 등록되었습니다 · 프로의 수락을 기다려주세요</p>
        <p className="text-[13px] text-gray-400 mb-8">주문번호: {orderId}</p>

        <div className="space-y-2.5">
          {chatRoomId ? (
            <Link
              href={`/chat/${chatRoomId}`}
              className="block w-full bg-[#3180F7] text-white font-semibold text-[15px] py-3.5 rounded-xl active:scale-[0.97] transition-transform"
            >
              채팅으로 돌아가기
            </Link>
          ) : (
            <Link
              href="/chat"
              className="block w-full bg-[#3180F7] text-white font-semibold text-[15px] py-3.5 rounded-xl active:scale-[0.97] transition-transform"
            >
              채팅 목록으로
            </Link>
          )}
          <Link
            href="/main"
            className="block w-full text-gray-400 font-medium text-[14px] py-2"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" /></div>}>
      <PaymentSuccessInner />
    </Suspense>
  );
}
