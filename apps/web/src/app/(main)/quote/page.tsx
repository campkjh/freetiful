'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, MapPin, Calendar, Clock, Check, Send, Star } from 'lucide-react';
import toast from 'react-hot-toast';

const PLANS = [
  { id: 'premium', label: 'Premium', price: 450000, desc: '행사 1시간 진행', icon: '⭐' },
  { id: 'superior', label: 'Superior', price: 800000, desc: '행사 2시간 진행', icon: '💎' },
  { id: 'enterprise', label: 'Enterprise', price: 1700000, desc: '6시간 풀타임', icon: '🏆' },
];

const EVENT_TYPES = ['결혼식', '돌잔치', '기업행사', '공식행사', '체육대회', '레크리에이션', '팀빌딩', '송년회', '컨퍼런스', '라이브커머스', '기업PT', '워크숍'];

const MOCK_PROS = [
  { id: '15', name: '박인애', image: '/images/박인애/IMG_0196.avif', rating: 4.9, reviews: 134, experience: 13, intro: '13년 생방송 뉴스 진행으로 다져진 품격있는 사회자' },
  { id: '23', name: '이승진', image: '/images/이승진/IMG_46511771924269213.avif', rating: 4.8, reviews: 211, experience: 4, intro: '따뜻하고 깔끔한 진행의 사회자' },
  { id: '31', name: '전해별', image: '/images/전해별/IMG_73341772850094485.avif', rating: 4.8, reviews: 133, experience: 10, intro: '탄탄한 발성의 아나운서' },
  { id: '12', name: '문정은', image: '/images/문정은/IMG_27221772621229571.avif', rating: 4.6, reviews: 216, experience: 10, intro: '품격있고 고급스러운 진행' },
  { id: '25', name: '이우영', image: '/images/이우영/2-11772248201484.avif', rating: 4.7, reviews: 158, experience: 8, intro: '현직 아나운서의 고품격 진행' },
  { id: '35', name: '정이현', image: '/images/정이현/44561772622988798.avif', rating: 4.9, reviews: 34, experience: 10, intro: '정이현 사회자입니다' },
  { id: '1', name: '강도현', image: '/images/강도현/10000133881772850005043.avif', rating: 4.6, reviews: 117, experience: 14, intro: '신뢰감 있는 보이스' },
  { id: '5', name: '김유석', image: '/images/김유석/10000029811773033474612.avif', rating: 4.7, reviews: 65, experience: 8, intro: '최고의 진행자 아나운서' },
  { id: '24', name: '이용석', image: '/images/이용석/10001176941772847263491.avif', rating: 4.9, reviews: 239, experience: 11, intro: '1000회 이상 결혼식사회' },
];

type Step = 'type' | 'plan' | 'detail' | 'pros' | 'confirm';

