'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion, type Transition } from 'framer-motion';
import { MyDetailHeader, QdBackIcon, QdBody } from '../_components/detail-ui';
import { RgChip, RgCta, RgField, RgOption, RgToggle } from '../../pro-register/_components/RegisterKit';
import { CameraIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, CloseIcon, LockIcon, StarIcon } from '@/components/icons/mono';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { useAuthStore } from '@/lib/store/auth.store';
import { prosApi } from '@/lib/api/pros.api';
import { usersApi } from '@/lib/api/users.api';
import {
  WEDDING_OPTION_SUGGESTIONS,
  WEDDING_PLAN_TEMPLATES,
  buildWeddingServices,
  migrateWeddingCustomOptions,
  migrateWeddingPlanKeys,
  migrateWeddingPlanPrices,
  normalizeWeddingPlanKey,
  parseWeddingOptionsFromDescription,
} from '@/lib/wedding-plans';
/* ─── Constants ─── */
const WEDDING_TAGS = ['결혼식', '돌잔치', '회갑/칠순', '상견례'];
const EVENT_TAGS = ['기업행사', '컨퍼런스/세미나', '체육대회', '송년회/시무식', '레크리에이션', '팀빌딩', '라이브커머스', '기업PT', '축제/페스티벌', '공식행사'];
const OTHER_TAGS = ['레슨/클래스', '쇼호스트', '축가/연주'];
const ALL_CATEGORIES = [...WEDDING_TAGS, ...EVENT_TAGS, ...OTHER_TAGS];

const REGIONS = ['전국가능', '수도권(서울/인천/경기)', '강원도', '충청권', '전라권', '경상권', '제주'];

const LANGUAGES = ['영어', '일본어', '중국어', '스페인어', '프랑스어', '독일어', '러시아어', '아랍어', '베트남어', '태국어'];

const CAREER_YEARS = Array.from({ length: 30 }, (_, i) => i + 1);
const PRO_EDIT_PROFILE_CACHE_PREFIX = 'freetiful-pro-edit-profile-cache-v1';
const PRO_EDIT_PROFILE_CACHE_TTL = 60 * 60_000;
const PROFILE_PHOTO_MAX_DIMENSION = 1600;
const PROFILE_PHOTO_TARGET_BYTES = 3.5 * 1024 * 1024;

type ProPhotoItem = {
  id?: string;
  url: string;
  file?: File;
  isLocal?: boolean;
};

/* ─── Helpers ─── */
function ls(key: string, fallback: string = ''): string {
  if (typeof window === 'undefined') return fallback;
  return localStorage.getItem(key) || fallback;
}
function lsJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

function safeSetLocalStorage(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`localStorage write skipped: ${key}`, error);
  }
}

function getProEditProfileCacheKey(userId?: string | null) {
  return `${PRO_EDIT_PROFILE_CACHE_PREFIX}:${userId || 'anonymous'}`;
}

function compactProfileForCache(profile: any) {
  if (!profile || typeof profile !== 'object') return null;
  return {
    id: profile.id,
    userId: profile.userId,
    status: profile.status,
    user: profile.user,
    isProfileHidden: Boolean(profile.isProfileHidden),
    shortIntro: profile.shortIntro,
    phone: profile.phone,
    careerYears: profile.careerYears,
    tags: profile.tags,
    detailHtml: profile.detailHtml,
    gender: profile.gender,
    youtubeUrl: profile.youtubeUrl,
    images: profile.images,
    categories: profile.categories,
    regions: profile.regions,
    isNationwide: profile.isNationwide,
    languages: profile.languages,
    services: profile.services,
  };
}

function readProEditProfileCache(userId?: string | null) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getProEditProfileCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || Date.now() - parsed.ts > PRO_EDIT_PROFILE_CACHE_TTL) return null;
    if (userId && parsed.userId && parsed.userId !== userId) return null;
    return parsed.profile || null;
  } catch {
    return null;
  }
}

function writeProEditProfileCache(userId: string | undefined | null, profile: any) {
  if (typeof window === 'undefined' || !userId) return;
  const compact = compactProfileForCache(profile);
  if (!compact) return;
  try {
    localStorage.setItem(
      getProEditProfileCacheKey(userId),
      JSON.stringify({ ts: Date.now(), userId, profile: compact }),
    );
  } catch {}
}

function dataUrlToFile(dataUrl: string, filename: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  const bytes = atob(match[2]);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) buffer[i] = bytes.charCodeAt(i);
  const ext = match[1].split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  return new File([buffer], `${filename}.${ext}`, { type: match[1] });
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('이미지를 읽을 수 없습니다.'));
    reader.readAsDataURL(file);
  });
}

// 상세설명 인라인 이미지: 리사이즈+압축해서 base64 용량을 대폭 축소 (저장 속도/본문 크기 개선)
function compressImageToDataUrl(file: File, maxW = 1200, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        URL.revokeObjectURL(objectUrl);
        const scale = Math.min(1, maxW / (img.width || maxW));
        const w = Math.max(1, Math.round((img.width || maxW) * scale));
        const h = Math.max(1, Math.round((img.height || maxW) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('no ctx')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        reject(err as Error);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('이미지 로드 실패')); };
    img.src = objectUrl;
  });
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지 미리보기를 생성할 수 없습니다.'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('이미지를 압축할 수 없습니다.'));
    }, type, quality);
  });
}

function isSelectableImageFile(file: File) {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

async function canvasSupportsWebp(): Promise<boolean> {
  try {
    const c = document.createElement('canvas');
    c.width = 1; c.height = 1;
    const blob: Blob | null = await new Promise((resolve) => c.toBlob(resolve, 'image/webp', 0.8));
    return !!blob && blob.type === 'image/webp';
  } catch { return false; }
}

async function normalizeProfilePhoto(file: File): Promise<ProPhotoItem> {
  const originalUrl = await fileToDataUrl(file);
  const isHeicLike = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);

  try {
    const img = await loadImageElement(originalUrl);
    const longestSide = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
    // 1280px 이상은 다운사이징 — 모바일 디스플레이에선 더 클 필요 없음
    const scale = Math.min(1, 1280 / Math.max(1, longestSide));
    const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('이미지 캔버스를 만들 수 없습니다.');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    // 우선 WebP 시도 — 동일 화질에서 JPEG 대비 30~50% 작음
    const webpSupported = await canvasSupportsWebp();
    let mime: string = 'image/jpeg';
    let ext = 'jpg';
    let quality = 0.82;
    let blob: Blob | null = null;
    const target = 1.2 * 1024 * 1024; // 1.2MB target — 모바일 업로드 안정성↑

    if (webpSupported) {
      mime = 'image/webp';
      ext = 'webp';
      blob = await canvasToBlob(canvas, mime, quality);
      while (blob && blob.size > target && quality > 0.55) {
        quality -= 0.08;
        blob = await canvasToBlob(canvas, mime, quality);
      }
    }
    if (!blob || blob.size > target * 2.5) {
      mime = 'image/jpeg';
      ext = 'jpg';
      quality = 0.82;
      blob = await canvasToBlob(canvas, mime, quality);
      while (blob.size > target && quality > 0.55) {
        quality -= 0.08;
        blob = await canvasToBlob(canvas, mime, quality);
      }
    }

    const normalizedName = (file.name.replace(/\.[^.]+$/, '') || 'profile-photo').slice(0, 60);
    const normalizedFile = new File([blob!], `${normalizedName}.${ext}`, {
      type: mime,
      lastModified: Date.now(),
    });
    const normalizedUrl = await fileToDataUrl(normalizedFile);
    return { url: normalizedUrl, file: normalizedFile, isLocal: true };
  } catch (error) {
    if (isHeicLike && file.size > 10 * 1024 * 1024) {
      throw new Error('HEIC 사진은 10MB 이하만 등록할 수 있습니다. 사진 앱에서 JPG로 저장한 뒤 다시 올려주세요.');
    }
    if (file.size > 10 * 1024 * 1024) throw error;
    return { url: originalUrl, file, isLocal: true };
  }
}

/* ─── 화면 부품 — 퀵매칭 어법(260928 사장 "태그·버튼·토글 전부 지금 톤앤매너·애니메이션에 맞게").
   칩·선택 카드·스위치·입력 묶음·버튼은 RegisterKit(파트너 신청과 공통), 여기엔 이 화면에만 쓰는 것만 ─── */
