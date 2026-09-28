'use client';

// 홈 첫 진입 팝업 — 오늘의집 '오늘의딜' 팝업 결(260929 사장 '첫 번째 이미지를 두 번째 팝업처럼, 모달형 말고, 뜰 때 고급스럽게, r 5').
//  · 가운데 카드(모서리 5) = 그림 + 아래에 붙은 파란 띠 단추 · 카드 밖 아래 = '다시 보지 않기'(왼쪽) · '닫기'(오른쪽) 어두운 알약.
//  · 뜰 때: 딤이 스르르 → 카드가 아래에서 스프링으로 떠오르며 커지고 → 그림은 살짝 크게 시작해 제자리로 가라앉고 →
//    띠 단추가 아래에서 올라오고 → 알약 둘이 차례로. 닫을 땐 살짝 작아지며 사라진다. (빛이 스치는 효과는 사장 지시로 뺐다 260929)
//  · 카드 크기는 화면 높이에 맞춘다(작은 폰에서도 알약까지 한 화면).
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';

export type HomePromo = {
  id: string;
  imageUrl: string;
  /** 그림 칸 비율(가로/세로) — 그림 원본 비율 그대로(자르지 않음) */
  aspect: number;
  ctaLabel: string;
  alt: string;
};

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function HomePromoPopup({
  promo,
  open,
  onCta,
  onClose,
  onHideForever,
}: {
  promo: HomePromo | null;
  open: boolean;
  onCta: () => void;
  onClose: () => void;
  onHideForever: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  // 카드 너비 — 폰 폭의 78% · 최대 320 · 화면 높이(띠 56 + 알약 줄 64 + 위아래 여유 90)에 맞춘 값 중 가장 작은 것
  const width = promo ? `min(78vw, 320px, calc((100svh - 210px) * ${promo.aspect}))` : '0px';

  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && promo && (
          <motion.div
            key="home-promo"
            role="dialog"
            aria-modal="true"
            aria-label={promo.alt}
            className="fixed inset-0 z-[140] flex flex-col items-center justify-center px-6"
            initial={{ backgroundColor: 'rgba(0,0,0,0)' }}
            animate={{ backgroundColor: 'rgba(0,0,0,0.58)' }}
            exit={{ backgroundColor: 'rgba(0,0,0,0)', transition: { duration: 0.28, ease: EASE_OUT } }}
            transition={{ duration: 0.36, ease: EASE_OUT }}
            onClick={onClose}
          >
            <motion.div
              className="relative overflow-hidden rounded-[5px] bg-[#0B1330] shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
              style={{ width }}
              initial={{ opacity: 0, y: 46, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.96, transition: { duration: 0.24, ease: [0.4, 0, 1, 1] } }}
              transition={{ type: 'spring', stiffness: 250, damping: 24, mass: 0.9, delay: 0.06 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={onCta}
                aria-label={promo.ctaLabel}
                className="relative block w-full overflow-hidden"
                style={{ aspectRatio: String(promo.aspect) }}
              >
                <motion.img
                  src={promo.imageUrl}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 h-full w-full select-none object-cover"
                  style={{ objectPosition: '50% 0%' }}
                  initial={{ scale: 1.12 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 1.4, ease: EASE_OUT, delay: 0.06 }}
                />
              </button>
              {/* 띠 단추 — 카드 아래에 붙어 아래에서 올라온다 */}
              <motion.button
                type="button"
                onClick={onCta}
                className="flex h-14 w-full items-center justify-center gap-1 bg-[#3182F6] text-[17px] font-bold tracking-[-0.3px] text-white transition-colors hover:bg-[#2272EB] active:bg-[#1B64DA]"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 30, delay: 0.32 }}
              >
                {promo.ctaLabel}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </motion.button>
            </motion.div>

            {/* 카드 밖 아래 — 다시 보지 않기 · 닫기(어두운 알약) */}
            <div className="mt-3.5 flex items-center justify-between" style={{ width }} onClick={(e) => e.stopPropagation()}>
              {[
                { label: '다시 보지 않기', onClick: onHideForever, delay: 0.44 },
                { label: '닫기', onClick: onClose, delay: 0.5 },
              ].map((b) => (
                <motion.button
                  key={b.label}
                  type="button"
                  onClick={b.onClick}
                  className="h-11 rounded-full px-4 text-[15px] font-semibold tracking-[-0.2px] text-white/95 transition-colors hover:bg-black/70 active:scale-[0.97]"
                  style={{ backgroundColor: 'rgba(0,0,0,0.5)', WebkitBackdropFilter: 'blur(10px)', backdropFilter: 'blur(10px)' }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.18 } }}
                  transition={{ duration: 0.42, ease: EASE_OUT, delay: b.delay }}
                >
                  {b.label}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>,
    document.body,
  );
}
