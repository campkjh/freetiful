'use client';

import { useState } from 'react';
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
  const [allAgreed, setAllAgreed] = useState(false);
  const [terms, setTerms] = useState<boolean[]>(new Array(REQUIRED_TERMS.length).fill(false));

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
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-4">
        <button onClick={() => router.back()} className="mb-4">
          <ChevronLeft size={24} className="text-gray-900" />
        </button>
        <p className="text-sm text-gray-400 mb-1">프리티풀</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">파트너스 시작하기</h1>
        <p className="text-sm text-gray-400">프리티풀 파트너스를 시작하시려면<br/>아래의 약관 동의가 필요합니다</p>
      </div>

      {/* All Agree */}
      <div className="px-4 mb-5">
        <button
          onClick={handleAllAgree}
          className="flex items-center gap-3 w-full px-5 py-5 bg-gray-50 rounded-2xl"
        >
          <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
            allAgreed ? 'bg-primary-500' : 'bg-white border-2 border-gray-300'
          }`}>
            {allAgreed && <Check size={16} className="text-white stroke-[3]" />}
          </div>
          <span className="text-base font-semibold text-gray-900">
            프리티풀의 필수약관을 모두 동의합니다
          </span>
        </button>
      </div>

      {/* Terms List */}
      <div className="px-4 mb-4 flex-1">
        <p className="text-sm font-bold text-gray-900 mb-2">필수 약관</p>
        <p className="text-xs text-gray-400 mb-3">프리티풀</p>

        <div className="space-y-5">
          {REQUIRED_TERMS.map((term, index) => (
            <button
              key={index}
              onClick={() => handleTermToggle(index)}
              className="flex items-center gap-3 w-full"
            >
              <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                terms[index] ? 'bg-primary-500' : 'bg-white border-2 border-gray-300'
              }`}>
                {terms[index] && <Check size={16} className="text-white stroke-[3]" />}
              </div>
              <span className="text-sm text-gray-600 text-left">{term}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Next Button */}
      <div className="p-4 pb-8">
        <button
          onClick={handleNext}
          disabled={!allAgreed}
          className={`w-full py-4 rounded-2xl font-bold text-base transition-all ${
            allAgreed
              ? 'bg-primary-500 text-white'
              : 'bg-blue-100 text-blue-300'
          }`}
        >
          다음
        </button>
      </div>
    </div>
  );
}
