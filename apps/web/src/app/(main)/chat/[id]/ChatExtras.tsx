'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
import { getPlanTemplates, type PlanTemplate } from '@/lib/api/plan-templates.api';

import type { Message, ChatPartner, SystemPayload } from './chat-types';
export type { Message, ChatPartner, SystemPayload };

// ─── Helpers ───

const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

const formatKRW = (n: number) => n.toLocaleString('ko-KR') + '원';
const formatDate = (iso: string) => {
  const d = new Date(iso);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
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

// ─── SystemMessageCard ───
export function SystemMessageCard({ msg, isPro = false, chatPartner = null }: { msg: Message; isPro?: boolean; chatPartner?: ChatPartner | null }) {
  const [planTemplates, setPlanTemplates] = useState<PlanTemplate[]>([]);
  useEffect(() => { getPlanTemplates().then(setPlanTemplates).catch(() => {}); }, []);

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
    // 어드민 템플릿에서 label 조회, 없으면 planKey 를 Title Case 로 표시
    const planKey = String(sys.plan || '').toLowerCase();
    const tpl = planTemplates.find((t) => t.planKey.toLowerCase() === planKey);
    const planLabel = tpl?.label || (planKey ? planKey.charAt(0).toUpperCase() + planKey.slice(1) : 'Premium');
    const planColor = planKey === 'enterprise' ? '#F59E0B' : planKey === 'superior' ? '#8B5CF6' : '#3180F7';
    return (
      <div className={wrapperClass}>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-[#3180F7] px-4 py-3 flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="4" y="2" width="16" height="20" rx="2.5" fill="white" opacity="0.3"/><rect x="7.5" y="6" width="9" height="1.5" rx="0.75" fill="white" opacity="0.7"/><rect x="7.5" y="9.5" width="6" height="1.5" rx="0.75" fill="white" opacity="0.5"/><rect x="7.5" y="13" width="9" height="1.5" rx="0.75" fill="white" opacity="0.7"/></svg>
            <p className="text-[14px] font-semibold text-white">견적서가 발송되었습니다</p>
          </div>
          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${planColor}15`, color: planColor }}>
                {planLabel}
              </span>
              {sys.eventName && <span className="text-[11px] text-gray-400">{sys.eventName}</span>}
            </div>
            <p className="text-[16px] font-semibold text-gray-900 tabular-nums">{formatKRW(sys.amount || 0)}</p>
            {sys.items && sys.items.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">포함 서비스</p>
                <div className="space-y-1">
                  {sys.items.map((it, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[12px] text-gray-600">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill={planColor} opacity="0.15"/><path d="M8 12l3 3 5-5" stroke={planColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <span>{it}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {sys.eventDate && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2.5" fill="#E5E7EB"/><rect x="3" y="4" width="18" height="6" rx="2.5" fill="#9CA3AF"/></svg>
                <p className="text-[11px] text-gray-400">{formatDate(sys.eventDate)}{sys.eventTime ? ` · ${sys.eventTime}` : ''}</p>
              </div>
            )}
            {/* 결제 버튼 (고객 측에만, quotationId 있을 때) */}
            {!isPro && sys.quotationId && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const proId = chatPartner?.id;
                  const url = proId
                    ? `/pros/${proId}/checkout?quotationId=${sys.quotationId}&amount=${sys.amount || 0}`
                    : `/pros/checkout?quotationId=${sys.quotationId}&amount=${sys.amount || 0}`;
                  window.location.href = url;
                }}
                className="w-full mt-3 h-11 bg-[#3180F7] active:scale-[0.98] text-white text-[14px] font-bold rounded-xl transition-transform flex items-center justify-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="3" fill="white"/><path d="M2 10h20" stroke="#3180F7" strokeWidth="1" opacity="0.3"/></svg>
                결제하기
              </button>
            )}
          </div>
        </div>
      </div>
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
    playingVoice, setPlayingVoice,
    voicePlayProgress, setVoicePlayProgress,
    mentionQuery, setMentionQuery,
    inputRef, fileInputRef, cameraInputRef,
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
  const [quoteMemo, setQuoteMemo] = useState('');

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
        const url = URL.createObjectURL(blob);
        const duration = Math.round((Date.now() - recordingStartRef.current) / 1000);
        setMessages((prev) => [...prev, {
          id: Date.now().toString(),
          senderId: MY_ID,
          content: url,
          type: 'voice',
          createdAt: new Date().toISOString(),
          isRead: false,
          duration: Math.max(1, duration),
          isNew: true,
        }]);
        stream.getTracks().forEach((t) => t.stop());
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

  const handleImageSend = (file: File) => {
    const url = URL.createObjectURL(file);
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      senderId: MY_ID,
      content: url,
      type: 'image',
      createdAt: new Date().toISOString(),
      isRead: false,
      isNew: true,
    }]);
    setShowAttach(false);
  };

  const handleFileSend = (file: File) => {
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      senderId: MY_ID,
      content: file.name,
      type: 'file',
      createdAt: new Date().toISOString(),
      isRead: false,
      fileName: file.name,
      isNew: true,
    }]);
    setShowAttach(false);
    toast.success(`${file.name} 전송 완료`);
  };

  const sendLocationMessage = (lat: number, lng: number) => {
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      senderId: MY_ID,
      content: '내 위치를 공유했습니다',
      type: 'location',
      createdAt: new Date().toISOString(),
      isRead: false,
      isNew: true,
      latitude: lat,
      longitude: lng,
    }]);
    toast.success('위치 전송 완료');
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
    const plan = PLAN_DATA[quotePlan];
    if (!plan) { toast.error('플랜 정보를 불러오는 중입니다'); return; }
    if (!chatPartner?.id) {
      toast.error('상대방 정보를 찾을 수 없습니다');
      return;
    }
    try {
      // 1) 백엔드에 실제 Quotation 생성
      const created = await quotationApi.create({
        userId: chatPartner.id,
        amount: plan.price,
        title: quoteEventName || '행사 진행',
        description: quoteMemo || undefined,
        eventDate: quoteEventDate || undefined,
        eventTime: quoteEventTime || undefined,
      } as any);
      const quotationId = (created as any)?.id;

      // 2) 채팅방에 견적 카드 메시지 전송 (상대가 결제 버튼 누를 수 있게 metadata 포함)
      const roomId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : '';
      if (roomId && !roomId.startsWith('pending-')) {
        await chatApi.sendMessage(roomId, {
          type: 'system' as any,
          content: `💰 견적서 발송: ${plan.price.toLocaleString()}원`,
          metadata: {
            system: {
              kind: 'quote',
              plan: quotePlan,
              eventName: quoteEventName || '행사 진행',
              amount: plan.price,
              eventDate: quoteEventDate,
              eventTime: quoteEventTime,
              items: plan.items,
              quotationId,
            },
          },
        } as any).catch(() => {});
      }

      // 3) 로컬 UI에도 즉시 반영
      const quoteMsg: Message = {
        id: `s-quote-${Date.now()}`,
        senderId: MY_ID,
        content: '견적서 발송',
        type: 'system',
        createdAt: new Date().toISOString(),
        isRead: false,
        system: {
          kind: 'quote',
          plan: quotePlan,
          eventName: quoteEventName || '행사 진행',
          amount: plan.price,
          eventDate: quoteEventDate,
          eventTime: quoteEventTime,
          items: plan.items,
          quotationId,
        },
      };
      setMessages(prev => [...prev, quoteMsg]);
      setShowQuoteModal(false);
      setQuoteEventName('');
      setQuoteEventDate('');
      setQuoteEventTime('');
      setQuoteMemo('');
      toast.success('견적서가 발송되었습니다');
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '발송 실패';
      toast.error(`견적서 발송 실패: ${msg}`);
    }
  };

  const ATTACH_ITEMS = [
    { icon: <Camera size={24} className="text-white" />, bg: 'bg-slate-700', label: '카메라', action: () => cameraInputRef.current?.click() },
    { icon: <ImageIcon size={24} className="text-white" />, bg: 'bg-slate-700', label: '사진', action: () => fileInputRef.current?.click() },
    { icon: <Smile size={24} className="text-white" />, bg: 'bg-slate-700', label: '이모티콘', action: () => { setShowAttach(false); toast('곧 제공될 예정입니다', { icon: '😊' }); } },
    { icon: <FileText size={24} className="text-white" />, bg: 'bg-slate-700', label: '파일', action: () => { const inp = document.createElement('input'); inp.type = 'file'; inp.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFileSend(f); }; inp.click(); } },
    { icon: <MapPin size={24} className="text-white" />, bg: 'bg-slate-700', label: '위치', action: handleLocationSend },
    { icon: <Music size={24} className="text-white" />, bg: 'bg-slate-700', label: '오디오', action: () => { setShowAttach(false); toast('곧 제공될 예정입니다', { icon: '🎵' }); } },
    ...(isPro ? [{ icon: <FileText size={24} className="text-white" />, bg: 'bg-[#3180F7]', label: '견적서 발송', action: () => { setShowAttach(false); setShowQuoteModal(true); } }] : []),
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
            <Link href={`/pros/${chatPartner?.id || ''}`} className="flex items-center gap-3 px-4 py-3 text-[14px] text-gray-800 hover:bg-gray-50 w-full border-t border-gray-100">
              <Smile size={16} className="text-gray-500" /> 프로필 보기
            </Link>
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
          <div className="bg-white w-full rounded-t-3xl px-5 pt-5 pb-8 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp 0.3s ease' }}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <h2 className="text-[18px] font-bold text-gray-900 mb-4">견적서 작성</h2>

            <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">플랜 선택</p>
            <div className="flex gap-2 mb-4 overflow-x-auto">
              {PLAN_KEYS.map(p => (
                <button
                  key={p}
                  onClick={() => setQuotePlan(p)}
                  className={`flex-1 shrink-0 py-3 rounded-xl text-[13px] font-bold transition-colors ${
                    quotePlan === p ? 'bg-[#3180F7] text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {PLAN_DATA[p]?.label}
                  <span className="block text-[11px] font-medium mt-0.5 opacity-70">{((PLAN_DATA[p]?.price || 0) / 10000).toFixed(0)}만원</span>
                </button>
              ))}
            </div>

            <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">포함 서비스</p>
            <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1">
              {(PLAN_DATA[quotePlan]?.items || []).map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-[13px] text-gray-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#3180F7]" />
                  {item}
                </div>
              ))}
            </div>

            <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">행사 정보</p>
            <div className="space-y-2 mb-4">
              <input
                type="text"
                value={quoteEventName}
                onChange={(e) => setQuoteEventName(e.target.value)}
                placeholder="행사명 (예: 결혼식 사회)"
                className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-4 text-[16px] outline-none focus:border-[#3180F7] transition-colors"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={quoteEventDate}
                  onChange={(e) => setQuoteEventDate(e.target.value)}
                  className="flex-1 h-11 bg-gray-50 border border-gray-200 rounded-xl px-4 text-[16px] outline-none focus:border-[#3180F7] transition-colors"
                />
                <input
                  type="time"
                  value={quoteEventTime}
                  onChange={(e) => setQuoteEventTime(e.target.value)}
                  className="w-[130px] h-11 bg-gray-50 border border-gray-200 rounded-xl px-4 text-[16px] outline-none focus:border-[#3180F7] transition-colors"
                />
              </div>
              <textarea
                value={quoteMemo}
                onChange={(e) => setQuoteMemo(e.target.value)}
                placeholder="추가 메모 (선택)"
                className="w-full h-20 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[16px] outline-none focus:border-[#3180F7] resize-none transition-colors"
              />
            </div>

            <button
              onClick={handleSendQuote}
              disabled={!quoteEventName.trim()}
              className={`w-full h-12 rounded-xl font-bold text-[15px] transition-colors ${
                quoteEventName.trim() ? 'bg-[#3180F7] text-white active:scale-[0.98]' : 'bg-gray-100 text-gray-400'
              }`}
            >
              견적서 발송
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
            <div className="px-4 pb-6 max-h-[50vh] overflow-y-auto">
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

      {/* 숨겨진 파일 인풋 */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSend(f); e.target.value = ''; }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSend(f); e.target.value = ''; }} />

      {/* ─── Recording UI (input bar replacement handled by parent, but we provide startRecording/stopRecording) ─── */}
      {/* The recording bar is rendered in the parent page.tsx since it replaces the input bar */}
    </>
  );
}
