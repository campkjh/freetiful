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

// v2: 결제 status 필터링 로직이 바뀌었으니 v1 캐시(과거 'MC 대기' row 가 들어있던) 버림.
const SCHEDULE_CACHE_PREFIX = 'freetiful-schedule-cache-v2:';
const SCHEDULE_CACHE_TTL = 10 * 60_000;

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

function formatEventTimeShort(value: any): string {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{1,2}:\d{2}/.test(value)) {
    const [hh, mm] = value.split(':');
    return `${hh.padStart(2, '0')}:${mm.slice(0, 2)}`;
  }
  if (typeof value === 'string') {
    const isoTime = value.match(/T(\d{2}:\d{2})/);
    if (isoTime) return isoTime[1];
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function mapPaymentsToSchedules(data: any[]): ScheduleItem[] {
  const mapped: ScheduleItem[] = [];
  // 결제완료/에스크로/정산완료 만 캘린더에 노출. pending/failed/refunded 는 제외.
  const ALLOWED = new Set(['completed', 'escrowed', 'settled']);
  // 같은 quotationId 에 대해 여러 Payment row 가 있을 수 있음 (재결제 등) — 가장 최근 것만.
  const seenQuotationIds = new Set<string>();
  const sorted = [...data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  sorted.forEach((p: any) => {
    if (!ALLOWED.has(p.status)) return;
    const qs = Array.isArray(p.quotations) ? p.quotations : (p.quotation ? [p.quotation] : []);
    if (qs.length === 0) return;

    qs.forEach((q: any) => {
      if (seenQuotationIds.has(q.id)) return;
      seenQuotationIds.add(q.id);
      const proUser = q.proProfile?.user || {};
      const proImg = q.proProfile?.images?.[0]?.imageUrl || proUser.profileImageUrl || '';
      const eventDate = q.eventDate || p.createdAt;
      const dateStr = new Date(eventDate).toISOString().slice(0, 10);
      const eventDateObj = new Date(eventDate);
      const now = new Date();
      // ALLOWED 만 들어왔으니 모두 결제 OK 상태 — 행사일 지나면 completed, 아니면 confirmed.
      const status: ScheduleItem['status'] =
        eventDateObj < now ? 'completed' : 'confirmed';
      mapped.push({
        id: `${p.id}__${q.id}`,
        date: dateStr,
        title: q.title || p.description || '행사',
        category: q.category || q.proProfile?.categories?.[0]?.category?.name || '사회자',
        proName: proUser.name || '',
        proImage: proImg,
        time: formatEventTimeShort(q.eventTime),
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

function UserScheduleSkeleton() {
  return (
    <div className="divide-y divide-gray-100">
      {[0, 1, 2].map((i) => (
        <div key={`user-schedule-skeleton-${i}`} className="bg-white px-5 py-3">
          <div className="flex items-start gap-3">
            <div className="h-16 w-12 shrink-0 animate-pulse rounded-lg bg-gray-100" />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="mb-2 h-4 w-36 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
              <div className="mt-3 flex gap-1.5">
                <div className="h-6 w-20 animate-pulse rounded-lg bg-gray-100" />
                <div className="h-6 w-28 animate-pulse rounded-lg bg-gray-100" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

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
  paidAt: string | null;
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

function ProScheduleView() {
  const authUser = useAuthStore((s) => s.user);
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const cacheKey = `pro:${authUser?.id || 'anon'}:${month}`;
  const cachedInit = readScheduleCache<ProBooking[]>(cacheKey);
  const [apiBookings, setApiBookings] = useState<ProBooking[]>(cachedInit || []);
  // 캐시가 없을 때만 로딩 — 캐시 있으면 즉시 카드를 보여주고 백그라운드 갱신.
  const [loading, setLoading] = useState<boolean>(cachedInit == null);
  useEffect(() => {
    if (!authUser) { setLoading(false); return; }
    let cancelled = false;
    scheduleApi.getMySchedule(month)
      .then((data) => {
        if (cancelled) return;
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
            paidAt: b.paidAt || null,
          };
        });
        setApiBookings(mapped);
        writeScheduleCache(cacheKey, mapped);
      })
      .catch(() => { if (!cancelled && cachedInit == null) setApiBookings([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authUser, month, cacheKey]);
  const bookings = apiBookings;

  const formatPaidAt = (iso: string | null) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch { return ''; }
  };

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
      <div className="px-4 pb-3">
        <h2 className="text-[18px] font-semibold" style={{ color: '#2B313D' }}>예약된 행사</h2>
        <p className="text-[14px] font-medium" style={{ color: '#8A909C', marginTop: 2 }}>이번 달 일정 한눈에 보기</p>
      </div>

      {/* Booking Cards */}
      <div className="px-4 space-y-3 pb-24">
        {loading ? (
          // 데이터가 뜨기 전까지 카드와 동일 형태의 스켈레톤
          [0, 1].map((i) => (
            <div
              key={`sk-${i}`}
              className="bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
              style={{ borderRadius: 24 }}
            >
              <div className="skeleton h-4 w-2/3 rounded mb-2" />
              <div className="skeleton h-3 w-1/2 rounded mb-1" />
              <div className="skeleton h-3 w-1/3 rounded mb-3" />
              <div className="flex items-end justify-between mt-2">
                <div className="skeleton h-5 w-24 rounded" />
                <div className="skeleton h-3 w-20 rounded" />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="skeleton h-11" style={{ borderRadius: 12 }} />
                <div className="skeleton h-11" style={{ borderRadius: 12 }} />
              </div>
            </div>
          ))
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mb-3">
              <rect x="3" y="4" width="18" height="18" rx="3" fill="#E5E7EB"/>
              <rect x="3" y="4" width="18" height="7" rx="3" fill="#9CA3AF"/>
              <rect x="7" y="2" width="2.5" height="4" rx="1.25" fill="#D1D5DB"/>
              <rect x="14.5" y="2" width="2.5" height="4" rx="1.25" fill="#D1D5DB"/>
            </svg>
            <p className="text-[14px]">예약된 행사가 없습니다</p>
          </div>
        ) : (
          bookings.map(booking => {
            const dateObj = new Date(booking.date);
            const dateLabel = `${dateObj.getFullYear()}. ${dateObj.getMonth() + 1}. ${dateObj.getDate()} (${DAYS_KR[dateObj.getDay()]})`;
            return (
              <div
                key={booking.id}
                className="bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
                style={{ borderRadius: 24, border: '0.6px solid #F9F9F9' }}
              >
                {/* 품목 */}
                <p className="text-[15px] font-semibold truncate" style={{ color: '#2B313D' }}>
                  {booking.eventType || booking.plan || '행사'}
                </p>
                {/* 행사 주소 */}
                {booking.venue && (
                  <div className="mt-1 flex items-center gap-1.5 text-[13px]" style={{ color: '#51535C' }}>
                    <MapPin size={14} className="shrink-0 text-[#A4ABBA]" />
                    <p className="min-w-0 truncate">{booking.venue}</p>
                  </div>
                )}
                {/* 행사 일시 */}
                <div className="mt-0.5 flex items-center gap-1.5 text-[13px]" style={{ color: '#51535C' }}>
                  <Calendar size={14} className="shrink-0 text-[#A4ABBA]" />
                  <p>{dateLabel}{booking.time ? ` ${booking.time}` : ''}</p>
                </div>

                {/* 가격 + 결제일시 */}
                <div className="flex items-end justify-between mt-2.5">
                  <p className="text-[18px] font-semibold tabular-nums" style={{ color: '#2B313D' }}>
                    {booking.amount}원
                  </p>
                  {booking.paidAt && (
                    <p className="text-[14px]" style={{ color: '#8A909C' }}>
                      결제 {formatPaidAt(booking.paidAt)}
                    </p>
                  )}
                </div>

                {/* 액션 버튼 (좌: 상세보기 파란 / 우: 회색 일정/채팅 등) */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <Link
                    href={booking.paymentId ? `/schedule/${booking.paymentId}` : `/schedule/${booking.id}`}
                    className="h-11 leading-[44px] text-center text-[18px] active:scale-[0.98] transition-transform"
                    style={{ borderRadius: 12, backgroundColor: '#3787FF', color: '#FFFFFF', fontWeight: 600 }}
                  >
                    상세보기
                  </Link>
                  <Link
                    href="/chat"
                    className="h-11 leading-[44px] text-center text-[18px] active:scale-[0.98] transition-transform"
                    style={{ borderRadius: 12, backgroundColor: '#F2F3F5', color: '#51535C', fontWeight: 600 }}
                  >
                    채팅하기
                  </Link>
                </div>
              </div>
            );
          })
        )}
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
  const [apiSchedules, setApiSchedules] = useState<ScheduleItem[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  useEffect(() => {
    setIsLoggedIn(authUser !== null);
    setIsPro(authUser?.role === 'pro');
  }, [authUser]);

  // Fetch schedule from API when authenticated
  // 페이지 재진입 시에도 최신 데이터 반영되도록 visibility 기반 refetch 도 지원
  useEffect(() => {
    if (!authUser) {
      setScheduleLoading(false);
      return;
    }
    if (authUser.role === 'pro') {
      setScheduleLoading(false);
      return;
    }
    let cancelled = false;
    const cacheKey = `user:${authUser.id}:${initialMonthKey}`;
    const cached = readScheduleCache<ScheduleItem[]>(cacheKey);
    if (cached) {
      setApiSchedules(cached);
      setScheduleLoading(false);
    } else {
      setScheduleLoading(true);
    }

    const fetchGeneralSchedules = (silent = false) => {
      if (!silent) setScheduleLoading(true);
      apiClient.get('/api/v1/payment/schedule', { params: { limit: 80 }, timeout: 4000 })
        .then((res: any) => {
          const data = res.data?.data || [];
          if (!Array.isArray(data)) return;
          const mapped = mapPaymentsToSchedules(data);
          if (cancelled) return;
          setApiSchedules(mapped);
          writeScheduleCache(cacheKey, mapped);
        })
        .catch((err) => { console.error('[Schedule] payment API error:', err); })
        .finally(() => { if (!cancelled) setScheduleLoading(false); });
    };

    fetchGeneralSchedules(!!cached);

    // 탭 복귀/포커스 시 자동 재조회 (결제 직후 다른 탭에서 돌아와도 즉시 반영)
    const onVis = () => { if (document.visibilityState === 'visible') fetchGeneralSchedules(true); };
    const onFocus = () => fetchGeneralSchedules(true);
    window.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
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

  const overviewSchedules = useMemo(() => {
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const upcoming = monthSchedules
      .filter((s) => s.date >= todayKey && s.status !== 'completed' && s.status !== 'cancelled')
      .slice(0, 5);
    if (upcoming.length > 0) return { title: '다가오는 스케줄', items: upcoming };
    return {
      title: '완료된 스케줄',
      items: monthSchedules.filter((s) => s.status === 'completed').slice(-5).reverse(),
    };
  }, [monthSchedules, today]);

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
            {scheduleLoading && apiSchedules.length === 0 ? (
              <UserScheduleSkeleton />
            ) : selectedSchedules.length > 0 ? (
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

          {overviewSchedules.items.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
              <h3 className="text-[15px] font-bold text-gray-900">{overviewSchedules.title}</h3>
              <div className="mt-3 space-y-2">
                {overviewSchedules.items.map((s) => {
                  const status = STATUS_MAP[s.status];
                  const dateObj = new Date(s.date);
                  const dateLabel = `${String(dateObj.getFullYear()).slice(2)}. ${dateObj.getMonth() + 1}. ${dateObj.getDate()} (${DAYS_KR[dateObj.getDay()]})`;
                  return (
                    <Link key={`overview-${s.id}`} href={`/schedule/${s.id}`} className="block rounded-2xl bg-white px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                      <div className="flex items-center gap-3">
                        <img src={s.proImage} alt={s.proName} className="h-12 w-10 rounded-lg object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-[14px] font-bold text-gray-900">{s.category} {s.proName}</p>
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${status.bg} ${status.color}`}>{status.label}</span>
                          </div>
                          <p className="mt-0.5 text-[12px] text-gray-400">{dateLabel}{s.time ? ` · ${s.time}` : ''}</p>
                          {s.location && <p className="mt-0.5 truncate text-[12px] text-gray-500">{s.location}</p>}
                        </div>
                        <ChevronRight size={16} className="shrink-0 text-gray-300" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        /* List View */
        <div className="min-h-[200px]">
          {scheduleLoading && apiSchedules.length === 0 ? (
            <UserScheduleSkeleton />
          ) : monthSchedules.length > 0 ? (
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
