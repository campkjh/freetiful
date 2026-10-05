'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/* ─────────────────────────────────────────────────────────────
 * 날짜 칸 + 그 자리 달력(261005 사장 '연도·월·일 피커를 퀵매칭 피커처럼 — 모달 말고 그 위치에 뜨는 팝업, PC 에서 견적서 보낼 때처럼').
 *  · 칸을 누르면 바로 아래(자리가 모자라면 위)에 흰 카드가 붙어 뜬다 — 화면을 덮는 딤 없음, 바깥·Esc·날짜 고르면 스르르 닫힘.
 *  · 달력 = 퀵매칭 예식일 달력 어법: 'YYYY년 MM월' + ‹ › · 요일 줄 · 늘 6줄(높이 출렁임 없음) · 줄마다 아래→위로 차례로 올라옴 ·
 *    고른 날 = 연한 파랑 바탕 + 파란 굵은 글자. 기간의 다른 쪽 날짜와 그 사이도 옅게 보여 준다(rangeStart~rangeEnd).
 *  · 목록 카드(.adm-listcard)가 overflow hidden 이라 카드는 body 포털 + fixed 자리(스크롤·창 크기 바뀌면 따라감).
 * ──────────────────────────────────────────────────────────── */
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const pad2 = (n: number) => String(n).padStart(2, '0');
const ymdLocal = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const POP_W = 340;
const GAP = 8;
const EDGE = 12;

/** '2026-10-05' → '2026.10.05 (일)' */
function fmtField(v: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return v;
  const dow = WEEK[new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay()];
  return `${m[1]}.${m[2]}.${m[3]} (${dow})`;
}

function baseYm(v: string) {
  const m = /^(\d{4})-(\d{2})/.exec(v);
  const d = new Date();
  return m ? { y: Number(m[1]), m: Number(m[2]) - 1 } : { y: d.getFullYear(), m: d.getMonth() };
}

function DateGrid({ y, m, sel, today, rangeStart, rangeEnd, onPick }: {
  y: number;
  m: number;
  sel: string;
  today: string;
  rangeStart?: string;
  rangeEnd?: string;
  onPick: (d: string) => void;
}) {
  const first = new Date(y, m, 1).getDay();
  const daysIn = new Date(y, m + 1, 0).getDate();
  const lo = rangeStart && rangeEnd ? (rangeStart < rangeEnd ? rangeStart : rangeEnd) : '';
  const hi = rangeStart && rangeEnd ? (rangeStart < rangeEnd ? rangeEnd : rangeStart) : '';
  return (
    <div className="adm-datepop-grid">
      {Array.from({ length: 6 }, (_, r) => (
        <div key={r} className="adm-datepop-row" style={{ animationDelay: `${0.04 + r * 0.035}s` }}>
          {Array.from({ length: 7 }, (_, c) => {
            const d = r * 7 + c - first + 1;
            if (d < 1 || d > daysIn) return <span key={c} />;
            const ds = `${y}-${pad2(m + 1)}-${pad2(d)}`;
            const on = ds === sel;
            const edge = !on && (ds === rangeStart || ds === rangeEnd);
            const inRange = !!lo && ds > lo && ds < hi;
            return (
              <button
                key={c}
                type="button"
                className={`adm-datepop-day ${on ? 'on' : ''} ${edge ? 'edge' : ''} ${inRange ? 'in' : ''} ${ds === today ? 'today' : ''}`}
                aria-pressed={on}
                aria-label={`${y}년 ${m + 1}월 ${d}일 ${WEEK[c]}요일`}
                onClick={() => onPick(ds)}
              >
                {d}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function AdminDatePop({ value, onChange, placeholder, ariaLabel, rangeStart, rangeEnd }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel: string;
  /** 기간의 양 끝(옅게 이어 보여 줄 때) */
  rangeStart?: string;
  rangeEnd?: string;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);
  const [ym, setYm] = useState(() => baseYm(value));
  const closing = useRef(0);
  const today = ymdLocal(new Date());

  const place = useCallback(() => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(POP_W, vw - EDGE * 2);
    const h = popRef.current?.offsetHeight || 430;
    // 칸 왼쪽에 맞추되 오른쪽이 넘치면 칸 오른쪽 끝에 맞춘다
    let left = b.left + width > vw - EDGE ? b.right - width : b.left;
    left = Math.max(EDGE, Math.min(left, vw - EDGE - width));
    const fitsBelow = b.bottom + GAP + h <= vh - EDGE;
    const up = !fitsBelow && b.top - GAP - h >= EDGE;
    setPos({ top: up ? b.top - GAP - h : b.bottom + GAP, left, width, up });
  }, []);

  const close = useCallback((focusBack = false) => {
    setShown(false);
    window.clearTimeout(closing.current);
    closing.current = window.setTimeout(() => setOpen(false), 170);
    if (focusBack) btnRef.current?.focus();
  }, []);

  const openPop = () => {
    window.clearTimeout(closing.current);
    setYm(baseYm(value || rangeStart || rangeEnd || ''));
    // 닫히는 중(스르르)에 다시 누르면 그 자리에서 다시 떠오른다
    if (open) { place(); setShown(true); return; }
    setPos(null);
    setOpen(true);
  };

  // 뜬 뒤 높이를 재서 자리 잡고 → 다음 프레임에 스르르
  useLayoutEffect(() => {
    if (!open) return;
    place();
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(true); } };
    window.addEventListener('resize', follow);
    window.addEventListener('scroll', follow, true);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', follow);
      window.removeEventListener('scroll', follow, true);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, place, close]);

  useEffect(() => () => window.clearTimeout(closing.current), []);

  const pick = (ds: string) => { onChange(ds); close(true); };
  const goMonth = (delta: number) => setYm(({ y, m }) => {
    const t = y * 12 + m + delta;
    return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
  });

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`adm-input sm adm-datefield ${value ? '' : 'empty'} ${open ? 'on' : ''}`}
        onClick={() => (open && shown ? close() : openPop())}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={value ? `${ariaLabel} ${fmtField(value)}` : ariaLabel}
      >
        <span className="adm-datefield-text">{value ? fmtField(value) : placeholder}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="adm-datefield-ic">
          <rect x="3.5" y="5" width="17" height="15.5" rx="3.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={popRef}
          className={`admin-shell adm-datepop ${shown ? 'on' : ''} ${pos?.up ? 'up' : ''}`}
          style={pos ? { top: pos.top, left: pos.left, width: pos.width } : { top: -9999, left: -9999, width: POP_W }}
          role="dialog"
          aria-label={`${ariaLabel} 고르기`}
        >
          <div className="adm-datepop-head">
            <b>{ym.y}년 {pad2(ym.m + 1)}월</b>
            <div className="adm-datepop-nav">
              <button type="button" aria-label="이전 달" onClick={() => goMonth(-1)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 5.5 8.5 12l6.5 6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button type="button" aria-label="다음 달" onClick={() => goMonth(1)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5.5 15.5 12 9 18.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </div>
          <div className="adm-datepop-week" aria-hidden="true">{WEEK.map((w) => <span key={w}>{w}</span>)}</div>
          <DateGrid key={`${ym.y}-${ym.m}`} y={ym.y} m={ym.m} sel={value} today={today} rangeStart={rangeStart} rangeEnd={rangeEnd} onPick={pick} />
          <div className="adm-datepop-foot">
            <button type="button" onClick={() => pick(today)}>오늘</button>
            {value && <button type="button" className="sub" onClick={() => { onChange(''); close(true); }}>지우기</button>}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
