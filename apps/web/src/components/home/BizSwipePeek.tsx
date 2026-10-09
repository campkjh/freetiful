'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { INTRO, heroMedia } from '@/components/biz/toss/content';
import { BIZ_LANGS, getT, type BizLangCode, type Translations } from '@/lib/biz/i18n';

/** 비즈에서 고른 언어(lib/biz/i18n 이 localStorage 'biz-lang' 에 적는다) — 홈은 비즈 언어 칸 밖이라 직접 읽는다 */
function savedBizLang(): BizLangCode {
  try {
    const v = localStorage.getItem('biz-lang');
    if (v && BIZ_LANGS.some((l) => l.code === v)) return v as BizLangCode;
  } catch { /* 저장소 막힘 — 한국어 */ }
  return 'ko';
}
const TAB_BIZ: Translations = { ko: '비즈', en: 'Biz', ja: 'ビズ', zh: '企业' };
const TAB_HOME: Translations = { ko: '프리티풀로', en: 'Freetiful', ja: 'Freetifulへ', zh: '去Freetiful' };

/**
 * 홈 왼쪽 끝을 오른쪽으로 끌 때 들어오는 비즈 첫 화면 미리보기(261009 사장 '스와이프하면 비즈가 나오게').
 * /biz 모바일 첫 장면과 같은 자리에 그려(머리줄 56 · 카드 위 56 · 양옆 20 · 아래 96 · 모서리 40 · 제목 40px 세 줄)
 * 다 넘긴 뒤 진짜 /biz 로 바뀌어도 화면이 튀지 않게 한다. 그림·글은 비즈 장면과 같은 것(content.ts)을 쓴다.
 * 홈 첫 진입 안내(BizSwipeHint — 왼쪽에서 살짝 '보잉보잉' 엿보기)도 이 그림을 그대로 쓴다.
 *
 * 머리줄(261009 사장 '햄버거 필요 없고, 홈의 전체·남성사회자처럼 비즈 · 프리티풀로 글자 탭, 그 왼쪽에 영어/한국어 번역 탭, 헤더 투명도 없이') —
 * 비즈 머리줄(components/biz/BizHeader)과 같은 모양을 그림으로만 그린다(누르는 건 없음 — 이 칸 전체가 '비즈 열기'다).
 * 진짜 머리줄을 그대로 넣지 않는 건 그쪽이 스크롤·언어 상태·화면 이동을 쥐고 있어서 — 미리보기가 그걸 건드리면 안 된다.
 */
/**
 * 미리보기 그림(첫 장면 포스터 · 로고)을 미리 받아 둔다 — 끌자마자·첫 진입 안내가 뜨자마자 빈 카드가 보이지 않게.
 * 홈(HomeSwipeTabs)이 자리 잡은 뒤 한가할 때와 왼쪽 끝에 손이 닿을 때 부른다. 한 번만 받는다(브라우저 캐시).
 * 다 받으면(또는 실패해도) 풀리는 약속을 돌려준다 — 첫 진입 안내는 이걸 기다렸다 뜬다(사진 없는 회색 카드가 튀어나오지 않게, 261009).
 */
let peekReady: Promise<void> | null = null;
export function preloadBizPeek(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (!peekReady) {
    peekReady = Promise.all(
      // 포스터는 지금 화면에 맞는 것(폰 세로 = 세로 편집본 첫 장면 · 261009) — 미리보기 · /biz 첫 장면과 같은 그림
      [heroMedia().poster, '/images/logo-prettyful.svg'].map(
        (src) => new Promise<void>((resolve) => {
          try {
            const img = new window.Image();
            img.decoding = 'async';
            img.onload = () => resolve();
            img.onerror = () => resolve(); // 미리 받기 실패 — 그릴 때 받는다
            img.src = src;
          } catch { resolve(); }
        }),
      ),
    ).then(() => undefined);
  }
  return peekReady;
}

