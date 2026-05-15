'use client';

import { useRef, useState } from 'react';
import { Archive } from 'lucide-react';

type SwipeArchiveCardProps = {
  children: React.ReactNode;
  onArchive: () => void;
  className?: string;
  style?: React.CSSProperties;
  archiveLabel?: string;
  disabled?: boolean;
};

export function SwipeArchiveCard({
  children,
  onArchive,
  className = '',
  style,
  archiveLabel = '보관',
  disabled = false,
}: SwipeArchiveCardProps) {
  const [dragging, setDragging] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const offsetRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const startRef = useRef({ x: 0, y: 0, active: false });

  const revealOpacity = Math.max(0, Math.min(1, Math.abs(offsetX) / 72));

  const reset = () => {
    setDragging(false);
    offsetRef.current = 0;
    setOffsetX(0);
    pointerIdRef.current = null;
    startRef.current.active = false;
  };

  return (
    <div className="relative overflow-hidden rounded-[24px]">
      <div
        style={{ opacity: revealOpacity }}
        className="pointer-events-none absolute inset-y-0 right-0 flex w-24 items-center justify-center rounded-[24px] bg-[#EAF2FF] text-[#3180F7]"
      >
        <div className="flex flex-col items-center gap-1">
          <Archive size={18} />
          <span className="text-[11px] font-bold">{archiveLabel}</span>
        </div>
      </div>
      <div
        style={{
          transform: `translate3d(${offsetX}px, 0, 0)`,
          transition: dragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
          touchAction: 'pan-y',
          ...style,
        }}
        onPointerDown={(event) => {
          if (disabled) return;
          pointerIdRef.current = event.pointerId;
          startRef.current = { x: event.clientX, y: event.clientY, active: false };
        }}
        onPointerMove={(event) => {
          if (disabled || pointerIdRef.current !== event.pointerId) return;
          const dx = event.clientX - startRef.current.x;
          const dy = event.clientY - startRef.current.y;
          if (!startRef.current.active) {
            if (Math.abs(dx) < 8) return;
            if (Math.abs(dy) > Math.abs(dx)) {
              reset();
              return;
            }
            startRef.current.active = true;
            setDragging(true);
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }
          event.preventDefault();
          const nextOffset = Math.max(-108, Math.min(0, dx));
          offsetRef.current = nextOffset;
          setOffsetX(nextOffset);
        }}
        onPointerUp={(event) => {
          if (disabled || pointerIdRef.current !== event.pointerId) return;
          if (offsetRef.current <= -88) {
            onArchive();
          }
          reset();
        }}
        onPointerCancel={reset}
        className={`relative z-10 w-full ${className} ${dragging ? 'cursor-grabbing' : ''}`}
      >
        {children}
      </div>
    </div>
  );
}
