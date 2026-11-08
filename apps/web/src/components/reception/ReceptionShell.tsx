'use client';

// 송년회 공용 틀 — 사장 견본 톤(로열 블루 · 크리스털 · 금빛 세리프): 배경 그림 고정 + 아래 떠 있는 탭(식순 · 자리 · 이벤트 · 설문조사).
// 배경 = 그림 + 일렁이는 프리즘 빛줄기(rc-prism). 탭 아이콘 = 사장 제공 토스 단색 아이콘(ReceptionIcons). 고른 탭은 금빛 + 뒤에 은은한 알약이 미끄러져 따라간다.
// 왼쪽 위 '‹ 프리티풀' = 송년회 밖(홈)으로 나가는 유일한 길 — 앱(iOS 웹 껍데기)엔 브라우저 뒤로가기가 없다(261108 사장 '빠져나올 수가 없음').
// 이름 있는 손님이 화면을 열면 서버에 한 번 남긴다(어드민 '송년회 참여자' — 261108 사장 '누가 참여했는지'). 탭 세션마다 이름당 한 번.
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { BackIcon, EventIcon, ProgramIcon, SeatIcon, SurveyIcon } from './ReceptionIcons';
import { useReceptionGuest } from '@/lib/reception/guest';
import { receptionApi } from '@/lib/reception/api';

// 배경 프리즘 빛줄기(261108 사장 레퍼런스 '프리즘 느낌이 배경에서 일렁이듯이') — 오른쪽 위에서 왼쪽 아래로 비스듬히 내리는 빛 + 무지개 테두리.
// [왼쪽, 폭, 기울기, 한 번 오가는 시간, 시작 어긋남] — 서로 다른 박자로 오가며 겹쳤다 흩어진다. 그라데이션·빛 금지 규칙의 예외(배경 한정).
const PRISM: Array<[string, string, string, string, string]> = [
  ['56%', '40%', '28deg', '11s', '-2s'],
  ['20%', '26%', '24deg', '14s', '-7s'],
  ['82%', '22%', '33deg', '9s', '-4s'],
  ['-12%', '34%', '20deg', '16s', '-10s'],
];

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
  const guest = useReceptionGuest();
  useEffect(() => {
    if (!guest?.name) return;
    const KEY = 'freetiful-reception-guest-sent';
    try { if (sessionStorage.getItem(KEY) === guest.name) return; } catch {}
    receptionApi.guest(guest.deviceId, guest.name).then(() => {
      try { sessionStorage.setItem(KEY, guest.name); } catch {}
    }).catch(() => {});
  }, [guest?.deviceId, guest?.name]);
  const active = TABS.reduce((best, t) => (pathname === t.href || pathname.startsWith(`${t.href}/`) ? t : best), TABS[0] as (typeof TABS)[number]);
  return (
    <div className={`rc-theme rc-root ${fontClassName}`}>
      <div className="rc-bg" aria-hidden="true">
        <div className="rc-prism">
          {PRISM.map((b, k) => (
            <i key={k} style={{ '--x': b[0], '--w': b[1], '--r': b[2], '--d': b[3], '--dl': b[4] } as React.CSSProperties} />
          ))}
        </div>
      </div>
      <Link href="/main" className="rc-exit" aria-label="프리티풀 홈으로 나가기">
        <BackIcon size={16} />
        <span>프리티풀</span>
      </Link>
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
