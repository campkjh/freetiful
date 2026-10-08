'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { useT } from '@/lib/biz/i18n';
import { useInView } from '@/components/biz/biz-motion';
import { CLIENTS, DOCK, LOGOS, type Tr } from './content';
import { clamp01, prefersReducedMotion, useFrame, usePassProgress } from './scene';

/*
 * ⑧ 함께한 기업(토스 홈 'Toss payments' 장면 자리, 261008).
 * 데스크톱(≥1024): 높은 부모(2.8vh + 첫 설명 높이/2) + 100vh sticky 무대. 무대 위 브라우저 틀 영상이 뒤로 젖혀진 채 크게 들어와
 *   부모 위 끝이 화면 40% 에 닿을 때부터 1.08vh 동안 선형으로 평평해진다(1.5배 → 1배, 오른쪽 위로). 끝나면 설명 1 밝아짐,
 *   설명 2 가운데가 화면 80% 에 닿으면 영상 2 로 딱 끊어 바꾼다. 무대가 빠진 뒤 로고 벽(3줄 흐름) → 흰색으로 이어지는 20vh 띠.
 * 모바일 · 태블릿(<1024): 토스 모바일처럼 끈적임 없이 제목(단어 흐림 등장) + 영상 카드 2장(120px 떠오름) + 로고 벽.
 * 수치는 토스 화면을 재서 옮긴 것 — 토스 코드 · CSS · 그림은 쓰지 않는다.
 */

