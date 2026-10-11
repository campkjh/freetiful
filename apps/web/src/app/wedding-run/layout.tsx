import type { Metadata, Viewport } from 'next';

// 웨딩런(261011 사장 '웨딩런: 신혼집까지 달려!' 2D 러너) — 기본 링크 미리보기 · 확대 금지 뷰포트(핀치·더블탭 확대가 버튼을 먹지 않게) · 상단 색.
//  · 공유 링크(?c=)의 '○○님의 N점에 도전!' 미리보기는 page.tsx generateMetadata 가 덮어쓴다.
const TITLE = '웨딩런: 신혼집까지 달려!';
const DESC = '서울에서 출발해 상견례·드레스·본식·발리 신혼여행을 지나 신혼집까지! 점프하고 슬라이드하며 달리는 프리티풀 웨딩 미니게임 — 예랑·예신, 누가 더 멀리 갈까?';

export const metadata: Metadata = {
  metadataBase: new URL('https://freetiful.com'),
  title: `${TITLE} | 프리티풀`,
  description: DESC,
  alternates: { canonical: '/wedding-run' },
  formatDetection: { telephone: false },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: '/wedding-run',
    siteName: '프리티풀',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: '/api/wedding-run/og', width: 1200, height: 630, alt: TITLE }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC, images: ['/api/wedding-run/og'] },
};

// 게임 화면 — 핀치 확대·더블탭 확대가 탭(점프)을 먹지 않게 확대 금지. viewport-fit=cover 로 노치 세이프에어리어 사용.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#FFF0F5',
};

export default function WeddingRunLayout({ children }: { children: React.ReactNode }) {
  return children;
}
