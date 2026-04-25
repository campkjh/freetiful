'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Calendar, List, MapPin, Clock } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { apiClient } from '@/lib/api/client';
import { scheduleApi } from '@/lib/api/schedule.api';

const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];

const CATEGORY_COLORS: Record<string, string> = {
  'MC': '#3B82F6',
  '축가': '#22C55E',
  '쇼호스트': '#EF4444',
  '웨딩홀': '#F59E0B',
  '스튜디오': '#8B5CF6',
  '헤어': '#EC4899',
  '메이크업': '#F472B6',
  '드레스': '#06B6D4',
  '피부과': '#14B8A6',
  '스냅': '#A78BFA',
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
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled';
}

const SCHEDULE_CACHE_PREFIX = 'freetiful-schedule-cache-v1:';
const SCHEDULE_CACHE_TTL = 2 * 60_000;

function readScheduleCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SCHEDULE_CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || Date.now() - parsed.ts > SCHEDULE_CACHE_TTL) {
      localStorage.removeItem(SCHEDULE_CACHE_PREFIX + key);
      return null;
    }
    return parsed.data as T;
  } catch {
    return null;
  }
}

function writeScheduleCache(key: string, data: any) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SCHEDULE_CACHE_PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

function mapPaymentsToSchedules(data: any[]): ScheduleItem[] {
  const mapped: ScheduleItem[] = [];
  data.forEach((p: any) => {
    if (p.status === 'refunded') return;
    const qs = Array.isArray(p.quotations) ? p.quotations : (p.quotation ? [p.quotation] : []);

    if (qs.length === 0) {
      const dateStr = new Date(p.createdAt).toISOString().slice(0, 10);
      mapped.push({
        id: p.id,
        date: dateStr,
        title: p.description || '결제 완료',
        category: 'MC',
        proName: '',
        proImage: '',
        time: '',
        location: '',
        status: p.status === 'completed' ? 'confirmed' : 'pending',
      });
      return;
    }

    qs.forEach((q: any) => {
      const proUser = q.proProfile?.user || {};
      const proImg = q.proProfile?.images?.[0]?.imageUrl || proUser.profileImageUrl || '';
      const eventDate = q.eventDate || p.createdAt;
      const dateStr = new Date(eventDate).toISOString().slice(0, 10);
      const eventDateObj = new Date(eventDate);
      const now = new Date();
      const status: ScheduleItem['status'] =
        p.status === 'completed' && eventDateObj < now ? 'completed'
        : p.status === 'completed' ? 'confirmed'
        : 'pending';
      mapped.push({
        id: `${p.id}__${q.id}`,
        date: dateStr,
        title: q.title || p.description || '행사',
        category: q.category || q.proProfile?.categories?.[0]?.category?.name || '사회자',
        proName: proUser.name || '',
        proImage: proImg,
        time: q.eventTime ? new Date(q.eventTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '',
        location: q.eventLocation || '',
        status,
      });
    });
  });
  return mapped;
}

// 실제 스케줄은 API 응답(apiSchedules)으로 채워집니다. 목업 데이터 제거됨.

const STATUS_MAP = {
  confirmed: { label: '확정', color: 'text-blue-600', bg: 'bg-blue-50' },
  pending: { label: '대기', color: 'text-amber-600', bg: 'bg-amber-50' },
  completed: { label: '완료', color: 'text-gray-500', bg: 'bg-gray-100' },
  cancelled: { label: '취소', color: 'text-red-500', bg: 'bg-red-50' },
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

/* ─── Pro (사회자) Mock Data ─── */
interface ProBooking {
  id: string;
  paymentId: string | null;
  clientName: string;
  eventType: string;
  date: string;
  time: string;
  venue: string;
  plan: string;
  paymentStatus: '결제완료' | '대기';
  amount: string;
  status: 'confirmed' | 'pending' | 'completed';
}


const PRO_STATUS_MAP = {
  confirmed: { label: '확정', textColor: 'text-green-700', bgColor: 'bg-green-50' },
  pending: { label: '대기', textColor: 'text-amber-700', bgColor: 'bg-amber-50' },
  completed: { label: '완료', textColor: 'text-gray-500', bgColor: 'bg-gray-100' },
};

/* ─── Pro SVG Icons ─── */
const ProIconCalendar = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="18" rx="3" fill="#3B82F6"/>
    <rect x="3" y="4" width="18" height="7" rx="3" fill="#2563EB"/>
    <rect x="7" y="2" width="2.5" height="4" rx="1.25" fill="#93C5FD"/>
    <rect x="14.5" y="2" width="2.5" height="4" rx="1.25" fill="#93C5FD"/>
  </svg>
);
const ProIconClock = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#E5E7EB"/>
    <path d="M12 7v5l3.5 3.5" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const ProIconPin = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EF4444"/>
    <circle cx="12" cy="9" r="2.5" fill="white"/>
  </svg>
);
const ProIconWon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#10B981"/>
    <text x="12" y="16" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="system-ui">₩</text>
  </svg>
);

