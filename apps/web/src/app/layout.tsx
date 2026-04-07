import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import Providers from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Prettyful — 나의 특별한 행사를 완성하는 전문가',
  description: '웨딩, 생일, 돌잔치 등 모든 행사의 MC, 가수, 쇼호스트를 한 번에',
  keywords: ['MC', '웨딩MC', '행사진행', '결혼식MC', '이벤트전문가'],
  openGraph: {
    title: 'Prettyful',
    description: '나의 특별한 행사를 완성하는 전문가',
    locale: 'ko_KR',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
      </head>
      <body className="font-sans bg-white text-gray-900 antialiased">
        <Providers>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3000,
              style: { fontFamily: 'Pretendard, sans-serif' },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
