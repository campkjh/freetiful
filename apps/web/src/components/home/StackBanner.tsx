'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BannerItem {
  id: string;
  title: string;
  subtitle: string;
  bgColor: string;
}

interface StackBannerProps {
  banners: BannerItem[];
  autoPlayInterval?: number;
}

export default function StackBanner({ banners, autoPlayInterval = 4000 }: StackBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const next = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(next, autoPlayInterval);
    return () => clearInterval(timer);
  }, [next, autoPlayInterval, banners.length]);

  if (banners.length === 0) return null;

  // Show up to 3 stacked cards behind the current one
  const visibleCount = Math.min(banners.length, 3);

  return (
    <div className="w-full">
      <div className="relative w-full" style={{ aspectRatio: '2 / 1' }}>
        {/* Stacked cards behind (static, showing depth) */}
        {Array.from({ length: visibleCount - 1 }, (_, i) => {
          const stackIndex = visibleCount - 1 - i; // 2, 1 (back to front)
          const bannerIdx = (currentIndex + stackIndex) % banners.length;
          const banner = banners[bannerIdx];
          const scale = 1 - stackIndex * 0.04;
          const translateY = -stackIndex * 8;

          return (
            <div
              key={`stack-${stackIndex}`}
              className="absolute inset-0 rounded-2xl overflow-hidden"
              style={{
                transform: `scale(${scale}) translateY(${translateY}px)`,
                zIndex: stackIndex,
                opacity: 1 - stackIndex * 0.15,
              }}
            >
              <div
                className={`w-full h-full ${banner.bgColor} flex flex-col justify-end p-6`}
              >
                <p className="text-white/60 text-[12px] font-medium tracking-wide uppercase mb-1">
                  {banner.subtitle}
                </p>
                <h3 className="text-white text-[18px] lg:text-[22px] font-bold leading-snug">
                  {banner.title}
                </h3>
              </div>
            </div>
          );
        })}

        {/* Active card (animated) */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={banners[currentIndex].id}
            className="absolute inset-0 rounded-2xl overflow-hidden shadow-lg"
            style={{ zIndex: visibleCount }}
            initial={{ y: 60, scale: 0.92, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -300, scale: 0.95, opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
              mass: 1,
            }}
          >
            <div
              className={`w-full h-full ${banners[currentIndex].bgColor} flex flex-col justify-end p-6 cursor-pointer`}
              onClick={next}
            >
              <p className="text-white/70 text-[12px] font-medium tracking-wide uppercase mb-1.5">
                {banners[currentIndex].subtitle}
              </p>
              <h3 className="text-white text-[20px] lg:text-[24px] font-bold leading-snug">
                {banners[currentIndex].title}
              </h3>

              {/* Page indicator */}
              <div className="flex gap-1.5 mt-4">
                {banners.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDirection(i > currentIndex ? 1 : -1);
                      setCurrentIndex(i);
                    }}
                    className={`h-[3px] rounded-full transition-all duration-300 ${
                      i === currentIndex
                        ? 'w-5 bg-white'
                        : 'w-2 bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
