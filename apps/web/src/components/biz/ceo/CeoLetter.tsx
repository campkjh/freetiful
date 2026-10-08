'use client';

/* eslint-disable @next/next/no-img-element -- public 정적 그림(얼굴 · 서명 svg) */
import { Fragment, useEffect, useRef, type CSSProperties, type RefObject } from 'react';
import { useBizLang, useT, type BizLangCode } from '@/lib/biz/i18n';
import { CountUp, useInView } from '@/components/biz/biz-motion';
import { clamp01, ease } from '../toss/scene';
import { prefersReducedMotion } from '../scroll-to';
import { CEO_NAME, CEO_ROLE, COMPANY, HERO, LETTER, SIGNATURE, STAT, STAT_AFTER, THANKS, type Seg } from './content';
import { flag, splitWords } from './motion';

/*
 * ② 인사말 본문(261009 사장 '문단이 스크롤에 맞춰 차오르고 핵심 문장 강조').
 * 문단마다 낱말(일 · 중은 글자)이 연회색 → 진한 글자로 스크롤 따라 차오른다(비즈 홈 ScrollFillText 어법 — 다만 리렌더 없이 rAF 로 색만 쓰고,
 *   목표값을 ~140ms 로 부드럽게 따라가 손가락 스크롤에서도 끊기지 않는다). 형광펜 문장은 마지막 낱말까지 차면 파란 밑줄이 왼쪽부터 그어지고,
 *   1,000여 명 문장은 파랑으로 찬다. 방송사 문단 뒤엔 그 사실을 크게 보여 주는 숫자 칸(세어 올라감).
 * 데스크톱(≥1024)은 왼쪽에 붙어 따라오는 칸(대표 얼굴 · 이름 · 읽은 만큼 차는 세로 선), 끝은 '감사합니다' + 서명이 펜으로 쓰듯 그려진다.
 * 움직임 줄이기면 처음부터 다 찬 글.
 */

const BASE: [number, number, number] = [209, 214, 219]; // #D1D6DB
const INK: Record<string, [number, number, number]> = {
  p: [25, 31, 40], // #191F28
  hl: [25, 31, 40],
  strong: [49, 130, 246], // #3182F6
  soft: [107, 118, 132], // #6B7684 — '감사합니다'
};

/** 문단 조각 → 낱말 span(data-k 로 잉크 색) — 형광펜 · 굵게는 묶음 span 안에 */
function FillPara({ segs, lang, kind = 'p', className = '' }: { segs: Seg[]; lang: BizLangCode; kind?: 'p' | 'soft'; className?: string }) {
  return (
    <p data-fp className={`cx-p ${className}`}>
      {segs.map((sg, si) => {
        const k = sg.k || kind;
        const words = splitWords(sg.s, lang).map((w, wi) => (
          <span key={wi} className="cx-w" data-k={k}>{w}</span>
        ));
        if (sg.k === 'hl') return <span key={si} data-hl className="cx-hl">{words}</span>;
        if (sg.k === 'strong') return <strong key={si} className="cx-st">{words}</strong>;
        return <Fragment key={si}>{words}</Fragment>;
      })}
    </p>
  );
}

/** 문단 차오르기 — 화면 근처일 때만 스크롤에 붙는다 */
function useFill(rootRef: RefObject<HTMLElement>, railRef: RefObject<HTMLElement>, lang: BizLangCode) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    type Para = { el: HTMLElement; words: HTMLElement[]; inks: [number, number, number][]; hls: { el: HTMLElement; last: number }[]; cur: number; target: number; vals: string[] };
    const paras: Para[] = Array.from(root.querySelectorAll<HTMLElement>('[data-fp]')).map((el) => {
      const words = Array.from(el.querySelectorAll<HTMLElement>('.cx-w'));
      const hls = Array.from(el.querySelectorAll<HTMLElement>('[data-hl]')).map((h) => {
        const ws = h.querySelectorAll<HTMLElement>('.cx-w');
        return { el: h, last: words.indexOf(ws[ws.length - 1]) };
      });
      return { el, words, inks: words.map((w) => INK[w.dataset.k || 'p'] || INK.p), hls, cur: 0, target: 0, vals: [] };
    });
    const rail = railRef.current;

    const paint = () => {
      let sum = 0;
      paras.forEach((pa) => {
        const n = pa.words.length;
        const u = pa.cur * (n + 3);
        for (let i = 0; i < n; i++) {
          const x = clamp01((u - i) / 3);
          const key = x.toFixed(2);
          if (pa.vals[i] === key) continue;
          pa.vals[i] = key;
          const ink = pa.inks[i];
          const c = BASE.map((b, j) => Math.round(b + (ink[j] - b) * x));
          pa.words[i].style.color = `rgb(${c[0]},${c[1]},${c[2]})`;
        }
        pa.hls.forEach((h) => {
          const x = h.last >= 0 ? clamp01((u - h.last) / 3) : 0;
          if (x >= 0.98) flag(h.el, 'data-on', true);
          else if (x < 0.5) flag(h.el, 'data-on', false);
        });
        sum += pa.cur;
      });
      if (rail) rail.style.transform = `scaleY(${(paras.length ? sum / paras.length : 0).toFixed(4)})`;
    };

    if (prefersReducedMotion()) {
      paras.forEach((pa) => { pa.cur = 1; });
      paint();
      return undefined;
    }

    let near = false;
    let raf = 0;
    let last = 0;
    const measure = () => {
      const H = window.innerHeight;
      const start = H * 0.86;
      const end = H * 0.5;
      paras.forEach((pa) => {
        const r = pa.el.getBoundingClientRect();
        pa.target = clamp01((start - r.top) / (r.height + start - end));
      });
    };
    const tick = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      const k = 1 - Math.exp(-dt / 140);
      let moving = false;
      paras.forEach((pa) => {
        const d = pa.target - pa.cur;
        if (Math.abs(d) < 0.0008) pa.cur = pa.target;
        else {
          pa.cur += d * k;
          moving = true;
        }
      });
      paint();
      if (moving) raf = requestAnimationFrame(tick);
      else last = 0;
    };
    const kick = () => {
      if (!near) return;
      measure();
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      near = e.isIntersecting;
      kick();
    }, { rootMargin: '25% 0px' });
    io.observe(root);
    // 처음 그림: 이미 지나간 문단(새로 고침 · 뒤로 가기로 아래에서 시작)은 바로 찬 상태로
    measure();
    paras.forEach((pa) => { pa.cur = pa.target; });
    paint();
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', kick);
      window.removeEventListener('resize', kick);
    };
  }, [rootRef, railRef, lang]);
}

