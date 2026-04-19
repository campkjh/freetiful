'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
        <motion.button
          onClick={() => router.back()}
          className="mb-4"
          whileTap={{ scale: 0.9 }}
        >
          <ChevronLeft size={24} className="text-gray-900" />
        </motion.button>
        {/* Progress bar */}
        <div className="relative h-[3px] bg-gray-100 rounded-full overflow-hidden mb-2">
          <motion.div
            className="absolute left-0 top-0 h-full bg-[#3180F7] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(4 / 7) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-2xl font-bold text-gray-900 mb-2"
        >
          행사 가능 지역 선택 <span className="text-[11px] text-gray-400">4/7</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-sm text-gray-400"
        >
          다중선택 가능합니다
        </motion.p>
      </div>

      {/* Regions — scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-2">
        <div className="space-y-3">
          {REGIONS.map((region, index) => {
            const selected = selectedRegions.includes(region);
            return (
              <motion.button
                key={region}
                initial={{ opacity: 0, y: 12 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  backgroundColor: selected ? '#EFF6FF' : '#FFFFFF',
                  borderColor: selected ? '#3180F7' : '#E5E7EB',
                  color: selected ? '#3180F7' : '#9CA3AF',
                }}
                transition={{ delay: index * 0.05, duration: 0.2 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => toggleRegion(region)}
                className="w-full py-4 rounded-2xl text-[18px] font-bold border-2 flex items-center justify-center gap-2"
              >
                <AnimatePresence>
                  {selected && (
                    <motion.span initial={{ scale: 0, width: 0 }} animate={{ scale: 1, width: 'auto' }} exit={{ scale: 0, width: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
                      <Check size={18} className="text-[#3180F7] stroke-[3]" />
                    </motion.span>
                  )}
                </AnimatePresence>
                {region}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Next Button — fixed bottom */}
      <div className="shrink-0 p-6 pb-8 bg-white">
        <motion.button
          onClick={handleNext}
          disabled={!hasSelection}
          whileTap={{ scale: 0.96 }}
          animate={{
            backgroundColor: hasSelection ? '#3180F7' : '#F3F4F6',
            color: hasSelection ? '#FFFFFF' : '#9CA3AF',
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
