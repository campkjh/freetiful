'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronLeft, Check, UserRoundCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const REQUIRED_TERMS = [
  '[필수]개인정보처리방침',
  '[필수]개인정보수집 및 이용 동의',
  '[필수]개인정보 제 3자 제공 동의',
  '[필수]마케팅 정보 수신 및 동의',
  '[필수]프리티풀 전속 파트너스 계약 동의',
];

export default function TermsPage() {
  const router = useRouter();
  const [allAgreed, setAllAgreed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('proRegister_allAgreed');
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });
  const [terms, setTerms] = useState<boolean[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('proRegister_terms');
      return saved ? JSON.parse(saved) : new Array(REQUIRED_TERMS.length).fill(false);
    }
    return new Array(REQUIRED_TERMS.length).fill(false);
  });

  useEffect(() => {
    localStorage.setItem('proRegister_allAgreed', JSON.stringify(allAgreed));
  }, [allAgreed]);

  useEffect(() => {
    localStorage.setItem('proRegister_terms', JSON.stringify(terms));
  }, [terms]);

  const handleAllAgree = () => {
    const newValue = !allAgreed;
    setAllAgreed(newValue);
    setTerms(new Array(REQUIRED_TERMS.length).fill(newValue));
  };

  const handleTermToggle = (index: number) => {
    const newTerms = [...terms];
    newTerms[index] = !newTerms[index];
    setTerms(newTerms);
    setAllAgreed(newTerms.every(t => t));
  };

  const handleNext = () => {
    if (!allAgreed) return;
    router.push('/pro-register/promo-code');
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col" style={{ height: '100dvh' }}>
      {/* Header — fixed */}
      <div className="shrink-0 px-4 pt-4 pb-4">
        <div className="flex items-center justify-between mb-4">
          <motion.button
            onClick={() => router.back()}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronLeft size={24} className="text-gray-900" />
          </motion.button>
          <motion.button
            onClick={() => {
              localStorage.setItem('proRegister_allAgreed', JSON.stringify(allAgreed));
              localStorage.setItem('proRegister_terms', JSON.stringify(terms));
            }}
            whileTap={{ scale: 0.95 }}
            className="text-[13px] text-gray-400 font-medium px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors"
          >
            중간저장
          </motion.button>
        </div>
        {/* Progress bar */}
        <div className="relative h-[3px] bg-gray-100 rounded-full overflow-hidden mb-2">
          <motion.div
            className="absolute left-0 top-0 h-full bg-[#3180F7] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(1 / 7) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="text-sm text-gray-400 mb-1"
        >
          프리티풀
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-2xl font-bold text-gray-900 mb-2"
        >
          파트너스 시작하기 <span className="text-[11px] text-gray-400">1/7</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-sm text-gray-400"
        >
          프리티풀 파트너스를 시작하시려면<br/>아래의 약관 동의가 필요합니다
        </motion.p>
      </div>

      {/* Existing profile handover */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="px-4 mb-4"
      >
        <motion.button
          type="button"
          onClick={() => router.push('/pro-register/handover')}
          whileTap={{ scale: 0.98 }}
          className="flex w-full items-center gap-3 rounded-2xl border border-[#3180F7]/15 bg-[#F2F7FF] px-4 py-4 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#3180F7] shadow-sm">
            <UserRoundCheck size={20} strokeWidth={2.4} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold text-gray-900">기존 프로필 인수하기</span>
            <span className="mt-0.5 block text-[12px] leading-4 text-gray-500">
              이미 등록된 사회자 프로필을 내 계정으로 연결
            </span>
          </span>
          <ArrowRight size={18} className="shrink-0 text-[#3180F7]" />
        </motion.button>
      </motion.div>

      {/* All Agree */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="px-4 mb-5"
      >
        <motion.button
          onClick={handleAllAgree}
          whileTap={{ scale: 0.98 }}
          animate={{
            backgroundColor: allAgreed ? '#3180F7' : '#F9FAFB',
          }}
          transition={{ duration: 0.25 }}
          className="flex items-center gap-3 w-full px-5 py-5 rounded-2xl"
        >
          <motion.div
            animate={{
              backgroundColor: allAgreed ? '#FFFFFF' : '#FFFFFF',
              borderColor: allAgreed ? '#FFFFFF' : '#D1D5DB',
            }}
            transition={{ duration: 0.2 }}
            className="w-6 h-6 rounded flex items-center justify-center shrink-0 border-2"
          >
            <AnimatePresence>
              {allAgreed && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
                  <Check size={16} className="text-[#3180F7] stroke-[3]" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          <motion.span
            animate={{ color: allAgreed ? '#FFFFFF' : '#111827' }}
            transition={{ duration: 0.25 }}
            className="text-base font-semibold"
          >
            프리티풀의 필수약관을 모두 동의합니다
          </motion.span>
        </motion.button>
      </motion.div>

      {/* Terms List — scrollable */}
      <div className="px-4 mb-4 flex-1 overflow-y-auto">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-sm font-bold text-gray-900 mb-2"
        >
          필수 약관
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.28 }}
          className="text-xs text-gray-400 mb-3"
        >
          프리티풀
        </motion.p>

        <div className="space-y-5">
          {REQUIRED_TERMS.map((term, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.06 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleTermToggle(index)}
              className="flex items-center gap-3 w-full"
            >
              <motion.div
                animate={{
                  backgroundColor: terms[index] ? '#3180F7' : '#FFFFFF',
                  borderColor: terms[index] ? '#3180F7' : '#D1D5DB',
                }}
                transition={{ duration: 0.2 }}
                className="w-6 h-6 rounded flex items-center justify-center shrink-0 border-2"
              >
                <AnimatePresence>
                  {terms[index] && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
                      <Check size={16} className="text-white stroke-[3]" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
              <span className="text-sm text-gray-600 text-left">{term}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Next Button — fixed bottom */}
      <div className="shrink-0 p-4 pb-8 bg-white">
        <motion.button
          onClick={handleNext}
          disabled={!allAgreed}
          whileTap={{ scale: 0.96 }}
          animate={{
            backgroundColor: allAgreed ? '#3180F7' : '#F3F4F6',
            color: allAgreed ? '#FFFFFF' : '#9CA3AF',
          }}
          transition={{ duration: 0.3 }}
          className="w-full py-4 rounded-2xl font-bold text-base"
        >
          다음
        </motion.button>
      </div>
    </div>
  );
}
