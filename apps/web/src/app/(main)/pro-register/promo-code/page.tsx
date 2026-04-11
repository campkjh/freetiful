'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PromoCodePage() {
  const router = useRouter();
  const [code, setCode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('proRegister_code') || '';
    }
    return '';
  });

  useEffect(() => {
    localStorage.setItem('proRegister_code', code);
  }, [code]);

  const handleNext = () => {
    router.push('/pro-register/personal-info');
  };

  const handleSkip = () => {
    router.push('/pro-register/personal-info');
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col" style={{ height: '100dvh' }}>
      {/* Header — fixed */}
      <div className="shrink-0 px-6 pt-4 pb-4">
        <div className="flex items-center justify-between mb-4">
          <motion.button onClick={() => router.back()} whileTap={{ scale: 0.9 }}>
            <ChevronLeft size={24} className="text-gray-900" />
          </motion.button>
          <motion.button
            onClick={handleSkip}
            whileTap={{ scale: 0.95 }}
            className="text-[13px] text-gray-400 font-medium px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors"
          >
            건너뛰기
          </motion.button>
        </div>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-2xl font-bold text-gray-900"
        >
          프로모션 코드입력
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-sm text-gray-400 mt-1"
        >
          코드가 없으시면 건너뛰기를 눌러주세요
        </motion.p>
      </div>

      {/* Code Input — scrollable area */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="px-6 flex-1 overflow-y-auto pt-4"
      >
        {code && (
          <motion.label
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-primary-500 mb-2 block font-medium"
          >
            코드입력
          </motion.label>
        )}
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="000000"
          maxLength={6}
          className="w-full text-2xl font-medium border-b-2 border-primary-500 pb-2 outline-none placeholder:text-gray-300 tracking-[0.3em]"
        />
      </motion.div>

      {/* Next Button — fixed bottom */}
      <div className="shrink-0 p-6 pb-8 bg-white">
        <motion.button
          onClick={handleNext}
          whileTap={{ scale: 0.96 }}
          animate={{
            backgroundColor: code.length === 6 ? '#3180F7' : '#F3F4F6',
            color: code.length === 6 ? '#FFFFFF' : '#9CA3AF',
          }}
          transition={{ duration: 0.25 }}
          className="w-full py-4 rounded-2xl font-bold text-base"
        >
          다음
        </motion.button>
      </div>
    </div>
  );
}
