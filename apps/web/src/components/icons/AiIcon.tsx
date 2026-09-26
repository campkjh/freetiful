'use client';

// 프리티풀 AI 아이콘 — 옅은 하늘빛 둥근 타일 + 보라→남보라→하늘 그라데이션 네 갈래 별(260926 사장 지정: "모든 AI 아이콘을 이걸로").
//  · tile=false 면 별만(글자 사이 아주 작은 자리용). spin 은 AI 가 생각 중일 때 별만 돈다(타일은 그대로).
//  · 그라데이션 id 는 인스턴스마다 달라야 한다(같은 id 가 숨은 SVG 에 먼저 있으면 사파리·크롬에서 칠이 빠진다).
import { useId } from 'react';

export const AI_STAR_PATH =
  'M12 2.5C12.8 8.4 15.4 11.1 21.5 12C15.4 12.9 12.8 15.6 12 21.5C11.2 15.6 8.6 12.9 2.5 12C8.6 11.1 11.2 8.4 12 2.5Z';

export default function AiIcon({
  size = 24,
  tile = true,
  spin = false,
  className = '',
  title,
}: {
  size?: number;
  tile?: boolean;
  spin?: boolean;
  className?: string;
  title?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const starId = `ai-star-${uid}`;
  const tileId = `ai-tile-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`inline-block shrink-0 ${className}`}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={starId} x1="7" y1="3.5" x2="15" y2="21.5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A9A4FA" />
          <stop offset="0.42" stopColor="#6A6CF6" />
          <stop offset="0.72" stopColor="#4F86F4" />
          <stop offset="1" stopColor="#7BD0FA" />
        </linearGradient>
        {tile && (
          <linearGradient id={tileId} x1="0" y1="0" x2="0" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#F8FBFF" />
            <stop offset="1" stopColor="#EDF3FE" />
          </linearGradient>
        )}
      </defs>
      {tile && <rect x="0.4" y="0.4" width="23.2" height="23.2" rx="7.4" fill={`url(#${tileId})`} stroke="#E3EBFA" strokeWidth="0.8" />}
      <g transform={tile ? 'translate(3 3) scale(0.75)' : undefined}>
        <g className={spin ? 'ai-icon-spin' : undefined}>
          <path d={AI_STAR_PATH} fill={`url(#${starId})`} />
          {/* 왼쪽 면을 살짝 밝게 — 받은 아이콘의 두 톤 면 */}
          <path d="M12 2.5C11.2 8.4 8.6 11.1 2.5 12C8.6 12.9 11.2 15.6 12 21.5L12 12Z" fill="#FFFFFF" opacity="0.16" />
        </g>
      </g>
    </svg>
  );
}
