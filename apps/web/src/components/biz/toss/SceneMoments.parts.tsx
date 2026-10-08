'use client';

import type { CSSProperties, ReactNode } from 'react';

/*
 * '순간' 장면 조각 — 유리 느낌 작은 칸(문구 칩) · 흰 알약 버튼 · 3차 베지어 풀이.
 * 칸 안쪽은 238px 판으로 그리고 바깥에서 scale 로 줄인다(데스크톱 238 · 모바일 160 · 태블릿 208 같은 그림).
 */

/** cubic-bezier(x1,y1,x2,y2) — t(0~1) → 진행 값. 뉴턴 + 이분법 */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const e = sx(t) - x;
      const d = dx(t);
      if (Math.abs(e) < 1e-5) return sy(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 24; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-5) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

const INK = 'rgb(78,89,104)';
const INK2 = 'rgb(51,61,75)';
const SUB = 'rgb(139,149,161)';

/* 칸마다 다른 파스텔 유리 바탕(라벤더 · 분홍 · 하늘) */
const BG: string[] = [
  'radial-gradient(120% 70% at 50% 108%, rgba(214,228,250,0.95) 0%, rgba(214,228,250,0) 60%), linear-gradient(180deg,#F7F9FD 0%,#EEF3FB 100%)',
  'radial-gradient(90% 70% at 20% 0%, rgba(250,226,234,0.9) 0%, rgba(250,226,234,0) 70%), linear-gradient(165deg,#FBF3F6 0%,#F5F1F8 55%,#F3F4FB 100%)',
  'radial-gradient(80% 80% at 90% 10%, rgba(232,224,252,0.95) 0%, rgba(232,224,252,0) 70%), linear-gradient(170deg,#F7F4FD 0%,#F2F1FB 60%,#F1F4FC 100%)',
  'linear-gradient(180deg,#F4F3FD 0%,#EEF2FC 100%)',
  'radial-gradient(90% 60% at 20% 0%, rgba(214,236,250,0.95) 0%, rgba(214,236,250,0) 70%), linear-gradient(180deg,#F0F7FD 0%,#F6F9FD 100%)',
  'linear-gradient(180deg,#F3F6FB 0%,#F8FAFD 100%)',
];

function Icon({ i }: { i: number }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (i) {
    case 0: // 확인 배지
      return <svg viewBox="0 0 24 24" width="26" height="26" {...p}><path d="M12 2.8l2.4 1.7 2.9-.1.9 2.8 2.3 1.8-.9 2.8.9 2.8-2.3 1.8-.9 2.8-2.9-.1L12 21.2l-2.4-1.7-2.9.1-.9-2.8-2.3-1.8.9-2.8-.9-2.8 2.3-1.8.9-2.8 2.9.1z" /><path d="M8.6 12.2l2.3 2.3 4.6-4.8" /></svg>;
    case 2: // 문서
      return <svg viewBox="0 0 24 24" width="24" height="24" {...p}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></svg>;
    case 3: // 방패
      return <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M12 2.5l7.5 3v6c0 4.6-3.2 8.4-7.5 10-4.3-1.6-7.5-5.4-7.5-10v-6z" opacity=".9" /><path d="M8.7 12l2.3 2.3 4.4-4.6" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case 4: // 위치
      return <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" /></svg>;
    default: // 말풍선
      return <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z" /></svg>;
  }
}

