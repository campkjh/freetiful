'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Phone, Share2, Play, ChevronDown, ChevronRight, ArrowUpRight, X, Check, Copy, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/auth.store';
import { discoveryApi, getCachedProDetail, getCachedProPreview, type ProListItem } from '@/lib/api/discovery.api';
import type { PlanTemplate } from '@/lib/api/plan-templates.api';
import { reviewApi } from '@/lib/api/review.api';
import { buildReviewFallbacks, getReviewComment, getReviewRows, getReviewTotal } from '@/lib/review-display';
import {
  WEDDING_PLAN_TEMPLATES,
  buildWeddingServicesFromStorage,
  getWeddingPlanDisplayPrice,
  getWeddingPlanTemplate,
  normalizeWeddingPlanKey,
} from '@/lib/wedding-plans';
import { matchApi } from '@/lib/api/match.api';
import { rememberAuthReturnTo, startOAuth } from '@/lib/auth/oauth';
import { requestNativeLoginSheet } from '@/lib/auth/native-login';
import GuestLoginForm from '@/components/GuestLoginForm';

// ─── Brand Color ────────────────────────────────────────────
const BRAND = '#3180F7';

const proSearchHref = (category?: string, q?: string) => {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (q) params.set('q', q);
  const query = params.toString();
  return query ? `/pros?${query}` : '/pros';
};

const PC_DETAIL_CATEGORY_MENUS = [
  {
    label: '업종별',
    href: '/pros',
    highlight: true,
    items: [
      { label: '전체 사회자', href: '/pros' },
      { label: '결혼식 사회자', href: proSearchHref('사회자', '결혼식') },
      { label: '행사 MC', href: proSearchHref('사회자', '행사') },
      { label: '외국어 사회자', href: proSearchHref('외국어사회자') },
      { label: '쇼호스트', href: proSearchHref('쇼호스트') },
      { label: '축가·연주', href: proSearchHref('축가·연주') },
    ],
  },
  {
    label: '전체',
    href: '/pros',
    items: [
      { label: '전체 사회자 보기', href: '/pros' },
      { label: '인기 사회자 보기', href: proSearchHref('사회자') },
      { label: '외국어 진행 가능', href: proSearchHref('외국어사회자') },
    ],
  },
  {
    label: '전문 결혼식 사회자',
    href: proSearchHref('사회자', '결혼식'),
    items: [
      { label: '결혼식 사회자', href: proSearchHref('사회자', '결혼식') },
      { label: '돌잔치 진행', href: proSearchHref('사회자', '돌잔치') },
      { label: '외국어 예식 진행', href: proSearchHref('외국어사회자', '결혼식') },
    ],
  },
  {
    label: '전문 행사 사회자',
    href: proSearchHref('사회자', '행사'),
    items: [
      { label: '행사 MC', href: proSearchHref('사회자', '행사') },
      { label: '공식행사 진행', href: proSearchHref('사회자', '공식행사') },
      { label: '레크리에이션', href: proSearchHref('사회자', '레크리에이션') },
    ],
  },
  {
    label: '기업행사',
    href: proSearchHref('사회자', '기업행사'),
    items: [
      { label: '기업행사 사회자', href: proSearchHref('사회자', '기업행사') },
      { label: '송년회·시무식', href: proSearchHref('사회자', '송년회') },
      { label: '기업PT 진행', href: proSearchHref('사회자', '기업PT') },
    ],
  },
  {
    label: '컨퍼런스',
    href: proSearchHref('사회자', '컨퍼런스'),
    items: [
      { label: '컨퍼런스 사회자', href: proSearchHref('사회자', '컨퍼런스') },
      { label: '세미나 진행', href: proSearchHref('사회자', '세미나') },
      { label: '축제·페스티벌', href: proSearchHref('사회자', '축제') },
    ],
  },
  {
    label: '외국어 사회자',
    href: proSearchHref('외국어사회자'),
    items: [
      { label: '영어 사회자', href: proSearchHref('외국어사회자', '영어') },
      { label: '일본어 사회자', href: proSearchHref('외국어사회자', '일본어') },
      { label: '중국어 사회자', href: proSearchHref('외국어사회자', '중국어') },
    ],
  },
  {
    label: '프리티풀 Biz',
    href: '/biz',
    items: [
      { label: '기업 섭외 문의', href: '/biz' },
      { label: '도입 사례', href: '/biz/clients' },
      { label: '자주 묻는 질문', href: '/biz/faq' },
    ],
  },
];

// ─── Reveal Hook ────────────────────────────────────────────
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'translate-y-0 opacity-100 blur-0' : 'translate-y-8 opacity-0 blur-[4px]'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ─── Helper: extract YouTube ID from URL ────────────────────
function extractYoutubeId(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0];
    if (host.includes('youtube.com')) {
      const watchId = parsed.searchParams.get('v');
      if (watchId) return watchId;
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(parts[0])) return parts[1];
    }
  } catch {}
  return url.match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([a-zA-Z0-9_-]{11})/)?.[1];
}

// 업로드 영상 URL 여부 (/uploads/ 경로 또는 영상 확장자)
function isUploadedVideoUrl(url: string): boolean {
  return url.startsWith('/uploads/') || /\.(mp4|mov|webm|m4v)(\?.*)?$/i.test(url);
}

// youtubeUrl(개행 조인) 원본 URL 목록에서 유튜브가 아닌 업로드 영상만 추출
function extractUploadedVideos(urls: string[], titlePrefix: string): { url: string; title: string }[] {
  const uploaded = Array.from(new Set(urls.filter((u) => !extractYoutubeId(u) && isUploadedVideoUrl(u))));
  return uploaded.map((url, i) => ({ url, title: `${titlePrefix}${uploaded.length > 1 ? ` ${i + 1}` : ''}` }));
}

function runWhenIdle(cb: () => void, timeout = 1200) {
  if (typeof window === 'undefined') return 0;
  const win = window as typeof window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  return win.requestIdleCallback ? win.requestIdleCallback(cb, { timeout }) : window.setTimeout(cb, 250);
}

function cancelIdleRun(handle: number) {
  if (typeof window === 'undefined' || !handle) return;
  const win = window as typeof window & { cancelIdleCallback?: (handle: number) => void };
  if (win.cancelIdleCallback) win.cancelIdleCallback(handle);
  window.clearTimeout(handle);
}

// ─── Pro data type from API ────────────────────────────────
interface ProDetailData {
  id: string;
  userId?: string;
  name: string;
  profileImage: string;
  mainImage: string;
  images: string[];
  title: string;
  categoryName?: string;
  tags?: string[];
  career?: string;
  isPrime: boolean;
  showPartnersLogo?: boolean;
  companyLogos?: string[];
  youtubeId?: string;
  youtubeVideos: { id: string; title: string }[];
  uploadedVideos: { url: string; title: string }[];
  faqs: { question: string; answer: string }[];
  rating: number;
  reviewCount: number;
  plans: { id: string; label: string; price: number; duration: string; title: string; desc: string[]; workDays: number; revisions: number }[];
  description: string;
  hasDescriptionContent: boolean;
  expertStats: {
    totalDeals: number;
    satisfaction: number;
    memberType: string;
    taxInvoice: string;
    responseTime: string;
    contactTime: string;
  };
  descriptionHtml?: string;
  reviews: {
    id: string;
    name: string;
    rating: number;
    date: string;
    scores?: Record<string, number>;
    content: string;
    workDays: number;
    orderRange: string;
    badge?: string;
    photos?: string[];
    proReply?: { date: string; content: string };
  }[];
  recommendedPros: { id: string; name: string; role: string; rating: number; reviews: number; experience: number; image: string; tags: string[]; isPartner: boolean }[];
  alsoViewed: { id: string; title: string; price: number; rating?: number; reviewCount?: number; author: string; image: string; category?: string }[];
}

function mapApiReviewToDetail(r: any): ProDetailData['reviews'][number] {
  const photos = (Array.isArray(r.images) ? r.images : Array.isArray(r.photos) ? r.photos : [])
    .map((item: any) => (typeof item === 'string' ? item : item?.imageUrl || item?.url))
    .filter(Boolean);
  return {
    id: r.id,
    name: r.isAnonymous ? '익명' : (r.reviewer?.name ? r.reviewer.name.slice(0, 2) + '********' : '고객'),
    rating: Number(r.avgRating) || 5.0,
    date: r.createdAt ? new Date(r.createdAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }) : '',
    scores: {
      경력: Number(r.ratingExperience) || 0,
      만족도: Number(r.ratingSatisfaction) || 0,
      구성력: Number(r.ratingComposition) || 0,
      위트: Number(r.ratingWit) || 0,
      발성: Number(r.ratingVoice) || 0,
      이미지: Number(r.ratingAppearance) || 0,
    },
    content: getReviewComment(r),
    workDays: 14,
    orderRange: '협의',
    photos,
    proReply: r.proReply
      ? {
          date: r.proRepliedAt ? new Date(r.proRepliedAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }) : '',
          content: r.proReply,
        }
      : undefined,
  };
}

function mergeDetailReviews(
  primary: ProDetailData['reviews'] = [],
  secondary: ProDetailData['reviews'] = [],
) {
  const seen = new Set<string>();
  const merged: ProDetailData['reviews'] = [];
  [...primary, ...secondary].forEach((review, index) => {
    const key = String(review.id || `${review.date}-${review.content}-${index}`);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(review);
  });
  return merged;
}

