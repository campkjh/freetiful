'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useT, type Translations } from '@/lib/biz/i18n';
import BizHeader from '@/components/biz/BizHeader';
import { FadeUp } from '@/components/biz/biz-motion';
import { cameByHistory } from '@/components/biz/scroll-to';

/*
 * 비즈 문의 접수 완료(261009 사장 '비즈의 모든 페이지를 프리티풀 톤앤매너 · 애니메이션으로 이쁘고 일관성 있게').
 *  · 머리줄 = 비즈 공통 BizHeader(옛 '‹ 홈으로' 반투명 줄 삭제). 예전엔 한국어만 — 비즈 다른 화면처럼 4개 언어.
 *  · 한 화면 가운데 정렬. 아래 하단 탭바(BizTabBar, lg 미만 · 58 + 안전영역)에 단추가 가리지 않게 그만큼 아래 여백을 둔다
 *    (탭바는 이 화면에 빈칸을 두지 않는다 — needsSpacer 제외).
 *  · 움직임: 파란 원이 톡 튀어나오고 체크가 그려진 뒤 물결이 두 번 퍼진다(예전 animate-ping 은 끝없이 깜빡였다). 줄인 움직임이면 다 그려진 채.
 *  · 안내 문구는 예전 그대로('프리티풀 전문 매니저가 곧 연락드리겠습니다') — 걸리는 시간 같은 새 약속은 넣지 않는다.
 */

const STEPS: { title: Translations; desc: Translations }[] = [
  {
    title: { ko: '접수 완료', en: 'Received', ja: '受付完了', zh: '已受理' },
    desc: { ko: '남겨 주신 문의가 잘 전달됐어요', en: 'Your inquiry has been delivered', ja: 'お問合せ内容が届きました', zh: '您的咨询已成功送达' },
  },
  {
    title: { ko: '담당 매니저 확인', en: 'Manager review', ja: '担当マネージャー確認', zh: '经理确认' },
    desc: { ko: '프리티풀 전문 매니저가 내용을 확인해요', en: 'A Freetiful manager reviews the details', ja: 'Freetiful の専門マネージャーが内容を確認します', zh: 'Freetiful 专业经理将确认内容' },
  },
  {
    title: { ko: '연락 드림', en: 'We contact you', ja: 'ご連絡', zh: '与您联系' },
    desc: { ko: '남겨 주신 연락처로 곧 연락드려요', en: "We'll reach you at the contact you left", ja: 'お残しの連絡先へまもなくご連絡します', zh: '我们会尽快通过您留下的联系方式与您联系' },
  },
];

