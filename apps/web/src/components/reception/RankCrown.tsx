'use client';

/*
 * 1·2·3등 왕관 — 워크키퍼(~/rocketdan src/components/MonthlyPicks.tsx GoldCrown · SideCrown, 사장이 직접 만든 그림)를 그대로 옮김(261108 사장 '왕관 아이콘은 워크키퍼 123등 아이콘으로').
 *  · 1등 = 금관(구슬 셋 · 빨간 반원 · 양옆 창) · 2등 = 은관 · 3등 = 동관, 숫자는 둥근 끝 흰 획.
 *  · size = 높이. 폭은 그림 비율대로(1등은 양옆 창 때문에 넓다).
 *  · 왼쪽 반 음영 clipPath 는 한 화면에 여러 개라(타일 · 순위 · 사진 보기) useId 로 따로 — 숨은 칸(display:none) 것을 가리키면 안 그려진다.
 */
import { useId } from 'react';

const SIDE = { 2: ['#6F787C', '#879199', '#61666F'], 3: ['#9C734A', '#B48B64', '#8A5F32'] } as const;
const DIGIT = {
  2: 'M29 25.6C29.4 23.2 31.8 22.5 35 22.5C38.6 22.5 40.8 24.4 40.8 27C40.8 29.2 39.6 30.8 37.6 32.6L28.8 41.3H41.4',
  3: 'M29.6 25.4C30 23.2 32.4 22.5 35.4 22.5C39.4 22.5 41.6 24.2 41.6 26.8C41.6 29.6 39.4 31.4 35.6 31.4H33.6M35.6 31.4C39.8 31.4 42 33.4 42 36.2C42 39.2 39.6 40.8 35.6 40.8C32.2 40.8 30 39.8 29.6 38',
} as const;
const STROKE = { fill: 'none', stroke: '#fff', strokeWidth: 5.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const SIDE_BODY = 'M8.6 47L3.7 15.2Q3.4 12.4 5.6 11.4Q7.6 10.6 9.6 12.4L19 20Q20.2 21 21.2 19.8L33 3.4Q35.4 0.6 37.9 3.4L49.8 19.8Q50.8 21 52 20L61.4 12.4Q63.4 10.6 65.4 11.4Q67.6 12.4 67.3 15.2L62.4 47Z';

// 1등 — 가운데 축 58.9 기준 좌우 대칭
const mirror = (x: number) => +(117.8 - x).toFixed(2);
const HALF: [number, number][] = [[58.9, 8], [55.4, 11.8], [47.2, 24.2], [43.6, 27.2], [34.8, 21.2], [29.6, 15], [24.8, 19.5], [28.6, 24.4], [32.6, 48.4]];
const GOLD_PTS = [...HALF, ...[...HALF].reverse().map(([x, y]) => [mirror(x), y] as [number, number])].map(([x, y]) => `${x},${y}`).join(' ');
const SPEAR_HEAD = '4.2,23.6 10.8,26.2 17.8,30.2 21.8,32.4 23.2,37 25.6,42.8 19.2,43.4 12.2,42.8 8.6,35.6 5.4,28.4';
const SPEAR_FACET = '4.2,23.6 5.4,28.4 8.6,35.6 12.2,42.8 17.6,43.2';
const GOLD_BASE = 'M24.6 47.8H93.2L84.6 58.4Q83.2 60.6 79 61Q58.9 62.6 38.8 61Q34.6 60.6 33.2 58.4Z';

export default function RankCrown({ rank, size = 20, className, label }: { rank: 1 | 2 | 3; size?: number; className?: string; label?: string }) {
  const clip = `rc-crown-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const a11y = label === '' ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': label ?? `${rank}등` };

  if (rank === 1) {
    const spear = (
      <>
        <path d="M21.4 42.4 27.2 48.2" stroke="#FFC915" strokeWidth="5.2" strokeLinecap="round" />
        <polygon points={SPEAR_HEAD} fill="#FFCB0E" stroke="#FFCB0E" strokeWidth="1" strokeLinejoin="round" />
        <polygon points={SPEAR_FACET} fill="#FFDD45" />
      </>
    );
    const gold = (
      <>
        <polygon points={GOLD_PTS} />
        <circle cx="58.9" cy="6.8" r="5.4" />
        <circle cx="29.6" cy="18.2" r="5.6" />
        <circle cx={mirror(29.6)} cy="18.2" r="5.6" />
        <path d={GOLD_BASE} />
      </>
    );
    return (
      <svg viewBox="3.4 1.2 111 60.8" width={(size * 111) / 60.8} height={size} className={className} {...a11y}>
        <defs><clipPath id={clip}><rect x="0" y="0" width="57.6" height="64" /></clipPath></defs>
        {spear}
        <g transform="translate(117.8 0) scale(-1 1)">{spear}</g>
        <ellipse cx="58.9" cy="30" rx="23" ry="14" fill="#F45A50" />
        <g fill="#FBC700">{gold}</g>
        <g fill="#FDA302" clipPath={`url(#${clip})`}>{gold}</g>
        <path d="M28.2 52.2Q58.9 55.9 89.6 52.2L84.6 58.4Q83.2 60.6 79 61Q58.9 62.6 38.8 61Q34.6 60.6 33.2 58.4Z" fill="#F98B00" />
        <path d="M54.4 30.8 59 28.4V43.6" {...STROKE} />
      </svg>
    );
  }

  const [l, r, band] = SIDE[rank];
  return (
    <svg viewBox="3 1.5 64.5 54.5" width={(size * 64.5) / 54.5} height={size} className={className} {...a11y}>
      <defs><clipPath id={clip}><rect x="0" y="0" width="35.2" height="60" /></clipPath></defs>
      <path d={SIDE_BODY} fill={r} />
      <path d={SIDE_BODY} fill={l} clipPath={`url(#${clip})`} />
      <path d="M8.5 45.6Q35.5 50.4 62.5 45.6V51.4Q62.5 53.8 59.8 54.3Q35.5 57.4 11.2 54.3Q8.5 53.8 8.5 51.4Z" fill={band} />
      <path d={DIGIT[rank]} {...STROKE} />
    </svg>
  );
}
