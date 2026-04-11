'use client';

import { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const TERMS_ITEMS = [
  { href: '/terms/service', label: '서비스 이용약관', date: '2026.03.22' },
  { href: '/terms/privacy', label: '개인정보 수집 및 이용약관', date: '2026.03.22' },
  { href: '/terms/third-party', label: '개인정보 제3자 제공 동의', date: '2026.03.22' },
  { href: '/terms/electronic-finance', label: '전자금융거래 이용약관', date: '2026.03.22' },
  { href: '/terms/marketing', label: '마케팅 정보 수신 동의', date: '2026.03.22' },
  { href: '/terms/meta-ads', label: 'META 광고 데이터 처리 약관', date: '2026.03.22' },
];

export default function TermsListPage() {
  const router = useRouter();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="bg-white min-h-screen max-w-lg mx-auto" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white flex items-center px-4 h-[52px]">
        <button onClick={() => router.back()} className="p-1">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[18px] font-bold ml-2">약관 및 정책</h1>
      </div>

      {/* Section divider */}
      <div className="h-1.5 bg-gray-50" />

      {/* Terms list */}
      <div>
        {TERMS_ITEMS.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100"
          >
            <div>
              <p className="text-sm text-gray-900">{item.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">시행일: {item.date}</p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </Link>
        ))}
      </div>

      <div className="px-4 py-6">
        <p className="text-[11px] text-gray-400 text-center leading-relaxed">
          프리티풀 | 대표: 서나웅<br />
          개인정보 보호책임자: 김정훈 이사 (운영관리팀)<br />
          고객문의: Jaicylab0110@gmail.com
        </p>
      </div>
    </div>
  );
}
