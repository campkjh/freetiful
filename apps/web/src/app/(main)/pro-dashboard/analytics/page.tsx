'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, Users, TrendingUp, MousePointer } from 'lucide-react';

const MOCK_WEEKLY = [
  { day: '월', views: 42 },
  { day: '화', views: 58 },
  { day: '수', views: 35 },
  { day: '목', views: 67 },
  { day: '금', views: 53 },
  { day: '토', views: 89 },
  { day: '일', views: 44 },
];

const maxViews = Math.max(...MOCK_WEEKLY.map((d) => d.views));

export default function AnalyticsPage() {
  const router = useRouter();

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white px-4 pt-12 pb-4 sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1"><ArrowLeft size={22} /></button>
          <h1 className="text-lg font-bold">통계</h1>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <Eye size={16} className="text-blue-500 mb-2" />
          <p className="text-xs text-gray-500">이번 주 조회수</p>
          <p className="text-2xl font-black text-gray-900 mt-1">388</p>
          <p className="text-[10px] text-green-500 flex items-center gap-0.5">
            <TrendingUp size={10} /> +23% 전주 대비
          </p>
        </div>
        <div className="card p-4">
          <Users size={16} className="text-green-500 mb-2" />
          <p className="text-xs text-gray-500">이번 주 문의</p>
          <p className="text-2xl font-black text-gray-900 mt-1">12</p>
          <p className="text-[10px] text-green-500 flex items-center gap-0.5">
            <TrendingUp size={10} /> +3건 전주 대비
          </p>
        </div>
        <div className="card p-4">
          <MousePointer size={16} className="text-purple-500 mb-2" />
          <p className="text-xs text-gray-500">CPC (문의당 비용)</p>
          <p className="text-2xl font-black text-gray-900 mt-1">0원</p>
          <p className="text-[10px] text-gray-400">무료 플랜</p>
        </div>
        <div className="card p-4">
          <TrendingUp size={16} className="text-orange-500 mb-2" />
          <p className="text-xs text-gray-500">전환율</p>
          <p className="text-2xl font-black text-gray-900 mt-1">3.1%</p>
          <p className="text-[10px] text-gray-400">조회 → 문의</p>
        </div>
      </div>

      {/* Weekly Chart */}
      <div className="px-4 mt-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3">주간 프로필 조회수</h3>
        <div className="card p-4">
          <div className="flex items-end gap-2 h-40">
            {MOCK_WEEKLY.map(({ day, views }) => (
              <div key={day} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-gray-900">{views}</span>
                <div
                  className="w-full bg-primary-400 rounded-t-lg transition-all"
                  style={{ height: `${(views / maxViews) * 100}%`, minHeight: '4px' }}
                />
                <span className="text-[10px] text-gray-400">{day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Source Breakdown */}
      <div className="px-4 mt-5 mb-8">
        <h3 className="text-sm font-bold text-gray-900 mb-3">유입 경로</h3>
        <div className="card p-4 space-y-3">
          {[
            { source: '검색 (카테고리)', percent: 45, color: 'bg-primary-500' },
            { source: '추천 전문가', percent: 25, color: 'bg-blue-500' },
            { source: '링크 공유', percent: 18, color: 'bg-green-500' },
            { source: '기타', percent: 12, color: 'bg-gray-400' },
          ].map(({ source, percent, color }) => (
            <div key={source}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-700">{source}</span>
                <span className="text-xs font-bold text-gray-900">{percent}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
