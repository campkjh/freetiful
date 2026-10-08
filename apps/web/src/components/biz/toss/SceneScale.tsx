'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useBizLang, useT } from '@/lib/biz/i18n';
import { CAREER, DOCK, EVENTS, INTRO, MATCH, SCALE } from './content';
import { prefersReducedMotion } from './scene';
import { createTerrain, type TerrainPin, type TerrainTexts } from './SceneScale.terrain';

/*
 * ⑦ 규모 — 토스 '광고' 장면(가운데 2줄 제목 + 살아 움직이는 점 지형 + 2단 글 · 3칸 숫자) 재구현.
 * sticky 없음: 지형은 시간으로만 흐르고 페이지와 1:1 로 지나간다. 글은 한 번만 흐림→선명(1s, ease, 0.1s 차례).
 * 실측(1440×900): 위 여백 280 · 제목 48/61.44/700 · 캔버스 0.62W(893) 지평선 0.38H 가 제목 아래 17px · 글줄 좌우 128.
 * 모바일(390): 위 160 · 제목 36/46.08 · 캔버스 1.75W(683) · 글 아래로 쌓고 숫자 줄은 위 선 + 좌우 2칸.
 */

const EASE = 'cubic-bezier(0.25, 0.1, 0.25, 1)';

/* 핀 5개 — 위치 · 반경 · 솟음은 실측값(화면 x 252/497/924/998/1328 @1440). 이름은 진행 가능 도시 */
const PIN_GEO: Omit<TerrainPin, 'label'>[] = [
  { xr: -1.3, zi: 10, radius: 800, power: 1.4, strength: 320 },
  { xr: -0.85, zi: 25, radius: 650, power: 1.4, strength: 350 },
  { xr: 0.85, zi: 30, radius: 700, power: 2, strength: 300 },
  { xr: 1.35, zi: 40, radius: 400, power: 3.5, strength: 280 },
  { xr: 1.9, zi: 15, radius: 1000, power: 3, strength: 340 },
];
/** CAREER 지도 카드 도시 순서(서울·인천·대전·대구·광주·부산·제주) 중 핀에 붙일 것 — 왼쪽→오른쪽 */
const PIN_CITY = [4, 2, 0, 3, 5];
/** 처음 켜 둘 핀(토스 데스크톱 기본값과 같은 자리) */
const DEFAULT_PIN = 2;

