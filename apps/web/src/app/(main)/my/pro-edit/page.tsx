'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronDown, ChevronUp, Plus, X, Check, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b border-gray-100"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 active:bg-gray-50 transition-colors"
      >
        <span className="text-[15px] font-bold text-gray-900">{title}</span>
        {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Tag chip ─── */
function TagChip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={onToggle}
      className="px-3.5 py-2 rounded-full text-[13px] font-medium transition-colors"
      style={{
        backgroundColor: selected ? '#3180F7' : '#FFFFFF',
        color: selected ? '#FFFFFF' : '#4B5563',
        border: selected ? '1px solid #3180F7' : '1px solid #D1D5DB',
      }}
    >
      {label}
    </motion.button>
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
  const [videoUrl, setVideoUrl] = useState('');
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
    setAwards(ls('proRegister_awards'));
    setVideoUrl(ls('proRegister_videoUrl'));
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
  const handleSave = () => {
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
    localStorage.setItem('proRegister_videoUrl', videoUrl);
    localStorage.setItem('proRegister_faq', JSON.stringify(faqItems));

    setToast('저장되었습니다');
    setTimeout(() => setToast(''), 2500);
  };

  return (
    <div className="bg-white min-h-screen max-w-lg mx-auto lg:max-w-2xl" style={{ letterSpacing: '-0.02em' }}>
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />

      {/* ─── Header ─── */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-gray-100/60">
        <div className="flex items-center gap-3 px-4 h-[52px]">
          <motion.button onClick={() => router.back()} className="p-1" whileTap={{ scale: 0.9 }}>
            <ChevronLeft size={24} className="text-gray-700" />
          </motion.button>
          <h1 className="text-[17px] font-bold text-gray-900">프로필 수정</h1>
        </div>
      </div>

      {/* ─── Toast ─── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-[70px] left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg z-50"
          >
            <p className="text-[14px] font-bold flex items-center gap-2">
              <Check size={16} className="text-green-400" /> {toast}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

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
            <motion.button
              whileTap={{ scale: 0.99 }}
              onClick={() => setShowCategorySheet(true)}
              className="w-full h-11 border border-gray-200 rounded-xl px-4 flex items-center justify-between text-[15px] text-gray-900 active:bg-gray-50 transition-colors"
            >
              <span className={category ? 'text-gray-900' : 'text-gray-400'}>{category || '선택해주세요'}</span>
              <ChevronDown size={18} className="text-gray-400" />
            </motion.button>
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
          <motion.button
            whileTap={{ scale: 0.99 }}
            onClick={() => setShowCareerSheet(true)}
            className="w-full h-11 border border-gray-200 rounded-xl px-4 flex items-center justify-between text-[15px] active:bg-gray-50 transition-colors"
          >
            <span className="text-gray-900">{careerYears}년</span>
            <ChevronDown size={18} className="text-gray-400" />
          </motion.button>
          {/* Horizontal pill preview */}
          <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1 scrollbar-hide">
            {[1, 3, 5, 7, 10, 15, 20, 25, 30].map(y => (
              <motion.button
                key={y}
                whileTap={{ scale: 0.93 }}
                onClick={() => setCareerYears(y)}
                className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors"
                style={{
                  backgroundColor: careerYears === y ? '#3180F7' : '#F3F4F6',
                  color: careerYears === y ? '#FFFFFF' : '#6B7280',
                }}
              >
                {y}년
              </motion.button>
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
              <motion.button
                key={region}
                whileTap={{ scale: 0.97 }}
                onClick={() => toggleRegion(region)}
                className="w-full py-3 rounded-xl text-[14px] font-bold border-2 flex items-center justify-center gap-2 transition-colors"
                style={{
                  backgroundColor: selected ? '#EFF6FF' : '#FFFFFF',
                  borderColor: selected ? '#3180F7' : '#E5E7EB',
                  color: selected ? '#3180F7' : '#9CA3AF',
                }}
              >
                <AnimatePresence>
                  {selected && (
                    <motion.span initial={{ scale: 0, width: 0 }} animate={{ scale: 1, width: 'auto' }} exit={{ scale: 0, width: 0 }}>
                      <Check size={16} className="text-[#3180F7] stroke-[3]" />
                    </motion.span>
                  )}
                </AnimatePresence>
                {region}
              </motion.button>
            );
          })}
        </div>
      </Section>

      {/* ─── 6. 프로필 사진 ─── */}
      <Section title="프로필 사진">
        <div className="grid grid-cols-3 gap-2.5">
          {/* Add button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleAddPhoto}
            className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 hover:border-[#3180F7] hover:bg-blue-50/30 transition-colors"
          >
            <Plus size={22} className="text-gray-400" />
            <span className="text-[11px] text-gray-400 font-medium">{photos.length}장</span>
          </motion.button>

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
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push('/pro-register/profile')}
          className="mt-3 w-full py-2.5 border border-gray-200 rounded-xl text-[13px] font-bold text-gray-600 active:bg-gray-50 transition-colors"
        >
          기업 선택 페이지로 이동
        </motion.button>
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
        <div>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="YouTube 링크를 입력해주세요"
            className="w-full h-11 border border-gray-200 rounded-xl px-4 text-[16px] text-gray-900 outline-none focus:border-[#3180F7] focus:ring-1 focus:ring-[#3180F7]/20 transition-all"
          />
          {videoUrl && videoUrl.includes('youtu') && (
            <div className="mt-3 rounded-xl overflow-hidden bg-gray-100 aspect-video">
              <iframe
                src={videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/')}
                className="w-full h-full"
                allowFullScreen
                title="소개 영상"
              />
            </div>
          )}
        </div>
      </Section>

      {/* ─── 11. FAQ ─── */}
      <Section title="FAQ">
        <div className="space-y-3">
          {faqItems.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
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
            </motion.div>
          ))}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={addFaqItem}
            className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-[13px] font-bold text-gray-500 flex items-center justify-center gap-1 active:bg-gray-50 transition-colors"
          >
            <Plus size={14} /> FAQ 항목 추가
          </motion.button>
        </div>
      </Section>

      {/* ─── Save Button ─── */}
      <div className="p-5 pb-10">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          className="w-full h-[52px] bg-[#3180F7] hover:bg-[#2668d8] text-white font-bold rounded-2xl text-[15px] transition-colors active:scale-[0.98]"
        >
          저장하기
        </motion.button>
      </div>

      {/* ─── 전문가분류 바텀시트 ─── */}
      <AnimatePresence>
        {showCategorySheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end"
            onClick={() => setShowCategorySheet(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
              <h2 className="text-xl font-bold mb-2">전문가분류를 선택해주세요</h2>
              <p className="text-[13px] text-gray-500 mb-6">선택한 전문가분류로 활동이 가능합니다</p>
              {['사회자', '쇼호스트', '축가/연주'].map(item => (
                <motion.button
                  key={item}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setCategory(item); setShowCategorySheet(false); }}
                  className={`w-full py-4 rounded-2xl mb-3 text-[18px] font-bold transition-all ${
                    category === item
                      ? 'bg-blue-50 border-2 border-[#3180F7] text-[#3180F7]'
                      : 'bg-white border-2 border-gray-200 text-gray-400'
                  }`}
                >
                  {item}
                </motion.button>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── 경력 바텀시트 ─── */}
      <AnimatePresence>
        {showCareerSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end"
            onClick={() => setShowCareerSheet(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 max-h-[60vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
              <h2 className="text-xl font-bold mb-4">경력을 선택해주세요</h2>
              <div className="flex-1 overflow-y-auto space-y-2 pb-4">
                {CAREER_YEARS.map(y => (
                  <motion.button
                    key={y}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setCareerYears(y); setShowCareerSheet(false); }}
                    className={`w-full py-3 rounded-xl text-[16px] font-bold transition-all ${
                      careerYears === y
                        ? 'bg-blue-50 border-2 border-[#3180F7] text-[#3180F7]'
                        : 'bg-white border-2 border-gray-100 text-gray-500'
                    }`}
                  >
                    {y}년
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
