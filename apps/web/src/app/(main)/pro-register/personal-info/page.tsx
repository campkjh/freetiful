'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronLeft, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = ['결혼식', '행사', '회갑/칠순', '돌잔치', '레슨/클래스'];

export default function PersonalInfoPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [category, setCategory] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showGenderSheet, setShowGenderSheet] = useState(false);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [toast, setToast] = useState('');

  const displayCategory = () => {
    if (!category) return '';
    if (selectedCategories.length > 0) return `${selectedCategories[0]}${category}`;
    return category;
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
        <motion.button onClick={() => router.back()} className="mb-4" whileTap={{ scale: 0.9 }}>
          <ChevronLeft size={24} className="text-gray-900" />
        </motion.button>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-2xl font-bold text-gray-900"
        >
          개인정보
        </motion.h1>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-[100px] left-1/2 -translate-x-1/2 bg-white px-6 py-3.5 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.15)] z-50"
          >
            <p className="text-sm font-medium text-gray-900">{toast}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form — scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* 이름 */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-8">
          <label className={`block text-xs mb-1 transition-colors ${name ? 'text-[#3180F7]' : 'text-gray-400'}`}>이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full text-[20px] font-semibold outline-none pb-2 transition-all ${
              name ? 'border-b-2 border-[#3180F7] text-gray-900' : 'border-b border-gray-300 text-gray-900'
            }`}
          />
        </motion.div>

        {/* 전화번호 */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
          <label className={`block text-xs mb-1 transition-colors ${phone ? 'text-[#3180F7]' : 'text-gray-400'}`}>전화번호</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
            placeholder="010-0000-0000"
            className={`w-full text-[20px] font-semibold outline-none pb-2 transition-all ${
              phone ? 'border-b-2 border-[#3180F7] text-gray-900' : 'border-b border-gray-300 text-gray-400'
            }`}
          />
        </motion.div>

        {/* 성별 */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mb-8">
          <label className={`block text-xs mb-1 transition-colors ${gender ? 'text-[#3180F7]' : 'text-gray-400'}`}>성별</label>
          <motion.button
            onClick={() => setShowGenderSheet(true)}
            whileTap={{ scale: 0.99 }}
            className={`w-full flex items-center justify-between pb-2 transition-all ${
              gender ? 'border-b-2 border-[#3180F7]' : 'border-b border-gray-300'
            }`}
          >
            <span className={`text-[20px] font-semibold ${gender ? 'text-gray-900' : 'text-gray-400'}`}>
              {gender || '성별을 선택해주세요'}
            </span>
            <ChevronDown size={20} className="text-gray-400" />
          </motion.button>
        </motion.div>

        {/* 전문가분류 */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-10">
          <label className={`block text-xs mb-1 transition-colors ${category ? 'text-[#3180F7]' : 'text-gray-400'}`}>전문가분류</label>
          <motion.button
            onClick={() => setShowCategorySheet(true)}
            whileTap={{ scale: 0.99 }}
            className={`w-full flex items-center justify-between pb-2 transition-all ${
              category ? 'border-b-2 border-[#3180F7]' : 'border-b border-gray-300'
            }`}
          >
            <span className={`text-[20px] font-semibold ${category ? 'text-gray-900' : 'text-gray-400'}`}>
              {displayCategory() || '전문가분류를 선택해주세요'}
            </span>
            <ChevronDown size={20} className="text-gray-400" />
          </motion.button>
        </motion.div>

        {/* [필수]전문영역 */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mb-6">
          <p className="text-sm font-bold text-gray-900 mb-4">[필수]전문영역</p>
          <div className="flex flex-wrap gap-3">
            {CATEGORIES.map((cat, i) => {
              const selected = selectedCategories.includes(cat);
              return (
                <motion.button
                  key={cat}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => toggleCategory(cat)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: selected ? '#3180F7' : '#FFFFFF',
                    color: selected ? '#FFFFFF' : '#4B5563',
                    border: selected ? '1px solid #3180F7' : '1px solid #D1D5DB',
                  }}
                >
                  <motion.div
                    animate={{
                      backgroundColor: selected ? '#FFFFFF' : '#FFFFFF',
                      borderColor: selected ? '#FFFFFF' : '#D1D5DB',
                    }}
                    className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 border-2"
                  >
                    <AnimatePresence>
                      {selected && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
                          <Check size={14} className="text-[#3180F7] stroke-[3]" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                  {cat}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Next Button — fixed bottom */}
      <div className="shrink-0 p-6 pb-8 bg-white">
        <motion.button
          onClick={handleNext}
          disabled={!isFormValid}
          whileTap={{ scale: 0.96 }}
          animate={{
            backgroundColor: isFormValid ? '#3180F7' : '#DBEAFE',
            color: isFormValid ? '#FFFFFF' : '#93C5FD',
          }}
          transition={{ duration: 0.25 }}
          className="w-full py-4 rounded-2xl font-bold text-base"
        >
          다음
        </motion.button>
      </div>

      {/* 성별 선택 바텀시트 */}
      <AnimatePresence>
        {showGenderSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end"
            onClick={() => setShowGenderSheet(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="bg-white rounded-t-3xl w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
              <h2 className="text-xl font-bold mb-6">성별을 선택해주세요.</h2>
              {['남성', '여성'].map((g) => (
                <motion.button
                  key={g}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setGender(g); setShowGenderSheet(false); }}
                  className={`w-full py-4 rounded-2xl mb-3 transition-all ${
                    gender === g
                      ? 'bg-blue-50 border-2 border-[#3180F7] text-[#3180F7] font-medium'
                      : 'bg-white border-2 border-gray-200 text-gray-400'
                  }`}
                >
                  {g}
                </motion.button>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 전문가분류 선택 바텀시트 */}
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
              className="bg-white rounded-t-3xl w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
              <h2 className="text-xl font-bold mb-2">전문가분류를 선택해주세요.</h2>
              <p className="text-sm text-gray-500 mb-6">선택한 전문가분류로 활동이 가능합니다.</p>
              {['사회자', '쇼호스트', '축가/연주'].map((item) => (
                <motion.button
                  key={item}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setCategory(item); setShowCategorySheet(false); }}
                  className={`w-full py-4 rounded-2xl mb-3 transition-all ${
                    category === item
                      ? 'bg-blue-50 border-2 border-[#3180F7] text-[#3180F7] font-medium'
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
    </div>
  );
}
