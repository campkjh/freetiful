'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Check, Send, Star, ChevronDown, Search } from 'lucide-react';
import toast from 'react-hot-toast';

/* ─── 아이콘 ─── */
const PlanIconPremium = () => (
  <svg width={28} height={28} viewBox="0 0 24 24" fill="none">
    <rect x="12" y="2" width="14" height="14" rx="2" transform="rotate(45 12 2)" fill="#3B82F6"/>
  </svg>
);
const PlanIconSuperior = () => (
  <svg width={28} height={28} viewBox="0 0 24 24" fill="none">
    <path d="M12 2L4 9l8 13 8-13-8-7z" fill="#8B5CF6"/>
    <path d="M12 2L4 9h16L12 2z" fill="#A78BFA"/>
  </svg>
);
const PlanIconEnterprise = () => (
  <svg width={28} height={28} viewBox="0 0 24 24" fill="none">
    <path d="M12 2l2.5 5.5L20 9l-4 4.5 1.5 6L12 16.5 6.5 19.5 8 13.5 4 9l5.5-1.5L12 2z" fill="#F59E0B"/>
    <path d="M12 7l1.2 2.6L16 10.5l-2 2.2.7 3L12 14l-2.7 1.7.7-3-2-2.2 2.8-.9L12 7z" fill="white" opacity="0.5"/>
  </svg>
);
const LocationIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EF4444"/>
    <circle cx="12" cy="9" r="2.5" fill="white"/>
  </svg>
);
const CalendarIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="18" rx="3" fill="#3B82F6"/>
    <path d="M3 10h18" stroke="white" strokeWidth="1.5"/>
    <rect x="7" y="2" width="2" height="4" rx="1" fill="#2563EB"/>
    <rect x="15" y="2" width="2" height="4" rx="1" fill="#2563EB"/>
    <rect x="7" y="13" width="3" height="3" rx="0.5" fill="white" opacity="0.7"/>
  </svg>
);
const ClockIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#10B981"/>
    <path d="M12 7v5l3.5 2" stroke="white" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const PLANS = [
  { id: 'premium', label: 'Premium', price: 450000, desc: '행사 1시간 진행', icon: <PlanIconPremium />, color: 'border-blue-200 bg-blue-50/40' },
  { id: 'superior', label: 'Superior', price: 800000, desc: '행사 2시간 진행', icon: <PlanIconSuperior />, color: 'border-violet-200 bg-violet-50/40' },
  { id: 'enterprise', label: 'Enterprise', price: 1700000, desc: '6시간 풀타임', icon: <PlanIconEnterprise />, color: 'border-amber-200 bg-amber-50/40' },
];

const SERVICE_TABLE = [
  { name: '사회 진행', premium: true, superior: true, enterprise: true },
  { name: '사전 미팅', premium: true, superior: true, enterprise: true },
  { name: '대본 작성', premium: false, superior: true, enterprise: true },
  { name: '리허설 참석', premium: false, superior: true, enterprise: true },
  { name: '축사/건배사 코디', premium: false, superior: false, enterprise: true },
  { name: '포토타임 진행', premium: false, superior: true, enterprise: true },
  { name: '하객 응대 안내', premium: false, superior: false, enterprise: true },
  { name: '2차 진행', premium: false, superior: false, enterprise: true },
  { name: '영상 큐시트 관리', premium: false, superior: true, enterprise: true },
  { name: '전담 코디네이터', premium: false, superior: false, enterprise: true },
];

const EVENT_TYPES = ['결혼식', '돌잔치', '기업행사', '공식행사', '체육대회', '레크리에이션', '팀빌딩', '송년회', '컨퍼런스', '라이브커머스', '기업PT', '워크숍'];

const MOOD_TAGS = ['격식있는', '따뜻한', '유쾌한', '감동적인', '차분한', '에너지넘치는', '프리미엄', '친근한', '세련된', '로맨틱한'];

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00',
];

