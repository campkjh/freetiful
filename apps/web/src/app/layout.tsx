import type { Metadata, Viewport } from 'next';
import Providers from './providers';
import AppToaster from '@/components/AppToaster';
import NaturalReveal from '@/components/NaturalReveal';
import UpdateNotifier from '@/components/UpdateNotifier';
import './globals.css';

export const metadata: Metadata = {
  title: 'Freetiful — 나의 특별한 행사를 완성하는 전문가',
  description: '웨딩, 생일, 돌잔치 등 모든 행사의 MC, 가수, 쇼호스트를 한 번에',
  keywords: ['MC', '웨딩MC', '행사진행', '결혼식MC', '이벤트전문가'],
  manifest: '/manifest.json',
  themeColor: '#3180F7',
  openGraph: {
    title: 'Freetiful',
    description: '나의 특별한 행사를 완성하는 전문가',
    locale: 'ko_KR',
    type: 'website',
  },
};

// viewport-fit=cover — iOS/Android WebView에서 env(safe-area-inset-*) 활성화
// maximumScale/userScalable — Android Chrome에서 핀치 줌으로 vw 계산이 틀어지는 문제 방지
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
        <script defer src="https://developers.kakao.com/sdk/js/kakao.min.js" />
        <script async src="https://www.googletagmanager.com/gtag/js?id=AW-17930822929" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','AW-17930822929');`,
          }}
        />
        {/* Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-MPKFHWTN');`,
          }}
        />
      </head>
      <body className="font-sans bg-white text-gray-900 antialiased overflow-x-hidden">
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-MPKFHWTN"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        <Providers>
          <NaturalReveal />
          {children}
          <AppToaster />
          <UpdateNotifier />
        </Providers>
      </body>
    </html>
  );
}
