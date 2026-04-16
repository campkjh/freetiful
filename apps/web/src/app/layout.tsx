import type { Metadata, Viewport } from 'next';
import Providers from './providers';
import AppToaster from '@/components/AppToaster';
import './globals.css';

export const metadata: Metadata = {
  title: 'Freetiful — 나의 특별한 행사를 완성하는 전문가',
  description: '웨딩, 생일, 돌잔치 등 모든 행사의 MC, 가수, 쇼호스트를 한 번에',
  keywords: ['MC', '웨딩MC', '행사진행', '결혼식MC', '이벤트전문가'],
  openGraph: {
    title: 'Freetiful',
    description: '나의 특별한 행사를 완성하는 전문가',
    locale: 'ko_KR',
    type: 'website',
  },
};

// 핀치 줌/더블탭 줌 비활성화 — 모바일에서 페이지가 자유롭게 확대축소되며 일그러지는 문제 방지
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
        <script async src="https://www.googletagmanager.com/gtag/js?id=AW-17930822929" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','AW-17930822929');`,
          }}
        />
      </head>
      <body className="font-sans bg-white text-gray-900 antialiased overflow-x-hidden">
        <Providers>
          {children}
          <AppToaster />
        </Providers>
      </body>
    </html>
  );
}
