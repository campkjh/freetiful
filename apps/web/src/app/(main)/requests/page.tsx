'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { matchApi } from '@/lib/api/match.api';
import { useAuthStore } from '@/lib/store/auth.store';

type TabType = '전체' | '다수' | '단일' | '보관';

type RequestItem = {
  id: string;
  type: string;
  date: string;
  name: string;
  price: string;
  eventDate: string;
  location: string;
  note: string;
  status: string;
};

const TABS: TabType[] = ['전체', '다수', '단일', '보관'];
const PAGE_SIZE = 10;

export default function RequestsPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<TabType>('전체');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser) {
      setRequests([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    matchApi.getMyRequests()
      .then((items: any[]) => {
        if (!alive) return;
        setRequests((Array.isArray(items) ? items : []).map((r) => {
          const budget = r.budgetMin || r.budgetMax
            ? `${Number(r.budgetMin || 0).toLocaleString()}원 ~ ${r.budgetMax ? Number(r.budgetMax).toLocaleString() + '원' : ''}`
            : '협의';
          return {
            id: r.id,
            type: r.type === 'single' ? '단일문의' : '다수문의',
            date: new Date(r.createdAt).toLocaleDateString('ko-KR'),
            name: authUser.name || '고객',
            price: budget,
            eventDate: r.eventDate ? new Date(r.eventDate).toLocaleDateString('ko-KR') : '미정',
            location: r.eventLocation || '미정',
            note: r.rawUserInput?.note || [r.category?.name, r.eventCategory?.name].filter(Boolean).join(' · '),
            status: r.status,
          };
        }));
      })
      .catch(() => toast.error('의뢰 목록을 불러오지 못했습니다.'))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [authUser]);

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
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`relative isolate px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 active:scale-95 ${isActive ? 'text-white' : 'text-gray-500'}`}
            >
              <span className={`absolute inset-0 bg-gray-900 rounded-full transition-all duration-300 ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`} style={{ zIndex: -1 }} />
              <span className="relative">{tab} {counts[tab]}</span>
            </button>
          );
        })}
      </div>

      {/* Request Cards */}
      <div className="px-4 space-y-3 pb-28">
        {loading && (
          <div className="bg-white rounded-2xl p-5 text-sm text-gray-400">의뢰를 불러오는 중...</div>
        )}
        {!loading && !authUser && (
          <div className="bg-white rounded-2xl p-5 text-sm text-gray-500">로그인 후 의뢰 목록을 확인할 수 있습니다.</div>
        )}
        {!loading && authUser && visible.length === 0 && (
          <div className="bg-white rounded-2xl p-5 text-sm text-gray-500">아직 등록된 의뢰가 없습니다.</div>
        )}
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
              <button
                onClick={() => router.push('/chat')}
                className="flex-1 py-4 bg-[#3180F7] text-white rounded-2xl font-bold text-base"
              >
                채팅 보기
              </button>
              <button className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold text-base" disabled>
                {req.status === 'matched' ? '매칭 완료' : '전달 중'}
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
