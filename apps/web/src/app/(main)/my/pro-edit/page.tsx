'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronDown, ChevronUp, Plus, X, Check, Star } from 'lucide-react';
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

/* ─── Section wrapper ─── */
function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="border-b border-gray-100"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 active:bg-gray-50 transition-colors"
      >
        <span className="text-[15px] font-bold text-gray-900">{title}</span>
        {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
      <>
        {open && (
          <div
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">
              {children}
            </div>
          </div>
        )}
      </>
    </div>
  );
}

/* ─── Tag chip ─── */
function TagChip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="px-3.5 py-2 rounded-full text-[13px] font-medium transition-colors"
      style={{
        backgroundColor: selected ? '#3180F7' : '#FFFFFF',
        color: selected ? '#FFFFFF' : '#4B5563',
        border: selected ? '1px solid #3180F7' : '1px solid #D1D5DB',
      }}
    >
      {label}
    </button>
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
  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };
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
      // 전문영역 태그만 tags 필드에 저장 (중복 제거)
      const mergedTags = Array.from(new Set(selectedCategories.filter(Boolean)));
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
        tags: mergedTags,
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
        tags: mergedTags,
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
    <div className="bg-white min-h-screen max-w-lg mx-auto lg:max-w-2xl" style={{ letterSpacing: '-0.02em' }}>
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />

      {/* ─── Header ─── */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-gray-100/60" data-native-back-header>
        <div className="flex items-center gap-3 px-4 h-[52px]">
          <button onClick={() => router.back()} className="p-1">
            <ChevronLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="text-[17px] font-bold text-gray-900">프로필 수정</h1>
        </div>
      </div>

      {/* ─── Toast ─── */}
      <>
        {toast && (
          <div
            className="fixed top-[70px] left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg z-50"
          >
            <p className="text-[14px] font-bold flex items-center gap-2">
              <Check size={16} className="text-green-400" /> {toast}
            </p>
          </div>
        )}
      </>

      {/* ─── 1. 기본 정보 ─── */}
      <Section title="기본 정보" defaultOpen={true}>
        <div className="space-y-4">
          {/* 이름 (read-only) */}
          <div>
            <label className="block text-[12px] font-bold text-gray-400 mb-1.5">이름</label>
            <div className="w-full h-11 bg-gray-50 rounded-xl px-4 flex items-center text-[15px] text-gray-500">
              {name || '-'}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">이름은 변경할 수 없습니다</p>
          </div>

          {/* 전화번호 */}
          <div>
            <label className="block text-[12px] font-bold text-gray-400 mb-1.5">전화번호</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
              placeholder="010-0000-0000"
              className="w-full h-11 border border-gray-200 rounded-xl px-4 text-[16px] text-gray-900 outline-none focus:border-[#3180F7] focus:ring-1 focus:ring-[#3180F7]/20 transition-all"
            />
          </div>

          {/* 성별 (editable) */}
          <div>
            <label className="block text-[12px] font-bold text-gray-400 mb-1.5">성별</label>
            <div className="flex gap-2">
              {['남성', '여성'].map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(gender === g ? '' : g)}
                  className="flex-1 h-11 rounded-xl text-[14px] font-bold border-2 transition-colors"
                  style={{
                    backgroundColor: gender === g ? '#EFF6FF' : '#FFFFFF',
                    borderColor: gender === g ? '#3180F7' : '#E5E7EB',
                    color: gender === g ? '#3180F7' : '#9CA3AF',
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* 사회자분류 */}
          <div>
            <label className="block text-[12px] font-bold text-gray-400 mb-1.5">사회자분류</label>
            <button
              onClick={() => setShowCategorySheet(true)}
              className="w-full h-11 border border-gray-200 rounded-xl px-4 flex items-center justify-between text-[15px] text-gray-900 active:bg-gray-50 transition-colors"
            >
              <span className={category ? 'text-gray-900' : 'text-gray-400'}>{category || '선택해주세요'}</span>
              <ChevronDown size={18} className="text-gray-400" />
            </button>
          </div>
        </div>
      </Section>

      <Section title="프로필 공개 설정" defaultOpen={true}>
        <button
          type="button"
          onClick={handleToggleProfileVisibility}
          disabled={visibilitySaving}
          className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-4 text-left transition-colors active:bg-gray-50 disabled:cursor-wait disabled:opacity-70"
        >
          <div className="pr-4">
            <p className="text-[15px] font-bold text-gray-900">프로필 숨김</p>
            <p className="mt-1 text-[12px] leading-5 text-gray-500">
              켜두면 홈, 리스트, 검색에서 내 프로필이 보이지 않습니다.
            </p>
          </div>
          <div
            className={`relative h-7 w-12 rounded-full transition-colors ${isProfileHidden ? 'bg-[#111827]' : 'bg-gray-200'}`}
            aria-hidden="true"
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${isProfileHidden ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </div>
        </button>
      </Section>

      {/* ─── 2. 한줄 소개 ─── */}
      <Section title="한줄 소개" defaultOpen={true}>
        <div>
          <input
            type="text"
            value={intro}
            onChange={(e) => { if (e.target.value.length <= 50) setIntro(e.target.value); }}
            maxLength={50}
            placeholder="한줄로 자신을 소개해주세요"
            className="w-full h-11 border border-gray-200 rounded-xl px-4 text-[16px] text-gray-900 outline-none focus:border-[#3180F7] focus:ring-1 focus:ring-[#3180F7]/20 transition-all"
          />
          <p className="text-right text-[11px] text-gray-400 mt-1">{intro.length}/50</p>
        </div>
      </Section>

      {/* ─── 3. 경력 ─── */}
      <Section title="경력">
        <div>
          <button
            onClick={() => setShowCareerSheet(true)}
            className="w-full h-11 border border-gray-200 rounded-xl px-4 flex items-center justify-between text-[15px] active:bg-gray-50 transition-colors"
          >
            <span className="text-gray-900">{careerYears}년</span>
            <ChevronDown size={18} className="text-gray-400" />
          </button>
          {/* Horizontal pill preview */}
          <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1 scrollbar-hide">
            {[1, 3, 5, 7, 10, 15, 20, 25, 30].map(y => (
              <button
                key={y}
                onClick={() => setCareerYears(y)}
                className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors"
                style={{
                  backgroundColor: careerYears === y ? '#3180F7' : '#F3F4F6',
                  color: careerYears === y ? '#FFFFFF' : '#6B7280',
                }}
              >
                {y}년
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── 4. 전문영역 ─── */}
      <Section title="전문영역">
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">웨딩 / 가족행사</p>
            <div className="flex flex-wrap gap-2">
              {WEDDING_TAGS.map(cat => (
                <TagChip key={cat} label={cat} selected={selectedCategories.includes(cat)} onToggle={() => toggleCategory(cat)} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">기업 / 공식행사</p>
            <div className="flex flex-wrap gap-2">
              {EVENT_TAGS.map(cat => (
                <TagChip key={cat} label={cat} selected={selectedCategories.includes(cat)} onToggle={() => toggleCategory(cat)} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">기타</p>
            <div className="flex flex-wrap gap-2">
              {OTHER_TAGS.map(cat => (
                <TagChip key={cat} label={cat} selected={selectedCategories.includes(cat)} onToggle={() => toggleCategory(cat)} />
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ─── 5. 행사 가능 지역 ─── */}
      <Section title="행사 가능 지역">
        <div className="space-y-2">
          {REGIONS.map(region => {
            const selected = selectedRegions.includes(region);
            return (
              <button
                key={region}
                onClick={() => toggleRegion(region)}
                className="w-full py-3 rounded-xl text-[14px] font-bold border-2 flex items-center justify-center gap-2 transition-colors"
                style={{
                  backgroundColor: selected ? '#EFF6FF' : '#FFFFFF',
                  borderColor: selected ? '#3180F7' : '#E5E7EB',
                  color: selected ? '#3180F7' : '#9CA3AF',
                }}
              >
                <>
                  {selected && (
                    <span>
                      <Check size={16} className="text-[#3180F7] stroke-[3]" />
                    </span>
                  )}
                </>
                {region}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ─── 6. 프로필 사진 ─── */}
      <Section title="프로필 사진">
        <div className="grid grid-cols-3 gap-2.5">
          {/* Add button */}
          <button
            onClick={handleAddPhoto}
            className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 hover:border-[#3180F7] hover:bg-blue-50/30 transition-colors"
          >
            <Plus size={22} className="text-gray-400" />
            <span className="text-[11px] text-gray-400 font-medium">여러 장 추가</span>
            <span className="text-[10px] text-gray-300">{photos.length}/10</span>
          </button>

          {/* Photos */}
          {photos.map((photo, index) => (
            <div key={photo.id || `${photo.url}-${index}`} className="aspect-square relative rounded-xl overflow-hidden group">
              {/* Main badge */}
              {mainPhotoIndex === index && (
                <div className="absolute top-1.5 left-1.5 bg-[#3180F7] text-white text-[10px] px-2 py-0.5 rounded-full z-10 font-bold flex items-center gap-0.5">
                  <Star size={8} className="fill-white" /> 대표
                </div>
              )}
              <img src={photo.url} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-center pb-1.5 gap-1.5 opacity-0 group-hover:opacity-100">
                <button
                  onClick={() => handleSetMain(index)}
                  className="px-2 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-bold text-gray-700"
                >
                  대표설정
                </button>
              </div>
              {/* Delete */}
              <button
                onClick={() => handleRemovePhoto(index)}
                className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center z-10"
              >
                <X size={12} className="text-white stroke-[2.5]" />
              </button>
            </div>
          ))}
        </div>
        {photos.length > 0 && (
          <p className="text-[11px] text-gray-400 mt-2">사진은 한 번에 여러 장 선택할 수 있고, 사진 위에 마우스를 올려 대표 사진을 설정하세요</p>
        )}
      </Section>

      {/* ─── 8. 언어 ─── */}
      <Section title="언어">
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map(lang => (
            <TagChip key={lang} label={lang} selected={languages.includes(lang)} onToggle={() => toggleLanguage(lang)} />
          ))}
        </div>
      </Section>

      {/* ─── 10. 소개영상 ─── */}
      <Section title="소개영상">
        <div className="space-y-3">
          {videos.map((url, i) => {
            const isUploadedVideo = url.includes('/uploads/');
            const embedSrc = url.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/');
            return (
              <div key={i} className="relative">
                {isUploadedVideo ? (
                  <video
                    src={`${url}#t=0.1`}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full rounded-xl bg-black object-contain"
                    style={{ maxHeight: '70vh' }}
                  />
                ) : (
                  <div className="rounded-xl overflow-hidden bg-gray-100 aspect-video">
                    <iframe src={embedSrc} className="w-full h-full" allowFullScreen title={`영상 ${i + 1}`} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeVideo(url)}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white active:scale-90"
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
          {/* 영상 추가 버튼 */}
          <button
            type="button"
            onClick={() => setShowYoutubeSearch(true)}
            className="w-full h-12 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center gap-2 text-[14px] font-medium text-gray-500 hover:border-[#3180F7] hover:text-[#3180F7] active:scale-[0.98] transition-all"
          >
            <Plus size={16} /> 영상 추가 (YouTube 검색)
          </button>
          {/* 동영상 파일 직접 업로드 */}
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
            className="w-full h-12 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center gap-2 text-[14px] font-medium text-gray-500 hover:border-[#3180F7] hover:text-[#3180F7] active:scale-[0.98] transition-all disabled:opacity-60 disabled:active:scale-100"
          >
            {videoUploading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-[#3180F7] border-t-transparent animate-spin" />
                업로드 중... {videoUploadPct}%
              </>
            ) : (
              <>
                <Plus size={16} /> 동영상 파일 업로드 (100MB 이하)
              </>
            )}
          </button>
          {videoUploading && (
            <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full bg-[#3180F7] rounded-full transition-all" style={{ width: `${videoUploadPct}%` }} />
            </div>
          )}
          {/* URL 직접 입력 */}
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="또는 YouTube 링크 직접 입력"
              className="flex-1 h-11 border border-gray-200 rounded-xl px-4 text-[14px] text-gray-900 outline-none focus:border-[#3180F7] focus:ring-1 focus:ring-[#3180F7]/20 transition-all"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value;
                  if (val.trim()) { addVideoUrl(val.trim()); (e.target as HTMLInputElement).value = ''; }
                }
              }}
            />
          </div>
        </div>
      </Section>

      {/* YouTube 검색 모달 */}
      {showYoutubeSearch && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col" style={{ animation: 'slideInRight 0.3s ease' }}>
          <div className="shrink-0 px-4 pt-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => { setShowYoutubeSearch(false); setYtChannels([]); setYtVideos([]); setYtSelectedChannel(null); setYtChannelQuery(''); }}>
                <ChevronLeft size={24} className="text-gray-900" />
              </button>
              <h2 className="text-[18px] font-bold text-gray-900">YouTube 영상 검색</h2>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={ytChannelQuery}
                onChange={(e) => setYtChannelQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchYtChannels()}
                placeholder="채널명을 검색하세요"
                className="flex-1 h-11 bg-gray-50 border border-gray-200 rounded-xl px-4 outline-none text-[16px] text-gray-900 placeholder:text-gray-400 focus:border-[#3180F7]"
                autoFocus
              />
              <button onClick={searchYtChannels} className="h-11 px-4 bg-[#3180F7] text-white rounded-xl text-[14px] font-bold shrink-0 active:scale-95">
                검색
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {ytLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#3180F7] border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!ytSelectedChannel && ytChannels.length > 0 && !ytLoading && (
              <div className="p-4">
                <p className="text-[12px] text-gray-400 font-bold uppercase mb-3">채널 선택</p>
                <div className="space-y-2">
                  {ytChannels.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => loadYtVideos(ch.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 text-left active:scale-[0.98] transition-all"
                    >
                      <img src={ch.thumbnail} alt="" className="w-10 h-10 rounded-full object-cover bg-gray-200" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-gray-900 truncate">{ch.title}</p>
                        <p className="text-[12px] text-gray-400 truncate">{ch.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {ytSelectedChannel && ytVideos.length > 0 && !ytLoading && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[12px] text-gray-400 font-bold uppercase">영상 선택</p>
                  <button onClick={() => { setYtSelectedChannel(null); setYtVideos([]); }} className="text-[12px] text-[#3180F7] font-semibold">
                    채널 다시 선택
                  </button>
                </div>
                <div className="space-y-3">
                  {ytVideos.map((v) => {
                    const url = `https://www.youtube.com/watch?v=${v.id}`;
                    const already = videos.includes(url);
                    return (
                      <button
                        key={v.id}
                        onClick={() => { if (!already) addVideoUrl(url); }}
                        className={`w-full rounded-xl overflow-hidden border text-left transition-all ${already ? 'border-[#3180F7] bg-blue-50/30' : 'border-gray-100'}`}
                      >
                        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                          <img src={v.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover" />
                          {already && (
                            <div className="absolute top-2 right-2 w-7 h-7 bg-[#3180F7] rounded-full flex items-center justify-center shadow-md">
                              <Check size={16} className="text-white stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-[14px] font-semibold text-gray-900 line-clamp-2">{v.title}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!ytLoading && !ytChannelQuery && ytChannels.length === 0 && (
              <div className="flex flex-col items-center py-16">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="4" fill="#DBEAFE"/><path d="M10 8.5v7l6-3.5-6-3.5z" fill="#3180F7"/></svg>
                <p className="text-[14px] text-gray-500 mt-4">채널명을 검색해주세요</p>
              </div>
            )}
            {!ytLoading && ytChannels.length === 0 && !ytSelectedChannel && ytChannelQuery && (
              <p className="text-center text-gray-400 text-[14px] py-12">검색 결과가 없습니다</p>
            )}
          </div>

          {videos.length > 0 && (
            <div className="shrink-0 p-4 pb-8 bg-white border-t border-gray-100">
              <button
                onClick={() => { setShowYoutubeSearch(false); setYtChannels([]); setYtVideos([]); setYtSelectedChannel(null); setYtChannelQuery(''); }}
                className="w-full py-4 bg-[#3180F7] text-white rounded-2xl font-bold text-[16px] active:scale-[0.98]"
              >
                완료 ({videos.length}개 영상)
              </button>
            </div>
          )}

          <style dangerouslySetInnerHTML={{ __html: `@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }` }} />
        </div>
      )}

      {/* ─── 10-1. 상세설명 (네이버 스마트에디터 스타일 + AI 자동 생성) ─── */}
      <Section title="상세설명" defaultOpen={false}>
        <div className="space-y-3">
          <p className="text-[12px] text-gray-400">프로필 상세페이지에 노출될 자기소개 영역입니다.</p>

          {/* Toolbar — 네이버 스마트에디터 스타일 */}
          <div className="bg-[#F9F9F9] rounded-xl px-3 py-2 flex items-center gap-0.5 flex-wrap">
            <button type="button" onMouseDown={(e) => { e.preventDefault(); execDetailFormat('bold'); }} className="w-8 h-8 flex items-center justify-center font-bold text-gray-800 text-sm rounded hover:bg-gray-200" title="굵게">B</button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); execDetailFormat('italic'); }} className="w-8 h-8 flex items-center justify-center italic text-gray-800 text-sm rounded hover:bg-gray-200" title="기울임">I</button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); execDetailFormat('underline'); }} className="w-8 h-8 flex items-center justify-center underline text-gray-800 text-sm rounded hover:bg-gray-200" title="밑줄">U</button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); execDetailFormat('strikeThrough'); }} className="w-8 h-8 flex items-center justify-center line-through text-gray-800 text-sm rounded hover:bg-gray-200" title="취소선">S</button>
            <div className="w-px h-5 bg-gray-300 mx-1" />
            <button type="button" onMouseDown={(e) => { e.preventDefault(); execDetailFormat('formatBlock', '<h3>'); }} className="px-2 h-8 flex items-center justify-center text-xs font-bold text-gray-700 rounded hover:bg-gray-200" title="제목">H</button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); execDetailFormat('formatBlock', '<p>'); }} className="px-2 h-8 flex items-center justify-center text-xs text-gray-700 rounded hover:bg-gray-200" title="본문">P</button>
            <div className="w-px h-5 bg-gray-300 mx-1" />
            <button type="button" onMouseDown={(e) => { e.preventDefault(); execDetailFormat('justifyLeft'); }} className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200" title="왼쪽">
              <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor"><rect x="0" y="0" width="16" height="2" rx="1"/><rect x="0" y="6" width="10" height="2" rx="1"/><rect x="0" y="12" width="13" height="2" rx="1"/></svg>
            </button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); execDetailFormat('justifyCenter'); }} className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200" title="중앙">
              <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor"><rect x="0" y="0" width="16" height="2" rx="1"/><rect x="3" y="6" width="10" height="2" rx="1"/><rect x="1.5" y="12" width="13" height="2" rx="1"/></svg>
            </button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); execDetailFormat('justifyRight'); }} className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200" title="오른쪽">
              <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor"><rect x="0" y="0" width="16" height="2" rx="1"/><rect x="6" y="6" width="10" height="2" rx="1"/><rect x="3" y="12" width="13" height="2" rx="1"/></svg>
            </button>
            <div className="w-px h-5 bg-gray-300 mx-1" />
            <button type="button" onMouseDown={(e) => { e.preventDefault(); execDetailFormat('insertUnorderedList'); }} className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200" title="글머리기호">
              <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor"><circle cx="1.5" cy="2" r="1.5"/><rect x="5" y="1" width="11" height="2" rx="1"/><circle cx="1.5" cy="7" r="1.5"/><rect x="5" y="6" width="11" height="2" rx="1"/><circle cx="1.5" cy="12" r="1.5"/><rect x="5" y="11" width="11" height="2" rx="1"/></svg>
            </button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); execDetailFormat('insertOrderedList'); }} className="w-8 h-8 flex items-center justify-center text-gray-800 text-xs font-bold rounded hover:bg-gray-200" title="번호목록">1.</button>
            <div className="w-px h-5 bg-gray-300 mx-1" />
            <button type="button" onMouseDown={(e) => { e.preventDefault(); detailColorInputRef.current?.click(); }} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200" title="글자색">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text x="8" y="11" textAnchor="middle" fill="#1F2937" fontSize="10" fontWeight="bold">A</text><rect x="4" y="13" width="8" height="2" fill="#3180F7"/></svg>
            </button>
            <input ref={detailColorInputRef} type="color" className="hidden" onChange={(e) => execDetailFormat('foreColor', e.target.value)} />
            <button type="button" onMouseDown={(e) => { e.preventDefault(); detailImageInputRef.current?.click(); }} className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200" title="사진 삽입">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            </button>
            <input ref={detailImageInputRef} type="file" accept="image/*" className="hidden" onChange={onDetailImageSelected} />
            <button type="button" onMouseDown={(e) => { e.preventDefault(); const url = window.prompt('링크 URL'); if (url) execDetailFormat('createLink', url); }} className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200" title="링크">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
            </button>
          </div>

          {/* Editable content */}
          <div
            ref={setDetailEditorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => { detailDirtyRef.current = true; setDetailHtml(e.currentTarget.innerHTML); }}
            className="min-h-[180px] p-4 border border-gray-200 rounded-xl text-[15px] text-gray-900 leading-relaxed outline-none focus:border-[#3180F7] [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-2 [&_h3]:text-[16px] [&_h3]:font-bold [&_h3]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-[#3180F7] [&_a]:underline empty:before:content-['상세_소개를_직접_작성하거나_AI_자동_생성을_눌러주세요'] empty:before:text-gray-300"
          />
        </div>
      </Section>

      {/* ─── Save Button ─── */}
      <div className="p-5 pb-10">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-[52px] bg-[#3180F7] hover:bg-[#2668d8] text-white font-bold rounded-2xl text-[15px] transition-colors active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2"
        >
          {saving && <span className="w-4 h-4 rounded-full border-2 border-white/80 border-t-transparent animate-spin" />}
          {saving ? '저장 중...' : '저장하기'}
        </button>
      </div>

      {/* ─── 회원 탈퇴 (프로 계정도 탈퇴 가능하도록) ─── */}
      <div className="px-4 pb-10 text-center">
        <button type="button" onClick={() => setShowWithdraw(true)} className="text-[13px] text-red-400 font-medium">
          회원 탈퇴
        </button>
      </div>

      {/* 회원탈퇴 확인 모달 — confirm() 대신(네이티브 WKWebView 빌드 무관하게 동작) */}
      {showWithdraw && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-6" onClick={() => setShowWithdraw(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-[16px] font-bold text-gray-900 text-center mb-2">정말 탈퇴하시겠어요?</p>
            <p className="text-[13px] text-gray-500 text-center mb-5 leading-relaxed">탈퇴 시 모든 데이터가 삭제되며<br />복구할 수 없습니다.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowWithdraw(false)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold text-[14px] active:scale-95 transition-transform">아니오</button>
              <button
                onClick={() => {
                  setShowWithdraw(false);
                  usersApi.deleteAccount()
                    .then(() => { useAuthStore.getState().logout(); try { localStorage.clear(); } catch {} router.push('/'); })
                    .catch(() => { useAuthStore.getState().logout(); try { localStorage.clear(); } catch {} router.push('/'); });
                }}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold text-[14px] active:scale-95 transition-transform"
              >탈퇴하기</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 사회자분류 바텀시트 ─── */}
      <>
        {showCategorySheet && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-end"
            onClick={() => setShowCategorySheet(false)}
          >
            <div
              className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
              <h2 className="text-xl font-bold mb-2">사회자분류를 선택해주세요</h2>
              <p className="text-[13px] text-gray-500 mb-6">선택한 사회자분류로 활동이 가능합니다</p>
              {['사회자', '쇼호스트', '축가/연주'].map(item => (
                <button
                  key={item}
                  onClick={() => { setCategory(item); setShowCategorySheet(false); }}
                  className={`w-full py-4 rounded-2xl mb-3 text-[18px] font-bold transition-all ${
                    category === item
                      ? 'bg-blue-50 border-2 border-[#3180F7] text-[#3180F7]'
                      : 'bg-white border-2 border-gray-200 text-gray-400'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}
      </>

      {/* ─── 경력 바텀시트 ─── */}
      <>
        {showCareerSheet && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-end"
            onClick={() => setShowCareerSheet(false)}
          >
            <div
              className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 max-h-[60vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
              <h2 className="text-xl font-bold mb-4">경력을 선택해주세요</h2>
              <div className="flex-1 overflow-y-auto space-y-2 pb-4">
                {CAREER_YEARS.map(y => (
                  <button
                    key={y}
                    onClick={() => { setCareerYears(y); setShowCareerSheet(false); }}
                    className={`w-full py-3 rounded-xl text-[16px] font-bold transition-all ${
                      careerYears === y
                        ? 'bg-blue-50 border-2 border-[#3180F7] text-[#3180F7]'
                        : 'bg-white border-2 border-gray-100 text-gray-500'
                    }`}
                  >
                    {y}년
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </>
    </div>
  );
}
