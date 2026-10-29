import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '결혼식 사회자, 아나운서로 구하세요 · 프리티풀',
  description:
    'KBS·SBS·MBC 출신 아나운서 중심 결혼식 사회자. 예식 일정과 지역을 입력하고 나에게 맞는 사회자를 만나보세요.',
  openGraph: {
    title: '결혼식 사회자, 아나운서로 구하세요 · 프리티풀',
    description: 'KBS·SBS·MBC 출신 검증된 전문 사회자 다수에게 무료 견적 요청',
    locale: 'ko_KR',
    type: 'website',
    images: ['/wedding_mc/wall/19.webp'],
  },
};

export default function WeddingMcLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
