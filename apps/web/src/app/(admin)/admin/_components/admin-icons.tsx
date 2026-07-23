'use client';

/* ─────────────────────────────────────────────────────────────
   어드민 아이콘 세트 — 첨부된 토스 아이콘(public/admin-icons/*.svg)을
   lucide-react 와 "동일한 이름"으로 export 한다. 각 어드민 파일은
   import 소스만 'lucide-react' → 이 파일로 바꾸면 전부 교체된다.
   lucide 호환: size / className / strokeWidth·color(무시) props 수용.
   ───────────────────────────────────────────────────────────── */

import { forwardRef } from 'react';

type IconProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height'> & {
  size?: number | string;
  // lucide 호환용(렌더에는 미사용)
  strokeWidth?: number | string;
  color?: string;
  absoluteStrokeWidth?: boolean;
  fill?: string;
};

function make(file: string) {
  const Icon = forwardRef<HTMLImageElement, IconProps>(function Icon(
    { size = 24, className, style, strokeWidth, color, absoluteStrokeWidth, fill, alt = '', ...rest },
    ref,
  ) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={ref}
        src={`/admin-icons/${file}.svg`}
        alt={alt}
        aria-hidden={alt ? undefined : true}
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle', ...style }}
        {...rest}
      />
    );
  });
  Icon.displayName = file;
  return Icon;
}

export const Activity = make('activity');
export const AlertCircle = make('alert-circle');
export const AlertTriangle = make('alert-triangle');
export const Archive = make('archive');
export const ArrowLeft = make('arrow-left');
export const ArrowRightLeft = make('arrow-right-left');
export const BellRing = make('bell-ring');
export const Building2 = make('building');
export const Calendar = make('calendar');
export const CalendarDays = make('calendar-days');
export const Check = make('check');
export const CheckCircle2 = make('check-circle-2');
export const ChevronDown = make('chevron-down');
export const ChevronLeft = make('chevron-left');
export const ChevronRight = make('chevron-right');
export const ChevronUp = make('chevron-up');
export const Clock = make('clock');
export const Clock3 = make('clock3');
export const Code2 = make('code');
export const CreditCard = make('credit-card');
export const Download = make('download');
export const Edit3 = make('edit');
export const ExternalLink = make('external-link');
export const Eye = make('eye');
export const EyeOff = make('eye-off');
export const FileText = make('file-text');
export const GripVertical = make('grip');
export const HelpCircle = make('question');
export const ImageOff = make('image-off');
export const Inbox = make('inbox');
export const Loader2 = make('loader');
export const LogOut = make('log-out');
export const Mail = make('mail');
export const Menu = make('menu');
export const MessageSquare = make('chat');
export const MessageSquareText = make('message-square-text');
export const Paperclip = make('paperclip');
export const Phone = make('phone');
export const Pin = make('pin');
export const PinOff = make('pin-off');
export const Plus = make('plus');
export const RefreshCw = make('refresh');
export const RotateCcw = make('rotate-ccw');
export const Save = make('save');
export const Search = make('search');
export const ShieldAlert = make('shield-alert');
export const ShieldCheck = make('shield-check');
export const Smartphone = make('smartphone');
export const Star = make('star');
export const Trash2 = make('trash');
export const TrendingUp = make('trending-up');
export const Trophy = make('trophy');
export const Upload = make('upload');
export const UserCheck = make('user-check');
export const Users = make('users');
export const Wallet = make('wallet');
export const X = make('x');
export const XCircle = make('x-circle');
export const Zap = make('zap');
