'use client';

import { useState } from 'react';
import { Archive } from 'lucide-react';
import { motion, useMotionValue, useTransform } from 'framer-motion';

type SwipeArchiveCardProps = {
  children: React.ReactNode;
  onArchive: () => void;
  className?: string;
  archiveLabel?: string;
  disabled?: boolean;
};

export function SwipeArchiveCard({
  children,
  onArchive,
  className = '',
  archiveLabel = '보관',
  disabled = false,
}: SwipeArchiveCardProps) {
  const [dragging, setDragging] = useState(false);
  const x = useMotionValue(0);
  const revealOpacity = useTransform(x, [-108, -40, -8, 0], [1, 0.9, 0.25, 0]);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <motion.div
        style={{ opacity: revealOpacity }}
        className="pointer-events-none absolute inset-y-0 right-0 flex w-24 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#3180F7]"
      >
        <div className="flex flex-col items-center gap-1">
          <Archive size={18} />
          <span className="text-[11px] font-bold">{archiveLabel}</span>
        </div>
      </motion.div>
      <motion.div
        style={{ x }}
        drag={disabled ? false : 'x'}
        dragDirectionLock
        dragConstraints={{ left: -108, right: 0 }}
        dragElastic={{ left: 0.08, right: 0 }}
        dragMomentum={false}
        onDragStart={() => setDragging(true)}
        onDragEnd={(_, info) => {
          setDragging(false);
          if (info.offset.x <= -88) {
            onArchive();
          }
        }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        className={`relative z-10 w-full ${className} ${dragging ? 'cursor-grabbing' : ''}`}
      >
        {children}
      </motion.div>
    </div>
  );
}