const MOCK_PROS = [
  { id: '15', name: '박인애', image: '/images/박인애/IMG_0196.avif', rating: 4.9, reviews: 134, experience: 13, intro: '13년 생방송 뉴스 진행으로 다져진 품격있는 사회자', youtubeId: 'UIbfieXAT0U', recentReviews: ['품격있는 진행 감동이었어요', '뉴스 앵커 느낌의 안정감!', '하객분들이 정말 좋아하셨어요'] },
  { id: '23', name: '이승진', image: '/images/이승진/IMG_46511771924269213.avif', rating: 4.8, reviews: 211, experience: 4, intro: '따뜻하고 깔끔한 진행의 사회자', youtubeId: 'Nqe3UioEV8E', recentReviews: ['따뜻한 진행 덕분에 울컥했어요', '깔끔하고 센스있는 진행!', '다시 부탁드리고 싶어요'] },
  { id: '12', name: '문정은', image: '/images/문정은/IMG_27221772621229571.avif', rating: 4.6, reviews: 216, experience: 10, intro: '품격있고 고급스러운 진행', youtubeId: 'D5Mx42ArNOY', recentReviews: ['고급스러운 분위기 최고!', '프로페셔널한 진행에 감사', '축사 코디까지 완벽했어요'] },
  { id: '25', name: '이우영', image: '/images/이우영/2-11772248201484.avif', rating: 4.7, reviews: 158, experience: 8, intro: '현직 아나운서의 고품격 진행', youtubeId: 'plGBzTNsdiM', recentReviews: ['아나운서 발성이 확실히 다르네요', '격식과 유머의 밸런스 최고', '현직 아나운서 진행 추천!'] },
  { id: '5', name: '김유석', image: '/images/김유석/10000029811773033474612.avif', rating: 4.7, reviews: 65, experience: 8, intro: '최고의 진행자 아나운서', youtubeId: '6R7r1tbMbTY', recentReviews: ['진행이 정말 자연스러웠어요', '분위기를 잘 살려주셨어요', '사전 미팅도 꼼꼼하셨어요'] },
  { id: '24', name: '이용석', image: '/images/이용석/10001176941772847263491.avif', rating: 4.9, reviews: 239, experience: 11, intro: '1000회 이상 결혼식사회', youtubeId: 'nZhdGrZaBKU', recentReviews: ['1000회 경력이 느껴지는 진행', '안정감 있는 진행 최고!', '처음부터 끝까지 완벽했습니다'] },
  { id: '13', name: '박상설', image: '/images/박상설/10000077391773050357628.avif', rating: 4.9, reviews: 43, experience: 10, intro: '10년 경력, 2000번의 행사', youtubeId: 'P04peAmLV7c', recentReviews: ['베테랑의 여유가 느껴졌어요', '행사 경험이 풍부하시네요', '센스있는 진행 감사합니다'] },
  { id: '31', name: '전해별', image: '/images/전해별/025209A2-09A8-4777-9A6A-DF4751F560A71772850104015.avif', rating: 4.8, reviews: 133, experience: 10, intro: '탄탄한 발성의 아나운서', youtubeId: 'Aooj1e0Wu2I', recentReviews: ['발성이 정말 좋으세요', '아나운서 진행 추천합니다', '마이크 없이도 잘 들렸어요'] },
  { id: '34', name: '정애란', image: '/images/정애란/IMG_2920.avif', rating: 4.9, reviews: 226, experience: 10, intro: '임기응변에 강한 따뜻한 목소리', youtubeId: 'uZCpxPN8I0Y', recentReviews: ['돌발상황도 자연스럽게!', '따뜻한 목소리에 감동', '위트있는 진행 최고였어요'] },
];

/* ─── Rotating Review Hook ─── */
function useRotatingReview(reviews: string[], interval = 4000) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (reviews.length <= 1) return;
    const timer = setInterval(() => setIdx(i => (i + 1) % reviews.length), interval);
    return () => clearInterval(timer);
  }, [reviews.length, interval]);
  return reviews[idx];
}

