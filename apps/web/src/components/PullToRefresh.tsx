"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// 당겨서 새로고침 — 스피너 대신 동물 친구 프로필(20종)이 동그라미 안에서 통통 튀며 계속 바뀐다.
//
// 웹뷰 규칙
//  · 터치 이벤트로 직접 구현한다(overscroll 로는 안드/iOS 동작이 제각각).
//  · preventDefault 를 하려면 리스너를 { passive: false } 로 달아야 한다 →
//    JSX 의 onTouchMove 로는 안 되고 addEventListener 로 붙인다.
//  · 맨 위(scrollY<=0)에서 아래로 당길 때만 가로챈다. 그 외엔 평소 스크롤 그대로.
// 일반 회원 기본 프로필과 같은 동물 친구 20종(public/images/avatars).
const AVATARS = Array.from({ length: 20 }, (_, i) => `/images/avatars/animal-${String(i + 1).padStart(2, "0")}.webp`);
const THRESHOLD = 68; // 이만큼 당기면 새로고침
const MAX_PULL = 110; // 더 당겨도 여기까지만 내려온다
const SWAP_PX = 22; // 당기는 동안 이 간격마다 프로필이 바뀐다
const SWAP_MS = 230; // 새로고침 도는 동안 프로필 교체 주기

// 처음 맨 위에서 터치할 때 한 번만 20장을 미리 받아 둔다(당기며 바뀔 때 깜빡이지 않게).
let avatarsPreloaded = false;
function preloadAvatars() {
  if (avatarsPreloaded || typeof window === "undefined") return;
  avatarsPreloaded = true;
  for (const src of AVATARS) {
    const img = new window.Image();
    img.decoding = "async";
    img.src = src;
  }
}

