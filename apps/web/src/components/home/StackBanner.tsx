'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
interface BannerItem {
  id: string;
  title: string;
  subtitle: string;
  bgColor: string;
  image?: string;
  linkUrl?: string | null;
}

interface StackBannerProps {
  banners: BannerItem[];
  autoPlayInterval?: number;
}

function BannerContent({ banner, onClick }: { banner: BannerItem; onClick?: () => void }) {
  if (banner.image) {
    return (
      <div className="w-full h-full cursor-pointer" onClick={onClick}>
        <img src={banner.image} alt="" className="w-full h-full object-cover" draggable={false} />
      </div>
    );
  }
  return (
    <div className={`w-full h-full ${banner.bgColor} flex flex-col justify-end p-6 cursor-pointer`} onClick={onClick}>
      <p className="text-white/70 text-[12px] font-medium tracking-wide uppercase mb-1.5">{banner.subtitle}</p>
      <h3 className="text-white text-[20px] lg:text-[24px] font-bold leading-snug">{banner.title}</h3>
    </div>
  );
}

export default function StackBanner({ banners, autoPlayInterval = 4000 }: StackBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [dragOffset, setDragOffset] = useState(0);
  const pointerStartRef = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const didSwipeRef = useRef(false);

  const next = useCallback(() => {
    if (banners.length <= 1) return;
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const prev = useCallback(() => {
    if (banners.length <= 1) return;
    setDirection(-1);
    setCurrentIndex((current) => (current - 1 + banners.length) % banners.length);
  }, [banners.length]);

  const settleSwipe = useCallback((dx: number, dy: number) => {
    setDragOffset(0);
    if (Math.abs(dx) < 36 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    didSwipeRef.current = true;
    if (dx < 0) next();
    else prev();
    window.setTimeout(() => { didSwipeRef.current = false; }, 250);
  }, [next, prev]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      if (!pointerStartRef.current?.active) next();
    }, autoPlayInterval);
    return () => clearInterval(timer);
  }, [next, autoPlayInterval, banners.length]);

  if (banners.length === 0) return null;

  const visibleCount = Math.min(banners.length, 3);

  return (
    <div className="w-full">
      <div
        className="relative w-full select-none"
        style={{ aspectRatio: '1170 / 300', touchAction: 'pan-y' }}
        onPointerDown={(e) => {
          if (banners.length <= 1) return;
          pointerStartRef.current = { x: e.clientX, y: e.clientY, active: true };
          setDragOffset(0);
          if (e.pointerType !== 'touch') e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const start = pointerStartRef.current;
          if (!start?.active) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (Math.abs(dy) > Math.abs(dx) * 1.3) return;
          setDragOffset(Math.max(-90, Math.min(90, dx)));
        }}
        onPointerUp={(e) => {
          const start = pointerStartRef.current;
          if (!start?.active) return;
          pointerStartRef.current = null;
          settleSwipe(e.clientX - start.x, e.clientY - start.y);
        }}
        onPointerCancel={() => {
          pointerStartRef.current = null;
          setDragOffset(0);
        }}
      >
        {Array.from({ length: visibleCount - 1 }, (_, i) => {
          const stackIndex = visibleCount - 1 - i;
          const bannerIdx = (currentIndex + stackIndex) % banners.length;
          const banner = banners[bannerIdx];
          const scale = 1 - stackIndex * 0.04;
          const translateY = -stackIndex * 8;

          return (
            <div
              key={`stack-${stackIndex}`}
              className="absolute inset-0 rounded-2xl overflow-hidden"
              style={{ transform: `scale(${scale}) translateY(${translateY}px)`, zIndex: stackIndex, opacity: 1 - stackIndex * 0.15 }}
            >
              <BannerContent banner={banner} />
            </div>
          );
        })}

        <>
          <div
            key={banners[currentIndex].id}
            className="absolute inset-0 rounded-2xl overflow-hidden shadow-lg"
            style={{
              zIndex: visibleCount,
              transform: `translateX(${dragOffset}px) rotate(${dragOffset / 40}deg)`,
              transition: dragOffset === 0 ? 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
            }}
          >
            <BannerContent
              banner={banners[currentIndex]}
              onClick={() => {
                if (didSwipeRef.current) return;
                const link = banners[currentIndex].linkUrl;
                if (link) {
                  if (/^https?:\/\//.test(link)) window.open(link, '_blank');
                  else window.location.href = link;
                } else {
                  next();
                }
              }}
            />
            {/* Page indicator */}
            <div className="absolute bottom-4 left-6 flex gap-1.5">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setDirection(i > currentIndex ? 1 : -1); setCurrentIndex(i); }}
                  className={`h-[3px] rounded-full transition-all duration-300 ${i === currentIndex ? 'w-5 bg-white' : 'w-2 bg-white/40'}`}
                />
              ))}
            </div>
          </div>
        </>
      </div>
    </div>
  );
}
