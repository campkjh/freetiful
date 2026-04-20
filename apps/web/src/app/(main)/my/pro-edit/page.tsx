'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronDown, ChevronUp, Plus, X, Check, Star } from 'lucide-react';
/* ─── Constants ─── */
const WEDDING_TAGS = ['결혼식', '돌잔치', '회갑/칠순', '상견례'];
const EVENT_TAGS = ['기업행사', '컨퍼런스/세미나', '체육대회', '송년회/시무식', '레크리에이션', '팀빌딩', '라이브커머스', '기업PT', '축제/페스티벌', '공식행사'];
const OTHER_TAGS = ['레슨/클래스', '쇼호스트', '축가/연주'];
const ALL_CATEGORIES = [...WEDDING_TAGS, ...EVENT_TAGS, ...OTHER_TAGS];

const REGIONS = ['전국가능', '수도권(서울/인천/경기)', '강원도', '충청권', '전라권', '경상권', '제주'];

const LANGUAGES = ['영어', '일본어', '중국어', '스페인어', '프랑스어', '독일어', '러시아어', '아랍어', '베트남어', '태국어'];

const CAREER_YEARS = Array.from({ length: 30 }, (_, i) => i + 1);

/* ─── Helpers ─── */
function ls(key: string, fallback: string = ''): string {
  if (typeof window === 'undefined') return fallback;
  return localStorage.getItem(key) || fallback;
}
function lsJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

/* ─── Section wrapper ─── */
function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="border-b border-gray-100"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 active:bg-gray-50 transition-colors"
      >
        <span className="text-[15px] font-bold text-gray-900">{title}</span>
        {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
      <>
        {open && (
          <div
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">
              {children}
            </div>
          </div>
        )}
      </>
    </div>
  );
}

/* ─── Tag chip ─── */
function TagChip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="px-3.5 py-2 rounded-full text-[13px] font-medium transition-colors"
      style={{
        backgroundColor: selected ? '#3180F7' : '#FFFFFF',
        color: selected ? '#FFFFFF' : '#4B5563',
        border: selected ? '1px solid #3180F7' : '1px solid #D1D5DB',
      }}
    >
      {label}
    </button>
  );
}

