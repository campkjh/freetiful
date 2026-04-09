'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Check,
  Mic, Music, Tv, Plus, X, Camera,
  AlertTriangle, Save, Search, Globe, Building2,
  Bold, Italic, Underline, List, Image as ImageIcon, Link as LinkIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Constants ──────────────────────────────────────────────────────────────

const STEPS = ['카테고리', '기본 정보', '경력 & 서비스', '상세 페이지', '사진 등록', '확인'];

const CATEGORIES = [
  { id: 'mc', label: 'MC', icon: Mic, desc: '결혼식, 돌잔치, 기업행사 등 행사를 진행합니다' },
  { id: 'singer', label: '가수', icon: Music, desc: '축가, 공연, 이벤트 무대에서 노래합니다' },
  { id: 'showhost', label: '쇼호스트', icon: Tv, desc: '행사 연출, 이벤트 진행, 사회를 봅니다' },
];

const ALL_REGIONS = ['수도권', '강원도', '충청권', '전라권', '경상권', '제주'];
const REGION_NATIONWIDE = '전국가능';

const EVENT_TYPES = ['결혼식', '돌잔치', '생신잔치', '기업행사', '강의/클래스', '축제/페스티벌'];

const LANGUAGES = ['영어', '일본어', '중국어', '스페인어', '프랑스어', '독일어', '러시아어', '베트남어', '태국어', '인도네시아어', '아랍어'];

// 관리자가 등록한 기업 목록 (실제로는 API에서 불러옴)
const COMPANIES = [
  '한국가스안전공사', '한국경제TV', '삼성전자', 'LG전자', 'SK텔레콤',
  '현대자동차', '롯데그룹', 'CJ ENM', 'KBS', 'MBC', 'SBS',
  '아시아나항공', '대한항공', '한국전력공사', '한국도로공사',
  '국민건강보험공단', '한국수자원공사', '코트라(KOTRA)', '한국관광공사',
  'GS칼텍스', '포스코', '네이버', '카카오', '쿠팡', '배달의민족',
];

const DRAFT_KEY = 'freetiful_pro_register_draft';

// ─── Component ──────────────────────────────────────────────────────────────