/** 유리 칸 안쪽(238 판) — 토스 미니앱 위젯 자리를 프리티풀 문구 칩으로 */
export function GlassTile({ label, variant }: { label: string; variant: number }) {
  const v = variant % 6;
  const base: CSSProperties = { position: 'absolute', inset: 0, background: BG[v] };
  let body: ReactNode = null;
  if (v === 0) {
    body = (
      <>
        <div style={{ position: 'absolute', left: '50%', top: 64, width: 300, height: 300, marginLeft: -150, borderRadius: '50%', background: 'radial-gradient(circle at 50% 40%, rgba(255,255,255,0.9), rgba(226,236,250,0.4) 60%, rgba(226,236,250,0) 72%)' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 92, display: 'flex', justifyContent: 'center', color: 'rgb(49,130,246)' }}><Icon i={0} /></div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 134, textAlign: 'center', fontSize: 22, fontWeight: 600, color: INK2, letterSpacing: '-0.02em' }}>{label}</div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 166, display: 'flex', justifyContent: 'center', gap: 6 }}>
          {[0, 1, 2].map((i) => <i key={i} style={{ width: 5, height: 5, borderRadius: 3, background: i === 1 ? 'rgba(49,130,246,0.55)' : 'rgba(139,149,161,0.35)' }} />)}
        </div>
      </>
    );
  } else if (v === 1) {
    body = (
      <>
        <div style={{ position: 'absolute', left: 28, top: 150, fontSize: 30, fontWeight: 700, color: INK, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{label}</div>
        <div style={{ position: 'absolute', left: 30, top: 194, display: 'flex', gap: 3, color: 'rgba(78,89,104,0.28)' }}>
          {[0, 1, 2, 3, 4].map((i) => <svg key={i} viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z" /></svg>)}
        </div>
      </>
    );
  } else if (v === 2) {
    body = (
      <>
        <div style={{ position: 'absolute', left: 52, top: 96, width: 170, height: 92, borderRadius: 16, transform: 'rotate(-12deg)', background: 'linear-gradient(135deg, rgba(255,255,255,0.75), rgba(255,255,255,0.25))', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.8)' }} />
        <div style={{ position: 'absolute', left: 30, top: 70, color: 'rgba(78,89,104,0.55)' }}><Icon i={2} /></div>
        <div style={{ position: 'absolute', left: 24, top: 168, fontSize: 13, fontWeight: 500, color: SUB }}>Freetiful</div>
        <div style={{ position: 'absolute', left: 24, top: 190, fontSize: 20, fontWeight: 600, color: INK2, letterSpacing: '-0.02em' }}>{label}</div>
      </>
    );
  } else if (v === 3) {
    const on = [1, 2, 5, 7, 8, 9, 12, 14, 18, 19, 21, 22, 27, 30];
    body = (
      <>
        <div style={{ position: 'absolute', left: 8, top: 8, display: 'grid', gridTemplateColumns: 'repeat(8, 22px)', gap: 6 }}>
          {Array.from({ length: 64 }, (_, i) => (
            <i key={i} style={{ width: 22, height: 22, borderRadius: 4, background: on.includes(i % 32) ? 'rgba(198,206,240,0.55)' : 'rgba(222,226,247,0.35)' }} />
          ))}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 74, display: 'flex', justifyContent: 'center', color: INK2 }}><Icon i={3} /></div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 108, textAlign: 'center', fontSize: 21, fontWeight: 600, color: INK2, letterSpacing: '-0.02em' }}>{label}</div>
      </>
    );
  } else if (v === 4) {
    body = (
      <>
        <div style={{ position: 'absolute', left: 24, top: 26, fontSize: 32, fontWeight: 500, color: 'rgb(102,152,196)', letterSpacing: '-0.03em', lineHeight: 1.15 }}>{label}</div>
        <div style={{ position: 'absolute', right: 20, top: 30, display: 'flex', alignItems: 'center', gap: 3, height: 24, padding: '0 9px', borderRadius: 12, background: 'rgba(255,255,255,0.7)', color: 'rgb(102,152,196)', fontSize: 11, fontWeight: 600 }}>
          <Icon i={4} />KR
        </div>
      </>
    );
  } else {
    body = (
      <>
        <div style={{ position: 'absolute', left: 24, top: 26, display: 'flex', alignItems: 'center', gap: 8, color: INK2 }}>
          <Icon i={5} />
          <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>{label}</span>
        </div>
        <div style={{ position: 'absolute', left: 24, right: 24, top: 70, display: 'flex', gap: 3 }}>
          {Array.from({ length: 30 }, (_, i) => <i key={i} style={{ flex: 1, height: 18, borderRadius: 2, background: i < 19 ? 'rgba(126,160,214,0.55)' : 'rgba(126,160,214,0.18)' }} />)}
        </div>
      </>
    );
  }
  return (
    <div style={base}>
      {body}
      <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.6)' }} />
    </div>
  );
}

/** 흰 알약 버튼(글자 + 오른쪽 검은 동그라미 화살표) */
export function WhitePill({ label, onClick, className, style }: { label: string; onClick: () => void; className?: string; style?: CSSProperties }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`smo-pill ${className || ''}`}
      style={style}
    >
      <span>{label}</span>
      <i aria-hidden>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8h9M8.8 4.2L12.5 8l-3.7 3.8" /></svg>
      </i>
    </button>
  );
}
