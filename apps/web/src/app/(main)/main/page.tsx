'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, useLayoutEffect, type CSSProperties, type RefObject, type TouchEvent as ReactTouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { captureUtm, trackLandingVisit } from '@/lib/landing-track';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, X } from 'lucide-react';
import { HeaderBellIcon, HeaderSearchIcon } from '@/components/icons/HeaderIcons';
import ProQuickView from '@/components/ProQuickView';
import BannerPhotoStrip, { type BannerStrip } from '@/components/home/BannerPhotoStrip';
import HomePromoPopup, { type HomePromo } from '@/components/home/HomePromoPopup';
import { QuickMatchBubbleGlass } from '@/components/home/TossBubble';
import { PartnerCategoryIcon } from '@/components/icons/partner';
import { RankMedal } from '@/components/icons/color';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  PinLocationIcon,
} from '@/components/icons/mono';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/auth.store';
import { apiClient } from '@/lib/api/client';
import { matchApi } from '@/lib/api/match.api';
import {
  WEDDING_PARTNER_CATEGORIES,
  WEDDING_PARTNER_CATEGORY_ICONS,
  categoryTileColor,
  WEDDING_PARTNER_CATEGORY_TABS,
} from '@/lib/business-categories';
import {
  getBusinessDisplayTags,
  isPopularBusinessPartner,
  sortPopularPartnersFirst,
} from '@/lib/business-popularity';
import {
  getRelevantBusinessCategories,
  isBusinessRelevantToAnyCategory,
  sanitizeBusinessImageUrls,
} from '@/lib/business-quality';
import { deriveBusinessTagSuggestions, extractBusinessTagsFromHtml } from '@/lib/business-tags';
import {
  getWeddingPartnerImageSet,
  getWeddingPartnerSectionCategories,
  mergeWeddingPartnerImages,
} from '@/lib/wedding-partner-images';
import { discoveryApi, getCachedProList } from '@/lib/api/discovery.api';
import { useImageTone } from '@/lib/image-tone';
import PartnerToneCard from '@/components/business/PartnerToneCard';
import ProFeedCard, { matchesGender, mapProFeedItems, PRO_FEED_LIST_PARAMS, type ProFeedItem } from '@/components/pros/ProFeedCard';
import ProReviewsSheet, { type ReviewSheetPro } from '@/components/pros/ProReviewsSheet';
import { getCachedUnreadCount, notificationApi } from '@/lib/api/notification.api';

const OFFICIAL_OPEN_MODAL_SESSION_KEY = 'freetiful-official-open-modal-20260506';
const OFFICIAL_OPEN_MODAL_DISMISSED_UNTIL_KEY = 'freetiful-official-open-modal-dismissed-until-20260506';
const OFFICIAL_OPEN_MODAL_HIDE_MS = 365 * 24 * 60 * 60 * 1000; // '다시 보지 않기'(260929 — 예전 '3일 동안 안보기')
// 홈 진입 팝업을 이 세션에서 이미 닫았는지 — 탭 안에서 홈을 다시 방문해도 재노출 안 되게
const POPUP_SEEN_KEY = 'freetiful-popup-seen-session';
const OFFICIAL_OPEN_MODAL_IMAGE = '/images/freetiful-open-20260506.png';

/* ─── 홈 애니메이션은 세션 첫 진입 때만 실행 ───────────────────── */
let _homeSkipPrepared = false;
let _homeSkipValue = false;
function prepareHomeAnimationDecision() {
  if (typeof window === 'undefined') return false;
  if (_homeSkipPrepared) return _homeSkipValue;
  try {
    const alreadyPlayed = sessionStorage.getItem('home-animation-played') === '1';
    _homeSkipValue = alreadyPlayed;
    if (!alreadyPlayed) sessionStorage.setItem('home-animation-played', '1');
  } catch { _homeSkipValue = false; }
  _homeSkipPrepared = true;
  return _homeSkipValue;
}
function resetHomeAnimationDecision() {
  _homeSkipPrepared = false;
}
function shouldSkipHomeAnim(): boolean {
  prepareHomeAnimationDecision();
  return _homeSkipValue;
}

function useHomeAnimationSkip(): boolean {
  const [skip, setSkip] = useState(false);
  useEffect(() => {
    setSkip(shouldSkipHomeAnim());
  }, []);
  return skip;
}

/* ─── Scroll Reveal Hook ──────────────────────────────────── */
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (visible) return; // 이미 visible이면 observer 불필요
    if (shouldSkipHomeAnim()) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    ob.observe(el);
    return () => ob.disconnect();
  }, [threshold, visible]);
  return { ref, visible };
}

/* ─── Reveal Wrapper ─────────────────────────────────────── */
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'translate-y-0 opacity-100 blur-0' : 'translate-y-6 opacity-0 blur-[3px]'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── Lazy Section ───────────────────────────────────────── */
function LazySection({ children, height = 400 }: { children: React.ReactNode; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShow(true); ob.disconnect(); } }, { rootMargin: '200px' });
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  return <div ref={ref} style={show ? undefined : { minHeight: height }}>{show ? children : null}</div>;
}

/* ─── Count-Up Animation ─────────────────────────────────── */
function CountUpText({ value, suffix = '' }: { value: number; suffix?: string }) {
  const { ref, visible } = useReveal(0.3);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const duration = 1200;
    const start = Date.now();
    const tick = () => {
      const progress = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(value * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    tick();
  }, [visible, value]);
  return <span ref={ref}>{count}{suffix}</span>;
}

/* ─── Pill Border Train (흐르는 광선 효과) ────────────────── */
function PillBorderTrain({ color = '#FBBF24' }: { color?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const path = pathRef.current;
    if (!path || size.w === 0) return;
    const perimeter = path.getTotalLength();
    const trainLen = perimeter * 0.14;
    path.setAttribute('stroke-dasharray', `${trainLen} ${perimeter - trainLen}`);
    path.setAttribute('stroke-dashoffset', '0');
    // 빠르게 돌았다 천천히 가는 리듬감 있는 애니메이션
    const animation = path.animate(
      [
        { strokeDashoffset: 0, offset: 0 },
        { strokeDashoffset: -perimeter * 0.55, offset: 0.2 }, // 20% 시간에 55% 거리 (빠름)
        { strokeDashoffset: -perimeter * 0.6, offset: 0.55 }, // 35% 시간에 5% 거리 (느림)
        { strokeDashoffset: -perimeter, offset: 1 }, // 45% 시간에 40% 거리 (중간-빠름)
      ],
      {
        duration: 3200,
        iterations: Infinity,
        easing: 'cubic-bezier(0.45, 0, 0.55, 1)',
      }
    );
    return () => animation.cancel();
  }, [size]);

  if (size.w === 0) {
    return <svg ref={svgRef} className="absolute inset-0 pointer-events-none" />;
  }

  const w = size.w;
  const h = size.h;
  const inset = 1;
  const left = inset;
  const top = inset;
  const right = w - inset;
  const bottom = h - inset;
  // 3:4 비율 알약: 위/아래 반원 r = w/2
  const radius = (w - inset * 2) / 2;

  const path = `M ${left},${top + radius} A ${radius},${radius} 0 0 1 ${right},${top + radius} L ${right},${bottom - radius} A ${radius},${radius} 0 0 1 ${left},${bottom - radius} Z`;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      style={{ overflow: 'visible' }}
    >
      <path
        ref={pathRef}
        d={path}
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        style={{
          filter: `drop-shadow(0 0 3px ${color}cc) drop-shadow(0 0 6px ${color}88)`,
        }}
      />
    </svg>
  );
}

/* ─── Rounded Rect Border Train (둥근사각형 흐르는 띠) ──── */
function RoundedRectBorderTrain({ color = '#2B313D' }: { color?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef1 = useRef<SVGPathElement>(null);
  const pathRef2 = useRef<SVGPathElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const p1 = pathRef1.current;
    const p2 = pathRef2.current;
    if (!p1 || !p2 || size.w === 0) return;
    const perimeter = p1.getTotalLength();
    const trainLen = perimeter * 0.2;
    const gapLen = perimeter - trainLen;
    p1.setAttribute('stroke-dasharray', `${trainLen} ${gapLen}`);
    p1.setAttribute('opacity', '1');
    const a1 = p1.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: -perimeter }], { duration: 6000, iterations: Infinity, easing: 'linear' });
    p2.setAttribute('stroke-dasharray', `${trainLen} ${gapLen}`);
    p2.setAttribute('stroke-dashoffset', `${-perimeter * 0.5}`);
    p2.setAttribute('opacity', '1');
    const a2 = p2.animate([{ strokeDashoffset: -perimeter * 0.5 }, { strokeDashoffset: -perimeter * 1.5 }], { duration: 6000, iterations: Infinity, easing: 'linear' });
    return () => { a1.cancel(); a2.cancel(); };
  }, [size]);

  if (size.w === 0) {
    return <svg ref={svgRef} className="absolute inset-0 pointer-events-none" />;
  }

  const w = size.w;
  const h = size.h;
  const inset = 1;
  const r = 16;
  const left = inset;
  const top = inset;
  const right = w - inset;
  const bottom = h - inset;

  const path = `M ${left + r},${top} L ${right - r},${top} A ${r},${r} 0 0 1 ${right},${top + r} L ${right},${bottom - r} A ${r},${r} 0 0 1 ${right - r},${bottom} L ${left + r},${bottom} A ${r},${r} 0 0 1 ${left},${bottom - r} L ${left},${top + r} A ${r},${r} 0 0 1 ${left + r},${top} Z`;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      style={{ overflow: 'visible' }}
    >
      <path
        ref={pathRef1}
        d={path}
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0"
      />
      <path
        ref={pathRef2}
        d={path}
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0"
      />
    </svg>
  );
}

function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 275 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M245.215 69.6595C244.99 69.837 244.811 70.0662 244.693 70.3279C243.015 72.9488 240.547 74.9581 237.651 76.0597C236.34 76.5622 234.962 76.8626 233.563 76.9508C232.02 77.0731 230.467 76.9665 228.954 76.6345C225.804 75.8971 223.63 74.0058 222.374 71.0207C221.74 69.4354 221.339 67.7657 221.184 66.064C221.067 64.9311 221.013 63.7924 221.022 62.6534C221.022 57.7525 221.022 52.8515 221.022 47.9506C221.008 47.3818 221.051 46.8131 221.151 46.2531C221.484 44.6255 222.406 43.1806 223.737 42.1991C225.068 41.2175 226.715 40.7693 228.356 40.9414C229.997 41.1135 231.516 41.8937 232.618 43.1305C233.72 44.3673 234.326 45.9724 234.32 47.6343C234.333 48.8461 234.32 50.0602 234.32 51.2721C234.32 53.9706 234.32 56.6683 234.32 59.3653C234.321 60.7033 234.523 62.0333 234.919 63.3106C235.1 63.9021 235.351 64.4692 235.669 64.9992C235.932 65.4477 236.268 65.849 236.662 66.1866C237.223 66.678 237.926 66.9738 238.667 67.03C239.409 67.0862 240.148 66.8997 240.776 66.4984C241.437 66.0651 242.002 65.4994 242.437 64.8366C243.272 63.5768 243.827 62.1506 244.065 60.6552C244.182 59.9187 244.232 59.1731 244.215 58.4275C244.215 54.8141 244.215 51.2008 244.215 47.5875C244.197 45.815 244.879 44.1079 246.11 42.8416C247.342 41.5753 249.022 40.8536 250.782 40.8353C252.542 40.817 254.237 41.5035 255.494 42.7439C256.751 43.9843 257.468 45.6769 257.486 47.4494C257.486 47.5986 257.486 47.7479 257.486 47.8949C257.486 56.9542 257.486 66.0135 257.486 75.0729C257.486 76.1355 257.612 75.9862 256.601 75.9884C253.089 75.9884 249.576 75.9884 246.064 75.9884H245.697C245.213 75.9884 245.206 75.9884 245.204 75.4872C245.204 73.8268 245.204 72.1687 245.204 70.5128L245.215 69.6595Z" fill="currentColor"/>
      <path d="M132.854 61.7201C130.251 61.7201 127.647 61.7201 125.044 61.7201C124.31 61.7201 124.381 61.7624 124.425 62.3616C124.462 63.4765 124.686 64.577 125.088 65.6163C125.261 66.0523 125.484 66.4665 125.752 66.8505C126.107 67.3726 126.565 67.815 127.098 68.1498C127.631 68.4845 128.227 68.7043 128.848 68.7952C130.731 69.1139 132.665 68.7743 134.329 67.8329C134.84 67.5366 135.332 67.2085 135.802 66.8505C136.158 66.5876 136.521 66.3336 136.888 66.0841C139.1 64.5827 142.21 65.6185 143.223 68.2249C143.611 69.1724 143.666 70.2248 143.38 71.2083C143.094 72.1918 142.483 73.0474 141.648 73.6338C139.919 74.8641 137.984 75.7697 135.935 76.3071C134.222 76.7497 132.462 76.9852 130.693 77.0088C128.434 77.0819 126.175 76.8466 123.978 76.3093C121.07 75.5697 118.462 74.2531 116.268 72.1635C114.538 70.5331 113.206 68.5218 112.375 66.2868C110.506 61.2634 110.451 56.2199 112.457 51.2254C113.604 48.2961 115.529 45.7418 118.023 43.8429C120.517 41.944 123.482 40.7739 126.592 40.4611C129.704 40.1147 132.853 40.4841 135.802 41.5415C139.503 42.8782 142.241 45.3554 144.05 48.8707C145.178 51.0489 145.884 53.4236 146.129 55.8679C146.335 57.933 145.466 59.5726 143.782 60.7688C142.781 61.4772 141.637 61.7201 140.434 61.7245C138.764 61.7245 137.094 61.7245 135.424 61.7245L132.854 61.7201ZM124.845 53.658C125.023 53.7447 125.224 53.7713 125.418 53.7338H132.56C133.354 53.7338 133.223 53.7204 133.102 53.0432C132.93 51.965 132.54 50.9338 131.956 50.0135C131.273 48.9887 130.346 48.3784 129.098 48.2982C127.911 48.2247 126.929 48.6056 126.194 49.568C125.943 49.9042 125.732 50.27 125.568 50.6573C125.285 51.3158 125.079 52.005 124.954 52.7112C124.892 53.0231 124.761 53.3283 124.845 53.658Z" fill="currentColor"/>
      <path d="M95.2207 61.7212H87.6321C87.4352 61.7212 87.2384 61.7212 87.0415 61.7212C86.8447 61.7212 86.7894 61.7992 86.7938 62.0042C86.8181 63.4032 87.0305 64.7643 87.6542 66.0319C88.4703 67.6893 89.7753 68.6516 91.6177 68.841C92.3748 68.9265 93.1397 68.9137 93.8936 68.8031C95.257 68.5833 96.5494 68.0413 97.6647 67.2214C98.1668 66.865 98.6556 66.4908 99.1665 66.1477C99.6689 65.7891 100.244 65.5465 100.85 65.4371C101.853 65.3055 102.872 65.5186 103.74 66.0417C104.609 66.5648 105.277 67.3675 105.637 68.3202C105.997 69.2729 106.028 70.32 105.724 71.2924C105.42 72.2648 104.8 73.1058 103.964 73.6795C102.103 74.9802 100.014 75.9144 97.8085 76.433C96.2518 76.7886 94.6625 76.9797 93.0664 77.0033C91.0288 77.0694 88.9907 76.8907 86.9951 76.4709C84.6795 75.989 82.4815 75.0501 80.5278 73.7085C77.7122 71.7437 75.7703 69.0994 74.5936 65.8737C74.0202 64.2663 73.6486 62.5929 73.4877 60.8925C73.1895 58.1783 73.4554 55.4312 74.2685 52.826C75.7327 48.1857 78.5195 44.6192 82.8192 42.3224C84.804 41.2731 86.9775 40.6353 89.2113 40.4467C91.9317 40.185 94.6766 40.4589 97.2931 41.2531C101.739 42.6076 104.897 45.4546 106.828 49.6961C107.692 51.6138 108.258 53.6536 108.507 55.7443C108.847 58.4621 106.959 61.0908 104.128 61.6121C103.643 61.6983 103.153 61.7401 102.661 61.7368C100.18 61.7235 97.6994 61.7183 95.2207 61.7212ZM91.3324 53.7483H94.8712C95.0437 53.7483 95.2163 53.7483 95.3866 53.7483C95.5569 53.7483 95.5878 53.6391 95.5635 53.4943C95.4226 52.4879 95.124 51.5104 94.6788 50.5983C94.3281 49.8564 93.774 49.2311 93.0819 48.7961C92.3095 48.3155 91.3795 48.1629 90.4956 48.3717C89.6117 48.5805 88.8461 49.1336 88.3664 49.91C87.6697 51.0238 87.3954 52.278 87.1963 53.5523C87.192 53.5768 87.1931 53.602 87.1998 53.626C87.2065 53.6499 87.2185 53.6721 87.2349 53.6907C87.2512 53.7094 87.2716 53.7241 87.2944 53.7337C87.3173 53.7432 87.342 53.7475 87.3666 53.7461C87.537 53.7572 87.7095 53.7572 87.882 53.7572L91.3324 53.7483Z" fill="currentColor"/>
      <path d="M210.563 62.456V75.0759C210.563 75.2987 210.563 75.5215 210.563 75.7443C210.564 75.7746 210.56 75.805 210.55 75.8336C210.539 75.8622 210.523 75.8884 210.503 75.9105C210.482 75.9326 210.457 75.9502 210.429 75.9623C210.401 75.9743 210.372 75.9804 210.341 75.9804C210.195 75.9804 210.047 75.9804 209.899 75.9804H197.955C197.261 75.9804 197.292 76.0383 197.292 75.2898C197.292 66.777 197.292 58.265 197.292 49.7537C197.292 49.5309 197.292 49.3081 197.292 49.0854C197.293 49.0482 197.286 49.0113 197.272 48.977C197.258 48.9428 197.236 48.9122 197.209 48.8874C197.181 48.8625 197.149 48.844 197.113 48.8332C197.078 48.8224 197.041 48.8195 197.004 48.8247C196.71 48.8247 196.416 48.8247 196.12 48.8091C195.259 48.7843 194.431 48.4764 193.76 47.9325C193.09 47.3885 192.615 46.6385 192.408 45.797C192.202 44.9556 192.274 44.069 192.615 43.2729C192.955 42.4768 193.545 41.815 194.295 41.3886C194.851 41.0667 195.48 40.8927 196.122 40.883C196.416 40.883 196.71 40.883 197.006 40.883C197.043 40.8882 197.081 40.8853 197.116 40.8743C197.152 40.8634 197.184 40.8447 197.212 40.8196C197.239 40.7945 197.261 40.7636 197.275 40.7291C197.289 40.6946 197.296 40.6574 197.294 40.6201C197.294 40.4218 197.294 40.2236 197.294 40.0253C197.294 38.7399 197.294 37.4523 197.294 36.1647C197.288 34.7288 197.504 33.3008 197.935 31.9321C198.853 29.0895 200.709 27.1447 203.48 26.091C205.074 25.499 206.76 25.1973 208.459 25.1999C210.52 25.1799 212.584 25.2133 214.652 25.1888C215.694 25.1755 216.699 25.5798 217.446 26.3128C218.192 27.0458 218.619 28.0474 218.632 29.0973C218.645 30.1472 218.244 31.1594 217.516 31.9112C216.788 32.6629 215.794 33.0928 214.752 33.106C214.285 33.1087 213.821 33.1693 213.369 33.2865C211.702 33.7632 210.812 35.1132 210.616 36.6102C210.588 36.8811 210.577 37.1534 210.582 37.4256C210.582 38.2921 210.582 39.1587 210.582 40.0253C210.582 40.9698 210.483 40.8763 211.467 40.8785C212.522 40.8785 213.579 40.8785 214.634 40.8785C215.252 40.8656 215.863 41.0063 216.414 41.288C216.965 41.5697 217.439 41.9837 217.793 42.4936C218.702 43.7634 218.839 45.1535 218.164 46.5636C217.881 47.2154 217.417 47.7716 216.829 48.1664C216.241 48.5612 215.553 48.778 214.847 48.7913C213.697 48.8514 212.54 48.8113 211.385 48.818C210.525 48.818 210.582 48.7178 210.582 49.6022L210.563 62.456Z" fill="currentColor"/>
      <path d="M151.512 57.4083V49.7628C151.512 49.5646 151.512 49.3663 151.512 49.168C151.512 48.8896 151.45 48.8428 151.149 48.8339C150.848 48.825 150.609 48.8339 150.339 48.8205C149.441 48.7908 148.58 48.4529 147.899 47.8628C147.218 47.2727 146.757 46.4658 146.593 45.5759C146.43 44.6859 146.573 43.7664 146.999 42.9696C147.425 42.1729 148.109 41.5468 148.937 41.1951C149.367 41.0095 149.828 40.9089 150.295 40.8988C150.589 40.8988 150.886 40.8988 151.18 40.8854C151.474 40.8721 151.512 40.8186 151.512 40.5179C151.512 39.1812 151.512 37.8446 151.512 36.508C151.502 35.4156 151.751 34.3367 152.237 33.3603C152.869 32.113 153.874 31.0966 155.109 30.454C156.344 29.8114 157.748 29.5748 159.124 29.7777C160.5 29.9805 161.778 30.6125 162.779 31.5847C163.779 32.557 164.452 33.8207 164.703 35.1981C164.781 35.6863 164.817 36.1806 164.809 36.6751C164.822 37.8379 164.809 39.0008 164.809 40.1637C164.809 40.3374 164.809 40.5112 164.829 40.6827C164.831 40.7328 164.851 40.7803 164.887 40.8155C164.922 40.8507 164.969 40.871 165.019 40.8721C165.189 40.8854 165.362 40.8877 165.534 40.8877H168.852C169.394 40.8756 169.932 40.9828 170.429 41.2017C170.925 41.4206 171.368 41.746 171.727 42.1552C172.833 43.3938 173.103 44.8285 172.479 46.3611C172.224 47.0668 171.763 47.6783 171.157 48.1156C170.551 48.5529 169.828 48.7955 169.082 48.8116C167.956 48.8784 166.824 48.8317 165.694 48.8406C164.749 48.8406 164.809 48.7114 164.809 49.6938C164.809 54.2717 164.844 58.8496 164.793 63.4253C164.769 65.6085 166.101 67.2302 168.155 67.8161C168.771 67.9904 169.407 68.0744 170.046 68.0656C170.414 68.0656 170.783 68.0656 171.152 68.0656C171.189 68.0617 171.226 68.0661 171.261 68.0786C171.296 68.0912 171.328 68.1115 171.354 68.1381C171.379 68.1646 171.399 68.1968 171.411 68.2321C171.423 68.2673 171.427 68.3049 171.422 68.3419C171.422 68.4399 171.422 68.5401 171.422 68.6382V75.3925C171.422 75.5173 171.422 75.6398 171.422 75.7623C171.422 75.7936 171.416 75.8245 171.403 75.8531C171.391 75.8817 171.373 75.9073 171.35 75.9283C171.327 75.9493 171.3 75.9652 171.27 75.975C171.241 75.9848 171.21 75.9882 171.179 75.9851H170.885C168.306 75.9851 165.727 76.0163 163.143 75.974C161.4 75.9688 159.668 75.6853 158.012 75.1341C156.699 74.7069 155.495 73.9934 154.487 73.0445C153.124 71.7347 152.346 70.1107 151.928 68.2906C151.638 66.9855 151.498 65.6514 151.509 64.3142C151.514 62.0122 151.515 59.7103 151.512 57.4083Z" fill="currentColor"/>
      <path d="M274.989 53.4241C274.989 60.6508 274.989 67.8767 274.989 75.1019C274.989 76.0977 275.098 75.993 274.142 75.993H262.577C262.404 75.993 262.234 75.993 262.061 75.993C261.774 75.9818 261.734 75.9395 261.723 75.6365C261.723 75.4628 261.723 75.289 261.723 75.1153C261.723 60.7896 261.723 46.4626 261.723 32.134C261.69 30.8413 262.016 29.5649 262.665 28.4494C263.352 27.2962 264.368 26.3781 265.58 25.8146C266.793 25.251 268.145 25.0682 269.462 25.2898C270.779 25.5114 271.999 26.1273 272.964 27.0572C273.928 27.987 274.592 29.1879 274.87 30.5033C274.965 30.9888 275.008 31.4832 274.998 31.978C274.991 39.1245 274.988 46.2732 274.989 53.4241Z" fill="currentColor"/>
      <path d="M55.2947 47.2888C55.5191 47.1644 55.7045 46.9792 55.8299 46.7542C57.0965 45.0749 58.6507 43.637 60.4194 42.5082C62.7419 41.0358 65.4436 40.285 68.1871 40.3495C70.1778 40.3874 71.7525 41.2183 72.77 42.9649C73.38 43.9669 73.6294 45.1498 73.4764 46.315C73.3234 47.4803 72.7772 48.5572 71.9295 49.3651C71.5094 49.7815 71.0616 50.1685 70.5891 50.5235C68.7335 51.8356 66.8004 51.8601 64.8275 50.7975C64.4013 50.5489 64.0062 50.2497 63.6508 49.9064C63.1415 49.4354 62.5184 49.1074 61.8438 48.9552C60.6693 48.7012 59.6585 49.042 58.7782 49.8217C58.247 50.3046 57.8156 50.8883 57.5087 51.5393C56.9075 52.8165 56.5389 54.192 56.4205 55.6004C56.3303 56.4885 56.289 57.3809 56.2966 58.2736C56.2966 63.9171 56.2966 69.5607 56.2966 75.2042C56.2966 76.0952 56.3718 76.0039 55.5114 76.0039H43.7226C42.9684 76.0039 42.9972 76.0663 42.9972 75.2866C42.9972 68.0094 42.9972 60.7323 42.9972 53.4551C42.9972 51.2274 42.9972 48.9997 42.9972 46.772C42.9775 45.6787 43.2307 44.5978 43.7337 43.6287C44.374 42.4246 45.3918 41.4677 46.6285 40.9072C47.8652 40.3466 49.2513 40.2139 50.5707 40.5297C51.8902 40.8456 53.0688 41.5922 53.9228 42.6532C54.7769 43.7142 55.2585 45.03 55.2925 46.3955C55.2991 46.6517 55.2947 46.9213 55.2947 47.2888Z" fill="currentColor"/>
      <path d="M189.186 61.4459C189.186 65.9978 189.186 70.549 189.186 75.0995C189.186 76.1042 189.284 75.9906 188.342 75.9906C184.464 75.9906 180.586 75.9906 176.708 75.9906C175.823 75.9906 175.898 76.1242 175.898 75.144V62.6689C175.898 57.6967 175.898 52.7252 175.898 47.7544C175.898 46.195 176.292 44.7582 177.256 43.5329C179.012 41.3052 181.324 40.4431 184.057 41.0825C186.791 41.7218 188.417 43.5329 189.06 46.2463C189.163 46.7301 189.209 47.2242 189.198 47.7188C189.184 52.293 189.181 56.8687 189.186 61.4459Z" fill="currentColor"/>
      <path d="M182.525 25.2052C182.894 25.2052 183.261 25.2052 183.631 25.2052C185.993 25.154 188.581 26.9607 189.098 29.8834C189.345 31.2975 189.052 32.7531 188.279 33.9595C187.506 35.1658 186.31 36.034 184.929 36.3905C184.788 36.4304 184.645 36.4617 184.5 36.4841C183.257 36.6352 182 36.6404 180.755 36.4997C179.451 36.3145 178.251 35.6757 177.365 34.6938C176.479 33.7118 175.961 32.4487 175.902 31.1229C175.843 29.7972 176.246 28.4924 177.042 27.4345C177.837 26.3765 178.975 25.6321 180.258 25.33C180.639 25.24 181.029 25.1951 181.421 25.1963L182.525 25.2052Z" fill="currentColor"/>
      <path d="M17.2666 57.9817C17.1449 58.2356 17.2068 58.5096 17.2068 58.7725C17.2068 63.5249 17.2068 68.2774 17.2068 73.0298C17.2125 74.2234 16.918 75.399 16.3509 76.4471C15.6603 77.7145 14.5892 78.7292 13.2911 79.3459C11.9929 79.9627 10.5342 80.1498 9.12403 79.8805C7.71381 79.6112 6.42438 78.8993 5.44043 77.8468C4.45648 76.7943 3.82848 75.4551 3.6464 74.0211C3.60514 73.6781 3.58372 73.333 3.58226 72.9875C3.58226 61.8245 3.54908 50.6615 3.59331 39.4984C3.61101 34.4772 5.48439 30.1978 9.08959 26.7181C11.1377 24.7421 13.5375 23.3142 16.1496 22.2271C18.7702 21.1623 21.5091 20.421 24.3067 20.0194C26.9803 19.6312 29.6784 19.4384 32.3797 19.4424C34.1403 19.4568 35.827 20.1579 37.0852 21.3985C38.3435 22.639 39.0754 24.3225 39.1272 26.0951C39.179 27.8678 38.5467 29.5917 37.3631 30.9046C36.1795 32.2176 34.5368 33.0174 32.78 33.1361C32.0457 33.1762 31.3092 33.1762 30.5682 33.203C28.0628 33.2603 25.5735 33.6223 23.1543 34.2812C22.1351 34.5622 21.1482 34.9512 20.2104 35.4418C19.7103 35.7067 19.2369 36.0201 18.7971 36.3774C17.7642 37.2173 17.1737 38.2843 17.1825 39.6455C17.1767 40.0175 17.1944 40.3895 17.2356 40.7593C17.3708 41.7504 17.8773 42.6518 18.6511 43.2789C19.5672 44.0309 20.6185 44.5981 21.7476 44.9496C23.4504 45.5211 25.2345 45.8085 27.0294 45.8006C27.3722 45.8006 27.715 45.7494 28.0578 45.7271C31.0061 45.5221 33.3219 46.6405 34.7728 49.2446C35.2854 50.1663 35.5787 51.1951 35.6297 52.2502C35.6807 53.3053 35.488 54.358 35.0668 55.3255C34.6456 56.2929 34.0074 57.1488 33.2022 57.8257C32.3971 58.5027 31.447 58.9824 30.4267 59.227C29.7804 59.3758 29.1209 59.4587 28.4582 59.4742C26.8352 59.5561 25.2084 59.5114 23.5922 59.3406C21.6413 59.118 19.7158 58.7093 17.8416 58.1198C17.6609 58.0357 17.4654 57.9888 17.2666 57.9817Z" fill="#0B58FF"/>
      <path d="M9.1809 18.7724C4.38134 18.8593 -0.0024175 14.8383 0.00421785 9.52971C-0.0330545 8.29147 0.177013 7.05831 0.621953 5.9034C1.06689 4.74849 1.73764 3.69538 2.59439 2.80655C3.45114 1.91772 4.47643 1.21129 5.60942 0.729182C6.74241 0.247072 7.96001 -0.000893105 9.18996 2.41698e-06C10.4199 0.000897939 11.6372 0.250634 12.7695 0.734393C13.9018 1.21815 14.926 1.92608 15.7815 2.81615C16.637 3.70623 17.3062 4.76032 17.7495 5.91588C18.1928 7.07143 18.4011 8.30489 18.362 9.54308C18.3598 14.845 14.0137 18.8638 9.1809 18.7724Z" fill="#68DEFF"/>
    </svg>
  );
}