export default function ProRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 0: Category
  const [category, setCategory] = useState('');

  // Step 1: Basic info
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [shortIntro, setShortIntro] = useState('');
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [isNationwide, setIsNationwide] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [companySearch, setCompanySearch] = useState('');
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

  // Step 2: Career & Services
  const [careerYears, setCareerYears] = useState('');
  const [mainExperience, setMainExperience] = useState('');
  const [awards, setAwards] = useState('');
  const [services, setServices] = useState([{ title: '', price: '', desc: '' }]);
  const [youtubeUrl, setYoutubeUrl] = useState('');

  // Step 3: Detail page (HTML editor)
  const [detailHtml, setDetailHtml] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);

  // Step 4: Photos
  const [photos, setPhotos] = useState<{ id: string; file?: File; url: string; hasFace: boolean }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 5: Confirm
  const [agreed, setAgreed] = useState(false);

  // Draft save status
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // ─── Draft Save / Load ──────────────────────────────────────────────────

  const getDraftData = useCallback(() => ({
    category, name, gender, shortIntro,
    selectedRegions, isNationwide, selectedEvents,
    selectedLanguages, selectedCompanies,
    careerYears, mainExperience, awards, services, youtubeUrl,
    detailHtml, step,
  }), [category, name, gender, shortIntro, selectedRegions, isNationwide,
    selectedEvents, selectedLanguages, selectedCompanies, careerYears,
    mainExperience, awards, services, youtubeUrl, detailHtml, step]);

  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(getDraftData()));
      const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      setLastSaved(now);
      toast.success('임시 저장되었습니다', { duration: 1500 });
    } catch {
      toast.error('저장에 실패했습니다');
    }
  }, [getDraftData]);

  // Load draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const data = JSON.parse(saved);
      if (data.category) setCategory(data.category);
      if (data.name) setName(data.name);
      if (data.gender) setGender(data.gender);
      if (data.shortIntro) setShortIntro(data.shortIntro);
      if (data.selectedRegions) setSelectedRegions(data.selectedRegions);
      if (data.isNationwide) setIsNationwide(data.isNationwide);
      if (data.selectedEvents) setSelectedEvents(data.selectedEvents);
      if (data.selectedLanguages) setSelectedLanguages(data.selectedLanguages);
      if (data.selectedCompanies) setSelectedCompanies(data.selectedCompanies);
      if (data.careerYears) setCareerYears(data.careerYears);
      if (data.mainExperience) setMainExperience(data.mainExperience);
      if (data.awards) setAwards(data.awards);
      if (data.services) setServices(data.services);
      if (data.youtubeUrl) setYoutubeUrl(data.youtubeUrl);
      if (data.detailHtml) setDetailHtml(data.detailHtml);
      if (typeof data.step === 'number') setStep(data.step);
      toast('이전에 작성 중이던 내용을 불러왔습니다', { icon: '📝', duration: 2000 });
    } catch { /* ignore */ }
  }, []);

  // Auto-save every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      if (name || category) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(getDraftData()));
        setLastSaved(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [getDraftData, name, category]);

  // ─── Region Logic ───────────────────────────────────────────────────────

  const toggleRegion = (r: string) => {
    setSelectedRegions((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  };

  const toggleNationwide = () => {
    if (isNationwide) {
      setIsNationwide(false);
      setSelectedRegions([]);
    } else {
      setIsNationwide(true);
      setSelectedRegions([...ALL_REGIONS]); // 전국가능 = 모든 지역 선택
    }
  };

  // When individual regions change, check if all are selected
  useEffect(() => {
    if (selectedRegions.length === ALL_REGIONS.length && ALL_REGIONS.every((r) => selectedRegions.includes(r))) {
      setIsNationwide(true);
    } else if (isNationwide && selectedRegions.length < ALL_REGIONS.length) {
      setIsNationwide(false);
    }
  }, [selectedRegions, isNationwide]);

  const toggleEvent = (e: string) => {
    setSelectedEvents((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);
  };

  // ─── Company Search ─────────────────────────────────────────────────────

  const filteredCompanies = COMPANIES.filter(
    (c) => c.includes(companySearch) && !selectedCompanies.includes(c),
  );

  // ─── Services ───────────────────────────────────────────────────────────

  const addService = () => {
    if (services.length < 5) setServices([...services, { title: '', price: '', desc: '' }]);
  };
  const removeService = (idx: number) => {
    if (services.length > 1) setServices(services.filter((_, i) => i !== idx));
  };
  const updateService = (idx: number, field: string, value: string) => {
    setServices(services.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  // ─── Photo Upload (실제 파일 선택) ──────────────────────────────────────

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = 10 - photos.length;
    const filesToAdd = Array.from(files).slice(0, remaining);

    for (const file of filesToAdd) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: 10MB를 초과합니다`);
        continue;
      }
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.type)) {
        toast.error(`${file.name}: 지원하지 않는 형식입니다`);
        continue;
      }

      const url = URL.createObjectURL(file);
      setPhotos((prev) => [...prev, {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        file,
        url,
        hasFace: true, // 실제로는 서버 업로드 후 판단
      }]);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo?.url.startsWith('blob:')) URL.revokeObjectURL(photo.url);
      return prev.filter((p) => p.id !== id);
    });
  };

  // ─── HTML Editor Commands ───────────────────────────────────────────────

  const execCommand = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };

  const handleEditorInput = () => {
    if (editorRef.current) setDetailHtml(editorRef.current.innerHTML);
  };

  const insertEditorImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      execCommand('insertImage', url);
    };
    input.click();
  };

  // ─── Validation ─────────────────────────────────────────────────────────

  const canProceed = () => {
    switch (step) {
      case 0: return !!category;
      case 1: return name.length >= 2 && !!gender && shortIntro.length >= 10 && (selectedRegions.length > 0 || isNationwide) && selectedEvents.length > 0;
      case 2: return !!careerYears && mainExperience.length >= 10 && services[0].title.length > 0;
      case 3: return true; // 상세 페이지는 선택
      case 4: return photos.length >= 4;
      case 5: return agreed;
      default: return false;
    }
  };

  const handleSubmit = () => {
    localStorage.removeItem(DRAFT_KEY);
    toast.success('파트너 등록 신청이 완료되었습니다!\n심사 후 승인되면 알림을 보내드립니다.');
    router.push('/pro-dashboard');
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-surface-50 min-h-screen max-w-lg mx-auto lg:max-w-2xl">
      {/* Header */}
      <div className="glass sticky top-0 z-20 border-b border-gray-100/50">
        <div className="flex items-center justify-between px-5 h-14">
          <div className="flex items-center gap-3">
            <button onClick={() => step > 0 ? setStep(step - 1) : router.back()} className="p-1">
              <ArrowLeft size={22} />
            </button>
            <h1 className="text-[17px] font-bold tracking-tight">파트너 등록</h1>
          </div>
          <button
            onClick={saveDraft}
            className="flex items-center gap-1.5 text-[13px] text-primary-500 font-semibold px-3 py-1.5 rounded-full hover:bg-primary-50 active:scale-[0.97]"
            style={{ transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <Save size={14} />
            {lastSaved ? `저장됨 ${lastSaved}` : '임시저장'}
          </button>
        </div>
        {/* Progress */}
        <div className="px-5 pb-3">
          <div className="flex gap-1">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`h-1 w-full rounded-full ${i <= step ? 'bg-primary-500' : 'bg-gray-200'}`}
                  style={{ transition: 'background-color 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
                />
                <span className={`text-[8px] ${i <= step ? 'text-primary-500 font-bold' : 'text-gray-400'}`}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-5 py-6">
        {/* ═══ Step 0: Category ═══════════════════════════════════════════ */}
        {step === 0 && (
          <div className="animate-fade-in" style={{ animationFillMode: 'forwards' }}>
            <h2 className="text-[22px] font-black text-gray-900 tracking-tight mb-2">어떤 분야의 전문가이신가요?</h2>
            <p className="text-[14px] text-gray-500 mb-8">하나를 선택해주세요</p>
            <div className="space-y-3">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`w-full card p-5 flex items-center gap-4 text-left ${category === cat.id ? 'ring-2 ring-primary-500 bg-primary-50/30' : ''}`}
                  style={{ transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${category === cat.id ? 'bg-primary-500' : 'bg-surface-100'}`} style={{ transition: 'all 0.3s' }}>
                    <cat.icon size={22} className={category === cat.id ? 'text-white' : 'text-gray-400'} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[15px] font-bold text-gray-900">{cat.label}</p>
                    <p className="text-[13px] text-gray-500 mt-0.5">{cat.desc}</p>
                  </div>
                  {category === cat.id && (
                    <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                      <Check size={14} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ Step 1: Basic Info ═════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in" style={{ animationFillMode: 'forwards' }}>
            <div>
              <h2 className="text-[22px] font-black text-gray-900 tracking-tight mb-2">기본 정보를 입력해주세요</h2>
              <p className="text-[14px] text-gray-500">프로필에 표시되는 정보입니다</p>
            </div>

            {/* 활동명 */}
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">활동명 *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김민준 MC" className="input" />
            </div>

            {/* 성별 */}
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">성별 *</label>
              <div className="flex gap-2">
                {['남성', '여성'].map((g) => (
                  <button key={g} onClick={() => setGender(g)} className={gender === g ? 'chip-active flex-1' : 'chip-inactive flex-1'}>{g}</button>
                ))}
              </div>
            </div>

            {/* 한 줄 소개 */}
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">한 줄 소개 * <span className="text-gray-400 font-normal">({shortIntro.length}/100)</span></label>
              <input type="text" value={shortIntro} onChange={(e) => setShortIntro(e.target.value.slice(0, 100))} placeholder="나를 표현하는 한 줄 소개" className="input" />
              {shortIntro.length > 0 && shortIntro.length < 10 && (
                <p className="text-[11px] text-amber-500 mt-1 flex items-center gap-1"><AlertTriangle size={10} /> 최소 10자 이상 입력해주세요</p>
              )}
            </div>

            {/* 행사 가능 지역 */}
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">행사 가능 지역 * <span className="text-gray-400 font-normal">(복수 선택)</span></label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={toggleNationwide}
                  className={isNationwide
                    ? 'chip bg-primary-500 text-white border-primary-500 shadow-sm font-bold'
                    : 'chip-inactive font-bold'}
                >
                  <Globe size={13} className="mr-1 inline" />
                  {REGION_NATIONWIDE}
                </button>
                {ALL_REGIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => { toggleRegion(r); }}
                    className={selectedRegions.includes(r) ? 'chip-active text-[12px]' : 'chip-inactive text-[12px]'}
                  >
                    {selectedRegions.includes(r) && <Check size={12} className="mr-1 inline" />}{r}
                  </button>
                ))}
              </div>
              {isNationwide && (
                <p className="text-[11px] text-primary-500 mt-2 flex items-center gap-1">
                  <Check size={10} /> 전국 모든 지역이 선택되었습니다
                </p>
              )}
            </div>

            {/* 가능한 행사 */}
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">가능한 행사 * <span className="text-gray-400 font-normal">(복수 선택)</span></label>
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map((e) => (
                  <button key={e} onClick={() => toggleEvent(e)} className={selectedEvents.includes(e) ? 'chip-active text-[12px]' : 'chip-inactive text-[12px]'}>
                    {selectedEvents.includes(e) && <Check size={12} className="mr-1 inline" />}{e}
                  </button>
                ))}
              </div>
            </div>

            {/* 언어 */}
            <div className="relative">
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">
                <Globe size={12} className="inline mr-1" /> 구사 언어 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              {selectedLanguages.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedLanguages.map((lang) => (
                    <span key={lang} className="tag-primary flex items-center gap-1">
                      {lang}
                      <button onClick={() => setSelectedLanguages((prev) => prev.filter((l) => l !== lang))} className="hover:text-primary-800"><X size={10} /></button>
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className="chip-inactive text-[12px] flex items-center gap-1"
              >
                <Plus size={12} /> 언어 추가
              </button>
              {showLanguageDropdown && (
                <div className="absolute left-0 right-0 mt-1 bg-white rounded-2xl shadow-card-hover border border-gray-100 max-h-48 overflow-y-auto z-10 animate-scale-in" style={{ animationFillMode: 'forwards' }}>
                  {LANGUAGES.filter((l) => !selectedLanguages.includes(l)).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => { setSelectedLanguages((prev) => [...prev, lang]); setShowLanguageDropdown(false); }}
                      className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 hover:bg-surface-50"
                      style={{ transition: 'background 0.15s' }}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 기업 이력 */}
            <div className="relative">
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">
                <Building2 size={12} className="inline mr-1" /> 기업 이력 <span className="text-gray-400 font-normal">(선택, 다중 선택)</span>
              </label>
              {selectedCompanies.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedCompanies.map((c) => (
                    <span key={c} className="tag-default flex items-center gap-1">
                      {c}
                      <button onClick={() => setSelectedCompanies((prev) => prev.filter((x) => x !== c))} className="hover:text-gray-800"><X size={10} /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={companySearch}
                  onChange={(e) => { setCompanySearch(e.target.value); setShowCompanyDropdown(true); }}
                  onFocus={() => setShowCompanyDropdown(true)}
                  placeholder="기업명 검색 (예: 한국가스안전공사)"
                  className="input pl-9 text-[13px]"
                />
              </div>
              {showCompanyDropdown && companySearch && filteredCompanies.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white rounded-2xl shadow-card-hover border border-gray-100 max-h-48 overflow-y-auto z-10 animate-scale-in" style={{ animationFillMode: 'forwards' }}>
                  {filteredCompanies.slice(0, 10).map((c) => (
                    <button
                      key={c}
                      onClick={() => { setSelectedCompanies((prev) => [...prev, c]); setCompanySearch(''); setShowCompanyDropdown(false); }}
                      className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 hover:bg-surface-50"
                      style={{ transition: 'background 0.15s' }}
                    >
                      <Building2 size={12} className="inline mr-2 text-gray-400" />{c}
                    </button>
                  ))}
                </div>
              )}
              {showCompanyDropdown && companySearch && filteredCompanies.length === 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white rounded-2xl shadow-card-hover border border-gray-100 p-4 z-10">
                  <p className="text-[13px] text-gray-400 text-center">검색 결과가 없습니다</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ Step 2: Career & Services ══════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in" style={{ animationFillMode: 'forwards' }}>
            <div>
              <h2 className="text-[22px] font-black text-gray-900 tracking-tight mb-2">경력과 서비스를 알려주세요</h2>
              <p className="text-[14px] text-gray-500">고객이 나를 선택하는 데 도움이 됩니다</p>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">경력 기간 *</label>
              <div className="flex flex-wrap gap-2">
                {['1년 미만', '1~3년', '3~5년', '5~10년', '10년 이상'].map((y) => (
                  <button key={y} onClick={() => setCareerYears(y)} className={careerYears === y ? 'chip-active text-[12px]' : 'chip-inactive text-[12px]'}>{y}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">주요 경력 * <span className="text-gray-400 font-normal">({mainExperience.length}/500)</span></label>
              <textarea value={mainExperience} onChange={(e) => setMainExperience(e.target.value.slice(0, 500))} placeholder="주요 활동 이력, 행사 경험 등을 자유롭게 작성해주세요" className="input min-h-[120px] resize-none" rows={5} />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">수상 이력 <span className="text-gray-400 font-normal">(선택)</span></label>
              <input type="text" value={awards} onChange={(e) => setAwards(e.target.value)} placeholder="수상 경력이 있다면 입력해주세요" className="input" />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">유튜브 영상 <span className="text-gray-400 font-normal">(선택)</span></label>
              <input type="url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/..." className="input" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[13px] font-semibold text-gray-700">서비스 & 가격 *</label>
                {services.length < 5 && (
                  <button onClick={addService} className="text-[12px] text-primary-500 font-semibold flex items-center gap-1"><Plus size={14} /> 추가</button>
                )}
              </div>
              <div className="space-y-3">
                {services.map((s, i) => (
                  <div key={i} className="card p-4 space-y-3 relative">
                    {services.length > 1 && (
                      <button onClick={() => removeService(i)} className="absolute top-3 right-3 p-1 rounded-full hover:bg-surface-100"><X size={14} className="text-gray-400" /></button>
                    )}
                    <input type="text" value={s.title} onChange={(e) => updateService(i, 'title', e.target.value)} placeholder="서비스명 (예: 웨딩 MC 기본 패키지)" className="input text-[13px]" />
                    <input type="text" value={s.price} onChange={(e) => updateService(i, 'price', e.target.value)} placeholder="가격 (예: 50만원~)" className="input text-[13px]" />
                    <input type="text" value={s.desc} onChange={(e) => updateService(i, 'desc', e.target.value)} placeholder="서비스 설명 (선택)" className="input text-[13px]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ Step 3: Detail Page (HTML Editor) ═════════════════════════ */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in" style={{ animationFillMode: 'forwards' }}>
            <div>
              <h2 className="text-[22px] font-black text-gray-900 tracking-tight mb-2">상세 페이지를 작성해주세요</h2>
              <p className="text-[14px] text-gray-500">자유롭게 나를 소개하는 상세 페이지를 만들어보세요 (선택)</p>
            </div>

            {/* Toolbar */}
            <div className="card p-1.5 flex items-center gap-0.5 flex-wrap">
              <button onClick={() => execCommand('bold')} className="p-2 rounded-lg hover:bg-surface-100 text-gray-600" title="굵게"><Bold size={16} /></button>
              <button onClick={() => execCommand('italic')} className="p-2 rounded-lg hover:bg-surface-100 text-gray-600" title="기울임"><Italic size={16} /></button>
              <button onClick={() => execCommand('underline')} className="p-2 rounded-lg hover:bg-surface-100 text-gray-600" title="밑줄"><Underline size={16} /></button>
              <div className="w-px h-5 bg-gray-200 mx-1" />
              <button onClick={() => execCommand('insertUnorderedList')} className="p-2 rounded-lg hover:bg-surface-100 text-gray-600" title="목록"><List size={16} /></button>
              <button onClick={insertEditorImage} className="p-2 rounded-lg hover:bg-surface-100 text-gray-600" title="이미지"><ImageIcon size={16} /></button>
              <button onClick={() => { const url = prompt('링크 URL을 입력하세요'); if (url) execCommand('createLink', url); }} className="p-2 rounded-lg hover:bg-surface-100 text-gray-600" title="링크"><LinkIcon size={16} /></button>
              <div className="w-px h-5 bg-gray-200 mx-1" />
              <select onChange={(e) => execCommand('fontSize', e.target.value)} className="text-[12px] text-gray-600 bg-surface-50 rounded-lg px-2 py-1.5 border-0 outline-none" defaultValue="3">
                <option value="1">작게</option>
                <option value="3">보통</option>
                <option value="5">크게</option>
                <option value="7">매우 크게</option>
              </select>
            </div>

            {/* Editor */}
            <div
              ref={editorRef}
              contentEditable
              onInput={handleEditorInput}
              dangerouslySetInnerHTML={{ __html: detailHtml }}
              className="card min-h-[300px] p-5 text-[14px] text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary-200 [&_img]:max-w-full [&_img]:rounded-xl [&_img]:my-3 [&_a]:text-primary-500 [&_a]:underline"
              data-placeholder="자유롭게 작성해주세요. 나만의 스타일, 진행 방식, 포트폴리오 등을 소개할 수 있습니다."
              style={{ minHeight: 300 }}
            />

            <p className="text-[11px] text-gray-400">
              * 추후 네이버 스마트에디터 API가 연동되면 더 풍부한 편집이 가능합니다.
            </p>
          </div>
        )}

        {/* ═══ Step 4: Photos (실제 파일 업로드) ══════════════════════════ */}
        {step === 4 && (
          <div className="space-y-6 animate-fade-in" style={{ animationFillMode: 'forwards' }}>
            <div>
              <h2 className="text-[22px] font-black text-gray-900 tracking-tight mb-2">프로필 사진을 등록해주세요</h2>
              <p className="text-[14px] text-gray-500">최소 4장, 최대 10장까지 등록할 수 있습니다</p>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {photos.map((photo, i) => (
                <div key={photo.id} className="relative aspect-square rounded-2xl overflow-hidden group">
                  <img src={photo.url} alt="" className="w-full h-full object-cover" />
                  {i === 0 && (
                    <span className="absolute top-1.5 left-1.5 bg-primary-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">대표</span>
                  )}
                  <button
                    onClick={() => removePhoto(photo.id)}
                    className="absolute top-1.5 right-1.5 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-black/70 active:scale-90"
                    style={{ transition: 'all 0.2s' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {photos.length < 10 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1.5 hover:border-primary-300 hover:bg-primary-50/30 active:scale-[0.97]"
                  style={{ transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
                >
                  <Camera size={20} className="text-gray-400" />
                  <span className="text-[10px] text-gray-400 font-medium">{photos.length}/10</span>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              className="hidden"
              onChange={handlePhotoSelect}
            />

            {photos.length < 4 && (
              <div className="flex items-start gap-2 bg-amber-50 text-amber-700 text-[13px] px-4 py-3 rounded-2xl">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <p>최소 4장의 사진이 필요합니다. 얼굴이 잘 보이는 사진을 올려주세요.</p>
              </div>
            )}

            <p className="text-[11px] text-gray-400 leading-relaxed">
              등록 신청 시 서버에서 WebP로 자동 변환되며, 얼굴이 인식되지 않는 사진은 등록이 제한될 수 있습니다. 드래그로 순서를 변경할 수 있습니다.
            </p>
          </div>
        )}

        {/* ═══ Step 5: Confirm ════════════════════════════════════════════ */}
        {step === 5 && (
          <div className="space-y-6 animate-fade-in" style={{ animationFillMode: 'forwards' }}>
            <div>
              <h2 className="text-[22px] font-black text-gray-900 tracking-tight mb-2">등록 정보를 확인해주세요</h2>
              <p className="text-[14px] text-gray-500">심사 후 승인되면 바로 활동을 시작할 수 있습니다</p>
            </div>

            <div className="space-y-2">
              <SummaryRow label="카테고리" value={CATEGORIES.find((c) => c.id === category)?.label || ''} />
              <SummaryRow label="활동명" value={name} />
              <SummaryRow label="성별" value={gender} />
              <SummaryRow label="한 줄 소개" value={shortIntro} />
              <SummaryRow label="활동 지역" value={isNationwide ? '전국가능' : selectedRegions.join(', ')} />
              <SummaryRow label="가능한 행사" value={selectedEvents.join(', ')} />
              {selectedLanguages.length > 0 && <SummaryRow label="구사 언어" value={selectedLanguages.join(', ')} />}
              {selectedCompanies.length > 0 && <SummaryRow label="기업 이력" value={selectedCompanies.join(', ')} />}
              <SummaryRow label="경력" value={careerYears} />
              <SummaryRow label="등록 사진" value={`${photos.length}장`} />
              <SummaryRow label="서비스" value={services.filter((s) => s.title).map((s) => s.title).join(', ')} />
              {detailHtml && <SummaryRow label="상세 페이지" value="작성 완료" />}
            </div>

            <div className="bg-primary-50 rounded-2xl p-4">
              <p className="text-[13px] text-primary-700 font-medium leading-relaxed">
                등록 신청 후 1~2일 내에 심사가 진행됩니다.
                승인되면 바로 고객의 견적 요청을 받을 수 있습니다.
                가입비는 무료이며, 매칭 성사 시에만 수수료가 발생합니다.
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <button
                onClick={() => setAgreed(!agreed)}
                className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center mt-0.5 ${agreed ? 'bg-primary-500 border-primary-500' : 'border-gray-300'}`}
                style={{ transition: 'all 0.2s' }}
              >
                {agreed && <Check size={12} className="text-white" />}
              </button>
              <span className="text-[13px] text-gray-700 leading-relaxed">
                <span className="font-bold">이용약관</span> 및 <span className="font-bold">개인정보처리방침</span>에 동의하며, 입력한 정보가 정확함을 확인합니다.
              </span>
            </label>
          </div>
        )}
      </div>

      {/* ─── Bottom Actions ──────────────────────────────────────────── */}
      <div className="sticky bottom-0 px-5 py-4 bg-white/90 backdrop-blur-xl border-t border-gray-100/50 z-10">
        <div className="flex gap-2.5">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="btn-outline w-auto px-5 text-[14px]">이전</button>
          )}
          {step < 5 ? (
            <button onClick={() => setStep(step + 1)} disabled={!canProceed()} className="btn-primary flex items-center justify-center gap-2 flex-1">
              다음 <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={!agreed} className="btn-primary flex items-center justify-center gap-2 flex-1">
              등록 신청하기 <Check size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-4 py-3 flex items-center justify-between">
      <span className="text-[13px] text-gray-500">{label}</span>
      <span className="text-[13px] font-semibold text-gray-900 text-right max-w-[60%] truncate">{value || '-'}</span>
    </div>
  );
}
