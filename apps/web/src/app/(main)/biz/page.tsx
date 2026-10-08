'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, Check, Clock, Copy, Download, FileText, Mail, MapPin, Phone, Shield, X } from 'lucide-react';
import { useT, useBizLang, type Translations } from '@/lib/biz/i18n';
import BizHeader from '@/components/biz/BizHeader';
import { CEO_NAME, FOOTER as CEO_FOOTER } from '@/components/biz/ceo/content';
import { SmoothScroll, prefersReducedMotion, useFrame, usePassProgress } from '@/components/biz/toss/scene';
import { BizFooter, DockIndicator } from '@/components/biz/toss/TossChrome';
import {
  BIZ_INQUIRY_PATH, bizSectionAnchor, cameByHistory, isBizInquirySection, scrollToBizSection, setBizNavigator, takePendingBizSection,
} from '@/components/biz/scroll-to';
import SceneIntro from '@/components/biz/toss/SceneIntro';
import SceneMatch from '@/components/biz/toss/SceneMatch';
import SceneCareer from '@/components/biz/toss/SceneCareer';
import SceneDoor from '@/components/biz/toss/SceneDoor';
import SceneBook from '@/components/biz/toss/SceneBook';
import SceneEvents from '@/components/biz/toss/SceneEvents';
import SceneScale from '@/components/biz/toss/SceneScale';
import SceneClients from '@/components/biz/toss/SceneClients';
import SceneStage from '@/components/biz/toss/SceneStage';
import SceneMoments from '@/components/biz/toss/SceneMoments';

/*
 * 프리티풀 비즈(261008 사장 '토스 홈페이지 완전 똑같이 — 애니메이션 · 카드 · 폰트 · CSS') — 토스 홈을 장면마다 실측해(크기 · 글자 · 모서리 ·
 *  그림자 · 그라데이션 · 장면 길이 · 스크롤 연출) 우리 코드로 다시 짠 것. 토스의 코드 · CSS · 글꼴(Toss Product Sans) · 그림 · 영상은 쓰지 않았다 —
 *  글꼴은 Pretendard, 소재는 프리티풀 것(송년회 영상 · 행사 사진 · 앱 실제 캡처, 채팅은 가상 대화). 장면 = components/biz/toss/Scene*.tsx,
 *  문구 = toss/content.ts(4개 언어), 스크롤 엔진 = toss/scene.tsx(framer useScroll + Lenis).
 *
 * 261009 사장 개편:
 *  · 머리줄 = 비즈 공용 BizHeader(불투명 흰색 · 햄버거 없음 · '비즈 · 프리티풀로' 글자 탭) — 옛 투명/유리 머리줄(BizNav) · 모바일 메뉴 시트는 걷어냈다.
 *  · 문의 섹션(#문의폼 · #문의 폼)은 삭제 — '문의하기'는 모두 상담 채팅(/biz/inquiry)으로. 옛 링크(/biz#문의폼)로 오면 그리로 돌린다.
 *  · 아래쪽 연혁 · 자료실 · 오시는길은 장면들과 같은 어법(흐림→선명 등장 · 스크롤에 차오르는 연혁 선 · 알약 화살표)으로 다시 그렸다. 내용은 그대로.
 *  섹션 id(회사소개 · 핵심서비스 · 연혁 · 자료실 · 오시는길)는 iOS 브리지(__freetifulBizScroll)가 쓴다.
 */

/* ─── 회사 정보(바닥글 · 오시는길) ───────────────────────────
 * 주소 · 대표 이름은 언어별로(261009 검증: 영어로 바꿔도 /biz 만 지도 · 정보 줄 · 바닥글에 한글 주소 · 'CEO 서나웅'이 남았다).
 * 표기는 CEO 화면(ceo/content.ts — 예전 CEO 화면의 4개 언어 표기)과 같은 것을 가져다 쓴다 — 비즈 하위 화면 바닥(BizPageFooter)도 같은 글 */
const COMPANY_INFO = {
  name: '프리티풀',
  nameEn: 'Freetiful',
  ceo: CEO_NAME,
  address: CEO_FOOTER.address,
  phone: '02-765-8882',
  email: 'freetiful2025@gmail.com',
  blog: 'https://blog.naver.com/freetiful2025',
  instagram: 'freetiful_',
  youtube: 'https://www.youtube.com/@freetiful',
  tiktok: 'https://www.tiktok.com/@freetiful',
};

/** 연혁 — 오래된 것부터(걸어온 순서대로 선이 차오른다. 예전 화면은 2026 → 2025 거꾸로였다). 문구 = 예전 연혁 그대로 */
const HISTORY_DATA: { year: string; events: Translations[] }[] = [
  { year: '2025', events: [
    { ko: '12월 주식회사 커넥트풀 설립', en: 'Dec · Connectful Inc. founded', ja: '12月 株式会社 Connectful 設立', zh: '12月 Connectful 株式会社成立' },
  ]},
  { year: '2026', events: [
    { ko: '01월 프리티풀 브랜드 공식 론칭', en: 'Jan · Official brand launch', ja: '1月 Freetiful ブランド公式ローンチ', zh: '1月 Freetiful 品牌正式发布' },
    { ko: '01월 전문 행사인력 매칭 플랫폼 출시', en: 'Jan · Event talent matching platform launched', ja: '1月 プロイベント人材マッチングプラットフォーム開始', zh: '1月 专业活动人才匹配平台上线' },
    { ko: '02월 전문투자기관으로부터 Seed 투자 유치', en: 'Feb · Secured Seed investment from VC', ja: '2月 専門投資機関よりシード投資調達', zh: '2月 从专业投资机构获得种子轮投资' },
    { ko: '02월 제휴업체 300여 곳과 전략적 파트너십 체결', en: 'Feb · Strategic partnerships with 300+ affiliates', ja: '2月 提携先 300 社と戦略的パートナーシップ締結', zh: '2月 与 300 余家合作伙伴建立战略合作' },
    { ko: '03월 벤처기업 인증 획득', en: 'Mar · Certified as Venture Company', ja: '3月 ベンチャー企業認証取得', zh: '3月 获得风险企业认证' },
    { ko: '03월 프리티풀 정식 서비스 운영 개시', en: 'Mar · Official service operation begins', ja: '3月 Freetiful 正式サービス運営開始', zh: '3月 Freetiful 正式运营' },
    { ko: '05월 신용보증기금 성장지원 기업 선정', en: 'May · Selected for KODIT growth support program', ja: '5月 信用保証基金の成長支援企業に選定', zh: '5月 入选信用保证基金成长支持企业' },
    { ko: '06월 빌라드지디 웨딩홀 & 한국웨딩협회 제휴 체결', en: 'Jun · Partnership with Villa de GD Wedding Hall & Korea Wedding Association', ja: '6月 ヴィラ・ド・ジディ ウェディングホール&韓国ウェディング協会と提携', zh: '6月 与Villa de GD婚礼会馆和韩国婚礼协会签署合作' },
  ]},
];

/** 연혁 표식 순서(해 → 그 해 기록들 → 다음 해 …)에서 해 표식의 자리 — 선이 어느 해까지 찼는지 고를 때 쓴다 */
const YEAR_MARKS: number[] = (() => {
  const out: number[] = [];
  let k = 0;
  HISTORY_DATA.forEach((h) => { out.push(k); k += 1 + h.events.length; });
  return out;
})();

