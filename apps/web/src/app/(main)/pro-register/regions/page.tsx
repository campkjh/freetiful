'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RegisterShell, RgCta, RgOption } from '../_components/RegisterKit';

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
    // 본문 자체가 .rg-list — 지역 카드가 본문 직계라 퀵매칭처럼 한 장씩 차례로 들어온다
    <RegisterShell
      step={3}
      title="행사 가능 지역 선택"
      sub="다중선택 가능합니다"
      bodyClassName="rg-list"
      cta={<RgCta disabled={!hasSelection} onClick={handleNext}>다음</RgCta>}
    >
      {REGIONS.map((region) => (
        <RgOption key={region} on={selectedRegions.includes(region)} onClick={() => toggleRegion(region)} label={region} />
      ))}
    </RegisterShell>
  );
}
