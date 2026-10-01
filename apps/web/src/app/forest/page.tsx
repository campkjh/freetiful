import type { Metadata, Viewport } from 'next';
import ForestClient from './ForestClient';

export const metadata: Metadata = {
  title: '결혼의 숲 | 프리티풀',
  description: '귀여운 아바타로 숲을 가꾸고, 동물 친구들과 우리의 결혼식과 일상을 만드는 3D 게임.',
  openGraph: {
    title: '결혼의 숲',
    description: '귀여운 아바타로 숲을 가꾸고, 동물 친구들과 우리의 결혼식과 일상을 만드는 3D 게임.',
    locale: 'ko_KR',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#527B57',
};

export default function ForestPage() {
  return <ForestClient />;
}
