'use client';

import { useEffect } from 'react';
import { ClockIcon } from '@/components/icons/mono';
import { MY_CARD, MySectionTitle, MyDetailHeader, QdList, QdRow } from '../_components/detail-ui';

const CONTACTS = [
  {
    href: 'tel:02-765-8882',
    label: '전화 문의',
    value: '02-765-8882',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="5" y="2" width="14" height="20" rx="3" fill="#3182F6" />
        <rect x="9" y="17" width="6" height="1.5" rx="0.75" fill="white" opacity="0.6" />
        <rect x="8" y="5" width="8" height="9" rx="1" fill="white" opacity="0.3" />
      </svg>
    ),
  },
  {
    href: 'mailto:support@freetiful.co.kr',
    label: '이메일 문의',
    value: 'support@freetiful.co.kr',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="14" rx="3" fill="#F59E0B" />
        <path d="M2 8l10 6 10-6" stroke="white" strokeWidth="1.5" strokeLinejoin="round" opacity="0.7" />
      </svg>
    ),
  },
  {
    href: 'http://pf.kakao.com/_axbJmn',
    label: '카카오톡 문의',
    value: '프리티풀 카카오톡 채널',
    external: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#FEE500" />
        <path
          d="M12 6c-3.86 0-7 2.46-7 5.5 0 1.97 1.31 3.7 3.28 4.67l-.84 3.14c-.05.18.16.33.31.22l3.73-2.47c.17.01.34.02.52.02 3.86 0 7-2.46 7-5.5S15.86 6 12 6z"
          fill="#3C1E1E"
        />
      </svg>
    ),
  },
];

const SHORTCUTS = [
  { href: '/my/faq', label: '자주 묻는 질문 (FAQ)' },
  { href: '/my/announcements', label: '공지사항' },
  { href: '/terms/refund', label: '플랫폼 환불 규정' },
];

export default function SupportPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white pb-10" style={{ letterSpacing: '-0.02em' }}>
      <MyDetailHeader title="고객센터" sub="궁금한 점을 편하게 물어보세요" />

      <div className="qd-body space-y-6 px-6 pt-1">
        {/* 운영시간 */}
        <div className={`${MY_CARD} p-5`}>
          <div className="mb-2 flex items-center gap-1.5">
            <ClockIcon size={16} className="text-[#3182F6]" />
            <span className="text-[14px] font-bold text-[#2B313D]">운영시간</span>
          </div>
          <p className="text-[14px] font-medium text-[#51535C]">평일 09:00 ~ 18:00</p>
          <p className="mt-0.5 text-[13px] text-[#A4ABBA]">점심 12:00 ~ 13:00 · 주말 및 공휴일 휴무</p>
        </div>

        {/* 연락 방법 */}
        <div>
          <MySectionTitle>문의하기</MySectionTitle>
          <QdList>
            {CONTACTS.map((row) => (
              <QdRow key={row.label} icon={row.icon} title={row.label} hint={row.value} href={row.href} external={row.external} />
            ))}
          </QdList>
        </div>

        {/* 자주 가는 링크 */}
        <div>
          <MySectionTitle>자주 찾는 안내</MySectionTitle>
          <QdList>
            {SHORTCUTS.map((row) => (
              <QdRow key={row.href} title={row.label} href={row.href} />
            ))}
          </QdList>
        </div>
      </div>
    </div>
  );
}
