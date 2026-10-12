'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { flushSync, createPortal } from 'react-dom';
import Link from 'next/link';
import ChatNotice from '@/components/chat/ChatNotice';
import { Reply, TextSelect } from 'lucide-react';
import {
  XIcon as X,
  CopyIcon as Copy,
  TrashIcon as Trash2,
  DotsVerticalIcon as MoreVertical,
  PinLocationIcon as MapPin,
  DocumentIcon as FileText,
  EmojiIcon as Smile,
  PlusIcon as Plus,
  BellIcon as Bell,
  BellOffIcon as BellOff,
  FlagIcon as Flag,
  PinIcon as Pin,
  UnpinIcon as PinOff,
  CameraIcon as Camera,
  MicIcon as Mic,
  PictureIcon as ImageIcon,
  VideoIcon as Video,
  CardIcon as CreditCard,
  CheckCircleIcon as CheckCircle2,
  BellIcon as AlarmClock,
  TwinkleIcon as Sparkles,
  StarIcon as Star,
  RefreshIcon as RefreshCw,
  XCircleIcon as XCircle,
  ClockIcon as Clock,
} from '@/components/icons/chat';
import toast from 'react-hot-toast';
import { quotationApi } from '@/lib/api/quotation.api';
import { chatApi } from '@/lib/api/chat.api';
import { useAuthStore } from '@/lib/store/auth.store';
import { useChatStore } from '@/lib/store/chat.store';
import { getPlanTemplates, type PlanTemplate } from '@/lib/api/plan-templates.api';
import { getWeddingPlanTemplate, normalizeWeddingPlanKey } from '@/lib/wedding-plans';
import { CHAT_STICKERS } from '@/lib/chat-stickers';
import { popItemDelay } from '@/lib/pop-menu';

import type { Message, ChatPartner, SystemPayload } from './chat-types';
import { formatEventTime } from '@/lib/event-time';
import { type PlaceResult, androidIntentUrl, isValidLatLng, kakaoMapUrl, locationContent, tilesForView } from './chat-location';
import { SearchIcon as MonoSearchIcon } from '@/components/icons/mono';
export type { Message, ChatPartner, SystemPayload };

// ─── Helpers ───

const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

// 이미지 전체보기 — body 로 포털(채팅 fixed 컨테이너 스태킹 컨텍스트 탈출, 안드 WebView 에서 안 뜨던 문제),
// 화면 맞춤(object-contain), 로딩/실패 폴백, 연 직후 고스트 탭으로 즉시 닫힘 방지(가드).
function ChatImageViewer({ url, onClose }: { url: string; onClose: () => void }) {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const openedAt = useRef(0);
  useEffect(() => { openedAt.current = Date.now(); setErrored(false); setLoaded(false); }, [url]);
  const guardedClose = () => { if (Date.now() - openedAt.current > 300) onClose(); };
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90"
      style={{ touchAction: 'none' }}
      onClick={guardedClose}
    >
      <button onClick={onClose} className="absolute right-4 top-4 z-10 text-white" aria-label="닫기"><X size={28} /></button>
      {!errored ? (
        <img
          src={url}
          alt=""
          className="max-h-[92vh] max-w-[94vw] select-none rounded-lg object-contain"
          onClick={(e) => e.stopPropagation()}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      ) : (
        <div className="flex flex-col items-center gap-3 px-8 text-center" onClick={(e) => e.stopPropagation()}>
          <p className="text-[15px] font-semibold text-white/90">이미지를 불러올 수 없습니다</p>
          {/^https?:|^\/uploads\//.test(url) && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white/15 px-4 py-2 text-[13px] font-bold text-white">원본 열기</a>
          )}
        </div>
      )}
      {!loaded && !errored && (
        <div className="pointer-events-none absolute h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      )}
    </div>,
    document.body,
  );
}

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
    kakao?: any;
  }
}

// ─── 장소 보내기 시트 · 위치 카드 (261012 사장 '채팅창 내에서 갤럭시 장소/음성 전달 실패(아이폰 갤럭시 둘다 발생함)') ───
//  예전 NaverMapPicker 는 운영에 네이버 지도 키가 없어 '네이버 지도 SDK 로드 실패' 문구만 뜨고 전송 버튼이 영영 꺼져 있었다.
//  갤럭시 앱(2.0.6)은 웹뷰 위치 권한 처리가 없어 현재 위치도 못 받아 → 위치를 보낼 방법이 아예 없었다.
//  지금: 장소 검색(서버 경유 카카오 로컬 /chat/place-search) → 골라서 보내기. 현재 위치는 되는 기기에서만 덤으로.
//  검색이 안 되면 검색어 그대로(장소명만) 보낼 수 있다 — 어떤 경우에도 막다른 길이 없게.

/** 시트에서 고른 장소 — label 은 시트 표시용, placeName·address 는 메시지 metadata 로 간다 */
export type PickedPlace = { lat?: number; lng?: number; placeName?: string; address?: string; label: string };

/** 지금 깔린 안드로이드 앱(2.0.6)인지 — window.Android(앱 JS 다리)는 있는데 위치 지원 표시가 없으면 웹뷰가 위치를 못 준다 */
function androidAppWithoutGeolocation() {
  if (typeof window === 'undefined') return false;
  const bridge = (window as unknown as { Android?: Record<string, unknown> }).Android;
  return !!bridge && typeof bridge.supportsGeolocation !== 'function';
}

