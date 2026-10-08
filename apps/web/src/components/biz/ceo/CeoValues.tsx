'use client';

/* eslint-disable @next/next/no-img-element -- public 정적 행사 사진 · 앱 캡처 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useT } from '@/lib/biz/i18n';
import { FadeUp } from '@/components/biz/biz-motion';
import { clamp01 } from '../toss/scene';
import { prefersReducedMotion, scrollToY } from '../scroll-to';
import { VALUES, VALUES_HEAD, type ValueCard } from './content';
import { put } from './motion';

/*
 * ③ 경영 철학 — 카드 4장이 쌓이는 장면(261009 사장 '가치 · 비전 카드가 쌓이는 sticky 장면').
 * 카드마다 sticky(위 끝이 조금씩 아래 — 겹친 카드 머리가 계단처럼 보인다). 다음 카드가 올라와 덮는 만큼 앞 카드는 0.94 배로 줄며 어두워진다
 * (스크롤 따라, 리렌더 없이). 카드 1~3 = 프리티풀 행사 사진(진행자 · 결혼식 사회 · 연회장), 4 = 앱 실제 화면(진행자 목록 · 6가지 항목 후기) 두 대.
 * 데스크톱(≥1024)은 왼쪽 제목 칸이 따라오며 지금 맨 위 카드의 번호 · 제목이 진해진다(누르면 그 카드로).
 * 움직임 줄이기면 쌓지 않고 차례로 늘어놓는다.
 */

const SCALE_STEP = 0.06;
const DIM_MAX = 0.42;

function PhonePair({ screens }: { screens: string[] }) {
  return (
    <div className="cx-vc-phones" aria-hidden>
      {screens.map((src, i) => (
        <div key={src} className="cx-vc-phone" style={{ '--i': i } as CSSProperties}>
          <div className="cx-vc-screen">
            <img src={src} alt="" loading="lazy" decoding="async" draggable={false} />
          </div>
          <span className="cx-vc-island" />
        </div>
      ))}
    </div>
  );
}

function Card({ v, i, t, cardRef, dimRef }: { v: ValueCard; i: number; t: ReturnType<typeof useT>; cardRef: (el: HTMLLIElement | null) => void; dimRef: (el: HTMLDivElement | null) => void }) {
  return (
    <li ref={cardRef} className={`cx-vc ${v.screens ? 'cx-vc-blue' : ''}`} style={{ '--i': i } as CSSProperties}>
      {v.photo && <img className="cx-vc-ph" src={v.photo.src} alt="" loading="lazy" decoding="async" draggable={false} style={{ objectPosition: v.photo.pos }} />}
      {v.screens && <PhonePair screens={v.screens} />}
      <div className="cx-vc-grad" aria-hidden />
      <div className="cx-vc-body">
        <span className="cx-vc-num">{v.num}</span>
        <h3 className="cx-vc-t">{t(v.title)}</h3>
        <p className="cx-vc-d">{t(v.desc)}</p>
      </div>
      <div ref={dimRef} className="cx-vc-dim" aria-hidden />
    </li>
  );
}

