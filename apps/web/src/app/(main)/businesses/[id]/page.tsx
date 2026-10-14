'use client';

// 웨딩 파트너(업체) 상세 — 260926 사장 "상세페이지 사진 갤러리랑 지도, 문의 버튼 넣어서 알차게".
//  (한때 웨딩숲 계층으로 바꿨다가 사장 "상세 말고 리스트 페이지를 말한 것" → 이 사진 색 버전으로 되돌림. 지도 버튼만 브랜드 색 유지)
//  · 맨 위 = 사진 넘겨보기(4:3, 쓸어 넘김 · N/M · 누르면 크게) → 아래쪽이 대표 사진에서 뽑은 색(lib/image-tone)으로 녹아
//    이름 칸으로 이어진다(홈 '사진 색 카드'와 같은 결).
//  · 이름 칸: 분야 · 이름 24 · 한 줄 소개(카카오 자동 등록 문구는 숨김) · 지역 | 사진 N장 · 흰 반투명 칩
//  · 바로가기(문의 · 길찾기 · 인스타그램/웹사이트 · 공유) → 사진 모아보기(3열, 마지막 칸 +N) → 위치(네이버 지도 칸 · 카카오맵/네이버 지도 단추 · 주소 복사)
//    → 업체 정보
//  · 위치 지도(261012 사장 '네이버 다이나믹맵 전부 다 적용') — 구글 지도 임베드 → 네이버 지도(components/map/NaverMap, 고정 칸 196px).
//    업체 좌표에 핀 · 좌표가 없으면 주소를 우리 프록시(/api/naver-map/geocode)로 좌표로 바꿔 찍는다. 지역만 적힌 곳('서울/경기')은 칸을 처음부터 안 두고,
//    주소로 찾아봤는데 못 찾은 곳(브랜미처럼 네이버 주소 검색 0건 · 두 번 다 실패)은 같은 높이의 주소 카드(누르면 네이버 장소 검색)로 바꾼다
//    — 자리표시 칸이 통째로 사라져 아래 단추가 튀어 오르지 않게(261012 검수).
//    칸을 누르면 네이버 지도(그 자리 핀). 길찾기 = 네이버 길찾기(도착지 채움). 바깥 지도 링크는 안드로이드 앱(2.0.6)에서 intent:// 로 넘긴다
//    (웹뷰 안에서 열면 지도 웹이 nmap:// · kakaomap:// 를 열다 '웹페이지를 사용할 수 없음').
//  · 아래 고정 '문의하기' → 시트(이름·연락처·문의 종류 칩·희망 시기·내용) → API POST /business-inquiries
//    (source 'wedding_partner' — 관리자 문의함 + 관리자 알림톡). 전화 버튼은 예전 결정대로 숨김(오류 이슈).
//  · iOS 앱은 이 화면을 네이티브로 그린다(웹 수정 미반영).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
// 아이콘 = 사장 제공 토스 mono 세트(260926 "상세페이지 아이콘 이걸로 다 교체")
import {
  TossBackIcon,
  TossCameraIcon,
  TossChatBubbleIcon,
  TossCheckIcon,
  TossChevronRightIcon,
  TossCloseIcon,
  TossCopyIcon,
  TossDirectionIcon,
  TossEarthIcon,
  TossPictureIcon,
  TossPinIcon,
  TossShareBoxIcon,
} from '@/components/icons/TossMonoIcons';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth.store';
import { useImageTone } from '@/lib/image-tone';
import { useKeyboardInset } from '@/lib/useKeyboardInset';
import { readSafeTop, useNativeStatusBar } from '@/lib/safe-area';
import {
  deriveBusinessTagSuggestions,
  extractBusinessTagsFromHtml,
  normalizeBusinessTags,
  stripBusinessTagMarker,
} from '@/lib/business-tags';
import {
  getWeddingPartnerImageSet,
  getWeddingPartnerSectionCategories,
  mergeWeddingPartnerImages,
} from '@/lib/wedding-partner-images';
import { getRelevantBusinessCategories, isBusinessRelevantToAnyCategory, sanitizeBusinessImageUrls } from '@/lib/business-quality';
import { extractHallInfo } from '@/lib/business-hall-info';
import PartnerLanding from '@/components/business/partner-landing/PartnerLanding';
import { buildPartnerFacts } from '@/components/business/partner-landing/partner-facts';
import NaverMap from '@/components/map/NaverMap';
import { isInKorea, toFiniteNumber, type LatLngLiteral } from '@/lib/naver-map-shared';
import { naverMapLinkProps, openExternalMapLink } from '@/lib/naver-map-links';
import { fetchMapJson } from '@/lib/naver-map';

interface BizDetail {
  id: string;
  businessName: string;
  address: string | null;
  addressDetail?: string | null;
  lat?: string | number | null;
  lng?: string | number | null;
  phone: string | null;
  instagramUrl?: string | null;
  websiteUrl?: string | null;
  descriptionHtml?: string | null;
  businessType?: string | null;
  tags?: string[];
  categories: Array<{ category: { name: string } }>;
  images: Array<{ imageUrl: string }>;
}

