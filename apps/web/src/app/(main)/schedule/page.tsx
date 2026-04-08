'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Calendar, List, MapPin, Clock } from 'lucide-react';

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
  time: string;
  location: string;
  status: 'confirmed' | 'pending' | 'completed';
}

const MOCK_SCHEDULES: ScheduleItem[] = [
  { id: '1', date: '2026-04-10', title: '결혼식 MC', category: 'MC', proName: '박인애', time: '14:00 - 16:00', location: '그랜드 웨딩홀', status: 'confirmed' },
  { id: '2', date: '2026-04-10', title: '축가 공연', category: '축가', proName: '채안빈', time: '14:30 - 15:00', location: '그랜드 웨딩홀', status: 'confirmed' },
  { id: '3', date: '2026-04-15', title: '웨딩 촬영', category: '스튜디오', proName: '로즈스튜디오', time: '10:00 - 13:00', location: '강남 스튜디오', status: 'pending' },
  { id: '4', date: '2026-04-18', title: '드레스 피팅', category: '드레스', proName: '라벨드레스', time: '15:00 - 17:00', location: '청담 쇼룸', status: 'pending' },
  { id: '5', date: '2026-04-22', title: '헤어 메이크업 리허설', category: '헤메샵', proName: '뷰티살롱', time: '11:00 - 13:00', location: '압구정 살롱', status: 'pending' },
  { id: '6', date: '2026-04-05', title: '웨딩홀 투어', category: '웨딩홀', proName: '더채플앳청담', time: '14:00 - 15:30', location: '청담동', status: 'completed' },
  { id: '7', date: '2026-04-03', title: 'MC 미팅', category: 'MC', proName: '김서현', time: '16:00 - 17:00', location: '카페', status: 'completed' },
  { id: '8', date: '2026-05-01', title: '본식 MC', category: 'MC', proName: '박인애', time: '12:00 - 14:00', location: '그랜드 웨딩홀', status: 'confirmed' },
  { id: '9', date: '2026-05-01', title: '본식 축가', category: '축가', proName: '채안빈', time: '12:30 - 13:00', location: '그랜드 웨딩홀', status: 'confirmed' },
];