export default function BizSwipePeek() {
  // 넘긴 뒤 진짜 /biz 와 같은 말로(261009 — 영어로 보던 사람에게 한국어 미리보기가 나왔다 바뀌면 튄다). 홈 포털 안에서만 그려져 첫 렌더부터 읽어도 된다
  const [lang] = useState<BizLangCode>(() => (typeof window === 'undefined' ? 'ko' : savedBizLang()));
  // 첫 장면 그림 · 구도 — /biz 모바일 첫 장면과 같은 기준(폰 세로 = 세로 편집본 포스터 + 가운데, 그 밖 = 가로 포스터 + 62% · 261009)
  const [hero] = useState(heroMedia);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // 사진이 뜨기 전엔 밝은 빈 카드만 — 어두운 카드 바탕·아래 띠·흰 제목이 먼저 보이면 '검은 덩어리'로 보였다(261009 사장). 사진과 함께 스르르
  const [loaded, setLoaded] = useState(false);
  const fade = { opacity: loaded ? 1 : 0, transition: 'opacity 0.25s ease' };
  // 제목 크기 맞추기 — /biz 모바일 첫 장면(SceneIntro fitFont 'lines')과 같은 셈: 가장 긴 줄이 칸보다 넓으면 40px 에서 그 비율만큼 줄인다(0.1 내림)
  useLayoutEffect(() => {
    const box = titleRef.current;
    if (!box) return;
    const fit = () => {
      box.style.fontSize = '40px';
      box.style.lineHeight = `${40 * 1.28}px`;
      const parts = Array.from(box.querySelectorAll<HTMLElement>('[data-fit]'));
      const cs = getComputedStyle(box);
      const avail = box.clientWidth - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0');
      if (!parts.length || avail <= 0) return;
      const widest = Math.max(...parts.map((el) => el.getBoundingClientRect().width));
      if (widest <= avail) return;
      const f = Math.floor(((40 * avail) / widest) * 10) / 10;
      box.style.fontSize = `${f}px`;
      box.style.lineHeight = `${f * 1.28}px`;
    };
    fit();
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) fit(); }).catch(() => {});
    return () => { alive = false; };
  }, [lang]);
  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      <div
        className="absolute overflow-hidden"
        style={{ top: 56, left: 20, right: 20, bottom: 96, borderRadius: 40, background: loaded ? '#2B3038' : '#F2F4F6', transition: 'background-color 0.25s ease' }}
      >
        {/* 비즈 첫 장면처럼 화면 기준 120% 로 깔고 카드가 창이 된다 */}
        {/* eslint-disable-next-line @next/next/no-img-element -- 정적 포스터 한 장 */}
        <img
          src={hero.poster}
          alt=""
          draggable={false}
          onLoad={() => setLoaded(true)}
          ref={(el) => { if (el && el.complete && el.naturalWidth > 0 && !loaded) setLoaded(true); }}
          className="absolute max-w-none object-cover"
          // 구도 = 비즈 모바일 첫 장면과 같은 값(261009 corporate-mc 히어로 영상 — 폰 세로는 진행자를 따라 자른 세로 편집본) — 넘긴 뒤 진짜 /biz 로 바뀌어도 그림이 안 튄다
          style={{ left: 'calc(-20px - 10vw)', top: 'calc(-56px - 10vh)', width: '120vw', height: '120vh', objectPosition: hero.pos, ...fade }}
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: 'linear-gradient(rgba(56,68,82,0), rgb(56,68,82))', ...fade }} />
        <h2
          ref={titleRef}
          className="absolute inset-x-0 text-center text-[40px] font-bold leading-[1.28] text-white"
          style={{ bottom: 20, paddingLeft: 12, paddingRight: 12, wordBreak: 'keep-all', ...fade }}
        >
          {INTRO.heroWords.map((w) => (
            <span key={w.ko} className="block">
              <span data-fit className="inline-block whitespace-nowrap">{getT(w, lang)}</span>
            </span>
          ))}
        </h2>
      </div>
      {/* 머리줄 — 불투명 흰 바탕 56 · 왼쪽 로고 · 오른쪽 [KO|EN] [비즈 · 프리티풀로] (그림만) */}
      {/* 크기·색은 BizHeader(px-5 · 로고 h-6 · 오른쪽 간격 14) + BizLangPill(30 높이 · 칸 32 · 흰 엄지) 그대로 — 넘긴 뒤 진짜 머리줄로 바뀌어도 안 튄다 */}
      <div className="absolute inset-x-0 top-0 flex h-14 items-center justify-between bg-white px-5">
        {/* eslint-disable-next-line @next/next/no-img-element -- 비즈 머리줄과 같은 로고 */}
        <img src="/images/logo-prettyful.svg" alt="" draggable={false} className="block h-6 w-auto shrink-0" />
        <div className="flex h-full items-center gap-3.5">
          <span className="relative flex h-[30px] shrink-0 items-center rounded-full bg-[#F2F4F6] p-[3px] text-[12px] leading-none tracking-[-0.1px]">
            <span
              className="absolute left-[3px] top-[3px] h-[24px] w-8 rounded-full bg-white shadow-[0_1px_3px_rgba(0,23,51,0.12)]"
              style={{ transform: `translateX(${lang === 'en' ? 32 : 0}px)`, opacity: lang === 'ko' || lang === 'en' ? 1 : 0 }}
            />
            <span className={`relative flex h-[24px] w-8 items-center justify-center ${lang === 'ko' ? 'font-bold text-[#191F28]' : 'font-semibold text-[#8B95A1]'}`}>KO</span>
            <span className={`relative flex h-[24px] w-8 items-center justify-center ${lang === 'en' ? 'font-bold text-[#191F28]' : 'font-semibold text-[#8B95A1]'}`}>EN</span>
          </span>
          <span className="flex h-full items-center gap-4 whitespace-nowrap text-[16px] leading-[1.6] tracking-[-0.3px]">
            <span className="font-bold text-[#191F28]">{getT(TAB_BIZ, lang)}</span>
            <span className="font-semibold text-[#B0B8C1]">{getT(TAB_HOME, lang)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