const SHEET_SPRING: Transition = { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 };
const POP_SPRING: Transition = { type: 'spring', stiffness: 520, damping: 26 };
// 상세설명 서식 도구 버튼(폭 32 — 묶음 다섯 개가 375 폭에서 두 줄에 들어간다)
const TOOL_BTN = 'flex h-9 min-w-[32px] items-center justify-center rounded-[10px] px-1.5 text-[#4E5968] transition-colors active:bg-[#E5E8EB] lg:hover:bg-[#EEF0F3]';

/** 묶음 — 제목 18 · 회색 설명 · 오른쪽 보조(개수) + 내용. QdBody 직계 칸이라 차례로 들어온다 */
function EditSection({ title, desc, aside, children }: { title: string; desc?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold leading-[1.4] tracking-[-0.3px] text-[#191F28]">{title}</h2>
          {desc && <p className="mt-1 text-[14px] leading-[1.5] text-[#8B95A1]">{desc}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** 'N / 최대' — 채운 수는 파랑(진행 막대 'N / 5' 와 같은 결) */
function Count({ n, max }: { n: number; max: number }) {
  return (
    <span className="flex-none text-[14px] font-medium tabular-nums text-[#8B95A1]">
      <b className={`font-semibold ${n > 0 ? 'text-[#3182F6]' : ''}`}>{n}</b> / {max}
    </span>
  );
}

/** 눌러서 아래 시트로 고르는 칸 — .qd-input 모양 + 오른쪽 꺾쇠 */
function SheetPicker({ value, placeholder, onClick }: { value?: string; placeholder?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="qd-input flex items-center justify-between gap-3 text-left active:bg-[#F9FAFB]">
      <span className={`truncate ${value ? 'text-[#191F28]' : 'text-[#B0B8C1]'}`}>{value || placeholder}</span>
      <ChevronDownIcon size={22} className="flex-none text-[#B0B8C1]" />
    </button>
  );
}

/** 아래 시트 — 스프링으로 올라오고 닫을 땐 내려간다(PC 는 가운데 카드로 떠오름) · 떠 있는 동안 뒤 화면 잠금.
 *  AI 응답설정 시트(pro-dashboard/inquiries/AiQuoteFab)와 같은 결 — .ft-* 의 CSS 등장은 끄고 framer 로 */
function Sheet({ open, onClose, className = '', style, children }: { open: boolean; onClose: () => void; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  useBodyScrollLock(open);
  const centered = typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="scrim"
          className="ft-scrim"
          style={{ animation: 'none' }}
          initial={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
          animate={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
          exit={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          onClick={onClose}
        >
          <motion.div
            className={`ft-sheet ${className}`}
            role="dialog"
            aria-modal="true"
            style={{ animation: 'none', overscrollBehavior: 'contain', ...style }}
            initial={centered ? { opacity: 0, y: 18, scale: 0.97 } : { y: '100%' }}
            animate={centered ? { opacity: 1, y: 0, scale: 1 } : { y: 0 }}
            exit={centered ? { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.18 } } : { y: '100%', transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
            transition={SHEET_SPRING}
            onClick={(e) => e.stopPropagation()}
          >
            {/* flex 열 시트에서도 손잡이가 눌려 사라지지 않게 shrink-0 */}
            <div className="ft-grab shrink-0" aria-hidden="true" />
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Main Page ─── */
export default function ProEditPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const authUser = useAuthStore((s) => s.user);

  /* ── State ── */
  const [showWithdraw, setShowWithdraw] = useState(false);   // 회원탈퇴 확인 모달 (confirm() 대신 — WKWebView 의존 제거)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [category, setCategory] = useState('');
  const [intro, setIntro] = useState('');
  const [careerYears, setCareerYears] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [photos, setPhotos] = useState<ProPhotoItem[]>([]);
  const [mainPhotoIndex, setMainPhotoIndex] = useState(0);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [isProfileHidden, setIsProfileHidden] = useState(false);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [detailHtml, setDetailHtml] = useState('');
  const detailHtmlRef = useRef('');
  detailHtmlRef.current = detailHtml; // 항상 최신 detailHtml 미러 (에디터 마운트 시 주입용)

  /* ── Pricing (결혼식 사회자 1부/1+2부 플랜 기반) ── */
  type PlanTpl = { planKey: string; label: string; defaultPrice: number; description: string; includedItems: string[] };
  const toPlanTpl = (t: any): PlanTpl => ({
    planKey: t.planKey,
    label: t.label,
    defaultPrice: Number(t.defaultPrice) || 0,
    description: t.description || '',
    includedItems: Array.isArray(t.includedItems) ? t.includedItems : [],
  });
  const [planTemplates] = useState<PlanTpl[]>(() => WEDDING_PLAN_TEMPLATES.map(toPlanTpl));
  const [enabledPlans, setEnabledPlans] = useState<Set<string>>(() => new Set(['wedding_part1']));
  const [planPrices, setPlanPrices] = useState<Record<string, number>>(() => migrateWeddingPlanPrices({}));
  const [customOptions, setCustomOptions] = useState<Record<string, { name: string; price: number }[]>>(() => migrateWeddingCustomOptions({}));
  const [activePlanTab, setActivePlanTab] = useState<string>('wedding_part1');
  const [newOptName, setNewOptName] = useState('');
  const [newOptPrice, setNewOptPrice] = useState('');
  useEffect(() => {
    if (enabledPlans.has(activePlanTab)) return;
    setActivePlanTab([...enabledPlans][0] || 'wedding_part1');
  }, [activePlanTab, enabledPlans]);
  const updatePlanPrice = (key: string, value: string) => {
    const price = Math.max(0, Math.floor(Number(value) || 0));
    setPlanPrices((prev) => ({ ...prev, [key]: price }));
  };
  const detailEditorRef = useRef<HTMLDivElement>(null);
  // 에디터가 (슬라이드 패널 열림 등으로) 마운트될 때 저장된 내용을 확실히 주입.
  // 동기화 effect는 포커스 중이면 건너뛰므로, 마운트 시점엔 ref 콜백으로 직접 채워 누락을 막는다.
  const setDetailEditorRef = useCallback((el: HTMLDivElement | null) => {
    detailEditorRef.current = el;
    if (el && (el.innerHTML || '') !== (detailHtmlRef.current || '')) {
      el.innerHTML = detailHtmlRef.current || '';
    }
  }, []);
  const detailImageInputRef = useRef<HTMLInputElement>(null);
  const detailColorInputRef = useRef<HTMLInputElement>(null);
  const detailDirtyRef = useRef(false);   // 사용자가 에디터를 직접 수정했는지 (로드 레이스로 덮어쓰기 방지)
  const execDetailFormat = (command: string, value?: string) => {
    detailEditorRef.current?.focus();
    document.execCommand(command, false, value);
    detailDirtyRef.current = true;
    setDetailHtml(detailEditorRef.current?.innerHTML || '');
  };
  const onDetailImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const dataUrl = await compressImageToDataUrl(file);   // 리사이즈+압축 → 저장 payload 대폭 축소
      detailEditorRef.current?.focus();
      document.execCommand('insertImage', false, dataUrl);
      detailDirtyRef.current = true;
      setDetailHtml(detailEditorRef.current?.innerHTML || '');
    } catch {
      setToast('이미지 처리에 실패했습니다');
      setTimeout(() => setToast(''), 2000);
    }
  };
  // 에디터 DOM을 detailHtml 상태와 동기화 — 로드/지연 마운트 시 채워주고, 입력 중(포커스)엔 건드리지 않아 커서·내용을 보존
  useEffect(() => {
    const el = detailEditorRef.current;
    if (!el || document.activeElement === el) return;
    if ((el.innerHTML || '') !== (detailHtml || '')) {
      el.innerHTML = detailHtml || '';
    }
  });
  const [videos, setVideos] = useState<string[]>([]);
  const [showYoutubeSearch, setShowYoutubeSearch] = useState(false);
  const [ytChannelQuery, setYtChannelQuery] = useState('');
  const [ytChannels, setYtChannels] = useState<Array<{ id: string; title: string; description: string; thumbnail: string }>>([]);
  const [ytVideos, setYtVideos] = useState<Array<{ id: string; title: string; thumbnail: string }>>([]);
  const [ytSelectedChannel, setYtSelectedChannel] = useState<string | null>(null);
  const [ytLoading, setYtLoading] = useState(false);

  const searchYtChannels = async () => {
    if (!ytChannelQuery.trim()) return;
    setYtLoading(true);
    setYtChannels([]);
    setYtVideos([]);
    setYtSelectedChannel(null);
    try {
      const res = await fetch(`/api/youtube?action=searchChannels&q=${encodeURIComponent(ytChannelQuery)}`);
      const data = await res.json();
      setYtChannels(data.channels || []);
    } catch {} finally { setYtLoading(false); }
  };

  const loadYtVideos = async (channelId: string) => {
    setYtSelectedChannel(channelId);
    setYtLoading(true);
    try {
      const res = await fetch(`/api/youtube?action=channelVideos&channelId=${channelId}`);
      const data = await res.json();
      setYtVideos(data.videos || []);
    } catch {} finally { setYtLoading(false); }
  };

  const addVideoUrl = (url: string) => {
    if (!url.trim()) return;
    if (videos.includes(url)) return;
    setVideos((prev) => [...prev, url]);
  };

  const removeVideo = (url: string) => {
    setVideos((prev) => prev.filter((v) => v !== url));
  };

  // YouTube 검색 닫기(뒤로·완료 공통) — 검색 상태 초기화
  const closeYoutubeSearch = () => { setShowYoutubeSearch(false); setYtChannels([]); setYtVideos([]); setYtSelectedChannel(null); setYtChannelQuery(''); };
  useBodyScrollLock(showYoutubeSearch);   // 전체 화면 검색이 떠 있는 동안 뒤 화면 잠금

  /* ── 동영상 파일 직접 업로드 (유튜브 없이) ── */
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadPct, setVideoUploadPct] = useState(0);
  const handleVideoFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || videoUploading) return;
    if (file.size > 100 * 1024 * 1024) {
      setToast('동영상은 100MB 이하만 업로드할 수 있습니다.');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    setVideoUploading(true);
    setVideoUploadPct(0);
    try {
      const { url } = await prosApi.uploadVideo(file, {
        onUploadProgress: (ev) => {
          if (ev.total) setVideoUploadPct(Math.min(100, Math.round((ev.loaded / ev.total) * 100)));
        },
      });
      if (url) {
        addVideoUrl(url);
        setToast('동영상이 업로드되었습니다. 저장하기를 눌러야 반영됩니다.');
      } else {
        setToast('동영상 업로드에 실패했습니다. 다시 시도해주세요.');
      }
      setTimeout(() => setToast(''), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || '동영상 업로드에 실패했습니다.';
      setToast(String(msg).slice(0, 80));
      setTimeout(() => setToast(''), 3000);
    } finally {
      setVideoUploading(false);
    }
  };
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const lastSyncedPhotoIdsRef = useRef<string[]>([]);
  const lastSyncedMainIndexRef = useRef(0);
  const handleAiGenerate = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const { aiApi } = await import('@/lib/api/ai.api');
      const out = await aiApi.generateProfile({
        name: name || undefined,
        category: category || undefined,
        careerYears,
        selectedTags: selectedCategories,
        languages,
        keywords: intro || undefined, // 기존 한줄소개를 톤 힌트로 전달
        imageDataUrls: photos.map((p) => p.url).filter((p) => p?.startsWith('data:image/')).slice(0, 4),
      });
      // 기존 값이 비어있는 필드만 덮어쓰기 (사용자가 입력한 값 보호)
      if (!intro && out.shortIntro) setIntro(out.shortIntro);
      // 상세설명 HTML 을 에디터에 주입 + state 동기화
      if (out.detailHtml) {
        detailDirtyRef.current = true;
        setDetailHtml(out.detailHtml);
        if (detailEditorRef.current) detailEditorRef.current.innerHTML = out.detailHtml;
        setTimeout(() => detailEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      }
      setToast('AI 텍스트 완료 — 이미지 생성 중...');

      // 히어로 이미지는 별도 요청 (7-18초 소요) — 텍스트는 이미 에디터에 반영됨
      try {
        const hero = await aiApi.generateHeroImage({
          name: name || undefined,
          category: category || undefined,
          keywords: intro || out.shortIntro,
          imageDataUrls: photos.map((p) => p.url).filter((p) => p?.startsWith('data:image/')).slice(0, 4),
        });
        console.log('[AI Hero] response:', hero);
        if (hero.url) {
          const imgTag = `<img src="${hero.url}" alt="${name || '사회자'} 프로필" style="max-width:100%;height:auto;border-radius:12px;margin-bottom:12px;display:block;" />`;
          if (detailEditorRef.current) {
            const before = detailEditorRef.current.innerHTML;
            detailEditorRef.current.innerHTML = imgTag + before;
            detailDirtyRef.current = true;
            setDetailHtml(imgTag + before);
            detailEditorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          setToast(`AI 생성 완료 — 이미지 URL: ${hero.url}`);
        } else {
          const debugMsg = hero.debug?.join(' | ') || '원인 불명';
          console.warn('[AI Hero] no url, debug:', hero.debug);
          setToast(`이미지 생성 실패: ${debugMsg.slice(0, 100)}`);
        }
      } catch (e: any) {
        const msg = e?.response?.data?.message || e?.message || '네트워크 오류';
        console.warn('[AI Hero] error:', e);
        setToast(`이미지 생성 실패: ${msg.slice(0, 100)}`);
      }
      setTimeout(() => setToast(''), 8000);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '알 수 없는 오류';
      setToast(`AI 생성 실패: ${msg}`);
      setTimeout(() => setToast(''), 4000);
    } finally {
      setAiLoading(false);
    }
  };
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showCareerSheet, setShowCareerSheet] = useState(false);

  const applyLoadedProfile = (p: any) => {
    if (!p?.id) return;
    safeSetLocalStorage('freetiful-my-pro-id', p.id);
    if (p.shortIntro) setIntro(p.shortIntro);
    setIsProfileHidden(Boolean(p.isProfileHidden));
    if (typeof p.careerYears === 'number' && p.careerYears >= 0) setCareerYears(p.careerYears);
    if (Array.isArray(p.tags)) {
      const specialty = p.tags.filter((t: string) => ALL_CATEGORIES.includes(t));
      if (specialty.length > 0) setSelectedCategories(specialty);
    }
    if (typeof p.detailHtml === 'string' && !detailDirtyRef.current) {
      setDetailHtml(p.detailHtml);
      // DOM 반영은 아래 동기화 effect가 처리 (포커스/입력 중엔 안 건드려 커서·내용 보존)
    }
    if (p.gender) setGender(p.gender);
    if (p.youtubeUrl) {
      const urls = String(p.youtubeUrl).split(/\n+/).map((u: string) => u.trim()).filter(Boolean);
      setVideos((prev) => Array.from(new Set([...urls, ...prev])));
    }
    if (p.user?.name) setName(p.user.name);
    if (p.phone || p.user?.phone) setPhone(p.phone || p.user.phone);
    if (Array.isArray(p.images) && p.images.length > 0) {
      const loadedPhotos = p.images
        .map((img: any) => ({
          id: typeof img === 'object' ? img.id : undefined,
          url: typeof img === 'object' ? img.imageUrl : img,
        }))
        .filter((img: ProPhotoItem) => Boolean(img.url));
      setPhotos(
        loadedPhotos,
      );
      setRemovedPhotoIds([]);
      const primaryIdx = p.images.findIndex((img: any) => img.isPrimary);
      const nextMainIndex = primaryIdx >= 0 ? primaryIdx : 0;
      if (primaryIdx >= 0) setMainPhotoIndex(primaryIdx);
      lastSyncedPhotoIdsRef.current = loadedPhotos.map((img: ProPhotoItem) => img.id).filter(Boolean) as string[];
      lastSyncedMainIndexRef.current = nextMainIndex;
    }
    if (Array.isArray(p.categories) && p.categories.length > 0) {
      const catName = p.categories[0]?.category?.name;
      if (catName) setCategory(catName);
    }
    if (Array.isArray(p.regions) && p.regions.length > 0) {
      const names = p.regions.map((r: any) => r?.region?.name).filter(Boolean);
      if (names.length > 0) setSelectedRegions(names);
    } else if (p.isNationwide) {
      setSelectedRegions(['전국가능']);
    }
    if (Array.isArray(p.languages) && p.languages.length > 0) {
      setLanguages(p.languages.map((l: any) => l.languageCode).filter(Boolean));
    }
    if (Array.isArray(p.services) && p.services.length > 0) {
      const enabled = new Set<string>();
      const prices: Record<string, number> = {};
      const options: Record<string, { name: string; price: number }[]> = migrateWeddingCustomOptions({});
      for (const s of p.services) {
        if (!s?.title) continue;
        const key = normalizeWeddingPlanKey(s.title || s.id);
        if (!key) continue;
        enabled.add(key);
        if (typeof s.basePrice === 'number' && s.basePrice >= 0) prices[key] = s.basePrice;
        const parsedOptions = parseWeddingOptionsFromDescription(s.description);
        if (parsedOptions.length > 0) {
          options[key] = parsedOptions;
        }
      }
      const migratedEnabled = migrateWeddingPlanKeys([...enabled]);
      if (migratedEnabled.length > 0) {
        setEnabledPlans(new Set(migratedEnabled));
        setActivePlanTab(migratedEnabled[0]);
      }
      setPlanPrices(migrateWeddingPlanPrices(prices));
      setCustomOptions(options);
    }
  };

  /* ── Load from localStorage (즉시) + 서버(최신 기준 덮어쓰기) ── */
  useEffect(() => {
    window.scrollTo(0, 0);
    // 1) localStorage 로 폼 즉시 채움 (체감 속도)
    // 이름은 authUser.name (로그인된 실계정 이름) 을 우선 사용. localStorage 는 fallback.
    setName(authUser?.name || ls('proRegister_name'));
    setPhone(ls('proRegister_phone'));
    setGender(ls('proRegister_gender'));
    setCategory(ls('proRegister_category'));
    setIntro(ls('proRegister_intro'));
    setCareerYears(parseInt(ls('proRegister_careerYears', '1')) || 1);
    setSelectedCategories(lsJson('proRegister_selectedCategories', []));
    setSelectedRegions(lsJson('proRegister_selectedRegions', []));
    setPhotos(lsJson<string[]>('proRegister_photos', []).map((url) => ({ url, isLocal: url?.startsWith('data:image/') })));
    setMainPhotoIndex(parseInt(ls('proRegister_mainPhotoIndex', '0')) || 0);
    setLanguages(lsJson('proRegister_languages', []));
    const savedVideos = lsJson<string[] | null>('proRegister_videos', null);
    if (Array.isArray(savedVideos)) setVideos(savedVideos);
    setEnabledPlans(new Set(migrateWeddingPlanKeys(lsJson('proRegister_enabledPlans', []))));
    setPlanPrices(migrateWeddingPlanPrices(lsJson('proRegister_prices', {})));
    setCustomOptions(migrateWeddingCustomOptions(lsJson('proRegister_customOptions', {})));

    const cachedProfile = readProEditProfileCache(authUser?.id);
    if (cachedProfile) applyLoadedProfile(cachedProfile);

    // 2) 서버에서 최신 프로필 가져와 덮어쓰기 (stale localStorage 방지) + my-pro-id 저장
    (async () => {
      try {
        const p: any = await prosApi.getMyProfile();
        if (!p?.id) return;
        applyLoadedProfile(p);
        writeProEditProfileCache(authUser?.id || p.userId || p.user?.id, p);
      } catch { /* 로컬 폼 유지 */ }
    })();
  }, [authUser?.id]);

  /* ── Formatters ── */
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '').slice(0, 11);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  };

  /* ── Toggle helpers ── */
  const toggleRegion = (region: string) => {
    setSelectedRegions(prev => prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]);
  };
  const toggleLanguage = (lang: string) => {
    setLanguages(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]);
  };

  /* ── Photo handlers ── */
  const handleAddPhoto = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const currentCount = photos.length;
    const availableSlots = Math.max(0, 10 - currentCount);
    const selectedFiles = Array.from(files)
      .filter(isSelectableImageFile)
      .slice(0, availableSlots);

    if (availableSlots <= 0) {
      setToast('프로필 사진은 최대 10장까지 등록할 수 있습니다.');
      setTimeout(() => setToast(''), 2200);
      e.target.value = '';
      return;
    }
    if (files.length > selectedFiles.length) {
      setToast(`최대 10장까지 등록됩니다. ${selectedFiles.length}장만 추가했어요.`);
      setTimeout(() => setToast(''), 2500);
    }

    try {
      setToast('사진을 최적화하고 있습니다...');
      const nextPhotos = await Promise.all(selectedFiles.map(normalizeProfilePhoto));
      setPhotos((prev) => [...prev, ...nextPhotos]);
      setToast('');
    } catch {
      setToast('일부 사진을 불러오지 못했습니다. 10MB 이하 JPG/PNG 사진으로 다시 선택해주세요.');
      setTimeout(() => setToast(''), 2500);
    } finally {
      e.target.value = '';
    }
  };
  const handleRemovePhoto = (index: number) => {
    const target = photos[index];
    if (target?.id) {
      setRemovedPhotoIds((prev) => (prev.includes(target.id!) ? prev : [...prev, target.id!]));
    }
    setPhotos(prev => prev.filter((_, i) => i !== index));
    if (mainPhotoIndex === index) setMainPhotoIndex(0);
    else if (mainPhotoIndex > index) setMainPhotoIndex(prev => prev - 1);
  };
  const handleSetMain = (index: number) => setMainPhotoIndex(index);

  const haveProfilePhotosChanged = (items: ProPhotoItem[], selectedMainIndex: number) => {
    if (removedPhotoIds.length > 0) return true;
    if (items.some((item) => !item.id)) return true;
    const ids = items.map((item) => item.id).filter(Boolean) as string[];
    const lastIds = lastSyncedPhotoIdsRef.current;
    if (ids.length !== lastIds.length) return true;
    if (ids.some((id, index) => id !== lastIds[index])) return true;
    return selectedMainIndex !== lastSyncedMainIndexRef.current;
  };

  const uploadPhotosWithLimit = async (tasks: Array<() => Promise<{ index: number; uploaded: any }>>, limit = 3) => {
    const results: { index: number; uploaded: any }[] = [];
    let cursor = 0;
    const worker = async () => {
      while (cursor < tasks.length) {
        const task = tasks[cursor];
        cursor += 1;
        results.push(await task());
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
    return results;
  };

  const applySyncedPhotos = (images: any[], selectedMainIndex = 0, primaryId?: string) => {
    const normalizedImages = Array.isArray(images) ? images : [];
    const nextPhotos = normalizedImages
      .map((img: any) => ({
        id: img.id,
        url: img.imageUrl || img.url,
      }))
      .filter((img: ProPhotoItem) => Boolean(img.url));
    setRemovedPhotoIds([]);
    setPhotos(nextPhotos);

    const primaryIndex = normalizedImages.findIndex((img: any) => (
      img.isPrimary || (primaryId && img.id === primaryId)
    ));
    const nextPrimaryIndex = primaryIndex >= 0
      ? primaryIndex
      : Math.max(0, Math.min(selectedMainIndex, Math.max(0, nextPhotos.length - 1)));
    setMainPhotoIndex(nextPrimaryIndex);
    lastSyncedPhotoIdsRef.current = nextPhotos.map((img) => img.id).filter(Boolean) as string[];
    lastSyncedMainIndexRef.current = nextPrimaryIndex;
    safeSetLocalStorage('proRegister_photos', JSON.stringify(nextPhotos.map((img) => img.url).filter(Boolean)));
    safeSetLocalStorage('proRegister_mainPhotoIndex', String(nextPrimaryIndex));

    return {
      images: normalizedImages,
      primaryId: normalizedImages[nextPrimaryIndex]?.id,
    };
  };

  const syncProfilePhotosViaPayload = async (items: ProPhotoItem[], selectedMainIndex: number) => {
    const photoUrls: string[] = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (item.url && !item.url.startsWith('blob:')) {
        photoUrls.push(item.url);
        continue;
      }
      if (item.file) {
        photoUrls.push(await fileToDataUrl(item.file));
      }
    }
    await prosApi.submitRegistration({
      photos: photoUrls,
      mainPhotoIndex: Math.max(0, Math.min(selectedMainIndex, Math.max(0, photoUrls.length - 1))),
    });
    const refreshed = await prosApi.getImages();
    return applySyncedPhotos(Array.isArray(refreshed) ? refreshed : [], selectedMainIndex);
  };

  const syncProfilePhotos = async (items: ProPhotoItem[], selectedMainIndex: number) => {
    if (!haveProfilePhotosChanged(items, selectedMainIndex)) {
      return {
        images: items.map((item, index) => ({
          id: item.id,
          imageUrl: item.url,
          isPrimary: index === selectedMainIndex,
        })),
        primaryId: items[selectedMainIndex]?.id,
      };
    }

    try {
      await Promise.all(removedPhotoIds.map((id) => prosApi.deleteImage(id).catch(() => null)));

      const uploadWithRetry = async (file: File, attempts = 3): Promise<any> => {
        let lastErr: any;
        for (let i = 0; i < attempts; i++) {
          try {
            return await prosApi.uploadImage(file);
          } catch (e) {
            lastErr = e;
            // 네트워크 일시 오류일 가능성 — 짧게 backoff 후 재시도
            await new Promise((r) => setTimeout(r, 600 * (i + 1)));
          }
        }
        throw lastErr;
      };
      const uploadTasks = items.flatMap((item, index) => {
        if (item.id) return [];
        const file = item.file || (item.url?.startsWith('data:image/') ? dataUrlToFile(item.url, `profile-${index + 1}`) : null);
        if (!file) return [];
        return [() => uploadWithRetry(file).then((uploaded) => ({ index, uploaded }))];
      });
      // 업로드 속도 개선: 최대 3장 동시(재시도/백오프는 uploadWithRetry 가 유지)
      const uploadedResults = await uploadPhotosWithLimit(uploadTasks, Math.max(1, Math.min(3, uploadTasks.length)));
      const uploadedByIndex = new Map(uploadedResults.map(({ index, uploaded }) => [index, uploaded]));

      const finalItems = items
        .map((item, index) => item.id ? item : uploadedByIndex.get(index))
        .filter((item: any) => Boolean(item?.id));

      const orderedIds = finalItems.map((item: any) => item.id);
      const primaryId = finalItems[Math.max(0, Math.min(selectedMainIndex, Math.max(0, finalItems.length - 1)))]?.id;
      const reordered = orderedIds.length > 0
        ? await prosApi.reorderImages(orderedIds, primaryId)
        : await prosApi.getImages();

      return applySyncedPhotos(Array.isArray(reordered) ? reordered : finalItems, selectedMainIndex, primaryId);
    } catch (error) {
      console.warn('프로필 사진 multipart 저장 실패, payload 저장으로 재시도:', error);
      return syncProfilePhotosViaPayload(items, selectedMainIndex);
    }
  };

  const patchCachedProfileVisibility = (nextHidden: boolean) => {
    if (typeof window === 'undefined') return;
    const userId = authUser?.id;
    if (!userId) return;
    try {
      const cached = readProEditProfileCache(userId);
      if (!cached) return;
      writeProEditProfileCache(userId, { ...cached, isProfileHidden: nextHidden });
    } catch {}
  };

  const handleToggleProfileVisibility = async () => {
    if (visibilitySaving) return;
    const nextHidden = !isProfileHidden;
    setIsProfileHidden(nextHidden);
    setVisibilitySaving(true);
    patchCachedProfileVisibility(nextHidden);

    try {
      await prosApi.updateProfileVisibility(nextHidden);
      setToast(nextHidden ? '프로필이 숨김 처리되었습니다.' : '프로필 공개가 다시 켜졌습니다.');
      setTimeout(() => setToast(''), 1800);
    } catch (error: any) {
      setIsProfileHidden(!nextHidden);
      patchCachedProfileVisibility(!nextHidden);
      const message = error?.response?.data?.message || error?.message || '프로필 공개 설정을 변경하지 못했습니다.';
      setToast(String(message));
      setTimeout(() => setToast(''), 2500);
    } finally {
      setVisibilitySaving(false);
    }
  };

  /* ── Save ── */
  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setToast('프로필 저장 중...');
    // 에디터의 실제 내용을 저장 소스로 사용 (상태가 늦게 반영돼도 상세설명 유실 방지)
    const currentDetailHtml = (detailEditorRef.current?.innerHTML ?? detailHtml) || '';
    try {
      // 1) localStorage 저장 (즉시 UI 반영용). 새로 선택한 base64 사진은 용량이 커서 저장하지 않는다.
      const persistedPhotoUrls = photos
        .filter((photo) => photo.id && photo.url && !photo.url.startsWith('data:image/'))
        .map((photo) => photo.url);
      safeSetLocalStorage('proRegister_name', name);
      safeSetLocalStorage('proRegister_phone', phone);
      safeSetLocalStorage('proRegister_gender', gender);
      safeSetLocalStorage('proRegister_category', category);
      safeSetLocalStorage('proRegister_intro', intro);
      safeSetLocalStorage('proRegister_careerYears', String(careerYears));
      safeSetLocalStorage('proRegister_selectedCategories', JSON.stringify(selectedCategories));
      safeSetLocalStorage('proRegister_selectedRegions', JSON.stringify(selectedRegions));
      safeSetLocalStorage('proRegister_photos', JSON.stringify(persistedPhotoUrls));
      safeSetLocalStorage('proRegister_mainPhotoIndex', String(mainPhotoIndex));
      safeSetLocalStorage('proRegister_languages', JSON.stringify(languages));
      safeSetLocalStorage('proRegister_videos', JSON.stringify(videos));
      safeSetLocalStorage('proRegister_enabledPlans', JSON.stringify([...enabledPlans]));
      safeSetLocalStorage('proRegister_prices', JSON.stringify(planPrices));
      safeSetLocalStorage('proRegister_customOptions', JSON.stringify(customOptions));

      // 2) 서버에 업데이트 (pro detail 페이지 반영)
      // 전문영역은 이 화면에서 뺐다(사장 지시 260925) → tags 는 **보내지 않는다**.
      // 서버 submitRegistration 은 tags 키가 없으면 기존 값을 그대로 두므로, 홈 카테고리 필터(tags 기반)가 안 깨진다.
      // (보내면 기기에 남은 옛 localStorage 값으로 덮일 수 있다)
      const servicesPayload = buildWeddingServices(enabledPlans, planPrices, customOptions);

      const profilePayload = {
        // name 은 서버에서 무시됨 (User.name = 가입 시 실계정 이름, 변경 불가)
        phone,
        gender,
        shortIntro: intro,
        careerYears,
        detailHtml: currentDetailHtml,
        youtubeUrl: videos.filter(Boolean).join('\n'),   // 여러 영상 — 개행 조인(단일 데이터 호환)
        isProfileHidden,
        languages: languages,
        category: category || undefined,
        regions: selectedRegions,
        services: servicesPayload,
      };

      // 프로필 저장과 사진 동기화는 서로 독립 — 병렬 실행해 순차 대기(저장 느림) 제거
      const [editResponse, photoResult] = (await Promise.all([
        prosApi.submitRegistration(profilePayload),
        syncProfilePhotos(photos, mainPhotoIndex).catch((error) => ({ error })),
      ])) as [any, any];
      const syncedImages = Array.isArray(photoResult?.images) ? photoResult.images : undefined;
      if (photoResult?.error) {
        const photoError = photoResult.error;
        console.error('프로필 사진 저장 실패:', photoError);
        const message = photoError?.response?.data?.message || photoError?.message || '사진 저장에 실패했습니다. 10MB 이하 JPG/PNG 사진으로 다시 시도해주세요.';
        setToast(`기본 정보는 저장됐지만 ${String(message).slice(0, 80)}`);
        setTimeout(() => setToast(''), 5000);
        return;
      }
      // 백엔드 응답에 updated user가 포함됨 — 즉시 auth store 갱신
      try {
        const newImg = syncedImages?.find((img: any) => img.isPrimary)?.imageUrl || editResponse?.user?.profileImageUrl;
        if (newImg && authUser) {
          useAuthStore.getState().setUser({ ...authUser, profileImageUrl: newImg });
        }
      } catch {}
      // 저장 완료 후 불필요한 상세/목록 재호출을 기다리지 않고 즉시 반영한다.
      const myProId: string | null = editResponse?.id || editResponse?.profile?.id || null;
      if (syncedImages) editResponse.images = syncedImages;
      const optimisticSavedProfile = {
        ...editResponse,
        id: myProId || editResponse?.id,
        userId: authUser?.id || editResponse?.userId || editResponse?.user?.id,
        user: editResponse?.user || authUser,
        phone,
        gender,
        shortIntro: intro,
        careerYears,
        detailHtml: currentDetailHtml,
        youtubeUrl: videos.filter(Boolean).join('\n'),   // 여러 영상 — 개행 조인(단일 데이터 호환)
        isProfileHidden,
        // 전문영역은 안 바꿨다 — 서버가 돌려준 값(없으면 불러온 값) 그대로
        tags: Array.isArray(editResponse?.tags) ? editResponse.tags : selectedCategories,
        images: syncedImages || editResponse?.images,
        languages: languages.map((languageCode) => ({ languageCode })),
        categories: category ? [{ category: { name: category } }] : [],
        regions: selectedRegions.map((regionName) => ({ region: { name: regionName } })),
        isNationwide: selectedRegions.includes('전국가능') || selectedRegions.length === 0,
        services: servicesPayload,
      };
      try {
        const { invalidateProCache } = await import('@/lib/api/discovery.api');
        invalidateProCache(); // 클라 메모리 캐시 전체 삭제
        try { localStorage.removeItem('freetiful-pros-cache'); localStorage.removeItem('freetiful-pros-cache-v6'); } catch {}   // 홈 첫페인트 캐시까지 무효화
        if (myProId) safeSetLocalStorage('freetiful-my-pro-id', myProId);
        writeProEditProfileCache(authUser?.id || editResponse?.userId || editResponse?.user?.id, optimisticSavedProfile);
      } catch {}
      setToast('저장되었습니다');
      // 상세 페이지로 이동 (타임스탬프로 HTTP 캐시 버스트)
      setTimeout(() => {
        if (myProId) {
          window.location.replace(`/pros/${myProId}?_=${Date.now()}`);   // replace: 뒤로가기가 프로필수정으로 안 돌아가게
        } else {
          setToast('');
        }
      }, 1000);
    } catch (e) {
      console.error('프로필 저장 실패:', e);
      setToast('저장에 실패했습니다. 다시 시도해주세요.');
      setTimeout(() => setToast(''), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
    <div className="mx-auto min-h-screen max-w-lg bg-white lg:max-w-2xl" style={{ letterSpacing: '-0.02em' }}>
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />

      {/* ─── Header — 퀵매칭 어법(뒤로 + 큰 제목 아래→위 페이드) ─── */}
      <MyDetailHeader title="프로필 수정" sub="고객에게 보이는 사회자 프로필이에요" />

      {/* ─── 본문 — 묶음(직계 칸)이 오른쪽→왼쪽으로 차례 등장. 시트·토스트는 밖에(안에 두면 늦게 미끄러진다) ─── */}
      <QdBody className="space-y-11 px-6 pb-8 pt-1">
        {/* ─── 1. 기본 정보 ─── */}
        <EditSection title="기본 정보">
          <RgField label="이름" hint={<span className="inline-flex items-center gap-1"><LockIcon size={12} />이름은 바꿀 수 없어요</span>}>
            <div className="qd-input flex items-center !bg-[#F9FAFB] !text-[#8B95A1]">
              <span className="truncate">{name || '-'}</span>
            </div>
          </RgField>

          <RgField label="전화번호">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
              placeholder="010-0000-0000"
              className="qd-input"
            />
          </RgField>

          {/* 성별 — 한 번 더 누르면 해제 */}
          <RgField label="성별">
            <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="성별">
              {['남성', '여성'].map((g) => (
                <RgOption key={g} role="radio" on={gender === g} onClick={() => setGender(gender === g ? '' : g)} label={g} />
              ))}
            </div>
          </RgField>

          <RgField label="사회자분류">
            <SheetPicker value={category} placeholder="선택해주세요" onClick={() => setShowCategorySheet(true)} />
          </RgField>
        </EditSection>

        {/* ─── 프로필 공개 설정 — 누르는 즉시 서버 반영 ─── */}
        <EditSection title="프로필 공개 설정">
          <div className="qd-card px-[18px] py-2.5">
            <RgToggle
              checked={isProfileHidden}
              onChange={() => handleToggleProfileVisibility()}
              disabled={visibilitySaving}
              label="프로필 숨김"
              hint="켜 두면 홈, 리스트, 검색에서 내 프로필이 보이지 않아요"
            />
          </div>
        </EditSection>

        {/* ─── 2. 한줄 소개 ─── */}
        <EditSection title="한줄 소개" aside={<Count n={intro.length} max={50} />}>
          <input
            type="text"
            value={intro}
            onChange={(e) => { if (e.target.value.length <= 50) setIntro(e.target.value); }}
            maxLength={50}
            placeholder="한줄로 자신을 소개해주세요"
            className="qd-input"
          />
        </EditSection>

        {/* ─── 3. 경력 — 칸을 누르면 1~30년 시트, 아래 칩은 바로 고르기 ─── */}
        <EditSection title="경력">
          <SheetPicker value={`${careerYears}년`} onClick={() => setShowCareerSheet(true)} />
          <div className="mt-3 flex flex-wrap gap-2">
            {[1, 3, 5, 7, 10, 15, 20, 25, 30].map((y) => (
              <RgChip key={y} on={careerYears === y} onClick={() => setCareerYears(y)}>{y}년</RgChip>
            ))}
          </div>
        </EditSection>

        {/* ─── 5. 행사 가능 지역 ─── */}
        <EditSection title="행사 가능 지역" desc="여러 곳을 고를 수 있어요">
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {REGIONS.map((region) => (
              <RgOption key={region} on={selectedRegions.includes(region)} onClick={() => toggleRegion(region)} label={region} />
            ))}
          </div>
        </EditSection>

        {/* ─── 6. 프로필 사진 — 대표는 파란 테두리 + 배지(톡), 나머지는 '대표로' ─── */}
        <EditSection title="프로필 사진" aside={<Count n={photos.length} max={10} />}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <button
              type="button"
              onClick={handleAddPhoto}
              className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[16px] bg-[#F2F4F6] text-[#8B95A1] transition-[transform,background-color] active:scale-[0.97] active:bg-[#E5E8EB] lg:hover:bg-[#EEF0F3]"
            >
              <CameraIcon size={26} />
              <span className="text-[13px] font-semibold text-[#4E5968]">여러 장 추가</span>
            </button>

            {photos.map((photo, index) => (
              <div key={photo.id || `${photo.url}-${index}`} className="relative aspect-square overflow-hidden rounded-[16px] bg-[#F2F4F6]">
                <img src={photo.url} alt={`프로필 사진 ${index + 1}`} className="h-full w-full object-cover" />
                {mainPhotoIndex === index ? (
                  <>
                    <motion.span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-[16px] ring-2 ring-inset ring-[#3182F6]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    />
                    <motion.span
                      className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-[#3182F6] px-2 py-[3px] text-[11px] font-semibold text-white"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={POP_SPRING}
                    >
                      <StarIcon size={10} /> 대표
                    </motion.span>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSetMain(index)}
                    className="absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-2.5 py-1 text-[12px] font-semibold text-[#333D4B] shadow-[0_2px_8px_rgba(0,0,0,0.12)] backdrop-blur-sm transition-transform active:scale-95"
                  >
                    대표로
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(index)}
                  aria-label="사진 삭제"
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-transform active:scale-90"
                >
                  <CloseIcon size={14} />
                </button>
              </div>
            ))}
          </div>
          {photos.length > 0 && (
            <p className="rg-hint">여러 장을 한 번에 고를 수 있어요. ‘대표로’를 누르면 대표 사진이 바뀌어요</p>
          )}
        </EditSection>

        {/* ─── 8. 언어 ─── */}
        <EditSection title="언어" desc="여러 개 고를 수 있어요">
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((lang) => (
              <RgChip key={lang} on={languages.includes(lang)} onClick={() => toggleLanguage(lang)}>{lang}</RgChip>
            ))}
          </div>
        </EditSection>

        {/* ─── 10. 소개영상 ─── */}
        <EditSection title="소개영상">
          <div className="space-y-2.5">
            {videos.map((url, i) => {
              const isUploadedVideo = url.includes('/uploads/');
              const embedSrc = url.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/');
              return (
                <div key={i} className="relative overflow-hidden rounded-[16px] bg-[#F2F4F6]">
                  {/* 업로드 영상은 원본 비율 그대로(세로 영상 — aspect-video 래퍼 금지) */}
                  {isUploadedVideo ? (
                    <video
                      src={`${url}#t=0.1`}
                      controls
                      playsInline
                      preload="metadata"
                      className="block w-full bg-black object-contain"
                      style={{ maxHeight: '70vh' }}
                    />
                  ) : (
                    <div className="aspect-video">
                      <iframe src={embedSrc} className="h-full w-full" allowFullScreen title={`영상 ${i + 1}`} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeVideo(url)}
                    aria-label="영상 삭제"
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white transition-transform active:scale-90"
                  >
                    <CloseIcon size={16} />
                  </button>
                </div>
              );
            })}
            <RgCta ghost onClick={() => setShowYoutubeSearch(true)}>영상 추가 (YouTube 검색)</RgCta>
            {/* 동영상 파일 직접 업로드 — 올라가는 만큼 버튼이 연파랑으로 차오른다 */}
            <input
              ref={videoFileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleVideoFileSelected}
            />
            <button
              type="button"
              disabled={videoUploading}
              onClick={() => videoFileInputRef.current?.click()}
              className="qd-cta ghost relative overflow-hidden disabled:!text-[#3182F6]"
            >
              {videoUploading && (
                <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-[#E8F3FF] transition-[width] duration-300 ease-out" style={{ width: `${videoUploadPct}%` }} />
              )}
              <span className="relative flex items-center gap-2">
                {videoUploading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    업로드 중... {videoUploadPct}%
                  </>
                ) : (
                  '동영상 파일 업로드 (100MB 이하)'
                )}
              </span>
            </button>
            {/* URL 직접 입력 — 엔터로 추가 */}
            <input
              type="url"
              placeholder="또는 YouTube 링크 직접 입력"
              className="qd-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value;
                  if (val.trim()) { addVideoUrl(val.trim()); (e.target as HTMLInputElement).value = ''; }
                }
              }}
            />
          </div>
        </EditSection>

        {/* ─── 10-1. 상세설명 (서식 도구 + 에디터 한 칸, 포커스면 파란 테두리) ─── */}
        <EditSection title="상세설명" desc="프로필 상세페이지에 보이는 자기소개예요">
          <div className="overflow-hidden rounded-[16px] border-[1.5px] border-[#E5E8EB] transition-colors focus-within:border-[#3182F6]">
            {/* 서식 도구 — 묶음 단위로만 줄바꿈 · onMouseDown preventDefault 로 에디터 포커스(선택 영역) 유지 */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-[#F2F4F6] bg-[#F9FAFB] px-2 py-1.5">
              <div className="flex items-center gap-0.5">
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execDetailFormat('bold'); }} className={`${TOOL_BTN} text-[15px] font-bold`} title="굵게" aria-label="굵게">B</button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execDetailFormat('italic'); }} className={`${TOOL_BTN} text-[15px] italic`} title="기울임" aria-label="기울임">I</button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execDetailFormat('underline'); }} className={`${TOOL_BTN} text-[15px] underline`} title="밑줄" aria-label="밑줄">U</button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execDetailFormat('strikeThrough'); }} className={`${TOOL_BTN} text-[15px] line-through`} title="취소선" aria-label="취소선">S</button>
              </div>
              <div className="flex items-center gap-0.5">
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execDetailFormat('formatBlock', '<h3>'); }} className={`${TOOL_BTN} text-[13px] font-bold`} title="제목" aria-label="제목">H</button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execDetailFormat('formatBlock', '<p>'); }} className={`${TOOL_BTN} text-[13px]`} title="본문" aria-label="본문">P</button>
              </div>
              <div className="flex items-center gap-0.5">
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execDetailFormat('justifyLeft'); }} className={TOOL_BTN} title="왼쪽" aria-label="왼쪽 정렬">
                  <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor"><rect x="0" y="0" width="16" height="2" rx="1"/><rect x="0" y="6" width="10" height="2" rx="1"/><rect x="0" y="12" width="13" height="2" rx="1"/></svg>
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execDetailFormat('justifyCenter'); }} className={TOOL_BTN} title="중앙" aria-label="가운데 정렬">
                  <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor"><rect x="0" y="0" width="16" height="2" rx="1"/><rect x="3" y="6" width="10" height="2" rx="1"/><rect x="1.5" y="12" width="13" height="2" rx="1"/></svg>
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execDetailFormat('justifyRight'); }} className={TOOL_BTN} title="오른쪽" aria-label="오른쪽 정렬">
                  <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor"><rect x="0" y="0" width="16" height="2" rx="1"/><rect x="6" y="6" width="10" height="2" rx="1"/><rect x="3" y="12" width="13" height="2" rx="1"/></svg>
                </button>
              </div>
              <div className="flex items-center gap-0.5">
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execDetailFormat('insertUnorderedList'); }} className={TOOL_BTN} title="글머리기호" aria-label="글머리기호">
                  <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor"><circle cx="1.5" cy="2" r="1.5"/><rect x="5" y="1" width="11" height="2" rx="1"/><circle cx="1.5" cy="7" r="1.5"/><rect x="5" y="6" width="11" height="2" rx="1"/><circle cx="1.5" cy="12" r="1.5"/><rect x="5" y="11" width="11" height="2" rx="1"/></svg>
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execDetailFormat('insertOrderedList'); }} className={`${TOOL_BTN} text-[13px] font-bold`} title="번호목록" aria-label="번호목록">1.</button>
              </div>
              <div className="flex items-center gap-0.5">
                <button type="button" onMouseDown={(e) => { e.preventDefault(); detailColorInputRef.current?.click(); }} className={TOOL_BTN} title="글자색" aria-label="글자색">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text x="8" y="11" textAnchor="middle" fill="#333D4B" fontSize="10" fontWeight="bold">A</text><rect x="4" y="13" width="8" height="2" fill="#3182F6"/></svg>
                </button>
                <input ref={detailColorInputRef} type="color" className="hidden" onChange={(e) => execDetailFormat('foreColor', e.target.value)} />
                <button type="button" onMouseDown={(e) => { e.preventDefault(); detailImageInputRef.current?.click(); }} className={TOOL_BTN} title="사진 삽입" aria-label="사진 삽입">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                </button>
                <input ref={detailImageInputRef} type="file" accept="image/*" className="hidden" onChange={onDetailImageSelected} />
                <button type="button" onMouseDown={(e) => { e.preventDefault(); const url = window.prompt('링크 URL'); if (url) execDetailFormat('createLink', url); }} className={TOOL_BTN} title="링크" aria-label="링크">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                </button>
              </div>
            </div>

            {/* Editable content */}
            <div
              ref={setDetailEditorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => { detailDirtyRef.current = true; setDetailHtml(e.currentTarget.innerHTML); }}
              className="min-h-[220px] px-[18px] py-4 text-[16px] leading-[1.7] text-[#191F28] outline-none [&_a]:text-[#3182F6] [&_a]:underline [&_h3]:mt-3 [&_h3]:text-[18px] [&_h3]:font-bold [&_img]:my-2 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-[12px] [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 empty:before:text-[#B0B8C1] empty:before:content-['상세_소개를_자유롭게_작성해_주세요']"
            />
          </div>
        </EditSection>

        {/* ─── 회원 탈퇴 (프로 계정도 탈퇴 가능하도록) ─── */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowWithdraw(true)}
            className="text-[13px] font-medium text-[#E5484D]/70 transition-colors hover:text-[#E5484D]"
          >
            회원 탈퇴
          </button>
        </div>
      </QdBody>

      {/* ─── 저장 — 아래 고정, 위에 흰 페이드(내용이 밑으로 스며든다) ─── */}
      <div className="sticky bottom-0 z-10 bg-white px-5 pt-2.5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-white to-white/0" />
        <RgCta onClick={handleSave} disabled={saving}>
          {saving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
          {saving ? '저장 중...' : '저장하기'}
        </RgCta>
      </div>

      {/* ─── Toast — 앱 공통 토스트(AppToaster)와 같은 유리 알약, 톡 내려오고 위로 사라진다 ─── */}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[70px] z-[800] flex justify-center px-4">
        <AnimatePresence>
          {toast && (
            <motion.p
              key="toast"
              className="max-w-full rounded-[20px] border-[0.6px] border-[rgba(229,233,240,0.9)] bg-white/[0.92] px-[18px] py-[13px] text-center text-[14px] font-bold leading-[1.35] text-[#2B313D] shadow-[0_18px_42px_rgba(15,23,42,0.14)] backdrop-blur-[18px] [overflow-wrap:anywhere]"
              initial={{ opacity: 0, y: -28, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.94, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 480, damping: 28 }}
            >
              {toast}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* 회원탈퇴 확인 시트 — confirm() 대신(네이티브 WKWebView 빌드 무관하게 동작) */}
      <Sheet open={showWithdraw} onClose={() => setShowWithdraw(false)}>
        <p className="ft-title">정말 탈퇴하시겠어요?</p>
        <p className="ft-desc">탈퇴 시 모든 데이터가 삭제되며<br />복구할 수 없습니다.</p>
        <div className="ft-actions">
          <button type="button" onClick={() => setShowWithdraw(false)} className="ft-btn secondary">아니오</button>
          <button
            type="button"
            onClick={() => {
              setShowWithdraw(false);
              usersApi.deleteAccount()
                .then(() => { useAuthStore.getState().logout(); try { localStorage.clear(); } catch {} router.push('/'); })
                .catch(() => { useAuthStore.getState().logout(); try { localStorage.clear(); } catch {} router.push('/'); });
            }}
            className="ft-btn danger"
          >탈퇴하기</button>
        </div>
      </Sheet>

      {/* ─── 사회자분류 시트 — 고르면 체크가 톡 튄 뒤 내려간다(퀵매칭 단일 선택처럼) ─── */}
      <Sheet open={showCategorySheet} onClose={() => setShowCategorySheet(false)}>
        <h2 className="ft-title">사회자분류를 선택해주세요</h2>
        <p className="ft-desc">선택한 사회자분류로 활동이 가능합니다</p>
        <div className="rg-list mt-6" role="radiogroup" aria-label="사회자분류">
          {['사회자', '쇼호스트', '축가/연주'].map((item) => (
            <RgOption
              key={item}
              role="radio"
              on={category === item}
              label={item}
              onClick={() => { setCategory(item); setTimeout(() => setShowCategorySheet(false), 180); }}
            />
          ))}
        </div>
      </Sheet>

      {/* ─── 경력 시트 — 30개 목록: 높이 60vh 유지, 제목은 두고 목록만 스크롤 ─── */}
      <Sheet open={showCareerSheet} onClose={() => setShowCareerSheet(false)} className="flex flex-col" style={{ maxHeight: '60vh' }}>
        <h2 className="ft-title">경력을 선택해주세요</h2>
        <div className="rg-list mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain" role="radiogroup" aria-label="경력">
          {CAREER_YEARS.map((y) => (
            <RgOption
              key={y}
              role="radio"
              on={careerYears === y}
              label={`${y}년`}
              onClick={() => { setCareerYears(y); setTimeout(() => setShowCareerSheet(false), 180); }}
            />
          ))}
        </div>
      </Sheet>

      {/* ─── YouTube 검색 — 오른쪽에서 밀려 들어오는 전체 화면(닫으면 다시 오른쪽으로) ─── */}
      <AnimatePresence>
        {showYoutubeSearch && (
          <motion.div
            key="yt-search"
            className="fixed inset-0 z-50 flex flex-col bg-white"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%', transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } }}
            transition={SHEET_SPRING}
          >
            <header className="flex h-14 flex-none items-center px-2">
              <button type="button" onClick={closeYoutubeSearch} aria-label="뒤로가기" className="qd-back">
                <QdBackIcon />
              </button>
            </header>
            <div className="flex-none px-6 pb-4">
              <h2 className="text-[24px] font-semibold leading-[1.4] tracking-[-0.4px] text-[#191F28]">YouTube 영상 검색</h2>
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={ytChannelQuery}
                  onChange={(e) => setYtChannelQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchYtChannels()}
                  placeholder="채널명을 검색하세요"
                  className="qd-input min-w-0 flex-1"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={searchYtChannels}
                  className="h-[60px] flex-none rounded-[16px] bg-[#3182F6] px-5 text-[17px] font-semibold text-white transition-[transform,background-color] active:scale-[0.97] active:bg-[#2272EB]"
                >
                  검색
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
              {ytLoading && (
                <div className="flex items-center justify-center py-14">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#3182F6] border-t-transparent" />
                </div>
              )}

              {/* 결과 줄은 새로 뜰 때만 오른쪽→왼쪽으로 차례 등장 */}
              {!ytSelectedChannel && ytChannels.length > 0 && !ytLoading && (
                <div>
                  <p className="mb-3 px-1 text-[15px] font-semibold text-[#4E5968]">채널 선택</p>
                  <div className="space-y-2.5">
                    {ytChannels.map((ch, i) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => loadYtVideos(ch.id)}
                        className="qd-card qd-a-item flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors active:bg-[#F8F9FA]"
                        style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}
                      >
                        <img src={ch.thumbnail} alt="" className="h-11 w-11 flex-none rounded-full bg-[#F2F4F6] object-cover" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[16px] font-semibold text-[#191F28]">{ch.title}</span>
                          <span className="mt-0.5 block truncate text-[13px] text-[#8B95A1]">{ch.description}</span>
                        </span>
                        <ChevronRightIcon size={18} className="flex-none text-[#B0B8C1]" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {ytSelectedChannel && ytVideos.length > 0 && !ytLoading && (
                <div>
                  <div className="mb-3 flex items-center justify-between px-1">
                    <p className="text-[15px] font-semibold text-[#4E5968]">영상 선택</p>
                    <button type="button" onClick={() => { setYtSelectedChannel(null); setYtVideos([]); }} className="text-[14px] font-semibold text-[#3182F6]">
                      채널 다시 선택
                    </button>
                  </div>
                  <div className="space-y-3">
                    {ytVideos.map((v, i) => {
                      const url = `https://www.youtube.com/watch?v=${v.id}`;
                      const already = videos.includes(url);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => { if (!already) addVideoUrl(url); }}
                          className={`qd-a-item block w-full overflow-hidden rounded-[16px] border-[1.5px] text-left transition-colors ${already ? 'border-[#3182F6] bg-[#EDF4FF]' : 'border-[#E5E8EB] bg-white active:bg-[#F8F9FA]'}`}
                          style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}
                        >
                          <div className="relative w-full bg-[#F2F4F6]" style={{ paddingBottom: '56.25%' }}>
                            <img src={v.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" />
                            {already && (
                              <motion.span
                                className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#3182F6] text-white shadow-[0_2px_8px_rgba(49,130,246,0.4)]"
                                initial={{ scale: 0.4, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={POP_SPRING}
                              >
                                <CheckIcon size={16} />
                              </motion.span>
                            )}
                          </div>
                          <p className={`line-clamp-2 px-4 py-3 text-[15px] font-semibold leading-[1.45] ${already ? 'text-[#3182F6]' : 'text-[#191F28]'}`}>{v.title}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!ytLoading && !ytChannelQuery && ytChannels.length === 0 && (
                <div className="flex flex-col items-center py-16 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#F2F4F6]">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="4" fill="#DCEBFF"/><path d="M10 8.5v7l6-3.5-6-3.5z" fill="#3182F6"/></svg>
                  </span>
                  <p className="mt-4 text-[15px] text-[#8B95A1]">채널명을 검색해주세요</p>
                </div>
              )}
              {!ytLoading && ytChannels.length === 0 && !ytSelectedChannel && ytChannelQuery && (
                <p className="py-14 text-center text-[15px] text-[#8B95A1]">검색 결과가 없어요</p>
              )}
            </div>

            {videos.length > 0 && (
              <div className="relative flex-none bg-white px-5 pt-2.5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
                <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-white to-white/0" />
                <RgCta onClick={closeYoutubeSearch}>완료 ({videos.length}개 영상)</RgCta>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}
