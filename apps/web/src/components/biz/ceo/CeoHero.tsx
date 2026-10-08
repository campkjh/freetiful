'use client';

/* eslint-disable @next/next/no-img-element -- public 정적 누끼(투명 webp), 고정 무대 좌표로 직접 움직인다 */
import { useEffect, useRef, type CSSProperties } from 'react';
import { useBizLang, useT } from '@/lib/biz/i18n';
import { ease, lerp, seg, useFrame, usePassProgress, useSceneProgress } from '../toss/scene';
import { Particles } from '../toss/SceneIntro.parts';
import { prefersReducedMotion } from '../scroll-to';
import { CEO_NAME, CEO_ROLE, HERO } from './content';
import { flag, put, smooth01, splitPhrases, useIsoLayoutEffect, useMode } from './motion';

/*
 * ① CEO 인사말 첫 장면(261009 사장 '대표 사진이 마스크로 열리며 큰 제목 — 고급 비즈 인터랙션으로').
 * 데스크톱(≥1024 · 가로 화면 · 움직임 줄이기 아님): 300vh 부모 + 머리줄 아래 sticky 무대(비즈 홈 장면 엔진 · 리렌더 없이 스타일 직접).
 *   들어오면(시간) 왼쪽 큰 제목이 낱말마다 흐림→또렷, 오른쪽 둥근 창이 아래에서 위로 열리며 남색 무대 위 대표 누끼가 1.1배 → 1배로 내려앉는다.
 *   스크롤: 창이 화면 가득 커지고(clip-path, 비즈 홈 첫 장면 카드 → 꽉 찬 화면 어법) 누끼는 오른쪽으로 크게, 제목은 왼쪽으로 흐려지며 빠짐 →
 *   왼쪽에 대표 한마디가 낱말마다 밝아짐(비즈 홈 '함께한 순간' 맺음말 어법) → 서명 줄 → 고정이 풀리는 순간 0.92 배 둥근 카드로(무대 장면 끝 어법).
 * 모바일 · 태블릿 · 움직임 줄이기: 고정 없이 제목 + 둥근 카드(아래에서 위로 마스크가 열림) — 카드가 화면에 들어오면 한마디가 낱말마다 밝아지고,
 *   지나가는 동안 누끼 · 배경 글자가 반대로 살짝 흐른다(시차).
 */

const RUN_VH = 300;
/* 진행률 구간 */
const OPEN: [number, number] = [0.03, 0.4]; // 창 → 화면 가득
const TEXT_OUT: [number, number] = [0.02, 0.24];
const SHADE: [number, number] = [0.28, 0.46];
const Q_SHOW: [number, number] = [0.36, 0.44];
const Q_WORDS: [number, number] = [0.44, 0.78];
const CAP_AT = 0.8;
const INTRO_MS = 1500;

export default function CeoHero() {
  const mode = useMode();
  return (
    <section className="cx-hero relative" aria-labelledby="cx-hero-title">
      {mode !== 'stack' && <HeroDesk className={mode === 'ssr' ? 'cx-desk' : ''} active={mode === 'desk'} ids={mode === 'desk'} />}
      {mode !== 'desk' && <HeroStack className={mode === 'ssr' ? 'cx-stack' : ''} active={mode === 'stack'} ids={mode === 'stack'} />}
    </section>
  );
}

/* ═══════════════════════ 데스크톱 ═══════════════════════ */