const EASE = 'cubic-bezier(0.25,0.1,0.25,1)';
const BG = 'rgb(243,243,243)';
const DOMAIN = 'freetiful.com';
/* 설명 2 아래 알약(토스 LI2 '자세히 보기' 자리) — 앱(플랫폼) 첫 화면으로 */
const MORE: Tr = { ko: '자세히 보기', en: 'Learn more', ja: '詳しく見る', zh: '了解更多' };
const MORE_HREF = '/';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/* 장면 전용 CSS — 화면비(16:9 이상이면 vw 기준) · 글자 크기 단계 · 흐림 등장 · 로고 흐름 */
const CSS = `
.scc-root{--pad:48px;--h2:48px;--it:20px;--ib:16px;letter-spacing:-0.02em}
@media (min-width:1280px){.scc-root{--pad:80px}}
@media (min-width:1440px){.scc-root{--pad:128px}}
@media (min-width:1441px){.scc-root{--h2:52px}}
@media (min-width:1600px){.scc-root{--pad:160px}}
@media (min-width:1601px){.scc-root{--h2:64px;--it:24px;--ib:18px}}
.scc-root{--cw:111.111vh;--cl:calc(50vw - 22.222vh);--ct:16.667vh}
@media (min-aspect-ratio:16/9){.scc-root{--cw:62.5vw;--cl:37.5vw;--ct:calc(50vh - 18.75vw)}}
.scc-root{--u:calc(var(--cw) / 1000)}
.scc-card{position:absolute;left:var(--cl);top:calc(var(--ct) + var(--u) * 20);width:var(--cw);border-radius:calc(var(--u) * 32);overflow:hidden;background:#fff;transform-origin:50% 50%;backface-visibility:hidden;will-change:transform;box-shadow:0 0 0 1px rgba(0,27,55,0.05),0 calc(var(--u) * 24) calc(var(--u) * 60) calc(var(--u) * -30) rgba(0,27,55,0.12)}
.scc-bar{height:calc(var(--u) * 48);padding:0 calc(var(--u) * 20);gap:calc(var(--u) * 8)}
.scc-bar i{width:calc(var(--u) * 12);height:calc(var(--u) * 12)}
.scc-url{width:calc(var(--u) * 300);height:calc(var(--u) * 28);border-radius:calc(var(--u) * 8);font-size:calc(var(--u) * 13);gap:calc(var(--u) * 6)}
.scc-text{max-width:min(571px,calc(var(--cl) - var(--pad) - 20px))}
.scc-bw{display:inline-block;opacity:0;transform:translateY(24px);filter:blur(16px);transition:opacity 1s ${EASE},transform 1s ${EASE},filter 1s ${EASE};transition-delay:var(--d,0s)}
.scc-fu{opacity:0;transform:translateY(var(--y,24px));transition:opacity var(--t,1s) ${EASE},transform var(--t,1s) ${EASE};transition-delay:var(--d,0s)}
[data-in] .scc-bw,[data-in] .scc-fu,[data-in].scc-fu{opacity:1;transform:none;filter:none}
.scc-li{transition:opacity .5s ${EASE}}
.scc-pill{display:inline-flex;align-items:center;align-self:flex-start;height:48px;margin-top:16px;border-radius:136px;padding:11px 0 11px 18px;background:rgba(7,25,76,0.051);border:0.66px solid rgba(13,25,74,0.0392);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:rgb(28,31,37);font-size:16px;line-height:25.6px;letter-spacing:-0.32px;font-weight:600;text-decoration:none;transition:background-color .2s ease;box-sizing:border-box}
.scc-pl{position:relative;display:inline-flex;overflow:hidden;white-space:pre}
.scc-pl span{display:inline-block;transition:transform .45s ${EASE},opacity .45s ${EASE}}
.scc-pl .b{position:absolute;left:0;top:0;display:inline-flex}
.scc-pl .b span{transform:translateY(16px);opacity:0}
.scc-ico{display:inline-flex;padding:0 10px 0 12px}
.scc-dot{display:flex;align-items:center;width:28px;height:28px;border-radius:80px;background:rgb(28,31,37);overflow:hidden}
.scc-arr{display:flex;gap:14px;flex:none;transform:translateX(-21px);transition:transform .45s ${EASE}}
@media (hover:hover){
  .scc-pill:hover{background:rgba(3,31,63,0.09)}
  .scc-pill:hover .scc-pl .a span{transform:translateY(-16px);opacity:0}
  .scc-pill:hover .scc-pl .b span{transform:none;opacity:1}
  .scc-pill:hover .scc-arr{transform:translateX(7px)}
}
.scc-m-more{margin-top:28px}
.scc-m-more .scc-pill{margin-top:0}
@media (max-width:767px){.scc-m-more .scc-pill{font-size:14px;line-height:22.4px;letter-spacing:-0.28px}}
.scc-pill:focus-visible{outline:2px solid rgb(49,130,246);outline-offset:3px}
@keyframes scc-mq{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}
.scc-row{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
.scc-track{display:flex;width:max-content;animation:scc-mq calc(var(--n) * 3.4s) linear infinite}
@media (min-width:768px){.scc-track{animation-duration:calc(var(--n) * 4.2s)}}
@media (min-width:1024px){.scc-track{animation-duration:calc(var(--n) * 5s)}}
.scc-track[data-rev]{animation-direction:reverse}
.scc-row:hover .scc-track{animation-play-state:paused}
.scc-logo{flex:none;display:flex;align-items:center;justify-content:center;width:136px;height:48px}
.scc-logo img{max-width:88px;max-height:26px;object-fit:contain;filter:grayscale(1);opacity:.5;transition:filter .3s ease,opacity .3s ease}
.scc-logo:hover img{filter:none;opacity:1}
@media (min-width:768px){.scc-logo{width:168px;height:60px}.scc-logo img{max-width:108px;max-height:30px}}
@media (min-width:1024px){.scc-logo{width:200px;height:72px}.scc-logo img{max-width:128px;max-height:36px}}
@media (prefers-reduced-motion:reduce){
  .scc-bw,.scc-fu{opacity:1!important;transform:none!important;filter:none!important;transition:none!important}
  .scc-track{animation:none;flex-wrap:wrap;justify-content:center;width:auto}
  .scc-track [data-dup]{display:none}
  .scc-row{-webkit-mask-image:none;mask-image:none}
}
`;

