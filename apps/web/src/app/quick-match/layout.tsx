import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '퀵매칭 — 3분 만에 내 예식 사회자 찾기 | 프리티풀',
  description:
    '예식일·지역·조건만 고르면 딱 맞는 전문 사회자 5명을 바로 추천해드려요. 마음에 드는 사회자에게 한 번에 의뢰하세요.',
  // iOS Safari가 번호 표시(010-…)를 전화번호로 자동 인식해 밑줄/링크를 덧그리는 것 방지(밑줄 2개로 보이던 문제)
  formatDetection: { telephone: false },
  openGraph: {
    title: '퀵매칭 — 3분 만에 내 예식 사회자 찾기',
    description: '조건에 가장 잘 맞는 전문 사회자 5명을 바로 추천받고 한 번에 의뢰하세요.',
    locale: 'ko_KR',
    type: 'website',
  },
};

export default function QuickMatchLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* 토스 톤앤매너용 Pretendard (토스 제품 폰트에 가장 가까운 웹폰트) */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
      />
      {children}
    </>
  );
}