function HeroDesk({ className, active, ids }: { className: string; active: boolean; ids: boolean }) {
  const t = useT();
  const { lang } = useBizLang();
  const runRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const winRef = useRef<HTMLDivElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const wmRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const quoteRef = useRef<HTMLDivElement>(null);
  const capRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const geo = useRef({ W: 1440, H: 836, cL: 150, cW: 1140, sl: 754, sr: 1290, st: 75, sb: 761 });
  const intro = useRef(0);
  const P = useSceneProgress(runRef);
  const words = splitPhrases(t(HERO.motto), lang);

  const update = (p: number) => {
    if (!active) return;
    const g = geo.current;
    const ie = intro.current;
    const e = ease.inOut(seg(p, OPEN[0], OPEN[1]));
    // 창(clip-path) — 처음엔 오른쪽 둥근 칸(들어올 때 아래에서 위로 열림), 스크롤하면 화면 가득
    const top0 = lerp(g.sb, g.st, ie);
    const it = lerp(top0, 0, e);
    const ir = lerp(g.W - g.sr, 0, e);
    const ib = lerp(g.H - g.sb, 0, e);
    const il = lerp(g.sl, 0, e);
    const rad = lerp(36, 0, e);
    put(winRef.current, 'clip-path', `inset(${it.toFixed(1)}px ${ir.toFixed(1)}px ${ib.toFixed(1)}px ${il.toFixed(1)}px round ${rad.toFixed(1)}px)`);
    // 누끼 — 칸 가운데 · 칸 높이 97% → 오른쪽 넷째 칸 · 화면 높이 95%(들어올 때 1.1배에서 내려앉음)
    const A = HERO.portrait.aspect;
    const hp = lerp((g.sb - g.st) * 0.97, g.H * 0.95, e) * (1 + 0.1 * (1 - ie));
    const cx = lerp((g.sl + g.sr) / 2, g.cL + g.cW * 0.76, e);
    const by = lerp(g.sb, g.H, e) + 28 * (1 - ie);
    const s = hp / g.H;
    put(imgRef.current, 'transform', `translate3d(${(cx - (A * g.H * s) / 2).toFixed(1)}px,${(by - g.H * s).toFixed(1)}px,0) scale(${s.toFixed(4)})`);
    put(imgRef.current, 'opacity', Math.min(1, ie * 1.6).toFixed(3));
    // 뒤 조명 — 머리 · 어깨 뒤
    const sd = hp * 1.3;
    put(spotRef.current, 'transform', `translate3d(${(cx - sd / 2).toFixed(1)}px,${(by - hp * 0.78 - sd / 2).toFixed(1)}px,0) scale(${(sd / 1000).toFixed(4)})`);
    // 배경 큰 글자 — 칸 가운데에서 화면 가운데로, 스크롤 내내 왼쪽으로 천천히(시차)
    const wx = lerp((g.sl + g.sr) / 2 - g.W / 2, -g.W * 0.03, e) - p * g.W * 0.06;
    put(wmRef.current, 'transform', `translate3d(calc(-50% + ${wx.toFixed(1)}px),-50%,0)`);
    // 왼쪽 제목 — 창이 덮어 오는 동안 왼쪽으로 흐려지며 빠짐
    const k = ease.out(seg(p, TEXT_OUT[0], TEXT_OUT[1]));
    put(textRef.current, 'opacity', (1 - k).toFixed(3));
    put(textRef.current, 'transform', `translate3d(${(-56 * k).toFixed(1)}px,0,0)`);
    put(textRef.current, 'filter', k > 0.004 ? `blur(${(8 * k).toFixed(2)}px)` : 'none');
    put(hintRef.current, 'opacity', (1 - seg(p, 0, 0.06)).toFixed(3));
    // 왼쪽 그늘 · 한마디
    put(shadeRef.current, 'opacity', seg(p, SHADE[0], SHADE[1]).toFixed(3));
    const qs = seg(p, Q_SHOW[0], Q_SHOW[1]);
    put(quoteRef.current, 'opacity', qs.toFixed(3));
    put(quoteRef.current, 'visibility', qs > 0 ? 'visible' : 'hidden');
    const n = words.length;
    const d = (Q_WORDS[1] - Q_WORDS[0]) / Math.max(1, n);
    for (let i = 0; i < n; i++) {
      const el = wordRefs.current[i];
      if (!el) continue;
      const q = smooth01(seg(p, Q_WORDS[0] + i * d, Q_WORDS[0] + (i + 1.6) * d));
      put(el, 'color', `rgba(255,255,255,${(0.14 + 0.86 * q).toFixed(3)})`);
      put(el, 'filter', q >= 0.999 ? 'none' : `blur(${(6 * (1 - q)).toFixed(2)}px)`);
    }
    flag(capRef.current, 'data-on', p >= CAP_AT);
    // 끝 — 고정이 풀리면 둥근 카드로(되돌아가면 원래대로)
    flag(cardRef.current, 'data-end', p >= 0.9995);
  };
  const upd = useRef(update);
  upd.current = update;

  // 크기 — 무대 · 본문 칸(1140) · 오른쪽 사진 칸(제목 · 한마디 칸의 왼쪽 · 폭은 CSS 가 같은 식으로 — 붙기 전 첫 그림부터 제자리)
  useIsoLayoutEffect(() => {
    if (!active) return undefined;
    const layout = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const W = stage.clientWidth || window.innerWidth;
      const H = stage.clientHeight || window.innerHeight;
      const cW = Math.min(1140, W - 96);
      const cL = Math.max(48, (W - 1140) / 2);
      geo.current = { W, H, cL, cW, sl: cL + cW * 0.53, sr: cL + cW, st: H * 0.09, sb: H * 0.91 };
      const img = imgRef.current;
      if (img) {
        img.style.height = `${H}px`;
        img.style.width = `${HERO.portrait.aspect * H}px`;
      }
      if (wmRef.current) wmRef.current.style.fontSize = `${Math.round(W * 0.22)}px`;
      upd.current(P.get());
    };
    layout();
    window.addEventListener('resize', layout);
    return () => window.removeEventListener('resize', layout);
  }, [active, P]);

  // 들어올 때 한 번 — 창이 아래에서 위로 열리고 누끼가 내려앉는다(1.5초, easeOutQuart)
  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    let t0 = 0;
    const tick = (now: number) => {
      if (!t0) t0 = now;
      const x = Math.min(1, (now - t0) / INTRO_MS);
      intro.current = ease.outQuart(x);
      upd.current(P.get());
      if (x < 1) raf = requestAnimationFrame(tick);
    };
    const tm = window.setTimeout(() => { raf = requestAnimationFrame(tick); }, 260);
    return () => { window.clearTimeout(tm); cancelAnimationFrame(raf); };
  }, [active, P]);

  // 언어가 바뀌면 낱말 수가 달라진다 — 새 낱말에 지금 진행률을 바로 입힌다
  useIsoLayoutEffect(() => { upd.current(P.get()); }, [lang]);

  useFrame(P, update);

  const title = HERO.title.map((l) => t(l));
  let wi = 0;
  return (
    <div ref={runRef} className={`relative ${className}`} style={{ height: `${RUN_VH}vh` }}>
      <div ref={stageRef} className="cx-hd-stage">
        {/* 왼쪽 큰 제목 — 낱말마다 흐림 → 또렷(CSS, 붙기 전에도 돈다) */}
        <div ref={textRef} className="cx-hd-text">
          <p className="cx-eyebrow cx-rise" style={{ '--i': 0 } as CSSProperties}>{t(HERO.eyebrow)}</p>
          <h1 id={ids ? 'cx-hero-title' : undefined} className="cx-hd-h1" aria-label={t(HERO.titleFull)}>
            {title.map((line, li) => (
              <span key={li} className="block" aria-hidden>
                {line.split(' ').map((w, j, a) => {
                  wi += 1;
                  return (
                    <span key={j}>
                      <span className="cx-hw cx-rise" style={{ '--i': wi } as CSSProperties}>{w}</span>
                      {j < a.length - 1 ? ' ' : ''}
                    </span>
                  );
                })}
              </span>
            ))}
          </h1>
          <p className="cx-hd-sub cx-rise" style={{ '--i': wi + 1 } as CSSProperties}>{t(HERO.sub)}</p>
        </div>
        <div ref={hintRef} className="cx-hint" aria-hidden>
          <span className="cx-hint-line" />
          {t(HERO.scrollHint)}
        </div>

        {/* 창 — 남색 무대 · 조명 · 큰 글자 · 떠다니는 빛 · 누끼 · 한마디 */}
        <div ref={cardRef} className="cx-hd-card">
          <div ref={winRef} className="cx-hd-win" style={{ clipPath: 'inset(91% 6% 9% 53% round 36px)' }}>
            <div className="cx-navy" />
            <div ref={spotRef} className="cx-spot" />
            <div ref={wmRef} className="cx-wm" aria-hidden>Freetiful</div>
            <Particles style={{ left: 0, top: 0, width: '100%', height: '100%' }} count={90} />
            <img
              ref={imgRef}
              src={HERO.portrait.lg}
              alt={t(HERO.alt)}
              className="cx-pt"
              style={{ opacity: 0 }}
              decoding="async"
              fetchPriority="high"
              draggable={false}
            />
            <div className="cx-floor" />
            <div ref={shadeRef} className="cx-shade" style={{ opacity: 0 }} />
            <div ref={quoteRef} className="cx-hd-q" style={{ opacity: 0, visibility: 'hidden' }}>
              <span className="cx-qmark" aria-hidden>&ldquo;</span>
              <p className="cx-hd-qt">
                <span className="sr-only">{t(HERO.motto)}</span>
                <span aria-hidden>
                  {words.map((x, i) => (
                    <span key={`${lang}-${i}`}>
                      <span ref={(el) => { wordRefs.current[i] = el; }} className="cx-qw">{x.w}</span>
                      {x.sp ? ' ' : ''}
                    </span>
                  ))}
                </span>
              </p>
              <div ref={capRef} className="cx-hd-cap">
                <span className="cx-cap-line" />
                <span>{t(CEO_ROLE)} <b>{t(CEO_NAME)}</b></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ 모바일 · 태블릿 · 움직임 줄이기 ═══════════════════════ */

function HeroStack({ className, active, ids }: { className: string; active: boolean; ids: boolean }) {
  const t = useT();
  const { lang } = useBizLang();
  const cardRef = useRef<HTMLDivElement>(null);
  const parRef = useRef<HTMLDivElement>(null);
  const wmRef = useRef<HTMLDivElement>(null);
  const qRef = useRef<HTMLDivElement>(null);
  const pass = usePassProgress(cardRef);
  const words = splitPhrases(t(HERO.motto), lang);

  // 카드가 화면에 반 넘게 들어오면 한마디가 낱말마다 밝아진다(한 번)
  useEffect(() => {
    if (!active) return undefined;
    const card = cardRef.current;
    const q = qRef.current;
    if (!card || !q) return undefined;
    if (prefersReducedMotion()) {
      q.setAttribute('data-q', '');
      return undefined;
    }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        q.setAttribute('data-q', '');
        io.disconnect();
      }
    }, { threshold: 0.5 });
    io.observe(card);
    return () => io.disconnect();
  }, [active]);

  // 지나가는 동안 누끼는 위로 · 배경 글자는 옆으로 살짝(시차 — 줄인 움직임이면 그대로)
  useFrame(pass, (p) => {
    if (!active || prefersReducedMotion()) return;
    put(parRef.current, 'transform', `translate3d(0,${((p - 0.5) * -32).toFixed(1)}px,0)`);
    put(wmRef.current, 'transform', `translate3d(calc(-50% + ${((0.5 - p) * 70).toFixed(1)}px),-50%,0)`);
  });

  const title = HERO.title.map((l) => t(l));
  let wi = 0;
  return (
    <div className={`cx-hm ${className}`}>
      <div className="cx-hm-text">
        <p className="cx-eyebrow cx-rise" style={{ '--i': 0 } as CSSProperties}>{t(HERO.eyebrow)}</p>
        <h1 id={ids ? 'cx-hero-title' : undefined} className="cx-hm-h1" aria-label={t(HERO.titleFull)}>
          {title.map((line, li) => (
            <span key={li} className="block" aria-hidden>
              {line.split(' ').map((w, j, a) => {
                wi += 1;
                return (
                  <span key={j}>
                    <span className="cx-hw cx-rise" style={{ '--i': wi } as CSSProperties}>{w}</span>
                    {j < a.length - 1 ? ' ' : ''}
                  </span>
                );
              })}
            </span>
          ))}
        </h1>
        <p className="cx-hm-sub cx-rise" style={{ '--i': wi + 1 } as CSSProperties}>{t(HERO.sub)}</p>
      </div>

      <div ref={cardRef} className="cx-hm-card">
        <div className="cx-navy" />
        <div className="cx-hm-spot" />
        <div ref={wmRef} className="cx-wm cx-hm-wm" aria-hidden>Freetiful</div>
        <Particles style={{ left: 0, top: 0, width: '100%', height: '100%' }} count={44} />
        <div ref={parRef} className="cx-hm-par">
          <img
            src={HERO.portrait.sm}
            srcSet={`${HERO.portrait.sm} 628w, ${HERO.portrait.lg} 1068w`}
            sizes="(min-width: 768px) 420px, 92vw"
            alt={t(HERO.alt)}
            className="cx-hm-pt"
            decoding="async"
            fetchPriority="high"
            draggable={false}
          />
        </div>
        <div className="cx-hm-fade" />
        <div ref={qRef} className="cx-hm-q">
          <span className="cx-qmark cx-qmark-sm" aria-hidden>&ldquo;</span>
          <p className="cx-hm-qt">
            <span className="sr-only">{t(HERO.motto)}</span>
            <span aria-hidden>
              {words.map((x, i) => (
                <span key={`${lang}-${i}`}>
                  <span className="cx-mqw" style={{ '--d': `${0.25 + i * 0.09}s` } as CSSProperties}>{x.w}</span>
                  {x.sp ? ' ' : ''}
                </span>
              ))}
            </span>
          </p>
          <div className="cx-hm-cap" style={{ '--d': `${0.45 + words.length * 0.09}s` } as CSSProperties}>
            <span className="cx-cap-line" />
            <span>{t(CEO_ROLE)} <b>{t(CEO_NAME)}</b></span>
          </div>
        </div>
      </div>
    </div>
  );
}
