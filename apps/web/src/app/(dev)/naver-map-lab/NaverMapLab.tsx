'use client';

import { useEffect, useState } from 'react';
import NaverMap from '@/components/map/NaverMap';
import { getNaverMapAuthState, naverMapLinkProps, naverMapRouteUrl, naverMapUrl } from '@/lib/naver-map';

// 개발용 실험실 화면(page.tsx 가 운영에선 404). 각 칸의 상태는 data-naver-map(idle·loading·ready·failed) + window.__nmLog 로 읽는다.

const FREETIFUL = { lat: 37.56029, lng: 126.99376 };
const CHUNGMURO = { lat: 37.56108, lng: 126.99536 };

declare global {
  interface Window {
    __nmLog?: string[];
  }
}

function log(s: string) {
  if (typeof window === 'undefined') return;
  (window.__nmLog ||= []).push(`${Math.round(performance.now())} ${s}`);
}

export default function NaverMapLab() {
  const [auth, setAuth] = useState('unknown');
  useEffect(() => {
    const t = setInterval(() => setAuth(getNaverMapAuthState()), 300);
    return () => clearInterval(t);
  }, []);
  const place = { ...FREETIFUL, name: '프리티풀', address: '서울 중구 퇴계로36길 2' };
  return (
    <main className="mx-auto max-w-[520px] px-4 pb-[60vh] pt-6 font-sans">
      <h1 className="text-[20px] font-bold text-[#191F28]">네이버 지도 실험실</h1>
      <p id="nm-auth" className="mt-1 text-[13px] text-[#6B7684]">인증 상태: {auth}</p>

      <h2 className="mt-6 text-[15px] font-bold">1. 고정 지도(업체 상세 · 누르면 네이버 지도)</h2>
      <NaverMap
        center={FREETIFUL}
        markers={[{ ...FREETIFUL, label: '프리티풀' }]}
        title="프리티풀"
        address="서울 중구 퇴계로36길 2"
        className="mt-2 h-[196px] rounded-[16px]"
        onReady={() => log('static:ready')}
        onFallback={(r) => log(`static:fallback:${r}`)}
      >
        <span id="nm-chip" className="absolute bottom-2.5 right-2.5 inline-flex h-8 items-center rounded-[8px] bg-white/95 px-2.5 text-[13px] font-semibold text-[#333D4B] shadow-[0_2px_8px_rgba(0,0,0,0.12)]">크게 보기</span>
      </NaverMap>

      <h2 className="mt-6 text-[15px] font-bold">2. 움직이는 지도(비즈 오시는길 · 눌러서 움직이기)</h2>
      <NaverMap
        center={FREETIFUL}
        zoom={17}
        markers={[{ ...FREETIFUL, label: '프리티풀' }]}
        interactive
        title="프리티풀"
        address="서울 중구 퇴계로36길 2"
        className="mt-2 h-[280px] rounded-[24px]"
        onReady={() => log('interactive:ready')}
        onFallback={(r) => log(`interactive:fallback:${r}`)}
      />

      <h2 className="mt-6 text-[15px] font-bold">3. 그림만(채팅 말풍선 크기)</h2>
      <NaverMap
        imageOnly
        center={CHUNGMURO}
        markers={[CHUNGMURO]}
        title="대한극장"
        className="mt-2 h-[120px] w-[240px] rounded-[20px]"
        onFallback={(r) => log(`image:fallback:${r}`)}
      />

      <h2 className="mt-6 text-[15px] font-bold">4. 표시 여럿(다 보이게)</h2>
      <NaverMap
        markers={[{ ...FREETIFUL, label: '프리티풀' }, { ...CHUNGMURO, label: '대한극장' }, { lat: 37.5636, lng: 126.9975, label: '충무로역' }]}
        className="mt-2 h-[220px] rounded-[16px]"
        onReady={() => log('multi:ready')}
        onFallback={(r) => log(`multi:fallback:${r}`)}
      />

      <h2 className="mt-6 text-[15px] font-bold">5. 좌표 없음(주소 카드)</h2>
      <NaverMap
        center={null}
        title="빌라드지디 청담"
        address="서울 강남구 학동로 519"
        href={naverMapUrl({ name: '빌라드지디 청담' })}
        className="mt-2 h-[160px] rounded-[16px]"
        onFallback={(r) => log(`nocenter:fallback:${r}`)}
      />

      <h2 className="mt-6 text-[15px] font-bold">6. 링크 도우미</h2>
      <div className="mt-2 flex flex-wrap gap-2 text-[14px]">
        <a id="nm-link-view" className="rounded-[10px] bg-[#03C75A] px-3 py-2 font-bold text-white" {...naverMapLinkProps(place)}>네이버 지도</a>
        <a id="nm-link-route" className="rounded-[10px] bg-[#F2F4F6] px-3 py-2 font-bold text-[#333D4B]" {...naverMapLinkProps(place, { kind: 'route' })}>길찾기</a>
      </div>
      <pre id="nm-urls" className="mt-2 whitespace-pre-wrap break-all text-[11px] text-[#6B7684]">
        {[
          naverMapUrl(place, { device: 'mobile' }),
          naverMapUrl(place, { device: 'desktop' }),
          naverMapUrl({ name: '빌라드지디 청담' }, { device: 'mobile' }),
          naverMapRouteUrl(place),
        ].join('\n')}
      </pre>
    </main>
  );
}
