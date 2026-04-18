'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Check } from 'lucide-react';
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
          <button onClick={() => router.back()}>
            <ChevronLeft size={24} className="text-gray-900" />
          </button>
          <button
            onClick={handleSkip}
            className="text-[14px] text-[#3180F7] font-semibold px-4 py-2 rounded-full hover:bg-blue-50 active:bg-blue-100 transition-colors"
          >
            건너뛰기
          </button>
        </div>
        {/* Progress bar */}
        <div className="relative h-[3px] bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className="absolute left-0 top-0 h-full bg-[#3180F7] rounded-full"
          />
        </div>
        <h1
          className="text-2xl font-bold text-gray-900"
        >
          프로모션 코드입력 <span className="text-[11px] text-gray-400">2/7</span>
        </h1>
        <p
          className="text-sm text-gray-400 mt-1"
        >
          코드가 없으시면 건너뛰기를 눌러주세요
        </p>
      </div>

      {/* Code Input — 6 boxes */}
      <div className="flex-1 overflow-y-auto px-6 pt-8 flex flex-col items-center">
        <div
          className="w-full flex justify-center"
        >
          <>
            {!matched ? (
              /* 6 separate boxes */
              <div
                key="boxes"
                className="flex gap-2.5"
              >
                {digits.map((d, i) => (
                  <div
                    key={i}
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
                  </div>
                ))}
              </div>
            ) : (
              /* Merged single box */
              <div
                key="merged"
                className="h-[56px] rounded-xl bg-[#3180F7] flex items-center justify-center gap-2 overflow-hidden"
              >
                <div
                >
                  <Check size={20} className="text-white stroke-[3]" />
                </div>
                <span
                  className="text-[16px] font-bold text-white tracking-wider"
                >
                  {code}
                </span>
              </div>
            )}
          </>
        </div>

        {/* Pudding reward message */}
        <>
          {showReward && (
            <div
              className="mt-8 flex flex-col items-center"
            >
              {/* Pudding icon */}
              <div
                className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4"
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M4 14c0 4 3.6 7 8 7s8-3 8-7H4z" fill="#FBBF24"/>
                  <path d="M2 14h20" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M8 10c0-3 1.8-5 4-5s4 2 4 5" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="6" r="1.5" fill="#F59E0B"/>
                </svg>
              </div>
              <p
                className="text-[18px] font-bold text-gray-900 text-center"
              >
                푸딩이 지급되었습니다!
              </p>
              <p
                className="text-[13px] text-gray-500 text-center mt-2 leading-relaxed"
              >
                푸딩은 프리티풀에서 전문가 프로필을<br/>최상단으로 올려주는 재화입니다.
              </p>
              <div
                className="mt-4 px-4 py-2 bg-amber-50 rounded-full"
              >
                <span className="text-[14px] font-bold text-amber-600">+ 1 푸딩 적립</span>
              </div>
            </div>
          )}
        </>

        {/* Invalid code message */}
        <>
          {code.length === 6 && !matched && code !== VALID_CODE && (
            <p
              className="mt-4 text-[13px] text-red-500 font-medium"
            >
              유효하지 않은 코드입니다
            </p>
          )}
        </>
      </div>

      {/* Next Button */}
      <div className="shrink-0 p-6 pb-8 bg-white">
        <button
          onClick={handleNext}
          className="w-full py-4 rounded-2xl font-bold text-base"
        >
          {showReward ? '다음으로' : '다음'}
        </button>
      </div>
    </div>
  );
}