/** 사진 아래쪽을 이름 칸 색으로 녹이는 그라데이션(사진 위에 얹는다 — 넘겨도 그대로) */
const heroFade = (bg: string) => `linear-gradient(to bottom, rgba(0,0,0,0) 55%, ${bg} 100%)`;

/** 카카오 자동 등록 소개('…은(는) 카카오맵 지역검색 기준으로 등록된 … 파트너입니다. 주소 … 카카오 카테고리 …')는 손님에게 의미가 없어 숨긴다 */
function readableIntro(html?: string | null) {
  const text = String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').trim();
  if (!text || /카카오맵 지역검색 기준으로 등록된/.test(text)) return '';
  return text;
}

function shortRegion(address?: string | null) {
  const parts = String(address || '').trim().split(/\s+/);
  return parts.slice(0, 2).join(' ');
}

/* ─── 위치 지도 도우미(261012 사장 '네이버 다이나믹맵 전부 다 적용') ─────────────────── */

/** 업체에 저장된 좌표(문자열 Decimal) — 대한민국 밖 · 0,0 · 빈 값이면 null(주소로 다시 찾는다) */
function storedPoint(lat: unknown, lng: unknown): LatLngLiteral | null {
  const la = toFiniteNumber(lat);
  const ln = toFiniteNumber(lng);
  return la != null && ln != null && isInKorea(la, ln) ? { lat: la, lng: ln } : null;
}

/**
 * 좌표로 바꿔 볼 주소 — 번지 숫자가 없는 지역만 적힌 곳('서울/경기' · '서울 강남구')은 묻지 않는다(네이버 주소 검색은 0건이거나 엉뚱한 곳).
 * 뒤에 붙은 층·호수('6층' · 'C동 412호')는 네이버 주소 검색이 알아서 무시한다(261012 실측). 프록시 한도 80자.
 */
function geocodeQuery(address?: string | null): string {
  const s = String(address || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.length < 5 || !/\d/.test(s)) return '';
  return s.slice(0, 80).trim();
}

type GeoState = { status: 'idle' | 'loading' | 'found' | 'missing'; point: LatLngLiteral | null };

/**
 * 좌표 없는 업체 — 주소 → 좌표(우리 프록시 /api/naver-map/geocode, CDN 7일 캐시).
 * 한 번에 8초(SDK 로딩 한도와 같음), 망 오류 · 시간 초과 · 5xx 면 2.5초 뒤 한 번 더(261012 검수: 붐비는 서버에서 한 번 끊기면 지도 칸이 사라졌다).
 * 그래도 못 받거나 0건이면 '못 찾음'.
 */
function useGeocodedPoint(query: string): GeoState {
  const [result, setResult] = useState<{ query: string; point: LatLngLiteral | null } | null>(null);
  useEffect(() => {
    if (!query) return;
    let alive = true;
    const ctrl = new AbortController();
    fetchMapJson<{ results?: Array<{ lat?: unknown; lng?: unknown }> }>(`/api/naver-map/geocode?query=${encodeURIComponent(query)}`, { signal: ctrl.signal })
      .then((d) => {
        if (!alive) return;
        const first = d?.results?.[0];
        setResult({ query, point: first ? storedPoint(first.lat, first.lng) : null });
      })
      .catch(() => { if (alive) setResult({ query, point: null }); });
    return () => { alive = false; ctrl.abort(); };
  }, [query]);
  if (!query) return { status: 'idle', point: null };
  if (!result || result.query !== query) return { status: 'loading', point: null };
  return { status: result.point ? 'found' : 'missing', point: result.point };
}

/** 핀 말풍선 글자 — 괄호 설명('(엘타워)' · '(레스토랑)')은 빼고, 16자가 넘으면 낱말 단위로 15자 안까지 + …(첫 낱말부터 길면 15자) */
function mapPinLabel(name: string): string {
  const s = name.replace(/\s*[(\[][^)\]]*[)\]]\s*/g, ' ').replace(/\s+/g, ' ').trim() || name.trim();
  if (s.length <= 16) return s;
  let out = '';
  for (const w of s.split(' ')) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > 15) break;
    out = next;
  }
  return `${out || s.slice(0, 15)}…`;
}

