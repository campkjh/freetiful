'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

const RECOMMENDED = {
  id: '4',
  name: '정다은',
  image: 'https://i.pravatar.cc/300?img=10',
  title: '오늘의 추천 전문가',
};

type Phase = 'collapsed' | 'expanding' | 'expanded' | 'collapsing' | 'closed';

export default function RecommendedProBar() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('collapsed');

  // 처음 진입 시 collapsed → expanding (원 → 알약 펼침)
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('expanding'), 600);
    const t2 = setTimeout(() => setPhase('expanded'), 1300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === 'closed') return null;

  const isExpandedPhase = phase === 'expanding' || phase === 'expanded';

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPhase('collapsing');
    setTimeout(() => setPhase('closed'), 600);
  };

  const handleClick = () => {
    if (phase !== 'expanded') return;
    router.push(`/pros/${RECOMMENDED.id}`);
  };

  return (
    <div
      className="lg:hidden fixed left-0 right-0 z-40 px-4 pointer-events-none"
      style={{ bottom: 'calc(80px + env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-lg mx-auto flex justify-start pointer-events-auto">
        <button
          type="button"
          onClick={handleClick}
          className="relative flex items-center bg-black/90 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.18)] active:scale-[0.97] origin-left"
          style={{
            borderRadius: 9999,
            height: 52,
            width: isExpandedPhase ? 260 : 52,
            paddingLeft: 6,
            paddingRight: isExpandedPhase ? 14 : 6,
            transition:
              phase === 'expanding'
                ? 'width 0.65s cubic-bezier(0.34, 1.56, 0.64, 1), padding 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)'
                : phase === 'collapsing'
                ? 'width 0.5s cubic-bezier(0.7, 0, 0.84, 0), padding 0.5s cubic-bezier(0.7, 0, 0.84, 0), transform 0.5s cubic-bezier(0.7, 0, 0.84, 0), opacity 0.5s ease'
                : 'none',
            transform: phase === 'collapsing' ? 'scale(0.7)' : 'scale(1)',
            opacity: phase === 'collapsing' ? 0 : 1,
            transformOrigin: 'left center',
          }}
        >
          {/* 좌측 - 원형 프로필 */}
          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-700 shrink-0">
            <img
              src={RECOMMENDED.image}
              alt={RECOMMENDED.name}
              draggable={false}
              className="w-full h-full object-cover"
            />
          </div>

          {/* 텍스트 영역 - 알약 펼쳐졌을 때만 표시 */}
          <div
            className="flex-1 ml-2.5 overflow-hidden text-left"
            style={{
              opacity: phase === 'expanded' ? 1 : 0,
              transform: phase === 'expanded' ? 'translateX(0)' : 'translateX(-8px)',
              filter: phase === 'expanded' ? 'blur(0)' : 'blur(4px)',
              transition: 'opacity 0.4s ease 0.15s, transform 0.4s ease 0.15s, filter 0.4s ease 0.15s',
            }}
          >
            <p className="text-[10px] font-semibold text-white/60 leading-tight whitespace-nowrap">
              사회자 {RECOMMENDED.name}
            </p>
            <p className="text-[14px] font-bold text-white leading-tight whitespace-nowrap">
              {RECOMMENDED.title}
            </p>
          </div>

          {/* X 닫기 버튼 */}
          <span
            role="button"
            tabIndex={0}
            onClick={handleClose}
            className="ml-2 w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all shrink-0 cursor-pointer"
            style={{
              opacity: phase === 'expanded' ? 1 : 0,
              transform: phase === 'expanded' ? 'scale(1)' : 'scale(0.5)',
              transition: 'opacity 0.3s ease 0.25s, transform 0.3s ease 0.25s',
              pointerEvents: phase === 'expanded' ? 'auto' : 'none',
            }}
            aria-label="닫기"
          >
            <X size={16} strokeWidth={2.5} />
          </span>
        </button>
      </div>
    </div>
  );
}
