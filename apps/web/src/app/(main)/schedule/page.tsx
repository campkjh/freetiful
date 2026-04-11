'use client';

import { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Calendar, List, MapPin, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];

const CATEGORY_COLORS: Record<string, string> = {
  'MC': '#3B82F6',
  '축가': '#22C55E',
  '쇼호스트': '#EF4444',
  '웨딩홀': '#F59E0B',
  '스튜디오': '#8B5CF6',
  '헤메샵': '#EC4899',
  '드레스': '#06B6D4',
  '기타': '#F97316',
};

interface ScheduleItem {
  id: string;
  date: string;
  title: string;
  category: string;
  proName: string;
  proImage: string;
  time: string;
  location: string;
  status: 'confirmed' | 'pending' | 'completed';
}

const MOCK_SCHEDULES: ScheduleItem[] = [
  { id: '1', date: '2026-04-10', title: '결혼식 MC', category: 'MC', proName: '박인애', proImage: '/images/박인애/IMG_0196.avif', time: '14:00 - 16:00', location: '그랜드 웨딩홀', status: 'confirmed' },
  { id: '2', date: '2026-04-10', title: '축가 공연', category: '축가', proName: '성연채', proImage: '/images/이승진/IMG_46511771924269213.avif', time: '14:30 - 15:00', location: '그랜드 웨딩홀', status: 'confirmed' },
  { id: '3', date: '2026-04-15', title: '웨딩 촬영', category: '스튜디오', proName: '조하늘', proImage: '/images/전해별/IMG_73341772850094485.avif', time: '10:00 - 13:00', location: '강남 스튜디오', status: 'pending' },
  { id: '4', date: '2026-04-18', title: '드레스 피팅', category: '드레스', proName: '김진아', proImage: '/images/박인애/IMG_0196.avif0', time: '15:00 - 17:00', location: '청담 쇼룸', status: 'pending' },
  { id: '5', date: '2026-04-22', title: '헤어 메이크업 리허설', category: '헤메샵', proName: '유하영', proImage: '/images/김동현/10000365351773046135169.avif0', time: '11:00 - 13:00', location: '압구정 살롱', status: 'pending' },
  { id: '6', date: '2026-04-05', title: '웨딩홀 투어', category: '웨딩홀', proName: '함현지', proImage: '/images/박인애/IMG_0196.avif2', time: '14:00 - 15:30', location: '청담동', status: 'completed' },
  { id: '7', date: '2026-04-03', title: 'MC 미팅', category: 'MC', proName: '문정은', proImage: '/images/박인애/IMG_0196.avif5', time: '16:00 - 17:00', location: '카페', status: 'completed' },
  { id: '8', date: '2026-05-01', title: '본식 MC', category: 'MC', proName: '박인애', proImage: '/images/박인애/IMG_0196.avif', time: '12:00 - 14:00', location: '그랜드 웨딩홀', status: 'confirmed' },
  { id: '9', date: '2026-05-01', title: '본식 축가', category: '축가', proName: '성연채', proImage: '/images/이승진/IMG_46511771924269213.avif', time: '12:30 - 13:00', location: '그랜드 웨딩홀', status: 'confirmed' },
];

const STATUS_MAP = {
  confirmed: { label: '확정', color: 'text-blue-600', bg: 'bg-blue-50' },
  pending: { label: '대기', color: 'text-amber-600', bg: 'bg-amber-50' },
  completed: { label: '완료', color: 'text-gray-500', bg: 'bg-gray-100' },
};

