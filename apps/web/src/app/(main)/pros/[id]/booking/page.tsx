'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Minus, Plus, ChevronDown, HelpCircle, Info, X, MapPin, Search } from 'lucide-react';
import toast from 'react-hot-toast';

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

const PLAN_OPTIONS = [
  { id: 'opt1', name: 'Premium 패키지', originalPrice: 450000, discountPercent: 0, finalPrice: 450000 },
  { id: 'opt2', name: 'Superior 패키지', originalPrice: 800000, discountPercent: 0, finalPrice: 800000 },
  { id: 'opt3', name: 'Enterprise 패키지', originalPrice: 1700000, discountPercent: 0, finalPrice: 1700000 },
];

const EXTRA_OPTIONS = [
  { id: 'dist1', label: '출장비 (30km 이내)', price: 30000 },
  { id: 'dist2', label: '출장비 (30~60km)', price: 50000 },
  { id: 'dist3', label: '출장비 (60~100km)', price: 100000 },
  { id: 'dist4', label: '출장비 (100~150km)', price: 130000 },
  { id: 'dist5', label: '출장비 (150km 이상)', price: 200000 },
];

const MAX_SELECTIONS = 1;

// 사회자 이름/사진 매핑
const PRO_NAMES: Record<string, { name: string; image: string }> = {
  '1': { name: '강도현', image: '/images/강도현/10000133881772850005043.avif' },
  '2': { name: '김동현', image: '/images/김동현/10000365351773046135169.avif' },
  '3': { name: '김민지', image: '/images/김민지/IMG_06781773894450803.avif' },
  '4': { name: '김솔', image: '/images/김솔/IMG_23601771788594274.avif' },
  '5': { name: '김유석', image: '/images/김유석/10000029811773033474612.avif' },
  '6': { name: '김재성', image: '/images/김재성/10000602271772960706687.avif' },
  '7': { name: '김진아', image: '/images/김진아/IMG_53011772965035335.avif' },
  '8': { name: '김호중', image: '/images/김호중/0DBA6E02-BBC8-4660-8464-5B5162FAD2461773045822216.avif' },
  '9': { name: '나연지', image: '/images/나연지/Facetune_10-02-2026-21-07-511772438130235.avif' },
  '10': { name: '노유재', image: '/images/노유재/10000016211774440274171.avif' },
  '11': { name: '도준석', image: '/images/도준석/1-1231772850030951.avif' },
  '12': { name: '문정은', image: '/images/문정은/IMG_27221772621229571.avif' },
  '13': { name: '박상설', image: '/images/박상설/10000077391773050357628.avif' },
  '14': { name: '박은결', image: '/images/박은결/IMG_02661773035503788.avif' },
  '15': { name: '박인애', image: '/images/박인애/IMG_0196.avif' },
  '16': { name: '박주은', image: '/images/박주은/IMG_01621772973118334.avif' },
  '17': { name: '배유정', image: '/images/배유정/IMG_21541773026472716.avif' },
  '18': { name: '성연채', image: '/images/성연채/20161016_161406_IMG_5921.avif' },
  '19': { name: '송지은', image: '/images/송지은/DE397232-C3A6-4FD0-80C8-0251D66A66AF1772092441240.avif' },
  '20': { name: '유하늘', image: '/images/유하늘/D54BC1BA-3BF2-4827-AA76-096D4056BCDB1773030157943.avif' },
  '21': { name: '유하영', image: '/images/유하영/22712e20f03327c2843673c063c881f432f6af591772967031477.avif' },
  '22': { name: '이강문', image: '/images/이강문/10000353831773035180593.avif' },
  '23': { name: '이승진', image: '/images/이승진/IMG_46511771924269213.avif' },
  '24': { name: '이용석', image: '/images/이용석/10001176941772847263491.avif' },
  '25': { name: '이우영', image: '/images/이우영/2-11772248201484.avif' },
  '26': { name: '이원영', image: '/images/이원영/1-1231772531708677.avif' },
  '27': { name: '이재원', image: '/images/이재원/17230390916981773388202648.avif' },
  '28': { name: '이한나', image: '/images/이한나/IMG_002209_01772081523241.avif' },
  '29': { name: '임하람', image: '/images/임하람/10000118841772968813129.avif' },
  '30': { name: '장윤영', image: '/images/장윤영/IMG_27051772976548211.avif' },
  '31': { name: '전해별', image: '/images/전해별/025209A2-09A8-4777-9A6A-DF4751F560A71772850104015.avif' },
  '32': { name: '전혜인', image: '/images/전혜인/IMG_19181773027236141.avif' },
  '33': { name: '정미정', image: '/images/정미정/0533d0a3d5f361ad511e32dafb775319b26ce7541772100346528.avif' },
  '34': { name: '정애란', image: '/images/정애란/IMG_2920.avif' },
  '35': { name: '정이현', image: '/images/정이현/44561772622988798.avif' },
  '36': { name: '조하늘', image: '/images/조하늘/IMG_27041773036338469.avif' },
  '37': { name: '최진선', image: '/images/최진선/10001059551772371340253.avif' },
  '38': { name: '한가람', image: '/images/한가람/IMG_34281772111635068.avif' },
  '39': { name: '함현지', image: '/images/함현지/11773004544652.avif' },
  '40': { name: '허수빈', image: '/images/허수빈/IMG_01991772961130928.avif' },
  '41': { name: '홍현미', image: '/images/홍현미/IMG_12201772513865121.avif' },
};

// ─── Page ──────────────────────────────────────────────────
export default function BookingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const proInfo = PRO_NAMES[id || ''] || { name: '사회자', image: '' };

  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear] = useState(now.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate());
  const [selectedOption, setSelectedOption] = useState(PLAN_OPTIONS[0]);
  const [quantity, setQuantity] = useState(1);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [disabledSlots] = useState(['15:00', '15:30', '16:00', '16:30', '17:30', '18:00']);
  const [extraQty, setExtraQty] = useState<Record<string, number>>(
    Object.fromEntries(EXTRA_OPTIONS.map((o) => [o.id, 0]))
  );
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

  const handleBook = () => {
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
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[14px] font-bold text-gray-900">옵션 선택</span>
          <button className="px-3 h-[30px] rounded-lg border border-gray-200 text-[12px] font-medium text-gray-700">변경</button>
        </div>

        <div className="border border-gray-200 rounded-2xl p-4">
          {/* 프로필 + 정보 */}
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
              return (
                <button
                  key={`day-${i}`}
                  onClick={() => !d.isPast && setSelectedDay(d.day)}
                  disabled={d.isPast}
                  className="flex flex-col items-center"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-[18px] font-bold transition-all ${
                      selected
                        ? 'bg-[#2B313D] text-white'
                        : d.isPast
                        ? 'text-gray-200'
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
    </div>
  );
}
