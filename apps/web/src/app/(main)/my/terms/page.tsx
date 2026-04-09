'use client';

import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const TERMS_ITEMS = [
  { href: '/terms/service', label: '서비스 이용약관', date: '2026.01.01' },
  { href: '/terms/privacy', label: '개인정보처리방침', date: '2026.01.01' },
  { href: '#', label: '위치기반서비스 이용약관', date: '2026.01.01' },
  { href: '#', label: '전자금융거래 이용약관', date: '2026.01.01' },
  { href: '#', label: '마케팅 정보 수신 동의', date: '2026.01.01' },
  { href: '#', label: '제3자 정보 제공 동의', date: '2026.01.01' },
];

export default function TermsListPage() {
  const router = useRouter();

  return (
    <div className="bg-gray-50 min-h-screen max-w-lg mx-auto">
      <div className="flex items-center px-4 h-14 border-b border-gray-100 bg-white sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-1"><ArrowLeft size={22} /></button>
        <h1 className="text-base font-bold ml-3">약관 및 정책</h1>
      </div>

      <div className="bg-white mt-2 divide-y divide-gray-50">
        {TERMS_ITEMS.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center justify-between px-4 py-3.5"
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
          프리티풀 | 대표: 홍길동 | 사업자등록번호: 123-45-67890<br />
          서울특별시 강남구 테헤란로 123, 4층<br />
          고객센터: 1544-0000 | support@freetiful.co.kr
        </p>
      </div>
    </div>
  );
}