export default function QuotePage() {
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
  const [selectedPros, setSelectedPros] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const togglePro = (id: string) => {
    setSelectedPros((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    setSending(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSending(false);
    if (isEvent) {
      toast.success('행사 견적 요청이 접수되었습니다.\n담당자가 확인 후 연락드리겠습니다.');
    } else {
      toast.success(`${selectedPros.size}명의 사회자에게 견적을 보냈습니다.`);
    }
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

  const stepIndex = ['type', 'plan', 'detail', 'pros', 'confirm'].indexOf(step);
  const totalSteps = isEvent ? 4 : 4;
  const currentStep = isEvent ? stepIndex : (step === 'plan' ? 0 : step === 'detail' ? 1 : step === 'pros' ? 2 : 3);

  return (
    <div className="fixed inset-0 bg-white flex flex-col" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 h-[56px] border-b border-gray-100">
        <button onClick={prevStep} className="p-1 active:scale-90 transition-transform">
          <ChevronLeft size={24} className="text-gray-700" />
        </button>
        <h1 className="text-[16px] font-bold text-gray-900">
          {isEvent ? '행사 사회자 견적요청' : '결혼식 사회자 견적요청'}
        </h1>
        <div className="w-8" />
      </div>

      {/* Progress */}
      <div className="shrink-0 px-4 py-3">
        <div className="flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i <= currentStep ? 'bg-gray-900' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {/* Step: 행사 유형 (행사 모드만) */}
        {step === 'type' && (
          <div>
            <h2 className="text-[22px] font-black text-gray-900 mt-4 mb-2">어떤 행사인가요?</h2>
            <p className="text-[14px] text-gray-400 mb-6">행사 유형을 선택해주세요</p>
            <div className="grid grid-cols-2 gap-3">
              {EVENT_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setEventType(t)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
                    eventType === t ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <p className={`text-[15px] font-bold ${eventType === t ? 'text-gray-900' : 'text-gray-600'}`}>{t}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: 플랜 선택 */}
        {step === 'plan' && (
          <div>
            <h2 className="text-[22px] font-black text-gray-900 mt-4 mb-2">플랜을 선택해주세요</h2>
            <p className="text-[14px] text-gray-400 mb-6">행사 규모에 맞는 플랜을 골라주세요</p>
            <div className="space-y-3">
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlan(p.id)}
                  className={`w-full p-5 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
                    plan === p.id ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-[24px]">{p.icon}</span>
                      <div>
                        <p className={`text-[16px] font-bold ${plan === p.id ? 'text-gray-900' : 'text-gray-700'}`}>{p.label}</p>
                        <p className="text-[13px] text-gray-400">{p.desc}</p>
                      </div>
                    </div>
                    <p className="text-[16px] font-black text-gray-900">{p.price.toLocaleString()}원</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: 장소/시간 */}
        {step === 'detail' && (
          <div>
            <h2 className="text-[22px] font-black text-gray-900 mt-4 mb-2">행사 정보를 입력해주세요</h2>
            <p className="text-[14px] text-gray-400 mb-6">장소, 날짜, 시간을 알려주세요</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-bold text-gray-700 mb-1.5">
                  <MapPin size={12} className="inline mr-1" />행사 장소
                </label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="예: 서울 강남 더시에나호텔" className="input text-[16px]" />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-gray-700 mb-1.5">
                  <Calendar size={12} className="inline mr-1" />행사 날짜
                </label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input text-[16px]" />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-gray-700 mb-1.5">
                  <Clock size={12} className="inline mr-1" />행사 시간
                </label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input text-[16px]" />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-gray-700 mb-1.5">추가 요청사항 (선택)</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="특별히 요청하실 사항이 있으시면 적어주세요" className="input text-[16px] h-24 resize-none" />
              </div>
            </div>
          </div>
        )}

        {/* Step: 사회자 선택 (결혼식 모드만) */}
        {step === 'pros' && (
          <div>
            <h2 className="text-[22px] font-black text-gray-900 mt-4 mb-2">사회자를 선택해주세요</h2>
            <p className="text-[14px] text-gray-400 mb-6">여러 명을 선택하면 동시에 견적을 받을 수 있어요</p>
            <div className="space-y-3">
              {MOCK_PROS.map((pro) => {
                const selected = selectedPros.has(pro.id);
                return (
                  <button
                    key={pro.id}
                    onClick={() => togglePro(pro.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
                      selected ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img src={pro.image} alt={pro.name} className="w-14 h-14 rounded-xl object-cover" />
                      {selected && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center">
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-bold text-gray-900">{pro.name}</p>
                      <p className="text-[12px] text-gray-400 truncate">{pro.intro}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-0.5">
                          <Star size={10} className="text-amber-400 fill-amber-400" />
                          <span className="text-[11px] font-bold text-gray-700">{pro.rating.toFixed(1)}</span>
                        </div>
                        <span className="text-[11px] text-gray-400">리뷰 {pro.reviews}</span>
                        <span className="text-[11px] text-gray-400">경력 {pro.experience}년</span>
                      </div>
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
            <h2 className="text-[22px] font-black text-gray-900 mt-4 mb-2">견적 요청 확인</h2>
            <p className="text-[14px] text-gray-400 mb-6">아래 내용을 확인하고 전송해주세요</p>
            <div className="bg-gray-50 rounded-2xl p-5 space-y-3">
              {isEvent && eventType && (
                <div className="flex justify-between">
                  <span className="text-[13px] text-gray-500">행사 유형</span>
                  <span className="text-[13px] font-bold text-gray-900">{eventType}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[13px] text-gray-500">플랜</span>
                <span className="text-[13px] font-bold text-gray-900">{PLANS.find((p) => p.id === plan)?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-gray-500">장소</span>
                <span className="text-[13px] font-bold text-gray-900">{location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-gray-500">날짜</span>
                <span className="text-[13px] font-bold text-gray-900">{date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-gray-500">시간</span>
                <span className="text-[13px] font-bold text-gray-900">{time}</span>
              </div>
              {!isEvent && selectedPros.size > 0 && (
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-[13px] text-gray-500 mb-2">선택한 사회자 ({selectedPros.size}명)</p>
                  <div className="flex flex-wrap gap-2">
                    {MOCK_PROS.filter((p) => selectedPros.has(p.id)).map((p) => (
                      <div key={p.id} className="flex items-center gap-2 bg-white rounded-full pl-1 pr-3 py-1 border border-gray-200">
                        <img src={p.image} alt={p.name} className="w-6 h-6 rounded-full object-cover" />
                        <span className="text-[12px] font-semibold text-gray-700">{p.name}</span>
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
      <div className="shrink-0 px-4 pb-6 pt-3 border-t border-gray-100 bg-white">
        {step === 'confirm' ? (
          <button
            onClick={handleSubmit}
            disabled={sending}
            className="w-full h-[52px] bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-2xl active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send size={16} />
            {sending ? '전송 중...' : isEvent ? '견적 요청 보내기' : `${selectedPros.size}명에게 견적 보내기`}
          </button>
        ) : (
          <button
            onClick={nextStep}
            disabled={!canNext()}
            className="w-full h-[52px] bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-2xl active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-1"
          >
            다음 <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