/** 단어별 흐림 등장 제목 — 줄 배열을 받아 공백으로 쪼갠다 */
function BlurTitle({ lines, step, lineGap = 0, className, style }: { lines: string[]; step: number; lineGap?: number; className?: string; style?: CSSProperties }) {
  const { ref, inView } = useInView<HTMLHeadingElement>({ threshold: 1, rootMargin: '0px' });
  let k = 0;
  return (
    <h2 ref={ref} data-in={inView ? '' : undefined} className={className} style={style}>
      {lines.map((line, li) => (
        <span key={li} className="block">
          {line.split(' ').map((w, wi, arr) => {
            const d = k++ * step + li * lineGap;
            return (
              <span key={wi}>
                <span className="scc-bw" style={{ '--d': `${d}s` } as CSSProperties}>{w}</span>
                {wi < arr.length - 1 ? ' ' : ''}
              </span>
            );
          })}
        </span>
      ))}
    </h2>
  );
}

/** 영상 — 가까워지면 src 를 붙이고(지연 로드), 보일 때만 재생 */
function useLazyVideo(ref: React.RefObject<HTMLVideoElement>, src: string, margin = '50% 0px') {
  useEffect(() => {
    const v = ref.current;
    if (!v) return undefined;
    const ob = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !v.getAttribute('src')) {
        v.setAttribute('src', src);
        v.load();
        ob.disconnect();
      }
    }, { rootMargin: margin });
    ob.observe(v);
    return () => ob.disconnect();
  }, [ref, src, margin]);
}

function tryPlay(v: HTMLVideoElement | null) {
  if (!v || !v.getAttribute('src')) return;
  const p = v.play();
  if (p) p.catch(() => {});
}

/** 브라우저 틀(점 3개 + 주소창) — 데스크톱 카드는 --u 비례, 모바일은 고정 px */
function BrowserBar({ compact }: { compact?: boolean }) {
  const dot = compact ? { width: 8, height: 8 } : undefined;
  return (
    <div
      className={`${compact ? '' : 'scc-bar '}relative flex items-center bg-white`}
      style={compact ? { height: 32, padding: '0 12px', gap: 5 } : undefined}
    >
      {[0, 1, 2].map((i) => (
        <i key={i} className="block shrink-0 rounded-full" style={{ ...dot, background: 'rgb(229,232,235)' }} />
      ))}
      <div
        className={`${compact ? '' : 'scc-url '}absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center`}
        style={{ background: 'rgb(242,244,246)', color: 'rgb(139,149,161)', ...(compact ? { width: 150, height: 20, borderRadius: 6, fontSize: 10, gap: 4 } : null) }}
      >
        <svg viewBox="0 0 12 12" width="0.9em" height="0.9em" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
          <rect x="2.2" y="5.2" width="7.6" height="5.6" rx="1.4" />
          <path d="M4 5.2V3.8a2 2 0 0 1 4 0v1.4" />
        </svg>
        <span style={{ letterSpacing: 0 }}>{DOMAIN}</span>
      </div>
    </div>
  );
}

