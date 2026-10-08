'use client';

import { useBizLang, useT } from '@/lib/biz/i18n';
import BizHeader from '@/components/biz/BizHeader';
import { SmoothScroll } from '@/components/biz/toss/scene';
import { BizFooter } from '@/components/biz/toss/TossChrome';
import CeoHero from '@/components/biz/ceo/CeoHero';
import CeoLetter from '@/components/biz/ceo/CeoLetter';
import CeoValues from '@/components/biz/ceo/CeoValues';
import CeoLeaders from '@/components/biz/ceo/CeoLeaders';
import CeoOrg from '@/components/biz/ceo/CeoOrg';
import CeoClosing from '@/components/biz/ceo/CeoClosing';
import { CEO_NAME, FOOTER } from '@/components/biz/ceo/content';
import { CEO_CSS } from '@/components/biz/ceo/styles';

/*
 * 기업소개 = CEO 인사말(261009 사장 '기업소개는 CEO 인사말로 — 우리가 여태 한 고급스러운 비즈 인터랙션 스타일로, 모든 소스 활용해
 *  인터랙션 · 슬라이드 애니메이션으로 리디자인'). 비즈 홈 장면 엔진(toss/scene.tsx — sticky 무대 + 스크롤 진행률, Lenis)을 그대로 쓴다.
 *  ① 첫 화면: 대표 누끼가 둥근 창으로 열리고 창이 화면 가득 → 대표 한마디가 낱말마다 밝아짐
 *  ② 인사말: 문단이 스크롤 따라 차오름 · 형광펜 밑줄 · 1,000여 명 숫자 칸 · 서명이 펜으로 쓰듯
 *  ③ 경영 철학: 카드 4장이 쌓임  ④ 이사진 9명: 세로 스크롤 → 가로로 흐르는 카드(모바일 캐러셀 + 점)
 *  ⑤ 조직도: 선이 그려지며 카드가 나타남  ⑥ 맺음: 인사말 마지막 문장 + 문의하기(/biz/inquiry)
 * 문구 · 사람 · 직함은 예전 화면 그대로(components/biz/ceo/content.ts, 4개 언어). 머리줄 = 비즈 공통 BizHeader(위 여백 pt-14 md:pt-16),
 * 하단 탭바는 비즈 레이아웃이 붙인다(이 화면 = 기업소개 선택).
 */
export default function CeoPage() {
  const t = useT();
  const { lang } = useBizLang();
  const htmlLang = lang === 'zh' ? 'zh-CN' : lang;

  return (
    // overflow-x: clip — hidden 이면 이 칸이 스크롤 칸이 돼 sticky 무대가 붙지 않는다
    // 화면 끝까지 — (main) 레이아웃이 비즈 화면은 폭 칸(max-w-7xl · px-8)에 넣지 않는다(layout.tsx bizFullRoute)
    <div lang={htmlLang} className="cx-root relative min-h-screen overflow-x-clip bg-white pt-14 text-[#191F28] md:pt-16">
      <style dangerouslySetInnerHTML={{ __html: CEO_CSS }} />
      <SmoothScroll />
      <BizHeader />
      {/* (main) 레이아웃이 이미 <main> 이라 여기선 div(main 이 겹치면 안 된다) */}
      <div>
        <CeoHero />
        <CeoLetter />
        <CeoValues />
        <CeoLeaders />
        <CeoOrg />
        <CeoClosing />
      </div>
      {/* 바닥글 — 맺음 장면과 같은 남색 위에서 이어진다(바닥글 위 끝은 투명 → 아래 바탕이 비친다) */}
      <div className="cx-foot">
        <BizFooter
          links={FOOTER.links.map((l) => ({ label: t(l.label), href: l.href, external: l.external }))}
          company={[
            `${t({ ko: '프리티풀', en: 'Freetiful', ja: 'Freetiful', zh: 'Freetiful' })} | ${t({ ko: '대표', en: 'CEO', ja: '代表', zh: '代表' })} ${t(CEO_NAME)}`,
            `T ${FOOTER.phone} | E ${FOOTER.email}`,
            t(FOOTER.address),
            // 비즈 모든 화면 같은 저작권 줄(비즈 홈 · BizPageFooter 와 같은 'Freetiful.' — 법인은 주식회사 커넥트풀)
            'Copyright © Freetiful. All rights reserved.',
          ]}
        />
      </div>
    </div>
  );
}
