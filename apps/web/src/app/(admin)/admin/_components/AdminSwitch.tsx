'use client';

type AdminSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  ariaLabel?: string;
  className?: string;
  labelClassName?: string;
};

export function AdminSwitch({
  checked,
  onChange,
  disabled = false,
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
      aria-label={ariaLabel || label || '토글'}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`admin-ios-switch relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-[3px] transition-[background-color,box-shadow,opacity] duration-200 ease-out focus:outline-none focus:ring-4 focus:ring-[#3180F7]/15 disabled:cursor-not-allowed disabled:opacity-45 ${
        checked
          ? 'bg-[#3180F7] shadow-[inset_0_0_0_1px_rgba(49,128,247,0.18)]'
          : 'bg-[#D1D6DB] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]'
      } ${className}`}
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
