'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronLeft, Check } from 'lucide-react';
const WEDDING_TAGS = ['결혼식', '돌잔치', '회갑/칠순', '상견례'];
const EVENT_TAGS = ['기업행사', '컨퍼런스/세미나', '체육대회', '송년회/시무식', '레크리에이션', '팀빌딩', '라이브커머스', '기업PT', '축제/페스티벌', '공식행사'];
const OTHER_TAGS = ['레슨/클래스', '쇼호스트', '축가/연주'];

export default function PersonalInfoPage() {
  const router = useRouter();
  const [name, setName] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('proRegister_name') || '';
    return '';
  });
  const [phone, setPhone] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('proRegister_phone') || '';
    return '';
  });
  const [gender, setGender] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('proRegister_gender') || '';
    return '';
  });
  const [category, setCategory] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('proRegister_category') || '';
    return '';
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('proRegister_selectedCategories');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [showGenderSheet, setShowGenderSheet] = useState(false);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { localStorage.setItem('proRegister_name', name); }, [name]);
  useEffect(() => { localStorage.setItem('proRegister_phone', phone); }, [phone]);
  useEffect(() => { localStorage.setItem('proRegister_gender', gender); }, [gender]);
  useEffect(() => { localStorage.setItem('proRegister_category', category); }, [category]);
  useEffect(() => { localStorage.setItem('proRegister_selectedCategories', JSON.stringify(selectedCategories)); }, [selectedCategories]);

  const displayCategory = () => {
    return category || '';
  };

  const validatePhone = (phoneNumber: string) => /^010-\d{4}-\d{4}$/.test(phoneNumber);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '').slice(0, 11);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  };

  const isFormValid = name && phone && gender && category && selectedCategories.length > 0;

  const handleNext = () => {
    if (!isFormValid) return;
    if (!validatePhone(phone)) {
      setToast('올바른 휴대폰 양식이 아닙니다.');
      setTimeout(() => setToast(''), 3000);
      return;
    }
    router.push('/pro-register/regions');
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col" style={{ height: '100dvh' }}>
      {/* Header — fixed */}
      <div className="shrink-0 px-6 pt-4 pb-4">
        <button onClick={() => router.back()} className="mb-4">
          <ChevronLeft size={24} className="text-gray-900" />
        </button>
        {/* Progress bar */}
        <div className="relative h-[3px] bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className="absolute left-0 top-0 h-full bg-[#3180F7] rounded-full"
          />
        </div>
        <h1
          className="text-2xl font-bold text-gray-900"
        >
          개인정보 <span className="text-[11px] text-gray-400">3/7</span>
        </h1>
      </div>

      {/* Toast */}
      <>
        {toast && (
          <div
            className="fixed top-[100px] left-1/2 -translate-x-1/2 bg-white px-6 py-3.5 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.15)] z-50"
          >
            <p className="text-sm font-medium text-gray-900">{toast}</p>
          </div>
        )}
      </>

      {/* Form — scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* 이름 */}
        <div className="mb-8">
          {name && <label className="block text-xs mb-1 text-[#3180F7] transition-colors">이름</label>}
          <input
            type="text"
            value={name}
            onChange={(e) => { if (e.target.value.length <= 4) setName(e.target.value); }}
            maxLength={4}
            placeholder="이름 (최대 4자)"
            className={`w-full text-[16px] font-semibold outline-none pb-2 transition-all placeholder:text-gray-300 ${
              name ? 'border-b-2 border-[#3180F7] text-gray-900' : 'border-b border-gray-300 text-gray-900'
            } focus:border-b-2 focus:border-[#3180F7]`}
          />
        </div>

        {/* 전화번호 */}
        <div className="mb-8">
          {phone && <label className="block text-xs mb-1 text-[#3180F7] transition-colors">전화번호</label>}
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
            placeholder="010-0000-0000"
            className={`w-full text-[16px] font-semibold outline-none pb-2 transition-all ${
              phone ? 'border-b-2 border-[#3180F7] text-gray-900' : 'border-b border-gray-300 text-gray-400'
            } focus:border-b-2 focus:border-[#3180F7]`}
          />
        </div>

        {/* 성별 */}
        <div className="mb-8">
          {gender && <label className="block text-xs mb-1 text-[#3180F7] transition-colors">성별</label>}
          <button
            onClick={() => setShowGenderSheet(true)}
            className={`w-full flex items-center justify-between pb-2 transition-all ${
              gender ? 'border-b-2 border-[#3180F7]' : 'border-b border-gray-300 focus:border-b-2 focus:border-[#3180F7]'
            }`}
          >
            <span className={`text-[16px] font-semibold ${gender ? 'text-gray-900' : 'text-gray-400'}`}>
              {gender || '성별을 선택해주세요'}
            </span>
            <ChevronDown size={20} className="text-gray-400" />
          </button>
        </div>

        {/* 전문가분류 */}
        <div className="mb-10">
          {category && <label className="block text-xs mb-1 text-[#3180F7] transition-colors">전문가분류</label>}
          <button
            onClick={() => setShowCategorySheet(true)}
            className={`w-full flex items-center justify-between pb-2 transition-all ${
              category ? 'border-b-2 border-[#3180F7]' : 'border-b border-gray-300 focus:border-b-2 focus:border-[#3180F7]'
            }`}
          >
            <span className={`text-[16px] font-semibold ${category ? 'text-gray-900' : 'text-gray-400'}`}>
              {displayCategory() || '전문가분류를 선택해주세요'}
            </span>
            <ChevronDown size={20} className="text-gray-400" />
          </button>
        </div>

        {/* [필수]전문영역 */}
        <div className="mb-6">
          <p className="text-sm font-bold text-gray-900 mb-1">[필수]전문영역</p>
          <p className="text-xs text-gray-400 mb-4">가능한 분야를 모두 선택해주세요</p>

          {/* 웨딩/가족행사 */}
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">웨딩 · 가족행사</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {WEDDING_TAGS.map((cat, i) => (
              <TagChip key={cat} label={cat} selected={selectedCategories.includes(cat)} onToggle={() => toggleCategory(cat)} delay={0.4 + i * 0.03} />
            ))}
          </div>

          {/* 기업/공식행사 */}
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">기업 · 공식행사</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {EVENT_TAGS.map((cat, i) => (
              <TagChip key={cat} label={cat} selected={selectedCategories.includes(cat)} onToggle={() => toggleCategory(cat)} delay={0.5 + i * 0.03} />
            ))}
          </div>

          {/* 기타 */}
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">기타</p>
          <div className="flex flex-wrap gap-2">
            {OTHER_TAGS.map((cat, i) => (
              <TagChip key={cat} label={cat} selected={selectedCategories.includes(cat)} onToggle={() => toggleCategory(cat)} delay={0.6 + i * 0.03} />
            ))}
          </div>
        </div>
      </div>

      {/* Next Button — fixed bottom */}
      <div className="shrink-0 p-6 pb-8 bg-white">
        <button
          onClick={handleNext}
          disabled={!isFormValid}
          className="w-full py-4 rounded-2xl font-bold text-base"
        >
          다음
        </button>
      </div>

      {/* 성별 선택 바텀시트 */}
      <>
        {showGenderSheet && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-end"
            onClick={() => setShowGenderSheet(false)}
          >
            <div
              className="bg-white rounded-t-3xl w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
              <h2 className="text-xl font-bold mb-6">성별을 선택해주세요.</h2>
              {['남성', '여성'].map((g) => (
                <button
                  key={g}
                  onClick={() => { setGender(g); setShowGenderSheet(false); }}
                  className={`w-full py-4 rounded-2xl mb-3 text-[18px] font-bold transition-all ${
                    gender === g
                      ? 'bg-blue-50 border-2 border-[#3180F7] text-[#3180F7] font-medium'
                      : 'bg-white border-2 border-gray-200 text-gray-400'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}
      </>

      {/* 전문가분류 선택 바텀시트 */}
      <>
        {showCategorySheet && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-end"
            onClick={() => setShowCategorySheet(false)}
          >
            <div
              className="bg-white rounded-t-3xl w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
              <h2 className="text-xl font-bold mb-2">전문가분류를 선택해주세요.</h2>
              <p className="text-sm text-gray-500 mb-6">선택한 전문가분류로 활동이 가능합니다.</p>
              {['사회자', '쇼호스트', '축가/연주'].map((item) => (
                <button
                  key={item}
                  onClick={() => { setCategory(item); setShowCategorySheet(false); }}
                  className={`w-full py-4 rounded-2xl mb-3 text-[18px] font-bold transition-all ${
                    category === item
                      ? 'bg-blue-50 border-2 border-[#3180F7] text-[#3180F7] font-medium'
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
    </div>
  );
}

function TagChip({ label, selected, onToggle, delay }: { label: string; selected: boolean; onToggle: () => void; delay: number }) {
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
