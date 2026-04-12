'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function PaymentFailInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get('code');
  const message = searchParams.get('message');

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
        <p className="text-[14px] text-gray-500 mb-1">{message || '결제가 완료되지 않았습니다'}</p>
        {code && <p className="text-[12px] text-gray-400 mb-6">오류 코드: {code}</p>}

        <div className="space-y-2.5 mt-6">
          <button
            onClick={() => router.back()}
            className="w-full bg-gray-900 text-white font-semibold text-[15px] py-3.5 rounded-xl active:scale-[0.97] transition-transform"
          >
            다시 시도하기
          </button>
          <button
            onClick={() => router.push('/main')}
            className="w-full text-gray-400 font-medium text-[14px] py-2"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" /></div>}>
      <PaymentFailInner />
    </Suspense>
  );
}
