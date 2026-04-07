'use client';

import { ArrowLeft, Phone, Mail, MessageCircle, Clock, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SupportPage() {
  const router = useRouter();

  return (
    <div className="bg-gray-50 min-h-screen max-w-lg mx-auto">
      <div className="flex items-center px-4 h-14 border-b border-gray-100 bg-white sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-1"><ArrowLeft size={22} /></button>
        <h1 className="text-base font-bold ml-3">고객센터</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* 운영시간 */}
        <div className="bg-primary-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-primary-500" />
            <span className="text-sm font-bold text-primary-700">운영시간</span>
          </div>
          <p className="text-sm text-primary-600">평일 09:00 ~ 18:00 (점심 12:00 ~ 13:00)</p>
          <p className="text-xs text-primary-400 mt-1">주말 및 공휴일 휴무</p>
        </div>

        {/* 연락 방법 */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <a href="tel:1544-0000" className="flex items-center gap-3 px-4 py-4 border-b border-gray-50">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Phone size={18} className="text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">전화 문의</p>
              <p className="text-xs text-gray-400">1544-0000</p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </a>
          <a href="mailto:support@prettyful.co.kr" className="flex items-center gap-3 px-4 py-4 border-b border-gray-50">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Mail size={18} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">이메일 문의</p>
              <p className="text-xs text-gray-400">support@prettyful.co.kr</p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </a>
          <button className="flex items-center gap-3 px-4 py-4 w-full text-left">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <MessageCircle size={18} className="text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">카카오톡 문의</p>
              <p className="text-xs text-gray-400">@프리티풀</p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        </div>

        {/* 자주 가는 링크 */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <Link href="/my/faq" className="flex items-center justify-between px-4 py-3.5 border-b border-gray-50">
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
