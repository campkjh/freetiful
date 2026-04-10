'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

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
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

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

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <button onClick={() => router.back()} className="mb-10">
          <ChevronLeft size={24} className="text-gray-900" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">행사 가능 지역 선택</h1>
        <p className="text-sm text-gray-400">다중선택 가능합니다</p>
      </div>

      {/* Regions */}
      <div className="px-6 flex-1">
        <div className="space-y-3">
          {REGIONS.map((region) => (
            <button
              key={region}
              onClick={() => toggleRegion(region)}
              className={`w-full py-4 rounded-2xl text-center font-medium transition-all ${
                selectedRegions.includes(region)
                  ? 'bg-blue-50 border-2 border-[#3180F7] text-[#3180F7]'
                  : 'bg-white border-2 border-gray-200 text-gray-400'
              }`}
            >
              {region}
            </button>
          ))}
        </div>
      </div>

      {/* Next Button */}
      <div className="p-6 pb-8">
        <button
          onClick={handleNext}
          disabled={selectedRegions.length === 0}
          className={`w-full py-4 rounded-2xl font-bold text-base transition-colors ${
            selectedRegions.length > 0
              ? 'bg-[#3180F7] text-white'
              : 'bg-blue-100 text-blue-300 cursor-not-allowed'
          }`}
        >
          다음
        </button>
      </div>
    </div>
  );
}
