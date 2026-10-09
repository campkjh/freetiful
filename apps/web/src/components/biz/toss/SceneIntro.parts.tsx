'use client';

import Link from 'next/link';
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useBizLang, useT } from '@/lib/biz/i18n';
import BubbleTail, { TAIL_CORNER_CLASS } from '@/components/chat/BubbleTail';
import { HERO_TALL_MQ, INTRO } from './content';
import { scrollToElement } from './scene';

/*
 * 첫 장면(SceneIntro) 조각 — 기울어진 폰 · 폰 속 채팅 · 알약 단추 · 떠다니는 점 캔버스 · 장면 전용 CSS.
 * 치수는 토스 홈 실측값(1920×1080 디자인 판 기준)을 따르되, 그림 · 코드는 전부 새로 그린 것(폰 틀도 CSS 로 만든다).
 */

export const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/* ─── 장면 전용 CSS(클래스 앞머리 si-) ─────────────────────────────── */
export const SI_CSS = `
.si-root .break-keep{overflow-wrap:anywhere}
.si-desk{display:none}
@media (min-width:1024px) and (min-aspect-ratio:6/5) and (prefers-reduced-motion:no-preference){.si-desk{display:block}.si-stack{display:none}}
.si-hw{display:inline-block;white-space:pre;will-change:transform,opacity;transition:transform .8s cubic-bezier(.16,1,.3,1) calc(var(--i)*100ms),opacity .8s cubic-bezier(.16,1,.3,1) calc(var(--i)*100ms);animation:si-rise .8s cubic-bezier(.16,1,.3,1) calc(var(--i)*100ms + 200ms) backwards}
.si-hero-h[data-gone] .si-hw{transform:translate3d(0,-40px,0);opacity:0;transition-delay:calc(var(--r)*100ms)}
@keyframes si-rise{from{transform:translate3d(0,40px,0);opacity:0}to{transform:none;opacity:1}}
.si-tt{opacity:0;transition:opacity .8s ease}
.si-tt[data-on]{opacity:1}
.si-hl{display:block;opacity:0;transform:translate3d(0,24px,0);filter:blur(16px);transition:opacity 1s cubic-bezier(.37,.31,0,1),transform 1s cubic-bezier(.37,.31,0,1),filter 1s cubic-bezier(.37,.31,0,1)}
[data-rev] .si-hl{opacity:1;transform:none;filter:blur(0);transition-delay:calc(var(--i)*100ms)}
.si-row{opacity:0;transform:translate3d(0,60px,0)}
[data-rev] .si-row{opacity:1;transform:none;transition:opacity .5s cubic-bezier(.25,.46,.45,.94) calc(500ms + var(--i)*100ms),transform .5s cubic-bezier(.25,.46,.45,.94) calc(500ms + var(--i)*100ms)}
.si-chipw{opacity:0;transform:translate3d(0,24px,0) scale(.96);transition:opacity .4s ease,transform .4s ease}
[data-rev] .si-chipw{opacity:1;transform:none;transition:opacity .7s cubic-bezier(.25,1,.5,1) calc(900ms + var(--i)*120ms),transform .9s cubic-bezier(.25,1,.5,1) calc(900ms + var(--i)*120ms)}
.si-chip{animation:si-float 6.5s ease-in-out calc(var(--i)*-2.1s) infinite;transition:box-shadow .5s cubic-bezier(.25,.46,.45,.94),background-color .5s ease}
.si-chip>span{transition:transform .5s cubic-bezier(.25,.46,.45,.94),opacity .5s ease}
@keyframes si-float{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-9px,0)}}
.si-acc-t{color:rgba(51,56,64,.2);padding:calc(20px*var(--k)) 0;transition:color .5s cubic-bezier(.25,.46,.45,.94),padding-bottom .5s cubic-bezier(.25,.46,.45,.94)}
.si-acc-t:hover{color:rgba(51,56,64,.42)}
[data-on]>.si-acc-t{color:rgb(51,56,64);padding-bottom:calc(4px*var(--k))}
.si-pill{-webkit-tap-highlight-color:transparent}
.si-pill .si-ch{display:inline-block;white-space:pre;transition:transform .195s cubic-bezier(.37,.06,.84,.75),opacity .195s cubic-bezier(.37,.06,.84,.75),filter .195s cubic-bezier(.37,.06,.84,.75)}
.si-pill .si-cb .si-ch{transform:translate3d(0,16px,0);opacity:0}
.si-pill .si-trk{transform:translate3d(-21px,0,0);transition:transform .3s cubic-bezier(.61,0,0,.6)}
@media (hover:hover){
.si-pill:hover .si-ct .si-ch{transform:translate3d(0,-16px,0);opacity:0;filter:blur(4px);transition-duration:.27s;transition-timing-function:cubic-bezier(.31,.52,.35,1);transition-delay:calc(var(--i)*5ms)}
.si-pill:hover .si-cb .si-ch{transform:none;opacity:1;transition-duration:.27s;transition-timing-function:cubic-bezier(.31,.52,.35,1);transition-delay:calc(var(--i)*5ms)}
.si-pill:hover .si-trk{transform:translate3d(7px,0,0)}
}
.si-pill:focus-visible .si-ct .si-ch{transform:translate3d(0,-16px,0);opacity:0;filter:blur(4px)}
.si-pill:focus-visible .si-cb .si-ch{transform:none;opacity:1}
.si-pill:focus-visible .si-trk{transform:translate3d(7px,0,0)}
@keyframes si-pop{0%{opacity:0;transform:translate3d(0,10px,0) scale(.62)}45%{opacity:1}100%{opacity:1;transform:none}}
.si-msg{animation:si-pop .42s cubic-bezier(.2,.9,.3,1) both}
@keyframes si-slot{from{opacity:0;transform:translate3d(0,6px,0)}to{opacity:1;transform:none}}
.si-slot{animation:si-slot .4s cubic-bezier(.2,.9,.3,1) calc(240ms + var(--i)*110ms) both}
@keyframes si-ck{0%{transform:scale(0)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
.si-ck{animation:si-ck .36s cubic-bezier(.34,1.56,.64,1) calc(330ms + var(--i)*110ms) both}
@keyframes si-dot{0%,70%,100%{transform:translate3d(0,0,0);opacity:.35}35%{transform:translate3d(0,-3px,0);opacity:1}}
.si-dot{animation:si-dot 1.1s ease-in-out infinite}
.si-fu{opacity:0;transform:translate3d(0,80px,0);transition:opacity .7s cubic-bezier(.25,1,.5,1),transform .7s cubic-bezier(.25,1,.5,1)}
.si-fu[data-in]{opacity:1;transform:none}
.si-mphone{--ps:.74}
/* 아주 좁은 폰(320 — SE 1세대 · 작은 안드)은 기운 폰 오른쪽 위 옆면이 카드 오른쪽 끝에 2px 걸려 잘렸다 → 그 폭에서만 조금 작게(261009 검증) */
@media (max-width:340px){.si-mphone{--ps:.68}}
@media (min-width:768px){.si-mphone{--ps:.86}}
/* 첫 장면 영상 · 포스터 구도(261009) — 폰 세로는 세로 편집본이라 가운데, 그 밖(태블릿 · 가로 폰)은 가로 영상 62% */
.si-hpos{object-position:${INTRO.heroPos.mob}}
@media ${HERO_TALL_MQ}{.si-hpos{object-position:${INTRO.heroPos.tall}}}
.si-mhero{--t:56px;--s:20px;--b:calc(96px + env(safe-area-inset-bottom,0px));--r:40px;height:100vh;height:100svh;min-height:540px}
@media (min-width:768px){.si-mhero{--t:64px;--s:24px;--b:24px;--r:40px}}
.si-mclip{clip-path:inset(var(--t) var(--s) var(--b) round var(--r));transition:clip-path 1s cubic-bezier(.33,1,.68,1)}
.si-mhero[data-x] .si-mclip{clip-path:inset(0px 0px 0px round 0px);transition-duration:.8s}
.si-mvid{transform:translate3d(-50%,-50%,0) scale(1.2);transition:transform 1s cubic-bezier(.33,1,.68,1)}
.si-mhero[data-x] .si-mvid{transform:translate3d(-50%,-50%,0) scale(1);transition-duration:.8s}
.si-mhl{display:block;transition:transform .9s cubic-bezier(.33,1,.68,1) calc(var(--i)*75ms),opacity .9s cubic-bezier(.33,1,.68,1) calc(var(--i)*75ms)}
.si-mhero[data-x] .si-mhl{transform:translate3d(0,-40px,0);opacity:0;transition-duration:.45s}
@media (prefers-reduced-motion:reduce){
.si-hw{animation:none}
.si-fu{opacity:1;transform:none;transition:none}
.si-msg,.si-dot,.si-chip,.si-slot,.si-ck{animation:none}
.si-mclip,.si-mvid,.si-mhl{transition:none}
}
`;

