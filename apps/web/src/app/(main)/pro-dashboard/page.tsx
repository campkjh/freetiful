'use client';

import Link from 'next/link';
import {
  Calendar, MessageCircle, BarChart3, Award,
  Clock, TrendingUp, Eye, Users, ChevronRight
} from 'lucide-react';

const MOCK_STATS = {
  puddingCount: 45,
  puddingRank: 2,
  profileViews: 328,
  inquiriesThisWeek: 12,
  responseRate: 98,
  matchRate: 72,
  todayAttendance: true,
  upcomingEvents: 3,
};

const QUICK_MENU = [
  { href: '/pro-dashboard/schedule', icon: Calendar, label: '일정 관리', color: 'bg-blue-500' },
  { href: '/pro-dashboard/inquiries', icon: MessageCircle, label: '문의 관리', color: 'bg-green-500', badge: '5' },
  { href: '/pro-dashboard/pudding', icon: Award, label: '푸딩', color: 'bg-yellow-500' },
  { href: '/pro-dashboard/analytics', icon: BarChart3, label: '통계', color: 'bg-purple-500' },
];

export default function ProDashboardPage() {
  const stats = MOCK_STATS;

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-primary-500 px-4 pt-12 pb-6">
        <h1 className="text-xl font-bold text-white">파트너 대시보드</h1>
        <p className="text-xs text-white/70 mt-1">김민준 MC님, 오늘도 화이팅!</p>

        {/* Pudding Card */}
        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/80">보유 푸딩</p>
              <p className="text-3xl font-black text-white mt-1">{stats.puddingCount}</p>
            </div>
            <div className="text-right">
              <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                stats.puddingRank === 1 ? 'bg-yellow-400 text-yellow-900' :
                stats.puddingRank === 2 ? 'bg-gray-300 text-gray-700' :
                'bg-orange-400 text-orange-900'
              }`}>
                {stats.puddingRank === 1 ? '🥇' : stats.puddingRank === 2 ? '🥈' : '🥉'} {stats.puddingRank}위
              </span>
              <p className="text-[10px] text-white/60 mt-1">매일 00시 랭킹 갱신</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Menu */}
      <div className="px-4 -mt-3">
        <div className="bg-white rounded-2xl shadow-sm p-4 grid grid-cols-4 gap-3">
          {QUICK_MENU.map(({ href, icon: Icon, label, color, badge }) => (
            <Link key={href} href={href} className="flex flex-col items-center gap-1.5 relative">
              <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center`}>
                <Icon size={22} className="text-white" />
              </div>
              <span className="text-[10px] text-gray-600 font-medium">{label}</span>
              {badge && (
                <span className="absolute -top-1 right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                  {badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Attendance */}
      <div className="px-4 mt-4">
        <div className="card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <Clock size={20} className="text-green-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">오늘 출석체크</p>
              <p className="text-xs text-gray-500">{stats.todayAttendance ? '완료!' : '아직 안 했어요'}</p>
            </div>
          </div>
          {stats.todayAttendance ? (
            <span className="text-xs font-bold text-green-500 bg-green-50 px-3 py-1.5 rounded-full">완료</span>
          ) : (
            <button className="text-xs font-bold text-white bg-primary-500 px-4 py-1.5 rounded-full">출석</button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye size={14} className="text-gray-400" />
            <span className="text-xs text-gray-500">프로필 조회</span>
          </div>
          <p className="text-2xl font-black text-gray-900">{stats.profileViews}</p>
          <p className="text-[10px] text-green-500 flex items-center gap-0.5 mt-1">
            <TrendingUp size={10} /> +12% 이번 주
          </p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} className="text-gray-400" />
            <span className="text-xs text-gray-500">받은 문의</span>
          </div>
          <p className="text-2xl font-black text-gray-900">{stats.inquiriesThisWeek}</p>
          <p className="text-[10px] text-green-500 flex items-center gap-0.5 mt-1">
            <TrendingUp size={10} /> +5건 이번 주
          </p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle size={14} className="text-gray-400" />
            <span className="text-xs text-gray-500">응답률</span>
          </div>
          <p className="text-2xl font-black text-primary-500">{stats.responseRate}%</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-gray-400" />
            <span className="text-xs text-gray-500">매칭률</span>
          </div>
          <p className="text-2xl font-black text-primary-500">{stats.matchRate}%</p>
        </div>
      </div>

      {/* Upcoming */}
      <div className="px-4 mt-4 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900">다가오는 일정</h3>
          <Link href="/pro-dashboard/schedule" className="text-xs text-primary-500 font-medium flex items-center">
            전체보기 <ChevronRight size={14} />
          </Link>
        </div>
        <div className="space-y-2">
          {[
            { date: '4/05 (토)', event: '웨딩 MC', client: '홍길동', venue: '시에나호텔', status: 'upcoming' },
            { date: '4/12 (토)', event: '돌잔치 MC', client: '이영희', venue: '그랜드하얏트', status: 'upcoming' },
            { date: '4/19 (토)', event: '웨딩 MC', client: '박철수', venue: 'JW메리어트', status: 'upcoming' },
          ].map((item, i) => (
            <div key={i} className="card flex items-center gap-3 p-3">
              <div className="w-12 h-12 bg-primary-50 rounded-xl flex flex-col items-center justify-center shrink-0">
                <span className="text-[10px] text-primary-500 font-bold">{item.date.split(' ')[0]}</span>
                <span className="text-[8px] text-primary-400">{item.date.split(' ')[1]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">{item.event}</p>
                <p className="text-xs text-gray-500">{item.client} · {item.venue}</p>
              </div>
              <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">예정</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