function decodeHtmlEntities(value: string) {
  if (typeof document === 'undefined') {
    return value
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripUnsafeHtml(html: string) {
  if (!html.trim()) return '';
  const source = /&lt;\/?[a-z][\s\S]*?&gt;/i.test(html) ? decodeHtmlEntities(html) : html;

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return source
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
      .replace(/\son\w+=["'][^"']*["']/gi, '')
      .replace(/\s(href|src)=["']\s*javascript:[^"']*["']/gi, '')
      .replace(/\sstyle=["'][^"']*(javascript:|expression\s*\(|behavior\s*:)[^"']*["']/gi, '');
  }

  const doc = new DOMParser().parseFromString(source, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach((node) => node.remove());
  doc.body.querySelectorAll('*').forEach((node) => {
    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      const isUnsafeUrl = (name === 'href' || name === 'src') && value.startsWith('javascript:');
      const isUnsafeStyle = name === 'style' && /(javascript:|expression\s*\(|behavior\s*:)/i.test(attr.value);
      if (name.startsWith('on') || isUnsafeUrl || isUnsafeStyle) {
        node.removeAttribute(attr.name);
      }
    });
  });
  return doc.body.innerHTML;
}

function textToHtml(text: string) {
  if (!text.trim()) return '';
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block.trim()).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

// 상대경로 /uploads 이미지를 현재 웹 origin 절대경로로 변환 (freetiful.com/uploads 는 프록시되어 200)
// API(Railway) origin 으로 절대화하면 iOS 등에서 로드 실패 → 웹 origin 사용
function uploadsOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return 'https://freetiful.com';
}
function absolutizeUploads(html: string) {
  return html.replace(/(src=["'])\/uploads\//g, `$1${uploadsOrigin()}/uploads/`);
}

function buildDescriptionHtml(html: string | null | undefined, fallbackText: string) {
  const cleaned = stripUnsafeHtml(html || '');
  if (cleaned.trim()) return absolutizeUploads(cleaned);
  return textToHtml(fallbackText);
}

function hasRichTextContent(html: string | null | undefined) {
  const cleaned = stripUnsafeHtml(html || '');
  // 1) 이미지/비디오/임베드/SVG/HR 등 텍스트가 아닌 시각 콘텐츠가 있으면 본문 있음
  if (/<(img|video|picture|svg|figure|hr|embed)\b/i.test(cleaned)) return true;
  // 2) 그 외엔 태그를 모두 벗긴 뒤 남은 텍스트 길이로 판단
  return cleaned
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim().length > 0;
}

function buildAiReviewSummary(pro: ProDetailData, reviews: ProDetailData['reviews']) {
  const source = reviews.map((review) => review.content).join(' ');
  const keywordRules = [
    { label: '진행 안정감', pattern: /안정|매끄|차분|진행|깔끔|능숙/ },
    { label: '분위기 센스', pattern: /분위기|센스|위트|유쾌|재미|웃/ },
    { label: '빠른 응답', pattern: /응답|빠르|친절|소통|상담/ },
    { label: '꼼꼼한 준비', pattern: /준비|대본|꼼꼼|미팅|확인/ },
    { label: '높은 만족도', pattern: /만족|추천|최고|감사|좋았|완벽/ },
  ];
  const fallbackKeywords = ['진행 안정감', '분위기 센스', '높은 만족도'];
  const keywords = keywordRules
    .filter((item) => item.pattern.test(source))
    .map((item) => item.label)
    .slice(0, 3);
  const topKeywords = keywords.length > 0 ? keywords : fallbackKeywords;
  const reviewCount = Math.max(reviews.length, pro.reviewCount);
  const ratingText = pro.rating > 0 ? `${pro.rating.toFixed(1)}점` : '높은 평점';

  return {
    text: `AI가 ${reviewCount.toLocaleString()}개 고객 리뷰를 읽고 요약했어요. ${pro.name} 사회자는 ${topKeywords.join(', ')}에서 좋은 평가가 많고, 전체 평점은 ${ratingText}이에요.`,
    keywords: topKeywords,
  };
}

/** 리뷰 본문에서 자주 언급된 표현을 뽑아 많이 나온 순으로 돌려준다 */
const REVIEW_KEYWORD_RULES: { label: string; pattern: RegExp }[] = [
  { label: '편안함', pattern: /편안|편하|긴장|부드럽|안심/ },
  { label: '매끄러운 진행', pattern: /매끄|자연스|막힘|물 흐르|무리 없/ },
  { label: '유쾌한 위트', pattern: /위트|유머|웃음|재밌|재미|유쾌/ },
  { label: '안정적인 목소리', pattern: /목소리|발성|성량|음성|딕션|톤/ },
  { label: '꼼꼼한 준비', pattern: /꼼꼼|세심|준비|대본|미팅|리허설/ },
  { label: '빠른 응답', pattern: /응답|빠르|바로|즉시|연락/ },
  { label: '친절한 소통', pattern: /친절|상담|소통|배려|편하게 말/ },
  { label: '분위기 리드', pattern: /분위기|센스|리드|조율|이끌/ },
  { label: '시간 준수', pattern: /시간|정확|지연|딜레이|약속/ },
  { label: '감동적인 순간', pattern: /감동|눈물|뭉클|울컥|따뜻/ },
  { label: '하객 호응', pattern: /하객|손님|호응|박수|반응/ },
  { label: '노련한 전문성', pattern: /프로|전문|노련|능숙|경력|베테랑/ },
  { label: '깔끔한 진행', pattern: /깔끔|정돈|군더더기|담백/ },
  { label: '또 부르고 싶은', pattern: /추천|또 |재의뢰|다시|강추/ },
];

function buildReviewKeywords(reviews: ProDetailData['reviews']) {
  const texts = reviews.map((review) => review.content || '');
  const counted = REVIEW_KEYWORD_RULES.map((rule) => ({
    label: rule.label,
    count: texts.filter((text) => rule.pattern.test(text)).length,
  }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
  const labels = counted.map((item) => item.label);
  // 리뷰가 적어 뽑히는 게 없으면 기본 키워드로 채운다
  const fallback = ['편안함', '매끄러운 진행', '친절한 소통', '꼼꼼한 준비', '분위기 리드'];
  for (const label of fallback) {
    if (labels.length >= 5) break;
    if (!labels.includes(label)) labels.push(label);
  }
  return labels;
}

function mapRecommendedPros(items: any[] = [], currentId: string) {
  return items
    .filter((p: any) => p.id !== currentId)
    .slice(0, 6)
    .map((p: any) => ({
      id: p.id,
      name: p.name,
      role: (p.categories && p.categories[0]) || '사회자',
      rating: p.avgRating,
      reviews: p.reviewCount,
      experience: p.careerYears,
      image: p.images?.[0] || p.profileImageUrl || '',
      tags: p.shortIntro ? p.shortIntro.split(' ').slice(0, 3) : [],
      isPartner: p.isFeatured,
    }));
}

function mapRecommendedProsToAlsoViewed(items: ProDetailData['recommendedPros']): ProDetailData['alsoViewed'] {
  return items.map((item) => ({
    id: item.id,
    title: `${item.role} ${item.name}`,
    price: 0,
    rating: item.rating,
    reviewCount: item.reviews,
    author: item.name,
    image: item.image || '/images/default-profile.png',
    category: item.role,
  }));
}

function mapListProPreview(p: ProListItem, planTemplates: PlanTemplate[]): ProDetailData {
  const images = [p.profileImageUrl, ...(p.images || [])].filter(Boolean);
  const proCategory = p.categories?.[0] || '사회자';
  const fallbackDescription = [p.shortIntro, p.mainExperience].filter(Boolean).join('\n\n') || `안녕하세요. ${proCategory} ${p.name}입니다.`;
  const previewApiTags = Array.isArray(p.tags) ? p.tags.filter(Boolean) : [];
  const previewFallbackTags = [
    ...(Array.isArray(p.categories) ? p.categories : []),
    ...(Array.isArray(p.regions) ? p.regions : []),
  ].filter(Boolean);
  const previewTags = (previewApiTags.length > 0 ? previewApiTags : previewFallbackTags).slice(0, 5);
  const previewVideoUrls: string[] = String(p.youtubeUrl || '').split(/\n+/).map((u) => u.trim()).filter(Boolean);
  const previewYoutubeId = previewVideoUrls.map((u) => extractYoutubeId(u)).filter(Boolean)[0];
  const previewUploadedVideos = extractUploadedVideos(previewVideoUrls, `${p.name} ${proCategory} 진행 영상`);
  const plans = planTemplates.filter((t) => t.isActive).map((t, idx) => ({
    id: t.planKey,
    label: t.label,
    price: 0,
    duration: t.description || '',
    title: t.description || `${t.label} 패키지`,
    desc: t.includedItems?.length ? t.includedItems : ['사회 진행'],
    workDays: 14,
    revisions: idx + 1,
  }));

  return {
    id: p.id,
    userId: p.userId,
    name: p.name,
    profileImage: images[0] || '/images/default-profile.png',
    mainImage: images[0] || '/images/default-profile.png',
    images: images.length > 0 ? images : ['/images/default-profile.png'],
    title: `${proCategory} ${p.name}`,
    categoryName: proCategory,
    tags: previewTags,
    career: p.mainExperience || '',
    isPrime: p.isFeatured || p.showPartnersLogo || false,
    showPartnersLogo: Boolean(p.showPartnersLogo),
    companyLogos: [],
    youtubeId: previewYoutubeId,
    youtubeVideos: previewYoutubeId ? [{ id: previewYoutubeId, title: `${p.name} ${proCategory} 진행 영상` }] : [],
    uploadedVideos: previewUploadedVideos,
    faqs: [],
    rating: p.avgRating || 0,
    reviewCount: p.reviewCount || 0,
    plans: plans.length > 0 ? plans : [{
      id: 'base',
      label: '기본',
      price: 0,
      duration: '',
      title: '기본 진행 패키지',
      desc: ['사회 진행'],
      workDays: 14,
      revisions: 1,
    }],
    description: fallbackDescription,
    hasDescriptionContent: false,
    descriptionHtml: '',
    expertStats: {
      totalDeals: p.reviewCount || 0,
      satisfaction: p.avgRating ? Math.round((p.avgRating / 5) * 100) : 0,
      memberType: '기업',
      taxInvoice: '프리티풀 발행',
      responseTime: '1시간 이내',
      contactTime: '언제나 가능',
    },
    reviews: [],
    recommendedPros: [],
    alsoViewed: [],
  };
}

function mapApiProDetail(res: any, planTemplates: PlanTemplate[], recommendedPros: ProDetailData['recommendedPros'] = []): ProDetailData {
  const userName = res.user?.name || '사회자';
  const images = res.images?.map((img: any) => img.imageUrl) || [];
  const profileImg = images[0] || res.user?.profileImageUrl || '';
  // 여러 영상 — youtubeUrl 에 개행 조인 저장(단일 데이터 호환)
  const ytUrls: string[] = String(res.youtubeUrl || '').split(/\n+/).map((u: string) => u.trim()).filter(Boolean);
  const ytIds: string[] = Array.from(new Set(ytUrls.map((u) => extractYoutubeId(u)).filter(Boolean))) as string[];
  const ytId = ytIds[0] || null;
  const proCategory: string = (res.categoryNames && res.categoryNames[0]) || '사회자';
  // 상대 /uploads URL 은 그대로 사용 (next rewrite 가 /uploads 프록시)
  const uploadedVideos = extractUploadedVideos(ytUrls, `${userName} ${proCategory} 진행 영상`);
  const services = res.services || [];
  const fallbackPlans = planTemplates.filter((t) => t.isActive).map((t, idx) => ({
    id: t.planKey,
    label: t.label,
    price: 0,
    duration: t.description || '',
    title: t.description || `${t.label} 패키지`,
    desc: t.includedItems?.length ? t.includedItems : ['사회 진행'],
    workDays: 14,
    revisions: idx + 1,
  }));
  const seenPlanKeys = new Set<string>();
  const plans = services
    .map((s: any, idx: number) => {
      const normalizedKey = normalizeWeddingPlanKey(s.title || s.id);
      const tpl = getWeddingPlanTemplate(normalizedKey);
      if (!tpl || seenPlanKeys.has(tpl.planKey)) return null;
      seenPlanKeys.add(tpl.planKey);
      const serviceDescription = String(s.description || '').trim();
      const desc = serviceDescription
        ? serviceDescription.split(/\s+·\s+|\n/).map((line) => line.trim()).filter(Boolean)
        : (tpl.includedItems?.length ? tpl.includedItems : ['사회 진행']);
      return {
        id: tpl.planKey,
        label: tpl.label,
        price: getWeddingPlanDisplayPrice(s.title || tpl.planKey, s.basePrice),
        duration: tpl.description || '',
        title: tpl.description || `${tpl.label} 패키지`,
        desc,
        workDays: 14,
        revisions: idx + 1,
      };
    })
    .filter(Boolean) as ProDetailData['plans'];

  const reviews = (res.reviews || []).map(mapApiReviewToDetail);
  const faqs = Array.isArray(res.faqs)
    ? res.faqs
        .map((f: any) => ({
          question: String(f.question || '').trim(),
          answer: String(f.answer || '').trim(),
        }))
        .filter((f: { question: string; answer: string }) => f.question && f.answer)
    : [];

  const fallbackDescription = [
    `안녕하세요. ${proCategory} ${userName}입니다.`,
    res.shortIntro ? `\n${res.shortIntro}` : '',
    res.mainExperience ? `\n\n주요 경력:\n• ${res.mainExperience.split('/').map((s: string) => s.trim()).join('\n• ')}` : '',
  ].filter(Boolean).join('');
  const hasDescriptionContent = hasRichTextContent(res.detailHtml);

  const apiTags = Array.isArray(res.tagList) ? res.tagList.filter(Boolean) : (Array.isArray(res.tags) ? res.tags.filter(Boolean) : []);
  const fallbackTags = [
    ...(Array.isArray(res.categoryNames) ? res.categoryNames : []),
    ...(Array.isArray(res.regionNames) ? res.regionNames : []),
  ].filter(Boolean);
  const detailTags = (apiTags.length > 0 ? apiTags : fallbackTags).slice(0, 5);

  return {
    id: res.id,
    userId: res.userId || res.user?.id,
    name: userName,
    profileImage: profileImg,
    mainImage: images[0] || profileImg,
    images: images.length > 0 ? images : [profileImg].filter(Boolean),
    title: `${proCategory} ${userName}`,
    categoryName: proCategory,
    tags: detailTags,
    career: res.mainExperience || '',
    isPrime: res.isFeatured || res.showPartnersLogo || false,
    showPartnersLogo: Boolean(res.showPartnersLogo),
    companyLogos: Array.isArray(res.companyLogos) ? res.companyLogos.filter(Boolean) : [],
    youtubeId: ytId,
    youtubeVideos: ytIds.map((id, i) => ({ id, title: `${userName} ${proCategory} 진행 영상${ytIds.length > 1 ? ` ${i + 1}` : ''}` })),
    uploadedVideos,
    faqs,
    rating: res.avgRating || 0,
    reviewCount: res.reviewCount || 0,
    plans: plans.length > 0 ? plans : fallbackPlans,
    description: fallbackDescription,
    hasDescriptionContent,
    descriptionHtml: hasDescriptionContent ? buildDescriptionHtml(res.detailHtml, '') : '',
    expertStats: {
      totalDeals: res.reviewCount || 0,
      satisfaction: res.avgRating ? Math.round((res.avgRating / 5) * 100) : 0,
      memberType: '기업',
      taxInvoice: '프리티풀 발행',
      responseTime: res.responseRate ? `${res.responseRate}시간 이내` : '1시간 이내',
      contactTime: '언제나 가능',
    },
    reviews,
    recommendedPros,
    alsoViewed: [],
  };
}

// ─── Components ─────────────────────────────────────────────

/**
 * 리뷰에서 자주 언급된 키워드.
 *
 * 예전엔 이 자리에 포텐셜 점수(레이더 차트 + 항목별 점수)가 있었는데,
 * 숫자보다 "무슨 말을 들었는지"가 고르는 데 더 도움이 된다는 판단으로 바꿨다.
 * 가장 많이 언급된 키워드일수록 크고 밝게, 어두운 판 위에 둥실 떠 있게 뒀다.
 */
const KEYWORD_SLOTS = [
  // 많이 언급된 순서대로 — 겹치지 않게 줄을 나눠 두고 크기·색·들여쓰기만 흔들었다
  { x: 38, y: 43, size: 21, weight: 700, color: '#1B64DA' },
  { x: 52, y: 27, size: 17, weight: 700, color: '#191F28' },
  { x: 55, y: 59, size: 16, weight: 700, color: '#7C5CE0' },
  { x: 40, y: 12, size: 14, weight: 600, color: '#4E5968' },
  { x: 41, y: 75, size: 14, weight: 600, color: '#6B7684' },
  { x: 57, y: 90, size: 13, weight: 600, color: '#A4ABBA' },
];

function ReviewKeywordCloud({ items, reviewCount }: { items: string[]; reviewCount: number }) {
  const { ref, visible } = useReveal(0.25);
  const shown = items.slice(0, KEYWORD_SLOTS.length);

  return (
    <div
      ref={ref as unknown as React.RefObject<HTMLDivElement>}
      data-kw-cloud
      className="relative mb-4 h-[250px] w-full overflow-hidden rounded-[20px] border border-[#EEF2F7] bg-white"
    >
      {/* 원에서 번져 나오는 빛 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            // 파랑이 중심, 위쪽으로 보라가 살짝 겹치며 번진다
            'radial-gradient(46% 62% at 34% 22%, rgba(139,92,246,0.20) 0%, rgba(139,92,246,0.09) 34%, rgba(255,255,255,0) 68%), ' +
            'radial-gradient(54% 80% at 20% 50%, rgba(49,128,247,0.26) 0%, rgba(49,128,247,0.14) 28%, rgba(49,128,247,0.05) 50%, rgba(255,255,255,0) 72%)',
          animation: visible ? 'kwGlow 6s ease-in-out infinite' : undefined,
        }}
      />
      {/* 가운데 어두운 원 */}
      <div className="absolute left-[20%] top-1/2 flex h-[96px] w-[96px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[#F2F4F6] text-center">
        <span className="text-[11px] font-semibold text-[#8B95A1]">언급 키워드</span>
        <span className="mt-0.5 text-[17px] font-bold text-[#2B313D]">{shown.length}개</span>
        <span className="mt-0.5 text-[10px] text-[#A4ABBA]">리뷰 {reviewCount}건</span>
      </div>

      {shown.map((keyword, i) => {
        const slot = KEYWORD_SLOTS[i];
        return (
          <span
            key={keyword}
            className="absolute -translate-y-1/2 whitespace-nowrap"
            style={{
              left: `${slot.x}%`,
              top: `${slot.y}%`,
              opacity: visible ? 1 : 0,
              transition: `opacity .6s ease ${i * 90}ms`,
            }}
          >
            <span
              className="block"
              style={{
                fontSize: slot.size,
                fontWeight: slot.weight,
                color: slot.color,
                animation: visible ? `kwFloat ${3.6 + i * 0.35}s ease-in-out ${i * 0.22}s infinite` : undefined,
              }}
            >
              {keyword}
            </span>
          </span>
        );
      })}
    </div>
  );
}

// 기존 사회자별 기업로고 매핑 (각 사회자가 함께한 기업)
const PRO_COMPANY_LOGOS: Record<string, string[]> = {
  '1': ['/images/company-logos/ARxaH4OpVaUc1UjpOv2UhQ8hgPGt-JH64gkcWcIAGz4XfVyiy1LAog-99r2v_a3zax4EEZzaMKE5l2tFcQ7i7A.svg', '/images/company-logos/D8d0CAJYg56wMGb2nqUnU5thBBSBSisClhYH5WA_KfgBzdgzgn4Tb-Wd8VtH17Nsal4NkSk9XZ2SwUgLUuhVVg.svg', '/images/company-logos/BRqtD2yZxxRP08TEpNXXNlHvXxtA9Dck7kO4rNAiyud7WyX1EudEU0Y7XpRaIi0eGipOIqU1iZRx06TjD87Bu_8PuSHC-vYi2expOi_ie9INQgZ_8lkfsq7WCiYGssRZvARyM-hmOKkZEOhr4vxl6Q.svg'],
  '2': ['/images/company-logos/EL-GmGKqmm_1_UI1I1HmCwdRis9GIdUfq0tBhZlKnvvB51kv2Wn0hFOfrApbJwh68wKSsYejtF7VN4Htuk2beb2mBOKIBpIM7NphrfKxnZWtfymCW5185hIVDb5q1_GmhJPNTV4GXIWat2Uw7SUHcw.svg', '/images/company-logos/FIN9iKw1Cdlcw0qdsLudvODTjrdndKbpbhu2rrzXy_MHd5LgMZBsbXaErtn_kNzWxM6iTiR7rJlKDcOV0TJ5UO7kwpWLap2PqskFK8q7Lb4kbHzAlpLii3vrpXzQbKneH9d2GEmKXMNl6VrkeepcXQ.svg'],
  '5': ['/images/company-logos/GwHvDSCNafSHnRiZNqDMJOvThTG4_8QJgEFMZC3jlpTg_e_IMR2WWQcB4W641zxOwU219ER8opVMfaK8uhdrl-F69hJn02bChdq-cAheQjLEjDthTLEr4gaXwc4V8ZDNYdfj319zkwONKucgD_G05w.svg', '/images/company-logos/Kl7O19oIwFHCfL2QV05oLVVoL684vmbcbpFHyQCiQRiYr7Dgb18bXQM9qY__l0rm0dlPJKRTqAcwaqRcmvg_m0mVOvVfkrcdjER-1QOvtudPOP8len_6uFgfriIGYpYVBjmCyJ0RAHKe7JjZ1soeWw.svg', '/images/company-logos/BzBaSlPhUQvUgTbep2YBg19b6coNL8iXPJp-BBD6f4z-rfsdylm8zOJnrkRmUWdJoQgJIDNuh7LnNaUeJ_B8Q32S11shONnXjdlQTFLz_5LSzLoW5D7pmuYXc99y6tWUOByfVz00-KNaJ9YAXRk2Eg.svg'],
  '8': ['/images/company-logos/N_7oK9jBqgd4o6MM1imyAIM0lZK2Rsr_oc9HDG8WRllhnrld37ChFRXkVZA5aMK-PSrkr9Y9LBrKuF0mQCMGP09WApahFXbjqTh-Rpw7fYqHkc2f7CKt7xCTc2OG0y1e1LPxvAqnwH4XOpxyWIyMMg.svg', '/images/company-logos/PV5QhQJrjCNrlEkK4HE-Myx-FNqaklavtwzZAzm_tVkUiX5U0kp-Ujm4vqKipQmsZj86CgDo_HVBtEEFgMCWIyrR7zWurNboYJJdW60duDKqWBF0ci_KpyXJ2-goGoXSB2_RmNotjMlducSl0kt_aA.svg', '/images/company-logos/Qqb24ODKcfgDz0dpJRti2CqDr9MThAod9YacFPOKifdbjvhBkviT1LgksZ5bxp92WDj3AsUa0h214Ln6fv3ejj1UxiP4hJfpPfq_u5Ae217Thzzkv3FqP9hDDBDGaNNBHJ1ypWViORlHmkucr_Elng.svg', '/images/company-logos/RDynDFYidWJ6Plgi-NOQnlBIMy3xfHiR0zgdLhyrv0PKCdBdstgmskNWU9s6MZ9iKGqbCRe8kK1zELijChT4yyIT285FNArduGoMzOK6nr3Jia0qu7Prqzk2awOznbMlKYQyxTaA_eSLDVRDyQFZpg.svg'],
  '9': ['/images/company-logos/Fbc3OBO5lnF_aljwIte4mbdQIFVsutSyv5oZ3_JZ5vZ5_Ez_Se0pe47JqRTjOZBqtlFGxYQXYzlG820nGt_M4of6r_OTf2hzjBGAa4UbekunDcLTFOXnG8Moc_cIMDhrABFn_g42rUoQk6FTMBErqg.svg', '/images/company-logos/0kIrqSx6FQ6AZtryR8Rii4lXBGrvITgNfRhhiLfi2aVr-Uqg1l5bOMa4Vi3THlnZYVns6hi5Y75mBhXXS4r6dBfKvn1HPMRq10Gh8NrRBcZE0Pd7zOeDm9WYfDEvAaCZSVD12nCLfeJdkz9WXPnZ3w.svg'],
  '10': ['/images/company-logos/CTCL5r-2Lrik1gBj6n7B0qyIP13vlZUsO_9YpcjuK8Hr8gUiNH33HhuUpwYDmywHYEBZencD5-2p_cJIfunWiqJXR16H5tsIW3hL6qiUK4o3afLmSrpCAf85-c-TDMmsTZRiKr9kWrRUGmMuKFNXlQ.svg', '/images/company-logos/1GPWKc37T7Qz08E07p9sDg0F4rYPxg_qbmh5CSSxrdDTQoy6hCl6k-UgoySwKANqEm0jCWiZjyMqaLUxX31_3RyRiW1yQ2L5zYtA6WzN7s5Zxy31rQSDGIotP0yP2rU6jhAVfxvxFl__q_NPEuRKAg.svg', '/images/company-logos/4nJH1a9BfVA9ilPdwu120VbDd-ERloXHcOus1u88Xhvpql-0zhgPSW9dj3zZKGKlGVEfqJwFPQLWwtXGYmft8KGikSA2N0n3yojcWKfrmKWyZ3dLtYmBFcKkeTn8CDL7HarNcbkEmB8AYP76lHFDTg.svg'],
  '12': ['/images/company-logos/5bZLn7_cvlKQnqzT0_0hMSHeq0y1K-YgT4X40IT9qxQClHZTU3fHCuuIyI7JSjm7MmtDrWs1KBx7VtHyTk4rrbhhAhWa-EpxfAJwkoVV9vrn7DLNFlXNy6zNfET5B7ohb0ULDDwO99agnC9QOW7lKA.svg', '/images/company-logos/7JPcHcbSryZEH9UhI0PnkdfR30SZvvoSyV7ynaBncTLEwBYWfUrG4IdzrpmjvAKS2a06vY7ReLjl6MGktfk6NaRQrN-tHBcs3GbLIDJ4x5s_O4NXZYGeNFUdkjS5iJJidsmP7fXHqWo7RlGL9mbNgg.svg', '/images/company-logos/7K5Bmcq7qiQ6Eud7OD2A2hTmRHTxkShb8lmf3EVD4alegph6WnxOEzfOYxM0LDCXkfT_vVZ9_Hjk_XXaRJlTsMPB9epfyN8kUFonEnB4GTiHlonXo_oKqJs4AR9MJhtmsVX8j90IdFvH1Ujko6XLOQ.svg'],
  '13': ['/images/company-logos/8iC8ebMvPPfZeTUkj9VBmsrPUw4lPJp9ITlR115EWv0ULvgo-S_CtNWa2TNlKwzqNS_KGPNo6xFnF_UxcRLylG-HIYXXoRmhDQUjoZvi8kTTM3-1l5hd558xNYS5PlZxUCI3j1XXJbcotsBxfHIeNQ.svg', '/images/company-logos/Fbe6yAmPhTGyBpbFnJrzWROlvct5aNx2TBIUKqyiunO_iZdfvBKbFzh7FVPmqRQpeRfEKA-pz-QeTLTsfVj7NxKMy8mEN8NUKbf9r0p4VlGyHGibJqXQKEBS-4NE0QWMgj4CvofMTvCYXMovp3WWNg.svg'],
  '15': ['/images/company-logos/ARxaH4OpVaUc1UjpOv2UhQ8hgPGt-JH64gkcWcIAGz4XfVyiy1LAog-99r2v_a3zax4EEZzaMKE5l2tFcQ7i7A.svg', '/images/company-logos/D8d0CAJYg56wMGb2nqUnU5thBBSBSisClhYH5WA_KfgBzdgzgn4Tb-Wd8VtH17Nsal4NkSk9XZ2SwUgLUuhVVg.svg', '/images/company-logos/EL-GmGKqmm_1_UI1I1HmCwdRis9GIdUfq0tBhZlKnvvB51kv2Wn0hFOfrApbJwh68wKSsYejtF7VN4Htuk2beb2mBOKIBpIM7NphrfKxnZWtfymCW5185hIVDb5q1_GmhJPNTV4GXIWat2Uw7SUHcw.svg', '/images/company-logos/GwHvDSCNafSHnRiZNqDMJOvThTG4_8QJgEFMZC3jlpTg_e_IMR2WWQcB4W641zxOwU219ER8opVMfaK8uhdrl-F69hJn02bChdq-cAheQjLEjDthTLEr4gaXwc4V8ZDNYdfj319zkwONKucgD_G05w.svg'],
  '23': ['/images/company-logos/BRqtD2yZxxRP08TEpNXXNlHvXxtA9Dck7kO4rNAiyud7WyX1EudEU0Y7XpRaIi0eGipOIqU1iZRx06TjD87Bu_8PuSHC-vYi2expOi_ie9INQgZ_8lkfsq7WCiYGssRZvARyM-hmOKkZEOhr4vxl6Q.svg', '/images/company-logos/FIN9iKw1Cdlcw0qdsLudvODTjrdndKbpbhu2rrzXy_MHd5LgMZBsbXaErtn_kNzWxM6iTiR7rJlKDcOV0TJ5UO7kwpWLap2PqskFK8q7Lb4kbHzAlpLii3vrpXzQbKneH9d2GEmKXMNl6VrkeepcXQ.svg'],
  '24': ['/images/company-logos/Kl7O19oIwFHCfL2QV05oLVVoL684vmbcbpFHyQCiQRiYr7Dgb18bXQM9qY__l0rm0dlPJKRTqAcwaqRcmvg_m0mVOvVfkrcdjER-1QOvtudPOP8len_6uFgfriIGYpYVBjmCyJ0RAHKe7JjZ1soeWw.svg', '/images/company-logos/N_7oK9jBqgd4o6MM1imyAIM0lZK2Rsr_oc9HDG8WRllhnrld37ChFRXkVZA5aMK-PSrkr9Y9LBrKuF0mQCMGP09WApahFXbjqTh-Rpw7fYqHkc2f7CKt7xCTc2OG0y1e1LPxvAqnwH4XOpxyWIyMMg.svg', '/images/company-logos/PV5QhQJrjCNrlEkK4HE-Myx-FNqaklavtwzZAzm_tVkUiX5U0kp-Ujm4vqKipQmsZj86CgDo_HVBtEEFgMCWIyrR7zWurNboYJJdW60duDKqWBF0ci_KpyXJ2-goGoXSB2_RmNotjMlducSl0kt_aA.svg'],
  '25': ['/images/company-logos/Qqb24ODKcfgDz0dpJRti2CqDr9MThAod9YacFPOKifdbjvhBkviT1LgksZ5bxp92WDj3AsUa0h214Ln6fv3ejj1UxiP4hJfpPfq_u5Ae217Thzzkv3FqP9hDDBDGaNNBHJ1ypWViORlHmkucr_Elng.svg', '/images/company-logos/RDynDFYidWJ6Plgi-NOQnlBIMy3xfHiR0zgdLhyrv0PKCdBdstgmskNWU9s6MZ9iKGqbCRe8kK1zELijChT4yyIT285FNArduGoMzOK6nr3Jia0qu7Prqzk2awOznbMlKYQyxTaA_eSLDVRDyQFZpg.svg', '/images/company-logos/BzBaSlPhUQvUgTbep2YBg19b6coNL8iXPJp-BBD6f4z-rfsdylm8zOJnrkRmUWdJoQgJIDNuh7LnNaUeJ_B8Q32S11shONnXjdlQTFLz_5LSzLoW5D7pmuYXc99y6tWUOByfVz00-KNaJ9YAXRk2Eg.svg'],
  '31': ['/images/company-logos/0kIrqSx6FQ6AZtryR8Rii4lXBGrvITgNfRhhiLfi2aVr-Uqg1l5bOMa4Vi3THlnZYVns6hi5Y75mBhXXS4r6dBfKvn1HPMRq10Gh8NrRBcZE0Pd7zOeDm9WYfDEvAaCZSVD12nCLfeJdkz9WXPnZ3w.svg', '/images/company-logos/CTCL5r-2Lrik1gBj6n7B0qyIP13vlZUsO_9YpcjuK8Hr8gUiNH33HhuUpwYDmywHYEBZencD5-2p_cJIfunWiqJXR16H5tsIW3hL6qiUK4o3afLmSrpCAf85-c-TDMmsTZRiKr9kWrRUGmMuKFNXlQ.svg', '/images/company-logos/Fbc3OBO5lnF_aljwIte4mbdQIFVsutSyv5oZ3_JZ5vZ5_Ez_Se0pe47JqRTjOZBqtlFGxYQXYzlG820nGt_M4of6r_OTf2hzjBGAa4UbekunDcLTFOXnG8Moc_cIMDhrABFn_g42rUoQk6FTMBErqg.svg'],
  '34': ['/images/company-logos/1GPWKc37T7Qz08E07p9sDg0F4rYPxg_qbmh5CSSxrdDTQoy6hCl6k-UgoySwKANqEm0jCWiZjyMqaLUxX31_3RyRiW1yQ2L5zYtA6WzN7s5Zxy31rQSDGIotP0yP2rU6jhAVfxvxFl__q_NPEuRKAg.svg', '/images/company-logos/4nJH1a9BfVA9ilPdwu120VbDd-ERloXHcOus1u88Xhvpql-0zhgPSW9dj3zZKGKlGVEfqJwFPQLWwtXGYmft8KGikSA2N0n3yojcWKfrmKWyZ3dLtYmBFcKkeTn8CDL7HarNcbkEmB8AYP76lHFDTg.svg'],
  '35': ['/images/company-logos/5bZLn7_cvlKQnqzT0_0hMSHeq0y1K-YgT4X40IT9qxQClHZTU3fHCuuIyI7JSjm7MmtDrWs1KBx7VtHyTk4rrbhhAhWa-EpxfAJwkoVV9vrn7DLNFlXNy6zNfET5B7ohb0ULDDwO99agnC9QOW7lKA.svg', '/images/company-logos/7JPcHcbSryZEH9UhI0PnkdfR30SZvvoSyV7ynaBncTLEwBYWfUrG4IdzrpmjvAKS2a06vY7ReLjl6MGktfk6NaRQrN-tHBcs3GbLIDJ4x5s_O4NXZYGeNFUdkjS5iJJidsmP7fXHqWo7RlGL9mbNgg.svg', '/images/company-logos/8iC8ebMvPPfZeTUkj9VBmsrPUw4lPJp9ITlR115EWv0ULvgo-S_CtNWa2TNlKwzqNS_KGPNo6xFnF_UxcRLylG-HIYXXoRmhDQUjoZvi8kTTM3-1l5hd558xNYS5PlZxUCI3j1XXJbcotsBxfHIeNQ.svg'],
  '37': ['/images/company-logos/ARxaH4OpVaUc1UjpOv2UhQ8hgPGt-JH64gkcWcIAGz4XfVyiy1LAog-99r2v_a3zax4EEZzaMKE5l2tFcQ7i7A.svg', '/images/company-logos/Fbe6yAmPhTGyBpbFnJrzWROlvct5aNx2TBIUKqyiunO_iZdfvBKbFzh7FVPmqRQpeRfEKA-pz-QeTLTsfVj7NxKMy8mEN8NUKbf9r0p4VlGyHGibJqXQKEBS-4NE0QWMgj4CvofMTvCYXMovp3WWNg.svg'],
  '38': ['/images/company-logos/D8d0CAJYg56wMGb2nqUnU5thBBSBSisClhYH5WA_KfgBzdgzgn4Tb-Wd8VtH17Nsal4NkSk9XZ2SwUgLUuhVVg.svg', '/images/company-logos/GwHvDSCNafSHnRiZNqDMJOvThTG4_8QJgEFMZC3jlpTg_e_IMR2WWQcB4W641zxOwU219ER8opVMfaK8uhdrl-F69hJn02bChdq-cAheQjLEjDthTLEr4gaXwc4V8ZDNYdfj319zkwONKucgD_G05w.svg', '/images/company-logos/Kl7O19oIwFHCfL2QV05oLVVoL684vmbcbpFHyQCiQRiYr7Dgb18bXQM9qY__l0rm0dlPJKRTqAcwaqRcmvg_m0mVOvVfkrcdjER-1QOvtudPOP8len_6uFgfriIGYpYVBjmCyJ0RAHKe7JjZ1soeWw.svg'],
};

const DEFAULT_COMPANY_LOGOS = Array.from(new Set(Object.values(PRO_COMPANY_LOGOS).flat()));

function simpleHash(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function fallbackCompanyLogos(proId?: string) {
  const seed = simpleHash(proId || 'freetiful-company-logos');
  return [...DEFAULT_COMPANY_LOGOS]
    .sort((a, b) => simpleHash(`${seed}:${a}`) - simpleHash(`${seed}:${b}`))
    .slice(0, 8);
}

function cleanLogoUrls(items?: string[]) {
  return Array.from(new Set((items || []).filter((logo) => typeof logo === 'string' && logo.startsWith('/images/'))));
}

function CompanyLogoCarousel({
  proId,
  logos: providedLogos,
  showFallback = false,
}: {
  proId?: string;
  logos?: string[];
  showFallback?: boolean;
}) {
  const [logos, setLogos] = useState<string[]>([]);
  useEffect(() => {
    const explicitLogos = cleanLogoUrls(providedLogos);
    if (explicitLogos.length > 0) {
      setLogos(explicitLogos);
      return;
    }
    // 1. 해당 프로의 매핑된 로고 확인
    if (proId && PRO_COMPANY_LOGOS[proId]) {
      setLogos(PRO_COMPANY_LOGOS[proId]);
      return;
    }
    // 2. 본인 프로필 페이지일 때만 localStorage에서 읽기 (my-pro 또는 내 프로 ID인 경우)
    const isOwnProfile = proId === 'my-pro';
    if (!isOwnProfile) {
      setLogos([]);
      return;
    }
    try {
      const saved = localStorage.getItem('proRegister_companyLogos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string' && parsed[0].startsWith('/images/')) {
          setLogos(parsed);
          return;
        }
      }
    } catch {}
    if (showFallback) {
      setLogos(fallbackCompanyLogos(proId));
      return;
    }
    setLogos([]);
  }, [proId, providedLogos, showFallback]);

  if (logos.length === 0) return null;

  const repeated = [...logos, ...logos, ...logos];

  return (
    <div className="overflow-hidden mb-4 -mx-2.5 px-2.5">
      <div
        className="flex items-center gap-5"
        style={{
          width: 'max-content',
          animation: `logoScroll ${logos.length * 3}s linear infinite`,
        }}
      >
        {repeated.map((logo, i) => (
          <div key={i} className="shrink-0 h-[28px] w-[72px] flex items-center justify-center opacity-40 grayscale">
            <img src={encodeURI(logo)} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        ))}
      </div>
      <style>{`@keyframes logoScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-${logos.length * 92}px); } }`}</style>
    </div>
  );
}

// 핀치 줌/팬/더블탭 이미지 뷰어 — 전역 viewport 가 user-scalable=no 라 브라우저 확대가 막혀 있어
// 제스처를 직접 구현. touch-action:none 으로 스크롤 개입 차단(안드 웹뷰 preventDefault 불요).
function ZoomableImage({ src }: { src: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const g = useRef({
    scale: 1, tx: 0, ty: 0,
    startDist: 0, startScale: 1,
    panX: 0, panY: 0, startTx: 0, startTy: 0, panning: false, pinching: false,
    lastTap: 0,
  });

  const apply = () => {
    const el = wrapRef.current;
    if (!el) return;
    const s = g.current;
    el.style.transform = `translate(${s.tx}px, ${s.ty}px) scale(${s.scale})`;
  };
  const clampPan = () => {
    const el = wrapRef.current;
    const s = g.current;
    if (!el) return;
    if (s.scale <= 1) { s.tx = 0; s.ty = 0; return; }
    const maxX = (el.offsetWidth * (s.scale - 1)) / 2;
    const maxY = (el.offsetHeight * (s.scale - 1)) / 2;
    s.tx = Math.min(maxX, Math.max(-maxX, s.tx));
    s.ty = Math.min(maxY, Math.max(-maxY, s.ty));
  };
  const dist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  return (
    <div
      ref={wrapRef}
      className="max-w-[95vw] max-h-[90vh]"
      style={{ touchAction: 'none', transformOrigin: 'center center', willChange: 'transform' }}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => {
        const s = g.current;
        if (e.touches.length === 2) {
          s.pinching = true; s.panning = false;
          s.startDist = dist(e.touches); s.startScale = s.scale;
        } else if (e.touches.length === 1) {
          s.panning = s.scale > 1;
          s.panX = e.touches[0].clientX; s.panY = e.touches[0].clientY;
          s.startTx = s.tx; s.startTy = s.ty;
        }
      }}
      onTouchMove={(e) => {
        const s = g.current;
        if (s.pinching && e.touches.length === 2) {
          s.scale = Math.min(4, Math.max(1, s.startScale * (dist(e.touches) / (s.startDist || 1))));
          clampPan(); apply();
        } else if (s.panning && e.touches.length === 1) {
          s.tx = s.startTx + (e.touches[0].clientX - s.panX);
          s.ty = s.startTy + (e.touches[0].clientY - s.panY);
          clampPan(); apply();
        }
      }}
      onTouchEnd={(e) => {
        const s = g.current;
        if (e.touches.length === 0) {
          // 더블탭: 300ms 내 두 번 → 1x ↔ 2.5x 토글
          const wasPinch = s.pinching;
          const moved = Math.abs(s.tx - s.startTx) > 8 || Math.abs(s.ty - s.startTy) > 8;
          s.pinching = false; s.panning = false;
          if (!wasPinch && !moved) {
            const now = Date.now();
            if (now - s.lastTap < 300) {
              s.scale = s.scale > 1 ? 1 : 2.5;
              clampPan(); apply();
              s.lastTap = 0;
            } else {
              s.lastTap = now;
            }
          }
          if (s.scale <= 1.02) { s.scale = 1; clampPan(); apply(); }
        } else if (e.touches.length === 1) {
          // 핀치 → 한 손가락 남음: 팬으로 전환
          s.pinching = false;
          s.panning = s.scale > 1;
          s.panX = e.touches[0].clientX; s.panY = e.touches[0].clientY;
          s.startTx = s.tx; s.startTy = s.ty;
        }
      }}
    >
      <Image src={src} alt="" width={1200} height={1200} className="max-w-[95vw] max-h-[90vh] object-contain rounded-xl select-none" draggable={false} />
    </div>
  );
}

function StarRating({ value, size = 14, twinkle = false }: { value: number; size?: number; /** 프로필 사진 아래 대표 별점에서만 켠다 */ twinkle?: boolean }) {
  return (
    <div className="flex items-center gap-0">
      {[0, 1, 2, 3, 4].map((i) => (
        // 별 모양은 제공받은 아이콘 그대로. 예전 자체 path 는 좌표 정밀도가 낮아
        // iOS 사파리에서 뾰족한 부분이 뭉개져 깨져 보였다.
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          shapeRendering="geometricPrecision"
          className={twinkle && i < Math.floor(value) ? 'star-twinkle' : undefined}
          style={{ display: 'block', flexShrink: 0, animationDelay: `${i * 140}ms` }}
        >
          <path
            d="M21.5409 6.54807L24.6489 12.8481C24.7724 13.0978 24.9547 13.3138 25.1801 13.4775C25.4055 13.6413 25.6672 13.7478 25.9429 13.7881L32.8939 14.7981C33.2111 14.8441 33.5092 14.9779 33.7543 15.1845C33.9994 15.391 34.1819 15.6621 34.281 15.9669C34.3802 16.2717 34.3921 16.5982 34.3153 16.9094C34.2386 17.2207 34.0764 17.5042 33.8469 17.7281L28.8159 22.6281C28.6168 22.8228 28.4678 23.0629 28.3818 23.3278C28.2957 23.5927 28.2752 23.8745 28.3219 24.1491L29.5099 31.0721C29.5639 31.388 29.5286 31.7128 29.4077 32.0097C29.2869 32.3067 29.0855 32.5639 28.8262 32.7523C28.5669 32.9408 28.26 33.053 27.9403 33.0763C27.6206 33.0996 27.3008 33.033 27.0169 32.8841L20.7999 29.6171C20.5532 29.4872 20.2787 29.4193 19.9999 29.4193C19.7211 29.4193 19.4466 29.4872 19.1999 29.6171L12.9819 32.8861C12.698 33.035 12.3782 33.1016 12.0585 33.0783C11.7388 33.055 11.4319 32.9428 11.1726 32.7543C10.9133 32.5659 10.7119 32.3087 10.5911 32.0117C10.4703 31.7148 10.4349 31.39 10.4889 31.0741L11.6769 24.1511C11.7236 23.8765 11.7031 23.5947 11.6171 23.3298C11.531 23.0649 11.3821 22.8248 11.1829 22.6301L6.15191 17.7301C5.92245 17.5062 5.76019 17.2227 5.68347 16.9114C5.60676 16.6002 5.61864 16.2737 5.71779 15.9689C5.81694 15.6641 5.99939 15.393 6.24452 15.1865C6.48965 14.9799 6.78768 14.8461 7.10491 14.8001L14.0559 13.7901C14.3316 13.7498 14.5933 13.6433 14.8187 13.4795C15.0441 13.3158 15.2264 13.0998 15.3499 12.8501L18.4579 6.55007C18.5997 6.26234 18.8191 6.02002 19.0914 5.8505C19.3637 5.68098 19.678 5.59103 19.9988 5.59082C20.3195 5.59061 20.634 5.68015 20.9065 5.84932C21.179 6.01849 21.3988 6.26053 21.5409 6.54807Z"
            fill={i < Math.floor(value) ? '#FFCD00' : '#E5E7EB'}
          />
        </svg>
      ))}
    </div>
  );
}


/**
 * 주요 경력 — 파란 띠가 글자를 훑고 지나가며 한 줄씩 드러난다.
 * 화면 밖에서 애니메이션이 이미 끝나 버리지 않도록, 보이기 시작할 때 시작한다.
 */
function CareerSweepList({ lines, size = 'sm' }: { lines: string[]; size?: 'sm' | 'lg' }) {
  const { ref, visible } = useReveal(0.2);
  return (
    <ul ref={ref as unknown as React.RefObject<HTMLUListElement>} className={size === 'lg' ? 'space-y-2' : 'divide-y divide-[#F2F4F6]'}>
      {lines.map((line, i) => (
        <li
          key={i}
          className={`${visible ? 'career-sweep' : ''} ${size === 'lg' ? 'text-[17px] font-semibold leading-[1.55]' : 'py-2.5 text-[14px] font-semibold leading-[1.6]'}`}
          style={visible ? { animationDelay: `${i * 120}ms` } : { color: '#333D4B' }}
        >
          {line}
        </li>
      ))}
    </ul>
  );
}

/** AI 요약 스파클 — 큰 별 하나에 작은 별 둘이 엇박으로 반짝인다 */
function AiSparkle({ size = 18 }: { size?: number }) {
  const star = (cx: number, cy: number, r: number) =>
    `M ${cx} ${cy - r} Q ${cx + r * 0.18} ${cy - r * 0.18} ${cx + r} ${cy}` +
    ` Q ${cx + r * 0.18} ${cy + r * 0.18} ${cx} ${cy + r}` +
    ` Q ${cx - r * 0.18} ${cy + r * 0.18} ${cx - r} ${cy}` +
    ` Q ${cx - r * 0.18} ${cy - r * 0.18} ${cx} ${cy - r} Z`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden="true">
      <path d={star(10, 13, 8)} fill="#8B5CF6" className="sparkle-big" />
      <path d={star(19, 5.5, 4)} fill="#C4A6FF" className="sparkle-small" style={{ animationDelay: '0.5s' }} />
      <path d={star(20, 16, 2.6)} fill="#E0CCFF" className="sparkle-small" style={{ animationDelay: '1s' }} />
    </svg>
  );
}

/** 이름 옆 인증 뱃지 — 톱니 원 안에 체크 */
function VerifiedBadge({ size = 18 }: { size?: number }) {
  const points = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const r = i % 2 === 0 ? 12 : 10.4;
    return `${(12 + Math.cos(a) * r).toFixed(2)},${(12 + Math.sin(a) * r).toFixed(2)}`;
  }).join(' ');
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="shrink-0" aria-label="인증 사회자">
      <polygon points={points} fill="#3180F7" />
      <path d="M8.4 12.2l2.5 2.5 4.7-5" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** 리뷰 이름 마스킹 — 첫 글자만 남긴다 */
function maskReviewer(name?: string) {
  const n = (name || '').trim();
  if (!n) return '익명';
  return `${n[0]}${'*'.repeat(Math.max(2, Math.min(5, n.length)))}`;
}

/**
 * 별점 아래에 리뷰 카드들이 서로 어긋난 높이로 놓여 천천히 떠다닌다.
 * 카드마다 주기와 시작 지연이 달라야 '두둥실' 느낌이 나서 인덱스로 어긋나게 준다.
 */
function FloatingReviewCards({ reviews }: { reviews: ProDetailData['reviews'] }) {
  const items = (reviews || []).filter((r) => (r.content || '').trim()).slice(0, 6);
  if (items.length === 0) return null;
  return (
    <div className="-mx-5 mt-2.5 overflow-x-auto px-5 pb-2 pt-1 scrollbar-hide">
      <div className="flex items-start gap-3" style={{ width: 'max-content' }}>
        {items.map((r, i) => {
          const accent = i % 3 === 1;
          return (
            <div
              key={r.id}
              className={`review-float w-[232px] shrink-0 rounded-[20px] p-4 ${accent ? 'bg-[#3180F7]' : 'bg-[#F7F8FA]'}`}
              style={{
                marginTop: (i % 3) * 14,
                animation: `reviewFloat ${(4.2 + (i % 3) * 0.9).toFixed(1)}s ease-in-out ${(i * 0.35).toFixed(2)}s infinite`,
              }}
            >
              <StarRating value={r.rating} size={12} />
              <p className={`mt-2 line-clamp-3 text-[13px] leading-[1.6] ${accent ? 'text-white' : 'text-[#4E5968]'}`}>
                {r.content}
              </p>
              <div className={`mt-3 flex items-center justify-between text-[11px] ${accent ? 'text-white/75' : 'text-[#A4ABBA]'}`}>
                <span>{maskReviewer(r.name)}</span>
                <span>{r.date}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 화이트 카드 톤 공용 UI (표현 전용 — 제이씨랩 자가견적 톤) ───
// 카드: 흰 배경 + 1px #EEF0F4 테두리 + 아주 옅은 그림자
/* 섹션을 카드로 묶지 않는다 — 흰 바탕에 이어지고, 사이는 회색 띠로만 나눈다 */
const CARD_CLS = 'bg-white';
/* 섹션 사이 회색 구분 띠 */
const SECTION_GAP_CLS = 'border-t-[10px] border-[#F2F4F6]';

// 라운드 스퀘어클 아이콘 타일 (44px, #F2F4F6, radius 14) + 24px 아이콘
function IconTile({ src, size = 26, icon = 24, className = '' }: { src: string; size?: number; icon?: number; className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <img src={src} alt="" width={icon} height={icon} />
    </span>
  );
}

// 영문 eyebrow + 진회색 섹션 타이틀 헤더 (size: lg=섹션 19px / sm=서브 섹션 15px)
function SectionHead({
  eyebrow,
  title,
  icon,
  size = 'lg',
  tileClassName,
  className = '',
}: {
  /** 더 이상 표시하지 않음(호출부 호환용) */
  eyebrow?: string;
  title: ReactNode;
  icon?: string;
  size?: 'lg' | 'sm';
  tileClassName?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {icon && <IconTile src={icon} className={tileClassName} />}
      <div className="min-w-0 flex-1">
        {/* 영문 eyebrow 는 노출하지 않는다(요청) — prop 은 호출부 호환을 위해 남겨 둔다 */}
        <h2 className={`font-extrabold leading-tight text-[#191F28] ${size === 'lg' ? 'text-[19px]' : 'text-[15px]'}`}>{title}</h2>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────

export default function ProDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [headerQuery, setHeaderQuery] = useState('');   // PC 헤더 검색창
  const [pro, setPro] = useState<ProDetailData | null>(null);
  const [apiError, setApiError] = useState(false);
  const [apiLoading, setApiLoading] = useState(true);

  // API에서 사회자 상세 데이터 가져오기
  useEffect(() => {
    if (!id) return;
    // id 변경 시 이전 페이지의 에러 상태가 남아 새 페이지를 가리는 문제 방지
    setApiError(false);
    setApiLoading(true);

    // 'my-pro' special case: localStorage에서 등록된 사회자
    if (id === 'my-pro') {
      try {
        const name = localStorage.getItem('proRegister_name') || '사회자';
        const photos = JSON.parse(localStorage.getItem('proRegister_photos') || '[]');
        const mainPhotoIndex = parseInt(localStorage.getItem('proRegister_mainPhotoIndex') || '0') || 0;
        const intro = localStorage.getItem('proRegister_intro') || '프리티풀 인증 사회자';
        // career: proRegister_awards 의 첫 줄을 하이라이트로 사용 (career 전용 키는 없음)
        const awards = localStorage.getItem('proRegister_awards') || '';
        const career = awards.split('\n').filter(Boolean)[0] || '';
        const careerYears = parseInt(localStorage.getItem('proRegister_careerYears') || '1');
        // 영상 목록: proRegister_videos 배열만 사용 (레거시 단일키는 제거됨)
        let videoUrls: string[] = [];
        try {
          const vs = JSON.parse(localStorage.getItem('proRegister_videos') || '[]');
          if (Array.isArray(vs)) videoUrls = vs.filter(Boolean);
        } catch {}
        const ytIds = videoUrls.map((u) => extractYoutubeId(u)).filter(Boolean) as string[];
        const ytId = ytIds[0];
        const localUploadedVideos = extractUploadedVideos(videoUrls, `${name} 사회자 진행 영상`);
        const allImages = photos.length > 0 ? photos : ['/images/placeholder.avif'];
        const detailHtml = localStorage.getItem('proRegister_description') || '';
        let localFaqs: { question: string; answer: string }[] = [];
        try {
          const rawFaqs = JSON.parse(localStorage.getItem('proRegister_faq') || '[]');
          if (Array.isArray(rawFaqs)) {
            localFaqs = rawFaqs
              .map((f: any) => ({
                question: String(f.question || f.q || '').trim(),
                answer: String(f.answer || f.a || '').trim(),
              }))
              .filter((f: { question: string; answer: string }) => f.question && f.answer);
          }
        } catch {}
        const fallbackDescription = `안녕하세요. 사회자 ${name}입니다.\n\n${intro}\n\n${career ? `주요 경력:\n• ${career.split('/').map((s: string) => s.trim()).join('\n• ')}` : ''}`;
        const hasDescriptionContent = hasRichTextContent(detailHtml);
        let registeredRegions: string[] = [];
        try {
          const rs = JSON.parse(localStorage.getItem('proRegister_regions') || '[]');
          if (Array.isArray(rs)) registeredRegions = rs.filter(Boolean);
        } catch {}
        let localCompanyLogos: string[] = [];
        try {
          const savedLogos = JSON.parse(localStorage.getItem('proRegister_companyLogos') || '[]');
          if (Array.isArray(savedLogos)) {
            localCompanyLogos = savedLogos.filter((logo) => typeof logo === 'string' && logo.startsWith('/images/'));
          }
        } catch {}
        const myProTags = ['사회자', ...registeredRegions].slice(0, 5);
        const localPlanServices = buildWeddingServicesFromStorage();
        const localPlans = localPlanServices.map((service, idx) => {
          const tpl = getWeddingPlanTemplate(service.title);
          const desc = service.description
            ? service.description.split(/\s+·\s+|\n/).map((line) => line.trim()).filter(Boolean)
            : (tpl?.includedItems || ['사회 진행']);
          return {
            id: tpl?.planKey || `wedding-local-${idx}`,
            label: tpl?.label || service.title,
            price: typeof service.basePrice === 'number' ? service.basePrice : 0,
            duration: tpl?.description || '',
            title: tpl?.description || service.title,
            desc,
            workDays: 14,
            revisions: idx + 1,
          };
        });

        setPro({
          id: 'my-pro',
          name,
          profileImage: allImages[mainPhotoIndex] || allImages[0],
          mainImage: allImages[0],
          images: allImages,
          title: `사회자 ${name}`,
          categoryName: '사회자',
          tags: myProTags,
          career,
          isPrime: true,
          showPartnersLogo: localCompanyLogos.length > 0,
          companyLogos: localCompanyLogos,
          youtubeId: ytId,
          youtubeVideos: ytIds.map((id, i) => ({ id, title: `${name} 사회자 진행 영상 ${i + 1}` })),
          uploadedVideos: localUploadedVideos,
          faqs: localFaqs,
          rating: 5.0,
          reviewCount: 0,
          plans: localPlans,
          description: fallbackDescription,
          hasDescriptionContent,
          descriptionHtml: hasDescriptionContent ? buildDescriptionHtml(detailHtml, '') : '',
          expertStats: {
            totalDeals: careerYears * 8 + 10,
            satisfaction: 100,
            memberType: '기업',
            taxInvoice: '프리티풀 발행',
            responseTime: '1시간 이내',
            contactTime: '언제나 가능',
          },
          reviews: [],
          recommendedPros: [],
          alsoViewed: [],
        });
        setApiLoading(false);
        return;
      } catch {
        setApiError(true);
        setApiLoading(false);
        return;
      }
    }

    // API에서 실제 데이터 로드. 상세 본문을 추천 목록보다 먼저 보여 체감 진입 속도를 높인다.
    // 본인 프로 페이지면 항상 최신 데이터 로드 (캐시 스킵)
    const myProId = typeof window !== 'undefined' ? localStorage.getItem('freetiful-my-pro-id') : null;
    const skipCache = myProId === id;
    const effectivePlanTemplates = WEDDING_PLAN_TEMPLATES;
    const cachedDetail = !skipCache ? getCachedProDetail(id) : null;
    const cachedPreview = !skipCache ? getCachedProPreview(id) : null;
    if (cachedDetail) {
      try {
        setPro(mapApiProDetail(cachedDetail, effectivePlanTemplates));
        setApiLoading(false);
      } catch {}
    } else if (cachedPreview) {
      setPro(mapListProPreview(cachedPreview, effectivePlanTemplates));
      setApiLoading(false);
    }

    let cancelled = false;
    const hasFallbackData = Boolean(cachedDetail || cachedPreview);
    discoveryApi.getProDetail(id, skipCache)
      .then((res: any) => {
        if (cancelled) return;
        if (!res) {
          // 캐시/프리뷰로 이미 표시 중인 데이터가 있으면 화면을 비우지 않는다
          if (!hasFallbackData) setApiError(true);
          return;
        }
        try {
          setPro(mapApiProDetail(res, effectivePlanTemplates));
          const loadRecommendations = () => {
            discoveryApi.getProList({ limit: 9, sort: 'rating', withTotal: false })
              .then((proListRes: any) => {
                if (cancelled) return;
                const recommended = mapRecommendedPros(proListRes?.data || [], res.id);
                setPro((current) => current
                  ? {
                      ...current,
                      recommendedPros: recommended,
                      alsoViewed: mapRecommendedProsToAlsoViewed(recommended),
                    }
                  : current);
              })
              .catch(() => {});
          };
          runWhenIdle(loadRecommendations, 300);
        } catch (mapErr) {
          console.error('ProDetail mapping error:', mapErr);
          if (!hasFallbackData) setApiError(true);
        }
      })
      .catch((err) => {
        console.error('ProDetail load error:', err);
        if (!hasFallbackData) setApiError(true);
      })
      .finally(() => { if (!cancelled) setApiLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  // 상세 API/목록 캐시에 수치만 남아 있는 경우를 막기 위해 리뷰 전용 API로 실제 리뷰와 건수를 동기화한다.
  useEffect(() => {
    const proId = pro?.id;
    if (!proId || proId === 'my-pro') return;
    let cancelled = false;
    reviewApi.getByPro(proId, { limit: 100 })
      .then((payload: any) => {
        if (cancelled) return;
        const rows = getReviewRows(payload);
        const total = getReviewTotal(payload, rows);
        setPro((current) => {
          if (!current || current.id !== proId) return current;
          const mappedReviews = rows.map(mapApiReviewToDetail);
          const hasDetailReviewsOrMetrics = current.reviews.length > 0 || current.reviewCount > 0 || current.rating > 0;
          const nextReviews = mergeDetailReviews(mappedReviews, current.reviews);
          const nextTotal = Math.max(
            total,
            nextReviews.length,
            hasDetailReviewsOrMetrics ? current.reviewCount || current.reviews.length : 0,
          );
          const nextRating = nextTotal > 0 ? current.rating : 0;
          return {
            ...current,
            rating: nextRating,
            reviewCount: nextTotal,
            reviews: nextReviews,
            expertStats: {
              ...current.expertStats,
              totalDeals: nextTotal,
              satisfaction: nextRating ? Math.round((nextRating / 5) * 100) : 0,
            },
          };
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pro?.id]);

  const [activeImage, setActiveImage] = useState(0);
  // PC 우측 스택 캐러셀 — 모바일 캐러셀(activeImage)은 스크롤로 움직이므로 상태를 분리한다
  const [deskImage, setDeskImage] = useState(0);
  const [deskPaused, setDeskPaused] = useState(false);
  const [activeSection, setActiveSection] = useState<'desc' | 'info' | 'reviews'>('desc');

  // PC 제목 옆 영상 스택
  const [deskVideo, setDeskVideo] = useState(0);
  const [deskVideoPaused, setDeskVideoPaused] = useState(false);

  // PC 스택 캐러셀 3초 자동 넘김 (마우스 올리면 멈춤)
  const deskImageCount = pro?.images?.length ?? 0;
  useEffect(() => {
    if (deskPaused || deskImageCount < 2) return;
    const t = setInterval(() => setDeskImage((i) => (i + 1) % deskImageCount), 3000);
    return () => clearInterval(t);
  }, [deskPaused, deskImageCount]);

  // 영상이 여러 개면 순환 — 영상은 충분히 볼 시간이 필요해 20초
  const deskVideoCount =
    (pro?.uploadedVideos?.length ?? 0) + (pro?.youtubeVideos?.length ?? 0);
  useEffect(() => {
    if (deskVideoPaused || deskVideoCount < 2) return;
    const t = setInterval(() => setDeskVideo((i) => (i + 1) % deskVideoCount), 20000);
    return () => clearInterval(t);
  }, [deskVideoPaused, deskVideoCount]);
  const [headerSolid, setHeaderSolid] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const authUser = useAuthStore((s) => s.user);

  const [openingChat, setOpeningChat] = useState(false);
  /** 홈 미리보기 iframe 안인지 — 바깥에 닫기 버튼이 이미 있다 */
  const [inFrame, setInFrame] = useState(false);
  useEffect(() => {
    try { setInFrame(window.self !== window.top); } catch { setInFrame(true); }
  }, []);
  const [confirmInquiryOpen, setConfirmInquiryOpen] = useState(false);
  const [inquiryLocation, setInquiryLocation] = useState('');
  const [inquiryDate, setInquiryDate] = useState('');
  const [inquiryTime, setInquiryTime] = useState('');
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);
  const [imageModal, setImageModal] = useState<string | null>(null);
  // 서비스 설명 본문(dangerouslySetInnerHTML)의 <img> 클릭 시 확대 모달 — 이벤트 위임.
  const zoomOnImgClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.tagName === 'IMG' && !t.closest('a')) {
      const src = (t as HTMLImageElement).currentSrc || (t as HTMLImageElement).src;
      if (src) setImageModal(src);
    }
  };
  const [shareModal, setShareModal] = useState(false);
  const [reviewsModal, setReviewsModal] = useState(false);
  const [phoneModal, setPhoneModal] = useState(false);
  const [loginModal, setLoginModal] = useState(false);
  const [reviewMenu, setReviewMenu] = useState<string | null>(null);
  const [playingVideos, setPlayingVideos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (authUser) setLoginModal(false);
  }, [authUser]);

  useEffect(() => {
    if (!confirmInquiryOpen) return;
    setInquiryLocation('');
    setInquiryDate('');
    setInquiryTime('');
  }, [confirmInquiryOpen, pro?.id]);

  const descRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);

  const galleryRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  // 방문 기록 저장
  useEffect(() => {
    try {
      const key = 'viewed-pros';
      const stored = JSON.parse(localStorage.getItem(key) || '[]') as { id: string; time: number }[];
      const filtered = stored.filter((v) => v.id !== id);
      filtered.unshift({ id, time: Date.now() });
      localStorage.setItem(key, JSON.stringify(filtered.slice(0, 20)));
    } catch {}
  }, [id]);

  // Active section auto-tracking on scroll + header solid bg
  useEffect(() => {
    const sections: Array<{ id: 'desc' | 'info' | 'reviews'; ref: React.RefObject<HTMLDivElement> }> = [
      ...(pro?.hasDescriptionContent ? [{ id: 'desc' as const, ref: descRef }] : []),
      { id: 'info', ref: infoRef },
      { id: 'reviews', ref: reviewsRef },
    ];
    let ticking = false;
    let rafId = 0;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      rafId = requestAnimationFrame(() => {
        const nextScrollY = window.scrollY + 120;
        let current: 'desc' | 'info' | 'reviews' = sections[0]?.id || 'info';
        sections.forEach(({ id, ref }) => {
          if (ref.current && ref.current.offsetTop <= nextScrollY) current = id;
        });
        setActiveSection(current);
        setScrollY(window.scrollY);
        // Solid header when gallery's bottom passes the top of viewport
        if (galleryRef.current) {
          const galleryBottom = galleryRef.current.offsetTop + galleryRef.current.offsetHeight;
          setHeaderSolid(window.scrollY > galleryBottom - 60);
        }
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [pro?.hasDescriptionContent]);

  useEffect(() => {
    if (pro && !pro.hasDescriptionContent && activeSection === 'desc') {
      setActiveSection('info');
    }
  }, [activeSection, pro?.hasDescriptionContent]);

  // Body scroll lock when modals open
  useEffect(() => {
    const anyModal = imageModal || shareModal || reviewsModal || phoneModal || confirmInquiryOpen;
    if (anyModal) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [imageModal, shareModal, reviewsModal, phoneModal, confirmInquiryOpen]);

  // Handlers
  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: pro?.title || '', url: window.location.href });
      } catch {
        setShareModal(true);
      }
    } else {
      setShareModal(true);
    }
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      toast.success('링크가 복사되었습니다');
      setShareModal(false);
    }
  };

  const handleInquiry = () => {
    if (!pro) return;
    if (!authUser) {
      rememberAuthReturnTo();
      if (requestNativeLoginSheet({ reason: 'pro-detail-chat' })) {
        setLoginModal(false);
        return;
      }
      setLoginModal(true);
      return;
    }
    if ((pro.userId && pro.userId === authUser.id) || pro.id === 'my-pro') {
      toast('본인 프로필에는 문의할 수 없어요');
      return;
    }
    setConfirmInquiryOpen(true);
  };

  const submitInquiryRequest = async (override?: { location: string; date: string; time: string }): Promise<string> => {
    if (!pro || !authUser || openingChat) return 'fail:준비 중입니다. 잠시 후 다시 시도해주세요.';
    const trimmedLocation = (override?.location ?? inquiryLocation).trim();
    const eventDate = override?.date ?? inquiryDate;
    const eventTime = override?.time ?? inquiryTime;
    if (!trimmedLocation || !eventDate || !eventTime) {
      toast.error('행사 장소와 일시를 입력해주세요.');
      return 'fail:행사 장소와 일시를 입력해주세요.';
    }
    setOpeningChat(true);
    try {
      const categoryName = pro.categoryName || '사회자';
      await matchApi.createRequest({
        categoryId: categoryName,
        eventDate: eventDate,
        eventTime: eventTime,
        eventLocation: trimmedLocation,
        type: 'single',
        selectedProProfileIds: [pro.id],
        rawUserInput: {
          source: 'pro_detail_inquiry',
          categoryName,
          eventType: `${categoryName} 문의`,
          eventName: `${categoryName} 문의`,
          location: trimmedLocation,
          date: eventDate,
          timeStart: eventTime,
          targetScope: 'single',
          requestKind: 'single',
          note: '사회자 상세페이지에서 보낸 문의 요청입니다.',
          targetProProfileId: pro.id,
          targetProName: pro.name,
        },
      });
      setConfirmInquiryOpen(false);
      toast.success('문의요청이 완료되었습니다.');
      window.dispatchEvent(new Event('freetiful:match-requests-changed'));
      return 'ok';
    } catch (error: any) {
      if (error?.response?.status === 401) {
        rememberAuthReturnTo();
        if (!requestNativeLoginSheet({ reason: 'pro-detail-inquiry' })) setLoginModal(true);
        return 'fail:로그인이 필요합니다.';
      }
      const msg = error?.response?.data?.message || '문의요청에 실패했습니다. 잠시 후 다시 시도해주세요.';
      toast.error(msg);
      return 'fail:' + msg;
    } finally {
      setOpeningChat(false);
    }
  };

  // 네이티브 상세의 문의 CTA가 호출 (웹 문의 핸들러 트리거)
  useEffect(() => {
    (window as any).__freetifulProInquiry = () => { try { handleInquiry(); } catch {} };
    // 네이티브 즉시 전송 (확인 모달이 네이티브 오버레이 뒤라 안 보임 → 기본값으로 바로 문의 생성, 세부는 채팅서 협의)
    (window as any).__freetifulProInquirySend = () => {
      try {
        if (!authUser) { handleInquiry(); return false; }
        if ((pro?.userId && pro.userId === authUser.id) || pro?.id === 'my-pro') return false;
        const d = new Date(); d.setDate(d.getDate() + 14);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        submitInquiryRequest({ location: '추후 협의', date: dateStr, time: '협의' });
        return true;
      } catch { return false; }
    };
    // 네이티브 v3 — 입력 폼 제출 (로그인: createRequest / 비로그인: quickRequest 자동 회원화+로그인)
    (window as any).__freetifulProInquiryState = () => ({
      loggedIn: !!authUser,
      proName: pro?.name || '',
    });
    (window as any).__freetifulProInquirySubmit = async (payload: any) => {
      try {
        if (!pro) return 'fail:페이지 준비 중입니다.';
        if ((pro?.userId && authUser && pro.userId === authUser.id) || pro?.id === 'my-pro') return 'fail:본인 프로필에는 문의할 수 없습니다.';
        const date = String(payload?.date || '').trim();
        const time = String(payload?.time || '협의').trim() || '협의';
        const part = String(payload?.part || '').trim();
        const location = String(payload?.location || '').trim() || '추후 협의';
        const categoryName = pro.categoryName || '사회자';
        const rawUserInput = {
          source: 'pro_detail_inquiry_form',
          categoryName,
          eventType: `${categoryName} 문의`,
          eventName: `${categoryName} 문의`,
          location,
          date,
          timeStart: time,
          eventPart: part,
          targetScope: 'single',
          requestKind: 'single',
          note: part ? `${part} 행사 문의입니다.` : '사회자 상세페이지에서 보낸 문의 요청입니다.',
          targetProProfileId: pro.id,
          targetProName: pro.name,
        };
        if (authUser) {
          await matchApi.createRequest({
            categoryId: categoryName,
            eventDate: date || undefined,
            eventTime: time,
            eventLocation: location,
            type: 'single',
            selectedProProfileIds: [pro.id],
            rawUserInput,
          });
          window.dispatchEvent(new Event('freetiful:match-requests-changed'));
          return 'ok';
        }
        // 비로그인 — 간이 회원가입 + 문의 + 자동 로그인 유지
        const name = String(payload?.name || '').trim();
        const phone = String(payload?.phone || '').replace(/\D/g, '');
        if (!name) return 'fail:이름을 입력해주세요.';
        if (phone.length < 9) return 'fail:올바른 전화번호를 입력해주세요.';
        const res: any = await matchApi.quickRequest({
          name,
          phone,
          categoryId: categoryName,
          eventDate: date || undefined,
          eventTime: time,
          eventLocation: location,
          type: 'single',
          selectedProProfileIds: [pro.id],
          rawUserInput,
        });
        if (res?.accessToken && res?.refreshToken && res?.user) {
          const { useAuthStore } = await import('@/lib/store/auth.store');
          useAuthStore.getState().setAuth(res.user, res.accessToken, res.refreshToken);
        }
        window.dispatchEvent(new Event('freetiful:match-requests-changed'));
        return 'ok:signed';
      } catch (e: any) {
        return 'fail:' + (e?.response?.data?.message || e?.message || '문의 전송에 실패했습니다.');
      }
    };
    // 네이티브 v2 — 실제 API 결과('ok'|'fail:사유'|'login') 를 반환 (성공 가장 토스트 버그 수정)
    (window as any).__freetifulProInquirySendAsync = async () => {
      try {
        if (!authUser) { handleInquiry(); return 'login'; }
        if ((pro?.userId && pro.userId === authUser.id) || pro?.id === 'my-pro') return 'fail:본인 프로필에는 문의할 수 없습니다.';
        const d = new Date(); d.setDate(d.getDate() + 14);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return await submitInquiryRequest({ location: '추후 협의', date: dateStr, time: '협의' });
      } catch (e: any) { return 'fail:' + (e?.message || '오류가 발생했습니다.'); }
    };
    return () => {
      try { delete (window as any).__freetifulProInquiry; } catch {}
      try { delete (window as any).__freetifulProInquirySend; } catch {}
      try { delete (window as any).__freetifulProInquirySendAsync; } catch {}
      try { delete (window as any).__freetifulProInquiryState; } catch {}
      try { delete (window as any).__freetifulProInquirySubmit; } catch {}
    };
  });

  const scrollToSection = (section: 'desc' | 'info' | 'reviews') => {
    setActiveSection(section);
    const target = section === 'desc' ? descRef.current : section === 'info' ? infoRef.current : reviewsRef.current;
    if (target) {
      const y = target.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const scrollToDesktopSection = (section: 'desc' | 'info' | 'reviews') => {
    setActiveSection(section);
    const target = document.getElementById(`desktop-${section}`);
    if (target) {
      const y = target.getBoundingClientRect().top + window.scrollY - 176;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // Error state: 사회자를 찾을 수 없습니다
  // 캐시/프리뷰에서라도 pro 가 들어왔다면 에러 화면이 덮지 않도록 보호한다
  if (apiError && !pro) {
    return (
      <div className="bg-white min-h-screen flex flex-col items-center justify-center" style={{ letterSpacing: '-0.02em' }}>
        <div className="text-center px-6">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <ChevronLeft size={28} className="text-gray-400" />
          </div>
          <h2 className="text-[20px] font-bold text-gray-900 mb-2">사회자를 찾을 수 없습니다</h2>
          <p className="text-[14px] text-gray-500 mb-6">요청하신 사회자 정보를 불러올 수 없습니다.<br />다시 시도해 주세요.</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-[#3180F7] text-white font-semibold rounded-xl active:scale-95 transition-transform"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (apiLoading || !pro) {
    return (
      <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
        {/* Gallery skeleton */}
        <div className="skeleton" style={{ width: '100%', aspectRatio: '1/1', borderRadius: 0 }} />
        {/* Info skeleton */}
        <div className="px-4 pt-4">
          <div className="skeleton mb-2" style={{ width: 60, height: 20, borderRadius: 10 }} />
          <div className="skeleton mb-2" style={{ width: '80%', height: 22 }} />
          <div className="skeleton mb-3" style={{ width: '50%', height: 14 }} />
          <div className="skeleton mb-2" style={{ width: '60%', height: 28 }} />
          <div className="flex gap-2 mt-4 mb-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ width: 70, height: 32, borderRadius: 16 }} />
            ))}
          </div>
          <div className="skeleton mb-2" style={{ width: '100%', height: 100 }} />
          <div className="skeleton mb-2" style={{ width: '100%', height: 100 }} />
        </div>
      </div>
    );
  }

  const displayReviews = pro.reviews.length > 0
    ? pro.reviews
    : buildReviewFallbacks({ id: pro.id, reviewCount: pro.reviewCount, rating: pro.rating });
  const displayReviewCount = Math.max(pro.reviewCount, displayReviews.length);
  const hasDescriptionContent = Boolean(pro.hasDescriptionContent && pro.descriptionHtml?.trim());
  const detailSectionTabs: Array<{ id: 'desc' | 'info' | 'reviews'; label: string }> = [
    ...(hasDescriptionContent ? [{ id: 'desc' as const, label: '서비스 설명' }] : []),
    { id: 'info', label: '사회자 정보' },
    { id: 'reviews', label: `리뷰 (${displayReviewCount})` },
  ];
  const activeSectionIndex = Math.max(0, detailSectionTabs.findIndex((tab) => tab.id === activeSection));
  const reviewKeywords = buildReviewKeywords(displayReviews);
  const displayFaqs = pro.faqs.length > 0 ? pro.faqs : [
    {
      question: `${pro.categoryName || '사회자'} 섭외는 어떻게 진행되나요?`,
      answer: '문의하기로 장소와 행사 성격을 알려주시면 사회자가 가능 여부와 견적을 확인해 답변드립니다. 이후 결제와 사전 미팅을 통해 진행 방향을 조율합니다.',
    },
    {
      question: '행사 전 준비 자료는 언제 전달하면 되나요?',
      answer: '행사 개요, 식순, 요청 멘트, 참고 대본이 있다면 전달해 주세요. 결혼식은 보통 본식 한 달 전후로 사전 질문지를 기반으로 대본을 맞춰갑니다.',
    },
    {
      question: '진행 영상이나 포트폴리오는 어디에서 볼 수 있나요?',
      answer: pro.youtubeVideos.length > 0
        ? '상세페이지의 영상 섹션에서 대표 진행 영상을 확인할 수 있습니다.'
      : '등록된 영상이 없는 경우 문의하기로 참고 포트폴리오를 요청할 수 있습니다.',
    },
  ];
  const displayAlsoViewed = pro.alsoViewed.length > 0
    ? pro.alsoViewed
    : mapRecommendedProsToAlsoViewed(pro.recommendedPros);
  const hasReviewMetricOnly = displayReviewCount > 0 && displayReviews.length === 0;
  const metricOnlyReviewMessage = '상세 후기 본문은 아직 등록되지 않았습니다. 등록된 평점과 리뷰 수를 기준으로 표시합니다.';
  const aiReviewSummary = displayReviews.length > 0 ? buildAiReviewSummary(pro, displayReviews) : null;

  return (
    <div className="bg-white lg:bg-white" style={{ letterSpacing: '-0.02em' }}>
      <div className="hidden lg:block min-h-screen bg-white pb-24">
        <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
          <div className="mx-auto flex h-[58px] max-w-[1180px] items-center gap-7 px-8">
            <Link href="/main" className="flex items-center">
              <img src="/images/logo-freetiful-wordmark.svg" alt="Freetiful" className="h-7 w-auto" />
            </Link>
            {/* 실제 입력 가능한 검색창 — 예전엔 span 으로 흉내만 낸 장식이라 클릭·입력이 안 됐다 */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const q = headerQuery.trim();
                router.push(q ? `/pros?q=${encodeURIComponent(q)}` : '/pros');
              }}
              className="flex h-11 flex-1 max-w-[520px] items-center rounded-full border border-gray-300 px-5 shadow-sm focus-within:border-[#3180F7]"
            >
              <input
                value={headerQuery}
                onChange={(e) => setHeaderQuery(e.target.value)}
                placeholder="어떤 사회자가 필요하세요?"
                aria-label="사회자 검색"
                className="flex-1 bg-transparent text-[14px] text-gray-900 outline-none placeholder:text-gray-400"
              />
              <button type="submit" aria-label="검색" className="ml-2 shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2.3" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
              </button>
            </form>
            <nav className="ml-auto flex items-center gap-6 text-[14px] font-semibold text-gray-900">
              <Link href="/biz">엔터프라이즈</Link>
              <Link href="/pro-register/terms">사회자 등록</Link>
              <button type="button" onClick={() => setLoginModal(true)}>로그인</button>
            </nav>
          </div>
          <div className="border-t border-gray-100">
            <nav className="mx-auto flex h-[50px] max-w-[1180px] items-center gap-1.5 px-8 text-[14px] font-semibold text-gray-900" aria-label="사회자 카테고리">
              {PC_DETAIL_CATEGORY_MENUS.map((menu) => (
                <div key={menu.label} className="home-desktop-category-menu group relative">
                  <Link
                    href={menu.href}
                    className={`flex items-center gap-1 rounded-xl px-3 py-2 transition-all duration-200 hover:bg-gray-50 hover:text-gray-950 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3180F7]/25 ${
                      menu.highlight ? 'text-[#3180F7]' : 'text-gray-900'
                    }`}
                  >
                    <span className="whitespace-nowrap">{menu.label}</span>
                    <ChevronDown size={14} className="home-desktop-category-chevron text-gray-400 transition-transform duration-200 group-hover:rotate-180 group-hover:text-gray-700" />
                  </Link>
                  <div className="home-desktop-category-dropdown pointer-events-none absolute left-1/2 top-full z-40 mt-1.5 w-[190px] -translate-x-1/2 translate-y-1 rounded-2xl p-1.5 text-left opacity-0 transition-all duration-200">
                    {menu.items.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        className="block rounded-xl px-3 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-950 focus-visible:bg-gray-50 focus-visible:outline-none"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-[1180px] px-8 pt-8">
          <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-10">
            <div>
              {/* 제목 + (영상 있으면) 우측 16:9 스택 캐러셀 */}
              {(() => {
                // 업로드 영상 먼저, 그 뒤 유튜브
                const vids: Array<{ kind: 'upload' | 'yt'; src: string; title: string }> = [
                  ...(pro.uploadedVideos || []).map((v) => ({ kind: 'upload' as const, src: v.url, title: v.title })),
                  ...(pro.youtubeVideos || []).map((v) => ({ kind: 'yt' as const, src: v.id, title: v.title })),
                ];
                const vn = vids.length;
                const titleBlock = (
                  <>
                    <p className="mb-1.5 text-[13px] text-gray-500">
                      사회자 찾기 &gt; {pro.categoryName || '사회자'} &gt; {pro.name}
                    </p>
                    <h1 className="max-w-[780px] text-[34px] font-bold leading-tight text-gray-950">{pro.title}</h1>
                    <div className="mt-3 flex items-center gap-2">
                      <StarRating value={parseFloat(pro.rating.toFixed(1))} size={16} />
                      <span className="text-[15px] font-bold text-gray-950">{pro.rating.toFixed(1)}</span>
                      <span className="text-[14px] text-gray-500">({displayReviewCount})</span>
                    </div>
                  </>
                );
                if (vn === 0) return titleBlock;
                return (
                  // 행이 컬럼 맨 위에 오므로 영상 top 이 우측 프로필 사진 top 과 같아진다.
                  // items-center — 경로+제목 덩어리가 영상 세로 가운데에 놓인다.
                  // pt-7 = 우측 사진 카드의 겹침 여백과 같은 값 → 영상 top 이 사진 top 과 정확히 맞는다
                  <div className="flex items-center gap-6 pt-7">
                    <div className="min-w-0 flex-1">{titleBlock}</div>
                    {/* pr-7 = 뒤 카드가 오른쪽으로 삐져나올 자리 (사진은 위로, 영상은 옆으로) */}
                    <div
                      className="relative w-[400px] shrink-0 pr-7"
                      onMouseEnter={() => setDeskVideoPaused(true)}
                      onMouseLeave={() => setDeskVideoPaused(false)}
                    >
                      <div className="relative aspect-video w-full">
                        {vids.map((v, i) => {
                          const pos = (i - deskVideo + vn) % vn;
                          const front = pos === 0;
                          const behind = pos === 1 && vn > 1;
                          return (
                            <div
                              key={`${v.kind}-${v.src}-${i}`}
                              className="absolute inset-0 overflow-hidden rounded-[48px] bg-black shadow-sm transition-all duration-[650ms]"
                              style={{
                                transform: front
                                  ? 'scale(1) translateX(0)'
                                  : behind
                                    ? 'scale(0.93) translateX(30px)'
                                    : 'scale(0.88) translateX(44px)',
                                opacity: front || behind ? 1 : 0,
                                zIndex: front ? 20 : behind ? 10 : 0,
                                transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                                pointerEvents: front ? 'auto' : 'none',
                              }}
                            >
                              {v.kind === 'upload' ? (
                                <video
                                  src={v.src}
                                  autoPlay={front}
                                  muted
                                  loop
                                  playsInline
                                  preload="metadata"
                                  controls={front}
                                  className="absolute inset-0 h-full w-full object-cover"
                                />
                              ) : (
                                <iframe
                                  src={`https://www.youtube.com/embed/${v.src}?autoplay=${front ? 1 : 0}&mute=1&loop=1&playlist=${v.src}&playsinline=1&rel=0&modestbranding=1`}
                                  title={v.title}
                                  allow="autoplay; encrypted-media; picture-in-picture"
                                  allowFullScreen
                                  className="absolute inset-0 h-full w-full"
                                />
                              )}
                              {behind && <span className="absolute inset-0 bg-black/30" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 주요 경력 — 모바일과 같은 흰 카드 토큰(#EEF0F4 보더 + 진회색 텍스트) */}
              {pro.career && pro.career.trim().length > 0 && (
                <div
                  className="mt-6 max-w-[780px]"
                  /* NaturalReveal 이 'main ul > li' 를 잡아 animation 을 덮어쓰는 영역 → 제외 유지 */
                  data-no-natural-reveal
                >
                  <CareerSweepList size="lg" lines={pro.career.split(/\n|\//).map((l) => l.trim()).filter(Boolean).slice(0, 6)} />
                </div>
              )}

              <div className="pt-12">
                <div className="mb-11">
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-[21px] font-bold text-gray-950">최근 받은 리뷰</h2>
                    {displayReviewCount > 0 && <button onClick={() => router.push(`/pros/${pro.id}/reviews`)} className="text-[13px] font-semibold text-gray-700">전체보기</button>}
                  </div>
                  <div className="relative overflow-hidden rounded-lg">
                    {displayReviews.length > 0 ? (
                      <div className="grid grid-cols-[286px_minmax(0,1fr)] gap-3">
                        <div className="relative flex h-[164px] flex-col overflow-hidden rounded-2xl border border-[#EEF0F4] bg-white p-5 shadow-[0_1px_4px_rgba(15,23,42,0.06)]" style={{ borderLeft: `3px solid ${BRAND}` }}>
                          <div className="relative z-10 flex items-center gap-2">
                            <span className="ai-review-summary-icon flex h-6 w-6 items-center justify-center">
                              <img src="/icons/pro-detail/sparkle.svg" alt="" width={20} height={20} />
                            </span>
                            <div>
                              <p className="text-[12px] font-bold text-[#3180F7]">AI 리뷰 요약</p>
                              <p className="mt-0.5 text-[11px] font-medium text-[#8B95A1]">
                                고객 리뷰를 분석해 작성했어요
                                <span className="ai-review-thinking-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>
                              </p>
                            </div>
                          </div>
                          <p className="ai-review-summary-copy relative z-10 mt-3 line-clamp-2 text-[14px] leading-relaxed text-[#4E5968]">
                            {aiReviewSummary?.text}
                            <span className="ai-review-summary-cursor" aria-hidden="true" />
                          </p>
                          <div className="relative z-10 mt-auto flex flex-wrap gap-1 pt-2">
                            {aiReviewSummary?.keywords.map((keyword) => (
                              <span key={keyword} className="rounded-full bg-[#F2F4F6] px-2 py-1 text-[11px] font-semibold text-[#4E5968]">
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="recent-reviews-carousel-frame relative overflow-hidden rounded-lg">
                          <div className="recent-reviews-carousel flex w-max">
                            {[0, 1].map((loop) => (
                              <div key={`review-carousel-${loop}`} className="flex shrink-0 gap-3 pr-3">
                                {displayReviews.slice(0, 5).map((review) => (
                                  <div key={`${review.id}-${loop}`} className="h-[164px] w-[286px] shrink-0 rounded-lg bg-gray-50 p-5">
                                    <div className="flex items-center gap-2">
                                      <StarRating value={review.rating} size={14} />
                                      <span className="text-[14px] font-bold text-gray-950">{review.rating.toFixed(1)}</span>
                                      <span className="text-[12px] text-gray-400">{review.date}</span>
                                    </div>
                                    {(review as typeof review & { scores?: Record<string, number> }).scores && (
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {Object.entries((review as typeof review & { scores: Record<string, number> }).scores).slice(0, 3).map(([key, val]) => (
                                          <span key={key} className="flex items-center rounded-[5px] bg-white px-1.5 text-[10px] font-medium text-gray-600" style={{ height: 20 }}>
                                            {key} <span className="ml-1 font-bold text-[#3180F7]">{val}</span>
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-gray-800">{review.content}</p>
                                    <p className="mt-2 text-[12px] font-semibold text-gray-500">{review.name}</p>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : hasReviewMetricOnly ? (
                      <div className="rounded-lg bg-gray-50 p-5">
                        <div className="flex items-center gap-2">
                          <StarRating value={parseFloat(pro.rating.toFixed(1))} size={14} />
                          <span className="text-[14px] font-bold text-gray-950">{pro.rating.toFixed(1)}</span>
                          <span className="text-[13px] text-gray-400">({displayReviewCount})</span>
                        </div>
                        <p className="mt-3 text-[14px] leading-relaxed text-gray-600">{metricOnlyReviewMessage}</p>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-gray-50 p-5 text-[14px] leading-relaxed text-gray-500">
                        아직 표시할 리뷰가 없습니다. 리뷰가 등록되면 이곳에 바로 보여집니다.
                      </div>
                    )}
                  </div>
                </div>

                <div className="sticky top-[108px] z-40 mb-10 flex border-b border-gray-200 bg-white">
                  {detailSectionTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => scrollToDesktopSection(tab.id as 'desc' | 'info' | 'reviews')}
                      className={`mr-7 h-12 border-b-2 text-[15px] font-bold ${activeSection === tab.id ? 'border-gray-950 text-gray-950' : 'border-transparent text-gray-500'}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {hasDescriptionContent && (
                  <section id="desktop-desc" className="mb-9 rounded-lg border border-gray-200 p-6">
                    <div className="space-y-5">
                      <h3 className="text-[19px] font-bold text-gray-950">사회자 소개</h3>
                      {/* 모바일 본문과 동일한 리치텍스트 유틸 — 없으면 preflight 때문에 문단 여백·불릿이 사라진다 */}
                      <div className="pro-detail-html text-[15px] leading-[1.85] text-gray-800 [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-xl [&_img]:cursor-zoom-in [&_a]:text-[#3180F7] [&_a]:underline [&_p]:mb-4 [&_strong]:font-bold [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1.5 [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-[#3180F7]/30 [&_blockquote]:pl-4 [&_blockquote]:text-gray-600 [&_h1]:mb-3 [&_h1]:text-[22px] [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:text-[19px] [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:text-[17px] [&_h3]:font-bold" onClick={zoomOnImgClick} dangerouslySetInnerHTML={{ __html: pro.descriptionHtml || '' }} />
                    </div>
                  </section>
                )}

                <section className="mb-9 rounded-lg border border-gray-200 p-6">
                  <div className="space-y-5">
                    <h3 className="text-[19px] font-bold text-gray-950">영상</h3>
                    <div>
                      {pro.youtubeVideos.length > 0 || pro.uploadedVideos.length > 0 ? (
                        <div className="grid grid-cols-2 gap-4">
                          {pro.youtubeVideos.map((video) => (
                            <div key={video.id}>
                              <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                                {playingVideos.has(video.id) ? (
                                  <iframe
                                    className="h-full w-full"
                                    src={`https://www.youtube.com/embed/${video.id}?autoplay=1&mute=1&modestbranding=1&rel=0&playsinline=1`}
                                    title={video.title}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setPlayingVideos((prev) => new Set(prev).add(video.id))}
                                    className="relative block h-full w-full"
                                    aria-label={`${video.title} 재생`}
                                  >
                                    <img src={`https://img.youtube.com/vi/${video.id}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" loading="lazy" />
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                                        <Play size={19} className="ml-0.5 fill-gray-950 text-gray-950" />
                                      </span>
                                    </span>
                                  </button>
                                )}
                              </div>
                              <p className="mt-2 line-clamp-1 text-[13px] font-semibold text-gray-700">{video.title}</p>
                            </div>
                          ))}
                          {pro.uploadedVideos.map((video) => (
                            <div key={video.url}>
                              <video
                                src={`${video.url}#t=0.1`}
                                controls
                                playsInline
                                preload="metadata"
                                className="w-full rounded-xl bg-black object-contain"
                                style={{ maxHeight: '70vh' }}
                              />
                              <p className="mt-2 line-clamp-1 text-[13px] font-semibold text-gray-700">{video.title}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-lg bg-gray-50 p-6 text-[14px] text-gray-500">등록된 진행 영상이 없습니다. 문의하기로 포트폴리오를 요청할 수 있어요.</div>
                      )}
                    </div>
                  </div>
                </section>

                <section id="desktop-info" className="mb-9">
                  <h2 className="mb-6 text-[22px] font-bold text-gray-950">사회자 정보</h2>
                  <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-5">
                    <div className="rounded-lg border border-gray-200 p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-[17px] font-bold text-gray-950">고객이 자주 언급한 키워드</h3>
                      </div>
                      <ReviewKeywordCloud items={reviewKeywords} reviewCount={displayReviewCount} />
                    </div>
                    <div className="rounded-lg border border-gray-200 p-5">
                      <div className="flex items-center gap-3">
                        <img src={pro.profileImage} alt="" className="h-14 w-14 rounded-full object-cover" />
                        <div>
                          <p className="text-[16px] font-bold text-gray-950">{pro.name}</p>
                          <p className="mt-1 text-[13px] text-gray-500">{pro.categoryName || '사회자'} 사회자</p>
                        </div>
                      </div>
                      <div className="mt-5 space-y-3 text-[13px] text-gray-700">
                        <div className="flex justify-between gap-4"><span>연락 가능 시간</span><strong>{pro.expertStats.contactTime}</strong></div>
                        <div className="flex justify-between gap-4"><span>평균 응답 시간</span><strong>{pro.expertStats.responseTime}</strong></div>
                        <div className="flex justify-between gap-4"><span>파트너 인증</span><strong>{pro.isPrime ? '인증 완료' : '심사 완료'}</strong></div>
                      </div>
                    </div>
                  </div>

                </section>

                <section className="mb-9 rounded-lg border border-gray-200 p-6">
                  <div className="space-y-5">
                    <h3 className="text-[19px] font-bold text-gray-950">대상자</h3>
                    <ul className="space-y-3 text-[14px] text-gray-800">
                      {['전문 결혼식 사회자를 찾는 예비부부', '기업행사와 컨퍼런스 진행이 필요한 담당자', '현장 분위기에 맞춘 안정적인 진행을 원하는 고객', '검증된 사회자와 직접 소통하고 싶은 고객'].map((item) => (
                        <li key={item} className="flex items-start gap-3"><Check size={18} className="mt-0.5 text-gray-500" />{item}</li>
                      ))}
                    </ul>
                  </div>
                </section>

                <section className="mb-9">
                  <h2 className="mb-6 text-[22px] font-bold text-gray-950">사회자 이력</h2>
                  <div className="rounded-lg border border-gray-200 p-6">
                    {[
                      ['경력 사항', (pro.career && pro.career.trim()) || pro.description || `${pro.categoryName || '사회자'} ${pro.name} 사회자`],
                      ['보유 자격증', pro.isPrime ? '프리티풀 인증 사회자' : '프로필 심사 완료'],
                      ['학력 전공', pro.categoryName || '전문 진행'],
                    ].map(([title, body]) => (
                      <div key={title} className="mb-6 last:mb-0">
                        <p className="mb-3 text-[15px] font-bold text-gray-950">ㆍ {title}</p>
                        <div className="whitespace-pre-line rounded-lg bg-gray-50 p-5 text-[14px] leading-relaxed text-gray-700">{body}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="mb-9 rounded-lg border border-gray-200 p-6">
                  <div className="space-y-5">
                    <h3 className="text-[19px] font-bold text-gray-950">FAQ</h3>
                    <div className="divide-y divide-gray-100">
                      {displayFaqs.map((faq, index) => (
                        <details key={`${faq.question}-${index}`} className="group py-4 first:pt-0 last:pb-0">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-[15px] font-bold text-gray-950">
                            <span>Q. {faq.question}</span>
                            <ChevronDown size={18} className="shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
                          </summary>
                          <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-gray-700">A. {faq.answer}</p>
                        </details>
                      ))}
                    </div>
                  </div>
                </section>

                <section id="desktop-reviews" className="mb-9 rounded-lg border border-gray-200 p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <h3 className="text-[19px] font-bold text-gray-950">리뷰</h3>
                    <div className="flex items-center gap-2">
                      <StarRating value={parseFloat(pro.rating.toFixed(1))} size={14} />
                      <span className="text-[14px] font-bold">{pro.rating.toFixed(1)}</span>
                      <span className="text-[13px] text-gray-500">({displayReviewCount})</span>
                    </div>
                  </div>
                  <div className="space-y-5">
                    {hasReviewMetricOnly ? (
                      <div className="rounded-lg bg-gray-50 p-6">
                        <div className="mb-2 flex items-center gap-2">
                          <StarRating value={parseFloat(pro.rating.toFixed(1))} size={14} />
                          <span className="text-[14px] font-bold text-gray-950">{pro.rating.toFixed(1)}</span>
                          <span className="text-[13px] text-gray-400">({displayReviewCount})</span>
                        </div>
                        <p className="text-[14px] leading-relaxed text-gray-600">{metricOnlyReviewMessage}</p>
                      </div>
                    ) : displayReviews.length === 0 ? (
                      <p className="rounded-lg bg-gray-50 p-6 text-center text-[14px] text-gray-500">아직 표시할 리뷰가 없습니다</p>
                    ) : displayReviews.slice(0, 3).map((review) => (
                      <div key={review.id} className="border-b border-gray-100 pb-5 last:border-0 last:pb-0">
                        <div className="mb-2 flex items-center gap-2">
                          <StarRating value={review.rating} size={13} />
                          <span className="text-[13px] font-bold text-gray-950">{review.rating.toFixed(1)}</span>
                          <span className="text-[12px] text-gray-400">{review.date}</span>
                        </div>
                        {/* 항목별 점수(발성력·진행력 등) — 모바일에만 있던 걸 PC 에도 */}
                        {(review as typeof review & { scores?: Record<string, number> }).scores && (
                          <div className="mb-2 flex flex-wrap gap-1">
                            {Object.entries((review as typeof review & { scores: Record<string, number> }).scores).map(([key, val]) => (
                              <span key={key} className="flex items-center rounded-[5px] bg-gray-100 px-1.5 text-[10px] font-medium text-gray-600" style={{ height: 22 }}>
                                {key} <span className="ml-1 font-bold text-[#3180F7]">{val}</span>
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-[14px] leading-relaxed text-gray-800">{review.content}</p>
                        {review.photos && review.photos.length > 0 && (
                          <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
                            {review.photos.slice(0, 5).map((photo, index) => (
                              <img
                                key={`${review.id}-desktop-photo-${index}`}
                                src={photo}
                                alt=""
                                className="h-[76px] w-[76px] shrink-0 rounded-lg object-cover"
                                loading="lazy"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {displayReviewCount > 0 && (
                    <button onClick={() => router.push(`/pros/${pro.id}/reviews`)} className="mt-5 h-11 w-full rounded-lg border border-gray-200 text-[14px] font-bold text-gray-700 hover:bg-gray-50">
                      리뷰 전체보기
                    </button>
                  )}
                </section>

              </div>
            </div>

            <aside className="space-y-7">
              {/* 스택 캐러셀 — 앞 사진 뒤로 다음 사진이 살짝 작게 겹쳐 보이고,
                  3초마다 뒤 사진이 위로 올라오며 앞으로 나온다.
                  비율·라운드는 모바일 히어로와 동일(70:106 / 48px). */}
              {(() => {
                const imgs = pro.images.length > 0 ? pro.images : [pro.mainImage];
                const n = imgs.length;
                const go = (dir: number) => setDeskImage((i) => (i + dir + n) % n);
                return (
                  <div
                    className="relative pt-7"
                    onMouseEnter={() => setDeskPaused(true)}
                    onMouseLeave={() => setDeskPaused(false)}
                  >
                    <div className="relative aspect-[70/106] w-full">
                      {imgs.map((src, i) => {
                        const pos = (i - deskImage + n) % n;   // 0=앞, 1=바로 뒤
                        const front = pos === 0;
                        const behind = pos === 1 && n > 1;
                        return (
                          <button
                            key={`${src}-${i}`}
                            type="button"
                            aria-hidden={!front}
                            tabIndex={front ? 0 : -1}
                            onClick={() => front && setImageModal(src)}
                            className="absolute inset-0 block overflow-hidden rounded-[48px] border border-gray-200 bg-gray-100 shadow-sm transition-all duration-[650ms]"
                            style={{
                              // 뒤 카드는 조금 작게 + 위로 올라가 있어 앞 카드 위로 살짝 보인다
                              transform: front
                                ? 'scale(1) translateY(0)'
                                : behind
                                  ? 'scale(0.93) translateY(-26px)'
                                  : 'scale(0.88) translateY(-38px)',
                              opacity: front || behind ? 1 : 0,
                              zIndex: front ? 20 : behind ? 10 : 0,
                              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                              pointerEvents: front ? 'auto' : 'none',
                            }}
                          >
                            <Image
                              src={src}
                              alt={front ? pro.name : ''}
                              fill
                              className="object-cover"
                              sizes="360px"
                              priority={i === 0}
                            />
                            {behind && <span className="absolute inset-0 bg-black/25" />}
                          </button>
                        );
                      })}

                      {/* 하단 딤드 — 예전엔 이름·소개글이 있던 자리, 이제 좌우 버튼이 들어간다 */}
                      {n > 1 && (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center justify-between rounded-b-[48px] bg-gradient-to-t from-black/65 to-transparent px-5 pb-6 pt-12">
                          <button
                            type="button"
                            aria-label="이전 사진"
                            onClick={(e) => { e.stopPropagation(); go(-1); }}
                            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur-md transition hover:bg-white/40 active:scale-95"
                          >
                            <ChevronLeft size={22} strokeWidth={2.4} />
                          </button>

                          {/* 화살표 사이 가운데 — 배경 없이 글씨만 */}
                          <span className="text-[17px] font-bold tabular-nums text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)]">
                            {deskImage + 1} / {n}
                          </span>

                          <button
                            type="button"
                            aria-label="다음 사진"
                            onClick={(e) => { e.stopPropagation(); go(1); }}
                            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur-md transition hover:bg-white/40 active:scale-95"
                          >
                            <ChevronRight size={22} strokeWidth={2.4} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 감싸던 카드 박스를 없애고 버튼만 남겼다. 공유는 그 옆에 */}
              <div className="sticky top-[132px] flex items-center gap-2">
                <button
                  onClick={handleInquiry}
                  disabled={openingChat}
                  className="h-[58px] flex-1 rounded-lg bg-[#3180F7] text-[17px] font-bold text-white transition hover:bg-[#2470E6] disabled:opacity-60"
                >
                  {openingChat ? '요청 중...' : '이 사회자에게 문의하기'}
                </button>
                <button
                  onClick={handleShare}
                  aria-label="공유하기"
                  className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-lg bg-[#F2F3F5] text-[#51535C] transition hover:bg-[#E9EBEF]"
                >
                  <Share2 size={20} />
                </button>
              </div>
            </aside>
          </div>
        </main>
      </div>

      <div className="lg:hidden bg-white min-h-screen" style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 112px), 128px)' }}>
      {/* ─── Top Header (Floating → Solid with thumbnail on scroll) ─── */}
      <div
        data-native-back-header
        className={`fixed top-0 left-0 right-0 z-40 flex items-center gap-2 px-3 transition-all duration-300 ${
          /* 스크롤 시 아래 섹션 탭과 붙어 통짜로 보이도록 헤더 하단 보더는 두지 않는다 */
          headerSolid ? 'bg-white h-[60px] py-0' : 'justify-between pt-3 pb-3 px-4'
        }`}
      >
        {/* iframe(홈 미리보기) 안에서는 바깥 닫기 버튼과 겹쳐 어색하므로 숨긴다 */}
        {!inFrame && (
          <button
            onClick={() => router.back()}
            className={`flex items-center justify-center shrink-0 active:scale-90 transition-all ${
              headerSolid
                ? 'w-9 h-9 text-gray-900'
                : 'w-9 h-9 rounded-full bg-white/90 backdrop-blur-md shadow-sm'
            }`}
          >
            <ChevronLeft size={22} className="text-gray-900" />
          </button>
        )}

        {/* Scrolled state: Thumbnail + Title */}
        <div
          className={`flex-1 min-w-0 flex items-center gap-2.5 transition-all duration-300 ${
            headerSolid ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{
            transform: headerSolid ? 'translateY(0)' : 'translateY(6px)',
          }}
        >
          <img
            src={pro.images[0]}
            alt=""
            className="w-10 h-10 rounded-xl object-cover shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-gray-900 truncate leading-tight">
              {pro.title}
            </p>
          </div>
        </div>

        <div className={`flex items-center gap-2 shrink-0 ${headerSolid ? '' : 'ml-auto'}`}>
          <button
            onClick={handleShare}
            className={`flex items-center justify-center active:scale-90 transition-all ${
              headerSolid
                ? 'w-9 h-9 text-gray-900'
                : 'w-9 h-9 rounded-full bg-white/90 backdrop-blur-md shadow-sm'
            }`}
          >
            <Share2 size={18} className="text-gray-900" />
          </button>
        </div>
      </div>

      {/* ─── Hero Carousel — 네이티브 동일 (좌정렬 + peek + 스와이프 스케일) ─── */}
      <div className="pt-[74px] overflow-hidden">
        <div
          ref={galleryRef as any}
          onScroll={(e) => {
            const el = e.currentTarget as HTMLDivElement;
            const cardW = Math.min(el.clientWidth * 0.7, 420) + 12;
            const idx = Math.round(el.scrollLeft / cardW);
            const clamped = Math.max(0, Math.min(pro.images.length - 1, idx));
            if (clamped !== activeImage) setActiveImage(clamped);
          }}
          className="hero-snap flex gap-3 overflow-x-auto px-[18px]"
        >
          {pro.images.map((src, i) => (
            <button
              key={i}
              onClick={() => setImageModal(src)}
              className="relative shrink-0 snap-start overflow-hidden rounded-[44px] bg-white transition-transform duration-300 ease-out"
              style={{ width: 'min(70vw, 420px)', aspectRatio: '70 / 106', transform: `scale(${i === activeImage ? 1 : 0.9})` }}
            >
              {Math.abs(i - activeImage) <= 1 ? (
                <Image src={src} alt={pro.name} fill className="object-cover" priority={i === 0} sizes="70vw" />
              ) : (
                <div className="w-full h-full bg-white" />
              )}
            </button>
          ))}
        </div>
        {pro.images.length > 1 && (
          <div className="mt-3 flex justify-center gap-1.5">
            {pro.images.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  const el = galleryRef.current as HTMLDivElement | null;
                  if (el) el.scrollTo({ left: i * (Math.min(el.clientWidth * 0.7, 420) + 12), behavior: 'smooth' });
                }}
                className="rounded-full transition-colors duration-300"
                style={{ width: 6, height: 6, backgroundColor: i === activeImage ? '#191F28' : '#D5DAE0' }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Main Content ─── */}
      <div className={`px-5 py-6 ${CARD_CLS}`}>
        {/* Pro row + prime */}
        <Reveal>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2.5">
              <p className="flex items-center gap-1 text-[18px] font-extrabold text-[#191F28]">
                {pro.categoryName || '사회자'} {pro.name}
                {pro.isPrime && <VerifiedBadge size={18} />}
              </p>
            </div>
            {pro.isPrime && (
              <span className="flex items-center gap-1 bg-[#F2F4F6] text-[#4E5968] text-[11px] font-bold px-2.5 py-1 rounded-full">
                <img src="/images/verified-pro.svg" alt="" width={14} height={14} className="shrink-0" />
                인증 사회자
              </span>
            )}
          </div>
          {/* 태그: DB에서 등록된 실제 태그만 표시 — 중성 회색 필 */}
          {Array.isArray(pro.tags) && pro.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2 mb-1">
              {pro.tags.map((t) => (
                <span key={t} className="text-[13px] font-semibold text-[#4E5968] bg-[#F2F4F6] px-2.5 py-1 rounded-full">
                  {t}
                </span>
              ))}
            </div>
          )}
        </Reveal>

        {/* Rating — 별 + 큰 숫자 한 줄 */}
        <Reveal delay={100}>
          <div className="flex items-center gap-2 mt-2 mb-1">
            <StarRating value={parseFloat(pro.rating.toFixed(1))} size={16} twinkle />
            <span className="text-[18px] font-extrabold text-[#191F28]">{pro.rating.toFixed(1)}</span>
            <span className="text-[13px] text-[#8B95A1]">({displayReviewCount})</span>
          </div>
          <FloatingReviewCards reviews={displayReviews} />
        </Reveal>

        {/* ─── 주요 경력 — 아이콘 타일 헤더 + 구분선 행 목록 ─── */}
        {pro.career && pro.career.trim().length > 0 && (
          <Reveal delay={150}>
            <div className="mt-4 pt-4">
              <SectionHead eyebrow="CAREER" title="주요 경력" icon="/icons/pro-detail/trophy.svg" size="sm" className="mb-1.5" />
              <CareerSweepList lines={pro.career.split(/\n|\//).map((l) => l.trim()).filter(Boolean).slice(0, 6)} />
            </div>
          </Reveal>
        )}

        {/* ─── 기업 로고 캐러셀 ─── */}
        <CompanyLogoCarousel proId={pro.id} logos={pro.companyLogos} showFallback={pro.showPartnersLogo} />

      </div>


      {/* ─── Section Tabs (Sticky below header) ─── */}
      {/* 섹션 탭 — PC 헤더 네비와 같은 세그먼트(회색 트랙 + 흰 알약이 미끄러진다) */}
      <div className="sticky top-[60px] z-30 mt-4 bg-white px-4 pb-2 pt-1">
        <div className="relative flex gap-1 rounded-2xl bg-[#F2F3F5] p-1">
          <span
            className="absolute bottom-1 top-1 rounded-[13px] bg-white shadow-sm transition-all duration-500"
            style={{
              left: `calc(4px + ${(activeSectionIndex * 100) / detailSectionTabs.length}% - ${(activeSectionIndex * 8) / detailSectionTabs.length}px)`,
              width: `calc(${100 / detailSectionTabs.length}% - ${8 / detailSectionTabs.length}px)`,
              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
          {detailSectionTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => scrollToSection(tab.id as 'desc' | 'info' | 'reviews')}
              className={`relative flex-1 rounded-[13px] py-2 text-[13px] transition-colors duration-300 ${
                activeSection === tab.id ? 'font-bold text-[#2B313D]' : 'font-semibold text-[#A4ABBA] hover:text-[#51535C]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 서비스 설명 Section ─── */}
      {(hasDescriptionContent || pro.youtubeVideos.length > 0 || pro.uploadedVideos.length > 0) && (
        <div ref={descRef} className={`px-5 py-6 scroll-mt-[120px] ${CARD_CLS}`}>
          <Reveal>
            <SectionHead eyebrow="ABOUT" title="서비스 설명" icon="/icons/pro-detail/document.svg" className="mb-4" />
          </Reveal>

          {/* 서비스 설명 맨 위에 진행 영상 — 여러 편이면 옆으로 넘겨 본다(업로드 먼저) */}
          {(() => {
            const clips = [
              ...pro.uploadedVideos.map((v) => ({ key: v.url, kind: 'upload' as const, src: v.url, title: v.title })),
              ...pro.youtubeVideos.map((v) => ({ key: v.id, kind: 'youtube' as const, src: v.id, title: v.title })),
            ];
            if (clips.length === 0) return null;
            const single = clips.length === 1;
            return (
              <Reveal delay={60}>
                <div className={`mb-5 flex gap-3 ${single ? '' : '-mx-5 snap-x snap-mandatory overflow-x-auto px-5 scrollbar-hide'}`}>
                  {clips.map((clip) => (
                    <div
                      key={clip.key}
                      className={`overflow-hidden rounded-[20px] bg-black ${single ? 'w-full' : 'w-[86%] shrink-0 snap-start'}`}
                      style={{ aspectRatio: '16 / 9' }}
                    >
                      {clip.kind === 'upload' ? (
                        <video
                          src={`${clip.src}#t=0.1`}
                          className="h-full w-full object-cover"
                          controls
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <iframe
                          src={`https://www.youtube.com/embed/${clip.src}?modestbranding=1&rel=0&playsinline=1`}
                          title={clip.title}
                          className="h-full w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      )}
                    </div>
                  ))}
                </div>
              </Reveal>
            );
          })()}

        {pro.isPrime && (
          <Reveal delay={100}>
            <div className="mb-6 rounded-2xl border border-[#EEF0F4] bg-[#F7F8FA] p-4">
              <SectionHead
                eyebrow="PARTNERS"
                title={<>프리티풀 엄선 상위 <span className="text-[#3180F7]">2%</span> 사회자가 제공해요</>}
                icon="/icons/pro-detail/certification.svg"
                size="sm"
                tileClassName="bg-white"
                className="mb-3"
              />
              <ul className="space-y-1.5">
                {['포트폴리오와 고객 후기로 검증된 퀄리티', '경력·이력 인증 심사를 통과한 서비스', '다양한 고객의 요청에 맞춘 전문성'].map((item, i) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-[13px] text-[#4E5968] opacity-0"
                    style={{ animation: `slideInLeft 0.6s ease-out ${300 + i * 100}ms forwards` }}
                  >
                    <img src="/icons/pro-detail/check.svg" alt="" width={14} height={14} className="shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        )}

        {/* Description text (영상만 있는 사회자는 설명 본문 생략) */}
        {hasDescriptionContent && (
          <>
            {/* 설명 전문 표시 — 400px 클램프+더보기 제거(설명 짤림 QA) */}
            <div className="pro-detail-html text-left text-[15px] leading-[1.8] text-[#333D4B] [&_a]:text-[#3180F7] [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-[#3180F7]/30 [&_blockquote]:pl-4 [&_blockquote]:text-[#4E5968] [&_br]:leading-[1.8] [&_h1]:mb-3 [&_h1]:text-[22px] [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:text-[19px] [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:text-[17px] [&_h3]:font-bold [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-xl [&_li]:mb-1.5 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-4 [&_strong]:font-bold [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-5 [&_img]:cursor-zoom-in" onClick={zoomOnImgClick}>
              <div dangerouslySetInnerHTML={{ __html: pro.descriptionHtml || '' }} />
            </div>

            {/* Image expand notice */}
            <div className="mt-8 bg-[#F7F8FA] rounded-2xl py-3 flex items-center justify-center gap-2 text-[13px] text-[#8B95A1]">
              이미지를 클릭해서 확대 할 수 있어요
              <ArrowUpRight size={14} />
            </div>
          </>
        )}

        </div>
      )}

      {/* ─── 프리티풀의 다른 검증된 사회자 ─── */}
      {displayAlsoViewed.length > 0 && (
        <div className="px-4 pt-8 pb-4">
          <Reveal>
            <h3 className="mb-4 text-[20px] font-extrabold leading-tight text-[#191F28]">프리티풀의 다른<br />검증된 사회자를 살펴보세요</h3>
          </Reveal>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x pr-4">
            {displayAlsoViewed.map((item) => (
              <Link
                key={item.id}
                href={`/pros/${item.id}`}
                className="group w-[150px] shrink-0 snap-start"
              >
                <div className="relative overflow-hidden rounded-[16px] bg-[#F2F4F6]" style={{ aspectRatio: '3/4' }}>
                  <Image src={item.image || '/images/default-profile.png'} alt="" fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="mt-1.5">
                  <span className="mb-1 inline-flex items-center gap-0.5 rounded-full bg-[#F2F4F6] px-2 py-[3px] text-[11px] font-bold text-[#4E5968]"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Partners</span>
                  <p className="text-[15px] font-semibold leading-tight text-[#191F28]">{item.category || '사회자'} {item.author}</p>
                  {item.rating && (
                    <div className="mt-1 flex items-center gap-1">
                      <StarRating value={parseFloat(item.rating.toFixed(1))} size={13} />
                      <span className="text-[13px] font-bold text-[#191F28]">{item.rating.toFixed(1)}</span>
                      <span className="text-[12px] text-[#8B95A1]">({item.reviewCount})</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ─── Divider ─── */}

      {/* ─── 사회자 정보 Section ─── */}
      <div ref={infoRef} className={`px-5 py-6 scroll-mt-[120px] ${CARD_CLS}`}>
        <SectionHead eyebrow="PROFILE" title="사회자 정보" icon="/icons/pro-detail/mic.svg" className="mb-5" />

        <div className="flex items-center gap-4 mb-2">
          <img src={pro.profileImage} alt="" className="w-[60px] h-[60px] rounded-[14px] object-cover" />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-extrabold text-[#191F28]">{pro.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <StarRating value={parseFloat(pro.rating.toFixed(1))} size={12} />
              <span className="text-[12px] font-bold text-[#191F28]">{pro.rating.toFixed(1)}</span>
              <span className="text-[12px] text-[#8B95A1]">({displayReviewCount})</span>
            </div>
          </div>
        </div>

        {/* 정보 행 — 아이콘 타일 + 라벨/값, 1px 구분선 */}
        <div className="divide-y divide-[#F2F4F6]">
          {[
            { icon: '/icons/pro-detail/clock.svg', label: '연락 가능 시간', value: pro.expertStats.contactTime },
            { icon: '/icons/pro-detail/chat.svg', label: '평균 응답 시간', value: pro.expertStats.responseTime },
            { icon: '/icons/pro-detail/certification.svg', label: '파트너 인증', value: pro.isPrime ? '인증 완료' : '심사 완료' },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-3 py-3">
              <IconTile src={row.icon} />
              <span className="text-[13px] text-[#8B95A1]">{row.label}</span>
              <span className="ml-auto text-[14px] font-bold text-[#191F28]">{row.value}</span>
            </div>
          ))}
        </div>

      </div>

      {/* ─── 리뷰 Section ─── */}
      <div ref={reviewsRef} className={`px-5 py-6 scroll-mt-[120px] ${CARD_CLS}`}>
        <SectionHead eyebrow="REVIEW" title="리뷰" icon="/icons/pro-detail/eyes.svg" className="mb-4" />

        <div className="flex items-center gap-2 mb-3">
          <StarRating value={parseFloat(pro.rating.toFixed(1))} size={20} />
          <span className="text-[24px] font-extrabold text-[#191F28]">{pro.rating.toFixed(1)}</span>
          <span className="text-[14px] text-[#8B95A1]">({displayReviewCount})</span>
        </div>

        {/* AI 리뷰 요약 — 흰 카드 + 좌측 브랜드색 세로 라인 + 스파클 아이콘 */}
        {aiReviewSummary && (
          <div className="mb-3 rounded-[20px] border border-[#F0E7F8] bg-gradient-to-b from-[#FBF3FB] via-[#FDF9FE] to-white p-4">
            <div className="mb-2 flex items-center gap-1.5">
              <AiSparkle size={18} />
              <span className="text-[15px] font-bold text-[#2B313D]">
                고객들의 리뷰를 <span className="text-[#8B5CF6]">요약</span>했어요
              </span>
              <span
                title="AI 가 실제 리뷰를 모아 요약한 내용이에요"
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#C8CEDA] text-[10px] font-bold leading-none text-[#A4ABBA]"
              >
                i
              </span>
            </div>
            <p className="text-[14px] leading-[1.6] text-[#4E5968]">{aiReviewSummary.text}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {aiReviewSummary.keywords.map((keyword) => (
                <span key={keyword} className="rounded-full bg-[#F2F4F6] px-2.5 py-1 text-[12px] font-semibold text-[#4E5968]">
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        <ReviewKeywordCloud items={reviewKeywords} reviewCount={displayReviewCount} />


        {/* Reviews list */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-extrabold text-[#191F28]">전체 리뷰 {displayReviewCount}건</h3>
          <button><ChevronRight size={20} className="text-[#8B95A1]" /></button>
        </div>

        <div className="space-y-6">
          {hasReviewMetricOnly ? (
            <div className="rounded-2xl bg-[#F7F8FA] px-4 py-5">
              <div className="mb-2 flex items-center gap-2">
                <StarRating value={parseFloat(pro.rating.toFixed(1))} size={14} />
                <span className="text-[13px] font-bold text-[#191F28]">{pro.rating.toFixed(1)}</span>
                <span className="text-[12px] text-[#8B95A1]">({displayReviewCount})</span>
              </div>
              <p className="text-[14px] leading-[1.7] text-[#4E5968]">{metricOnlyReviewMessage}</p>
            </div>
          ) : displayReviews.length === 0 && (
            <div className="rounded-2xl bg-[#F7F8FA] px-4 py-8 text-center">
              <p className="text-[14px] font-semibold text-[#191F28]">아직 표시할 리뷰가 없습니다</p>
              <p className="mt-1 text-[12px] text-[#8B95A1]">리뷰가 등록되면 이곳에 바로 보여집니다</p>
            </div>
          )}

          {displayReviews.map((review) => (
            <div key={review.id} className="pb-6 border-b border-[#F2F4F6] last:border-0 relative">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-[#F2F4F6] flex items-center justify-center">
                    <img src="/icons/pro-detail/person.svg" alt="" width={20} height={20} />
                  </div>
                  <span className="text-[14px] text-[#4E5968]">{review.name}</span>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setReviewMenu(reviewMenu === review.id ? null : review.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#F2F4F6] transition-colors"
                  >
                    <span className="text-[16px] text-[#8B95A1] leading-none">⋯</span>
                  </button>
                  {reviewMenu === review.id && (
                    <div className="absolute right-0 top-8 bg-white border border-[#EEF0F4] rounded-xl shadow-lg py-1 z-20 min-w-[120px]">
                      <button onClick={() => { toast('리뷰를 신고했습니다'); setReviewMenu(null); }} className="w-full text-left px-4 py-2.5 text-[13px] text-[#4E5968] hover:bg-[#F7F8FA]">신고하기</button>
                      <button onClick={() => { toast('리뷰를 차단했습니다'); setReviewMenu(null); }} className="w-full text-left px-4 py-2.5 text-[13px] text-[#4E5968] hover:bg-[#F7F8FA]">차단하기</button>
                      <button onClick={() => { navigator.clipboard.writeText(review.content); toast.success('복사됨'); setReviewMenu(null); }} className="w-full text-left px-4 py-2.5 text-[13px] text-[#4E5968] hover:bg-[#F7F8FA]">복사하기</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 mb-2">
                <StarRating value={parseFloat(review.rating.toFixed(1))} size={14} />
                <span className="text-[13px] font-bold text-[#191F28]">{review.rating.toFixed(1)}</span>
                <span className="text-[12px] text-[#D5DAE0]">|</span>
                <span className="text-[12px] text-[#8B95A1]">{review.date}</span>
              </div>
              {(review as typeof review & { scores?: Record<string, number> }).scores && (
                <div className="flex flex-wrap gap-1 mb-2.5">
                  {Object.entries((review as typeof review & { scores: Record<string, number> }).scores).map(([key, val]) => (
                    <span key={key} className="text-[10px] font-medium px-1.5 rounded-[5px] bg-[#F2F4F6] text-[#4E5968] flex items-center" style={{ height: 22 }}>
                      {key} <span className="font-bold text-[#3180F7] ml-1">{val}</span>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[14px] leading-[1.7] text-[#333D4B] mb-3 whitespace-pre-line">{review.content}</p>
              {review.photos && review.photos.length > 0 && (
                <div className="mb-3 flex gap-2 overflow-x-auto scrollbar-hide">
                  {review.photos.slice(0, 5).map((photo, index) => (
                    <img
                      key={`${review.id}-photo-${index}`}
                      src={photo}
                      alt=""
                      className="h-[82px] w-[82px] shrink-0 rounded-xl object-cover"
                      loading="lazy"
                    />
                  ))}
                </div>
              )}
              <p className="text-[12px] text-gray-400 mb-2">
              </p>
              {review.badge && (
                <span className="inline-block text-[11px] text-[#4E5968] bg-[#F2F4F6] px-2 py-1 rounded-full">{review.badge}</span>
              )}
              {review.proReply && (
                <div className="mt-3 bg-[#F7F8FA] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[13px] font-semibold text-[#191F28]">{pro.name}</span>
                    <span className="text-[12px] text-[#8B95A1]">{review.proReply.date}</span>
                  </div>
                  <p className="text-[13px] leading-[1.7] text-[#4E5968] whitespace-pre-line">{review.proReply.content}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {displayReviewCount > 0 && (
          <button
            onClick={() => router.push(`/pros/${pro.id}/reviews`)}
            className="w-full py-3.5 border border-[#E5E8EB] rounded-2xl text-[14px] font-semibold text-[#4E5968] hover:bg-[#F7F8FA] active:scale-[0.98] transition-all mt-5"
          >
            리뷰 전체보기
          </button>
        )}
      </div>

      {/* ─── Expandable panels ─── */}
      <div className={`px-5 py-6 ${CARD_CLS}`}>
        <SectionHead eyebrow="GUIDE" title="사회자 FAQ" icon="/icons/pro-detail/bulb.svg" className="mb-1" />
        {[
          { id: 'info', label: '서비스 정보', content: `• 카테고리: MC / 아나운서\n• 평균 작업 기간: 20일 이내\n• 커뮤니케이션: 1시간 이내 응답\n• 수정 횟수: 1회 포함\n• 취소·환불 정책: 환불 규정 참고` },
          { id: 'revision', label: '수정 및 재진행', content: `• 상품 구매 후 수정 횟수는 1회입니다.\n• 수정 요청은 작업 완료 전 요청 가능합니다.\n• 추가 수정이 필요한 경우 별도 협의가 필요합니다.` },
          { id: 'cancel', label: '취소 및 환불 규정', content: `• 작업 시작 전: 100% 환불\n• 작업 진행 중: 진행률에 따른 일부 환불\n• 작업 완료 후: 환불 불가\n※ 상세 규정은 프리티풀 이용약관을 따릅니다.` },
          { id: 'notice', label: '상품정보고시', content: `• 제공자: ${pro.name}\n• 서비스 제공방식: 온/오프라인\n• 결제 후 계약 내용 변경은 상호 협의에 의해서만 가능합니다.` },
        ].map((panel) => {
          const isOpen = expandedPanel === panel.id;
          return (
            <div key={panel.id} className="border-b border-[#F2F4F6] last:border-0">
              <button
                onClick={() => setExpandedPanel(isOpen ? null : panel.id)}
                className="w-full flex items-center justify-between py-4 text-left"
              >
                <span className="text-[15px] font-semibold text-[#191F28]">{panel.label}</span>
                <ChevronDown size={20} className={`text-[#8B95A1] transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#3180F7]' : ''}`} />
              </button>
              <div
                className="overflow-hidden transition-all duration-500"
                style={{
                  maxHeight: isOpen ? 400 : 0,
                  opacity: isOpen ? 1 : 0,
                  transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <div className="pb-4 text-[13px] text-[#8B95A1] leading-[1.8] whitespace-pre-line">{panel.content}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── 환불 규정 안내 (맨 하단) ─── */}
      <div className="px-5 pb-8 pt-2">
        <div className="flex items-start gap-3 rounded-[20px] bg-[#F7F8FA] p-4">
          <img src="/icons/pro-detail/counselor.svg" alt="" width={40} height={40} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-[#191F28]">환불 규정 안내</p>
            <p className="mt-1 text-[13px] leading-[1.7] text-[#8B95A1]">
              행사 7일 전까지 취소하면 전액 환불됩니다. 이후에는 행사일이 가까울수록 환불 비율이 줄어들며,
              사회자 귀책으로 진행이 어려워진 경우에는 언제든 전액 환불됩니다.
            </p>
            <Link
              href="/my/terms"
              className="mt-2 inline-flex items-center gap-0.5 text-[13px] font-bold text-[#3180F7]"
            >
              자세한 환불 규정 보기
              <ChevronRight size={15} />
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Bottom Fixed Bar ─── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
        style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 12px), 20px)' }}
      >
        {/* 블러 배경 (별도 레이어로 분리) */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, white 30%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.5) 70%, rgba(255,255,255,0) 100%)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            maskImage: 'linear-gradient(to top, black 55%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to top, black 55%, transparent 100%)',
          }}
        />
      <div className="relative pointer-events-auto pt-10">
        <div className="flex items-center gap-3 max-w-[680px] mx-auto">
		          {/* 문의하기 */}
          <div className="relative flex-1">
            <div className="flex h-14 overflow-visible">
              <button
                disabled={openingChat}
                onClick={handleInquiry}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#3180F7] text-[16.5px] font-bold text-white transition-all active:scale-[0.99] disabled:opacity-70"
              >
                {openingChat ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
                    요청 중
                  </>
                ) : (
                  '이 사회자에게 문의하기'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
      </div>

      {confirmInquiryOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0"
          onClick={() => {
            if (!openingChat) setConfirmInquiryOpen(false);
          }}
          style={{ animation: 'inquiryBackdropIn 0.24s ease-out' }}
        >
          <div
            className="w-full max-w-[420px] rounded-[28px] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
            style={{ animation: 'inquirySheetIn 0.38s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[20px] font-bold text-[#2B313D]">문의 요청하기</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[#6B7280]">
                  {pro.name} 사회자에게 전달할 행사 장소와 일시를 입력해주세요.
                </p>
              </div>
              <button
                type="button"
                disabled={openingChat}
                onClick={() => setConfirmInquiryOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F2F4F6] text-[#8B95A1] transition active:scale-95 disabled:opacity-60"
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-bold text-[#6B7684]">행사 장소</span>
                <input
                  value={inquiryLocation}
                  onChange={(event) => setInquiryLocation(event.target.value)}
                  placeholder="예: 서울 중구 퇴계로"
                  disabled={openingChat}
                  className="h-[52px] w-full rounded-2xl border border-[#E5E8EF] bg-white px-4 text-[15px] font-semibold text-[#2B313D] outline-none transition placeholder:text-[#A4ABBA] focus:border-[#3180F7] disabled:bg-[#F8FAFC]"
                />
              </label>
              <div>
                <span className="mb-1.5 block text-[12px] font-bold text-[#6B7684]">행사일시</span>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <input
                    type="date"
                    value={inquiryDate}
                    onChange={(event) => setInquiryDate(event.target.value)}
                    disabled={openingChat}
                    className="inquiry-datetime-input h-[52px] min-w-0 rounded-2xl border border-[#E5E8EF] bg-white px-3 text-[14px] font-semibold text-[#2B313D] outline-none transition focus:border-[#3180F7] disabled:bg-[#F8FAFC]"
                  />
                  <input
                    type="time"
                    value={inquiryTime}
                    onChange={(event) => setInquiryTime(event.target.value)}
                    disabled={openingChat}
                    className="inquiry-datetime-input h-[52px] min-w-0 rounded-2xl border border-[#E5E8EF] bg-white px-3 text-[14px] font-semibold text-[#2B313D] outline-none transition focus:border-[#3180F7] disabled:bg-[#F8FAFC]"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={openingChat}
                onClick={() => setConfirmInquiryOpen(false)}
                className="h-[48px] rounded-2xl bg-[#F2F4F6] text-[15px] font-bold text-[#4E5968] transition active:scale-[0.98] disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                disabled={openingChat}
                onClick={() => submitInquiryRequest()}
                className="flex h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#3180F7] text-[15px] font-bold text-white shadow-[0_12px_24px_rgba(49,128,247,0.24)] transition active:scale-[0.98] disabled:opacity-70"
              >
                {openingChat && <span className="h-4 w-4 rounded-full border-2 border-white/80 border-t-transparent animate-spin" />}
                요청하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Image Modal (확대) ─── */}
      {imageModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={() => setImageModal(null)}
          style={{ animation: 'modalFade 0.3s ease-out' }}
        >
          <button
            onClick={() => setImageModal(null)}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white"
          >
            <X size={24} />
          </button>
          <ZoomableImage src={imageModal} />
          <p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/80 backdrop-blur-sm">두 손가락으로 확대 · 두 번 탭</p>
        </div>
      )}

      {/* ─── Share Modal ─── */}
      {shareModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setShareModal(false)}
          style={{ animation: 'modalFade 0.3s ease-out' }}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-safe"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'sheetUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4 sm:hidden" />
            <h3 className="text-[18px] font-bold text-gray-900 mb-5">공유하기</h3>
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-3 py-4 px-4 hover:bg-gray-50 rounded-xl transition-colors"
            >
              <div className="w-11 h-11 rounded-[14px] bg-[#F2F4F6] flex items-center justify-center">
                <Link2 size={20} className="text-[#3180F7]" />
              </div>
              <span className="text-[15px] font-medium text-gray-900">링크 복사</span>
            </button>
            <button
              onClick={() => setShareModal(false)}
              className="w-full mt-2 py-3.5 bg-gray-100 rounded-xl text-[14px] font-semibold text-gray-700"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* ─── Phone Modal ─── */}
      {phoneModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setPhoneModal(false)}
          style={{ animation: 'modalFade 0.3s ease-out' }}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-safe"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'sheetUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4 sm:hidden" />
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-[20px] bg-[#F2F4F6] flex items-center justify-center mx-auto mb-4">
                <Phone size={28} className="text-[#3180F7]" />
              </div>
              <h3 className="text-[18px] font-bold text-gray-900 mb-2">전화 상담</h3>
              <p className="text-[14px] text-gray-500 mb-6">
                채팅으로 먼저 문의하시면<br />더 빠른 답변을 받을 수 있어요
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPhoneModal(false)}
                  className="flex-1 py-3.5 bg-gray-100 rounded-xl text-[14px] font-semibold text-gray-700"
                >
                  취소
                </button>
                <button
                  onClick={() => { setPhoneModal(false); router.push(`/chat/${pro.id}`); }}
                  className="flex-1 py-3.5 rounded-xl text-[14px] font-bold text-white bg-[#3180F7]"
                >
                  채팅 문의
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Reviews Full Modal ─── */}
      {reviewsModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setReviewsModal(false)}
          style={{ animation: 'modalFade 0.3s ease-out' }}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto pb-safe"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'sheetUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
              <h3 className="text-[17px] font-bold text-gray-900">전체 리뷰 ({displayReviewCount})</h3>
              <button onClick={() => setReviewsModal(false)}>
                <X size={22} className="text-gray-500" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-6">
              {displayReviews.map((review) => (
                <div key={review.id} className="pb-6 border-b border-[#F2F4F6] last:border-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-full bg-[#F2F4F6] flex items-center justify-center">
                      <img src="/icons/pro-detail/person.svg" alt="" width={20} height={20} />
                    </div>
                    <span className="text-[14px] text-[#4E5968]">{review.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <StarRating value={parseFloat(review.rating.toFixed(1))} size={14} />
                    <span className="text-[13px] font-bold text-[#191F28]">{review.rating.toFixed(1)}</span>
                    <span className="text-[12px] text-[#D5DAE0]">|</span>
                    <span className="text-[12px] text-[#8B95A1]">{review.date}</span>
                  </div>
                  <p className="text-[14px] leading-[1.7] text-[#333D4B] mb-3 whitespace-pre-line">{review.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Premium animations */}
      {/* Login Modal */}
      {loginModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40" onClick={() => setLoginModal(false)}>
          <div className="bg-white w-full max-w-md rounded-t-3xl px-6 pt-6 pb-8 animate-[slideUp_0.3s_ease]" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5" />
            <h2 className="text-[20px] font-bold text-gray-900 text-center mb-1">로그인이 필요합니다</h2>
            <p className="text-[14px] text-gray-500 text-center mb-6">이 기능을 사용하려면 로그인해주세요</p>
            <div className="space-y-2.5">
              {['kakao', 'naver'].map((p) => (
                <button key={p} onClick={() => startOAuth(p as 'kakao' | 'naver' | 'google')}
                  className={`w-full flex items-center justify-center gap-3 font-semibold py-3.5 rounded-xl active:scale-[0.98] transition-transform ${p === 'kakao' ? 'bg-[#FEE500] text-[#191919]' : 'bg-[#03C75A] text-white'}`}
                >{p === 'kakao' ? '카카오로 계속하기' : '네이버로 계속하기'}</button>
              ))}
            </div>
            {/* 비회원 로그인 — 랜딩에서 견적만 신청한 고객(소셜 계정 없음)용 */}
            <div className="mt-3">
              <GuestLoginForm onSuccess={() => { setLoginModal(false); router.refresh(); }} />
            </div>
            <button onClick={() => setLoginModal(false)} className="w-full mt-4 text-[14px] text-gray-400 font-medium py-2 text-center">나중에 하기</button>
          </div>
          <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes modalFade {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes inquiryBackdropIn {
          0% { opacity: 0; backdrop-filter: blur(0); }
          100% { opacity: 1; backdrop-filter: blur(4px); }
        }
        @keyframes inquirySheetIn {
          0% { opacity: 0; transform: translateY(26px) scale(0.96); filter: blur(8px); }
          62% { opacity: 1; transform: translateY(-3px) scale(1.01); filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes sheetUp {
          0% { transform: translateY(100%); }
          100% { transform: translateY(0); }
        }
        @keyframes tooltipBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes priceFadeUp {
          0% { opacity: 0; transform: translateY(8px); filter: blur(3px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes slideInLeft {
          0% { opacity: 0; transform: translateX(-12px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes recentReviewsSlideLTR {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .hero-snap {
          scroll-snap-type: x mandatory;
          scroll-padding-left: 18px;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .hero-snap::-webkit-scrollbar { display: none; }
        .recent-reviews-carousel {
          animation: recentReviewsSlideLTR 34s linear infinite;
          will-change: transform;
        }
        .recent-reviews-carousel:hover {
          animation-play-state: paused;
        }
        .recent-reviews-carousel-frame::before,
        .recent-reviews-carousel-frame::after {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          z-index: 12;
          width: 58px;
          pointer-events: none;
        }
        .recent-reviews-carousel-frame::before {
          left: 0;
          background: linear-gradient(90deg, #fff 0%, rgba(255,255,255,0.86) 24%, rgba(255,255,255,0) 100%);
        }
        .recent-reviews-carousel-frame::after {
          right: 0;
          background: linear-gradient(270deg, #fff 0%, rgba(255,255,255,0.86) 24%, rgba(255,255,255,0) 100%);
        }
        @keyframes aiReviewSummaryReveal {
          0% { clip-path: inset(0 100% 0 0); filter: blur(3px); opacity: 0.65; }
          100% { clip-path: inset(0 0 0 0); filter: blur(0); opacity: 1; }
        }
        @keyframes aiReviewCursorBlink {
          0%, 45% { opacity: 1; }
          46%, 100% { opacity: 0; }
        }
        @keyframes aiReviewDotPulse {
          0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-1px); }
        }
        @keyframes aiReviewIconPulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(49,128,247,0)); }
          50% { transform: scale(1.08); filter: drop-shadow(0 4px 8px rgba(49,128,247,0.22)); }
        }
        .ai-review-summary-icon {
          transform-origin: center;
          animation: aiReviewIconPulse 2s ease-in-out infinite;
        }
        .ai-review-summary-copy {
          animation: aiReviewSummaryReveal 1.25s ease-out both;
        }
        .ai-review-summary-cursor {
          display: inline-block;
          width: 2px;
          height: 1em;
          margin-left: 3px;
          transform: translateY(2px);
          border-radius: 999px;
          background: #3180F7;
          animation: aiReviewCursorBlink 0.82s steps(1) infinite;
        }
        .ai-review-thinking-dots span {
          display: inline-block;
          animation: aiReviewDotPulse 1.2s ease-in-out infinite;
        }
        .ai-review-thinking-dots span:nth-child(2) {
          animation-delay: 0.15s;
        }
        .ai-review-thinking-dots span:nth-child(3) {
          animation-delay: 0.3s;
        }
        @media (prefers-reduced-motion: reduce) {
          .recent-reviews-carousel,
          .ai-review-summary-icon,
          .ai-review-summary-copy,
          .ai-review-summary-cursor,
          .ai-review-thinking-dots span {
            animation: none;
          }
        }
        @keyframes primeShine {
          0%, 100% { box-shadow: 0 0 0 rgba(49,128,247,0); }
          50% { box-shadow: 0 0 16px rgba(49,128,247,0.4); }
        }
        @keyframes primeShineMove {
          0% { transform: translateX(-100%); }
          50%, 100% { transform: translateX(400%); }
        }
        @keyframes playPulse {
          0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.5); }
          100% { box-shadow: 0 0 0 18px rgba(255,255,255,0); }
        }
        @keyframes bestBounce {
          0% { opacity: 0; transform: translateY(8px) scale(0.5); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bestFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes heartPop {
          0% { transform: scale(1); }
          50% { transform: scale(1.4); }
          100% { transform: scale(1); }
        }
        @keyframes buttonShine {
          0% { transform: translateX(-100%) skewX(-15deg); }
          50%, 100% { transform: translateX(450%) skewX(-15deg); }
        }
      `}} />
    </div>
  );
}
