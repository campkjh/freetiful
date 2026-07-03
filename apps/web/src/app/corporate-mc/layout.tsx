import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '중요한 행사의 완성도는 사회자에 따라 달라집니다 · 프리티풀',
  description:
    'KBS·SBS·MBC 아나운서 출신 중심. 시상식·컨퍼런스·브랜드 행사까지, 담당자가 안심할 수 있는 검증된 전문 MC를 행사 성격에 맞춰 추천해드립니다.',
  openGraph: {
    title: '중요한 행사의 완성도는 사회자에 따라 달라집니다 · 프리티풀',
    description: 'KBS·SBS·MBC 아나운서 출신. 행사일과 유형만 남기면 가능 MC와 예상 견적을 빠르게 안내드립니다.',
    type: 'website',
  },
};

export default function CorporateMcLayout({ children }: { children: React.ReactNode }) {
  return children;
}
