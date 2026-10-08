'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import type { BizLangCode } from '@/lib/biz/i18n';

/*
 * CEO 인사말 움직임 도우미(261009). 장면 진행률 · 구간(seg) · 곡선(ease)은 비즈 홈 장면 엔진(toss/scene.tsx)을 그대로 쓰고,
 * 여기엔 이 화면 부품들이 같이 쓰는 작은 것만 — 판 고르기(데스크톱 장면 / 쌓는 판), 스타일 덜 쓰기, 낱말 나누기.
 */

export const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** 데스크톱 고정 장면은 가로 1024 이상 · 가로로 넓은 화면 · 움직임 줄이기 아님 — 세로로 긴 태블릿(1024×1366)은 쌓는 판 */
export const DESK_MQ = '(min-width: 1024px) and (min-aspect-ratio: 1/1) and (prefers-reduced-motion: no-preference)';

export type Mode = 'ssr' | 'desk' | 'stack';

/** 서버 · 첫 그림은 'ssr'(두 판을 CSS 미디어 쿼리로 가려 깜빡임 없음), 붙은 뒤 desk / stack 하나만 */
export function useMode(query = DESK_MQ): Mode {
  const [m, setM] = useState<Mode>('ssr');
  useEffect(() => {
    let mq: MediaQueryList | null = null;
    try {
      mq = window.matchMedia(query);
    } catch {
      setM('stack');
      return undefined;
    }
    const on = () => setM(mq && mq.matches ? 'desk' : 'stack');
    on();
    mq.addEventListener?.('change', on);
    return () => mq?.removeEventListener?.('change', on);
  }, [query]);
  return m;
}

/** 지난번에 쓴 값과 다를 때만 스타일을 쓴다(스크롤 프레임마다 불림 — 리렌더 없이 DOM 에 직접) */
const lastStyle = new WeakMap<Element, Record<string, string>>();
export function put(el: HTMLElement | SVGElement | null | undefined, prop: string, v: string) {
  if (!el) return;
  let c = lastStyle.get(el);
  if (!c) {
    c = {};
    lastStyle.set(el, c);
  }
  if (c[prop] === v) return;
  c[prop] = v;
  el.style.setProperty(prop, v);
}
/** 속성 켜고 끄기(바뀔 때만) */
export function flag(el: Element | null | undefined, name: string, on: boolean) {
  if (!el) return;
  if (el.hasAttribute(name) === on) return;
  el.toggleAttribute(name, on);
}

/** 0~1 부드러운 계단(smoothstep) */
export const smooth01 = (x: number) => x * x * (3 - 2 * x);

/**
 * 채워지는 글 조각 나누기 — 한국어 · 영어는 띄어쓰기 단위, 일본어 · 중국어는 띄어쓰기가 없어 글자 단위
 * (덩어리가 한 문단 통째가 되면 차오르는 맛이 없다). 문장부호는 앞 글자에 붙여 줄머리에 홀로 오지 않게.
 */
export function splitWords(s: string, lang: BizLangCode): string[] {
  if (lang === 'ja' || lang === 'zh') {
    const out: string[] = [];
    for (const ch of Array.from(s)) {
      if (out.length && /^[\s、。，．・：；！？）」』】〕,.!?:;)\]—ー〜…%]$/.test(ch)) out[out.length - 1] += ch;
      else out.push(ch);
    }
    return out;
  }
  // 띄어쓰기는 앞 낱말 끝에 붙여 둔다(줄바꿈 자리 유지). 뒤돌아보기 정규식((?<=))은 옛 iOS 사파리(16.3 이하)에서 파일 통째로 깨져 쓰지 않는다
  return s.match(/\S+\s*|\s+/g) || [];
}

/**
 * 한 덩어리씩 움직이는 글(inline-block 낱말 — 흐림 → 밝음)용 나누기. inline-block 사이는 어디서든 줄이 바뀌므로
 * 일 · 중을 글자 단위로 나누면 '検証されていな|い' 처럼 낱말 가운데서 끊겼다 → Intl.Segmenter 낱말 단위,
 * 일본어는 히라가나로 시작하는 조각(조사 · 어미)을 앞 덩어리에 붙여 '検証されていない / 人は / 繋がない' 같은 어절로.
 * Segmenter 가 없는 옛 브라우저는 글자 단위. 한국어 · 영어는 띄어쓰기 단위(빈칸은 덩어리 밖 — sp).
 * 서버는 늘 한국어로 그린다(비즈 언어는 붙은 뒤 localStorage 에서) — 일 · 중 결과가 서버와 달라 생기는 불일치는 없다.
 */
export function splitPhrases(s: string, lang: BizLangCode): { w: string; sp: boolean }[] {
  if (lang !== 'ja' && lang !== 'zh') return s.split(' ').filter(Boolean).map((w, i, a) => ({ w, sp: i < a.length - 1 }));
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: 'word' }) => { segment: (x: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (!Seg) return splitWords(s, lang).map((w) => ({ w, sp: false }));
  const out: string[] = [];
  for (const { segment: g } of Array.from(new Seg(lang, { granularity: 'word' }).segment(s))) {
    const glue = /^[\s、。，．・：；！？）」』】〕,.!?:;)\]—ー〜…%]+$/.test(g) || (lang === 'ja' && /^[\u3040-\u309F]/.test(g));
    if (out.length && glue) out[out.length - 1] += g;
    else out.push(g);
  }
  return out.map((w) => ({ w, sp: false }));
}

