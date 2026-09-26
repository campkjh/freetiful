'use client';

// 웨딩 파트너(업체) 상세 — 260926 사장 "상세페이지 사진 갤러리랑 지도, 문의 버튼 넣어서 알차게".
//  (한때 웨딩숲 계층으로 바꿨다가 사장 "상세 말고 리스트 페이지를 말한 것" → 이 사진 색 버전으로 되돌림. 지도 버튼만 브랜드 색 유지)
//  · 맨 위 = 사진 넘겨보기(4:3, 쓸어 넘김 · N/M · 누르면 크게) → 아래쪽이 대표 사진에서 뽑은 색(lib/image-tone)으로 녹아
//    이름 칸으로 이어진다(홈 '사진 색 카드'와 같은 결).
//  · 이름 칸: 분야 · 이름 24 · 한 줄 소개(카카오 자동 등록 문구는 숨김) · 지역 | 사진 N장 · 흰 반투명 칩
//  · 바로가기(문의 · 길찾기 · 인스타그램/웹사이트 · 공유) → 사진 모아보기(3열, 마지막 칸 +N) → 위치(구글 지도 임베드 — 키 없이 됨,
//    좌표 있으면 좌표·없으면 주소 / 카카오맵 · 네이버 지도 · 주소 복사) → 업체 정보
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

