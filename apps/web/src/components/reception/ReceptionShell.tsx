'use client';

// 송년회 공용 틀 — 사장 견본 톤(로열 블루 · 크리스털 · 금빛 세리프): 배경 그림 고정 + 아래 떠 있는 탭(식순 · 자리 · 이벤트 · 설문조사).
// 탭 아이콘 = 사장 제공 토스 단색 아이콘(ReceptionIcons). 고른 탭은 금빛 + 뒤에 은은한 알약이 미끄러져 따라간다.
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { EventIcon, ProgramIcon, SeatIcon, SurveyIcon } from './ReceptionIcons';

const TABS = [
  { href: '/reception', label: '식순', Icon: ProgramIcon },
  { href: '/reception/seat', label: '자리', Icon: SeatIcon },
  { href: '/reception/event', label: '이벤트', Icon: EventIcon },
  { href: '/reception/survey', label: '설문조사', Icon: SurveyIcon },
] as const;

export default function ReceptionShell({ children, fontClassName }: { children: React.ReactNode; fontClassName: string }) {
  const pathname = usePathname() || '/reception';
  // 글꼴 변수(next/font)를 html 에도 — body 로 띄우는 창(이름 입력·사진 보기·순위 서랍)도 같은 세리프를 쓰게
  useEffect(() => {
    const cls = fontClassName.split(' ').filter(Boolean);
    document.documentElement.classList.add(...cls);
    return () => document.documentElement.classList.remove(...cls);
  }, [fontClassName]);
  const active = TABS.reduce((best, t) => (pathname === t.href || pathname.startsWith(`${t.href}/`) ? t : best), TABS[0] as (typeof TABS)[number]);
  return (
    <div className={`rc-theme rc-root ${fontClassName}`}>
      <div className="rc-bg" aria-hidden="true" />
      <main className="rc-main">{children}</main>
      <nav className="rc-nav" aria-label="송년회 메뉴">
        {TABS.map((t) => {
          const on = t.href === active.href;
          return (
            <Link key={t.href} href={t.href} className={`rc-nav-item ${on ? 'on' : ''}`} aria-current={on ? 'page' : undefined} scroll={false}>
              {on && <motion.span layoutId="rc-nav-pill" className="rc-nav-pill" transition={{ type: 'spring', stiffness: 520, damping: 38 }} />}
              <t.Icon size={24} className="rc-nav-ic" />
              <span className="rc-nav-label">{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
