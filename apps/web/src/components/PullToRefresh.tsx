'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';

interface Props {
  onRefresh: () => void | Promise<void>;
  threshold?: number; // px, 당길 거리
  children: ReactNode;
}

/**
 * 모바일 pull-to-refresh 컨테이너.
 * 페이지 최상단에서 아래로 드래그하면 로딩 인디케이터 표시 후 onRefresh 호출.
 */
export default function PullToRefresh({ onRefresh, threshold = 70, children }: Props) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) { startY.current = null; return; }
      startY.current = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && window.scrollY <= 0) {
        // 저항감을 위해 0.5배 스케일
        setPull(Math.min(dy * 0.5, threshold * 1.5));
      } else {
        setPull(0);
      }
    };
    const onTouchEnd = async () => {
      if (pull >= threshold && !refreshing) {
        setRefreshing(true);
        try { await onRefresh(); } finally {
          setTimeout(() => { setRefreshing(false); setPull(0); }, 300);
        }
      } else {
        setPull(0);
      }
      startY.current = null;
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [pull, threshold, refreshing, onRefresh]);

  const spin = refreshing || pull >= threshold;
  const progress = Math.min(pull / threshold, 1);

  return (
    <div style={{ transform: `translateY(${pull}px)`, transition: pull === 0 ? 'transform 0.25s ease' : 'none' }}>
      <div
        className="flex justify-center items-center"
        style={{
          position: 'absolute', left: 0, right: 0, top: -60, height: 60,
          opacity: progress,
        }}
      >
        <div
          className={`w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full ${spin ? 'animate-spin' : ''}`}
          style={{ transform: !spin ? `rotate(${progress * 360}deg)` : undefined, transition: !spin ? 'transform 0.05s linear' : undefined }}
        />
      </div>
      {children}
    </div>
  );
}