export default function CeoValues() {
  const t = useT();
  const listRef = useRef<HTMLUListElement>(null);
  const cardRefs = useRef<(HTMLLIElement | null)[]>([]);
  const dimRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [front, setFront] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    // 움직임 줄이기 — 쌓지 않고 늘어놓되, 왼쪽 목록의 '지금 카드'는 화면 가운데를 지난 마지막 카드로 따라간다
    if (prefersReducedMotion()) {
      setStill(true);
      let q = false;
      const pick = () => {
        q = false;
        let f = 0;
        cardRefs.current.forEach((el, i) => { if (el && el.getBoundingClientRect().top < window.innerHeight * 0.5) f = i; });
        setFront(f);
      };
      const on = () => { if (!q) { q = true; requestAnimationFrame(pick); } };
      window.addEventListener('scroll', on, { passive: true });
      return () => window.removeEventListener('scroll', on);
    }
    let tops: number[] = [];
    const measure = () => {
      tops = cardRefs.current.map((el) => (el ? parseFloat(getComputedStyle(el).top) || 0 : 0));
    };
    let near = false;
    let queued = false;
    let lastFront = -1;
    const paint = () => {
      queued = false;
      const cards = cardRefs.current;
      const n = cards.length;
      let f = 0;
      for (let i = 0; i < n; i++) {
        const el = cards[i];
        if (!el) continue;
        // 다음 카드가 얼마나 덮었나(0 = 아직 한 장 거리 밖, 1 = 다음 카드가 자기 자리에 붙음)
        const next = cards[i + 1];
        let k = 0;
        if (next) {
          const range = el.offsetHeight + 40;
          const d = next.getBoundingClientRect().top - tops[i + 1];
          k = clamp01(1 - d / range);
          if (k > 0.5) f = i + 1;
        }
        put(el, 'transform', k > 0.0005 ? `scale(${(1 - SCALE_STEP * k).toFixed(4)})` : 'none');
        put(dimRefs.current[i], 'opacity', (DIM_MAX * k).toFixed(3));
      }
      if (f !== lastFront) {
        lastFront = f;
        setFront(f);
      }
    };
    const kick = () => {
      if (!near || queued) return;
      queued = true;
      requestAnimationFrame(paint);
    };
    const io = new IntersectionObserver(([e]) => {
      near = e.isIntersecting;
      kick();
    }, { rootMargin: '20% 0px' });
    io.observe(list);
    const onResize = () => { measure(); kick(); };
    measure();
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', kick);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  /** 왼쪽 목록 누르면 그 카드가 붙는 자리로 */
  const goCard = (i: number) => {
    const el = cardRefs.current[i];
    const list = listRef.current;
    if (!el || !list) return;
    // 쌓는 판 = 카드가 붙는 자리(sticky top), 늘어놓는 판(움직임 줄이기) = 머리줄 아래 24px
    let hh = 56;
    try { if (window.matchMedia('(min-width: 768px)').matches) hh = 64; } catch { /* noop */ }
    const top = still ? hh + 24 : parseFloat(getComputedStyle(el).top) || 0;
    // 붙기 전 자연 위치 = 목록 위 끝 + 앞 카드들 높이 · 간격(카드가 sticky 라 지금 rect 는 못 믿는다)
    let y = list.getBoundingClientRect().top + window.scrollY + parseFloat(getComputedStyle(list).paddingTop || '0');
    for (let j = 0; j < i; j++) {
      const c = cardRefs.current[j];
      if (c) y += c.offsetHeight + (parseFloat(getComputedStyle(c).marginBottom) || 0);
    }
    scrollToY(Math.max(0, y - top + 2));
  };

  return (
    <section className="cx-va" aria-labelledby="cx-va-title">
      <div className="cx-wrap cx-va-grid">
        <div className="cx-va-side">
          <FadeUp>
            <p className="cx-eyebrow">{VALUES_HEAD.eyebrow}</p>
            <h2 id="cx-va-title" className="cx-h2">{t(VALUES_HEAD.title)}</h2>
          </FadeUp>
          <ol className="cx-va-index">
            {VALUES.map((v, i) => (
              <li key={v.num}>
                <button type="button" data-on={front === i ? '' : undefined} onClick={() => goCard(i)}>
                  <span className="cx-va-ix">{v.num}</span>
                  <span>{t(v.title)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        <ul ref={listRef} className={`cx-va-list ${still ? 'cx-va-still' : ''}`}>
          {VALUES.map((v, i) => (
            <Card
              key={v.num}
              v={v}
              i={i}
              t={t}
              cardRef={(el) => { cardRefs.current[i] = el; }}
              dimRef={(el) => { dimRefs.current[i] = el; }}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