/** 카카오 장소 주소는 http:// 로 들어온다 — 안드로이드 앱(평문 http 차단)·혼합 콘텐츠를 피해 https 로 */
function httpsUrl(url: string): string {
  return url.replace(/^http:\/\//i, 'https://');
}

function onImgError(e: React.SyntheticEvent<HTMLImageElement>) {
  const el = e.currentTarget;
  if (el.dataset.fallback) return;
  el.dataset.fallback = '1';
  el.src = '/images/default-profile.png';
}

/* ─── 사진 크게 보기 — 검은 바탕, 쓸어 넘김, N/M, 닫기(✕·Esc) ─────────────────── */
function PhotoViewer({ images, start, name, onClose }: { images: string[]; start: number; name: string; onClose: () => void }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);
  // 닫기는 ref 로 — 부모가 다시 그려질 때마다 아래 효과가 다시 돌면 처음 사진으로 튄다
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const el = railRef.current;
    if (el) el.scrollLeft = el.clientWidth * start;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key === 'ArrowRight') railRef.current?.scrollBy({ left: railRef.current.clientWidth, behavior: 'smooth' });
      if (e.key === 'ArrowLeft') railRef.current?.scrollBy({ left: -railRef.current.clientWidth, behavior: 'smooth' });
    };
    window.addEventListener('keydown', onKey);
    return () => { html.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [start]);
  return (
    <div className="fixed inset-0 z-[720] flex flex-col bg-black pt-[var(--ft-sat)]" role="dialog" aria-modal="true" aria-label={`${name} 사진`}>
      {/* iOS 앱(261014)은 위를 상태바 칸(--ft-sat)만큼 띄운다 — 검정 바탕이 상태바 뒤까지 */}
      <div className="flex h-14 shrink-0 items-center justify-between px-3 text-white">
        <span className="pl-2 text-[15px] font-semibold tracking-[-0.2px] text-white/85">{index + 1} / {images.length}</span>
        <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10" aria-label="닫기">
          <TossCloseIcon size={26} />
        </button>
      </div>
      <div
        ref={railRef}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto scrollbar-hide"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.min(images.length - 1, Math.max(0, Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))));
        }}
      >
        {images.map((src, i) => (
          <div key={src + i} className="flex h-full w-full shrink-0 snap-center items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" referrerPolicy="no-referrer" loading={Math.abs(i - start) <= 1 ? 'eager' : 'lazy'} decoding="async" onError={onImgError} className="max-h-full max-w-full object-contain" />
          </div>
        ))}
      </div>
      <div className="h-[calc(24px+env(safe-area-inset-bottom,0px))] shrink-0" />
    </div>
  );
}

/* ─── 문의 시트 — 이름·연락처(로그인 정보로 채움) · 문의 종류 칩 · 희망 시기 · 내용 → 관리자 문의함 ─────────── */
const INQUIRY_KINDS = ['견적 문의', '방문 상담', '일정 확인', '기타'];

