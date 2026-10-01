// 잎과 꽃을 단순화한 아이콘(제작 프롬프트 13쪽). 색만으로 상태를 구분하지 않도록 모양·문구와 함께 쓴다.
import { ITEMS, type IconKind } from '../data/items';

export function ItemIcon({ id, size = 40 }: { id: string; size?: number }) {
  const def = ITEMS[id];
  const kind: IconKind = def?.icon || 'flower';
  const c = def?.color || '#ffffff';
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      {renderIcon(kind, c)}
    </svg>
  );
}

function petals(cx: number, cy: number, r: number, color: string, n = 5) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return <ellipse key={i} cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r} rx={r * 0.72} ry={r * 0.72} fill={color} stroke="#E2D6BF" strokeWidth={1.2} />;
  });
}

function renderIcon(kind: IconKind, c: string) {
  switch (kind) {
    case 'flower':
      return (
        <g>
          <path d="M24 26 C24 34 22 40 20 44" stroke="#6E9E57" strokeWidth="3" fill="none" strokeLinecap="round" />
          <ellipse cx="17" cy="37" rx="6" ry="3" fill="#79A960" transform="rotate(-25 17 37)" />
          {petals(24, 18, 6.2, c)}
          <circle cx="24" cy="18" r="4.4" fill="#F2C14E" />
        </g>
      );
    case 'rare':
      return (
        <g>
          <path d="M22 44 C22 30 26 22 32 14" stroke="#6E9E57" strokeWidth="3" fill="none" strokeLinecap="round" />
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M${18 + i * 6} ${20 + i * 5} a5 5 0 0 0 10 0 Z`} fill={c} stroke="#B9D3EE" strokeWidth="1.2" />
          ))}
          <ellipse cx="14" cy="36" rx="7" ry="3" fill="#79A960" transform="rotate(-30 14 36)" />
        </g>
      );
    case 'wood':
      return (
        <g>
          <rect x="6" y="16" width="34" height="16" rx="8" fill={c} />
          <ellipse cx="38" cy="24" rx="6" ry="8" fill="#E2C49A" stroke="#B07F55" strokeWidth="1.5" />
          <ellipse cx="38" cy="24" rx="2.5" ry="3.5" fill="none" stroke="#B07F55" strokeWidth="1.2" />
        </g>
      );
    case 'branch':
      return (
        <g stroke={c} strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M8 40 L38 10" />
          <path d="M22 26 L32 28" />
          <path d="M16 32 L14 22" />
          <ellipse cx="34" cy="28" rx="4" ry="2.2" fill="#79A960" stroke="none" />
        </g>
      );
    case 'fruit':
      return (
        <g>
          <circle cx="24" cy="27" r="13" fill={c} />
          <circle cx="19" cy="22" r="3.5" fill="#fff" opacity="0.5" />
          <path d="M24 14 C24 10 26 8 28 7" stroke="#8E6A4C" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <ellipse cx="31" cy="11" rx="5" ry="2.6" fill="#79A960" transform="rotate(-20 31 11)" />
        </g>
      );
    case 'stone':
      return <path d="M10 32 C8 22 16 14 26 15 C36 16 41 24 38 32 C35 39 14 40 10 32 Z" fill={c} stroke="#B3AA9A" strokeWidth="1.5" />;
    case 'ribbon':
      return (
        <g fill={c} stroke="#DE97AE" strokeWidth="1.5">
          <path d="M24 22 L10 14 L10 30 Z" />
          <path d="M24 22 L38 14 L38 30 Z" />
          <path d="M22 24 L16 40 L21 38 L24 42 Z" />
          <path d="M26 24 L32 40 L27 38 L24 42 Z" />
          <circle cx="24" cy="22" r="4" />
        </g>
      );
    case 'seed':
      return (
        <g>
          <path d="M12 16 L36 16 L34 40 C34 42 14 42 14 40 Z" fill="#E9D5B4" stroke="#C9AE84" strokeWidth="1.5" />
          <path d="M12 16 L36 16 L33 10 L15 10 Z" fill="#D9C29A" />
          {petals(24, 28, 4, c)}
          <circle cx="24" cy="28" r="2.6" fill="#F2C14E" />
        </g>
      );
    case 'bouquet':
      return (
        <g>
          <path d="M24 30 L18 44 L30 44 Z" fill="#F4B9C9" />
          <ellipse cx="13" cy="24" rx="6" ry="3" fill="#79A960" transform="rotate(-30 13 24)" />
          <ellipse cx="35" cy="24" rx="6" ry="3" fill="#79A960" transform="rotate(30 35 24)" />
          {[
            [24, 16],
            [17, 21],
            [31, 21],
            [24, 26],
          ].map(([x, y], i) => (
            <g key={i}>
              {petals(x, y, 3.6, '#ffffff')}
              <circle cx={x} cy={y} r="2.4" fill="#F2C14E" />
            </g>
          ))}
        </g>
      );
    case 'arch':
      return (
        <g>
          <path d="M10 44 L10 22 A14 14 0 0 1 38 22 L38 44" fill="none" stroke="#fff" strokeWidth="5" />
          <path d="M10 44 L10 22 A14 14 0 0 1 38 22 L38 44" fill="none" stroke="#E2D6BF" strokeWidth="1.5" />
          {[
            [10, 30],
            [12, 16],
            [24, 8],
            [36, 16],
            [38, 30],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="3.4" fill={i % 2 ? '#F4B9C9' : '#fff'} stroke="#E2D6BF" />
          ))}
        </g>
      );
    case 'chair':
      return (
        <g fill={c} stroke="#A77D5A" strokeWidth="1.5">
          <rect x="14" y="8" width="20" height="16" rx="4" />
          <rect x="12" y="24" width="24" height="6" rx="3" />
          <rect x="14" y="30" width="4" height="12" rx="2" />
          <rect x="30" y="30" width="4" height="12" rx="2" />
        </g>
      );
    case 'rug':
      return (
        <g>
          <rect x="14" y="4" width="20" height="40" rx="5" fill={c} stroke="#E2D6BF" strokeWidth="1.5" />
          {[10, 18, 26, 34].map((y, i) => (
            <circle key={i} cx={i % 2 ? 28 : 20} cy={y} r="2.5" fill="#F4B9C9" />
          ))}
        </g>
      );
    case 'center':
      return (
        <g>
          <rect x="21" y="26" width="6" height="16" fill="#F7EFE4" />
          <ellipse cx="24" cy="42" rx="10" ry="3" fill="#F7EFE4" />
          <path d="M18 20 L30 20 L28 30 L20 30 Z" fill="#CFE5EA" />
          {petals(20, 14, 3.4, '#fff')}
          {petals(29, 13, 3.4, c)}
        </g>
      );
    case 'lantern':
      return (
        <g>
          <rect x="22" y="22" width="4" height="22" fill="#A77D5A" />
          <path d="M14 10 L34 10 L30 4 L18 4 Z" fill="#A77D5A" />
          <rect x="16" y="10" width="16" height="14" rx="3" fill="#FFE7A8" stroke="#A77D5A" strokeWidth="2" />
          <circle cx="24" cy="17" r="4" fill="#FFC27A" />
        </g>
      );
    case 'cake':
      return (
        <g fill="#FFFDF8" stroke="#E2D6BF" strokeWidth="1.5">
          <rect x="10" y="30" width="28" height="10" rx="2" />
          <rect x="14" y="20" width="20" height="10" rx="2" />
          <rect x="18" y="11" width="12" height="9" rx="2" />
          <circle cx="24" cy="8" r="3" fill="#F4B9C9" stroke="none" />
        </g>
      );
    case 'pot':
      return (
        <g>
          <path d="M14 26 L34 26 L31 42 L17 42 Z" fill="#D9876C" />
          <ellipse cx="24" cy="22" rx="12" ry="7" fill="#5E8F55" />
          {petals(18, 18, 3, c)}
          {petals(30, 17, 3, '#F4B9C9')}
        </g>
      );
    case 'post':
      return (
        <g>
          <rect x="22" y="10" width="4" height="34" rx="2" fill="#fff" stroke="#E2D6BF" />
          <path d="M24 16 L14 10 L14 22 Z M24 16 L34 10 L34 22 Z" fill={c} />
          <path d="M23 18 L18 32 M25 18 L30 32" stroke={c} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 'frame':
      return (
        <g>
          <rect x="8" y="10" width="32" height="24" rx="3" fill={c} />
          <rect x="12" y="14" width="24" height="16" rx="2" fill="#CFE5EA" />
          <circle cx="20" cy="22" r="3" fill="#fff" />
          <circle cx="28" cy="22" r="3" fill="#F4B9C9" />
          <path d="M16 34 L12 44 M32 34 L36 44" stroke="#A77D5A" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
  }
}

type UIIconName = 'bag' | 'map' | 'album' | 'camera' | 'gear' | 'leaf' | 'acorn' | 'sun' | 'moon' | 'check' | 'x' | 'rotate' | 'undo' | 'trash' | 'grid' | 'heart' | 'help' | 'save' | 'home' | 'star' | 'letter' | 'arrow';

export function Icon({ name, size = 24, color = 'currentColor' }: { name: UIIconName; size?: number; color?: string }) {
  const s = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (name) {
    case 'bag':
      return (
        <svg {...s}>
          <path d="M5 8h14l-1 12H6L5 8z" fill="#E9D5B4" stroke={color} />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
          <path d="M12 11c-2 0-2 3 0 3s2-3 0-3" stroke="#79A960" />
        </svg>
      );
    case 'map':
      return (
        <svg {...s}>
          <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z" fill="#E3EFD9" />
          <path d="M9 4v14M15 6v14" />
          <circle cx="12" cy="11" r="1.6" fill="#E86F6F" stroke="none" />
        </svg>
      );
    case 'album':
      return (
        <svg {...s}>
          <rect x="4" y="4" width="16" height="16" rx="3" fill="#FBE3EA" />
          <path d="M12 9.2c-1.2-2-4-1.2-4 .8 0 2.2 4 4.6 4 4.6s4-2.4 4-4.6c0-2-2.8-2.8-4-.8z" fill="#E7A0B4" stroke="none" />
        </svg>
      );
    case 'camera':
      return (
        <svg {...s}>
          <rect x="3" y="7" width="18" height="13" rx="3" fill="#DCEBF0" />
          <path d="M8 7l1.5-3h5L16 7" />
          <circle cx="12" cy="13.5" r="3.4" fill="#fff" />
        </svg>
      );
    case 'gear':
      return (
        <svg {...s}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
        </svg>
      );
    case 'leaf':
      return (
        <svg {...s}>
          <path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15" fill="#A9C987" />
          <path d="M5 19l8-8" />
        </svg>
      );
    case 'acorn':
      return (
        <svg {...s} stroke="none">
          <path d="M6 10h12c0 6-3 10-6 11-3-1-6-5-6-11z" fill="#C9935E" />
          <path d="M5 10c0-3 3-5 7-5s7 2 7 5H5z" fill="#8E6A4C" />
          <path d="M12 5V2.5" stroke="#8E6A4C" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'sun':
      return (
        <svg {...s} stroke="#E3A43C">
          <circle cx="12" cy="12" r="4.4" fill="#F6D46B" />
          <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </svg>
      );
    case 'moon':
      return (
        <svg {...s} stroke="#7FA3C7">
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="#DCE8F4" />
        </svg>
      );
    case 'check':
      return (
        <svg {...s}>
          <path d="M5 12.5l4.2 4.2L19 7" />
        </svg>
      );
    case 'x':
      return (
        <svg {...s}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case 'rotate':
      return (
        <svg {...s}>
          <path d="M20 12a8 8 0 1 1-2.3-5.6" />
          <path d="M20 4v4h-4" />
        </svg>
      );
    case 'undo':
      return (
        <svg {...s}>
          <path d="M9 7L4 12l5 5" />
          <path d="M4 12h10a6 6 0 0 1 0 12" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...s}>
          <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />
        </svg>
      );
    case 'grid':
      return (
        <svg {...s}>
          <path d="M4 4h16v16H4zM4 12h16M12 4v16" />
        </svg>
      );
    case 'heart':
      return (
        <svg {...s} stroke="none">
          <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="#E7A0B4" />
        </svg>
      );
    case 'help':
      return (
        <svg {...s}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 17h.01" />
        </svg>
      );
    case 'save':
      return (
        <svg {...s}>
          <path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15" fill="#A9C987" />
        </svg>
      );
    case 'home':
      return (
        <svg {...s}>
          <path d="M4 11l8-7 8 7v9H4z" fill="#F7F2E7" />
          <path d="M10 20v-5h4v5" />
        </svg>
      );
    case 'star':
      return (
        <svg {...s} stroke="none">
          <path d="M12 3l2.6 5.6 6 .7-4.4 4.1 1.2 6L12 16.5 6.6 19.4l1.2-6L3.4 9.3l6-.7z" fill="#F6D46B" />
        </svg>
      );
    case 'letter':
      return (
        <svg {...s}>
          <rect x="3" y="6" width="18" height="13" rx="2" fill="#FFF8E8" />
          <path d="M3 7l9 6 9-6" />
        </svg>
      );
    case 'arrow':
      return (
        <svg {...s}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
  }
}
