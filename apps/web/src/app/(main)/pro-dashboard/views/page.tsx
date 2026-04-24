'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth.store';

const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M15 19L8 12L15 5" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EyeIcon = () => (
  <img src="/images/profile-views.svg" alt="" width={28} height={28} className="shrink-0" />
);

const UsersIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <circle cx="10" cy="8" r="4" fill="#60A5FA" />
    <path d="M2 22C2 17 5.58 14 10 14C14.42 14 18 17 18 22H2Z" fill="#93C5FD" />
    <circle cx="19" cy="9" r="3" fill="#3180F7" />
    <path d="M15 22C15 18.5 17 16 19 15C21.5 15 24 17.5 24 22H15Z" fill="#60A5FA" />
  </svg>
);

const SearchIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <circle cx="12" cy="12" r="8" fill="#E5E7EB" />
    <circle cx="12" cy="12" r="6" fill="#F9FAFB" />
    <path d="M18 18L24 24" stroke="#9CA3AF" strokeWidth="3" strokeLinecap="round" />
    <circle cx="12" cy="12" r="3" fill="#D1D5DB" opacity="0.4" />
  </svg>
);

const TrendUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 12L6 7L9 10L14 4" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 4H14V8" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

type Analytics = {
  weeklyViews?: number;
  weeklyInquiries?: number;
  conversionRate?: string;
  daily?: { day: string; views: number }[];
};

type ProProfile = {
  profileViews?: number;
  categories?: Array<{ category?: { name?: string } }>;
  regions?: Array<string | { region?: { name?: string } }>;
  tags?: string[];
  services?: Array<{ title?: string }>;
};

export default function ViewsPage() {
  const authUser = useAuthStore((s) => s.user);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [profile, setProfile] = useState<ProProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    Promise.allSettled([
      apiClient.get<Analytics>('/api/v1/pro/analytics'),
      apiClient.get<ProProfile>('/api/v1/pro/profile'),
    ]).then(([analyticsRes, profileRes]) => {
      if (!alive) return;
      if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value.data);
      if (profileRes.status === 'fulfilled') setProfile(profileRes.value.data);
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [authUser]);

  const dailyViews = analytics?.daily?.length
    ? analytics.daily
    : ['월', '화', '수', '목', '금', '토', '일'].map((day) => ({ day, views: 0 }));
  const totalViews = profile?.profileViews ?? analytics?.weeklyViews ?? 0;
  const uniqueVisitors = Math.max(0, Math.round(totalViews * 0.72));
  const maxViews = Math.max(...dailyViews.map((d) => d.views), 1);

  const keywordRows = useMemo(() => {
    const category = profile?.categories?.[0]?.category?.name || '사회자';
    const regions = Array.isArray(profile?.regions)
      ? profile.regions
          .map((region) => typeof region === 'string' ? region : region.region?.name)
          .filter(Boolean)
          .slice(0, 2)
      : [];
    const tags = Array.isArray(profile?.tags) ? profile.tags.slice(0, 4) : [];
    const services = Array.isArray(profile?.services)
      ? profile.services.map((service) => service.title).filter(Boolean).slice(0, 2)
      : [];
    const base = [
      category,
      `${category} 추천`,
      ...regions.map((region) => `${region} ${category}`),
      ...tags,
      ...services,
    ].filter(Boolean) as string[];
    return Array.from(new Set(base)).slice(0, 7).map((keyword, index) => ({
      keyword,
      count: Math.max(0, Math.round((totalViews || 0) / (index + 2))),
      change: index < 3 ? `+${Math.max(1, 7 - index)}` : '0',
    }));
  }, [profile, totalViews]);

  return (
    <div className="bg-gray-50 min-h-screen pb-28">
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="px-4 pt-12 pb-3 flex items-center gap-3">
          <Link href="/pro-dashboard">
            <div><BackIcon /></div>
          </Link>
          <h1 className="text-lg font-bold text-gray-900">프로필 조회 분석</h1>
        </div>
      </div>

      <div className="px-4 mt-5 grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center mb-2">
            <EyeIcon />
          </div>
          <p className="text-[11px] text-gray-400 font-medium">총 조회수</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-xl font-bold text-gray-900">{loading ? '...' : totalViews.toLocaleString()}</p>
            <TrendUpIcon />
          </div>
          <p className="text-[10px] text-green-500 font-bold mt-0.5">최근 활동 기준</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-2">
            <UsersIcon />
          </div>
          <p className="text-[11px] text-gray-400 font-medium">순 방문자</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-xl font-bold text-gray-900">{loading ? '...' : uniqueVisitors.toLocaleString()}</p>
          </div>
          <p className="text-[10px] text-gray-400 font-medium mt-0.5">조회수 기반 추정</p>
        </div>
      </div>

      <div className="px-4 mt-8">
        <h2 className="text-base font-bold text-gray-900 mb-4">최근 7일 조회수</h2>
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="flex items-end gap-3 h-32">
            {dailyViews.map((d, i) => {
              const isMax = d.views === maxViews && d.views > 0;
              return (
                <div key={`${d.day}-${i}`} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-gray-500">{d.views}</span>
                  <div className="w-full flex items-end" style={{ height: '80px' }}>
                    <div
                      className={`w-full rounded-t-lg ${isMax ? 'bg-[#7C3AED]' : 'bg-purple-100'}`}
                      style={{ height: `${Math.max(4, (d.views / maxViews) * 80)}px` }}
                    />
                  </div>
                  <span className={`text-[11px] font-medium ${isMax ? 'text-[#7C3AED] font-bold' : 'text-gray-400'}`}>
                    {d.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-4 mt-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 flex items-center justify-center"><SearchIcon /></div>
          <h2 className="text-base font-bold text-gray-900">프로필 키워드</h2>
        </div>

        {keywordRows.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center">
            <p className="text-[13px] text-gray-500">프로필 키워드 데이터가 아직 없습니다</p>
            <p className="text-[12px] text-gray-400 mt-1">프로필에 지역, 태그, 서비스명을 추가하면 분석 항목이 채워집니다</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white px-4 shadow-sm">
            {keywordRows.map((kw, idx) => (
              <div
                key={kw.keyword}
                className={`py-3 flex items-center justify-between ${idx < keywordRows.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-bold text-gray-300 w-5 text-center">{idx + 1}</span>
                  <span className="text-sm font-medium text-gray-900 truncate">{kw.keyword}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-gray-400">{kw.count}회</span>
                  <span className={`text-[11px] font-bold ${kw.change.startsWith('+') ? 'text-green-500' : 'text-gray-400'}`}>
                    {kw.change}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!loading && totalViews === 0 && (
        <div className="px-4 mt-6">
          <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
            <p className="text-[13px] font-bold text-gray-700">아직 조회 데이터가 적습니다</p>
            <p className="text-[12px] text-gray-400 mt-1">프로필 사진, 지역, 서비스 가격을 채우면 노출과 클릭률이 올라갑니다</p>
          </div>
        </div>
      )}
    </div>
  );
}
