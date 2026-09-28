'use client';

// 프리티풀 안전결제 안내 글 — 채팅 위 '프리티풀 안전결제로 안전하게 예약하세요' 띠를 누르면 여는 화면(260929 사장).
//  · 토스 블로그 결: 큰 제목 · 쓴 곳/날짜 · 본문 17 · 소제목 · 둥근 그림 · 회색 판 위 폰 화면 2개(실제 프리티풀 화면을 예시 대화로 찍은 것).
//  · 사실만 쓴다: 결제 금액은 행사가 끝난 뒤 사회자에게 전달(채팅·결제 화면 문구와 같음) · 채팅 밖 직거래는 환불·분쟁 조정 보호 밖 ·
//    환불 = 「플랫폼 환불 규정」(이용약관 제11조) · 분쟁은 당사자 협의가 원칙이고 프리티풀은 사실 확인·조정 자료를 돕는다(제15조).
//  · 캡처 화면 = 로컬에서 API 를 예시 데이터로 바꿔 찍은 실제 화면(실제 회원 정보 없음). 다시 찍을 땐 스크래치 capture-safepay.mjs.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { MotionConfig, motion } from 'framer-motion';

const IMG = '/images/guide/safe-payment';
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** 화면에 들어올 때 아래에서 살짝 떠오른다(한 번) */
function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -60px 0px' }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-5 break-keep text-[17px] leading-[1.85] tracking-[-0.2px] text-[#333D4B]">{children}</p>;
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="break-keep text-[23px] font-bold leading-[1.4] tracking-[-0.6px] text-[#191F28] lg:text-[27px]">{children}</h2>;
}

function Art({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="mt-8 overflow-hidden rounded-[20px] bg-[#EEF3FA]" style={{ aspectRatio: '3 / 2' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
    </div>
  );
}

/** 폰 화면 한 장 — 위 상태 줄(9:41) + 실제 화면 캡처. highlight = 화면 속 강조할 칸(세로 % 위치) */
function Phone({ src, alt, highlight }: { src: string; alt: string; highlight?: { top: number; height: number } }) {
  return (
    <div className="w-[46%] max-w-[250px] overflow-hidden rounded-[26px] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.10)]">
      <div className="flex h-7 items-center justify-between px-5 text-[11px] font-semibold text-[#191F28]" aria-hidden="true">
        <span>9:41</span>
        <span className="flex items-center gap-1">
          <svg width="15" height="10" viewBox="0 0 15 10" fill="#191F28"><rect x="0" y="6" width="2.6" height="4" rx="0.8" /><rect x="4" y="4" width="2.6" height="6" rx="0.8" /><rect x="8" y="2" width="2.6" height="8" rx="0.8" /><rect x="12" y="0" width="2.6" height="10" rx="0.8" /></svg>
          <svg width="20" height="10" viewBox="0 0 20 10" fill="none"><rect x="0.5" y="0.5" width="16" height="9" rx="2.2" stroke="#191F28" /><rect x="2" y="2" width="13" height="6" rx="1.2" fill="#191F28" /><rect x="17.6" y="3.3" width="1.6" height="3.4" rx="0.8" fill="#191F28" /></svg>
        </span>
      </div>
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" decoding="async" className="block w-full" />
        {highlight && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-1 rounded-[10px]"
            style={{ top: `${highlight.top}%`, height: `${highlight.height}%`, boxShadow: '0 0 0 2px #3182F6, 0 0 18px rgba(49,130,246,0.45)' }}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: [0, 1, 0.55, 1] }}
            viewport={{ once: true }}
            transition={{ duration: 1.6, ease: 'easeInOut', delay: 0.5 }}
          />
        )}
      </div>
    </div>
  );
}

function PhonePanel({ children, caption }: { children: ReactNode; caption: string }) {
  return (
    <Reveal className="mt-8">
      <div className="flex items-start justify-center gap-3.5 rounded-[24px] bg-[#F2F4F6] px-4 py-8 sm:gap-6 lg:py-11">{children}</div>
      <p className="mt-3 text-center text-[14px] tracking-[-0.2px] text-[#8B95A1]">{caption}</p>
    </Reveal>
  );
}

const REFUND_ROWS = [
  ['입금일로부터 4일 이내 (예약 당일 포함)', '예약금액의 100% 환불'],
  ['입금일로부터 5일~7일 이내 (예약 당일 포함)', '예약금액의 50% 환불'],
  ['입금일로부터 7일 경과 또는 사전미팅 진행 후', '환불 불가'],
];