const CSS = `
.ssc{position:relative;background:#f3f3f3;overflow-x:clip;--side:20px}
.ssc-band{display:none;height:min(10vh,250px);background:linear-gradient(#f5f5f5,#f3f3f3)}
.ssc-head{position:relative;z-index:1;text-align:center;padding:160px var(--side) 0;pointer-events:none}
.ssc-eye{font-size:14px;line-height:22.4px;letter-spacing:-0.28px;font-weight:400;color:rgb(78,83,92);padding-bottom:20px}
.ssc-h2{margin:0;font-size:36px;line-height:46.08px;letter-spacing:-0.72px;font-weight:700;color:rgb(28,31,37);word-break:keep-all;text-wrap:balance}
.ssc-line{display:inline-block}
.ssc-cw{position:relative;height:175vw;margin-top:calc(-66.5vw + 98px);overflow:clip}
.ssc-cw canvas{display:block;width:100%;height:100%;cursor:crosshair;touch-action:pan-y}
.ssc-row{position:relative;z-index:1;padding:55px var(--side) 0;display:flex;flex-direction:column}
.ssc-txt{display:flex;flex-direction:column;gap:24px;max-width:732px}
.ssc-h3{margin:0;font-size:28px;line-height:39.2px;letter-spacing:-0.56px;font-weight:700;color:rgb(28,31,37);word-break:keep-all}
.ssc-p{margin:0;font-size:16px;line-height:25.6px;letter-spacing:-0.32px;font-weight:400;color:rgb(78,83,92);word-break:keep-all}
.ssc-cols{display:flex;flex-direction:column;gap:20px;margin:60px 0 24px}
.ssc-col{display:flex;gap:16px;border-top:1px solid rgba(3,31,63,0.09);padding-top:16px}
.ssc-ct{flex:none;width:132px;font-size:18px;line-height:26.64px;letter-spacing:-0.36px;font-weight:600;color:#191F28;font-variant-numeric:tabular-nums}
.ssc-cd{flex:1;min-width:0;font-size:16px;line-height:25.6px;letter-spacing:-0.32px;color:rgb(114,119,128);word-break:keep-all}
.ssc-rv{opacity:0;transform:translate3d(0,24px,0);filter:blur(16px);transition:opacity 1s ${EASE},transform 1s ${EASE},filter 1s ${EASE};will-change:opacity,transform,filter}
.ssc-rv.nb{filter:none;transition:opacity 1s ${EASE},transform 1s ${EASE};will-change:opacity,transform}
.ssc-rv.in{opacity:1;transform:none;filter:blur(0)}
.ssc-rv.nb.in{filter:none}
/* 알약 버튼 */
.ssc-pill{display:inline-flex;align-items:center;height:48px;border-radius:136px;padding:11px 0 11px 18px;background:rgba(7,25,76,0.051);border:0.66px solid rgba(13,25,74,0.0392);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:rgb(28,31,37);font-size:14px;line-height:22.4px;letter-spacing:-0.28px;font-weight:600;text-decoration:none;transition:background-color .2s;box-sizing:border-box}
.ssc-pill:hover{background:rgba(3,31,63,0.09)}
.ssc-pl{position:relative;display:inline-flex;overflow:hidden;white-space:pre}
.ssc-pl span{display:inline-block;transition:transform .35s ${EASE},opacity .35s ${EASE}}
.ssc-pl .b{position:absolute;left:0;top:0;display:inline-flex}
.ssc-pl .b span{transform:translateY(16px);opacity:0}
.ssc-pill:hover .ssc-pl .a span{transform:translateY(-16px);opacity:0}
.ssc-pill:hover .ssc-pl .b span{transform:none;opacity:1}
.ssc-ico{padding:0 10px 0 12px;display:inline-flex}
.ssc-dot{width:28px;height:28px;border-radius:80px;background:rgb(28,31,37);overflow:hidden;display:flex;align-items:center}
.ssc-arr{display:flex;gap:14px;flex:none;transform:translateX(-21px);transition:transform .35s ${EASE}}
.ssc-pill:hover .ssc-arr{transform:translateX(7px)}
@media (min-width:768px){
  .ssc{--side:48px}
  .ssc-band{display:block}
  .ssc-head{padding-top:220px}
  .ssc-eye{font-size:16px;line-height:25.6px;letter-spacing:-0.32px}
  .ssc-h2{font-size:44px;line-height:56.32px;letter-spacing:-0.88px}
  .ssc-cw{height:80vw;margin-top:calc(-30.4vw + 40px)}
  .ssc-row{padding-top:24px;padding-bottom:120px}
  .ssc-h3{font-size:32px;line-height:44.8px;letter-spacing:-0.64px}
  .ssc-cols{flex-direction:row;gap:12px;margin:56px 0 0}
  .ssc-col{flex:1;flex-direction:column;gap:4px;border-top:0;border-left:1px solid rgba(3,31,63,0.09);padding:0 0 0 24px}
  .ssc-ct{width:auto;font-size:20px;line-height:29.6px;letter-spacing:-0.4px}
  .ssc-cta-wrap{margin-top:48px}
  .ssc-pill{font-size:16px;line-height:25.6px;letter-spacing:-0.32px}
}
@media (min-width:1024px){
  .ssc{--side:80px}
  .ssc-head{padding-top:280px}
  .ssc-h2{font-size:48px;line-height:61.44px;letter-spacing:-0.96px}
  .ssc-cw{height:62vw;margin-top:calc(-23.56vw + 17px)}
  .ssc-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:24px;row-gap:64px;align-items:start;padding-top:0}
  .ssc-txt{grid-column:1;grid-row:1}
  .ssc-cols{grid-column:2;grid-row:1 / span 2;margin:0}
  .ssc-cta-wrap{grid-column:1;grid-row:2;margin-top:0}
}
@media (min-width:1024px) and (min-height:901px){.ssc-row{margin-top:-50px}}
@media (min-width:1440px){.ssc{--side:128px}}
@media (min-width:1441px){.ssc-h2{font-size:52px;line-height:66.56px;letter-spacing:-1.04px}}
@media (min-width:1600px){
  .ssc{--side:160px}
  .ssc-h2{font-size:64px;line-height:81.92px;letter-spacing:-1.28px}
  .ssc-cw{height:1072px;margin-top:-233px}
  .ssc-h3{font-size:40px;line-height:56px;letter-spacing:-0.8px}
  .ssc-ct{font-size:24px;line-height:35.52px;letter-spacing:-0.48px}
  .ssc-p,.ssc-cd{font-size:18px;line-height:28.8px;letter-spacing:-0.36px}
}
@media (prefers-reduced-motion:reduce){
  .ssc-rv,.ssc-rv.nb{opacity:1;transform:none;filter:none;transition:none}
}
`;

