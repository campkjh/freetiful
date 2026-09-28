'use client';

// 파트너 신청·사회자 프로필 수정 공통 부품 — 퀵매칭 어법(260928 사장 "파트너 신청 디자인 톤앤매너 맞춰서, 전환 인터렉션 퀵매칭처럼 고급스럽게",
// "사회자 프로필 수정 UI 도 태그·버튼·토글 전부 지금 톤앤매너·애니메이션에 맞게").
//  · RegisterShell: 머리(퀵매칭 뒤로 화살표 + 진행 막대 'N / 5' — 앞 단계 자리에서 지금 단계까지 차오른다) · 제목 아래→위 페이드 ·
//    본문 칸은 오른쪽→왼쪽 순차 슬라이드(.qd-body) · 아래 흰 페이드 위 고정 버튼.
//  · RgOption(선택 카드) · RgCheck(동그라미 체크) · RgChip(칩) · RgToggle(스위치) · RgField(라벨·도움말·오류) · RgCta(버튼).
//  · 스타일은 globals .rg-* / .qd-* / .ft-chip.
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { QdBackIcon } from '../../my/_components/detail-ui';

/** 파트너 신청 단계 수 — 약관 · 기본 정보 · 지역 · 사진 · 소개 */
export const REGISTER_STEPS = 5;
const PROGRESS_KEY = 'proRegister_progressAt';

