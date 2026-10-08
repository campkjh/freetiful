'use client';

// 프리티풀 뉴스 — 비즈 하단 탭 '뉴스·소식'(261008 사장 '모바일 네비게이션바 홈, 뉴스소식, 문의하기, 기업소개').
//  · 261009 사장 '뉴스소식은 공지사항으로 이동하는 게 아니라 따로 프리티풀 뉴스 페이지로, 물론 디자인은 공지사항처럼' →
//    공지(앱 사용 안내) 대신 웨딩홀 · 기업행사 담당자가 볼 회사 소식(lib/biz/news.ts — 연혁 · 게시된 서비스 소식 · 송년회, 사실만).
//    카드 · 시트는 공지사항과 같은 뉴스룸 결(components/biz/BizNewsFeed — 카드는 AnnouncementFeed 의 NewsroomCard 를 같이 쓴다).
//  · 머리줄 = 비즈 공통 BizHeader(불투명 흰 줄 · fixed · 모바일 56 / md 이상 64) — 여기선 그 높이만큼 위를 비운다.
//  · 맨 아래 = 비즈 하위 화면 공통 바닥(BizPageFooter — 다른 소개 화면으로 가는 카드).
//  · 하단 탭바는 biz/layout 이 비즈 모든 화면에 한 번 붙인다 — 여기선 따로 그리지 않는다(맨 아래 가림 여백도 레이아웃 몫).
import { useEffect, useRef } from 'react';
import { useT } from '@/lib/biz/i18n';
import BizHeader, { BizPageFooter } from '@/components/biz/BizHeader';
import BizNewsFeed from '@/components/biz/BizNewsFeed';
import { FadeUp } from '@/components/biz/biz-motion';
import { cameByHistory } from '@/components/biz/scroll-to';

/** 떠날 때의 스크롤 자리 — 뒤로가기로 돌아오면 여기로 */
let savedY = 0;

export default function BizNewsPage() {
  const t = useT();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 탭 · 링크로 오면 맨 위부터(비즈 첫 화면을 아래로 많이 내려 둔 상태에서 넘어와도) — html 이 scroll-behavior:smooth 라 'instant'.
    // 뒤로 · 앞으로 가기로 오면 떠날 때 자리로(기사 목록은 정적이라 첫 그림부터 키가 같다)
    const back = cameByHistory();
    const y = back ? savedY : 0;
    window.scrollTo({ top: y, left: 0, behavior: 'instant' });
    const raf = back && y > 0 ? requestAnimationFrame(() => window.scrollTo({ top: y, left: 0, behavior: 'instant' })) : 0;
    const onScroll = () => {
      // 화면을 떠나는 중(이미 DOM 에서 빠짐) · 시트가 문서를 잠근 동안(body fixed → scrollY 0)의 값은 기억하지 않는다
      if (rootRef.current?.isConnected && document.body.style.position !== 'fixed') savedY = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div ref={rootRef} className="min-h-screen bg-white text-[#191F28]" style={{ letterSpacing: '-0.02em' }}>
      <BizHeader />

      <main className="pt-14 md:pt-16">
        <div className="mx-auto max-w-lg sm:max-w-[1100px]">
          {/* 큰 제목 — 비즈 하위 화면(연혁 · 고객사 · 자주 묻는 질문)과 같은 제목 단계: 파란 작은 라벨 15/18 · 제목 34/60 · 설명 17/20 ·
              같은 여백 · 같은 떠오름(FadeUp). 예전엔 뉴스만 30/54 에 라벨이 없어 화면을 옮기면 제목 크기가 바뀌었다(261009 검증 · 사장 '모든 페이지 일관성 있게') */}
          <section className="px-6 pb-8 pt-10 sm:px-8 lg:px-10 lg:pb-12 lg:pt-24">
            <FadeUp y={20}>
              <p className="m-0 text-[15px] font-semibold tracking-[-0.2px] text-[#3182F6] lg:text-[18px]">
                {t({ ko: '뉴스·소식', en: 'News', ja: 'ニュース', zh: '新闻资讯' })}
              </p>
            </FadeUp>
            <FadeUp y={28} delay={80}>
              <h1 className="m-0 mt-3 break-keep text-[34px] font-bold leading-[1.3] tracking-[-1px] text-[#191F28] lg:mt-4 lg:text-[60px] lg:tracking-[-2px]">
                {t({ ko: '프리티풀 뉴스', en: 'Freetiful News', ja: 'Freetiful ニュース', zh: 'Freetiful 新闻' })}
              </h1>
            </FadeUp>
            <FadeUp y={24} delay={160}>
              <p className="m-0 mt-5 max-w-[620px] break-keep text-[17px] font-medium leading-[1.6] tracking-[-0.3px] text-[#4E5968] lg:mt-6 lg:text-[20px]">
                {t({
                  ko: '웨딩홀과 기업행사, 프리티풀의 새 소식을 전해요',
                  en: 'News on wedding halls, corporate events and Freetiful',
                  ja: '式場と企業イベント、Freetiful の最新ニュースをお届けします',
                  zh: '为您带来婚礼堂、企业活动与 Freetiful 的最新动态',
                })}
              </p>
            </FadeUp>
          </section>

          <BizNewsFeed className="px-5 sm:px-8 lg:px-10" />
        </div>
      </main>

      <BizPageFooter current="news" />
    </div>
  );
}
