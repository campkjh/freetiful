'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export default function PromoCodePage() {
  const router = useRouter();
  const [code, setCode] = useState('');

  const handleNext = () => {
    router.push('/pro-register/personal-info');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="px-6 pt-12 pb-8">
        <button onClick={() => router.back()} className="mb-10">
          <ChevronLeft size={24} className="text-gray-900" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">프로모션 코드입력</h1>
      </div>

      {/* Code Input */}
      <div className="px-6 flex-1">
        {code && (
          <label className="text-sm text-primary-500 mb-2 block font-medium">
            코드입력
          </label>
        )}
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="000000"
          maxLength={6}
          className="w-full text-2xl font-medium border-b-2 border-primary-500 pb-2 outline-none placeholder:text-gray-300"
        />
      </div>

      {/* Next Button */}
      <div className="p-6 pb-8">
        <button
          onClick={handleNext}
          className="w-full py-4 bg-primary-500 text-white rounded-2xl font-bold text-base"
        >
          다음
        </button>
      </div>
    </div>
  );
}