/* ───────────── 데스크톱: sticky 무대 ───────────── */
function DesktopStage({ t }: { t: ReturnType<typeof useT> }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const runwayRef = useRef<HTMLDivElement>(null);
  const track1Ref = useRef<HTMLDivElement>(null);
  const ulRef = useRef<HTMLDivElement>(null);
  const li1Ref = useRef<HTMLDivElement>(null);
  const li2Ref = useRef<HTMLDivElement>(null);
  const persRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const vA = useRef<HTMLVideoElement>(null);
  const vB = useRef<HTMLVideoElement>(null);
  const geo = useRef({ vh: 900, k: 1, wrapH: 2581, secStart: 1000 });
  const st = useRef({ state: -1, on: false, reduced: false });
  const progress = usePassProgress(wrapRef);
  const head = useInView<HTMLParagraphElement>({ threshold: 1, rootMargin: '0px' });

  /* 상태 전환 — 0 들어오기 전 · 1 젖힘 풀림 · 2 설명 1 · 3 설명 2. 영상은 딱 끊어 바꾸고 들어갈 때 처음부터 */
  const applyState = useCallback((s: number, on: boolean) => {
    const cur = st.current;
    const a = vA.current;
    const b = vB.current;
    if (s !== cur.state) {
      const prev = cur.state;
      cur.state = s;
      if (li1Ref.current) li1Ref.current.style.opacity = s === 2 ? '1' : '0.3';
      if (li2Ref.current) li2Ref.current.style.opacity = s === 3 ? '1' : '0.3';
      if (a && b) {
        if (s === 3) {
          b.style.opacity = '1';
          a.style.opacity = '0';
          a.pause();
          if (b.getAttribute('src')) b.currentTime = 0;
        } else {
          a.style.opacity = '1';
          b.style.opacity = '0';
          b.pause();
          if (prev === 3 && a.getAttribute('src')) a.currentTime = 0;
        }
      }
    }
    cur.on = on;
    const active = s === 3 ? b : a;
    const idle = s === 3 ? a : b;
    idle?.pause();
    if (on && s >= 1 && !cur.reduced) tryPlay(active);
    else active?.pause();
  }, []);

  const update = useCallback(() => {
    const wrap = wrapRef.current;
    const card = cardRef.current;
    if (!wrap || !card) return;
    const g = geo.current;
    const rel = -wrap.getBoundingClientRect().top; // 부모 위 끝이 화면 위에서 얼마나 올라갔나
    const p = st.current.reduced ? 1 : clamp01((rel + 0.4 * g.vh) / (1.08 * g.vh));
    if (p >= 1) card.style.transform = 'none';
    else {
      const q = 1 - p;
      card.style.transform = `translate3d(${-160 * g.k * q}px,${548 * g.k * q}px,0) rotateX(${45 * q}deg) rotateY(${5 * q}deg) scale(${1.5 - 0.5 * p})`;
    }
    const s = rel < -0.4 * g.vh ? 0 : p < 1 ? 1 : rel < g.secStart ? 2 : 3;
    const on = rel > -g.vh && rel < g.wrapH;
    applyState(s, on);
  }, [applyState]);

  /* 길이 계산 — 토스 식: 활주로 1.48vh − 설명1/2, 트랙 0.42vh + 설명1, 목록 칸 0.9vh */
  const layout = useCallback(() => {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const cw = vw / vh >= 16 / 9 ? 0.625 * vw : 1.11111 * vh;
    const cl = vw / vh >= 16 / 9 ? 0.375 * vw : vw / 2 - 0.22222 * vh;
    const k = cw / 1000;
    const l1 = li1Ref.current?.offsetHeight ?? 122;
    const l2 = li2Ref.current?.offsetHeight ?? 122;
    const runway = 1.48 * vh - l1 / 2;
    const track = 0.42 * vh + l1;
    const wrapH = 2.8 * vh + l1 / 2;
    if (runwayRef.current) runwayRef.current.style.height = `${runway}px`;
    if (track1Ref.current) track1Ref.current.style.height = `${track}px`;
    if (ulRef.current) ulRef.current.style.height = `${0.9 * vh}px`;
    if (wrapRef.current) wrapRef.current.style.height = `${wrapH}px`;
    if (persRef.current) {
      persRef.current.style.perspective = `${3200 * k}px`;
      persRef.current.style.perspectiveOrigin = `${cl + 118 * k}px ${120 * k}px`;
    }
    geo.current = { vh, k, wrapH, secStart: runway + track + l2 / 2 - 0.8 * vh };
    update();
  }, [update]);

  useIsoLayoutEffect(() => {
    st.current.reduced = prefersReducedMotion();
    layout();
    window.addEventListener('resize', layout);
    const ro = new ResizeObserver(layout);
    if (li1Ref.current) ro.observe(li1Ref.current);
    if (li2Ref.current) ro.observe(li2Ref.current);
    return () => {
      window.removeEventListener('resize', layout);
      ro.disconnect();
    };
  }, [layout]);

  useFrame(progress, update);
  useLazyVideo(vA, CLIENTS.video, '100% 0px');
  useLazyVideo(vB, CLIENTS.video2, '100% 0px');

  /* src 가 붙은 뒤 현재 상태대로 재생 */
  const onReady = () => {
    const s = st.current;
    const cur = s.state;
    s.state = -1;
    applyState(cur < 0 ? 0 : cur, s.on);
  };

  return (
    <div ref={wrapRef} className="relative" style={{ height: '280vh', overflowX: 'clip' }}>
      {/* 무대 */}
      <div className="scc-stage sticky top-0 h-screen w-full overflow-hidden" style={{ zIndex: 0 }}>
        <div ref={persRef} className="absolute inset-0">
          <div ref={cardRef} className="scc-card">
            <BrowserBar />
            <div className="relative w-full" style={{ aspectRatio: '16 / 9', background: '#0b0d10' }}>
              {[vA, vB].map((r, i) => (
                <video
                  key={i}
                  ref={r}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onLoadedData={onReady}
                  aria-label={t(CLIENTS.blocks[i].title)}
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ opacity: i === 0 ? 1 : 0, zIndex: i }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 머리말 — 부모 위 끝에 붙어 1:1 로 지나간다 */}
      <div
        className="absolute left-0 right-0 top-0"
        style={{ zIndex: 2, padding: '200px var(--pad) 0' }}
      >
        <p style={{ fontSize: 16, lineHeight: '25.6px', fontWeight: 400, color: 'rgb(78,83,92)', paddingBottom: 20 }}>
          {t(DOCK.find((d) => d.id === 'dock-clients')!.label)}
        </p>
        <BlurTitle
          lines={CLIENTS.title.map((l) => t(l))}
          step={0.1}
          style={{ fontSize: 'var(--h2)', lineHeight: 1.28, fontWeight: 700, color: 'rgb(28,31,37)', letterSpacing: '-0.02em' }}
        />
        <p
          ref={head.ref}
          data-in={head.inView ? '' : undefined}
          className="scc-fu"
          style={{ '--d': '0.5s', marginTop: 24, maxWidth: 'min(520px, calc(var(--cl) - var(--pad) - 24px))', fontSize: 'var(--ib)', lineHeight: 1.6, color: 'rgb(78,83,92)' } as CSSProperties}
        >
          {t(CLIENTS.desc)}
        </p>
      </div>

      {/* 설명 칸 — 무대 위로 1:1 로 지나간다 */}
      <div className="relative flex" style={{ zIndex: 1, marginTop: '-100vh' }}>
        <div style={{ flex: 3, paddingLeft: 'calc(var(--pad) - 20px)' }}>
          <div ref={runwayRef} style={{ height: '120vh' }} />
          <div ref={track1Ref}>
            <Explain refEl={li1Ref} block={CLIENTS.blocks[0]} t={t} />
          </div>
          <div ref={ulRef} style={{ height: '90vh' }}>
            <Explain refEl={li2Ref} block={CLIENTS.blocks[1]} t={t} more />
          </div>
        </div>
        <div style={{ flex: 4 }} />
      </div>
    </div>
  );
}

function Explain({ refEl, block, t, more }: { refEl: React.RefObject<HTMLDivElement>; block: { title: Tr; desc: Tr }; t: ReturnType<typeof useT>; more?: boolean }) {
  return (
    <div ref={refEl} className="scc-li scc-text flex flex-col" style={{ gap: 12, opacity: 0.3 }}>
      <h3 style={{ fontSize: 'var(--it)', lineHeight: 1.48, fontWeight: 700, color: '#000', letterSpacing: '-0.02em', whiteSpace: 'pre-line' }}>{t(block.title)}</h3>
      <p style={{ fontSize: 'var(--ib)', lineHeight: 1.6, fontWeight: 400, color: 'rgb(107,118,132)' }}>{t(block.desc)}</p>
      {more && <MorePill label={t(MORE)} />}
    </div>
  );
}

function PillArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden className="block flex-none">
      <path d="M2 7h9.5M7.5 2.8 11.7 7l-4.2 4.2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 토스식 알약(높이 48 · 글자 굴림 + 화살표 밀림) — 설명 2 아래 margin-top 28(간격 12 + 16) */
function MorePill({ label }: { label: string }) {
  const chars = Array.from(label);
  const row = (k: string) => chars.map((c, i) => <span key={`${k}${i}`} style={{ transitionDelay: `${i * 5}ms` }}>{c}</span>);
  return (
    <Link href={MORE_HREF} className="scc-pill">
      <span className="scc-pl">
        <span className="a" style={{ display: 'inline-flex' }}>{row('a')}</span>
        <span className="b" aria-hidden>{row('b')}</span>
      </span>
      <span className="scc-ico" aria-hidden>
        <span className="scc-dot"><span className="scc-arr"><PillArrow /><PillArrow /></span></span>
      </span>
    </Link>
  );
}

/* ───────────── 모바일 · 태블릿: 카드 쌓기 ───────────── */
function MobileCard({ block, src, t, more }: { block: { title: Tr; desc: Tr }; src: string; t: ReturnType<typeof useT>; more?: boolean }) {
  // 토스 모바일: 번역 위치 위 끝이 ≈571px(844 기준)에 닿으면 120px 아래에서 0.8초 'ease' 로 떠오름
  const { ref, inView } = useInView<HTMLLIElement>({ threshold: 0, rootMargin: '0px 0px -32% 0px' });
  const vRef = useRef<HTMLVideoElement>(null);
  useLazyVideo(vRef, src);
  useEffect(() => {
    const v = vRef.current;
    if (!v || prefersReducedMotion()) return undefined;
    const ob = new IntersectionObserver(([e]) => (e.isIntersecting ? tryPlay(v) : v.pause()), { threshold: 0.25 });
    ob.observe(v);
    const onData = () => {
      const r = v.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) tryPlay(v);
    };
    v.addEventListener('loadeddata', onData);
    return () => {
      ob.disconnect();
      v.removeEventListener('loadeddata', onData);
    };
  }, []);
  return (
    <li ref={ref} data-in={inView ? '' : undefined} className="scc-fu list-none" style={{ '--y': '120px', '--t': '0.8s' } as CSSProperties}>
      <div
        className="relative overflow-hidden"
        style={{ aspectRatio: '350 / 300', borderRadius: 32, background: 'rgb(245,245,245)', border: '1px solid rgba(7,25,76,0.05)' }}
      >
        <div
          className="absolute overflow-hidden bg-white"
          style={{ left: 24, top: 40, width: 'calc(100% + 8px)', borderRadius: 18, boxShadow: '0 0 0 1px rgba(0,27,55,0.05), 0 24px 48px -24px rgba(0,27,55,0.18)' }}
        >
          <BrowserBar compact />
          <div className="relative w-full" style={{ aspectRatio: '16 / 9', background: '#0b0d10' }}>
            <video ref={vRef} muted loop playsInline preload="metadata" aria-label={t(block.title)} className="absolute inset-0 h-full w-full object-cover" />
          </div>
        </div>
      </div>
      <h3 className="md:text-[24px] md:leading-[33.6px]" style={{ marginTop: 24, fontSize: 22, lineHeight: '30.8px', fontWeight: 700, color: '#000', letterSpacing: '-0.02em' }}>
        {t(block.title)}
      </h3>
      <p style={{ marginTop: 12, fontSize: 16, lineHeight: '25.6px', color: 'rgb(107,118,132)' }}>{t(block.desc)}</p>
      {more && <div className="scc-m-more"><MorePill label={t(MORE)} /></div>}
    </li>
  );
}

