// 미션 화면 전용 선 아이콘(직접 그림) — 색은 currentColor.
type P = { className?: string };
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const IcCheck = ({ className }: P) => (
  <svg {...base} strokeWidth={2.8} className={className}><path d="M5.5 12.5l4.2 4.2 8.8-9.2" /></svg>
);
export const IcChevron = ({ className }: P) => (
  <svg {...base} className={className}><path d="M9.5 6l6 6-6 6" /></svg>
);
export const IcBack = ({ className }: P) => (
  <svg {...base} strokeWidth={2.4} className={className}><path d="M15 4.5L7.5 12l7.5 7.5" /></svg>
);
export const IcHelp = ({ className }: P) => (
  <svg viewBox="0 0 24 24" aria-hidden className={className}>
    <circle cx="12" cy="12" r="10" fill="currentColor" />
    <path d="M9.4 9.4a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.2-2.6 3.9" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" />
    <circle cx="12" cy="17.2" r="1.25" fill="#fff" />
  </svg>
);
