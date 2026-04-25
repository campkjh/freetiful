'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Calendar, MapPin, Wallet, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api/client';
import { matchApi } from '@/lib/api/match.api';
import { useAuthStore } from '@/lib/store/auth.store';

const STEPS = ['카테고리', '행사정보', '스타일', '확인'];

const CATEGORIES = [
  { id: '사회자', name: '사회자', icon: '🎤', description: '결혼식/행사 진행 전문' },
  { id: '가수', name: '가수', icon: '🎵', description: '축가 및 공연' },
  { id: '쇼호스트', name: '쇼호스트', icon: '🎬', description: '쇼 진행 전문' },
];

const EVENT_TYPES = [
  { id: 'wedding', name: '결혼식' },
  { id: 'birthday', name: '생신잔치 (환갑/칠순)' },
  { id: 'dol', name: '돌잔치' },
  { id: 'corporate', name: '기업행사' },
  { id: 'class', name: '강의/클래스' },
];

const STYLES = ['격식있는', '유머있는', '감동적인', '경쾌한', '차분한', '프로페셔널한'];
const PERSONALITIES = ['친근한', '활발한', '신중한', '창의적인', '배려심있는', '카리스마있는'];

interface MatchCategory {
  id: string;
  name: string;
  nameEn?: string | null;
  iconUrl?: string | null;
  eventCategories?: { id: string; name: string }[];
  styleOptions?: { id: string; name: string }[];
}

interface PersonalityOption {
  id: string;
  name: string;
}

const BUDGET_RANGES = [
  { label: '30~50만원', min: 300000, max: 500000 },
  { label: '50~80만원', min: 500000, max: 800000 },
  { label: '80~100만원', min: 800000, max: 1000000 },
  { label: '100만원 이상', min: 1000000, max: 0 },
  { label: '미정', min: 0, max: 0 },
];