function PlacePickerSheet({ onSend, onClose }: { onSend: (p: PickedPlace) => Promise<boolean>; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PlaceResult[] | null>(null); // null = 아직 검색 전
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [selected, setSelected] = useState<PickedPlace | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [geoState, setGeoState] = useState<'idle' | 'locating' | 'denied' | 'failed'>('idle');
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const seqRef = useRef(0);
  const noGeoApp = androidAppWithoutGeolocation();
  const geoSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator && !noGeoApp;

  // 검색 — 입력 멈추고 0.3초 뒤. 늦게 온 옛 응답은 버린다(seq).
  useEffect(() => {
    const term = q.replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!term) {
      seqRef.current += 1;
      setResults(null);
      setSearchError(false);
      setSearching(false);
      return;
    }
    const seq = ++seqRef.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: term });
        if (here) {
          params.set('lat', here.lat.toFixed(4));
          params.set('lng', here.lng.toFixed(4));
        }
        const res = await fetch(`/chat/place-search?${params.toString()}`, { credentials: 'omit' });
        const data = await res.json().catch(() => ({} as any));
        if (seq !== seqRef.current) return;
        setResults(Array.isArray(data?.places) ? data.places : []);
        setSearchError(!res.ok || !!data?.error);
      } catch {
        if (seq !== seqRef.current) return;
        setResults([]);
        setSearchError(true);
      } finally {
        if (seq === seqRef.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, here]);

  // 현재 위치 — 자체 감시 타이머(9초)로 끝을 보장한다(웹뷰가 위치 요청에 아무 답도 안 주는 경우 대비).
  const locate = useCallback(() => {
    if (!geoSupported) return;
    setGeoState('locating');
    let done = false;
    const watchdog = setTimeout(() => {
      if (done) return;
      done = true;
      setGeoState('failed');
    }, 9000);
    const finish = () => { done = true; clearTimeout(watchdog); };
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (done) return;
          finish();
          const { latitude, longitude } = pos.coords;
          if (!isValidLatLng(latitude, longitude)) { setGeoState('failed'); return; }
          setHere({ lat: latitude, lng: longitude });
          setGeoState('idle');
          setSelected({ lat: latitude, lng: longitude, label: '현재 위치' });
          setSelectedKey('here');
          inputRef.current?.blur();
          // 주소 붙이기 — 실패해도 좌표만으로 보낼 수 있다. 건물 이름은 붙이지 않는다(GPS 오차로 옆 건물 이름이 갈 수 있어서)
          fetch(`/chat/place-search?lat=${latitude.toFixed(4)}&lng=${longitude.toFixed(4)}`, { credentials: 'omit' })
            .then((r) => r.json())
            .then((d) => {
              const address = typeof d?.address === 'string' ? d.address : '';
              if (!address) return;
              setSelected((cur) => (cur && cur.lat === latitude && cur.lng === longitude ? { ...cur, address } : cur));
            })
            .catch(() => {});
        },
        (err) => {
          if (done) return;
          finish();
          setGeoState(err?.code === 1 ? 'denied' : 'failed');
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
      );
    } catch {
      finish();
      setGeoState('failed');
    }
  }, [geoSupported]);

  // 이미 위치 권한을 준 기기면(팝업 없이) 열자마자 현재 위치를 잡아 둔다
  useEffect(() => {
    if (!geoSupported) return;
    const perms = (navigator as any).permissions;
    if (!perms?.query) return;
    perms.query({ name: 'geolocation' })
      .then((st: any) => { if (st?.state === 'granted') locate(); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (key: string, p: PickedPlace) => {
    setSelected(p);
    setSelectedKey(key);
    // 안드로이드 웹뷰는 키보드가 떠도 화면이 안 줄어 아래 보내기 버튼이 가린다 → 고르면 키보드를 내린다
    inputRef.current?.blur();
  };

  const send = async () => {
    if (!selected || sending) return;
    setSending(true);
    const ok = await onSend(selected).catch(() => false);
    setSending(false);
    if (ok) onClose();
  };

  const term = q.trim();
  const geoLine =
    geoState === 'locating' ? '현재 위치 찾는 중…'
      : geoState === 'denied' ? '위치 권한이 꺼져 있어요 · 장소를 검색해서 보내 주세요'
        : geoState === 'failed' ? '현재 위치를 찾지 못했어요 · 다시 누르거나 장소를 검색해 주세요'
          : '지금 있는 곳을 보내요';

  return (
    // 공통 시트(ft-*) — 검색칸은 시트 위쪽(안드로이드 키보드에 가리지 않게), 결과 목록이 남는 높이를 채운다
    <div className="ft-scrim" onClick={onClose}>
      <div
        className="ft-sheet wide h-[80vh] sm:h-[600px] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="장소 보내기"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ft-grab shrink-0" aria-hidden="true" />
        <div className="flex items-center justify-between shrink-0">
          <h3 className="ft-title">장소 보내기</h3>
          <button onClick={onClose} aria-label="닫기" className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center active:scale-90 transition-transform">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="pt-3 pb-2 shrink-0">
          <div className="flex items-center bg-[#F2F4F6] rounded-full pl-4 pr-2 h-11">
            <MonoSearchIcon size={18} className="text-[#8B95A1] shrink-0" />
            {/* type=search 는 브라우저 기본 지우기(×)가 따로 붙어 지우기 버튼이 둘이 된다 → text + 검색 키보드 */}
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              value={q}
              maxLength={60}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.blur(); } }}
              placeholder="장소·건물 이름이나 주소 검색"
              className="ml-2 flex-1 min-w-0 bg-transparent text-[16px] focus:outline-none placeholder:text-[#B0B8C1]"
            />
            {q && (
              <button type="button" aria-label="지우기" onClick={() => { setQ(''); inputRef.current?.focus(); }} className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90">
                <XCircle size={18} className="text-[#B0B8C1]" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 overscroll-contain">
          {geoSupported ? (
            <button
              type="button"
              onClick={locate}
              disabled={geoState === 'locating'}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors active:bg-[#F2F4F6] ${selectedKey === 'here' ? 'bg-[#EEF5FF]' : ''}`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8F7EF]">
                {geoState === 'locating'
                  ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#15B86C]/30 border-t-[#15B86C]" />
                  : <MapPin size={20} className="text-[#15B86C]" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-[#191F28]">현재 위치 보내기</span>
                <span className={`block text-[13px] ${geoState === 'denied' || geoState === 'failed' ? 'text-[#F04452]' : 'text-[#8B95A1]'}`}>{geoLine}</span>
              </span>
              {selectedKey === 'here' && <CheckCircle2 size={20} className="shrink-0 text-[#3182F6]" />}
            </button>
          ) : noGeoApp ? (
            <div className="flex items-center gap-3 rounded-2xl px-3 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F2F4F6]">
                <MapPin size={20} className="text-[#B0B8C1]" />
              </span>
              <span className="min-w-0 flex-1 text-[13px] leading-[1.45] text-[#8B95A1]">
                현재 위치는 앱 업데이트 후 쓸 수 있어요.<br />지금은 장소를 검색해서 보내 주세요.
              </span>
            </div>
          ) : null}

          <div className="mx-3 my-1 h-px bg-[#F2F4F6]" />

          {!term ? (
            <p className="px-3 py-6 text-center text-[13px] leading-[1.6] text-[#8B95A1]">
              가게·건물 이름이나 주소로 찾아보세요<br />예) 강남역, 서울 중구 세종대로 110
            </p>
          ) : searching && !results?.length ? (
            <p className="px-3 py-6 text-center text-[13px] text-[#8B95A1]">찾는 중…</p>
          ) : results && results.length > 0 ? (
            <ul>
              {results.map((p, idx) => {
                const key = `r-${idx}-${p.lat}-${p.lng}`;
                const sub = p.roadAddress || p.address;
                const on = selectedKey === key;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => pick(key, { lat: p.lat, lng: p.lng, placeName: p.name, address: sub, label: p.name })}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors active:bg-[#F2F4F6] ${on ? 'bg-[#EEF5FF]' : ''}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-1.5">
                          <span className="min-w-0 truncate text-[15px] font-bold text-[#191F28]">{p.name}</span>
                          {p.category && <span className="shrink-0 text-[12px] text-[#B0B8C1]">{p.category}</span>}
                        </span>
                        {sub && <span className="block truncate text-[13px] text-[#8B95A1]">{sub}</span>}
                      </span>
                      {on && <CheckCircle2 size={20} className="shrink-0 text-[#3182F6]" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-3 py-4">
              <p className="text-center text-[13px] text-[#8B95A1]">
                {searchError ? '장소 검색을 잠시 쓸 수 없어요' : '검색 결과가 없어요'}
              </p>
              {/* 막다른 길 방지 — 검색이 안 되거나 없으면 검색어를 장소명으로 그대로 보낸다(받는 쪽은 카카오맵 검색으로 연다) */}
              <button
                type="button"
                onClick={() => pick('typed', { placeName: term, label: term })}
                className={`mt-3 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors active:bg-[#F2F4F6] ${selectedKey === 'typed' ? 'bg-[#EEF5FF]' : 'bg-[#F9FAFB]'}`}
              >
                <MapPin size={18} className="shrink-0 text-[#3182F6]" />
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[#191F28]">‘{term}’ 그대로 보내기</span>
                {selectedKey === 'typed' && <CheckCircle2 size={20} className="shrink-0 text-[#3182F6]" />}
              </button>
            </div>
          )}
        </div>

        <div className="shrink-0">
          {selected && (
            <div className="flex items-center gap-2 mt-2 px-3 py-2.5 bg-[#F2F8FF] rounded-xl">
              <MapPin size={16} className="text-[#3182F6] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-[#191F28] truncate">{selected.label}</p>
                <p className="text-[12px] text-[#8B95A1] truncate">
                  {selected.address || (isValidLatLng(selected.lat, selected.lng) ? `${selected.lat!.toFixed(5)}, ${selected.lng!.toFixed(5)}` : '장소 이름만 보내요')}
                </p>
              </div>
            </div>
          )}
          <div className="ft-actions">
            <button onClick={send} disabled={!selected || sending} className="ft-btn primary">
              {sending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <MapPin size={16} />}
              {sending ? '보내는 중…' : '이 장소 보내기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 위치 카드 위 작은 지도(OSM 타일 이어 붙이기) — 지도 SDK·키 없이. 타일이 안 오면 회색 바탕+핀만 */
function LocationMiniMap({ lat, lng }: { lat: number; lng: number }) {
  const W = 240;
  const H = 120;
  const [failed, setFailed] = useState(false);
  const tiles = tilesForView(lat, lng, 16, W, H);
  return (
    <div className="relative h-[120px] w-full overflow-hidden bg-[#E5E8EB]" aria-hidden="true">
      {!failed && (
        <div className="absolute left-1/2 top-0 h-[120px] w-[240px] -translate-x-1/2">
          {tiles.map((t) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={t.key}
              src={t.url}
              alt=""
              width={256}
              height={256}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{ left: t.left, top: t.top, width: 256, height: 256 }}
              onError={() => setFailed(true)}
            />
          ))}
        </div>
      )}
      {/* 핀 — 끝이 칸 한가운데(좌표)에 오도록 */}
      <svg width="30" height="38" viewBox="0 0 30 38" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full drop-shadow-[0_2px_3px_rgba(0,0,0,0.25)]">
        <path d="M15 37C15 37 28 23.5 28 14.5C28 7 22.2 1 15 1C7.8 1 2 7 2 14.5C2 23.5 15 37 15 37Z" fill="#F04452" stroke="#fff" strokeWidth="2" />
        <circle cx="15" cy="14.5" r="5" fill="#fff" />
      </svg>
      {!failed && (
        <span className="absolute bottom-0.5 right-1 rounded bg-white/75 px-1 text-[9px] leading-[14px] text-[#4E5968]">© OpenStreetMap</span>
      )}
    </div>
  );
}

/**
 * 받은·보낸 위치 메시지 카드 — 지도 그림 + 장소명·주소 + '지도에서 보기'(카카오맵).
 * 옛 메시지(placeName 없이 좌표만, 본문 '내 위치를 공유했습니다')도 같은 카드로, 좌표 없이 장소명만 온 메시지는 지도 그림 없이.
 * 꾹 누르기(메뉴)는 바깥 줄(page.tsx)이 그대로 맡는다.
 */
export function LocationCard({ msg, mine, tailCorner = '' }: { msg: Message; mine: boolean; tailCorner?: string }) {
  // metadata 좌표가 문자열로 저장된 옛 메시지도 있을 수 있어 숫자로 맞춘다(빈 값은 NaN → 좌표 없음)
  const toNum = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN);
  const lat = toNum(msg.latitude);
  const lng = toNum(msg.longitude);
  const hasCoord = isValidLatLng(lat, lng);
  // 글자인 것만 — 캐시(localStorage)에 예전 모양 그대로 남은 메시지는 mapApiMessage 를 다시 안 거친다(261012)
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const content = str(msg.content);
  const placeName = str(msg.placeName);
  const address = str(msg.address);
  const fallbackTitle = hasCoord ? (mine ? '내 위치' : '상대가 보낸 위치') : '공유한 장소';
  const title = placeName || (content && content !== '내 위치를 공유했습니다' ? content : '') || address || fallbackTitle;
  const sub = address && address !== title ? address : '';
  const href = kakaoMapUrl(placeName || address || (title !== fallbackTitle ? title : ''), lat, lng);
  const open = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.stopPropagation();
    // 안드로이드 앱 웹뷰 — intent:// 로 감싸 바깥(브라우저·카카오맵)으로. 그냥 열면 웹뷰 안에서 카카오맵 웹이
    // 앱 스킴을 열다 '웹페이지를 사용할 수 없음'이 날 수 있다(지금 깔린 2.0.6 은 intent:// 만 밖으로 넘긴다).
    const inAndroidApp = typeof window !== 'undefined' && !!(window as unknown as { Android?: unknown }).Android;
    if (inAndroidApp) {
      e.preventDefault();
      try { window.location.href = androidIntentUrl(href); } catch { /* 링크를 못 만들면 아무 일도 안 한다(오류 화면보다 낫다) */ }
    }
  };
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={open}
      draggable={false}
      className={`block w-[240px] max-w-full overflow-hidden rounded-[20px]${tailCorner} no-underline select-none ${mine ? 'bg-[#3180F7] text-white' : 'bg-[#F2F3F5] text-[#191F28]'}`}
      style={{ WebkitTouchCallout: 'none' }}
    >
      {hasCoord && <LocationMiniMap lat={lat} lng={lng} />}
      <div className="px-4 py-3">
        <p className="break-words text-[15px] font-bold leading-[1.35] [overflow-wrap:anywhere]">{title}</p>
        {sub && <p className={`mt-0.5 break-words text-[12px] leading-[1.4] ${mine ? 'text-white/80' : 'text-[#6B7684]'}`}>{sub}</p>}
        <p className={`mt-2 flex items-center gap-1 text-[12px] font-semibold ${mine ? 'text-white/90' : 'text-[#3180F7]'}`}>
          <MapPin size={13} />
          지도에서 보기
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
/** 주문번호 — 토스에 넘긴 orderId(ORDER-{시각}-{8자리})에서 뒤 8자리만 보여 준다 */
function orderNo(sys: SystemPayload) {
  const raw = sys.orderId || sys.paymentId || sys.quotationId || '';
  if (!raw) return '';
  const tail = raw.split('-').pop() || raw;
  return tail.slice(-8).toUpperCase();
}

/** 견적 금액 키패드 — 퀵매칭 번호 입력과 같은 배열 */
const QUOTE_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

/** 490000 → '49만원', 12345678 → '1,234만 5,678원' */
function toKoreanWon(n: number) {
  const eok = Math.floor(n / 1e8);
  const man = Math.floor((n % 1e8) / 1e4);
  const rest = n % 1e4;
  const parts: string[] = [];
  if (eok) parts.push(`${eok.toLocaleString('ko-KR')}억`);
  if (man) parts.push(`${man.toLocaleString('ko-KR')}만`);
  if (rest) parts.push(rest.toLocaleString('ko-KR'));
  return `${parts.join(' ')}원`;
}

/** 견적 카드 제목 — "홍길동님의 결혼식 사회 섭외건" 처럼 누구의 무슨 행사인지 한 줄로 */
function quoteTitle(sys: SystemPayload, customerName?: string | null) {
  const who = (customerName || '').trim();
  const what = (sys.eventName || '').trim() || '행사';
  // 이미 문장처럼 길게 들어온 견적명이나 '김예비님의 결혼식 행사' 처럼 이름이 든 견적명은 그대로 둔다
  if (what.length > 12 || what.includes('섭외') || what.includes('님의')) return what;
  return who ? `${who}님의 ${what} 사회 섭외건` : `${what} 사회 섭외건`;
}

/** 견적 카드에 보여줄 행사일 — 시스템 페이로드에 없으면 견적 상세에서 끌어온다 */
function formatQuoteEventDate(sys: SystemPayload, quoteDetail: any): string {
  const raw =
    sys.eventDate ||
    quoteDetail?.request?.eventDate ||
    quoteDetail?.eventDate ||
    '';
  if (!raw) return '사회자와 협의';
  const date = new Date(raw);
  const day = Number.isNaN(date.getTime())
    ? String(raw)
    : `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  const time = sys.eventTime || quoteDetail?.request?.eventTime || '';
  return time ? `${day} ${time}` : day;
}

/**
 * 직접 결제 유도 주의 안내.
 *
 * 안전결제를 피해 계좌로 직접 보내라고 하는 경우가 사고의 대부분이라,
 * 견적 카드 뒤와 대화 중간중간에 같은 문구를 반복해서 깔아 둔다.
 */
// 단색 SVG 를 원하는 색으로 칠하는 아이콘(CSS 마스크) — 토스 mono 아이콘 세트용
export function TintIcon({ src, color, size = 24 }: { src: string; color: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        flexShrink: 0,
        backgroundColor: color,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  );
}

// 안전결제 안내 — 파란 '안내' 카드(사장 지시 260925: 유의=노랑·주의=빨강·안내=파랑). 예전엔 빨간 ※ 주의 글줄이었다.
export function SafePaymentNotice() {
  return (
    <ChatNotice tone="info" title="프리티풀 안전결제로 거래하세요" action={{ label: '신고하기', href: '/my/support' }} className="my-3">
      결제 금액은 행사가 끝난 뒤 사회자에게 전달돼요. 직접 결제를 유도하면 신고해 주세요.
    </ChatNotice>
  );
}

export function SystemMessageCard({ msg, isPro = false, chatPartner = null, myProfileImage = null, isLatestQuote = false, refreshTick = 0 }: { msg: Message; isPro?: boolean; chatPartner?: ChatPartner | null; myProfileImage?: string | null; isLatestQuote?: boolean; refreshTick?: number }) {
  const authUser = useAuthStore((state) => state.user);
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

  const wrapperClass = 'max-w-[280px] my-2 ml-14 origin-bottom-left animate-[bubbleGrow_0.42s_cubic-bezier(0.2,0.9,0.3,1)_both]';

  if (sys.kind === 'quote') {
    const planKey = String(sys.plan || '').toLowerCase();
    const tpl = planTemplates.find((t) => t.planKey.toLowerCase() === planKey);
    const weddingTpl = getWeddingPlanTemplate(normalizeWeddingPlanKey(planKey));
    const planLabel = tpl?.label || weddingTpl?.label || (planKey ? planKey.charAt(0).toUpperCase() + planKey.slice(1) : '1부 예식');

    return (
      <>
      {/* 안전 결제 카드 — 견적서를 보내면 이 카드가 대화에 남는다.
          직접 송금 대신 플랫폼 결제로 유도하는 게 핵심이라, 무엇을·언제까지·얼마에
          받는지를 한 장에 담고 결제 화면으로 바로 넘어가게 했다. */}
      <div
        ref={quoteRef}
        data-quote-card="true"
        data-near-center="false"
        className="quote-card-root my-2 ml-2 mr-auto w-[min(320px,86%)] overflow-hidden rounded-[18px] border-[0.6px] border-[#EEF1F5] bg-white shadow-[0_6px_20px_rgba(15,23,42,0.06)]"
      >
        <div className="px-4 pb-4 pt-4">
          <p className="text-[17px] font-bold text-[#191F28]">프리티풀 안전 결제</p>
          <p className="mt-1.5 text-[13px] leading-[1.55] text-[#8B95A1]">
            행사 진행이 끝난 뒤 결제 대금이<br />
            사회자에게 전달되기 때문에 안전하게 거래하실 수 있어요.
          </p>

          {/* 상품 — 썸네일 + 제목 */}
          <div className="mt-4 flex items-start gap-3">
            <img
              src={(sys as any)?.proImage || (isPro ? myProfileImage : chatPartner?.profileImageUrl) || '/images/default-profile.svg'}
              alt=""
              className="h-[62px] w-[86px] shrink-0 rounded-[10px] bg-[#E4E7EB] object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = '/images/default-profile.svg'; }}
            />
            <p className="min-w-0 flex-1 text-[14px] font-medium leading-[1.5] text-[#191F28]">
              {quoteTitle(sys, isPro ? chatPartner?.name : authUser?.name)}
            </p>
          </div>

          {/* 조건 */}
          <div className="mt-4 space-y-2.5">
            <div>
              <p className="text-[15px] font-bold text-[#191F28]">제공 서비스</p>
              <p className="mt-1 text-[14px] text-[#333D4B]">
                {planLabel}
                {Array.isArray(sys.options) && sys.options.length > 0 ? ` + 추가 ${sys.options.length}종` : ''}
              </p>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-[15px] font-bold text-[#191F28]">행사일</p>
              <p className="text-[14px] text-[#333D4B]">{formatQuoteEventDate(sys, quoteDetail)}</p>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[15px] font-bold text-[#191F28]">금액</p>
              <p className="text-[19px] font-bold tabular-nums text-[#191F28]">{formatKRW(sys.amount || 0)}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowQuoteDetail(true); }}
            className="mt-1.5 flex items-center gap-1 text-[12px] text-[#A4ABBA]"
          >
            수수료 별도 안내
            <span className="flex h-[15px] w-[15px] items-center justify-center rounded-full bg-[#C8CEDA] text-[10px] font-bold leading-none text-white">
              ?
            </span>
          </button>

          {/* 액션 */}
          {!isPro && sys.quotationId ? (
            isPaid ? (
              <div className="mt-4 flex h-[52px] w-full items-center justify-center gap-1.5 rounded-[12px] bg-[#E9F8EF] text-[15px] font-bold text-[#12B76A]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.18" />
                  <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                결제 완료
              </div>
            ) : isLatestQuote ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = buildQuoteCheckoutUrl(chatPartner, sys, quoteDetail);
                }}
                className="mt-4 h-[52px] w-full rounded-[12px] bg-[#191F28] text-[16px] font-bold text-white transition-transform active:scale-[0.99]"
              >
                거래 화면으로 이동
              </button>
            ) : (
              <button
                type="button"
                disabled
                title="최신 견적서만 결제할 수 있어요"
                className="mt-4 h-[52px] w-full cursor-not-allowed rounded-[12px] bg-[#E4E7EB] text-[15px] font-bold text-[#A4ABBA]"
              >
                만료된 견적
              </button>
            )
          ) : null}

          {isPro && sys.quotationId && (
            <div
              className={`mt-4 flex h-[52px] w-full items-center justify-center gap-1.5 rounded-[12px] text-[15px] font-bold ${
                isPaid ? 'bg-[#E9F8EF] text-[#12B76A]' : 'bg-[#FFF6E5] text-[#D98A00]'
              }`}
            >
              {isPaid ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.18" />
                    <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  고객 결제 완료
                </>
              ) : (
                <>
                  <Clock size={15} />
                  결제 대기 중
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 직접 결제 유도 주의 — 견적 카드 뒤에 항상 붙는다 */}
      <SafePaymentNotice />
      {/* 견적 상세 — 공통 시트(ft-*) */}
      {showQuoteDetail && (
        <div
          className="ft-scrim"
          onClick={() => setShowQuoteDetail(false)}
        >
          <div
            className="ft-sheet"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ft-grab" aria-hidden="true" />
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="ft-title">
                {isPro ? '내가 보낸 견적' : isPaid ? '결제 내역' : '받은 견적'}
              </h2>
              <button
                onClick={() => setShowQuoteDetail(false)}
                className="w-8 h-8 shrink-0 rounded-full bg-gray-100 flex items-center justify-center"
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
            <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-[13px] text-gray-500">총 견적 금액</span>
              <span className="text-[20px] font-bold text-[#3180F7] tabular-nums">
                {Number(sys.amount || 0).toLocaleString()}원
              </span>
            </div>

            {/* 액션: 미결제 + 최신 + 고객 측이면 결제하기 노출 */}
            {!isPro && sys.quotationId && !isPaid && isLatestQuote && (
              <div className="ft-actions">
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = buildQuoteCheckoutUrl(chatPartner, sys, quoteDetail);
                  }}
                  className="ft-btn primary"
                >
                  결제하기
                </button>
              </div>
            )}
            {isPro && (
              <p className="mt-4 text-center text-[12px] text-gray-400">
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
    // 결제가 끝나면 '무엇을 결제했는지' 가 대화에 남아야 한다 — 참고 화면과 같은 형태
    const paidAt = new Date(msg.createdAt);
    const stamp = Number.isNaN(paidAt.getTime())
      ? ''
      : `${String(paidAt.getFullYear()).slice(2)}.${String(paidAt.getMonth() + 1).padStart(2, '0')}.${String(paidAt.getDate()).padStart(2, '0')} ` +
        `${String(paidAt.getHours()).padStart(2, '0')}:${String(paidAt.getMinutes()).padStart(2, '0')}`;
    const no = orderNo(sys);

    return (
      <div className="my-2 ml-2 mr-auto w-[min(320px,86%)] rounded-[18px] bg-[#EDF7E6] px-4 py-4">
        <p className="text-[15px] text-[#2F3A2A]">
          <span className="font-bold">결제한 서비스</span>
          {stamp && <span className="text-[14px]"> ({stamp})</span>}
        </p>
        <div className="mt-3 flex items-start gap-3">
          <img
            src={(sys as any)?.proImage || (isPro ? myProfileImage : chatPartner?.profileImageUrl) || '/images/default-profile.svg'}
            alt=""
            className="h-[62px] w-[78px] shrink-0 rounded-[10px] bg-white object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = '/images/default-profile.svg'; }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] leading-[1.5] text-[#191F28]">
              {quoteTitle(sys, isPro ? chatPartner?.name : authUser?.name)}
            </p>
            {no && (
              <p className="mt-1.5 text-[14px] font-bold text-[#191F28]">
                주문번호: <span className="tabular-nums">{no}</span>
              </p>
            )}
          </div>
        </div>
        <p className="mt-3 border-t border-[#DCEBD1] pt-2.5 text-[13px] font-bold text-[#2F3A2A]">
          결제금액 <span className="tabular-nums">{formatKRW(sys.amount || 0)}</span>
        </p>
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
// 공용 렌더러(@멘션 + URL 링크화) 재노출 — 기존 import 경로 호환 유지
export { renderTextWithMentions } from './chat-text';

// ─── ChatExtras Props ───

export interface ChatExtrasProps {
  /** 이 방 id — PC 임베드(주소가 /chat 그대로)에서도 맞는 방으로 보내게 주소창 대신 이걸 쓴다(261012) */
  roomId?: string;
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
  /** 알림 끄기/켜기(서버 저장) — 없으면 화면 상태만 바꾼다 */
  onToggleMute?: () => void;
  /** ⋮ → 대화 내용 검색(웹) — 방 화면이 검색 줄을 연다 */
  onOpenSearch?: () => void;
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
  /** 입력창 안 스마일 버튼이 이모티콘 시트를 열 수 있게 여는 함수를 넘겨준다. */
  onRegisterStickers?: (open: () => void) => void;
  /** 상단 영역(헤더+거래 카드+칩+배너) 높이 — 공지 바를 그 바로 아래에 붙인다 */
  topOffset?: number;
  // Voice playback
  playingVoice: string | null;
  setPlayingVoice: React.Dispatch<React.SetStateAction<string | null>>;
  voicePlayProgress: Record<string, number>;
  setVoicePlayProgress: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  // Mention
  mentionQuery: string | null;
  setMentionQuery: React.Dispatch<React.SetStateAction<string | null>>;
  // Refs
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
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
    onToggleMute,
    onOpenSearch,
    showAttach, setShowAttach,
    showQuoteModal, setShowQuoteModal,
    showLocationPicker, setShowLocationPicker,
    pinnedMessage, setPinnedMessage,
    partialCopyMsg, setPartialCopyMsg,
    isRecording, setIsRecording,
    recordingTime, setRecordingTime,
    onRegisterRecording,
    onRegisterStickers,
    topOffset,
    playingVoice, setPlayingVoice,
    voicePlayProgress, setVoicePlayProgress,
    mentionQuery, setMentionQuery,
    inputRef, fileInputRef, cameraInputRef,
    roomMeta,
  } = props;
  // 방 id — prop 우선, 없으면 예전처럼 주소창 끝 조각(옛 호출부 호환)
  const currentRoomId = () =>
    props.roomId || (typeof window !== 'undefined' ? window.location.pathname.split('/').pop() || '' : '');

  // ─── Internal refs for recording/voice ───
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartRef = useRef<number>(0);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  // 이모티콘 시트
  const [showStickers, setShowStickers] = useState(false);

  // 카메라 첨부 — 사진/동영상 중 무엇을 찍을지 먼저 고른다.
  // 안드로이드는 ACTION_IMAGE_CAPTURE 로 카메라를 열면 사진 모드로 고정되어
  // 카메라 앱 안에서 동영상으로 전환할 수 없으므로, 앱에서 미리 물어본다.
  const [showCameraChoice, setShowCameraChoice] = useState(false);

  // 시트가 열려 있을 때 뒤로가기는 '시트 닫기' 여야 한다.
  // 히스토리 항목을 하나 쌓아두면 안드로이드 뒤로가기가 페이지 이동 대신
  // popstate 로 들어와 시트만 닫힌다(그냥 두면 채팅방을 나가버림).
  const sheetOpen = showAttach || showStickers || showCameraChoice;
  useEffect(() => {
    if (!sheetOpen) return;
    window.history.pushState({ ftSheet: true }, '');
    const closeAll = () => { setShowAttach(false); setShowStickers(false); setShowCameraChoice(false); };
    window.addEventListener('popstate', closeAll);
    return () => {
      window.removeEventListener('popstate', closeAll);
      // 버튼으로 닫은 경우엔 쌓아둔 항목을 되돌린다 (뒤로가기로 닫혔으면 이미 없음)
      if ((window.history.state as any)?.ftSheet) window.history.back();
    };
  }, [sheetOpen, setShowAttach]);

  // ─── Quote modal state ───
  const [quotePlan, setQuotePlan] = useState<string>('premium');
  const [quoteEventName, setQuoteEventName] = useState('');
  const [quoteEventDate, setQuoteEventDate] = useState('');
  const [quoteEventTime, setQuoteEventTime] = useState('');
  const [quoteEventLocation, setQuoteEventLocation] = useState('');
  const [quoteMemo, setQuoteMemo] = useState('');
  const [quoteCustomAmount, setQuoteCustomAmount] = useState('');

  // 견적 작성 시트가 열릴 때, 고객 매칭 요청/최신 견적 정보를 자동 채움.
  // 시트엔 금액만 있다 — 행사일/시간/장소는 고객이 쓴 값 그대로, 행사명은 발송 때 autoQuoteTitle().
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
    // 행사 시각은 벽시계 값 — 시간대 변환 금지(로컬 변환 시 KST 에서 +9h 밀림)
    const toTimeInput = formatEventTime;
    setQuoteEventDate((cur) => cur || toDateInput(mr?.eventDate || lq?.eventDate || raw.date));
    setQuoteEventTime((cur) => cur || toTimeInput(mr?.eventTime || lq?.eventTime || raw.timeStart));
    setQuoteEventLocation((cur) => cur || mr?.eventLocation || lq?.eventLocation || raw.location || '');
    // 플랜 자동 선택 — rawUserInput 의 planKey 또는 wedding_part1 / wedding_part12 같은 라벨 힌트
    const planHint = raw.planKey || raw.plan;
    if (planHint && typeof planHint === 'string') {
      setQuotePlan((cur) => (PLAN_KEYS.includes(planHint) ? planHint : cur));
    }
  }, [showQuoteModal, roomMeta, chatPartner]);
  // 견적 이름 — 입력칸 없이 자동: '{고객명}님의 {행사 종류} 행사' (예: 김예비님의 결혼식 행사).
  // 퀵매칭 요청은 행사 종류가 비어 있고 결혼식 사회자 전용이라 결혼식으로 본다.
  const autoQuoteTitle = () => {
    const mr: any = roomMeta?.matchRequest;
    const raw: any = mr?.rawUserInput && typeof mr.rawUserInput === 'object' ? mr.rawUserInput : {};
    let kind = String(mr?.eventCategory?.name || '');
    if (!kind && (raw.source === 'landing_quick_match' || /결혼|웨딩|예식/.test(String(mr?.category?.name || '')))) kind = '결혼식';
    kind = kind.replace(/\s*\(.*?\)\s*/g, '').trim();
    const what = !kind ? '행사' : /행사$/.test(kind) ? kind : `${kind} 행사`;
    const who = (chatPartner?.name || '').trim();
    return who ? `${who}님의 ${what}` : what;
  };
  // 견적 금액 키패드 — 퀵매칭 번호 키패드와 같은 동작(최대 9자리, 맨 앞 0 무시)
  const pressQuoteKey = (k: string) =>
    setQuoteCustomAmount((p) => {
      const d = p.replace(/\D/g, '');
      if (k === 'back') return d.slice(0, -1);
      if (d.length >= 9 || (!d && k === '0')) return d;
      return d + k;
    });
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


  // ─── Handlers ───

  const formatVoiceDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // 녹음 형식 — AAC(mp4)를 먼저 고른다(261012 사장 '채팅창 내에서 갤럭시 장소/음성 전달 실패').
  // 갤럭시가 webm/opus 로 녹음하면 아이폰에서 재생이 안 될 수 있다. AAC 를 지원하는 기기(아이폰 전부, 최근 크롬·웹뷰)는
  // 처음부터 어디서나 재생되는 형식으로 녹음하고, 못 하는 기기는 webm 으로 녹음해 서버가 m4a 로 바꿔 저장한다.
  // 'audio/mp4'(코덱 미지정)는 크롬에서 opus-in-mp4 가 될 수 있어 webm 뒤로 뺐다.
  const VOICE_MAX_SECONDS = 300;

  const getSupportedMimeType = (): string => {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
      'audio/mp4;codecs=mp4a.40.2',
      'audio/webm;codecs=opus',
      'audio/webm',
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
      let mr: MediaRecorder;
      try {
        mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      } catch {
        // isTypeSupported 는 true 인데 실제 생성이 거절되는 웹뷰가 있다 → 기기 기본 형식으로
        mr = new MediaRecorder(stream);
      }
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        // 실제로 녹음된 형식(mr.mimeType)을 붙인다 — 고른 후보와 다를 수 있다(서버가 형식을 추정하는 힌트)
        const recordedType = mr.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: recordedType });
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

        // 서버 업로드 후 WebSocket 전송 — 방 id 는 prop(PC 임베드는 주소가 /chat 이라 주소창으로는 못 찾는다)
        const roomId = currentRoomId();
        if (!roomId || roomId === 'chat' || roomId.startsWith('pending-')) {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
          toast.error('대화방이 아직 준비되지 않았어요. 잠시 후 다시 녹음해 주세요.');
          return;
        }
        import('@/lib/api/chat.api').then(({ chatApi }) => {
          chatApi.uploadAudio(roomId, blob, recordedType)
            .then(async (res) => {
              const audioUrl = res.data.url || res.data.audioUrl || res.data.imageUrl;
              if (!audioUrl) throw new Error('업로드 주소를 받지 못했어요');

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
              // 서버가 준 한국어 사유(예: '음성 메시지가 너무 길어요')가 있으면 그걸 보여 준다
              const serverMsg = err?.response?.data?.message;
              const raw = Array.isArray(serverMsg) ? serverMsg[0] : serverMsg || err?.message;
              const detail = raw ? ` (${String(raw).slice(0, 60)})` : '';
              toast.error(`음성 전송 실패${detail} · 다시 녹음해 주세요`);
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
        const sec = Math.floor((Date.now() - recordingStartRef.current) / 1000);
        setRecordingTime(sec);
        // 최대 5분 — 넘으면 지금까지 녹음한 걸 보낸다(서버 음성 한도·업로드 시간 보호)
        if (sec >= VOICE_MAX_SECONDS && mediaRecorderRef.current === mr && mr.state === 'recording') {
          toast('음성은 최대 5분까지 보낼 수 있어요. 지금까지 녹음한 걸 보낼게요.', { icon: '🎙️' });
          stopRecording(false);
        }
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

  // 입력창 스마일 버튼 → 이모티콘 시트
  useEffect(() => {
    onRegisterStickers?.(() => {
      setShowAttach(false);
      setShowStickers(true);
    });
  }, []);

  // ─── + 시트 '최근 사진' ───
  // 웹은 기기 사진첩을 직접 못 읽으니, 전체보기·앨범으로 고른 사진/영상을 이 줄에 모아(번호 표시) 한 번에 보낸다.
  const [picked, setPicked] = useState<{ id: string; file: File; url: string; video: boolean }[]>([]);
  const pickRef = useRef<HTMLInputElement | null>(null);
  const clearPicked = () =>
    setPicked((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return [];
    });
  const addPicked = (files: File[]) =>
    setPicked((prev) =>
      [
        ...prev,
        ...files.map((f) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file: f,
          url: URL.createObjectURL(f),
          video: f.type.startsWith('video/'),
        })),
      ].slice(0, 10),
    );
  const removePicked = (id: string) =>
    setPicked((prev) => {
      const hit = prev.find((p) => p.id === id);
      if (hit) URL.revokeObjectURL(hit.url);
      return prev.filter((p) => p.id !== id);
    });
  const sendPicked = async () => {
    const files = picked.map((p) => p.file);
    setShowAttach(false);
    clearPicked();
    for (const f of files) await handleImageSend(f);
  };
  useEffect(() => {
    if (!showAttach && picked.length) clearPicked();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAttach]);

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
    // 용량 가드 — 플랫폼별로 다르다.
    // iOS: 50MB. 네이티브 base64 청크 브릿지(nativeMedia*) + 웹 재조립 이중 적재로
    //      WKWebView WebContent 메모리 한도를 넘어 앱이 튕겼다(업로드 중 크래시 QA).
    // 그 외(안드로이드/데스크톱): 서버 multer 한도와 동일한 100MB.
    //      안드는 base64 재조립 없이 FormData 멀티파트로 바로 올라가 메모리 문제가 없는데도
    //      iOS용 50MB 캡을 같이 맞고 있었다. 갤럭시 기본 촬영(FHD30 ≈ 17Mbps)은 약 24초,
    //      4K30(≈48Mbps)은 8초면 50MB를 넘어 "안드에서 동영상 전송이 안 된다"의 원인이었다.
    // ※ 서버 한도(apps/api/src/chat/chat.controller.ts: FileInterceptor 100MB)를 넘기면
    //   토스트가 아니라 multer LIMIT_FILE_SIZE 로 정체불명 오류가 나므로 반드시 동일하게 유지.
    const isIosApp = typeof document !== 'undefined' && document.documentElement.dataset.platform === 'ios';
    const maxBytes = (isIosApp ? 50 : 100) * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(`${label}은 ${isIosApp ? 50 : 100}MB 이하만 전송할 수 있습니다`);
      return;
    }
    // 방이 아직 준비 전(pending-)이면 낙관적 메시지를 넣기 전에 차단 — 안 그러면 멈춘 0% 버블이 남음
    const roomId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : '';
    if (!roomId || roomId.startsWith('pending-')) {
      toast.error('채팅방을 준비 중입니다. 잠시 후 다시 시도해주세요');
      return;
    }
    const tempId = `tmp-${Date.now()}-${Math.round(file.size % 100000)}`;
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
    // 1) 변환을 먼저 — 낙관적 미리보기를 blob(네이티브에서 렌더 불안정) 대신 "항상 렌더되는 data URL" 로.
    //    이미지: 캔버스 JPEG 재인코딩(HEIC/빈mime/대용량 해결, onload+4초 타임아웃으로 hang 방지).
    //    동영상: 원본 + mime 보정.
    let dataUrl: string;
    try {
      if (isVideo) {
        // 동영상: 거대 base64(readAsDataURL)는 대용량에서 OOM/hang → 가벼운 blob URL 로 미리보기.
        //   (전송 자체는 아래 uploadMedia 가 원본 파일을 바이너리로 올림. 성공 시 /uploads 로 교체.)
        dataUrl = URL.createObjectURL(file);
      } else {
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
    } catch (e: any) {
      toast.error(`${label} 처리 실패: ${e?.message || ''}`);
      return;
    }

    // 2) 낙관적 메시지 — 변환된 data URL(확실히 렌더됨) + 업로드 진행률(원형)
    setMessages((prev) => [...prev, {
      id: tempId,
      senderId: MY_ID,
      content: dataUrl,
      type: msgType,
      createdAt: new Date().toISOString(),
      isRead: false,
      isNew: true,
      uploadProgress: 0,
      uploadBytesTotal: file.size,
    }]);

    try {
      // 3) 바이너리 멀티파트 업로드 → URL 획득. (WKWebView 가 큰 base64 JSON 본문을 중간에
      //    끊어 'request aborted' 나던 문제 회피: 미디어는 멀티파트로 올리고 메시지는 URL 만 전송.)
      const up = await chatApi.uploadMedia(roomId, file, msgType, {
        onUploadProgress: (e) => {
          if (!e.total) return;
          const pct = Math.min(99, Math.round((e.loaded / e.total) * 100));
          setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, uploadProgress: pct } : m));
        },
      });
      const mediaUrl = (up.data as any)?.url;
      if (!mediaUrl) throw new Error('업로드 URL 을 받지 못했습니다');
      // 4) 작은 본문(content=URL)으로 메시지 전송 → WKWebView 안정
      const resp = await chatApi.sendMessage(roomId, { type: msgType, content: mediaUrl });
      const saved = resp.data as any;
      setMessages((prev) => {
        if (prev.some((m) => m.id === saved.id)) return prev.filter((m) => m.id !== tempId);
        return prev.map((m) => m.id === tempId ? {
          ...m,
          id: saved.id,
          // 이미지: data URL 미리보기 유지(확실히 렌더). 동영상: 서버 /uploads URL 로 교체(Range 재생).
          content: isVideo ? (saved.content || mediaUrl) : m.content,
          createdAt: saved.createdAt || m.createdAt,
          type: (saved.type as Message['type']) || msgType,
          isNew: false,
          uploadProgress: undefined,
          uploadBytesTotal: undefined,
        } : m);
      });
      useChatStore.getState().fetchRooms({ limit: 50, force: true }).catch(() => {});
    } catch (e: any) {
      toast.error(`${label} 전송 실패: ${e?.response?.data?.message || e?.message || ''}`);
      // 사진/영상이 "떴다 사라짐" 방지: 실패해도 버블을 지우지 않고 data URL(확실히 렌더됨)을
      // 유지한 채 '전송 실패·탭하여 재시도' 상태로 둔다. (재시도는 page.tsx retryFailedMedia)
      setMessages((prev) => prev.map((m) => m.id === tempId
        ? { ...m, uploadProgress: undefined, uploadBytesTotal: undefined, uploadFailed: true }
        : m));
    }
  };

  // 파일 선택 인풋 열기 — 안드 웹뷰는 DOM 에 안 붙은(detached) input.click() 을 무시하는
  // 기기가 있어(갤럭시 동영상/파일 안 열림) 반드시 body 에 붙였다가 정리한다.
  const pickFilesViaInput = (opts: { accept?: string; multiple?: boolean; capture?: string }, onFiles: (files: File[]) => void) => {
    // 이전에 열었다가 사용자가 취소한 인풋이 5분간 DOM 에 남아 있었다.
    // 안드 셸이 앞선 파일선택 콜백을 아직 물고 있으면 새 요청을 무시해 '떴다 안 떴다' 로 보인다 → 먼저 치운다.
    document.querySelectorAll('input[data-ft-picker]').forEach((el) => el.remove());

    const inp = document.createElement('input');
    inp.type = 'file';
    inp.setAttribute('data-ft-picker', '1');
    if (opts.accept) inp.accept = opts.accept;
    if (opts.multiple) inp.multiple = true;
    if (opts.capture) inp.setAttribute('capture', opts.capture);
    inp.style.position = 'fixed';
    inp.style.left = '-9999px';
    inp.style.width = '1px';
    inp.style.height = '1px';
    inp.style.opacity = '0';
    const cleanup = () => { try { inp.remove(); } catch {} };
    inp.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      cleanup();
      if (files.length) onFiles(files);
    };
    document.body.appendChild(inp);
    inp.click();
    // 취소 시 leak 방지 (안드/iOS 는 cancel 이벤트가 안 와서 지연 정리)
    setTimeout(cleanup, 5 * 60_000);
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
      // 바이너리 멀티파트 업로드 → URL (WKWebView base64 본문 끊김 회피), 이후 content=URL 로 전송
      const up = await chatApi.uploadMedia(roomId, file, 'file', {
        onUploadProgress: (e) => {
          if (!e.total) return;
          const pct = Math.min(99, Math.round((e.loaded / e.total) * 100));
          setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, uploadProgress: pct } : m));
        },
      });
      const mediaUrl = (up.data as any)?.url;
      if (!mediaUrl) throw new Error('업로드 URL 을 받지 못했습니다');
      const resp = await chatApi.sendMessage(roomId, {
        type: 'file',
        content: mediaUrl,
        metadata: { fileName: file.name, fileSize: file.size, mimeType: file.type },
      });
      const saved = resp.data as any;
      setMessages((prev) => {
        if (prev.some((m) => m.id === saved.id)) return prev.filter((m) => m.id !== tempId);
        return prev.map((m) => m.id === tempId ? {
          ...m,
          id: saved.id,
          content: saved.content || mediaUrl,
          isNew: false,
          uploadProgress: undefined,
          uploadBytesTotal: undefined,
        } : m);
      });
      useChatStore.getState().fetchRooms({ limit: 50, force: true }).catch(() => {});
      toast.success(`${file.name} 전송 완료`);
    } catch (e: any) {
      toast.error(`파일 전송 실패: ${e?.response?.data?.message || e?.message || ''}`);
      // 실패해도 버블 유지(파일칩 + '전송 실패·재시도'), 지우지 않음
      setMessages((prev) => prev.map((m) => m.id === tempId
        ? { ...m, uploadProgress: undefined, uploadBytesTotal: undefined, uploadFailed: true }
        : m));
    }
  };

  // 위치(장소) 전송(261012) — 장소명·주소를 metadata 에 덧붙인다(latitude/longitude 키 의미는 그대로, 옛 앱 호환).
  //  · 본문(content)은 사람이 읽을 글(장소명 > 주소 > '내 위치를 공유했습니다') — 옛 앱·목록에도 그 글이 보인다.
  //  · 스토어가 null(방 접속 전)이거나 실패하면 REST 로 한 번 더 — 같은 clientMessageId 라 서버가 중복을 걸러 준다.
  //  · 성공 여부를 돌려준다(시트는 실패면 닫지 않고 그대로 — 다시 누르면 된다).
  const sendLocationMessage = async (
    lat: number | undefined,
    lng: number | undefined,
    info?: { placeName?: string; address?: string },
  ): Promise<boolean> => {
    const hasCoord = isValidLatLng(lat, lng);
    const placeName = (info?.placeName || '').trim().slice(0, 100) || undefined;
    const address = (info?.address || '').trim().slice(0, 200) || undefined;
    if (!hasCoord && !placeName && !address) {
      toast.error('보낼 장소를 골라 주세요');
      return false;
    }
    const content = locationContent(placeName, address);
    const metadata: Record<string, unknown> = {
      ...(hasCoord ? { latitude: Number(lat), longitude: Number(lng) } : {}),
      ...(placeName ? { placeName } : {}),
      ...(address ? { address } : {}),
      clientMessageId: `cm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    };
    const payload = { type: 'location', content, metadata };
    let saved: any = null;
    let lastErr: any = null;
    try {
      saved = await useChatStore.getState().sendMessage(payload);
    } catch (e) {
      lastErr = e;
    }
    if (!saved) {
      const rid = currentRoomId();
      if (rid && rid !== 'chat' && !rid.startsWith('pending-')) {
        try {
          saved = (await chatApi.sendMessage(rid, payload)).data;
        } catch (e) {
          lastErr = e;
        }
      }
    }
    if (!saved?.id) {
      const detail = lastErr?.response?.data?.message || lastErr?.message || '';
      toast.error(`위치 전송 실패${detail ? ` (${String(detail).slice(0, 60)})` : ''} · 잠시 후 다시 시도해 주세요`);
      return false;
    }
    setMessages((prev) => prev.some((m) => m.id === saved.id) ? prev : [...prev, {
      id: saved.id,
      senderId: saved.senderId,
      content: saved.content || content,
      type: 'location',
      createdAt: saved.createdAt,
      isRead: saved.isRead,
      isNew: true,
      latitude: hasCoord ? Number(lat) : undefined,
      longitude: hasCoord ? Number(lng) : undefined,
      placeName,
      address,
    }]);
    useChatStore.getState().fetchRooms({ limit: 50, force: true }).catch(() => {});
    toast.success('장소를 보냈어요');
    return true;
  };

  // 이모티콘 전송 — 업로드 없이 사이트에 있는 스티커 URL 을 그대로 보낸다.
  // 렌더는 isChatStickerUrl 로 판별해 말풍선/전체보기 없이 이미지만 띄운다.
  const sendStickerMessage = async (src: string) => {
    setShowStickers(false);
    const saved = await useChatStore.getState().sendMessage({
      type: 'image',
      content: src,
    }).catch(() => null);
    if (!saved) {
      toast.error('이모티콘 전송 실패');
      return;
    }
    setMessages((prev) => prev.some((m) => m.id === saved.id) ? prev : [...prev, {
      id: saved.id,
      senderId: saved.senderId,
      content: saved.content || src,
      type: 'image',
      createdAt: saved.createdAt,
      isRead: saved.isRead,
      isNew: true,
    }]);
    useChatStore.getState().fetchRooms({ limit: 50, force: true }).catch(() => {});
  };

  // '장소' — 장소 보내기 시트를 바로 연다(261012). 예전엔 현재 위치를 확인 없이 곧장 보내고,
  // 실패하면 막힌 네이버 지도 선택창으로 넘겨 갤럭시 앱에서는 늘 막다른 길이었다.
  const handleLocationSend = () => {
    setShowAttach(false);
    setShowLocationPicker(true);
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
          // ⚠️iOS 네이티브 시트에서 오는 경로는 user-gesture 없는 evaluateJavaScript 라
          // input.click() 이 무시될 수 있음 — iOS 는 네이티브 문서피커(chatBarsInvokeAttach)가 우선 처리.
          pickFilesViaInput({}, (files) => { if (files[0]) handleFileSend(files[0]); });
          break;
        }
        case 'location': handleLocationSend(); break;
        case 'audio': toast('곧 제공될 예정입니다', { icon: '🎵' }); break;
      }
    };
    const invokeMenu = (id: string) => {
      switch (id) {
        case 'search': toast('곧 제공될 예정입니다', { icon: '🔍' }); break;
        case 'mute': if (onToggleMute) onToggleMute(); else { setMuted(!muted); toast(muted ? '알림 켜짐' : '알림 꺼짐'); } break;
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
    // 네이티브 PHPicker(+버튼→사진) 가 고른 미디어를 청크 base64 로 전달 → File 재구성 후
    // 일반 업로드 경로(handleImageSend: 낙관+게이지+직접업로드)로. 한방 거대 주입/큰 본문 회피.
    //
    // 큰 영상(수십 MB)에서 "업로드 중 튕김/멈춤" 방지:
    //   예전엔 base64 전체를 join → atob → charCodeAt 루프 한 방에 처리해서
    //   (원본 30MB 기준) 40MB 문자열 + 30MB 바이너리 문자열 + 30MB TypedArray 가 동시에 살아있고
    //   메인스레드가 수 초 정지 → WKWebView 메모리 압박으로 WebContent 프로세스가 죽어 화면이 리로드됐다.
    //   지금은 청크(700KB, 4의 배수라 독립 디코딩 안전)를 받는 즉시 바이너리로 변환해 버리므로
    //   피크 메모리가 원본 크기 수준으로 떨어지고 블로킹도 잘게 쪼개진다.
    const nativeMediaBuf: Record<string, { mime: string; name: string; parts: BlobPart[] }> = {};
    const b64ChunkToBytes = (b64: string) => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    };
    const nativeMediaBegin = (id: string, mime: string, name: string) => { nativeMediaBuf[id] = { mime: mime || '', name: name || 'media', parts: [] }; };
    const nativeMediaChunk = (id: string, b64: string) => {
      const e = nativeMediaBuf[id];
      if (!e) return;
      try { e.parts.push(b64ChunkToBytes(b64)); }
      catch { delete nativeMediaBuf[id]; toast.error('미디어를 불러오지 못했습니다'); }
    };
    const nativeMediaEnd = (id: string) => {
      const e = nativeMediaBuf[id];
      if (!e) return;
      delete nativeMediaBuf[id];
      try {
        const f = new File(e.parts, e.name, { type: e.mime || 'application/octet-stream' });
        // 이미지/영상은 미디어 경로, 그 외(PDF 등)는 파일 경로로 — 네이티브 문서피커 지원
        const isMedia = /^(image|video)\//.test(f.type) || /\.(jpe?g|png|gif|webp|heic|mp4|mov|m4v|webm)$/i.test(f.name);
        if (isMedia) handleImageSend(f); else handleFileSend(f);
      } catch { toast.error('미디어를 불러오지 못했습니다'); }
    };
    w.__freetifulChatActions = {
      attachItems, menuItems, invokeAttach, invokeMenu,
      nativeMediaBegin, nativeMediaChunk, nativeMediaEnd,
      sendLocation: (lat: number, lng: number) => { void sendLocationMessage(Number(lat), Number(lng)); },
      getQuoteDefaults: () => computeQuoteDefaults(),
      // 네이티브 ⋮ → '고객 정보 보기' 모달용 — 견적서 폼과 독립적으로 고객 요청 정보 제공
      getRequestInfo: () => {
        const mr: any = roomMeta?.matchRequest;
        const lq: any = roomMeta?.latestQuotation;
        if (!mr && !lq) return null;
        const raw: any = mr?.rawUserInput && typeof mr.rawUserInput === 'object' ? mr.rawUserInput : {};
        const toTime = formatEventTime;   // 행사 시각은 벽시계 값 — 시간대 변환 금지
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
    // 네이티브 폼은 행사명을 넘겨 주고, 웹 시트는 입력칸이 없어 자동 이름
    const title = quoteEventName.trim() || autoQuoteTitle();
    try {
      const roomId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : '';
      // 1) 백엔드에 실제 Quotation 생성
      const created = await quotationApi.create({
        userId: chatPartner.id,
        amount: totalAmount,
        title,
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
        eventName: title,
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
  // 견적 시트: 채팅 입력창 포커스(모바일 키보드)를 내려 키패드가 가려지지 않게, PC 는 실제 키보드 숫자·지우기·엔터·ESC
  const quoteAmountRef = useRef('');
  quoteAmountRef.current = quoteCustomAmount;
  useEffect(() => {
    if (!showQuoteModal) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input, textarea, [contenteditable="true"]')) return;
      if (/^\d$/.test(e.key)) { e.preventDefault(); pressQuoteKey(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); pressQuoteKey('back'); }
      else if (e.key === 'Enter') {
        if (quoteAmountRef.current.replace(/\D/g, '')) { e.preventDefault(); handleSendQuoteRef.current?.(); }
      } else if (e.key === 'Escape') setShowQuoteModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showQuoteModal]);
  const computeQuoteDefaults = () => {
    const mr = roomMeta?.matchRequest;
    const lq = roomMeta?.latestQuotation;
    const raw: any = mr?.rawUserInput && typeof mr.rawUserInput === 'object' ? mr.rawUserInput : {};
    const toDate = (v: any): string => { if (!v) return ''; try { const d = new Date(v); return Number.isNaN(d.getTime()) ? (typeof v === 'string' ? v.slice(0, 10) : '') : d.toISOString().slice(0, 10); } catch { return ''; } };
    const toTime = formatEventTime;   // 행사 시각은 벽시계 값 — 시간대 변환 금지
    const plan = PLAN_DATA[quotePlan] || Object.values(PLAN_DATA)[0];
    return {
      // 행사명 기본값: '{고객명}님의 {행사 종류} 행사' — 웹 시트와 같은 규칙(네이티브 견적폼도 이 값을 사용)
      eventName: autoQuoteTitle(),
      eventDate: toDate(mr?.eventDate || lq?.eventDate || raw.date),
      eventTime: toTime(mr?.eventTime || lq?.eventTime || raw.timeStart),
      eventLocation: mr?.eventLocation || lq?.eventLocation || raw.location || '',
      planLabel: (plan as any)?.label || '',
      planPrice: (plan as any)?.price || 0,
    };
  };

  // 첨부 시트 — 컬러 원 아이콘을 한 줄씩 쌓는 대신 기능을 묶어 두 칸으로 보여준다(그룹 포커스)
  // 파일/오디오 첨부는 웹(안드) 시트에서 제거(2026-07-04 요청) — iOS 네이티브 시트는 별개(ViewController)
  const ATTACH_GROUPS: { title: string; items: { icon: JSX.Element; label: string; action: () => void }[] }[] = [
    {
      title: '사진 · 영상',
      items: [
        { icon: <img src="/icons/chat-attach/camera.svg" alt="" width={24} height={24} className="shrink-0" />, label: '카메라', action: () => { setShowAttach(false); setShowCameraChoice(true); } },
        { icon: <img src="/icons/chat-attach/picture.svg" alt="" width={24} height={24} className="shrink-0" />, label: '사진', action: () => fileInputRef.current?.click() },
        { icon: <img src="/icons/chat-attach/video.svg" alt="" width={24} height={24} className="shrink-0" />, label: '동영상', action: () => { setShowAttach(false); pickFilesViaInput({ accept: 'video/*', multiple: true }, (files) => { (async () => { for (const f of files) await handleImageSend(f); })(); }); } },
      ],
    },
    {
      title: isPro ? '업무' : '그 외',
      items: [
        ...(isPro ? [{ icon: <img src="/icons/chat-attach/quote.svg" alt="" width={24} height={24} className="shrink-0" />, label: '견적서 발송', action: () => { setShowAttach(false); setShowQuoteModal(true); } }] : []),
        { icon: <img src="/icons/chat-attach/emoji.svg" alt="" width={24} height={24} className="shrink-0" />, label: '이모티콘', action: () => { setShowAttach(false); setShowStickers(true); } },
      ],
    },
  ];

  // '카메라' 를 눌렀을 때 뜨는 2차 선택 — 사진 촬영 / 동영상 촬영
  const CAMERA_CHOICE_ITEMS = [
    { icon: <img src="/icons/chat-attach/camera.svg" alt="" width={24} height={24} className="shrink-0" />, label: '사진 촬영', action: () => { pickFilesViaInput({ accept: 'image/*', capture: 'environment' }, (files) => { if (files[0]) handleImageSend(files[0]); }); } },
    { icon: <img src="/icons/chat-attach/video.svg" alt="" width={24} height={24} className="shrink-0" />, label: '동영상 촬영', action: () => { pickFilesViaInput({ accept: 'video/*', capture: 'environment' }, (files) => { if (files[0]) handleImageSend(files[0]); }); } },
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
      {/* ─── 헤더 드롭다운 메뉴 — 툴팁 메뉴 공통(globals .pop-menu): 작게 시작해 정비율로 커지고, 항목은 오른쪽→왼쪽으로 촤라락 ─── */}
      {showHeaderMenu && (() => {
        // 알림 메뉴 어법(globals .nt-menu-item) — 왼쪽 토스 컬러 아이콘 24 · 이름 17
        const itemCls = 'pop-menu-item nt-menu-item';
        const ic = (name: string) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/icons/toss/${name}.svg`} alt="" />
        );
        return (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowHeaderMenu(false)} />
          <div className="pop-menu nt-menu absolute right-3 top-[68px] z-50 overflow-hidden" style={{ transformOrigin: 'top right' }} role="menu">
            <button onClick={() => { setShowHeaderMenu(false); if (onOpenSearch) onOpenSearch(); else toast('곧 제공될 예정입니다', { icon: '🔍' }); }} className={itemCls} style={popItemDelay(0)}>
              {ic('search')} 대화 내용 검색
            </button>
            <button onClick={() => { if (onToggleMute) onToggleMute(); else { setMuted(!muted); toast(muted ? '알림 켜짐' : '알림 꺼짐'); } setShowHeaderMenu(false); }} className={itemCls} style={popItemDelay(1)}>
              {muted ? ic('alarm') : ic('alarm-off')}
              {muted ? '알림 켜기' : '알림 끄기'}
            </button>
            {isPro ? (
              <button
                onClick={() => {
                  setShowHeaderMenu(false);
                  toast(`${chatPartner?.name || '고객'} 정보는 대화 상단 카드에서 확인할 수 있습니다`);
                }}
                className={itemCls}
                style={popItemDelay(2)}
              >
                {ic('user')} 고객 정보 보기
              </button>
            ) : (
              <Link href={`/pros/${chatPartner?.proProfileId || chatPartner?.id || ''}`} className={itemCls} style={popItemDelay(2)}>
                {ic('user')} 프로필 보기
              </Link>
            )}
            <button onClick={() => { if (confirm('대화 내용을 삭제하시겠습니까?')) { setMessages([]); toast.success('대화 삭제됨'); } setShowHeaderMenu(false); }} className={`${itemCls} danger`} style={popItemDelay(3)}>
              {ic('bin')} 대화 삭제
            </button>
          </div>
        </>
        );
      })()}

      {/* ─── 공지 바 ─── */}
      {pinnedMessage && (
        <button
          onClick={() => scrollToMessage(pinnedMessage.id)}
          style={{ top: topOffset || 72 }}
          className="absolute left-0 right-0 z-30 flex items-center gap-3 px-4 py-2.5 bg-amber-50/90 backdrop-blur border-b border-amber-100 active:bg-amber-100 transition-colors animate-[slideUp_0.3s_ease]"
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
            className="pop-menu-anim fixed z-50"
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

            {/* 말풍선 메뉴 — 알림 메뉴 어법(왼쪽 토스 컬러 아이콘 · 이름 17 · 모서리 24) */}
            <div className="pop-menu-surface nt-menu overflow-hidden">
              {[
                { label: '답장', icon: 'chat', run: () => { const msg = messages.find((m) => m.id === actionMenu.id); if (msg) handleReply(msg); } },
                { label: '복사', icon: 'copy', run: () => { const msg = messages.find((m) => m.id === actionMenu.id); if (msg) handleCopy(msg.content); } },
                { label: '부분복사', icon: 'crop', run: () => { const msg = messages.find((m) => m.id === actionMenu.id); if (msg) handlePartialCopy(msg); } },
                { label: '공지로 등록', icon: 'loudspeaker', run: () => { const msg = messages.find((m) => m.id === actionMenu.id); if (msg) handlePin(msg); } },
                { label: '신고하기', icon: 'siren', run: () => { const msg = messages.find((m) => m.id === actionMenu.id); if (msg) handleReport(msg); } },
                ...(actionMenu.mine ? [{ label: '삭제', icon: 'bin', run: () => handleDelete(actionMenu.id), danger: true }] : []),
              ].map((item, idx) => (
                <button
                  key={item.label}
                  onClick={item.run}
                  className={`pop-menu-item nt-menu-item${'danger' in item && item.danger ? ' danger' : ''}`}
                  style={popItemDelay(idx)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/icons/toss/${item.icon}.svg`} alt="" />
                  {item.label}
                </button>
              ))}
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
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
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

      {/* ─── 견적서 작성 시트 (사회자 전용) — 금액만 입력. 퀵매칭 번호 입력과 같은 큰 숫자 + 키패드.
          행사명('김예비님의 결혼식 행사')·행사일·시간·장소는 입력칸 없이 고객 매칭 요청 값으로 자동. ─── */}
      {showQuoteModal && (() => {
        const digits = quoteCustomAmount.replace(/\D/g, '');
        const amount = digits ? Number(digits) : 0;
        return (
        <>
          <div
            className="fixed inset-0 z-40 animate-[fadeIn_0.25s_ease] bg-black/30 lg:bg-transparent"
            onClick={() => setShowQuoteModal(false)}
          />
          <div
            className="chs-sheet fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] bg-white pb-safe shadow-[0_-8px_32px_rgba(0,0,0,0.08)] lg:absolute lg:bottom-[72px] lg:left-[max(12px,calc((100%_-_680px)/2_+_12px))] lg:right-auto lg:max-h-[calc(100%-96px)] lg:w-[380px] lg:overflow-y-auto lg:rounded-[28px] lg:shadow-[0_16px_48px_rgba(15,23,42,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2.5 h-[5px] w-10 rounded-full bg-[#D1D6DB] lg:hidden" />
            <div className="px-6 pt-6">
              <h2 className="chs-title text-[24px] font-semibold leading-[1.4] tracking-[-0.4px] text-[#191F28]">견적 금액을 입력해주세요</h2>
              <p className="chs-title mt-2.5 truncate text-[15px] leading-[1.5] text-[#8B95A1]" style={{ animationDelay: '0.2s' }}>
                {autoQuoteTitle()}
              </p>
              <div
                className={`chs-item mt-11 border-b-2 pb-4 transition-colors duration-150 ${digits ? 'border-[#3182F6]' : 'border-[#E5E8EB]'}`}
                style={{ animationDelay: '0.26s' }}
              >
                <span className="flex items-center text-[28px] font-semibold leading-none tracking-[0.5px]">
                  <span className={digits ? 'text-[#191F28]' : 'text-[#B0B8C1]'}>{digits ? `${amount.toLocaleString('ko-KR')}원` : '0원'}</span>
                  <i aria-hidden="true" className="ml-[2px] block h-7 w-[2px] bg-[#3182F6]" style={{ animation: 'chsCaret 1s step-end infinite' }} />
                </span>
              </div>
              {/* 큰 금액 오타 방지 — '49만원' 처럼 읽어 준다 */}
              <p className="mt-2 h-5 text-[14px] text-[#8B95A1]">{amount >= 10000 ? toKoreanWon(amount) : ''}</p>
            </div>
            <div className="px-5 pb-2.5 pt-5">
              <button
                type="button"
                onClick={handleSendQuote}
                disabled={!amount || quoteSending}
                className={`flex h-14 w-full items-center justify-center gap-2 rounded-[17px] text-[17px] font-semibold transition-[transform,background-color] duration-150 ${
                  !amount
                    ? 'bg-[#F2F4F6] text-[#B0B8C1]'
                    : quoteSending
                      ? 'bg-[#3182F6] text-white opacity-80'
                      : 'bg-[#3182F6] text-white active:scale-[0.99] active:bg-[#2272EB]'
                }`}
              >
                {quoteSending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {quoteSending ? '견적서 발송 중…' : '견적서 발송'}
              </button>
            </div>
            <div className="grid grid-cols-3 pb-1.5">
              {QUOTE_KEYS.map((k, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={k === 'back' ? '지우기' : k || undefined}
                  disabled={!k}
                  onClick={() => k && pressQuoteKey(k)}
                  className={`mx-1.5 my-0.5 flex h-[62px] items-center justify-center rounded-[14px] text-[26px] font-medium text-[#191F28] transition-colors duration-100 ${
                    k ? 'active:bg-[#F2F4F6] lg:hover:bg-[#F9FAFB]' : 'pointer-events-none'
                  }`}
                >
                  {k === 'back' ? <TintIcon src="/quick-match/icons/backspace.svg" color="#191F28" size={26} /> : k}
                </button>
              ))}
            </div>
          </div>
        </>
        );
      })()}

      {/* ─── 첨부 메뉴(+) — 당근마켓 시트 레이아웃, 색만 파랑 ───
          등장: 시트 아래→위, '최근 갤러리' 제목 아래→위 페이드, 나머지는 오른쪽→왼쪽 슬라이드(chs-* — page.tsx 스타일) */}
      {showAttach && (() => {
        const ACTIONS = [
          { key: 'album', label: '앨범', icon: 'gallery', color: '#4E5968', action: () => pickRef.current?.click() },
          { key: 'emoji', label: '이모티콘', icon: 'emoji', color: '#3182F6', action: () => { setShowAttach(false); setShowStickers(true); } },
          { key: 'place', label: '장소', icon: 'pin', color: '#15B86C', action: () => handleLocationSend() },
          ...(isPro
            ? [{ key: 'quote', label: '견적서', icon: 'quote', color: '#3182F6', action: () => { setShowAttach(false); setShowQuoteModal(true); } }]
            : []),
          { key: 'voice', label: '음성', icon: 'mic', color: '#3182F6', action: () => { setShowAttach(false); startRecording(); } },
        ];
        // 보내기 → 카메라 → 전체보기 → 원형 버튼 순서로 살짝씩 늦게
        const slide = (order: number) => ({ animationDelay: `${0.18 + order * 0.045}s` });
        return (
        <>
          <div
            className="fixed inset-0 z-40 animate-[fadeIn_0.25s_ease] bg-black/30 lg:bg-transparent"
            onClick={() => setShowAttach(false)}
          />
          <div
            className="chs-sheet fixed bottom-0 left-0 right-0 z-50 rounded-t-[32px] bg-white pb-safe shadow-[0_-8px_32px_rgba(0,0,0,0.08)] lg:absolute lg:bottom-[72px] lg:left-[max(12px,calc((100%_-_680px)/2_+_12px))] lg:right-auto lg:w-[400px] lg:rounded-[28px] lg:shadow-[0_16px_48px_rgba(15,23,42,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2.5 h-[5px] w-10 rounded-full bg-[#D1D6DB] lg:hidden" />
            <div className="flex items-center justify-between px-5 pb-3 pt-4">
              <p className="chs-title text-[19px] font-bold text-[#191F28]">최근 갤러리</p>
              <button
                type="button"
                disabled={!picked.length}
                onClick={sendPicked}
                style={slide(0)}
                className={`chs-item h-9 rounded-full px-4 text-[15px] font-bold transition-colors ${
                  picked.length ? 'bg-[#3182F6] text-white active:bg-[#1B64DA]' : 'bg-[#F2F4F6] text-[#C4C9D0]'
                }`}
              >
                보내기{picked.length ? ` ${picked.length}` : ''}
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto px-5 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                aria-label="카메라"
                onClick={() => { setShowAttach(false); setShowCameraChoice(true); }}
                style={slide(1)}
                className="chs-item flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-[18px] bg-[#F2F4F6] transition-transform active:scale-95"
              >
                <TintIcon src="/icons/chat-kr/camera.svg" color="#191F28" size={30} />
              </button>
              {picked.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  aria-label={`선택한 ${p.video ? '영상' : '사진'} ${i + 1} 빼기`}
                  onClick={() => removePicked(p.id)}
                  className="chs-item relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[18px] bg-[#F2F4F6]"
                >
                  {p.video ? (
                    <video src={p.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.url} alt="" className="h-full w-full object-cover" />
                  )}
                  <span className="absolute right-1.5 top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-white bg-[#3182F6] text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => pickRef.current?.click()}
                style={slide(2)}
                className="chs-item flex h-[88px] w-[88px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-[18px] bg-[#F2F4F6] transition-transform active:scale-95"
              >
                <TintIcon src="/icons/chat-kr/gallery.svg" color="#4E5968" size={26} />
                <span className="text-[13.5px] font-medium text-[#4E5968]">전체보기</span>
              </button>
            </div>
            <div className="grid grid-cols-4 gap-y-5 px-2 pb-8">
              {ACTIONS.map((a, idx) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={a.action}
                  style={slide(3 + idx)}
                  className="chs-item flex flex-col items-center gap-2 transition-transform active:scale-95"
                >
                  <span className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#F4F5F7]">
                    <TintIcon src={`/icons/chat-kr/${a.icon}.svg`} color={a.color} size={28} />
                  </span>
                  <span className="text-[14.5px] text-[#4E5968]">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
        );
      })()}

      {/* ─── 이모티콘 시트 ─── */}
      {showStickers && (
        <>
          <div
            className="fixed inset-0 z-40 animate-[fadeIn_0.25s_ease] bg-black/10 backdrop-blur-[2px] lg:bg-transparent lg:backdrop-blur-none"
            onClick={() => setShowStickers(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] bg-white/95 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.1)] backdrop-blur-2xl lg:absolute lg:bottom-[72px] lg:left-[max(12px,calc((100%_-_680px)/2_+_12px))] lg:right-auto lg:w-[380px] lg:origin-bottom-left lg:animate-[menuPop_0.22s_cubic-bezier(0.34,1.56,0.64,1)] lg:rounded-[24px] lg:pb-2 lg:shadow-[0_16px_48px_rgba(15,23,42,0.18)]"
            style={{ animation: 'sheetUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <div className="mx-auto mb-2 mt-3 h-1 w-10 rounded-full bg-gray-300 lg:hidden" />
            <div className="max-h-[55vh] overflow-y-auto px-4 pb-6 lg:max-h-[320px] lg:pb-3 lg:pt-4">
              <div className="grid grid-cols-4 gap-2">
                {CHAT_STICKERS.map((sticker, idx) => (
                  <button
                    key={sticker.id}
                    onClick={(e) => { e.stopPropagation(); sendStickerMessage(sticker.src); }}
                    className="aspect-square rounded-2xl p-1.5 active:scale-90 hover:bg-gray-100/70 transition-all"
                    style={{ animation: `attachItemUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.02}s both` }}
                  >
                    <img src={sticker.src} alt={sticker.alt} draggable={false} className="w-full h-full object-contain select-none" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ─── 카메라 선택 (사진 촬영 / 동영상 촬영) ─── */}
      {showCameraChoice && (
        <>
          <div
            className="fixed inset-0 z-40 animate-[fadeIn_0.25s_ease] bg-black/10 backdrop-blur-[2px] lg:bg-transparent lg:backdrop-blur-none"
            onClick={() => setShowCameraChoice(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] bg-white/95 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.1)] backdrop-blur-2xl lg:absolute lg:bottom-[72px] lg:left-[max(12px,calc((100%_-_680px)/2_+_12px))] lg:right-auto lg:w-[380px] lg:origin-bottom-left lg:animate-[menuPop_0.22s_cubic-bezier(0.34,1.56,0.64,1)] lg:rounded-[24px] lg:pb-2 lg:shadow-[0_16px_48px_rgba(15,23,42,0.18)]"
            style={{ animation: 'sheetUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <div className="mx-auto mb-4 mt-3 h-1 w-10 rounded-full bg-gray-300 lg:hidden" />
            <div className="px-4 pb-6 lg:pb-3 lg:pt-4">
              <p className="mb-1 px-2 text-[13px] font-medium text-gray-400">카메라</p>
              {CAMERA_CHOICE_ITEMS.map((item, idx) => (
                <button
                  key={item.label}
                  onClick={(e) => { e.stopPropagation(); setShowCameraChoice(false); item.action(); }}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition-all hover:bg-gray-100/60 active:scale-[0.98]"
                  style={{ animation: `attachItemUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.05}s both` }}
                >
                  <span className="shrink-0 text-[#2B313D]">{item.icon}</span>
                  <span className="text-[16px] font-medium text-gray-900">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ─── 이미지 전체보기 (포털 + 화면맞춤 + 실패 폴백) ─── */}
      {imagePreview && <ChatImageViewer url={imagePreview} onClose={() => setImagePreview(null)} />}

      {/* ─── 위치 선택 모달 ─── */}
      {showLocationPicker && (
        <PlacePickerSheet
          onSend={(p) => sendLocationMessage(p.lat, p.lng, { placeName: p.placeName, address: p.address })}
          onClose={() => setShowLocationPicker(false)}
        />
      )}

      {/* ─── 부분복사 모달 — 공통 시트(ft-*) ─── */}
      {partialCopyMsg && (
        <div className="ft-scrim" onClick={() => setPartialCopyMsg(null)}>
          <div
            className="ft-sheet"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ft-grab" aria-hidden="true" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold tracking-wider text-gray-400">PARTIAL COPY</p>
                <h3 className="ft-title">부분복사</h3>
              </div>
              <button onClick={() => setPartialCopyMsg(null)} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center active:scale-90 transition-transform">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <p className="ft-desc">텍스트를 드래그하여 복사할 부분을 선택하세요</p>
            <div className="mt-4">
              <p
                className="text-[15px] leading-[1.7] text-gray-900 whitespace-pre-wrap bg-gray-50 rounded-2xl p-4 max-h-[40vh] overflow-y-auto select-text border border-gray-100"
                style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
              >
                {partialCopyMsg.content}
              </p>
            </div>
            <div className="ft-actions">
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
                className="ft-btn primary"
              >
                <Copy size={16} />
                선택한 부분 복사
              </button>
              {/* 취소는 글자 폭만 — 반반이면 폰에서 '선택한 부분 복사'가 두 줄로 꺾임 */}
              <button
                onClick={() => setPartialCopyMsg(null)}
                className="ft-btn secondary !flex-none"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 숨겨진 파일 인풋 — 사진/동영상 다중 선택 가능 */}
      {/* 사진=이미지 전용(image/*) — 안드는 image/*+video/* 혼합 accept 면 갤러리 대신 카메라/파일 선택기가
          뜨고 다중선택도 안 되던 문제. 영상은 별도 '동영상' 메뉴(video/*)로 분리. */}
      {/* '사진' 탭 — 앨범에 있는 사진과 동영상을 함께 고를 수 있어야 한다 */}
      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { const input = e.target; const files = Array.from(input.files || []); (async () => { try { for (const f of files) await handleImageSend(f); } finally { input.value = ''; } })(); }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const input = e.target; const f = input.files?.[0]; if (!f) return; (async () => { try { await handleImageSend(f); } finally { input.value = ''; } })(); }} />
      {/* + 시트 '앨범·전체보기' — 바로 보내지 않고 '최근 사진' 줄에 번호 붙여 모은 뒤 시트의 보내기로 한 번에 */}
      <input
        ref={pickRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = '';
          if (files.length) addPicked(files);
        }}
      />

      {/* ─── Recording UI (input bar replacement handled by parent, but we provide startRecording/stopRecording) ─── */}
      {/* The recording bar is rendered in the parent page.tsx since it replaces the input bar */}
    </>
  );
}
