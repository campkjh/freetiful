'use client';

/* eslint-disable @next/next/no-img-element -- public 정적 행사 사진 */
import { useEffect, useRef, type CSSProperties } from 'react';
import Link from 'next/link';
import { useBizLang, useT } from '@/lib/biz/i18n';
import { clamp01, seg } from '../toss/scene';
import { prefersReducedMotion } from '../scroll-to';
import { CLOSING, TAGLINE } from './content';
import { flag, smooth01, splitPhrases } from './motion';

/*
 * ⑥ 맺음(261009) — 인사말 마지막 문장 '여러분의 소중한 시간을 아름다운 순간으로. 프리티풀.'을 페이지 끝 큰 문장으로.
 * 비즈 홈 '함께한 순간' 맺음말 어법: 흰색 → 남색으로 물드는 띠, 연회장 사진이 어둠 속에 비치고, 문장이 낱말마다 흐림 → 밝음
 * (문단 위 끝이 화면 83% → 30% 를 지나는 동안, 목표값을 ~150ms 로 따라감), 다 밝아지면 흰 알약 '문의하기'(→ /biz/inquiry) + 다른 비즈 화면 알약.
 * 아래 바닥글(BizFooter)은 같은 남색 위에서 이어진다.
 */

const NAVY = '2,14,32';

export default function CeoClosing() {
  const t = useT();
  const { lang } = useBizLang();
  const rootRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const list = splitPhrases(t(TAGLINE), lang);
  const n = list.length;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const paint = (cur: number, vals: string[]) => {
      // 낱말마다 1.6칸 폭으로 겹쳐 밝아진다 — 칸 = 1/(n+0.6) 이라야 cur=1 에서 마지막 낱말까지 다 밝다(1/n 이면 '프리티풀.'이 62% 에서 멈췄다)
      const d = 1 / (Math.max(1, n) + 0.6);
      for (let i = 0; i < n; i++) {
        const el = wordRefs.current[i];
        if (!el) continue;
        const q = smooth01(seg(cur, i * d, (i + 1.6) * d));
        const key = q.toFixed(3);
        if (vals[i] === key) continue;
        vals[i] = key;
        el.style.color = `rgba(255,255,255,${(0.12 + 0.88 * q).toFixed(3)})`;
        el.style.filter = q >= 0.999 ? 'none' : `blur(${(6 * (1 - q)).toFixed(2)}px)`;
      }
    };
    const vals: string[] = [];
    if (prefersReducedMotion()) {
      paint(1, vals);
      flag(ctaRef.current, 'data-on', true);
      return undefined;
    }
    // 목표값(스크롤 자리)을 ~150ms 로 따라간다 — 다 따라가면 쉬고, 스크롤 · 크기 바뀜이 다시 깨운다(가만히 있을 때 매 프레임 돌지 않게)
    let raf = 0;
    let cur = 0;
    let last = 0;
    let ctaOn = false;
    let visible = false;
    const tick = (now: number) => {
      raf = 0;
      const el = textRef.current;
      if (!el) return;
      const H = window.innerHeight;
      const target = clamp01((0.83 * H - el.getBoundingClientRect().top) / (0.53 * H));
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      cur += (target - cur) * (1 - Math.exp(-dt / 150));
      const settled = Math.abs(target - cur) < 0.0005;
      if (settled) cur = target;
      paint(cur, vals);
      const on = ctaOn ? cur > 0.8 : cur > 0.96;
      if (on !== ctaOn) {
        ctaOn = on;
        flag(ctaRef.current, 'data-on', on);
      }
      if (!settled) raf = requestAnimationFrame(tick);
      else last = 0;
    };
    const wake = () => {
      if (visible && !raf) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      wake();
    }, { rootMargin: '15% 0px' });
    io.observe(root);
    window.addEventListener('scroll', wake, { passive: true });
    window.addEventListener('resize', wake);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', wake);
      window.removeEventListener('resize', wake);
    };
  }, [n, lang]);

  return (
    <section ref={rootRef} className="cx-cl" aria-label={t(TAGLINE)}>
      <div className="cx-cl-band" aria-hidden />
      <div className="cx-cl-stage">
        <img className="cx-cl-ph" src={CLOSING.photo} alt="" loading="lazy" decoding="async" draggable={false} />
        <div className="cx-cl-veil" aria-hidden style={{ background: `linear-gradient(180deg,rgb(${NAVY}) 0%,rgba(${NAVY},.35) 40%,rgba(${NAVY},.55) 75%,rgb(${NAVY}) 100%)` }} />
        <div className="cx-wrap cx-cl-in">
          <p ref={textRef} className="cx-cl-t">
            <span className="sr-only">{t(TAGLINE)}</span>
            <span aria-hidden>
              {list.map((x, i) => (
                <span key={`${lang}-${i}`}>
                  <span ref={(el) => { wordRefs.current[i] = el; }} className="cx-clw">{x.w}</span>
                  {x.sp ? ' ' : ''}
                </span>
              ))}
            </span>
          </p>
          <div ref={ctaRef} className="cx-cl-cta">
            <Link href={CLOSING.ctaHref} className="cx-wpill">
              <span>{t(CLOSING.cta)}</span>
              <i aria-hidden>
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8h9M8.8 4.2L12.5 8l-3.7 3.8" /></svg>
              </i>
            </Link>
            <div className="cx-cl-links">
              {CLOSING.links.map((l, i) => (
                <Link key={l.href} href={l.href} className="cx-gpill" style={{ '--i': i } as CSSProperties}>{t(l.label)}</Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
