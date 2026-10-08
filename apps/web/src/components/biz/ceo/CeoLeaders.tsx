'use client';

/* eslint-disable @next/next/no-img-element -- public 정적 프로필(같은 3:4 틀로 맞춘 webp) */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useT } from '@/lib/biz/i18n';
import { FadeUp } from '@/components/biz/biz-motion';
import { useFrame, useSceneProgress } from '../toss/scene';
import { prefersReducedMotion } from '../scroll-to';
import { LEADERS, LEADERS_HEAD, type Leader } from './content';
import { put, useIsoLayoutEffect, useMode } from './motion';

/*
 * ④ 이사진 소개 9명(261009 사장 '사진 카드가 옆으로 흐르는 가로 스크롤 장면 — 모바일은 스와이프 캐러셀 + 점').
 * 데스크톱(≥1024 · 가로 화면 · 움직임 줄이기 아님): 부모 높이 = 무대 높이 + (카드 줄 길이 - 화면 폭). 세로 스크롤 진행률만큼 카드 줄이 왼쪽으로 흐르고,
 *   카드 속 사진은 화면 가운데에서 멀수록 반대로 살짝 밀린다(창 너머로 보는 시차). 오른쪽 위 '01 / 09' 와 진행 막대가 따라온다.
 *   무대가 화면에 들어오면 카드들이 오른쪽에서 차례로 미끄러져 들어온다(시간).
 * 모바일 · 태블릿 · 움직임 줄이기: 손가락으로 넘기는 캐러셀(scroll-snap) + 아래 점(지금 카드 = 긴 알약), 태블릿 이상은 좌우 단추도.
 * 사진은 누끼 · 배경 사진이 섞여 있어 같은 3:4 틀(몸 위 끝 8%)로 미리 맞춰 두었다(public/images/biz-v2/ceo/leader-*.webp).
 */

function LeaderCard({ p, t, i, imgRef, eager }: { p: Leader; t: ReturnType<typeof useT>; i: number; imgRef?: (el: HTMLImageElement | null) => void; eager?: boolean }) {
  return (
    <figure className="cx-lc" style={{ '--i': i } as CSSProperties}>
      <div className="cx-lc-ph">
        {/* 데스크톱 가로 흐름은 transform 으로 밀려 들어와 lazy 면 들어오는 순간 빈 카드가 보였다 — 미리 받는다(9장 · 장당 20~45KB) */}
        <img ref={imgRef} src={p.image} alt={t(p.name)} loading={eager ? 'eager' : 'lazy'} decoding="async" draggable={false} />
        <span className="cx-lc-bd">{p.badge}</span>
      </div>
      <figcaption>
        <span className="cx-lc-n">{t(p.name)}</span>
        <span className="cx-lc-r">{t(p.role)}</span>
      </figcaption>
    </figure>
  );
}

function Counter({ cur, n, numRef }: { cur?: number; n: number; numRef?: (el: HTMLSpanElement | null) => void }) {
  const pad = (x: number) => String(x).padStart(2, '0');
  return (
    <span className="cx-count" aria-hidden>
      <span ref={numRef} className="cx-count-cur">{pad((cur ?? 0) + 1)}</span>
      <span className="cx-count-sep">/</span>
      <span>{pad(n)}</span>
    </span>
  );
}

export default function CeoLeaders() {
  const mode = useMode();
  return (
    <section className="cx-ld" aria-labelledby="cx-ld-title">
      {mode !== 'stack' && <LeadersDesk className={mode === 'ssr' ? 'cx-desk' : ''} active={mode === 'desk'} ids={mode === 'desk'} />}
      {mode !== 'desk' && <LeadersStack className={mode === 'ssr' ? 'cx-stack' : ''} ids={mode === 'stack'} />}
    </section>
  );
}

/* ═══════════════════════ 데스크톱: 세로 스크롤 → 가로로 흐르는 카드 ═══════════════════════ */