interface ProData {
  id: string;
  name: string;
  categories: string[];
  regions: string[];
  languages: string[];
  isNationwide: boolean;
  image: string;
  images: string[];
  intro: string;
  price: number;
  experience: number;
  tags: string[];
  available: boolean;
  youtubeId?: string;
  isPartner?: boolean;
  avgRating?: number;      // BEST 포디움 — 랭킹 안 매긴 사회자의 정렬 기준(실제 평점)
  reviewCount?: number;
  rankOrder?: number | null; // 어드민 '사회자 랭킹'(작을수록 위) — BEST 는 이 순서가 먼저
}

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

function formatCareerLabel(years?: number) {
  return years && years > 0 ? `경력 ${years}년` : '경력 확인중';
}

function mapDiscoveryProToHomePro(p: any): ProData {
  return {
    id: p.id,
    name: p.name,
    categories: p.categories || [],
    regions: p.regions || [],
    languages: p.languages || [],
    isNationwide: p.isNationwide ?? false,
    image: p.images?.[0] || p.profileImageUrl || '',
    images: p.images || [],
    intro: p.shortIntro || '',
    price: 0,
    experience: p.careerYears || 0,
    tags: (Array.isArray(p.tags) && p.tags.length > 0)
      ? p.tags
      : (p.isFeatured ? ['인기'] : (p.isNationwide ? ['전국가능'] : [])),
    available: true,
    youtubeId: extractYoutubeId(p.youtubeUrl),
    isPartner: p.showPartnersLogo || p.isFeatured || false,
    avgRating: Number(p.avgRating) || 0,
    reviewCount: Number(p.reviewCount) || 0,
    rankOrder: typeof p.rankOrder === 'number' ? p.rankOrder : null,
  };
}

function sortByHomeRank(items: ProData[]) {
  return [...items].sort((a, b) =>
    (b.experience ?? 0) - (a.experience ?? 0)
    || a.name.localeCompare(b.name, 'ko')
  );
}

function seededHash(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffleProsBySeed(items: ProData[], seed: string) {
  return [...items].sort((a, b) =>
    seededHash(`${seed}:${a.id}:${a.name}`) - seededHash(`${seed}:${b.id}:${b.name}`)
  );
}

function isWeddingMcPro(pro: ProData) {
  return pro.categories.some((category) => {
    const value = category.toLowerCase();
    return value.includes('결혼식') || value.includes('사회자') || value.includes('mc');
  });
}

/** 결혼식 태그 사회자 — 태그·분류에 '결혼식'(260926 사장 '프리티풀의 더 많은 결혼식 사회자'). isWeddingMcPro 는 '사회자' 분류면 다 통과라 따로 */
function isWeddingTaggedPro(pro: ProData) {
  return [...pro.categories, ...pro.tags].some((value) => value.toLowerCase().includes('결혼식'));
}

function isEventMcPro(pro: ProData) {
  const values = [...pro.categories, ...pro.tags].map((value) => value.toLowerCase());
  return values.some((value) =>
    value.includes('행사')
    || value.includes('기업')
    || value.includes('컨퍼런스')
    || value.includes('컨벤션')
    || value.includes('쇼호스트')
    || value.includes('event')
  );
}

const HOME_HERO_PROFILE_FALLBACK_IMAGES = [
  '/images/pro-15/IMG_0196.avif',
  '/images/pro-23/IMG_46511771924269213.avif',
  '/images/pro-12/IMG_27221772621229571.avif',
  '/images/pro-31/IMG_73341772850094485.avif',
  '/images/pro-09/Facetune_10-02-2026-21-07-511772438130235.avif',
  '/images/pro-25/2-11772248201484.avif',
  '/images/pro-01/10000133881772850005043.avif',
  '/images/pro-18/20161016_161406_IMG_5921.avif',
  '/images/pro-05/10000029811773033474612.avif',
  '/images/pro-34/IMG_2920.avif',
  '/images/pro-24/10001176941772847263491.avif',
  '/images/pro-07/IMG_53011772965035335.avif',
  '/images/pro-03/IMG_06781773894450803.avif',
  '/images/pro-22/10000353831773035180593.avif',
  '/images/pro-10/10000016211774440274171.avif',
  '/images/pro-28/IMG_002209_01772081523241.avif',
  '/images/pro-36/IMG_27041773036338469.avif',
  '/images/pro-14/IMG_02661773035503788.avif',
  '/images/pro-38/IMG_34281772111635068.avif',
  '/images/pro-04/IMG_23601771788594274.avif',
  '/images/pro-41/IMG_12201772513865121.avif',
];

function HomeHeroProfileMarqueeRow({
  images,
  direction = 'left',
  speed = 80,
}: {
  images: string[];
  direction?: 'left' | 'right';
  speed?: number;
}) {
  const repeated = [...images, ...images, ...images];
  return (
    <div
      className={`home-hero-profile-track home-hero-profile-track-${direction} flex w-max gap-4`}
      style={{ '--home-hero-profile-speed': `${speed}s` } as React.CSSProperties}
    >
      {repeated.map((src, index) => (
        <div
          key={`${src}-${index}`}
          className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-full border border-white/70 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.14)] xl:h-[104px] xl:w-[104px]"
        >
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
            loading="lazy"
            decoding="async"
            onError={(e) => { e.currentTarget.src = '/images/default-profile.png'; }}
          />
        </div>
      ))}
    </div>
  );
}

function HomeHeroProfileMarquee({ images }: { images: string[] }) {
  const profileImages = useMemo(() => {
    const merged = [...images, ...HOME_HERO_PROFILE_FALLBACK_IMAGES]
      .filter((src) => src && !src.includes('default-profile'));
    return Array.from(new Set(merged)).slice(0, 24);
  }, [images]);

  const rows = [
    profileImages.slice(0, 8),
    profileImages.slice(8, 16),
    profileImages.slice(16, 24),
  ].filter((row) => row.length > 0);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[600px] overflow-hidden">
      <div
        className="absolute left-1/2 top-0 flex -translate-x-1/2 flex-col gap-5 opacity-[0.31] xl:opacity-[0.34]"
        style={{ transform: 'translateX(-50%) rotate(-12deg) scale(1.18)', transformOrigin: 'center' }}
      >
        {rows.map((row, index) => (
          <HomeHeroProfileMarqueeRow
            key={index}
            images={index % 2 === 0 ? row : [...row].reverse()}
            direction={index % 2 === 0 ? 'left' : 'right'}
            speed={index === 0 ? 84 : index === 1 ? 96 : 90}
          />
        ))}
        <HomeHeroProfileMarqueeRow
          images={[...profileImages.slice(0, 8)].reverse()}
          direction="right"
          speed={104}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/54 to-white" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.24),rgba(255,255,255,0.82)_78%)]" />
    </div>
  );
}

function proCategoryHref(category: string) {
  return `/pros?category=${encodeURIComponent(category)}`;
}

/* placeholder to anchor subsequent edits */
// ─── Business Partners (기업회원) ──────────────────────────────
interface BusinessPartner {
  id: string;
  category: string;
  categories: string[];
  name: string;
  location: string;
  images: string[];
  tags: string[];
  isPopular: boolean;
  originalPrice: number;
  discountPercent: number;
}

const BIZ_CATEGORIES = WEDDING_PARTNER_CATEGORY_TABS;
const WEDDING_PARTNER_SECTION_ORDER = BIZ_CATEGORIES.filter((category) => category !== '전체');

// 실제 파트너십 데이터는 /api/v1/business 에서 로드 (목업 데이터 제거됨)
const HOME_PROS_CACHE_KEY = 'freetiful-pros-cache-v6';
const BUSINESS_CACHE_KEY = 'freetiful-home-business-cache-v7';
const BUSINESS_CACHE_TTL = 5 * 60_000;
const BUSINESS_REQUEST_VERSION = '20260429-category-quality';

/** 웨딩 파트너 카드 — 공용 사진 색 카드(components/business/PartnerToneCard, 목록 페이지와 같은 카드) */
function BusinessCard({
  biz,
  index = 0,
  wrapperClassName,
  wrapperStyle,
}: {
  biz: BusinessPartner;
  index?: number;
  /** 가로열의 한 칸. 카드가 렌더되지 않을 땐 이 칸도 같이 사라져야 빈칸이 안 남는다 */
  wrapperClassName?: string;
  wrapperStyle?: CSSProperties;
}) {
  return (
    <PartnerToneCard
      biz={{ id: biz.id, name: biz.name, location: biz.location, images: biz.images, tags: biz.tags, discountPercent: biz.discountPercent }}
      index={index}
      wrapperClassName={wrapperClassName}
      wrapperStyle={wrapperStyle}
    />
  );
}
/**
 * 웨딩 파트너 한 섹션(제목 + 가로 카드열).
 * 전체보기 옆 화살표로 한 칸씩 밀어 본다 — 스크롤 위치를 알아야 해서
 * 헤더와 카드열을 한 컴포넌트로 묶었다.
 */
function BusinessPartnerSection({
  category, businesses, showDivider,
}: {
  category: string;
  businesses: BusinessPartner[];
  showDivider: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  /** PC 한 줄에 놓을 칸 수 — 업체가 적으면 그만큼만 나눠 빈칸이 생기지 않게 */
  const pcCols = Math.min(3, Math.max(1, businesses.length));
  const partnerIconFile = (WEDDING_PARTNER_CATEGORY_ICONS as Record<string, string | undefined>)[category];
  const partnerIcon = partnerIconFile ? `${HOME_CATEGORY_ICON_DIR}/${partnerIconFile}` : null;

  const syncEdges = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    syncEdges();
    const el = rowRef.current;
    if (!el) return;
    el.addEventListener('scroll', syncEdges, { passive: true });
    return () => el.removeEventListener('scroll', syncEdges);
  }, [syncEdges, businesses.length]);

  const nudge = (dir: -1 | 1) => {
    const el = rowRef.current;
    if (!el) return;
    // 카드 하나 + 간격만큼 민다
    const step = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? el.clientWidth / 3;
    el.scrollBy({ left: dir * (step + 8), behavior: 'smooth' });
  };

  const arrowCls =
    'hidden h-9 w-9 items-center justify-center rounded-full bg-[#F2F3F5] text-[#51535C] transition-colors hover:bg-[#E9EBEF] disabled:cursor-default disabled:text-[#D8DDE4] disabled:hover:bg-[#F2F3F5] lg:flex';

  return (
    <section>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* 앞 그림 = 홈 카테고리 칸과 같은 컬러 일러스트(샹들리에·드레스·카메라…) — 사회자 섹션처럼 배경 없이 48(PC 56), 모바일도(260926 사장) */}
            {partnerIcon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={partnerIcon} alt="" className="h-12 w-12 shrink-0 object-contain lg:h-14 lg:w-14" />
            ) : (
              <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EAF2FF] lg:flex">
                <PartnerCategoryIcon category={category} size={24} />
              </span>
            )}
            <div>
              <h3 className="section-title">{category}</h3>
              <p className="section-subtitle mt-1">프리티풀이 엄선한 {category} 업체를 만나보세요</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => nudge(-1)} disabled={atStart} className={arrowCls} aria-label={`이전 ${category}`}>
              <ChevronLeftIcon size={16} />
            </button>
            <button type="button" onClick={() => nudge(1)} disabled={atEnd} className={arrowCls} aria-label={`다음 ${category}`}>
              <ChevronRightIcon size={16} />
            </button>
            <Link
              href={`/businesses?category=${encodeURIComponent(category)}`}
              className="text-[13px] text-gray-400 font-medium flex items-center gap-0.5 hover:text-gray-600"
              style={{ transition: 'color 0.3s' }}
            >
              전체보기 <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </div>
      {/* 가로로 넘기는 줄은 세로로 넘치는 부분을 자른다 — 카드 테두리가 줄 위아래 끝에 딱 붙으면 폰 픽셀 위치에 따라 테두리선이 반쯤 잘려
          위아래가 잘려 보였다(260926 사장 제보). 위아래 8px 여유 + 같은 만큼 음수 여백으로 자리는 그대로 */}
      <div
        ref={rowRef}
        className="-mx-[10px] -my-2 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-pl-[10px] px-[10px] py-2 scrollbar-hide lg:gap-2"
      >
        {/* 업체가 2곳뿐인 카테고리는 3칸으로 나누면 오른쪽이 비어 보인다 */}
        {businesses.map((biz, i) => (
          <BusinessCard
            key={`${category}-${biz.id}`}
            biz={biz}
            index={i}
            wrapperClassName="w-[78%] shrink-0 snap-start lg:w-[var(--pc-card-w)]"
            wrapperStyle={{ ['--pc-card-w' as string]: `calc((100% - ${(pcCols - 1) * 8}px) / ${pcCols})` } as CSSProperties}
          />
        ))}
      </div>
      {/* 섹션 사이 — 줄 없이 간격만(260926 사장 '웨딩파트너 각 섹션 하단 줄 없애줘' → '홈 각 섹션 얇은 줄 없애줘', PC 도) */}
      {showDivider && <div aria-hidden className="h-7 lg:h-12" />}
    </section>
  );
}

