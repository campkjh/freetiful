'use client';

import type { ReactNode } from 'react';

type AdminSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** 저장 중 — 눌러도 안 바뀌지만 포커스는 그대로(키보드로 누른 사람이 자리를 잃지 않게 native disabled 대신 aria-disabled) */
  busy?: boolean;
  label?: ReactNode;
  ariaLabel?: string;
  className?: string;
  labelClassName?: string;
};

export function AdminSwitch({
  checked,
  onChange,
  disabled = false,
  busy = false,
  label,
  ariaLabel,
  className = '',
  labelClassName = '',
}: AdminSwitchProps) {
  const switchButton = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel || (typeof label === 'string' ? label : '토글')}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      disabled={disabled}
      onClick={() => { if (!busy) onChange(!checked); }}
      className={`admin-ios-switch relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-[3px] transition-[background-color,box-shadow,opacity] duration-200 ease-out focus:outline-none focus:ring-4 focus:ring-[#3180F7]/15 disabled:cursor-not-allowed disabled:opacity-45 ${busy ? 'cursor-progress opacity-70' : ''} ${className}`}
      style={{
        backgroundColor: checked ? '#3180F7' : '#D1D6DB',
        boxShadow: checked
          ? 'inset 0 0 0 1px rgba(49,128,247,0.18)'
          : 'inset 0 0 0 1px rgba(0,0,0,0.05)',
      }}
    >
      <span
        className={`h-[22px] w-[22px] rounded-full bg-white shadow-[0_2px_6px_rgba(25,31,40,0.22)] transition-transform duration-200 ease-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );

  if (!label) return switchButton;

  return (
    <span className="inline-flex items-center gap-2.5">
      {switchButton}
      <span className={`text-[13px] font-semibold text-[#191F28] ${labelClassName}`}>{label}</span>
    </span>
  );
}
