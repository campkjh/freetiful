'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, Users, TrendingUp, Calendar } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { apiClient } from '@/lib/api/client';

interface Analytics {
  weeklyViews: number;
  weeklyInquiries: number;
  weeklyBookings: number;
  prevWeekInquiries: number;
  conversionRate: string;
  daily: { day: string; views: number }[];
}

export default function AnalyticsPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser) { setLoading(false); return; }
    apiClient.get<Analytics>('/api/v1/pro/analytics')
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [authUser]);

  const daily = data?.daily ?? ['월', '화', '수', '목', '금', '토', '일'].map((day) => ({ day, views: 0 }));
  const maxViews = Math.max(...daily.map((d) => d.views), 1);
  const inquiryDiff = (data?.weeklyInquiries ?? 0) - (data?.prevWeekInquiries ?? 0);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white px-4 pt-12 pb-4 sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1"><ArrowLeft size={22} /></button>
          <h1 className="text-lg font-bold">통계</h1>
        </div>
      </div>

      <div className="px-4 mt-4 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <Eye size={16} className="text-blue-500 mb-2" />
          <p className="text-xs text-gray-500">누적 프로필 조회수</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{loading ? '...' : (data?.weeklyViews ?? 0)}</p>
          <p className="text-[10px] text-gray-400">최근 업데이트 기준</p>
        </div>
        <div className="card p-4">
          <Users size={16} className="text-green-500 mb-2" />
          <p className="text-xs text-gray-500">이번 주 문의</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{loading ? '...' : (data?.weeklyInquiries ?? 0)}</p>
          <p className={`text-[10px] flex items-center gap-0.5 ${inquiryDiff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            <TrendingUp size={10} /> {inquiryDiff >= 0 ? '+' : ''}{inquiryDiff}건 전주 대비
          </p>
        </div>
        <div className="card p-4">
          <Calendar size={16} className="text-purple-500 mb-2" />
          <p className="text-xs text-gray-500">이번 주 예약</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{loading ? '...' : (data?.weeklyBookings ?? 0)}</p>
          <p className="text-[10px] text-gray-400">확정된 예약</p>
        </div>
        <div className="card p-4">
          <TrendingUp size={16} className="text-orange-500 mb-2" />
          <p className="text-xs text-gray-500">전환율</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{loading ? '...' : (data?.conversionRate ?? '0%')}</p>
          <p className="text-[10px] text-gray-400">조회 → 문의</p>
        </div>
      </div>

      <div className="px-4 mt-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3">주간 요일별 예약</h3>
        <div className="card p-4">
          <div className="flex items-end gap-2 h-40">
            {daily.map(({ day, views }) => (
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

      {!loading && (!data || data.weeklyInquiries === 0) && (
        <div className="px-4 mt-5 mb-8">
          <div className="card p-6 text-center">
            <p className="text-[13px] text-gray-500">아직 데이터가 충분하지 않습니다</p>
            <p className="text-[12px] text-gray-400 mt-1">프로필을 완성하고 노출을 늘려보세요</p>
          </div>
        </div>
      )}
    </div>
  );
}