export default function SafePaymentGuidePage() {
  const router = useRouter();
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-white pb-28" style={{ letterSpacing: '-0.02em' }}>
        <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-[760px] items-center px-2 lg:px-5">
            <button
              type="button"
              onClick={() => { if (window.history.length > 1) router.back(); else router.replace('/chat'); }}
              aria-label="뒤로가기"
              className="flex h-11 w-11 items-center justify-center rounded-full text-[#191F28] transition-colors active:bg-[#F2F4F6]"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </div>

        <article className="mx-auto max-w-[720px] px-5 lg:px-0">
          <Reveal>
            <h1 className="mt-4 break-keep text-[29px] font-bold leading-[1.32] tracking-[-0.9px] text-[#191F28] lg:mt-8 lg:text-[40px] lg:tracking-[-1.2px]">
              행사가 끝날 때까지 지켜 드리는<br />프리티풀 안전결제
            </h1>
            <div className="mt-7">
              <p className="text-[15px] font-semibold text-[#4E5968]">프리티풀</p>
              <p className="mt-1 text-[14px] text-[#8B95A1]">2026년 9월 29일</p>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <p className="mt-12 break-keep text-[17px] leading-[1.85] tracking-[-0.2px] text-[#333D4B]">
              결혼식 사회자를 고르는 일은 생각보다 오래 걸려요. 여러 사회자와 이야기해 보고, 마음에 드는 분을 찾았다면 이제 예약할 차례예요.
              그런데 결제를 어떻게 하느냐에 따라 행사 날까지의 마음이 꽤 달라져요. 이 글에서는 프리티풀 안전결제가 어떻게 돈과 예약을 지켜 드리는지 차근차근 설명해 드릴게요.
            </p>
          </Reveal>

          {/* 1. 채팅 → 견적서 */}
          <section className="mt-16">
            <Reveal><H2>대화는 채팅에서, 예약은 안전결제로</H2></Reveal>
            <Reveal><Art src={`${IMG}/art-chat.webp`} alt="사회자와 채팅으로 이야기하는 모습" /></Reveal>
            <Reveal>
              <P>
                프리티풀에서는 사회자와 채팅으로 일정과 진행 방식을 편하게 이야기할 수 있어요. 이야기가 끝나면 사회자가 채팅으로 견적서를 보내 드리고,
                견적서에는 제공 서비스와 행사일, 금액이 한 장에 담겨 있어요.
              </P>
              <P>
                채팅 맨 위의 <b className="font-semibold text-[#1B64DA]">‘프리티풀 안전결제로 안전하게 예약하세요’</b> 띠는 지금 보고 계신 이 안내로 이어져요.
                견적서를 받았다면 견적 카드에서 바로 결제로 넘어갈 수 있어요.
              </P>
            </Reveal>
            <PhonePanel caption="채팅 위 안전결제 띠(왼쪽)와 사회자가 보낸 견적 카드(오른쪽)">
              <Phone src={`${IMG}/shot-chat.webp`} alt="채팅 화면 위쪽의 안전결제 띠" highlight={{ top: 21.6, height: 6.2 }} />
              <Phone src={`${IMG}/shot-quote.webp`} alt="채팅 속 견적 카드와 안전결제 안내 카드" />
            </PhonePanel>
          </section>

          {/* 2. 결제 금액은 행사 뒤에 전달 */}
          <section className="mt-20">
            <Reveal><H2>결제 금액은 행사가 끝난 뒤에 전달돼요</H2></Reveal>
            <Reveal><Art src={`${IMG}/art-safe.webp`} alt="방패와 카드, 자물쇠로 표현한 안전결제" /></Reveal>
            <Reveal>
              <P>
                안전결제로 결제한 금액은 바로 사회자에게 가지 않아요. <b className="font-semibold text-[#191F28]">행사 진행이 끝난 뒤에 사회자에게 전달</b>되기 때문에,
                예약한 날까지 마음 놓고 기다리실 수 있어요.
              </P>
              <P>
                결제 화면에서는 선택한 서비스와 연락처, 결제 금액을 한 번 더 확인해요. 견적 금액에 부가세 10%가 더해진 금액으로 결제되고,
                결제를 마치면 채팅에 결제 내역이 남고 거래 카드가 ‘예약확정’으로 바뀌어요.
              </P>
              <P>
                대화와 견적, 결제 기록이 모두 프리티풀 안에 남기 때문에, 혹시 문제가 생기면 프리티풀이 기록을 바탕으로 사실 확인과 조정을 도와 드려요.
              </P>
            </Reveal>
            <PhonePanel caption="결제 화면(왼쪽)과 결제를 마친 뒤의 채팅(오른쪽)">
              <Phone src={`${IMG}/shot-checkout.webp`} alt="견적 결제 화면" />
              <Phone src={`${IMG}/shot-paid.webp`} alt="결제 완료 후 채팅 화면" />
            </PhonePanel>
          </section>

          {/* 3. 직거래 주의 */}
          <section className="mt-20">
            <Reveal><H2>이런 요청은 꼭 조심하세요</H2></Reveal>
            <Reveal><Art src={`${IMG}/art-warning.webp`} alt="경고 표시와 금지된 영수증" /></Reveal>
            <Reveal>
              <P>
                안전결제를 피해 직접 돈을 보내 달라는 요청이 사고의 대부분이에요. 아래처럼 말하면 결제하기 전에 한 번 멈춰 주세요.
              </P>
              <ul className="mt-6 space-y-3">
                {[
                  '계좌이체나 현금으로 직접 보내 달라고 해요',
                  '채팅 밖 메신저나 전화로 결제를 하자고 해요',
                  '견적서 없이 입금부터 먼저 해 달라고 해요',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3 rounded-[16px] bg-[#FFF4F4] px-4 py-3.5">
                    <span className="mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F04452] text-[13px] font-bold text-white" aria-hidden="true">!</span>
                    <span className="break-keep text-[16px] leading-[1.6] tracking-[-0.2px] text-[#333D4B]">{t}</span>
                  </li>
                ))}
              </ul>
              <P>
                채팅 밖에서 직접 거래하면 <b className="font-semibold text-[#191F28]">환불이나 분쟁 조정 같은 안전결제 보호를 받을 수 없어요.</b> 이런 요청을 받았다면
                채팅 속 안내 카드의 ‘신고하기’나 고객센터로 알려 주세요.
              </P>
            </Reveal>
          </section>

          {/* 4. 환불 */}
          <section className="mt-20">
            <Reveal><H2>환불은 이렇게 돼요</H2></Reveal>
            <Reveal>
              <P>예약을 취소하면 입금한 날을 기준으로 아래와 같이 환불돼요.</P>
              <div className="mt-6 overflow-hidden rounded-[16px] border border-[#EEF0F3]">
                <div className="grid grid-cols-[1.35fr_1fr] bg-[#F7F8FA] text-[14px] font-semibold text-[#6B7684]">
                  <span className="px-4 py-3">환불 요청 시점</span>
                  <span className="px-4 py-3">환불 금액</span>
                </div>
                {REFUND_ROWS.map(([when, amount]) => (
                  <div key={when} className="grid grid-cols-[1.35fr_1fr] border-t border-[#EEF0F3] text-[15px] leading-[1.55] tracking-[-0.2px]">
                    <span className="break-keep px-4 py-3.5 text-[#333D4B]">{when}</span>
                    <span className="break-keep px-4 py-3.5 font-semibold text-[#191F28]">{amount}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 break-keep text-[14px] leading-[1.7] text-[#8B95A1]">
                행사일이 입금일로부터 7일 이내(예약 당일 포함)라면 예약금 환불이 어려워요. 사회자 사정으로 인한 보상과 회원 사정에 따른 위약금은{' '}
                <Link href="/terms/refund" className="font-semibold text-[#4E5968] underline underline-offset-2">플랫폼 환불 규정</Link>을 따라요.
              </p>
            </Reveal>
          </section>

          {/* 마무리 */}
          <Reveal className="mt-20">
            <div className="rounded-[24px] bg-[#F2F7FF] px-6 py-7">
              <p className="break-keep text-[20px] font-bold leading-[1.45] tracking-[-0.5px] text-[#191F28]">안심하고 예약하세요</p>
              <p className="mt-2 break-keep text-[15px] leading-[1.7] text-[#4E5968]">
                대화부터 결제, 행사 날까지 프리티풀 안에서 이어지면 가장 안전해요. 궁금한 점이 있다면 언제든 물어봐 주세요.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { if (window.history.length > 1) router.back(); else router.replace('/chat'); }}
                  className="h-12 rounded-[14px] bg-[#3182F6] px-5 text-[16px] font-semibold text-white transition-colors hover:bg-[#2272EB] active:scale-[0.98]"
                >
                  채팅으로 돌아가기
                </button>
                <Link href="/my/support" className="flex h-12 items-center rounded-[14px] bg-white px-5 text-[16px] font-semibold text-[#4E5968] transition-colors hover:bg-[#F9FAFB] active:scale-[0.98]">
                  고객센터 문의
                </Link>
              </div>
            </div>
          </Reveal>
        </article>
      </div>
    </MotionConfig>
  );
}
