'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronLeft, Check } from 'lucide-react';

const CATEGORIES = ['결혼식', '행사', '회갑/칠순', '돌잔치', '레슨/클래스'];

export default function PersonalInfoPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [category, setCategory] = useState(''); // 사회자, 쇼호스트, 축가/연주
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showGenderSheet, setShowGenderSheet] = useState(false);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [toast, setToast] = useState('');

  // 전문가분류 표시용 (전문영역 + 전문가분류 결합)
  const displayCategory = () => {
    if (!category) return '';
    if (selectedCategories.length > 0) {
      return `${selectedCategories[0]}${category}`;
    }
    return category;
  };

  const validatePhone = (phoneNumber: string) => {
    const phoneRegex = /^010-\d{4}-\d{4}$/;
    return phoneRegex.test(phoneNumber);
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const formatPhoneNumber = (value: string) => {
    // 숫자만 추출
    const numbers = value.replace(/[^\d]/g, '');

    // 11자리로 제한
    const limited = numbers.slice(0, 11);

    // 자동 하이픈 추가
    if (limited.length <= 3) {
      return limited;
    } else if (limited.length <= 7) {
      return `${limited.slice(0, 3)}-${limited.slice(3)}`;
    } else {
      return `${limited.slice(0, 3)}-${limited.slice(3, 7)}-${limited.slice(7)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  const isFormValid = name && phone && gender && category && selectedCategories.length > 0;

  const handleNext = () => {
    if (!isFormValid) {
      return;
    }

    if (!validatePhone(phone)) {
      setToast('올바른 휴대폰 양식이 아닙니다.');
      setTimeout(() => setToast(''), 3000);
      return;
    }

    // 다음 페이지로 이동
    router.push('/pro-register/regions');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <button onClick={() => router.back()} className="mb-10">
          <ChevronLeft size={24} className="text-gray-900" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">개인정보</h1>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-[140px] left-1/2 -translate-x-1/2 bg-white px-6 py-3.5 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.15)] z-50 animate-fade-in">
          <p className="text-sm font-medium text-gray-900">{toast}</p>
        </div>
      )}

      {/* Form */}
      <div className="px-6 py-6 flex-1">
        {/* 이름 */}
        <div className="mb-8">
          <label className={`block text-xs mb-1 ${name ? 'text-[#3180F7]' : 'text-gray-400'}`}>
            이름
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full text-[20px] font-semibold outline-none pb-2 ${
              name ? 'border-b-2 border-[#3180F7] text-gray-900' : 'border-b border-gray-300 text-gray-900'
            }`}
          />
        </div>

        {/* 전화번호 */}
        <div className="mb-8">
          <label className={`block text-xs mb-1 ${phone ? 'text-[#3180F7]' : 'text-gray-400'}`}>
            전화번호
          </label>
          <input
            type="tel"
            value={phone}
            onChange={handlePhoneChange}
            className={`w-full text-[20px] font-semibold outline-none pb-2 ${
              phone ? 'border-b-2 border-[#3180F7] text-gray-900' : 'border-b border-gray-300 text-gray-400'
            }`}
          />
        </div>

        {/* 성별 */}
        <div className="mb-8">
          <label className={`block text-xs mb-1 ${gender ? 'text-[#3180F7]' : 'text-gray-400'}`}>
            성별
          </label>
          <button
            onClick={() => setShowGenderSheet(true)}
            className={`w-full flex items-center justify-between pb-2 ${
              gender ? 'border-b-2 border-[#3180F7]' : 'border-b border-gray-300'
            }`}
          >
            <span className={`text-[20px] font-semibold ${gender ? 'text-gray-900' : 'text-gray-400'}`}>
              {gender || '성별을 선택해주세요'}
            </span>
            <ChevronDown size={20} className="text-gray-400" />
          </button>
        </div>

        {/* 전문가분류 */}
        <div className="mb-10">
          <label className={`block text-xs mb-1 ${category ? 'text-[#3180F7]' : 'text-gray-400'}`}>
            전문가분류
          </label>
          <button
            onClick={() => setShowCategorySheet(true)}
            className={`w-full flex items-center justify-between pb-2 ${
              category ? 'border-b-2 border-[#3180F7]' : 'border-b border-gray-300'
            }`}
          >
            <span className={`text-[20px] font-semibold ${category ? 'text-gray-900' : 'text-gray-400'}`}>
              {displayCategory() || '전문가분류를 선택해주세요'}
            </span>
            <ChevronDown size={20} className="text-gray-400" />
          </button>
        </div>

        {/* [필수]전문영역 */}
        <div className="mb-6">
          <p className="text-sm font-bold text-gray-900 mb-4">[필수]전문영역</p>
          <div className="flex flex-wrap gap-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`px-4 py-2.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all ${
                  selectedCategories.includes(cat)
                    ? 'bg-[#3180F7] text-white'
                    : 'bg-white text-gray-600 border border-gray-300'
                }`}
              >
                {selectedCategories.includes(cat) && (
                  <div className="w-5 h-5 rounded-md bg-white flex items-center justify-center shrink-0">
                    <Check size={14} className="text-[#3180F7] stroke-[3]" />
                  </div>
                )}
                {!selectedCategories.includes(cat) && (
                  <div className="w-5 h-5 rounded-md border-2 border-gray-300 bg-white shrink-0" />
                )}
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Next Button */}
      <div className="p-6 pb-8">
        <button
          onClick={handleNext}
          disabled={!isFormValid}
          className={`w-full py-4 rounded-2xl font-bold text-base transition-colors ${
            isFormValid
              ? 'bg-[#3180F7] text-white'
              : 'bg-blue-100 text-blue-300 cursor-not-allowed'
          }`}
        >
          다음
        </button>
      </div>

      {/* 성별 선택 바텀시트 */}
      {showGenderSheet && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowGenderSheet(false)}>
          <div className="bg-white rounded-t-3xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
            <h2 className="text-xl font-bold mb-6">성별을 선택해주세요.</h2>

            <button
              onClick={() => {
                setGender('남성');
                setShowGenderSheet(false);
              }}
              className={`w-full py-4 rounded-2xl mb-3 ${
                gender === '남성'
                  ? 'bg-blue-50 border-2 border-[#3180F7] text-[#3180F7] font-medium'
                  : 'bg-white border-2 border-gray-200 text-gray-400'
              }`}
            >
              남성
            </button>

            <button
              onClick={() => {
                setGender('여성');
                setShowGenderSheet(false);
              }}
              className={`w-full py-4 rounded-2xl ${
                gender === '여성'
                  ? 'bg-blue-50 border-2 border-[#3180F7] text-[#3180F7] font-medium'
                  : 'bg-white border-2 border-gray-200 text-gray-400'
              }`}
            >
              여성
            </button>
          </div>
        </div>
      )}

      {/* 전문가분류 선택 바텀시트 */}
      {showCategorySheet && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowCategorySheet(false)}>
          <div className="bg-white rounded-t-3xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
            <h2 className="text-xl font-bold mb-2">전문가분류를 선택해주세요.</h2>
            <p className="text-sm text-gray-500 mb-6">선택한 전문가분류로 활동이 가능합니다.</p>

            {['사회자', '쇼호스트', '축가/연주'].map((item) => (
              <button
                key={item}
                onClick={() => {
                  setCategory(item);
                  setShowCategorySheet(false);
                }}
                className={`w-full py-4 rounded-2xl mb-3 ${
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
    </div>
  );
}
