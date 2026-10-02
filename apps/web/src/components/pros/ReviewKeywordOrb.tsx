'use client';

/**
 * 사회자 상세 — 리뷰 '언급 키워드' (2026-10-02 사장이 준 그림과 100% 같게: "토씨 안틀리고").
 *
 * 그림(1269×816, 'AI 시대 프로덕트 디자이너' 원 + 체크 칩 4 + 회색 칩 4)을 **픽셀로 재서** 그대로 옮겼다.
 *   맨 위 점 셋(진→연) · 두 줄 제목(회색 / 검정 굵게 + 회색 끝) · 가운데 보라 원(그라데이션은 원 안 픽셀 1만 개에 맞춘 값) ·
 *   원 위쪽 흰 두 줄 · 큰·작은 반짝이 · 원 가장자리에 걸친 흰 칩 4(보라 글자 + 바깥 위 모서리 체크 배지) ·
 *   그 사이 옅은 회색 칩 4.
 * 글자만 이 자리에 맞게 바꿨다: 칩 = 리뷰에서 많이 나온 순(앞 넷이 체크 칩, 다음 넷이 회색 칩),
 * 원 = 사회자 이름, 제목 = 리뷰 건수. (그림의 'AI 시대 프로덕트 디자이너' 같은 견본 글자를 그대로 쓰면
 * 사회자 화면에 엉뚱한 말이 뜬다 — 일반바 '뱃지' 사고와 같은 이유.)
 *
 * 배치: 넓은 칸(560px↑, PC)은 그림 좌표를 그대로 줄여 쓰고(1120×720 판), 폰은 같은 요소·같은 순서를
 * 폭 335 판으로 옮겼다(그림 비율 그대로 줄이면 칩 글자가 6px 가 된다). 칩은 실제 글자 폭을 재서
 * 원 테두리에 그림과 같은 만큼 걸치게 놓고, 칸 밖으로 나가면 안쪽으로 당긴다.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/* ── 그림에서 잰 값 ─────────────────────────────────────────────────────────── */

/** 그림 색(JPEG 심의 진한 쪽 평균) */
const C = {
  titleGray: '#9E9DA3',
  titleInk: '#0E0D12',
  chipPurple: '#6345CF',
  badge: '#7048E9',
  subGray: '#A7A6AB',
  dots: ['#B4B4B8', '#D3D3D7', '#E5E4E9'],
};

/** 원 그라데이션 — 그림의 원 안 픽셀 2만 개(글자·칩·반짝이와 그 둘레 3px 은 뺌)에 여섯 겹 radial-gradient 를
 *  좌표 하강으로 맞춘 값(채널당 RMSE ≈ 6/255). 아래가 바탕(파랑 심 → 옅은 하늘), 위로 보라(오른쪽)·민트(왼아래)·
 *  분홍빛 흰 빛(위)·보라 옅은 빛(오른위)·파랑 빛(왼쪽)이 겹친다. */
const ORB_BG = [
  'radial-gradient(ellipse 30.5% 26.3% at 17.4% 39%, rgba(87,106,255,0.381) 0%, rgba(87,106,255,0.19) 50.9%, rgba(87,106,255,0) 100%)',
  'radial-gradient(ellipse 20.1% 32.6% at 97.4% 24.1%, rgba(154,132,241,0.693) 0%, rgba(154,132,241,0.347) 48.3%, rgba(154,132,241,0) 100%)',
  'radial-gradient(ellipse 86.9% 35.4% at 47.4% 2.2%, rgba(255,242,255,0.583) 0%, rgba(255,242,255,0.292) 33.2%, rgba(255,242,255,0) 100%)',
  'radial-gradient(ellipse 47.6% 43.3% at 23.5% 97.1%, rgba(196,225,216,0.937) 0%, rgba(196,225,216,0.468) 33.8%, rgba(196,225,216,0) 100%)',
  'radial-gradient(ellipse 49.8% 53% at 96% 37.5%, rgba(129,46,247,0.589) 0%, rgba(129,46,247,0.295) 59.1%, rgba(129,46,247,0) 100%)',
  'radial-gradient(ellipse 54.6% 55% at 61% 47.4%, #555FED 0%, #5B65F4 20%, #727BF3 40%, #949FF5 60%, #BEC9F6 80%, #DBE0F9 100%)',
].join(', ');

type Slot = { kind: 'p' | 's'; side: 'l' | 'r' | 'c'; dy: number; ov?: number; dx?: number };
/** 칩 자리 — 원 반지름(r) 단위. dy = 칩 가운데 높이, ov = 원 테두리 안으로 걸치는 깊이(음수면 떨어진 거리), dx = 가운데 정렬 칩의 x.
 *  순서 = 많이 나온 순: 체크 칩 넷(왼위·오른위·왼아래·오른아래) → 회색 칩 넷(왼가운데·오른가운데·왼아래 끝·오른아래 끝) */
