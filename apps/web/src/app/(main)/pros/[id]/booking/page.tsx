'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Minus, Plus, ChevronDown, HelpCircle, Info, X, MapPin, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/auth.store';
import { discoveryApi } from '@/lib/api/discovery.api';
import { scheduleApi } from '@/lib/api/schedule.api';

// ─── Helpers ───────────────────────────────────────────────
function getDaysOfWeek(year: number, month: number, holidays: Record<string, string>) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: { day: number; dayOfWeek: string; isToday: boolean; isPast: boolean; isHoliday: boolean; holidayName: string }[] = [];
  const weekNames = ['일', '월', '화', '수', '목', '금', '토'];
  const today = new Date();

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const key = `${year}${String(month).padStart(2, '0')}${String(d).padStart(2, '0')}`;
    days.push({
      day: d,
      dayOfWeek: weekNames[date.getDay()],
      isToday: date.toDateString() === today.toDateString(),
      isPast: date < new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      isHoliday: !!holidays[key],
      holidayName: holidays[key] || '',
    });
  }
  return days;
}

const TIME_SLOTS = [
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00',
  '15:30', '16:00', '16:30', '17:00', '17:30', '18:00',
];

// API 서비스가 없는 프로일 때 기본 플랜 (폴백) — 프로가 서비스를 등록하면 이 목록은 무시됨
const PLAN_OPTIONS: { id: string; name: string; originalPrice: number; discountPercent: number; finalPrice: number }[] = [];

const EXTRA_OPTIONS = [
  { id: 'dist1', label: '출장비 (30km 이내)', price: 30000 },
  { id: 'dist2', label: '출장비 (30~60km)', price: 50000 },
  { id: 'dist3', label: '출장비 (60~100km)', price: 100000 },
  { id: 'dist4', label: '출장비 (100~150km)', price: 130000 },
  { id: 'dist5', label: '출장비 (150km 이상)', price: 200000 },
];

const MAX_SELECTIONS = 1;

// 사회자 이름/사진 매핑
const PRO_NAMES: Record<string, { name: string; image: string }> = {};

