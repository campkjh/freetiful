'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Check } from 'lucide-react';
const REGIONS = [
  '전국가능',
  '수도권(서울/인천/경기)',
  '강원도',
  '충청권',
  '전라권',
  '경상권',
  '제주'
];

export default function RegionsPage() {
  const router = useRouter();
  const [selectedRegions, setSelectedRegions] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('proRegister_selectedRegions');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('proRegister_selectedRegions', JSON.stringify(selectedRegions));
  }, [selectedRegions]);

  const toggleRegion = (region: string) => {
    setSelectedRegions(prev =>
      prev.includes(region)
        ? prev.filter(r => r !== region)
        : [...prev, region]
    );
  };

  const handleNext = () => {
    if (selectedRegions.length === 0) return;
    router.push('/pro-register/photos');
  };

  const hasSelection = selectedRegions.length > 0;

  return (
    <div className="fixed inset-0 bg-white flex flex-col" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="shrink-0 px-6 pt-4 pb-4">
        <button
          onClick={() => router.back()}
          className="mb-4"
        >
          <ChevronLeft size={24} className="text-gray-900" />
        </button>
        {/* Progress bar */}
        <div className="relative h-[3px] bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className="absolute left-0 top-0 h-full bg-[#3180F7] rounded-full"
          />
        </div>
        <h1
          className="text-2xl font-bold text-gray-900 mb-2"
        >
          행사 가능 지역 선택 <span className="text-[11px] text-gray-400">4/7</span>
        </h1>
        <p
          className="text-sm text-gray-400"
        >
          다중선택 가능합니다
        </p>
      </div>

      {/* Regions — scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-2">
        <div className="space-y-3">
          {REGIONS.map((region, index) => {
            const selected = selectedRegions.includes(region);
            return (
              <button
                key={region}
                onClick={() => toggleRegion(region)}
                className="w-full py-4 rounded-2xl text-[18px] font-bold border-2 flex items-center justify-center gap-2"
              >
                <>
                  {selected && (
                    <span>
                      <Check size={18} className="text-[#3180F7] stroke-[3]" />
                    </span>
                  )}
                </>
                {region}
              </button>
            );
          })}
        </div>
      </div>

      {/* Next Button — fixed bottom */}
      <div className="shrink-0 p-6 pb-8 bg-white">
        <button
          onClick={handleNext}
          disabled={!hasSelection}
          className="w-full py-4 rounded-2xl font-bold text-base"
        >
          다음
        </button>
      </div>
    </div>
  );
}
