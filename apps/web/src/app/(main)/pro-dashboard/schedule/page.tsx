'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { scheduleApi } from '@/lib/api/schedule.api';

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-white text-gray-900',
  booked: 'bg-primary-100 text-primary-700',
  unavailable: 'bg-gray-200 text-gray-400',
};

type DateStatus = 'available' | 'booked' | 'unavailable';

export default function SchedulePage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(now.getFullYear(), now.getMonth()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateStatuses, setDateStatuses] = useState<Record<string, DateStatus>>({});
  const [bookedInfo, setBookedInfo] = useState<Record<string, { event: string; client: string }>>({});

  // 월 변경 또는 인증 상태 변경 시 실제 스케줄 조회
  useEffect(() => {
    if (!authUser) return;
    const y = currentMonth.getFullYear();
    const m = String(currentMonth.getMonth() + 1).padStart(2, '0');
    scheduleApi.getMySchedule(`${y}-${m}`)
      .then((data: any) => {
        if (!Array.isArray(data)) return;
        const statuses: Record<string, DateStatus> = {};
        const info: Record<string, { event: string; client: string }> = {};
        data.forEach((s: any) => {
          const dateKey = typeof s.date === 'string' ? s.date.slice(0, 10) : new Date(s.date).toISOString().slice(0, 10);
          if (s.status === 'booked' || s.status === 'completed' || s.status === 'pending') {
            statuses[dateKey] = 'booked';
            info[dateKey] = {
              event: s.eventTitle || s.title || '예약된 행사',
              client: s.clientName || '고객',
            };
          } else if (s.status === 'unavailable') {
            statuses[dateKey] = 'unavailable';
          }
        });
        setDateStatuses(statuses);
        setBookedInfo(info);
      })
      .catch(() => {});
  }, [authUser, currentMonth]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const getDateKey = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const toggleBlock = (dateKey: string) => {
    setDateStatuses((prev) => {
      const current = prev[dateKey];
      if (current === 'booked') return prev;
      if (current === 'unavailable') {
        const next = { ...prev };
        delete next[dateKey];
        return next;
      }
      return { ...prev, [dateKey]: 'unavailable' };
    });
  };

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1));

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white px-4 pt-12 pb-4 sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1"><ArrowLeft size={22} /></button>
          <h1 className="text-lg font-bold">일정 관리</h1>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-1"><ChevronLeft size={20} className="text-gray-600" /></button>
          <p className="text-base font-bold text-gray-900">{year}년 {month + 1}월</p>
          <button onClick={nextMonth} className="p-1"><ChevronRight size={20} className="text-gray-600" /></button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
            <div key={d} className={`text-center text-[10px] font-bold py-1 ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
            }`}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            if (d === null) return <div key={i} />;
            const dateKey = getDateKey(d);
            const status = dateStatuses[dateKey] || 'available';
            const isPast = dateKey < today;
            const isSelected = dateKey === selectedDate;

            return (
              <button
                key={i}
                onClick={() => {
                  setSelectedDate(dateKey);
                  if (!isPast && status !== 'booked') toggleBlock(dateKey);
                }}
                disabled={isPast}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-medium transition-all relative ${
                  isSelected ? 'ring-2 ring-primary-500' : ''
                } ${isPast ? 'opacity-30 cursor-not-allowed' : ''} ${STATUS_COLORS[status]}`}
              >
                {d}
                {status === 'booked' && <span className="w-1.5 h-1.5 bg-primary-500 rounded-full mt-0.5" />}
                {status === 'unavailable' && <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-0.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-3 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-primary-500 rounded-full" />
          <span className="text-[10px] text-gray-500">예약됨</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-gray-400 rounded-full" />
          <span className="text-[10px] text-gray-500">차단됨</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-white border border-gray-200 rounded-full" />
          <span className="text-[10px] text-gray-500">가능</span>
        </div>
      </div>

      {/* Selected Date Info */}
      {selectedDate && (
        <div className="px-4 py-3">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-gray-900">{selectedDate}</p>
              <button onClick={() => setSelectedDate(null)}><X size={16} className="text-gray-400" /></button>
            </div>
            {dateStatuses[selectedDate] === 'booked' && bookedInfo[selectedDate] ? (
              <div className="bg-primary-50 rounded-xl p-3">
                <p className="text-xs font-bold text-primary-600">{bookedInfo[selectedDate].event}</p>
                <p className="text-xs text-primary-500 mt-0.5">고객: {bookedInfo[selectedDate].client}</p>
              </div>
            ) : dateStatuses[selectedDate] === 'unavailable' ? (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">이 날짜는 차단되어 있습니다</p>
                <button
                  onClick={() => toggleBlock(selectedDate)}
                  className="text-xs text-primary-500 font-bold mt-1"
                >
                  차단 해제하기
                </button>
              </div>
            ) : (
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-xs text-green-600">예약 가능한 날짜입니다</p>
                <button
                  onClick={() => toggleBlock(selectedDate)}
                  className="text-xs text-red-500 font-bold mt-1"
                >
                  이 날짜 차단하기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
