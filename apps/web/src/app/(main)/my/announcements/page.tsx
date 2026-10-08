'use client';

// 공지사항 — 토스 뉴스룸 카드 그대로(261001 · 260928 사장 '공지사항 카드 이렇게 — 완전 똑같이, 하단엔 그라데이션 블러, 카드는 4:3').
//  · 큰 제목 '공지사항'(뉴스룸처럼 크게) 아래로 카드가 모바일 1열 · 넓은 화면 2열.
//  · 카드 목록 · 그림 나눠 주기 · 본문 시트는 AnnouncementFeed 한 곳에 있다 — 비즈 '뉴스·소식'(biz/news)도 같은 걸 쓴다(261008 사장 비즈 하단 탭).
//    여기는 머리줄(뒤로) · 큰 제목만 그린다.
import { useEffect } from 'react';
import AnnouncementFeed from '@/components/announcements/AnnouncementFeed';
import { QdBackHeader } from '../_components/detail-ui';

export default function AnnouncementsPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white pb-24 sm:max-w-[1100px]" style={{ letterSpacing: '-0.02em' }}>
      <QdBackHeader />
      {/* 큰 제목 — 뉴스룸처럼 굵고 크게 */}
      <div className="px-6 pb-6 pt-2 sm:px-8 lg:px-10 lg:pb-9 lg:pt-4" data-native-back-header>
        <h1 className="qd-a-title m-0 text-[30px] font-bold leading-[1.25] tracking-[-0.8px] text-[#191F28] lg:text-[54px] lg:tracking-[-1.8px]">공지사항</h1>
      </div>

      <AnnouncementFeed className="px-5 sm:px-8 lg:px-10" />
    </div>
  );
}