/** 로드맵 — 예전 세 단계 그대로, 말만 웨딩홀 · 기업행사 쪽으로(261009 사장 '비즈의 모든 내용이 웨딩홀과 기업행사 위주로') */
const ROADMAP: { title: Translations; desc: Translations }[] = [
  {
    title: { ko: '웨딩홀 · 기업행사 매칭 고도화', en: 'Smarter matching for halls & events', ja: '式場・企業イベントのマッチング高度化', zh: '婚礼堂 · 企业活动匹配升级' },
    desc: { ko: 'AI 매칭 정확도를 높이고, 행사마다 맞는 사회자 분야를 넓혀요.', en: 'Improve AI matching accuracy and expand MC specialties for every kind of event.', ja: 'AIマッチングの精度を高め、イベントごとに合う司会者の分野を広げます。', zh: '提高AI匹配准确度，扩展适合各类活动的主持领域。' },
  },
  {
    title: { ko: '전국 웨딩홀 · 행사장으로', en: 'Halls and venues nationwide', ja: '全国の式場・会場へ', zh: '覆盖全国婚礼堂与活动场地' },
    desc: { ko: '수도권 중심에서 전국 서비스 커버리지로 넓혀요.', en: 'Expand coverage from the capital region to nationwide.', ja: '首都圏中心から全国サービスへ広げます。', zh: '从首都圈扩展至全国服务覆盖。' },
  },
  {
    title: { ko: '종합 행사 솔루션', en: 'Total event solution', ja: '総合イベントソリューション', zh: '综合活动解决方案' },
    desc: { ko: '기획 · 공간 · 사회자 · 장비까지 한 번에 준비하는 행사 플랫폼으로.', en: 'A one-stop event platform covering planning, venues, MCs and equipment.', ja: '企画・会場・司会者・機材まで、ワンストップで準備できるイベントプラットフォームへ。', zh: '发展为涵盖策划、场地、主持人、设备的一站式活动平台。' },
  },
];

