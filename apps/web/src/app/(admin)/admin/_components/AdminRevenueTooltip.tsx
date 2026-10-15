'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from './admin-icons';
import { adminFetch } from './adminFetch';
import { QuickMatchBubbleGlass } from '@/components/home/TossBubble';

interface RevenuePro {
  id: string;
  name: string;
  imageUrl: string | null;
  amount: number;
  paymentCount: number;
}

interface RevenueDay {
  date: string;
  amount: number;
  paymentCount: number;
  pros: RevenuePro[];
}

interface RevenueSnapshot {
  from: string;
  to: string;
  days: RevenueDay[];
  fetchedAt: number;
}

export interface RevenueTooltipTarget {
  dateKey: string;
  amount: number;
  anchor: HTMLButtonElement;
}

function RevenueAvatar({ pro }: { pro: RevenuePro }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <span className="adm-revenue-avatar" aria-hidden="true">
      {pro.imageUrl && pro.imageUrl !== failedUrl
        ? <img src={pro.imageUrl} alt="" width={40} height={40} loading="lazy" onError={() => setFailedUrl(pro.imageUrl)} />
        : pro.name.trim().slice(0, 1) || '?'}
    </span>
  );
}

export function AdminRevenueTooltip({
  id, from, to, target, onClose, onKeepOpen, onScheduleClose,
}: {
  id: string;
  from?: string;
  to?: string;
  target: RevenueTooltipTarget | null;
  onClose: (restoreFocus?: boolean) => void;
  onKeepOpen: () => void;
  onScheduleClose: () => void;
}) {
  const popup = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef<RevenueSnapshot | null>(null);
  const inFlight = useRef<{ range: string; promise: Promise<void> } | null>(null);
  const revision = useRef(0);
  const [snapshot, setSnapshot] = useState<RevenueSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; arrow: number; side: 'above' | 'below' } | null>(null);
  const reducedMotion = useReducedMotion();

  const load = useCallback((force = false): Promise<void> => {
    if (!from || !to) return Promise.resolve();
    const range = `${from}:${to}`;
    if (inFlight.current?.range === range) return inFlight.current.promise;
    const cached = snapshotRef.current;
    if (!force && cached?.from === from && cached.to === to && Date.now() - cached.fetchedAt < 15_000) return Promise.resolve();
    const request = ++revision.current;
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({ from, to });
    const promise = adminFetch('GET', `/api/v1/admin/revenue-breakdown?${params}`, undefined, { cache: !force, cacheTtl: 10_000 })
      .then((data) => {
        if (!Array.isArray(data?.days) || !data.days.length || data.from !== from || data.to !== to) throw new Error('Invalid revenue breakdown');
        if (request !== revision.current) return;
        const next: RevenueSnapshot = { from, to, days: data.days, fetchedAt: Date.now() };
        snapshotRef.current = next;
        setSnapshot(next);
      })
      .catch(() => { if (request === revision.current) setError(true); })
      .finally(() => {
        if (request !== revision.current) return;
        inFlight.current = null;
        setLoading(false);
      });
    inFlight.current = { range, promise };
    return promise;
  }, [from, to]);

  // Prefetch one bounded 14-day breakdown; changing bars does not fetch each day again.
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (target) void load(); }, [target?.dateKey, load]);
  useEffect(() => () => { revision.current += 1; inFlight.current = null; }, []);

  const day = snapshot?.from === from && snapshot.to === to
    ? snapshot.days.find((item) => item.date === target?.dateKey)
    : undefined;

  useLayoutEffect(() => {
    if (!target) { setPosition(null); return; }
    const update = () => {
      const el = popup.current;
      if (!el || !target.anchor.isConnected) return;
      const anchor = target.anchor.querySelector('.adm-vbar-col') || target.anchor;
      const r = anchor.getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - 24);
      const height = Math.min(el.offsetHeight, window.innerHeight - 24);
      const center = r.left + r.width / 2;
      const left = Math.max(12, Math.min(center - width / 2, window.innerWidth - width - 12));
      const above = r.top - height - 12 >= 12;
      const top = Math.max(12, Math.min(above ? r.top - height - 12 : r.bottom + 12, window.innerHeight - height - 12));
      const next = { left, top, arrow: Math.max(20, Math.min(width - 20, center - left)), side: above ? 'above' as const : 'below' as const };
      setPosition((prev) => prev && prev.left === next.left && prev.top === next.top && prev.arrow === next.arrow && prev.side === next.side ? prev : next);
    };
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (popup.current) observer?.observe(popup.current);
    window.addEventListener('resize', update);
    return () => { observer?.disconnect(); window.removeEventListener('resize', update); };
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const outside = (event: PointerEvent) => {
      const node = event.target as Node | null;
      if (node && !popup.current?.contains(node) && !target.anchor.contains(node)) onClose();
    };
    const scroll = (event: Event) => {
      if (event.target instanceof Node && popup.current?.contains(event.target)) return;
      onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose(!!popup.current?.contains(document.activeElement));
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('scroll', scroll, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('scroll', scroll, true);
    };
  }, [target, onClose]);

  if (typeof document === 'undefined') return null;
  const dateLabel = target ? new Date(`${target.dateKey}T00:00:00+09:00`).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' }) : '';
  const direction = position?.side === 'above' ? -1 : 1;

  return createPortal(
    <AnimatePresence>
      {target && (
        <motion.div
          key="revenue-tooltip"
          ref={popup}
          id={id}
          role="dialog"
          aria-modal={false}
          aria-labelledby={`${id}-title`}
          aria-busy={loading && !day}
          tabIndex={-1}
          className="adm-revenue-tip"
          data-side={position?.side}
          style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? 'visible' : 'hidden', '--revenue-arrow': `${position?.arrow ?? 20}px` } as CSSProperties}
          initial={reducedMotion ? false : { scaleX: 0.53, scaleY: 0.16, y: -10 * direction }}
          animate={{ scaleX: [0.53, 0.8, 0.92, 0.99, 1.013, 1.009, 1, 1, 1, 1], scaleY: [0.16, 0.6, 0.85, 1, 1.013, 1.009, 1, 1, 1, 1], y: [-10, -9.5, -8, -5, 1.3, 6.3, 3.3, 0.7, 0.2, 0].map((y) => y * direction) }}
          exit={{ opacity: 0, y: -6 * direction, scaleX: 0.9, scaleY: 0.7, transition: { duration: reducedMotion ? 0 : 0.18 } }}
          transition={{ duration: reducedMotion ? 0 : 1, ease: 'linear', times: [0, 0.033, 0.1, 0.15, 0.217, 0.317, 0.45, 0.55, 0.7, 1] }}
          onMouseEnter={onKeepOpen}
          onMouseLeave={onScheduleClose}
          onFocusCapture={onKeepOpen}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null) && !target.anchor.contains(event.relatedTarget as Node | null)) onScheduleClose();
          }}
        >
          <span className="adm-revenue-shadow" aria-hidden="true" />
          <span className="adm-revenue-glass" aria-hidden="true"><QuickMatchBubbleGlass tailX={position?.arrow ?? 40} /></span>
          <div className="adm-revenue-content">
          <div className="adm-revenue-head">
            <div>
              <p id={`${id}-title`} className="adm-revenue-date">{dateLabel} 매출</p>
              <p className="adm-revenue-total">{(day?.amount ?? target.amount).toLocaleString('ko-KR')}<span>원</span></p>
              {day && <p className="adm-revenue-count">결제 완료 {day.paymentCount.toLocaleString('ko-KR')}건 · 사회자 {day.pros.length.toLocaleString('ko-KR')}명</p>}
            </div>
            <button type="button" className="adm-revenue-close" aria-label="매출 상세 닫기" onClick={() => onClose(true)}><X size={18} /></button>
          </div>
          <div className="adm-revenue-body">
            {day ? (
              day.pros.length ? (
                <ul key={day.date} className="adm-revenue-list">
                  {day.pros.map((pro, index) => (
                    <li key={pro.id} className="adm-revenue-row" style={{ animationDelay: `${Math.min(index, 6) * 0.02}s` }}>
                      <RevenueAvatar pro={pro} />
                      <div className="adm-revenue-person"><span title={pro.name}>{pro.name}</span><small>결제 {pro.paymentCount.toLocaleString('ko-KR')}건</small></div>
                      <b className="adm-revenue-amount">{pro.amount.toLocaleString('ko-KR')}원</b>
                    </li>
                  ))}
                </ul>
              ) : <p className="adm-revenue-empty">완료된 결제가 없어요</p>
            ) : error ? (
              <div className="adm-revenue-empty"><p>결제 내역을 불러오지 못했어요</p><button type="button" onClick={() => void load(true)} disabled={loading}>다시 불러오기</button></div>
            ) : (
              <div className="adm-revenue-skeleton" aria-label="결제 내역 불러오는 중">
                {[0, 1, 2].map((index) => <div key={index}><span /><span /><span /></div>)}
              </div>
            )}
          </div>
          {day && error && <button type="button" className="adm-revenue-retry" onClick={() => void load(true)} disabled={loading}>최신 내역 다시 불러오기</button>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