export default function MatchRequestPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [categories, setCategories] = useState<MatchCategory[]>([]);
  const [personalities, setPersonalities] = useState<PersonalityOption[]>([]);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [selectedBudget, setSelectedBudget] = useState(-1);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedPersonalities, setSelectedPersonalities] = useState<string[]>([]);
  const [additionalNote, setAdditionalNote] = useState('');

  useEffect(() => {
    let alive = true;
    apiClient
      .get('/api/v1/ref-data/match-options')
      .then((res) => {
        if (!alive) return;
        setCategories(Array.isArray(res.data?.categories) ? res.data.categories : []);
        setPersonalities(Array.isArray(res.data?.personalities) ? res.data.personalities : []);
      })
      .catch(() => {
        if (alive) {
          setCategories([]);
          setPersonalities([]);
        }
      })
      .finally(() => {
        if (alive) setOptionsLoading(false);
      });
    return () => { alive = false; };
  }, []);

  const categoryOptions = useMemo(() => {
    if (categories.length > 0) return categories;
    return CATEGORIES.map((c) => ({
      ...c,
      nameEn: null,
      eventCategories: EVENT_TYPES.map((ev) => ({ id: ev.name, name: ev.name })),
      styleOptions: STYLES.map((name) => ({ id: name, name })),
    }));
  }, [categories]);

  const currentCategory = categoryOptions.find((c) => c.id === selectedCategory);
  const eventOptions = currentCategory?.eventCategories?.length ? currentCategory.eventCategories : EVENT_TYPES;
  const styleOptions = currentCategory?.styleOptions?.length
    ? currentCategory.styleOptions.map((s) => s.name)
    : STYLES;
  const personalityOptions = personalities.length > 0 ? personalities.map((p) => p.name) : PERSONALITIES;

  const toggleStyle = (s: string) =>
    setSelectedStyles((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : prev.length < 3 ? [...prev, s] : prev
    );

  const togglePersonality = (p: string) =>
    setSelectedPersonalities((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : prev.length < 3 ? [...prev, p] : prev
    );

  const canProceed = () => {
    switch (step) {
      case 0: return !!selectedCategory;
      case 1: return !!selectedEvent && !!eventDate;
      case 2: return selectedStyles.length > 0;
      case 3: return true;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    if (!authUser) {
      window.dispatchEvent(new Event('freetiful:show-login'));
      toast.error('로그인 후 견적 요청이 가능합니다.');
      return;
    }
    if (!selectedCategory) return;
    setLoading(true);
    try {
      const budget = selectedBudget >= 0 ? BUDGET_RANGES[selectedBudget] : undefined;
      const styleOptionIds = currentCategory?.styleOptions
        ?.filter((s) => selectedStyles.includes(s.name))
        .map((s) => s.id);
      const personalityOptionIds = personalities.length > 0
        ? personalities
            .filter((p) => selectedPersonalities.includes(p.name))
            .map((p) => p.id)
        : selectedPersonalities;

      await matchApi.createRequest({
        categoryId: selectedCategory,
        eventCategoryId: selectedEvent || undefined,
        eventDate: eventDate || undefined,
        eventTime: eventTime || undefined,
        eventLocation: eventLocation || undefined,
        budgetMin: budget?.min || undefined,
        budgetMax: budget?.max || undefined,
        type: 'multi',
        styleOptionIds,
        personalityOptionIds,
        rawUserInput: {
          categoryName: getCategoryName(),
          styles: selectedStyles,
          personalities: selectedPersonalities,
          note: additionalNote,
          eventName: getEventName(),
          budgetLabel: getBudgetLabel(),
        },
      });
      toast.success('견적 요청이 전문가들에게 전달되었습니다.');
      router.push('/requests');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '견적 요청 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryName = () => categoryOptions.find((c) => c.id === selectedCategory)?.name || '';
  const getEventName = () => eventOptions.find((e) => e.id === selectedEvent)?.name || '';
  const getBudgetLabel = () => selectedBudget >= 0 ? BUDGET_RANGES[selectedBudget].label : '미정';

  return (
    <div className="bg-white min-h-screen flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="px-4 pt-12 pb-3 flex items-center gap-3 sticky top-0 bg-white z-10">
        <button onClick={() => step > 0 ? setStep(step - 1) : router.back()} className="p-1">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-lg font-bold">견적 요청</h1>
      </div>

      {/* Progress */}
      <div className="px-4 mb-6">
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div className={`h-1 w-full rounded-full transition-colors ${
                i <= step ? 'bg-primary-500' : 'bg-gray-200'
              }`} />
              <span className={`text-[10px] font-medium ${
                i <= step ? 'text-primary-500' : 'text-gray-400'
              }`}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 px-4 pb-24 overflow-y-auto">
        {/* Step 0: Category */}
        {step === 0 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">어떤 전문가를 찾으시나요?</h2>
            <p className="text-sm text-gray-500 mb-6">카테고리를 선택해주세요</p>
            <div className="space-y-3">
              {optionsLoading && (
                <div className="p-4 rounded-2xl bg-gray-50 text-sm text-gray-400">선택지를 불러오는 중...</div>
              )}
              {!optionsLoading && categoryOptions.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setSelectedEvent('');
                    setSelectedStyles([]);
                  }}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                    selectedCategory === cat.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  <span className="text-3xl">{(cat as any).icon || '🎤'}</span>
                  <div className="text-left">
                    <p className="font-bold text-gray-900">{cat.name}</p>
                    <p className="text-xs text-gray-500">{(cat as any).description || cat.nameEn || '전문가 매칭'}</p>
                  </div>
                  {selectedCategory === cat.id && (
                    <Check size={20} className="text-primary-500 ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Event Info */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">행사 정보를 알려주세요</h2>
            <p className="text-sm text-gray-500 mb-6">행사 유형과 일정을 입력해주세요</p>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">행사 유형</label>
                <div className="flex flex-wrap gap-2">
                  {eventOptions.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev.id)}
                      className={`text-sm px-4 py-2 rounded-full border transition-colors ${
                        selectedEvent === ev.id
                          ? 'bg-primary-500 text-white border-primary-500'
                          : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      {ev.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Calendar size={14} className="inline mr-1" /> 행사 날짜
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="input"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">행사 시간 (선택)</label>
                <input
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <MapPin size={14} className="inline mr-1" /> 행사 장소 (선택)
                </label>
                <input
                  type="text"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="예: 서울 강남구 역삼동"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Wallet size={14} className="inline mr-1" /> 예산 범위
                </label>
                <div className="flex flex-wrap gap-2">
                  {BUDGET_RANGES.map((b, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedBudget(i)}
                      className={`text-sm px-4 py-2 rounded-full border transition-colors ${
                        selectedBudget === i
                          ? 'bg-primary-500 text-white border-primary-500'
                          : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Style & Personality */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">원하는 스타일을 선택하세요</h2>
            <p className="text-sm text-gray-500 mb-6">최대 3개까지 선택 가능합니다</p>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">진행 스타일</label>
                <div className="flex flex-wrap gap-2">
                  {styleOptions.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleStyle(s)}
                      className={`text-sm px-4 py-2 rounded-full border transition-colors ${
                        selectedStyles.includes(s)
                          ? 'bg-primary-500 text-white border-primary-500'
                          : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">성격 / 분위기</label>
                <div className="flex flex-wrap gap-2">
                  {personalityOptions.map((p) => (
                    <button
                      key={p}
                      onClick={() => togglePersonality(p)}
                      className={`text-sm px-4 py-2 rounded-full border transition-colors ${
                        selectedPersonalities.includes(p)
                          ? 'bg-primary-500 text-white border-primary-500'
                          : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">추가 요청사항 (선택)</label>
                <textarea
                  value={additionalNote}
                  onChange={(e) => setAdditionalNote(e.target.value)}
                  placeholder="전문가에게 전달하고 싶은 내용을 입력해주세요"
                  className="input min-h-[100px] resize-none"
                  maxLength={500}
                />
                <p className="text-xs text-gray-400 text-right mt-1">{additionalNote.length}/500</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">요청 내용을 확인해주세요</h2>
            <p className="text-sm text-gray-500 mb-6">AI가 요청서를 작성하여 전문가에게 전달합니다</p>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                <SummaryRow label="카테고리" value={getCategoryName()} />
                <SummaryRow label="행사 유형" value={getEventName()} />
                <SummaryRow label="행사 날짜" value={eventDate} />
                {eventTime && <SummaryRow label="행사 시간" value={eventTime} />}
                {eventLocation && <SummaryRow label="행사 장소" value={eventLocation} />}
                <SummaryRow label="예산" value={getBudgetLabel()} />
                <SummaryRow label="스타일" value={selectedStyles.join(', ')} />
                {selectedPersonalities.length > 0 && (
                  <SummaryRow label="성격" value={selectedPersonalities.join(', ')} />
                )}
              </div>

              {additionalNote && (
                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-xs font-bold text-gray-500 mb-1">추가 요청</p>
                  <p className="text-sm text-gray-700">{additionalNote}</p>
                </div>
              )}

              <div className="bg-primary-50 rounded-2xl p-4 flex items-start gap-3">
                <Sparkles size={20} className="text-primary-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-primary-700">AI 요청서 자동 작성</p>
                  <p className="text-xs text-primary-600 mt-1">
                    입력하신 정보를 바탕으로 AI가 전문가에게 보낼 요청서를 자동으로 작성합니다.
                    매칭된 전문가에게 동시에 발송됩니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t border-gray-100 px-4 py-3 pb-safe z-40">
        {step < 3 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={optionsLoading || !canProceed()}
            className="btn-primary flex items-center justify-center gap-2"
          >
            다음 <ArrowRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading || optionsLoading}
            className="btn-primary flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                AI 요청서 생성 중...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                견적 요청 보내기
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}
