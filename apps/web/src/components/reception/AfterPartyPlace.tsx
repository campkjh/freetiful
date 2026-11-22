'use client';

// 2차 회식 장소 카드(261122 사장 'https://naver.me/58N6jsaj 이거 지도가 나오게끔 · 현 위치로 부터 네비게이션 마냥') — 설문 첫 질문에서 '예'를 고르면 열린다.
//  · 지도 = 공용 NaverMap(SDK 인증 실패면 정적 그림 → 주소 카드로 저절로) · 목적지 핀 '청담항'. 손으로 움직이려면 한 번 눌러 잠금을 푼다.
//  · [내 위치에서 길찾기] = navigator.geolocation(watchPosition) — 동적 지도에 내 위치 점을 찍고 목적지와 함께 보이게 맞춘 뒤 직선거리.
//    걸으면 점 · 거리가 따라 움직인다(지도는 처음 한 번만 맞춤 — 그 뒤엔 손님이 옮긴 지도를 안 건드리고 '다시 맞추기' 단추로).
//    정적 그림(인증 실패)엔 내 위치를 안 그린다 — 그림 주소가 우리 서버(/api/naver-map/static)를 거치기 때문. 위치는 기기 밖으로 안 보낸다.
//  · 길안내 = 네이버 지도(대중교통 · 자동차 · 도보 — 앱 → 없으면 웹) · 카카오맵(웹). 출발지는 비워 둔다(지도 앱이 현 위치에서 출발).
//    기기별 길은 lib/reception/after-party.ts openNaverRoute. 위치 권한이 없어도 단추는 그대로 동작한다.
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { BusFront, CarFront, Copy, Footprints, LocateFixed, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import NaverMap from '@/components/map/NaverMap';
import { copyText } from '@/lib/app-links';
import { haptic } from '@/lib/haptics';
import { isInKorea, openExternalMapLink, type NaverMapInstance, type NaverMapsNS, type NaverMarker } from '@/lib/naver-map';
import {
  AFTER_PARTY_PLACE as P,
  ROUTE_MODES,
  androidAppWithoutGeolocation,
  distanceMeters,
  formatDistance,
  kakaoRouteUrl,
  naverWebRouteUrl,
  openNaverRoute,
  type RouteMode,
} from '@/lib/reception/after-party';
import './reception-after-party.css';

type GeoState = 'idle' | 'locating' | 'on' | 'denied' | 'failed';
type LatLng = { lat: number; lng: number };

const DEST = { lat: P.lat, lng: P.lng };
const DEST_MARKERS = [{ lat: P.lat, lng: P.lng, label: P.name }];
const ROUTE_ICON: Record<RouteMode, typeof BusFront> = { public: BusFront, car: CarFront, walk: Footprints };
/** 첫 위치가 이 안에 안 오면 실패로(웹뷰가 위치 요청에 아무 답도 안 주는 경우가 있다 — 채팅 getCurrentPositionSafe 와 같은 까닭) */
const FIRST_FIX_MS = 12000;
/** 두 점이 아주 가까워도 이보다 크게는 안 당긴다 */
const FIT_MAX_ZOOM = 17;

/** 내 위치 점(뿌리 0×0 = 좌표) — 목적지 핀(파랑)과 헷갈리지 않게 분홍 점 + '내 위치' 말풍선. 빛 · 그라데이션 없음 */
const ME_HTML =
  '<div style="position:relative;width:0;height:0;pointer-events:none">' +
  '<span style="position:absolute;left:-15px;top:-15px;width:30px;height:30px;border-radius:50%;background:rgba(255,77,109,0.2)"></span>' +
  '<span style="position:absolute;left:-8px;top:-8px;width:16px;height:16px;box-sizing:border-box;border-radius:50%;background:#FF4D6D;border:3px solid #fff"></span>' +
  '<span style="position:absolute;left:0;bottom:14px;transform:translateX(-50%);padding:4px 8px;border-radius:9px;background:#191F28;color:#fff;font:600 12px/16px Pretendard,-apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:-0.2px;white-space:nowrap">내 위치</span>' +
  '</div>';

export default function AfterPartyPlace({ className = '' }: { className?: string }) {
  const [geo, setGeo] = useState<GeoState>('idle');
  const [me, setMe] = useState<LatLng | null>(null);
  const [mapLive, setMapLive] = useState(false);
  /** 앱이 안 열린 길찾기(그 방법의 웹 링크를 보여 준다) */
  const [missing, setMissing] = useState<RouteMode | null>(null);

  const mapRef = useRef<NaverMapInstance | null>(null);
  const nsRef = useRef<NaverMapsNS | null>(null);
  const meMarkerRef = useRef<NaverMarker | null>(null);
  const watchRef = useRef<number | null>(null);
  const watchdogRef = useRef<number | null>(null);
  /** 다음 위치가 오면 두 점이 보이게 맞춘다 */
  const fitPendingRef = useRef(false);

  const stopWatch = useCallback(() => {
    if (watchdogRef.current != null) { window.clearTimeout(watchdogRef.current); watchdogRef.current = null; }
    if (watchRef.current != null) {
      try { navigator.geolocation.clearWatch(watchRef.current); } catch { /* 무시 */ }
      watchRef.current = null;
    }
  }, []);
  // 카드가 닫히면(2차 '아니요' · 화면 이동) 위치 받기도 멈춘다
  useEffect(() => stopWatch, [stopWatch]);

  const fitBoth = useCallback((pos: LatLng) => {
    const map = mapRef.current;
    const naver = nsRef.current;
    if (!map || !naver || !isInKorea(pos.lat, pos.lng)) return;
    try {
      const sw = new naver.LatLng(Math.min(pos.lat, DEST.lat), Math.min(pos.lng, DEST.lng));
      const ne = new naver.LatLng(Math.max(pos.lat, DEST.lat), Math.max(pos.lng, DEST.lng));
      // 위 여백 = 핀 · 말풍선 높이
      map.fitBounds(new naver.LatLngBounds(sw, ne), { top: 76, right: 48, bottom: 52, left: 48 });
      if (map.getZoom() > FIT_MAX_ZOOM) map.setZoom(FIT_MAX_ZOOM, false);
    } catch { /* 부서진 지도 */ }
  }, []);

  // 내 위치 점 — 동적 지도가 살아 있을 때만(정적 그림엔 안 그림)
  useEffect(() => {
    const map = mapRef.current;
    const naver = nsRef.current;
    if (!mapLive || !map || !naver || !me || !isInKorea(me.lat, me.lng)) return;
    try {
      const pos = new naver.LatLng(me.lat, me.lng);
      if (meMarkerRef.current) meMarkerRef.current.setPosition(pos);
      else meMarkerRef.current = new naver.Marker({ position: pos, map, icon: { content: ME_HTML, anchor: new naver.Point(0, 0) }, clickable: false, zIndex: 300 });
    } catch { /* 표시 실패는 넘어간다(거리 글자는 그대로) */ }
    if (fitPendingRef.current) {
      fitPendingRef.current = false;
      fitBoth(me);
    }
  }, [mapLive, me, fitBoth]);

  const onMapReady = useCallback((map: NaverMapInstance, naver: NaverMapsNS) => {
    mapRef.current = map;
    nsRef.current = naver;
    meMarkerRef.current = null; // 새 지도 — 점은 다시 찍는다
    fitPendingRef.current = fitPendingRef.current || watchRef.current != null;
    setMapLive(true);
  }, []);

  // 정적 그림으로 바뀌면 SDK 를 더 만지지 않는다(인증 실패면 SDK 가 지도를 스스로 부숨 — NaverMap 주석)
  const onMapFallback = useCallback(() => {
    mapRef.current = null;
    nsRef.current = null;
    meMarkerRef.current = null;
    setMapLive(false);
  }, []);

  const locate = () => {
    haptic('light');
    if (geo === 'on' && me) {
      fitBoth(me);
      return;
    }
    if (watchRef.current != null) return;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator) || androidAppWithoutGeolocation()) {
      setGeo('failed');
      return;
    }
    setGeo('locating');
    fitPendingRef.current = true;
    let got = false;
    watchdogRef.current = window.setTimeout(() => {
      if (got) return;
      stopWatch();
      setGeo('failed');
    }, FIRST_FIX_MS);
    try {
      watchRef.current = navigator.geolocation.watchPosition(
        (p) => {
          const { latitude, longitude } = p.coords;
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
          if (!got) {
            got = true;
            if (watchdogRef.current != null) { window.clearTimeout(watchdogRef.current); watchdogRef.current = null; }
          }
          setMe({ lat: latitude, lng: longitude });
          setGeo('on');
        },
        (err) => {
          // 첫 위치를 받은 뒤 잠깐 끊긴 것(시간 초과 등)은 마지막 위치 그대로
          if (got) return;
          stopWatch();
          setGeo(err?.code === 1 ? 'denied' : 'failed');
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
      );
    } catch {
      stopWatch();
      setGeo('failed');
    }
  };

  const onRoute = (mode: RouteMode) => (e: MouseEvent<HTMLAnchorElement>) => {
    haptic('light');
    setMissing(null);
    openNaverRoute(mode, e, () => setMissing(mode));
  };

  const onExternal = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    haptic('light');
    openExternalMapLink(e, href);
  };

  const copyAddress = async () => {
    haptic('light');
    if (await copyText(P.address)) toast.success('주소를 복사했어요');
    else toast.error('복사하지 못했어요. 주소를 길게 눌러 복사해 주세요.');
  };

  const distance = me ? formatDistance(distanceMeters(me, DEST)) : '';
  const kakao = kakaoRouteUrl();

  return (
    <section className={`rc-glass rc-ap ${className}`} aria-label={`2차 장소 ${P.name}`}>
      <p className="rc-eyebrow">After Party</p>
      <h3 className="rc-ap-name"><MapPin size={20} aria-hidden="true" />{P.name}</h3>
      <p className="rc-ap-addr">
        <span>{P.address}</span>
        <button type="button" className="rc-ap-copy" onClick={copyAddress} aria-label="주소 복사">
          <Copy size={13} aria-hidden="true" />복사
        </button>
      </p>

      <NaverMap
        className="rc-ap-map"
        center={DEST}
        zoom={16}
        markers={DEST_MARKERS}
        interactive
        href={P.link}
        linkLabel="네이버 지도에서 장소 보기"
        title={P.name}
        address={P.address}
        onReady={onMapReady}
        onFallback={onMapFallback}
      />

      <button type="button" className="rc-btn-gold rc-ap-locate" onClick={locate} disabled={geo === 'locating'}>
        <LocateFixed size={19} aria-hidden="true" />
        {geo === 'locating' ? '내 위치 찾는 중…' : geo === 'on' ? '내 위치와 함께 다시 보기' : '내 위치에서 길찾기'}
      </button>
      <p className={`rc-ap-status ${geo === 'denied' || geo === 'failed' ? 'warn' : ''}`} aria-live="polite">
        {geo === 'on' && distance ? (
          <>여기서 직선 <b>{distance}</b>{mapLive ? ' · 지도에 내 위치를 표시했어요' : ''}</>
        ) : geo === 'denied' ? (
          '위치 권한이 꺼져 있어 내 위치를 못 받았어요 — 길찾기 앱에서 출발지가 현 위치로 잡혀요.'
        ) : geo === 'failed' ? (
          '위치를 못 받았어요 — 길찾기 앱에서 출발지가 현 위치로 잡혀요.'
        ) : geo === 'locating' ? (
          '위치 권한을 물으면 허용을 눌러 주세요.'
        ) : (
          '내 위치는 지도 표시에만 쓰고 어디에도 저장하지 않아요.'
        )}
      </p>

      <p className="rc-ap-sub">네이버 지도로 길안내 · 출발은 지금 내 위치</p>
      <div className="rc-ap-routes">
        {ROUTE_MODES.map(({ mode, label }) => {
          const Icon = ROUTE_ICON[mode];
          return (
            <a key={mode} className="rc-ap-route" href={naverWebRouteUrl(mode)} target="_blank" rel="noopener noreferrer" onClick={onRoute(mode)}>
              <Icon size={22} aria-hidden="true" />
              <span>{label}</span>
            </a>
          );
        })}
      </div>
      {missing && (
        <p className="rc-ap-missing" role="status">
          네이버 지도 앱이 안 열렸나요?{' '}
          <a href={naverWebRouteUrl(missing)} target="_blank" rel="noopener noreferrer" onClick={onExternal(naverWebRouteUrl(missing))}>웹에서 길찾기</a>
        </p>
      )}
      <a className="rc-btn-line sm rc-ap-kakao" href={kakao} target="_blank" rel="noopener noreferrer" onClick={onExternal(kakao)}>
        카카오맵으로 길안내
      </a>
      <a className="rc-text-btn rc-ap-place" href={P.link} target="_blank" rel="noopener noreferrer" onClick={onExternal(P.link)}>
        네이버 지도에서 장소 보기 ›
      </a>
    </section>
  );
}
