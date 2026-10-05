'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';

/** 라디오 버튼 묶음 — 하나만 고르는 거르기(261005 사장 '전체·입금·환불 같은 건 탭 말고 라디오 버튼으로' →
 *  같은 날 '다른 표들도 시간(어제·최근 7일 …) 칩만 빼고 전부 라디오로'). 모든 목록 화면 공통.
 *  동그라미 테두리 → 고르면 파란 테두리 + 가운데 점이 톡 커진다. ←→ 로 옮겨 고를 수 있다(포커스는 고른 것 하나만).
 *  count 를 주면 이름 뒤에 회색 숫자(예: 운영 글 12). */
export function AdminRadioGroup<T extends string>({ value, options, onChange, ariaLabel }: {
  value: T;
  options: Array<{ value: T; label: ReactNode; count?: ReactNode }>;
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
            {o.count != null && <span className="adm-radio-count">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
