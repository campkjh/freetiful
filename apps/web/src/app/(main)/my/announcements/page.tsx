'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronDown, Pin } from 'lucide-react';
import { useRouter } from 'next/navigation';

const MOCK_ANNOUNCEMENTS = [
  { id: '1', title: '[필독] 프리티풀 서비스 오픈 안내', content: '안녕하세요, 프리티풀입니다.\n\n웨딩 전문가 매칭 플랫폼 프리티풀이 정식 오픈했습니다!\n\n오픈 기념 이벤트로 첫 결제 시 10% 할인 쿠폰을 드립니다.\n마이페이지 > 쿠폰에서 확인해주세요.\n\n감사합니다.', date: '2026-03-01', isPinned: true },
  { id: '2', title: '[업데이트] v1.2.0 업데이트 안내', content: '다음과 같은 기능이 추가/개선되었습니다:\n\n1. 채팅 기능 개선 (예약 메시지, 이모지 리액션)\n2. 사진첩 기능 추가 (20일 자동 삭제)\n3. 전문가 프로필 UI 개선\n4. 버그 수정 및 성능 최적화', date: '2026-03-15', isPinned: true },
  { id: '3', title: '[안내] 에스크로 결제 시스템 도입', content: '고객님의 안전한 결제를 위해 에스크로 결제 시스템이 도입되었습니다.\n\n결제 금액은 행사 완료 확인 후 전문가에게 정산됩니다.\n자세한 내용은 FAQ를 참고해주세요.', date: '2026-03-10', isPinned: false },
  { id: '4', title: '[이벤트] 친구 초대 이벤트', content: '친구를 초대하면 초대한 분과 초대받은 분 모두 500P를 드립니다!\n\n마이페이지 > 친구 초대에서 내 추천 코드를 확인하세요.', date: '2026-03-05', isPinned: false },
  { id: '5', title: '[점검] 3월 25일 서버 점검 안내', content: '서비스 안정화를 위해 아래 시간에 서버 점검이 진행됩니다.\n\n일시: 2026년 3월 25일(수) 03:00 ~ 05:00\n영향: 전 서비스 이용 불가\n\n이용에 불편을 드려 죄송합니다.', date: '2026-03-22', isPinned: false },
];

export default function AnnouncementsPage() {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="bg-white min-h-screen max-w-lg mx-auto" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white flex items-center px-4 h-[52px]">
        <button onClick={() => router.back()} className="p-1">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[18px] font-bold ml-2">공지사항</h1>
      </div>

      {/* Section divider */}
      <div className="h-1.5 bg-gray-50" />

      {/* Announcement list */}
      <div>
        {MOCK_ANNOUNCEMENTS.map((a) => {
          const isOpen = openId === a.id;
          return (
            <div key={a.id} className="border-b border-gray-100">
              <button
                onClick={() => setOpenId(isOpen ? null : a.id)}
                className="flex items-center gap-3 w-full px-4 py-3.5 text-left"
              >
                {a.isPinned && <Pin size={14} className="text-primary-500 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${a.isPinned ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{a.title}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{a.date}</p>
                </div>
                <ChevronDown
                  size={16}
                  className="text-gray-300 shrink-0 transition-transform duration-200"
                  style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>
              <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{
                  maxHeight: isOpen ? '500px' : '0px',
                  opacity: isOpen ? 1 : 0,
                }}
              >
                <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed whitespace-pre-line bg-gray-50" style={{ borderRadius: 12 }}>
                  {a.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