/** 한 번만 켜지는 보임 신호(IntersectionObserver) */
function useOnce(ref: RefObject<Element>, opt: IntersectionObserverInit, enabled = true) {
  const [on, setOn] = useState(false);
  const key = `${opt.rootMargin}|${String(opt.threshold)}`;
  useEffect(() => {
    const el = ref.current;
    if (!el || on || !enabled) return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setOn(true); io.disconnect(); }
    }, opt);
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, on, enabled, key]);
  return on;
}

function useMedia(q: string) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const f = () => setM(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [q]);
  return m;
}

/** 숫자 세기 — 켜지면 delay 뒤 1초 감속으로 0 → value(글자만 직접 바꿈) */
function CountNum({ value, suffix, run, delay }: { value: number; suffix: string; run: boolean; delay: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const fmt = (v: number) => `${Math.round(v).toLocaleString('en-US')}${suffix}`;
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (prefersReducedMotion()) { el.textContent = fmt(value); return undefined; }
    if (!run) { el.textContent = fmt(0); return undefined; }
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / 1000));
      el.textContent = fmt(value * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, value, suffix, delay]);
  return <span ref={ref}>{fmt(value)}</span>;
}

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 7h9.5M7.5 2.8 11.7 7l-4.2 4.2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 토스식 알약 — 글자 굴림 + 화살표 밀림(호버) */
function Pill({ label, href }: { label: string; href: string }) {
  const chars = Array.from(label);
  return (
    <Link href={href} className="ssc-pill">
      <span className="ssc-pl" aria-label={label}>
        <span className="a" aria-hidden style={{ display: 'inline-flex' }}>{chars.map((c, i) => <span key={i} style={{ transitionDelay: `${i * 12}ms` }}>{c}</span>)}</span>
        <span className="b" aria-hidden>{chars.map((c, i) => <span key={i} style={{ transitionDelay: `${i * 12}ms` }}>{c}</span>)}</span>
      </span>
      <span className="ssc-ico">
        <span className="ssc-dot"><span className="ssc-arr"><Arrow /><Arrow /></span></span>
      </span>
    </Link>
  );
}