/* ─── 아래쪽 구획 공통 CSS — 장면들(SceneScale · SceneClients)과 같은 여백 단계 · 글자 단계 · 흐림→선명 등장 ─── */
const EASE = 'cubic-bezier(0.25, 0.1, 0.25, 1)';
const SPRING_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const LOWER_CSS = `
.bz{--side:20px;position:relative;letter-spacing:-0.02em;color:#191F28}
.bz-in{max-width:1600px;margin:0 auto;padding:0 var(--side)}
.bz-eye{margin:0;font-size:14px;line-height:22.4px;letter-spacing:-0.28px;font-weight:500;color:#4E535C}
.bz-h2{margin:12px 0 0;font-size:34px;line-height:44px;letter-spacing:-0.72px;font-weight:700;color:#1C1F25;word-break:keep-all}
.bz-line{display:inline-block}
.bz-lead{margin:20px 0 0;max-width:560px;font-size:16px;line-height:25.6px;letter-spacing:-0.32px;color:#4E535C;word-break:keep-all}
.bz-rv{opacity:0;transform:translate3d(0,24px,0);filter:blur(16px);transition:opacity 1s ${EASE},transform 1s ${EASE},filter 1s ${EASE};will-change:opacity,transform,filter}
.bz-rv.nb{filter:none;transition:opacity 1s ${EASE},transform 1s ${EASE}}
.bz-rv.up{transform:translate3d(0,80px,0);filter:none;transition:opacity .9s ${SPRING_OUT},transform 1.1s ${SPRING_OUT}}
.bz-rv.in{opacity:1;transform:none;filter:blur(0)}
.bz-rv.nb.in,.bz-rv.up.in{filter:none}

/* 알약 화살표(장면 알약과 같은 어법: 글자 굴림 + 화살표 밀림) */
.bz-dot{position:relative;display:inline-flex;align-items:center;flex:none;width:28px;height:28px;border-radius:80px;background:#1C1F25;overflow:hidden}
.bz-arr{display:flex;gap:14px;flex:none;transform:translateX(-21px);transition:transform .45s ${SPRING_OUT}}
.bz-arr svg{flex:none;display:block}

/* ── 연혁 ── */
.bzh{background:#fff;padding:120px 0 0}
.bzh-grid{display:block}
.bzh-list{position:relative;margin-top:56px;padding-left:30px}
.bzh-track{position:absolute;left:5px;top:0;bottom:0;width:2px;border-radius:2px;background:#E5E8EB}
.bzh-fill{position:absolute;inset:0;border-radius:2px;background:linear-gradient(180deg,#8EC0FF 0%,#3182F6 100%);transform-origin:50% 0;transform:scaleY(0);will-change:transform}
.bzh-group+.bzh-group{margin-top:44px}
.bzh-yr{position:relative;display:flex;align-items:center;height:40px;font-size:30px;line-height:40px;font-weight:700;letter-spacing:-0.04em;font-variant-numeric:tabular-nums;color:#C4CAD1;transition:color .45s ease}
.bzh-yr[data-on="1"]{color:#191F28}
.bzh-ul{margin:14px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:16px}
.bzh-ev{position:relative;display:flex;gap:12px;align-items:baseline}
.bzh-pin{position:absolute;left:-30px;top:50%;width:12px;height:12px;margin-top:-6px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 2px #D1D6DB;transition:box-shadow .35s ease,background-color .35s ease,transform .45s ${SPRING_OUT}}
.bzh-yr .bzh-pin{width:14px;height:14px;margin-top:-7px;left:-31px}
[data-on="1"]>.bzh-pin{background:#3182F6;box-shadow:inset 0 0 0 2px #3182F6,0 0 0 5px rgba(49,130,246,.14);transform:scale(1.08)}
.bzh-mo{flex:none;min-width:44px;font-size:14px;line-height:24px;font-weight:600;color:#B0B8C1;font-variant-numeric:tabular-nums;transition:color .4s ease}
.bzh-tx{flex:1;min-width:0;font-size:17px;line-height:27px;font-weight:600;letter-spacing:-0.34px;color:#8B95A1;word-break:keep-all;transition:color .4s ease}
.bzh-ev[data-on="1"] .bzh-mo{color:#3182F6}
.bzh-ev[data-on="1"] .bzh-tx{color:#191F28}
.bzh-side{display:none}
.bzh-year{position:relative;height:1.04em;overflow:hidden;font-size:clamp(96px,9vw,148px);line-height:1;font-weight:700;letter-spacing:-0.05em;font-variant-numeric:tabular-nums}
.bzh-year>span{position:absolute;left:0;top:0;background:linear-gradient(180deg,#3182F6 10%,#8EC0FF 100%);-webkit-background-clip:text;background-clip:text;color:transparent;transition:transform .9s ${SPRING_OUT},opacity .6s ease,filter .6s ease}
.bzh-year>span[data-pos="prev"]{transform:translate3d(0,-70%,0);opacity:0;filter:blur(8px)}
.bzh-year>span[data-pos="next"]{transform:translate3d(0,70%,0);opacity:0;filter:blur(8px)}
.bzh-cap{margin:18px 0 0;font-size:15px;line-height:24px;color:#8B95A1}

/* 로드맵 */
.bzr{padding-top:120px}
.bzr-h3{margin:12px 0 0;font-size:26px;line-height:36px;font-weight:700;letter-spacing:-0.52px;color:#1C1F25;word-break:keep-all}
.bzr-cards{display:grid;gap:12px;margin-top:32px}
.bzr-card{position:relative;overflow:hidden;border-radius:28px;background:#F7F8FA;padding:28px 26px 30px;transition:transform .5s ${SPRING_OUT},box-shadow .5s ${SPRING_OUT},background-color .3s ease}
.bzr-no{display:flex;align-items:center;gap:10px;font-size:14px;line-height:20px;font-weight:700;color:#3182F6;font-variant-numeric:tabular-nums}
.bzr-bar{flex:1;height:2px;border-radius:2px;background:rgba(49,130,246,.12);overflow:hidden}
.bzr-bar>i{display:block;height:100%;width:100%;background:#3182F6;transform-origin:0 50%;transform:scaleX(0);transition:transform 1.2s ${SPRING_OUT}}
.bzr-card.in .bzr-bar>i{transform:scaleX(1)}
.bzr-t{margin:22px 0 0;font-size:21px;line-height:30px;font-weight:700;letter-spacing:-0.42px;color:#191F28;word-break:keep-all}
.bzr-d{margin:8px 0 0;font-size:15px;line-height:24px;letter-spacing:-0.3px;color:#6B7684;word-break:keep-all}

/* ── 자료실 ── */
.bzs{background:#F3F3F3;padding:120px 0 128px;margin-top:120px}
.bzs-band{position:absolute;left:0;right:0;top:-96px;height:96px;background:linear-gradient(rgba(243,243,243,0),#F3F3F3);pointer-events:none}
.bzs-list{display:flex;flex-direction:column;gap:10px;margin:40px 0 0;padding:0;list-style:none}
.bzs-row{display:flex;align-items:center;gap:16px;width:100%;padding:18px 18px 18px 20px;border:0;border-radius:22px;background:#fff;text-align:left;font:inherit;color:inherit;cursor:pointer;box-shadow:0 0 0 1px rgba(0,27,55,.03);transition:transform .45s ${SPRING_OUT},box-shadow .45s ${SPRING_OUT};-webkit-tap-highlight-color:transparent}
.bzs-row:active{transform:scale(.985)}
.bzs-ic{display:flex;align-items:center;justify-content:center;flex:none;width:44px;height:44px;border-radius:14px;background:#F2F4F6;color:#4E5968}
.bzs-t{flex:1;min-width:0;font-size:17px;line-height:24px;font-weight:600;letter-spacing:-0.34px;color:#191F28;word-break:keep-all}
.bzs-d{flex:none;font-size:13px;line-height:18px;font-weight:500;color:#8B95A1}

/* ── 오시는길 ── */
/* 문의 상담 카드가 빠져(261009 사장 '문의하기 섹션 삭제') 오시는길이 바닥글 바로 위 마지막 구획 — 아래 여백을 직접 둔다 */
.bzl{background:#fff;padding:160px 0 120px}
.bzl-grid{display:grid;gap:12px;margin-top:40px}
.bzl-map{position:relative;height:280px;border-radius:24px;overflow:hidden;background:#F2F4F6;isolation:isolate}
.bzl-lock{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;padding:0 0 16px;border:0;background:transparent;cursor:pointer;-webkit-tap-highlight-color:transparent}
.bzl-hint{height:34px;padding:0 14px;border-radius:999px;background:#191F28;color:#fff;font-size:13px;line-height:34px;font-weight:600;letter-spacing:-0.26px;box-shadow:0 6px 16px -6px rgba(0,0,0,.35);opacity:.92;transition:transform .35s ${SPRING_OUT},opacity .2s ease}
.bzl-rows{display:flex;flex-direction:column}
.bzl-row{display:flex;align-items:flex-start;gap:14px;padding:18px 0;border-top:1px solid rgba(3,31,63,.08)}
.bzl-row:first-child{border-top:0}
.bzl-ic{display:flex;align-items:center;justify-content:center;flex:none;width:40px;height:40px;border-radius:13px;background:#F2F4F6;color:#4E5968}
.bzl-lb{margin:0;font-size:13px;line-height:18px;font-weight:600;color:#8B95A1}
.bzl-v{margin:4px 0 0;font-size:16px;line-height:24px;font-weight:600;letter-spacing:-0.32px;color:#191F28}
.bzl-copy{display:flex;align-items:center;justify-content:center;flex:none;width:36px;height:36px;margin-top:2px;border:0;border-radius:12px;background:transparent;color:#B0B8C1;cursor:pointer;transition:background-color .2s,color .2s}
.bzl-go{margin-top:8px;padding:20px 22px;border-radius:20px;background:#F7F8FA;font-size:15px;line-height:24px;color:#4E5968}
.bzl-go p{margin:0}
.bzl-go p+p{margin-top:6px}

@media (hover:hover){
  .bzs-row:hover{box-shadow:0 0 0 1px rgba(0,27,55,.04),0 16px 32px -20px rgba(0,27,55,.22);transform:translateY(-2px)}
  .bzs-row:hover .bz-arr{transform:translateX(7px)}
  .bzr-card:hover{transform:translateY(-4px);box-shadow:0 24px 48px -28px rgba(0,27,55,.25);background:#fff}
  .bzl-copy:hover{background:#F2F4F6;color:#3182F6}
  .bzl-lock:hover .bzl-hint{transform:translateY(-2px);opacity:1}
}
@media (min-width:768px){
  .bz{--side:48px}
  .bz-eye{font-size:16px;line-height:25.6px;letter-spacing:-0.32px}
  .bz-h2{font-size:44px;line-height:56.32px;letter-spacing:-0.88px}
  .bz-lead{font-size:17px;line-height:27.2px}
  .bzh{padding-top:160px}
  .bzh-list{padding-left:36px}
  .bzh-pin{left:-36px}
  .bzh-yr .bzh-pin{left:-37px}
  .bzh-tx{font-size:19px;line-height:30px}
  .bzh-mo{font-size:15px;line-height:30px;min-width:52px}
  .bzh-ul{gap:18px}
  .bzr-cards{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
  .bzr-h3{font-size:32px;line-height:44.8px}
  .bzs{padding:150px 0 160px}
  .bzl{padding-top:180px;padding-bottom:160px}
  .bzl-map{height:380px;border-radius:28px}
}
@media (min-width:1024px){
  .bz{--side:80px}
  .bz-h2{font-size:48px;line-height:61.44px;letter-spacing:-0.96px}
  .bzh{padding-top:180px}
  .bzh-grid{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);column-gap:64px;align-items:start}
  .bzh-sticky{position:sticky;top:calc(64px + 12vh)}
  .bzh-side{display:block;margin-top:56px}
  .bzh-list{margin-top:8px}
  .bzh-group+.bzh-group{margin-top:64px}
  .bzh-yr{font-size:36px;height:48px;line-height:48px}
  .bzr{padding-top:160px}
  .bzs-grid{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);column-gap:64px;align-items:start}
  .bzs-list{margin-top:0}
  .bzl-grid{grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:48px;align-items:start;margin-top:56px}
  .bzl-map{height:460px}
}
/* 1024~1279 — 두 칸이 좁아 큰 제목이 세 줄로 꺾였다(1024 실측 '웨딩홀 · / 기업행사와 / …') → 칸을 반반으로 · 제목 한 단계 작게 */
@media (min-width:1024px) and (max-width:1279px){
  .bzh-grid,.bzs-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:48px}
  .bzh .bz-h2,.bzs .bz-h2{font-size:40px;line-height:52px;letter-spacing:-0.8px}
}
@media (min-width:1440px){ .bz{--side:128px} }
@media (min-width:1441px){ .bz-h2{font-size:52px;line-height:66.56px;letter-spacing:-1.04px} }
@media (min-width:1600px){
  .bz{--side:160px}
  .bz-h2{font-size:64px;line-height:81.92px;letter-spacing:-1.28px}
  /* 반쪽 칸(연혁 · 자료실 왼쪽)은 64 면 꺾인다 — 52 까지만 */
  .bzh .bz-h2,.bzs .bz-h2{font-size:52px;line-height:66.56px;letter-spacing:-1.04px}
  .bz-lead{font-size:18px;line-height:28.8px}
}
@media (prefers-reduced-motion:reduce){
  .bz-rv,.bz-rv.nb,.bz-rv.up{opacity:1;transform:none;filter:none;transition:none}
  .bzh-fill,.bzh-pin,.bzh-yr,.bzh-mo,.bzh-tx,.bzh-year>span,.bzr-bar>i,.bz-arr{transition:none}
}
`;

