'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X, ChevronRight } from 'lucide-react';

const RECOMMENDED = {
  id: '4',
  name: '정다은',
  image: 'https://i.pravatar.cc/300?img=10',
  title: '오늘의 추천 전문가',
};

export default function RecommendedProBar() {
  const [closed, setClosed] = useState(false);

  if (closed) return null;

  return (
    <div
      className="lg:hidden fixed left-0 right-0 z-40 px-4 pointer-events-none"
      style={{ bottom: 'calc(80px + env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-lg mx-auto flex justify-start pointer-events-auto">
        <div className="relative inline-flex">
          <Link
            href={`/pros/${RECOMMENDED.id}`}
            className="flex items-center gap-2.5 bg-black/90 backdrop-blur-xl rounded-full pl-1.5 pr-3 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.18)] active:scale-[0.97] transition-transform"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 shrink-0">
              <img
                src={RECOMMENDED.image}
                alt={RECOMMENDED.name}
                draggable={false}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-[14px] font-semibold text-white whitespace-nowrap pr-1">
              {RECOMMENDED.title}
            </span>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setClosed(true);
              }}
              className="w-6 h-6 rounded-full flex items-center justify-center text-white/70 hover:text-white active:scale-90 transition-all shrink-0"
              aria-label="닫기"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </Link>
          {/* 우측 상단 - 사회자 이름 미니 라벨 */}
          <Link
            href={`/pros/${RECOMMENDED.id}`}
            className="absolute -top-2 right-8 bg-white border border-gray-200/80 rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-gray-700 flex items-center gap-0.5 shadow-sm hover:bg-gray-50 transition-colors"
          >
            사회자 {RECOMMENDED.name}
            <ChevronRight size={10} className="text-gray-400" />
          </Link>
        </div>
      </div>
    </div>
  );
}