const SLOTS: Slot[] = [
  { kind: 'p', side: 'l', dy: -0.547, ov: 0.24 },   // 분석 결과를 해석하고 판단
  { kind: 'p', side: 'r', dy: -0.626, ov: 0.073 },  // 일관된 사용성
  { kind: 'p', side: 'l', dy: 0.513, ov: 0.482 },   // 문제에 맞는 최적의 해결책 선택
  { kind: 'p', side: 'r', dy: 0.435, ov: 0.272 },   // 브랜드를 반영한 비주얼 퀄리티
  { kind: 's', side: 'l', dy: 0.005, ov: -0.419 },  // 다양한 해결책 도출하기
  { kind: 's', side: 'r', dy: -0.052, ov: -0.342 }, // 좋은 UX를 찾고 설계하기
  { kind: 's', side: 'c', dy: 1.0, dx: -0.772 },    // UX 리서치
  { kind: 's', side: 'c', dy: 0.958, dx: 1.026 },   // 데이터 분석
];

/** 판 하나의 치수(px, 1배) — wide = 그림 좌표(가로 95~1215 를 잘라 1120 판), narrow = 폰 335 판 */
type Board = {
  w: number; h: number; cx: number; cy: number; r: number;
  dots: { y: number; d: number }[];
  title: { y1: number; y2: number; font: number; ls: number };
  orbText: { y1: number; y2: number; font: number; ls: number };
  p: { font: number; h: number; padX: number; badge: number; inset: number; ls: number };
  s: { font: number; h: number; padX: number; ls: number };
  margin: number;
};
const WIDE: Board = {
  w: 1120, h: 720, cx: 560, cy: 472, r: 191,
  dots: [{ y: 3, d: 6 }, { y: 27, d: 5 }, { y: 51, d: 4 }],
  title: { y1: 132, y2: 183, font: 40.8, ls: 1.0 },
  orbText: { y1: 348, y2: 382, font: 25.2, ls: 0.6 },
  p: { font: 24.5, h: 65, padX: 28, badge: 23, inset: 8.5, ls: 1.05 },
  s: { font: 21.25, h: 50, padX: 22, ls: 0.55 },
  margin: 6,
};
const NARROW: Board = {
  w: 335, h: 364, cx: 167.5, cy: 237, r: 92,
  dots: [{ y: 2.5, d: 5 }, { y: 14.5, d: 4.2 }, { y: 26.5, d: 3.4 }],
  title: { y1: 68.5, y2: 95.5, font: 20, ls: 0.45 },
  orbText: { y1: 176.5, y2: 195, font: 13.7, ls: 0.3 },
  p: { font: 14.8, h: 38, padX: 15, badge: 14, inset: 5, ls: 0.55 },
  s: { font: 13.2, h: 32, padX: 12, ls: 0.3 },
  margin: 4,
};

/** 반짝이 — 그림의 큰 반짝이 실루엣(줄마다 폭을 잼)에 맞춘 네 갈래 별. 끝은 둥근 이음으로 무디게 */
const SPARK = 'M50 0C54 26.7 73.3 46 100 50C73.3 54 54 73.3 50 100C46 73.3 26.7 54 0 50C26.7 46 46 26.7 50 0Z';

/* ── 화면 ─────────────────────────────────────────────────────────────────── */

export type KeywordOrbText = {
  titleTop: string;
  titleStrong: string;
  titleRest: string;
  orbLines: [string, string];
  primary: string[];
  secondary: string[];
};

