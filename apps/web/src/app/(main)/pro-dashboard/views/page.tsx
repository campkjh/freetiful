'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

/* ─── Icons ─── */

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

/* ─── Data ─── */

const DAILY_VIEWS = [
  { day: '월', views: 42 },
  { day: '화', views: 58 },
  { day: '수', views: 35 },
  { day: '목', views: 67 },
  { day: '금', views: 51 },
  { day: '토', views: 45 },
  { day: '일', views: 30 },
];

const KEYWORDS = [
  { keyword: '웨딩 MC', count: 89, change: '+12' },
  { keyword: '결혼식 사회자', count: 64, change: '+5' },
  { keyword: 'MC 추천', count: 47, change: '+8' },
  { keyword: '돌잔치 MC', count: 38, change: '-2' },
  { keyword: '행사 MC 서울', count: 31, change: '+15' },
  { keyword: '프리미엄 MC', count: 24, change: '+3' },
  { keyword: '기업행사 사회자', count: 19, change: '+1' },
];

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function ViewsPage() {
  const totalViews = 328;
  const uniqueVisitors = 246;
  const maxViews = Math.max(...DAILY_VIEWS.map((d) => d.views));

  return (
    <div className="bg-gray-50 min-h-screen pb-28">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="px-4 pt-12 pb-3 flex items-center gap-3">
          <Link href="/pro-dashboard">
            <motion.div whileTap={{ scale: 0.9 }}><BackIcon /></motion.div>
          </Link>
          <h1 className="text-lg font-bold text-gray-900">프로필 조회 분석</h1>
        </div>
      </div>

      {/* Summary Stats */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="px-4 mt-5 grid grid-cols-2 gap-3">
        <motion.div variants={fadeUp} className="bg-white rounded-2xl p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center mb-2">
            <EyeIcon />
          </div>
          <p className="text-[11px] text-gray-400 font-medium">총 조회수</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-xl font-bold text-gray-900">{totalViews}</p>
            <TrendUpIcon />
          </div>
          <p className="text-[10px] text-green-500 font-bold mt-0.5">+18% 전월 대비</p>
        </motion.div>
        <motion.div variants={fadeUp} className="bg-white rounded-2xl p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-2">
            <UsersIcon />
          </div>
          <p className="text-[11px] text-gray-400 font-medium">순 방문자</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-xl font-bold text-gray-900">{uniqueVisitors}</p>
          </div>
          <p className="text-[10px] text-gray-400 font-medium mt-0.5">이번 달 기준</p>
        </motion.div>
      </motion.div>

      {/* Daily View Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="px-4 mt-8"
      >
        <h2 className="text-base font-bold text-gray-900 mb-4">최근 7일 조회수</h2>
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="flex items-end gap-3 h-32">
            {DAILY_VIEWS.map((d, i) => {
              const isMax = d.views === maxViews;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-gray-500">{d.views}</span>
                  <div className="w-full flex items-end" style={{ height: '80px' }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(d.views / maxViews) * 100}%` }}
                      transition={{ delay: 0.4 + i * 0.08, duration: 0.5, ease: 'easeOut' }}
                      className={`w-full rounded-t-lg ${isMax ? 'bg-[#7C3AED]' : 'bg-purple-100'}`}
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
      </motion.div>

      {/* Keywords */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="px-4 mt-8"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 flex items-center justify-center"><SearchIcon /></div>
          <h2 className="text-base font-bold text-gray-900">유입 검색어</h2>
        </div>

        <motion.div variants={stagger} initial="hidden" animate="show">
          {KEYWORDS.map((kw, idx) => (
            <motion.div
              key={kw.keyword}
              variants={fadeUp}
              className={`py-3 flex items-center justify-between ${idx < KEYWORDS.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-300 w-5 text-center">{idx + 1}</span>
                <span className="text-sm font-medium text-gray-900">{kw.keyword}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{kw.count}회</span>
                <span className={`text-[11px] font-bold ${kw.change.startsWith('+') ? 'text-green-500' : 'text-red-400'}`}>
                  {kw.change}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