/* ─── 등장 도우미 ─────────────────────────────────────────── */

/** 한 번만 켜지는 보임 신호 — 줄인 움직임이면 처음부터 켬 */
function useOnce<T extends Element>(rootMargin = '0px 0px -14% 0px') {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || on) return undefined;
    if (prefersReducedMotion()) { setOn(true); return undefined; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setOn(true); io.disconnect(); }
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [on, rootMargin]);
  return [ref, on] as const;
}

/** 흐림→선명 등장 클래스(장면들 .ssc-rv 와 같은 값) — kind: blur(기본) · nb(흐림 없이) · up(80px 떠오름) */
function rv(on: boolean, delay = 0, kind: 'blur' | 'nb' | 'up' = 'blur'): { className: string; style: CSSProperties } {
  return { className: `bz-rv${kind === 'blur' ? '' : ` ${kind}`}${on ? ' in' : ''}`, style: { transitionDelay: `${delay}ms` } };
}

/** 구획 머리(작은 눈썹 + 큰 제목 줄마다 흐림→선명 0.1s 차례 + 설명) */
function SecHead({ eyebrow, lines, lead }: { eyebrow: string; lines: string[]; lead?: string }) {
  const [ref, on] = useOnce<HTMLDivElement>();
  const eye = rv(on, 0, 'nb');
  const ld = rv(on, 120 + lines.length * 100);
  return (
    <div ref={ref}>
      <p className={`bz-eye ${eye.className}`} style={eye.style}>{eyebrow}</p>
      <h2 className="bz-h2">
        {lines.map((l, i) => {
          const r = rv(on, 80 + i * 100);
          return (
            <span key={i}>
              <span className={`bz-line ${r.className}`} style={r.style}>{l}</span>
              {i < lines.length - 1 && <br />}
            </span>
          );
        })}
      </h2>
      {lead && <p className={`bz-lead ${ld.className}`} style={ld.style}>{lead}</p>}
    </div>
  );
}

