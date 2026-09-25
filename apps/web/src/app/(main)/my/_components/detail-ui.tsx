'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * 마이페이지 하위 상세 화면들의 공통 껍데기 — **퀵매칭 어법**(2026-09-25 사장 지시:
 * "버튼 눌러서 나오는 상세페이지 전부 퀵매칭 헤더 디자인·인터랙션·모든 부분 디자인").
 *
 *  · 헤더는 뒤로 버튼만(56px · 40px 둥근 버튼, 퀵매칭 화살표). 제목은 그 아래 큰 글씨(24px)로 아래→위 페이드.
 *  · 본문은 <QdBody> 로 감싸면 직계 칸이 오른쪽→왼쪽으로 순차 슬라이드된다.
 *  · 스타일은 globals.css 의 .qd-* (카드 .qd-card · 버튼 .qd-cta · 입력 .qd-input).
 *  · iOS 앱은 이 화면들을 네이티브 뒤로 헤더(제목 포함)로 덮으므로 헤더·큰 제목 둘 다 data-native-back-header —
 *    거기선 숨겨져 제목이 두 번 안 나온다.
 */

/** 카드 — 퀵매칭 선택 카드처럼 1.5px 테두리 · 모서리 16 */
export const MY_CARD = 'qd-card';

/** 카드 묶음 위에 붙는 제목 */
export function MySectionTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`px-1 pb-2.5 text-[15px] font-semibold text-[#333D4B] ${className}`}>{children}</p>;
}

/** 퀵매칭 뒤로 화살표(public/quick-match/icons/back.svg)를 글자색으로 칠한다 */
function BackIcon() {
  return (
    <i
      aria-hidden="true"
      className="block h-[26px] w-[26px] bg-[#191F28]"
      style={{
        WebkitMaskImage: 'url(/quick-match/icons/back.svg)',
        maskImage: 'url(/quick-match/icons/back.svg)',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  );
}

/** 퀵매칭 헤더 바만(뒤로 + 오른쪽 자리) — 큰 제목이 따로 있는 화면(이벤트 이미지 등)용 */
export function QdBackHeader({ right, onBack }: { right?: React.ReactNode; onBack?: () => void }) {
  const router = useRouter();
  return (
    <header className="qd-header" data-native-back-header>
      <button type="button" onClick={onBack || (() => router.back())} aria-label="뒤로가기" className="qd-back">
        <BackIcon />
      </button>
      {right && <div className="ml-auto flex items-center gap-1 pr-2">{right}</div>}
    </header>
  );
}

export function MyDetailHeader({
  title,
  sub,
  right,
  onBack,
}: {
  title: string;
  /** 큰 제목 아래 회색 한 줄 */
  sub?: React.ReactNode;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <>
      <QdBackHeader right={right} onBack={onBack} />
      <div className="qd-titlewrap" data-native-back-header>
        <h1 className="qd-h1 qd-a-title">{title}</h1>
        {sub && <p className="qd-sub qd-a-sub">{sub}</p>}
      </div>
    </>
  );
}

/** 본문 — 직계 칸이 오른쪽→왼쪽으로 순차 슬라이드(퀵매칭 stag) */
export function QdBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`qd-body ${className}`}>{children}</div>;
}

/** 퀵매칭 선택 카드 묶음 — 카드 사이 10px */
export function QdList({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-2.5 ${className}`}>{children}</div>;
}

function QdChevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M9 6l6 6-6 6" stroke="#B0B8C1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 퀵매칭 선택 카드 한 줄 — 아이콘 칸(44 · 모서리 12) · 제목 17 · 회색 힌트 13 · 오른쪽 꺾쇠 */
export function QdRow({
  icon,
  title,
  hint,
  right,
  href,
  external,
  onClick,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  hint?: React.ReactNode;
  right?: React.ReactNode;
  href?: string;
  external?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      {icon && <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#F2F4F6]">{icon}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="truncate text-[17px] font-semibold text-[#333D4B]">{title}</span>
        {hint && <span className="truncate text-[13px] text-[#8B95A1]">{hint}</span>}
      </span>
      {right ?? <QdChevron />}
    </>
  );
  const cls = 'qd-card flex min-h-[60px] w-full items-center gap-3.5 px-[18px] py-3.5 text-left transition-colors active:bg-[#F8F9FA] lg:hover:bg-[#FAFBFC]';
  if (href) {
    if (external || /^(https?:|tel:|mailto:)/.test(href)) {
      return (
        <a href={href} className={cls} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {inner}
        </a>
      );
    }
    return <Link href={href} className={cls}>{inner}</Link>;
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
