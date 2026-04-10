'use client';

import { ChevronLeft, Phone, Mail, MessageCircle, Clock, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SupportPage() {
  const router = useRouter();

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
            <div className="w-10 h-10 bg-green-100 flex items-center justify-center" style={{ borderRadius: 12 }}>
              <Phone size={18} className="text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">전화 문의</p>
              <p className="text-xs text-gray-400">1544-0000</p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </a>
          <a href="mailto:support@freetiful.co.kr" className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
            <div className="w-10 h-10 bg-blue-100 flex items-center justify-center" style={{ borderRadius: 12 }}>
              <Mail size={18} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">이메일 문의</p>
              <p className="text-xs text-gray-400">support@freetiful.co.kr</p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </a>
          <button className="flex items-center gap-3 px-4 py-4 w-full text-left">
            <div className="w-10 h-10 bg-purple-100 flex items-center justify-center" style={{ borderRadius: 12 }}>
              <MessageCircle size={18} className="text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">카카오톡 문의</p>
              <p className="text-xs text-gray-400">@프리티풀</p>
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
