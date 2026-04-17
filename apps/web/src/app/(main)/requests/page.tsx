'use client';

import { useState } from 'react';

type TabType = '전체' | '다수' | '단일' | '보관';

const MOCK_REQUESTS: { id: number; type: string; date: string; name: string; price: string; eventDate: string; location: string; note: string }[] = [];

const TABS: TabType[] = ['전체', '다수', '단일', '보관'];
const PAGE_SIZE = 10;

export default function RequestsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('전체');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const requests = MOCK_REQUESTS;
  const filtered = requests.filter((r) => {
    if (activeTab === '전체') return true;
    if (activeTab === '다수') return r.type === '다수문의';
    if (activeTab === '단일') return r.type === '단일문의';
    if (activeTab === '보관') return r.type === '보관';
    return true;
  });

  const counts = {
    전체: requests.length,
    다수: requests.filter(r => r.type === '다수문의').length,
    단일: requests.filter(r => r.type === '단일문의').length,
    보관: requests.filter(r => r.type === '보관').length,
  };

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="px-4 pt-14 pb-4 bg-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">새의뢰</h1>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 pb-4 flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-500 border border-gray-200'
            }`}
          >
            {tab} {counts[tab]}
          </button>
        ))}
      </div>

      {/* Request Cards */}
      <div className="px-4 space-y-3 pb-28">
        {visible.map((req) => (
          <div key={req.id} className="bg-white rounded-2xl p-5">
            {/* Date & Type */}
            <p className="text-xs text-gray-400 mb-1">{req.type} {req.date}</p>

            {/* Name */}
            <p className="text-lg font-bold mb-4">
              <span className="text-[#3180F7]">{req.name}</span>님의 의뢰
            </p>

            {/* 견적가 */}
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-0.5">견적가</p>
              <p className="text-xl font-bold text-gray-900">{req.price}</p>
            </div>

            {/* 행사일 */}
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-0.5">행사일</p>
              <p className="text-xl font-bold text-gray-900">{req.eventDate}</p>
            </div>

            {/* 행사장소 */}
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-0.5">행사장소</p>
              <p className="text-xl font-bold text-gray-900 whitespace-pre-line">{req.location}</p>
            </div>

            {/* 요청사항 */}
            <div className="mb-5">
              <p className="text-xs text-gray-400 mb-0.5">요청사항</p>
              {req.note ? (
                <p className="text-base text-gray-900">{req.note}</p>
              ) : null}
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mb-4">
              <button className="flex-1 py-4 bg-[#3180F7] text-white rounded-2xl font-bold text-base">
                견적보내기
              </button>
              <button className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold text-base">
                보관
              </button>
            </div>

            {/* 행사장 길찾기 */}
            <a
              href={`https://map.naver.com/v5/search/${encodeURIComponent(req.location.replace('\n', ' '))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2"
            >
              <div className="w-7 h-7 rounded-full bg-[#03C75A] flex items-center justify-center shrink-0">
                <span className="text-white font-black text-sm leading-none">N</span>
              </div>
              <span className="text-sm font-medium text-gray-700">행사장 길찾기</span>
            </a>
          </div>
        ))}

        {/* 더보기 */}
        {hasMore && (
          <div className="flex justify-center pt-2 pb-4">
            <button
              onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
              className="px-10 py-3 bg-gray-200 text-gray-600 rounded-full font-medium text-sm"
            >
              더보기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
