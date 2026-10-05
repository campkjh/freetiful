'use client';

import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * 펼치기·접기(261005 사장 '펼칠 때도 더 부드럽게, 접을 땐 뚝 말고 완전 부드럽게').
 * 높이를 0 ↔ auto 로 같은 감속 곡선으로 늘이고 줄인다 — 접을 때도 내용이 남아 있다가 높이가 0 이 된 뒤 빠진다.
 * (AnimatePresence 바로 아래는 Fragment 말고 키 있는 motion.div 하나 — Fragment 면 exit 뒤 안 빠진다)
 */
const EASE = [0.22, 1, 0.36, 1] as const;

export function AdminCollapse({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="collapse"
          className={className}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1, transition: { height: { duration: 0.5, ease: EASE }, opacity: { duration: 0.32, delay: 0.06 } } }}
          exit={{ height: 0, opacity: 0, transition: { height: { duration: 0.42, ease: EASE }, opacity: { duration: 0.2 } } }}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** 접혀도 안 빠지는 판(입력 값 보존) — 높이를 grid 행(0fr ↔ 1fr)으로 부드럽게, 접힌 동안은 inert */
export function AdminCollapseKeep({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={`adm-collapse ${open ? 'on' : ''}`} aria-hidden={!open} {...(!open ? { inert: '' as unknown as boolean } : {})}>
      <div className="adm-collapse-inner">{children}</div>
    </div>
  );
}
