'use client';

import { useEffect, useState } from 'react';
import { INTRO } from '@/components/biz/toss/content';

/** 비즈 첫 화면 사진을 미리 받아 둔다 — 끌기 시작할 때 아직 안 받았으면 카드가 빈 회색에 어두운 띠만 보였다(261009 사장 '검은색 영역') */
let preloaded = false;
export function preloadBizPeek() {
  if (preloaded || typeof window === 'undefined') return;
  preloaded = true;
  const img = new Image();
  img.decoding = 'async';
  img.src = INTRO.heroPoster;
}

/**
 * 홈 왼쪽 끝을 오른쪽으로 끌 때 들어오는 비즈 첫 화면 미리보기(261009 사장 '스와이프하면 비즈가 나오게').
 * /biz 모바일 첫 장면과 같은 자리에 그려(머리줄 56 · 카드 위 56 · 양옆 20 · 아래 96 · 모서리 40 · 제목 40px 세 줄)
 * 다 넘긴 뒤 진짜 /biz 로 바뀌어도 화면이 튀지 않게 한다. 그림·글은 비즈 장면과 같은 것(content.ts)을 쓴다.
 * 사진이 뜨기 전엔 밝은 빈 카드만(어두운 아래 띠·흰 제목은 사진과 함께 스르르) — 검은 덩어리가 먼저 보이지 않게.
 */
export default function BizSwipePeek() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { preloadBizPeek(); }, []);
  const fade = { opacity: loaded ? 1 : 0, transition: 'opacity 0.25s ease' };
  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      <div
        className="absolute overflow-hidden bg-[#F2F4F6]"
        style={{ top: 56, left: 20, right: 20, bottom: 96, borderRadius: 40 }}
      >
        {/* 비즈 첫 장면처럼 화면 기준 120% 로 깔고 카드가 창이 된다 */}
        {/* eslint-disable-next-line @next/next/no-img-element -- 정적 포스터 한 장 */}
        <img
          src={INTRO.heroPoster}
          alt=""
          draggable={false}
          onLoad={() => setLoaded(true)}
          ref={(el) => { if (el?.complete && el.naturalWidth > 0 && !loaded) setLoaded(true); }}
          className="absolute max-w-none object-cover"
          style={{ left: 'calc(-20px - 10vw)', top: 'calc(-56px - 10vh)', width: '120vw', height: '120vh', ...fade }}
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: 'linear-gradient(rgba(56,68,82,0), rgb(56,68,82))', ...fade }} />
        <h2
          className="absolute inset-x-0 text-center text-[40px] font-bold leading-[1.28] text-white"
          style={{ bottom: 20, paddingLeft: 12, paddingRight: 12, wordBreak: 'keep-all', ...fade }}
        >
          {INTRO.heroWords.map((w) => (
            <span key={w.ko} className="block whitespace-nowrap">{w.ko}</span>
          ))}
        </h2>
      </div>
      {/* 머리줄 — 로고 · 메뉴(모양만) */}
      {/* eslint-disable-next-line @next/next/no-img-element -- 비즈 머리줄과 같은 로고 */}
      <img src="/images/logo-prettyful.svg" alt="" className="absolute" style={{ left: 20, top: 16, height: 24, width: 'auto' }} />
      <span className="absolute flex h-[42px] w-[42px] flex-col items-center justify-center gap-[5px]" style={{ right: 8, top: 7 }}>
        <span className="block h-[2px] w-[20px] rounded-full bg-[#191F28]" />
        <span className="block h-[2px] w-[20px] rounded-full bg-[#191F28]" />
        <span className="block h-[2px] w-[20px] rounded-full bg-[#191F28]" />
      </span>
    </div>
  );
}
