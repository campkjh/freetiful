'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Check } from 'lucide-react';
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
          <button
            onClick={() => router.back()}
          >
            <ChevronLeft size={24} className="text-gray-900" />
          </button>
          <button
            onClick={() => {
              localStorage.setItem('proRegister_allAgreed', JSON.stringify(allAgreed));
              localStorage.setItem('proRegister_terms', JSON.stringify(terms));
            }}
            className="text-[13px] text-gray-400 font-medium px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors"
          >
            중간저장
          </button>
        </div>
        {/* Progress bar */}
        <div className="relative h-[3px] bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className="absolute left-0 top-0 h-full bg-[#3180F7] rounded-full"
          />
        </div>
        <p
          className="text-sm text-gray-400 mb-1"
        >
          프리티풀
        </p>
        <h1
          className="text-2xl font-bold text-gray-900 mb-2"
        >
          파트너스 시작하기 <span className="text-[11px] text-gray-400">1/7</span>
        </h1>
        <p
          className="text-sm text-gray-400"
        >
          프리티풀 파트너스를 시작하시려면<br/>아래의 약관 동의가 필요합니다
        </p>
      </div>

      {/* All Agree */}
      <div
        className="px-4 mb-5"
      >
        <button
          onClick={handleAllAgree}
          className="flex items-center gap-3 w-full px-5 py-5 rounded-2xl"
        >
          <div
            className="w-6 h-6 rounded flex items-center justify-center shrink-0 border-2"
          >
            <>
              {allAgreed && (
                <div>
                  <Check size={16} className="text-[#3180F7] stroke-[3]" />
                </div>
              )}
            </>
          </div>
          <span
            className="text-base font-semibold"
          >
            프리티풀의 필수약관을 모두 동의합니다
          </span>
        </button>
      </div>

      {/* Terms List — scrollable */}
      <div className="px-4 mb-4 flex-1 overflow-y-auto">
        <p
          className="text-sm font-bold text-gray-900 mb-2"
        >
          필수 약관
        </p>
        <p
          className="text-xs text-gray-400 mb-3"
        >
          프리티풀
        </p>

        <div className="space-y-5">
          {REQUIRED_TERMS.map((term, index) => (
            <button
              key={index}
              onClick={() => handleTermToggle(index)}
              className="flex items-center gap-3 w-full"
            >
              <div
                className="w-6 h-6 rounded flex items-center justify-center shrink-0 border-2"
              >
                <>
                  {terms[index] && (
                    <div>
                      <Check size={16} className="text-white stroke-[3]" />
                    </div>
                  )}
                </>
              </div>
              <span className="text-sm text-gray-600 text-left">{term}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Next Button — fixed bottom */}
      <div className="shrink-0 p-4 pb-8 bg-white">
        <button
          onClick={handleNext}
          disabled={!allAgreed}
          className="w-full py-4 rounded-2xl font-bold text-base"
        >
          다음
        </button>
      </div>
    </div>
  );
}
