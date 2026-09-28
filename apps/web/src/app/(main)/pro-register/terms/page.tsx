'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RegisterShell, RgCheck, RgCta, RgOption } from '../_components/RegisterKit';

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
    router.push('/pro-register/personal-info');
  };

  return (
    <RegisterShell
      step={1}
      eyebrow="프리티풀"
      title="파트너스 시작하기"
      sub={<>프리티풀 파트너스를 시작하시려면<br />아래의 약관 동의가 필요합니다</>}
      right={
        // 중간저장 — 작은 회색 글자 단추(글자 끝을 머리 오른쪽 여백 20 에 맞춘다)
        <button
          type="button"
          onClick={() => {
            localStorage.setItem('proRegister_allAgreed', JSON.stringify(allAgreed));
            localStorage.setItem('proRegister_terms', JSON.stringify(terms));
          }}
          className="-mr-2.5 ml-2 h-8 flex-none rounded-full px-2.5 text-[13px] font-medium text-[#8B95A1] transition-colors active:bg-[#F2F4F6]"
        >
          중간저장
        </button>
      }
      cta={<RgCta disabled={!allAgreed} onClick={handleNext}>다음</RgCta>}
    >
      {/* 모두 동의 — 퀵매칭 선택 카드. 폰에선 두 줄로 떨어져 위아래 여유를 더 주고 줄 길이를 고르게 */}
      <div className="[&>.rg-opt]:py-4 [&_.rg-opt-t]:text-balance">
        <RgOption on={allAgreed} onClick={handleAllAgree} label="프리티풀의 필수약관을 모두 동의합니다" />
      </div>

      <p className="rg-label mt-7">필수 약관</p>

      {/* 약관 줄 — 본문 직계라 한 줄씩 차례로 들어온다. 작은 체크는 위 카드 체크와 가운데 줄을 맞춤 */}
      {REQUIRED_TERMS.map((term, index) => (
        <button
          key={index}
          type="button"
          role="checkbox"
          aria-checked={terms[index]}
          onClick={() => handleTermToggle(index)}
          className="flex min-h-[48px] w-full items-center gap-3 rounded-xl pl-[21px] pr-3 text-left transition-colors active:bg-[#F8F9FA]"
        >
          <RgCheck on={terms[index]} small />
          <span className="min-w-0 flex-1 text-[15px] leading-[1.45] tracking-[-0.2px] text-[#4E5968]">
            <span className="mr-1.5 font-semibold text-[#3182F6]">필수</span>
            {term.replace(/^\[필수\]\s*/, '')}
          </span>
        </button>
      ))}
    </RegisterShell>
  );
}
