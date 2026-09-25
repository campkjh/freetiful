'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * 채팅 안 안내 카드 — 유의(노랑) · 주의(빨강) · 안내(파랑) (사장 지시 2026-09-25).
 *  · 유의: 고객이 전화번호를 보냈을 때 — 연락처로 직거래하지 말라
 *  · 주의: 사회자가 자기 전화번호를 드러냈을 때
 *  · 안내: 안전결제 같은 일반 안내
 * 뱃지(Size=L·Weak: 높이 29 · 모서리 13 · 바탕은 글자색 16%)와 아이콘(public/icons/chat-notice/*)은 사장이 준 파일.
 * 뱃지 SVG 의 '뱃지' 글자는 자리표시라 쓰지 않고 앱 글꼴로 다시 그린다. 카드 바탕은 같은 색을 아주 옅게 깔아
 * 한눈에 종류가 보이게(회색 말풍선과도 안 헷갈리게).
 */
export type ChatNoticeTone = 'caution' | 'warning' | 'info';

const TONES: Record<ChatNoticeTone, { label: string; icon: string; badgeBg: string; badgeFg: string; cardBg: string }> = {
  caution: { label: '유의', icon: '/icons/chat-notice/caution.svg', badgeBg: 'rgba(255,179,49,0.16)', badgeFg: '#DD7D02', cardBg: '#FFFAF0' },
  warning: { label: '주의', icon: '/icons/chat-notice/warning.svg', badgeBg: 'rgba(240,68,82,0.16)', badgeFg: '#E42939', cardBg: '#FFF6F7' },
  info: { label: '안내', icon: '/icons/chat-notice/info.svg', badgeBg: 'rgba(49,130,246,0.16)', badgeFg: '#2272EB', cardBg: '#F4F8FF' },
};

export default function ChatNotice({
  tone,
  title,
  children,
  action,
  className = '',
}: {
  tone: ChatNoticeTone;
  title: string;
  children?: ReactNode;
  /** 본문 끝에 붙는 글자 링크(예: 신고하기) */
  action?: { label: string; href: string };
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <div
      role="note"
      aria-label={`${t.label}: ${title}`}
      className={`mx-auto w-full max-w-[440px] rounded-[20px] px-4 py-3.5 ${className}`}
      style={{ background: t.cardBg }}
    >
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- public 정적 SVG, 색 그대로 */}
        <img src={t.icon} alt="" className="h-[22px] w-[22px] shrink-0" />
        <span
          className="shrink-0 rounded-[13px] px-2.5 text-[13.5px] font-bold leading-[27px]"
          style={{ background: t.badgeBg, color: t.badgeFg }}
        >
          {t.label}
        </span>
        <span className="min-w-0 text-[15px] font-bold leading-[1.35] text-[#191F28]">{title}</span>
      </div>
      {children && (
        <p className="mt-2 text-[13.5px] leading-[1.6] text-[#6B7684]">
          {children}
          {action && (
            <>
              {' '}
              <Link href={action.href} className="font-semibold text-[#4E5968] underline underline-offset-2">
                {action.label}
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}

// ─── 전화번호 감지 ───
// 휴대폰 번호(01X) — 마디 사이 띄어쓰기·점·하이픈·괄호 허용: 0101233412 · 010 1234 5678 · 010.1234.5678 ·
// (010)1234-5678 · +82 10-1234-5678. 앞뒤가 숫자면 더 긴 숫자(계좌·주문번호)의 일부라 제외.
// 뒤돌아보기(lookbehind)는 옛 iOS 사파리에서 정규식이 통째로 깨지므로 쓰지 않는다.
const PHONE_DIGITS = /(?:^|\D)(?:\+?82[\s.-]*|0)1[016789][\s.)-]*\d{3,4}[\s.-]*\d{4}(?!\d)/;
// '공일공 일이삼사 오육칠팔'처럼 한글 숫자로 돌려 쓴 번호
const PHONE_KO = /[공영]\s*일\s*[공영일육칠팔구]\s*[-.]?\s*(?:[공영일이삼사오육륙칠팔구0-9]\s*[-.]?\s*){7,8}/;

export function containsPhoneNumber(text?: string | null): boolean {
  if (!text) return false;
  // 전각 숫자(０１０)도 같은 숫자로
  const s = text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  return PHONE_DIGITS.test(s) || PHONE_KO.test(s);
}

/** 전화번호가 든 말 아래 붙는 카드 — 보낸 사람(고객/사회자)과 보는 사람(보낸 본인/상대)에 따라 문구가 다르다 */
export function PhoneNumberNotice({ senderIsPro, viewerIsSender }: { senderIsPro: boolean; viewerIsSender: boolean }) {
  if (senderIsPro) {
    return viewerIsSender ? (
      <ChatNotice tone="warning" title="개인 연락처 공유는 제한돼요">
        프리티풀 밖 직거래는 약관상 금지돼 있어 반복되면 이용이 제한될 수 있어요. 고객과의 연락·결제는 채팅에서 해 주세요.
      </ChatNotice>
    ) : (
      <ChatNotice tone="warning" title="사회자가 개인 연락처를 보냈어요" action={{ label: '신고하기', href: '/my/support' }}>
        채팅 밖 직거래는 환불·분쟁 조정 같은 안전결제 보호를 받을 수 없어요. 결제는 꼭 프리티풀 안에서 해 주세요.
      </ChatNotice>
    );
  }
  return viewerIsSender ? (
    <ChatNotice tone="caution" title="연락처로 직거래하지 마세요">
      프리티풀 밖에서 거래하면 환불·분쟁 조정 같은 안전결제 보호를 받을 수 없어요. 예약과 결제는 채팅에서 진행해 주세요.
    </ChatNotice>
  ) : (
    <ChatNotice tone="caution" title="고객님이 연락처를 남겼어요">
      연락처로 직거래하는 건 약관상 금지돼 있어요. 견적과 결제는 채팅 안에서 진행해 주세요.
    </ChatNotice>
  );
}
