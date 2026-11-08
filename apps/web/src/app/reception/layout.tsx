import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond } from 'next/font/google';
import ReceptionShell from '@/components/reception/ReceptionShell';
import '@/components/reception/reception.css';

// 송년회(261108 사장 '처음 진입 배너 누르면 식순 페이지 — 네비게이션바(식순, 자리, 이벤트, 설문조사)').
// 홈 진입 팝업 '송년회' 장 → /reception. 탭마다 주소가 따로라(/reception/seat 등) 현장 QR 로 바로 보낼 수 있다.
const TITLE = 'Freetiful & WMAK 2026 Year-End RECEPTION';
const DESC = '프리티풀 × 한국여성사회자협회 송년회 — 2026년 11월 23일(월) 17:30, 청담 리베라호텔 3F 베르사이유 홀. 식순 · 내 자리 · 포토 이벤트 · 설문조사';

const serif = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--rc-serif', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL('https://freetiful.com'),
  title: `${TITLE} | 프리티풀`,
  description: DESC,
  alternates: { canonical: '/reception' },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: '/reception',
    siteName: '프리티풀',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: '/images/popups/reception-2026.webp', width: 887, height: 1774, alt: TITLE }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#071A63',
};

export default function ReceptionLayout({ children }: { children: React.ReactNode }) {
  return <ReceptionShell fontClassName={serif.variable}>{children}</ReceptionShell>;
}