// ─── Page ──────────────────────────────────────────────────
export default function BookingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const fallbackInfo = PRO_NAMES[id || ''] || { name: '사회자', image: '' };

  // ─── Real API data ───────────────────────────────────────
  const [pro, setPro] = useState<any>(null);
  const [loadingPro, setLoadingPro] = useState(true);
  const [bookedDates, setBookedDates] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoadingPro(true);
    discoveryApi
      .getProDetail(id)
      .then((data) => { if (alive) setPro(data); })
      .catch(() => { /* fallback to local data */ })
      .finally(() => { if (alive) setLoadingPro(false); });
    scheduleApi
      .getBookedDates(id)
      .then((data: any) => {
        const arr = Array.isArray(data) ? data : data?.dates || [];
        if (alive) setBookedDates(arr);
      })
      .catch(() => { /* ignore */ });
    return () => { alive = false; };
  }, [id]);

  // getProDetail 반환값: { user: { name, profileImageUrl }, images: [{ imageUrl }], services: [{ title, basePrice, description }] }
  const DEFAULT_PRICES: Record<string, number> = { Premium: 450000, Superior: 800000, Enterprise: 1700000 };
  const proInfo = {
    name: pro?.user?.name || pro?.name || fallbackInfo.name,
    image: pro?.images?.[0]?.imageUrl || pro?.user?.profileImageUrl || fallbackInfo.image,
  };

  // 전문가가 등록한 서비스(옵션) 기반으로 동적 플랜 구성
  const plans = useMemo(() => {
    if (pro?.services && Array.isArray(pro.services) && pro.services.length > 0) {
      return pro.services.filter((s: any) => s.isActive !== false).map((s: any, idx: number) => {
        const title = s.title || s.name || `서비스 ${idx + 1}`;
        const price = s.basePrice || DEFAULT_PRICES[title] || 450000;
        return {
          id: s.id || `svc-${idx}`,
          name: `${title} 패키지`,
          originalPrice: price,
          discountPercent: 0,
          finalPrice: price,
        };
      });
    }
    return PLAN_OPTIONS;
  }, [pro]);

  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear] = useState(now.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate());
  const [selectedOption, setSelectedOption] = useState(PLAN_OPTIONS[0]);

  // Sync selectedOption when API plans load
  useEffect(() => {
    if (plans && plans.length > 0 && plans[0]?.id !== selectedOption?.id) {
      setSelectedOption(plans[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans]);
  const [quantity, setQuantity] = useState(1);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  // 전문가 스케줄에서 예약 불가 슬롯 계산 — bookedDates 에 해당일이 있으면 전체 슬롯 비활성
  const disabledSlots = useMemo(() => {
    if (!selectedDay) return [] as string[];
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    const isBooked = bookedDates.some((d) => d === dateStr || d.startsWith(dateStr));
    return isBooked ? TIME_SLOTS : [] as string[];
  }, [bookedDates, selectedDay, currentMonth, currentYear]);
  const [extraQty, setExtraQty] = useState<Record<string, number>>(
    Object.fromEntries(EXTRA_OPTIONS.map((o) => [o.id, 0]))
  );
  const [showPlanSelector, setShowPlanSelector] = useState(false);
  const optionSectionRef = useRef<HTMLDivElement>(null);
  const [venueAddress, setVenueAddress] = useState('');
  const [venueDetail, setVenueDetail] = useState('');
  const [showMapSearch, setShowMapSearch] = useState(false);
  const [mapQuery, setMapQuery] = useState('');

  const extraTotal = EXTRA_OPTIONS.reduce((sum, o) => sum + o.price * (extraQty[o.id] || 0), 0);

  // 대한민국 공휴일 (2025~2027)
  const holidays = useMemo<Record<string, string>>(() => ({
    // 2025
    '20250101': '신정', '20250128': '설날', '20250129': '설날', '20250130': '설날',
    '20250301': '삼일절', '20250505': '어린이날', '20250506': '대체공휴일',
    '20250604': '석가탄신일', '20250606': '현충일', '20250815': '광복절',
    '20251003': '개천절', '20251005': '추석', '20251006': '추석', '20251007': '추석',
    '20251008': '대체공휴일', '20251009': '한글날', '20251225': '크리스마스',
    // 2026
    '20260101': '신정', '20260216': '설날', '20260217': '설날', '20260218': '설날',
    '20260301': '삼일절', '20260505': '어린이날', '20260524': '석가탄신일',
    '20260606': '현충일', '20260815': '광복절', '20260923': '추석',
    '20260924': '추석', '20260925': '추석', '20261003': '개천절',
    '20261009': '한글날', '20261225': '크리스마스',
    // 2027
    '20270101': '신정', '20270206': '설날', '20270207': '설날', '20270208': '설날',
    '20270301': '삼일절', '20270505': '어린이날', '20270513': '석가탄신일',
    '20270606': '현충일', '20270815': '광복절', '20271003': '개천절',
    '20271009': '한글날', '20271011': '추석', '20271012': '추석', '20271013': '추석',
    '20271225': '크리스마스',
  }), []);

  const days = useMemo(() => getDaysOfWeek(currentYear, currentMonth, holidays), [currentYear, currentMonth, holidays]);

  // 7일씩 주 단위로 스와이프
  const [weekOffset, setWeekOffset] = useState(0);
  const todayIdx = days.findIndex((d) => d.isToday);
  const baseIdx = Math.max(0, todayIdx);
  const weekStart = baseIdx + weekOffset * 7;
  const visibleDays = days.slice(weekStart, weekStart + 7);
  const hasNextWeek = weekStart + 7 < days.length;
  const hasPrevWeek = weekOffset > 0;

  // 스와이프 핸들링
  const touchStartX = useRef(0);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50 && hasNextWeek) setWeekOffset((p) => p + 1);
    if (diff < -50 && hasPrevWeek) setWeekOffset((p) => p - 1);
  }, [hasNextWeek, hasPrevWeek]);

  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;

  const toggleSlot = (time: string) => {
    if (disabledSlots.includes(time)) return;
    setSelectedSlots((prev) => {
      if (prev.includes(time)) return prev.filter((t) => t !== time);
      if (prev.length >= MAX_SELECTIONS) {
        toast.error(`최대 ${MAX_SELECTIONS}개까지 선택 가능합니다`);
        return prev;
      }
      return [...prev, time];
    });
  };

  const removeSlot = (time: string) => {
    setSelectedSlots((prev) => prev.filter((t) => t !== time));
  };

  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleBook = () => {
    if (!(authUser !== null || localStorage.getItem('freetiful-logged-in') === 'true')) {
      setShowLoginModal(true);
      return;
    }
    if (selectedSlots.length === 0) {
      toast.error('희망 시간을 선택해주세요');
      return;
    }
    const params = new URLSearchParams({
      plan: selectedOption.name,
      price: String(selectedOption.finalPrice * quantity + extraTotal),
      slots: selectedSlots.join(','),
      day: String(selectedDay),
      month: String(currentMonth),
      ...(venueAddress ? { venue: venueAddress, venueDetail } : {}),
    });
    router.push(`/pros/${id}/checkout?${params.toString()}`);
  };

  const totalPrice = selectedOption.finalPrice * quantity;

  return (
    <div className="bg-white min-h-screen pb-40" style={{ letterSpacing: '-0.02em' }}>
      {/* ─── Header ─── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-50">
        <div className="flex items-center px-3 h-[52px]">
          <button onClick={() => router.back()} className="p-1.5 active:scale-90 transition-transform">
            <ChevronLeft size={26} className="text-gray-900" />
          </button>
          <h1 className="ml-1 text-[18px] font-bold text-gray-900">예약일 선택</h1>
        </div>
      </div>

      {/* ─── Option Card ─── */}
      <div className="px-4 pt-4" ref={optionSectionRef}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[14px] font-bold text-gray-900">옵션 선택</span>
          <button
            onClick={() => setShowPlanSelector((v) => !v)}
            className="px-3 h-[30px] rounded-lg border border-gray-200 text-[12px] font-medium text-gray-700 active:bg-gray-50 transition-colors"
          >
            변경
          </button>
        </div>

        {/* Plan selector */}
        {showPlanSelector && (
          <div className="mb-3 space-y-2">
            {plans.map((plan: any) => (
              <button
                key={plan.id}
                onClick={() => { setSelectedOption(plan); setShowPlanSelector(false); }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                  selectedOption.id === plan.id
                    ? 'border-[#3180F7] bg-[#EAF3FF]'
                    : 'border-gray-200 bg-white active:bg-gray-50'
                }`}
              >
                <span className={`text-[14px] font-medium ${selectedOption.id === plan.id ? 'text-[#3180F7] font-bold' : 'text-gray-700'}`}>{plan.name}</span>
                <span className={`text-[14px] font-bold ${selectedOption.id === plan.id ? 'text-[#3180F7]' : 'text-gray-900'}`}>{plan.finalPrice.toLocaleString()}원</span>
              </button>
            ))}
          </div>
        )}

        <div className="border border-gray-200 rounded-2xl p-4">
          {/* 프로필 + 정보 */}
          {loadingPro ? (
            <div className="flex gap-3 animate-pulse">
              <div className="w-[72px] h-[72px] rounded-xl bg-gray-100 shrink-0" />
              <div className="flex-1 min-w-0 space-y-2 py-1">
                <div className="h-4 bg-gray-100 rounded w-1/3" />
                <div className="h-3 bg-gray-100 rounded w-1/4" />
                <div className="h-5 bg-gray-100 rounded w-1/2 mt-2" />
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <div className="w-[72px] h-[72px] rounded-xl overflow-hidden bg-gray-100 shrink-0">
                <img src={proInfo.image} alt={proInfo.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-gray-900">사회자 {proInfo.name}</p>
                <p className="text-[12px] text-gray-500 mt-0.5">{selectedOption.name}</p>
                <p className="text-[17px] font-bold text-gray-900 mt-1">
                  {selectedOption.finalPrice.toLocaleString()}원
                  <span className="text-[12px] font-normal text-gray-400 ml-1.5">1개</span>
                </p>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowDetail(!showDetail)}
            className="flex items-center gap-1 text-[12px] text-gray-400 mt-3 ml-auto"
          >
            자세히
            <ChevronDown size={13} className={`transition-transform ${showDetail ? 'rotate-180' : ''}`} />
          </button>

          {showDetail && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-[12px] text-gray-500 leading-relaxed">행사 진행 + 리허설 + 사전 미팅 포함</p>
            </div>
          )}

          {/* Quantity */}
          <div className="flex items-center justify-end gap-0 mt-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 border border-gray-200 rounded-l-xl flex items-center justify-center text-gray-400 active:bg-gray-50"
            >
              <Minus size={16} />
            </button>
            <div className="w-12 h-10 border-t border-b border-gray-200 flex items-center justify-center text-[15px] font-bold text-gray-900">
              {quantity}
            </div>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-10 border border-gray-200 rounded-r-xl flex items-center justify-center text-gray-400 active:bg-gray-50"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── 옵션항목 ─── */}
      <div className="px-4 pt-6">
        <h2 className="text-[17px] font-bold text-gray-900 mb-4">옵션항목</h2>
        <div className="space-y-5">
          {EXTRA_OPTIONS.map((opt) => (
            <div key={opt.id}>
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-gray-600">{opt.label}</span>
                <HelpCircle size={16} className="text-gray-300" />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[17px] font-bold text-gray-900">+{opt.price.toLocaleString()}원</span>
                <div className="flex items-center gap-0">
                  <button
                    onClick={() => setExtraQty((p) => ({ ...p, [opt.id]: Math.max(0, (p[opt.id] || 0) - 1) }))}
                    className="w-9 h-9 border border-gray-200 rounded-l-xl flex items-center justify-center text-gray-400 active:bg-gray-50"
                  >
                    <Minus size={15} />
                  </button>
                  <div className="w-10 h-9 border-t border-b border-gray-200 flex items-center justify-center text-[14px] font-bold text-gray-900">
                    {extraQty[opt.id] || 0}
                  </div>
                  <button
                    onClick={() => setExtraQty((p) => ({ ...p, [opt.id]: (p[opt.id] || 0) + 1 }))}
                    className="w-9 h-9 border border-gray-200 rounded-r-xl flex items-center justify-center text-gray-400 active:bg-gray-50"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── 행사 위치 ─── */}
      <div className="px-4 pt-6">
        <h2 className="text-[17px] font-bold text-gray-900 mb-3">행사 위치</h2>

        {venueAddress ? (
          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            {/* 카카오맵 미리보기 */}
            <div className="w-full h-[140px] bg-gray-100 relative overflow-hidden">
              <img
                src={`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(venueAddress)}&zoom=15&size=600x280&markers=${encodeURIComponent(venueAddress)}&key=placeholder`}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <MapPin size={24} className="text-[#3180F7] mx-auto mb-1" />
                  <p className="text-[11px] text-gray-500">지도에서 확인</p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-start gap-2">
                <MapPin size={16} className="text-[#3180F7] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-[14px] font-bold text-gray-900">{venueAddress}</p>
                  {venueDetail && <p className="text-[12px] text-gray-500 mt-0.5">{venueDetail}</p>}
                </div>
                <button
                  onClick={() => { setVenueAddress(''); setVenueDetail(''); }}
                  className="text-[12px] text-gray-400 shrink-0"
                >
                  변경
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowMapSearch(true)}
            className="w-full flex items-center gap-3 px-4 h-[52px] border border-gray-200 rounded-2xl text-left active:bg-gray-50 transition-colors"
          >
            <MapPin size={18} className="text-gray-400" />
            <span className="text-[14px] text-gray-400 flex-1">행사 장소를 검색하세요</span>
            <Search size={16} className="text-gray-300" />
          </button>
        )}
      </div>

      {/* ─── 다음 주소 검색 모달 ─── */}
      {showMapSearch && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowMapSearch(false)}
          style={{ animation: 'modalFadeIn 0.25s ease-out' }}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[90vh] overflow-hidden pb-safe"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'sheetSlideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mt-3" />
            <div className="px-5 pt-4 pb-3 flex items-center justify-between">
              <h3 className="text-[17px] font-bold text-gray-900">행사 장소 검색</h3>
              <button onClick={() => setShowMapSearch(false)} className="active:scale-90 transition-transform">
                <X size={22} className="text-gray-500" />
              </button>
            </div>

            {/* 다음 주소 검색 iframe */}
            <div className="px-5" style={{ height: '450px' }}>
              <iframe
                className="w-full h-full border-0 rounded-xl"
                src="https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
                title="주소검색"
                style={{ display: 'none' }}
              />
              <div
                id="daum-postcode"
                ref={(el) => {
                  if (!el || el.childNodes.length > 0) return;
                  const script = document.createElement('script');
                  script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
                  script.onload = () => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    new (window as any).daum.Postcode({
                      oncomplete: (data: { address: string; buildingName: string }) => {
                        setVenueAddress(data.address + (data.buildingName ? ` (${data.buildingName})` : ''));
                        setShowMapSearch(false);
                        toast.success('행사 위치가 설정되었습니다');
                      },
                      width: '100%',
                      height: '100%',
                    }).embed(el);
                  };
                  document.head.appendChild(script);
                }}
                className="w-full h-full rounded-xl overflow-hidden"
              />
            </div>

            {/* 상세 주소 입력 */}
            <div className="px-5 pt-3 pb-4">
              <input
                type="text"
                value={venueDetail}
                onChange={(e) => setVenueDetail(e.target.value)}
                placeholder="상세 주소 입력 (예: 3층 그랜드볼룸)"
                className="w-full bg-gray-100 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#3180F7]/30"
              />
            </div>
          </div>
        </div>
      )}

      {/* Map modal animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes modalFadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes sheetSlideUp { 0% { transform: translateY(100%); } 100% { transform: translateY(0); } }
      `}} />

      {/* ─── Divider ─── */}
      <div className="h-[6px] bg-gray-50 mt-5" />

      {/* ─── 행사 희망 일정 ─── */}
      <div className="px-4 pt-6">
        <h2 className="text-[18px] font-bold text-gray-900 mb-4">행사 희망 일정</h2>

        {/* Month tabs */}
        <div className="flex items-center gap-4 border-b border-gray-100 mb-1">
          <button
            onClick={() => { setCurrentMonth(now.getMonth() + 1); setWeekOffset(0); }}
            className={`pb-3 text-[16px] font-bold border-b-2 transition-colors ${
              currentMonth === now.getMonth() + 1 ? 'text-gray-900 border-gray-900' : 'text-gray-300 border-transparent'
            }`}
          >
            {now.getMonth() + 1}월
          </button>
          <button
            onClick={() => { setCurrentMonth(nextMonth); setWeekOffset(0); }}
            className={`pb-3 text-[16px] font-bold border-b-2 transition-colors ${
              currentMonth === nextMonth ? 'text-gray-900 border-gray-900' : 'text-gray-300 border-transparent'
            }`}
          >
            {nextMonth}월
          </button>
        </div>

        {/* Day picker (swipeable weekly) */}
        <div
          className="border-b border-gray-100 py-3 overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="grid grid-cols-7 text-center gap-y-1 transition-opacity duration-200">
            {/* Day of week header */}
            {visibleDays.map((d, i) => (
              <span
                key={`dow-${i}`}
                className={`text-[12px] font-medium ${d.dayOfWeek === '일' || d.isHoliday ? 'text-red-400' : 'text-gray-400'}`}
              >
                {d.dayOfWeek}
              </span>
            ))}
            {/* Day numbers */}
            {visibleDays.map((d, i) => {
              const selected = selectedDay === d.day;
              const isRed = d.dayOfWeek === '일' || d.isHoliday;
              const dateKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
              const isBooked = bookedDates.includes(dateKey);
              const blocked = d.isPast || isBooked;
              return (
                <button
                  key={`day-${i}`}
                  onClick={() => !blocked && setSelectedDay(d.day)}
                  disabled={blocked}
                  className="flex flex-col items-center"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-[18px] font-bold transition-all ${
                      selected
                        ? 'bg-[#2B313D] text-white'
                        : d.isPast
                        ? 'text-gray-200'
                        : isBooked
                        ? 'text-gray-300 line-through'
                        : isRed
                        ? 'text-red-400'
                        : 'text-gray-900'
                    }`}
                  >
                    {d.day}
                  </div>
                  {d.isHoliday && !d.isToday && <span className="text-[9px] text-red-400 mt-0.5 truncate max-w-[40px]">{d.holidayName}</span>}
                  {d.isToday && !d.isHoliday && <span className="text-[10px] text-gray-400 mt-0.5">오늘</span>}
                  {d.isToday && d.isHoliday && <span className="text-[9px] text-red-400 mt-0.5 truncate max-w-[40px]">{d.holidayName}</span>}
                </button>
              );
            })}
          </div>
          {/* 스와이프 인디케이터 */}
          <div className="flex justify-center gap-1 mt-2">
            {Array.from({ length: Math.ceil((days.length - baseIdx) / 7) }, (_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === weekOffset ? 'bg-gray-800' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>
      </div>

      {/* ─── Time slots ─── */}
      <div className="px-4 pt-5">
        <div className="flex items-center gap-1.5 mb-4">
          <span className="text-[12px] text-gray-500">행사 확정 방식:</span>
          <span className="text-[12px] font-bold text-gray-900">사회자 확인 후 확정</span>
          <HelpCircle size={14} className="text-gray-300" />
        </div>

        <div className="grid grid-cols-5 gap-2">
          {TIME_SLOTS.map((time) => {
            const isDisabled = disabledSlots.includes(time);
            const isSelected = selectedSlots.includes(time);
            return (
              <button
                key={time}
                onClick={() => toggleSlot(time)}
                disabled={isDisabled}
                className={`h-[42px] rounded-xl text-[14px] font-medium border transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-[#2B313D] border-[#2B313D] text-white font-bold'
                    : isDisabled
                    ? 'bg-gray-50 border-gray-50 text-gray-300'
                    : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300'
                }`}
              >
                {time}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Notice ─── */}
      <div className="px-4 pt-6">
        <div className="bg-gray-50 rounded-2xl p-4">
          <div className="flex items-start gap-2">
            <Info size={16} className="text-gray-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-bold text-gray-700 mb-2">예약 시 안내사항</p>
              <ul className="space-y-1 text-[12px] text-gray-500 leading-relaxed">
                <li>· 일정 변경이 필요하면 앱에서 변경/취소해주세요.</li>
                <li>· 예약 변경/취소는 행사 3일 전까지 가능해요.</li>
                <li>· 행사 규모에 따라 리허설 시간이 추가될 수 있어요.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Bottom Fixed Bar ─── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 px-4 pt-3 pb-safe">
        {/* Selected slots tags */}
        {selectedSlots.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3">
            {selectedSlots.map((time, i) => (
              <button
                key={time}
                onClick={() => removeSlot(time)}
                className="shrink-0 flex items-center gap-1.5 px-3 h-[32px] rounded-full bg-gray-100 text-[12px] font-medium text-gray-700 active:scale-95 transition-transform"
              >
                {i + 1}. {currentMonth}월 {selectedDay}일 {time}
                <X size={12} className="text-gray-400" />
              </button>
            ))}
          </div>
        )}

        {/* Guide text */}
        <p className="text-center text-[13px] text-gray-500 mb-3">
          행사 희망 일시를 선택해주세요.
        </p>

        {/* Book button */}
        <button
          onClick={handleBook}
          className={`w-full h-[52px] rounded-2xl text-[16px] font-bold transition-all active:scale-[0.98] ${
            selectedSlots.length > 0
              ? 'bg-[#2B313D] text-white'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          예약하기
        </button>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40" onClick={() => setShowLoginModal(false)}>
          <div
            className="bg-white w-full max-w-md rounded-t-3xl px-6 pt-6 pb-8 animate-[slideUp_0.3s_ease]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5" />
            <h2 className="text-[20px] font-bold text-gray-900 text-center mb-1">로그인이 필요합니다</h2>
            <p className="text-[14px] text-gray-500 text-center mb-6">예약을 진행하려면 로그인해주세요</p>
            <div className="space-y-2.5">
              {[
                { provider: 'kakao', label: '카카오로 계속하기', bg: 'bg-[#FEE500]', text: 'text-[#191919]', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M9 0C4.03 0 0 3.19 0 7.13c0 2.52 1.67 4.74 4.19 6.01L3.1 17.2a.3.3 0 0 0 .46.32L8.4 14a10.7 10.7 0 0 0 .6.02C13.97 14.02 18 10.83 18 6.89 18 2.94 13.97 0 9 0z" fill="#191919"/></svg> },
                { provider: 'naver', label: '네이버로 계속하기', bg: 'bg-[#03C75A]', text: 'text-white', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M12.16 9.57L5.56 0H0v18h5.84V8.43L12.44 18H18V0h-5.84v9.57z" fill="white"/></svg> },
                { provider: 'google', label: 'Google로 계속하기', bg: 'bg-white border border-gray-200', text: 'text-gray-700', icon: <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg> },
              ].map(({ provider, label, bg, text, icon }) => (
                <button
                  key={provider}
                  onClick={() => {
                    localStorage.setItem('freetiful-logged-in', 'true');
                    localStorage.setItem('freetiful-user', JSON.stringify({ name: '', provider, createdAt: Date.now() }));
                    localStorage.setItem('userRole', authUser?.role || 'general');
                    setShowLoginModal(false);
                    window.location.href = '/onboarding';
                  }}
                  className={`w-full flex items-center justify-center gap-3 ${bg} ${text} font-semibold py-3.5 rounded-xl active:scale-[0.98] transition-transform`}
                >{icon}{label}</button>
              ))}
            </div>
            <button onClick={() => setShowLoginModal(false)} className="w-full mt-4 text-[14px] text-gray-400 font-medium py-2 text-center">나중에 하기</button>
          </div>
          <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        </div>
      )}
    </div>
  );
}