export default function SceneScale() {
  const t = useT();
  const { lang } = useBizLang();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useRef<ReturnType<typeof createTerrain> | null>(null);
  const h2Ref = useRef<HTMLHeadingElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const h3Ref = useRef<HTMLHeadingElement>(null);
  const pRef = useRef<HTMLParagraphElement>(null);
  const colsRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const desk = useMedia('(min-width: 768px)');

  // 데스크톱: 제목은 통째로 보일 때, 글줄은 80% 보일 때 한꺼번에. 모바일: 요소마다 화면 위에서 실측 높이에 닿을 때
  const titleOn = useOnce(h2Ref, desk ? { threshold: 1 } : { rootMargin: '0px 0px -16% 0px' });
  const rowOn = useOnce(rowRef, { threshold: 0.8 }, desk);
  const h3On = useOnce(h3Ref, { rootMargin: '0px 0px -59% 0px' }, !desk);
  const pOn = useOnce(pRef, { rootMargin: '0px 0px -43% 0px' }, !desk);
  const colsOn = useOnce(colsRef, { rootMargin: '0px 0px -23% 0px' }, !desk);
  const ctaOn = useOnce(ctaRef, { rootMargin: '0px 0px -10% 0px' }, !desk);
  const show = {
    h3: desk ? rowOn : h3On,
    p: desk ? rowOn : pOn,
    cols: desk ? rowOn : colsOn,
    cta: desk ? rowOn : ctaOn,
  };

  const texts: TerrainTexts = useMemo(() => {
    const locale = lang === 'ko' ? 'ko-KR' : lang === 'ja' ? 'ja-JP' : lang === 'zh' ? 'zh-CN' : 'en-US';
    const df = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' });
    const tf = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const st = SCALE.stats[0];
    return {
      pins: PIN_CITY.map((c) => t(CAREER.cards[2].cities![c])),
      infoLabel: t(st.label),
      count: `${st.value.toLocaleString('en-US')}${t(st.suffix)}`,
      right: [t(EVENTS.tag), ...MATCH.subPills.map((p) => t(p))],
      clock: (d: Date) => `${df.format(d)} ${tf.format(d)}`,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return undefined;
    const pins = PIN_GEO.map((g, i) => ({ ...g, label: texts.pins[i] }));
    const e = createTerrain(cv, { pins, texts, defaultPin: DEFAULT_PIN, still: prefersReducedMotion() });
    engine.current = e;
    return () => { e.destroy(); engine.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { engine.current?.setTexts(texts); }, [texts]);

  const rv = (on: boolean, delay: number, blur = true): { className: string; style: CSSProperties } => ({
    className: `ssc-rv${blur ? '' : ' nb'}${on ? ' in' : ''}`,
    style: { transitionDelay: `${delay}ms` },
  });
  const eyebrow = DOCK.find((d) => d.id === 'dock-scale')!.label;
  const cta = INTRO.listItems[0];
  // 모바일 제목 줄 차례: 0 / 67 / 200ms, 데스크톱 0.1s 씩
  const lineDelay = (i: number) => (desk ? i * 100 : [0, 67, 200][i] ?? i * 100);

  return (
    <section id="dock-scale" className="ssc">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ssc-band" aria-hidden />
      <div className="ssc-head">
        <div className="ssc-eye">{t(eyebrow)}</div>
        <h2 ref={h2Ref} className="ssc-h2">
          {SCALE.title.map((l, i) => (
            <span key={i}>
              <span {...rv(titleOn, lineDelay(i))} className={`ssc-line ${rv(titleOn, 0).className}`}>{t(l)}</span>
              {i < SCALE.title.length - 1 && <br />}
            </span>
          ))}
        </h2>
      </div>
      <div className="ssc-cw">
        <canvas ref={canvasRef} aria-hidden />
      </div>
      <div ref={rowRef} className="ssc-row">
        <div className="ssc-txt">
          <h3 ref={h3Ref} {...rv(show.h3, 0)} className={`ssc-h3 ${rv(show.h3, 0).className}`}>{t(SCALE.leadTitle)}</h3>
          <p ref={pRef} {...rv(show.p, 200)} className={`ssc-p ${rv(show.p, 0).className}`}>{t(SCALE.leadDesc)}</p>
        </div>
        <div ref={colsRef} className="ssc-cols">
          {SCALE.stats.map((s, i) => {
            const d = desk ? 100 + i * 200 : i * 200;
            return (
              <div key={i} {...rv(show.cols, d, false)} className={`ssc-col ${rv(show.cols, 0, false).className}`}>
                <div className="ssc-ct"><CountNum value={s.value} suffix={t(s.suffix)} run={show.cols} delay={d} /></div>
                <div className="ssc-cd">{t(s.label)}</div>
              </div>
            );
          })}
        </div>
        <div ref={ctaRef} {...rv(show.cta, desk ? 400 : 0, false)} className={`ssc-cta-wrap ${rv(show.cta, 0, false).className}`}>
          <Pill label={t(cta.cta)} href={cta.href} />
        </div>
      </div>
    </section>
  );
}
