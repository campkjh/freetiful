'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import {
  X, Copy, Reply, Trash2, MoreVertical,
  MapPin, FileText, Music, Smile, Plus, Search, Bell, BellOff,
  Flag, Pin, TextSelect, PinOff,
  Camera, Mic, Image as ImageIcon,
  FileSignature, CreditCard, CheckCircle2, CalendarCheck,
  AlarmClock, Sparkles, Star, RefreshCw, XCircle, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { quotationApi } from '@/lib/api/quotation.api';
import { chatApi } from '@/lib/api/chat.api';
import { useAuthStore } from '@/lib/store/auth.store';
import { useChatStore } from '@/lib/store/chat.store';
import { getPlanTemplates, type PlanTemplate } from '@/lib/api/plan-templates.api';
import { getWeddingPlanTemplate, normalizeWeddingPlanKey } from '@/lib/wedding-plans';

import type { Message, ChatPartner, SystemPayload } from './chat-types';
export type { Message, ChatPartner, SystemPayload };

// ─── Helpers ───

const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

// 옵션명 AI 추천 (키워드 기반) — 입력 단어에 매칭되는 추천 태그를 보여줌
const OPTION_SUGGESTIONS: { name: string; price: number; keywords: string[] }[] = [
  { name: '전문 사회 비용', price: 150000, keywords: ['사회', '진행', 'mc'] },
  { name: '공식 행사 MC', price: 300000, keywords: ['공식', 'mc', '행사'] },
  { name: '리허설 참여', price: 50000, keywords: ['리허설', '연습'] },
  { name: '대본 작성', price: 80000, keywords: ['대본', '스크립트', '원고'] },
  { name: '사전 미팅', price: 30000, keywords: ['미팅', '사전', '상담'] },
  { name: '포토타임 진행', price: 50000, keywords: ['포토', '사진'] },
  { name: '축사/건배사 코디', price: 70000, keywords: ['축사', '건배', '코디'] },
  { name: '2차 진행', price: 150000, keywords: ['2차', '뒷풀이', '피로연'] },
  { name: '하객 응대', price: 80000, keywords: ['하객', '응대', '안내'] },
  { name: '전담 코디네이터', price: 200000, keywords: ['코디', '전담', '매니저'] },
  { name: '음향/사운드 체크', price: 50000, keywords: ['음향', '사운드', '마이크'] },
  { name: '교통비', price: 30000, keywords: ['교통', '출장', '이동'] },
  { name: '출장비 (장거리)', price: 100000, keywords: ['출장', '장거리', '지방', '교통'] },
  { name: '의상 (턱시도/드레스)', price: 100000, keywords: ['의상', '턱시도', '드레스'] },
  { name: '조기 도착', price: 30000, keywords: ['조기', '일찍', '리허설'] },
  { name: '영상 큐시트', price: 50000, keywords: ['큐시트', '영상', '진행표'] },
  { name: '세팅 지원', price: 50000, keywords: ['세팅', '준비', '셋업'] },
];

function suggestOptionNames(input: string): { name: string; price: number }[] {
  const q = input.toLowerCase().trim();
  if (!q) return [];
  const scored = OPTION_SUGGESTIONS.map((s) => {
    let score = 0;
    if (s.name.toLowerCase().includes(q)) score += 10;
    for (const kw of s.keywords) {
      if (kw.toLowerCase().includes(q) || q.includes(kw.toLowerCase())) score += 5;
    }
    return { ...s, score };
  }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);
  return scored.map(({ name, price }) => ({ name, price }));
}

const formatKRW = (n: number) => n.toLocaleString('ko-KR') + '원';
const formatDate = (iso: string) => {
  const d = new Date(iso);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
};
const normalizeDateParam = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};
const normalizeTimeParam = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{1,2}:\d{2}/.test(value)) {
    const [hh, mm] = value.split(':');
    return `${hh.padStart(2, '0')}:${mm.slice(0, 2)}`;
  }
  if (typeof value === 'string') {
    const isoTime = value.match(/T(\d{2}:\d{2})/);
    if (isoTime) return isoTime[1];
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const buildQuoteCheckoutUrl = (chatPartner: ChatPartner | null, sys: SystemPayload, quoteDetail?: any) => {
  const proId = chatPartner?.proProfileId || chatPartner?.id;
  const params = new URLSearchParams({
    price: String(sys.amount || quoteDetail?.amount || 0),
    plan: sys.plan || 'premium',
    quotationId: sys.quotationId || quoteDetail?.id || '',
  });
  const eventDate = normalizeDateParam(sys.eventDate || quoteDetail?.eventDate);
  const eventTime = normalizeTimeParam(sys.eventTime || quoteDetail?.eventTime);
  const eventLocation = sys.eventLocation || quoteDetail?.eventLocation || '';
  if (eventDate) params.set('eventDate', eventDate);
  if (eventTime) params.set('slots', eventTime);
  if (eventLocation) params.set('eventLocation', eventLocation);
  const qs = params.toString();
  return proId ? `/pros/${proId}/checkout?${qs}` : `/pros/checkout?${qs}`;
};

declare global {
  interface Window {
    naver?: any;
    kakao?: any;
  }
}

// 네이버 지도 SDK 동적 로드
let naverMapsLoadingPromise: Promise<void> | null = null;
function loadNaverMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject('SSR');
  if (window.naver?.maps) return Promise.resolve();
  if (naverMapsLoadingPromise) return naverMapsLoadingPromise;

  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  if (!clientId) return Promise.reject('NO_KEY');

  naverMapsLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${clientId}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject('LOAD_ERROR');
    document.head.appendChild(script);
  });
  return naverMapsLoadingPromise;
}

// ─── NaverMapPicker ───
function NaverMapPicker({ onSelect, onClose }: { onSelect: (lat: number, lng: number) => void; onClose: () => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<{ lat: number; lng: number } | null>(null);
  const [hasNaverKey, setHasNaverKey] = useState<boolean | null>(null);
  const naverMapInstanceRef = useRef<any>(null);
  const naverMarkerRef = useRef<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadNaverMaps()
      .then(() => {
        if (cancelled || !mapRef.current || !window.naver?.maps) return;
        setHasNaverKey(true);
        const naver = window.naver;
        const seoul = new naver.maps.LatLng(37.5665, 126.978);
        const map = new naver.maps.Map(mapRef.current, {
          center: seoul,
          zoom: 14,
          zoomControl: true,
          zoomControlOptions: { position: naver.maps.Position.TOP_RIGHT },
          mapTypeControl: false,
          logoControl: false,
          mapDataControl: false,
          scaleControl: false,
        });
        naverMapInstanceRef.current = map;

        naver.maps.Event.addListener(map, 'click', (e: any) => {
          const lat = e.coord.lat();
          const lng = e.coord.lng();
          setSelected({ lat, lng });
          if (naverMarkerRef.current) {
            naverMarkerRef.current.setPosition(e.coord);
          } else {
            naverMarkerRef.current = new naver.maps.Marker({ position: e.coord, map });
          }
        });

        naverMarkerRef.current = new naver.maps.Marker({ position: seoul, map });
        setSelected({ lat: 37.5665, lng: 126.978 });
      })
      .catch(() => {
        if (!cancelled) setHasNaverKey(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSearch = () => {
    if (!searchQuery.trim() || !window.naver?.maps?.Service) {
      toast.error('네이버 지오코딩 서비스를 사용할 수 없습니다');
      return;
    }
    window.naver.maps.Service.geocode({ query: searchQuery }, (status: any, response: any) => {
      if (status !== window.naver.maps.Service.Status.OK) {
        toast.error('검색 실패');
        return;
      }
      const result = response.v2.addresses[0];
      if (!result) {
        toast.error('검색 결과가 없습니다');
        return;
      }
      const lat = parseFloat(result.y);
      const lng = parseFloat(result.x);
      const point = new window.naver.maps.LatLng(lat, lng);
      naverMapInstanceRef.current?.setCenter(point);
      naverMapInstanceRef.current?.setZoom(16);
      if (naverMarkerRef.current) {
        naverMarkerRef.current.setPosition(point);
      }
      setSelected({ lat, lng });
    });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-[fadeIn_0.2s_ease]" onClick={onClose}>
      <div
        className="w-full max-w-[520px] h-[80vh] sm:h-[600px] sm:max-h-[80vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-[menuPop_0.3s_cubic-bezier(0.34,1.56,0.64,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0">
          <div>
            <p className="text-[11px] font-bold tracking-wider text-gray-400">LOCATION</p>
            <h3 className="text-[18px] font-black text-gray-900 mt-0.5">위치 선택</h3>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center active:scale-90 transition-transform">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="px-5 pb-3 shrink-0">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center bg-gray-100 rounded-full pl-4 pr-2 h-11">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
                placeholder="장소나 주소 검색"
                className="flex-1 bg-transparent text-[15px] focus:outline-none placeholder:text-gray-400"
              />
              <button onClick={handleSearch} className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-900 flex items-center justify-center active:scale-90 transition-transform">
                <Search size={16} className="text-white" />
              </button>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2 px-1">지도를 탭하거나 검색하여 위치를 선택하세요</p>
        </div>

        <div className="flex-1 relative bg-gray-100 mx-5 rounded-2xl overflow-hidden">
          {hasNaverKey !== false && <div ref={mapRef} className="absolute inset-0" />}
          {hasNaverKey === false && (
            <div className="absolute inset-0 flex items-center justify-center text-center p-6">
              <div>
                <MapPin size={36} className="text-gray-300 mx-auto mb-2" />
                <p className="text-[13px] text-gray-500">네이버 지도 SDK 로드 실패</p>
                <p className="text-[11px] text-gray-400 mt-1">NEXT_PUBLIC_NAVER_MAP_CLIENT_ID 환경변수를 확인해주세요</p>
              </div>
            </div>
          )}
          {hasNaverKey === null && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-[13px] text-gray-400">지도 로딩 중...</p>
            </div>
          )}
        </div>

        <div className="px-5 pt-3 pb-5 shrink-0">
          {selected && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2.5 bg-blue-50 rounded-xl">
              <MapPin size={16} className="text-[#007AFF] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-gray-900">선택한 위치</p>
                <p className="text-[11px] text-gray-500 truncate tabular-nums">{selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}</p>
              </div>
            </div>
          )}
          <button
            onClick={() => {
              if (!selected) {
                toast.error('지도에서 위치를 선택해주세요');
                return;
              }
              onSelect(selected.lat, selected.lng);
              onClose();
            }}
            disabled={!selected}
            className="w-full h-12 bg-[#007AFF] hover:bg-[#0066d9] disabled:bg-gray-300 text-white text-[15px] font-bold rounded-2xl active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <MapPin size={16} />
            이 위치 전송하기
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── NaverMapPreview ───
export function NaverMapPreview({ lat, lng, mine }: { lat: number; lng: number; mine: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [hasNaverKey, setHasNaverKey] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadNaverMaps()
      .then(() => {
        if (cancelled || !mapRef.current || !window.naver?.maps) return;
        setHasNaverKey(true);
        const naver = window.naver;
        const center = new naver.maps.LatLng(lat, lng);
        const map = new naver.maps.Map(mapRef.current, {
          center,
          zoom: 16,
          draggable: false,
          pinchZoom: false,
          scrollWheel: false,
          keyboardShortcuts: false,
          disableDoubleTapZoom: true,
          disableDoubleClickZoom: true,
          disableTwoFingerTapZoom: true,
          zoomControl: false,
          mapTypeControl: false,
          logoControl: false,
          mapDataControl: false,
          scaleControl: false,
        });
        new naver.maps.Marker({ position: center, map });
      })
      .catch(() => {
        if (!cancelled) setHasNaverKey(false);
      });
    return () => { cancelled = true; };
  }, [lat, lng]);

  const naverMapUrl = `https://map.naver.com/p/?c=${lng},${lat},16,0,0,0,0`;

  return (
    <a
      href={naverMapUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-[260px] rounded-2xl overflow-hidden bg-gray-100 active:scale-[0.98] transition-transform"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative w-full h-[160px] bg-gray-200">
        {hasNaverKey !== false && (
          <div ref={mapRef} className="absolute inset-0" />
        )}
        {hasNaverKey === false && (
          <iframe
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.004}%2C${lat - 0.003}%2C${lng + 0.004}%2C${lat + 0.003}&layer=mapnik&marker=${lat}%2C${lng}`}
            className="absolute inset-0 w-full h-full border-0 pointer-events-none"
            loading="lazy"
          />
        )}
        {hasNaverKey === null && (
          <div className="absolute inset-0 flex items-center justify-center">
            <MapPin size={32} className="text-[#007AFF]" />
          </div>
        )}
      </div>
      <div className={`px-3 py-2.5 ${mine ? 'bg-[#0066D9]' : 'bg-white'}`}>
        <div className="flex items-center gap-2">
          <MapPin size={14} className={mine ? 'text-white' : 'text-[#007AFF]'} />
          <p className={`text-[13px] font-bold ${mine ? 'text-white' : 'text-gray-900'}`}>
            내 위치
          </p>
        </div>
        <p className={`text-[11px] mt-0.5 truncate ${mine ? 'text-white/70' : 'text-gray-500'}`}>
          {lat.toFixed(5)}, {lng.toFixed(5)} · 네이버 지도에서 열기
        </p>
      </div>
    </a>
  );
}

// ─── KakaoMapEmbed ───
function KakaoMapEmbed({ venue }: { venue: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;

    const existingScript = document.querySelector('script[src*="dapi.kakao.com/v2/maps"]');
    const init = () => {
      if (!window.kakao?.maps) return;
      window.kakao.maps.load(() => {
        const container = mapRef.current;
        if (!container) return;
        const map = new window.kakao.maps.Map(container, {
          center: new window.kakao.maps.LatLng(37.566, 126.978),
          level: 4,
        });
        const ps = new window.kakao.maps.services.Places();
        ps.keywordSearch(venue, (data: any[], status: string) => {
          if (status === window.kakao.maps.services.Status.OK && data[0]) {
            const pos = new window.kakao.maps.LatLng(data[0].y, data[0].x);
            map.setCenter(pos);
            new window.kakao.maps.Marker({ map, position: pos });
          }
        });
        setLoaded(true);
      });
    };

    if (existingScript) {
      if (window.kakao?.maps) init();
      else existingScript.addEventListener('load', init);
    } else {
      const script = document.createElement('script');
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=dca1b472188890116c81a55eff590885&libraries=services&autoload=false`;
      script.async = true;
      script.onload = init;
      document.head.appendChild(script);
    }
  }, [venue]);

  return (
    <a href={`https://map.kakao.com/?q=${encodeURIComponent(venue)}`} target="_blank" rel="noopener noreferrer" className="block">
      <div ref={mapRef} className="w-full h-[120px]" style={{ background: '#F3F4F6' }} />
    </a>
  );
}

// 견적 카드 중 뷰포트 중앙에 가장 가까운 카드만 부유 애니메이션을 켠다.
// 여러 인스턴스가 렌더될 때 서로 비교하기 위해 간단한 글로벌 레지스트리 사용.
const quoteCardRegistry = new Set<HTMLElement>();
let quoteScrollRaf = 0;
function scheduleQuoteCenterUpdate() {
  if (quoteScrollRaf) return;
  quoteScrollRaf = requestAnimationFrame(() => {
    quoteScrollRaf = 0;
    if (typeof window === 'undefined') return;
    const center = window.innerHeight / 2;
    let best: HTMLElement | null = null;
    let bestDist = Infinity;
    quoteCardRegistry.forEach((el) => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - center);
      if (d < bestDist) { bestDist = d; best = el; }
    });
    quoteCardRegistry.forEach((el) => {
      if (el === best) el.setAttribute('data-near-center', 'true');
      else el.setAttribute('data-near-center', 'false');
    });
  });
}
function useNearestQuoteCard<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    quoteCardRegistry.add(el);
    scheduleQuoteCenterUpdate();
    const onScroll = () => scheduleQuoteCenterUpdate();
    const onResize = () => scheduleQuoteCenterUpdate();
    // 창 스크롤 + 채팅 컨테이너 스크롤(캡처) 모두 커버
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onResize);
    return () => {
      quoteCardRegistry.delete(el);
      window.removeEventListener('scroll', onScroll, { capture: true } as any);
      window.removeEventListener('resize', onResize);
      scheduleQuoteCenterUpdate();
    };
  }, []);
  return ref;
}