/** 서명 — 화면에 들어오면 왼쪽부터 펜으로 쓰듯(부드러운 끝 마스크가 1.9초 동안 지나감) */
function SignatureDraw({ alt }: { alt: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const set = (v: number) => {
      const m = v >= 1 ? 'none' : `linear-gradient(90deg,#000 ${(v * 130 - 30).toFixed(1)}%,transparent ${(v * 130).toFixed(1)}%)`;
      el.style.setProperty('-webkit-mask-image', m);
      el.style.setProperty('mask-image', m);
    };
    if (prefersReducedMotion()) {
      set(1);
      return undefined;
    }
    let raf = 0;
    let t0 = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const tick = (now: number) => {
        if (!t0) t0 = now;
        const x = Math.min(1, (now - t0) / 1900);
        set(ease.inOut(x));
        if (x < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div ref={ref} className="cx-sig" style={{ WebkitMaskImage: 'linear-gradient(90deg,#000 -30%,transparent 0%)', maskImage: 'linear-gradient(90deg,#000 -30%,transparent 0%)' }}>
      <img src={SIGNATURE} alt={alt} width={200} height={77} draggable={false} />
    </div>
  );
}

/** 1,000여 명 · 방송사 — 인사말 셋째 문단의 사실을 크게 */
function StatCard() {
  const t = useT();
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.35 });
  return (
    <div ref={ref} className="cx-stat" data-in={inView ? '' : undefined}>
      <div>
        <p className="cx-stat-num">
          <CountUp target={STAT.value} />
          <span className="cx-stat-suf">{t(STAT.suffix)}</span>
        </p>
        <p className="cx-stat-label">{t(STAT.label)}</p>
      </div>
      <div className="cx-stat-side">
        <div className="cx-chips">
          {STAT.chips.map((c, i) => (
            <span key={c} className="cx-chip" style={{ '--i': i } as CSSProperties}>{c}</span>
          ))}
        </div>
        <p className="cx-stat-cap">{t(STAT.chipsLabel)}</p>
      </div>
    </div>
  );
}

export default function CeoLetter() {
  const t = useT();
  const { lang } = useBizLang();
  const bodyRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLSpanElement>(null);
  const sign = useInView<HTMLDivElement>({ threshold: 0.4 });
  useFill(bodyRef, railRef, lang);

  return (
    <section className="cx-lt" aria-label={t(HERO.eyebrow)}>
      <div className="cx-wrap">
        <div className="cx-lt-grid">
          {/* 왼쪽 따라오는 칸(데스크톱) */}
          <aside className="cx-rail" aria-hidden>
            <div className="cx-rail-in">
              <p className="cx-eyebrow">CEO MESSAGE</p>
              <div className="cx-rail-who">
                <span className="cx-face"><img src={HERO.face} alt="" draggable={false} /></span>
                <span>
                  <span className="cx-rail-name">{t(CEO_NAME)}</span>
                  <span className="cx-rail-role">{t(COMPANY)} · {t(CEO_ROLE)}</span>
                </span>
              </div>
              <div className="cx-rail-line"><span ref={railRef} className="cx-rail-fill" /></div>
            </div>
          </aside>

          <div ref={bodyRef} className="cx-lt-body">
            {/* 모바일 · 태블릿 머리(보내는 사람) */}
            <div className="cx-lt-from">
              <p className="cx-eyebrow">CEO MESSAGE</p>
              <div className="cx-rail-who">
                <span className="cx-face"><img src={HERO.face} alt="" draggable={false} /></span>
                <span>
                  <span className="cx-rail-name">{t(CEO_NAME)}</span>
                  <span className="cx-rail-role">{t(COMPANY)} · {t(CEO_ROLE)}</span>
                </span>
              </div>
            </div>

            {LETTER.map((p, i) => (
              <Fragment key={`${lang}-${i}`}>
                <FillPara segs={p[lang] || p.ko} lang={lang} />
                {i === STAT_AFTER && <StatCard />}
              </Fragment>
            ))}
            <FillPara key={`${lang}-thanks`} segs={[{ s: t(THANKS) }]} lang={lang} kind="soft" className="cx-thanks" />

            <div ref={sign.ref} className="cx-sign" data-in={sign.inView ? '' : undefined}>
              <span className="cx-sign-line" aria-hidden />
              <div className="cx-sign-who">
                <p className="cx-sign-co">{t(COMPANY)}</p>
                <p className="cx-sign-name">{t(CEO_ROLE)} <strong>{t(CEO_NAME)}</strong></p>
                <SignatureDraw alt={`${t(CEO_ROLE)} ${t(CEO_NAME)} signature`} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
