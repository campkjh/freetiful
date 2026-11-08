'use client';

// 홈 첫 진입 팝업 — 오늘의집 '오늘의딜' 팝업 결(260929 사장 '첫 번째 이미지를 두 번째 팝업처럼, 모달형 말고, 뜰 때 고급스럽게, r 5').
//  · 가운데 카드(모서리 5) = 그림 + 아래에 붙은 파란 띠 단추 · 카드 밖 아래 = '다시 보지 않기'(왼쪽) · '닫기'(오른쪽) 어두운 알약.
//  · 뜰 때: 딤이 스르르 → 카드가 아래에서 스프링으로 떠오르며 커지고 → 그림은 살짝 크게 시작해 제자리로 가라앉고 →
//    띠 단추가 아래에서 올라오고 → 알약 둘이 차례로. 닫을 땐 살짝 작아지며 사라진다. (빛이 스치는 효과는 사장 지시로 뺐다 260929)
//  · 카드 크기는 화면 높이에 맞춘다(작은 폰에서도 알약까지 한 화면).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  promos,
  activeIndex,
  onChange,
  open,
  onCta,
  onClose,
  onHideForever,
}: {
  promos: HomePromo[];
  activeIndex: number;
  onChange: (index: number) => void;
  open: boolean;
  onCta: (index: number) => void;
  onClose: () => void;
  onHideForever: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout>>();
  const reduceMotion = useReducedMotion();
  const promo = promos[activeIndex] ?? null;
  const move = (delta: number) => onChange((activeIndex + delta + promos.length) % promos.length);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => () => clearTimeout(clickTimer.current), []);
  useLayoutEffect(() => {
    if (track.current?.contains(document.activeElement)) {
      track.current.querySelector<HTMLButtonElement>('[data-active="true"] button')?.focus({ preventScroll: true });
    }
  }, [activeIndex]);
  useEffect(() => {
    if (!open || promos.length < 2 || hovered || focused || reduceMotion) return;
    const timer = window.setInterval(() => {
      if (!pointerStart.current && !document.hidden) onChange((activeIndex + 1) % promos.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [open, activeIndex, promos.length, hovered, focused, reduceMotion, onChange]);
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
            onKeyDown={(event) => {
              if (promos.length < 2) return;
              if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                event.preventDefault();
                move(event.key === 'ArrowRight' ? 1 : -1);
              }
            }}
          >
            <motion.div
              className="relative overflow-hidden rounded-[5px] bg-[#0B1330] shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
              style={{ width }}
              initial={{ opacity: 0, y: 46, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.96, transition: { duration: 0.24, ease: [0.4, 0, 1, 1] } }}
              transition={{ type: 'spring', stiffness: 250, damping: 24, mass: 0.9, delay: 0.06 }}
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              onFocusCapture={() => setFocused(true)}
              onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setFocused(false); }}
            >
              <div
                ref={track}
                className="flex select-none"
                style={{ width: `${promos.length * 100}%`, transform: `translateX(calc(-${activeIndex * (100 / promos.length)}% + ${dragOffset}px))`, transition: dragOffset || reduceMotion ? 'none' : 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)', touchAction: 'pan-y' }}
                onPointerDown={(event) => {
                  if (promos.length < 2 || (event.pointerType === 'mouse' && event.button !== 0)) return;
                  pointerStart.current = { x: event.clientX, y: event.clientY };
                }}
                onPointerMove={(event) => {
                  const start = pointerStart.current;
                  if (!start) return;
                  const dx = event.clientX - start.x, dy = event.clientY - start.y;
                  if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDragOffset(Math.max(-90, Math.min(90, dx)));
                }}
                onPointerUp={(event) => {
                  const start = pointerStart.current;
                  pointerStart.current = null;
                  setDragOffset(0);
                  if (!start) return;
                  const dx = event.clientX - start.x, dy = event.clientY - start.y;
                  if (Math.abs(dx) > 8) {
                    suppressClick.current = true;
                    clearTimeout(clickTimer.current);
                    clickTimer.current = setTimeout(() => { suppressClick.current = false; }, 300);
                  }
                  if (Math.abs(dx) >= 36 && Math.abs(dx) > Math.abs(dy) * 1.2) move(dx < 0 ? 1 : -1);
                }}
                onPointerCancel={() => { pointerStart.current = null; setDragOffset(0); }}
                onPointerLeave={() => { if (!dragOffset) pointerStart.current = null; }}
                onClickCapture={(event) => {
                  if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); }
                }}
              >
                {promos.map((item, index) => (
                  <div key={item.id} className="shrink-0" style={{ width: `${100 / promos.length}%` }} aria-hidden={index !== activeIndex} data-active={index === activeIndex}>
                    <button type="button" onClick={() => onCta(index)} tabIndex={index === activeIndex ? 0 : -1} aria-label={item.ctaLabel} className="relative block w-full overflow-hidden" style={{ aspectRatio: String(item.aspect) }}>
                      <motion.img src={item.imageUrl} alt="" draggable={false} decoding="async" className="absolute inset-0 h-full w-full select-none object-cover" style={{ objectPosition: '50% 0%' }} initial={{ scale: 1.12 }} animate={{ scale: 1 }} transition={{ duration: 1.4, ease: EASE_OUT, delay: 0.06 }} />
                    </button>
                    <motion.button type="button" onClick={() => onCta(index)} tabIndex={index === activeIndex ? 0 : -1} className="flex h-14 w-full items-center justify-center gap-1 bg-[#3182F6] text-[17px] font-bold tracking-[0] text-white transition-colors hover:bg-[#2272EB] active:bg-[#1B64DA]" initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 30, delay: 0.32 }}>
                      {item.ctaLabel}<ChevronRight size={20} aria-hidden="true" />
                    </motion.button>
                  </div>
                ))}
              </div>
            </motion.div>

            {promos.length > 1 && (
              <div className="mt-2 flex h-8 items-center justify-center gap-3 text-white" style={{ width }} onClick={(e) => e.stopPropagation()}>
                <button type="button" aria-label="이전 팝업" title="이전 팝업" className="grid h-8 w-8 place-items-center rounded-full bg-black/40" onClick={() => move(-1)}><ChevronLeft size={18} /></button>
                {promos.map((item, index) => <button key={item.id} type="button" aria-label={`${index + 1}번째 팝업: ${item.alt}`} aria-pressed={index === activeIndex} onClick={() => onChange(index)} className="grid h-8 min-w-4 place-items-center"><span className={`h-1.5 rounded-full transition-all ${index === activeIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`} /></button>)}
                <button type="button" aria-label="다음 팝업" title="다음 팝업" className="grid h-8 w-8 place-items-center rounded-full bg-black/40" onClick={() => move(1)}><ChevronRight size={18} /></button>
              </div>
            )}

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
