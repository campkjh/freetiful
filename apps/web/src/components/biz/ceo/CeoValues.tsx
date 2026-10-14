'use client';

/* eslint-disable @next/next/no-img-element -- public 정적 행사 사진 · 앱 캡처 */
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useT } from '@/lib/biz/i18n';
import { FadeUp } from '@/components/biz/biz-motion';
import { clamp01 } from '../toss/scene';
import { prefersReducedMotion, scrollToY } from '../scroll-to';
import { VALUES, VALUES_HEAD, type ValueCard } from './content';
import { put } from './motion';
import { readSafeTop } from '@/lib/safe-area';
import CeoSilk from './CeoSilk';
import CeoReviewPhone from './CeoReviewPhone';
import { VALUES_CSS } from './valuesStyles';

/*
 * ③ 경영 철학 — 카드 4장이 쌓이는 장면(261009 사장 '가치 · 비전 카드가 쌓이는 sticky 장면').
 * 카드마다 sticky(위 끝이 조금씩 아래 — 겹친 카드 머리가 계단처럼 보인다). 다음 카드가 올라와 덮는 만큼 앞 카드는 0.94 배로 줄며 어두워진다
 * (스크롤 따라, 리렌더 없이). 카드 1~3 = 프리티풀 행사 사진(진행자 · 결혼식 사회 · 연회장), 4 = 앱 실제 화면(진행자 목록 · 리뷰 화면(AI 키워드 판 → 리뷰)) 두 대 · 바탕은 일렁이는 비단(CeoSilk).
 * 모서리 5 · 아래쪽 그라데이션 블러(261013 사장).
 * 카드 4 오른쪽 폰 = AI 키워드 판이 먼저 돌고 리뷰 화면(지금 앱 캡처)으로 내려앉는다(CeoReviewPhone · valuesStyles, 261013 사장) — 카드가 맨 앞일 때.
 * 카드 4 폰 기기 · 배치 다시 그림(261013 사장 '기술 기반 혁신 부분 모바일 아이폰 디자인 너무 이상해 pc도 다듬고 모바일도 다듬어줘') —
 *  아이폰 15 · 16 Pro 비율 기기, PC = 앞(리뷰) 크게 똑바로 · 뒤(목록) 왼쪽 위 작게 · 둘 다 카드 안 · 글 칸과 안 겹침, 모바일 · 태블릿 = 앞 폰 한 대 가운데.
 * 데스크톱(≥1024)은 왼쪽 제목 칸이 따라오며 지금 맨 위 카드의 번호 · 제목이 진해진다(누르면 그 카드로).
 * 움직임 줄이기면 쌓지 않고 차례로 늘어놓는다.
 */

const SCALE_STEP = 0.06;
const DIM_MAX = 0.42;

/** 아이폰 상태 표시줄(9:41 · 신호 · 와이파이 · 배터리) — 앱 캡처는 상태 표시줄 없이 머리줄부터라 폰처럼 안 보였다(261013 사장 '아이폰 부분에 스테이터스 바가 없음').
 *  크기는 화면 칸 폭 기준(cqw) — 카드 크기가 바뀌어도 같은 비율. 화면 내용은 이 줄 아래부터(valuesStyles .cxv-sb) */
function StatusBar() {
  return (
    <div className="cxv-sb" aria-hidden>
      <span className="cxv-sb-t">9:41</span>
      <span className="cxv-sb-i">
        <svg viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
        <svg viewBox="0 0 16 12" fill="currentColor"><path d="M8 2.6c2.3 0 4.4.9 6 2.4l1.3-1.3A10.3 10.3 0 0 0 8 .7 10.3 10.3 0 0 0 .7 3.7L2 5a8.4 8.4 0 0 1 6-2.4Z" /><path d="M8 6.3c1.3 0 2.5.5 3.4 1.3l1.3-1.3A6.6 6.6 0 0 0 8 4.4c-1.8 0-3.5.7-4.7 1.9l1.3 1.3c.9-.8 2.1-1.3 3.4-1.3Z" /><path d="M8 9.9 10.1 8a3 3 0 0 0-4.2 0L8 9.9Z" /></svg>
        <svg viewBox="0 0 27 12"><rect x=".5" y=".5" width="22" height="11" rx="3.2" fill="none" stroke="currentColor" strokeOpacity=".38" /><rect x="2" y="2" width="19" height="8" rx="2" fill="currentColor" /><path d="M24.5 4v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2Z" fill="currentColor" fillOpacity=".45" /></svg>
      </span>
    </div>
  );
}

/** 카드 04 폰 두 대(261013 사장 '기술 기반 혁신 부분 모바일 아이폰 디자인 너무 이상해 pc도 다듬고 모바일도 다듬어줘').
 *  기기 = 아이폰 15 · 16 Pro 비율(화면 393×852) — 티타늄 띠 · 검은 베젤 · 동심 모서리 · 다이내믹 아일랜드 · 옆 단추 · 그림자, 크기는 모두 기기 폭 기준(cqw).
 *  뒤(왼쪽) = 진행자 목록 캡처, 앞(오른쪽) = AI 키워드 판 → 리뷰 화면(CeoReviewPhone). 배치는 valuesStyles(PC 두 대 · 모바일 · 태블릿 앞 폰 한 대) */