function getBusinessPartnerSections(businesses: BusinessPartner[]) {
  const grouped = new Map<string, BusinessPartner[]>();

  businesses.forEach((business) => {
    const categories = business.categories.length > 0 ? business.categories : [business.category];
    categories
      .filter((category) => category && category !== '전체' && category !== '인기')
      .forEach((category) => {
        const items = grouped.get(category) || [];
        items.push(business);
        grouped.set(category, items);
      });
  });

  const orderedCategories = [
    ...WEDDING_PARTNER_SECTION_ORDER,
    ...Array.from(grouped.keys()).filter((category) => !WEDDING_PARTNER_SECTION_ORDER.includes(category)),
  ];

  // 스냅·헤어는 뒤쪽 업체가 먼저 보이도록 순서를 뒤집는다(요청)
  const REVERSED_SECTIONS = ['스냅', '헤어'];

  return orderedCategories
    .map((category) => {
      // 사진이 없는 업체는 카드가 통째로 렌더되지 않아 줄에 빈칸만 남는다 → 아예 뺀다
      const withImage = (grouped.get(category) || []).filter((b) => Boolean(b.images?.[0]));
      const sorted = sortPopularPartnersFirst(withImage);
      return {
        category,
        businesses: REVERSED_SECTIONS.includes(category) ? [...sorted].reverse() : sorted,
      };
    })
    .filter((section) => section.businesses.length > 0);
}

const BANNERS = [
  { id: 'b1', title: '', subtitle: '', bgColor: '', image: '/images/frame-1707490590.png', linkUrl: '/my/invite' },
  { id: 'b2', title: '', subtitle: '', bgColor: '', image: '/images/frame-1707490591.png', linkUrl: null },
];

/**
 * 홈 맨 위 배너(모바일) — 4:3 · 모서리 5(260926 사장 "배너 너무 얇다, 홈 최상단으로, 가로4 세로3, r값 5").
 * 사장이 준 4:3 배너 5장(public/images/banners). 예전 얇은 배너(관리자 'home' 1170:300)는 4:3 에 넣으면 크게 잘려서 모바일에선 안 쓴다
 * (PC 첫 화면·iOS 네이티브 홈은 그대로 관리자 배너). 누르면: 가입 5천원 = 비로그인 가입 창·로그인 시 친구 초대 / 빌라드지디 = 웨딩홀 목록
 * (맨 위 빌라드지디 소개) / 결혼식사회자 1등 = 퀵매칭 / 슈슈몽드·세라미크 = 업체 페이지가 없어 이동 없음.
 */
/**
 * 홈 퀵매칭·웨딩숲 바로가기(모바일, 홈 맨 위) — 사장 제공 사진 8:3(public/images/home, 1200 폭으로 줄임). 퀵매칭 버튼 '빠른찾기' 260927 사장,
 * 퀵매칭 사진은 파란 꽃 여자 사회자로 교체(260927). 260928 사장: 설명 줄을 빼고 제목 위 작은 글씨(kicker)로 — '결혼식사회자 / 퀵매칭', '예비부부 커뮤니티 / 웨딩숲'.
 */
const HOME_SHORTCUTS = [
  { href: '/quick-match', image: '/images/home/shortcut-quick-match-blue.webp', tallImage: '/images/home/pc-quick-match-tall.webp', kicker: '결혼식사회자', title: '퀵매칭', cta: '빠른찾기' },
  { href: '/community', image: '/images/home/shortcut-wedding-forest.webp', tallImage: '/images/home/pc-wedding-forest-tall.webp', kicker: '예비부부 커뮤니티', title: '웨딩숲', cta: '구경하기' },
];

/**
 * 퀵매칭 · 웨딩숲 바로가기(모바일, 홈 맨 위) — 사장 사진(8:3) 두 장, 모서리 5, 간격 10(좌우 여백과 같게), 왼쪽 흐린 자리에 흰 제목·설명·작은 유리 버튼.
 * 260927 사장: 웨딩숲을 퀵매칭 뒤에 접어 두던 효과(스크롤하면 펼침)는 없앴다 — 두 장 다 그대로 보인다.
 * 첫 진입 등장(fadeSlideUp)과 누름 효과(active:scale)가 서로 transform 을 덮어쓰지 않게 칸을 나눠 건다.
 */
/** × 로 닫으면 30분 동안 안 뜬다(260927 사장 — 처음엔 7일, 그다음 '다시 뜨게', 지금 30분) */
const QM_BUBBLE_HIDE_KEY = 'ft-home-qm-bubble-hide-until';
const QM_BUBBLE_HIDE_MS = 30 * 60 * 1000;
/** 꼬리 끝과 '빠른찾기' 버튼 아래 사이 간격(260927 사장 '빠른찾기 버튼 쪽으로 좀 올려줘') */
const QM_BUBBLE_GAP = 5;
/** 말풍선 좌우 = 카드와 같은 여백(바로가기 묶음 px-[10px]) */
const QM_BUBBLE_INSET = 10;

/**
 * 퀵매칭 말풍선(홈, 모바일) — 토스 하단 탭 말풍선을 그대로, 꼬리만 위로 뒤집어 퀵매칭 카드 '빠른찾기'를 가리킨다(260927 사장).
 *  · 모양(토스 화면 3배 해상도 실측 — 사장이 보낸 '물티슈' 말풍선): 모서리 26·꼬리 28×12.5(옆면 52°·밑동 오목·끝 둥글게),
 *    왼쪽 아이콘(사장 아이콘 세트 icon-emoji-fire 를 푸른 불꽃으로), 제목 17 굵게 — 앞쪽 44% 는 파랑 #2955B5 에서 남색으로 짙어져
 *    검은 본문으로 이어지는 그라데이션(토스 글자 속 색을 구간별로 잰 값), 부제 15 회색, 오른쪽 위 회색 원 ×.
 *  · 바탕(260927 사장 '꼬리부터 35% 까지 오퍼시티 80 에 블러, 그림자 아주 옅게, 말풍선 그라데이션 아주 옅게'): 꼬리 쪽이 옅은 푸른 흰색 80%
 *    + 뒤 흐림(backdrop blur), 35% 에서 불투명 흰색 · 그림자는 아래로만 옅게. 바탕은 꼬리+몸통 한 장(QuickMatchBubbleGlass).
 *    → 흐림이 먹으려면 조상에 filter·opacity<1·mask 가 없어야 해서(Backdrop Root) 카드 칸(등장 애니 fadeSlideUp 끝값이 filter:blur(0))
 *      밖, 바로가기 묶음에 바로 붙이고, 투명도 애니도 흐림을 가진 유리에 직접 건다(globals .qm-bubble).
 *  · 자리: '빠른찾기' 버튼을 재서(offset — 등장 애니 transform 영향 없음) 꼬리 끝을 버튼 아래 5 · 버튼 가운데에 둔다. 글꼴·폭이 바뀌면 다시 잰다.
 *  · 등장(토스 화면 녹화 프레임별 실측): 꼬리를 기준으로 납작하게(가로 53%·세로 16%·투명 20%) 나타나 0.2초에 제 크기
 *    (1.3% 살짝 넘침), 그동안 꼬리 쪽으로 10 붙어 있다가 반대로 6.3 넘어갔다 0.87초에 제자리. 아이콘·글씨는 조금 늦게(~0.38초) 진해진다.
 *  · 누르면 퀵매칭. × 는 30분 동안 안 보이게(QM_BUBBLE_HIDE_MS). 제목 '맞춤 사회자'(260927 사장, 처음엔 '인기 사회자').
 */