export default function PullToRefresh({
  onRefresh,
  disabled,
  offsetTop = 0,
}: {
  onRefresh: () => Promise<void> | void;
  disabled?: boolean;
  /** 화면 위에 고정 헤더가 있으면 그 높이만큼 내려서 띄운다(헤더에 가리지 않게) */
  offsetTop?: number;
}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  // 당길 때마다 다른 동물부터 시작한다.
  const [seed, setSeed] = useState(0);
  const startY = useRef<number | null>(null);
  const startX = useRef(0);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  // 렌더 중에 ref 를 건드리면 컴파일러가 막는다 → 이펙트에서 최신 콜백을 담아둔다.
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const finish = useCallback(() => {
    refreshingRef.current = false;
    setRefreshing(false);
    pullRef.current = 0;
    setPull(0);
  }, []);

  useEffect(() => {
    if (disabled) return;

    const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || e.touches.length !== 1 || !atTop()) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      preloadAvatars();
      setSeed(Math.floor(Math.random() * AVATARS.length));
    };

    const onMove = (e: TouchEvent) => {
      if (startY.current == null || refreshingRef.current) return;
      const dy = e.touches[0].clientY - startY.current;
      const dx = Math.abs(e.touches[0].clientX - startX.current);
      // 가로로 미는 동작(주간 인기글 캐러셀 등)은 가로채지 않는다.
      if (dx > Math.abs(dy)) {
        startY.current = null;
        if (pullRef.current !== 0) {
          pullRef.current = 0;
          setPull(0);
        }
        return;
      }
      if (dy <= 0 || !atTop()) {
        if (pullRef.current !== 0) {
          pullRef.current = 0;
          setPull(0);
        }
        return;
      }
      // 고무줄처럼 갈수록 덜 따라온다
      const eased = Math.min(MAX_PULL, dy * 0.55);
      pullRef.current = eased;
      setPull(eased);
      if (e.cancelable) e.preventDefault(); // 브라우저 기본 당김(새로고침·바운스) 차단
    };

    const onEnd = () => {
      if (startY.current == null) return;
      startY.current = null;
      if (refreshingRef.current) return;
      if (pullRef.current < THRESHOLD) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      refreshingRef.current = true;
      setRefreshing(true);
      pullRef.current = THRESHOLD;
      setPull(THRESHOLD);
      Promise.resolve(onRefreshRef.current())
        .catch(() => {})
        // 너무 빨리 끝나면 깜빡이고 마니 최소 0.6초는 보여준다
        .then(() => new Promise((r) => setTimeout(r, 600)))
        .then(finish);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [disabled, finish]);

  // 새로고침 도는 동안 이모지 교체
  useEffect(() => {
    if (!refreshing) return;
    const id = setInterval(() => setTick((t) => t + 1), SWAP_MS);
    return () => clearInterval(id);
  }, [refreshing]);

  // 페이지 트리 안에 두면 탭 진입 애니메이션(.page-enter 스태거)이 이 요소의 transform 까지
  // 가져가 버린다 → body 포털로 띄운다.
  if ((pull <= 0 && !refreshing) || typeof document === "undefined") return null;

  const index = (seed + (refreshing ? tick : Math.floor(pull / SWAP_PX))) % AVATARS.length;
  const ready = pull >= THRESHOLD;
  const scale = refreshing ? 1 : Math.min(1, 0.5 + (pull / THRESHOLD) * 0.5);
  const label = refreshing ? "새로고침 중" : ready ? "놓으면 새로고침" : "당겨서 새로고침";

  return createPortal(
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        // 커뮤니티 고정 헤더(z-index 80)보다 위. 전체화면 모달(1200)보다는 아래.
        zIndex: 90,
        transform: `translateY(${pull}px)`,
        transition: refreshing || pull === 0 ? "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)" : "none",
      }}
    >
      <div
        className={refreshing ? "ptr-pill is-refreshing" : "ptr-pill"}
        style={{
          marginTop: offsetTop > 0 ? offsetTop + 8 : "calc(8px + env(safe-area-inset-top, 0px))",
          transform: `scale(${scale})`,
          opacity: ready || refreshing ? 1 : 0.75,
        }}
      >
        <span className="ptr-ava">
          {/* key 가 바뀔 때마다 새로 붙어 '톡' 튀며 바뀐다 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={index} src={AVATARS[index]} alt="" width={36} height={36} />
        </span>
        <span className="ptr-label">
          {label}
          {refreshing && (
            <span className="ptr-dots">
              <i />
              <i />
              <i />
            </span>
          )}
        </span>
      </div>
      <style jsx>{`
        .ptr-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          height: 48px;
          padding: 0 18px 0 6px;
          border-radius: 999px;
          background: #fff;
          box-shadow: 0 8px 24px rgba(17, 24, 39, 0.14), 0 1px 4px rgba(17, 24, 39, 0.06);
          transform-origin: top center;
          transition: transform 0.12s ease, opacity 0.12s ease;
        }
        .ptr-ava {
          flex: none;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          overflow: hidden;
          background: #f2f4f6;
          box-shadow: 0 0 0 2px #fff, 0 0 0 3px rgba(49, 130, 246, 0.18);
        }
        .ptr-ava :global(img) {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          animation: ptrBoing 0.42s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .ptr-label {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          font-size: 14.5px;
          font-weight: 600;
          color: #333d4b;
          letter-spacing: -0.3px;
          white-space: nowrap;
        }
        .ptr-dots {
          display: inline-flex;
          gap: 2px;
          margin-left: 2px;
        }
        .ptr-dots i {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: #8b95a1;
          animation: ptrDot 1s ease-in-out infinite;
        }
        .ptr-dots i:nth-child(2) {
          animation-delay: 0.15s;
        }
        .ptr-dots i:nth-child(3) {
          animation-delay: 0.3s;
        }
        .ptr-pill.is-refreshing .ptr-ava {
          animation: ptrHop 0.46s ease-in-out infinite;
        }
        @keyframes ptrBoing {
          0% { transform: scale(0.55) rotate(-14deg); opacity: 0.4; }
          60% { transform: scale(1.12) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes ptrHop {
          0%, 100% { transform: translateY(0) scale(1); }
          40% { transform: translateY(-4px) scale(1.05); }
          70% { transform: translateY(0) scale(0.97); }
        }
        @keyframes ptrDot {
          0%, 100% { opacity: 0.25; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-2px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ptr-pill.is-refreshing .ptr-ava,
          .ptr-ava :global(img),
          .ptr-dots i {
            animation: none;
          }
        }
      `}</style>
    </div>,
    document.body
  );
}
