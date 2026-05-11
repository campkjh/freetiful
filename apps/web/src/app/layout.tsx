import type { Metadata, Viewport } from 'next';
import Providers from './providers';
import AppToaster from '@/components/AppToaster';
import NaturalReveal from '@/components/NaturalReveal';
import UpdateNotifier from '@/components/UpdateNotifier';
import './globals.css';

export const metadata: Metadata = {
  title: 'Freetiful — 나의 특별한 행사를 완성하는 사회자',
  description: '웨딩, 생일, 돌잔치 등 모든 행사의 MC, 가수, 쇼호스트를 한 번에',
  keywords: ['MC', '웨딩MC', '행사진행', '결혼식MC', '이벤트사회자'],
  manifest: '/manifest.json',
  themeColor: '#3180F7',
  openGraph: {
    title: 'Freetiful',
    description: '나의 특별한 행사를 완성하는 사회자',
    locale: 'ko_KR',
    type: 'website',
  },
};

// viewport-fit=cover — iOS/Android WebView에서 env(safe-area-inset-*) 활성화
// maximumScale/userScalable — Android Chrome에서 핀치 줌으로 vw 계산이 틀어지는 문제 방지
// interactiveWidget=resizes-content — Android 키보드가 올라올 때 viewport를 shrink해
//   fixed inset-0 채팅창이 키보드 위에 올바르게 배치되도록 함 (Android Chrome 108+)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/*
          ⚠️ iOS 앱(WKWebView) lag 핫픽스 — head 최상단에서 실행되어야 함.

          iOS 앱이 주입하는 nativeNavigationBridgeScript 가 documentElement 전체에 MutationObserver 를 걸고,
          DOM 변경마다 hideWebBottomNav() 호출 → querySelectorAll('nav, footer, div') + 모든 div 에
          getBoundingClientRect()/getComputedStyle() 을 돌려 강제 layout reflow. 채팅 리스트처럼 div 가
          많은 페이지에서 React 렌더마다 수백 ms 누적 → "채팅 리스트 15초" 의 진짜 원인.

          PC/Safari 는 이 스크립트가 주입되지 않아 빠르고, iOS 앱 안에서만 느림.

          이 head 스크립트는 user content script 가 documentEnd 에 주입되기 전에 실행돼서
          MutationObserver 생성자를 감싸 hideWebBottomNav callback 만 noop observer 로 바꾼다.
          notify()/pushState/replaceState 경로의 hideWebBottomNav 호출은 그대로 유지 → 하단 nav 숨김 기능은 정상 동작.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(typeof window==='undefined')return;if(!window.webkit||!window.webkit.messageHandlers||!window.webkit.messageHandlers.nativeNavState)return;var OMO=window.MutationObserver;if(!OMO)return;var Wrap=function(cb){var s='';try{s=String(cb);}catch(e){}if(s.indexOf('hideWebBottomNav')!==-1||s.indexOf('hideBottomNavCandidates')!==-1){return{observe:function(){},disconnect:function(){},takeRecords:function(){return[];}};}return new OMO(cb);};Wrap.prototype=OMO.prototype;window.MutationObserver=Wrap;}catch(e){}})();`,
          }}
        />
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
        <script type="text/javascript" src="https://wcs.naver.net/wcslog.js" />
        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{
            __html: `
              window.wcs_add = window.wcs_add || {};
              window.wcs_add.wa = 's_4ba653e912f8';
              window._nasa = window._nasa || {};
              if (window.wcs) {
                window.wcs.inflow();
                window.wcs_do();
              }
            `,
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