function QuickMatchBubble({ delay, containerRef, anchorRef }: { delay: number; containerRef: RefObject<HTMLDivElement>; anchorRef: RefObject<HTMLSpanElement> }) {
  const router = useRouter();
  const gradId = useId().replace(/:/g, '');
  const [phase, setPhase] = useState<'hidden' | 'in' | 'out'>('hidden');
  const [pos, setPos] = useState<{ top: number; tailX: number } | null>(null);
  const visible = phase !== 'hidden';
  useEffect(() => {
    try { if (Number(localStorage.getItem(QM_BUBBLE_HIDE_KEY) || 0) > Date.now()) return; } catch { /* 저장소 막힘 — 그냥 띄운다 */ }
    const t = window.setTimeout(() => setPhase('in'), delay);
    return () => window.clearTimeout(t);
  }, [delay]);
  useLayoutEffect(() => {
    if (!visible) return;
    const box = containerRef.current;
    const anchor = anchorRef.current;
    if (!box || !anchor) return;
    const measure = () => {
      let x = 0;
      let y = 0;
      let el: HTMLElement | null = anchor;
      while (el && el !== box) {
        x += el.offsetLeft;
        y += el.offsetTop;
        el = el.offsetParent as HTMLElement | null;
      }
      if (el !== box) return;
      setPos({ top: Math.round(y + anchor.offsetHeight + QM_BUBBLE_GAP), tailX: Math.round(x + anchor.offsetWidth / 2 - QM_BUBBLE_INSET) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(anchor);
    return () => ro.disconnect();
  }, [visible, containerRef, anchorRef]);
  if (!visible || !pos) return null;
  const close = (e: React.MouseEvent) => {
    e.stopPropagation();
    try { localStorage.setItem(QM_BUBBLE_HIDE_KEY, String(Date.now() + QM_BUBBLE_HIDE_MS)); } catch { /* 이번만 닫힘 */ }
    setPhase('out');
    window.setTimeout(() => setPhase('hidden'), 200);
  };
  const go = () => router.push('/quick-match');
  return (
    <div
      className={`qm-bubble${phase === 'out' ? ' is-out' : ''}`}
      style={{ top: pos.top, left: QM_BUBBLE_INSET, right: QM_BUBBLE_INSET, '--tail-x': `${pos.tailX}px` } as CSSProperties}
      role="link"
      tabIndex={0}
      aria-label="맞춤 사회자, 1분 만에 찾아요. 빠른찾기로 딱 맞는 사회자 추천받기"
      onClick={go}
      onKeyDown={(e) => { if (e.key === 'Enter') go(); }}
    >
      {/* 그림자(몸통 바깥에만 그려져 반투명한 윗부분에 안 비친다) → 유리(꼬리+몸통 한 장) → 글씨 */}
      <span className="qm-bubble-shadow" aria-hidden="true" />
      <QuickMatchBubbleGlass tailX={pos.tailX} />
      <div className="qm-bubble-body">
        <span className="qm-bubble-ic" aria-hidden="true">
          {/* 사장 아이콘 세트 icon-emoji-fire — 푸른 불꽃(260927 사장), 색은 토스 파랑 아이콘(#4A82EA·밝은 #CBE2FA) 결 */}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <defs>
              <linearGradient id={`${gradId}-o`} x1="12" y1="1.5" x2="12" y2="22.2" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#62A0F8" />
                <stop offset="0.55" stopColor="#4A82EA" />
                <stop offset="1" stopColor="#3566DA" />
              </linearGradient>
              <linearGradient id={`${gradId}-i`} x1="12.3" y1="11.9" x2="12.3" y2="21.2" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#EAF4FF" />
                <stop offset="1" stopColor="#B6D5FA" />
              </linearGradient>
            </defs>
            <path d="M18.9999 6.50004C19.1999 8.10004 19.4999 9.10004 18.3999 9.10004C16.7999 9.10004 16.7999 5.30004 14.0999 3.20004C11.3999 1.00004 9.4999 1.50004 9.3999 1.60004C11.5999 3.50004 10.3999 6.50004 8.8999 7.30004C7.4999 8.10004 5.9999 7.10004 6.7999 4.70004C4.9999 7.20004 3.3999 10.3 3.3999 13.3C3.3999 18.2 7.3999 22.2 12.2999 22.2C17.1999 22.2 21.1999 18.2 21.1999 13.3C21.2999 10.9 20.2999 8.60004 18.9999 6.50004Z" fill={`url(#${gradId}-o)`} />
            <path d="M12.2999 11.8999C12.2999 11.8999 16.1999 14.0999 16.1999 17.2999C16.1999 19.3999 14.4999 21.1999 12.2999 21.1999C10.0999 21.1999 8.3999 19.4999 8.3999 17.2999C8.3999 14.0999 12.2999 11.8999 12.2999 11.8999Z" fill={`url(#${gradId}-i)`} />
          </svg>
        </span>
        <p className="qm-bubble-title">맞춤 사회자, 1분 만에 찾아요.</p>
        <p className="qm-bubble-sub">빠른찾기로 딱 맞는 사회자 추천받기</p>
        <button type="button" className="qm-bubble-x" aria-label="말풍선 닫기" onClick={close}>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function HomeShortcuts({ skipAnim }: { skipAnim: boolean }) {
  // 말풍선 자리 재기 — 묶음(기준)과 퀵매칭 '빠른찾기' 버튼
  const boxRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLSpanElement>(null);
  return (
    <div ref={boxRef} className="relative flex flex-col gap-[10px] px-[10px] pt-[10px]">
      {HOME_SHORTCUTS.map((b, i) => (
        <div
          key={b.href}
          className={skipAnim ? '' : 'opacity-0'}
          style={skipAnim ? undefined : { animation: `fadeSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${0.05 + i * 0.1}s forwards` }}
        >
          <Link
            href={b.href}
            className="relative block overflow-hidden rounded-[5px] bg-[#F2F4F6] transition-transform duration-200 active:scale-[0.98]"
            style={{ aspectRatio: '8 / 3' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.image} alt="" width={1200} height={450} decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            {/* 왼쪽만 옅게 어둡게 — 밝은 사진(웨딩숲 숲 빛)에서도 흰 글자가 읽히게 */}
            <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0.14) 42%, rgba(0,0,0,0) 68%)' }} />
            <div className="absolute inset-y-0 left-0 flex max-w-[64%] flex-col justify-center pl-5" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.22)' }}>
              <p className="break-keep text-[13.5px] font-medium leading-[1.5] tracking-[-0.2px] text-white/90">{b.kicker}</p>
              <p className="text-[21px] font-bold leading-[1.35] tracking-[-0.4px] text-white">{b.title}</p>
              <span
                ref={i === 0 ? ctaRef : undefined}
                className="mt-2.5 inline-flex h-[28px] w-fit items-center gap-0.5 rounded-full pl-3 pr-2 text-[13px] font-semibold tracking-[-0.2px] text-white"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)', WebkitBackdropFilter: 'blur(10px)', backdropFilter: 'blur(10px)', textShadow: 'none' }}
              >
                {b.cta}
                <ChevronRight size={15} />
              </span>
            </div>
          </Link>
        </div>
      ))}
      {/* 카드 칸 밖에 둔다 — 칸의 등장 애니(filter) 안에 있으면 말풍선 뒤 흐림이 안 먹는다 */}
      <QuickMatchBubble delay={skipAnim ? 250 : 850} containerRef={boxRef} anchorRef={ctaRef} />
    </div>
  );
}

const VDGD = '/images/wedding-partners/wedding-hall';
const APP_STORE_URL = 'https://apps.apple.com/nz/app/%ED%94%84%EB%A6%AC%ED%8B%B0%ED%92%80-%EA%B2%B0%ED%98%BC%EC%8B%9D%EC%82%AC%ED%9A%8C%EC%9E%90-%EC%A7%84%ED%96%89%EC%9E%90-%ED%96%89%EC%82%AC-%EC%A0%84%EB%AC%B8%EA%B0%80-%EC%84%AD%EC%99%B8/id6745000474';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.freetiful.freetiful&hl=ko';
// pcCta = PC 배너 위 단추(260929 사장) — signup: 가입 5천원 '바로가기' · stores: 1등 배너 앱 다운로드(App Store · Google Play)
//   · go: 웹 글자 제목 바로 아래 '바로가기'(261007 사장, 프리티풀 비즈) → href
// pcOnly = PC 4:3 배너에만(모바일 8:3 넘김엔 없다 — image 도 없다)
const HOME_TOP_BANNERS: { id: string; image?: string; pcImage: string; alt: string; title?: string[]; href?: string; action?: 'signup'; strip?: BannerStrip; pcCta?: 'signup' | 'stores' | 'go'; pcOnly?: boolean }[] = [
  // 순서(260926 사장): 빌라드지디 → 결혼식사회자 1등 → 슈슈몽드 → 가입 5천원 → 세라미크 — 8:3(260927).
  // 빌라드지디·슈슈몽드·세라미크는 글자 없는 사진 + 제목을 웹 글자로(퀵매칭 제목과 같은 21 굵게), 장이 넘어올 때마다 페이드 업(260927 사장).
  // 결혼식사회자 1등·가입 5천원은 그림에 글자가 들어 있다.
  // pcImage = PC 첫 화면 4:3 판(260928 사장 — 빌라드지디·슈슈몽드·세라미크는 로고만 든 사진, 제목은 같은 웹 글자로).
  // strip = PC 배너 아래 사진 줄(260928 사장 — 오늘의집 카드처럼, 유리 판) · 빌라드지디는 지점마다 대표 사진 한 장 → 그 지점 상세.
  // 사진 4장까지 — 줄이 왼쪽에서 사진 폭의 2/3 안쪽에서 끝나야 오른쪽 아래 로고(VILLA de GD · ChouchouMonde)를 안 가린다(1024 폭 기준).
  { id: 'villadegd', image: '/images/banners/home-top-villadegd-bg.webp', pcImage: '/images/banners/pc-hero-villadegd.webp', title: ['변하지 않는 가치,', '품격 있는 웨딩의 시작', '빌라드지디'], alt: '변하지 않는 가치, 품격 있는 웨딩의 시작 빌라드지디', href: `/businesses?category=${encodeURIComponent('웨딩홀')}`,
    strip: {
      photos: [
        { src: `${VDGD}/villadegd-cheongdam/01.webp`, href: '/businesses/8afc8e16-edfb-473f-8f60-5654e7cddfe1', label: '청담' },
        { src: `${VDGD}/villadegd-nonhyeon/04.webp`, href: '/businesses/bfd0674b-6295-40a2-8fcc-86704a2c6f10', label: '논현' },
        { src: `${VDGD}/villadegd-suseo/01.webp`, href: '/businesses/69df8352-1b66-4f9d-af54-1576f6b9d9f3', label: '수서' },
        { src: `${VDGD}/villadegd-anyang/01.webp`, href: '/businesses/eb492956-bbf5-4c61-b6e4-441b4a964877', label: '안양' },
      ],
      moreHref: `/businesses?category=${encodeURIComponent('웨딩홀')}`,
    } },
  { id: 'mc-no1', image: '/images/banners/home-top-mc-no1-8x3.webp', pcImage: '/images/banners/pc-hero-mc-no1.webp', alt: '프리티풀 결혼식사회자 1등 매칭 플랫폼', href: '/quick-match', pcCta: 'stores' },
  // 프리티풀 비즈 — PC 전용(261007 사장 '프리티풀 비즈 배너, PC 에서만, 배너 글은 네가 쓰고 바로가기 버튼도'). 사진 오른쪽 아래에 Freetiful BIZ 로고가 들어 있어
  // 제목·단추는 왼쪽 위. 결혼식사회자 1등 다음 = 프리티풀 자기 배너끼리 붙인다.
  { id: 'biz', pcImage: '/images/banners/pc-hero-biz.webp', title: ['믿을 수 있는 파트너,', '기업 행사의 품격을 높이는', '프리티풀 비즈'], alt: '믿을 수 있는 파트너, 기업 행사의 품격을 높이는 프리티풀 비즈', href: '/biz', pcCta: 'go', pcOnly: true },
  // 슈슈몽드 강남 — 제휴 웨딩홀 사진(다이렉트결혼준비, 업체 상세와 같은 사진) · 배너·사진 모두 업체 상세로
  { id: 'chouchoumonde', image: '/images/banners/home-top-chouchoumonde-bg.webp', pcImage: '/images/banners/pc-hero-chouchoumonde.webp', title: ['빛과 정원이 머무는,', '품격 있는 웨딩의 시작', '슈슈몽드'], alt: '빛과 정원이 머무는, 품격 있는 웨딩의 시작 슈슈몽드', href: '/businesses/78c08b05-2378-412f-8a61-d478c785a206',
    strip: {
      photos: [
        { src: 'https://cdn.prod.website-files.com/66a1eeaa00f1c86c3dbae974/66e002d586b4b4bef8e0a619_1491381951_img_4559_0_1707118657.avif', href: '/businesses/78c08b05-2378-412f-8a61-d478c785a206' },
        { src: 'https://cdn.prod.website-files.com/66a1eeaa00f1c86c3dbae974/66e002d486b4b4bef8e0a5c6_1491381951_img_4559_1_1707118657.avif', href: '/businesses/78c08b05-2378-412f-8a61-d478c785a206' },
        { src: 'https://cdn.prod.website-files.com/66a1eeaa00f1c86c3dbae974/66e002d486b4b4bef8e0a5b4_1491381951_img_4559_2_1707118657.avif', href: '/businesses/78c08b05-2378-412f-8a61-d478c785a206' },
        { src: 'https://cdn.prod.website-files.com/66a1eeaa00f1c86c3dbae974/66e002d486b4b4bef8e0a518_1491381951_img_4559_3_1707118657.avif', href: '/businesses/78c08b05-2378-412f-8a61-d478c785a206' },
      ],
      moreHref: '/businesses/78c08b05-2378-412f-8a61-d478c785a206',
      // 사진 왼쪽 아래 안내 문구('프리미엄 가든 웨딩홀에서…', 높이 84~93%) 위로 띄운다
      bottom: '19%',
    } },
  { id: 'signup-5000', image: '/images/banners/home-top-signup-5000-8x3.webp', pcImage: '/images/banners/pc-hero-signup-5000.webp', alt: '가입만 하면 5,000원 입금 — 신규 가입 완료 시 5천원 지급', action: 'signup', pcCta: 'signup' },
  { id: 'ceramique', image: '/images/banners/home-top-ceramique-bg.webp', pcImage: '/images/banners/pc-hero-ceramique.webp', title: ['아름다움의 새로운 기준,', '세라미크에서', '경험하세요.'], alt: '아름다움의 새로운 기준, 세라미크에서 경험하세요' },
];

/**
 * PC 첫 화면 오른쪽 세로 카드(퀵매칭·웨딩숲) — 260928 사장 '오늘의집 첫 화면처럼, 오른쪽 버튼 2개 같은 비율, 모서리는 모바일과 같게'.
 * 사장이 준 세로 사진(907:1735)을 그대로 비율로 쓰고, 글씨(작은 글씨·제목·유리 버튼)는 위쪽 — 모바일 바로가기와 같은 문구.
 * 마우스를 올리면 사진이 천천히 살짝 커진다.
 */
function PcHeroCard({ href, tallImage, kicker, title, cta }: (typeof HOME_SHORTCUTS)[number]) {
  return (
    <Link
      href={href}
      className="group relative block min-w-0 overflow-hidden rounded-[5px] bg-[#F2F4F6] transition-transform duration-200 active:scale-[0.98]"
      style={{ aspectRatio: '907 / 1735' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={tallImage}
        alt=""
        width={600}
        height={1148}
        decoding="async"
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
      />
      {/* 위쪽만 옅게 어둡게 — 밝은 하늘·숲 빛에서도 흰 글씨가 읽히게 */}
      <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.12) 30%, rgba(0,0,0,0) 52%)' }} />
      <div className="absolute inset-x-0 top-0 p-6 text-left" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.22)' }}>
        <p className="break-keep text-[15px] font-medium leading-[1.5] tracking-[-0.2px] text-white/90">{kicker}</p>
        <p className="text-[27px] font-bold leading-[1.3] tracking-[-0.6px] text-white">{title}</p>
        <span
          className="mt-3.5 inline-flex h-[32px] w-fit items-center gap-0.5 rounded-full pl-3.5 pr-2.5 text-[14px] font-semibold tracking-[-0.2px] text-white"
          style={{ backgroundColor: 'rgba(255,255,255,0.2)', WebkitBackdropFilter: 'blur(10px)', backdropFilter: 'blur(10px)', textShadow: 'none' }}
        >
          {cta}
          <ChevronRight size={16} />
        </span>
      </div>
    </Link>
  );
}

function HomeTopBanner({ variant = 'mobile' }: { variant?: 'mobile' | 'pc' }) {
  // PC 첫 화면 왼쪽 배너도 이 컴포넌트(4:3 판 사진·큰 제목) — 넘김·제목 페이드 업·인디케이터는 모바일과 같다
  const pc = variant === 'pc';
  const router = useRouter();
  const authUser = useAuthStore((st) => st.user);
  const skipAnim = useHomeAnimationSkip();
  const banners = pc ? HOME_TOP_BANNERS : HOME_TOP_BANNERS.filter((b) => !b.pcOnly);
  const count = banners.length;
  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState(0);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const lockRef = useRef(false);
  // 제목 페이드 업 — 들어오는 장은 turn 이 바뀔 때마다 새로 그려 매번 다시 떠오르고, 나가는 장(leaving)은 밀려 나갈 동안 제목을 그대로 둔다
  const idxRef = useRef(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [turn, setTurn] = useState(0);
  const leaveTimerRef = useRef(0);
  const go = (delta: number) => {
    const from = idxRef.current;
    const to = (from + delta + count) % count;
    idxRef.current = to;
    setLeaving(from);
    setIdx(to);
    setTurn((t) => t + 1);
    window.clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = window.setTimeout(() => setLeaving(null), 550);
  };

  // 4초마다 다음 장(끄는 중엔 멈춤)
  useEffect(() => {
    const t = window.setInterval(() => { if (!startRef.current) go(1); }, 4000);
    return () => { window.clearInterval(t); window.clearTimeout(leaveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const finish = (dx: number, dy: number) => {
    setDrag(0);
    if (Math.abs(dx) < 34 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    lockRef.current = true;
    go(dx < 0 ? 1 : -1);
    window.setTimeout(() => { lockRef.current = false; }, 260);
  };
  const open = (b: (typeof HOME_TOP_BANNERS)[number]) => {
    if (lockRef.current) return;
    if (b.action === 'signup') {
      if (authUser) router.push('/my/invite');
      else window.dispatchEvent(new Event('freetiful:show-login'));
      return;
    }
    if (b.href) router.push(b.href);
  };

  return (
    // 첫 진입 등장 — 위에서부터 차례로(퀵매칭 → 웨딩숲 → 카테고리 칸 → 배너), 세션 첫 진입 때만(260926 사장)
    <div
      data-hswipe-ignore
      className={pc ? 'min-w-0' : `-mt-1.5 px-[10px] ${skipAnim ? '' : 'opacity-0'}`}
      style={pc || skipAnim ? undefined : { animation: 'fadeSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards' }}
    >
      <div
        className="relative w-full select-none overflow-hidden rounded-[5px] bg-[#F2F4F6]"
        style={{ aspectRatio: pc ? '4 / 3' : '8 / 3', touchAction: 'pan-y' }}
        onPointerDown={(e) => {
          // 사진 줄(링크)에서 시작한 누름은 넘기기로 잡지 않는다 — 잡으면(pointer capture) 링크 눌림이 배너로 가 버린다
          if ((e.target as HTMLElement).closest?.('[data-banner-strip]')) return;
          startRef.current = { x: e.clientX, y: e.clientY };
          setDrag(0);
          if (e.pointerType !== 'touch') e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const st = startRef.current;
          if (!st) return;
          const dx = e.clientX - st.x;
          const dy = e.clientY - st.y;
          if (Math.abs(dy) > Math.abs(dx) * 1.3) return;
          setDrag(Math.max(-140, Math.min(140, dx)));
        }}
        onPointerUp={(e) => {
          const st = startRef.current;
          startRef.current = null;
          if (st) finish(e.clientX - st.x, e.clientY - st.y);
        }}
        onPointerCancel={() => { startRef.current = null; setDrag(0); }}
      >
        <div
          className="flex h-full"
          style={{
            width: `${count * 100}%`,
            transform: `translateX(-${idx * (100 / count)}%) translateX(${drag}px)`,
            transition: drag === 0 ? 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
          }}
        >
          {banners.map((b, i) => (
            // 장 = 칸(div) 안에 배너 단추(가득) + PC 사진 줄(링크들) — 단추 안에 링크를 넣으면 안 돼서 나란히 둔다
            <div key={b.id} className="relative h-full shrink-0 overflow-hidden" style={{ width: `${100 / count}%` }}>
            <button
              type="button"
              onClick={() => open(b)}
              aria-label={b.alt}
              className={`absolute inset-0 overflow-hidden ${b.href || b.action ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pc ? b.pcImage : b.image ?? b.pcImage} alt={b.alt} width={1200} height={pc ? 900 : 450} loading={i < 2 ? 'eager' : 'lazy'} decoding="async" draggable={false} className="h-full w-full object-cover" />
              {b.title && (
                <>
                  {/* 왼쪽(PC 는 왼쪽 위)만 옅게 어둡게 — 밝은 사진에서도 흰 제목이 읽히게(퀵매칭·웨딩숲 카드와 같은 결) */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{ background: pc ? 'linear-gradient(160deg, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0.12) 34%, rgba(0,0,0,0) 58%)' : 'linear-gradient(90deg, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.12) 45%, rgba(0,0,0,0) 70%)' }}
                  />
                  <span
                    key={i === idx ? `on-${turn}` : 'off'}
                    aria-hidden
                    className={`pointer-events-none absolute text-left font-bold text-white ${pc ? 'left-9 top-8 text-[32px] leading-[1.32] tracking-[-0.7px]' : 'left-5 top-[14px] text-[21px] leading-[1.35] tracking-[-0.4px]'}`}
                    style={{
                      textShadow: '0 1px 8px rgba(0,0,0,0.22)',
                      ...(i === idx
                        ? { animation: 'fadeSlideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both' }
                        : { opacity: i === leaving ? 1 : 0 }),
                    }}
                  >
                    {b.title.map((line) => <span key={line} className="block">{line}</span>)}
                  </span>
                </>
              )}
            </button>
            {/* PC 배너 위 단추 — 배너 단추와 나란히(단추 안 단추 금지), 장이 들어올 때마다 떠오른다 */}
            {/* go = 제목(top-8 · 32px · 줄 1.32) 바로 아래 18 — 제목 줄 수가 바뀌어도 따라 내려간다 */}
            {pc && (b.pcCta === 'signup' || b.pcCta === 'go') && (
              <button
                key={i === idx ? `cta-${turn}` : 'cta'}
                type="button"
                data-banner-strip
                onClick={() => open(b)}
                className={`absolute left-9 z-[2] inline-flex h-[42px] items-center gap-0.5 rounded-full pl-4 pr-3 text-[16px] font-semibold tracking-[-0.3px] text-white transition-colors hover:bg-white/30 ${b.pcCta === 'signup' ? 'top-[58%]' : ''}`}
                style={{
                  ...(b.pcCta === 'go' ? { top: `calc(32px + ${b.title?.length ?? 0} * 32px * 1.32 + 18px)` } : null),
                  backgroundColor: 'rgba(255,255,255,0.2)', WebkitBackdropFilter: 'blur(10px)', backdropFilter: 'blur(10px)',
                  ...(i === idx ? { animation: 'fadeSlideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both' } : { visibility: i === leaving ? 'visible' : 'hidden' }),
                }}
              >
                바로가기
                <ChevronRight size={18} />
              </button>
            )}
            {pc && b.pcCta === 'stores' && (
              <div
                key={i === idx ? `stores-${turn}` : 'stores'}
                data-banner-strip
                className="absolute bottom-5 left-5 z-[2] flex flex-col gap-1.5 xl:bottom-6 xl:left-6"
                style={i === idx ? { animation: 'fadeSlideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both' } : { visibility: i === leaving ? 'visible' : 'hidden' }}
              >
                {[
                  { href: APP_STORE_URL, label: 'App Store', aria: 'App Store 에서 앱 다운로드', icon: (
                    <svg viewBox="0 0 398 398" className="h-[16px] w-[16px]" aria-hidden="true"><path d="M276.174 207.944C276.578 251.295 314.54 265.723 314.957 265.91C314.634 266.923 308.89 286.471 294.954 306.66C282.914 324.115 270.403 341.503 250.709 341.863C231.351 342.223 225.136 330.489 203.007 330.489C180.877 330.489 173.976 341.503 155.654 342.223C136.646 342.943 122.171 323.355 110.024 305.966C85.2175 270.377 66.2496 205.451 91.715 161.607C104.36 139.845 126.974 126.057 151.511 125.697C170.183 125.351 187.792 138.152 199.213 138.152C210.634 138.152 232.023 122.75 254.543 125.017C263.959 125.404 290.42 128.791 307.397 153.433C306.038 154.273 275.838 171.701 276.174 207.944ZM239.799 101.495C249.888 89.3874 256.682 72.5326 254.825 55.7578C240.283 56.3312 222.687 65.372 212.248 77.4664C202.899 88.1873 194.706 105.335 196.913 121.777C213.136 123.017 229.71 113.603 239.799 101.495Z" fill="currentColor" /></svg>
                  ) },
                  { href: PLAY_STORE_URL, label: 'Google Play', aria: 'Google Play 에서 앱 다운로드', icon: (
                    <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" aria-hidden="true">
                      <path d="M4.2 2.6c-.3.3-.4.7-.4 1.2v16.4c0 .5.1.9.4 1.2l9.1-9.4z" fill="#00D7FE" />
                      <path d="M16.3 15l-3-3 3-3 3.6 2.1c1 .6 1 1.2 0 1.8z" fill="#FFCE00" />
                      <path d="M16.3 15L13.3 12l-9.1 9.4c.4.4 1 .4 1.6.1z" fill="#FF3A44" />
                      <path d="M16.3 9L5.8 2.5c-.6-.3-1.2-.3-1.6.1l9.1 9.4z" fill="#00F076" />
                    </svg>
                  ) },
                ].map((st) => (
                  <a
                    key={st.label}
                    href={st.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={st.aria}
                    draggable={false}
                    onClick={(e) => { if (lockRef.current) e.preventDefault(); }}
                    className="inline-flex h-9 w-fit items-center gap-1.5 rounded-[11px] px-2.5 text-[12px] font-semibold tracking-[-0.2px] text-white transition-colors hover:bg-black/70 xl:h-10 xl:px-3 xl:text-[13px]"
                    style={{ backgroundColor: 'rgba(0,0,0,0.55)', WebkitBackdropFilter: 'blur(10px)', backdropFilter: 'blur(10px)' }}
                  >
                    {st.icon}
                    {st.label}
                  </a>
                ))}
              </div>
            )}
            {pc && b.strip && (
              <BannerPhotoStrip
                strip={b.strip}
                active={i === idx}
                leaving={i === leaving}
                animKey={i === idx ? `on-${turn}` : 'off'}
                canNavigate={() => !lockRef.current}
              />
            )}
            </div>
          ))}
        </div>
        {/* 인디케이터 — 왼쪽 아래 길고 얇은 선(반투명 흰 선 위를 흰 막대가 지금 장으로 미끄러진다, 260926 사장 "1/5 말고 길고 얇은 선을 좌측에").
            PC 는 오른쪽 위 — 아래는 사진 줄(유리 판) 자리(260928) */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute h-[2px] overflow-hidden rounded-full bg-white/35 ${pc ? 'right-7 top-7 w-[96px]' : 'bottom-[14px] left-[14px] w-[80px]'}`}
          style={{ filter: 'drop-shadow(0 0 1px rgba(0, 0, 0, 0.18))' }}
        >
          <div
            className="h-full rounded-full bg-white"
            style={{
              width: `${100 / count}%`,
              transform: `translateX(${idx * 100}%)`,
              transition: 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </div>
        <span className="sr-only" aria-live="polite">{idx + 1}번째 배너 / 전체 {count}개</span>
      </div>
    </div>
  );
}

/** BEST 포디움 알약 — 사진(위 70%) 아래쪽을 사진 색 바탕으로 녹인다(이름 줄과 안 겹치게) */
const PODIUM_FADE = 'linear-gradient(to bottom, #000 0%, #000 58%, rgba(0,0,0,.4) 82%, transparent 100%)';

/**
 * BEST 결혼식 사회자 포디움 카드(모바일) — 알약 모양은 그대로, '결혼식 사회자' 사진 색 카드처럼 바탕 = 사진에서 뽑은 색(lib/image-tone)이고
 * 사진 아래쪽이 그 색으로 녹아든다. 이름·경력은 알약 안 가운데 두 줄(260926 사장 "알약 형태지만 프로필 결혼식사회자 카드랑 비슷하게,
 * 내용은 중간에 문정은 / 경력10년"). 테두리 = 금·은·동, 메달은 알약 아래 끝에 걸친다. 그림자 없음(사장 지시).
 * 알약 칸은 aspect-ratio 로 크기가 정해지니 안의 사진은 absolute — 세로로 긴 원본에 칸이 늘어나던 문제(2등만 길던 것) 재발 방지.
 */
function BestPodiumCard({ pro, border, trophy, offset }: { pro: ProData; border: string; trophy: string; offset: boolean }) {
  const img = pro.image || pro.images[0] || '/images/default-profile.png';
  const tone = useImageTone(img);
  return (
    <Link href={`/pros/${pro.id}`} className={`block ${offset ? 'mt-5' : ''}`}>
      <div
        className="relative w-full overflow-hidden rounded-full"
        style={{
          aspectRatio: '3 / 5',
          backgroundColor: tone?.bg || '#F2F4F6',
          border: `1.4px solid ${border}`,
          transition: 'background-color .5s ease',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt={pro.name}
          className="absolute inset-x-0 top-0 h-[70%] w-full object-cover"
          style={{ objectPosition: 'center 18%', WebkitMaskImage: PODIUM_FADE, maskImage: PODIUM_FADE }}
        />
        <div className="absolute inset-x-0 bottom-[10%] px-2 text-center">
          <p className="whitespace-nowrap text-[15px] font-bold leading-[1.55] tracking-[-0.3px] text-[#191F28]">{pro.name}</p>
          <p className="whitespace-nowrap text-[12.5px] font-medium leading-[1.55] tracking-[-0.2px]" style={{ color: tone?.sub || '#6B7684' }}>
            {formatCareerLabel(pro.experience)}
          </p>
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={trophy} alt="" className="relative z-[1] mx-auto -mt-[11px] block h-[18px] w-[29px]" />
    </Link>
  );
}

/** 사진 아래쪽을 카드 바탕색으로 녹여 이어지게(마스크) — 60% 까지 그대로, 끝에서 완전히 투명 */
const PRO_CARD_FADE = 'linear-gradient(to bottom, #000 0%, #000 58%, rgba(0,0,0,.4) 82%, transparent 100%)';

/** '수도권(서울/인천/경기)' → '수도권' */
function proCardRegion(pro: ProData) {
  if (pro.isNationwide) return '전국';
  return String(pro.regions[0] || '').replace(/\(.*?\)/g, '').trim();
}

/**
 * 홈 사회자 카드(더 많은 결혼식 사회자 · 행사 사회자) — 260926 사장 시안(토스 쇼핑 카드):
 *  카드 바탕 = 그 사람 프로필 사진에서 뽑은 색(lib/image-tone, 스튜디오 배경색을 옅은 파스텔로)이고,
 *  사진 아래쪽이 그 색으로 자연스럽게 녹아 이어진다. 왼쪽 위 배지 = 경력(실제 값 있을 때만, 검은 반투명 유리),
 *  이름 17 굵게('사회자' 글자 없음) · 한 줄 정보(★ 평점 (리뷰) | 지역 — 바탕 색을 머금은 진회색) · 소개 한 줄 · 흰 반투명 칩.
 *  사진 위 영상 썸네일은 뺐다(사장 '영상 부분은 프로필 사진에서 빼줘').
 */
function ProCard({ pro, index, onQuickView, onPreload }: {
  pro: ProData;
  index: number;
  onQuickView?: (pro: ProData) => void;
  onPreload?: (proId: string) => void;
}) {
  const skipAnim = useHomeAnimationSkip();
  const primaryImage = pro.images[0] || pro.image || '/images/default-profile.png';
  const tone = useImageTone(primaryImage);
  const sub = tone?.sub || '#6B7684';
  const reviews = pro.reviewCount || 0;
  const region = proCardRegion(pro);
  return (
    <Link
      href={`/pros/${pro.id}`}
      onTouchStart={() => discoveryApi.getProDetail(pro.id)}
      onMouseEnter={() => {
        discoveryApi.getProDetail(pro.id);
        if (typeof window !== 'undefined' && window.innerWidth >= 1024) onPreload?.(pro.id);
      }}
      onClick={(e) => {
        // PC 는 홈을 두고 오른쪽 미리보기로. 모바일은 예전처럼 상세로 이동
        if (!onQuickView || typeof window === 'undefined' || window.innerWidth < 1024) return;
        e.preventDefault();
        onQuickView(pro);
      }}
      className={`group card-press block h-full overflow-hidden rounded-[20px] border ${skipAnim ? 'opacity-100' : 'opacity-0 animate-fade-in'}`}
      style={{
        backgroundColor: tone?.bg || '#F2F4F6',
        borderColor: tone?.line || '#EAEDF0',
        transition: 'background-color .5s ease, border-color .5s ease',
        ...(skipAnim ? {} : { animationDelay: `${index * 80}ms`, animationFillMode: 'forwards' as const }),
      }}
    >
      <div className="relative" style={{ aspectRatio: '4 / 5' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={primaryImage}
          alt={pro.name}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          style={{ objectPosition: 'center 20%', WebkitMaskImage: PRO_CARD_FADE, maskImage: PRO_CARD_FADE }}
        />
        {/* 경력 배지 — 검은 반투명 + 뒤 흐림(유리), 파란색 아님(260926 사장) */}
        {pro.experience > 0 && (
          <span
            className="absolute left-2 top-2 inline-flex h-[26px] items-center rounded-[8px] px-2 text-[12.5px] font-bold tracking-[-0.2px] text-white lg:left-2.5 lg:top-2.5"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.36)', WebkitBackdropFilter: 'blur(10px) saturate(140%)', backdropFilter: 'blur(10px) saturate(140%)', boxShadow: 'inset 0 0 0 0.5px rgba(255, 255, 255, 0.18)' }}
          >
            경력 {pro.experience}년
          </span>
        )}
      </div>
      <div className="relative -mt-3 px-3 pb-3.5 lg:px-3.5">
        <p className="flex items-center gap-1 break-keep text-[17px] font-bold leading-[1.4] tracking-[-0.4px] text-[#191F28]">
          <span className="min-w-0">{pro.name}</span>
          {pro.isPartner && (
            <svg width="15" height="15" viewBox="0 0 24 24" className="shrink-0" aria-label="프리티풀 파트너">
              <path d="M12 1.8l2.6 1.9 3.2-.1 1 3.1 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3.1-3.2-.1L12 22.2l-2.6-1.9-3.2.1-1-3.1-2.6-1.9 1-3.1-1-3.1 2.6-1.9 1-3.1 3.2.1z" fill="#3182F6" />
              <path d="M8.2 12.2l2.5 2.5 5-5.2" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </p>
        {/* 한 줄 정보 — 시안의 '👁 46만 명 | ★ 4.8 (65,240)' 자리 */}
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] leading-[1.5] tracking-[-0.2px]" style={{ color: sub }}>
          {reviews > 0 ? (
            <span className="inline-flex items-center gap-[3px]">
              <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
                <path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill="currentColor" />
              </svg>
              {Number(pro.avgRating || 0).toFixed(1)} ({reviews})
            </span>
          ) : (
            <span>새로 온 사회자</span>
          )}
          {region && (
            <>
              <span aria-hidden="true" className="h-2.5 w-px" style={{ backgroundColor: sub, opacity: 0.35 }} />
              <span>{region}</span>
            </>
          )}
        </p>
        {/* 소개 한 줄 — 시안의 '지금 30일 내 최저가' 자리 */}
        {pro.intro && (
          <p className="mt-0.5 line-clamp-1 break-all text-[13px] leading-[1.65] tracking-[-0.2px]" style={{ color: sub }}>{pro.intro}</p>
        )}
        {/* 칩 — 흰 반투명(시안 '최대 308원 적립'), 한 줄 높이만(넘치는 칩은 통째로 가려진다) */}
        {pro.tags.length > 0 && (
          <div className="mt-2.5 flex h-[26px] flex-wrap gap-1 overflow-hidden">
            {pro.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="flex h-[26px] items-center whitespace-nowrap rounded-[8px] bg-white/60 px-2 text-[12.5px] font-semibold tracking-[-0.2px] text-[#333D4B]">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

/** PC 사회자 섹션 한 페이지에 깔리는 카드 수(6열 × 2줄) */
const PRO_SECTION_PAGE_SIZE = 12;

/**
 * 사회자 섹션 헤더의 페이저 — 좌/우 화살표 + 「전체 N개 펼쳐보기」.
 * 예전엔 목록 페이지로 보내는 '전체보기' 링크였는데, 홈을 벗어나지 않고
 * 그 자리에서 넘겨보거나 한 번에 펼칠 수 있게 바꿨다.
 */
function ProSectionPager({
  page, pageCount, total, expanded, onPrev, onNext, onToggle, showExpand = true,
}: {
  page: number;
  pageCount: number;
  total: number;
  expanded: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggle: () => void;
  /** false 면 화살표만 — BEST 처럼 '전부 펼치기'가 어울리지 않는 섹션용 */
  showExpand?: boolean;
}) {
  const arrowCls =
    'flex h-11 w-11 items-center justify-center rounded-full bg-[#F2F3F5] text-[#51535C] transition-colors hover:bg-[#E9EBEF] disabled:cursor-default disabled:text-[#C7CBD3] disabled:hover:bg-[#F2F3F5]';
  return (
    <div className="hidden items-center gap-2 lg:flex">
      {!expanded && pageCount > 1 && (
        <>
          <button type="button" onClick={onPrev} disabled={page === 0} className={arrowCls} aria-label="이전 사회자">
            <ChevronLeftIcon size={18} />
          </button>
          <button type="button" onClick={onNext} disabled={page >= pageCount - 1} className={arrowCls} aria-label="다음 사회자">
            <ChevronRightIcon size={18} />
          </button>
        </>
      )}
      {showExpand && (
        <button
          type="button"
          onClick={onToggle}
          className="flex h-11 items-center gap-2 rounded-full bg-[#F2F3F5] px-5 text-[14px] font-semibold text-[#51535C] transition-colors hover:bg-[#E9EBEF]"
        >
          {expanded ? '접기' : `전체 ${total}개 펼쳐보기`}
          <ChevronDownIcon size={18} className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
}

/**
 * 섹션별 페이지·펼침 상태. 목록이 줄어들면 페이지를 범위 안으로 되돌린다.
 * move 는 마지막 조작(-1 이전 / 1 다음 / 0 펼침)이라 카드가 들어오는 방향을 정한다.
 */
function useProSectionPager(total: number, pageSize = PRO_SECTION_PAGE_SIZE) {
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [move, setMove] = useState<-1 | 0 | 1>(0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    setPage((p) => Math.min(p, pageCount - 1));
  }, [pageCount]);
  const slice = <T,>(list: T[]) =>
    expanded ? list : list.slice(page * pageSize, (page + 1) * pageSize);
  /** key 가 바뀌면 리마운트되며 애니메이션이 다시 돈다(key 는 스프레드 금지) */
  const itemKey = (index: number) => `${expanded ? 'all' : page}-${index}`;
  const itemStyle = (index: number): CSSProperties => ({
    animation: `${move === -1 ? 'proPageFromLeft' : move === 1 ? 'proPageFromRight' : 'proPageExpand'} 0.42s cubic-bezier(0.16, 1, 0.3, 1) both`,
    animationDelay: `${Math.min(index, 11) * 28}ms`,
  });
  return {
    page,
    pageCount,
    expanded,
    slice,
    itemKey,
    itemStyle,
    /** 첫 페이지(펼치지 않은 상태)는 시작 위치라 진입 애니메이션을 걸지 않는다 */
    offset: expanded ? 0 : page * pageSize,
    onPrev: () => { setMove(-1); setPage((p) => Math.max(0, p - 1)); },
    onNext: () => { setMove(1); setPage((p) => Math.min(pageCount - 1, p + 1)); },
    onToggle: () => { setMove(0); setExpanded((v) => !v); setPage(0); },
  };
}

function ApplianceIconSwap() {
  const icons = ['/images/category-icons/appliance.png', '/images/category-icons/appliance-2.png'];
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <img
        key={tick}
        src={icons[tick % icons.length]}
        alt="가전"
        className="absolute inset-0 h-full w-full object-contain"
        style={{ animation: 'applianceSwoosh 0.55s cubic-bezier(0.22, 1, 0.36, 1) both' }}
      />
    </div>
  );
}

type HomeCategoryItem = { name: string; img: string; href: string };
const HOME_CATEGORY_ICON_DIR = '/images/category-icons';
/** 비즈 — PC 에서만 결혼식사회자 앞에(261007 사장). 모바일 5×2 칸·쪽 나누기에는 넣지 않는다(첫 쪽 앞에 hidden lg:flex 로만) */
const HOME_PC_BIZ_ITEM: HomeCategoryItem = { name: '비즈', img: `${HOME_CATEGORY_ICON_DIR}/biz.png`, href: '/biz' };

function getHomeCategoryItems(): HomeCategoryItem[] {
  const weddingPartnerCats = WEDDING_PARTNER_CATEGORIES
    .filter((name) => name !== '가전')
    .map((name) => ({
      name,
      img: `${HOME_CATEGORY_ICON_DIR}/${WEDDING_PARTNER_CATEGORY_ICONS[name]}`,
      href: `/businesses?category=${encodeURIComponent(name)}`,
    }));
  const applianceCat = WEDDING_PARTNER_CATEGORIES.includes('가전')
    ? [{
        name: '가전',
        img: `${HOME_CATEGORY_ICON_DIR}/${WEDDING_PARTNER_CATEGORY_ICONS['가전']}`,
        href: `/businesses?category=${encodeURIComponent('가전')}`,
      }]
    : [];

  return [
    // 남성/여성 사회자(사장 지시 260925 — 결혼식·행사 대신 성별로). 아이콘은 턱시도 남자·파란 재킷 여자 일러스트
    // 결혼식·행사 사회자(260926 사장 — 남성/여성 칸을 다시 결혼식·행사로, 아이콘은 백합+마이크·와인+마이크 새 일러스트)
    { name: '결혼식사회자', img: `${HOME_CATEGORY_ICON_DIR}/wedding-mc-icon.png`, href: proCategoryHref('결혼식사회자') },
    { name: '행사사회자', img: `${HOME_CATEGORY_ICON_DIR}/event-mc-icon.png`, href: proCategoryHref('전문행사사회자') },
    { name: '외국어사회자', img: `${HOME_CATEGORY_ICON_DIR}/foreign-mc.png`, href: proCategoryHref('외국어사회자') },
    ...weddingPartnerCats,
    ...applianceCat,
  ];
}

function HomeCategoryIcon({ item }: { item: HomeCategoryItem }) {
  // 웨딩홀도 다른 칸과 같은 일러스트 아이콘(예전엔 동그란 영상) — 사장 지시 260925 카테고리 아이콘 교체
  if (item.name === '가전') return <ApplianceIconSwap />;

  return (
    <img
      src={item.img}
      alt={item.name}
      className="h-full w-full object-contain"
      onError={(event) => {
        (event.currentTarget as HTMLImageElement).src = '/images/category-icons/wedding-hall.png';
      }}
    />
  );
}

function CategorySwiper() {
  const skipAnim = useHomeAnimationSkip();
  const allCats = getHomeCategoryItems().slice(0, 10);
  const pageSize = 10;
  const pages: HomeCategoryItem[][] = [];
  for (let i = 0; i < allCats.length; i += pageSize) pages.push(allCats.slice(i, i + pageSize));

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activePage, setActivePage] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      setActivePage(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, []);

  const scrollToPage = (pageIdx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * pageIdx, behavior: 'smooth' });
  };

  return (
    <div className="relative pb-2 pt-1">
      <div ref={scrollRef} className="flex snap-x snap-mandatory overflow-x-auto scrollbar-hide" style={{ scrollBehavior: 'smooth' }}>
        {pages.map((pageCats, pageIndex) => (
          <div key={pageIndex} className="w-full shrink-0 snap-start">
            <div className="grid grid-cols-5 gap-x-1 gap-y-3 py-2 pl-[18px] pr-[10px] lg:grid-cols-11 lg:gap-x-3 lg:px-2 lg:py-3">
              {/* PC 는 한 줄(260926 사장 "5×2 말고 일렬로 나란히") — 맨 앞 비즈까지 11칸(261007), 모바일은 비즈 없이 5×2 그대로 */}
              {(pageIndex === 0 ? [HOME_PC_BIZ_ITEM, ...pageCats] : pageCats).map((item, i) => {
                const pcOnly = item === HOME_PC_BIZ_ITEM;
                const index = pageIndex === 0 ? i - 1 : i;
                return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`${pcOnly ? 'hidden lg:flex' : 'flex'} flex-col items-center gap-0.5 opacity-0 lg:gap-1`}
                  style={skipAnim ? { opacity: 1 } : { animation: `fadeSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${0.2 + index * 0.03}s forwards` }}
                >
                  {/* 아이콘 뒤 둥근 타일(사장 레퍼런스 260925: 모서리 약 1/3) — 색은 아이콘마다 그 그림 색을 아주 옅게(260926, lib/business-categories CATEGORY_TILE_TINTS).
                      투명 배경 일러스트를 72% 크기로 가운데 */}
                  <div
                    className="relative flex h-[60px] w-[60px] items-center justify-center overflow-hidden rounded-[20px] lg:h-16 lg:w-16 lg:rounded-[21px]"
                    style={{ backgroundColor: categoryTileColor(item.img) }}
                  >
                    <span className="relative block h-[44px] w-[44px] lg:h-[46px] lg:w-[46px]">
                      <HomeCategoryIcon item={item} />
                    </span>
                  </div>
                  <span className="mt-1 text-center text-[12px] font-medium leading-tight text-[#51535C] lg:text-[13px]">
                    {item.name}
                  </span>
                </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {activePage < pages.length - 1 && (
        <button
          type="button"
          onClick={() => scrollToPage(activePage + 1)}
          className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition-all active:scale-90"
          style={{
            background: 'rgba(255, 255, 255, 0.55)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          }}
          aria-label="다음 카테고리"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      )}

      {pages.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {pages.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => scrollToPage(index)}
              className="block rounded-full transition-all duration-300"
              style={{
                width: index === activePage ? 28 : 4,
                height: 3,
                backgroundColor: index === activePage ? '#111111' : '#D1D5DB',
              }}
              aria-label={`페이지 ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SimpleMatchRequestModal({
  open,
  requestType,
  onClose,
  authUser,
}: {
  open: boolean;
  requestType: 'wedding' | 'event';
  onClose: () => void;
  authUser: { id?: string; role?: string | null } | null;
}) {
  const [location, setLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLocation('');
    setEventDate('');
    setEventTime('');
    setSubmitting(false);
  }, [open, requestType]);

  if (!open) return null;

  const title = requestType === 'wedding' ? '결혼식전문 사회자 요청' : '행사전문 사회자 요청';
  const categoryName = requestType === 'wedding' ? '결혼식사회자' : '전문행사사회자';
  const eventName = requestType === 'wedding' ? '결혼식' : '행사';

  const submit = async () => {
    if (!authUser) {
      window.dispatchEvent(new Event('freetiful:show-login'));
      return;
    }
    if (!location.trim()) {
      toast.error('장소를 입력해주세요.');
      return;
    }
    if (!eventDate || !eventTime) {
      toast.error('일시를 선택해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await matchApi.createRequest({
        categoryId: categoryName,
        eventDate,
        eventTime,
        eventLocation: location.trim(),
        type: 'multi',
        rawUserInput: {
          source: 'home_simple_request_modal',
          categoryName,
          eventType: eventName,
          eventName,
          location: location.trim(),
          date: eventDate,
          timeStart: eventTime,
          targetScope: 'all',
          requestKind: 'multi',
        },
      });
      toast.success('모든 사회자에게 요청을 보냈습니다.');
      onClose();
      window.dispatchEvent(new Event('freetiful:match-requests-changed'));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || '요청 전송에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BodyPortal>
    {/* 빠른 요청 시트 — 공통 모달(웨딩숲 톤 · 버튼 56/17/17) */}
    <div className="ft-scrim">
      <div className="ft-sheet" role="dialog" aria-modal="true">
        <div className="ft-grab" aria-hidden="true" />
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-[#3180F7]">빠른 요청</p>
            <h2 className="ft-title">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F2F4F8] text-[#6B7684] active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#4E5968]">장소</span>
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="예시: 서울 강남구 코엑스홀"
              className="ft-input"
            />
          </label>
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-[#4E5968]">행사일시</span>
            <div className="grid min-w-0 grid-cols-1 gap-2 min-[390px]:grid-cols-2">
              <label className="relative min-w-0">
                <span className="sr-only">행사 날짜</span>
                {!eventDate && (
                  <span className="pointer-events-none absolute left-5 top-1/2 z-10 -translate-y-1/2 text-[17px] text-[#B0B8C1]">
                    일자선택
                  </span>
                )}
                {/* 빈 값일 땐 기본 날짜 글자를 숨기고 위 안내 글자만 — ft-input 글자색보다 세게(!) */}
                <input
                  type="date"
                  value={eventDate}
                  onChange={(event) => setEventDate(event.target.value)}
                  className={`ft-input min-w-0 appearance-none [color-scheme:light] ${eventDate ? '' : '!text-transparent'}`}
                />
              </label>
              <label className="relative min-w-0">
                <span className="sr-only">행사 시간</span>
                {!eventTime && (
                  <span className="pointer-events-none absolute left-5 top-1/2 z-10 -translate-y-1/2 text-[17px] text-[#B0B8C1]">
                    시간선택
                  </span>
                )}
                <input
                  type="time"
                  value={eventTime}
                  onChange={(event) => setEventTime(event.target.value)}
                  className={`ft-input min-w-0 appearance-none [color-scheme:light] ${eventTime ? '' : '!text-transparent'}`}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="ft-actions">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="ft-btn primary"
          >
            {submitting ? '요청 보내는 중...' : '모든 사회자에게 요청하기'}
          </button>
        </div>
      </div>
    </div>
    </BodyPortal>
  );
}

// 하단 네비 '홈' 아이콘과 동일한 글리프 (홈 전체 버튼용)
const HomeGlyph = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd" d="M28.0924 10.9387L16.8297 1.98268C16.5941 1.79489 16.3017 1.69263 16.0004 1.69263C15.6991 1.69263 15.4067 1.79489 15.1711 1.98268L3.90706 10.9387C3.59312 11.1884 3.33957 11.5057 3.16528 11.867C2.99098 12.2283 2.90044 12.6242 2.90039 13.0253V25.5827C2.90039 26.4314 3.23753 27.2453 3.83765 27.8454C4.43777 28.4455 5.2517 28.7827 6.10039 28.7827H13.3337V22.4467C13.3337 22.0931 13.4742 21.7539 13.7242 21.5039C13.9743 21.2538 14.3134 21.1133 14.6671 21.1133H17.3337C17.6873 21.1133 18.0265 21.2538 18.2765 21.5039C18.5266 21.7539 18.6671 22.0931 18.6671 22.4467V28.7827H25.8991C26.7478 28.7827 27.5617 28.4455 28.1618 27.8454C28.7619 27.2453 29.0991 26.4314 29.0991 25.5827V13.0267C29.099 12.6255 29.0085 12.2296 28.8342 11.8683C28.6599 11.507 28.4063 11.1884 28.0924 10.9387Z" fill="currentColor" />
  </svg>
);

// 260926 사장: 결혼식·행사 대신 남성·여성 사회자(외국어는 그대로). 목록은 사회자 목록(/pros) 카드 그대로(ProFeedCard)
const HOME_SWIPE_TABS = ['전체', '남성사회자', '여성사회자', '외국어사회자'];

// 네이티브 홈과 동일: 헤더 아래 고정 글래스 탭 + 좌우 스와이프 페이저 + 긴 세로 리스트 (모바일 전용)
/**
 * 홈 본문은 스와이프로 밀려야 하는데, transform 을 걸면 그 안의 position:fixed 가
 * 뷰포트가 아니라 그 요소 기준이 돼서 헤더·탭바·하단바가 같이 밀리고 스크롤에서도 풀린다.
 * 그래서 고정돼야 하는 것들만 body 로 빼서 그린다.
 */
function BodyPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

/** 홈 탭 목록 — /pros 처럼 10장씩 이어 그린다(카드마다 사진 3장이라 한 번에 다 그리면 무겁다) */
function HomeFeedList({ items, onOpenReviews }: { items: ProFeedItem[]; onOpenReviews: (pro: ProFeedItem) => void }) {
  const [shown, setShown] = useState(10);
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = moreRef.current;
    if (!el || shown >= items.length) return;
    // 패널마다 제 스크롤이 있어서 그 칸을 기준으로 미리(600px 앞) 잇는다
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setShown((n) => Math.min(items.length, n + 10));
    }, { root: el.closest('[data-home-panel]'), rootMargin: '0px 0px 600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [shown, items.length]);
  return (
    <>
      {items.slice(0, shown).map((pro, i) => (
        <ProFeedCard key={pro.id} pro={pro} index={i} onOpenReviews={onOpenReviews} />
      ))}
      {shown < items.length && <div ref={moreRef} className="h-10" />}
    </>
  );
}

function HomeSwipeTabs() {
  const [tab, setTab] = useState(0);
  // 사회자 목록(/pros)과 같은 목록·같은 캐시 — 목록 화면에 다녀왔으면 바로 보인다
  const [pros, setPros] = useState<ProFeedItem[]>(() => {
    const hit = getCachedProList(PRO_FEED_LIST_PARAMS);
    return hit?.data?.length ? mapProFeedItems(hit.data) : [];
  });
  const [loaded, setLoaded] = useState(false);
  // 카드의 '리뷰' — /pros 와 같은 댓글 시트
  const [reviewPro, setReviewPro] = useState<ReviewSheetPro | null>(null);
  const openReviews = (pro: ProFeedItem) => setReviewPro({ id: pro.id, name: pro.name, image: pro.image, rating: pro.rating, reviews: pro.reviews });
  const [dragX, setDragX] = useState(0);
  // 손가락을 대는 순간 옆 패널 목록을 미리 받아 둔다 — 끌 때 옆이 빈 흰 화면이면 '덮인다' 로 보인다
  const [warm, setWarm] = useState(false);
  const touchRef = useRef<{ x: number; y: number; locked: 0 | 1 | -1 } | null>(null);
  const tabRef = useRef(0);
  useEffect(() => { tabRef.current = tab; }, [tab]);

  useEffect(() => {
    // 홈에 있을 때도 한가할 때 미리 받아 둔다 — 끌었을 때 옆이 빈 흰 화면이면 '덮인다' 로 보인다
    if (loaded) return;
    if (tab === 0 && !warm) {
      const idle = window.setTimeout(() => setWarm(true), 1200);
      return () => window.clearTimeout(idle);
    }
    let cancelled = false;
    discoveryApi.getProList(PRO_FEED_LIST_PARAMS)
      .then((res: any) => {
        if (cancelled) return;
        const rows = Array.isArray(res?.data) ? res.data : [];
        if (rows.length > 0) setPros(mapProFeedItems(rows));
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [tab, loaded, warm]);

  // 1=남성 · 2=여성(/pros 성별 탭과 같은 판정) · 3=외국어(언어가 적힌 사회자 — /pros 외국어사회자와 같은 기준). 순서는 /pros 추천순(리뷰순 순위)
  const filterByTab = (index: number, list: ProFeedItem[]): ProFeedItem[] => {
    if (index === 1) return list.filter((p) => matchesGender(p.gender, 'male'));
    if (index === 2) return list.filter((p) => matchesGender(p.gender, 'female'));
    if (index === 3) return list.filter((p) => p.languages.length > 0);
    return list;
  };

  const open = tab !== 0;
  // 카테고리 패널 열렸을 때 문서(html) 스크롤 잠금 — 패널은 fixed 오버레이라 뒤 홈이 같이
  // 스크롤되던(체이닝 아닌 문서 자체 스크롤) 문제 차단. overscroll-contain 만으론 못 막음.
  useEffect(() => {
    if (!open) return;
    const el = document.documentElement;
    const body = document.body;
    const prevHtml = el.style.overflow;
    const prevBody = body.style.overflow;
    el.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => { el.style.overflow = prevHtml; body.style.overflow = prevBody; };
  }, [open]);
  const goTab = (i: number) => { setDragX(0); setTab(i); };

  // 홈 본문을 손가락만큼 같이 밀어 준다.
  // 예전엔 리스트 패널만 위를 덮어서 '화면이 덮인다' 는 느낌이었다 —
  // 옆 화면이 밀고 들어오는 것처럼 보이려면 뒤 화면도 같이 빠져야 한다.
  useEffect(() => {
    const root = document.documentElement;
    const shift = tab === 0 ? `${dragX}px` : '-100vw';
    root.style.setProperty('--home-shift', shift);
    root.style.setProperty(
      '--home-shift-anim',
      dragX === 0 ? 'transform 0.34s cubic-bezier(0.22,0.61,0.36,1)' : 'none',
    );

    // 안 끌고 있을 땐 transform 을 아예 없앤다.
    // translateX(0px) 이라도 남아 있으면 그 안의 position:fixed 가 뷰포트가 아니라
    // 이 div 를 기준으로 잡혀(안내 팝업 딤이 화면 전체를 덮고 팝업은 문서 맨 아래로 밀림),
    // stacking context 까지 생겨 헤더·네비 위로 못 올라온다.
    // 되돌아오는 애니메이션이 끝난 뒤에 걷어내야 마지막 프레임이 튀지 않는다.
    const idle = tab === 0 && dragX === 0;
    let timer = 0;
    if (idle) {
      timer = window.setTimeout(() => root.style.setProperty('--home-transform', 'none'), 380);
    } else {
      root.style.setProperty('--home-transform', 'translateX(var(--home-shift, 0px))');
    }
    return () => {
      if (timer) window.clearTimeout(timer);
      root.style.removeProperty('--home-shift');
      root.style.removeProperty('--home-shift-anim');
      root.style.removeProperty('--home-transform');
    };
  }, [tab, dragX]);

  // 오버레이(리스트) 페이저 스와이프 — 1↔2↔3 + 1에서 우스와이프 → 전체(홈)
  const onTouchStart = (e: ReactTouchEvent) => { const t = e.touches[0]; touchRef.current = { x: t.clientX, y: t.clientY, locked: 0 }; };
  const onTouchMove = (e: ReactTouchEvent) => {
    const s = touchRef.current; if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x; const dy = t.clientY - s.y;
    if (s.locked === 0) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      s.locked = Math.abs(dx) > Math.abs(dy) ? 1 : -1; // 1=가로 페이저, -1=세로 스크롤
    }
    if (s.locked !== 1) return;
    let d = dx;
    if (tab >= 3 && dx < 0) d = dx * 0.35; // 마지막 탭에서 왼쪽 끌기 저항
    setDragX(d);
  };
  const onTouchEnd = (e: ReactTouchEvent) => {
    const s = touchRef.current; touchRef.current = null; if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x; const dy = t.clientY - s.y;
    setDragX(0);
    if (s.locked !== 1) return;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) setTab((c) => Math.min(3, c + 1));
    if (dx > 0) setTab((c) => Math.max(0, c - 1)); // 1→0(전체/홈)까지 허용
  };

  // 전체(홈)에서 좌스와이프 → 결혼식 탭 열기 (윈도우 리스너, 축잠금 + 무시영역[배너/카테고리])
  useEffect(() => {
    let s: { x: number; y: number; locked: 0 | 1 | -1; ignore: boolean } | null = null;
    const isMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches;
    // 오른쪽 가장자리에서 시작한 스와이프만 다음 탭으로 — 화면 아무 데서나 끌리면
    // 가로 스크롤·카드 조작과 헷갈린다
    const EDGE = 56;
    const onStart = (e: TouchEvent) => {
      if (tabRef.current !== 0 || !isMobile()) { s = null; return; }
      const t = e.touches[0];
      if (t.clientX < window.innerWidth - EDGE) { s = null; return; }
      const target = e.target as HTMLElement | null;
      const ignore = !!target?.closest?.('[data-hswipe-ignore]');
      s = { x: t.clientX, y: t.clientY, locked: 0, ignore };
    };
    const onMove = (e: TouchEvent) => {
      if (!s || s.ignore) return;
      const t = e.touches[0];
      const dx = t.clientX - s.x; const dy = t.clientY - s.y;
      if (s.locked === 0) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        s.locked = Math.abs(dx) > Math.abs(dy) * 1.3 ? 1 : -1;
      }
      if (s.locked !== 1) return;
      // 가로 스와이프 — 안드 웹뷰/브라우저의 뒤로가기 제스처·세로스크롤 가로채기 방지(non-passive preventDefault)
      // + 손가락 따라 패널을 끌어와(인터랙티브 드래그) '플로팅 덮기'가 아니라 페이지가 스와이프되게.
      e.preventDefault();
      setWarm(true);
      setDragX(dx < 0 ? dx : dx * 0.3); // 탭0: 왼쪽(다음 탭)만 따라가고 오른쪽은 저항
    };
    const onEnd = (e: TouchEvent) => {
      if (!s || s.ignore || s.locked !== 1) { s = null; setDragX(0); return; }
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x; const dy = t.clientY - s.y;
      s = null;
      setDragX(0);
      if (dx < -50 && Math.abs(dx) > Math.abs(dy)) setTab(1);
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);

  // 탭은 헤더 한 줄에 — 로고 오른쪽 끝 ~ 알림 아이콘 왼쪽 끝 사이(260926 사장 "로고 옆에, 하단 줄 없이, 우측은 흰 그라데이션").
  // 로고·아이콘 자리를 실제로 재서 맞춘다(로고 폭 81 · 아이콘 88 기준 기본값).
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const [tabSlot, setTabSlot] = useState({ left: 100, right: 96 });
  const [tabScrolled, setTabScrolled] = useState(false);
  useLayoutEffect(() => {
    const measure = () => {
      const header = document.querySelector('[data-native-home-header]');
      const logo = header?.querySelector('a')?.getBoundingClientRect();
      const icons = header?.querySelector('.ml-auto')?.getBoundingClientRect();
      if (!logo || !icons || logo.width === 0) return;
      setTabSlot({ left: Math.round(logo.right + 14), right: Math.round(window.innerWidth - icons.left) });
    };
    measure();
    const t = window.setTimeout(measure, 400); // 로고 그림이 늦게 뜨면 한 번 더
    window.addEventListener('resize', measure);
    return () => { window.clearTimeout(t); window.removeEventListener('resize', measure); };
  }, []);
  // 고른 탭이 칸 안에 보이게 가운데로(끌어서 넘겨도 따라온다)
  useEffect(() => {
    const box = tabScrollRef.current;
    const el = box?.querySelector<HTMLElement>(`[data-home-tab="${tab}"]`);
    if (!box || !el) return;
    const target = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2;
    box.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [tab]);

  // 밑줄 없이 글자로만 — 고른 탭 굵은 검정, 나머지 옅은 회색
  const tabBar = (
    <div className="relative h-full">
      <div
        ref={tabScrollRef}
        onScroll={(e) => setTabScrolled(e.currentTarget.scrollLeft > 2)}
        className="flex h-full items-center gap-4 overflow-x-auto pr-10 scrollbar-hide"
        style={{ scrollbarWidth: 'none' }}
      >
        {HOME_SWIPE_TABS.map((t, i) => {
          const active = i === tab;
          return (
            <button
              key={t}
              type="button"
              data-home-tab={i}
              onClick={() => goTab(i)}
              className={`flex h-full shrink-0 items-center whitespace-nowrap text-[16px] leading-[1.6] tracking-[-0.3px] transition-colors duration-200 ${
                active ? 'font-bold text-[#191F28]' : 'font-semibold text-[#B0B8C1]'
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>
      {/* 오른쪽 — 흰색으로 스르륵(더 있다는 표시), 왼쪽은 넘겼을 때만 */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-white via-white/85 to-white/0" />
      <div aria-hidden className={`pointer-events-none absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-white to-white/0 transition-opacity duration-200 ${tabScrolled ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  );

  return (
    <BodyPortal>
      {/* 헤더 배경 — 스크롤해도 흐려지지 않는 불투명 흰색(탭이 헤더 줄로 올라가 한 줄 64) */}
      <div
        className="lg:hidden pointer-events-none fixed inset-x-0 top-0 z-[42] bg-white"
        style={{ height: 64 }}
      />
      {/* 탭 — 헤더 줄(위 12 · 높이 42) 로고와 아이콘 사이 */}
      <div className="lg:hidden fixed top-[12px] z-[45] h-[42px]" style={{ left: tabSlot.left, right: tabSlot.right }}>{tabBar}</div>

      {/* 카테고리 리스트 오버레이 페이저 — 전체(0)=투명(홈 비침), 1~3=리스트 */}
      <div
        className="lg:hidden fixed inset-x-0 bottom-0 top-[64px] z-[40] overflow-hidden"
        style={{ pointerEvents: open ? 'auto' : 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex h-full"
          style={{
            width: '400%',
            transform: `translateX(calc(${-tab * 25}% + ${dragX}px))`,
            transition: dragX === 0 ? 'transform 0.34s cubic-bezier(0.22,0.61,0.36,1)' : 'none',
            touchAction: 'pan-y',
          }}
        >
          {HOME_SWIPE_TABS.map((_, panel) => {
            if (panel === 0) return <div key="all" className="h-full w-1/4 shrink-0" />;
            const near = Math.abs(panel - tab) <= 1;
            const list = near ? filterByTab(panel, pros) : [];
            return (
              <div key={panel} data-home-panel className="h-full w-1/4 shrink-0 overflow-y-auto overscroll-contain bg-white pb-28">
                {!near ? null : pros.length === 0 && !loaded ? (
                  // 카드 뼈대(프사 42 · 이름·정보 줄 · 소개 두 줄 · 사진 세 칸)
                  <div aria-hidden="true">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex gap-2.5 border-b border-[#F2F4F6] px-4 pb-3.5 pt-[18px]">
                        <div className="skeleton h-[42px] w-[42px] shrink-0" style={{ borderRadius: 9999 }} />
                        <div className="min-w-0 flex-1">
                          <div className="skeleton h-4 w-24" style={{ borderRadius: 6 }} />
                          <div className="skeleton mt-2 h-3.5 w-40" style={{ borderRadius: 6 }} />
                          <div className="skeleton mt-4 h-4 w-[90%]" style={{ borderRadius: 6 }} />
                          <div className="skeleton mt-2 h-4 w-[70%]" style={{ borderRadius: 6 }} />
                          <div className="skeleton mt-3.5 aspect-[9/4] w-full max-w-[420px]" style={{ borderRadius: 16 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : list.length === 0 ? (
                  <div className="py-24 text-center text-[14px] text-[#999]">사회자가 없습니다</div>
                ) : (
                  <HomeFeedList items={list} onOpenReviews={openReviews} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 홈 전체 pill (네비 홈 아이콘) — 리스트 탭에서만 */}
      {open && (
        <button
          type="button"
          onClick={() => goTab(0)}
          className="lg:hidden fixed left-1/2 z-[46] flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/25 bg-black/60 px-[18px] py-[11px] text-[13.5px] font-bold text-white shadow-[0_10px_28px_rgba(0,0,0,0.24)] backdrop-blur-md transition active:scale-95"
          style={{ bottom: 'calc(82px + env(safe-area-inset-bottom))' }}
        >
          <HomeGlyph className="h-3.5 w-3.5" /> 홈 전체
        </button>
      )}

      <ProReviewsSheet pro={reviewPro} onClose={() => setReviewPro(null)} />
    </BodyPortal>
  );
}

export default function HomePage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [apiPros, setApiPros] = useState<ProData[] | null>(null);
  const [showOfficialOpenModal, setShowOfficialOpenModal] = useState(false);
  // 홈 첫 진입 팝업(260929 — 오늘의집 카드 결) — 모두에게 가입 5천원 한 장(관리자 팝업 배너는 더 안 씀)
  const [popupBanner, setPopupBanner] = useState<(HomePromo & { kind: 'signup' | 'banner'; linkUrl?: string | null }) | null>(null);
  const authHydrated = useAuthStore((s) => s.hasHydrated);
  const [simpleRequestOpen, setSimpleRequestOpen] = useState(false);
  const [simpleRequestType, setSimpleRequestType] = useState<'wedding' | 'event'>('wedding');
  const skipHomeAnim = useHomeAnimationSkip();
  useEffect(() => () => resetHomeAnimationDecision(), []);
  // 홈 방문 1건(기기 세션당 1번, 익명) — 어드민 홈 '전환 퍼널' 1단계(261005)
  useEffect(() => { captureUtm(); trackLandingVisit('home'); }, []);

  // 홈 진입 팝업 — 가입 5천원 한 장(예전엔 어드민 배너 placement=popup). '다시 보지 않기'는 팝업 id 별로 기억.
  // 예전 iOS 앱(네이티브 홈이 있던 2.1.x — 네이티브 홈 브리지 nativeHomeRows 가 있음)에선 띄우지 않는다: 네이티브 홈에 가려 안 보이고
  // 네이티브가 자체 팝업을 띄운다. 웹 화면만 쓰는 iOS 앱(260927~)은 웹 팝업 그대로 — 탭바는 모달이 닫히면 다시 나온다.
  useEffect(() => {
    // 로그인 상태를 알아야 무엇을 띄울지 정한다(비로그인 = 가입 5천원) — 저장된 로그인이 복원된 뒤 한 번
    if (!authHydrated) return;
    const isLegacyNativeHome = typeof window !== 'undefined'
      && !!(window as any).webkit?.messageHandlers?.nativeHomeRows;
    if (isLegacyNativeHome) return;
    // 한 번 닫았으면 이 세션에선 다시 띄우지 않는다.
    // (홈 → 마이/채팅 → 홈 으로 되돌아올 때마다 이 effect 가 다시 돌아 계속 뜨던 문제)
    try { if (sessionStorage.getItem(POPUP_SEEN_KEY) === '1') return; } catch {}
    let cancelled = false;
    let stopWaiting = () => {};
    const hidden = (id: string) => {
      try {
        const until = Number(localStorage.getItem(`freetiful-popup-hide:${id}`) || '0');
        return !!until && Date.now() < until;
      } catch { return false; }
    };
    const schedule = (next: NonNullable<typeof popupBanner>) => {
      const show = () => {
        if (cancelled) return;
        setPopupBanner(next);
        setShowOfficialOpenModal(true);
      };
      // 빌라드지디 첫 화면이 떠 있으면 그게 닫힌 뒤에 — 두 창이 한꺼번에 겹쳐 뜨지 않게(260927, 예전 iOS 네이티브 앱과 같은 순서)
      if (document.querySelector('[role="dialog"][aria-label="빌라드지디"]')) {
        const onClosed = () => { stopWaiting(); window.setTimeout(show, 350); };
        window.addEventListener('freetiful:villadegd-closed', onClosed);
        stopWaiting = () => window.removeEventListener('freetiful:villadegd-closed', onClosed);
      } else {
        show();
      }
    };
    // 오픈 팝업 = 가입 5천원 한 장(사장 제공 세로 그림 887×1774, 원본 비율) — 로그인 여부와 상관없이 모두에게(260929 사장 '오픈팝업 이거 써, 지금 거 말고').
    // 예전 관리자 팝업 배너(placement=popup, 친구 초대)는 더 이상 띄우지 않는다. 로그인한 사람은 띠 단추가 친구 초대로 간다.
    if (!hidden('signup-5000')) {
      const loggedIn = !!useAuthStore.getState().user;
      schedule({
        id: 'signup-5000', kind: 'signup', imageUrl: '/images/popups/signup-5000.webp', aspect: 887 / 1774,
        ctaLabel: loggedIn ? '친구 초대하러 가기' : '가입하고 5,000원 받기', alt: '가입만 하면 5,000원 입금',
      });
    }
    return () => { cancelled = true; stopWaiting(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authHydrated]);

  /** 닫기(어떤 경로든) — 이 세션에선 다시 띄우지 않도록 표시 */
  const closeOfficialOpenModal = () => {
    try { sessionStorage.setItem(POPUP_SEEN_KEY, '1'); } catch {}
    setShowOfficialOpenModal(false);
  };

  const openPopupTarget = () => {
    if (!popupBanner) return;
    closeOfficialOpenModal();
    if (popupBanner.kind === 'signup') {
      if (useAuthStore.getState().user) router.push('/my/invite');
      else window.dispatchEvent(new Event('freetiful:show-login'));
      return;
    }
    if (popupBanner.linkUrl) {
      try { window.location.href = popupBanner.linkUrl; } catch {}
    }
  };

  const hideOfficialOpenModalFor3Days = () => {
    try {
      if (popupBanner) {
        localStorage.setItem(`freetiful-popup-hide:${popupBanner.id}`, String(Date.now() + OFFICIAL_OPEN_MODAL_HIDE_MS));
      }
    } catch {}
    setShowOfficialOpenModal(false);
  };

  useEffect(() => {
    if (!showOfficialOpenModal) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeOfficialOpenModal();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showOfficialOpenModal]);


  useEffect(() => {
    if (!authUser) {
      setUnreadNotifications(0);
      return;
    }

    const syncUnreadCount = () => {
      setUnreadNotifications(getCachedUnreadCount());
    };
    syncUnreadCount();
    notificationApi.getUnreadCount()
      .then((res) => setUnreadNotifications(res.count ?? 0))
      .catch(() => {});

    window.addEventListener('freetiful:notifications-changed', syncUnreadCount);
    window.addEventListener('focus', syncUnreadCount);
    return () => {
      window.removeEventListener('freetiful:notifications-changed', syncUnreadCount);
      window.removeEventListener('focus', syncUnreadCount);
    };
  }, [authUser]);

  // iOS 네이티브 홈 카테고리 사회자 데이터 브리지 (B6)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ORIGIN = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '').replace(/\/api\/v1$/, '').replace(/\/api$/, '');
    const abs = (u?: string) => (u && ORIGIN && u.startsWith('/uploads/') ? `${ORIGIN}${u}` : (u || ''));
    let proCache: any[] | null = null;
    const fetchAllPros = async (): Promise<any[]> => {
      if (proCache) return proCache;
      const res: any = await discoveryApi.getProList({ limit: 41, sort: 'reviews', withTotal: false });
      proCache = Array.isArray(res?.data) ? res.data : Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
      return proCache;
    };
    const lowerCats = (p: any) => (Array.isArray(p.categories) ? p.categories : []).map((c: any) => String(typeof c === 'string' ? c : c?.name || c?.category?.name || '').toLowerCase());
    const lowerTags = (p: any) => (Array.isArray(p.tags) ? p.tags : []).map((t: any) => String(t).toLowerCase());
    // index: 1=결혼식사회자, 2=행사사회자, 3=외국어사회자 (기존 홈 분류 로직과 동일)
    const filterByTab = (index: number, list: any[]): any[] => {
      if (index === 1) return list.filter((p) => lowerCats(p).some((v: string) => v.includes('결혼식') || v.includes('사회자') || v.includes('mc')));
      if (index === 2) return list.filter((p) => [...lowerCats(p), ...lowerTags(p)].some((v: string) => v.includes('행사') || v.includes('기업') || v.includes('컨퍼런스') || v.includes('컨벤션') || v.includes('쇼호스트') || v.includes('event')));
      if (index === 3) return list.filter((p) => (Array.isArray(p.languages) ? p.languages : []).length > 0);
      return list;
    };
    (window as any).__freetifulHomeRowsPost = async (index: number) => {
      try {
        const all = await fetchAllPros();
        const list = filterByTab(index, all);
        const items = list.slice(0, 12).map((p: any) => ({
          id: p.id,
          name: p.name || p.user?.name || '사회자',
          image: abs(p.image || p.profileImageUrl || p.mainImage || (Array.isArray(p.images) ? (typeof p.images[0] === 'string' ? p.images[0] : p.images?.[0]?.imageUrl) : '') || p.user?.profileImageUrl || ''),
          rating: Number(p.avgRating ?? p.rating) || 0,
          reviewCount: p.reviewCount || 0,
          intro: p.shortIntro || p.mainExperience || '',
          youtubeUrl: p.youtubeUrl || '',
        }));
        (window as any).webkit?.messageHandlers?.nativeHomeRows?.postMessage({ index, items });
      } catch {}
    };
    // 전체(홈) 네이티브 섹션 데이터 (BEST/더많은/행사 사회자 + 웨딩홀/드레스 업체)
    const proImg = (p: any) => abs(p.image || p.profileImageUrl || p.mainImage || (Array.isArray(p.images) ? (typeof p.images[0] === 'string' ? p.images[0] : p.images?.[0]?.imageUrl) : '') || p.user?.profileImageUrl || '');
    const proCard = (p: any) => ({ id: p.id, name: p.name || p.user?.name || '사회자', image: proImg(p), careerYears: Number(p.careerYears) || 0, tags: Array.isArray(p.tags) ? p.tags.slice(0, 3) : [], isPartner: Boolean(p.isFeatured || p.showPartnersLogo), youtubeUrl: p.youtubeUrl || '' });
    let bizCache: any[] | null = null;
    const fetchBusiness = async (): Promise<any[]> => {
      if (bizCache) return bizCache;
      try { const r = await fetch('/api/v1/business?limit=100'); const d = await r.json(); bizCache = Array.isArray(d?.items) ? d.items : Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []; } catch { bizCache = []; }
      return bizCache || [];
    };
    const bizCatNames = (b: any) => (Array.isArray(b.categories) ? b.categories : []).map((c: any) => String(c?.category?.name || c?.name || c || ''));
    const bizForCategory = (cat: string, list: any[]) => list.filter((b) => bizCatNames(b).some((n: string) => n.includes(cat)) || String(b.businessType || '').includes(cat));
    const bizCard = (b: any, i: number) => ({ id: b.id, name: b.businessName || b.name || b.title || '업체', location: String(b.address || b.region || '').trim().split(/\s+/)[0] || '', image: abs(Array.isArray(b.images) ? (typeof b.images[0] === 'string' ? b.images[0] : b.images?.[0]?.imageUrl) : ''), tags: Array.isArray(b.tags) ? b.tags.slice(0, 3) : [], isPopular: i < 2 });
    (window as any).__freetifulHomeSectionsPost = async () => {
      try {
        const [pros, biz] = await Promise.all([fetchAllPros(), fetchBusiness()]);
        // BEST 포디움 = 웹 bestWeddingPros 와 같은 기준 — 어드민 사회자 랭킹(rankOrder)이 먼저, 안 매긴 사회자만 평점순
        // (리뷰 3개 이상 먼저, 모자라면 나머지). 분류가 빈 사회자도 넣는다.
        const byRating = (a: any, b: any) =>
          (Number(b.avgRating) || 0) - (Number(a.avgRating) || 0) ||
          (Number(b.reviewCount) || 0) - (Number(a.reviewCount) || 0);
        const bestBase = pros.filter((p: any) => filterByTab(1, [p]).length > 0 || lowerCats(p).length === 0);
        const hasRank = (p: any) => typeof p.rankOrder === 'number';
        const unrankedBest = bestBase.filter((p: any) => !hasRank(p));
        const bestRanked = [
          ...bestBase.filter(hasRank).sort((a: any, b: any) => a.rankOrder - b.rankOrder),
          ...unrankedBest.filter((p: any) => (Number(p.reviewCount) || 0) >= 3).sort(byRating),
          ...unrankedBest.filter((p: any) => (Number(p.reviewCount) || 0) < 3).sort(byRating),
        ];
        const best = bestRanked.slice(0, 3).map((p: any) => ({ id: p.id, name: p.name || '사회자', image: proImg(p), careerYears: Number(p.careerYears) || 0, youtubeUrl: p.youtubeUrl || '' }));
        const morePros = pros.slice(0, 6).map(proCard);
        let event = filterByTab(2, pros);
        if (event.length < 9) { const ids = new Set(event.map((p: any) => p.id)); event = [...event, ...pros.filter((p: any) => !ids.has(p.id))]; }
        const eventPros = event.slice(0, 9).map(proCard);
        const weddingHalls = bizForCategory('웨딩홀', biz).slice(0, 8).map(bizCard);
        const dresses = bizForCategory('드레스', biz).slice(0, 8).map(bizCard);
        (window as any).webkit?.messageHandlers?.nativeHomeSections?.postMessage({ best, morePros, eventPros, weddingHalls, dresses });
      } catch {}
    };
    // 브리지 준비되면 능동 푸시 — 네이티브 초기 요청 레이스 해소
    const pushAll = () => { [1, 2, 3].forEach((i) => (window as any).__freetifulHomeRowsPost?.(i)); (window as any).__freetifulHomeSectionsPost?.(); };
    const t1 = setTimeout(pushAll, 200);
    const t2 = setTimeout(pushAll, 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); try { delete (window as any).__freetifulHomeRowsPost; delete (window as any).__freetifulHomeSectionsPost; } catch {} };
  }, []);



  // Fetch pro list from API
  useEffect(() => {
    let cancelled = false;
    // 캐시에서 즉시 표시 (두 번째 방문부터 무한 로딩 방지)
    try {
      const cached = localStorage.getItem(HOME_PROS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) setApiPros(parsed);
      }
    } catch {}

    // 타임아웃: 8초 내 응답 없으면 빈 배열로 설정
    const timeout = setTimeout(() => {
      setApiPros((prev) => prev ?? []);
    }, 8000);

    const loadRealtimeProRank = () => {
      discoveryApi.getProList({ limit: 41, sort: 'reviews', withTotal: false, realtime: true })
        .then((res) => {
          if (cancelled) return;
          clearTimeout(timeout);
          if (res.data?.length > 0) {
            // userId 기준 중복 제거 (동일 유저의 여러 프로필 중 가장 최신 것만)
            const seen = new Set<string>();
            const deduped = res.data.filter((p: any) => {
              const key = p.userId || p.id;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            const mapped = sortByHomeRank(deduped.map(mapDiscoveryProToHomePro));
            setApiPros(mapped);
            try { localStorage.setItem(HOME_PROS_CACHE_KEY, JSON.stringify(mapped)); } catch {}
          } else {
            setApiPros([]);
          }
        })
        .catch(() => {
          if (cancelled) return;
          clearTimeout(timeout);
          setApiPros((prev) => prev ?? []);
        });
    };

    loadRealtimeProRank();
    const interval = window.setInterval(loadRealtimeProRank, 20_000);
    const onFocus = () => loadRealtimeProRank();
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadRealtimeProRank();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Use API data only - no mock fallback
  const prosData = useMemo(() => sortByHomeRank(apiPros || []), [apiPros]);
  const heroProfileImages = useMemo(() => {
    const images = prosData.flatMap((pro) => [pro.image, ...pro.images])
      .filter((src): src is string => Boolean(src && !src.includes('default-profile')));
    return Array.from(new Set(images)).slice(0, 24);
  }, [prosData]);
  // BEST 결혼식 사회자(금/은/동) — 어드민 '사회자 랭킹'(rankOrder)이 먼저, 고객 사회자 목록(discovery)과 같은 순서
  // (261007 사장 '이승진·나연지·김현수인데 왜 노유재가 1등' — 예전엔 평점순이라 랭킹을 무시하고 5.0·리뷰 13 노유재가 1등이었다).
  // 랭킹을 안 매긴 사회자만 평점순 — 리뷰가 너무 적은 사람이 5.0 하나로 위에 오지 않게 리뷰 3개 이상을 먼저, 나머지를 이어 붙인다.
  // 분류가 빈 사회자(김솔 등, 등록 때 분류 누락)도 사회자라 넣는다 — 빼면 랭킹 5위가 BEST 에서 사라진다.
  const bestWeddingPros = useMemo(() => {
    const weddingPros = prosData.filter((p) => isWeddingMcPro(p) || p.categories.length === 0);
    const base = weddingPros.length > 0 ? weddingPros : prosData;
    const byRating = (a: ProData, b: ProData) =>
      (b.avgRating || 0) - (a.avgRating || 0) || (b.reviewCount || 0) - (a.reviewCount || 0);
    const MIN_REVIEWS = 3;
    const ranked = base.filter((p) => p.rankOrder != null).sort((a, b) => (a.rankOrder as number) - (b.rankOrder as number));
    const unranked = base.filter((p) => p.rankOrder == null);
    const enough = unranked.filter((p) => (p.reviewCount || 0) >= MIN_REVIEWS).sort(byRating);
    const rest = unranked.filter((p) => (p.reviewCount || 0) < MIN_REVIEWS).sort(byRating);
    return [...ranked, ...enough, ...rest];
  }, [prosData]);
  const moreProsSeedRef = useRef(`${Date.now()}-${Math.random()}`);
  // '더 많은 결혼식 사회자' — 결혼식 태그 사회자 먼저(행사 칸과 같은 방식), 모자라면 나머지로 채움
  const morePros = useMemo(() => {
    const wedding = prosData.filter(isWeddingTaggedPro);
    const ids = new Set(wedding.map((pro) => pro.id));
    const rest = prosData.filter((pro) => !ids.has(pro.id));
    const list = wedding.length >= 12 ? wedding : [...wedding, ...rest];
    return shuffleProsBySeed(list.length > 0 ? list : prosData, moreProsSeedRef.current);
  }, [prosData]);
  const eventPros = useMemo(() => {
    const filtered = prosData.filter(isEventMcPro);
    const filteredIds = new Set(filtered.map((pro) => pro.id));
    const fallback = prosData.filter((pro) => !filteredIds.has(pro.id));
    const filled = filtered.length > 0 ? [...filtered, ...fallback] : prosData;
    return shuffleProsBySeed(filled, `${moreProsSeedRef.current}:event`);
  }, [prosData]);
  /** BEST 는 10위까지만, 한 페이지에 5명 */
  const bestTop10 = useMemo(() => bestWeddingPros.slice(0, 10), [bestWeddingPros]);
  const bestProsPager = useProSectionPager(bestTop10.length, 5);
  const moreProsPager = useProSectionPager(morePros.length);
  const eventProsPager = useProSectionPager(eventPros.length);
  /** PC 홈에서 오른쪽으로 살짝 나오는 사회자 미리보기 */
  const [quickViewPro, setQuickViewPro] = useState<ProData | null>(null);
  /** 마우스를 올린 사회자 — 클릭 전에 상세를 미리 받아 둔다(열 때 흰 화면 방지) */
  const [quickViewPreloadId, setQuickViewPreloadId] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<BusinessPartner[]>([]);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(BUSINESS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.ts < BUSINESS_CACHE_TTL && Array.isArray(parsed.data)) {
          setBusinesses(parsed.data);
        }
      }
    } catch {}

    let cancelled = false;
    apiClient.get('/api/v1/business', { params: { limit: 100, _v: BUSINESS_REQUEST_VERSION } })
      .then((res) => {
        if (cancelled) return;
        const items = Array.isArray(res.data) ? res.data : res.data?.items;
        if (!Array.isArray(items)) return;
        const mapped: BusinessPartner[] = items.filter((b: any) => isBusinessRelevantToAnyCategory(b)).map((b: any, i: number) => {
          const categories = getRelevantBusinessCategories(b);
          const visibleCategories = categories;
          const isPopular = isPopularBusinessPartner(b, categories);
          const businessName = b.businessName || b.name || b.title || '웨딩 파트너';
          const partnerImageSet = getWeddingPartnerImageSet(businessName, b.name, b.title);
          const apiImages = Array.isArray(b.images)
            ? b.images.map((image: any) => image?.imageUrl).filter(Boolean)
            : [];
          const mergedImages = sanitizeBusinessImageUrls(mergeWeddingPartnerImages(
            partnerImageSet?.images,
            [b.image, b.imageUrl],
            apiImages,
          ));
          const displayCategories = Array.from(new Set([
            ...(visibleCategories.length > 0 ? visibleCategories : categories),
            ...getWeddingPartnerSectionCategories(partnerImageSet),
          ]));
          const businessCategories = Array.from(
            new Set(displayCategories.filter((name): name is string => Boolean(name))),
          );
          const address = b.address || '';
          const markerTags = extractBusinessTagsFromHtml(b.descriptionHtml);
          const sourceTags = Array.isArray(b.tags) && b.tags.length > 0
            ? b.tags
            : markerTags.length > 0
              ? markerTags
              : deriveBusinessTagSuggestions({
                businessName,
                businessType: b.businessType,
                address,
                categoryNames: businessCategories,
              });
          return {
            id: b.id || String(i),
            category: businessCategories[0] || b.businessType || '웨딩홀',
            categories: businessCategories.length > 0 ? businessCategories : [b.businessType || '웨딩홀'],
            name: businessName,
            location: address.split(' ')[0] || b.region || '전국',
            images: mergedImages,
            tags: getBusinessDisplayTags(businessCategories, b.businessType, isPopular, 3, sourceTags),
            isPopular,
            originalPrice: b.originalPrice ?? 0,
            discountPercent: b.discountPercent ?? 0,
          };
        }).filter((b: BusinessPartner) => b.name.trim().length > 0 && b.images.length > 0);
        const sorted = sortPopularPartnersFirst(mapped);
        setBusinesses(sorted);
        try { localStorage.setItem(BUSINESS_CACHE_KEY, JSON.stringify({ data: sorted, ts: Date.now() })); } catch {}
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  // 관리자 배너(DB, placement=home) — 옛 iOS 네이티브 홈(2.1.10 이하)만 쓴다(nativeHomeBanners 브리지). 웹 PC·모바일 첫 화면은 HOME_TOP_BANNERS(260928).
  const [banners, setBanners] = useState(BANNERS);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/banners?placement=home').then((r) => r.ok ? r.json() : null).then((data) => {
      if (cancelled || !Array.isArray(data) || data.length === 0) return;
      setBanners(data.map((b: any, index: number) => ({
        id: b.id,
        title: b.title || '',
        subtitle: b.subtitle || '',
        bgColor: b.bgColor || '',
        image: b.imageUrl,
        linkUrl: b.linkUrl || (index === 0 ? '/my/invite' : null),
      })));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // iOS 네이티브 홈 배너 데이터 브리지 (B6) — 배너 로드/변경 시 푸시
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ORIGIN = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '').replace(/\/api\/v1$/, '').replace(/\/api$/, '');
    const abs = (u?: string) => (u && ORIGIN && u.startsWith('/uploads/') ? `${ORIGIN}${u}` : (u || ''));
    const items = (banners || [])
      .filter((b: any) => b?.image)
      .map((b: any) => ({ image: abs(b.image), link: (b as any).linkUrl || '' }));
    const post = () => { (window as any).webkit?.messageHandlers?.nativeHomeBanners?.postMessage({ items }); };
    post();
    const t = setTimeout(post, 400);
    return () => clearTimeout(t);
  }, [banners]);

  const headerRef = useRef<HTMLDivElement>(null);
  const rankScrollRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(56);

  useEffect(() => {
    if (!headerRef.current) return;
    const ro = new ResizeObserver(([entry]) => setHeaderH(entry.contentRect.height + 12));
    ro.observe(headerRef.current);
    return () => ro.disconnect();
  }, []);

  const businessPartnerSections = useMemo(() => getBusinessPartnerSections(businesses), [businesses]);
  // 네이티브 홈 웨딩파트너 섹션 브리지 (웹 큐레이션 이미지 사용 — API 원본이 엉뚱한 문제 해결)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const post = () => {
      const sections = businessPartnerSections.map((s) => ({
        category: s.category,
        items: s.businesses.slice(0, 10).map((b) => ({
          id: b.id,
          name: b.name,
          location: b.location || '',
          image: (b.images && b.images[0]) || '',
          tags: Array.isArray(b.tags) ? b.tags.slice(0, 3) : [],
          isPopular: Boolean(b.isPopular),
        })),
      }));
      (window as any).webkit?.messageHandlers?.nativeHomeBusiness?.postMessage({ sections });
    };
    (window as any).__freetifulBusinessPost = post;
    post();
    const t = setTimeout(post, 1500);
    return () => { clearTimeout(t); try { delete (window as any).__freetifulBusinessPost; } catch {} };
  }, [businessPartnerSections]);
  const warmProsList = () => {
    discoveryApi.getProList({ limit: 100, sort: 'reviews', withTotal: false, realtime: true }).catch(() => {});
  };
  const openSimpleRequest = (type: 'wedding' | 'event') => {
    setSimpleRequestType(type);
    setSimpleRequestOpen(true);
  };

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const visited = sessionStorage.getItem('visited-main') === '1';
    if (visited) {
      setLoading(false);
      return;
    }
    const t = setTimeout(() => {
      setLoading(false);
      sessionStorage.setItem('visited-main', '1');
    }, 300);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="bg-white min-h-screen w-full">
        {/* 헤더 스켈레톤 — 로고 + 탭(모바일은 헤더 줄 안) + 알림·검색 아이콘 */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-2 lg:mx-auto lg:max-w-7xl lg:px-8 lg:pt-4 lg:pb-3">
          <div className="skeleton shrink-0" style={{ width: 81, height: 24, borderRadius: 6 }} />
          <div className="flex min-w-0 flex-1 items-center gap-4 overflow-hidden pl-1 lg:hidden">
            {[30, 76, 76].map((w, i) => (
              <div key={i} className="skeleton shrink-0" style={{ width: w, height: 15, borderRadius: 6 }} />
            ))}
          </div>
          <div className="ml-auto flex h-[42px] items-center gap-5 pr-1">
            <div className="skeleton" style={{ width: 24, height: 24, borderRadius: 9999 }} />
            <div className="skeleton" style={{ width: 24, height: 24, borderRadius: 9999 }} />
          </div>
        </div>

        <div className="space-y-5 px-[10px] pt-3 pb-6 lg:mx-auto lg:max-w-7xl lg:space-y-7 lg:px-8 lg:pt-4 lg:pb-12">
          {/* 퀵매칭·웨딩숲 바로가기 스켈레톤(모바일 8:3 두 줄, 맨 위) */}
          <div className="space-y-2.5 lg:hidden">
            <div className="skeleton w-full" style={{ aspectRatio: '8 / 3', borderRadius: 5 }} />
            <div className="skeleton w-full" style={{ aspectRatio: '8 / 3', borderRadius: 5 }} />
          </div>

          {/* 결혼식/행사 카드 스켈레톤(PC) */}
          <div className="hidden grid-cols-2 gap-3 lg:grid lg:grid-cols-3 lg:gap-4">
            <div className="skeleton aspect-square rounded-2xl lg:rounded-[22px]" />
            <div className="skeleton aspect-square rounded-2xl lg:rounded-[22px]" />
            <div className="skeleton hidden aspect-square rounded-[22px] lg:block" />
          </div>

          {/* 카테고리 아이콘 스켈레톤 */}
          <div className="grid grid-cols-5 gap-x-2 gap-y-4 lg:grid-cols-10">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="skeleton" style={{ width: 52, height: 52, borderRadius: 9999 }} />
                <div className="skeleton" style={{ width: 34, height: 10, borderRadius: 4 }} />
              </div>
            ))}
          </div>

          {/* 배너 스켈레톤 — 8:3 · 모서리 5, 카테고리 아래(모바일) */}
          <div className="skeleton w-full lg:hidden" style={{ aspectRatio: '8 / 3', borderRadius: 5 }} />

          {/* BEST 결혼식 사회자 스켈레톤 */}
          <div>
            <div className="mb-3 flex items-center gap-2 lg:mb-4">
              <div className="skeleton shrink-0" style={{ width: 40, height: 40, borderRadius: 9999 }} />
              <div>
                <div className="skeleton mb-1.5" style={{ width: 148, height: 16, borderRadius: 6 }} />
                <div className="skeleton" style={{ width: 92, height: 12, borderRadius: 6 }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-3 py-2 lg:hidden">
              {[true, false, true].map((offset, i) => (
                <div key={i} className={`flex flex-col items-center ${offset ? 'mt-5' : ''}`}>
                  <div className="skeleton w-full aspect-[3/4]" style={{ borderRadius: 9999 }} />
                  <div className="skeleton mt-4" style={{ width: 64, height: 14, borderRadius: 6 }} />
                  <div className="skeleton mt-2" style={{ width: 40, height: 10, borderRadius: 6 }} />
                </div>
              ))}
            </div>
            <div className="hidden gap-x-4 gap-y-4 lg:flex lg:flex-wrap lg:justify-center">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex w-[366px] shrink-0 gap-3">
                  <div className="skeleton shrink-0" style={{ width: 36, height: 48, borderRadius: 9999 }} />
                  <div className="skeleton shrink-0" style={{ width: 176, height: 234, borderRadius: 9999 }} />
                  <div className="flex-1 py-1">
                    <div className="skeleton" style={{ width: 96, height: 16, borderRadius: 6 }} />
                    <div className="skeleton mt-3" style={{ width: 80, height: 12, borderRadius: 6 }} />
                    <div className="skeleton mt-8" style={{ width: 64, height: 12, borderRadius: 6 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 사회자 카드 그리드 스켈레톤 */}
          <div className="grid grid-cols-3 gap-x-2 gap-y-4 lg:grid-cols-6 lg:gap-x-4 lg:gap-y-7">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i}>
                <div className="skeleton mb-2 rounded-xl lg:rounded-full" style={{ width: '100%', aspectRatio: '3/4' }} />
                <div className="skeleton mb-1" style={{ width: 48, height: 10, borderRadius: 4 }} />
                <div className="skeleton mb-1" style={{ width: '80%', height: 13, borderRadius: 4 }} />
                <div className="skeleton" style={{ width: '55%', height: 11, borderRadius: 4 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-pc-font-cap home-shift-mobile-only bg-white min-h-screen w-full">
      <SimpleMatchRequestModal
        open={simpleRequestOpen}
        requestType={simpleRequestType}
        authUser={authUser}
        onClose={() => setSimpleRequestOpen(false)}
      />

      {/* 홈 첫 진입 팝업 — 오늘의집 카드 결(모서리 5 · 아래 붙은 띠 단추 · 카드 밖 '다시 보지 않기'/'닫기'), 고급 등장(260929 사장) */}
      <HomePromoPopup
        promo={popupBanner}
        open={showOfficialOpenModal && !!popupBanner}
        onCta={openPopupTarget}
        onClose={() => closeOfficialOpenModal()}
        onHideForever={hideOfficialOpenModalFor3Days}
      />

      {/* PC 우하단 앱 홍보 — 폰 목업(iframe)은 제거했다. hidden lg:flex 로 PC 에서만 보인다 */}
      <div className="home-pc-floating-app-promo pointer-events-none fixed bottom-7 right-4 z-20 hidden flex-col items-end gap-3 lg:flex xl:bottom-8 xl:right-8">
          {/* 네이버 첫 화면 검색창 그대로(260929 사장 영상 분석) — 초록 테두리 알약 · 초록 N · '전문결혼식사회자는 프리티풀' 타이핑 + 깜빡이는 커서 ·
              자판 · AI 단추(글자 청록→파랑 · 빛 테두리가 한 바퀴 돌고 가라앉음). 모양·색은 영상에서 잰 값(globals .home-floating-naver-*) */}
          <div className="home-floating-naver-search pointer-events-none" aria-hidden="true">
            <svg className="home-floating-naver-n" viewBox="78 78 242 242" focusable="false">
              <path d="M154.426 319.75H78.248V78.25H154.426L240.166 208.488V78.25H319.748V319.75H240.166L154.426 208.488V319.75Z" fill="#03C75A" />
            </svg>
            <span className="home-floating-search-query">
              <span className="home-floating-search-query-text">전문결혼식사회자는 프리티풀</span>
            </span>
            <span className="home-floating-search-caret" />
            <svg className="home-floating-naver-kbd" viewBox="0 0 19 13" focusable="false">
              <rect width="19" height="13" rx="2.6" fill="#999" />
              <g fill="#fff">
                <rect x="3" y="3" width="1.6" height="1.6" rx="0.4" /><rect x="5.8" y="3" width="1.6" height="1.6" rx="0.4" /><rect x="8.7" y="3" width="1.6" height="1.6" rx="0.4" /><rect x="11.6" y="3" width="1.6" height="1.6" rx="0.4" /><rect x="14.4" y="3" width="1.6" height="1.6" rx="0.4" />
                <rect x="4.4" y="5.9" width="1.6" height="1.6" rx="0.4" /><rect x="7.2" y="5.9" width="1.6" height="1.6" rx="0.4" /><rect x="10.1" y="5.9" width="1.6" height="1.6" rx="0.4" /><rect x="13" y="5.9" width="1.6" height="1.6" rx="0.4" />
                <rect x="5.2" y="8.9" width="8.6" height="1.6" rx="0.8" />
              </g>
            </svg>
            <span className="home-floating-naver-ai">
              <i className="nv-ai-glow" />
              <i className="nv-ai-base" />
              <i className="nv-ai-tint" />
              <i className="nv-ai-ring" />
              <svg viewBox="0 0 24 24" focusable="false">
                <defs>
                  <linearGradient id="home-nv-ai-grad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#22D0C4" />
                    <stop offset="0.55" stopColor="#2F9BF7" />
                    <stop offset="1" stopColor="#3E6CF5" />
                  </linearGradient>
                </defs>
                {/* 네이버 AI 표시 — 두 잎이 X 로 엇갈린 모양 */}
                <path d="M4.2 3.4c3.1-.9 6.3 1.4 8.5 4.1 2.3 2.9 4.9 5.4 7.9 6.9 1.1.6 1.1 2.1.1 2.9-3.3 2.4-7.6 1.1-10.2-1.9C7.9 12.3 5.2 9.9 3.1 7.4c-.9-1.1-.3-3.6 1.1-4z" fill="url(#home-nv-ai-grad)" />
                <path d="M19.8 3.4c-3.1-.9-6.3 1.4-8.5 4.1-2.3 2.9-4.9 5.4-7.9 6.9-1.1.6-1.1 2.1-.1 2.9 3.3 2.4 7.6 1.1 10.2-1.9 2.6-3.1 5.3-5.5 7.4-8 .9-1.1.3-3.6-1.1-4z" fill="url(#home-nv-ai-grad)" opacity="0.92" />
              </svg>
              <span className="nv-ai-text">
                <span className="nv-ai-dark">AI</span>
                <span className="nv-ai-grad">AI</span>
              </span>
            </span>
          </div>

          <div className="home-app-download-buttons pointer-events-auto">
            <a
              href="https://apps.apple.com/nz/app/%ED%94%84%EB%A6%AC%ED%8B%B0%ED%92%80-%EA%B2%B0%ED%98%BC%EC%8B%9D%EC%82%AC%ED%9A%8C%EC%9E%90-%EC%A7%84%ED%96%89%EC%9E%90-%ED%96%89%EC%82%AC-%EC%A0%84%EB%AC%B8%EA%B0%80-%EC%84%AD%EC%99%B8/id6745000474"
              target="_blank"
              rel="noopener noreferrer"
              className="home-app-download-button"
              aria-label="App Store 다운로드"
            >
              <span className="home-app-download-icon home-app-download-icon-apple">
                <svg viewBox="0 0 398 398" aria-hidden="true" focusable="false">
                  <path
                    d="M276.174 207.944C276.578 251.295 314.54 265.723 314.957 265.91C314.634 266.923 308.89 286.471 294.954 306.66C282.914 324.115 270.403 341.503 250.709 341.863C231.351 342.223 225.136 330.489 203.007 330.489C180.877 330.489 173.976 341.503 155.654 342.223C136.646 342.943 122.171 323.355 110.024 305.966C85.2175 270.377 66.2496 205.451 91.715 161.607C104.36 139.845 126.974 126.057 151.511 125.697C170.183 125.351 187.792 138.152 199.213 138.152C210.634 138.152 232.023 122.75 254.543 125.017C263.959 125.404 290.42 128.791 307.397 153.433C306.038 154.273 275.838 171.701 276.174 207.944ZM239.799 101.495C249.888 89.3874 256.682 72.5326 254.825 55.7578C240.283 56.3312 222.687 65.372 212.248 77.4664C202.899 88.1873 194.706 105.335 196.913 121.777C213.136 123.017 229.71 113.603 239.799 101.495Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <span className="home-app-download-copy">
                <span>Download on the</span>
                <span>App Store</span>
              </span>
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.freetiful.freetiful&hl=ko"
              target="_blank"
              rel="noopener noreferrer"
              className="home-app-download-button"
              aria-label="Play Store 다운로드"
            >
              <span className="home-app-download-icon">
                <svg viewBox="0 0 398 398" aria-hidden="true" focusable="false">
                  <mask id="home-play-store-icon-mask" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="95" y="62" width="245" height="274">
                    <path d="M324.832 173.994C344.082 185.108 344.082 212.892 324.832 224.006L138.6 331.528C119.35 342.642 95.2873 328.749 95.2873 306.521L95.2874 91.4787C95.2874 69.2507 119.35 55.3583 138.6 66.4723L324.832 173.994Z" fill="#D9D9D9" />
                  </mask>
                  <g mask="url(#home-play-store-icon-mask)">
                    <rect x="45.457" y="46.4658" width="215.716" height="215.716" transform="rotate(45 45.457 46.4658)" fill="#4EA0FF" />
                    <rect x="197.992" y="199" width="215.716" height="215.716" transform="rotate(45 197.992 199)" fill="#FF4C50" />
                    <rect x="350.525" y="46.4658" width="215.716" height="215.716" transform="rotate(45 350.525 46.4658)" fill="#FFBC28" />
                    <rect x="197.992" y="-106.069" width="215.716" height="215.716" transform="rotate(45 197.992 -106.069)" fill="#34EA9B" />
                  </g>
                </svg>
              </span>
              <span className="home-app-download-copy">
                <span>GET IT ON</span>
                <span>Google Play</span>
              </span>
            </a>
          </div>
      </div>

      {/* ─── Mobile Header (Fixed, single row: 로고 + 알림·검색 아이콘) ──
          260926 사장 시안: 검색창을 빼고 오른쪽에 종(안 읽은 알림 빨간 점)·돋보기. 줄 높이 42 — 전체·남성·여성·외국어 탭(HomeSwipeTabs)이 이 줄의 로고와 아이콘 사이에 올라온다(탭바 줄 없음, 헤더 64).
          iOS 앱은 이 헤더를 숨기고 네이티브 헤더(NativeHomeHeader)를 쓴다. */}
      <BodyPortal>
      <div
        ref={headerRef}
        data-native-home-header
        className="lg:hidden fixed top-0 left-0 right-0 z-[44] px-[10px] pt-[12px] pb-[10px]"
        style={{
          background: 'transparent', // 통합 그라데이션 블러 레이어(HomeSwipeTabs)가 뒤에서 프로스트 처리
        }}
      >
        <div className="flex h-[42px] items-center">
          <Link href="/main" className="shrink-0">
            <Image
              src="/images/logo-freetiful-wordmark.svg"
              alt="Freetiful"
              width={118}
              height={35}
              priority
              className="h-[24px] w-auto"
            />
          </Link>
          <div className="ml-auto flex items-center">
            <Link
              href="/notifications"
              aria-label={unreadNotifications > 0 ? `알림 (안 읽은 알림 ${unreadNotifications}개)` : '알림'}
              className="flex h-[42px] w-11 items-center justify-center transition-transform duration-150 active:scale-90"
            >
              <HeaderBellIcon dot={unreadNotifications > 0} />
            </Link>
            <Link
              href="/search"
              aria-label="검색"
              onTouchStart={warmProsList}
              onMouseEnter={warmProsList}
              className="flex h-[42px] w-11 items-center justify-center transition-transform duration-150 active:scale-90"
            >
              <HeaderSearchIcon />
            </Link>
          </div>
        </div>
      </div>
      </BodyPortal>
      {/* Spacer for fixed header — 탭이 헤더 줄로 올라가 한 줄(64) */}
      <div className="lg:hidden h-[64px]" />

      {/* ─── Mobile Home Hero: Category Cards → Category Tabs → Icon Grid → Banner ─ */}
      <div className="lg:hidden">
        {/* 260927 사장: 맨 위 = 퀵매칭 · 웨딩숲 바로가기 → 카테고리 메뉴 → 배너(8:3) */}
        <HomeShortcuts skipAnim={skipHomeAnim} />

        {/* 카테고리 탭 (전체/결혼식/행사/외국어) + 좌우 스와이프 — 네이티브 홈과 동일 */}
        <HomeSwipeTabs />

        {/* 카테고리 아이콘 영역도 홈 탭 좌우 스와이프 허용(현재 1페이지라 자체 가로스크롤 없음).
            탭은 그대로 동작, 가로 스와이프만 탭 페이저로. (배너는 자체 캐러셀이라 계속 제외) */}
        {/* 카테고리 칸 위 여백(스와이퍼 안쪽 4+8) 12 → 웨딩숲 버튼과 10 이 되게 2 당김 */}
        <div className="-mt-0.5">
          <CategorySwiper />
        </div>

        {/* 배너 — 8:3 · 모서리 5, 카테고리 메뉴 아래(260927 사장). 카테고리 칸 아래 여백(8+8)에서 6 당겨 간격 10(좌우 여백과 같게) */}
        <HomeTopBanner />

      </div>

      {/* ─── Desktop Hero (6032c0b reference) ─────────────────────── */}
      <div className="relative hidden overflow-hidden bg-white lg:block">
        <HomeHeroProfileMarquee images={heroProfileImages} />
        <div className="relative z-10 max-w-6xl mx-auto px-8 pt-8 pb-0 text-center">
          {/* 배너 위 알약 검색창은 뺐다(260928 사장) — 검색은 헤더 돋보기로 */}
          <Reveal delay={150} className="relative z-10">
            {/* PC 첫 화면(260928 사장, 오늘의집 첫 화면 참고) — 왼쪽 4:3 배너(모바일과 같은 5장 + PC 전용 프리티풀 비즈, 4:3 판) + 오른쪽 세로 카드 2개(퀵매칭·웨딩숲, 907:1735 같은 비율).
                칸 너비를 각 비율(4/3 · 907/1735 · 907/1735)로 나눠 세 칸 높이가 딱 맞는다. 모서리 5 = 모바일과 같게. */}
            <div className="mx-auto mb-8 grid max-w-6xl gap-4" style={{ gridTemplateColumns: '1.3333fr 0.5228fr 0.5228fr' }}>
              <HomeTopBanner variant="pc" />
              {HOME_SHORTCUTS.map((b) => <PcHeroCard key={b.href} {...b} />)}
            </div>
          </Reveal>

          <Reveal delay={220} className="mx-auto mb-8 max-w-4xl">
            <CategorySwiper />
          </Reveal>
        </div>
      </div>

      <div className="px-[10px] lg:px-8 pt-0 pb-6 lg:pt-2 lg:pb-12 space-y-4 lg:space-y-7 lg:max-w-7xl lg:mx-auto">

        <LazySection height={2000}>
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 2. 이달의 TOP 사회자                                        */}
        {/* ══════════════════════════════════════════════��════════════ */}
        <section className="mt-4 lg:mt-2">
          <div className="flex items-end justify-between mb-1 lg:mb-4">
            <div className="flex items-center gap-2">
              <img src="/images/trophy.png" alt="" className="w-10 h-10 object-contain shrink-0" />
              <div>
                <h3 className="section-title">BEST 결혼식 사회자</h3>
                <p className="section-subtitle mt-1">검증된 인기 사회자</p>
              </div>
            </div>
            <Link href="/pros" className="text-[13px] text-gray-400 font-medium flex items-center gap-0.5 hover:text-gray-600 pb-0.5 lg:hidden" style={{ transition: 'color 0.3s' }}>
              전체보기 <ChevronRight size={16} />
            </Link>
            <ProSectionPager
              page={bestProsPager.page}
              pageCount={bestProsPager.pageCount}
              total={bestTop10.length}
              expanded={bestProsPager.expanded}
              onPrev={bestProsPager.onPrev}
              onNext={bestProsPager.onNext}
              onToggle={bestProsPager.onToggle}
              showExpand={false}
            />
          </div>

          {/* Mobile: pill-shaped 3:4 photos with rank badges */}
          <div className="grid grid-cols-3 gap-x-3 py-4 lg:hidden">
            {bestWeddingPros.length >= 3 ? [
              { pro: bestWeddingPros[1], border: '#D1D5DB', trophy: '/images/group-1707482188.svg', offset: true },
              { pro: bestWeddingPros[0], border: '#FBBF24', trophy: '/images/group-1707482189.svg', offset: false },
              { pro: bestWeddingPros[2], border: '#CD7F32', trophy: '/images/group-1707482190.svg', offset: true },
            ].map(({ pro, border, trophy, offset }) => (
              <BestPodiumCard key={pro.id} pro={pro} border={border} trophy={trophy} offset={offset} />
            )) : (
              [
                { border: '#D1D5DB', offset: true },
                { border: '#FBBF24', offset: false },
                { border: '#CD7F32', offset: true },
              ].map((s, i) => (
                <div key={i} className={`flex flex-col items-center ${s.offset ? 'mt-5' : ''}`}>
                  <div
                    className="relative w-full bg-gray-200 animate-pulse"
                    style={{ aspectRatio: '3 / 5', borderRadius: '9999px', border: `1.4px solid ${s.border}` }}
                  />
                </div>
              ))
            )}
          </div>

          {/* Desktop: 순위 카드 3열 — 화살표로 넘기고 펼쳐보기로 전부 본다 */}
          {/* grid 로는 마지막 줄(4·5)이 왼쪽으로 붙어서, 가운데 정렬되는 flex-wrap 으로 */}
          <div ref={rankScrollRef} className="hidden gap-x-4 gap-y-4 lg:flex lg:flex-wrap lg:justify-center">
            {bestWeddingPros.length === 0 && (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex w-[366px] shrink-0 gap-3">
                  <div className="h-12 w-9 rounded-full bg-gray-200 animate-pulse" />
                  <div className="h-[234px] w-[176px] rounded-full bg-gray-200 animate-pulse" />
                  <div className="flex-1 py-1">
                    <div className="h-4 w-24 bg-gray-200 rounded-full animate-pulse" />
                    <div className="mt-3 h-3 w-20 bg-gray-100 rounded-full animate-pulse" />
                    <div className="mt-8 h-3 w-16 bg-gray-100 rounded-full animate-pulse" />
                  </div>
                </div>
              ))
            )}
            {bestProsPager.slice(bestTop10).map((pro, i) => (
              <Link
                key={bestProsPager.itemKey(i)}
                style={bestProsPager.itemStyle(i)}
                href={`/pros/${pro.id}`}
                onMouseEnter={() => {
                  if (typeof window !== 'undefined' && window.innerWidth >= 1024) setQuickViewPreloadId(pro.id);
                }}
                onClick={(e) => {
                  if (typeof window === 'undefined' || window.innerWidth < 1024) return;
                  e.preventDefault();
                  setQuickViewPro(pro);
                }}
                className="group flex w-[366px] shrink-0 gap-3"
              >
                <div className="flex items-center shrink-0">
                  <span className="text-[44px] font-black leading-none text-gray-900">{bestProsPager.offset + i + 1}</span>
                </div>
                <div className="relative shrink-0">
                  <div className="h-[234px] w-[176px] overflow-hidden rounded-full bg-gray-100">
                    <img
                      src={pro.images[0] || pro.image}
                      alt={pro.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  </div>
                  {/* 순위 메달 — 사진 아래쪽에 겹쳐 올린다 */}
                  <RankMedal
                    rank={bestProsPager.offset + i + 1}
                    size={56}
                    className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 drop-shadow-[0_4px_10px_rgba(15,23,42,0.18)]"
                  />
                </div>
                <div className="flex min-w-0 max-w-[130px] flex-col justify-center py-0.5">
                  <div>
                    <p className="truncate text-[17px] font-bold leading-tight text-gray-900">{pro.name}</p>
                    <p className="mt-1 truncate text-[13px] text-gray-400">{formatCareerLabel(pro.experience)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
        {/* 섹션 사이 — 줄 없이 간격만(260926 사장 "홈 각 섹션 얇은 줄 없애줘") */}
        <div aria-hidden className="h-12" />

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 3. 더 많은 사회자 — PC 5×2, Mobile 2×3                     */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section>
          <Reveal>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                {/* 앞 그림 = 홈 칸 '결혼식사회자' 아이콘(백합+마이크) — 배경 칸 없이 그림만 크게(260926 사장 '이미지 키우고 백그라운드 풀어줘') */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/category-icons/wedding-mc-icon.png" alt="" className="h-12 w-12 shrink-0 object-contain lg:h-14 lg:w-14" />
                <div>
                  <h3 className="section-title">프리티풀의 더 많은 결혼식 사회자</h3>
                  <p className="section-subtitle mt-1">고객 만족도가 높은 사회자를 만나보세요</p>
                </div>
              </div>
              <Link
                href="/pros"
                onMouseEnter={warmProsList}
                onTouchStart={warmProsList}
                className="text-[13px] text-gray-400 font-medium flex items-center gap-0.5 hover:text-gray-600 lg:hidden"
                style={{ transition: 'color 0.3s' }}
              >
                전체보기 <ChevronRight size={16} />
              </Link>
              <ProSectionPager
                page={moreProsPager.page}
                pageCount={moreProsPager.pageCount}
                total={morePros.length}
                expanded={moreProsPager.expanded}
                onPrev={moreProsPager.onPrev}
                onNext={moreProsPager.onNext}
                onToggle={moreProsPager.onToggle}
              />
            </div>
          </Reveal>
          {/* Mobile: 2열 6장(사진 색 카드는 글 칸이 있어 3열엔 좁다 — 나머지는 '전체보기'), Desktop: 6열 12장 */}
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-6 lg:gap-x-4 lg:gap-y-6">
            {apiPros === null ? (
              [1,2,3,4,5,6,7,8,9,10,11,12].map((i) => (
                // 새 카드 뼈대(사진 4:5 · 이름 · 한 줄 정보 · 칩) — 모바일은 6장만
                <div key={i} className={`overflow-hidden rounded-[20px] bg-[#F7F8FA] ${i > 6 ? 'hidden lg:block' : ''}`}>
                  <div className="skeleton" style={{ width: '100%', aspectRatio: '4/5', borderRadius: 0 }} />
                  <div className="px-3 pb-3.5 pt-2.5">
                    <div className="skeleton" style={{ width: '46%', height: 17, borderRadius: 6 }} />
                    <div className="skeleton mt-2" style={{ width: '78%', height: 12, borderRadius: 5 }} />
                    <div className="skeleton mt-3" style={{ width: '52%', height: 24, borderRadius: 8 }} />
                  </div>
                </div>
              ))
            ) : moreProsPager.slice(morePros).map((pro, i) => (
              <div key={moreProsPager.itemKey(i)} style={moreProsPager.itemStyle(i)} className={!moreProsPager.expanded && i >= 6 ? 'hidden lg:block' : ''}>
                <ProCard pro={pro} index={i} onQuickView={setQuickViewPro} onPreload={setQuickViewPreloadId} />
              </div>
            ))}
          </div>
        </section>
        {/* 섹션 사이 — 줄 없이 간격만(260926 사장 "홈 각 섹션 얇은 줄 없애줘") */}
        <div aria-hidden className="h-12" />

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 4. 프리티풀의 행사 사회자                                  */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section>
          <Reveal>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                {/* 앞 그림 = 홈 칸 '행사사회자' 아이콘(와인+마이크) — 배경 칸 없이 그림만 크게(260926 사장 '이미지 키우고 백그라운드 풀어줘') */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/category-icons/event-mc-icon.png" alt="" className="h-12 w-12 shrink-0 object-contain lg:h-14 lg:w-14" />
                <div>
                  <h3 className="section-title">프리티풀의 행사 사회자</h3>
                  <p className="section-subtitle mt-1">기업행사와 컨퍼런스에 어울리는 사회자를 만나보세요</p>
                </div>
              </div>
              <Link
                href={proCategoryHref('전문행사사회자')}
                onMouseEnter={warmProsList}
                onTouchStart={warmProsList}
                className="text-[13px] text-gray-400 font-medium flex items-center gap-0.5 hover:text-gray-600 lg:hidden"
                style={{ transition: 'color 0.3s' }}
              >
                전체보기 <ChevronRight size={16} />
              </Link>
              <ProSectionPager
                page={eventProsPager.page}
                pageCount={eventProsPager.pageCount}
                total={eventPros.length}
                expanded={eventProsPager.expanded}
                onPrev={eventProsPager.onPrev}
                onNext={eventProsPager.onNext}
                onToggle={eventProsPager.onToggle}
              />
            </div>
          </Reveal>
          {/* Mobile: 2열 6장, Desktop: 「더 많은 사회자」와 동일한 6열 */}
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-6 lg:gap-x-4 lg:gap-y-6">
            {apiPros === null ? (
              [1,2,3,4,5,6,7,8,9,10,11,12].map((i) => (
                // 새 카드 뼈대(사진 4:5 · 이름 · 한 줄 정보 · 칩) — 모바일은 6장만
                <div key={i} className={`overflow-hidden rounded-[20px] bg-[#F7F8FA] ${i > 6 ? 'hidden lg:block' : ''}`}>
                  <div className="skeleton" style={{ width: '100%', aspectRatio: '4/5', borderRadius: 0 }} />
                  <div className="px-3 pb-3.5 pt-2.5">
                    <div className="skeleton" style={{ width: '46%', height: 17, borderRadius: 6 }} />
                    <div className="skeleton mt-2" style={{ width: '78%', height: 12, borderRadius: 5 }} />
                    <div className="skeleton mt-3" style={{ width: '52%', height: 24, borderRadius: 8 }} />
                  </div>
                </div>
              ))
            ) : eventProsPager.slice(eventPros).map((pro, i) => (
              <div key={eventProsPager.itemKey(i)} style={eventProsPager.itemStyle(i)} className={!eventProsPager.expanded && i >= 6 ? 'hidden lg:block' : ''}>
                <ProCard pro={pro} index={i} onQuickView={setQuickViewPro} onPreload={setQuickViewPreloadId} />
              </div>
            ))}
          </div>
        </section>
        {/* 섹션 사이 — 줄 없이 간격만(260926 사장 "홈 각 섹션 얇은 줄 없애줘") */}
        <div aria-hidden className="h-12" />

        {/* 6. 웨딩 파트너 — 업체가 있는 카테고리만 섹션 노출 */}
        {businessPartnerSections.length > 0 && (
          <>
            {businessPartnerSections.map((section, sectionIndex) => (
              <BusinessPartnerSection
                key={section.category}
                category={section.category}
                businesses={section.businesses.slice(0, 8)}
                showDivider={sectionIndex < businessPartnerSections.length - 1}
              />
            ))}
            <div aria-hidden className="h-12" />
          </>
        )}
        </LazySection>
      </div>

      {/* PC 사회자 미리보기 — 홈을 두고 오른쪽만 덮는다 */}
      <ProQuickView
        pro={quickViewPro ? { id: quickViewPro.id, name: quickViewPro.name, image: quickViewPro.images[0] || quickViewPro.image } : null}
        preloadId={quickViewPreloadId}
        onClose={() => setQuickViewPro(null)}
      />
    </div>
  );
}