function hostLabel(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function instagramHandle(url: string) {
  const m = url.match(/instagram\.com\/([^/?#]+)/i);
  return m ? `@${m[1]}` : hostLabel(url);
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
    <div className="fixed inset-0 z-[720] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={`${name} 사진`}>
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

function InquirySheet({ open, onClose, biz, category }: { open: boolean; onClose: () => void; biz: BizDetail; category: string }) {
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
  useEffect(() => {
    if (!open) return;
    setDone(false);
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
  const [solidHeader, setSolidHeader] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

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
      setSolidHeader(window.scrollY > h - 64);
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
    const lat = Number(biz.lat);
    const lng = Number(biz.lng);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
    const address = [biz.address, biz.addressDetail].filter(Boolean).join(' ').trim();
    const mapQuery = hasCoords ? `${lat},${lng}` : address || biz.businessName;
    const website = biz.websiteUrl && !/place\.map\.kakao\.com/i.test(biz.websiteUrl) ? biz.websiteUrl : '';
    const kakaoPlace = biz.websiteUrl && /place\.map\.kakao\.com/i.test(biz.websiteUrl) ? biz.websiteUrl : '';
    const kakaoMap = kakaoPlace
      || (hasCoords ? `https://map.kakao.com/link/map/${encodeURIComponent(biz.businessName)},${lat},${lng}` : `https://map.kakao.com/link/search/${encodeURIComponent(biz.businessName)}`);
    const kakaoRoute = hasCoords
      ? `https://map.kakao.com/link/to/${encodeURIComponent(biz.businessName)},${lat},${lng}`
      : `https://map.kakao.com/link/search/${encodeURIComponent(address || biz.businessName)}`;
    const naverMap = `https://map.naver.com/p/search/${encodeURIComponent(biz.businessName)}`;
    const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=16&hl=ko&output=embed`;
    return { images, category, categoryNames, tags, intro, address, website, kakaoMap, kakaoRoute, naverMap, mapSrc };
  }, [biz]);

  const tone = useImageTone(view?.images[0], 'scene');
  const toneBg = tone?.bg || '#F2F4F6';
  const toneSub = tone?.sub || '#6B7684';

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

  const { images, category, categoryNames, tags, intro, address, website, kakaoMap, kakaoRoute, naverMap, mapSrc } = view;

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

  const quick = [
    { key: 'inquiry', label: '문의하기', icon: <TossChatBubbleIcon size={24} />, onClick: () => setInquiryOpen(true) },
    { key: 'route', label: '길찾기', icon: <TossDirectionIcon size={24} />, href: kakaoRoute },
    biz.instagramUrl
      ? { key: 'insta', label: '인스타그램', icon: <TossCameraIcon size={24} />, href: biz.instagramUrl }
      : website
        ? { key: 'web', label: '웹사이트', icon: <TossEarthIcon size={24} />, href: website }
        : null,
    { key: 'share', label: '공유', icon: <TossShareBoxIcon size={24} />, onClick: share },
  ].filter(Boolean) as Array<{ key: string; label: string; icon: React.ReactNode; href?: string; onClick?: () => void }>;

  const gallery = images.slice(0, 9);
  const more = images.length - gallery.length;
  const infoRows: Array<{ label: string; value: React.ReactNode }> = [
    { label: '분야', value: categoryNames.join(' · ') || category },
    ...(address ? [{ label: '주소', value: address }] : []),
    ...(biz.instagramUrl ? [{
      label: '인스타그램',
      value: <a href={biz.instagramUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#3182F6]">{instagramHandle(biz.instagramUrl)}</a>,
    }] : []),
    ...(website ? [{
      label: '웹사이트',
      value: <a href={website} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-[#3182F6]">{hostLabel(website)}</a>,
    }] : []),
  ];

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white pb-[calc(96px+env(safe-area-inset-bottom,0px))]">
      {/* 머리줄 — 사진 위에선 투명 + 흰 아이콘(위쪽 옅은 그림자), 사진을 지나면 흰 바탕 + 업체 이름 */}
      <div
        data-native-back-header
        className="fixed left-1/2 top-0 z-30 w-full max-w-lg -translate-x-1/2 transition-colors duration-200"
        style={{ backgroundColor: solidHeader ? 'rgba(255,255,255,0.96)' : 'transparent', backdropFilter: solidHeader ? 'blur(12px)' : undefined, WebkitBackdropFilter: solidHeader ? 'blur(12px)' : undefined }}
      >
        {!solidHeader && <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/35 to-transparent" />}
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
            className="pointer-events-none absolute right-4 top-[68px] inline-flex h-[26px] items-center rounded-full px-2.5 text-[12.5px] font-semibold tracking-[-0.2px] text-white"
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
            <a key={q.key} href={q.href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
          ) : (
            <button key={q.key} type="button" onClick={q.onClick} className={cls}>{inner}</button>
          );
        })}
      </div>

      <div className="mx-5 mt-4 h-px bg-[#F2F4F6]" />

      {/* 사진 모아보기 — 웨딩숲 사진 칸 어법(3열 · 3px 틈 · 모서리 16) */}
      <section className="px-5 pt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[19px] font-bold tracking-[-0.4px] text-[#191F28]">사진 <span className="text-[#3182F6]">{images.length}</span></h2>
          {images.length > 1 && (
            <button type="button" onClick={() => setViewerAt(0)} className="flex items-center text-[14px] font-medium text-[#8B95A1]">
              전체보기 <TossChevronRightIcon size={18} />
            </button>
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-[3px] overflow-hidden rounded-[16px]">
          {gallery.map((src, i) => (
            <button key={src + i} type="button" onClick={() => setViewerAt(i)} className="relative aspect-square overflow-hidden bg-[#F2F4F6]" aria-label={`사진 ${i + 1} 크게 보기`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" onError={onImgError} className="absolute inset-0 h-full w-full object-cover" />
              {i === gallery.length - 1 && more > 0 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[17px] font-bold text-white">+{more}</span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* 위치 — 구글 지도 임베드(키 없이), 누르면 카카오맵 */}
      {address && (
        <section className="px-5 pt-8">
          <h2 className="text-[19px] font-bold tracking-[-0.4px] text-[#191F28]">위치</h2>
          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="break-keep text-[15px] leading-[1.6] tracking-[-0.2px] text-[#4E5968]">{address}</p>
            <button type="button" onClick={copyAddress} className="flex h-8 shrink-0 items-center gap-1 rounded-[8px] bg-[#F2F4F6] px-2.5 text-[13px] font-semibold text-[#4E5968] active:bg-[#E5E8EB]">
              <TossCopyIcon size={15} />
              복사
            </button>
          </div>
          <a href={kakaoMap} target="_blank" rel="noopener noreferrer" className="relative mt-3 block h-[196px] overflow-hidden rounded-[16px] bg-[#F2F4F6]" aria-label="카카오맵에서 크게 보기">
            <iframe
              src={mapSrc}
              title={`${biz.businessName} 위치`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="pointer-events-none absolute inset-0 h-full w-full border-0"
            />
            <span className="absolute bottom-2.5 right-2.5 inline-flex h-8 items-center rounded-[8px] bg-white/95 px-2.5 text-[13px] font-semibold text-[#333D4B] shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
              크게 보기
            </span>
          </a>
          {/* 브랜드 색 버튼 — 사장 제공 아이콘(public/icons/brand): 카카오 노랑 + 톡 아이콘 / 네이버 초록 + 흰 NAVER 로고 */}
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <a
              href={kakaoMap}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center justify-center gap-1.5 rounded-[12px] bg-[#FBE300] text-[15px] font-bold tracking-[-0.2px] text-[#3B1E1E] transition active:scale-[0.98] active:brightness-95"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/brand/kakao-talk.svg" alt="" className="h-7 w-7" />
              카카오맵
            </a>
            <a
              href={naverMap}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center justify-center gap-2 rounded-[12px] bg-[#03C75A] text-[15px] font-bold tracking-[-0.2px] text-white transition active:scale-[0.98] active:brightness-95"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/brand/naver-wordmark.svg" alt="NAVER" className="h-[11px] w-auto" />
              지도
            </a>
          </div>
        </section>
      )}

      {/* 업체 정보 */}
      <section className="px-5 pt-8">
        <h2 className="text-[19px] font-bold tracking-[-0.4px] text-[#191F28]">업체 정보</h2>
        <dl className="mt-2">
          {infoRows.map((row, i) => (
            <div key={row.label} className={`flex gap-4 py-3.5 ${i ? 'border-t border-[#F2F4F6]' : ''}`}>
              <dt className="w-[72px] shrink-0 text-[15px] tracking-[-0.2px] text-[#8B95A1]">{row.label}</dt>
              <dd className="min-w-0 flex-1 break-keep text-[15px] leading-[1.55] tracking-[-0.2px] text-[#191F28]">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 아래 고정 — 문의하기(전화 버튼은 예전 결정대로 숨김) */}
      <div className="fixed bottom-0 left-1/2 z-40 w-full max-w-lg -translate-x-1/2 bg-white/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-md">
        <button type="button" className="ft-btn primary w-full" onClick={() => setInquiryOpen(true)}>
          문의하기
        </button>
      </div>

      {viewerAt !== null && (
        <PhotoViewer images={images} start={viewerAt} name={biz.businessName} onClose={() => setViewerAt(null)} />
      )}
      <InquirySheet open={inquiryOpen} onClose={() => setInquiryOpen(false)} biz={biz} category={category} />
    </div>
  );
}