/** 진행 막대 — 앞 화면에서 보던 자리(sessionStorage)에서 지금 단계까지 차오른다(뒤로 가면 줄어든다) */
function RegisterProgress({ step }: { step: number }) {
  const to = (step / REGISTER_STEPS) * 100;
  const [from] = useState(() => {
    try {
      const prev = Number(sessionStorage.getItem(PROGRESS_KEY));
      if (prev > 0) return (prev / REGISTER_STEPS) * 100;
    } catch { /* 저장소 막힘 */ }
    return ((step - 1) / REGISTER_STEPS) * 100;
  });
  useEffect(() => {
    try { sessionStorage.setItem(PROGRESS_KEY, String(step)); } catch { /* 저장소 막힘 */ }
  }, [step]);
  return (
    <div className="flex flex-1 items-center gap-3 pl-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={REGISTER_STEPS} aria-valuenow={step} aria-label={`전체 ${REGISTER_STEPS}단계 중 ${step}단계`}>
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-[#F2F4F6]">
        <motion.span
          className="block h-full rounded-full bg-[#3182F6]"
          initial={{ width: `${from}%` }}
          animate={{ width: `${to}%` }}
          transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
        />
      </span>
      <span className="flex-none text-[13px] font-medium tabular-nums tracking-[0.2px] text-[#8B95A1]">
        <b className="font-semibold text-[#3182F6]">{step}</b> / {REGISTER_STEPS}
      </span>
    </div>
  );
}

export function RegisterShell({
  step,
  title,
  sub,
  eyebrow,
  right,
  onBack,
  cta,
  children,
  bodyClassName = '',
}: {
  /** 1~5. 없으면 진행 막대 없이 */
  step?: number;
  title: ReactNode;
  sub?: ReactNode;
  /** 제목 위 작은 파란 글씨 */
  eyebrow?: ReactNode;
  /** 머리 오른쪽(중간저장 등) */
  right?: ReactNode;
  onBack?: () => void;
  /** 아래 고정 칸(버튼) */
  cta?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}) {
  const router = useRouter();
  return (
    <div className="fixed inset-0 flex flex-col bg-white" style={{ height: '100dvh', letterSpacing: '-0.02em' }}>
      <header className="flex h-14 flex-none items-center gap-1 pl-2 pr-5">
        <button type="button" onClick={onBack || (() => router.back())} aria-label="뒤로가기" className="qd-back">
          <QdBackIcon />
        </button>
        {step ? <RegisterProgress step={step} /> : <div className="flex-1" />}
        {right}
      </header>
      <div className="flex-none px-6 pb-5 pt-2">
        {eyebrow && <p className="qd-a-title mb-1.5 text-[15px] font-semibold text-[#3182F6]">{eyebrow}</p>}
        <h1 className="qd-a-title m-0 text-[24px] font-semibold leading-[1.4] tracking-[-0.4px] text-[#191F28]">{title}</h1>
        {sub && <p className="qd-a-sub m-0 mt-2.5 text-[15px] leading-[1.5] text-[#8B95A1]">{sub}</p>}
      </div>
      <div className={`qd-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-8 ${bodyClassName}`}>{children}</div>
      {cta && (
        <div className="relative flex-none bg-white px-5 pt-2.5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-white to-white/0" />
          {cta}
        </div>
      )}
    </div>
  );
}

export function RgCta({ disabled, onClick, children, ghost, type = 'button' }: { disabled?: boolean; onClick?: () => void; children: ReactNode; ghost?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button type={type} className={`qd-cta${ghost ? ' ghost' : ''}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

export function RgCheck({ on, small }: { on: boolean; small?: boolean }) {
  return (
    <span className={`rg-chk${small ? ' sm' : ''}${on ? ' on' : ''}`} aria-hidden="true">
      <svg width={small ? 12 : 14} height={small ? 12 : 14} viewBox="0 0 14 14" fill="none">
        <path d="M3 7.2l2.6 2.6L11 4.4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** 선택 카드 — 퀵매칭 선택지(60 · 1.5px · 모서리 16, 고르면 파랑) */
export function RgOption({
  on,
  onClick,
  label,
  hint,
  icon,
  right,
  check = true,
  role = 'checkbox',
}: {
  on: boolean;
  onClick: () => void;
  label: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  right?: ReactNode;
  /** 왼쪽 동그라미 체크(없으면 오른쪽 right 만) */
  check?: boolean;
  role?: 'checkbox' | 'radio';
}) {
  return (
    <button type="button" role={role} aria-checked={on} onClick={onClick} className={`rg-opt${hint || icon ? ' tall' : ''}${on ? ' on' : ''}`}>
      {check && <RgCheck on={on} />}
      {icon}
      <span className="rg-opt-t">
        {label}
        {hint && <span className="rg-opt-hint">{hint}</span>}
      </span>
      {right}
    </button>
  );
}

/** 칩(여러 개 고르기) — .ft-chip, 고르면 연파랑 */
export function RgChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button type="button" aria-pressed={on} onClick={onClick} whileTap={{ scale: 0.94 }} className={`ft-chip${on ? ' on' : ''}`} style={{ transition: 'background-color .15s ease, color .15s ease' }}>
      {children}
    </motion.button>
  );
}

/** 스위치 — 손잡이가 스프링으로 미끄러진다(AI 응답설정 스위치와 같은 결) */
export function RgToggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 py-2 text-left disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-[16px] font-semibold tracking-[-0.3px] text-[#191F28]">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] text-[#8B95A1]">{hint}</span>}
      </span>
      <span className={`relative h-7 w-12 flex-none rounded-full transition-colors duration-200 ${checked ? 'bg-[#3182F6]' : 'bg-[#D1D6DB]'}`}>
        <motion.span
          className="absolute left-0 top-0.5 h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
          initial={false}
          animate={{ x: checked ? 22 : 2 }}
          transition={{ type: 'spring', stiffness: 520, damping: 34 }}
        />
      </span>
    </button>
  );
}

/** 입력 묶음 — 라벨 · (입력) · 도움말/오류 */
export function RgField({ label, hint, error, children, className = '' }: { label?: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`rg-section ${className}`}>
      {label && <span className="rg-label">{label}</span>}
      {children}
      {error ? <p className="rg-error">{error}</p> : hint ? <p className="rg-hint">{hint}</p> : null}
    </div>
  );
}
