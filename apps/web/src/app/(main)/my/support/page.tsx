'use client';

import { useEffect } from 'react';
import { ChevronLeft, Clock, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SupportPage() {
  const router = useRouter();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="bg-white min-h-screen max-w-lg mx-auto" style={{ letterSpacing: '-0.02em' }}>
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center px-4 h-[52px]">
          <button onClick={() => router.back()} className="p-1"><ChevronLeft size={24} /></button>
          <h1 className="text-[18px] font-bold ml-3">고객센터</h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* 운영시간 */}
        <div className="bg-gray-100 p-4" style={{ borderRadius: 12 }}>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-gray-600" />
            <span className="text-sm font-bold text-gray-900">운영시간</span>
          </div>
          <p className="text-sm text-gray-700">평일 09:00 ~ 18:00 (점심 12:00 ~ 13:00)</p>
          <p className="text-xs text-gray-400 mt-1">주말 및 공휴일 휴무</p>
        </div>

        {/* 연락 방법 */}
        <div className="border border-gray-100 overflow-hidden" style={{ borderRadius: 12 }}>
          <a href="tel:1544-0000" className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="5" y="2" width="14" height="20" rx="3" fill="#4A8AF4"/>
                  <rect x="9" y="17" width="6" height="1.5" rx="0.75" fill="white" opacity="0.6"/>
                  <rect x="8" y="5" width="8" height="9" rx="1" fill="white" opacity="0.3"/>
                </svg>
                전화 문의
              </p>
              <p className="text-xs text-gray-400 ml-7">1544-0000</p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </a>
          <a href="mailto:support@freetiful.co.kr" className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="5" width="20" height="14" rx="3" fill="#F59E0B"/>
                  <path d="M2 8l10 6 10-6" stroke="white" strokeWidth="1.5" strokeLinejoin="round" opacity="0.7"/>
                </svg>
                이메일 문의
              </p>
              <p className="text-xs text-gray-400 ml-7">support@freetiful.co.kr</p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </a>
          <button className="flex items-center gap-3 px-4 py-4 w-full text-left">
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="#FEE500"/>
                  <path d="M12 6c-3.86 0-7 2.46-7 5.5 0 1.97 1.31 3.7 3.28 4.67l-.84 3.14c-.05.18.16.33.31.22l3.73-2.47c.17.01.34.02.52.02 3.86 0 7-2.46 7-5.5S15.86 6 12 6z" fill="#3C1E1E"/>
                </svg>
                카카오톡 문의
              </p>
              <p className="text-xs text-gray-400 ml-7">@프리티풀</p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        </div>

        {/* 자주 가는 링크 */}
        <div className="border border-gray-100 overflow-hidden" style={{ borderRadius: 12 }}>
          <Link href="/my/faq" className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
            <span className="text-sm text-gray-700">자주 묻는 질문 (FAQ)</span>
            <ChevronRight size={16} className="text-gray-300" />
          </Link>
          <Link href="/my/announcements" className="flex items-center justify-between px-4 py-3.5">
            <span className="text-sm text-gray-700">공지사항</span>
            <ChevronRight size={16} className="text-gray-300" />
          </Link>
        </div>
      </div>
    </div>
  );
}