const STATUS_MAP = {
  confirmed: { label: '확정', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  pending: { label: '대기', color: 'text-amber-600', bg: 'bg-amber-50' },
  completed: { label: '완료', color: 'text-gray-500', bg: 'bg-gray-100' },
};

function getKoreanHolidays(year: number, month: number): Record<number, string> {
  const holidays: Record<number, string> = {};
  const fixed: Record<string, string> = {
    '1-1': '신정', '3-1': '삼일절', '5-5': '어린이날',
    '6-6': '현충일', '8-15': '광복절', '10-3': '개천절',
    '10-9': '한글날', '12-25': '성탄절',
  };
  Object.entries(fixed).forEach(([key, name]) => {
    const [m, d] = key.split('-').map(Number);
    if (m === month) holidays[d] = name;
  });
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

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevDays = new Date(year, month - 1, 0).getDate();

  const calendarDays = useMemo(() => {
    const days: { day: number; inMonth: boolean; dateStr: string }[] = [];
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevDays - i;
      const m = month - 1 < 1 ? 12 : month - 1;
      const y = month - 1 < 1 ? year - 1 : year;
      days.push({ day: d, inMonth: false, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, inMonth: true, dateStr: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const m = month + 1 > 12 ? 1 : month + 1;
        const y = month + 1 > 12 ? year + 1 : year;
        days.push({ day: d, inMonth: false, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
      }
    }
    return days;
  }, [year, month, firstDay, daysInMonth, prevDays]);

  const schedulesByDate = useMemo(() => {
    const map: Record<string, ScheduleItem[]> = {};
    MOCK_SCHEDULES.forEach(s => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, []);

  const selectedSchedules = selectedDate ? (schedulesByDate[selectedDate] ?? []) : [];

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
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

      {/* Stats Bar */}
      <div className="flex gap-3 px-5 pb-4">
        <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-[20px] font-bold text-gray-900">{monthSchedules.length}</p>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5">전체 일정</p>
        </div>
        <div className="flex-1 bg-emerald-50 rounded-xl p-3 text-center">
          <p className="text-[20px] font-bold text-emerald-600">{confirmedCount}</p>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5">확정</p>
        </div>
        <div className="flex-1 bg-amber-50 rounded-xl p-3 text-center">
          <p className="text-[20px] font-bold text-amber-600">{pendingCount}</p>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5">대기</p>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <>
          {/* Calendar Grid */}
          <div className="px-3">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS_KR.map((d, i) => (
                <div key={d} className={`text-center text-[12px] font-semibold py-2 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
                  {d}
                </div>
              ))}
            </div>

            {/* Date cells */}
            <div className="grid grid-cols-7">
              {calendarDays.map(({ day, inMonth, dateStr }, idx) => {
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const dayOfWeek = idx % 7;
                const items = schedulesByDate[dateStr];
                const holiday = inMonth ? holidays[day] : undefined;

                return (
                  <button
                    key={idx}
                    onClick={() => inMonth && setSelectedDate(dateStr)}
                    className={`relative flex flex-col items-center py-1.5 min-h-[56px] rounded-xl transition-all ${
                      !inMonth ? 'opacity-30' : ''
                    } ${isSelected ? 'bg-gray-900' : isToday ? 'bg-gray-900/5' : 'hover:bg-gray-50'}`}
                  >
                    <span className={`text-[14px] font-semibold leading-none ${
                      isSelected ? 'text-white' :
                      holiday || dayOfWeek === 0 ? 'text-red-400' :
                      dayOfWeek === 6 ? 'text-blue-400' :
                      'text-gray-800'
                    }`}>
                      {day}
                    </span>

                    {holiday && (
                      <span className={`text-[8px] mt-0.5 ${isSelected ? 'text-red-300' : 'text-red-400'}`}>{holiday}</span>
                    )}

                    {/* Schedule dots */}
                    {items && items.length > 0 && (
                      <div className="flex gap-0.5 mt-1">
                        {items.slice(0, 3).map((s, i) => (
                          <span
                            key={i}
                            className="w-[5px] h-[5px] rounded-full"
                            style={{ backgroundColor: isSelected ? '#fff' : (CATEGORY_COLORS[s.category] ?? '#999') }}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Date Detail */}
          <div className="mt-4 border-t border-gray-100">
            <div className="px-5 pt-4 pb-2">
              <h3 className="text-[15px] font-bold text-gray-900">
                {selectedDate ? `${parseInt(selectedDate.split('-')[1])}월 ${parseInt(selectedDate.split('-')[2])}일 일정` : '날짜를 선택하세요'}
              </h3>
            </div>

            {selectedSchedules.length > 0 ? (
              <div className="px-5 pb-6 space-y-3">
                {selectedSchedules.map(s => {
                  const status = STATUS_MAP[s.status];
                  return (
                    <div
                      key={s.id}
                      className="flex gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-100"
                    >
                      <div
                        className="w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[s.category] ?? '#999' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[13px] font-bold text-gray-900">{s.title}</span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${status.color} ${status.bg}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="text-[13px] text-gray-500 font-medium mb-1.5">{s.proName}</p>
                        <div className="flex items-center gap-3 text-[12px] text-gray-400">
                          <span className="flex items-center gap-1"><Clock size={12} />{s.time}</span>
                          <span className="flex items-center gap-1"><MapPin size={12} />{s.location}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-10 text-gray-400">
                <Calendar size={32} className="mb-3 text-gray-300" />
                <p className="text-[14px]">이 날에는 일정이 없습니다</p>
              </div>
            )}
          </div>
        </>
      ) : (
        /* List View */
        <div className="px-5 pb-6">
          {monthSchedules.length > 0 ? (
            <div className="space-y-3">
              {monthSchedules.map((s, i) => {
                const status = STATUS_MAP[s.status];
                const dateObj = new Date(s.date);
                const dayLabel = `${dateObj.getMonth() + 1}/${dateObj.getDate()} (${DAYS_KR[dateObj.getDay()]})`;
                const showDateHeader = i === 0 || monthSchedules[i - 1].date !== s.date;

                return (
                  <div key={s.id}>
                    {showDateHeader && (
                      <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mt-4 mb-2 first:mt-0">
                        {dayLabel}
                      </p>
                    )}
                    <div className="flex gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                      <div
                        className="w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[s.category] ?? '#999' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[13px] font-bold text-gray-900">{s.title}</span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${status.color} ${status.bg}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="text-[13px] text-gray-500 font-medium mb-1.5">{s.proName}</p>
                        <div className="flex items-center gap-3 text-[12px] text-gray-400">
                          <span className="flex items-center gap-1"><Clock size={12} />{s.time}</span>
                          <span className="flex items-center gap-1"><MapPin size={12} />{s.location}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <Calendar size={32} className="mb-3 text-gray-300" />
              <p className="text-[14px]">이번 달 일정이 없습니다</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
