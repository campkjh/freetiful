'use client';

// 웨딩 파트너(업체) 상세 — 260926 사장 "사진 갤러리랑 지도, 문의 버튼 넣어서 알차게", "웨딩숲 느낌으로", "인터랙션도 퀵매칭".
//  · 웨딩숲 글 상세 계층: 흰 머리줄(뒤로 · 가운데 분야 → 굴리면 업체 이름 · 공유) → 작성자 줄 자리(대표 사진 프사 48 · 이름 17/700 + 분야 배지 ·
//    회색 한 줄 '지역 · 사진 N장' · 오른쪽 '문의' = 팔로우 버튼 결) → 한 줄 소개 16.5 → 둥근 사진 넘겨보기(r16, N/M) → 회색 칩 →
//    액션 줄(문의 · 길찾기 · 인스타그램 · 공유) → 10px 회색 띠 → 사진 모아보기 → 위치(구글 지도 임베드 + 카카오맵 노랑 · 네이버 지도 초록 버튼,
//    사장 제공 아이콘) → 업체 정보. 글자 굵기 최대 700.
//  · 등장 = 퀵매칭: 이름 줄 qd-a-title(아래→위) · 정보 줄 qd-a-sub(.18s 뒤) · 본문 칸 .qd-body(오른쪽→왼쪽 0.3s + i*0.07s).
//  · 아래 고정 '문의하기' → 시트(이름·연락처·문의 종류 칩·희망 시기·내용) → API POST /business-inquiries
//    (source 'wedding_partner' — 관리자 문의함 + 관리자 알림톡). 전화 버튼은 예전 결정대로 숨김(오류 이슈).
//  · iOS 앱은 이 화면을 네이티브로 그린다(웹 수정 미반영).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, ChevronRight, Globe, Instagram, Navigation, Share2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth.store';
import { TossCommentIcon, TossShareIcon } from '@/components/community/TossIcons';
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
          <X size={24} />
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
              <Check size={28} strokeWidth={2.6} />
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
                  {kinds.includes(k) && <Check size={15} strokeWidth={2.6} />}
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
  const [nameInBar, setNameInBar] = useState(false);
  const nameRef = useRef<HTMLDivElement>(null);
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

  // 머리줄 가운데 = 분야, 이름 줄을 지나 굴리면 업체 이름으로(웨딩숲 상세 머리 결)
  useEffect(() => {
    const onScroll = () => {
      const el = nameRef.current;
      setNameInBar(el ? el.getBoundingClientRect().bottom < 56 : false);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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
  // 웨딩숲 액션 줄(♡ · 💬 · 공유 자리) — 아이콘 + 글자 16 #6B7684
  const actCls = 'inline-flex items-center gap-1.5 px-0.5 py-1 text-[16px] font-medium tracking-[-0.2px] text-[#6B7684] transition-transform active:scale-[0.92]';

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white pb-[calc(96px+env(safe-area-inset-bottom,0px))]">
      {/* 머리줄 — 웨딩숲 상세 머리(흰 바탕 · 뒤로 · 가운데 분야 → 이름 줄 지나면 업체 이름 · 공유) */}
      <div data-native-back-header className="qd-header">
        <button type="button" className="qd-back" onClick={() => router.back()} aria-label="뒤로">
          <ArrowLeft size={24} className="text-[#191F28]" />
        </button>
        <div className="relative h-[27px] min-w-0 flex-1 overflow-hidden text-center">
          <p className={`absolute inset-x-0 top-0 truncate text-[17px] font-bold leading-[1.6] tracking-[-0.3px] text-[#191F28] transition-all duration-200 ${nameInBar ? '-translate-y-2 opacity-0' : 'translate-y-0 opacity-100'}`}>{category}</p>
          <p className={`absolute inset-x-0 top-0 truncate text-[17px] font-bold leading-[1.6] tracking-[-0.3px] text-[#191F28] transition-all duration-200 ${nameInBar ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>{biz.businessName}</p>
        </div>
        <button type="button" className="qd-back" onClick={share} aria-label="공유">
          <Share2 size={21} className="text-[#191F28]" />
        </button>
      </div>

      {/* 작성자 줄 자리 — 대표 사진 프사 48 · 이름 + 분야 배지 · 회색 한 줄 · '문의'(팔로우 버튼 결) */}
      <div ref={nameRef} className="flex items-start gap-3 px-4 pt-2">
        <button type="button" onClick={() => setViewerAt(0)} className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[#F2F4F6]" aria-label="대표 사진 크게 보기">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[0]} alt="" referrerPolicy="no-referrer" onError={onImgError} className="h-full w-full object-cover" />
        </button>
        <div className="min-w-0 flex-1 pt-px">
          <div className="qd-a-title flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <h1 className="break-keep text-[17px] font-bold leading-[1.45] tracking-[-0.3px] text-[#191F28]">{biz.businessName}</h1>
            <span className="inline-flex h-6 shrink-0 items-center rounded-[6px] bg-[#F2F4F6] px-[7px] text-[13.5px] font-semibold tracking-[-0.2px] text-[#6B7684]">{category}</span>
          </div>
          <p className="qd-a-sub mt-1 text-[14px] tracking-[-0.2px] text-[#8B95A1]">
            {[shortRegion(address), `사진 ${images.length}장`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInquiryOpen(true)}
          className="flex h-[34px] shrink-0 items-center rounded-[10px] bg-[#E8F3FF] px-3 text-[15px] font-semibold tracking-[-0.2px] text-[#3182F6] transition active:scale-[0.97] active:bg-[#D6E9FF]"
        >
          문의
        </button>
      </div>

      {/* 본문 — 칸마다 오른쪽→왼쪽 차례 등장(퀵매칭) */}
      <div className="qd-body">
        {intro ? (
          <p className="mt-3.5 whitespace-pre-line break-keep px-4 text-[16.5px] leading-[1.65] tracking-[-0.3px] text-[#191F28]">{intro}</p>
        ) : <div className="h-0" />}

        {/* 사진 넘겨보기 — 웨딩숲 미디어처럼 둥글게(r16), N/M 유리 알약, 누르면 크게 */}
        <div className="relative mx-4 mt-3.5 overflow-hidden rounded-[16px] bg-[#F2F4F6]">
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
          {images.length > 1 && (
            <span
              className="pointer-events-none absolute bottom-3 right-3 inline-flex h-[26px] items-center rounded-full px-2.5 text-[12.5px] font-semibold tracking-[-0.2px] text-white"
              style={{ backgroundColor: 'rgba(0,0,0,0.36)', WebkitBackdropFilter: 'blur(10px)', backdropFilter: 'blur(10px)' }}
            >
              {heroIndex + 1} / {images.length}
            </span>
          )}
        </div>

        {/* 칩 — 웨딩숲 카테고리 칩(회색 · 모서리 6 · 13) */}
        {tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4">
            {tags.map((tag) => (
              <span key={tag} className="rounded-[6px] bg-[#F2F4F6] px-[9px] py-1 text-[13px] font-semibold text-[#6B7684]">{tag}</span>
            ))}
          </div>
        ) : <div className="h-0" />}

        {/* 액션 줄 — 문의 · 길찾기 · 인스타그램/웹사이트 · 공유 */}
        <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-1 px-4">
          <button type="button" onClick={() => setInquiryOpen(true)} className={actCls}>
            <TossCommentIcon />
            문의
          </button>
          <a href={kakaoRoute} target="_blank" rel="noopener noreferrer" className={actCls}>
            <Navigation size={21} strokeWidth={1.9} />
            길찾기
          </a>
          {biz.instagramUrl ? (
            <a href={biz.instagramUrl} target="_blank" rel="noopener noreferrer" className={actCls}>
              <Instagram size={22} strokeWidth={1.9} />
              인스타그램
            </a>
          ) : website ? (
            <a href={website} target="_blank" rel="noopener noreferrer" className={actCls}>
              <Globe size={21} strokeWidth={1.9} />
              웹사이트
            </a>
          ) : null}
          <button type="button" onClick={share} className={actCls}>
            <TossShareIcon />
            공유
          </button>
        </div>

        {/* 10px 회색 띠 — 웨딩숲 상세 구분 */}
        <div className="mt-5 h-2.5 bg-[#F2F4F6]" />

        {/* 사진 모아보기 — 3열 · 3px 틈 · 모서리 16, 9장 넘으면 마지막 칸 +N */}
        <section className="px-4 pt-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[19px] font-bold tracking-[-0.4px] text-[#191F28]">사진 <span className="text-[#3182F6]">{images.length}</span></h2>
            {images.length > 1 && (
              <button type="button" onClick={() => setViewerAt(0)} className="flex items-center text-[14px] font-medium text-[#8B95A1]">
                전체보기 <ChevronRight size={16} />
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

        {/* 위치 — 구글 지도 임베드(키 없이), 누르면 카카오맵 · 브랜드 색 버튼(사장 제공 아이콘) */}
        {address ? (
          <section className="px-4 pt-8">
            <h2 className="text-[19px] font-bold tracking-[-0.4px] text-[#191F28]">위치</h2>
            <div className="mt-2 flex items-start justify-between gap-3">
              <p className="break-keep text-[15px] leading-[1.6] tracking-[-0.2px] text-[#4E5968]">{address}</p>
              <button type="button" onClick={copyAddress} className="flex h-8 shrink-0 items-center rounded-[8px] bg-[#F2F4F6] px-2.5 text-[13px] font-semibold text-[#4E5968] active:bg-[#E5E8EB]">
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
        ) : <div className="h-0" />}

        {/* 업체 정보 */}
        <section className="px-4 pt-8">
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
      </div>

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