/* ─── Main Page ─── */
export default function ProEditPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── State ── */
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [category, setCategory] = useState('');
  const [intro, setIntro] = useState('');
  const [careerYears, setCareerYears] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [mainPhotoIndex, setMainPhotoIndex] = useState(0);
  const [selectedCompanyLogos, setSelectedCompanyLogos] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [awards, setAwards] = useState('');
  const [videos, setVideos] = useState<string[]>([]);
  const [showYoutubeSearch, setShowYoutubeSearch] = useState(false);
  const [ytChannelQuery, setYtChannelQuery] = useState('');
  const [ytChannels, setYtChannels] = useState<Array<{ id: string; title: string; description: string; thumbnail: string }>>([]);
  const [ytVideos, setYtVideos] = useState<Array<{ id: string; title: string; thumbnail: string }>>([]);
  const [ytSelectedChannel, setYtSelectedChannel] = useState<string | null>(null);
  const [ytLoading, setYtLoading] = useState(false);

  const searchYtChannels = async () => {
    if (!ytChannelQuery.trim()) return;
    setYtLoading(true);
    setYtChannels([]);
    setYtVideos([]);
    setYtSelectedChannel(null);
    try {
      const res = await fetch(`/api/youtube?action=searchChannels&q=${encodeURIComponent(ytChannelQuery)}`);
      const data = await res.json();
      setYtChannels(data.channels || []);
    } catch {} finally { setYtLoading(false); }
  };

  const loadYtVideos = async (channelId: string) => {
    setYtSelectedChannel(channelId);
    setYtLoading(true);
    try {
      const res = await fetch(`/api/youtube?action=channelVideos&channelId=${channelId}`);
      const data = await res.json();
      setYtVideos(data.videos || []);
    } catch {} finally { setYtLoading(false); }
  };

  const addVideoUrl = (url: string) => {
    if (!url.trim()) return;
    if (videos.includes(url)) return;
    setVideos((prev) => [...prev, url]);
  };

  const removeVideo = (url: string) => {
    setVideos((prev) => prev.filter((v) => v !== url));
  };
  const [faqItems, setFaqItems] = useState<{ q: string; a: string }[]>([]);
  const [toast, setToast] = useState('');
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showCareerSheet, setShowCareerSheet] = useState(false);

  /* ── Load from localStorage ── */
  useEffect(() => {
    window.scrollTo(0, 0);
    setName(ls('proRegister_name'));
    setPhone(ls('proRegister_phone'));
    setGender(ls('proRegister_gender'));
    setCategory(ls('proRegister_category'));
    setIntro(ls('proRegister_intro'));
    setCareerYears(parseInt(ls('proRegister_careerYears', '1')) || 1);
    setSelectedCategories(lsJson('proRegister_selectedCategories', []));
    setSelectedRegions(lsJson('proRegister_selectedRegions', []));
    setPhotos(lsJson('proRegister_photos', []));
    setMainPhotoIndex(parseInt(ls('proRegister_mainPhotoIndex', '0')) || 0);
    setSelectedCompanyLogos(lsJson('proRegister_companyLogos', []));
    setLanguages(lsJson('proRegister_languages', []));
    const savedAwards = lsJson('proRegister_awards', []);
    setAwards(Array.isArray(savedAwards) ? savedAwards.map((a: any) => typeof a === 'string' ? a : a.text || '').join('\n') : ls('proRegister_awards'));
    const savedVideos = lsJson('proRegister_videos', null);
    if (Array.isArray(savedVideos)) setVideos(savedVideos);
    else {
      const legacy = ls('proRegister_videoUrl');
      if (legacy) setVideos([legacy]);
    }
    setFaqItems(lsJson('proRegister_faq', []));
  }, []);

  /* ── Formatters ── */
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '').slice(0, 11);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  };

  /* ── Toggle helpers ── */
  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };
  const toggleRegion = (region: string) => {
    setSelectedRegions(prev => prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]);
  };
  const toggleLanguage = (lang: string) => {
    setLanguages(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]);
  };

  /* ── Photo handlers ── */
  const handleAddPhoto = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onloadend = () => setPhotos(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };
  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    if (mainPhotoIndex === index) setMainPhotoIndex(0);
    else if (mainPhotoIndex > index) setMainPhotoIndex(prev => prev - 1);
  };
  const handleSetMain = (index: number) => setMainPhotoIndex(index);

  /* ── FAQ handlers ── */
  const addFaqItem = () => setFaqItems(prev => [...prev, { q: '', a: '' }]);
  const updateFaqItem = (index: number, field: 'q' | 'a', value: string) => {
    setFaqItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };
  const removeFaqItem = (index: number) => setFaqItems(prev => prev.filter((_, i) => i !== index));

  /* ── Save ── */
  const handleSave = async () => {
    // 1) localStorage 저장 (즉시 UI 반영용)
    localStorage.setItem('proRegister_name', name);
    localStorage.setItem('proRegister_phone', phone);
    localStorage.setItem('proRegister_gender', gender);
    localStorage.setItem('proRegister_category', category);
    localStorage.setItem('proRegister_intro', intro);
    localStorage.setItem('proRegister_careerYears', String(careerYears));
    localStorage.setItem('proRegister_selectedCategories', JSON.stringify(selectedCategories));
    localStorage.setItem('proRegister_selectedRegions', JSON.stringify(selectedRegions));
    localStorage.setItem('proRegister_photos', JSON.stringify(photos));
    localStorage.setItem('proRegister_mainPhotoIndex', String(mainPhotoIndex));
    localStorage.setItem('proRegister_companyLogos', JSON.stringify(selectedCompanyLogos));
    localStorage.setItem('proRegister_languages', JSON.stringify(languages));
    localStorage.setItem('proRegister_awards', awards);
    localStorage.setItem('proRegister_videos', JSON.stringify(videos));
    localStorage.setItem('proRegister_videoUrl', videos[0] || '');
    localStorage.setItem('proRegister_youtubeUrl', videos[0] || ''); // 상세페이지가 이 키를 읽음
    localStorage.setItem('proRegister_videos_all', JSON.stringify(videos)); // 여러 영상 보관용
    localStorage.setItem('proRegister_faq', JSON.stringify(faqItems));

    // 2) 서버에 업데이트 (pro detail 페이지 반영)
    try {
      const { prosApi } = await import('@/lib/api/pros.api');
      const awardsArray = awards.split('\n').filter(Boolean);
      await prosApi.submitRegistration({
        name: name || undefined,
        phone: phone || undefined,
        gender: gender || undefined,
        shortIntro: intro || undefined,
        mainExperience: awardsArray.length > 0 ? awardsArray.join(' / ') : undefined,
        careerYears: careerYears || undefined,
        awards: awards || undefined,
        youtubeUrl: videos[0] || undefined,
        photos: photos.length > 0 ? photos : undefined,
        mainPhotoIndex: mainPhotoIndex,
        faqs: faqItems.filter((f) => f.q && f.a).map((f) => ({ question: f.q, answer: f.a })),
        languages: languages.length > 0 ? languages : undefined,
      });
      // 프로 상세 in-memory 캐시 무효화
      try {
        const { invalidateProCache } = await import('@/lib/api/discovery.api');
        invalidateProCache(); // 전체 detail + list 삭제
        // 서버 캐시도 무효화: 내 프로 상세를 nocache=1로 강제 리프레시
        const { apiClient } = await import('@/lib/api/client');
        const { data: myPro } = await apiClient.get('/api/v1/pro/profile').catch(() => ({ data: null }));
        if (myPro?.id) {
          await apiClient.get(`/api/v1/discovery/pros/${myPro.id}?nocache=1&_=${Date.now()}`).catch(() => {});
          // localStorage에 내 프로 id도 저장 (다른 곳에서 참조용)
          localStorage.setItem('freetiful-my-pro-id', myPro.id);
        }
      } catch {}
      setToast('저장되었습니다');
    } catch (e) {
      console.error('프로필 저장 실패:', e);
      setToast('저장에 실패했습니다. 다시 시도해주세요.');
    }
    setTimeout(() => setToast(''), 2500);
  };

  return (
    <div className="bg-white min-h-screen max-w-lg mx-auto lg:max-w-2xl" style={{ letterSpacing: '-0.02em' }}>
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />

      {/* ─── Header ─── */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-gray-100/60">
        <div className="flex items-center gap-3 px-4 h-[52px]">
          <button onClick={() => router.back()} className="p-1">
            <ChevronLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="text-[17px] font-bold text-gray-900">프로필 수정</h1>
        </div>
      </div>

      {/* ─── Toast ─── */}
      <>
        {toast && (
          <div
            className="fixed top-[70px] left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg z-50"
          >
            <p className="text-[14px] font-bold flex items-center gap-2">
              <Check size={16} className="text-green-400" /> {toast}
            </p>
          </div>
        )}
      </>

      {/* ─── 1. 기본 정보 ─── */}
      <Section title="기본 정보" defaultOpen={true}>
        <div className="space-y-4">
          {/* 이름 (read-only) */}
          <div>
            <label className="block text-[12px] font-bold text-gray-400 mb-1.5">이름</label>
            <div className="w-full h-11 bg-gray-50 rounded-xl px-4 flex items-center text-[15px] text-gray-500">
              {name || '-'}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">이름은 변경할 수 없습니다</p>
          </div>

          {/* 전화번호 */}
          <div>
            <label className="block text-[12px] font-bold text-gray-400 mb-1.5">전화번호</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
              placeholder="010-0000-0000"
              className="w-full h-11 border border-gray-200 rounded-xl px-4 text-[16px] text-gray-900 outline-none focus:border-[#3180F7] focus:ring-1 focus:ring-[#3180F7]/20 transition-all"
            />
          </div>

          {/* 성별 (display) */}
          <div>
            <label className="block text-[12px] font-bold text-gray-400 mb-1.5">성별</label>
            <div className="w-full h-11 bg-gray-50 rounded-xl px-4 flex items-center text-[15px] text-gray-500">
              {gender || '-'}
            </div>
          </div>

          {/* 전문가분류 */}
          <div>
            <label className="block text-[12px] font-bold text-gray-400 mb-1.5">전문가분류</label>
            <button
              onClick={() => setShowCategorySheet(true)}
              className="w-full h-11 border border-gray-200 rounded-xl px-4 flex items-center justify-between text-[15px] text-gray-900 active:bg-gray-50 transition-colors"
            >
              <span className={category ? 'text-gray-900' : 'text-gray-400'}>{category || '선택해주세요'}</span>
              <ChevronDown size={18} className="text-gray-400" />
            </button>
          </div>
        </div>
      </Section>

      {/* ─── 2. 한줄 소개 ─── */}
      <Section title="한줄 소개" defaultOpen={true}>
        <div>
          <input
            type="text"
            value={intro}
            onChange={(e) => { if (e.target.value.length <= 50) setIntro(e.target.value); }}
            maxLength={50}
            placeholder="한줄로 자신을 소개해주세요"
            className="w-full h-11 border border-gray-200 rounded-xl px-4 text-[16px] text-gray-900 outline-none focus:border-[#3180F7] focus:ring-1 focus:ring-[#3180F7]/20 transition-all"
          />
          <p className="text-right text-[11px] text-gray-400 mt-1">{intro.length}/50</p>
        </div>
      </Section>

      {/* ─── 3. 경력 ─── */}
      <Section title="경력">
        <div>
          <button
            onClick={() => setShowCareerSheet(true)}
            className="w-full h-11 border border-gray-200 rounded-xl px-4 flex items-center justify-between text-[15px] active:bg-gray-50 transition-colors"
          >
            <span className="text-gray-900">{careerYears}년</span>
            <ChevronDown size={18} className="text-gray-400" />
          </button>
          {/* Horizontal pill preview */}
          <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1 scrollbar-hide">
            {[1, 3, 5, 7, 10, 15, 20, 25, 30].map(y => (
              <button
                key={y}
                onClick={() => setCareerYears(y)}
                className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors"
                style={{
                  backgroundColor: careerYears === y ? '#3180F7' : '#F3F4F6',
                  color: careerYears === y ? '#FFFFFF' : '#6B7280',
                }}
              >
                {y}년
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── 4. 전문영역 ─── */}
      <Section title="전문영역">
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">웨딩 / 가족행사</p>
            <div className="flex flex-wrap gap-2">
              {WEDDING_TAGS.map(cat => (
                <TagChip key={cat} label={cat} selected={selectedCategories.includes(cat)} onToggle={() => toggleCategory(cat)} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">기업 / 공식행사</p>
            <div className="flex flex-wrap gap-2">
              {EVENT_TAGS.map(cat => (
                <TagChip key={cat} label={cat} selected={selectedCategories.includes(cat)} onToggle={() => toggleCategory(cat)} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">기타</p>
            <div className="flex flex-wrap gap-2">
              {OTHER_TAGS.map(cat => (
                <TagChip key={cat} label={cat} selected={selectedCategories.includes(cat)} onToggle={() => toggleCategory(cat)} />
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ─── 5. 행사 가능 지역 ─── */}
      <Section title="행사 가능 지역">
        <div className="space-y-2">
          {REGIONS.map(region => {
            const selected = selectedRegions.includes(region);
            return (
              <button
                key={region}
                onClick={() => toggleRegion(region)}
                className="w-full py-3 rounded-xl text-[14px] font-bold border-2 flex items-center justify-center gap-2 transition-colors"
                style={{
                  backgroundColor: selected ? '#EFF6FF' : '#FFFFFF',
                  borderColor: selected ? '#3180F7' : '#E5E7EB',
                  color: selected ? '#3180F7' : '#9CA3AF',
                }}
              >
                <>
                  {selected && (
                    <span>
                      <Check size={16} className="text-[#3180F7] stroke-[3]" />
                    </span>
                  )}
                </>
                {region}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ─── 6. 프로필 사진 ─── */}
      <Section title="프로필 사진">
        <div className="grid grid-cols-3 gap-2.5">
          {/* Add button */}
          <button
            onClick={handleAddPhoto}
            className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 hover:border-[#3180F7] hover:bg-blue-50/30 transition-colors"
          >
            <Plus size={22} className="text-gray-400" />
            <span className="text-[11px] text-gray-400 font-medium">{photos.length}장</span>
          </button>

          {/* Photos */}
          {photos.map((photo, index) => (
            <div key={index} className="aspect-square relative rounded-xl overflow-hidden group">
              {/* Main badge */}
              {mainPhotoIndex === index && (
                <div className="absolute top-1.5 left-1.5 bg-[#3180F7] text-white text-[10px] px-2 py-0.5 rounded-full z-10 font-bold flex items-center gap-0.5">
                  <Star size={8} className="fill-white" /> 대표
                </div>
              )}
              <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-center pb-1.5 gap-1.5 opacity-0 group-hover:opacity-100">
                <button
                  onClick={() => handleSetMain(index)}
                  className="px-2 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-bold text-gray-700"
                >
                  대표설정
                </button>
              </div>
              {/* Delete */}
              <button
                onClick={() => handleRemovePhoto(index)}
                className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center z-10"
              >
                <X size={12} className="text-white stroke-[2.5]" />
              </button>
            </div>
          ))}
        </div>
        {photos.length > 0 && (
          <p className="text-[11px] text-gray-400 mt-2">사진 위에 마우스를 올려 대표 사진을 설정하세요</p>
        )}
      </Section>

      {/* ─── 7. 기업이력 ─── */}
      <Section title="기업이력">
        {selectedCompanyLogos.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {selectedCompanyLogos.map((logo, i) => (
              <div key={i} className="relative w-16 h-16 bg-white border border-gray-100 rounded-xl p-2 flex items-center justify-center">
                <img src={logo} alt="Company" className="w-full h-full object-contain" />
                <button
                  onClick={() => setSelectedCompanyLogos(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center"
                >
                  <X size={10} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-gray-400">등록된 기업이력이 없습니다</p>
        )}
        <button
          onClick={() => router.push('/pro-register/profile')}
          className="mt-3 w-full py-2.5 border border-gray-200 rounded-xl text-[13px] font-bold text-gray-600 active:bg-gray-50 transition-colors"
        >
          기업 선택 페이지로 이동
        </button>
      </Section>

      {/* ─── 8. 언어 ─── */}
      <Section title="언어">
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map(lang => (
            <TagChip key={lang} label={lang} selected={languages.includes(lang)} onToggle={() => toggleLanguage(lang)} />
          ))}
        </div>
      </Section>

      {/* ─── 9. 수상내역 ─── */}
      <Section title="수상내역">
        <textarea
          value={awards}
          onChange={(e) => setAwards(e.target.value)}
          placeholder="수상 이력을 자유롭게 입력해주세요"
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[16px] text-gray-900 outline-none focus:border-[#3180F7] focus:ring-1 focus:ring-[#3180F7]/20 transition-all resize-none"
        />
      </Section>

      {/* ─── 10. 소개영상 ─── */}
      <Section title="소개영상">
        <div className="space-y-3">
          {videos.map((url, i) => {
            const embedSrc = url.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/');
            return (
              <div key={i} className="relative">
                <div className="rounded-xl overflow-hidden bg-gray-100 aspect-video">
                  <iframe src={embedSrc} className="w-full h-full" allowFullScreen title={`영상 ${i + 1}`} />
                </div>
                <button
                  type="button"
                  onClick={() => removeVideo(url)}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white active:scale-90"
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
          {/* 영상 추가 버튼 */}
          <button
            type="button"
            onClick={() => setShowYoutubeSearch(true)}
            className="w-full h-12 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center gap-2 text-[14px] font-medium text-gray-500 hover:border-[#3180F7] hover:text-[#3180F7] active:scale-[0.98] transition-all"
          >
            <Plus size={16} /> 영상 추가 (YouTube 검색)
          </button>
          {/* URL 직접 입력 */}
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="또는 YouTube 링크 직접 입력"
              className="flex-1 h-11 border border-gray-200 rounded-xl px-4 text-[14px] text-gray-900 outline-none focus:border-[#3180F7] focus:ring-1 focus:ring-[#3180F7]/20 transition-all"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value;
                  if (val.trim()) { addVideoUrl(val.trim()); (e.target as HTMLInputElement).value = ''; }
                }
              }}
            />
          </div>
        </div>
      </Section>

      {/* YouTube 검색 모달 */}
      {showYoutubeSearch && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col" style={{ animation: 'slideInRight 0.3s ease' }}>
          <div className="shrink-0 px-4 pt-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => { setShowYoutubeSearch(false); setYtChannels([]); setYtVideos([]); setYtSelectedChannel(null); setYtChannelQuery(''); }}>
                <ChevronLeft size={24} className="text-gray-900" />
              </button>
              <h2 className="text-[18px] font-bold text-gray-900">YouTube 영상 검색</h2>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={ytChannelQuery}
                onChange={(e) => setYtChannelQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchYtChannels()}
                placeholder="채널명을 검색하세요"
                className="flex-1 h-11 bg-gray-50 border border-gray-200 rounded-xl px-4 outline-none text-[16px] text-gray-900 placeholder:text-gray-400 focus:border-[#3180F7]"
                autoFocus
              />
              <button onClick={searchYtChannels} className="h-11 px-4 bg-[#3180F7] text-white rounded-xl text-[14px] font-bold shrink-0 active:scale-95">
                검색
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {ytLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#3180F7] border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!ytSelectedChannel && ytChannels.length > 0 && !ytLoading && (
              <div className="p-4">
                <p className="text-[12px] text-gray-400 font-bold uppercase mb-3">채널 선택</p>
                <div className="space-y-2">
                  {ytChannels.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => loadYtVideos(ch.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 text-left active:scale-[0.98] transition-all"
                    >
                      <img src={ch.thumbnail} alt="" className="w-10 h-10 rounded-full object-cover bg-gray-200" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-gray-900 truncate">{ch.title}</p>
                        <p className="text-[12px] text-gray-400 truncate">{ch.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {ytSelectedChannel && ytVideos.length > 0 && !ytLoading && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[12px] text-gray-400 font-bold uppercase">영상 선택</p>
                  <button onClick={() => { setYtSelectedChannel(null); setYtVideos([]); }} className="text-[12px] text-[#3180F7] font-semibold">
                    채널 다시 선택
                  </button>
                </div>
                <div className="space-y-3">
                  {ytVideos.map((v) => {
                    const url = `https://www.youtube.com/watch?v=${v.id}`;
                    const already = videos.includes(url);
                    return (
                      <button
                        key={v.id}
                        onClick={() => { if (!already) addVideoUrl(url); }}
                        className={`w-full rounded-xl overflow-hidden border text-left transition-all ${already ? 'border-[#3180F7] bg-blue-50/30' : 'border-gray-100'}`}
                      >
                        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                          <img src={v.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover" />
                          {already && (
                            <div className="absolute top-2 right-2 w-7 h-7 bg-[#3180F7] rounded-full flex items-center justify-center shadow-md">
                              <Check size={16} className="text-white stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-[14px] font-semibold text-gray-900 line-clamp-2">{v.title}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!ytLoading && !ytChannelQuery && ytChannels.length === 0 && (
              <div className="flex flex-col items-center py-16">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="4" fill="#DBEAFE"/><path d="M10 8.5v7l6-3.5-6-3.5z" fill="#3180F7"/></svg>
                <p className="text-[14px] text-gray-500 mt-4">채널명을 검색해주세요</p>
              </div>
            )}
            {!ytLoading && ytChannels.length === 0 && !ytSelectedChannel && ytChannelQuery && (
              <p className="text-center text-gray-400 text-[14px] py-12">검색 결과가 없습니다</p>
            )}
          </div>

          {videos.length > 0 && (
            <div className="shrink-0 p-4 pb-8 bg-white border-t border-gray-100">
              <button
                onClick={() => { setShowYoutubeSearch(false); setYtChannels([]); setYtVideos([]); setYtSelectedChannel(null); setYtChannelQuery(''); }}
                className="w-full py-4 bg-[#3180F7] text-white rounded-2xl font-bold text-[16px] active:scale-[0.98]"
              >
                완료 ({videos.length}개 영상)
              </button>
            </div>
          )}

          <style dangerouslySetInnerHTML={{ __html: `@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }` }} />
        </div>
      )}

      {/* ─── 11. FAQ ─── */}
      <Section title="FAQ">
        <div className="space-y-3">
          {faqItems.map((item, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-xl p-3 space-y-2 relative"
            >
              <button
                onClick={() => removeFaqItem(index)}
                className="absolute top-2 right-2 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center"
              >
                <X size={12} className="text-gray-500" />
              </button>
              <input
                type="text"
                value={item.q}
                onChange={(e) => updateFaqItem(index, 'q', e.target.value)}
                placeholder="질문을 입력하세요"
                className="w-full text-[16px] font-bold text-gray-900 outline-none border-b border-gray-100 pb-2 pr-6"
              />
              <textarea
                value={item.a}
                onChange={(e) => updateFaqItem(index, 'a', e.target.value)}
                placeholder="답변을 입력하세요"
                rows={2}
                className="w-full text-[16px] text-gray-600 outline-none resize-none"
              />
            </div>
          ))}
          <button
            onClick={addFaqItem}
            className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-[13px] font-bold text-gray-500 flex items-center justify-center gap-1 active:bg-gray-50 transition-colors"
          >
            <Plus size={14} /> FAQ 항목 추가
          </button>
        </div>
      </Section>

      {/* ─── Save Button ─── */}
      <div className="p-5 pb-10">
        <button
          onClick={handleSave}
          className="w-full h-[52px] bg-[#3180F7] hover:bg-[#2668d8] text-white font-bold rounded-2xl text-[15px] transition-colors active:scale-[0.98]"
        >
          저장하기
        </button>
      </div>

      {/* ─── 전문가분류 바텀시트 ─── */}
      <>
        {showCategorySheet && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-end"
            onClick={() => setShowCategorySheet(false)}
          >
            <div
              className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
              <h2 className="text-xl font-bold mb-2">전문가분류를 선택해주세요</h2>
              <p className="text-[13px] text-gray-500 mb-6">선택한 전문가분류로 활동이 가능합니다</p>
              {['사회자', '쇼호스트', '축가/연주'].map(item => (
                <button
                  key={item}
                  onClick={() => { setCategory(item); setShowCategorySheet(false); }}
                  className={`w-full py-4 rounded-2xl mb-3 text-[18px] font-bold transition-all ${
                    category === item
                      ? 'bg-blue-50 border-2 border-[#3180F7] text-[#3180F7]'
                      : 'bg-white border-2 border-gray-200 text-gray-400'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}
      </>

      {/* ─── 경력 바텀시트 ─── */}
      <>
        {showCareerSheet && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-end"
            onClick={() => setShowCareerSheet(false)}
          >
            <div
              className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 max-h-[60vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
              <h2 className="text-xl font-bold mb-4">경력을 선택해주세요</h2>
              <div className="flex-1 overflow-y-auto space-y-2 pb-4">
                {CAREER_YEARS.map(y => (
                  <button
                    key={y}
                    onClick={() => { setCareerYears(y); setShowCareerSheet(false); }}
                    className={`w-full py-3 rounded-xl text-[16px] font-bold transition-all ${
                      careerYears === y
                        ? 'bg-blue-50 border-2 border-[#3180F7] text-[#3180F7]'
                        : 'bg-white border-2 border-gray-100 text-gray-500'
                    }`}
                  >
                    {y}년
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </>
    </div>
  );
}
