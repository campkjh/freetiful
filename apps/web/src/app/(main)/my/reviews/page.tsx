'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export default function ReviewsPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-100 bg-white/80 backdrop-blur-xl px-4 py-3">
        <button onClick={() => router.back()} className="p-1"><ChevronLeft size={24} /></button>
        <h1 className="text-[17px] font-semibold">내 리뷰 관리</h1>
      </header>
      <div className="flex items-center justify-center h-[60vh] text-gray-400 text-[15px]">
        리뷰가 없습니다
      </div>
    </div>
  );
}
