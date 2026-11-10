// 미션 화면 전용 선 아이콘(직접 그림) — 색은 currentColor.
type P = { className?: string };
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const IcCheck = ({ className }: P) => (
  <svg {...base} strokeWidth={2.8} className={className}><path d="M5.5 12.5l4.2 4.2 8.8-9.2" /></svg>
);
export const IcPencil = ({ className }: P) => (
  <svg {...base} className={className}><path d="M14.6 5.4l4 4L9 19H5v-4z" /><path d="M12.6 7.4l4 4" /></svg>
);
export const IcDoc = ({ className }: P) => (
  <svg {...base} className={className}><path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1-1.5z" /><path d="M9.5 12h5M9.5 15.5h5" /></svg>
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