function getKoreanHolidays(year: number, month: number): Record<number, string> {
  const holidays: Record<number, string> = {};
  // 고정 공휴일
  const fixed: Record<string, string> = {
    '1-1': '신정', '3-1': '삼일절', '5-5': '어린이날',
    '6-6': '현충일', '8-15': '광복절', '10-3': '개천절',
    '10-9': '한글날', '12-25': '크리스마스',
  };
  Object.entries(fixed).forEach(([key, name]) => {
    const [m, d] = key.split('-').map(Number);
    if (m === month) holidays[d] = name;
  });
  // 음력 기반 공휴일 (설날/추석/석가탄신일/대체공휴일)
  const lunar: Record<string, Record<string, string>> = {
    '2025': {
      '1-28': '설날', '1-29': '설날', '1-30': '설날',
      '5-6': '대체공휴일', '6-4': '석가탄신일',
      '10-5': '추석', '10-6': '추석', '10-7': '추석', '10-8': '대체공휴일',
    },
    '2026': {
      '2-16': '설날', '2-17': '설날', '2-18': '설날',
      '5-24': '석가탄신일',
      '9-23': '추석', '9-24': '추석', '9-25': '추석',
    },
    '2027': {
      '2-6': '설날', '2-7': '설날', '2-8': '설날',
      '5-13': '석가탄신일',
      '10-11': '추석', '10-12': '추석', '10-13': '추석',
    },
  };
  const yearLunar = lunar[String(year)];
  if (yearLunar) {
    Object.entries(yearLunar).forEach(([key, name]) => {
      const [m, d] = key.split('-').map(Number);
      if (m === month) holidays[d] = name;
    });
  }
  return holidays;
}

