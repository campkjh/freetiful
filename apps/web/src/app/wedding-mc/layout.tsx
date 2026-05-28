import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '결혼식 사회자, 아무나 구하세요? — 프리티풀',
  description:
    'KBS·SBS·MBC 출신 검증된 전문 사회자에게 한 번의 신청으로 견적을 받아보세요. 노쇼 0건, 만족도 98%.',
  openGraph: {
    title: '결혼식 사회자, 아무나 구하세요?',
    description: 'KBS·SBS·MBC 출신 검증된 전문 사회자 다수에게 무료 견적 요청',
    locale: 'ko_KR',
    type: 'website',
  },
};

export default function WeddingMcLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