function MobileList({ t }: { t: ReturnType<typeof useT> }) {
  const desc = useInView<HTMLParagraphElement>({ threshold: 0, rootMargin: '0px 0px -18% 0px' });
  return (
    <div className="mx-auto max-w-[880px] px-5 pt-[160px] md:px-10">
      <p className="md:text-[16px]" style={{ fontSize: 14, lineHeight: '22.4px', color: 'rgb(78,83,92)' }}>
        {t(DOCK.find((d) => d.id === 'dock-clients')!.label)}
      </p>
      <BlurTitle
        lines={CLIENTS.title.map((l) => t(l))}
        step={0.067}
        lineGap={0.067}
        className="text-[36px] leading-[46.08px] md:text-[44px] md:leading-[56.32px]"
        style={{ marginTop: 20, fontWeight: 700, color: 'rgb(28,31,37)', letterSpacing: '-0.02em' }}
      />
      <p
        ref={desc.ref}
        data-in={desc.inView ? '' : undefined}
        className="scc-fu max-w-[520px]"
        style={{ '--d': '0.3s', marginTop: 16, fontSize: 16, lineHeight: '25.6px', color: 'rgb(78,83,92)' } as CSSProperties}
      >
        {t(CLIENTS.desc)}
      </p>
      <ul className="grid grid-cols-1 gap-[60px] md:grid-cols-2 md:gap-6" style={{ marginTop: 64 }}>
        <MobileCard block={CLIENTS.blocks[0]} src={CLIENTS.video} t={t} />
        <MobileCard block={CLIENTS.blocks[1]} src={CLIENTS.video2} t={t} more />
      </ul>
    </div>
  );
}

