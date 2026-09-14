import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '퀵매칭 — 3분 만에 내 예식 사회자 찾기 | 프리티풀',
  description:
    '예식일·지역·조건만 고르면 딱 맞는 전문 사회자 5명을 바로 추천해드려요. 마음에 드는 사회자에게 한 번에 의뢰하세요.',
  openGraph: {
    title: '퀵매칭 — 3분 만에 내 예식 사회자 찾기',
    description: '조건에 가장 잘 맞는 전문 사회자 5명을 바로 추천받고 한 번에 의뢰하세요.',
    locale: 'ko_KR',
    type: 'website',
  },
};

export default function QuickMatchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
