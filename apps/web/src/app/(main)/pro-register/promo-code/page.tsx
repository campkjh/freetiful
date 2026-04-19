'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const VALID_CODE = 'PRETTY'; // 유효한 프로모션 코드

export default function PromoCodePage() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('proRegister_code') || '';
      return saved.split('').concat(Array(6).fill('')).slice(0, 6);
    }
    return Array(6).fill('');
  });
  const [matched, setMatched] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join('');

  useEffect(() => {
    localStorage.setItem('proRegister_code', code);
  }, [code]);

  // Check code match
  useEffect(() => {
    if (code.length === 6 && code === VALID_CODE) {
      setTimeout(() => setMatched(true), 200);
      setTimeout(() => setShowReward(true), 900);
    } else {
      setMatched(false);
      setShowReward(false);
    }
  }, [code]);

  const handleDigitChange = (index: number, value: string) => {
    const char = value.slice(-1).toUpperCase();
    if (!char) {
      // Backspace
      const newDigits = [...digits];
      newDigits[index] = '';
      setDigits(newDigits);
      if (index > 0) inputRefs.current[index - 1]?.focus();
      return;
    }
    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);
    if (index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const newDigits = [...digits];
      newDigits[index - 1] = '';
      setDigits(newDigits);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const newDigits = Array(6).fill('');
    pasted.split('').forEach((c, i) => { newDigits[i] = c; });
    setDigits(newDigits);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleNext = () => {
    router.push('/pro-register/personal-info');
  };

  const handleSkip = () => {
    router.push('/pro-register/personal-info');
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="shrink-0 px-6 pt-4 pb-4 relative z-10">
        <div className="flex items-center justify-between mb-4">
          <motion.button onClick={() => router.back()} whileTap={{ scale: 0.9 }}>
            <ChevronLeft size={24} className="text-gray-900" />
          </motion.button>
          <motion.button
            onClick={handleSkip}
            whileTap={{ scale: 0.95 }}
            className="text-[14px] text-[#3180F7] font-semibold px-4 py-2 rounded-full hover:bg-blue-50 active:bg-blue-100 transition-colors"
          >
            건너뛰기
          </motion.button>
        </div>
        {/* Progress bar */}
        <div className="relative h-[3px] bg-gray-100 rounded-full overflow-hidden mb-2">
          <motion.div
            className="absolute left-0 top-0 h-full bg-[#3180F7] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(2 / 7) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-2xl font-bold text-gray-900"
        >
          프로모션 코드입력 <span className="text-[11px] text-gray-400">2/7</span>
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

      {/* Code Input — 6 boxes */}
      <div className="flex-1 overflow-y-auto px-6 pt-8 flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full flex justify-center"
        >
          <AnimatePresence mode="wait">
            {!matched ? (
              /* 6 separate boxes */
              <motion.div
                key="boxes"
                className="flex gap-2.5"
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {digits.map((d, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 + i * 0.05 }}
                  >
                    <input
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="text"
                      maxLength={1}
                      value={d}
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      onPaste={i === 0 ? handlePaste : undefined}
                      className={`w-[46px] h-[56px] rounded-xl border-2 text-center text-[22px] font-bold outline-none transition-all ${
                        d
                          ? 'border-[#3180F7] bg-blue-50/50 text-[#3180F7]'
                          : 'border-gray-200 bg-gray-50 text-gray-900'
                      } focus:border-[#3180F7] focus:ring-2 focus:ring-blue-100`}
                    />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              /* Merged single box */
              <motion.div
                key="merged"
                initial={{ scale: 0.5, opacity: 0, width: 46 }}
                animate={{ scale: 1, opacity: 1, width: 280 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                className="h-[56px] rounded-xl bg-[#3180F7] flex items-center justify-center gap-2 overflow-hidden"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 15 }}
                >
                  <Check size={20} className="text-white stroke-[3]" />
                </motion.div>
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-[16px] font-bold text-white tracking-wider"
                >
                  {code}
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Pudding reward message */}
        <AnimatePresence>
          {showReward && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="mt-8 flex flex-col items-center"
            >
              {/* Pudding icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 15 }}
                className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4"
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M4 14c0 4 3.6 7 8 7s8-3 8-7H4z" fill="#FBBF24"/>
                  <path d="M2 14h20" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M8 10c0-3 1.8-5 4-5s4 2 4 5" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="6" r="1.5" fill="#F59E0B"/>
                </svg>
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-[18px] font-bold text-gray-900 text-center"
              >
                푸딩이 지급되었습니다!
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-[13px] text-gray-500 text-center mt-2 leading-relaxed"
              >
                푸딩은 프리티풀에서 전문가 프로필을<br/>최상단으로 올려주는 재화입니다.
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-4 px-4 py-2 bg-amber-50 rounded-full"
              >
                <span className="text-[14px] font-bold text-amber-600">+ 1 푸딩 적립</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Invalid code message */}
        <AnimatePresence>
          {code.length === 6 && !matched && code !== VALID_CODE && (
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 text-[13px] text-red-500 font-medium"
            >
              유효하지 않은 코드입니다
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Next Button */}
      <div className="shrink-0 p-6 pb-8 bg-white">
        <motion.button
          onClick={handleNext}
          whileTap={{ scale: 0.96 }}
          animate={{
            backgroundColor: code.length === 6 || showReward ? '#3180F7' : '#F3F4F6',
            color: code.length === 6 || showReward ? '#FFFFFF' : '#9CA3AF',
          }}
          transition={{ duration: 0.25 }}
          className="w-full py-4 rounded-2xl font-bold text-base"
        >
          {showReward ? '다음으로' : '다음'}
        </motion.button>
      </div>
    </div>
  );
}
