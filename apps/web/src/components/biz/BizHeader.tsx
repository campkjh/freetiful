'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, Building2, CircleHelp, Milestone, MessageSquareQuote, Newspaper, type LucideIcon } from 'lucide-react';
import { useT, type Translations } from '@/lib/biz/i18n';
import { BizLangPill } from './LanguageToggle';
import { scrollToY } from './scroll-to';

/*
 * 비즈 공통 머리줄(261009 사장 '기타 페이지에서 슬라이드 했을 때 헤더가 최신헤더가 아닌게 있는데 해결 · 햄버거 필요없고
 *  홈의 전체 · 남성사회자 · 여성사회자처럼 비즈 · 프리티풀로 · 그 왼쪽에 영어 한국어 번역 탭 · 비즈 헤더 opacity 없게').
 *  · 예전엔 화면마다 머리줄이 달랐다 — /biz 는 토스식(투명 → 반투명 유리), ceo · faq · history · clients 는 내리면 떠 있는 반투명 알약으로
 *    줄어드는 옛 머리줄, news 는 흰 줄. 그래서 화면을 옮기며 내리면 모양이 바뀌어 '최신 헤더가 아닌 곳'으로 보였다 → 이 파일 하나만 쓴다.
 *  · 늘 불투명 흰 바탕(투명도 · 블러 없음) — 아래 장면 · 사진이 비쳐 글자가 흐려 보이던 것. 내리면 아래 0.5px 선만 생긴다.
 *  · 높이 모바일 56 · md 이상 64(옛 /biz 머리줄과 같은 값). 화면 쪽은 위 여백 pt-14 md:pt-16 만 맞춘다.
 *  · 오른쪽 '비즈 · 프리티풀로' = 홈 HomeSwipeTabs 글자 탭과 같은 결(16px · 고른 탭 굵은 #191F28 · 나머지 semibold #B0B8C1).
 *    비즈 화면에선 '비즈'가 늘 고른 탭, '프리티풀로' = 프리티풀 홈(/main).
 *  · lg 이상엔 가운데 글자 메뉴(뉴스·소식 · 기업소개 · 문의하기) — 그 폭에선 하단 탭바(BizTabBar, lg:hidden)가 없어서.
 *  · fixed 라 (main) 레이아웃의 max-w-7xl 칸을 벗어나 화면 끝까지 흰 줄이 깔린다. 좌우 여백은 옛 /biz 머리줄(tc-nav-in)과 같게.
 */

export const BIZ_HEADER_H = 56;
export const BIZ_HEADER_H_MD = 64;

type MenuKey = 'news' | 'company' | 'inquiry';

const MENU: { key: MenuKey; href: string; label: Translations }[] = [
  { key: 'news', href: '/biz/news', label: { ko: '뉴스·소식', en: 'News', ja: 'ニュース', zh: '新闻资讯' } },
  { key: 'company', href: '/biz/ceo', label: { ko: '기업소개', en: 'About', ja: '会社紹介', zh: '公司介绍' } },
  { key: 'inquiry', href: '/biz/inquiry', label: { ko: '문의하기', en: 'Contact', ja: 'お問合せ', zh: '咨询' } },
];

/** 가운데 메뉴의 고른 칸 — 하단 탭바(BizTabBar)와 같은 묶음: ceo · history · clients = 기업소개, inquiry · faq · complete = 문의하기 */
function menuFor(pathname: string): MenuKey | null {
  if (/^\/biz\/news(\/|$)/.test(pathname)) return 'news';
  if (/^\/biz\/(ceo|history|clients)(\/|$)/.test(pathname)) return 'company';
  if (/^\/biz\/(inquiry|faq|complete)(\/|$)/.test(pathname)) return 'inquiry';
  return null;
}

/** 새 탭 · 새 창으로 열기(⌘ · Ctrl · Shift · 가운데 단추)는 브라우저에 맡긴다 */
const isPlainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