// ─── SystemMessageCard ───
export function SystemMessageCard({ msg, isPro = false, chatPartner = null, myProfileImage = null, isLatestQuote = false, refreshTick = 0 }: { msg: Message; isPro?: boolean; chatPartner?: ChatPartner | null; myProfileImage?: string | null; isLatestQuote?: boolean; refreshTick?: number }) {
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [showQuoteDetail, setShowQuoteDetail] = useState(false);
  const [quoteDetail, setQuoteDetail] = useState<any>(null);
  // 결제 상태 실시간 추적: 카드 마운트 시 + 새 메시지가 들어올 때(refreshTick) +
  // 화면 포커스 시 + 미결제 동안 15초 주기로 quotation 상태를 폴링한다.
  useEffect(() => {
    const sys = msg.system;
    if (sys?.kind !== 'quote' || !sys.quotationId) return;
    let cancelled = false;
    const fetchStatus = () => {
      quotationApi.getDetail(sys.quotationId!)
        .then((q: any) => {
          if (cancelled) return;
          setQuoteDetail(q);
          if (q?.status === 'paid') setIsPaid(true);
        })
        .catch(() => {});
    };
    fetchStatus();
    if (isPaid) return () => { cancelled = true; };
    const interval = window.setInterval(fetchStatus, 15000);
    const onFocus = () => fetchStatus();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [msg.system, isPaid, refreshTick]);
  const [planTemplates, setPlanTemplates] = useState<PlanTemplate[]>([]);
  useEffect(() => { getPlanTemplates().then(setPlanTemplates).catch(() => {}); }, []);
  const quoteRef = useNearestQuoteCard<HTMLDivElement>();

  const sys = msg.system;
  if (!sys) return null;

  if (sys.kind === 'session_start' || !['quote', 'payment_request', 'payment_paid', 'booking_confirmed', 'reminder', 'event_today', 'event_done', 'review_request', 'refund', 'cancel'].includes(sys.kind)) {
    return (
      <div className="text-center py-3">
        <span className="inline-block text-[12px] text-gray-500 bg-gray-100 px-3.5 py-1.5 rounded-full">
          {msg.content}
        </span>
      </div>
    );
  }

  const wrapperClass = 'max-w-[280px] my-2 ml-14 animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]';

  if (sys.kind === 'quote') {
    const planKey = String(sys.plan || '').toLowerCase();
    const tpl = planTemplates.find((t) => t.planKey.toLowerCase() === planKey);
    const weddingTpl = getWeddingPlanTemplate(normalizeWeddingPlanKey(planKey));
    const planLabel = tpl?.label || weddingTpl?.label || (planKey ? planKey.charAt(0).toUpperCase() + planKey.slice(1) : '1부 예식');
    const planColor = planKey === 'enterprise' ? '#F59E0B' : planKey === 'superior' || planKey === 'wedding_part12' ? '#8B5CF6' : '#3180F7';

    return (
      <>
      <div
        ref={quoteRef}
        data-quote-card="true"
        data-near-center="false"
        onClick={() => setShowQuoteDetail(true)}
        className="quote-card-root my-2 ml-2 mr-auto max-w-[320px] cursor-pointer"
        style={{
          perspective: '650px',
          perspectiveOrigin: '50% 45%',
          transformStyle: 'preserve-3d',
        }}
      >
        <div className="flex items-center gap-4" style={{ transformStyle: 'preserve-3d' }}>
          {/* ─── 좌측: 세로형 카드 컨테이너 (fly-in + float 합성) ─── */}
          {/* 좌측으로 살짝 기울어진 래퍼 — 중앙일 때만 기울기 유지, 아니면 평면 */}
          <div className="relative shrink-0 quote-card-tilt" style={{ transformStyle: 'preserve-3d' }}>
          <div
            className="relative quote-card-float"
            style={{
              width: 116,
              height: 180,
              transformStyle: 'preserve-3d',
            }}
          >
            {/* 카드 본체 — 프로필 사진으로 가득 찬 형태 */}
            <div
              className="absolute inset-0 rounded-[16px] overflow-hidden quote-card-body"
              style={{
                transformStyle: 'preserve-3d',
                transformOrigin: 'center center',
                boxShadow: '0 14px 28px -12px rgba(0,0,0,0.18), 0 4px 10px -4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.18)',
                willChange: 'transform',
                background: '#1F2937',
              }}
            >
              {/* 프로필 사진 풀블리드 */}
              {(() => {
                const proImg = (sys as any)?.proImage
                  || (isPro ? myProfileImage : chatPartner?.profileImageUrl)
                  || '/images/default-profile.svg';
                return (
                  <img
                    src={proImg}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/images/default-profile.svg'; }}
                  />
                );
              })()}

              {/* 은은한 상단/하단 그라디언트 (사진 가독성 보조, 부유에 맞춰 진하기 변화) */}
              <div
                className="absolute inset-0 pointer-events-none quote-card-dim"
                style={{
                  borderRadius: 16,
                  background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0) 65%, rgba(0,0,0,0.3) 100%)',
                }}
              />

              {/* 빛반사 shimmer — 자연스럽고 부드러운 빛번짐 (카드 안쪽으로만 clip) */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ borderRadius: 16 }}>
                <div
                  className="absolute quote-card-shimmer"
                  style={{
                    inset: '-40% -50%',
                    background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.04) 42%, rgba(255,255,255,0.10) 48%, rgba(255,255,255,0.16) 50%, rgba(255,255,255,0.10) 52%, rgba(255,255,255,0.04) 58%, transparent 70%)',
                    mixBlendMode: 'soft-light',
                    filter: 'blur(3px)',
                  }}
                />
              </div>
            </div>

            {/* 바닥 그림자 — 전체적으로 더 옅게 */}
            <div
              className="absolute quote-card-shadow"
              style={{
                left: '50%',
                bottom: -18,
                width: 96,
                height: 14,
                background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.10) 40%, rgba(0,0,0,0) 75%)',
                transform: 'translateX(-50%)',
                filter: 'blur(5px)',
                pointerEvents: 'none',
              }}
            />
          </div>
          </div>

          {/* ─── 우측: 텍스트 스택 (순차 페이드인) + 결제 버튼 ─── */}
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            {/* 태그 (플랜명 + 추가옵션 수) — 알약 형태 / 살짝 딤드 */}
            <div className="flex items-center gap-1" style={{ animation: 'quoteTextInRight 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both' }}>
              <span
                className="inline-block py-1 rounded-full leading-none"
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  paddingLeft: 7,
                  paddingRight: 7,
                  color: 'rgba(0,0,0,0.7)',
                  background: 'rgba(0,0,0,0.06)',
                  border: '1px solid rgba(255,255,255,0.5)',
                }}
              >
                {planLabel}
              </span>
              {Array.isArray(sys.options) && sys.options.length > 0 && (
                <span
                  className="inline-block py-1 rounded-full leading-none"
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    paddingLeft: 6,
                    paddingRight: 6,
                    color: '#B45309',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                  }}
                  title={sys.options.map((o) => `${o.name} +${o.price.toLocaleString()}원`).join(', ')}
                >
                  +{sys.options.length}
                </span>
              )}
            </div>
            {/* 상품명 16pt weight 500 */}
            <p
              className="text-gray-900 leading-tight mt-0.5"
              style={{
                fontSize: 16,
                fontWeight: 500,
                animation: 'quoteTextInUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.48s both',
              }}
            >
              {sys.eventName || '행사 진행'}
            </p>
            {/* 금액 20pt weight 700 */}
            <p
              className="text-gray-900 tabular-nums"
              style={{
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                animation: 'quoteTextInUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.66s both',
              }}
            >
              {formatKRW(sys.amount || 0)}
            </p>
            {!isPro && sys.quotationId && (
              isPaid ? (
                <div
                  className="mt-2 self-start px-4 py-2.5 bg-emerald-50 text-emerald-600 text-[13px] font-bold inline-flex items-center gap-1.5"
                  style={{ borderRadius: 12 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15"/>
                    <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  결제완료
                </div>
              ) : isLatestQuote ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = buildQuoteCheckoutUrl(chatPartner, sys, quoteDetail);
                  }}
                  className="mt-2 self-start px-4 py-2.5 bg-[#3180F7] text-white text-[13px] font-bold active:scale-95 transition-transform shadow-[0_4px_12px_rgba(49,128,247,0.28)]"
                  style={{ borderRadius: 12, animation: 'quoteTextInUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.84s both' }}
                >
                  결제하기
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="mt-2 self-start px-4 py-2.5 bg-gray-100 text-gray-400 text-[13px] font-medium cursor-not-allowed"
                  style={{ borderRadius: 12 }}
                  title="최신 견적서만 결제 가능합니다"
                >
                  만료된 견적
                </button>
              )
            )}
            {/* 사회자 측 결제 상태 — 실시간 (15s 폴링 + focus 갱신) */}
            {isPro && sys.quotationId && (
              isPaid ? (
                <div
                  className="mt-2 self-start px-3.5 py-2 bg-emerald-50 text-emerald-600 text-[12px] font-bold inline-flex items-center gap-1.5"
                  style={{ borderRadius: 12 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15"/>
                    <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  고객 결제완료
                </div>
              ) : (
                <div
                  className="mt-2 self-start px-3.5 py-2 bg-amber-50 text-amber-600 text-[12px] font-bold inline-flex items-center gap-1.5"
                  style={{ borderRadius: 12 }}
                >
                  <Clock size={13} />
                  결제 대기 중
                </div>
              )
            )}
          </div>
        </div>
        <style>{`
          /* 카드 날아오기 — 2-3단계로 단순화해서 매우 자연스럽게 */
          @keyframes quoteCardFly {
            0% {
              opacity: 0;
              transform: translate3d(-260px, 10px, -220px) rotateY(72deg) rotateX(10deg) scale(0.55);
              filter: blur(4px);
            }
            35% {
              opacity: 1;
              filter: blur(0);
            }
            100% {
              opacity: 1;
              /* 평면 상태로 착지 — 중앙이면 CSS rule 의 rotateY(32)/rotateX(8) 로 transition */
              transform: translate3d(0, 0, 0) rotateY(0deg) rotateX(0deg) scale(1);
              filter: blur(0);
            }
          }
          .quote-card-root .quote-card-body {
            animation: quoteCardFly 1.0s cubic-bezier(0.22, 1, 0.36, 1);
          }
          /* 기본 (중앙 아님) — 모든 3D/애니메이션 OFF, 평면 + 그림자 없음.
             전환은 천천히 부드럽게 (뚝딱거리지 않게) */
          .quote-card-root .quote-card-tilt {
            transform: rotate(0deg);
            transition: transform 1.1s cubic-bezier(0.4, 0, 0.15, 1);
          }
          .quote-card-root .quote-card-body {
            transform: rotateY(0deg) rotateX(0deg);
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
            transition: transform 1.2s cubic-bezier(0.4, 0, 0.15, 1), box-shadow 1s cubic-bezier(0.4, 0, 0.15, 1);
          }
          .quote-card-root .quote-card-float { animation: none; }
          .quote-card-root .quote-card-dim {
            animation: none;
            opacity: 0.5;
            transition: opacity 0.9s cubic-bezier(0.4, 0, 0.15, 1);
          }
          .quote-card-root .quote-card-shimmer {
            animation: none;
            opacity: 0;
            transition: opacity 0.9s cubic-bezier(0.4, 0, 0.15, 1);
          }
          .quote-card-root .quote-card-shadow {
            animation: none;
            opacity: 0;
            transform: translateX(-50%) scaleX(0.7) scaleY(0.6);
            filter: blur(2px);
            transition: opacity 0.9s cubic-bezier(0.4, 0, 0.15, 1), transform 0.9s cubic-bezier(0.4, 0, 0.15, 1), filter 0.9s ease;
          }

          /* 중앙 — 3D 기울기 + 부유/shimmer/shadow/dim 전부 ON */
          .quote-card-root[data-near-center="true"] .quote-card-tilt {
            transform: rotate(-4deg);
          }
          .quote-card-root[data-near-center="true"] .quote-card-body {
            transform: rotateY(32deg) rotateX(8deg);
            box-shadow: 0 14px 28px -12px rgba(0,0,0,0.18), 0 4px 10px -4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.18);
          }
          .quote-card-root[data-near-center="true"] .quote-card-float {
            animation: quoteCardFloat 4.5s ease-in-out 0.1s infinite alternate;
          }
          .quote-card-root[data-near-center="true"] .quote-card-dim {
            animation: quoteCardDim 4.5s ease-in-out 0.1s infinite alternate;
          }
          .quote-card-root[data-near-center="true"] .quote-card-shimmer {
            animation: quoteCardShimmer 7s cubic-bezier(0.45, 0, 0.55, 1) 0.6s infinite;
            opacity: 1;
          }
          .quote-card-root[data-near-center="true"] .quote-card-shadow {
            animation: quoteCardShadow 5s ease-in-out 0.1s infinite alternate;
            opacity: 1;
          }

          /* 부유 — 더 확실하게 보이도록 진폭 증가 */
          @keyframes quoteCardFloat {
            0%   { transform: translate3d(0, 0, 0); }
            100% { transform: translate3d(0, -16px, 18px); }
          }
          /* 그림자 호흡 — 전체 옅게 */
          @keyframes quoteCardShadow {
            0%   { opacity: 0.72; transform: translateX(-50%) scaleX(0.6) scaleY(0.55); filter: blur(3px); }
            100% { opacity: 0.3;  transform: translateX(-50%) scaleX(1.35) scaleY(1.25); filter: blur(9px); }
          }
          /* 빛반사 — 긴 쉼 + 은은한 페이드 인/아웃. 인위적인 "번쩍"이 아니라
             햇빛이 사선으로 스며드는 느낌 */
          @keyframes quoteCardShimmer {
            0%   { transform: translate3d(-70%, -25%, 0); opacity: 0; }
            25%  { opacity: 0; }
            45%  { transform: translate3d(-10%, -5%, 0); opacity: 0.55; }
            55%  { transform: translate3d(10%, 5%, 0); opacity: 0.55; }
            75%  { transform: translate3d(70%, 25%, 0); opacity: 0; }
            100% { transform: translate3d(70%, 25%, 0); opacity: 0; }
          }
          /* 딤 레이어 — 부유에 맞춰 은은하게 진해졌다 옅어짐 */
          @keyframes quoteCardDim {
            0%   { opacity: 0.5; }
            100% { opacity: 1; }
          }
          /* 텍스트 — 우측에서 좌측으로 페이드인 (태그 전용) */
          @keyframes quoteTextInRight {
            0%   { opacity: 0; transform: translateX(14px); }
            100% { opacity: 1; transform: translateX(0); }
          }
          /* 텍스트 — 아래에서 위로 부드럽게 */
          @keyframes quoteTextInUp {
            0%   { opacity: 0; transform: translateY(6px); }
            100% { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
      {showQuoteDetail && (
        <div
          className="fixed inset-0 z-[120] flex items-end bg-black/40"
          onClick={() => setShowQuoteDetail(false)}
        >
          <div
            className="bg-white w-full rounded-t-3xl px-5 pt-5 pb-8 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'sheetUp 0.3s ease' }}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[18px] font-bold text-gray-900">
                {isPro ? '내가 보낸 견적' : isPaid ? '결제 내역' : '받은 견적'}
              </h2>
              <button
                onClick={() => setShowQuoteDetail(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X size={16} className="text-gray-600" />
              </button>
            </div>

            {/* 결제 상태 배지 */}
            <div className="mb-4">
              {isPaid ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 text-[12px] font-bold rounded-full">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15"/>
                    <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  결제완료
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 text-[12px] font-bold rounded-full">
                  <Clock size={12} />
                  결제 대기 중
                </div>
              )}
            </div>

            {/* 행사 정보 */}
            <div className="space-y-3 mb-5">
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">행사명</p>
                <p className="text-[16px] font-semibold text-gray-900">{sys.eventName || quoteDetail?.title || '행사 진행'}</p>
              </div>
              {(sys.eventDate || quoteDetail?.eventDate) && (
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">행사 일정</p>
                  <p className="text-[15px] text-gray-800">
                    {(() => {
                      const d = sys.eventDate || quoteDetail?.eventDate;
                      if (!d) return '미정';
                      try {
                        return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
                      } catch { return String(d); }
                    })()}
                    {normalizeTimeParam(sys.eventTime || quoteDetail?.eventTime) ? ` · ${normalizeTimeParam(sys.eventTime || quoteDetail?.eventTime)}` : ''}
                  </p>
                </div>
              )}
              {quoteDetail?.eventLocation && (
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">장소</p>
                  <p className="text-[15px] text-gray-800">{quoteDetail.eventLocation}</p>
                </div>
              )}
              {quoteDetail?.description && (
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">메모</p>
                  <p className="text-[14px] text-gray-700 whitespace-pre-wrap">{quoteDetail.description}</p>
                </div>
              )}
              {Array.isArray(sys.options) && sys.options.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">추가 옵션</p>
                  <div className="space-y-1">
                    {sys.options.map((o: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-[13px] text-gray-700">
                        <span>+ {o.name}</span>
                        <span className="font-semibold">+{Number(o.price || 0).toLocaleString()}원</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 금액 요약 */}
            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
              <span className="text-[13px] text-gray-500">총 견적 금액</span>
              <span className="text-[20px] font-bold text-[#3180F7] tabular-nums">
                {Number(sys.amount || 0).toLocaleString()}원
              </span>
            </div>

            {/* 액션: 미결제 + 최신 + 고객 측이면 결제하기 노출 */}
            {!isPro && sys.quotationId && !isPaid && isLatestQuote && (
              <button
                type="button"
                onClick={() => {
                  window.location.href = buildQuoteCheckoutUrl(chatPartner, sys, quoteDetail);
                }}
                className="w-full h-13 py-4 rounded-xl font-bold text-[16px] bg-[#3180F7] text-white active:scale-[0.98] transition-colors"
              >
                결제하기
              </button>
            )}
            {isPro && (
              <p className="text-center text-[12px] text-gray-400">
                고객의 결제 상태는 자동으로 갱신됩니다
              </p>
            )}
          </div>
        </div>
      )}
      </>
    );
  }

  if (sys.kind === 'payment_request') {
    return (
      <div className={wrapperClass}>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="5" width="20" height="14" rx="3" fill="#3180F7"/>
              <path d="M2 10h20" stroke="white" strokeWidth="1" opacity="0.3"/>
              <rect x="5" y="14" width="5" height="1.5" rx="0.75" fill="white" opacity="0.5"/>
              <circle cx="18" cy="14" r="2.5" fill="white" opacity="0.3"/>
            </svg>
            <div>
              <p className="text-[14px] font-semibold text-gray-900">프리티풀 안전결제 요청</p>
              <p className="text-[11px] text-gray-400">프리티풀을 통해 안전하게 결제됩니다</p>
            </div>
          </div>
          <div className="px-4 py-3.5">
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-gray-500">서비스 금액</span>
                <span className="text-gray-900 tabular-nums">{formatKRW(Math.round((sys.amount || 0) / 1.1))}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-gray-500">부가세 (10%)</span>
                <span className="text-gray-900 tabular-nums">{formatKRW((sys.amount || 0) - Math.round((sys.amount || 0) / 1.1))}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-gray-500">플랫폼 수수료</span>
                <span className="text-gray-400">₩0</span>
              </div>
              <div className="pt-2 mt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-gray-900">총 결제금액</span>
                <span className="text-[15px] font-semibold text-gray-900 tabular-nums">{formatKRW(sys.amount || 0)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mb-3">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 7v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V7l-8-5z" fill="#3180F7" opacity="0.2"/><path d="M9 12l2 2 4-4" stroke="#3180F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span className="text-[11px] text-[#3180F7] font-medium">프리티풀 구매안심보호</span>
            </div>
            <button type="button" onClick={(e) => e.stopPropagation()} className="w-full h-10 bg-[#3180F7] active:scale-[0.98] text-white text-[13px] font-semibold rounded-xl transition-transform flex items-center justify-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 7v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V7l-8-5z" fill="white" opacity="0.3"/><path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              안전결제하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (sys.kind === 'payment_paid') {
    const isDeposit = sys.paymentType === 'deposit';
    return (
      <div className={wrapperClass}>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#43A047"/><path d="M8 12l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-gray-900">{isDeposit ? '예약금' : '잔금'} 결제 완료</p>
            <p className="text-[13px] text-gray-500 tabular-nums">{formatKRW(sys.amount || 0)}</p>
          </div>
        </div>
      </div>
    );
  }

  if (sys.kind === 'booking_confirmed') {
    return (
      <div className={wrapperClass}>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-[#3180F7] px-4 py-3.5 text-white">
            <div className="flex items-center gap-2 mb-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2.5" fill="white" opacity="0.3"/><path d="M9 13l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <p className="text-[11px] font-semibold tracking-wider uppercase opacity-80">CONFIRMED</p>
            </div>
            <p className="text-[16px] font-semibold">예약이 확정되었습니다</p>
            <p className="text-[12px] opacity-60 mt-0.5">내 스케줄에 자동 추가되었습니다</p>
          </div>
          {sys.venue && <KakaoMapEmbed venue={sys.venue} />}
          {(sys.eventDate || sys.venue) && (
            <div className="px-4 py-3 space-y-1.5">
              {sys.eventDate && (
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2.5" fill="#E5E7EB"/><rect x="3" y="4" width="18" height="6" rx="2.5" fill="#9CA3AF"/></svg>
                  <p className="text-[12px] text-gray-600">{formatDate(sys.eventDate)}{sys.eventTime ? ` · ${sys.eventTime}` : ''}</p>
                </div>
              )}
              {sys.venue && (
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EF4444"/><circle cx="12" cy="9" r="2" fill="white"/></svg>
                  <p className="text-[12px] text-gray-600">{sys.venue}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (sys.kind === 'reminder') {
    const d = sys.daysLeft ?? 0;
    return (
      <div className="mx-4 my-2">
        <div className="bg-blue-50 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
          <span className="text-[13px] font-bold text-[#3180F7] tabular-nums shrink-0">D-{d}</span>
          <span className="text-[13px] text-gray-600">{sys.eventName || '본식'}까지 {d}일 남았습니다</span>
          {sys.eventDate && <span className="text-[11px] text-gray-400 ml-auto shrink-0">{formatDate(sys.eventDate)}</span>}
        </div>
      </div>
    );
  }

  if (sys.kind === 'event_today') {
    return (
      <div className={wrapperClass}>
        <div className="bg-[#EF4444] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-4 text-white">
            <div className="flex items-center gap-2 mb-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.4l-6.4 4.8 2.4-7.2-6-4.8h7.6L12 2z" fill="white" opacity="0.5"/></svg>
              <p className="text-[11px] font-bold tracking-wider uppercase opacity-80">D-DAY</p>
            </div>
            <p className="text-[18px] font-bold">오늘은 {sys.eventName || '본식'} 당일입니다</p>
            <p className="text-[12px] opacity-70 mt-0.5">멋진 순간을 만들어보세요</p>
            {(sys.eventTime || sys.venue) && (
              <div className="mt-3 pt-3 border-t border-white/20 space-y-1">
                {sys.eventTime && <p className="text-[12px] opacity-80">{sys.eventTime}</p>}
                {sys.venue && <p className="text-[12px] opacity-80">{sys.venue}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (sys.kind === 'event_done') {
    return (
      <div className={wrapperClass}>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#9CA3AF"/><path d="M8 12l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <div>
            <p className="text-[14px] font-bold text-gray-900">행사가 종료되었습니다</p>
            <p className="text-[12px] text-gray-400 mt-0.5">사회자님과 함께한 시간 어떠셨나요?</p>
          </div>
        </div>
      </div>
    );
  }

  if (sys.kind === 'review_request') {
    return (
      <div className={wrapperClass}>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3.5">
            <div className="flex items-center gap-2 mb-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.9 6.5 7.1.8-5.3 4.9 1.5 7L12 17.8 5.8 21.2l1.5-7L2 9.3l7.1-.8L12 2z" fill="#FBBF24"/></svg>
              <p className="text-[14px] font-bold text-gray-900">후기를 남겨주세요</p>
            </div>
            <p className="text-[12px] text-gray-400 mb-3">소중한 후기는 다른 고객에게 큰 도움이 됩니다</p>
            <div className="flex items-center justify-center gap-1.5 mb-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <svg key={s} width={24} height={24} viewBox="0 0 24 24" fill="none"><path d="M12 2l2.9 6.5 7.1.8-5.3 4.9 1.5 7L12 17.8 5.8 21.2l1.5-7L2 9.3l7.1-.8L12 2z" fill="#E5E7EB"/></svg>
              ))}
            </div>
            <button type="button" onClick={(e) => e.stopPropagation()} className="w-full h-10 bg-[#FBBF24] active:scale-[0.98] text-white text-[13px] font-bold rounded-xl transition-transform">
              후기 작성하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (sys.kind === 'refund') {
    return (
      <div className={wrapperClass}>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#60A5FA"/><path d="M8 12h8M15 9l-3 3 3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">REFUND</p>
            <p className="text-[14px] font-bold text-gray-900 leading-tight">환불이 완료되었습니다</p>
            <p className="text-[12px] text-gray-500 mt-0.5 tabular-nums">{formatKRW(sys.amount || 0)}</p>
          </div>
        </div>
      </div>
    );
  }

  if (sys.kind === 'cancel') {
    return (
      <div className={wrapperClass}>
        <div className="bg-white rounded-3xl border border-red-200/60 px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <XCircle size={18} className="text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold tracking-wider text-red-500 uppercase">CANCELLED</p>
            <p className="text-[14px] font-bold text-gray-900 leading-tight">예약이 취소되었습니다</p>
            <p className="text-[12px] text-gray-500 mt-0.5">{msg.content}</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Highlight @mentions in text
export function renderTextWithMentions(text: string) {
  const parts = text.split(/(@[\w가-힣]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return <span key={i} className="font-bold text-[#0A84FF] bg-[#0A84FF]/15 px-1 py-0.5 rounded">{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

// ─── ChatExtras Props ───

export interface ChatExtrasProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  chatPartner: ChatPartner | null;
  MY_ID: string;
  isPro: boolean;
  // Modal states
  actionMenu: { id: string; x: number; y: number; mine: boolean } | null;
  setActionMenu: React.Dispatch<React.SetStateAction<{ id: string; x: number; y: number; mine: boolean } | null>>;
  replyTo: { id: string; name: string; content: string } | null;
  setReplyTo: React.Dispatch<React.SetStateAction<{ id: string; name: string; content: string } | null>>;
  imagePreview: string | null;
  setImagePreview: React.Dispatch<React.SetStateAction<string | null>>;
  showHeaderMenu: boolean;
  setShowHeaderMenu: React.Dispatch<React.SetStateAction<boolean>>;
  muted: boolean;
  setMuted: React.Dispatch<React.SetStateAction<boolean>>;
  showAttach: boolean;
  setShowAttach: React.Dispatch<React.SetStateAction<boolean>>;
  showQuoteModal: boolean;
  setShowQuoteModal: React.Dispatch<React.SetStateAction<boolean>>;
  showLocationPicker: boolean;
  setShowLocationPicker: React.Dispatch<React.SetStateAction<boolean>>;
  pinnedMessage: { id: string; name: string; content: string } | null;
  setPinnedMessage: React.Dispatch<React.SetStateAction<{ id: string; name: string; content: string } | null>>;
  partialCopyMsg: Message | null;
  setPartialCopyMsg: React.Dispatch<React.SetStateAction<Message | null>>;
  // Recording
  isRecording: boolean;
  setIsRecording: React.Dispatch<React.SetStateAction<boolean>>;
  recordingTime: number;
  setRecordingTime: React.Dispatch<React.SetStateAction<number>>;
  onRegisterRecording?: (fns: { start: () => void; stop: (cancel: boolean) => void }) => void;
  // Voice playback
  playingVoice: string | null;
  setPlayingVoice: React.Dispatch<React.SetStateAction<string | null>>;
  voicePlayProgress: Record<string, number>;
  setVoicePlayProgress: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  // Mention
  mentionQuery: string | null;
  setMentionQuery: React.Dispatch<React.SetStateAction<string | null>>;
  // Refs
  inputRef: React.RefObject<HTMLInputElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  cameraInputRef: React.RefObject<HTMLInputElement | null>;
  // 고객의 매칭 요청 + 최신 견적 (사회자가 견적 작성 시 자동 채움용)
  roomMeta?: {
    matchRequest?: {
      id: string;
      eventDate?: string | null;
      eventTime?: string | null;
      eventLocation?: string | null;
      rawUserInput?: any;
      category?: { id: string; name: string } | null;
      eventCategory?: { id: string; name: string } | null;
    } | null;
    latestQuotation?: {
      id: string;
      title?: string | null;
      eventDate?: string | null;
      eventTime?: string | null;
      eventLocation?: string | null;
    } | null;
  } | null;
}

export default function ChatExtras(props: ChatExtrasProps) {
  const {
    messages, setMessages, chatPartner, MY_ID, isPro,
    actionMenu, setActionMenu,
    replyTo, setReplyTo,
    imagePreview, setImagePreview,
    showHeaderMenu, setShowHeaderMenu,
    muted, setMuted,
    showAttach, setShowAttach,
    showQuoteModal, setShowQuoteModal,
    showLocationPicker, setShowLocationPicker,
    pinnedMessage, setPinnedMessage,
    partialCopyMsg, setPartialCopyMsg,
    isRecording, setIsRecording,
    recordingTime, setRecordingTime,
    onRegisterRecording,
    playingVoice, setPlayingVoice,
    voicePlayProgress, setVoicePlayProgress,
    mentionQuery, setMentionQuery,
    inputRef, fileInputRef, cameraInputRef,
    roomMeta,
  } = props;

  // ─── Internal refs for recording/voice ───
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartRef = useRef<number>(0);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  // ─── Quote modal state ───
  const [quotePlan, setQuotePlan] = useState<string>('premium');
  const [quoteEventName, setQuoteEventName] = useState('');
  const [quoteEventDate, setQuoteEventDate] = useState('');
  const [quoteEventTime, setQuoteEventTime] = useState('');
  const [quoteEventLocation, setQuoteEventLocation] = useState('');
  const [quoteMemo, setQuoteMemo] = useState('');
  const [quoteCustomAmount, setQuoteCustomAmount] = useState('');

  // 견적 작성 모달이 열릴 때, 고객 매칭 요청/최신 견적 정보를 자동 채움.
  // 프로가 직접 다시 입력하지 않아도 행사일/시간/장소/이름이 들어가 있게.
  useEffect(() => {
    if (!showQuoteModal) return;
    const mr = roomMeta?.matchRequest;
    const lq = roomMeta?.latestQuotation;
    const raw: any = mr?.rawUserInput && typeof mr.rawUserInput === 'object' ? mr.rawUserInput : {};
    // ISO 또는 'YYYY-MM-DD' 둘 다 허용 — input[type=date] 는 YYYY-MM-DD 만 받는다.
    const toDateInput = (v: any): string => {
      if (!v) return '';
      try {
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return typeof v === 'string' ? v.slice(0, 10) : '';
        return d.toISOString().slice(0, 10);
      } catch { return ''; }
    };
    const toTimeInput = (v: any): string => {
      if (!v) return '';
      if (typeof v === 'string' && /^\d{1,2}:\d{2}/.test(v)) return v.slice(0, 5);
      try {
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return '';
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      } catch { return ''; }
    };
    setQuoteEventDate((cur) => cur || toDateInput(mr?.eventDate || lq?.eventDate || raw.date));
    setQuoteEventTime((cur) => cur || toTimeInput(mr?.eventTime || lq?.eventTime || raw.timeStart));
    setQuoteEventLocation((cur) => cur || mr?.eventLocation || lq?.eventLocation || raw.location || '');
    // 행사명 기본값: '{고객명}님의 행사' (예: 차보경님의 행사). 고객명 없으면 기존 폴백.
    setQuoteEventName((cur) => cur || (chatPartner?.name ? `${chatPartner.name}님의 행사` : '') || lq?.title || raw.eventName || mr?.eventCategory?.name || '');
    // 플랜 자동 선택 — rawUserInput 의 planKey 또는 wedding_part1 / wedding_part12 같은 라벨 힌트
    const planHint = raw.planKey || raw.plan;
    if (planHint && typeof planHint === 'string') {
      setQuotePlan((cur) => (PLAN_KEYS.includes(planHint) ? planHint : cur));
    }
  }, [showQuoteModal, roomMeta, chatPartner]);
  // 추가 옵션 (프로가 견적 보낼 때 옵션을 추가해 총액을 올릴 수 있음)
  const [quoteOptions, setQuoteOptions] = useState<{ name: string; price: number }[]>([]);
  const [quoteSending, setQuoteSending] = useState(false);
  const [newOptName, setNewOptName] = useState('');
  const [newOptPrice, setNewOptPrice] = useState('');

  // 어드민 플랜 템플릿 — 가격/이름/포함항목의 단일 소스
  const [planTemplates, setPlanTemplates] = useState<PlanTemplate[]>([]);
  useEffect(() => { getPlanTemplates().then(setPlanTemplates).catch(() => {}); }, []);
  const PLAN_DATA: Record<string, { label: string; price: number; items: string[] }> = Object.fromEntries(
    planTemplates.filter((t) => t.isActive).map((t) => [t.planKey, { label: t.label, price: t.defaultPrice, items: t.includedItems }])
  );
  const PLAN_KEYS = planTemplates.filter((t) => t.isActive).map((t) => t.planKey);
  useEffect(() => {
    if (PLAN_KEYS.length > 0 && !PLAN_KEYS.includes(quotePlan)) setQuotePlan(PLAN_KEYS[0]);
  }, [planTemplates]);

  const selectedPlan = PLAN_DATA[quotePlan];
  const quoteOptionsTotal = quoteOptions.reduce((s, o) => s + (Number(o.price) || 0), 0);
  const quoteBaseAmount = quoteCustomAmount.trim()
    ? Math.max(0, parseInt(quoteCustomAmount.replace(/[^\d]/g, ''), 10) || 0)
    : (selectedPlan?.price || 0);
  const quoteTotalAmount = quoteBaseAmount + quoteOptionsTotal;

  // ─── Handlers ───

  const formatVoiceDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getSupportedMimeType = (): string => {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4;codecs=mp4a.40.2',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];
    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
  };

  const startRecording = async () => {
    try {
      if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        toast.error('이 브라우저는 녹음을 지원하지 않습니다');
        return;
      }
      if (typeof MediaRecorder === 'undefined') {
        toast.error('이 브라우저는 녹음 기능을 지원하지 않습니다');
        return;
      }
      if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        toast.error('보안 연결(HTTPS)에서만 녹음할 수 있습니다');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        const duration = Math.max(1, Math.round((Date.now() - recordingStartRef.current) / 1000));
        stream.getTracks().forEach((t) => t.stop());

        // 녹음 데이터가 없으면 전송 불가 (iOS 오디오 권한 문제 등)
        if (blob.size === 0) {
          toast.error('녹음 데이터가 없습니다. 마이크 권한을 확인해주세요.');
          return;
        }

        const localUrl = URL.createObjectURL(blob);
        const optimisticId = `opt-voice-${Date.now()}`;

        // 낙관적 UI
        setMessages((prev) => [...prev, {
          id: optimisticId,
          senderId: MY_ID,
          content: localUrl,
          type: 'voice',
          createdAt: new Date().toISOString(),
          isRead: false,
          duration,
          isNew: true,
        }]);

        // 서버 업로드 후 WebSocket 전송
        const roomId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : '';
        if (!roomId || roomId.startsWith('pending-')) return;
        import('@/lib/api/chat.api').then(({ chatApi }) => {
          chatApi.uploadAudio(roomId, blob, mimeType || 'audio/webm')
            .then(async (res) => {
              const audioUrl = res.data.audioUrl || res.data.imageUrl;
              if (!audioUrl) throw new Error('audioUrl missing');

              // 업로드 완료 → 낙관적 메시지 content를 blob URL에서 실제 audioUrl로 교체
              // 이렇게 하면 재생 중에도 실제 URL로 연속 재생 가능
              setMessages((prev) => prev.map((m) =>
                m.id === optimisticId ? { ...m, content: audioUrl } : m,
              ));
              // 재생 중이던 경우 progress 키도 audioUrl 기반으로 유지 (id는 그대로)

              // store.sendMessage 시도 → null 반환(currentRoomId 없는 경우) 시 REST로 직접 전송
              let saved = await useChatStore.getState().sendMessage({
                type: 'voice',
                content: audioUrl,
                metadata: { duration },
              });
              if (!saved) {
                const r = await chatApi.sendMessage(roomId, {
                  type: 'voice',
                  content: audioUrl,
                  metadata: { duration },
                });
                saved = r.data as any;
              }
              return saved;
            })
            .then((saved) => {
              if (!saved) {
                setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
                toast.error('음성 메시지 전송에 실패했습니다.');
                return;
              }
              const savedId = (saved as any).id;
              const mappedType = ((saved as any).type === 'link' || (saved as any).type === 'sticker') ? 'text' : (saved as any).type as Message['type'];
              setMessages((prev) => {
                const withoutOpt = prev.filter((m) => m.id !== optimisticId);
                if (withoutOpt.some((m) => m.id === savedId)) return withoutOpt;
                return [...withoutOpt, { ...(saved as any), type: mappedType, duration, isNew: false } as unknown as Message];
              });
              // 낙관적 메시지가 재생 중이었다면 → 실제 메시지 ID로 재생 상태 이전
              if (playingVoice === optimisticId) {
                setPlayingVoice(savedId);
                setVoicePlayProgress((prev) => {
                  const progress = prev[optimisticId] ?? 0;
                  const { [optimisticId]: _removed, ...rest } = prev;
                  return { ...rest, [savedId]: progress };
                });
              }
            })
            .catch((err) => {
              setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
              const detail = err?.message ? ` (${err.message})` : '';
              toast.error(`음성 전송 실패${detail}`);
            });
        });
      };
      mr.onerror = (e) => {
        console.error('MediaRecorder error', e);
        toast.error('녹음 중 오류가 발생했습니다');
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = mr;
      mr.start();
      recordingStartRef.current = Date.now();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - recordingStartRef.current) / 1000));
      }, 100);
    } catch (err: any) {
      console.error('startRecording error', err);
      setIsRecording(false); // 실패 시 녹음 UI 원복
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        toast.error('마이크 권한이 거부되었습니다');
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        toast.error('마이크를 찾을 수 없습니다');
      } else if (err?.name === 'NotReadableError') {
        toast.error('마이크가 다른 앱에서 사용 중입니다');
      } else {
        toast.error(`녹음 시작 실패: ${err?.message || '알 수 없는 오류'}`);
      }
    }
  };

  const stopRecording = (cancel: boolean = false) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (cancel) {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = () => {
          mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
        };
      }
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingTime(0);
  };

  // page.tsx Mic·취소·전송 버튼이 startRecording/stopRecording을 직접 호출할 수 있도록 등록
  // (lazy load로 인해 isRecording prop이 이미 true인 채 마운트될 수 있어 useEffect 감시 방식 사용 불가)
  useEffect(() => {
    onRegisterRecording?.({ start: startRecording, stop: stopRecording });
  }, []);

  const togglePlayVoice = (msgId: string, url: string) => {
    if (playingVoice && playingVoice !== msgId) {
      const prevAudio = audioRefs.current[playingVoice];
      if (prevAudio) {
        prevAudio.pause();
        prevAudio.currentTime = 0;
      }
    }

    let audio = audioRefs.current[msgId];
    if (!audio) {
      audio = new Audio(url);
      audioRefs.current[msgId] = audio;
      audio.ontimeupdate = () => {
        if (audio.duration && isFinite(audio.duration)) {
          setVoicePlayProgress((p) => ({ ...p, [msgId]: audio.currentTime / audio.duration }));
        }
      };
      audio.onended = () => {
        setPlayingVoice(null);
        setVoicePlayProgress((p) => ({ ...p, [msgId]: 0 }));
        audio.currentTime = 0;
      };
    }

    if (playingVoice === msgId) {
      audio.pause();
      setPlayingVoice(null);
    } else {
      audio.play().catch((e) => {
        toast.error('재생할 수 없습니다');
        console.error(e);
      });
      setPlayingVoice(msgId);
    }
  };

  const handleImageSend = async (file: File) => {
    setShowAttach(false);
    // iOS WebView 는 동영상의 file.type 이 비는 경우가 있어 확장자도 함께 검사
    const nameLc = (file.name || '').toLowerCase();
    const isVideo = (file.type || '').startsWith('video') || /\.(mp4|mov|m4v|webm|avi|mkv|3gp|qt)$/i.test(nameLc);
    const msgType = isVideo ? 'video' : 'image';
    const label = isVideo ? '동영상' : '이미지';
    // 용량 가드 (base64 업로드라 너무 크면 서버 본문 한도 초과) — 30MB 초과 차단
    if (file.size > 30 * 1024 * 1024) {
      toast.error(`${label}은 30MB 이하만 전송할 수 있습니다`);
      return;
    }
    // 방이 아직 준비 전(pending-)이면 낙관적 메시지를 넣기 전에 차단 — 안 그러면 멈춘 0% 버블이 남음
    const roomId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : '';
    if (!roomId || roomId.startsWith('pending-')) {
      toast.error('채팅방을 준비 중입니다. 잠시 후 다시 시도해주세요');
      return;
    }
    const tempId = `tmp-${Date.now()}-${Math.round(file.size % 100000)}`;
    const localUrl = URL.createObjectURL(file);
    // 낙관적 UI: 로컬 미리보기 + 업로드 진행률(원형) 표시
    setMessages((prev) => [...prev, {
      id: tempId,
      senderId: MY_ID,
      content: localUrl,
      type: msgType,
      createdAt: new Date().toISOString(),
      isRead: false,
      isNew: true,
      uploadProgress: 0,
      uploadBytesTotal: file.size,
    }]);

    try {
      const readDataUrl = (f: File) => new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      const withForcedMime = (url: string, mime: string) => {
        if (new RegExp(`^data:${mime.split('/')[0]}\\/`, 'i').test(url)) return url;
        const i = url.indexOf(',');
        return `data:${mime};base64,${i >= 0 ? url.slice(i + 1) : url}`;
      };
      // 이미지는 캔버스로 JPEG 재인코딩 → 아이폰 HEIC/빈-mime/대용량 문제 해결(+업로드 용량 축소).
      // 동영상은 원본 그대로(빈 mime 면 video/mp4 로 보정).
      let dataUrl: string;
      if (isVideo) {
        dataUrl = withForcedMime(await readDataUrl(file), file.type?.startsWith('video') ? file.type : 'video/mp4');
      } else {
        // 캔버스 디코드는 img.decode() 가 WKWebView 에서 무한 대기하는 사례가 있어
        // onload/onerror + 4초 타임아웃으로 절대 멈추지 않게 하고, 실패 시 원본 전송으로 폴백.
        const fallback = async () => withForcedMime(await readDataUrl(file), 'image/jpeg');
        dataUrl = await (async () => {
          const objUrl = URL.createObjectURL(file);
          try {
            const img = document.createElement('img');
            const ok = await new Promise<boolean>((resolve) => {
              let done = false;
              const finish = (v: boolean) => { if (!done) { done = true; resolve(v); } };
              img.onload = () => finish(true);
              img.onerror = () => finish(false);
              setTimeout(() => finish(false), 4000);
              img.src = objUrl;
            });
            if (!ok || !img.naturalWidth || !img.naturalHeight) return await fallback();
            let w = img.naturalWidth, h = img.naturalHeight;
            const maxDim = 1600;
            if (Math.max(w, h) > maxDim) { const s = maxDim / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) return await fallback();
            ctx.drawImage(img, 0, 0, w, h);
            const out = canvas.toDataURL('image/jpeg', 0.9);
            return out.startsWith('data:image/') ? out : await fallback();
          } catch {
            return await fallback();
          } finally {
            try { URL.revokeObjectURL(objUrl); } catch {}
          }
        })();
      }
      // 서버에 전송(업로드 진행률 추적) → 서버가 DB 저장 후 공개 URL 로 content 대체
      const resp = await chatApi.sendMessage(roomId, { type: msgType, content: dataUrl }, {
        onUploadProgress: (e) => {
          if (!e.total) return;
          const pct = Math.min(99, Math.round((e.loaded / e.total) * 100));
          setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, uploadProgress: pct } : m));
        },
      });
      const saved = resp.data as any;
      // 임시 메시지를 서버 응답으로 교체 (실시간 echo 가 먼저 들어왔으면 임시본만 제거)
      setMessages((prev) => {
        if (prev.some((m) => m.id === saved.id)) return prev.filter((m) => m.id !== tempId);
        return prev.map((m) => m.id === tempId ? {
          ...m,
          id: saved.id,
          content: saved.content || localUrl,
          type: (saved.type as Message['type']) || msgType,
          isNew: false,
          uploadProgress: undefined,
          uploadBytesTotal: undefined,
        } : m);
      });
      try { URL.revokeObjectURL(localUrl); } catch {}
      // WS 끊겼을 때를 대비해 방 목록(최근메시지/정렬) 갱신 — 텍스트 전송의 REST 폴백과 동등
      useChatStore.getState().fetchRooms({ limit: 50, force: true }).catch(() => {});
    } catch (e: any) {
      toast.error(`${label} 전송 실패: ${e?.response?.data?.message || e?.message || ''}`);
      // 실패한 임시 메시지 제거
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      try { URL.revokeObjectURL(localUrl); } catch {}
    }
  };

  const handleFileSend = async (file: File) => {
    setShowAttach(false);
    if (file.size > 30 * 1024 * 1024) {
      toast.error('파일은 30MB 이하만 전송할 수 있습니다');
      return;
    }
    // 방이 아직 준비 전(pending-)이면 낙관적 메시지를 넣기 전에 차단
    const roomId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : '';
    if (!roomId || roomId.startsWith('pending-')) {
      toast.error('채팅방을 준비 중입니다. 잠시 후 다시 시도해주세요');
      return;
    }
    const tempId = `tmp-${Date.now()}-${Math.round(file.size % 100000)}`;
    // 낙관적 UI: 파일칩 + 업로드 진행률
    setMessages((prev) => [...prev, {
      id: tempId,
      senderId: MY_ID,
      content: file.name,
      type: 'file',
      createdAt: new Date().toISOString(),
      isRead: false,
      fileName: file.name,
      isNew: true,
      uploadProgress: 0,
      uploadBytesTotal: file.size,
    }]);
    try {
      // file → base64 data URL (서버가 DB 저장 후 공개 URL 반환)
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const resp = await chatApi.sendMessage(roomId, {
        type: 'file',
        content: dataUrl,
        metadata: { fileName: file.name, fileSize: file.size, mimeType: file.type },
      }, {
        onUploadProgress: (e) => {
          if (!e.total) return;
          const pct = Math.min(99, Math.round((e.loaded / e.total) * 100));
          setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, uploadProgress: pct } : m));
        },
      });
      const saved = resp.data as any;
      setMessages((prev) => {
        if (prev.some((m) => m.id === saved.id)) return prev.filter((m) => m.id !== tempId);
        return prev.map((m) => m.id === tempId ? {
          ...m,
          id: saved.id,
          content: saved.content || file.name,
          isNew: false,
          uploadProgress: undefined,
          uploadBytesTotal: undefined,
        } : m);
      });
      useChatStore.getState().fetchRooms({ limit: 50, force: true }).catch(() => {});
      toast.success(`${file.name} 전송 완료`);
    } catch (e: any) {
      toast.error(`파일 전송 실패: ${e?.response?.data?.message || e?.message || ''}`);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  const sendLocationMessage = async (lat: number, lng: number) => {
    const saved = await useChatStore.getState().sendMessage({
      type: 'location',
      content: '내 위치를 공유했습니다',
      metadata: { latitude: lat, longitude: lng },
    }).catch(() => null);
    if (saved) {
      setMessages((prev) => prev.some((m) => m.id === saved.id) ? prev : [...prev, {
        id: saved.id,
        senderId: saved.senderId,
        content: saved.content || '내 위치를 공유했습니다',
        type: 'location',
        createdAt: saved.createdAt,
        isRead: saved.isRead,
        isNew: true,
        latitude: lat,
        longitude: lng,
      }]);
      toast.success('위치 전송 완료');
    } else {
      toast.error('위치 전송 실패');
    }
  };

  const handleLocationSend = () => {
    setShowAttach(false);
    if (!('geolocation' in navigator)) {
      setShowLocationPicker(true);
      return;
    }
    const loadingToast = toast.loading('위치 가져오는 중...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.dismiss(loadingToast);
        const { latitude, longitude } = pos.coords;
        sendLocationMessage(latitude, longitude);
      },
      (err) => {
        toast.dismiss(loadingToast);
        if (err.code === err.PERMISSION_DENIED) {
          toast('지도에서 위치를 선택해주세요', { icon: '📍' });
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          toast('지도에서 위치를 선택해주세요', { icon: '📍' });
        } else if (err.code === err.TIMEOUT) {
          toast('지도에서 위치를 선택해주세요', { icon: '📍' });
        }
        setShowLocationPicker(true);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  // ─── iOS 네이티브 글래스 메뉴(+/•••)용 액션 노출 ───
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    const attachItems = [
      ...(isPro ? [{ id: 'quote', label: '견적서 발송', sf: 'doc.text.fill', tint: 'blue' }] : []),
      { id: 'camera', label: '카메라', sf: 'camera.fill' },
      { id: 'photo', label: '사진', sf: 'photo.fill' },
      { id: 'emoji', label: '이모티콘', sf: 'face.smiling' },
      { id: 'file', label: '파일', sf: 'doc.fill' },
      { id: 'audio', label: '오디오', sf: 'music.note' },
    ];
    const menuItems = [
      { id: 'search', label: '대화 내용 검색', sf: 'magnifyingglass' },
      { id: 'mute', label: muted ? '알림 켜기' : '알림 끄기', sf: muted ? 'bell.fill' : 'bell.slash.fill' },
      { id: 'profile', label: isPro ? '고객 정보 보기' : '프로필 보기', sf: 'person.crop.circle' },
      { id: 'delete', label: '대화 삭제', sf: 'trash', destructive: true },
    ];
    const invokeAttach = (id: string) => {
      switch (id) {
        case 'quote': setShowAttach(false); setShowQuoteModal(true); break;
        case 'camera': cameraInputRef.current?.click(); break;
        case 'photo': fileInputRef.current?.click(); break;
        case 'emoji': toast('곧 제공될 예정입니다', { icon: '😊' }); break;
        case 'file': {
          const inp = document.createElement('input');
          inp.type = 'file';
          inp.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFileSend(f); };
          inp.click();
          break;
        }
        case 'location': handleLocationSend(); break;
        case 'audio': toast('곧 제공될 예정입니다', { icon: '🎵' }); break;
      }
    };
    const invokeMenu = (id: string) => {
      switch (id) {
        case 'search': toast('곧 제공될 예정입니다', { icon: '🔍' }); break;
        case 'mute': setMuted(!muted); toast(muted ? '알림 켜짐' : '알림 꺼짐'); break;
        case 'profile':
          if (isPro) {
            toast(`${chatPartner?.name || '고객'} 정보는 대화 상단 카드에서 확인할 수 있습니다`);
          } else if (chatPartner) {
            window.location.href = `/pros/${chatPartner.proProfileId || chatPartner.id || ''}`;
          }
          break;
        case 'delete': {
          // 실제 방 삭제 (확인은 네이티브에서) → 목록 갱신 + 뒤로가기
          const rid = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : '';
          setMessages([]);
          if (rid && !rid.startsWith('pending-')) {
            useChatStore.getState().deleteRoom(rid)
              .then(() => {
                toast.success('대화가 삭제되었습니다');
                window.dispatchEvent(new Event('freetiful:chat-rooms-changed'));
                (window as any).__freetifulChat?.back?.();
              })
              .catch(() => toast.error('대화 삭제에 실패했습니다'));
          }
          break;
        }
      }
    };
    w.__freetifulChatActions = {
      attachItems, menuItems, invokeAttach, invokeMenu,
      sendLocation: (lat: number, lng: number) => sendLocationMessage(Number(lat), Number(lng)),
      getQuoteDefaults: () => computeQuoteDefaults(),
      // 네이티브 ⋮ → '고객 정보 보기' 모달용 — 견적서 폼과 독립적으로 고객 요청 정보 제공
      getRequestInfo: () => {
        const mr: any = roomMeta?.matchRequest;
        const lq: any = roomMeta?.latestQuotation;
        if (!mr && !lq) return null;
        const raw: any = mr?.rawUserInput && typeof mr.rawUserInput === 'object' ? mr.rawUserInput : {};
        const toTime = (v: any): string => { if (!v) return ''; if (typeof v === 'string' && /^\d{1,2}:\d{2}/.test(v)) return v.slice(0, 5); try { const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; } catch { return ''; } };
        const toDate = (v: any): string => { if (!v) return ''; try { const d = new Date(v); return Number.isNaN(d.getTime()) ? (typeof v === 'string' ? v.slice(0, 10) : '') : d.toISOString().slice(0, 10); } catch { return ''; } };
        return {
          customerName: chatPartner?.name || '고객',
          customerImage: chatPartner?.profileImageUrl || '',
          eventName: lq?.title || raw.eventName || mr?.eventCategory?.name || '',
          eventDate: toDate(mr?.eventDate || lq?.eventDate || raw.date),
          eventTime: toTime(mr?.eventTime || lq?.eventTime || raw.timeStart),
          eventLocation: mr?.eventLocation || lq?.eventLocation || raw.location || '',
          planLabel: raw.planLabel || (raw.planKey === 'wedding_part12' ? '1부+2부' : raw.planKey === 'wedding_part1' ? '1부' : ''),
          categoryName: mr?.category?.name || mr?.eventCategory?.name || raw.categoryName || '',
          memo: raw.memo || raw.note || '',
          latestAmount: lq?.amount != null ? Number(lq.amount) : 0,
        };
      },
      submitQuote: (data: any) => {
        try {
          flushSync(() => {
            if (data) {
              setQuoteCustomAmount(String(data.customAmount || ''));
              setQuoteEventName(String(data.eventName || ''));
              setQuoteEventDate(String(data.eventDate || ''));
              setQuoteEventTime(String(data.eventTime || ''));
              setQuoteEventLocation(String(data.eventLocation || ''));
            }
          });
        } catch (e) {}
        // 상태가 동기 반영된 직후 발송 (타이밍 레이스 제거)
        if (handleSendQuoteRef.current) handleSendQuoteRef.current();
      },
    };
    window.dispatchEvent(new Event('freetiful:chat-state'));
    return () => { try { if (w.__freetifulChatActions) delete w.__freetifulChatActions; } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro, muted, chatPartner, roomMeta, planTemplates]);

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('복사됨');
    setActionMenu(null);
  };

  const handleReply = (msg: Message) => {
    setReplyTo({ id: msg.id, name: msg.senderId === MY_ID ? '나' : (chatPartner?.name || '상대방'), content: msg.content });
    setActionMenu(null);
    inputRef.current?.focus();
  };

  const handleDelete = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setActionMenu(null);
  };

  const handleReport = (msg: Message) => {
    setActionMenu(null);
    if (confirm('이 메시지를 신고하시겠습니까?')) {
      toast.success('신고가 접수되었습니다');
    }
  };

  const handlePin = (msg: Message) => {
    if (msg.type !== 'text') {
      toast.error('텍스트 메시지만 공지로 등록할 수 있습니다');
      setActionMenu(null);
      return;
    }
    setPinnedMessage({
      id: msg.id,
      name: msg.senderId === MY_ID ? '나' : (chatPartner?.name || '상대방'),
      content: msg.content,
    });
    setActionMenu(null);
    toast.success('공지로 등록되었습니다');
  };

  const handlePartialCopy = (msg: Message) => {
    if (msg.type !== 'text') {
      toast.error('텍스트 메시지만 부분복사할 수 있습니다');
      setActionMenu(null);
      return;
    }
    setPartialCopyMsg(msg);
    setActionMenu(null);
  };

  const handleReaction = (msgId: string, emoji: string) => {
    setMessages((prev) => prev.map((m) =>
      m.id === msgId ? { ...m, reaction: m.reaction === emoji ? null : emoji } : m
    ));
    setActionMenu(null);
  };

  const scrollToMessage = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('animate-[replyHighlight_1.2s_ease-out]');
      setTimeout(() => el.classList.remove('animate-[replyHighlight_1.2s_ease-out]'), 1200);
    }
  };

  const handleSendQuote = async () => {
    if (quoteSending) return;
    const plan = PLAN_DATA[quotePlan];
    if (!plan) { toast.error('플랜 정보를 불러오는 중입니다'); return; }
    if (!chatPartner?.id) {
      toast.error('상대방 정보를 찾을 수 없습니다');
      return;
    }
    setQuoteSending(true);
    // 옵션 총액 + 전체 합계
    const optionsTotal = quoteOptions.reduce((s, o) => s + (Number(o.price) || 0), 0);
    const baseAmount = quoteCustomAmount.trim()
      ? Math.max(0, parseInt(quoteCustomAmount.replace(/[^\d]/g, ''), 10) || 0)
      : plan.price;
    const totalAmount = baseAmount + optionsTotal;
    try {
      const roomId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : '';
      // 1) 백엔드에 실제 Quotation 생성
      const created = await quotationApi.create({
        userId: chatPartner.id,
        amount: totalAmount,
        title: quoteEventName || '행사 진행',
        description: [
          quoteMemo,
          quoteOptions.length > 0
            ? `\n[추가 옵션]\n${quoteOptions.map((o) => `- ${o.name}: +${o.price.toLocaleString()}원`).join('\n')}`
            : '',
        ].filter(Boolean).join(''),
        eventDate: quoteEventDate || undefined,
        eventTime: quoteEventTime || undefined,
        eventLocation: quoteEventLocation || undefined,
        chatRoomId: roomId && !roomId.startsWith('pending-') ? roomId : undefined,
      } as any);
      const quotationId = (created as any)?.id;

      // 2) 견적 카드 system payload 구성
      const myProImage = useAuthStore.getState().user?.profileImageUrl || null;
      const quoteSystem = {
        kind: 'quote' as const,
        plan: quotePlan,
        eventName: quoteEventName || '행사 진행',
        amount: totalAmount,
        basePrice: baseAmount,
        options: quoteOptions,
        eventDate: quoteEventDate,
        eventTime: quoteEventTime,
        eventLocation: quoteEventLocation,
        items: plan.items,
        quotationId,
        proImage: myProImage,
      };

      // 3) 로컬 UI 즉시 반영(낙관적 카드) — quotationId 기준 dedup 으로 실제 카드와 자동 병합
      const quoteMsg: Message = {
        id: `opt-quote-${Date.now()}`,
        senderId: MY_ID,
        content: '견적서 발송',
        type: 'system',
        createdAt: new Date().toISOString(),
        isRead: false,
        system: quoteSystem as any,
      };
      setMessages(prev => [...prev, quoteMsg]);

      // 4) 모달 닫기 + 성공 표시 — 카드 전송 응답을 기다리지 않아 체감 지연(약 30초) 제거.
      //    Quotation 은 이미 생성됐고, 카드 전송은 백그라운드에서 처리한다.
      setShowQuoteModal(false);
      setQuoteEventName('');
      setQuoteEventDate('');
      setQuoteEventTime('');
      setQuoteEventLocation('');
      setQuoteMemo('');
      setQuoteCustomAmount('');
      setQuoteOptions([]);
      setNewOptName('');
      setNewOptPrice('');
      toast.success('견적서가 발송되었습니다');

      // 5) 채팅방 견적 카드 전송 — 백그라운드(fire-and-forget). 실패해도 견적은 유지됨.
      if (roomId && !roomId.startsWith('pending-')) {
        const quoteMessagePayload = {
          type: 'system' as any,
          content: `💰 견적서 발송: ${totalAmount.toLocaleString()}원`,
          metadata: { system: quoteSystem },
        };
        void useChatStore.getState().sendMessage(quoteMessagePayload)
          .catch(() => chatApi.sendMessage(roomId, quoteMessagePayload as any).then((r) => r?.data).catch(() => null));
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '발송 실패';
      toast.error(`견적서 발송 실패: ${msg}`);
    } finally {
      setQuoteSending(false);
    }
  };

  // 네이티브 견적 폼(UIKit 글래스) 연동 — 검증된 웹 발송 로직 재사용
  const handleSendQuoteRef = useRef(handleSendQuote);
  handleSendQuoteRef.current = handleSendQuote;
  const computeQuoteDefaults = () => {
    const mr = roomMeta?.matchRequest;
    const lq = roomMeta?.latestQuotation;
    const raw: any = mr?.rawUserInput && typeof mr.rawUserInput === 'object' ? mr.rawUserInput : {};
    const toDate = (v: any): string => { if (!v) return ''; try { const d = new Date(v); return Number.isNaN(d.getTime()) ? (typeof v === 'string' ? v.slice(0, 10) : '') : d.toISOString().slice(0, 10); } catch { return ''; } };
    const toTime = (v: any): string => { if (!v) return ''; if (typeof v === 'string' && /^\d{1,2}:\d{2}/.test(v)) return v.slice(0, 5); try { const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; } catch { return ''; } };
    const plan = PLAN_DATA[quotePlan] || Object.values(PLAN_DATA)[0];
    return {
      // 행사명 기본값: '{고객명}님의 행사' (네이티브 견적폼도 이 값을 사용)
      eventName: (chatPartner?.name ? `${chatPartner.name}님의 행사` : '') || lq?.title || raw.eventName || mr?.eventCategory?.name || '',
      eventDate: toDate(mr?.eventDate || lq?.eventDate || raw.date),
      eventTime: toTime(mr?.eventTime || lq?.eventTime || raw.timeStart),
      eventLocation: mr?.eventLocation || lq?.eventLocation || raw.location || '',
      planLabel: (plan as any)?.label || '',
      planPrice: (plan as any)?.price || 0,
    };
  };

  const ATTACH_ITEMS = [
    // 견적서 발송을 최상단으로 (프로에게 가장 중요한 액션)
    ...(isPro ? [{ icon: <FileText size={24} className="text-white" />, bg: 'bg-[#3180F7]', label: '견적서 발송', action: () => { setShowAttach(false); setShowQuoteModal(true); } }] : []),
    { icon: <Camera size={24} className="text-white" />, bg: 'bg-slate-700', label: '카메라', action: () => cameraInputRef.current?.click() },
    { icon: <ImageIcon size={24} className="text-white" />, bg: 'bg-slate-700', label: '사진', action: () => fileInputRef.current?.click() },
    { icon: <Smile size={24} className="text-white" />, bg: 'bg-slate-700', label: '이모티콘', action: () => { setShowAttach(false); toast('곧 제공될 예정입니다', { icon: '😊' }); } },
    { icon: <FileText size={24} className="text-white" />, bg: 'bg-slate-700', label: '파일', action: () => { const inp = document.createElement('input'); inp.type = 'file'; inp.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFileSend(f); }; inp.click(); } },
    { icon: <Music size={24} className="text-white" />, bg: 'bg-slate-700', label: '오디오', action: () => { setShowAttach(false); toast('곧 제공될 예정입니다', { icon: '🎵' }); } },
  ];

  const mentionList = chatPartner
    ? [{ id: chatPartner.id, name: chatPartner.name, username: chatPartner.name }]
    : [];

  const filteredMentions = mentionQuery !== null
    ? mentionList.filter((m) =>
        m.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        m.username.toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : [];

  return (
    <>
      {/* ─── 헤더 드롭다운 메뉴 ─── */}
      {showHeaderMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowHeaderMenu(false)} />
          <div className="absolute right-3 top-[68px] z-50 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/60 overflow-hidden min-w-[180px] animate-[scaleIn_0.2s_ease-out]" style={{ right: '12px', top: '68px' }}>
            <button onClick={() => { toast('곧 제공될 예정입니다', { icon: '🔍' }); setShowHeaderMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-gray-800 hover:bg-gray-50 w-full">
              <Search size={16} className="text-gray-500" /> 대화 내용 검색
            </button>
            <button onClick={() => { setMuted(!muted); toast(muted ? '알림 켜짐' : '알림 꺼짐'); setShowHeaderMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-gray-800 hover:bg-gray-50 w-full border-t border-gray-100">
              {muted ? <Bell size={16} className="text-gray-500" /> : <BellOff size={16} className="text-gray-500" />}
              {muted ? '알림 켜기' : '알림 끄기'}
            </button>
            {isPro ? (
              <button
                onClick={() => {
                  setShowHeaderMenu(false);
                  toast(`${chatPartner?.name || '고객'} 정보는 대화 상단 카드에서 확인할 수 있습니다`);
                }}
                className="flex items-center gap-3 px-4 py-3 text-[14px] text-gray-800 hover:bg-gray-50 w-full border-t border-gray-100"
              >
                <Smile size={16} className="text-gray-500" /> 고객 정보 보기
              </button>
            ) : (
              <Link href={`/pros/${chatPartner?.proProfileId || chatPartner?.id || ''}`} className="flex items-center gap-3 px-4 py-3 text-[14px] text-gray-800 hover:bg-gray-50 w-full border-t border-gray-100">
                <Smile size={16} className="text-gray-500" /> 프로필 보기
              </Link>
            )}
            <button onClick={() => { if (confirm('대화 내용을 삭제하시겠습니까?')) { setMessages([]); toast.success('대화 삭제됨'); } setShowHeaderMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-red-500 hover:bg-red-50 w-full border-t border-gray-100">
              <Trash2 size={16} /> 대화 삭제
            </button>
          </div>
        </>
      )}

      {/* ─── 공지 바 ─── */}
      {pinnedMessage && (
        <button
          onClick={() => scrollToMessage(pinnedMessage.id)}
          className="fixed left-0 right-0 top-[72px] z-30 flex items-center gap-3 px-4 py-2.5 bg-amber-50/90 backdrop-blur border-b border-amber-100 active:bg-amber-100 transition-colors animate-[slideUp_0.3s_ease]"
        >
          <Pin size={16} className="text-amber-600 shrink-0 rotate-45" />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[11px] font-bold text-amber-700">공지 · {pinnedMessage.name}</p>
            <p className="text-[12px] text-amber-900/80 truncate">{pinnedMessage.content}</p>
          </div>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); setPinnedMessage(null); toast('공지 해제됨', { icon: '📌' }); }}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-amber-100 cursor-pointer"
          >
            <PinOff size={14} className="text-amber-600" />
          </span>
        </button>
      )}

      {/* ─── 액션 메뉴 (롱프레스) ─── */}
      {actionMenu && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] animate-[fadeIn_0.2s_ease]" onClick={() => setActionMenu(null)} />
          <div
            className="fixed z-50 animate-[menuPop_0.3s_cubic-bezier(0.34,1.56,0.64,1)]"
            style={{
              left: actionMenu.mine ? undefined : Math.max(12, actionMenu.x),
              right: actionMenu.mine ? Math.max(12, window.innerWidth - actionMenu.x) : undefined,
              top: Math.max(80, actionMenu.y - 110),
              transformOrigin: actionMenu.mine ? 'right bottom' : 'left bottom',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white/95 backdrop-blur-xl rounded-full shadow-xl border border-gray-200/60 px-2 py-1.5 mb-2 flex items-center gap-1">
              {REACTIONS.map((r, idx) => (
                <button
                  key={r}
                  onClick={() => handleReaction(actionMenu.id, r)}
                  className="text-[24px] w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 active:scale-125 transition-transform"
                  style={{ animation: `reactionFade 0.3s ease ${idx * 0.04}s both` }}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/60 overflow-hidden min-w-[200px]">
              <button
                onClick={() => {
                  const msg = messages.find((m) => m.id === actionMenu.id);
                  if (msg) handleReply(msg);
                }}
                className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] text-gray-800 hover:bg-gray-50 w-full"
              >
                답장 <Reply size={18} className="text-gray-500" />
              </button>
              <button
                onClick={() => {
                  const msg = messages.find((m) => m.id === actionMenu.id);
                  if (msg) handleCopy(msg.content);
                }}
                className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] text-gray-800 hover:bg-gray-50 w-full border-t border-gray-100"
              >
                복사 <Copy size={18} className="text-gray-500" />
              </button>
              <button
                onClick={() => {
                  const msg = messages.find((m) => m.id === actionMenu.id);
                  if (msg) handlePartialCopy(msg);
                }}
                className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] text-gray-800 hover:bg-gray-50 w-full border-t border-gray-100"
              >
                부분복사 <TextSelect size={18} className="text-gray-500" />
              </button>
              <button
                onClick={() => {
                  const msg = messages.find((m) => m.id === actionMenu.id);
                  if (msg) handlePin(msg);
                }}
                className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] text-gray-800 hover:bg-gray-50 w-full border-t border-gray-100"
              >
                공지로 등록 <Pin size={18} className="text-gray-500" />
              </button>
              <button
                onClick={() => {
                  const msg = messages.find((m) => m.id === actionMenu.id);
                  if (msg) handleReport(msg);
                }}
                className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] text-orange-500 hover:bg-orange-50 w-full border-t border-gray-100"
              >
                신고하기 <Flag size={18} />
              </button>
              {actionMenu.mine && (
                <button
                  onClick={() => handleDelete(actionMenu.id)}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] text-red-500 hover:bg-red-50 w-full border-t border-gray-100"
                >
                  삭제 <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ─── 답장 프리뷰 ─── */}
      {replyTo && (
        <div className="fixed left-0 right-0 bottom-[72px] z-30 px-4 py-2.5 bg-white/90 backdrop-blur border-t border-gray-200/40 flex items-center justify-between animate-[slideUp_0.2s_ease]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-1 h-9 rounded-full bg-[#007AFF] shrink-0" />
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-[#007AFF]">{replyTo.name}에게 답장</p>
              <p className="text-[12px] text-gray-400 truncate">{replyTo.content}</p>
            </div>
          </div>
          <button onClick={() => setReplyTo(null)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100">
            <X size={16} className="text-gray-400" />
          </button>
        </div>
      )}

      {/* ─── 멘션 자동완성 ─── */}
      {mentionQuery !== null && filteredMentions.length > 0 && (
        <div className="fixed left-0 right-0 bottom-[72px] z-30 px-4 pb-2 bg-white/95 backdrop-blur border-t border-gray-200/40 animate-[slideUp_0.2s_ease]">
          <p className="text-[10px] font-bold tracking-wider text-gray-400 pt-2 pb-1">멘션</p>
          <div className="space-y-1">
            {filteredMentions.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  if (mentionQuery === null) return;
                  const cursorPos = inputRef.current?.selectionStart || 0;
                  const textBefore = (inputRef.current?.value || '').slice(0, cursorPos);
                  const textAfter = (inputRef.current?.value || '').slice(cursorPos);
                  const newTextBefore = textBefore.replace(/@([\w가-힣]*)$/, `@${m.name} `);
                  // We need to set the input value via a native input event or parent callback
                  // For simplicity, dispatch an event
                  if (inputRef.current) {
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                    nativeInputValueSetter?.call(inputRef.current, newTextBefore + textAfter);
                    inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
                  }
                  setMentionQuery(null);
                  setTimeout(() => {
                    inputRef.current?.focus();
                  }, 0);
                }}
                className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-gray-100 active:scale-[0.98] transition-all"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[13px] font-bold shrink-0">
                  {m.name.charAt(0)}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-[14px] font-semibold text-gray-900 truncate">{m.name}</p>
                  <p className="text-[11px] text-gray-400 truncate">@{m.username}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── 견적서 작성 모달 (사회자 전용) ─── */}
      {showQuoteModal && (
        <div className="fixed inset-0 z-[100] flex items-end bg-black/40" onClick={() => setShowQuoteModal(false)}>
          <div className="bg-white w-full rounded-t-3xl px-5 pt-5 pb-8 max-h-[85vh] overflow-y-auto" onClick={(e) => { e.stopPropagation(); const t = e.target as HTMLElement; if (!t.closest('input,textarea,select,button,a')) (document.activeElement as HTMLElement | null)?.blur(); }} style={{ animation: 'sheetUp 0.3s ease' }}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <h2 className="text-[18px] font-bold text-gray-900 mb-4">견적서 작성</h2>

            {/* 네이티브 견적서 폼과 동일한 인풋/내용 (네이티브가 기준) */}
            <p className="text-[12px] font-bold text-gray-500 mb-1.5">견적 금액</p>
            <input
              type="text"
              inputMode="numeric"
              value={quoteCustomAmount}
              onChange={(e) => setQuoteCustomAmount(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="직접 입력 시 선택 플랜 금액 대신 적용"
              className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl px-4 text-[16px] outline-none focus:border-[#3180F7] mb-4"
            />

            {/* ─── 행사 정보 ─── */}
            <p className="text-[12px] font-bold text-gray-500 mb-1.5">행사 정보</p>
            <div className="space-y-2 mb-4">
              <input
                type="text"
                value={quoteEventName}
                onChange={(e) => setQuoteEventName(e.target.value)}
                placeholder="행사명 (예: 김철수·이영희 결혼식)"
                className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl px-4 text-[16px] outline-none focus:border-[#3180F7]"
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <p className="text-[12px] font-bold text-gray-500 mb-1">행사일</p>
                  <input
                    type="date"
                    value={quoteEventDate}
                    onChange={(e) => setQuoteEventDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl px-4 text-[16px] outline-none focus:border-[#3180F7] text-gray-700"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-[12px] font-bold text-gray-500 mb-1">시간</p>
                  <input
                    type="time"
                    value={quoteEventTime}
                    onChange={(e) => setQuoteEventTime(e.target.value)}
                    className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl px-4 text-[16px] outline-none focus:border-[#3180F7] text-gray-700"
                  />
                </div>
              </div>
              <input
                type="text"
                value={quoteEventLocation}
                onChange={(e) => setQuoteEventLocation(e.target.value)}
                placeholder="행사 장소 (예: 그랜드 워커힐 서울)"
                className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl px-4 text-[16px] outline-none focus:border-[#3180F7]"
              />
            </div>

            {/* 총 견적 (네이티브와 동일: '총 견적 · {플랜}' + 총액) */}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 mb-4">
              <span className="text-[12px] font-bold text-gray-500">
                {selectedPlan?.label ? `총 견적 · ${selectedPlan.label}` : '총 견적'}
              </span>
              <p className="text-[18px] font-bold text-[#3180F7]">
                {quoteTotalAmount.toLocaleString()}원
              </p>
            </div>

            <button
              onClick={handleSendQuote}
              disabled={quoteSending}
              className="w-full h-13 py-4 rounded-xl font-bold text-[16px] bg-[#3180F7] text-white active:scale-[0.98] transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {quoteSending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  견적서 발송 중...
                </>
              ) : (
                '견적서 발송'
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─── 첨부 메뉴 ─── */}
      {showAttach && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/10 animate-[fadeIn_0.25s_ease]"
            style={{ backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
            onClick={() => setShowAttach(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-2xl rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] pb-safe"
            style={{ animation: 'sheetUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mt-3 mb-4" />
            <div className="px-4 pb-6 max-h-[75vh] overflow-y-auto">
              {ATTACH_ITEMS.map((item, idx) => (
                <button
                  key={item.label}
                  onClick={(e) => { e.stopPropagation(); item.action(); setShowAttach(false); }}
                  className="flex items-center gap-4 w-full py-3.5 px-2 hover:bg-gray-100/60 active:scale-[0.98] rounded-xl transition-all"
                  style={{
                    animation: `attachItemUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.05}s both`,
                  }}
                >
                  <div className={`w-11 h-11 rounded-full ${item.bg} flex items-center justify-center shrink-0`}>
                    {item.icon}
                  </div>
                  <span className="text-[17px] text-gray-900">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ─── 이미지 프리뷰 ─── */}
      {imagePreview && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setImagePreview(null)}>
          <button onClick={() => setImagePreview(null)} className="absolute top-4 right-4 text-white"><X size={28} /></button>
          <img src={imagePreview} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}

      {/* ─── 위치 선택 모달 ─── */}
      {showLocationPicker && (
        <NaverMapPicker
          onSelect={(lat, lng) => sendLocationMessage(lat, lng)}
          onClose={() => setShowLocationPicker(false)}
        />
      )}

      {/* ─── 부분복사 모달 ─── */}
      {partialCopyMsg && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-[fadeIn_0.2s_ease]" onClick={() => setPartialCopyMsg(null)}>
          <div
            className="w-full max-w-[480px] bg-white rounded-3xl shadow-2xl overflow-hidden animate-[menuPop_0.3s_cubic-bezier(0.34,1.56,0.64,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold tracking-wider text-gray-400">PARTIAL COPY</p>
                <h3 className="text-[18px] font-black text-gray-900 mt-0.5">부분복사</h3>
              </div>
              <button onClick={() => setPartialCopyMsg(null)} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center active:scale-90 transition-transform">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <p className="px-5 text-[12px] text-gray-400 mb-2">텍스트를 드래그하여 복사할 부분을 선택하세요</p>
            <div className="px-5 pb-3">
              <p
                className="text-[15px] leading-[1.7] text-gray-900 whitespace-pre-wrap bg-gray-50 rounded-2xl p-4 max-h-[40vh] overflow-y-auto select-text border border-gray-100"
                style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
              >
                {partialCopyMsg.content}
              </p>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={() => {
                  const sel = window.getSelection?.()?.toString() || '';
                  if (!sel.trim()) {
                    toast.error('선택된 텍스트가 없습니다');
                    return;
                  }
                  navigator.clipboard.writeText(sel);
                  toast.success(`${sel.length}자 복사됨`);
                  setPartialCopyMsg(null);
                }}
                className="flex-1 h-12 bg-[#007AFF] hover:bg-[#0066d9] text-white text-[15px] font-bold rounded-2xl active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              >
                <Copy size={16} />
                선택한 부분 복사
              </button>
              <button
                onClick={() => setPartialCopyMsg(null)}
                className="px-5 h-12 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[15px] font-medium rounded-2xl active:scale-[0.98] transition-transform"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 숨겨진 파일 인풋 — 사진/동영상 다중 선택 가능 */}
      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { const files = Array.from(e.target.files || []); e.target.value = ''; (async () => { for (const f of files) await handleImageSend(f); })(); }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSend(f); e.target.value = ''; }} />

      {/* ─── Recording UI (input bar replacement handled by parent, but we provide startRecording/stopRecording) ─── */}
      {/* The recording bar is rendered in the parent page.tsx since it replaces the input bar */}
    </>
  );
}
