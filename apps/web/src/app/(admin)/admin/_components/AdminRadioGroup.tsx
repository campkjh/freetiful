'use client';

import { useRef, type KeyboardEvent } from 'react';

/** 라디오 버튼 묶음 — 하나만 고르는 거르기(261005 사장 '전체·입금·환불 같은 건 탭 말고 라디오 버튼으로').
 *  동그라미 테두리 → 고르면 파란 테두리 + 가운데 점이 톡 커진다. ←→ 로 옮겨 고를 수 있다(포커스는 고른 것 하나만). */
export function AdminRadioGroup<T extends string>({ value, options, onChange, ariaLabel }: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = Math.max(0, options.findIndex((o) => o.value === value));
    const next = options[(i + step + options.length) % options.length];
    onChange(next.value);
    requestAnimationFrame(() => boxRef.current?.querySelector<HTMLButtonElement>(`[data-v="${next.value}"]`)?.focus());
  };
  return (
    <div ref={boxRef} className="adm-radios" role="radiogroup" aria-label={ariaLabel} onKeyDown={onKey}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-v={o.value}
            className="adm-radio"
            onClick={() => { if (!on) onChange(o.value); }}
          >
            <span className="adm-radio-dot" aria-hidden="true" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
