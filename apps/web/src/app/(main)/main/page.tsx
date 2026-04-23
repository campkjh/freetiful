'use client';

import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Bell, Star, ChevronRight, ChevronLeft, ArrowRight } from 'lucide-react';
import StackBanner from '@/components/home/StackBanner';
import { triggerFavoriteAnimation } from '@/components/FavoriteAnimation';
import { useAuthStore } from '@/lib/store/auth.store';
import { discoveryApi } from '@/lib/api/discovery.api';
import { favoriteApi } from '@/lib/api/favorite.api';

/* iOS WKWebView 감지 — autoplay 영상 강제 풀스크린 우회용 */
function isIOSWebView(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  // iOS 네이티브 WebView: Safari 토큰 없음 + iPhone/iPad/iPod UA
  return /iPhone|iPad|iPod/.test(ua) && !/Safari/.test(ua) && !/CriOS/.test(ua);
}

/* ─── 30초 이내 재방문 시 애니메이션 스킵 (모듈 레벨로 한 번만 계산) ─── */
let _homeSkipResolved = false;
let _homeSkipValue = false;
function shouldSkipHomeAnim(): boolean {
  if (typeof window === 'undefined') return false;
  if (_homeSkipResolved) return _homeSkipValue;
  try {
    const last = Number(sessionStorage.getItem('home-visited-at') || '0');
    _homeSkipValue = !!(last && Date.now() - last < 30000);
    sessionStorage.setItem('home-visited-at', String(Date.now()));
  } catch { _homeSkipValue = false; }
  _homeSkipResolved = true;
  // 1초 후 플래그 리셋하여 다음 진입에 다시 평가
  setTimeout(() => { _homeSkipResolved = false; }, 1000);
  return _homeSkipValue;
}