type Step = 'type' | 'plan' | 'detail' | 'pros' | 'confirm';

/* ─── Daum Postcode API ─── */
declare global {
  interface Window {
    daum: { Postcode: new (opts: { oncomplete: (data: { address: string; zonecode: string }) => void }) => { open: () => void } };
  }
}

function useDaumPostcode() {
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current || typeof window === 'undefined') return;
    if (document.querySelector('script[src*="postcode"]')) { loaded.current = true; return; }
    const s = document.createElement('script');
    s.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    s.async = true;
    document.head.appendChild(s);
    loaded.current = true;
  }, []);

  return (onComplete: (addr: string) => void) => {
    if (!window.daum) { toast.error('주소 검색을 불러오는 중입니다. 잠시 후 다시 시도해주세요.'); return; }
    new window.daum.Postcode({
      oncomplete: (data) => onComplete(data.address),
    }).open();
  };
}

export default function QuotePageWrapper() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-white flex items-center justify-center"><p className="text-gray-400 text-[14px]">로딩 중...</p></div>}>
      <QuotePage />
    </Suspense>
  );
}

function QuotePage() {
  const router = useRouter();
  const params = useSearchParams();
  const isEvent = params.get('mode') === 'event';
  const openPostcode = useDaumPostcode();

  const [step, setStep] = useState<Step>(isEvent ? 'type' : 'plan');
  const [eventType, setEventType] = useState('');
  const [plan, setPlan] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [note, setNote] = useState('');
  const [moods, setMoods] = useState<Set<string>>(new Set());
  const [selectedPros, setSelectedPros] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const toggleMood = (m: string) => setMoods((prev) => { const n = new Set(prev); n.has(m) ? n.delete(m) : n.add(m); return n; });
  const togglePro = (id: string) => setSelectedPros((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Time range: clicking sets start, then end
  const handleTimeClick = (slot: string) => {
    if (!timeStart || (timeStart && timeEnd)) {
      setTimeStart(slot);
      setTimeEnd('');
    } else {
      if (slot < timeStart) {
        setTimeEnd(timeStart);
        setTimeStart(slot);
      } else if (slot === timeStart) {
        setTimeEnd(slot);
      } else {
        setTimeEnd(slot);
      }
    }
  };

  const isInRange = (slot: string) => {
    if (!timeStart) return false;
    if (!timeEnd) return slot === timeStart;
    return slot >= timeStart && slot <= timeEnd;
  };

  const timeDisplay = timeStart && timeEnd ? `${timeStart} ~ ${timeEnd}` : timeStart || '';

  const handleSubmit = async () => {
    setSending(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSending(false);
    toast.success(isEvent ? '행사 견적 요청이 접수되었습니다.' : `${selectedPros.size}명의 사회자에게 견적을 보냈습니다.`);
    router.push('/home');
  };

  const canNext = () => {
    switch (step) {
      case 'type': return !!eventType;
      case 'plan': return !!plan;
      case 'detail': return !!location && !!date && !!timeStart && !!timeEnd;
      case 'pros': return isEvent || selectedPros.size > 0;
      default: return true;
    }
  };

  const nextStep = () => {
    if (step === 'type') setStep('plan');
    else if (step === 'plan') setStep('detail');
    else if (step === 'detail') setStep(isEvent ? 'confirm' : 'pros');
    else if (step === 'pros') setStep('confirm');
  };

  const prevStep = () => {
    if (step === 'plan') isEvent ? setStep('type') : router.back();
    else if (step === 'detail') setStep('plan');
    else if (step === 'pros') setStep('detail');
    else if (step === 'confirm') setStep(isEvent ? 'detail' : 'pros');
    else router.back();
  };

  // Service table click → select plan
  const handleTableCellClick = (planKey: string) => {
    setPlan(planKey);
  };

  const totalSteps = isEvent ? 4 : 4;
  const currentStep = isEvent
    ? ['type','plan','detail','confirm'].indexOf(step)
    : ['plan','detail','pros','confirm'].indexOf(step);

  // Date formatting
  const formatDate = (d: string) => {
    if (!d) return '';
    const dt = new Date(d);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${dt.getFullYear()}.${(dt.getMonth()+1).toString().padStart(2,'0')}.${dt.getDate().toString().padStart(2,'0')} (${days[dt.getDay()]})`;
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col" style={{ height: '100dvh', fontWeight: 400 }}>
      {/* 배경 영상 */}
      <div className="absolute top-0 left-0 right-0 h-[200px] overflow-hidden pointer-events-none" style={{ zIndex: -1 }}>
        <video
          src="/images/reference-video-1775801211148.mp4#t=0.001"
          autoPlay muted loop playsInline preload="none"
          className="w-full h-full object-cover"
          style={{ opacity: 0.2 }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-[100px] bg-gradient-to-t from-white to-transparent" />
      </div>

      {/* Header */}
      <div className="shrink-0 flex items-center px-4 h-[52px] relative z-10">
        <button onClick={prevStep} className="p-1 active:scale-90 transition-transform">
          <ChevronLeft size={24} className="text-gray-700" />
        </button>
      </div>

      {/* Progress */}
      <div className="shrink-0 px-6 pb-4 relative z-10">
        <div className="relative h-[3px] bg-gray-100 rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-[#3180F7] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          />
        </div>
        <p className="text-[11px] text-gray-300 mt-2 text-right">{currentStep + 1} / {totalSteps}</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-[10px] pb-6 relative z-10">
        {/* Step: 행사 유형 */}
        {step === 'type' && (
          <div>
            <h2 className="text-[22px] font-bold text-gray-900 mt-2 mb-1">어떤 행사인가요?</h2>
            <p className="text-[14px] text-gray-400 mb-6">행사 유형을 선택해주세요</p>
            <div className="grid grid-cols-2 gap-2.5">
              {EVENT_TYPES.map((t) => (
                <button key={t} onClick={() => setEventType(t)} className={`p-4 rounded-2xl border text-left transition-all active:scale-[0.97] ${eventType === t ? 'border-[#3180F7] bg-blue-50/60' : 'border-gray-100'}`}>
                  <p className={`text-[15px] font-semibold ${eventType === t ? 'text-[#3180F7]' : 'text-gray-600'}`}>{t}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: 플랜 선택 */}
        {step === 'plan' && (
          <div>
            <h2 className="text-[22px] font-bold text-gray-900 mt-2 mb-1">플랜을 선택해주세요</h2>
            <p className="text-[14px] text-gray-400 mb-6">행사 규모에 맞는 플랜을 골라주세요</p>

            {/* Plan selector — flat row */}
            <div className="flex gap-0 border-b border-gray-100">
              {PLANS.map((p) => {
                const active = plan === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlan(p.id)}
                    className="flex-1 py-4 flex flex-col items-center gap-1.5 relative transition-all active:scale-[0.97]"
                  >
                    <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'opacity-40'}`}>{p.icon}</div>
                    <p className={`text-[14px] font-bold transition-colors ${active ? 'text-gray-900' : 'text-gray-400'}`}>{p.label}</p>
                    <p className={`text-[12px] transition-colors ${active ? 'text-gray-500' : 'text-gray-300'}`}>{p.desc}</p>
                    <p className={`text-[15px] font-bold mt-0.5 transition-colors ${active ? 'text-[#3180F7]' : 'text-gray-300'}`}>{(p.price / 10000).toFixed(0)}만원~</p>
                    {active && (
                      <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-[#3180F7] rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Service comparison table — clickable */}
            <div className="mt-6">
              <p className="text-[13px] font-bold text-gray-900 mb-3">서비스 포함 내역</p>
              <div className="overflow-hidden rounded-xl border border-gray-100">
                {/* Table header */}
                <div className="grid grid-cols-4 bg-gray-50">
                  <div className="py-2.5 px-3 text-[11px] font-bold text-gray-400">서비스</div>
                  {PLANS.map((p) => (
                    <button key={p.id} onClick={() => setPlan(p.id)} className={`py-2.5 text-center text-[11px] font-bold transition-colors ${plan === p.id ? 'text-[#3180F7]' : 'text-gray-400'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
                {/* Table rows */}
                {SERVICE_TABLE.map((row, i) => (
                  <div key={row.name} className={`grid grid-cols-4 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${i < SERVICE_TABLE.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <div className="py-2.5 px-3 text-[12px] text-gray-600 font-medium flex items-center">{row.name}</div>
                    {(['premium', 'superior', 'enterprise'] as const).map((planKey) => {
                      const included = row[planKey];
                      const isActive = plan === planKey;
                      return (
                        <button
                          key={planKey}
                          onClick={() => handleTableCellClick(planKey)}
                          className={`py-2.5 flex items-center justify-center transition-colors ${isActive ? 'bg-blue-50/30' : ''}`}
                        >
                          {included ? (
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${isActive ? 'bg-[#3180F7]' : 'bg-gray-200'}`}>
                              <Check size={11} className="text-white" />
                            </div>
                          ) : (
                            <span className="text-[12px] text-gray-300">—</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-2">* 가격은 사회자에 따라 달라질 수 있습니다</p>
            </div>
          </div>
        )}

        {/* Step: 행사 정보 */}
        {step === 'detail' && (
          <div>
            <h2 className="text-[22px] font-bold text-gray-900 mt-2 mb-1">행사 정보를 입력해주세요</h2>
            <p className="text-[14px] text-gray-400 mb-6">장소, 날짜, 시간을 알려주세요</p>
            <div className="space-y-5">
              {/* 장소 — 다음 포스트 API */}
              <div>
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 mb-1.5"><LocationIcon />행사 장소</label>
                <button
                  onClick={() => openPostcode((addr) => setLocation(addr))}
                  className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl px-4 text-left flex items-center gap-2 active:bg-gray-100 transition-colors"
                >
                  <Search size={14} className="text-gray-400 shrink-0" />
                  <span className={`text-[15px] truncate ${location ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                    {location || '주소를 검색해주세요'}
                  </span>
                </button>
                {location && (
                  <p className="text-[12px] text-[#3180F7] mt-1.5 font-medium">{location}</p>
                )}
              </div>

              {/* 날짜 — date picker */}
              <div>
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 mb-1.5"><CalendarIcon />행사 날짜</label>
                <div className="relative">
                  <button
                    onClick={() => dateInputRef.current?.showPicker()}
                    className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl px-4 text-left flex items-center justify-between active:bg-gray-100 transition-colors"
                  >
                    <span className={`text-[15px] ${date ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                      {date ? formatDate(date) : '날짜를 선택해주세요'}
                    </span>
                    <ChevronDown size={16} className="text-gray-400" />
                  </button>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="absolute inset-0 opacity-0 pointer-events-none"
                  />
                </div>
              </div>

              {/* 시간 — 30분 단위 범위 선택 */}
              <div>
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 mb-1.5"><ClockIcon />행사 시간</label>
                {timeDisplay && (
                  <p className="text-[13px] text-[#3180F7] font-bold mb-2">{timeDisplay}</p>
                )}
                <p className="text-[11px] text-gray-400 mb-2">시작 시간과 종료 시간을 순서대로 선택해주세요</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {TIME_SLOTS.map((slot) => {
                    const inRange = isInRange(slot);
                    const isStart = slot === timeStart;
                    const isEnd = slot === timeEnd;
                    return (
                      <button
                        key={slot}
                        onClick={() => handleTimeClick(slot)}
                        className={`py-2 rounded-lg text-[13px] font-medium transition-all active:scale-95 ${
                          isStart || isEnd
                            ? 'bg-[#3180F7] text-white'
                            : inRange
                              ? 'bg-blue-100 text-[#3180F7]'
                              : 'bg-gray-50 text-gray-600 border border-gray-100'
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 선호 분위기 태그 */}
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-2">선호 분위기 (다중 선택)</label>
                <div className="flex flex-wrap gap-2">
                  {MOOD_TAGS.map((m) => {
                    const active = moods.has(m);
                    return (
                      <button key={m} onClick={() => toggleMood(m)} className={`px-3.5 py-2 rounded-full text-[13px] font-medium transition-all active:scale-95 ${active ? 'bg-[#3180F7] text-white' : 'bg-gray-100 text-gray-500'}`}>
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">추가 요청사항 (선택)</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="특별히 요청하실 사항이 있으시면 적어주세요" className="w-full h-24 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] text-gray-800 placeholder-gray-400 outline-none focus:border-[#3180F7] resize-none transition-colors" />
              </div>
            </div>
          </div>
        )}

        {/* Step: 사회자 선택 — 유튜브 영상 + 로테이팅 리뷰 */}
        {step === 'pros' && (
          <div>
            <h2 className="text-[22px] font-bold text-gray-900 mt-2 mb-1">사회자를 선택해주세요</h2>
            <p className="text-[14px] text-gray-400 mb-6">여러 명을 선택하면 동시에 견적을 받을 수 있어요</p>
            <div className="grid grid-cols-2 gap-3">
              {MOCK_PROS.map((pro) => (
                <ProSelectCard
                  key={pro.id}
                  pro={pro}
                  selected={selectedPros.has(pro.id)}
                  onToggle={() => togglePro(pro.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Step: 확인 */}
        {step === 'confirm' && (
          <div>
            <h2 className="text-[22px] font-bold text-gray-900 mt-2 mb-1">견적 요청 확인</h2>
            <p className="text-[14px] text-gray-400 mb-6">아래 내용을 확인하고 전송해주세요</p>
            <div className="bg-gray-50 rounded-2xl p-5 space-y-3">
              {isEvent && eventType && (
                <div className="flex justify-between"><span className="text-[13px] text-gray-500">행사 유형</span><span className="text-[13px] font-semibold text-gray-900">{eventType}</span></div>
              )}
              <div className="flex justify-between"><span className="text-[13px] text-gray-500">플랜</span><span className="text-[13px] font-semibold text-gray-900">{PLANS.find((p) => p.id === plan)?.label}</span></div>
              <div className="flex justify-between"><span className="text-[13px] text-gray-500">장소</span><span className="text-[13px] font-semibold text-gray-900 text-right max-w-[60%]">{location}</span></div>
              <div className="flex justify-between"><span className="text-[13px] text-gray-500">날짜</span><span className="text-[13px] font-semibold text-gray-900">{formatDate(date)}</span></div>
              <div className="flex justify-between"><span className="text-[13px] text-gray-500">시간</span><span className="text-[13px] font-semibold text-gray-900">{timeDisplay}</span></div>
              {moods.size > 0 && (
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-[13px] text-gray-500 mb-1">선호 분위기</p>
                  <div className="flex flex-wrap gap-1.5">{[...moods].map((m) => <span key={m} className="text-[11px] bg-blue-50 text-[#3180F7] px-2.5 py-1 rounded-full font-medium">{m}</span>)}</div>
                </div>
              )}
              {!isEvent && selectedPros.size > 0 && (
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-[13px] text-gray-500 mb-2">선택한 사회자 ({selectedPros.size}명)</p>
                  <div className="flex flex-wrap gap-2">
                    {MOCK_PROS.filter((p) => selectedPros.has(p.id)).map((p) => (
                      <div key={p.id} className="flex items-center gap-2 bg-white rounded-full pl-1 pr-3 py-1 border border-gray-200">
                        <img src={p.image} alt={p.name} className="w-6 h-6 rounded-full object-cover" />
                        <span className="text-[12px] font-medium text-gray-700">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {note && (
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-[13px] text-gray-500">추가 요청사항</p>
                  <p className="text-[13px] text-gray-700 mt-1">{note}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Button */}
      <div className="shrink-0 px-[10px] pb-6 pt-3 bg-white">
        {step === 'confirm' ? (
          <button
            onClick={handleSubmit}
            disabled={sending}
            className="w-full h-[52px] bg-[#3180F7] hover:bg-[#2568d9] text-white font-semibold rounded-2xl active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-[15px]"
          >
            <Send size={16} />
            {sending ? '전송 중...' : isEvent ? '견적 요청 보내기' : `${selectedPros.size}명에게 견적 보내기`}
          </button>
        ) : (
          <button
            onClick={nextStep}
            disabled={!canNext()}
            className={`w-full h-[52px] font-semibold rounded-2xl active:scale-[0.98] transition-all text-[15px] ${
              canNext() ? 'bg-[#3180F7] hover:bg-[#2568d9] text-white' : 'bg-gray-100 text-gray-400'
            }`}
          >
            다음
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Pro Select Card with YouTube + Rotating Review ─── */
function ProSelectCard({ pro, selected, onToggle }: {
  pro: typeof MOCK_PROS[0];
  selected: boolean;
  onToggle: () => void;
}) {
  const review = useRotatingReview(pro.recentReviews);
  const [reviewFade, setReviewFade] = useState(true);

  useEffect(() => {
    // Fade transition
    setReviewFade(false);
    const t = setTimeout(() => setReviewFade(true), 50);
    return () => clearTimeout(t);
  }, [review]);

  return (
    <button
      onClick={onToggle}
      className={`relative rounded-2xl overflow-hidden border text-left transition-all active:scale-[0.97] ${
        selected ? 'border-[#3180F7] shadow-md' : 'border-gray-100'
      }`}
    >
      <div className="relative aspect-[3/4]">
        <img src={pro.image} alt={pro.name} className="w-full h-full object-cover" />
        {selected && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-[#3180F7] rounded-full flex items-center justify-center shadow z-10">
            <Check size={14} className="text-white" />
          </div>
        )}
        {/* YouTube thumbnail — bottom right */}
        {pro.youtubeId && (
          <div className="absolute bottom-2 right-2 w-[52px] h-[52px] rounded-lg overflow-hidden shadow-lg border-2 border-white/80 z-10">
            <img
              src={`https://img.youtube.com/vi/${pro.youtubeId}/mqdefault.jpg`}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="w-4 h-4 rounded-full bg-red-600 flex items-center justify-center">
                <div className="w-0 h-0 border-l-[5px] border-l-white border-y-[3px] border-y-transparent ml-0.5" />
              </div>
            </div>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8">
          <p className="text-[14px] font-semibold text-white">{pro.name}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Star size={10} className="text-amber-400 fill-amber-400" />
            <span className="text-[11px] text-white/90">{pro.rating.toFixed(1)} · 리뷰 {pro.reviews}</span>
          </div>
        </div>
      </div>
      <div className="p-2.5">
        <p className="text-[11px] text-gray-500 line-clamp-1 leading-relaxed">{pro.intro}</p>
        {/* Rotating review */}
        <div className="mt-1.5 flex items-start gap-1">
          <span className="text-[9px] text-[#3180F7] font-bold shrink-0 mt-px">리뷰</span>
          <p
            className={`text-[10px] text-gray-400 line-clamp-1 transition-opacity duration-300 ${reviewFade ? 'opacity-100' : 'opacity-0'}`}
          >
            &ldquo;{review}&rdquo;
          </p>
        </div>
      </div>
    </button>
  );
}
