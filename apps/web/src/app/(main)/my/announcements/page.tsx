'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronDown, Pin, Megaphone } from 'lucide-react';
import { useRouter } from 'next/navigation';

const MOCK_ANNOUNCEMENTS = [
  { id: '1', title: '프리티풀 서비스 오픈 안내', content: '안녕하세요, 프리티풀입니다.\n\n웨딩 전문가 매칭 플랫폼 프리티풀이 정식 오픈했습니다!\n\n오픈 기념 이벤트로 첫 결제 시 10% 할인 쿠폰을 드립니다.\n마이페이지 > 쿠폰에서 확인해주세요.\n\n감사합니다.', date: '2026.03.01', isPinned: true, tag: '필독' },
  { id: '2', title: 'v1.2.0 업데이트 안내', content: '다음과 같은 기능이 추가/개선되었습니다:\n\n1. 채팅 기능 개선 (예약 메시지, 이모지 리액션)\n2. 사진첩 기능 추가 (20일 자동 삭제)\n3. 전문가 프로필 UI 개선\n4. 버그 수정 및 성능 최적화', date: '2026.03.15', isPinned: true, tag: '업데이트' },
  { id: '3', title: '에스크로 결제 시스템 도입', content: '고객님의 안전한 결제를 위해 에스크로 결제 시스템이 도입되었습니다.\n\n결제 금액은 행사 완료 확인 후 전문가에게 정산됩니다.\n자세한 내용은 FAQ를 참고해주세요.', date: '2026.03.10', isPinned: false, tag: '안내' },
  { id: '4', title: '친구 초대 이벤트', content: '친구를 초대하면 초대한 분과 초대받은 분 모두 500P를 드립니다!\n\n마이페이지 > 친구 초대에서 내 추천 코드를 확인하세요.', date: '2026.03.05', isPinned: false, tag: '이벤트' },
  { id: '5', title: '3월 25일 서버 점검 안내', content: '서비스 안정화를 위해 아래 시간에 서버 점검이 진행됩니다.\n\n일시: 2026년 3월 25일(수) 03:00 ~ 05:00\n영향: 전 서비스 이용 불가\n\n이용에 불편을 드려 죄송합니다.', date: '2026.03.22', isPinned: false, tag: '점검' },
];

const TAG_COLORS: Record<string, string> = {
  '필독': 'bg-red-50 text-red-500',
  '업데이트': 'bg-blue-50 text-blue-500',
  '안내': 'bg-gray-100 text-gray-600',
  '이벤트': 'bg-amber-50 text-amber-600',
  '점검': 'bg-orange-50 text-orange-500',
};

export default function AnnouncementsPage() {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="bg-white min-h-screen max-w-lg mx-auto pb-24" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-gray-100/60">
        <div className="flex items-center px-4 h-[52px]">
          <button onClick={() => router.back()} className="p-1 active:scale-90 transition-transform">
            <ChevronLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="text-[17px] font-bold ml-2 text-gray-900">공지사항</h1>
        </div>
      </div>

      {/* 공지 리스트 */}
      <div className="px-4 pt-4 space-y-2">
        {MOCK_ANNOUNCEMENTS.map((a) => {
          const isOpen = openId === a.id;
          return (
            <div
              key={a.id}
              className={`rounded-2xl border transition-all duration-300 ${
                isOpen
                  ? 'border-gray-200 shadow-sm bg-white'
                  : a.isPinned
                  ? 'border-blue-100 bg-blue-50/30'
                  : 'border-gray-100 bg-white'
              }`}
            >
              <button
                onClick={() => setOpenId(isOpen ? null : a.id)}
                className="flex items-start gap-3 w-full px-4 py-4 text-left active:bg-gray-50/60 rounded-2xl transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {a.isPinned && <Pin size={12} className="text-blue-500 fill-blue-500 shrink-0" />}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TAG_COLORS[a.tag] || 'bg-gray-100 text-gray-500'}`}>
                      {a.tag}
                    </span>
                    <span className="text-[11px] text-gray-400">{a.date}</span>
                  </div>
                  <p className={`text-[14px] leading-snug ${
                    isOpen ? 'font-bold text-gray-900' : a.isPinned ? 'font-bold text-gray-900' : 'font-medium text-gray-700'
                  }`}>
                    {a.title}
                  </p>
                </div>
                <ChevronDown
                  size={18}
                  className={`text-gray-400 shrink-0 mt-1 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                className="overflow-hidden transition-all duration-400 ease-out"
                style={{
                  maxHeight: isOpen ? 500 : 0,
                  opacity: isOpen ? 1 : 0,
                }}
              >
                <div className="mx-4 border-t border-gray-100" />
                <p className="px-4 pt-3 pb-4 text-[13px] text-gray-500 leading-[1.8] whitespace-pre-line">
                  {a.content}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
