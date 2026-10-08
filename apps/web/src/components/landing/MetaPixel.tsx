import Script from 'next/script';

/**
 * 메타(페이스북) 픽셀 — 랜딩(wedding-mc)·퀵매칭 공용. fbq 가 이미 있으면(루트 GTM 이 사이트 픽셀을 먼저 띄운 경우) 그걸 쓰고 init 만 더한다.
 * ⚠ fbq('track', …) 은 init 된 픽셀 전부로 간다 — 루트 GTM 이 사이트 픽셀(1270…)을 이미 init·PageView 해 두므로
 *   여기 PageView 를 'track' 으로 쏘면 사이트 픽셀에 PageView 가 두 번 찍힌다(261008 확인). 이 픽셀에만 보내려면 trackSingle.
 */
export const META_PIXEL_ID = '4542157089361204';

export default function MetaPixel() {
  return (
    <Script id="meta-pixel" strategy="afterInteractive">{`
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${META_PIXEL_ID}');
      fbq('trackSingle', '${META_PIXEL_ID}', 'PageView');
    `}</Script>
  );
}