/* ─── Scroll Reveal Hook ──────────────────────────────────── */
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  // 재방문 시 처음부터 visible=true로 시작해 애니메이션 스킵
  const [visible, setVisible] = useState(() => typeof window !== 'undefined' && shouldSkipHomeAnim());
  useEffect(() => {
    if (visible) return; // 이미 visible이면 observer 불필요
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
  rating: number;
  reviews: number;
  pudding: number;
  image: string;
  images: string[];
  intro: string;
  price: number;
  experience: number;
  tags: string[];
  available: boolean;
  youtubeId?: string;
  isPartner?: boolean;
}

/* placeholder to anchor subsequent edits */
// ─── Business Partners (기업회원) ──────────────────────────────
interface BusinessPartner {
  id: string;
  category: string;
  name: string;
  location: string;
  images: string[];
  tags: string[];
  originalPrice: number;
  discountPercent: number;
}

const BIZ_CATEGORIES = ['전체', '웨딩홀', '피부과', '스튜디오', '드레스', '헤메샵', '스냅영상'];

// 실제 파트너십 데이터는 /api/v1/business 에서 로드 (목업 데이터 제거됨)
const MOCK_BUSINESSES: BusinessPartner[] = [];

function BusinessCard({ biz }: { biz: BusinessPartner }) {
  // 가상의 리뷰 데이터 (나중에 실제 데이터로 교체)
  const highlightTag = biz.tags[0];
  const highlightCount = 21;
  const rating = 9.0;
  const totalReviews = 927;

  return (
    <Link href={`/businesses/${biz.id}`} className="block group">
      {/* 상단 와이드 이미지 */}
      <div className="relative w-full aspect-[2/1] rounded-xl overflow-hidden bg-gray-100">
        <img
          src={biz.images[0]}
          alt={biz.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {/* 좌측 상단 로고 마크 */}
        <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
          <span className="text-[12px] font-black text-gray-900">{biz.name.charAt(0)}</span>
        </div>
      </div>

      {/* 이름 */}
      <h4 className="mt-3 text-[16px] font-semibold text-gray-900 leading-[1.2] tracking-tight">{biz.name}</h4>

      {/* 하이라이트 태그 */}
      <p className="mt-1 text-[14px] font-semibold text-[#FF6B35] leading-tight">{highlightTag} 후기 {highlightCount}개</p>

      {/* 별점 + 후기수 + 위치 */}
      <div className="mt-1 flex items-center gap-1.5 text-[13px] text-gray-500 leading-tight">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="#FFB800" className="shrink-0">
          <path d="M12 2l2.9 6.5 7.1.8-5.3 4.9 1.5 7L12 17.8 5.8 21.2l1.5-7L2 9.3l7.1-.8L12 2z" />
        </svg>
        <span className="font-semibold text-gray-900">{rating.toFixed(1)}</span>
        <span className="text-gray-300">·</span>
        <span>후기 {totalReviews.toLocaleString()}개</span>
        <span className="text-gray-300">·</span>
        <span>{biz.location}</span>
      </div>

      {/* 태그 */}
      <div className="mt-2 flex flex-wrap gap-1">
        {biz.tags.map((tag) => (
          <span key={tag} className="text-[10px] font-medium px-1.5 rounded-[5px] bg-gray-100 text-gray-600 flex items-center" style={{ height: 22 }}>
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
}

const HERO_CATEGORIES = [
  { name: 'MC·사회자', emoji: '🎤', badge: '인기' },
  { name: '축가', emoji: '🎵' },
  { name: '연주', emoji: '🎹' },
  { name: '쇼호스트', emoji: '📺' },
  { name: '웨딩홀', emoji: '💒', badge: '업종별' },
  { name: '스튜디오', emoji: '📷', badge: '업종별' },
  { name: '드레스', emoji: '👗' },
  { name: '헤어·메이크업', emoji: '💄' },
  { name: 'AI 매칭', emoji: '✨', badge: 'Best' },
  { name: '전체보기', emoji: '⊞' },
];

const BANNERS = [
  { id: 'b1', title: '', subtitle: '', bgColor: '', image: '/images/frame-1707490590.png' },
  { id: 'b2', title: '', subtitle: '', bgColor: '', image: '/images/frame-1707490591.png' },
];

const CATEGORIES = ['전체', 'MC', '가수', '쇼호스트'];
const EVENTS = ['결혼식', '돌잔치', '생신잔치', '기업행사', '강의/클래스'];

const MOBILE_CATEGORY_TABS = ['모두', '결혼식사회자', '관공서 행사', '컨퍼런스/세미나', '체육대회'];

const EVENT_PACKAGES = [
  { name: '라이브커머스', tags: ['온라인마켓', '이벤트진행'], image: '/images/group-1707482240.png' },
  { name: '공식행사', tags: ['기업소통', '전문사회자'], image: '/images/group-1707482241.png' },
  { name: '송년회', tags: ['송년행사', '감사이벤트'], image: '/images/group-1707482242.png' },
  { name: '통번역', tags: ['동시통역', '외국어MC'], image: '/images/group-1707482243.png' },
  { name: '기업 PT', tags: ['프레젠테이션', '전문진행'], image: '/images/group-1707482244.png' },
  { name: '레크리에이션', tags: ['팀미션', '게임사회자'], image: '/images/group-1707482245.png' },
  { name: '팀빌딩', tags: ['팀워크', '조직활성화'], image: '/images/group-1707482246.png' },
  { name: '체육대회', tags: ['체육행사', '운동회'], image: '/images/group-1707482247.png' },
  { name: '워크숍', tags: ['교육행사', '세미나'], image: '/images/group-1707482248.png' },
];

function ProCard({ pro, favorites, toggleFavorite, index }: {
  pro: ProData;
  favorites: Set<string>;
  toggleFavorite: (e: React.MouseEvent, id: string) => void;
  index: number;
}) {
  return (
    <Link
      href={`/pros/${pro.id}`}
      onTouchStart={() => discoveryApi.getProDetail(pro.id)}
      onMouseEnter={() => discoveryApi.getProDetail(pro.id)}
      className="block opacity-0 animate-fade-in group card-press"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'forwards' }}
    >
      <div className="relative rounded-xl overflow-hidden">
        {/* Mobile: single 3:4 image */}
        <div className="lg:hidden" style={{ aspectRatio: '3 / 4' }}>
          <img src={pro.images[0]} alt={pro.name} className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105" />
        </div>
        {/* Desktop: 1+2 grid */}
        <div className="hidden lg:grid grid-cols-[1fr_0.5fr] gap-[2px] h-[220px]">
          <img src={pro.images[0]} alt={pro.name} className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-110" />
          <div className="grid grid-rows-2 gap-[2px]">
            <img src={pro.images[1]} alt="" className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-110" />
            <img src={pro.images[2]} alt="" className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-110" />
          </div>
        </div>
        {/* YouTube 썸네일 이미지 (iframe 대신 — 성능 최적화) */}
        {pro.youtubeId && (
          <div className="absolute bottom-2 right-2 w-[40%] aspect-video rounded-lg overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.3)] border border-white/90 bg-black z-10 flex items-center justify-center">
            <img
              src={`https://img.youtube.com/vi/${pro.youtubeId}/mqdefault.jpg`}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center">
                <svg width="8" height="10" viewBox="0 0 8 10" fill="none"><path d="M0 0L8 5L0 10V0Z" fill="#333"/></svg>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={(e) => toggleFavorite(e, pro.id)}
          className="absolute top-2 right-2 transition-transform duration-200 active:scale-125 z-20"
        >
          {favorites.has(pro.id) ? (
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M1.85156 7.75662C1.85156 11.7173 5.12524 13.8279 7.52163 15.717C8.36726 16.3836 9.18173 17.0113 9.99619 17.0113C10.8107 17.0113 11.6251 16.3836 12.4707 15.717C14.8671 13.8279 18.1408 11.7173 18.1408 7.75662C18.1408 3.79594 13.6611 0.987106 9.99619 4.79486C6.33124 0.987106 1.85156 3.79594 1.85156 7.75662Z" fill="#FF4D4D"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M1.85156 7.75662C1.85156 11.7173 5.12524 13.8279 7.52163 15.717C8.36726 16.3836 9.18173 17.0113 9.99619 17.0113C10.8107 17.0113 11.6251 16.3836 12.4707 15.717C14.8671 13.8279 18.1408 11.7173 18.1408 7.75662C18.1408 3.79594 13.6611 0.987106 9.99619 4.79486C6.33124 0.987106 1.85156 3.79594 1.85156 7.75662Z" fill="rgba(0,0,0,0.3)"/></svg>
          )}
        </button>
      </div>
      <div className="mt-1.5">
        {pro.isPartner && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#3180F7] bg-[#EAF3FF] px-1.5 py-[2px] rounded-full mb-1">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Partners
          </span>
        )}
        <h4 className="text-[15px] font-semibold text-gray-900 leading-tight lg:text-[16px]">{pro.categories[0]|| '사회자'} {pro.name}</h4>
        <div className="flex items-center gap-2 mt-0.5 mb-1">
          <div className="flex items-center gap-0.5">
            <Star size={11} className="fill-yellow-400 text-yellow-400" />
            <span className="text-[12px] font-bold text-gray-900">{pro.rating}</span>
            <span className="text-[11px] text-gray-400">({pro.reviews})</span>
          </div>
          <div className="flex items-center gap-0.5">
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M1.85156 7.75662C1.85156 11.7173 5.12524 13.8279 7.52163 15.717C8.36726 16.3836 9.18173 17.0113 9.99619 17.0113C10.8107 17.0113 11.6251 16.3836 12.4707 15.717C14.8671 13.8279 18.1408 11.7173 18.1408 7.75662C18.1408 3.79594 13.6611 0.987106 9.99619 4.79486C6.33124 0.987106 1.85156 3.79594 1.85156 7.75662Z" fill="#FF4D4D"/></svg>
            <span className="text-[11px] text-gray-400">{pro.pudding || Math.floor(Math.random() * 50 + 10)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          <span className="text-[10px] font-bold px-1.5 rounded-[5px] bg-primary-50 text-primary-600 flex items-center" style={{ height: 22 }}>경력{pro.experience}년</span>
          {pro.tags.map((tag) => (
            <span key={tag} className="text-[10px] font-medium px-1.5 rounded-[5px] bg-gray-100 text-gray-600 flex items-center" style={{ height: 22 }}>{tag}</span>
          ))}
          {pro.available && (
            <span className="text-[10px] font-medium px-1.5 rounded-[5px] bg-gray-100 text-gray-600 flex items-center" style={{ height: 22 }}>즉시출근</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function CherryBlossomAnimation() {
  const petals = [
    { top: '10%', delay: '0s',   duration: '4s',   size: 7 },
    { top: '45%', delay: '1.5s', duration: '4.5s', size: 6 },
    { top: '75%', delay: '2.8s', duration: '4.2s', size: 7 },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {petals.map((p, i) => (
        <span
          key={i}
          className="absolute"
          style={{
            top: p.top,
            left: -8,
            fontSize: p.size,
            lineHeight: 1,
            animation: `petalDrift ${p.duration} ${p.delay} linear infinite`,
          }}
        >
          🌸
        </span>
      ))}
    </div>
  );
}

function SparkleAnimation() {
  const sparkles = [
    { top: '10%', left: '15%', delay: '0s',   duration: '1.4s', size: 8 },
    { top: '20%', left: '75%', delay: '0.3s', duration: '1.6s', size: 6 },
    { top: '55%', left: '88%', delay: '0.7s', duration: '1.3s', size: 7 },
    { top: '80%', left: '10%', delay: '1.0s', duration: '1.5s', size: 6 },
    { top: '45%', left: '5%',  delay: '0.5s', duration: '1.2s', size: 5 },
    { top: '75%', left: '70%', delay: '1.2s', duration: '1.4s', size: 7 },
    { top: '30%', left: '45%', delay: '0.9s', duration: '1.5s', size: 5 },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {sparkles.map((s, i) => (
        <svg
          key={i}
          width={s.size}
          height={s.size}
          viewBox="0 0 20 20"
          className="absolute"
          style={{
            top: s.top,
            left: s.left,
            animation: `sparkle ${s.duration} ${s.delay} ease-in-out infinite`,
          }}
        >
          <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" fill="#3180F7" />
        </svg>
      ))}
    </div>
  );
}

function ApplianceIconSwap() {
  const icons = ['/images/category-icons/appliance.png', '/images/category-icons/appliance-2.png'];
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(timer);
  }, []);

  const src = icons[tick % icons.length];
  return (
    <div className="absolute inset-0 overflow-hidden">
      <img
        key={tick}
        src={src}
        alt="가전"
        className="absolute inset-0 w-full h-full object-contain"
        style={{ animation: 'applianceSwoosh 0.55s cubic-bezier(0.22, 1, 0.36, 1) both' }}
      />
    </div>
  );
}

function LanguageBadge() {
  const LANGS = ['English', '中文', '日本語', 'ภาษาไทย', 'العربية', 'Español'];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % LANGS.length), 2000);
    return () => clearInterval(t);
  }, []);
  return (
    <span
      className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-bold text-white whitespace-nowrap"
      style={{
        background: 'rgba(17, 17, 17, 0.2)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.5)',
        animation: 'langFade 2s ease-in-out infinite',
      }}
      key={idx}
    >
      {LANGS[idx]}
    </span>
  );
}

function CategorySwiper() {
  const CAT_DIR = '/images/category-icons';
  const allCats = [
    { name: '외국어사회자', img: `${CAT_DIR}/foreign-mc.png`, href: '/pros?category=외국어사회자' },
    { name: '웨딩홀', img: `${CAT_DIR}/wedding-hall.png`, href: '/businesses?category=웨딩홀' },
    { name: '드레스', img: `${CAT_DIR}/dress.png`, href: '/businesses?category=드레스' },
    { name: '피부과', img: `${CAT_DIR}/derma.png`, href: '/businesses?category=피부과' },
    { name: '스튜디오', img: `${CAT_DIR}/studio.png`, href: '/businesses?category=스튜디오' },
    { name: '헤어', img: `${CAT_DIR}/hair.png`, href: '/businesses?category=헤어' },
    { name: '메이크업', img: `${CAT_DIR}/makeup.png`, href: '/businesses?category=메이크업' },
    { name: '가전', img: `${CAT_DIR}/appliance.png`, href: '/businesses?category=가전' },
    { name: '스냅', img: `${CAT_DIR}/snap.png`, href: '/businesses?category=스냅' },
    { name: '축가연주', img: `${CAT_DIR}/singer.png`, href: '/pros?category=축가·연주' },
    { name: '한복', img: `${CAT_DIR}/hanbok.png`, href: '/businesses?category=한복' },
    { name: '성형외과', img: `${CAT_DIR}/plastic.png`, href: '/businesses?category=성형외과' },
    { name: '보석', img: `${CAT_DIR}/jewelry.png`, href: '/businesses?category=보석' },
    { name: '답례품', img: `${CAT_DIR}/gift.png`, href: '/businesses?category=답례품' },
    { name: '자동차', img: `${CAT_DIR}/car.png`, href: '/businesses?category=자동차' },
    { name: '신혼여행', img: `${CAT_DIR}/honeymoon.png`, href: '/businesses?category=신혼여행' },
    { name: '가구', img: `${CAT_DIR}/furniture.png`, href: '/businesses?category=가구' },
  ];
  const PAGE_SIZE = 10;
  const pages: typeof allCats[] = [];
  for (let i = 0; i < allCats.length; i += PAGE_SIZE) pages.push(allCats.slice(i, i + PAGE_SIZE));

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activePage, setActivePage] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      const i = Math.round(el.scrollLeft / el.clientWidth);
      setActivePage(i);
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
    <div className="pb-2 pt-1 relative">
      <div ref={scrollRef} className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide" style={{ scrollBehavior: 'smooth' }}>
        {pages.map((pageCats, pi) => (
          <div key={pi} className="shrink-0 w-full snap-start">
            <div className="grid grid-cols-5 gap-y-3 gap-x-1 py-2 pl-[18px] pr-[10px]">
              {pageCats.map((item, i) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex flex-col items-center gap-0.5 opacity-0"
                  style={shouldSkipHomeAnim() ? { opacity: 1 } : { animation: `fadeScaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.3 + i * 0.04}s forwards` }}
                >
                  <div className="w-[60px] h-[60px] flex items-center justify-center relative">
                    {item.name === '웨딩홀' ? (
                      <video
                        src="/images/wedding-hall-video.mp4"
                        autoPlay
                        muted
                        playsInline
                        preload="auto"
                        className="w-full h-full object-cover rounded-full"
                        ref={(v) => { if (v) v.playbackRate = 0.5; }}
                        onEnded={(e) => {
                          const v = e.currentTarget;
                          setTimeout(() => { v.currentTime = 0; v.play().catch(() => {}); }, 1500);
                        }}
                      />
                    ) : item.name === '가전' ? (
                      <ApplianceIconSwap />
                    ) : (
                      <img src={item.img} alt={item.name} className="w-full h-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/cat-wedding-hall.png'; }} />
                    )}
                    {item.name === '외국어사회자' && <LanguageBadge />}
                    {item.name === '헤어' && <CherryBlossomAnimation />}
                  </div>
                  <span className="text-[12px] font-medium text-center leading-tight mt-1" style={{ color: '#51535C' }}>{item.name}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* 우측 플로팅 화살표 — glassmorphism */}
      {activePage < pages.length - 1 && (
        <button
          onClick={() => scrollToPage(activePage + 1)}
          className="absolute top-1/2 -translate-y-1/2 right-2 w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-all z-10"
          style={{
            background: 'rgba(255, 255, 255, 0.55)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          }}
          aria-label="다음 카테고리"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      )}
      {/* 페이지 인디케이터 */}
      <div className="flex items-center justify-center gap-1.5 mt-2">
        {pages.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollToPage(i)}
            className="block rounded-full transition-all duration-300"
            style={{
              width: i === activePage ? 28 : 4,
              height: 3,
              backgroundColor: i === activePage ? '#111111' : '#D1D5DB',
            }}
            aria-label={`페이지 ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const authUser = useAuthStore((s) => s.user);
  const [apiPros, setApiPros] = useState<ProData[] | null>(null);

  /* hero 자동재생 영상 — iOS WebView는 autoPlay가 fullscreen 강제 트리거하므로
     서버 HTML엔 autoPlay 없이 렌더 + iOS 아닌 경우만 JS로 play() 호출 */
  const heroVideo1Ref = useRef<HTMLVideoElement | null>(null);
  const heroVideo2Ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    [heroVideo1Ref.current, heroVideo2Ref.current].forEach((v) => {
      if (!v) return;
      v.loop = true;
      v.muted = true;
      (v as any).playsInline = true;
      v.play().catch(() => undefined);
    });
  }, []);

  // 프로 유저는 /pro-dashboard 로 자동 리다이렉트 (앱 재진입 시)
  // userRole localStorage 도 체크 — 일반모드 전환한 경우는 유지
  const router = useRouter();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const localRole = localStorage.getItem('userRole');
    const isPro = authUser?.role === 'pro' || localRole === 'pro';
    const isGeneralByChoice = localRole === 'general';
    if (isPro && !isGeneralByChoice) {
      router.replace('/pro-dashboard');
    }
  }, [authUser, router]);

  // Fetch pro list from API
  useEffect(() => {
    // 캐시에서 즉시 표시 (두 번째 방문부터 무한 로딩 방지)
    try {
      const cached = localStorage.getItem('freetiful-pros-cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) setApiPros(parsed);
      }
    } catch {}

    // 타임아웃: 8초 내 응답 없으면 빈 배열로 설정
    const timeout = setTimeout(() => {
      setApiPros((prev) => prev ?? []);
    }, 8000);

    discoveryApi.getProList({ limit: 41, sort: 'rating' })
      .then((res) => {
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
          const mapped = deduped.map((p: any, i: number) => ({
            id: p.id,
            name: p.name,
            categories: p.categories || [],
            regions: p.regions || [],
            languages: p.languages || [],
            isNationwide: p.isNationwide ?? false,
            rating: p.avgRating,
            reviews: p.reviewCount,
            pudding: i + 1,
            image: p.images?.[0] || p.profileImageUrl || '',
            images: p.images || [],
            intro: p.shortIntro || '',
            price: p.basePrice || 450000,
            experience: p.careerYears || 0,
            tags: p.isFeatured ? ['인기', '추천'] : (p.isNationwide ? ['전국가능'] : []),
            available: true,
            youtubeId: p.youtubeUrl?.match(/v=([^&]+)/)?.[1],
            isPartner: p.showPartnersLogo || p.isFeatured || false,
          }));
          setApiPros(mapped);
          try { localStorage.setItem('freetiful-pros-cache', JSON.stringify(mapped)); } catch {}
        } else {
          setApiPros([]);
        }
      })
      .catch(() => {
        clearTimeout(timeout);
        setApiPros([]);
      });

    return () => clearTimeout(timeout);
  }, []);

  // Use API data only - no mock fallback
  const prosData = apiPros || [];

  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored: string[] = JSON.parse(localStorage.getItem('freetiful-favorites') || '[]');
      return new Set(stored);
    } catch { return new Set(); }
  });
  const rankScrollRef = useRef<HTMLDivElement>(null);
  const [selectedMobileTab, setSelectedMobileTab] = useState('결혼식사회자');
  const [bannerIdx, setBannerIdx] = useState(0);

  // 배너: DB → API, 실패 시 하드코딩 폴백
  const [banners, setBanners] = useState(BANNERS);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/banners').then((r) => r.ok ? r.json() : null).then((data) => {
      if (cancelled || !Array.isArray(data) || data.length === 0) return;
      setBanners(data.map((b: any) => ({
        id: b.id,
        title: b.title || '',
        subtitle: b.subtitle || '',
        bgColor: b.bgColor || '',
        image: b.imageUrl,
        linkUrl: b.linkUrl || null,
      })));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setBannerIdx((i) => (i + 1) % banners.length), 4000);
    return () => clearInterval(timer);
  }, [banners.length]);
  const [selectedBizCat, setSelectedBizCat] = useState<string | null>(null);
  const [viewedPros, setViewedPros] = useState<{ id: string; time: number }[]>([]);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('viewed-pros') || '[]');
      setViewedPros(stored);
    } catch {}
  }, []);
  const [logoVisible, setLogoVisible] = useState(true);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(56);

  useEffect(() => {
    const onScroll = () => {
      // 약 160px 이상 스크롤하면 (결혼식사회자 버튼 영역 지나면) 로고 숨김
      setLogoVisible(window.scrollY < 160);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!headerRef.current) return;
    const ro = new ResizeObserver(([entry]) => setHeaderH(entry.contentRect.height + 12));
    ro.observe(headerRef.current);
    return () => ro.disconnect();
  }, []);

  const filteredBiz = MOCK_BUSINESSES.filter((b) => !selectedBizCat || b.category === selectedBizCat);

  const toggleFavorite = (e: React.MouseEvent, proId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const isAdding = !favorites.has(proId);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(proId)) next.delete(proId);
      else next.add(proId);
      // Sync to localStorage
      try {
        const stored: string[] = JSON.parse(localStorage.getItem('freetiful-favorites') || '[]');
        if (isAdding) {
          if (!stored.includes(proId)) stored.push(proId);
        } else {
          const idx = stored.indexOf(proId);
          if (idx !== -1) stored.splice(idx, 1);
        }
        localStorage.setItem('freetiful-favorites', JSON.stringify(stored));
      } catch {}
      return next;
    });
    // Sync to API if authenticated
    if (authUser) {
      favoriteApi.toggle(proId).catch(() => {});
    }
    // Trigger fly animation when adding to favorites
    if (isAdding) {
      const pro = prosData.find((p) => p.id === proId);
      if (pro) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        triggerFavoriteAnimation({
          imageUrl: pro.image,
          startX: rect.left + rect.width / 2,
          startY: rect.top + rect.height / 2,
        });
      }
    }
  };

  const [loading, setLoading] = useState(() => typeof window !== 'undefined' ? !sessionStorage.getItem('visited-main') : true);
  useEffect(() => { if (!loading) return; const t = setTimeout(() => { setLoading(false); sessionStorage.setItem('visited-main', '1'); }, 300); return () => clearTimeout(t); }, [loading]);

  if (loading) {
    return (
      <div className="bg-white min-h-screen w-full px-4 pt-16">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div className="skeleton" style={{ width: 100, height: 28 }} />
          <div className="flex gap-2">
            <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
            <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
          </div>
        </div>
        {/* Banner skeleton */}
        <div className="skeleton mb-6" style={{ width: '100%', height: 160 }} />
        {/* Category chips skeleton */}
        <div className="flex gap-2 mb-6">
          {[80, 60, 70, 90].map((w, i) => (
            <div key={i} className="skeleton" style={{ width: w, height: 36, borderRadius: 18 }} />
          ))}
        </div>
        {/* Card skeletons */}
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="skeleton mb-2" style={{ width: '100%', height: 180 }} />
              <div className="skeleton mb-1" style={{ width: '70%', height: 14 }} />
              <div className="skeleton" style={{ width: '50%', height: 12 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen w-full">
      {/* ─── Mobile Header (Fixed, single row: logo + search + bell) ── */}
      <div
        ref={headerRef}
        className="lg:hidden fixed top-0 left-0 right-0 z-30 px-[10px] pt-[12px] pb-[10px]"
        style={{
          background: 'linear-gradient(to bottom, rgba(255,255,255,1) 60%, rgba(255,255,255,0) 100%)',
        }}
      >
        <div className="flex items-center gap-2">
          {/* Logo - shrinks & disappears on scroll */}
          <Link
            href="/main"
            className="shrink-0 origin-left"
            style={{
              width: logoVisible ? 'auto' : 0,
              opacity: logoVisible ? 1 : 0,
              transform: logoVisible ? 'scale(1)' : 'scale(0.5)',
              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              overflow: 'hidden',
            }}
          >
            <Logo className="h-[24px] w-auto text-gray-900" />
          </Link>
          {/* Search bar - expands with bounce */}
          <Link
            href="/search"
            className="flex items-center gap-2 bg-surface-100 rounded-full px-3 py-2.5 hover:bg-surface-200/80"
            style={{
              flex: 1,
              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <Search size={16} className="text-gray-400 shrink-0" />
            <span className="text-gray-400 text-[16px] font-medium truncate">어떤 전문가를 찾으시나요?</span>
          </Link>
          {/* Bell icon */}
          <Link
            href="/notifications"
            className="relative p-2 shrink-0 rounded-full hover:bg-surface-100/80"
            style={{
              width: logoVisible ? 'auto' : 0,
              opacity: logoVisible ? 1 : 0,
              transform: logoVisible ? 'scale(1)' : 'scale(0.5)',
              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              overflow: 'hidden',
              padding: logoVisible ? undefined : 0,
            }}
          >
            <Bell size={20} className="text-gray-700" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-500 rounded-full ring-2 ring-white" />
          </Link>
        </div>
      </div>
      {/* Spacer for fixed header */}
      <div className="lg:hidden h-[56px]" />

      {/* ─── Mobile: Category Cards → Category Tabs → Icon Grid → Banner ─ */}
      <div className="lg:hidden">
        {/* Category cards (결혼식사회자 영상 + 행사사회자) */}
        <div className="px-[10px] pt-3 pb-1">
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/events/wedding"
              className="block relative rounded-2xl overflow-hidden opacity-0 aspect-[5.5/2.8] transition-transform duration-200 hover:scale-[1.02] active:scale-[0.95] active:brightness-90"
              style={shouldSkipHomeAnim() ? { opacity: 1 } : { animation: 'fadeSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards' }}
            >
              <video
                ref={heroVideo1Ref}
                src="/images/reference-video-1775801211148.mp4#t=0.001"
                muted
                playsInline
                preload="metadata"
                controls={false}
                disablePictureInPicture
                webkit-playsinline="true"
                x5-playsinline="true"
                className="w-full h-full object-cover bg-gray-800"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <span className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: '#2B313D' }}>빠른무료견적</span>
              <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                <div>
                  <span className="text-[16px] font-bold text-white block leading-tight">전문결혼식</span>
                  <span className="text-[16px] font-bold text-white block leading-tight">사회자 찾기</span>
                </div>
                <ChevronRight size={20} className="text-white/80 shrink-0" />
              </div>
            </Link>
            <Link
              href="/events/corporate"
              className="relative rounded-2xl px-3 flex items-center -space-x-3 opacity-0 active:scale-[0.97] transition-transform"
              style={shouldSkipHomeAnim() ? { opacity: 1 } : { animation: 'fadeSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards' }}
            >
              <RoundedRectBorderTrain color="#2B313D" />
              <video
                ref={heroVideo2Ref}
                src="/images/kling_20260410_作品_A_specific_3877_0.mp4#t=0.001"
                muted
                playsInline
                preload="metadata"
                controls={false}
                disablePictureInPicture
                webkit-playsinline="true"
                x5-playsinline="true"
                className="w-20 h-20 object-cover shrink-0 rounded-xl bg-gray-100"
                style={{ transition: 'opacity 0.2s ease' }}
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  if (v.duration - v.currentTime <= 0.2) {
                    v.style.opacity = `${(v.duration - v.currentTime) / 0.2}`;
                  } else if (v.currentTime <= 0.2) {
                    v.style.opacity = `${v.currentTime / 0.2}`;
                  } else {
                    v.style.opacity = '1';
                  }
                }}
              />
              <div className="leading-none relative z-10">
                <span className="text-[16px] font-semibold block leading-tight" style={{ color: '#2B313D' }}>전문 행사</span>
                <span className="text-[16px] font-semibold block leading-tight" style={{ color: '#2B313D' }}>사회자 찾기</span>
              </div>
            </Link>
          </div>
        </div>

        {/* 3. Category text tabs */}
        <div
          className="flex gap-2 overflow-x-auto scrollbar-hide px-[10px] py-2 opacity-0"
          style={shouldSkipHomeAnim() ? { opacity: 1 } : { animation: 'fadeSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards' }}
        >
          {['결혼식사회자', '행사 맞춤의뢰', 'MC', '기업행사', '연례행사', '체육대회', '컨퍼런스'].map((tab) => {
            const active = selectedMobileTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setSelectedMobileTab(tab)}
                className={`shrink-0 text-[12px] font-medium px-3 py-1.5 rounded-[12px] transition-all duration-300 active:scale-95 ${
                  active
                    ? 'bg-[#2B313D] text-white shadow-[0_2px_8px_rgba(43,49,61,0.2)]'
                    : 'text-[#51535C]'
                }`}
                style={active ? {} : { backgroundColor: '#F2F3F5' }}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* 4. Icon category grid — 5x2, 스와이프로 다음 페이지 */}
        <CategorySwiper />


        {/* 5. Slide Banner — 아이콘 그리드 아래, 관심있는 전문가 위 */}
        <div className="px-[10px] pt-2 pb-1">
          <div
            className="relative w-full overflow-hidden rounded-2xl"
            style={{ aspectRatio: '1170/300' }}
          >
            <div className="flex transition-transform duration-500 ease-out h-full"
              style={{ width: `${banners.length * 100}%`, transform: `translateX(-${bannerIdx * (100 / banners.length)}%)` }}
            >
              {banners.map((b, i) => (
                <div
                  key={b.id || i}
                  className="h-full shrink-0 cursor-pointer"
                  style={{ width: `${100 / banners.length}%` }}
                  onClick={() => {
                    const link = (b as any).linkUrl;
                    if (!link) return;
                    if (/^https?:\/\//.test(link)) window.open(link, '_blank');
                    else window.location.href = link;
                  }}
                >
                  {b.image ? (
                    <img src={b.image} alt="" className="w-full h-full object-cover" draggable={false} />
                  ) : (
                    <div className={`w-full h-full ${b.bgColor} flex items-center px-6`}>
                      <div>
                        <p className="text-white/80 text-[13px] font-medium">{b.title}</p>
                        <p className="text-white text-[20px] font-bold mt-1">{b.subtitle}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* 인디케이터 */}
            <div className="absolute bottom-3 right-4 bg-black/30 rounded-full px-2.5 py-1 text-[11px] text-white font-medium">
              {bannerIdx + 1} / {banners.length}
            </div>
          </div>
        </div>

      </div>

      {/* ─── Desktop Hero ────────────────────────────────────────────── */}
      <div className="hidden lg:block bg-white border-b border-gray-100/50">
        <div className="max-w-7xl mx-auto px-8 py-20">
          <div className="flex items-center justify-between gap-16">
            <div className="flex-1 max-w-xl">
              <p className="eyebrow mb-4">WEDDING PROFESSIONALS</p>
              <h2 className="headline mb-5">
                당신의 특별한 날,<br />
                <span className="text-primary-500">완벽한 전문가</span>를 만나세요
              </h2>
              <p className="text-[16px] text-gray-500 mb-10 leading-relaxed max-w-[50ch]">
                웨딩 MC, 축가 가수, 쇼호스트까지<br />
                AI 매칭으로 딱 맞는 전문가를 추천받으세요
              </p>
              <div className="flex gap-3">
                <Link href="/match" className="btn-primary w-auto inline-flex items-center gap-2 px-8">
                  견적 요청하기 <ArrowRight size={18} />
                </Link>
                <Link href="/pros" className="btn-outline w-auto px-8">
                  전문가 둘러보기
                </Link>
              </div>
            </div>
            {/* Hero visual — Stack Banner */}
            <div className="flex-1 max-w-lg">
              <StackBanner banners={banners} />
            </div>
          </div>

          {/* ─── Category Icons ─────────────────────────────────────── */}
          <div className="flex items-start justify-between mt-14 gap-2">
            {HERO_CATEGORIES.map((cat) => (
              <Link
                key={cat.name}
                href={cat.name === '전체보기' ? '/pros' : `/pros?category=${encodeURIComponent(cat.name)}`}
                className="flex flex-col items-center gap-2 group w-[90px]"
              >
                <div className="relative">
                  {cat.badge && (
                    <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                      cat.badge === 'Best'
                        ? 'bg-red-500 text-white'
                        : 'bg-white text-red-500 border border-red-400'
                    }`}>
                      {cat.badge}
                    </span>
                  )}
                  <div className="w-14 h-14 rounded-2xl bg-surface-50 flex items-center justify-center text-[28px] group-hover:bg-surface-100 group-hover:scale-105 transition-all duration-200">
                    {cat.emoji}
                  </div>
                </div>
                <span className="text-[13px] text-gray-700 font-medium text-center leading-tight group-hover:text-gray-900 transition-colors">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="px-[10px] lg:px-0 pt-0 pb-6 lg:py-12 space-y-4 lg:space-y-10 lg:max-w-7xl lg:mx-auto lg:px-8">
        {/* ─── Category Chips (Desktop only) ─────────────────────────── */}
        <div className="hidden lg:flex gap-2.5 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((cat, i) => (
            <button key={cat} className={i === 0 ? 'chip-active' : 'chip-inactive'}>
              {cat}
            </button>
          ))}
        </div>

        <LazySection height={2000}>
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 0. 관심있는 전문가 (최근 본 전문가)                            */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {viewedPros.length > 0 && (() => {
          const viewedProData = viewedPros
            .map((v) => {
              const pro = prosData.find((p) => p.id === v.id);
              return pro ? { ...pro, viewedTime: v.time } : null;
            })
            .filter(Boolean) as (ProData & { viewedTime: number })[];
          if (viewedProData.length === 0) return null;
          const isRecent = (time: number) => Date.now() - time < 1000 * 60 * 30; // 30분 이내
          return (
            <section>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h3 className="section-title">관심있는 전문가</h3>
                  <p className="section-subtitle mt-1">최근 본 전문가를 다시 확인하세요</p>
                </div>
                <Link href="/favorites" className="text-[13px] text-gray-400 font-medium flex items-center gap-0.5 hover:text-gray-600" style={{ transition: 'color 0.3s' }}>
                  전체보기 <ChevronRight size={16} />
                </Link>
              </div>
              <div className="flex gap-0 overflow-x-auto overflow-y-visible scrollbar-hide -mx-[10px] px-[10px] lg:mx-0 lg:px-0">
                {viewedProData.map((pro) => (
                  <Link
                    key={pro.id}
                    href={`/pros/${pro.id}`}
                    className="shrink-0 w-[100px] flex flex-col items-center"
                  >
                    <div className="relative w-[84px] h-[112px] rounded-xl overflow-hidden">
                      <img src={pro.image} alt={pro.name} className="w-full h-full object-cover" />
                      {isRecent(pro.viewedTime) && (
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-white bg-red-500">
                          최근 본
                        </span>
                      )}
                    </div>
                    <p className="text-[16px] font-bold text-gray-900 mt-1.5 text-center">{pro.name}</p>
                    <p className="text-[14px] text-gray-400">{pro.categories[0] || '사회자'}</p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 2. 이달의 TOP 전문가                                        */}
        {/* ══════════════════════════════════════════════��════════════ */}
        <section>
          {/* Mobile header */}
          <div className="lg:hidden flex items-end justify-between mb-1">
            <div className="flex items-center gap-2">
              <img src="/images/trophy.png" alt="" className="w-10 h-10 object-contain shrink-0" />
              <div>
                <h3 className="section-title">BEST 결혼식 사회자</h3>
                <p className="section-subtitle mt-1">가장 많이 찾았던 전문가를 한눈에</p>
              </div>
            </div>
            <Link href="/pros" className="text-[13px] text-gray-400 font-medium flex items-center gap-0.5 hover:text-gray-600 pb-0.5" style={{ transition: 'color 0.3s' }}>
              전체보기 <ChevronRight size={16} />
            </Link>
          </div>

          {/* Desktop header */}
          <div className="hidden lg:flex items-center justify-between mb-5">
            <div>
              <h3 className="section-title">이달의 TOP 전문가</h3>
              <p className="section-subtitle mt-1">리뷰와 평점으로 선정된 TOP 5</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => rankScrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })}
                className="p-1.5 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft size={18} className="text-gray-500" />
              </button>
              <button
                onClick={() => rankScrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })}
                className="p-1.5 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <ChevronRight size={18} className="text-gray-500" />
              </button>
            </div>
          </div>

          {/* Mobile: Pill-shaped 3:4 photos with rank badges (top 3) */}
          <div className="lg:hidden grid grid-cols-3 gap-x-3 py-4">
            {prosData.length >= 3 ? [
              { pro: prosData[1], border: '#D1D5DB', trophy: '/images/group-1707482188.svg', offset: true },
              { pro: prosData[0], border: '#FBBF24', trophy: '/images/group-1707482189.svg', offset: false },
              { pro: prosData[2], border: '#CD7F32', trophy: '/images/group-1707482190.svg', offset: true },
            ].map(({ pro, border, trophy, offset }) => (
              <Link key={pro.id} href={`/pros/${pro.id}`} className={`flex flex-col items-center ${offset ? 'mt-5' : ''}`}>
                <div className="relative w-full aspect-[3/4]">
                  <img
                    src={pro.image}
                    alt={pro.name}
                    className="w-full h-full object-cover shadow-md"
                    style={{ borderRadius: '9999px', border: `1.4px solid ${border}` }}
                  />
                  <img src={trophy} alt="" className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[29px] h-[18px]" />
                </div>
                <p className="text-[14px] font-bold text-gray-900 mt-4">{pro.name}</p>
                <p className="text-[12px] text-gray-400">{pro.categories[0] || '사회자'}</p>
              </Link>
            )) : (
              [
                { border: '#D1D5DB', offset: true },
                { border: '#FBBF24', offset: false },
                { border: '#CD7F32', offset: true },
              ].map((s, i) => (
                <div key={i} className={`flex flex-col items-center ${s.offset ? 'mt-5' : ''}`}>
                  <div
                    className="relative w-full aspect-[3/4] bg-gray-200 animate-pulse shadow-md"
                    style={{ borderRadius: '9999px', border: `1.4px solid ${s.border}` }}
                  />
                  <div className="h-3.5 w-16 bg-gray-200 rounded-full animate-pulse mt-4" />
                  <div className="h-2.5 w-10 bg-gray-100 rounded-full animate-pulse mt-2" />
                </div>
              ))
            )}
          </div>

          {/* Desktop: horizontal scroll rank cards */}
          <div
            ref={rankScrollRef}
            className="hidden lg:flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
          >
            {prosData.length === 0 && (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[280px] snap-start flex gap-3">
                  <div className="flex items-center shrink-0">
                    <div className="h-9 w-7 bg-gray-200 rounded animate-pulse" />
                  </div>
                  <div className="w-[80px] h-[106px] rounded-lg bg-gray-200 animate-pulse shrink-0" />
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                    <div>
                      <div className="h-2.5 w-10 bg-gray-100 rounded-full animate-pulse" />
                      <div className="h-3.5 w-20 bg-gray-200 rounded-full animate-pulse mt-1.5" />
                    </div>
                    <div className="h-2.5 w-14 bg-gray-100 rounded-full animate-pulse" />
                  </div>
                </div>
              ))
            )}
            {prosData.slice(0, 5).map((pro, i) => (
              <Link
                key={pro.id}
                href={`/pros/${pro.id}`}
                className="flex-shrink-0 w-[280px] snap-start flex gap-3 group"
              >
                {/* Rank Number -- vertically centered */}
                <div className="flex items-center shrink-0">
                  <span className="text-[36px] font-black text-gray-900 leading-none">{i + 1}</span>
                </div>

                {/* Photo 3:4 */}
                <div className="w-[80px] h-[106px] rounded-lg overflow-hidden shrink-0">
                  <img
                    src={pro.image}
                    alt={pro.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div>
                    <span className="text-[11px] font-medium text-gray-400">{pro.categories[0] || '사회자'}</span>
                    <p className="text-[15px] font-bold text-gray-900 leading-tight">{pro.name}</p>
                  </div>
                  <div className="flex items-center gap-0.5 mt-1">
                    <Star size={11} className="fill-yellow-400 text-yellow-400" />
                    <span className="text-[12px] font-bold text-gray-900">{pro.rating}</span>
                    <span className="text-[11px] text-gray-400">({pro.reviews})</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
        <div className="my-6 border-t border-gray-100" />

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 지금 접속중인 전문가 (100px 원형 + hover 부채꼴)            */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {prosData.length > 0 && (
          <section>
            <Reveal>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="section-title">지금 접속중인 전문가</h3>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                    </span>
                  </div>
                  <p className="section-subtitle mt-1">지금 바로 상담 가능한 전문가예요</p>
                </div>
              </div>
            </Reveal>
            <div className="flex gap-3 overflow-x-auto overflow-y-visible scrollbar-hide -mx-[10px] px-[10px] lg:mx-0 lg:px-0 pt-3">
              {prosData.slice(0, 10).map((pro, idx) => {
                const minutesAgo = (idx * 7) % 60; // 간단한 더미 시간
                const isNow = idx < 3;
                const images = pro.images && pro.images.length >= 3 ? pro.images : [pro.image, pro.image, pro.image];
                return (
                  <Link
                    key={pro.id}
                    href={`/pros/${pro.id}`}
                    className="flex items-center gap-4 group p-[10px] rounded-[14px] active:bg-black/5 active:scale-[0.97] transition-all duration-200 shrink-0"
                  >
                    <div className="relative w-[100px] h-[100px] shrink-0 my-3 z-10">
                      <img
                        src={images[2]}
                        alt=""
                        className="absolute w-[100px] h-[100px] rounded-full object-cover border-[1.4px] border-white shadow-md transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-[64px] group-hover:translate-y-[-12px] group-hover:rotate-[12deg] group-hover:scale-90 z-[1]"
                      />
                      <img
                        src={images[1]}
                        alt=""
                        className="absolute w-[100px] h-[100px] rounded-full object-cover border-[1.4px] border-white shadow-md transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] delay-[50ms] group-hover:translate-x-[34px] group-hover:translate-y-[-18px] group-hover:rotate-[6deg] group-hover:scale-95 z-[2]"
                      />
                      <img
                        src={images[0]}
                        alt={pro.name}
                        className="absolute w-[100px] h-[100px] rounded-full object-cover border-[1.4px] border-white shadow-lg z-[3] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
                      />
                      <span className={`absolute bottom-1 right-1 z-[4] w-4 h-4 rounded-full border-[1.4px] border-white ${isNow ? 'bg-green-500' : 'bg-gray-300'}`} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[12px] font-medium text-gray-400">{pro.categories[0] || '사회자'}</span>
                      <p className="text-[16px] font-bold text-gray-900 leading-tight truncate">{pro.name}</p>
                      <p className="text-[12px] mt-1">
                        {isNow ? (
                          <span className="text-green-600 font-semibold">현재 접속중</span>
                        ) : (
                          <span className="text-gray-400">접속 {minutesAgo}분 전</span>
                        )}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
        {prosData.length > 0 && <div className="my-6 border-t border-gray-100" />}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 지역별 사회자                                              */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {prosData.length > 0 && (() => {
          const REGIONS = ['전국', '서울/경기', '충청', '경상', '전라', '강원', '제주'];
          return (
            <section>
              <Reveal>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="section-title">지역별 사회자</h3>
                    <p className="section-subtitle mt-1">원하는 지역의 전문가를 찾아보세요</p>
                  </div>
                </div>
              </Reveal>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-[10px] px-[10px] mb-4">
                {REGIONS.map((r) => (
                  <Link
                    key={r}
                    href={`/pros?region=${encodeURIComponent(r)}`}
                    className="shrink-0 px-3.5 py-1.5 text-[13px] font-medium bg-gray-100 text-gray-700"
                    style={{ borderRadius: 20 }}
                  >
                    {r}
                  </Link>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-x-2 gap-y-4 lg:grid-cols-5 lg:gap-x-4">
                {prosData.slice(0, 6).map((pro, i) => (
                  <div key={pro.id} className={i >= 6 ? 'hidden lg:block' : ''}>
                    <ProCard pro={pro} favorites={favorites} toggleFavorite={toggleFavorite} index={i} />
                  </div>
                ))}
              </div>
            </section>
          );
        })()}
        {prosData.length > 0 && <div className="my-6 border-t border-gray-100" />}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 3. 인기 전문가 — PC 5×2, Mobile 2×3                        */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section>
          <Reveal>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="section-title">인기 전문가</h3>
                <p className="section-subtitle mt-1">고객 만족도가 높은 전문가를 만나보세요</p>
              </div>
              <Link href="/pros" className="text-[13px] text-gray-400 font-medium flex items-center gap-0.5 hover:text-gray-600" style={{ transition: 'color 0.3s' }}>
                전체보기 <ChevronRight size={16} />
              </Link>
            </div>
          </Reveal>
          {/* Mobile: 3×3 grid, Desktop: 5×2 grid */}
          <div className="grid grid-cols-3 gap-x-2 gap-y-4 lg:grid-cols-5 lg:gap-x-4 lg:gap-y-8">
            {apiPros === null ? (
              [1,2,3,4,5,6,7,8,9].map((i) => (
                <div key={i} className={i >= 9 ? 'hidden lg:block' : ''}>
                  <div className="skeleton mb-2" style={{ width: '100%', aspectRatio: '3/4', borderRadius: 12 }} />
                  <div className="skeleton mb-1" style={{ width: 48, height: 10, borderRadius: 4 }} />
                  <div className="skeleton mb-1" style={{ width: '80%', height: 13, borderRadius: 4 }} />
                  <div className="skeleton" style={{ width: '55%', height: 11, borderRadius: 4 }} />
                </div>
              ))
            ) : prosData.slice(0, 10).map((pro, i) => (
              <div key={pro.id} className={i >= 9 ? 'hidden lg:block' : ''}>
                <ProCard pro={pro} favorites={favorites} toggleFavorite={toggleFavorite} index={i} />
              </div>
            ))}
          </div>
        </section>
        <div className="my-6 border-t border-gray-100" />

        {/* 6. 웨딩 파트너 (API 데이터 있을 때만 노출) */}
        {filteredBiz.length > 0 && (
          <>
            <section>
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="section-title">웨딩 파트너</h3>
                    <p className="section-subtitle mt-1">프리티풀이 엄선한 웨딩 업체를 만나보세요</p>
                  </div>
                  <Link href="/businesses" className="text-[13px] text-gray-400 font-medium flex items-center gap-0.5 hover:text-gray-600" style={{ transition: 'color 0.3s' }}>
                    전체보기 <ChevronRight size={16} />
                  </Link>
                </div>
                <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide -mx-[10px] px-[10px] lg:mx-0 lg:px-0">
                  <button onClick={() => setSelectedBizCat(null)} className={`relative isolate chip ${selectedBizCat === null ? 'text-white' : 'chip-inactive'}`}>
                    {selectedBizCat === null && <span className="absolute inset-0 bg-gray-900 rounded-full" style={{ zIndex: -1 }} />}
                    <span className="relative">전체</span>
                  </button>
                  {BIZ_CATEGORIES.slice(1).map((cat) => (
                    <button key={cat} onClick={() => setSelectedBizCat(selectedBizCat === cat ? null : cat)} className={`relative isolate chip ${selectedBizCat === cat ? 'text-white' : 'chip-inactive'}`}>
                      {selectedBizCat === cat && <span className="absolute inset-0 bg-gray-900 rounded-full" style={{ zIndex: -1 }} />}
                      <span className="relative">{cat}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-[10px] px-[10px] snap-x snap-mandatory scroll-pl-[10px]">
                {filteredBiz.slice(0, 8).map((biz) => (
                  <div key={biz.id} className="shrink-0 w-[78%] snap-start lg:w-[42%]">
                    <BusinessCard biz={biz} />
                  </div>
                ))}
              </div>
            </section>
            <div className="my-6 border-t border-gray-100" />
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 7. 행사 맞춤의뢰 (Mobile only)                              */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="lg:hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="section-title">행사 맞춤의뢰</h3>
              <p className="section-subtitle mt-1">프리티풀의 완벽한 행사 인프라</p>
            </div>
            <Link href="/match" className="text-[13px] text-primary-500 font-semibold flex items-center gap-0.5 hover:text-primary-600" style={{ transition: 'color 0.3s' }}>
              전체보기 <ChevronRight size={16} />
            </Link>
          </div>

          {/* Package Cards Grid */}
          <div className="grid grid-cols-3 gap-2">
            {EVENT_PACKAGES.map((pkg) => (
              <Link
                key={pkg.name}
                href={`/match?event=${encodeURIComponent(pkg.name)}`}
                className="block group"
              >
                {/* Card Image */}
                <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                  <img
                    src={pkg.image}
                    alt={pkg.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                {/* Info */}
                <p className="mt-1.5 text-[16px] font-bold text-gray-900 leading-tight line-clamp-1">{pkg.name}</p>
                <p className="text-[14px] text-gray-400 leading-tight line-clamp-1 mt-0.5">
                  {pkg.tags.join(' · ')}
                </p>
              </Link>
            ))}
          </div>
        </section>
        <div className="my-6 border-t border-gray-100" />
        </LazySection>
      </div>

    </div>
  );
}
