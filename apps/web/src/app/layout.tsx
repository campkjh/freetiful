import type { Metadata, Viewport } from 'next';
import Providers from './providers';
import AppToaster from '@/components/AppToaster';
import NaturalReveal from '@/components/NaturalReveal';
import UpdateNotifier from '@/components/UpdateNotifier';
import PageViewTracker from '@/components/PageViewTracker';
import NativeSafeAreaSync from '@/components/NativeSafeAreaSync';
import './globals.css';

export const metadata: Metadata = {
  title: '프리티풀 Freetiful | 검증된 전문사회자·아나운서 섭외',
  description: '프리티풀(Freetiful)은 검증된 아나운서, 전문사회자, MC를 쉽고 안전하게 섭외하는 플랫폼입니다.',
  keywords: ['MC', '웨딩MC', '행사진행', '결혼식MC', '이벤트사회자', '아나운서', '전문사회자', '사회자섭외'],
  manifest: '/manifest.json',
  themeColor: '#3180F7',
  openGraph: {
    title: '프리티풀 Freetiful | 검증된 전문사회자·아나운서 섭외',
    description: '프리티풀(Freetiful)은 검증된 아나운서, 전문사회자, MC를 쉽고 안전하게 섭외하는 플랫폼입니다.',
    locale: 'ko_KR',
    type: 'website',
  },
};

// viewport-fit=cover — iOS/Android WebView에서 env(safe-area-inset-*) 활성화
// ⚠ viewport meta 는 이것 하나뿐(하위 viewport export 는 Next 가 합침). 옛 iOS 앱은 문서 끝에 cover 없는 meta 를 하나 더 붙여 env 가 0(261014)
// maximumScale/userScalable — Android Chrome에서 핀치 줌으로 vw 계산이 틀어지는 문제 방지
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  // 키보드가 뜰 때 Android 가 레이아웃 높이를 줄이도록(resizes-content) — 미설정 시
  // 기본 resizes-visual 이라 고정 inset-0 컨테이너가 키보드에 가려진다. (채팅 입력창 가림 해결)
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
        {/* iframe(홈 미리보기·마이 우측 칸) 여부를 첫 페인트 전에 표시한다.
            useEffect 로 달면 한 프레임 동안 알림 서랍 그림자가 스쳐 보인다. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(window.self!==window.top)document.documentElement.setAttribute('data-embedded','1')}catch(e){document.documentElement.setAttribute('data-embedded','1')}`,
          }}
        />
        {/* iOS 앱 표시(261014 화면 끝까지) — 첫 페인트 전에 html[data-ios-app] 을 단다. 안전영역 토큰(--ft-sat/--ft-sab, globals.css)이
            이 표시가 있을 때만 env 값이 된다. nativeNavState 핸들러는 페이지 로드 전에 등록돼 있어 여기서 바로 보인다.
            사파리·안드엔 핸들러가 없어 안 붙는다. 하이드레이션에 지워지면 NativeSafeAreaSync 가 다시 단다. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var h=window.webkit&&window.webkit.messageHandlers;if(h&&h.nativeNavState)document.documentElement.setAttribute('data-ios-app','1')}catch(e){}`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var isAndroidProDashboard = /Android/i.test(navigator.userAgent || '') && location.pathname.indexOf('/pro-dashboard') === 0;
                var bootDelay = isAndroidProDashboard ? 2200 : 0;
                var appendScript = function (src, attrs, onload) {
                  var script = document.createElement('script');
                  script.src = src;
                  if (attrs) {
                    Object.keys(attrs).forEach(function (key) {
                      if (attrs[key] === true) script.setAttribute(key, '');
                      else script.setAttribute(key, attrs[key]);
                    });
                  }
                  if (onload) script.onload = onload;
                  document.head.appendChild(script);
                };
                var bootMarketing = function () {
                  if (window.__freetifulMarketingLoaded) return;
                  window.__freetifulMarketingLoaded = true;
                  appendScript('https://developers.kakao.com/sdk/js/kakao.min.js', { defer: true });
                  window.dataLayer = window.dataLayer || [];
                  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
                  window.gtag('js', new Date());
                  window.gtag('config', 'AW-17930822929');
                  appendScript('https://www.googletagmanager.com/gtag/js?id=AW-17930822929', { async: true });
                  (function(w,d,s,l,i){
                    w[l]=w[l]||[];
                    w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
                    var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
                    j.async=true;
                    j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
                    f.parentNode.insertBefore(j,f);
                  })(window,document,'script','dataLayer','GTM-MPKFHWTN');
                  window.wcs_add = window.wcs_add || {};
                  window.wcs_add.wa = 's_4ba653e912f8';
                  window._nasa = window._nasa || {};
                  appendScript('https://wcs.naver.net/wcslog.js', {}, function () {
                    if (window.wcs) {
                      window.wcs.inflow();
                      window.wcs_do();
                    }
                  });
                };
                if (bootDelay) {
                  window.setTimeout(bootMarketing, bootDelay);
                } else {
                  bootMarketing();
                }
              })();
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
          <NativeSafeAreaSync />
          <NaturalReveal />
          {children}
          <AppToaster />
          <UpdateNotifier />
          <PageViewTracker />
        </Providers>
      </body>
    </html>
  );
}