function LeadersDesk({ className, active, ids }: { className: string; active: boolean; ids: boolean }) {
  const t = useT();
  const runRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const numRef = useRef<HTMLSpanElement | null>(null);
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const geo = useRef({ dist: 0, W: 1440, centers: [] as number[], cw: 300 });
  const cur = useRef(-1);
  const P = useSceneProgress(runRef);
  const n = LEADERS.length;

  const update = (p: number) => {
    if (!active) return;
    const g = geo.current;
    const tx = -p * g.dist;
    put(trackRef.current, 'transform', `translate3d(${tx.toFixed(1)}px,0,0)`);
    put(barRef.current, 'transform', `scaleX(${p.toFixed(4)})`);
    // 카드 속 사진 시차 — 화면 가운데에서 멀수록 반대로(카드 폭의 ±8%)
    for (let i = 0; i < n; i++) {
      const off = (g.centers[i] + tx - g.W / 2) / g.W;
      put(imgRefs.current[i], 'transform', `translate3d(${(-off * g.cw * 0.08).toFixed(1)}px,0,0) scale(1.1)`);
    }
    const c = Math.max(0, Math.min(n - 1, Math.round(p * (n - 1))));
    if (c !== cur.current) {
      cur.current = c;
      if (numRef.current) numRef.current.textContent = String(c + 1).padStart(2, '0');
    }
  };
  const upd = useRef(update);
  upd.current = update;

  useIsoLayoutEffect(() => {
    if (!active) return undefined;
    const layout = () => {
      const run = runRef.current;
      const stage = stageRef.current;
      const track = trackRef.current;
      if (!run || !stage || !track) return;
      const W = stage.clientWidth || window.innerWidth;
      const dist = Math.max(0, track.scrollWidth - W);
      const cards = Array.from(track.children) as HTMLElement[];
      geo.current = { dist, W, centers: cards.map((c) => c.offsetLeft + c.offsetWidth / 2), cw: cards[0]?.offsetWidth || 300 };
      // 무대 높이(머리줄 아래 화면) + 흐를 거리 — 세로 1px = 가로 1px
      run.style.height = `${stage.offsetHeight + dist}px`;
      upd.current(P.get());
    };
    layout();
    window.addEventListener('resize', layout);
    document.fonts?.ready.then(layout).catch(() => {});
    return () => window.removeEventListener('resize', layout);
  }, [active, P]);

  // 무대가 화면에 들어오면 카드가 오른쪽에서 차례로(한 번)
  useEffect(() => {
    if (!active) return undefined;
    const stage = stageRef.current;
    if (!stage) return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        stage.setAttribute('data-in', '');
        io.disconnect();
      }
    }, { threshold: 0.25 });
    io.observe(stage);
    return () => io.disconnect();
  }, [active]);

  useFrame(P, update);

  return (
    <div ref={runRef} className={`relative ${className}`} style={{ height: '220vh' }}>
      <div ref={stageRef} className="cx-ld-stage">
        <div className="cx-wrap cx-ld-head">
          <div>
            <p className="cx-eyebrow">{LEADERS_HEAD.eyebrow}</p>
            <h2 id={ids ? 'cx-ld-title' : undefined} className="cx-h2">{t(LEADERS_HEAD.title)}</h2>
          </div>
          <div className="cx-ld-meta">
            <Counter n={n} numRef={(el) => { numRef.current = el; }} />
            <span className="cx-ld-bar"><span ref={barRef} className="cx-ld-bar-in" /></span>
          </div>
        </div>
        <div ref={trackRef} className="cx-ld-track">
          {LEADERS.map((p, i) => (
            <LeaderCard key={p.key} p={p} t={t} i={i} eager={active} imgRef={(el) => { imgRefs.current[i] = el; }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ 모바일 · 태블릿 · 움직임 줄이기: 캐러셀 + 점 ═══════════════════════ */

function LeadersStack({ className, ids }: { className: string; ids: boolean }) {
  const t = useT();
  const trackRef = useRef<HTMLDivElement>(null);
  const [cur, setCur] = useState(0);
  const n = LEADERS.length;

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    let queued = false;
    const on = () => {
      queued = false;
      const first = track.children[0] as HTMLElement | undefined;
      const second = track.children[1] as HTMLElement | undefined;
      if (!first) return;
      const step = second ? second.offsetLeft - first.offsetLeft : first.offsetWidth;
      const max = track.scrollWidth - track.clientWidth;
      // 끝에 닿으면 마지막 카드(마지막 몇 장은 왼쪽 끝까지 못 간다)
      const i = track.scrollLeft >= max - 4 ? n - 1 : Math.round(track.scrollLeft / Math.max(1, step));
      setCur(Math.max(0, Math.min(n - 1, i)));
    };
    const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(on); } };
    track.addEventListener('scroll', onScroll, { passive: true });
    return () => track.removeEventListener('scroll', onScroll);
  }, [n]);

  const go = (i: number) => {
    const track = trackRef.current;
    const el = track?.children[Math.max(0, Math.min(n - 1, i))] as HTMLElement | undefined;
    if (!track || !el) return;
    const first = track.children[0] as HTMLElement;
    track.scrollTo({ left: el.offsetLeft - first.offsetLeft, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  return (
    <div className={`cx-lm ${className}`}>
      <div className="cx-wrap cx-ld-head">
        <FadeUp>
          <p className="cx-eyebrow">{LEADERS_HEAD.eyebrow}</p>
          <h2 id={ids ? 'cx-ld-title' : undefined} className="cx-h2">{t(LEADERS_HEAD.title)}</h2>
        </FadeUp>
        <div className="cx-lm-nav">
          <Counter cur={cur} n={n} />
          <button type="button" className="cx-arrow" onClick={() => go(cur - 1)} disabled={cur <= 0} aria-label="Previous">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden><path d="M11 4 6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className="cx-arrow" onClick={() => go(cur + 1)} disabled={cur >= n - 1} aria-label="Next">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden><path d="m7 4 5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>
      <FadeUp delay={120}>
        <div ref={trackRef} className="cx-lm-track">
          {LEADERS.map((p, i) => <LeaderCard key={p.key} p={p} t={t} i={i} />)}
        </div>
      </FadeUp>
      <div className="cx-dots" role="tablist" aria-label={t(LEADERS_HEAD.title)}>
        {LEADERS.map((p, i) => (
          <button
            key={p.key}
            type="button"
            role="tab"
            aria-selected={cur === i}
            aria-label={`${t(p.name)} ${t(p.role)}`}
            className="cx-dot"
            data-on={cur === i ? '' : undefined}
            onClick={() => go(i)}
          />
        ))}
      </div>
    </div>
  );
}