function InquirySheet({ open, onClose, biz, category, prefill = '' }: { open: boolean; onClose: () => void; biz: BizDetail; category: string; prefill?: string }) {
  const authUser = useAuthStore((s) => s.user) as any;
  const scrimRef = useRef<HTMLDivElement>(null);
  const keyboardInset = useKeyboardInset(open, scrimRef);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [kinds, setKinds] = useState<string[]>(['견적 문의']);
  const [when, setWhen] = useState('');
  const [memo, setMemo] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  // 닫기는 ref 로, 여닫힘 효과는 open 에만 — 부모가 다시 그려질 때 '보냈어요' 화면이 지워지지 않게
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const prefillRef = useRef(prefill);
  prefillRef.current = prefill;
  // 질문으로 채운 내용(손님이 고치지 않았으면 다음 질문으로 바꿔 채운다)
  const autoMemoRef = useRef('');
  useEffect(() => {
    if (!open) return;
    setDone(false);
    // 'AI 분석' 질문 입력줄로 열면 그 질문을 내용 칸에 채운다(이미 적은 내용이 있으면 그대로)
    const next = prefillRef.current;
    if (next) {
      setMemo((v) => (!v.trim() || v === autoMemoRef.current ? next : v));
      autoMemoRef.current = next;
    }
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => { html.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]);
  // 로그인해 있으면 이름·연락처를 채워 둔다(이미 적은 값은 그대로)
  useEffect(() => {
    if (!open || !authUser) return;
    setName((v) => v || String(authUser.name || ''));
    setPhone((v) => v || String(authUser.phone || ''));
  }, [open, authUser]);

  if (!open) return null;

  const digits = phone.replace(/\D/g, '');
  const valid = name.trim().length > 0 && digits.length >= 9 && digits.length <= 12;
  const toggleKind = (k: string) => setKinds((list) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]));

  const submit = async () => {
    if (!valid || sending) return;
    setSending(true);
    const message = [
      kinds.length > 0 ? `문의 종류: ${kinds.join(', ')}` : '',
      when.trim() ? `희망 시기: ${when.trim()}` : '',
      memo.trim(),
    ].filter(Boolean).join('\n') || '상담을 원해요';
    try {
      await apiClient.post('/api/v1/business-inquiries', {
        company: biz.businessName,
        name: name.trim(),
        phone: phone.trim(),
        type: `${category} 문의`,
        message,
        source: 'wedding_partner',
        metadata: {
          businessId: biz.id,
          businessName: biz.businessName,
          category,
          page: `/businesses/${biz.id}`,
          userId: authUser?.id || null,
        },
      });
      setDone(true);
    } catch {
      toast.error('문의를 보내지 못했어요. 잠시 후 다시 시도해 주세요');
    } finally {
      setSending(false);
    }
  };

  return (
    <div ref={scrimRef} className="ft-scrim" onClick={onClose} style={keyboardInset ? { paddingBottom: keyboardInset } : undefined}>
      <div className="ft-sheet" role="dialog" aria-modal="true" aria-label={`${biz.businessName} 문의`} onClick={(e) => e.stopPropagation()}>
        <div className="ft-grab" />
        {done ? (
          <div className="pb-1 pt-2 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F3FF] text-[#3182F6]">
              <TossCheckIcon size={30} />
            </span>
            <p className="ft-title !mt-4">문의를 보냈어요</p>
            <p className="ft-desc">프리티풀 매니저가 확인하고<br />남겨 주신 연락처로 안내드릴게요</p>
            <div className="ft-actions">
              <button type="button" className="ft-btn primary" onClick={onClose}>확인</button>
            </div>
          </div>
        ) : (
          <>
            <p className="ft-title">{biz.businessName}에 문의하기</p>
            <p className="ft-desc">남겨 주시면 프리티풀 매니저가 업체와 함께 확인하고 연락드려요</p>
            <div className="mt-5 space-y-2.5">
              <input className="ft-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" autoComplete="name" maxLength={40} />
              <input className="ft-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="연락처 (예: 010-1234-5678)" inputMode="tel" autoComplete="tel" maxLength={20} />
            </div>
            <p className="mb-2 mt-5 text-[14px] font-semibold tracking-[-0.2px] text-[#4E5968]">무엇이 궁금하세요?</p>
            <div className="flex flex-wrap gap-2">
              {INQUIRY_KINDS.map((k) => (
                <button key={k} type="button" className={`ft-chip${kinds.includes(k) ? ' on' : ''}`} onClick={() => toggleKind(k)}>
                  {kinds.includes(k) && <TossCheckIcon size={17} />}
                  {k}
                </button>
              ))}
            </div>
            <div className="mt-5 space-y-2.5">
              <input className="ft-input" value={when} onChange={(e) => setWhen(e.target.value)} placeholder="희망 시기 (선택 · 예: 2027년 5월 주말)" maxLength={60} />
              <textarea className="ft-textarea" rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="더 남길 내용 (선택)" maxLength={1000} />
            </div>
            <p className="mt-3 text-[13px] leading-[1.5] tracking-[-0.2px] text-[#8B95A1]">문의 안내를 위해 이름·연락처를 프리티풀과 해당 업체가 확인해요.</p>
            <div className="ft-actions">
              <button type="button" className="ft-btn primary" disabled={!valid || sending} onClick={submit}>
                {sending ? '보내는 중…' : '문의 보내기'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function BusinessDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [biz, setBiz] = useState<BizDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryPrefill, setInquiryPrefill] = useState('');
  const [solidHeader, setSolidHeader] = useState(false);
  // 지도 칸이 주소 카드로 내려앉은 좌표(그땐 카드에 '네이버 지도에서 보기'가 있어 '크게 보기' 칩을 뺀다 — 겹침)
  const [mapCardKey, setMapCardKey] = useState<string | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!id) return;
    apiClient
      .get<BizDetail>(`/api/v1/business/${id}`)
      .then((r) => {
        if (!isBusinessRelevantToAnyCategory(r.data)) {
          setBiz(null);
          return;
        }
        const partnerImageSet = getWeddingPartnerImageSet(r.data.businessName);
        const apiImages = Array.isArray(r.data.images) ? r.data.images.map((i) => i.imageUrl).filter(Boolean) : [];
        const mergedImages = sanitizeBusinessImageUrls(mergeWeddingPartnerImages(partnerImageSet?.images, apiImages));
        if (mergedImages.length === 0) {
          setBiz(null);
          return;
        }
        setBiz(r.data);
      })
      .catch(() => setBiz(null))
      .finally(() => setLoading(false));
  }, [id]);

  // 사진 위에선 투명(흰 아이콘), 사진을 지나면 흰 바탕 머리줄 + 업체 이름
  useEffect(() => {
    const onScroll = () => {
      const h = heroRef.current?.offsetHeight || 280;
      // 머리줄이 상태바 칸(iOS 앱)만큼 길다 — 그때그때 읽는다(261014)
      setSolidHeader(window.scrollY > h - (64 + readSafeTop()));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [biz]);

  // 목록 카드 '문의'(?inquiry=1)로 들어오면 문의 시트를 바로 연다(사회자 목록 '문의'와 같은 방식) — 주소의 파라미터는 뗀다
  useEffect(() => {
    if (!biz || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('inquiry') !== '1') return;
    setInquiryOpen(true);
    params.delete('inquiry');
    const qs = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, [biz]);

  const view = useMemo(() => {
    if (!biz) return null;
    const partnerImageSet = getWeddingPartnerImageSet(biz.businessName);
    const apiImages = Array.isArray(biz.images) ? biz.images.map((i) => i.imageUrl).filter(Boolean) : [];
    const mergedImages = sanitizeBusinessImageUrls(mergeWeddingPartnerImages(partnerImageSet?.images, apiImages));
    const images = mergedImages.length > 0 ? mergedImages : ['/images/default-profile.png'];
    const categoryNames = Array.from(new Set([
      ...getRelevantBusinessCategories(biz),
      ...getWeddingPartnerSectionCategories(partnerImageSet),
    ]));
    const category = categoryNames[0] || partnerImageSet?.category || '웨딩파트너';
    const markerTags = extractBusinessTagsFromHtml(biz.descriptionHtml);
    const tags = normalizeBusinessTags(
      Array.isArray(biz.tags) && biz.tags.length > 0
        ? biz.tags
        : markerTags.length > 0
          ? markerTags
          : deriveBusinessTagSuggestions({ businessName: biz.businessName, businessType: biz.businessType, address: biz.address, categoryNames }),
      6,
    ).filter((tag) => tag !== '인기');
    const intro = readableIntro(stripBusinessTagMarker(biz.descriptionHtml));
    const address = [biz.address, biz.addressDetail].filter(Boolean).join(' ').trim();
    // 저장된 좌표(없거나 대한민국 밖이면 아래에서 주소로 찾는다)
    const storedLatLng = storedPoint(biz.lat, biz.lng);
    const website = biz.websiteUrl && !/place\.map\.kakao\.com/i.test(biz.websiteUrl) ? biz.websiteUrl : '';
    const kakaoPlace = biz.websiteUrl && /place\.map\.kakao\.com/i.test(biz.websiteUrl) ? httpsUrl(biz.websiteUrl) : '';
    // 네이버 장소 검색어 — 이름 앞에 시·군·구를 붙이면 그 근처 결과가 먼저 나온다('성동구 브랜미' → 성수점 하나, 261012 실측)
    const regionWord = String(biz.address || '').trim().split(/\s+/).find((w, i) => i > 0 && /[시군구]$/.test(w)) || '';
    const naverQuery = [regionWord, biz.businessName].filter(Boolean).join(' ');
    // 웨딩홀 상세(식대·보증 인원·홀 안내) — 제휴 웨딩홀은 소개 안의 숨은 표시로 들어온다(lib/business-hall-info)
    const hallInfo = extractHallInfo(biz.descriptionHtml);
    // 아래 랜딩(261014)이 쓰는 글자 — 업체 데이터로만(partner-facts)
    // 지도로 찾을 수 있는 주소인가(저장 좌표가 있거나 번지까지 적힌 주소) — 아니면 '서울/경기' 같은 활동 지역으로 쓴다
    const hasPlace = !!address && (!!storedLatLng || !!geocodeQuery(biz.address));
    const partner = buildPartnerFacts({
      name: biz.businessName,
      category,
      categoryNames,
      businessType: biz.businessType,
      address,
      hasPlace,
      tags,
      // 이름으로만 뽑은 규칙 태그('…호텔' → 호텔웨딩). 분야 기본 태그 목록(웨딩홀이면 호텔웨딩·채플웨딩까지)과 주소(건물명 '…파크' 오탐)는 쓰지 않는다.
      // 주관적인 말 · 홀이 아닌 업체의 홀 계열 태그는 partner-facts 가 거른다
      extraTags: deriveBusinessTagSuggestions({ businessName: biz.businessName }),
      images,
      hallInfo,
    });
    return { images, category, categoryNames, tags, intro, address, website, kakaoPlace, storedLatLng, naverQuery, partner, hasPlace };
  }, [biz]);

  const tone = useImageTone(view?.images[0], 'scene');
  const toneBg = tone?.bg || '#F2F4F6';
  const toneSub = tone?.sub || '#6B7684';
  // 좌표 없는 업체만 주소 → 좌표(지역만 적힌 곳은 묻지 않음)
  const geo = useGeocodedPoint(view && !view.storedLatLng ? geocodeQuery(biz?.address) : '');
  // 사진이 상태바 뒤에 깔린 동안(투명 머리줄)·사진 크게 보기 동안 상태바 흰 글자(261014 iOS 앱 화면 끝까지)
  useNativeStatusBar((!!view && !solidHeader) || viewerAt !== null);

  if (loading) {
    return (
      <div className="mx-auto min-h-screen max-w-lg bg-white pb-24">
        <div className="aspect-[4/3] animate-pulse bg-gray-100" />
        <div className="space-y-3 px-5 pt-5">
          <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
          <div className="h-7 w-48 animate-pulse rounded bg-gray-100" />
          <div className="h-4 w-64 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  if (!biz || !view) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
        <p className="mb-3 text-[15px] text-[#6B7684]">업체를 찾을 수 없어요</p>
        <button onClick={() => router.back()} className="text-[15px] font-semibold text-[#3182F6]">
          돌아가기
        </button>
      </div>
    );
  }

  const { images, category, tags, intro, address, website, kakaoPlace, storedLatLng, naverQuery, partner, hasPlace } = view;
  // 지도 핀 자리 = 저장된 좌표 > 주소로 찾은 좌표
  const point = storedLatLng || geo.point;
  const mapKey = point ? `${point.lat},${point.lng}` : '';
  // 지도 자리 — 좌표가 있거나 · 찾는 중이거나 · 찾아봤는데 못 찾음(같은 높이 주소 카드). 지역만 적힌 곳(묻지 않음)만 자리가 없다
  const showMapBox = !!point || geo.status === 'loading' || geo.status === 'missing';
  const kakaoMap = kakaoPlace
    || (point
      ? `https://map.kakao.com/link/map/${encodeURIComponent(biz.businessName.replace(/[,\n\r]+/g, ' '))},${point.lat},${point.lng}`
      : `https://map.kakao.com/link/search/${encodeURIComponent(biz.businessName)}`);
  const naverPlace = { lat: point?.lat, lng: point?.lng, name: biz.businessName, address };
  // 길찾기 = 네이버 길찾기(도착지 = 업체 좌표). 좌표가 없으면 네이버 장소 검색(그 화면에 길찾기 단추가 있다)
  const routeLink = naverMapLinkProps({ ...naverPlace, query: naverQuery }, { kind: 'route' });
  // 초록 '네이버 지도' 단추 = 네이버 장소 검색(리뷰·사진·전화가 있는 장소 화면) — 지도 칸(그 자리 핀)과 나눠 둔다
  const naverPlaceLink = naverMapLinkProps({ query: naverQuery });
  const openKakao = (e: React.MouseEvent<HTMLAnchorElement>) => { openExternalMapLink(e, kakaoMap); };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${biz.businessName} · 프리티풀`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast('링크를 복사했어요');
      }
    } catch { /* 공유 창을 닫았다 */ }
  };
  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      toast('주소를 복사했어요');
    } catch {
      toast.error('복사하지 못했어요');
    }
  };

  // 'AI 분석' 질문 입력줄은 그 질문을 문의 내용에 채워 연다
  const openInquiry = (prefill?: string) => {
    setInquiryPrefill(prefill || '');
    setInquiryOpen(true);
  };
  // 기능 줄 '위치 보기' — 머리줄(56) 아래로 지도 칸 제목이 오게
  const scrollToLocation = () => {
    const el = locationRef.current;
    if (!el) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 16 - readSafeTop(), behavior: reduced ? 'auto' : 'smooth' });
  };

  const quick = [
    { key: 'inquiry', label: '문의하기', icon: <TossChatBubbleIcon size={24} />, onClick: () => openInquiry() },
    { key: 'route', label: '길찾기', icon: <TossDirectionIcon size={24} />, href: routeLink.href, onLinkClick: routeLink.onClick },
    biz.instagramUrl
      ? { key: 'insta', label: '인스타그램', icon: <TossCameraIcon size={24} />, href: biz.instagramUrl }
      : website
        ? { key: 'web', label: '웹사이트', icon: <TossEarthIcon size={24} />, href: website }
        : null,
    { key: 'share', label: '공유', icon: <TossShareBoxIcon size={24} />, onClick: share },
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
    href?: string;
    onClick?: () => void;
    onLinkClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  }>;

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white pb-[calc(96px+env(safe-area-inset-bottom,0px))]">
      {/* 머리줄 — 사진 위에선 투명 + 흰 아이콘(위쪽 옅은 그림자), 사진을 지나면 흰 바탕 + 업체 이름 */}
      <div
        data-native-back-header
        className="fixed left-1/2 top-0 z-30 w-full max-w-lg -translate-x-1/2 pt-[var(--ft-sat)] transition-colors duration-200"
        style={{ backgroundColor: solidHeader ? 'rgba(255,255,255,0.96)' : 'transparent', backdropFilter: solidHeader ? 'blur(12px)' : undefined, WebkitBackdropFilter: solidHeader ? 'blur(12px)' : undefined }}
      >
        {/* iOS 앱(261014)은 바깥 칸이 상태바 칸(--ft-sat)만큼 위를 띄우고, 그림자·흰 바탕은 그 뒤까지 깔린다 */}
        {!solidHeader && <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[calc(80px+var(--ft-sat))] bg-gradient-to-b from-black/35 to-transparent" />}
        <div className="relative flex h-14 items-center justify-between px-2">
          <button onClick={() => router.back()} className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${solidHeader ? 'text-[#191F28]' : 'text-white'}`} aria-label="뒤로">
            <TossBackIcon size={28} />
          </button>
          <p className={`min-w-0 flex-1 truncate px-1 text-center text-[17px] font-bold leading-[1.6] tracking-[-0.3px] text-[#191F28] transition-opacity duration-200 ${solidHeader ? 'opacity-100' : 'opacity-0'}`}>
            {biz.businessName}
          </p>
          <button onClick={share} className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${solidHeader ? 'text-[#191F28]' : 'text-white'}`} aria-label="공유">
            <TossShareBoxIcon size={24} />
          </button>
        </div>
      </div>

      {/* 사진 넘겨보기 — 아래쪽이 이름 칸 색으로 녹아든다 */}
      <div ref={heroRef} className="relative">
        <div
          className="flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto scrollbar-hide"
          onScroll={(e) => {
            const el = e.currentTarget;
            setHeroIndex(Math.min(images.length - 1, Math.max(0, Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))));
          }}
        >
          {images.map((src, i) => (
            <button key={src + i} type="button" onClick={() => setViewerAt(i)} className="relative h-full w-full shrink-0 snap-center" aria-label={`사진 ${i + 1} 크게 보기`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={i === 0 ? biz.businessName : ''} referrerPolicy="no-referrer" loading={i < 2 ? 'eager' : 'lazy'} decoding="async" onError={onImgError} className="absolute inset-0 h-full w-full object-cover" />
            </button>
          ))}
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0 transition-[background] duration-500" style={{ background: heroFade(toneBg) }} />
        {images.length > 1 && (
          <span
            className="pointer-events-none absolute right-4 top-[calc(68px+var(--ft-sat))] inline-flex h-[26px] items-center rounded-full px-2.5 text-[12.5px] font-semibold tracking-[-0.2px] text-white"
            style={{ backgroundColor: 'rgba(0,0,0,0.36)', WebkitBackdropFilter: 'blur(10px)', backdropFilter: 'blur(10px)' }}
          >
            {heroIndex + 1} / {images.length}
          </span>
        )}
      </div>

      {/* 이름 칸 — 사진에서 뽑은 색 */}
      {/* 사진 그라데이션이 끝나는 자리에서 바로 이어 붙인다(겹치면 덜 녹은 사진이 칸 경계에서 직선으로 잘려 보인다) */}
      <section className="relative px-5 pb-6 pt-1 transition-colors duration-500" style={{ backgroundColor: toneBg }}>
        <p className="relative text-[14px] font-semibold tracking-[-0.2px]" style={{ color: toneSub }}>{category}</p>
        <h1 className="relative mt-1 break-keep text-[24px] font-bold leading-[1.35] tracking-[-0.5px] text-[#191F28]">{biz.businessName}</h1>
        {intro && <p className="mt-2 whitespace-pre-line break-keep text-[16px] leading-[1.6] tracking-[-0.3px] text-[#333D4B]">{intro}</p>}
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[14px] leading-[1.5] tracking-[-0.2px]" style={{ color: toneSub }}>
          {address && <span className="inline-flex items-center gap-[3px]"><TossPinIcon size={15} />{shortRegion(address)}</span>}
          {address && <span aria-hidden className="h-2.5 w-px" style={{ backgroundColor: toneSub, opacity: 0.35 }} />}
          <span className="inline-flex items-center gap-[3px]"><TossPictureIcon size={15} />사진 {images.length}장</span>
        </p>
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="flex h-[28px] items-center rounded-[8px] bg-white/60 px-2.5 text-[13px] font-semibold tracking-[-0.2px] text-[#333D4B]">{tag}</span>
            ))}
          </div>
        )}
      </section>

      {/* 바로가기 */}
      <div className="grid px-3 pb-2 pt-5" style={{ gridTemplateColumns: `repeat(${quick.length}, minmax(0, 1fr))` }}>
        {quick.map((q) => {
          const inner = (
            <>
              <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#F2F4F6] text-[#4E5968]">{q.icon}</span>
              <span className="mt-1.5 text-[13px] font-medium tracking-[-0.2px] text-[#4E5968]">{q.label}</span>
            </>
          );
          const cls = 'flex flex-col items-center py-1 transition-transform active:scale-[0.94]';
          return q.href ? (
            <a key={q.key} href={q.href} target="_blank" rel="noopener noreferrer" onClick={q.onLinkClick} className={cls}>{inner}</a>
          ) : (
            <button key={q.key} type="button" onClick={q.onClick} className={cls}>{inner}</button>
          );
        })}
      </div>

      {/* 아래 = 랜딩(261014 사장 '첨부한 사진처럼 똑같이, 인터렉션들도 · 히어로는 그대로' + 'AI 분석 = 사회자 상세의 동그라미·별')
          — 소개 문장 · 한눈에 보기 · 넘겨 보는 카드 · AI 분석 · 띠 · 기능 줄 · 아이콘 격자 · 홀 카드 · 비교 · 사진 격자 · 키워드 → 위치 → 묻고 답하기 · 마무리 띠 */}
      <PartnerLanding
        images={images}
        facts={partner}
        tags={tags}
        hasLocation={hasPlace}
        onOpenPhoto={(i) => setViewerAt(i)}
        onInquiry={openInquiry}
        onLocate={scrollToLocation}
        stepMap={point ? (
          // '위치 보고 길찾기' 줄의 실제 지도 — 고정 지도, 누르면 네이버 길찾기(도착지 = 업체). 왼쪽 아래 네이버 로고·저작권은 가리지 않는다
          <NaverMap
            key={`step-${mapKey}`}
            className="h-full w-full"
            markers={[{ lat: point.lat, lng: point.lng, label: mapPinLabel(biz.businessName) }]}
            zoom={16}
            title={biz.businessName}
            address={address}
            href={routeLink.href}
            onLinkClick={routeLink.onClick}
            linkLabel="네이버 지도로 길찾기"
          >
            <span
              aria-hidden
              className="absolute bottom-2.5 right-2.5 inline-flex h-8 items-center gap-[3px] whitespace-nowrap rounded-[8px] bg-white/95 pl-2.5 pr-1.5 text-[13px] font-semibold tracking-[-0.2px] text-[#333D4B] shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
              style={{ pointerEvents: 'none' }}
            >
              길찾기
              <TossChevronRightIcon size={15} />
            </span>
          </NaverMap>
        ) : null}
        locationSlot={
          <>
            {/* 위치 — 네이버 지도(261012 사장 '네이버 다이나믹맵 전부 다 적용'): 고정 칸(손가락은 페이지 스크롤), 누르면 네이버 지도 그 자리 핀.
                인증 실패·로딩 실패면 같은 자리의 네이버 정적 지도 그림 → 그것도 안 되면 주소 카드(빈 칸 없음) */}
        {address && (
          <section ref={locationRef} className="pl-loc px-5">
            <div className="pl-center">
              <span className="pl-eyebrow">Location</span>
              <h2 className="pl-h2">오시는 길</h2>
            </div>
            <div className="mt-5 flex items-start justify-between gap-3">
              <p className="break-keep text-[15px] leading-[1.6] tracking-[-0.2px] text-[#4E5968]">{address}</p>
              <button type="button" onClick={copyAddress} className="flex h-8 shrink-0 items-center gap-1 rounded-[8px] bg-[#F2F4F6] px-2.5 text-[13px] font-semibold text-[#4E5968] active:bg-[#E5E8EB]">
                <TossCopyIcon size={15} />
                복사
              </button>
            </div>
            {point ? (
              <NaverMap
                key={mapKey}
                className="mt-3 h-[196px] rounded-[16px]"
                markers={[{ lat: point.lat, lng: point.lng, label: mapPinLabel(biz.businessName) }]}
                zoom={16}
                title={biz.businessName}
                address={address}
                onFallback={(reason) => { if (reason === 'image' || reason === 'no_center') setMapCardKey(mapKey); }}
              >
                {/* 칩은 손가락을 받지 않는다(눌러도 아래 지도 칸 링크로) — 왼쪽 아래는 네이버 로고·'© NAVER Corp.' 자리(약관상 가리면 안 됨)라 오른쪽 아래에.
                    화면 390px 아래(갤럭시 360·384)에선 칩이 저작권 글자에 닿아 '크게 보기'만(261012 실측) */}
                {mapCardKey !== mapKey && (
                  <span
                    aria-hidden
                    className="absolute bottom-2.5 right-2.5 inline-flex h-8 items-center gap-[3px] whitespace-nowrap rounded-[8px] bg-white/95 pl-2.5 pr-1.5 text-[13px] font-semibold tracking-[-0.2px] text-[#333D4B] shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
                    style={{ pointerEvents: 'none' }}
                  >
                    <span><span className="hidden min-[390px]:inline">네이버 지도에서 </span>크게 보기</span>
                    <TossChevronRightIcon size={15} />
                  </span>
                )}
              </NaverMap>
            ) : geo.status === 'loading' ? (
              // 주소 → 좌표 찾는 동안(보통 한순간) — 같은 크기 연회색 칸(밀림 없음)
              <div aria-hidden className="mt-3 h-[196px] animate-pulse rounded-[16px] bg-[#F2F4F6]" />
            ) : geo.status === 'missing' ? (
              // 주소로 좌표를 못 찾음 — 같은 높이 주소 카드(핀 + 이름 + 주소 + '네이버 지도에서 보기' → 네이버 장소 검색 '시·군·구 + 이름')
              <NaverMap
                className="mt-3 h-[196px] rounded-[16px]"
                title={biz.businessName}
                address={address}
                searchQuery={naverQuery}
              />
            ) : null}
            {/* 브랜드 색 버튼 — 사장 제공 아이콘(public/icons/brand): 카카오 노랑 + 톡 아이콘 / 네이버 초록 + 흰 NAVER 로고 */}
            <div className={`${showMapBox ? 'mt-2.5' : 'mt-3'} grid grid-cols-2 gap-2`}>
              <a
                href={kakaoMap}
                target="_blank"
                rel="noopener noreferrer"
                onClick={openKakao}
                className="flex h-12 items-center justify-center gap-1.5 rounded-[12px] bg-[#FBE300] text-[15px] font-bold tracking-[-0.2px] text-[#3B1E1E] transition active:scale-[0.98] active:brightness-95"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/brand/kakao-talk.svg" alt="" className="h-7 w-7" />
                카카오맵
              </a>
              <a
                {...naverPlaceLink}
                className="flex h-12 items-center justify-center gap-2 rounded-[12px] bg-[#03C75A] text-[15px] font-bold tracking-[-0.2px] text-white transition active:scale-[0.98] active:brightness-95"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/brand/naver-wordmark.svg" alt="NAVER" className="h-[11px] w-auto" />
                지도
              </a>
            </div>
          </section>
        )}
          </>
        }
      />

      {/* 아래 고정 — 문의하기(전화 버튼은 예전 결정대로 숨김) */}
      <div className="fixed bottom-0 left-1/2 z-40 w-full max-w-lg -translate-x-1/2 bg-white/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-md">
        <button type="button" className="ft-btn primary w-full" onClick={() => openInquiry()}>
          문의하기
        </button>
      </div>

      {viewerAt !== null && (
        <PhotoViewer images={images} start={viewerAt} name={biz.businessName} onClose={() => setViewerAt(null)} />
      )}
      <InquirySheet open={inquiryOpen} onClose={() => setInquiryOpen(false)} biz={biz} category={category} prefill={inquiryPrefill} />
    </div>
  );
}