function ArrowSvg({ color = '#fff' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 7h9.5M7.5 2.8 11.7 7l-4.2 4.2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
/** 알약 끝 동그란 화살표(호버 때 다음 화살표가 밀려 들어옴) */
function ArrowDot({ dark = true }: { dark?: boolean }) {
  const c = dark ? '#fff' : '#3182F6';
  return (
    <span className="bz-dot" aria-hidden><span className="bz-arr"><ArrowSvg color={c} /><ArrowSvg color={c} /></span></span>
  );
}

/** '01월 프리티풀…' · 'Jan · Official…' · '1月 Freetiful…' → [달, 내용] */
function splitMonth(s: string): [string, string] {
  const m = /^(\S+?)(?: · |\s+)(.+)$/.exec(s);
  return m ? [m[1], m[2]] : ['', s];
}

/* ═══ 연혁 — 스크롤하면 왼쪽 선이 읽는 자리(화면 62%)까지 파랗게 차오르고, 지나간 기록이 차례로 밝아진다 ═══ */
function HistorySection() {
  const t = useT();
  const listRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const markRefs = useRef<(HTMLElement | null)[]>([]);
  const geo = useRef<{ h: number; ys: number[] }>({ h: 1, ys: [] });
  const [year, setYear] = useState(0);
  const yearRef = useRef(0);
  // 리스트 위 끝이 화면 62% 에 닿을 때 0, 아래 끝이 62% 에 닿을 때 1 → 선 끝 = 늘 화면 62% 줄
  const progress = usePassProgress(listRef, ['start 62%', 'end 62%']);

  const paint = useCallback((p: number) => {
    const { h, ys } = geo.current;
    const tip = p * h;
    if (fillRef.current) fillRef.current.style.transform = `scaleY(${p.toFixed(4)})`;
    let yi = 0;
    markRefs.current.forEach((el, i) => {
      if (!el) return;
      const on = tip >= (ys[i] ?? Infinity) - 1;
      const v = on ? '1' : '0';
      if (el.dataset.on !== v) el.dataset.on = v;
      const g = YEAR_MARKS.indexOf(i);
      if (g >= 0 && on) yi = g;
    });
    if (yi !== yearRef.current) { yearRef.current = yi; setYear(yi); }
  }, []);

  // 표식(해 · 기록) 가운데 높이를 리스트 기준으로 잰다 — 글자꼴 · 폭 · 언어가 바뀌면 다시
  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    const measure = () => {
      const top = list.getBoundingClientRect().top;
      geo.current = {
        h: list.offsetHeight || 1,
        ys: markRefs.current.map((el) => {
          const pin = el?.querySelector<HTMLElement>('.bzh-pin');
          if (!pin) return Infinity;
          const r = pin.getBoundingClientRect();
          return r.top + r.height / 2 - top;
        }),
      };
      paint(progress.get());
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [paint, progress]);
  useFrame(progress, paint);

  const lines = [t({ ko: '웨딩홀 · 기업행사와', en: 'Our path with', ja: '式場・企業イベントと', zh: '与婚礼堂 · 企业活动' }), t({ ko: '함께 걸어온 길', en: 'halls and events', ja: '歩んできた道', zh: '同行的足迹' })];

  return (
    <section id="연혁" className="bz bzh">
      <div className="bz-in bzh-grid">
        <div className="bzh-sticky">
          <SecHead
            eyebrow={t({ ko: '연혁', en: 'Milestones', ja: '沿革', zh: '发展历程' })}
            lines={lines}
            lead={t({ ko: '주식회사 커넥트풀 설립부터 웨딩홀 제휴까지, 프리티풀의 기록이에요.', en: 'From founding Connectful Inc. to our wedding hall partnership — the Freetiful record.', ja: '株式会社 Connectful の設立から式場との提携まで、Freetifulの記録です。', zh: '从 Connectful 株式会社成立到婚礼堂合作，这是 Freetiful 的足迹。' })}
          />
          {/* 데스크톱 — 지금 읽는 해가 크게 굴러 바뀐다 */}
          <div className="bzh-side" aria-hidden>
            <div className="bzh-year">
              {HISTORY_DATA.map((h, i) => (
                <span key={h.year} data-pos={i === year ? 'now' : i < year ? 'prev' : 'next'}>{h.year}</span>
              ))}
            </div>
            <p className="bzh-cap">{t({ ko: `${HISTORY_DATA[year].events.length}개의 기록`, en: `${HISTORY_DATA[year].events.length} ${HISTORY_DATA[year].events.length > 1 ? 'milestones' : 'milestone'}`, ja: `${HISTORY_DATA[year].events.length}件の記録`, zh: `${HISTORY_DATA[year].events.length} 项记录` })}</p>
          </div>
        </div>
        <div ref={listRef} className="bzh-list">
          <span className="bzh-track" aria-hidden><span ref={fillRef} className="bzh-fill" /></span>
          {HISTORY_DATA.map((h, g) => {
            const yi = YEAR_MARKS[g];
            return (
              <div key={h.year} className="bzh-group">
                <div ref={(el) => { markRefs.current[yi] = el; }} className="bzh-yr" data-on="0">
                  <span className="bzh-pin" aria-hidden />
                  {h.year}
                </div>
                <ul className="bzh-ul">
                  {h.events.map((ev, i) => {
                    const mi = yi + 1 + i;
                    const [mo, tx] = splitMonth(t(ev));
                    return (
                      <li key={i} ref={(el) => { markRefs.current[mi] = el; }} className="bzh-ev" data-on="0">
                        <span className="bzh-pin" aria-hidden />
                        <span className="bzh-mo">{mo}</span>
                        <span className="bzh-tx">{tx}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
      <Roadmap />
    </section>
  );
}

/** 로드맵 — 카드 3장이 80px 아래에서 차례로 떠오르고, 단계 막대가 왼쪽부터 찬다 */
function Roadmap() {
  const t = useT();
  const [ref, on] = useOnce<HTMLDivElement>('0px 0px -10% 0px');
  return (
    <div className="bz-in bzr">
      <SecHeadSmall eyebrow={t({ ko: '로드맵', en: 'Roadmap', ja: 'ロードマップ', zh: '发展蓝图' })} title={t({ ko: '앞으로의 프리티풀', en: "What's next for Freetiful", ja: 'これからのFreetiful', zh: 'Freetiful 的下一步' })} />
      <div ref={ref} className="bzr-cards">
        {ROADMAP.map((p, i) => {
          const r = rv(on, i * 120, 'up');
          return (
            <div key={i} className={`bzr-card ${r.className}`} style={r.style}>
              <div className="bzr-no">
                <span>{String(i + 1).padStart(2, '0')}</span>
                <span className="bzr-bar" aria-hidden><i style={{ transitionDelay: `${300 + i * 160}ms` }} /></span>
              </div>
              <h3 className="bzr-t">{t(p.title)}</h3>
              <p className="bzr-d">{t(p.desc)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SecHeadSmall({ eyebrow, title }: { eyebrow: string; title: string }) {
  const [ref, on] = useOnce<HTMLDivElement>();
  const a = rv(on, 0, 'nb');
  const b = rv(on, 100);
  return (
    <div ref={ref}>
      <p className={`bz-eye ${a.className}`} style={a.style}>{eyebrow}</p>
      <h3 className={`bzr-h3 ${b.className}`} style={b.style}>{title}</h3>
    </div>
  );
}

/* ═══ 자료실 ═══ */
function ResourcesSection({ items }: { items: { icon: ReactNode; title: string; desc: string; onClick: () => void }[] }) {
  const t = useT();
  const [ref, on] = useOnce<HTMLUListElement>('0px 0px -8% 0px');
  return (
    <section id="자료실" className="bz bzs">
      <div className="bzs-band" aria-hidden />
      <div className="bz-in bzs-grid">
        <SecHead
          eyebrow={t({ ko: '자료실', en: 'Resources', ja: '資料室', zh: '资料库' })}
          lines={[t({ ko: '제휴에 필요한 자료를', en: 'Everything you need', ja: '提携に必要な資料を', zh: '合作所需资料' }), t({ ko: '한곳에 모았어요', en: 'in one place', ja: '一か所にまとめました', zh: '尽在此处' })]}
          lead={t({ ko: '웨딩홀 · 기업행사 담당자를 위한 프리티풀 CI · BI 가이드와 서비스 안내예요.', en: 'Freetiful CI · BI guidelines and service guide for wedding hall and corporate event teams.', ja: '式場・企業イベントのご担当者向けの Freetiful CI・BI ガイドとサービス案内です。', zh: '为婚礼堂 · 企业活动负责人准备的 Freetiful CI · BI 指南与服务介绍。' })}
        />
        <ul ref={ref} className="bzs-list">
          {items.map((item, i) => {
            const r = rv(on, i * 70, 'nb');
            return (
              <li key={item.title} className={r.className} style={r.style}>
                <button type="button" className="bzs-row" onClick={item.onClick}>
                  <span className="bzs-ic">{item.icon}</span>
                  <span className="bzs-t">{item.title}</span>
                  {item.desc && <span className="bzs-d">{item.desc}</span>}
                  <ArrowDot />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ═══ 오시는길 ═══ */
/**
 * 지도 칸 — 외부 지도가 늦거나 막혀도(시간 초과 실측) 빈 상자가 되지 않게 뒤에 주소 카드를 깔고, 지도가 다 뜨면 그 위로 서서히 덮는다.
 * 지도는 한 번 눌러야 움직인다 — 그냥 두면 휠 · 손가락이 지도 확대/이동으로 빨려 들어가 페이지가 안 내려갔다(1440 실측: 지도 위 휠 = 지도 확대).
 * 마우스가 지도 밖으로 나가면 다시 잠근다
 */
function BizMap({ address, openLabel, hint }: { address: string; openLabel: string; hint: string }) {
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(false);
  return (
    <div className="relative h-full w-full" onMouseLeave={() => setActive(false)}>
      <a
        href="https://www.openstreetmap.org/?mlat=37.56029&mlon=126.99376#map=17/37.56029/126.99376"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#3182F6] shadow-[0_2px_10px_rgba(0,0,0,0.06)]"><MapPin className="h-5 w-5" /></span>
        <span lang={/[가-힣]/.test(address) ? 'ko' : undefined} className="text-[16px] font-semibold leading-[1.5] text-[#333D4B]">{address}</span>
        <span className="text-[14px] font-medium text-[#3182F6]">{openLabel}</span>
      </a>
      <iframe
        title="프리티풀 오시는길"
        src="https://www.openstreetmap.org/export/embed.html?bbox=126.9863%2C37.5553%2C127.0013%2C37.5653&layer=mapnik&marker=37.56029%2C126.99376"
        className="absolute inset-0 h-full w-full border-0 transition-opacity duration-500"
        style={{ opacity: loaded ? 1 : 0, pointerEvents: loaded && active ? 'auto' : 'none' }}
        loading="lazy"
        onLoad={() => setLoaded(true)}
      />
      {loaded && !active && (
        <button type="button" className="bzl-lock" onClick={() => setActive(true)} aria-label={hint}>
          <span className="bzl-hint">{hint}</span>
        </button>
      )}
    </div>
  );
}

/** 정보 줄(주소 · 전화 · 이메일 · 업무시간) — 복사 단추 */
function InfoRow({ icon, label, value, copyable, copyLabel }: { icon: ReactNode; label: string; value: string; copyable: boolean; copyLabel: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };
  return (
    <div className="bzl-row">
      <span className="bzl-ic">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="bzl-lb">{label}</p>
        {/* break-all 은 '충|무로관' · '휴|무)' 처럼 낱말 가운데서 끊었다 — 한국어는 keep-all(상속), 넘칠 때만 아무 데서나 */}
        <p lang={/[가-힣]/.test(value) ? 'ko' : undefined} className="bzl-v [overflow-wrap:anywhere]">{value}</p>
      </div>
      {copyable && (
        <button type="button" onClick={onCopy} className="bzl-copy" title={copyLabel} aria-label={`${label} ${copyLabel}`}>
          {copied ? <Check className="h-4 w-4 text-[#03B26C]" /> : <Copy className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

function LocationSection() {
  const t = useT();
  const [ref, on] = useOnce<HTMLDivElement>('0px 0px -8% 0px');
  const copyLabel = t({ ko: '복사', en: 'Copy', ja: 'コピー', zh: '复制' });
  const map = rv(on, 0, 'up');
  return (
    <section id="오시는길" className="bz bzl">
      <div className="bz-in">
        <SecHead
          eyebrow={t({ ko: '오시는길', en: 'Location', ja: 'アクセス', zh: '地址' })}
          lines={[t({ ko: '프리티풀을', en: 'How to', ja: 'Freetifulへの', zh: '如何' }), t({ ko: '찾아오시는 길', en: 'find us', ja: 'アクセス', zh: '找到我们' })]}
        />
        <div ref={ref} className="bzl-grid">
          <div className={`bzl-map ${map.className}`} style={map.style}>
            <BizMap address={t(COMPANY_INFO.address)} openLabel={t({ ko: '지도에서 보기', en: 'Open in map', ja: '地図で見る', zh: '在地图中查看' })} hint={t({ ko: '눌러서 지도 움직이기', en: 'Tap to move the map', ja: 'タップして地図を操作', zh: '点击后可移动地图' })} />
          </div>
          <div>
            <div className="bzl-rows">
              {[
                { icon: <MapPin className="h-[18px] w-[18px]" />, label: t({ ko: '주소', en: 'Address', ja: '住所', zh: '地址' }), value: t(COMPANY_INFO.address), copyable: true },
                { icon: <Phone className="h-[18px] w-[18px]" />, label: t({ ko: '대표전화', en: 'Phone', ja: '代表電話', zh: '代表电话' }), value: COMPANY_INFO.phone, copyable: true },
                { icon: <Mail className="h-[18px] w-[18px]" />, label: t({ ko: '이메일', en: 'Email', ja: 'メール', zh: '邮箱' }), value: COMPANY_INFO.email, copyable: true },
                { icon: <Clock className="h-[18px] w-[18px]" />, label: t({ ko: '업무시간', en: 'Business Hours', ja: '営業時間', zh: '营业时间' }), value: t({ ko: '평일 09:00 - 18:00 (주말/공휴일 휴무)', en: 'Weekdays 09:00 - 18:00 (Closed weekends/holidays)', ja: '平日 09:00 - 18:00（週末・祝日休み）', zh: '工作日 09:00 - 18:00（周末及节假日休息）' }), copyable: false },
              ].map((item, i) => {
                const r = rv(on, 120 + i * 80, 'nb');
                return (
                  <div key={item.label} className={r.className} style={r.style}>
                    <InfoRow icon={item.icon} label={item.label} value={item.value} copyable={item.copyable} copyLabel={copyLabel} />
                  </div>
                );
              })}
            </div>
            <div className={`bzl-go ${rv(on, 480, 'nb').className}`} style={rv(on, 480, 'nb').style}>
              <p className="!mb-2 text-[13px] font-semibold text-[#8B95A1]">{t({ ko: '교통편 안내', en: 'Getting here', ja: '交通案内', zh: '交通指南' })}</p>
              <p><span className="font-bold text-[#3182F6]">{t({ ko: '지하철', en: 'Subway', ja: '地下鉄', zh: '地铁' })}</span> — {t({ ko: '1호선·3호선·5호선 종로3가역 도보 5분', en: '5-min walk from Jongno 3-ga Station (Lines 1·3·5)', ja: '1号線・3号線・5号線 鍾路3街駅 徒歩5分', zh: '1号线·3号线·5号线 钟路3街站步行5分钟' })}</p>
              <p><span className="font-bold text-[#03B26C]">{t({ ko: '버스', en: 'Bus', ja: 'バス', zh: '公交' })}</span> — {t({ ko: '종로6가 정류장 하차', en: 'Get off at Jongno 6-ga stop', ja: '鍾路6街バス停下車', zh: '钟路6街站下车' })}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Page ─────────────────────────────────────────────────── */
export default function BizPage() {
  const t = useT();
  const { lang } = useBizLang();
  const htmlLang = lang === 'zh' ? 'zh-CN' : lang;
  const router = useRouter();

  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const previewCloseRef = useRef<HTMLButtonElement>(null);
  /** 자료실 파일 중 서버에 없는 것(404) — 깨진 미리보기 · HTML 404 를 내려받는 대신 목록에서 뺀다(파일이 돌아오면 다시 보인다) */
  const [missingFiles, setMissingFiles] = useState<string[]>([]);

  // 문서 언어(html lang)는 비즈 레이아웃(BizHtmlLang)이 비즈 모든 화면에 건다

  // 파일 미리보기가 떠 있는 동안 뒤 페이지 잠금(휠 = Lenis 멈춤, 터치 = 문서 overflow + touchmove 막기) + Esc 로 닫기
  const overlayOpen = !!previewFile;
  useEffect(() => {
    if (!overlayOpen) return undefined;
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    const prevPad = html.style.paddingRight;
    const sbw = window.innerWidth - html.clientWidth;
    html.style.overflow = 'hidden';
    if (sbw > 0) html.style.paddingRight = `${sbw}px`;
    window.__bizLenis?.stop();
    const onTouchMove = (e: TouchEvent) => {
      const box = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-scroll-inside]') : null;
      if (box && box.scrollHeight > box.clientHeight + 1) return; // 미리보기 안쪽처럼 실제로 스크롤되는 칸은 그대로
      if (e.cancelable) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreviewFile(null); };
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
      html.style.overflow = prevOverflow;
      html.style.paddingRight = prevPad;
      window.__bizLenis?.start();
    };
  }, [overlayOpen]);

  // 열린 창의 닫기 단추로 초점(키보드 · 화면 읽기 프로그램)
  useEffect(() => {
    if (previewFile) previewCloseRef.current?.focus({ preventScroll: true });
  }, [previewFile]);

  // 자료실 파일 확인 — 첫 화면을 다 그린 뒤에
  useEffect(() => {
    let alive = true;
    const tm = window.setTimeout(() => {
      Promise.all(['/images/CI.svg', '/images/freetiful_bi.pdf'].map((f) =>
        fetch(f, { method: 'HEAD' }).then((r) => (r.ok && !(r.headers.get('content-type') || '').includes('text/html') ? null : f)).catch(() => null),
      )).then((r) => { if (alive) setMissingFiles(r.filter((x): x is string => !!x)); });
    }, 2500);
    return () => { alive = false; window.clearTimeout(tm); };
  }, []);

  // 다른 화면 · 옛 링크(/biz#연혁 · /biz#자료실 …)로 왔을 때 — 장면 배치가 끝난 뒤 그 섹션으로 내려간다.
  // 옛 문의 링크(/biz#문의폼 · 옛 탭바의 대기 섹션)는 섹션이 없어졌으니 상담 채팅으로 바꿔 보낸다(261009 사장 '문의 섹션 삭제').
  // 첫 그림이 확정되게 rAF 두 번 + 짧은 지연 뒤 출발, 내려가는 동안 위쪽 장면 높이가 바뀌면(이미지 시퀀스 · 영상이 늦게 뜸) 도착 뒤 다시 맞춘다.
  // 사람이 손대면(누름 · 손가락 · 휠 · 키) 바로 손 뗀다
  useEffect(() => {
    const timers: number[] = [];
    let id: string | null = takePendingBizSection();
    const hash = window.location.hash;
    if (!id && hash.length > 1 && !cameByHistory()) {
      const raw = hash.slice(1);
      try { id = decodeURIComponent(raw); } catch { id = raw; } // 한글 해시(#%EB%AC%B8…)
    }
    if (id && isBizInquirySection(id)) {
      // replace — 뒤로 가기에 /biz#문의폼 이 다시 걸려 또 넘어가지 않게
      router.replace(BIZ_INQUIRY_PATH);
      return undefined;
    }
    if (hash.length > 1) {
      // 읽은 해시는 주소에서 지운다 — 남겨 두면 /biz 가 다시 마운트될 때마다(뒤로가기 · 새로 고침) 또 섹션으로 끌려 내려갔다.
      // state 를 null 로 주면 Next 가 고친 replaceState 가 내부 상태를 옮겨 담고 라우터 주소도 같이 맞춘다 —
      // 첫 로드에선 Next 가 replaceState 를 고치는 effect(부모)가 이 effect(자식) 뒤에 돌아 한 틱 미룬다
      timers.push(window.setTimeout(() => {
        if (window.location.pathname !== '/biz' || window.location.hash.length < 2) return;
        try { window.history.replaceState(null, '', window.location.pathname + window.location.search); } catch { /* noop */ }
      }, 0));
    }
    if (!id) return () => timers.forEach((tm) => window.clearTimeout(tm));
    const target = id;
    let cancelled = false;
    let raf = 0;
    const stop = () => { cancelled = true; };
    const userEvents = ['pointerdown', 'touchstart', 'touchmove', 'wheel', 'keydown'] as const;
    userEvents.forEach((ev) => window.addEventListener(ev, stop, { passive: true, capture: true }));
    /** 도착 자리(섹션 위 끝이 offset 자리)에 와 있는지(4px 안쪽) */
    const arrived = (a: { el: HTMLElement; offset: number }) => Math.abs(a.el.getBoundingClientRect().top + a.offset) <= 4;
    const go = (attempt: number) => {
      const a = bizSectionAnchor(target);
      if (cancelled || !a) return;
      if (attempt > 0 && arrived(a)) return;
      if (!scrollToBizSection(target)) return;
      if (attempt < 2) timers.push(window.setTimeout(() => go(attempt + 1), 1400)); // 1.2s 이동 뒤 확인
    };
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => { timers.push(window.setTimeout(() => go(0), 120)); });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach((tm) => window.clearTimeout(tm));
      userEvents.forEach((ev) => window.removeEventListener(ev, stop, { capture: true }));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 이 화면 안 섹션 링크(<a href="#핵심서비스"> 등)는 주소에 해시를 남기지 않고 같은 도우미로. 옛 문의 링크(#문의폼 · #문의)는 상담 채팅으로 */
  function onInPageHashClick(e: React.MouseEvent) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target instanceof Element ? e.target.closest('a[href^="#"]') : null;
    const raw = a?.getAttribute('href')?.slice(1);
    if (!raw) return;
    let id = raw;
    try { id = decodeURIComponent(raw); } catch { /* 그대로 */ }
    if (isBizInquirySection(id)) {
      e.preventDefault();
      router.push(BIZ_INQUIRY_PATH);
      return;
    }
    if (!document.getElementById(id)) return;
    e.preventDefault();
    scrollToBizSection(id);
  }

  // 화면 이동 함수(장면 CTA 의 상담 채팅 이동이 쓴다) + 네이티브(iOS) 비즈 → 섹션 스크롤 브리지(옛 '문의폼' · '문의'는 상담 채팅으로)
  useEffect(() => {
    setBizNavigator((href) => router.push(href));
    (window as unknown as { __freetifulBizScroll?: (id: string) => void }).__freetifulBizScroll = (id: string) => {
      try { scrollToBizSection(id); } catch { /* noop */ }
    };
    return () => {
      setBizNavigator(null);
      try { delete (window as unknown as { __freetifulBizScroll?: unknown }).__freetifulBizScroll; } catch { /* noop */ }
    };
  }, [router]);

  const resourceItems = [
    { icon: <Download className="h-5 w-5" />, title: 'CI', desc: 'SVG', file: '/images/CI.svg' },
    { icon: <Download className="h-5 w-5" />, title: t({ ko: 'BI 가이드라인', en: 'BI Guideline', ja: 'BI ガイドライン', zh: 'BI 指南' }), desc: 'PDF', file: '/images/freetiful_bi.pdf' },
    { icon: <FileText className="h-5 w-5" />, title: t({ ko: '서비스 이용가이드', en: 'Service Guide', ja: 'サービス利用ガイド', zh: '服务使用指南' }), desc: t({ ko: '웹 가이드', en: 'Web Guide', ja: 'Webガイド', zh: '网页指南' }), file: '#핵심서비스' },
    // 제안서는 파일이 아니라 상담으로 받는다(예전엔 문의 폼으로 내려갔다 — 문의 섹션 삭제, 261009)
    { icon: <Briefcase className="h-5 w-5" />, title: t({ ko: '파트너 제안서', en: 'Partner Proposal', ja: 'パートナー提案書', zh: '合作伙伴提案' }), desc: t({ ko: '상담으로 요청', en: 'Request in chat', ja: '相談で依頼', zh: '咨询索取' }), file: BIZ_INQUIRY_PATH },
    { icon: <Shield className="h-5 w-5" />, title: t({ ko: '개인정보처리방침', en: 'Privacy Policy', ja: 'プライバシーポリシー', zh: '隐私政策' }), desc: '', file: '/terms/privacy' },
  ]
    .filter((item) => !missingFiles.includes(item.file))
    .map((item) => ({
      ...item,
      onClick: () => {
        if (item.file.startsWith('#')) { scrollToBizSection(item.file.slice(1)); return; } // 네이티브 smooth 는 Lenis 와 섞여 끊긴다
        if (!/\.(svg|pdf|png|jpe?g|webp)$/i.test(item.file)) { router.push(item.file); return; }
        setPreviewFile(item.file);
      },
    }));

  return (
    // overflow-x: clip — hidden 이면 이 칸이 스크롤 칸이 돼 앱 기능 칸의 따라오는 폰(sticky)이 멈추지 않는다
    <div lang={htmlLang} className="biz-root relative min-h-screen overflow-x-clip bg-white text-[#191F28]" onClickCapture={onInPageHashClick}>
      {/* 옛 문의 링크(/biz#문의폼 · #문의)로 새로 열면 하이드레이션을 기다리지 않고 곧장 상담 채팅으로(261009 검증: dev 에선 3~10초 동안
          /biz 첫 화면이 보인 뒤에 넘어갔다). 해시는 서버가 못 받아 middleware 로는 못 한다 — 첫 HTML 을 읽는 중에 도는 인라인 스크립트로.
          화면 안에서 옮겨 온 경우(클라이언트 이동)엔 이 스크립트가 다시 돌지 않고 아래 effect 가 같은 일을 한다. 글자는 \u 로(문의폼 · 문의) */}
      <script
        dangerouslySetInnerHTML={{
          __html: "(function(){try{var h=location.hash.slice(1);try{h=decodeURIComponent(h)}catch(e){}if(location.pathname==='/biz'&&(h==='\\uBB38\\uC758\\uD3FC'||h==='\\uBB38\\uC758'))location.replace('/biz/inquiry'+location.search)}catch(e){}})();",
        }}
      />
      <style dangerouslySetInnerHTML={{ __html: LOWER_CSS }} />
      <SmoothScroll />
      {/* 비즈 공용 머리줄(불투명 흰색 56 · md 64). 장면들은 처음부터 위 56/64 를 비워 두고 그려져 있어 따로 위 여백을 두지 않는다 */}
      <BizHeader />
      <DockIndicator />

      {/* ═══ 토스식 장면들 ═══════════════════════════════════ */}
      <div id="회사소개"><SceneIntro /></div>
      <div id="핵심서비스"><SceneMatch /></div>
      <SceneCareer />
      <SceneDoor />
      <SceneBook />
      <SceneEvents />
      <SceneScale />
      <SceneClients />
      <SceneStage />
      <SceneMoments />

      {/* ═══ 연혁 · 로드맵 · 자료실 · 오시는길 ═══
          문의 섹션은 상담 카드로도 남기지 않는다(261009 사장 '문의하기 섹션을 삭제해주고') — 문의는 머리줄 · 하단 탭 · 바닥글 · 장면 CTA 의
          '문의하기'(/biz/inquiry 상담 채팅)로만 */}
      <HistorySection />
      <ResourcesSection items={resourceItems} />
      <LocationSection />

      <BizFooter
        links={[
          { label: t({ ko: '뉴스·소식', en: 'News', ja: 'ニュース', zh: '新闻资讯' }), href: '/biz/news' },
          // 기업소개 = CEO 인사말(하단 탭 · 머리줄과 같은 이름 · 같은 곳)
          { label: t({ ko: '기업소개', en: 'About', ja: '会社紹介', zh: '公司介绍' }), href: '/biz/ceo' },
          { label: t({ ko: '문의하기', en: 'Contact', ja: 'お問合せ', zh: '咨询' }), href: BIZ_INQUIRY_PATH },
          { label: t({ ko: '연혁', en: 'Milestones', ja: '沿革', zh: '发展历程' }), href: '/biz/history' },
          { label: t({ ko: '고객사', en: 'Clients', ja: '取引先', zh: '客户' }), href: '/biz/clients' },
          { label: t({ ko: '자주묻는질문', en: 'FAQ', ja: 'よくある質問', zh: '常见问题' }), href: '/biz/faq' },
          { label: t({ ko: '인재채용', en: 'Careers', ja: '採用情報', zh: '人才招聘' }), href: '/careers' },
          { label: t({ ko: '개인정보처리방침', en: 'Privacy Policy', ja: 'プライバシーポリシー', zh: '隐私政策' }), href: '/terms/privacy' },
          { label: t({ ko: '블로그', en: 'Blog', ja: 'ブログ', zh: '博客' }), href: COMPANY_INFO.blog, external: true },
          { label: 'Instagram', href: `https://instagram.com/${COMPANY_INFO.instagram}`, external: true },
          { label: 'YouTube', href: COMPANY_INFO.youtube, external: true },
          { label: 'TikTok', href: COMPANY_INFO.tiktok, external: true },
          // 머리줄 '프리티풀로' 탭과 같은 이름 · 같은 곳(앱 홈)
          { label: t({ ko: '프리티풀로', en: 'To Freetiful', ja: 'Freetifulへ', zh: '前往 Freetiful' }), href: '/main' },
        ]}
        company={[
          `${t({ ko: COMPANY_INFO.name, en: COMPANY_INFO.nameEn, ja: COMPANY_INFO.nameEn, zh: COMPANY_INFO.nameEn })} | ${t({ ko: '대표', en: 'CEO', ja: '代表', zh: '代表' })} ${t(COMPANY_INFO.ceo)}`,
          `T ${COMPANY_INFO.phone} | E ${COMPANY_INFO.email}`,
          t(COMPANY_INFO.address),
          // 비즈 모든 화면 같은 저작권 줄(BizPageFooter · 인재채용과 같은 'Freetiful.' — 법인은 주식회사 커넥트풀이라 'Freetiful Inc.' 는 쓰지 않는다)
          'Copyright © Freetiful. All rights reserved.',
        ]}
      />

      {/* 비즈 페이지 전역 스타일(모바일 하단 탭바는 biz/layout.tsx 의 BizTabBar) */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* framer useScroll 의 스크롤 칸(<html>)이 static 이면 개발 모드 경고 — 계산은 같다(offsetParent 는 body 에서 끝남) */
        html { position: relative; }
        /* 일본어 · 중국어 — 띄어쓰기가 없어 keep-all(전역 body · break-keep)이면 줄바꿈 기회가 0 이 돼 칸 밖으로 넘쳤다.
           글자 단위 줄바꿈 + 금칙(strict: ょ · ー · 。 등이 줄 머리에 안 옴). overflow-wrap:anywhere(첫 화면 말풍선)도 여기선 break-word 로 */
        .biz-root:lang(ja), .biz-root:lang(zh) { word-break: normal; line-break: strict; overflow-wrap: break-word; }
        .biz-root:lang(ja) *, .biz-root:lang(zh) * { word-break: normal !important; line-break: strict; overflow-wrap: break-word !important; }
        /* 일본어는 문절 단위로(Chrome 119+ auto-phrase — '以|上' · '進|行' 처럼 낱말 가운데서 안 끊음). 모르는 브라우저는 위 normal 그대로 */
        .biz-root:lang(ja), .biz-root:lang(ja) * { word-break: auto-phrase !important; }
        /* 언어별 한자 글자꼴 한 벌로(예전엔 한 낱말 안에 Apple SD Gothic Neo · PingFang SC 가 섞였다) — 라틴 · 가나는 Pretendard */
        .biz-root:lang(ja) { font-family: Pretendard, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic', Meiryo, sans-serif; }
        .biz-root:lang(zh) { font-family: Pretendard, 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', 'Hiragino Sans GB', sans-serif; }
        /* 일 · 중 화면 안의 한국어(주소 · 대표 이름 · 통역 데모 원문)는 lang="ko" — 글자 단위로 끊지 않고 낱말 단위(keep-all)로 */
        .biz-root [lang="ko"], .biz-root [lang="ko"] * { word-break: keep-all !important; line-break: auto; }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}} />

      {/* ═══ 파일 미리보기 모달 ═══════════════════════════════ */}
      {previewFile && (
        <div role="dialog" aria-modal="true" aria-label={previewFile.split('/').pop()} data-lenis-prevent className="fixed inset-0 z-[100] flex items-center justify-center overscroll-contain bg-black/50 p-4 backdrop-blur-sm" onClick={() => setPreviewFile(null)}>
          <div className="relative flex max-h-[90vh] w-full max-w-[900px] animate-[scaleIn_0.2s_ease-out] flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#F2F4F6] px-6 py-4">
              <p className="text-[16px] font-bold text-[#191F28]">{previewFile.split('/').pop()}</p>
              <div className="flex items-center gap-2">
                <a
                  href={previewFile}
                  download
                  className="flex items-center gap-1.5 rounded-[10px] bg-[#3182F6] px-4 py-2 text-[13px] font-bold text-white transition-all hover:bg-[#1B64DA] active:scale-95"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t({ ko: '다운로드', en: 'Download', ja: 'ダウンロード', zh: '下载' })}
                </a>
                <button ref={previewCloseRef} onClick={() => setPreviewFile(null)} className="rounded-[10px] p-2 transition-colors hover:bg-[#F2F4F6]" aria-label={t({ ko: '닫기', en: 'Close', ja: '閉じる', zh: '关闭' })}>
                  <X className="h-5 w-5 text-[#8B95A1]" />
                </button>
              </div>
            </div>
            <div data-scroll-inside className="flex min-h-[400px] flex-1 items-center justify-center overflow-auto overscroll-contain bg-[#F9FAFB] p-4">
              {previewFile.endsWith('.pdf') ? (
                <iframe src={previewFile} className="h-[70vh] w-full rounded-lg border-0" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewFile} alt={previewFile.endsWith('.svg') ? 'CI' : 'Preview'} className="max-h-[70vh] max-w-full object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