function PhonePair({ screens, active, still }: { screens: string[]; active: boolean; still: boolean }) {
  return (
    <div className="cx-vc-phones" aria-hidden>
      {screens.map((src, i) => {
        const front = i === screens.length - 1;
        return (
          <div key={src} className="cx-vc-phone" data-k={front ? 'front' : 'back'}>
            {/* 옆 단추(동작 · 음량 둘 · 전원) — 몸체 뒤에서 살짝 나온다 */}
            <span className="cx-vc-key cx-vc-key-a" />
            <span className="cx-vc-key cx-vc-key-u" />
            <span className="cx-vc-key cx-vc-key-d" />
            <span className="cx-vc-key cx-vc-key-p" />
            <div className="cx-vc-dev">
              {/* cxv-screen = 화면 칸을 판(.cxv)의 기준 칸으로 — 없으면 판이 베젤까지 덮고 둥근 모서리로 잘리지 않는다(261013 검토) */}
              <div className={front ? 'cx-vc-screen cxv-screen' : 'cx-vc-screen'}>
                <StatusBar />
                {/* 앞 폰 = AI 키워드 판 → 리뷰 화면(261013 사장 '리뷰 ui가 나오기 전에 AI 애니메이션 … 나오면서 리뷰 ui로') */}
                {front ? (
                  <CeoReviewPhone src={src} active={active} still={still} />
                ) : (
                  <img src={src} alt="" loading="lazy" decoding="async" draggable={false} />
                )}
                {/* 섬은 화면 칸 안 — 상태 표시줄과 같은 기준(화면 폭 cqw)이라 시간 · 아이콘 줄 가운데에 맞는다 */}
                <span className="cx-vc-island" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 앱 화면 카드(04) — 글 칸 위 끝 ~ 카드 바닥 거리(--vc-tb, px)를 카드에 적어 둔다(크기가 바뀔 때만 · 매 프레임 재지 않는다).
 *  폰 크기(모바일 앞 폰 · PC 뒤 폰) · 블러 · 흰 막이 이 값을 봐서, 영어처럼 글이 길어 줄이 늘어도 폰과 글이 겹치지 않는다(261013).
 *  PC 뒤 폰이 앞 폰의 .55 배보다 작아지면(낮은 창 · 긴 글) 숨긴다(data-solo — 자리는 그대로라 폭을 계속 잴 수 있다). */
function useTextBlockVar(on: boolean, liRef: RefObject<HTMLLIElement | null>, bodyRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const li = liRef.current;
    const body = bodyRef.current;
    if (!on || !li || !body || typeof ResizeObserver === 'undefined') return undefined;
    const apply = () => {
      const tb = li.clientHeight - body.offsetTop;
      if (tb > 0) li.style.setProperty('--vc-tb', `${Math.round(tb)}px`);
      const phones = li.querySelector<HTMLElement>('.cx-vc-phones');
      const back = li.querySelector<HTMLElement>('.cx-vc-phone[data-k=back]');
      const fr = li.querySelector<HTMLElement>('.cx-vc-phone[data-k=front]');
      if (phones && back && fr) phones.toggleAttribute('data-solo', back.offsetWidth > 0 && back.offsetWidth < fr.offsetWidth * 0.55);
    };
    const ro = new ResizeObserver(apply);
    ro.observe(li);
    ro.observe(body);
    return () => ro.disconnect();
  }, [on, liRef, bodyRef]);
}

function Card({ v, i, t, front, still, cardRef, dimRef }: { v: ValueCard; i: number; t: ReturnType<typeof useT>; front: boolean; still: boolean; cardRef: (el: HTMLLIElement | null) => void; dimRef: (el: HTMLDivElement | null) => void }) {
  const liRef = useRef<HTMLLIElement | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useTextBlockVar(!!v.screens, liRef, bodyRef);
  return (
    <li ref={(el) => { liRef.current = el; cardRef(el); }} className={`cx-vc ${v.screens ? 'cx-vc-light' : ''}`} style={{ '--i': i } as CSSProperties}>
      {/* 앱 화면 카드(04 기술 기반 혁신) 바탕 = 이사진 소개와 같은 일렁이는 비단(261013 사장 '파란색 말고 이사진 소개 배경처럼') */}
      {v.screens && <CeoSilk className="cx-vc-silk" />}
      {v.photo && <img className="cx-vc-ph" src={v.photo.src} alt="" loading="lazy" decoding="async" draggable={false} style={{ objectPosition: v.photo.pos }} />}
      {v.screens && <PhonePair screens={v.screens} active={front} still={still} />}
      {/* 아래쪽 그라데이션 블러(공지사항 카드와 같은 결 — blur 28 · 위로 갈수록 사라짐, 261013) → 그 위 색 막 → 글자 */}
      <div className="cx-vc-blur" aria-hidden />
      <div className="cx-vc-grad" aria-hidden />
      <div ref={bodyRef} className="cx-vc-body">
        {/* 카드 안 번호 알약(01 …)은 뺐다(261013 사장 '카드 안에 있는 01 이런 거 없애줘') — 왼쪽 목록 번호는 그대로 */}
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
    // 머리줄 = 56 · md 64 + iOS 앱 상태바 칸(readSafeTop, 261014 — 앱 밖은 0)
    let hh = 56;
    try { if (window.matchMedia('(min-width: 768px)').matches) hh = 64; } catch { /* noop */ }
    hh += readSafeTop();
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
      <style dangerouslySetInnerHTML={{ __html: VALUES_CSS }} />
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
              front={front === i}
              still={still}
              cardRef={(el) => { cardRefs.current[i] = el; }}
              dimRef={(el) => { dimRefs.current[i] = el; }}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
