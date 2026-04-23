'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Check } from 'lucide-react';

export default function BizCompletePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 헤더 */}
      <header className="fixed top-0 left-0 right-0 z-50 h-[56px] flex items-center px-4 bg-white/90 backdrop-blur-xl border-b border-gray-100/60">
        <Link
          href="/biz"
          className="flex items-center gap-1 text-[14px] font-medium text-gray-700 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft size={20} />
          <span>홈으로</span>
        </Link>
      </header>

      {/* 본문 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-[56px] pb-12">
        {/* 체크 아이콘 */}
        <div
          className="relative w-24 h-24 rounded-full flex items-center justify-center mb-8"
          style={{
            background: 'linear-gradient(135deg, #3B82F6, #2563EB, #1D4ED8)',
            animation: 'checkPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <Check size={48} strokeWidth={3} className="text-white" />
          <div className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />
        </div>

        {/* 타이틀 */}
        <h1 className="text-[26px] font-black text-gray-900 tracking-tight mb-3 text-center">
          접수가 완료되었습니다
        </h1>

        {/* 서브 텍스트 */}
        <p className="text-[15px] text-gray-500 leading-relaxed text-center max-w-sm">
          프리티풀 전문 매니저가<br />
          곧 연락드리겠습니다.
        </p>

        {/* 홈으로 버튼 */}
        <button
          onClick={() => router.push('/biz')}
          className="mt-12 px-10 py-3.5 bg-gray-900 text-white text-[14px] font-bold rounded-full hover:bg-gray-800 active:scale-95 transition-all"
        >
          비즈 홈으로 이동
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes checkPop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}} />
    </div>
  );
}