export default function BizCompletePage() {
  const t = useT();

  useEffect(() => {
    if (!cameByHistory()) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  return (
    <div data-no-natural-reveal className="bg-white pt-14 text-[#191F28] md:pt-16" style={{ letterSpacing: '-0.02em' }}>
      <BizHeader />

      <div className="cp-wrap mx-auto flex max-w-[440px] flex-col items-center justify-center px-6 pt-10 text-center">
        {/* 체크 — 원이 톡 튀고 체크가 그려진다 */}
        <div className="relative mb-7 h-[84px] w-[84px] lg:mb-10 lg:h-24 lg:w-24" aria-hidden>
          <span className="cp-ring absolute inset-0 rounded-full bg-[#3182F6]" />
          <svg viewBox="0 0 96 96" className="cp-badge relative block h-full w-full">
            <circle cx="48" cy="48" r="48" fill="#3182F6" />
            <path d="M29 49.5 42 62.5 67 36.5" fill="none" stroke="#fff" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="cp-check" />
          </svg>
        </div>

        <FadeUp y={18} delay={260}>
          <h1 className="m-0 break-keep text-[28px] font-bold leading-[1.35] tracking-[-0.8px] lg:text-[36px] lg:tracking-[-1.2px]">
            {t({ ko: '접수가 완료되었습니다', en: 'Your inquiry has been received', ja: '受付が完了しました', zh: '已成功提交' })}
          </h1>
        </FadeUp>
        <FadeUp y={18} delay={340}>
          <p className="m-0 mt-3 break-keep text-[16px] font-medium leading-[1.6] text-[#4E5968] lg:text-[18px]">
            {t({
              ko: <>프리티풀 전문 매니저가<br />곧 연락드리겠습니다.</>,
              en: <>A Freetiful manager<br />will contact you soon.</>,
              ja: <>Freetiful の専門マネージャーが<br />まもなくご連絡いたします。</>,
              zh: <>Freetiful 专业经理<br />将很快与您联系。</>,
            })}
          </p>
        </FadeUp>

        {/* 다음 단계 */}
        <FadeUp y={24} delay={440} className="mt-8 w-full lg:mt-10">
          <ol className="m-0 list-none rounded-[24px] bg-[#F9FAFB] p-2 text-left">
            {STEPS.map((s, i) => (
              <li key={i} className="flex items-center gap-3.5 rounded-[18px] px-4 py-3">
                <span
                  aria-hidden
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${i === 0 ? 'bg-[#3182F6] text-white' : 'bg-white text-[#8B95A1] shadow-[inset_0_0_0_1.5px_#E5E8EB]'}`}
                >
                  {i === 0 ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7.2 5.6 10.2 11.5 3.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  ) : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={`block text-[16px] font-bold leading-[1.4] ${i === 0 ? 'text-[#191F28]' : 'text-[#4E5968]'}`}>{t(s.title)}</span>
                  <span className="mt-0.5 block break-keep text-[14px] font-medium leading-[1.5] text-[#8B95A1]">{t(s.desc)}</span>
                </span>
              </li>
            ))}
          </ol>
        </FadeUp>

        <FadeUp y={24} delay={540} className="mt-7 w-full">
          <div className="flex flex-col gap-2.5">
            <Link href="/biz" className="inline-flex h-14 w-full items-center justify-center rounded-[16px] bg-[#3182F6] text-[17px] font-semibold text-white transition-[transform,background-color] duration-150 hover:bg-[#2272EB] active:scale-[0.98]">
              {t({ ko: '비즈 홈으로', en: 'Back to Biz home', ja: 'ビズ ホームへ', zh: '返回企业首页' })}
            </Link>
            <Link href="/biz/faq" className="inline-flex h-14 w-full items-center justify-center rounded-[16px] bg-[#F2F4F6] text-[17px] font-semibold text-[#4E5968] transition-[transform,background-color] duration-150 hover:bg-[#E5E8EB] active:scale-[0.98]">
              {t({ ko: '자주 묻는 질문 보기', en: 'Read the FAQ', ja: 'よくある質問を見る', zh: '查看常见问题' })}
            </Link>
          </div>
        </FadeUp>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        /* 한 화면 = 머리줄 아래 전부. 아래 여백에 하단 탭바(58 + 안전영역) 몫을 넣어 가운데가 '탭바 위 보이는 칸'의 가운데가 되게 */
        .cp-wrap{min-height:calc(100svh - 56px);padding-bottom:calc(40px + 58px + max(0.5rem, env(safe-area-inset-bottom)))}
        html[data-platform="android"] .cp-wrap{padding-bottom:calc(40px + 58px + 0.5rem)}
        @media (min-width:768px){.cp-wrap{min-height:calc(100svh - 64px)}}
        @media (min-width:1024px){.cp-wrap{padding-bottom:40px}}
        .cp-badge{animation:cpPop .6s cubic-bezier(.34,1.56,.64,1) both}
        .cp-check{stroke-dasharray:1;stroke-dashoffset:1;animation:cpDraw .42s cubic-bezier(.65,0,.35,1) .32s forwards}
        .cp-ring{opacity:0;animation:cpRing 1.5s cubic-bezier(.22,1,.36,1) .55s 2}
        @keyframes cpPop{0%{transform:scale(0);opacity:0}60%{transform:scale(1.12);opacity:1}100%{transform:scale(1)}}
        @keyframes cpDraw{to{stroke-dashoffset:0}}
        @keyframes cpRing{0%{transform:scale(1);opacity:.32}100%{transform:scale(1.9);opacity:0}}
        @media (prefers-reduced-motion: reduce){.cp-badge,.cp-ring{animation:none}.cp-check{animation:none;stroke-dashoffset:0}}
      ` }} />
    </div>
  );
}