function ProScheduleView() {
  const authUser = useAuthStore((s) => s.user);
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [apiBookings, setApiBookings] = useState<ProBooking[]>(() => readScheduleCache<ProBooking[]>(`pro:${month}`) || []);
  useEffect(() => {
    if (!authUser) return;
    scheduleApi.getMySchedule(month)
      .then((data) => {
        if (!Array.isArray(data)) return;
        // booked/completed/pending 등 실제 상태의 스케줄만
        const rows = data.filter((b: any) => ['booked', 'pending', 'completed'].includes(b.status));
        const mapped: ProBooking[] = rows.map((b: any) => {
          let uiStatus: ProBooking['status'] = 'pending';
          if (b.status === 'booked') uiStatus = 'confirmed';
          else if (b.status === 'completed') uiStatus = 'completed';
          else uiStatus = 'pending';
          const timeStr = b.eventTime ? new Date(b.eventTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';
          return {
            id: b.id || b.date,
            paymentId: b.paymentId || null,
            clientName: b.clientName || '',
            eventType: b.eventTitle || '행사',
            date: b.date,
            time: timeStr,
            venue: b.eventLocation || '',
            plan: b.eventTitle || '',
            paymentStatus: b.paymentStatus === 'completed' ? '결제완료' : '대기',
            amount: b.amount ? Number(b.amount).toLocaleString() : '0',
            status: uiStatus,
          };
        });
        setApiBookings(mapped);
        writeScheduleCache(`pro:${month}`, mapped);
      })
      .catch(() => setApiBookings([]));
  }, [authUser, month]);
  const bookings = apiBookings;
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="text-[18px] font-bold text-gray-900">예약 관리</h1>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">PRO</span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="px-4 py-4">
        <div className="flex gap-2">
          {[
            { label: '확정', count: bookings.filter(b => b.status === 'confirmed').length, color: '#22C55E' },
            { label: '대기', count: bookings.filter(b => b.status === 'pending').length, color: '#F59E0B' },
            { label: '완료', count: bookings.filter(b => b.status === 'completed').length, color: '#9CA3AF' },
          ].map(s => (
            <div key={s.label} className="flex-1 bg-gray-50 rounded-xl py-3 text-center">
              <p className="text-[20px] font-bold" style={{ color: s.color }}>{s.count}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Section Title */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-2">
          <ProIconCalendar />
          <h2 className="text-[16px] font-bold text-gray-900">예약된 행사</h2>
        </div>
      </div>

      {/* Booking Cards */}
      <div className="px-4 space-y-3 pb-24">
        {bookings.length === 0 && (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mb-3">
              <rect x="3" y="4" width="18" height="18" rx="3" fill="#E5E7EB"/>
              <rect x="3" y="4" width="18" height="7" rx="3" fill="#9CA3AF"/>
              <rect x="7" y="2" width="2.5" height="4" rx="1.25" fill="#D1D5DB"/>
              <rect x="14.5" y="2" width="2.5" height="4" rx="1.25" fill="#D1D5DB"/>
            </svg>
            <p className="text-[14px]">예약된 행사가 없습니다</p>
          </div>
        )}
        {bookings.map(booking => {
          const status = PRO_STATUS_MAP[booking.status];
          const dateObj = new Date(booking.date);
          const dateLabel = `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 (${DAYS_KR[dateObj.getDay()]})`;
          return (
            <div key={booking.id} className="bg-white border border-gray-100 rounded-2xl p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              {/* Top: Client + Status */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="8" r="4" fill="#9CA3AF"/>
                      <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" fill="#9CA3AF"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-gray-900">{booking.clientName}</p>
                    <p className="text-[12px] text-gray-400">{booking.eventType}</p>
                  </div>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${status.bgColor} ${status.textColor}`}>
                  {status.label}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-1.5 mb-3">
                <div className="flex items-center gap-2 text-[13px] text-gray-600">
                  <ProIconCalendar /><span className="text-[12px]">{dateLabel}</span>
                </div>
                <div className="flex items-center gap-2 text-[13px] text-gray-600">
                  <ProIconClock /><span className="text-[12px]">{booking.time}</span>
                </div>
                <div className="flex items-center gap-2 text-[13px] text-gray-600">
                  <ProIconPin /><span className="text-[12px]">{booking.venue}</span>
                </div>
              </div>

              {/* Plan + Payment */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">{booking.plan}</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${booking.paymentStatus === '결제완료' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                  {booking.paymentStatus}
                </span>
                <div className="flex items-center gap-1 ml-auto">
                  <ProIconWon />
                  <span className="text-[13px] font-bold text-gray-900">{booking.amount}원</span>
                </div>
              </div>

              {/* Action */}
              <Link href={`/schedule/${booking.paymentId || booking.id}`} className="block w-full py-2.5 text-[14px] text-white font-bold text-center" style={{ backgroundColor: '#2B313D', borderRadius: 12 }}>
                상세보기
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const authUser = useAuthStore((s) => s.user);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const today = new Date();
  const initialMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [apiSchedules, setApiSchedules] = useState<ScheduleItem[]>(() => readScheduleCache<ScheduleItem[]>(`user:${initialMonthKey}`) || []);
  useEffect(() => {
    setIsLoggedIn(authUser !== null);
    setIsPro(authUser?.role === 'pro');
  }, [authUser]);

  // Fetch schedule from API when authenticated
  // 페이지 재진입 시에도 최신 데이터 반영되도록 visibility 기반 refetch 도 지원
  useEffect(() => {
    if (!authUser) return;
    if (authUser.role === 'pro') return;
    let cancelled = false;

    const fetchGeneralSchedules = () => {
      apiClient.get('/api/v1/payment', { params: { limit: 100 } })
        .then((res: any) => {
          const data = res.data?.data || [];
          if (!Array.isArray(data)) return;
          const mapped = mapPaymentsToSchedules(data);
          if (cancelled) return;
          setApiSchedules(mapped);
          writeScheduleCache(`user:${initialMonthKey}`, mapped);
        })
        .catch((err) => { console.error('[Schedule] payment API error:', err); });
    };

    fetchGeneralSchedules();

    // 탭 복귀/포커스 시 자동 재조회 (결제 직후 다른 탭에서 돌아와도 즉시 반영)
    const onVis = () => { if (document.visibilityState === 'visible') fetchGeneralSchedules(); };
    window.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', fetchGeneralSchedules);
    return () => {
      cancelled = true;
      window.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', fetchGeneralSchedules);
    };
  }, [authUser, initialMonthKey]);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  );
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const holidays = useMemo(() => getKoreanHolidays(year, month), [year, month]);

  const daysInMonth = new Date(year, month, 0).getDate();

  type DayCell = { day: number; dateStr: string; dayOfWeek: string; isToday: boolean; isPast: boolean; isHoliday: boolean; holidayName: string } | null;

  // 월의 첫 요일로 맞춘 7×N 캘린더 주 배열
  const calendarWeeks = useMemo<DayCell[][]>(() => {
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=일 ~ 6=토
    const cells: DayCell[] = [];
    // 앞쪽 빈 셀
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    // 해당 월 날짜
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        day: d, dateStr, dayOfWeek: DAYS_KR[date.getDay()],
        isToday: dateStr === todayStr,
        isPast: date < new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        isHoliday: !!holidays[d], holidayName: holidays[d] || '',
      });
    }
    // 뒤쪽 빈 셀 (7의 배수 맞추기)
    while (cells.length % 7 !== 0) cells.push(null);
    // 주 단위로 분할
    const weeks: DayCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [year, month, daysInMonth, holidays, today]);

  // 스와이프 주 이동
  const [slideDirection, setSlideDirection] = useState(0); // -1 = left, 1 = right
  const [weekOffset, setWeekOffset] = useState(() => {
    // 현재 월이면 오늘이 속한 주로 초기화
    const isCurrentMonth = month === today.getMonth() + 1 && year === today.getFullYear();
    if (!isCurrentMonth) return 0;
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
    return Math.floor((firstDayOfWeek + today.getDate() - 1) / 7);
  });
  const totalWeeks = calendarWeeks.length;
  const visibleDays = calendarWeeks[Math.min(weekOffset, totalWeeks - 1)] || [];
  const hasNextWeek = weekOffset < totalWeeks - 1;
  const hasPrevWeek = weekOffset > 0;

  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50 && hasNextWeek) { setSlideDirection(1); setWeekOffset((p) => p + 1); }
    if (diff < -50 && hasPrevWeek) { setSlideDirection(-1); setWeekOffset((p) => p - 1); }
  };

  const schedulesByDate = useMemo(() => {
    if (apiSchedules.length === 0) return {};
    const map: Record<string, ScheduleItem[]> = {};
    apiSchedules.forEach(s => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [apiSchedules]);

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
    if (!isLoggedIn || apiSchedules.length === 0) return [];
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return apiSchedules
      .filter(s => s.date.startsWith(prefix))
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  }, [year, month, isLoggedIn, apiSchedules]);

  // Stats
  const confirmedCount = monthSchedules.filter(s => s.status === 'confirmed').length;
  const pendingCount = monthSchedules.filter(s => s.status === 'pending').length;

  if (isPro && isLoggedIn) return <ProScheduleView />;

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
            <>
              <div
                key={weekOffset}
                className="grid grid-cols-7 text-center gap-y-1"
              >
                {/* 요일 헤더 (고정 일월화수목금토) */}
                {DAYS_KR.map((dow, i) => (
                  <span
                    key={`dow-${i}`}
                    className={`text-[12px] font-medium ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}
                  >
                    {dow}
                  </span>
                ))}
                {/* Day numbers - 7개 고정, null은 빈 셀 */}
                {visibleDays.map((d, i) => {
                  if (!d) {
                    return <div key={`empty-${i}`} />;
                  }
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
                            ? 'text-gray-300'
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
              </div>
            </>
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