/* ─── 영상 반복 구간 자르기 — 영상 끝이 행사 장면이 아니면(옛 송년회 영상: 끝 1.7초가 흰 화면) 그 앞에서 처음으로 돌린다 ───
 * 끝 초 = INTRO.heroLoopEnd. 261009 corporate-mc 히어로 영상으로 바꾸며 null(끝까지 행사 장면 → 그대로 loop) */
type FrameCbVideo = HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number; cancelVideoFrameCallback?: (id: number) => void };
/** 영상 요소에 반복 구간 자르기를 붙인다 — 떼는 함수를 돌려준다 */
export function attachTrimLoop(el: HTMLVideoElement): () => void {
  const end = INTRO.heroLoopEnd;
  if (!end) return () => {};
  const v = el as FrameCbVideo;
  let id = 0;
  const back = () => {
    if (v.currentTime >= end) v.currentTime = 0.04;
  };
  if (typeof v.requestVideoFrameCallback === 'function') {
    const tick = () => {
      back();
      id = v.requestVideoFrameCallback!(tick);
    };
    id = v.requestVideoFrameCallback(tick);
    return () => v.cancelVideoFrameCallback?.(id);
  }
  v.addEventListener('timeupdate', back);
  return () => v.removeEventListener('timeupdate', back);
}
export function useTrimLoop(ref: React.RefObject<HTMLVideoElement>) {
  useEffect(() => {
    const v = ref.current;
    return v ? attachTrimLoop(v) : undefined;
  }, [ref]);
}