export default function BizHeader({ onLogo }: { onLogo?: () => void } = {}) {
  const t = useT();
  const pathname = usePathname() || '';
  const active = menuFor(pathname);
  const [scrolled, setScrolled] = useState(false);

  // 아래 선 — 맨 위에선 없고 조금이라도 내리면 생긴다. scroll 마다 읽지 않고 한 프레임에 한 번(rAF), 값이 같으면 다시 그리지 않는다
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      setScrolled(window.scrollY > 4);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  /** 로고 · '비즈' — /biz 에선 맨 위로(Lenis 가 있으면 그걸로 부드럽게), 다른 비즈 화면에선 /biz 로 이동(보통 링크) */
  const toBizHome = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    if (onLogo) {
      e.preventDefault();
      onLogo();
      return;
    }
    if (pathname === '/biz') {
      e.preventDefault();
      scrollToY(0);
    }
  };

  const textTab = 'flex h-full shrink-0 items-center whitespace-nowrap text-[16px] leading-[1.6] tracking-[-0.3px] transition-[color,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3182F6]/40 rounded-md';

  return (
    <header
      data-biz-header
      data-no-natural-reveal
      className="fixed inset-x-0 top-0 z-[60] h-14 bg-white md:h-16"
      style={{
        boxShadow: scrolled ? '0 0.5px 0 #E5E8EB' : '0 0.5px 0 rgba(229,232,235,0)',
        transition: 'box-shadow .25s ease',
      }}
    >
      <nav
        aria-label={t({ ko: '비즈 상단 메뉴', en: 'Business header', ja: 'ビジネス ヘッダー', zh: '企业顶部菜单' })}
        className="relative mx-auto flex h-full max-w-[1920px] items-center justify-between px-5 md:px-8 lg:px-[clamp(40px,7.5vw,108px)]"
      >
        <Link href="/biz" onClick={toBizHome} aria-label={t({ ko: '프리티풀 비즈 홈', en: 'Freetiful Biz home', ja: 'Freetiful Biz ホーム', zh: 'Freetiful Biz 首页' })} className="flex h-full shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3182F6]/40">
          {/* eslint-disable-next-line @next/next/no-img-element -- 작은 svg 로고(옛 /biz · news 머리줄과 같은 그림 · 크기) */}
          <img src="/images/logo-prettyful.svg" alt="Freetiful" width={82} height={24} className="block h-6 w-auto md:h-[21.86px]" draggable={false} />
        </Link>

        {/* 가운데 글자 메뉴(lg 이상) — 올려 둔 칸만 진하고 나머지는 옅어진다(옛 /biz 머리줄과 같은 손맛) */}
        <ul className="group absolute left-1/2 top-0 m-0 hidden h-full -translate-x-1/2 list-none items-center gap-9 p-0 lg:flex">
          {MENU.map((m) => {
            const on = active === m.key;
            return (
              <li key={m.key} className="h-full">
                <Link
                  href={m.href}
                  aria-current={on ? (m.href === pathname ? 'page' : 'true') : undefined}
                  className={`flex h-full items-center whitespace-nowrap text-[16px] leading-[1.6] tracking-[-0.32px] transition-opacity duration-200 group-hover:opacity-50 hover:!opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3182F6]/40 rounded-md ${
                    on ? 'font-semibold text-[#191F28]' : 'font-medium text-[#4E5968]'
                  }`}
                >
                  {t(m.label)}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex h-full min-w-0 items-center gap-3.5 md:gap-5">
          <BizLangPill />
          <div className="flex h-full items-stretch gap-4">
            <Link
              href="/biz"
              onClick={toBizHome}
              aria-current={pathname === '/biz' ? 'page' : 'true'}
              className={`${textTab} font-bold text-[#191F28]`}
            >
              {t({ ko: '비즈', en: 'Biz', ja: 'ビズ', zh: '企业' })}
            </Link>
            <Link href="/main" className={`${textTab} font-semibold text-[#B0B8C1] hover:text-[#8B95A1] active:opacity-60`}>
              {t({ ko: '프리티풀로', en: 'Freetiful', ja: 'Freetifulへ', zh: '去Freetiful' })}
            </Link>
          </div>
        </div>
      </nav>
      {/*
        일본어 · 중국어 줄바꿈 — 비즈 첫 화면(.biz-root)에만 있던 규칙을 머리줄이 붙는 비즈 모든 화면으로(261009 실측: 연혁 · 고객사 화면을
        일본어로 보면 전역 keep-all(body · break-keep) 때문에 띄어쓰기 없는 문장이 줄을 못 바꿔 360 폭에서 461px 로 넘쳤다).
        html lang 은 비즈 레이아웃(BizHtmlLang)이 비즈 안에서만 ja · zh 로 바꾸고 떠나면 되돌린다 — 이 규칙도 비즈 밖에선 걸리지 않는다.
      */}
      <style dangerouslySetInnerHTML={{ __html: `
        html:lang(ja) body,html:lang(zh) body{word-break:normal;line-break:strict;overflow-wrap:break-word}
        html:lang(ja) body *,html:lang(zh) body *{word-break:normal!important;line-break:strict;overflow-wrap:break-word!important}
        html:lang(ja) body,html:lang(ja) body *{word-break:auto-phrase!important}
        html:lang(ja) body{font-family:Pretendard,'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP','Yu Gothic',Meiryo,sans-serif}
        html:lang(zh) body{font-family:Pretendard,'PingFang SC','Noto Sans SC','Microsoft YaHei','Hiragino Sans GB',sans-serif}
        html:lang(ja) body [lang="ko"],html:lang(ja) body [lang="ko"] *,html:lang(zh) body [lang="ko"],html:lang(zh) body [lang="ko"] *{word-break:keep-all!important;line-break:auto}
      ` }} />
    </header>
  );
}

/* ───────────────────────── 비즈 하위 화면 바닥 ───────────────────────── */

type MoreKey = 'ceo' | 'history' | 'clients' | 'news' | 'faq';

const MORE: { key: MoreKey; href: string; icon: LucideIcon; title: Translations; desc: Translations }[] = [
  {
    key: 'ceo', href: '/biz/ceo', icon: MessageSquareQuote,
    title: { ko: 'CEO 인사말', en: "CEO's message", ja: 'CEO 挨拶', zh: 'CEO 致辞' },
    desc: { ko: '프리티풀이 웨딩홀과 기업행사에 전하는 이야기', en: 'What Freetiful promises wedding halls and corporate events', ja: '式場と企業イベントへの Freetiful の想い', zh: 'Freetiful 写给婚礼堂与企业活动的话' },
  },
  {
    key: 'history', href: '/biz/history', icon: Milestone,
    title: { ko: '연혁', en: 'Milestones', ja: '沿革', zh: '发展历程' },
    desc: { ko: '설립부터 웨딩홀 제휴까지 걸어온 길', en: 'From our founding to wedding hall partnerships', ja: '設立から式場提携までの歩み', zh: '从成立到婚礼堂合作的历程' },
  },
  {
    key: 'clients', href: '/biz/clients', icon: Building2,
    title: { ko: '고객사', en: 'Clients', ja: '取引先', zh: '客户' },
    desc: { ko: '프리티풀 진행자와 함께한 기업 · 웨딩 파트너', en: 'Companies and wedding partners we have worked with', ja: 'Freetiful の司会者と歩んだ企業・ウェディングパートナー', zh: '与 Freetiful 主持人合作过的企业与婚礼伙伴' },
  },
  {
    key: 'news', href: '/biz/news', icon: Newspaper,
    title: { ko: '뉴스·소식', en: 'News', ja: 'ニュース', zh: '新闻资讯' },
    desc: { ko: '프리티풀의 새 소식과 공지', en: 'The latest news and announcements', ja: '最新ニュースとお知らせ', zh: '最新动态与公告' },
  },
  {
    key: 'faq', href: '/biz/faq', icon: CircleHelp,
    title: { ko: '자주 묻는 질문', en: 'FAQ', ja: 'よくある質問', zh: '常见问题' },
    desc: { ko: '섭외 · 결제 · 환불까지 먼저 확인해 보세요', en: 'Booking, payment and refunds at a glance', ja: '依頼・決済・返金をまとめて確認', zh: '预约、支付、退款一目了然' },
  },
];

/**
 * 비즈 하위 화면(연혁 · 고객사 · 자주 묻는 질문 …) 맨 아래 — '더 알아보기' 카드 + 회사 한 줄.
 * 햄버거 메뉴(261009 삭제)가 하던 '다른 소개 화면으로 가는 길'을 여기서 맡는다(지금 화면 카드는 뺀다).
 * 머리줄과 짝이라 이 파일에 둔다(담당 파일 밖에 새 공용 파일을 만들지 않기 위해).
 */
export function BizPageFooter({ current }: { current?: MoreKey }) {
  const t = useT();
  const items = MORE.filter((m) => m.key !== current).slice(0, 4);
  return (
    <footer data-no-natural-reveal className="bg-white">
      <div className="mx-auto max-w-[1100px] px-5 pb-12 pt-20 sm:px-8 lg:px-10 lg:pb-16 lg:pt-28">
        <h2 className="m-0 text-[22px] font-bold leading-[1.4] tracking-[-0.5px] text-[#191F28] lg:text-[28px]">
          {t({ ko: '프리티풀 비즈 더 알아보기', en: 'More about Freetiful Biz', ja: 'Freetiful Biz をもっと知る', zh: '进一步了解 Freetiful Biz' })}
        </h2>
        <ul className="m-0 mt-6 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:mt-8 lg:grid-cols-4 lg:gap-4">
          {items.map((m) => {
            const Icon = m.icon;
            return (
              <li key={m.key}>
                <Link
                  href={m.href}
                  className="group flex h-full items-center gap-4 rounded-[24px] bg-[#F9FAFB] p-5 transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#F2F4F6] active:scale-[0.985] lg:flex-col lg:items-start lg:gap-0 lg:p-6"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#3182F6] shadow-[0_1px_2px_rgba(0,23,51,0.06)]">
                    <Icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1 lg:mt-5">
                    <span className="flex items-center gap-1 text-[17px] font-bold leading-[1.4] tracking-[-0.3px] text-[#191F28]">
                      {t(m.title)}
                      <ArrowUpRight className="h-4 w-4 text-[#B0B8C1] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#3182F6]" strokeWidth={2.2} aria-hidden />
                    </span>
                    <span className="mt-1 block break-keep text-[14px] font-medium leading-[1.5] text-[#8B95A1]">{t(m.desc)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-14 flex flex-col gap-4 border-t border-[#F2F4F6] pt-8 text-[13px] leading-[1.6] text-[#8B95A1] md:flex-row md:items-end md:justify-between">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo-prettyful.svg" alt="Freetiful" className="mb-3 block h-5 w-auto opacity-80" />
            <p className="m-0 break-keep">
              {t({ ko: '서울시 중구 퇴계로36길 2, 충무로관 본관 130호', en: 'Room 130, Chungmuro-gwan Main Building, 2 Toegye-ro 36-gil, Jung-gu, Seoul', ja: 'ソウル特別市中区退渓路36ギル2, 忠武路館本館130号', zh: '首尔市中区退溪路36街2号 忠武路馆本馆130号' })}
            </p>
            <p className="m-0">freetiful2025@gmail.com</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-semibold text-[#6B7684]">
            <Link href="/biz" className="transition-colors hover:text-[#191F28]">{t({ ko: '비즈 홈', en: 'Biz home', ja: 'ビズ ホーム', zh: '企业首页' })}</Link>
            <Link href="/biz/inquiry" className="transition-colors hover:text-[#191F28]">{t({ ko: '문의하기', en: 'Contact', ja: 'お問合せ', zh: '咨询' })}</Link>
            <Link href="/careers" className="transition-colors hover:text-[#191F28]">{t({ ko: '인재채용', en: 'Careers', ja: '採用情報', zh: '人才招聘' })}</Link>
            <Link href="/main" className="transition-colors hover:text-[#191F28]">{t({ ko: '프리티풀 홈', en: 'Freetiful home', ja: 'Freetiful ホーム', zh: 'Freetiful 首页' })}</Link>
          </div>
        </div>
        <p className="m-0 mt-6 text-[12px] text-[#B0B8C1]">Copyright &copy; Freetiful. All rights reserved.</p>
      </div>
    </footer>
  );
}