/* ───────────── 로고 벽: 3줄, 줄마다 반대 방향으로 천천히 ───────────── */
const ROWS = [LOGOS.slice(0, 18), LOGOS.slice(18, 35), LOGOS.slice(35)];

function LogoWall() {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0, rootMargin: '0px 0px -10% 0px' });
  return (
    <div ref={ref} data-in={inView ? '' : undefined} className="flex flex-col gap-2 pb-[120px] pt-[96px] lg:gap-4 lg:pb-[160px] lg:pt-[120px]">
      {ROWS.map((row, ri) => (
        <div key={ri} className="scc-row scc-fu" style={{ '--d': `${ri * 0.1}s` } as CSSProperties}>
          <div className="scc-track" data-rev={ri % 2 === 1 ? '' : undefined} style={{ '--n': row.length } as CSSProperties}>
            {[0, 1].map((dup) =>
              row.map((src, i) => (
                <div key={`${dup}-${i}`} className="scc-logo" data-dup={dup ? '' : undefined} aria-hidden={dup ? true : undefined}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" loading="lazy" decoding="async" draggable={false} />
                </div>
              )),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SceneClients() {
  const t = useT();
  return (
    <section id="dock-clients" data-no-natural-reveal className="scc-root relative" style={{ background: BG }}>
      <style>{CSS}</style>
      {/* 앞 장면(⑦ 규모, 같은 #f3f3f3)과 한 판으로 잇는다 — 토스도 광고 · 결제가 한 섹션(사이 120 은 앞 장면 아래 여백에 들어 있다). 흰 띠를 두면 회색 사이에 흰 줄이 생긴다 */}
      <div className="hidden lg:block">
        <DesktopStage t={t} />
      </div>
      <div className="lg:hidden">
        <MobileList t={t} />
      </div>
      <LogoWall />
      {/* 다음 장면(흰색)으로 이어지는 20vh 띠 — 데스크톱만. 모바일은 토스처럼 다음 검은 판(위 모서리 32)이 회색 위로 바로 올라온다 */}
      <div aria-hidden className="hidden lg:block" style={{ height: '20vh', background: `linear-gradient(${BG}, #fff)` }} />
    </section>
  );
}