export default function SchedulePage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  );
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const holidays = useMemo(() => getKoreanHolidays(year, month), [year, month]);

  const daysInMonth = new Date(year, month, 0).getDate();

  const allDays = useMemo(() => {
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const days: { day: number; dateStr: string; dayOfWeek: string; isToday: boolean; isPast: boolean; isHoliday: boolean; holidayName: string }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d, dateStr, dayOfWeek: DAYS_KR[date.getDay()],
        isToday: dateStr === todayStr,
        isPast: date < new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        isHoliday: !!holidays[d], holidayName: holidays[d] || '',
      });
    }
    return days;
  }, [year, month, daysInMonth, holidays, today]);

  // 7일 주 단위 스와이프
  const [slideDirection, setSlideDirection] = useState(0); // -1 = left, 1 = right
  const [weekOffset, setWeekOffset] = useState(0);
  const todayIdx = allDays.findIndex((d) => d.isToday);
  const baseIdx = month === today.getMonth() + 1 && year === today.getFullYear() ? Math.max(0, todayIdx) : 0;
  const weekStart = baseIdx + weekOffset * 7;
  const visibleDays = allDays.slice(weekStart, weekStart + 7);
  const totalWeeks = Math.ceil((allDays.length - baseIdx) / 7);
  const hasNextWeek = weekStart + 7 < allDays.length;
  const hasPrevWeek = weekOffset > 0;

  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50 && hasNextWeek) { setSlideDirection(1); setWeekOffset((p) => p + 1); }
    if (diff < -50 && hasPrevWeek) { setSlideDirection(-1); setWeekOffset((p) => p - 1); }
  };

  const schedulesByDate = useMemo(() => {
    const map: Record<string, ScheduleItem[]> = {};
    MOCK_SCHEDULES.forEach(s => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, []);

  const selectedSchedules = selectedDate ? (schedulesByDate[selectedDate] ?? []) : [];

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setWeekOffset(0);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setWeekOffset(0);
  };

  // List view: all schedules for current month sorted
  const monthSchedules = useMemo(() => {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return MOCK_SCHEDULES
      .filter(s => s.date.startsWith(prefix))
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  }, [year, month]);

  // Stats
  const confirmedCount = monthSchedules.filter(s => s.status === 'confirmed').length;
  const pendingCount = monthSchedules.filter(s => s.status === 'pending').length;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="text-[18px] font-bold text-gray-900">내 스케줄</h1>
          <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-full transition-colors ${viewMode === 'calendar' ? 'bg-white shadow-sm' : ''}`}
            >
              <Calendar size={18} className={viewMode === 'calendar' ? 'text-gray-900' : 'text-gray-400'} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-full transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
            >
              <List size={18} className={viewMode === 'list' ? 'text-gray-900' : 'text-gray-400'} />
            </button>
          </div>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between px-5 py-4">
        <button onClick={prevMonth} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <h2 className="text-[17px] font-bold text-gray-900">{year}년 {month}월</h2>
        <button onClick={nextMonth} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
          <ChevronRight size={20} className="text-gray-600" />
        </button>
      </div>

      {viewMode === 'calendar' ? (
        <>
          {/* Weekly Day Picker (swipeable) */}
          <div
            className="px-4 border-b border-gray-100 py-3 overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <AnimatePresence mode="wait" initial={false} custom={slideDirection}>
              <motion.div
                key={weekOffset}
                custom={slideDirection}
                initial={{ x: slideDirection * 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: slideDirection * -300, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="grid grid-cols-7 text-center gap-y-1"
              >
                {/* Day of week header */}
                {visibleDays.map((d, i) => (
                  <span
                    key={`dow-${i}`}
                    className={`text-[12px] font-medium ${d.dayOfWeek === '일' || d.isHoliday ? 'text-red-400' : d.dayOfWeek === '토' ? 'text-blue-400' : 'text-gray-400'}`}
                  >
                    {d.dayOfWeek}
                  </span>
                ))}
                {/* Day numbers */}
                {visibleDays.map((d, i) => {
                  const isSelected = d.dateStr === selectedDate;
                  const isRed = d.dayOfWeek === '일' || d.isHoliday;
                  const isSat = d.dayOfWeek === '토';
                  const items = schedulesByDate[d.dateStr];
                  return (
                    <button
                      key={`day-${i}`}
                      onClick={() => setSelectedDate(d.dateStr)}
                      className="flex flex-col items-center"
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-[18px] font-bold transition-all ${
                          isSelected
                            ? 'bg-[#2B313D] text-white'
                            : d.isPast
                            ? 'text-gray-200'
                            : isRed
                            ? 'text-red-400'
                            : isSat
                            ? 'text-blue-400'
                            : 'text-gray-900'
                        }`}
                      >
                        {d.day}
                      </div>
                      {d.isHoliday && !d.isToday && <span className="text-[9px] text-red-400 mt-0.5 truncate max-w-[40px]">{d.holidayName}</span>}
                      {d.isToday && !d.isHoliday && <span className="text-[10px] text-gray-400 mt-0.5">오늘</span>}
                      {d.isToday && d.isHoliday && <span className="text-[9px] text-red-400 mt-0.5 truncate max-w-[40px]">{d.holidayName}</span>}
                      {!d.isToday && !d.isHoliday && items && items.length > 0 && (
                        <div className="flex gap-0.5 mt-0.5">
                          {items.slice(0, 3).map((s, j) => (
                            <span
                              key={j}
                              className="w-[5px] h-[5px] rounded-full"
                              style={{ backgroundColor: CATEGORY_COLORS[s.category] ?? '#999' }}
                            />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
            {/* 스와이프 인디케이터 */}
            <div className="flex justify-center gap-1 mt-2">
              {Array.from({ length: totalWeeks }, (_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === weekOffset ? 'bg-gray-800' : 'bg-gray-200'}`} />
              ))}
            </div>
          </div>

          {/* Selected Date Detail */}
          <div className="min-h-[200px]">
            {selectedSchedules.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {selectedSchedules.map(s => {
                  const status = STATUS_MAP[s.status];
                  const dateObj = new Date(s.date);
                  const dateLabel = `${String(dateObj.getFullYear()).slice(2)}. ${dateObj.getMonth() + 1}. ${dateObj.getDate()} (${DAYS_KR[dateObj.getDay()]})`;
                  return (
                    <div key={s.id} className="bg-white px-5 py-3">
                      {/* 1줄: 프로필 이미지 + 프로이름 */}
                      <div className="flex items-start gap-3">
                        <img
                          src={s.proImage}
                          alt={s.proName}
                          className="w-[48px] h-[64px] rounded-lg object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[18px] font-bold text-gray-900">{s.category} {s.proName}</span>
                            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${status.bg} ${status.color}`}>{status.label}</span>
                          </div>
                          <p className="text-[13px] text-gray-400 mt-0.5">{dateLabel}</p>
                          {/* 시간/장소 태그 */}
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-[12px] font-medium text-gray-700" style={{ borderRadius: 8 }}>
                              <Clock size={12} className="text-gray-400" />{s.time}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-[12px] font-medium text-gray-700" style={{ borderRadius: 8 }}>
                              <MapPin size={12} className="text-gray-400" />{s.location}
                            </span>
                          </div>
                          {/* 하단 버튼 */}
                          <div className="mt-2">
                            <Link href={`/schedule/${s.id}`} className="block w-full py-2.5 text-[14px] text-white font-bold text-center" style={{ backgroundColor: '#2B313D', borderRadius: 12 }}>
                              예약 상세보기
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-14 text-gray-400">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mb-3">
                  <rect x="3" y="4" width="18" height="18" rx="3" fill="#E5E7EB"/>
                  <rect x="3" y="4" width="18" height="7" rx="3" fill="#9CA3AF"/>
                  <rect x="7" y="2" width="2.5" height="4" rx="1.25" fill="#D1D5DB"/>
                  <rect x="14.5" y="2" width="2.5" height="4" rx="1.25" fill="#D1D5DB"/>
                  <path d="M9 15l2 2 4-4" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p className="text-[14px]">이 날에는 일정이 없습니다</p>
              </div>
            )}
          </div>
        </>
      ) : (
        /* List View */
        <div className="min-h-[200px]">
          {monthSchedules.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {monthSchedules.map(s => {
                const status = STATUS_MAP[s.status];
                const dateObj = new Date(s.date);
                const dateLabel = `${String(dateObj.getFullYear()).slice(2)}. ${dateObj.getMonth() + 1}. ${dateObj.getDate()} (${DAYS_KR[dateObj.getDay()]})`;

                return (
                  <div key={s.id} className="bg-white px-5 py-3">
                    <div className="flex items-start gap-3">
                      <img
                        src={s.proImage}
                        alt={s.proName}
                        className="w-[48px] h-[64px] rounded-lg object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[18px] font-bold text-gray-900">{s.category} {s.proName}</span>
                          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${status.bg} ${status.color}`}>{status.label}</span>
                        </div>
                        <p className="text-[13px] text-gray-400 mt-0.5">{dateLabel}</p>
                      </div>
                    </div>

                    <div className="mt-2 pl-[60px] flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-[12px] font-medium text-gray-700" style={{ borderRadius: 8 }}>
                        <Clock size={12} className="text-gray-400" />{s.time}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-[12px] font-medium text-gray-700" style={{ borderRadius: 8 }}>
                        <MapPin size={12} className="text-gray-400" />{s.location}
                      </span>
                    </div>

                    <div className="mt-2.5 pl-[60px]">
                      <Link href={`/schedule/${s.id}`} className="block w-full py-2.5 text-[14px] text-white font-bold text-center" style={{ backgroundColor: '#2B313D', borderRadius: 12 }}>
                        예약 상세보기
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mb-3">
                <rect x="3" y="4" width="18" height="18" rx="3" fill="#E5E7EB"/>
                <rect x="3" y="4" width="18" height="7" rx="3" fill="#9CA3AF"/>
                <rect x="7" y="2" width="2.5" height="4" rx="1.25" fill="#D1D5DB"/>
                <rect x="14.5" y="2" width="2.5" height="4" rx="1.25" fill="#D1D5DB"/>
                <path d="M9 15l2 2 4-4" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-[14px]">이번 달 일정이 없습니다</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