/* ─── 아이콘(직접 그린 단순 도형) ─────────────────────────────────── */
function ArrowIcon({ size = 14, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.2 7h9.4M7.6 2.9 11.7 7l-4.1 4.1" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatusBar({ tone = '#191F28' }: { tone?: string }) {
  return (
    <div className="absolute inset-x-0 top-0 z-[3] flex h-[30px] items-center justify-between bg-white px-[26px] pt-[3px]" style={{ color: tone }}>
      <span className="text-[12.5px] font-semibold tracking-[-0.2px]">9:41</span>
      <span className="flex items-center gap-[4px]" aria-hidden="true">
        <svg width="15" height="10" viewBox="0 0 15 10" fill="currentColor"><rect x="0" y="6.4" width="2.5" height="3.6" rx=".6" /><rect x="4.1" y="4.4" width="2.5" height="5.6" rx=".6" /><rect x="8.2" y="2.3" width="2.5" height="7.7" rx=".6" /><rect x="12.3" y="0" width="2.5" height="10" rx=".6" /></svg>
        <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor"><path d="M7 2.1c2.1 0 4 .8 5.4 2.2l1.1-1.1A9.1 9.1 0 0 0 7 .5 9.1 9.1 0 0 0 .5 3.2l1.1 1.1A7.6 7.6 0 0 1 7 2.1Zm0 3c1.2 0 2.4.5 3.2 1.3l1.1-1.1A6.1 6.1 0 0 0 7 3.6 6.1 6.1 0 0 0 2.7 5.3l1.1 1.1C4.6 5.6 5.8 5.1 7 5.1Zm0 3c.4 0 .8.2 1.1.4L7 9.6 5.9 8.5c.3-.2.7-.4 1.1-.4Z" /></svg>
        <svg width="23" height="11" viewBox="0 0 23 11" fill="none"><rect x=".5" y=".5" width="19" height="10" rx="3" stroke="currentColor" opacity=".38" /><rect x="2" y="2" width="16" height="7" rx="1.7" fill="currentColor" /><path d="M21 3.8v3.4c.7-.2 1.1-.9 1.1-1.7S21.7 4 21 3.8Z" fill="currentColor" opacity=".4" /></svg>
      </span>
    </div>
  );
}

/* ─── 알약 단추(글자 굴림 + 화살표 밀기) ────────────────────────────── */
export function PillCta({ label, href, size = 'md' }: { label: string; href: string; size?: 'md' | 'sm' }) {
  const chars = Array.from(label);
  const fs = size === 'md' ? 'calc(16px*var(--k,1))' : '14px';
  const lh = size === 'md' ? 'calc(25.6px*var(--k,1))' : '22.4px';
  const inner = (
    <>
      <span className="relative block overflow-hidden" style={{ height: lh }}>
        <span className="si-ct block" aria-hidden="true">
          {chars.map((c, i) => <span key={i} className="si-ch" style={{ '--i': i } as CSSProperties}>{c}</span>)}
        </span>
        <span className="si-cb absolute inset-0 block" aria-hidden="true">
          {chars.map((c, i) => <span key={i} className="si-ch" style={{ '--i': i } as CSSProperties}>{c}</span>)}
        </span>
        <span className="sr-only">{label}</span>
      </span>
      <span className="block pl-[12px] pr-[10px]" aria-hidden="true">
        <span className="relative block h-[28px] w-[28px] overflow-hidden rounded-[80px] bg-[#1C1F25]">
          <span className="si-trk absolute left-0 top-[7px] flex gap-[14px]">
            <ArrowIcon />
            <ArrowIcon />
          </span>
        </span>
      </span>
    </>
  );
  const cls = 'si-pill inline-flex h-[48px] items-center rounded-[136px] border border-[rgba(13,25,74,0.04)] bg-[rgba(7,25,76,0.05)] pl-[18px] font-semibold text-[#1C1F25] backdrop-blur-[10px] transition-colors duration-200 hover:bg-[rgba(3,31,63,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3182F6]/40';
  const style: CSSProperties = { fontSize: fs, lineHeight: lh, letterSpacing: '-0.02em' };
  // '#…' = 같은 화면 섹션으로 스크롤, '/…' 경로(예: /biz/inquiry 상담 채팅 — 261009 문의 폼 섹션 삭제)는 아래 Link 로 라우터 이동
  if (href.startsWith('#')) {
    const id = href.slice(1);
    return (
      <button
        type="button"
        className={cls}
        style={style}
        onClick={() => {
          const el = document.getElementById(id);
          if (el) scrollToElement(el);
        }}
      >
        {inner}
      </button>
    );
  }
  return (
    <Link href={href} className={cls} style={style}>
      {inner}
    </Link>
  );
}

/* ─── 기울어진 폰(토스 실측 기울기: 직교 투영 rotateX 21 · rotateY -2 · rotateZ 11.5 · scaleY 1.03) ───
 * 1920×1080 판 위 677×827 칸(969.67, 139.25)에 놓인다. 틀 두께는 같은 평면 안에서 오른쪽 아래로 쌓은 그림자 층으로 그린다(3D 층 없음 → GPU 가볍게).
 */
const PHONE_BOX = { left: 969.67, top: 139.25, width: 677, height: 827 };
export const SCREEN_W = 332;
const SCREEN_H = 745;
const TILT = 'translate(153.3px, 28.5px) rotateX(21deg) rotateY(-2deg) rotateZ(11.5deg) scaleY(1.03)';

/**
 * 폰 틀 치수(352×775 칸 안, 디자인 px) — 기울어진 폰(TiltPhone, 데스크톱)과 모바일 채팅 카드의 납작 폰(SceneIntro FlatPhone)이 같이 쓴다.
 * 금속 테 2 · 검은 베젤 9.5(위 · 아래 · 옆 같음) · 모서리 60 → 58 → 48(안쪽으로 들어간 만큼 줄어 한 중심을 공유) — 실제 아이폰 비율에 가깝게.
 * 261009 사장 '모바일 폰 UI 상단이 이상함, 다이나믹 아일랜드 위쪽? r값이랑 뭔가 잘린다' — 납작 폰만 따로 베젤 위 11.5 · 옆 6.5 · 모서리 60/48 이라
 *   위가 두껍고 모서리가 어긋나 보였다. 이제 두 폰이 이 한 벌을 쓴다.
 */
export const PHONE_FRAME = {
  rim: { left: -1.5, top: 3.5, width: 355, height: 768, borderRadius: 60 },
  bezel: { left: 0.5, top: 5.5, width: 351, height: 764, borderRadius: 58 },
  screen: { left: 10, top: 15, width: SCREEN_W, height: SCREEN_H, borderRadius: 48 },
} as const;
export const PHONE_RIM_BG = 'linear-gradient(160deg, #FFFFFF 0%, #C9D2DF 18%, #F1F4F8 42%, #A7B2C4 70%, #E6EAF0 100%)';
export const PHONE_BEZEL = { background: '#08090C', boxShadow: 'inset 0 0 0 1.2px #30353E' } as const;
/** 화면 위 다이나믹 아일랜드(화면 332 폭 기준 98×27, 위에서 9) */
export function PhoneIsland() {
  return <div className="absolute left-1/2 top-[9px] z-[5] h-[27px] w-[98px] -translate-x-1/2 rounded-full bg-[#050608]" />;
}

/** 옆면(금속 띠) 층 — 폰 평면 안에서 (u, v) 쪽으로 n 장을 조금씩 밀어 쌓는다. 앞 → 뒤로 밝은 은색 → 어두운 회청색 */
function bandLayers(u: number, v: number, n: number) {
  const stops: [number, [number, number, number]][] = [
    [0, [246, 248, 252]],
    [0.1, [196, 205, 220]],
    [0.32, [156, 168, 188]],
    [0.62, [136, 149, 171]],
    [0.86, [112, 125, 147]],
    [1, [74, 84, 103]],
  ];
  const col = (f: number) => {
    let i = 0;
    while (i < stops.length - 2 && f > stops[i + 1][0]) i += 1;
    const [f0, c0] = stops[i];
    const [f1, c1] = stops[i + 1];
    const k = (f - f0) / (f1 - f0 || 1);
    return `rgb(${c0.map((x, j) => Math.round(x + (c1[j] - x) * k)).join(',')})`;
  };
  return Array.from({ length: n }, (_, i) => {
    const f = (i + 1) / n;
    return `${(u * f).toFixed(2)}px ${(v * f).toFixed(2)}px 0 ${col(f)}`;
  }).join(',');
}
const BAND_SHADOW = (() => {
  // 화면 기준 두께 벡터(디자인 px) → 폰 평면 안의 밀기 값으로 되돌려 층마다 조금씩 민다
  const ex = 15, ey = 17;
  const a = 0.979328, b = -0.205224, c = 0.17387, d = 0.944852;
  const det = a * d - b * c;
  return bandLayers((d * ex - b * ey) / det, (-c * ex + a * ey) / det, 22);
})();
/**
 * 납작 폰(모바일 채팅 카드 — -6° 기운 2D 폰) 옆면. 예전엔 한 장짜리 그림자(10px 14px, 퍼짐 -2)라 위 · 오른쪽 모서리에서
 * 둥근 판이 계단처럼 따로 삐져나와 '잘린' 것처럼 보였다(261009). 데스크톱 폰처럼 층을 쌓아 테두리와 이어지게.
 */
export const FLAT_BAND_SHADOW = bandLayers(8, 11, 16);

export function TiltPhone({ screen, pop }: { screen: ReactNode; pop?: ReactNode }) {
  return (
    <div className="absolute" style={{ left: PHONE_BOX.left, top: PHONE_BOX.top, width: PHONE_BOX.width, height: PHONE_BOX.height }} aria-hidden="true">
      <div className="absolute left-0" style={{ top: 5, width: 352, height: 775, transformOrigin: '176px 387.5px', transform: TILT }}>
        {/* 옆면(금속 띠) — 같은 모양을 오른쪽 아래로 층층이 밀어 두께를 만든다 */}
        <div className="absolute" style={{ ...PHONE_FRAME.rim, background: '#B9C3D3', boxShadow: BAND_SHADOW }} />
        {/* 옆 단추 */}
        <div className="absolute rounded-[3px]" style={{ left: 351.5, top: 214, width: 6, height: 68, background: 'linear-gradient(90deg, #DDE3EC, #9AA6BA)', boxShadow: '3px 3px 0 #7D899E' }} />
        <div className="absolute rounded-[3px]" style={{ left: 351.5, top: 296, width: 6, height: 68, background: 'linear-gradient(90deg, #DDE3EC, #9AA6BA)', boxShadow: '3px 3px 0 #7D899E' }} />
        {/* 아랫면 스피커 구멍 · 단자 */}
        <div className="absolute flex items-center gap-[7px]" style={{ left: 176 - 78 + 9, top: 771.5 + 6, transform: 'skewX(-12deg)' }}>
          {[0, 1, 2, 3, 4].map((d) => <span key={d} className="block h-[4px] w-[4px] rounded-full bg-[#4A5466]" />)}
          <span className="mx-[10px] block h-[5px] w-[34px] rounded-full bg-[#3E4757]" />
          {[0, 1, 2, 3, 4].map((d) => <span key={d} className="block h-[4px] w-[4px] rounded-full bg-[#4A5466]" />)}
        </div>
        {/* 앞 테두리(얇은 금속 테) */}
        <div className="absolute" style={{ ...PHONE_FRAME.rim, background: PHONE_RIM_BG }} />
        {/* 검은 베젤 */}
        <div className="absolute" style={{ ...PHONE_FRAME.bezel, ...PHONE_BEZEL }} />
        {/* 화면 */}
        <div className="absolute overflow-hidden" style={{ ...PHONE_FRAME.screen, background: '#F2F4F6', isolation: 'isolate' }}>
          {screen}
          <PhoneIsland />
        </div>
        {/* 화면 밖으로 튀어나오는 카드 층(잘리지 않음) */}
        {pop && <div className="pointer-events-none absolute" style={{ left: 10, top: 15, width: SCREEN_W, height: SCREEN_H }}>{pop}</div>}
      </div>
    </div>
  );
}

/* ─── 폰 속 채팅(프리티풀 앱 채팅방 어법) ──────────────────────────────
 * 261009 사장 '견적 문의부터 섭외까지 채팅 한 번으로 — 사회자랑 채팅하는 것처럼 말고, 기업 담당자랑 프리티풀이 기업 및 웨딩홀에
 *   스케줄 같은 걸 보내는 것처럼, 서로 소통하는 것처럼'. → 웨딩홀 담당자(오른쪽) ↔ 프리티풀 비즈(왼쪽)가
 *   예식 타임표 → 사회자 배정 일정표 → 기업 송년회 순서표 → 리허설 확인을 주고받는다(문구 = content.ts INTRO.chat*).
 * 말풍선은 프리티풀 채팅방(app/(main)/chat/[id])과 같은 결: 파랑 #3180F7 · 회색 #F2F3F5, 묶음 마지막 말풍선에만 꼬리(BubbleTail)와 시각,
 *   상대 묶음 첫 말풍선에만 프로필, 새 말풍선은 bubbleGrow 와 같은 값(si-msg). 파일 · 일정표는 채팅방 파일 말풍선처럼 같은 말풍선 안에 그린다.
 */
type ThreadItem = { kind: 'msg'; i: number } | { kind: 'timetable' } | { kind: 'schedule' } | { kind: 'program' };
/** 대화 순서 — 글은 INTRO.chatMessages[i], 카드는 chatTimetable · chatScheduleCard · chatProgram */
const THREAD: ThreadItem[] = [
  { kind: 'msg', i: 0 },
  { kind: 'timetable' },
  { kind: 'msg', i: 1 },
  { kind: 'schedule' },
  { kind: 'msg', i: 2 },
  { kind: 'program' },
  { kind: 'msg', i: 3 },
];
const isMine = (it: ThreadItem) => (it.kind === 'msg' ? INTRO.chatMessages[it.i].me : it.kind !== 'schedule');

type ChatStep = { show: number; typing?: boolean };
/** 단계: 말풍선이 하나씩 — 프리티풀 답장 앞엔 입력 중 점 세 개(담당자가 이어 보내는 파일은 바로) */
export const CHAT_STEPS: ChatStep[] = [
  { show: 1 },
  { show: 2 },
  { show: 2, typing: true },
  { show: 3 },
  { show: 3, typing: true },
  { show: 4 },
  { show: 5 },
  { show: 6 },
  { show: 6, typing: true },
  { show: 7 },
];
const CHAT_DATE = '2026.11.09';
const CHAT_TIMES = ['10:02', '10:02', '10:05', '10:08', '10:11', '10:11', '10:13'];
/** 프리티풀 채팅방과 같은 말풍선 색 */
const ME_BG = '#3180F7';
const OTHER_BG = '#F2F3F5';

/** 프리티풀 비즈 프로필 — 로고 앞 'F' 표시(logo-prettyful.svg 왼쪽 53.8/379 칸)만 잘라 동그라미 안에 */
function BizAvatar({ size }: { size: number }) {
  const h = Math.round(size * 0.56);
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full border border-[#E5E8EB] bg-white" style={{ width: size, height: size }} aria-hidden="true">
      <span
        className="block"
        style={{ width: Math.round(h * 0.485 * 10) / 10, height: h, marginLeft: 1, backgroundImage: 'url(/images/logo-prettyful.svg)', backgroundSize: `auto ${h}px`, backgroundRepeat: 'no-repeat', backgroundPosition: '0 0' }}
      />
    </span>
  );
}

function CalendarIcon({ size = 16, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.2" y="3.2" width="11.6" height="10.6" rx="2.2" stroke={color} strokeWidth="1.5" />
      <path d="M2.6 6.6h10.8M5.4 1.8v2.6M10.6 1.8v2.6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="5.6" cy="9.6" r=".95" fill={color} />
      <circle cx="8" cy="9.6" r=".95" fill={color} />
      <circle cx="10.4" cy="9.6" r=".95" fill={color} />
    </svg>
  );
}

/** 말풍선 껍데기 — 꼬리가 붙는 모서리는 채팅방과 같이 8 로 줄인다(TAIL_CORNER_CLASS) */
function Shell({ me, tailed, className = '', children }: { me: boolean; tailed: boolean; className?: string; children: ReactNode }) {
  const bg = me ? ME_BG : OTHER_BG;
  return (
    <div className={`relative rounded-[18px] ${tailed ? (me ? TAIL_CORNER_CLASS.mine : TAIL_CORNER_CLASS.other) : ''} ${className}`} style={{ background: bg }}>
      {children}
      {tailed && <BubbleTail mine={me} color={bg} />}
    </div>
  );
}

/** 한 줄(말풍선 + 시각 · 프로필) — 묶음 첫 줄은 위 12, 이어지는 줄은 4 */
function Row({ me, first, time, children }: { me: boolean; first: boolean; time: string | null; children: ReactNode }) {
  const gap = first ? 'mt-[12px]' : 'mt-[4px]';
  const stamp = time ? <span className="mb-[1px] shrink-0 text-[10.5px] tabular-nums text-[#8B95A1]">{time}</span> : null;
  if (me) {
    return (
      <div className={`si-msg ${gap} flex items-end justify-end gap-[6px] pr-[2px]`} style={{ transformOrigin: '100% 100%' }}>
        {stamp}
        {children}
      </div>
    );
  }
  return (
    <div className={`si-msg ${gap} flex items-start gap-[7px] pl-[2px]`} style={{ transformOrigin: '0% 100%' }}>
      {first ? <BizAvatar size={30} /> : <span className="w-[30px] shrink-0" aria-hidden="true" />}
      <div className="flex min-w-0 items-end gap-[6px]">
        {children}
        {stamp}
      </div>
    </div>
  );
}

/** 파일 말풍선(담당자가 보내는 타임표 · 순서표) — 채팅방 파일 말풍선처럼 동그란 아이콘 + 이름 */
function FileBody({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex max-w-[214px] items-center gap-[9px] py-[9px] pl-[9px] pr-[13px]">
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white/20">
        <CalendarIcon />
      </span>
      <span className="min-w-0">
        <span className="block break-keep text-[13.5px] font-bold leading-[1.35] tracking-[-0.2px] text-white">{title}</span>
        <span className="mt-[2px] block break-keep text-[11.5px] leading-[1.4] tracking-[-0.1px] text-white/80">{sub}</span>
      </span>
    </div>
  );
}

/** 프리티풀이 돌려주는 배정 일정표 — 타임 줄이 차례로 들어오고 체크가 톡(si-slot · si-ck) */
function ScheduleBody() {
  const t = useT();
  const c = INTRO.chatScheduleCard;
  return (
    <div className="w-[210px] p-[10px]">
      <div className="flex items-center gap-[8px] px-[2px]">
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full" style={{ background: ME_BG }}>
          <CalendarIcon size={15} />
        </span>
        <span className="min-w-0">
          <span className="block break-keep text-[13.5px] font-bold leading-[1.3] tracking-[-0.2px] text-[#191F28]">{t(c.title)}</span>
          <span className="mt-[1px] block break-keep text-[11px] leading-[1.35] tracking-[-0.1px] text-[#6B7684]">{t(c.sub)}</span>
        </span>
      </div>
      <ul className="mt-[9px] rounded-[12px] bg-white px-[10px] py-[3px]">
        {c.slots.map((s, i) => (
          <li key={s} className="si-slot flex h-[26px] items-center gap-[8px] border-b border-[#F2F4F6] last:border-b-0" style={{ '--i': i } as CSSProperties}>
            <span className="w-[34px] shrink-0 text-[11.5px] font-semibold tabular-nums tracking-[-0.1px] text-[#191F28]">{s}</span>
            <span className="min-w-0 flex-1 truncate text-[11.5px] tracking-[-0.1px] text-[#4E5968]">
              {t(c.host)} {c.hosts[i]}
            </span>
            <span className="si-ck flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full" style={{ '--i': i, background: ME_BG } as CSSProperties}>
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="m2.4 5.2 1.8 1.8 3.5-3.7" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </li>
        ))}
      </ul>
      <p className="si-slot mt-[8px] break-keep px-[2px] text-[11.5px] font-semibold leading-[1.35] tracking-[-0.1px]" style={{ '--i': c.slots.length, color: ME_BG } as CSSProperties}>{t(c.done)}</p>
    </div>
  );
}

function Typing({ first }: { first: boolean }) {
  return (
    <Row me={false} first={first} time={null}>
      <Shell me={false} tailed>
        <div className="flex h-[37px] items-center gap-[4px] px-[14px]">
          {[0, 1, 2].map((i) => <span key={i} className="si-dot h-[6px] w-[6px] rounded-full bg-[#8B95A1]" style={{ animationDelay: `${i * 0.16}s` }} />)}
        </div>
      </Shell>
    </Row>
  );
}

/** 채팅 화면 전체(332×745 디자인 px) — step 0 이면 빈 대화 */
export function ChatScreen({ step, listMax }: { step: number; listMax?: number }) {
  const t = useT();
  const { lang } = useBizLang();
  const st = step > 0 ? CHAT_STEPS[Math.min(step, CHAT_STEPS.length) - 1] : null;
  const show = st ? st.show : 0;
  const typing = !!st?.typing;
  const listRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [off, setOff] = useState(0);
  useIsoLayoutEffect(() => {
    const l = listRef.current;
    const n = innerRef.current;
    if (!l || !n) return;
    setOff(Math.max(0, n.offsetHeight - l.clientHeight));
  }, [show, typing, lang]);
  const items = THREAD.slice(0, Math.min(show, THREAD.length));
  const last = items.length ? items[items.length - 1] : null;
  return (
    <div className="absolute inset-0 flex flex-col bg-white">
      <StatusBar />
      <div className="h-[30px] shrink-0" />
      {/* 머리줄 — 상대는 사회자 개인이 아니라 '프리티풀 비즈' 창구 */}
      <div className="relative z-[2] flex h-[50px] shrink-0 items-center border-b border-[#F2F4F6] bg-white px-[12px]">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true"><path d="M13.6 4.6 7.2 11l6.4 6.4" stroke="#191F28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span className="ml-[8px] flex min-w-0 flex-1 items-center gap-[5px]">
          <span className="truncate text-[15.5px] font-bold tracking-[-0.3px] text-[#191F28]">{t(INTRO.chatPartnerName)}</span>
          <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 .9l1.8 1.3 2.2-.1.7 2.1 1.8 1.3-.7 2.1.7 2.1-1.8 1.3-.7 2.1-2.2-.1L8 15.1l-1.8-1.3-2.2.1-.7-2.1-1.8-1.3.7-2.1-.7-2.1 1.8-1.3.7-2.1 2.2.1Z" fill="#3182F6" /><path d="m5.3 8.1 1.8 1.8 3.6-3.7" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="#191F28" aria-hidden="true"><circle cx="10" cy="4.4" r="1.7" /><circle cx="10" cy="10" r="1.7" /><circle cx="10" cy="15.6" r="1.7" /></svg>
      </div>
      {/* 대화 */}
      <div ref={listRef} className={`relative min-h-0 overflow-hidden ${listMax ? 'shrink-0' : 'flex-1'}`} style={listMax ? { height: listMax } : undefined}>
        {/* 위로 밀려 나간 말풍선 끝(꼬리 몇 px)이 머리줄 밑에 잘린 조각처럼 남지 않게 위 14px 을 흰색으로 흐린다(261009 확대 캡처 — 첫 줄 날짜는 14px 아래라 안 가린다) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[14px]" style={{ background: 'linear-gradient(#fff 25%, rgba(255,255,255,0))' }} aria-hidden="true" />
        <div ref={innerRef} className="px-[12px] pb-[14px] pt-[6px]" style={{ transform: `translate3d(0, ${-off}px, 0)`, transition: 'transform .5s cubic-bezier(.2,.8,.2,1)' }}>
          <p className="mb-[2px] mt-[8px] text-center text-[11px] text-[#8B95A1]">{CHAT_DATE}</p>
          {items.map((it, i) => {
            const me = isMine(it);
            const prev = i > 0 ? isMine(items[i - 1]) : null;
            // 꼬리는 입력 중 점까지 묶음으로 보고(점이 묶음 끝), 시각은 실제 말풍선만 본다
            const nextWithTyping = i + 1 < items.length ? isMine(items[i + 1]) : typing ? false : null;
            const nextReal = i + 1 < items.length ? isMine(items[i + 1]) : null;
            const tailed = nextWithTyping !== me;
            const time = nextReal !== me ? CHAT_TIMES[i] : null;
            let body: ReactNode;
            if (it.kind === 'msg') {
              body = (
                <Shell me={me} tailed={tailed}>
                  <p className={`${me ? 'max-w-[212px] text-white' : 'max-w-[196px] text-[#191F28]'} break-keep px-[13px] py-[9px] text-[14px] leading-[1.45] tracking-[-0.2px]`}>{t(INTRO.chatMessages[it.i].text)}</p>
                </Shell>
              );
            } else if (it.kind === 'schedule') {
              body = (
                <Shell me={false} tailed={tailed}>
                  <ScheduleBody />
                </Shell>
              );
            } else {
              const f = it.kind === 'timetable' ? INTRO.chatTimetable : INTRO.chatProgram;
              body = (
                <Shell me tailed={tailed}>
                  <FileBody title={t(f.title)} sub={t(f.sub)} />
                </Shell>
              );
            }
            return (
              <Row key={i} me={me} first={prev !== me} time={time}>
                {body}
              </Row>
            );
          })}
          {typing && <Typing first={!last || isMine(last)} />}
        </div>
      </div>
      {listMax ? <div className="flex-1" /> : null}
      {/* 입력 줄 */}
      <div className="flex h-[62px] shrink-0 items-center gap-[8px] bg-white px-[12px] pb-[6px]">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true"><path d="M11 4v14M4 11h14" stroke="#4E5968" strokeWidth="1.8" strokeLinecap="round" /></svg>
        <div className="flex h-[38px] min-w-0 flex-1 items-center justify-between rounded-full bg-[#F2F4F6] pl-[14px] pr-[8px]">
          <span className="truncate text-[13px] text-[#B0B8C1]">{t(INTRO.chatInputPlaceholder)}</span>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.4" fill="#B0B8C1" /><circle cx="7.3" cy="8.4" r="1.1" fill="#fff" /><circle cx="12.7" cy="8.4" r="1.1" fill="#fff" /><path d="M6.6 11.6c.8 1.3 2 2 3.4 2s2.6-.7 3.4-2" stroke="#fff" strokeWidth="1.3" fill="none" strokeLinecap="round" /></svg>
        </div>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="#C5CBD3" aria-hidden="true"><path d="M3.2 10.2 18.6 3.4c.5-.2 1 .3.8.8L12.6 19.6c-.2.5-1 .5-1.1-.1l-1.4-6.2c0-.2-.2-.3-.4-.4L3.3 11.4c-.6-.1-.6-.9-.1-1.2Z" /></svg>
      </div>
    </div>
  );
}

/* ─── 진행자 고르기 화면(긴 캡처) + 튀어나오는 카드 ───────────────────────
 * crop = 780px 너비 캡처 안 좌표. 폰 화면 332px 로 줄여 보인다(scale 332/780).
 * 261009 사장: 셋째 칸 = 'AI가 정리한 실제 후기'(운영 사회자 상세 AI 요약 캡처 — 조각은 3x 고해상도 piece 로),
 *   넷째 칸 = '프리티풀 엔터프라이즈 전담 솔루션'(캡처 대신 컴포넌트로 그린 사회자 배정 보드 — board).
 */
export type HostScreen = {
  key: string;
  /** 폰 화면 긴 캡처(780 폭) — board 칸은 null */
  src: string | null;
  h: number;
  offset: number;
  /** 튀어나오는 조각 자리(긴 캡처 좌표) */
  crop: { x: number; y: number; w: number; h: number } | null;
  /** crop 자리와 같은 내용을 따로 받은 고해상도 조각(모바일 카드 · 튀어나오는 조각이 이걸 쓴다) */
  piece?: string;
  /** 캡처 대신 배정 보드(ScheduleBoardScreen)를 그린다 */
  board?: boolean;
};
export const SCREEN_SCALE = SCREEN_W / 780;
export const HOST_SCREENS: HostScreen[] = [
  { key: 'pros', src: INTRO.listItems[0].screen, h: 4800, offset: 0, crop: { x: 18, y: 226, w: 744, h: 588 } },
  { key: 'profile', src: INTRO.listItems[1].screen, h: 4800, offset: -206, crop: { x: 18, y: 1050, w: 744, h: 286 } },
  // ai-review-tall = 390×1200 css 화면 3x 캡처를 780 폭으로 · ai-review = 그 안 css (10,190)–(380,402) 3x 조각(AI 요약 카드만 —
  // 261009 검증: 위 별점 줄은 앱이 내림으로 별을 채워 4.9 가 별 4개로 읽혀서 뺐다. 긴 화면 캡처엔 그대로 남지만 흐리게(0.2) 깔린다)
  { key: 'reviews', src: INTRO.listItems[2].screen, h: 2400, offset: 0, crop: { x: 20, y: 380, w: 740, h: 424 }, piece: INTRO.listItems[2].piece },
  { key: 'enterprise', src: null, h: 715, offset: 0, crop: null, board: true },
];
const POP_EASE = 'cubic-bezier(.6,0,0,.6)';

/* ─── 엔터프라이즈 칸: 사회자 배정 보드(261009) ─────────────────────────
 * '사회자가 하는 게 아니라 프리티풀이 스케줄 배정까지 다 해 준다' — 프리티풀 전담팀이 관리하는 배정 현황 화면을 앱 화면 결로 그린다.
 * 첫 채팅 장면과 겹쳐 보이지 않게(261009 검증 — 채팅 속 '일정표가 도착했어요'가 한 날짜의 타임별 사회자 표라서) 여기선 하루 표가 아니라
 * 주간 달력 + 여러 날 · 여러 행사를 한 줄씩 모은 '다가오는 배정' 목록(BoardListCard, 머리 = 프리티풀 전담팀). 변경 반영(B → C) 줄로 '변경 대응'도 보인다.
 * 같은 목록 카드를 폰 화면 · 튀어나오는 조각 · 모바일 카드가 함께 쓴다. 높이는 고정값(BOARD_*)이라 바깥에서 자리를 셈한다.
 */
const BOARD_HEAD = 56;
const BOARD_HEAD_COMPACT = 46;
const BOARD_ROW = 50;
const BOARD_ROW_COMPACT = 42;
const BOARD_PAD_B = 6;
export const boardListH = (compact = false) =>
  (compact ? BOARD_HEAD_COMPACT : BOARD_HEAD) + INTRO.enterpriseBoard.rows.length * (compact ? BOARD_ROW_COMPACT : BOARD_ROW) + BOARD_PAD_B;
/** 보드 화면(상태 막대 아래 715) 안 목록 카드 위 끝 — 머리줄 50 · 주간 달력 10+84 · 거르기 칩 12+30 · 12 */
const BOARD_LIST_TOP = 198;
const CHANGED_FG = '#6B5CE7';

function CheckDot({ size = 14, color = ME_BG, className = '', style }: { size?: number; color?: string; className?: string; style?: CSSProperties }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full ${className}`} style={{ width: size, height: size, background: color, ...style }}>
      <svg width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="m2.4 5.2 1.8 1.8 3.5-3.7" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}

/**
 * '다가오는 배정' 목록 카드 — 머리 = 프리티풀 전담팀, 줄 = 날짜 칸(월 · 일) · 행사 · 배정된 사회자 · 상태 칩(배정 완료 / 변경 반영).
 * compact = 모바일 카드(줄 간격 좁힘) · animate = 줄이 차례로 들어오고 체크가 톡(튀어나오는 조각)
 */
export function BoardListCard({ compact = false, animate = false }: { compact?: boolean; animate?: boolean }) {
  const t = useT();
  const b = INTRO.enterpriseBoard;
  const rowH = compact ? BOARD_ROW_COMPACT : BOARD_ROW;
  return (
    <div className="overflow-hidden rounded-[18px] bg-white px-[14px]" style={{ height: boardListH(compact), paddingBottom: BOARD_PAD_B }}>
      <div className="flex items-center gap-[10px]" style={{ height: compact ? BOARD_HEAD_COMPACT : BOARD_HEAD }}>
        <BizAvatar size={compact ? 28 : 30} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-bold leading-[1.3] tracking-[-0.3px] text-[#191F28]">{t(b.team)}</span>
          <span className="mt-[1px] block truncate text-[11px] leading-[1.35] tracking-[-0.1px] text-[#6B7684]">{t(b.teamSub)}</span>
        </span>
      </div>
      <ul>
        {b.rows.map((r, i) => {
          const picked = r.m === b.rows[0].m && Number(r.d) === b.pick;
          return (
            <li
              key={i}
              className={`flex items-center gap-[10px] border-t border-[#F2F4F6] ${animate ? 'si-slot' : ''}`}
              style={{ height: rowH, '--i': i } as CSSProperties}
            >
              {/* 날짜 칸 — 고른 날(달력과 같은 11/14)만 파랗게 */}
              <span
                className={`flex shrink-0 flex-col items-center justify-center rounded-[11px] ${picked ? 'bg-[#E8F3FF]' : 'bg-[#F2F4F6]'}`}
                style={{ width: compact ? 34 : 38, height: compact ? 34 : 38 }}
              >
                <span className={`text-[9.5px] font-semibold leading-[1.15] tracking-[-0.1px] ${picked ? 'text-[#3182F6]' : 'text-[#8B95A1]'}`}>{t(r.m)}</span>
                <span className={`text-[14.5px] font-bold leading-[1.15] tabular-nums tracking-[-0.2px] ${picked ? 'text-[#1B64DA]' : 'text-[#191F28]'}`}>{r.d}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold leading-[1.3] tracking-[-0.2px] text-[#333D4B]">{t(r.title)}</span>
                <span className={`mt-[1px] block truncate text-[10.5px] leading-[1.35] tracking-[-0.1px] ${r.changed ? 'text-[#6B5CE7]' : 'text-[#8B95A1]'}`}>{t(r.sub)}</span>
              </span>
              <span
                className={`flex h-[22px] shrink-0 items-center gap-[4px] rounded-full pl-[4px] pr-[8px] text-[11px] font-semibold tracking-[-0.1px] ${r.changed ? 'bg-[#F3F0FF]' : 'bg-[#F2F7FF] text-[#3182F6]'}`}
                style={r.changed ? { color: CHANGED_FG } : undefined}
              >
                <CheckDot size={13} color={r.changed ? CHANGED_FG : ME_BG} className={animate ? 'si-ck' : ''} style={{ '--i': i } as CSSProperties} />
                {t(r.changed ? b.changed : b.assigned)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 배정 보드 화면(상태 막대 아래 332×715 디자인 px) — 머리줄 · 주간 달력 · 거르기 칩 · 다가오는 배정 목록 · 변경 안내 · 일정 보내기 */
export function ScheduleBoardScreen() {
  const t = useT();
  const b = INTRO.enterpriseBoard;
  const wd = t(b.weekdays).split(' ');
  return (
    <div className="absolute inset-0 bg-[#F2F4F6]">
      {/* 머리줄 */}
      <div className="flex h-[50px] items-center gap-[8px] bg-white px-[12px]">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true"><path d="M13.6 4.6 7.2 11l6.4 6.4" stroke="#191F28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span className="min-w-0 flex-1 truncate text-[16px] font-bold tracking-[-0.3px] text-[#191F28]">{t(b.title)}</span>
        <CalendarIcon size={20} color="#4E5968" />
      </div>
      <div className="px-[12px]">
        {/* 주간 달력 — 11/8(일) ~ 11/14(토), 고른 날 = 14 */}
        <div className="mt-[10px] h-[84px] rounded-[16px] bg-white px-[12px] pt-[10px]">
          <div className="flex h-[20px] items-center justify-between">
            <span className="truncate text-[13.5px] font-bold tracking-[-0.3px] text-[#191F28]">{t(b.month)}</span>
            <span className="flex shrink-0 items-center gap-[10px]" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M8.6 3.2 4.8 7l3.8 3.8" stroke="#B0B8C1" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5.4 3.2 9.2 7l-3.8 3.8" stroke="#4E5968" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </div>
          <div className="mt-[6px] grid grid-cols-7">
            {b.week.map((d, i) => {
              const on = d === b.pick;
              return (
                <span key={d} className="flex flex-col items-center">
                  <span className="h-[14px] text-[10px] leading-[14px] text-[#8B95A1]">{wd[i] || ''}</span>
                  <span
                    className={`mt-[2px] flex h-[26px] w-[26px] items-center justify-center rounded-full text-[12.5px] font-semibold tabular-nums ${on ? 'text-white' : 'text-[#333D4B]'}`}
                    style={on ? { background: ME_BG } : undefined}
                  >
                    {d}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
        {/* 거르기 칩 */}
        <div className="mt-[12px] flex h-[30px] items-center gap-[6px] overflow-hidden">
          {b.filters.map((f, i) => (
            <span
              key={i}
              className={`flex h-[30px] shrink-0 items-center rounded-full px-[12px] text-[12px] font-semibold tracking-[-0.2px] ${i === 0 ? 'bg-[#191F28] text-white' : 'bg-white text-[#4E5968]'}`}
            >
              {t(f)}
            </span>
          ))}
        </div>
        {/* 다가오는 배정 목록(튀어나오는 조각과 같은 카드) */}
        <div className="mt-[12px]">
          <BoardListCard />
        </div>
        {/* 변경 안내 — 바뀐 일정도 담당자는 보내기만, 재배정은 전담팀이 */}
        <div className="mt-[10px] flex h-[56px] items-center gap-[10px] rounded-[16px] bg-white px-[14px]">
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#E8F3FF]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M12.6 6.2A4.9 4.9 0 0 0 3.7 5M3.4 9.8a4.9 4.9 0 0 0 8.9 1.2" stroke="#3182F6" strokeWidth="1.6" strokeLinecap="round" /><path d="M12.9 2.9v3.4H9.5M3.1 13.1V9.7h3.4" stroke="#3182F6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-bold leading-[1.35] tracking-[-0.3px] text-[#191F28]">{t(b.note)}</span>
            <span className="mt-[1px] block truncate text-[11px] leading-[1.35] tracking-[-0.1px] text-[#6B7684]">{t(b.noteSub)}</span>
          </span>
        </div>
      </div>
      {/* 일정 보내기 — 담당자는 일정만 보낸다 */}
      <div className="absolute inset-x-[12px] bottom-[20px] flex h-[46px] items-center justify-center gap-[6px] rounded-[14px] text-[14.5px] font-bold tracking-[-0.3px] text-white" style={{ background: ME_BG }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" /></svg>
        {t(b.send)}
      </div>
    </div>
  );
}

export function HostScreenLayers({ active }: { active: number }) {
  const shown = active < 0 ? 0 : active;
  const dim = active >= 0;
  return (
    <>
      <div className="absolute inset-0 bg-white" />
      {HOST_SCREENS.map((sc, i) => {
        const on = i === shown;
        const faded = { opacity: on && dim ? 0.2 : 1, transition: 'opacity .3s ease .03s' };
        return (
          <div
            key={sc.key}
            className="absolute inset-x-0"
            style={{
              top: 30,
              height: sc.board ? sc.h : undefined,
              opacity: on ? 1 : 0,
              transform: `translate3d(0, ${on ? sc.offset : sc.offset + 48}px, 0)`,
              transition: on ? `transform .4s ${POP_EASE}, opacity .3s ease` : 'transform 0s linear .3s, opacity .3s ease',
            }}
          >
            {sc.board ? (
              <div className="absolute inset-0" style={faded}>
                <ScheduleBoardScreen />
              </div>
            ) : sc.src ? (
              // eslint-disable-next-line @next/next/no-img-element -- public 정적 캡처
              <img
                src={sc.src}
                alt=""
                width={SCREEN_W}
                height={Math.round(sc.h * SCREEN_SCALE)}
                loading="lazy"
                decoding="async"
                draggable={false}
                className="block select-none"
                style={{ width: SCREEN_W, height: 'auto', ...faded }}
              />
            ) : null}
          </div>
        );
      })}
      <StatusBar />
    </>
  );
}

export function HostPopCards({ active }: { active: number }) {
  return (
    <>
      {HOST_SCREENS.map((sc, i) => {
        const on = i === active;
        const base: CSSProperties = {
          position: 'absolute',
          left: 14,
          width: 304,
          transformOrigin: '100% 50%',
          borderRadius: 24,
          overflow: 'hidden',
          opacity: on ? 1 : 0,
          transform: on ? `translate3d(-30px, 0, 0) scale(${i === 0 ? 1.05 : 1.1})` : 'translate3d(0, 48px, 0)',
          boxShadow: on ? '0 8px 90px 0 rgba(2,32,71,0.05), 0 6px 24px -8px rgba(2,32,71,0.12)' : '0 0 0 0 rgba(2,32,71,0)',
          border: '1px solid rgba(7,25,76,0.05)',
          backgroundColor: 'rgba(251,251,252,0.99)',
          transition: on
            ? `transform .4s ${POP_EASE}, box-shadow .4s ${POP_EASE}, opacity .2s ease`
            : `transform 0s linear .3s, box-shadow .3s ease, opacity .25s ease`,
        };
        if (sc.board) {
          // 배정 보드: 화면 속 '다가오는 배정' 목록 카드가 그대로 튀어나온다 — 열릴 때마다 줄이 차례로 · 체크가 톡(key 로 다시 그려 애니메이션을 처음부터)
          const H = boardListH() + 20;
          const cy = 30 + sc.offset + BOARD_LIST_TOP + boardListH() / 2;
          return (
            <div key={sc.key} style={{ ...base, top: cy - H / 2, height: H, padding: 10 }}>
              <BoardListCard key={on ? 'on' : 'off'} animate={on} />
            </div>
          );
        }
        if (!sc.crop) return null;
        const c = sc.crop;
        const cy = 30 + sc.offset + (c.y + c.h / 2) * SCREEN_SCALE;
        if (sc.piece) {
          // 고해상도 조각(crop 자리와 같은 내용) — 카드 안쪽 여백 10, 폭 284
          const H = (284 * c.h) / c.w + 20;
          return (
            <div
              key={sc.key}
              style={{
                ...base,
                top: cy - H / 2,
                height: H,
                backgroundImage: on ? `url(${sc.piece})` : undefined,
                backgroundSize: '284px auto',
                backgroundPosition: '10px 10px',
                backgroundRepeat: 'no-repeat',
              }}
            />
          );
        }
        // 캡처 조각 — 카드 안쪽 여백(10px)을 두려고 조금 작게(콘텐츠 x 24–756 → 폭 284) 넣는다
        const f = 284 / 732;
        const H = c.h * f + 20;
        return (
          <div
            key={sc.key}
            style={{
              ...base,
              top: cy - H / 2,
              height: H,
              backgroundImage: on ? `url(${sc.src})` : undefined,
              backgroundSize: `${780 * f}px auto`,
              backgroundPosition: `${10 - 24 * f}px ${10 - c.y * f}px`,
              backgroundRepeat: 'no-repeat',
            }}
          />
        );
      })}
    </>
  );
}

/* ─── 떠다니는 흰 점(빛 번짐 위, 시간 기반 — 스크롤과 무관) ─────────────── */
export function Particles({ style, count = 470 }: { style?: CSSProperties; count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return undefined;
    const reduced = (() => {
      try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch {
        return false;
      }
    })();
    const ctx = cv.getContext('2d');
    if (!ctx) return undefined;
    // 부드러운 점 하나를 미리 그려 두고 찍는다
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 32;
    const sx = sprite.getContext('2d');
    if (sx) {
      const g = sx.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.45, 'rgba(255,255,255,.85)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      sx.fillStyle = g;
      sx.fillRect(0, 0, 32, 32);
    }
    let W = 0;
    let H = 0;
    let dpr = 1;
    const dots = Array.from({ length: count }, () => ({ x: Math.random(), y: Math.random(), r: 0, a: 0, vy: 0, ph: Math.random() * Math.PI * 2, f: 0.3 + Math.random() * 0.5 }));
    const seed = () => {
      dots.forEach((d) => {
        const z = Math.random();
        d.r = 1 + Math.pow(z, 1.8) * 8; // 1–9px, 가운데값 약 4
        d.a = 0.23 + Math.random() * 0.28;
        d.vy = 4 + Math.random() * 6; // px/s 아래로
      });
    };
    seed();
    const size = () => {
      const r = cv.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, Math.round(r.width * dpr));
      H = Math.max(1, Math.round(r.height * dpr));
      if (cv.width !== W) cv.width = W;
      if (cv.height !== H) cv.height = H;
    };
    size();
    let raf = 0;
    let last = performance.now();
    let visible = false;
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, W, H);
      for (const d of dots) {
        if (!reduced) {
          d.y += (d.vy * dt * dpr) / H;
          d.ph += d.f * dt;
          if (d.y > 1.02) {
            d.y = -0.02;
            d.x = Math.random();
          }
        }
        const px = d.x * W + Math.sin(d.ph) * 6 * dpr;
        const py = d.y * H;
        const s = d.r * dpr;
        ctx.globalAlpha = d.a;
        ctx.drawImage(sprite, px - s / 2, py - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      if (visible && !reduced) raf = requestAnimationFrame(draw);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) {
        size();
        last = performance.now();
        raf = requestAnimationFrame(draw);
      }
    });
    io.observe(cv);
    const onResize = () => size();
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [count]);
  return <canvas ref={ref} className="pointer-events-none absolute" style={style} aria-hidden="true" />;
}

/* ─── 바닥 그림자(흐린 납작한 타원, 곱하기) ─────────────────────────── */
export function FloorShadow({ style }: { style?: CSSProperties }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="pointer-events-none absolute" width="760" height="260" viewBox="0 0 760 260" style={{ mixBlendMode: 'multiply', opacity: 0.5, ...style }} aria-hidden="true">
      <defs>
        <filter id={`si-fs-${id}`} x="-30%" y="-80%" width="160%" height="260%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
      </defs>
      <path d="M96 124 C 220 112, 400 98, 512 101 C 590 110, 640 132, 650 146 C 560 158, 450 162, 362 160 C 250 150, 140 138, 96 124 Z" fill="#D7D2D7" filter={`url(#si-fs-${id})`} />
    </svg>
  );
}
