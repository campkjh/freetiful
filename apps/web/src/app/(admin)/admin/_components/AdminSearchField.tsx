'use client';

import { useRef, useState } from 'react';

/* ─────────────────────────────────────────────────────────────
 * 어드민 검색칸(261006 사장 시안 'Typing States' 4장 그대로 — Placeholder · Focused · Typing · Typed).
 *  · 회색 바탕(#F2F4F6) 44 · 모서리 12 · 테두리 없음 — 눌러도 파란 커서만(#3182F6).
 *  · 돋보기 20(검정 58%) · 글자 17(입력 #191F28 · 자리표시 46%).
 *  · 글을 넣고 칸을 벗어나면(Typed) 오른쪽에 지우기 동그라미(31%) — 누르면 비우고 바로 다시 찾는다(onSubmit('')).
 *  · Enter = onSubmit(지금 값), Esc = 비우기. 긴 글은 오른쪽 끝이 옅어진다(시안의 16px 그라데이션).
 * ──────────────────────────────────────────────────────────── */
export function AdminSearchField({
  value,
  onChange,
  onSubmit,
  placeholder,
  className = '',
  ariaLabel,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Enter · 지우기 — 넘겨 주는 값이 최신(상태는 아직 안 바뀌었을 수 있다) */
  onSubmit?: (v: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const clear = () => {
    onChange('');
    onSubmit?.('');
  };
  return (
    <label className={`adm-sf ${focused ? 'focus' : ''} ${value ? 'has' : ''} ${className}`}>
      <svg className="adm-sf-ic" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M21.8488 20.151L17.2418 15.544C18.3268 14.106 18.9778 12.324 18.9778 10.388C18.9778 5.652 15.1238 1.799 10.3888 1.799C5.6528 1.8 1.7998 5.653 1.7998 10.389C1.7998 15.124 5.6528 18.978 10.3888 18.978C12.3238 18.978 14.1068 18.327 15.5448 17.242L20.1518 21.849C20.3858 22.083 20.6928 22.2 20.9998 22.2C21.3068 22.2 21.6138 22.083 21.8488 21.848C22.3168 21.38 22.3168 20.62 21.8488 20.151ZM4.1998 10.389C4.1998 6.976 6.9758 4.2 10.3888 4.2C13.8008 4.2 16.5768 6.976 16.5768 10.388C16.5768 13.8 13.8008 16.576 10.3888 16.576C6.9758 16.577 4.1998 13.801 4.1998 10.389Z"
          fill="currentColor"
        />
      </svg>
      <input
        ref={ref}
        type="search"
        enterKeyHint="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit?.(e.currentTarget.value);
          else if (e.key === 'Escape' && value) { e.preventDefault(); clear(); }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
      />
      {value && !focused && (
        <button
          type="button"
          className="adm-sf-clear"
          aria-label="검색어 지우기"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => { e.preventDefault(); clear(); }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="11" fill="currentColor" />
            <path d="M7.5 7.5l7 7M14.5 7.5l-7 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </label>
  );
}
