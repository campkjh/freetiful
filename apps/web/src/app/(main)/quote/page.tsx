'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Check, Send, Star, ChevronDown, Search } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import toast from 'react-hot-toast';

const stepVariants = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};
const staggerContainer = { animate: { transition: { staggerChildren: 0.04 } } };
const staggerItem = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

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

/* ─── Daum Postcode API (embed modal) ─── */
declare global {
  interface Window {
    daum: {
      Postcode: new (opts: {
        oncomplete: (data: { address: string; zonecode: string }) => void;
        width: string;
        height: string;
      }) => { embed: (el: HTMLElement) => void };
    };
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

  return loaded;
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
  const postcodeLoaded = useDaumPostcode();

  const [step, setStep] = useState<Step>(isEvent ? 'type' : 'plan');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const addressEmbedRef = useRef<HTMLDivElement>(null);
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
  const [nearbyVenues, setNearbyVenues] = useState<{ name: string; address: string; phone: string; distance: number; url: string }[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSurveyPrompt, setShowSurveyPrompt] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  const [surveyStep, setSurveyStep] = useState(0);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string>>({});
  const dateInputRef = useRef<HTMLInputElement>(null);

  const toggleMood = (m: string) => setMoods((prev) => { const n = new Set(prev); n.has(m) ? n.delete(m) : n.add(m); return n; });

  // Embed Daum Postcode when modal opens
  useEffect(() => {
    if (!showAddressModal || !addressEmbedRef.current || !window.daum) return;
    addressEmbedRef.current.innerHTML = '';
    new window.daum.Postcode({
      oncomplete: (data) => {
        setLocation(data.address);
        setShowAddressModal(false);
      },
      width: '100%',
      height: '100%',
    }).embed(addressEmbedRef.current);
  }, [showAddressModal]);

  // Fetch nearby wedding venues when location changes
  useEffect(() => {
    if (!location) { setNearbyVenues([]); return; }
    let cancelled = false;
    setVenuesLoading(true);
    fetch(`/api/nearby-venues?address=${encodeURIComponent(location)}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setNearbyVenues(data.venues || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setVenuesLoading(false); });
    return () => { cancelled = true; };
  }, [location]);

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

  const handleSubmitClick = () => {
    if (localStorage.getItem('freetiful-logged-in') !== 'true') {
      router.push('/my');
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirm = async () => {
    setShowConfirmModal(false);
    const hasSubmitted = localStorage.getItem('freetiful-quote-submitted');
    if (!hasSubmitted) {
      setShowSurveyPrompt(true);
      return;
    }
    await doSubmit();
  };

  const handleSurveyAccept = () => {
    setShowSurveyPrompt(false);
    setShowSurvey(true);
  };

  const handleSurveyDecline = async () => {
    setShowSurveyPrompt(false);
    await doSubmit();
  };

  const doSubmit = async () => {
    setSending(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSending(false);
    localStorage.setItem('freetiful-quote-submitted', 'true');
    toast.success(isEvent ? '행사 견적 요청이 접수되었습니다.' : `${selectedPros.size}명의 사회자에게 견적을 보냈습니다.`);
    router.push('/main');
  };

  const handleSurveyComplete = async () => {
    setShowSurvey(false);
    await doSubmit();
  };

  const SURVEY_QUESTIONS = [
    { key: 'dress', question: '드레스는 준비하셨나요?', options: ['대여 완료', '대여 예정', '구매 예정', '아직 미정'] },
    { key: 'photo', question: '본식 스냅/영상 촬영은?', options: ['스냅 + 영상 모두', '스냅만', '영상만', '촬영 안 함', '아직 미정'] },
    { key: 'bouquet', question: '부케/꽃 장식은?', options: ['생화 부케', '조화 부케', '플라워 장식 포함', '아직 미정'] },
    { key: 'makeup', question: '헤어 · 메이크업은?', options: ['업체 계약 완료', '알아보는 중', '셀프 예정', '아직 미정'] },
    { key: 'singer', question: '축가 · 연주는?', options: ['섭외 완료', '섭외 예정', '필요 없음', '아직 미정'] },
    { key: 'honeymoon', question: '신혼여행은?', options: ['예약 완료', '알아보는 중', '나중에 예정', '아직 미정'] },
  ];

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
        <AnimatePresence>
        {/* Step: 행사 유형 */}
        {step === 'type' && (
          <motion.div key="type" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-[22px] font-bold text-gray-900 mt-2 mb-1">어떤 행사인가요?</motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="text-[14px] text-gray-400 mb-6">행사 유형을 선택해주세요</motion.p>
            <motion.div className="grid grid-cols-2 gap-2.5" variants={staggerContainer} initial="initial" animate="animate">
              {EVENT_TYPES.map((t) => (
                <motion.button key={t} variants={staggerItem} whileTap={{ scale: 0.95 }} onClick={() => setEventType(t)} className={`p-4 rounded-2xl border text-left transition-colors ${eventType === t ? 'border-[#3180F7] bg-blue-50/60' : 'border-gray-100'}`}>
                  <p className={`text-[15px] font-semibold ${eventType === t ? 'text-[#3180F7]' : 'text-gray-600'}`}>{t}</p>
                </motion.button>
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* Step: 플랜 선택 */}
        {step === 'plan' && (
          <motion.div key="plan" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-[22px] font-bold text-gray-900 mt-2 mb-1">플랜을 선택해주세요</motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="text-[14px] text-gray-400 mb-6">행사 규모에 맞는 플랜을 골라주세요</motion.p>

            {/* Plan selector — flat row with layoutId indicator */}
            <LayoutGroup id="plan-tabs">
              <div className="flex gap-0 border-b border-gray-100">
                {PLANS.map((p) => {
                  const active = plan === p.id;
                  return (
                    <motion.button
                      key={p.id}
                      onClick={() => setPlan(p.id)}
                      whileTap={{ scale: 0.95 }}
                      className="flex-1 py-4 flex flex-col items-center gap-1.5 relative"
                    >
                      <motion.div animate={{ scale: active ? 1.1 : 1, opacity: active ? 1 : 0.4 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>{p.icon}</motion.div>
                      <p className={`text-[14px] font-bold transition-colors ${active ? 'text-gray-900' : 'text-gray-400'}`}>{p.label}</p>
                      <p className={`text-[12px] transition-colors ${active ? 'text-gray-500' : 'text-gray-300'}`}>{p.desc}</p>
                      <p className={`text-[15px] font-bold mt-0.5 transition-colors ${active ? 'text-[#3180F7]' : 'text-gray-300'}`}>{(p.price / 10000).toFixed(0)}만원~</p>
                      {active && (
                        <motion.div layoutId="plan-indicator" className="absolute bottom-0 left-3 right-3 h-[2px] bg-[#3180F7] rounded-full" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </LayoutGroup>

            {/* Service comparison table — clickable */}
            <motion.div className="mt-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <p className="text-[13px] font-bold text-gray-900 mb-3">서비스 포함 내역</p>
              <div className="overflow-hidden rounded-xl border border-gray-100">
                <div className="grid grid-cols-4 bg-gray-50">
                  <div className="py-2.5 px-3 text-[11px] font-bold text-gray-400">서비스</div>
                  {PLANS.map((p) => (
                    <button key={p.id} onClick={() => setPlan(p.id)} className={`py-2.5 text-center text-[11px] font-bold transition-colors ${plan === p.id ? 'text-[#3180F7]' : 'text-gray-400'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
                {SERVICE_TABLE.map((row, i) => (
                  <motion.div key={row.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 + i * 0.03 }} className={`grid grid-cols-4 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${i < SERVICE_TABLE.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <div className="py-2.5 px-3 text-[12px] text-gray-600 font-medium flex items-center">{row.name}</div>
                    {(['premium', 'superior', 'enterprise'] as const).map((planKey) => {
                      const included = row[planKey];
                      const isActive = plan === planKey;
                      return (
                        <button key={planKey} onClick={() => handleTableCellClick(planKey)} className={`py-2.5 flex items-center justify-center transition-colors ${isActive ? 'bg-blue-50/30' : ''}`}>
                          {included ? (
                            <motion.div animate={{ scale: isActive ? 1 : 0.85, backgroundColor: isActive ? '#3180F7' : '#E5E7EB' }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="w-5 h-5 rounded-full flex items-center justify-center">
                              <Check size={11} className="text-white" />
                            </motion.div>
                          ) : (
                            <span className="text-[12px] text-gray-300">—</span>
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-2">* 가격은 사회자에 따라 달라질 수 있습니다</p>
            </motion.div>
          </motion.div>
        )}

        {/* Step: 행사 정보 */}
        {step === 'detail' && (
          <motion.div key="detail" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-[22px] font-bold text-gray-900 mt-2 mb-1">행사 정보를 입력해주세요</motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="text-[14px] text-gray-400 mb-6">장소, 날짜, 시간을 알려주세요</motion.p>
            <div className="space-y-5">
              {/* 장소 */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 mb-1.5"><LocationIcon />행사 장소</label>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAddressModal(true)}
                  className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl px-4 text-left flex items-center gap-2 active:bg-gray-100 transition-colors"
                >
                  <Search size={14} className="text-gray-400 shrink-0" />
                  <span className={`text-[15px] truncate ${location ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                    {location || '주소를 검색해주세요'}
                  </span>
                </motion.button>
                <AnimatePresence>
                  {location && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-[12px] text-[#3180F7] mt-1.5 font-medium">{location}</motion.p>
                  )}
                </AnimatePresence>

                {/* Nearby Wedding Venues */}
                <AnimatePresence>
                  {location && (venuesLoading || nearbyVenues.length > 0) && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 21V7l9-4 9 4v14" stroke="#3180F7" strokeWidth="2" strokeLinejoin="round"/><path d="M9 21V13h6v8" stroke="#3180F7" strokeWidth="2" strokeLinejoin="round"/></svg>
                        <span className="text-[12px] font-bold text-gray-700">근처 웨딩홀</span>
                        {venuesLoading && <span className="text-[10px] text-gray-400 ml-1">검색중...</span>}
                      </div>
                      {nearbyVenues.length > 0 && (
                        <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                          {nearbyVenues.slice(0, 5).map((v, i) => {
                            const isSelected = selectedVenue === v.name;
                            return (
                              <motion.button
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setSelectedVenue(isSelected ? null : v.name)}
                                className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all ${
                                  isSelected ? 'bg-blue-50 border border-[#3180F7]' : 'bg-gray-50 border border-transparent'
                                }`}
                              >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-[#3180F7]' : 'bg-blue-100'}`}>
                                  {isSelected ? (
                                    <Check size={14} className="text-white" />
                                  ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 21V7l9-4 9 4v14" stroke="#3180F7" strokeWidth="2" strokeLinejoin="round"/><path d="M9 21V13h6v8" stroke="#3180F7" strokeWidth="2" strokeLinejoin="round"/></svg>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-[13px] font-semibold truncate ${isSelected ? 'text-[#3180F7]' : 'text-gray-900'}`}>{v.name}</p>
                                  <p className="text-[11px] text-gray-400 truncate">{v.address}</p>
                                </div>
                                <span className="text-[11px] text-[#3180F7] font-bold shrink-0">
                                  {v.distance < 1000 ? `${v.distance}m` : `${(v.distance / 1000).toFixed(1)}km`}
                                </span>
                              </motion.button>
                            );
                          })}
                        </div>
                      )}
                      {!venuesLoading && nearbyVenues.length === 0 && location && (
                        <p className="text-[11px] text-gray-400">근처에 웨딩홀이 없습니다</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* 날짜 */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 mb-1.5"><CalendarIcon />행사 날짜</label>
                <div className="relative">
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl px-4 text-[15px] text-gray-900 outline-none focus:border-[#3180F7] transition-colors appearance-none"
                    style={{ colorScheme: 'light' }}
                  />
                  {!date && (
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-gray-400 pointer-events-none">날짜를 선택해주세요</span>
                  )}
                </div>
              </motion.div>

              {/* 시간 */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 mb-1.5"><ClockIcon />행사 시간</label>
                <AnimatePresence>
                  {timeDisplay && (
                    <motion.p initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-[13px] text-[#3180F7] font-bold mb-2">{timeDisplay}</motion.p>
                  )}
                </AnimatePresence>
                <p className="text-[11px] text-gray-400 mb-2">시작 시간과 종료 시간을 순서대로 선택해주세요</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {TIME_SLOTS.map((slot) => {
                    const inRange = isInRange(slot);
                    const isStart = slot === timeStart;
                    const isEnd = slot === timeEnd;
                    return (
                      <motion.button
                        key={slot}
                        whileTap={{ scale: 0.9 }}
                        animate={{
                          backgroundColor: isStart || isEnd ? '#3180F7' : inRange ? '#DBEAFE' : '#F9FAFB',
                          color: isStart || isEnd ? '#FFFFFF' : inRange ? '#3180F7' : '#4B5563',
                        }}
                        transition={{ duration: 0.2 }}
                        onClick={() => handleTimeClick(slot)}
                        className={`py-2 rounded-lg text-[13px] font-medium ${!inRange && !isStart && !isEnd ? 'border border-gray-100' : ''}`}
                      >
                        {slot}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>

              {/* 선호 분위기 태그 */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <label className="block text-[13px] font-semibold text-gray-700 mb-2">선호 분위기 (다중 선택)</label>
                <div className="flex flex-wrap gap-2">
                  {MOOD_TAGS.map((m) => {
                    const active = moods.has(m);
                    return (
                      <motion.button key={m} whileTap={{ scale: 0.9 }} animate={{ backgroundColor: active ? '#3180F7' : '#F3F4F6', color: active ? '#FFFFFF' : '#6B7280' }} transition={{ duration: 0.2 }} onClick={() => toggleMood(m)} className="px-3.5 py-2 rounded-full text-[13px] font-medium">
                        {m}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">추가 요청사항 (선택)</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="특별히 요청하실 사항이 있으시면 적어주세요" className="w-full h-24 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] text-gray-800 placeholder-gray-400 outline-none focus:border-[#3180F7] resize-none transition-colors" />
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Step: 사회자 선택 */}
        {step === 'pros' && (
          <motion.div key="pros" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-[22px] font-bold text-gray-900 mt-2 mb-1">사회자를 선택해주세요</motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="text-[14px] text-gray-400 mb-6">여러 명을 선택하면 동시에 견적을 받을 수 있어요</motion.p>
            <motion.div className="grid grid-cols-2 gap-3" variants={staggerContainer} initial="initial" animate="animate">
              {MOCK_PROS.map((pro) => (
                <motion.div key={pro.id} variants={staggerItem}>
                  <ProSelectCard
                    pro={pro}
                    selected={selectedPros.has(pro.id)}
                    onToggle={() => togglePro(pro.id)}
                  />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* Step: 확인 */}
        {step === 'confirm' && (
          <motion.div key="confirm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-[22px] font-bold text-gray-900 mt-2 mb-1">견적 요청 확인</motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="text-[14px] text-gray-400 mb-6">아래 내용을 확인하고 전송해주세요</motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }} className="bg-gray-50 rounded-2xl p-5 space-y-3">
              {isEvent && eventType && (
                <div className="flex justify-between"><span className="text-[13px] text-gray-500">행사 유형</span><span className="text-[13px] font-semibold text-gray-900">{eventType}</span></div>
              )}
              <div className="flex justify-between"><span className="text-[13px] text-gray-500">플랜</span><span className="text-[13px] font-semibold text-gray-900">{PLANS.find((p) => p.id === plan)?.label}</span></div>
              <div className="flex justify-between"><span className="text-[13px] text-gray-500">장소</span><span className="text-[13px] font-semibold text-gray-900 text-right max-w-[60%]">{location}</span></div>
              {selectedVenue && (
                <div className="flex justify-between"><span className="text-[13px] text-gray-500">웨딩홀</span><span className="text-[13px] font-semibold text-[#3180F7] text-right max-w-[60%]">{selectedVenue}</span></div>
              )}
              <div className="flex justify-between"><span className="text-[13px] text-gray-500">날짜</span><span className="text-[13px] font-semibold text-gray-900">{formatDate(date)}</span></div>
              <div className="flex justify-between"><span className="text-[13px] text-gray-500">시간</span><span className="text-[13px] font-semibold text-gray-900">{timeDisplay}</span></div>
              {moods.size > 0 && (
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-[13px] text-gray-500 mb-1">선호 분위기</p>
                  <div className="flex flex-wrap gap-1.5">{[...moods].map((m) => <motion.span key={m} initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-[11px] bg-blue-50 text-[#3180F7] px-2.5 py-1 rounded-full font-medium">{m}</motion.span>)}</div>
                </div>
              )}
              {!isEvent && selectedPros.size > 0 && (
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-[13px] text-gray-500 mb-2">선택한 사회자 ({selectedPros.size}명)</p>
                  <div className="flex flex-wrap gap-2">
                    {MOCK_PROS.filter((p) => selectedPros.has(p.id)).map((p, i) => (
                      <motion.div key={p.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-2 bg-white rounded-full pl-1 pr-3 py-1 border border-gray-200">
                        <img src={p.image} alt={p.name} className="w-6 h-6 rounded-full object-cover" />
                        <span className="text-[12px] font-medium text-gray-700">{p.name}</span>
                      </motion.div>
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
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* Address Search Modal */}
      <AnimatePresence>
        {showAddressModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col bg-black/40"
            onClick={() => setShowAddressModal(false)}
          >
            <div className="flex-1" />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="bg-white rounded-t-2xl overflow-hidden"
              style={{ height: '75vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="text-[16px] font-bold text-gray-900">주소 검색</h3>
                <button onClick={() => setShowAddressModal(false)} className="p-1 text-gray-400 active:scale-90 transition-transform">
                  <ChevronDown size={24} />
                </button>
              </div>
              <div ref={addressEmbedRef} className="w-full" style={{ height: 'calc(75vh - 52px)' }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-8"
            onClick={() => setShowConfirmModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 mx-auto mb-4">
                <Send size={20} className="text-[#3180F7]" />
              </div>
              <h3 className="text-[18px] font-bold text-gray-900 text-center">정말로 요청하시겠습니까?</h3>
              <p className="text-[13px] text-gray-500 text-center mt-2 leading-relaxed">
                {isEvent ? '행사 견적 요청을 전송합니다.' : `${selectedPros.size}명의 사회자에게 견적 요청을 보냅니다.`}
              </p>
              <div className="flex gap-2.5 mt-6">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 h-[46px] rounded-xl bg-gray-100 text-[14px] font-semibold text-gray-600"
                >
                  취소
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleConfirm}
                  className="flex-1 h-[46px] rounded-xl bg-[#3180F7] text-[14px] font-semibold text-white"
                >
                  요청하기
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Survey Prompt Modal — coffee coupon */}
      <AnimatePresence>
        {showSurveyPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-8"
            onClick={() => setShowSurveyPrompt(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"
            >
              {/* Coffee icon */}
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M17 8h1a4 4 0 010 8h-1" stroke="#D97706" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z" fill="#FBBF24"/>
                  <path d="M7 1v3M10 1v3M13 1v3" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <h3 className="text-[18px] font-bold text-gray-900 text-center leading-snug">
                간단한 설문에 참여하시면<br/>
                <span className="text-[#D97706]">컴포즈 커피 쿠폰</span>을 드려요!
              </h3>
              <p className="text-[13px] text-gray-500 text-center mt-2.5 leading-relaxed">
                웨딩 준비 현황에 대한 간단한 설문입니다.<br/>약 1분 정도 소요됩니다.
              </p>
              <div className="flex gap-2.5 mt-6">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSurveyDecline}
                  className="flex-1 h-[46px] rounded-xl bg-gray-100 text-[14px] font-semibold text-gray-500"
                >
                  괜찮아요
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSurveyAccept}
                  className="flex-1 h-[46px] rounded-xl bg-[#D97706] text-[14px] font-semibold text-white"
                >
                  참여할게요
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Survey Modal (first-time users) */}
      <AnimatePresence>
        {showSurvey && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col bg-white"
          >
            <div className="flex items-center px-4 h-[52px]">
              <button onClick={() => { setShowSurvey(false); doSubmit(); }} className="text-[13px] text-gray-400 font-medium">건너뛰기</button>
            </div>

            {/* Survey progress */}
            <div className="px-6 pb-4">
              <div className="relative h-[3px] bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="absolute left-0 top-0 h-full bg-[#3180F7] rounded-full"
                  animate={{ width: `${((surveyStep + 1) / SURVEY_QUESTIONS.length) * 100}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <p className="text-[11px] text-gray-300 mt-2 text-right">{surveyStep + 1} / {SURVEY_QUESTIONS.length}</p>
            </div>

            <div className="flex-1 overflow-y-auto px-[10px] pb-6">
              <AnimatePresence>
                <motion.div
                  key={surveyStep}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <p className="text-[12px] text-[#3180F7] font-bold mb-2">웨딩 준비 현황</p>
                  <h2 className="text-[22px] font-bold text-gray-900 mb-1">{SURVEY_QUESTIONS[surveyStep].question}</h2>
                  <p className="text-[14px] text-gray-400 mb-6">현재 상태를 선택해주세요</p>
                  <div className="space-y-2.5">
                    {SURVEY_QUESTIONS[surveyStep].options.map((opt, i) => {
                      const selected = surveyAnswers[SURVEY_QUESTIONS[surveyStep].key] === opt;
                      return (
                        <motion.button
                          key={opt}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setSurveyAnswers(prev => ({ ...prev, [SURVEY_QUESTIONS[surveyStep].key]: opt }))}
                          className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
                            selected ? 'border-[#3180F7] bg-blue-50/60' : 'border-gray-100'
                          }`}
                        >
                          <p className={`text-[15px] font-semibold ${selected ? 'text-[#3180F7]' : 'text-gray-600'}`}>{opt}</p>
                          {selected && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-5 h-5 rounded-full bg-[#3180F7] flex items-center justify-center">
                              <Check size={12} className="text-white" />
                            </motion.div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="shrink-0 px-[10px] pb-6 pt-3">
              <motion.button
                whileTap={{ scale: 0.96 }}
                animate={{
                  backgroundColor: surveyAnswers[SURVEY_QUESTIONS[surveyStep].key] ? '#3180F7' : '#F3F4F6',
                  color: surveyAnswers[SURVEY_QUESTIONS[surveyStep].key] ? '#FFFFFF' : '#9CA3AF',
                }}
                transition={{ duration: 0.25 }}
                disabled={!surveyAnswers[SURVEY_QUESTIONS[surveyStep].key]}
                onClick={() => {
                  if (surveyStep < SURVEY_QUESTIONS.length - 1) {
                    setSurveyStep(s => s + 1);
                  } else {
                    handleSurveyComplete();
                  }
                }}
                className="w-full h-[52px] font-semibold rounded-2xl text-[15px]"
              >
                {surveyStep < SURVEY_QUESTIONS.length - 1 ? '다음' : '완료'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Button */}
      <div className="shrink-0 px-[10px] pb-6 pt-3 bg-white">
        {step === 'confirm' ? (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleSubmitClick}
            disabled={sending}
            className="w-full h-[52px] bg-[#3180F7] hover:bg-[#2568d9] text-white font-semibold rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-[15px]"
          >
            <Send size={16} />
            {sending ? '전송 중...' : isEvent ? '견적 요청 보내기' : `${selectedPros.size}명에게 견적 보내기`}
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.96 }}
            animate={{ backgroundColor: canNext() ? '#3180F7' : '#F3F4F6', color: canNext() ? '#FFFFFF' : '#9CA3AF' }}
            transition={{ duration: 0.25 }}
            onClick={nextStep}
            disabled={!canNext()}
            className="w-full h-[52px] font-semibold rounded-2xl text-[15px]"
          >
            다음
          </motion.button>
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
  const [displayReview, setDisplayReview] = useState(review);
  const [reviewKey, setReviewKey] = useState(0);

  useEffect(() => {
    setReviewKey(k => k + 1);
    setDisplayReview(review);
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
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-2 right-2 w-6 h-6 bg-[#3180F7] rounded-full flex items-center justify-center shadow z-10"
          >
            <Check size={14} className="text-white" />
          </motion.div>
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
          <p className="text-[15px] font-bold text-white">{pro.name}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Star size={11} className="text-amber-400 fill-amber-400" />
            <span className="text-[12px] text-white/90 font-medium">{pro.rating.toFixed(1)} · 리뷰 {pro.reviews}</span>
          </div>
        </div>
      </div>
      <div className="p-3">
        <p className="text-[13px] text-gray-700 font-medium line-clamp-1 leading-snug">{pro.intro}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">경력 {pro.experience}년</p>
        {/* Rotating review with slide animation */}
        <div className="mt-2 flex items-start gap-1.5 overflow-hidden">
          <span className="text-[10px] text-[#3180F7] font-bold shrink-0 mt-0.5">리뷰</span>
          <AnimatePresence mode="wait">
            <motion.p
              key={reviewKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="text-[11px] text-gray-500 line-clamp-1"
            >
              &ldquo;{displayReview}&rdquo;
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </button>
  );
}
