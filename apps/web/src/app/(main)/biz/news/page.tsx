'use client';

// 비즈 '뉴스·소식' — 비즈 하단 탭 두 번째 칸(261008 사장 '모바일 네비게이션바 홈, 뉴스소식, 문의하기, 기업소개').
//  · 공지사항(마이 > 공지사항)과 같은 토스 뉴스룸 카드 · 본문 시트를 비즈 안에서 보여 준다(AnnouncementFeed 공용).
//    공지 API 는 공개라 로그인 안 한 기업 손님도 그대로 본다. 공지 글은 한국어 그대로, 화면 글만 4개 언어.
//  · 머리줄 = 흰 바탕 한 줄(왼쪽 프리티풀 로고 → /biz, 오른쪽 언어 바꾸기). 다른 비즈 하위 화면(faq·ceo)처럼 화면 위에 붙어 있고,
//    폭은 (main) 레이아웃의 max-w-7xl 칸을 벗어나 화면 끝까지(fixed). 높이는 비즈 첫 화면 머리줄과 같게(모바일 56 · md 이상 64).
//    내리면 아래에 가는 선이 생겨 카드와 갈린다.
//  · 하단 탭바는 biz/layout 이 비즈 모든 화면에 한 번 붙인다 — 여기선 따로 그리지 않는다(맨 아래 가림 여백도 레이아웃 몫).
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useT } from '@/lib/biz/i18n';
import LanguageToggle from '@/components/biz/LanguageToggle';
import AnnouncementFeed from '@/components/announcements/AnnouncementFeed';
import { cameByHistory } from '@/components/biz/scroll-to';

/** 떠날 때의 스크롤 자리 — 뒤로가기로 돌아오면 여기로(카드 41장을 다시 맨 위부터 찾지 않게) */
let savedY = 0;

export default function BizNewsPage() {
  const t = useT();
  const [scrolled, setScrolled] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 탭 · 링크로 오면 맨 위부터(비즈 첫 화면을 아래로 많이 내려 둔 상태에서 넘어와도) — html 이 scroll-behavior:smooth 라 'instant'.
    // 뒤로 · 앞으로 가기로 오면 떠날 때 자리로(예전엔 늘 맨 위로 되돌렸다). 공지 목록은 AnnouncementFeed 가 기억해 둬 첫 그림부터 키가 같다
    const back = cameByHistory();
    const y = back ? savedY : 0;
    window.scrollTo({ top: y, left: 0, behavior: 'instant' });
    const raf = back && y > 0 ? requestAnimationFrame(() => window.scrollTo({ top: y, left: 0, behavior: 'instant' })) : 0;
    const onScroll = () => {
      setScrolled(window.scrollY > 4);
      // 화면을 떠나는 중(이미 DOM 에서 빠짐) · 시트가 문서를 잠근 동안(body fixed → scrollY 0)의 값은 기억하지 않는다
      if (rootRef.current?.isConnected && document.body.style.position !== 'fixed') savedY = window.scrollY;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div ref={rootRef} className="min-h-screen bg-white pb-16 text-[#191F28] lg:pb-24" style={{ letterSpacing: '-0.02em' }}>
      <header
        className={`fixed inset-x-0 top-0 z-40 bg-white/90 backdrop-blur-xl transition-shadow duration-300 ${scrolled ? 'shadow-[0_0.5px_0_#E5E8EB]' : ''}`}
      >
        {/* 로고 왼쪽 끝 = 아래 큰 제목 · 카드 왼쪽 끝. 언어 단추는 안쪽 여백(12px)이 있어 오른쪽은 그만큼 덜 띄운다 */}
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between pl-5 pr-2 sm:max-w-[1100px] sm:pl-8 sm:pr-5 md:h-16 lg:pl-10 lg:pr-7">
          <Link href="/biz" aria-label="Freetiful" className="flex h-full items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo-prettyful.svg" alt="Freetiful" className="block h-6 w-auto md:h-[21.86px]" />
          </Link>
          <LanguageToggle />
        </div>
      </header>
      {/* 머리줄 자리 */}
      <div aria-hidden="true" className="h-14 md:h-16" />

      <div className="mx-auto max-w-lg sm:max-w-[1100px]">
        {/* 큰 제목 — 공지사항처럼 뉴스룸 크기 + 한 줄 설명 */}
        <div className="px-6 pb-6 pt-5 sm:px-8 lg:px-10 lg:pb-10 lg:pt-12">
          <h1 className="qd-a-title m-0 text-[30px] font-bold leading-[1.25] tracking-[-0.8px] text-[#191F28] lg:text-[54px] lg:tracking-[-1.8px]">
            {t({ ko: '뉴스·소식', en: 'News', ja: 'ニュース', zh: '新闻资讯' })}
          </h1>
          <p className="qd-a-title mt-2 break-keep text-[15px] font-medium leading-[1.55] tracking-[-0.2px] text-[#6B7684] lg:mt-4 lg:text-[19px]" style={{ animationDelay: '.08s' }}>
            {t({
              ko: '프리티풀의 새 소식과 공지를 전해요',
              en: 'The latest news and announcements from Freetiful',
              ja: 'Freetiful の最新ニュースとお知らせをお届けします',
              zh: '为您带来 Freetiful 的最新动态与公告',
            })}
          </p>
        </div>

        <AnnouncementFeed
          className="px-5 sm:px-8 lg:px-10"
          texts={{
            emptyTitle: t({ ko: '아직 전해 드릴 소식이 없어요', en: 'No news yet', ja: 'まだお知らせはありません', zh: '暂无新闻' }),
            emptyDescription: t({
              ko: '새로운 소식이 생기면 이곳에 알려드릴게요.',
              en: "We'll share updates here as soon as we have them.",
              ja: '新しいお知らせがあればこちらでお伝えします。',
              zh: '有新消息时会在这里告诉您。',
            }),
            close: t({ ko: '닫기', en: 'Close', ja: '閉じる', zh: '关闭' }),
          }}
        />
      </div>
    </div>
  );
}
