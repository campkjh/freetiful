'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, Users, User, MessageCircle, ChevronRight } from 'lucide-react';

type Filter = 'all' | 'multi' | 'single';

const MOCK_INQUIRIES = [
  { id: '1', type: 'multi' as const, userName: '홍길동', eventType: '결혼식', eventDate: '2026-04-20', budget: '50~80만원', message: '서울 강남 지역에서 진행할 결혼식 MC를 찾고 있습니다. 격식있으면서 유머있는 스타일을 원합니다.', receivedAt: '2분 전', status: 'pending' },
  { id: '2', type: 'single' as const, userName: '이영희', eventType: '돌잔치', eventDate: '2026-05-01', budget: '30~50만원', message: '아이 돌잔치 MC 문의드립니다. 밝고 친근한 분위기로 진행해주실 분을 찾습니다.', receivedAt: '1시간 전', status: 'pending' },
  { id: '3', type: 'multi' as const, userName: '박철수', eventType: '기업행사', eventDate: '2026-04-15', budget: '80~100만원', message: '회사 창립기념 행사 MC를 찾습니다. 프로페셔널한 진행 가능한 분 부탁드립니다.', receivedAt: '3시간 전', status: 'replied' },
  { id: '4', type: 'single' as const, userName: '김수정', eventType: '결혼식', eventDate: '2026-05-10', budget: '50~80만원', message: '5월 야외 웨딩 MC 가능하신지 문의드립니다.', receivedAt: '어제', status: 'replied' },
  { id: '5', type: 'multi' as const, userName: '정대호', eventType: '생신잔치', eventDate: '2026-04-25', budget: '30~50만원', message: '아버지 칠순 잔치 MC 부탁드려요.', receivedAt: '어제', status: 'declined' },
];

export default function InquiriesPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = MOCK_INQUIRIES.filter((inq) => filter === 'all' || inq.type === filter);
  const pendingCount = MOCK_INQUIRIES.filter((i) => i.status === 'pending').length;

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white px-4 pt-12 pb-3 sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.back()} className="p-1"><ArrowLeft size={22} /></button>
          <h1 className="text-lg font-bold">문의 관리</h1>
          {pendingCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
          )}
        </div>

        <div className="flex gap-2">
          {([
            { key: 'all' as Filter, label: '전체', icon: null },
            { key: 'multi' as Filter, label: '다중 견적', icon: Users },
            { key: 'single' as Filter, label: '1:1 문의', icon: User },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === key
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {Icon && <Icon size={12} />}
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm">문의가 없습니다</p>
          </div>
        ) : (
          filtered.map((inq) => (
            <Link key={inq.id} href={`/chat/${inq.id}`} className="card p-4 block hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    inq.type === 'multi'
                      ? 'bg-blue-50 text-blue-600'
                      : 'bg-green-50 text-green-600'
                  }`}>
                    {inq.type === 'multi' ? '다중' : '1:1'}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    inq.status === 'pending' ? 'bg-red-50 text-red-500' :
                    inq.status === 'replied' ? 'bg-green-50 text-green-600' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {inq.status === 'pending' ? '미답변' : inq.status === 'replied' ? '답변완료' : '거절'}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400">{inq.receivedAt}</span>
              </div>

              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-sm font-bold text-gray-900">{inq.userName}</p>
                <p className="text-xs text-gray-400">·</p>
                <p className="text-xs text-gray-500">{inq.eventType}</p>
              </div>

              <p className="text-xs text-gray-600 line-clamp-2">{inq.message}</p>

              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50">
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Clock size={10} /> {inq.eventDate}
                </span>
                <span className="text-[10px] text-gray-400">{inq.budget}</span>
                <span className="ml-auto"><ChevronRight size={14} className="text-gray-300" /></span>
              </div>

              {inq.status === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={(e) => e.preventDefault()}
                    className="flex-1 py-2 text-xs font-bold text-white bg-primary-500 rounded-xl flex items-center justify-center gap-1"
                  >
                    <MessageCircle size={12} /> 답변하기
                  </button>
                </div>
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
