'use client';

import { useEffect, useState, useCallback } from 'react';

type FavAnimEvent = {
  imageUrl: string;
  startX: number;
  startY: number;
};

const listeners: ((e: FavAnimEvent) => void)[] = [];

export function triggerFavoriteAnimation(event: FavAnimEvent) {
  listeners.forEach((fn) => fn(event));
}

interface AnimItem extends FavAnimEvent {
  id: number;
  targetX: number;
  targetY: number;
}

export default function FavoriteAnimation() {
  const [animations, setAnimations] = useState<AnimItem[]>([]);
  const [bounceNav, setBounceNav] = useState(false);

  const getTargetPos = useCallback(() => {
    // data-nav="찜" 속성으로 정확히 찾기
    const favEl = document.querySelector('[data-nav="찜"]');
    if (favEl) {
      const rect = favEl.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return { x: window.innerWidth * 0.7, y: window.innerHeight - 30 };
  }, []);

  const handleEvent = useCallback((e: FavAnimEvent) => {
    const target = getTargetPos();
    const id = Date.now() + Math.random();
    setAnimations((prev) => [...prev, { ...e, id, targetX: target.x, targetY: target.y }]);

    setTimeout(() => {
      setAnimations((prev) => prev.filter((a) => a.id !== id));
      // 찜 아이콘 바운스
      setBounceNav(true);
      setTimeout(() => setBounceNav(false), 700);
    }, 750);
  }, [getTargetPos]);

  useEffect(() => {
    listeners.push(handleEvent);
    return () => {
      const idx = listeners.indexOf(handleEvent);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, [handleEvent]);

  return (
    <>
      {animations.map((anim) => {
        const dx = anim.targetX - anim.startX;
        const dy = anim.targetY - anim.startY;

        return (
          <div
            key={anim.id}
            className="fixed pointer-events-none z-[200]"
            style={{
              left: anim.startX - 24,
              top: anim.startY - 24,
            }}
          >
            {/* X축 이동 (선형) */}
            <div style={{
              animation: 'favFlyX 0.75s cubic-bezier(0.2, 0, 0.8, 1) forwards',
              ['--dx' as string]: `${dx}px`,
            }}>
              {/* Y축 이동 (포물선 - 먼저 위로 올라갔다가 아래로 떨어짐) */}
              <div style={{
                animation: 'favFlyY 0.75s cubic-bezier(0.5, -0.4, 0.7, 1) forwards',
                ['--dy' as string]: `${dy}px`,
              }}>
                {/* 크기 축소 + 페이드 */}
                <div style={{
                  animation: 'favScale 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                }}>
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-red-400 shadow-xl bg-white">
                    <img src={anim.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* 찜 아이콘 + 네비바 바운스 */}
      {bounceNav && (
        <style>{`
          [data-nav="찜"] {
            animation: favIconBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
          }
          nav > div {
            animation: navBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
          }
        `}</style>
      )}
    </>
  );
}