export function KeywordOrb({ text, still = false, className = '' }: { text: KeywordOrbText; still?: boolean; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [W, setW] = useState(0);
  const [pos, setPos] = useState<Array<{ left: number; top: number } | null>>([]);
  const [seen, setSeen] = useState(still);
  /** 글자 줄이기 배율 — 이름이 길어 제목·원 안 줄이 칸을 넘으면 그만큼 줄인다(넘치지 않는 한 1) */
  const [fit, setFit] = useState({ title: 1, orb: 1 });
  const titleRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const orbRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  const chips = useMemo(() => [
    ...text.primary.slice(0, 4).map((label, i) => ({ label, slot: SLOTS[i] })),
    ...text.secondary.slice(0, 4).map((label, i) => ({ label, slot: SLOTS[4 + i] })),
  ], [text.primary, text.secondary]);

  /* 칸 폭 — 넓으면 그림 판, 좁으면 폰 판 */
  useIsoLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const read = () => setW(Math.round(el.getBoundingClientRect().width));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* 화면에 닿으면 등장 — 관찰자가 안 오는 기기(안드 웹뷰)도 6초 뒤엔 그냥 보인다(투명으로 남지 않게) */
  useEffect(() => {
    if (seen) return;
    const el = boxRef.current;
    if (!el) return;
    const t = window.setTimeout(() => setSeen(true), 6000);
    let ob: IntersectionObserver | null = null;
    try {
      ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); ob?.disconnect(); } }, { threshold: 0.2 });
      ob.observe(el);
    } catch { setSeen(true); }
    return () => { window.clearTimeout(t); ob?.disconnect(); };
  }, [seen]);

  const B = W >= 560 ? WIDE : NARROW;
  const k = W ? W / B.w : 0;          // 판 → 화면 배율
  const cx = B.cx * k, cy = B.cy * k, r = B.r * k;

  /* 넘침 재기 — 지금 배율로 그린 폭을 배율로 나눠 본래 폭을 얻고, 남는 칸에 맞춘다 */
  useIsoLayoutEffect(() => {
    if (!W) return;
    const natural = (els: (HTMLElement | null)[], cur: number) =>
      Math.max(0, ...els.map((el) => (el ? (el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth : el.scrollWidth) / cur : 0)));
    const t = natural(titleRefs.current, fit.title);
    const o = natural(orbRefs.current, fit.orb);
    const nextT = t ? Math.max(0.6, Math.min(1, (W - 12) / t)) : 1;
    // 원 안 줄은 원 폭의 60~70% 안에 — 좌우 체크 칩이 원 테두리에 걸쳐 들어오므로 그보다 넓으면 칩에 가린다
    const nextO = o ? Math.max(0.6, Math.min(1, (r * (B === WIDE ? 1.4 : 1.22)) / o)) : 1;
    if (Math.abs(nextT - fit.title) > 0.004 || Math.abs(nextO - fit.orb) > 0.004) setFit({ title: nextT, orb: nextO });
  }, [W, r, B, text.titleTop, text.titleStrong, text.titleRest, text.orbLines, fit.title, fit.orb]);

  /* 칩 놓기 — 실제 폭을 재서 그림처럼 원 테두리에 걸친다. 짧은 칩이 원 안으로 잠기지 않게 걸침은 폭의 45%까지 */
  useIsoLayoutEffect(() => {
    if (!W) return;
    const next = chips.map(({ slot }, i) => {
      const el = chipRefs.current[i];
      if (!el) return null;
      const w = el.offsetWidth;
      const h = (slot.kind === 'p' ? B.p.h : B.s.h) * k;
      const top = cy + slot.dy * r - h / 2;
      let left: number;
      if (slot.side === 'c') {
        left = cx + (slot.dx ?? 0) * r - w / 2;
      } else {
        const half = Math.sqrt(Math.max(0, 1 - slot.dy * slot.dy)) * r;
        const ov = (slot.ov ?? 0) * r;
        if (slot.side === 'l') {
          const edge = cx - half;
          const right = Math.min(edge + ov, edge + 0.45 * w);
          left = right - w;
        } else {
          const edge = cx + half;
          left = Math.max(edge - ov, edge - 0.45 * w);
        }
      }
      const m = B.margin * k + (slot.kind === 'p' ? B.p.badge * k * 0.2 : 0);
      left = Math.max(m, Math.min(W - m - w, left));
      return { left, top };
    });
    setPos(next);
  }, [W, chips, B, k, cx, cy, r]);

  const anim = (name: string, delay: number, dur = 0.6): CSSProperties | undefined =>
    still ? undefined : seen ? { animation: `${name} ${dur}s cubic-bezier(.22,.61,.36,1) ${delay}s both` } : { opacity: 0 };

  const sparkStyle = (fx: number, fy: number, fw: number, fh: number, delay: number): CSSProperties => ({
    position: 'absolute', left: cx + fx * r - (fw * r) / 2, top: cy + fy * r - (fh * r) / 2, width: fw * r, height: fh * r,
    filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.45))',
    ...(still ? {} : seen ? { animation: `kwoSpark .7s cubic-bezier(.34,1.56,.64,1) ${delay}s both, kwoTwinkle 3.2s ease-in-out ${delay + 0.8}s infinite` } : { opacity: 0 }),
  });

  return (
    /* ⚠ overflow-hidden 필수 — 뒤에 깔린 보라 빛(폭 4.2r)이 폰 판에선 칸보다 넓어 페이지에 가로 스크롤이 생겼다(2026-10-02 사장 신고).
         칩·배지·점은 놓을 때 이미 칸 안으로 당겨 두므로 잘리는 것은 그 빛의 옅은 끝뿐이다. */
    <div ref={boxRef} className={`relative w-full select-none overflow-hidden ${className}`} style={{ height: W ? B.h * k : NARROW.h }} aria-label={`${text.titleTop} ${text.titleStrong}${text.titleRest} — ${chips.map((c) => c.label).join(', ')}`}>
      <style>{KWO_CSS}</style>
      {W > 0 && (
        <>
          {/* 뒤에 깔린 옅은 보라 빛(그림 바탕의 #F7F4FF 번짐) */}
          <div aria-hidden className="pointer-events-none absolute" style={{
            left: cx - r * 2.1, top: cy - r * 1.9, width: r * 4.2, height: r * 3.8,
            background: 'radial-gradient(closest-side, rgba(120,104,246,0.075) 0%, rgba(120,104,246,0.035) 45%, rgba(120,104,246,0) 100%)',
          }} />

          {/* 맨 위 점 셋 */}
          {B.dots.map((d, i) => (
            <span key={i} aria-hidden className="absolute rounded-full" style={{
              left: cx - (d.d * k) / 2, top: d.y * k - (d.d * k) / 2, width: d.d * k, height: d.d * k, background: C.dots[i],
              ...anim('kwoFade', 0.05 + i * 0.08, 0.4),
            }} />
          ))}

          {/* 두 줄 제목 */}
          <p ref={(el) => { titleRefs.current[0] = el; }} className="absolute inset-x-0 text-center font-bold" style={{
            top: B.title.y1 * k, transform: 'translateY(-50%)', fontSize: B.title.font * k * fit.title, lineHeight: 1.3, letterSpacing: B.title.ls * k * fit.title,
            color: C.titleGray, whiteSpace: 'nowrap', ...anim('kwoUp', 0.12),
          }}><span>{text.titleTop}</span></p>
          <p ref={(el) => { titleRefs.current[1] = el; }} className="absolute inset-x-0 text-center font-bold" style={{
            top: B.title.y2 * k, transform: 'translateY(-50%)', fontSize: B.title.font * k * fit.title, lineHeight: 1.3, letterSpacing: B.title.ls * k * fit.title,
            whiteSpace: 'nowrap', ...anim('kwoUp', 0.24),
          }}>
            <span><span style={{ color: C.titleInk }}>{text.titleStrong}</span><span style={{ color: C.titleGray }}>{text.titleRest}</span></span>
          </p>

          {/* 가운데 원 — 가장자리는 그림처럼 살짝 번진다 */}
          <div aria-hidden className="absolute rounded-full" style={{
            left: cx - r, top: cy - r, width: r * 2, height: r * 2, background: ORB_BG,
            WebkitMaskImage: 'radial-gradient(closest-side, #000 98.2%, transparent 100%)',
            maskImage: 'radial-gradient(closest-side, #000 98.2%, transparent 100%)',
            ...(still ? {} : seen ? { animation: 'kwoOrb .9s cubic-bezier(.22,.61,.36,1) .3s both, kwoBreathe 5.5s ease-in-out 1.3s infinite' } : { opacity: 0 }),
          }} />

          {/* 원 안 두 줄 */}
          {[text.orbLines[0], text.orbLines[1]].map((line, i) => (
            <p key={i} ref={(el) => { orbRefs.current[i] = el; }} className="absolute inset-x-0 text-center font-bold text-white" style={{
              top: (i === 0 ? B.orbText.y1 : B.orbText.y2) * k, transform: 'translateY(-50%)', fontSize: B.orbText.font * k * fit.orb, lineHeight: 1.3,
              letterSpacing: B.orbText.ls * k * fit.orb, whiteSpace: 'nowrap', ...anim('kwoUp', 0.55 + i * 0.08),
            }}><span>{line}</span></p>
          ))}

          {/* 반짝이 둘 */}
          <svg aria-hidden viewBox="-6 -6 112 112" style={sparkStyle(-0.123, 0.104, 0.52, 0.52, 0.75)}>
            <path d={SPARK} fill="#fff" stroke="#fff" strokeWidth="9" strokeLinejoin="round" />
          </svg>
          <svg aria-hidden viewBox="-6 -6 112 112" style={sparkStyle(0.251, -0.136, 0.275, 0.275, 0.9)}>
            <path d={SPARK} fill="#fff" stroke="#fff" strokeWidth="9" strokeLinejoin="round" />
          </svg>

          {/* 칩 — 앞 넷 체크(흰 알약·보라 글자·바깥 위 모서리 배지), 뒤 넷 회색 */}
          {chips.map(({ label, slot }, i) => {
            const p = pos[i];
            const prim = slot.kind === 'p';
            const S = prim ? B.p : B.s;
            const order = i;
            const style: CSSProperties = {
              left: p ? p.left : -9999, top: p ? p.top : 0, height: S.h * k, paddingLeft: S.padX * k, paddingRight: S.padX * k,
              fontSize: S.font * k, letterSpacing: S.ls * k,
              ...(prim
                ? { background: '#fff', color: C.chipPurple, boxShadow: `0 ${4 * k}px ${16 * k}px rgba(70,56,150,0.08), 0 0 0 ${Math.max(0.5, 1 * k)}px rgba(60,50,120,0.04)` }
                : { background: 'rgba(255,255,255,0.78)', color: C.subGray, boxShadow: `0 ${2 * k}px ${12 * k}px rgba(70,56,150,0.045)` }),
              ...(still || !p ? (p ? {} : { visibility: 'hidden' as const }) : seen
                ? { animation: `kwoChip .62s cubic-bezier(.34,1.4,.64,1) ${0.95 + order * 0.09}s both, kwoFloat ${4.2 + i * 0.37}s ease-in-out ${1.9 + i * 0.21}s infinite` }
                : { opacity: 0 }),
            };
            return (
              <span key={`${i}-${label}`} ref={(el) => { chipRefs.current[i] = el; }}
                className={`absolute flex items-center whitespace-nowrap rounded-full ${prim ? 'font-bold' : 'font-medium'}`} style={style}>
                {label}
                {prim && (
                  <span aria-hidden className="absolute flex items-center justify-center rounded-full" style={{
                    width: B.p.badge * k, height: B.p.badge * k, background: C.badge,
                    top: B.p.inset * k - (B.p.badge * k) / 2,
                    ...(slot.side === 'l' ? { left: B.p.inset * k - (B.p.badge * k) / 2 } : { right: B.p.inset * k - (B.p.badge * k) / 2 }),
                    ...(still ? {} : seen ? { animation: `kwoBadge .5s cubic-bezier(.34,1.56,.64,1) ${1.25 + order * 0.09}s both` } : { opacity: 0 }),
                  }}>
                    <svg viewBox="0 0 24 24" width="62%" height="62%" fill="none">
                      <path d="M6.2 12.4l3.7 3.6 7.9-7.9" stroke="#fff" strokeWidth="2.9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </span>
            );
          })}
        </>
      )}
    </div>
  );
}

/** 사회자 상세에 놓는 판 — 리뷰 키워드(많이 나온 순)로 글자를 채운다 */
export default function ReviewKeywordOrb({ name, keywords, reviewCount, className = '' }: { name: string; keywords: string[]; reviewCount: number; className?: string }) {
  const who = (name || '').trim() || '이';
  const text = useMemo<KeywordOrbText>(() => ({
    titleTop: reviewCount > 0 ? `리뷰 ${reviewCount}건을 모아 보니,` : '고객 리뷰를 모아 보니,',
    titleStrong: `${who} 사회자의 이런 점`,
    titleRest: '에 만족했어요',
    orbLines: ['리뷰로 본', `${who} 사회자`],
    primary: keywords.slice(0, 4),
    secondary: keywords.slice(4, 8),
  }), [who, keywords, reviewCount]);
  return <KeywordOrb text={text} className={className} />;
}

const KWO_CSS = `
@keyframes kwoFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes kwoUp { from { opacity: 0; translate: 0 14px; } to { opacity: 1; translate: 0 0; } }
@keyframes kwoOrb { from { opacity: 0; scale: .86; } to { opacity: 1; scale: 1; } }
@keyframes kwoBreathe { 0%, 100% { scale: 1; } 50% { scale: 1.018; } }
@keyframes kwoSpark { 0% { opacity: 0; scale: .2; rotate: -30deg; } 100% { opacity: 1; scale: 1; rotate: 0deg; } }
@keyframes kwoTwinkle { 0%, 100% { scale: 1; } 50% { scale: .92; } }
@keyframes kwoChip { from { opacity: 0; scale: .7; } to { opacity: 1; scale: 1; } }
@keyframes kwoBadge { from { opacity: 0; scale: 0; } to { opacity: 1; scale: 1; } }
@keyframes kwoFloat { 0%, 100% { translate: 0 0; } 50% { translate: 0 -3px; } }
@media (prefers-reduced-motion: reduce) {
  [style*="kwo"] { animation: none !important; opacity: 1 !important; }
}
`;
