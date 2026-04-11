'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Check, Send, Star } from 'lucide-react';
import toast from 'react-hot-toast';

/* ─── 직접 그린 아이콘들 ─── */
const PlanIconPremium = () => (
  <svg width={28} height={28} viewBox="0 0 24 24" fill="none">
    <path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.4l-6.4 4.8 2.4-7.2-6-4.8h7.6L12 2z" fill="#3B82F6"/>
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
    <rect x="3" y="6" width="18" height="14" rx="3" fill="#F59E0B"/>
    <path d="M8 6V4a4 4 0 018 0v2" stroke="#D97706" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="12" cy="14" r="2" fill="white"/>
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

const EVENT_TYPES = ['결혼식', '돌잔치', '기업행사', '공식행사', '체육대회', '레크리에이션', '팀빌딩', '송년회', '컨퍼런스', '라이브커머스', '기업PT', '워크숍'];

const MOOD_TAGS = ['격식있는', '따뜻한', '유쾌한', '감동적인', '차분한', '에너지넘치는', '프리미엄', '친근한', '세련된', '로맨틱한'];

const MOCK_PROS = [
  { id: '15', name: '박인애', image: '/images/박인애/IMG_0196.avif', images: ['/images/박인애/IMG_0196.avif','/images/박인애/IMG_7549.avif'], rating: 4.9, reviews: 134, experience: 13, intro: '13년 생방송 뉴스 진행으로 다져진 품격있는 사회자' },
  { id: '23', name: '이승진', image: '/images/이승진/IMG_46511771924269213.avif', images: ['/images/이승진/IMG_46511771924269213.avif','/images/이승진/IMG_75131771924219656.avif'], rating: 4.8, reviews: 211, experience: 4, intro: '따뜻하고 깔끔한 진행의 사회자' },
  { id: '31', name: '전해별', image: '/images/전해별/IMG_73341772850094485.avif', images: ['/images/전해별/IMG_73341772850094485.avif'], rating: 4.8, reviews: 133, experience: 10, intro: '탄탄한 발성의 아나운서' },
  { id: '12', name: '문정은', image: '/images/문정은/IMG_27221772621229571.avif', images: ['/images/문정은/IMG_27221772621229571.avif'], rating: 4.6, reviews: 216, experience: 10, intro: '품격있고 고급스러운 진행' },
  { id: '25', name: '이우영', image: '/images/이우영/2-11772248201484.avif', images: ['/images/이우영/2-11772248201484.avif'], rating: 4.7, reviews: 158, experience: 8, intro: '현직 아나운서의 고품격 진행' },
  { id: '35', name: '정이현', image: '/images/정이현/44561772622988798.avif', images: ['/images/정이현/44561772622988798.avif'], rating: 4.9, reviews: 34, experience: 10, intro: '정이현 사회자입니다' },
  { id: '1', name: '강도현', image: '/images/강도현/10000133881772850005043.avif', images: ['/images/강도현/10000133881772850005043.avif'], rating: 4.6, reviews: 117, experience: 14, intro: '신뢰감 있는 보이스' },
  { id: '5', name: '김유석', image: '/images/김유석/10000029811773033474612.avif', images: ['/images/김유석/10000029811773033474612.avif'], rating: 4.7, reviews: 65, experience: 8, intro: '최고의 진행자 아나운서' },
  { id: '24', name: '이용석', image: '/images/이용석/10001176941772847263491.avif', images: ['/images/이용석/10001176941772847263491.avif'], rating: 4.9, reviews: 239, experience: 11, intro: '1000회 이상 결혼식사회' },
];

type Step = 'type' | 'plan' | 'detail' | 'pros' | 'confirm';

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

  const [step, setStep] = useState<Step>(isEvent ? 'type' : 'plan');
  const [eventType, setEventType] = useState('');
  const [plan, setPlan] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [moods, setMoods] = useState<Set<string>>(new Set());
  const [selectedPros, setSelectedPros] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const toggleMood = (m: string) => setMoods((prev) => { const n = new Set(prev); n.has(m) ? n.delete(m) : n.add(m); return n; });
  const togglePro = (id: string) => setSelectedPros((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

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
      case 'detail': return !!location && !!date && !!time;
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

  const totalSteps = isEvent ? 4 : 4;
  const currentStep = isEvent
    ? ['type','plan','detail','confirm'].indexOf(step)
    : ['plan','detail','pros','confirm'].indexOf(step);

  return (
    <div className="fixed inset-0 bg-white flex flex-col" style={{ height: '100dvh', fontWeight: 400 }}>
      {/* 배경 영상 (opacity 20%) — 최하단 레이어 */}
      <div className="absolute top-0 left-0 right-0 h-[200px] overflow-hidden pointer-events-none" style={{ zIndex: -1 }}>
        <video
          src="/images/reference-video-1775801211148.mp4#t=0.001"
          autoPlay muted loop playsInline preload="none"
          className="w-full h-full object-cover"
          style={{ opacity: 0.2 }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-[100px] bg-gradient-to-t from-white to-transparent" />
      </div>

      {/* Header — 텍스트 없음, 뒤로가기만 */}
      <div className="shrink-0 flex items-center px-4 h-[52px] relative z-10">
        <button onClick={prevStep} className="p-1 active:scale-90 transition-transform">
          <ChevronLeft size={24} className="text-gray-700" />
        </button>
      </div>

      {/* Progress — 부드러운 라인 인디케이터 */}
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
      <div className="flex-1 overflow-y-auto px-5 pb-6 relative z-10">
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

        {/* Step: 플랜 — 가로형 3*1 카드, 클릭 시 확대 */}
        {step === 'plan' && (
          <div>
            <h2 className="text-[22px] font-bold text-gray-900 mt-2 mb-1">플랜을 선택해주세요</h2>
            <p className="text-[14px] text-gray-400 mb-6">행사 규모에 맞는 플랜을 골라주세요</p>
            <div className="grid grid-cols-3 gap-2.5">
              {PLANS.map((p) => {
                const active = plan === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlan(p.id)}
                    className={`relative flex flex-col items-center p-4 rounded-2xl border text-center transition-all duration-300 active:scale-[0.95] ${
                      active ? `border-[#3180F7] ${p.color} scale-[1.05] shadow-md` : 'border-gray-100'
                    }`}
                  >
                    {active && <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#3180F7] rounded-full flex items-center justify-center"><Check size={12} className="text-white" /></div>}
                    <div className="mb-2">{p.icon}</div>
                    <p className={`text-[13px] font-semibold ${active ? 'text-gray-900' : 'text-gray-600'}`}>{p.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{p.desc}</p>
                    <p className={`text-[13px] font-bold mt-2 ${active ? 'text-[#3180F7]' : 'text-gray-700'}`}>{(p.price / 10000).toFixed(0)}만원</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step: 행사 정보 + 선호 분위기 */}
        {step === 'detail' && (
          <div>
            <h2 className="text-[22px] font-bold text-gray-900 mt-2 mb-1">행사 정보를 입력해주세요</h2>
            <p className="text-[14px] text-gray-400 mb-6">장소, 날짜, 시간을 알려주세요</p>
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 mb-1.5"><LocationIcon />행사 장소</label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="예: 서울 강남 더시에나호텔" className="input text-[16px]" />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 mb-1.5"><CalendarIcon />행사 날짜</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input text-[16px]" />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 mb-1.5"><ClockIcon />행사 시간</label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input text-[16px]" />
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
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="특별히 요청하실 사항이 있으시면 적어주세요" className="input text-[16px] h-24 resize-none" />
              </div>
            </div>
          </div>
        )}

        {/* Step: 사회자 선택 — 세로형 카드 그리드 */}
        {step === 'pros' && (
          <div>
            <h2 className="text-[22px] font-bold text-gray-900 mt-2 mb-1">사회자를 선택해주세요</h2>
            <p className="text-[14px] text-gray-400 mb-6">여러 명을 선택하면 동시에 견적을 받을 수 있어요</p>
            <div className="grid grid-cols-2 gap-3">
              {MOCK_PROS.map((pro) => {
                const selected = selectedPros.has(pro.id);
                return (
                  <button
                    key={pro.id}
                    onClick={() => togglePro(pro.id)}
                    className={`relative rounded-2xl overflow-hidden border text-left transition-all active:scale-[0.97] ${
                      selected ? 'border-[#3180F7] shadow-md' : 'border-gray-100'
                    }`}
                  >
                    <div className="relative aspect-[3/4]">
                      <img src={pro.image} alt={pro.name} className="w-full h-full object-cover" />
                      {selected && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-[#3180F7] rounded-full flex items-center justify-center shadow">
                          <Check size={14} className="text-white" />
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
                      <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">{pro.intro}</p>
                      <p className="text-[10px] text-gray-400 mt-1">경력 {pro.experience}년</p>
                    </div>
                  </button>
                );
              })}
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
              <div className="flex justify-between"><span className="text-[13px] text-gray-500">장소</span><span className="text-[13px] font-semibold text-gray-900">{location}</span></div>
              <div className="flex justify-between"><span className="text-[13px] text-gray-500">날짜</span><span className="text-[13px] font-semibold text-gray-900">{date}</span></div>
              <div className="flex justify-between"><span className="text-[13px] text-gray-500">시간</span><span className="text-[13px] font-semibold text-gray-900">{time}</span></div>
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
      <div className="shrink-0 px-5 pb-6 pt-3 bg-white">
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
