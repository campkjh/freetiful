'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { popItemDelay } from '@/lib/pop-menu';

/* ─────────────────────────────────────────────────────────────
 * 결제 조회 · 정산 내역 정렬(261026 운영팀 '결제일/예식일 오름차순/내림차순 정렬 선택').
 *  · 거르기 줄 오른쪽 [⇅ 결제일 최신순 ⌄] → 툴팁 메뉴(.pop-menu, 항목 촤라락) 네 가지.
 *  · 표 머리 '결제일' · '행사' 를 눌러도 같은 정렬이 바뀐다(AdminSortTh — 고른 쪽에 ↓/↑).
 *  · 서버 값 = apps/api/src/payment/admin-list.ts 의 AdminPaySort 와 같은 이름.
 *  · 목록 카드가 overflow hidden 이라 메뉴는 body 포털 + fixed(AdminDatePop 과 같은 방식).
 * ──────────────────────────────────────────────────────────── */
export type AdminPaySort = 'paid_desc' | 'paid_asc' | 'event_asc' | 'event_desc';

export const PAY_SORT_OPTIONS: Array<{ value: AdminPaySort; label: string }> = [
  { value: 'paid_desc', label: '결제일 최신순' },
  { value: 'paid_asc', label: '결제일 오래된순' },
  { value: 'event_asc', label: '예식일 빠른순' },
  { value: 'event_desc', label: '예식일 늦은순' },
];

const sortLabel = (v: AdminPaySort) => PAY_SORT_OPTIONS.find((o) => o.value === v)?.label || PAY_SORT_OPTIONS[0].label;
const GAP = 6;
const EDGE = 12;

function SortArrows() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M8 19V5m0 0L4.8 8.2M8 5l3.2 3.2M16 5v14m0 0-3.2-3.2M16 19l3.2-3.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AdminSortMenu({ value, onChange }: { value: AdminPaySort; onChange: (v: AdminPaySort) => void }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const place = useCallback(() => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const vw = window.innerWidth;
    const w = popRef.current?.offsetWidth || 200;
    // 단추 오른쪽 끝에 맞춰 아래로 — 좁은 화면에서 왼쪽이 넘치면 안쪽으로
    const right = Math.min(Math.max(EDGE, vw - b.right), vw - EDGE - w);
    setPos({ top: b.bottom + GAP, right: Math.max(EDGE, right) });
  }, []);

  const close = useCallback((focusBack = false) => {
    setOpen(false);
    if (focusBack) btnRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const follow = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); };
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(true); } };
    window.addEventListener('resize', follow);
    window.addEventListener('scroll', follow, true);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onKey);
    // 고른 항목에 포커스 — 키보드로 바로 ↑↓
    requestAnimationFrame(() => popRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus());
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', follow);
      window.removeEventListener('scroll', follow, true);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, place, close]);

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const items = Array.from(popRef.current?.querySelectorAll<HTMLButtonElement>('button') || []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + step + items.length) % items.length]?.focus();
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`adm-sortbtn ${open ? 'on' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`정렬: ${sortLabel(value)}`}
      >
        <SortArrows />
        <span>{sortLabel(value)}</span>
        <svg className="adm-sortbtn-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={popRef}
          className="admin-shell pop-menu adm-sortpop"
          style={pos ? { top: pos.top, right: pos.right, transformOrigin: 'top right' } : { top: -9999, right: -9999 }}
          role="menu"
          aria-label="정렬"
          onKeyDown={onMenuKey}
        >
          {PAY_SORT_OPTIONS.map((o, i) => {
            const on = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                className={`pop-menu-item adm-sortpop-item ${on ? 'on' : ''}`}
                style={popItemDelay(i)}
                onClick={() => { close(true); if (!on) onChange(o.value); }}
              >
                {o.label}
                {on && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

/** 표 머리 정렬 칸 — 결제일 = 최신순 ↔ 오래된순, 행사 = 예식일 빠른순 ↔ 늦은순 */
export function AdminSortTh({ field, value, onChange, children, className = '' }: {
  field: 'paid' | 'event';
  value: AdminPaySort;
  onChange: (v: AdminPaySort) => void;
  children: ReactNode;
  className?: string;
}) {
  const active = value.startsWith(field);
  const asc = value.endsWith('_asc');
  const next: AdminPaySort = field === 'paid'
    ? (value === 'paid_desc' ? 'paid_asc' : 'paid_desc')
    : (value === 'event_asc' ? 'event_desc' : 'event_asc');
  return (
    <th className={className} aria-sort={active ? (asc ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={`adm-sortth ${active ? 'on' : ''}`}
        onClick={() => onChange(next)}
        title={`${sortLabel(next)}으로 정렬`}
      >
        {children}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`adm-sortth-ic ${active ? (asc ? 'asc' : 'desc') : ''}`}>
          {active
            ? <path d="M12 5v14m0 0-5.5-5.5M12 19l5.5-5.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            : <path d="M8 19V5m0 0L4.8 8.2M8 5l3.2 3.2M16 5v14m0 0-3.2-3.2M16 19l3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
      </button>
    </th>
  );
}
