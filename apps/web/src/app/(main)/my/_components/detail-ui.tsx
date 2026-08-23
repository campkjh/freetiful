'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeftIcon } from '@/components/icons/mono';

/**
 * 마이페이지 하위 상세 화면들의 공통 껍데기.
 *
 * 화면마다 헤더 높이(52/56), 타이틀 크기(17/18), 구분선 유무, 회색 띠, 카드 라운드가
 * 제각각이라 같은 앱 안에서 다른 화면처럼 보였다. 제이씨랩 자가견적 톤에 맞춰
 * 흰 바탕 + 얇은 테두리 카드 하나로 통일한다.
 */

/** 흰 카드 — 회색 바탕 없이 헤어라인 테두리와 아주 옅은 그림자로만 구분한다 */
export const MY_CARD = 'rounded-[24px] border-[0.6px] border-[#F1F3F6] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]';

/** 카드 묶음 위에 붙는 작은 제목 */
export function MySectionTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`px-1 pb-2 text-[13px] font-bold text-[#A4ABBA] ${className}`}>{children}</p>;
}

export function MyDetailHeader({
  title,
  right,
  onBack,
}: {
  title: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  const router = useRouter();
  return (
    <header
      className="sticky top-0 z-20 flex h-14 items-center gap-1 bg-white px-4"
      data-native-back-header
    >
      <button
        type="button"
        onClick={onBack || (() => router.back())}
        aria-label="뒤로가기"
        className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-[#2B313D] transition-colors active:bg-[#F2F3F5]"
      >
        <ChevronLeftIcon size={22} />
      </button>
      <h1 className="text-[20px] font-bold text-[#2B313D]">{title}</h1>
      {right && <div className="ml-auto flex items-center gap-1">{right}</div>}
    </header>
  );
}
