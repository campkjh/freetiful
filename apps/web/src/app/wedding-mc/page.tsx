'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Check, ChevronRight, Star } from 'lucide-react';
import { matchApi } from '@/lib/api/match.api';
import { useAuthStore } from '@/lib/store/auth.store';

const PROMO_IMAGES = Array.from({ length: 14 }, (_, i) => `/images/biz-promo/promo-${i + 1}.jpeg`);

const PAIN_POINTS = [
  { emoji: '😬', title: '지인 부탁의 부담', desc: '평생 한 번뿐인 결혼식, 미숙한 진행으로 망치고 싶지 않아요.' },
  { emoji: '🏛', title: '웨딩홀 지정 사회자', desc: '선택권 없이 배정된 사회자가 정말 우리와 맞을까요?' },
  { emoji: '⚠️', title: '재능 플랫폼의 불안', desc: '검증 안 된 사회자에게 평생의 장면을 맡기긴 무서워요.' },
  { emoji: '📵', title: '연락 두절·노쇼', desc: '계약 후 응답이 늦고, 당일 노쇼 사고는 더 이상 듣고 싶지 않아요.' },
];

const DIFFERENTIATORS = [
  {
    no: '01',
    title: '전국 검증된 전문 사회자',
    desc: 'KBS·SBS·MBC·YTN·JTBC·TV조선·홈쇼핑 출신 등, 활동 이력·진행 영상을 직접 검증한 사회자만 등록됩니다.',
  },
  {
    no: '02',
    title: '예식 톤에 맞는 1:1 매칭',
    desc: '클래식·모던·감성·유쾌 등 원하시는 예식 분위기에 맞춰 최적의 사회자 후보를 큐레이션 해드립니다.',
  },
  {
    no: '03',
    title: '3~4주 전 사전 미팅 보장',
    desc: '결혼식 최소 3주 전 사회자와 사전 미팅·리허설을 진행해, 당일 진행 흐름을 완벽히 맞춥니다.',
  },
];

const REVIEWS = [
  { name: '김O민 신부님', rating: 5, body: '부모님 인사 때 울컥했어요. 진행이 따뜻하고 깔끔해서 하객들이 다 칭찬했어요.' },
  { name: '박O윤 신랑님', rating: 5, body: '리허설부터 본식까지 너무 꼼꼼하셨어요. 사회자 분이 분위기를 다 잡아주셨습니다.' },
  { name: '이O서 신부님', rating: 5, body: '대본을 우리 스타일대로 다듬어주셔서 결혼식이 진짜 우리다웠어요.' },
  { name: '정O호 신랑님', rating: 5, body: '하객들이 사회자 누구냐고 다 물어봤어요. 결혼식 격이 올라간 느낌.' },
  { name: '최O경 신부님', rating: 5, body: '예식 30분 전 도착해 준비 끝까지 챙겨주셨어요. 정말 프로의 자세.' },
  { name: '한O진 신랑님', rating: 5, body: '돌발 상황도 자연스럽게 넘기시는 노련함. 비용이 아깝지 않습니다.' },
];

const PROCESS_STEPS = [
  { step: '01', title: '간편 신청', desc: '이름·전화·예식 정보만 입력하면 끝.' },
  { step: '02', title: '사회자 후보 추천', desc: '검증된 사회자들이 견적과 프로필을 채팅으로 전달.' },
  { step: '03', title: '계약·사전 미팅', desc: '마음에 드는 사회자와 직접 소통·계약·리허설.' },
  { step: '04', title: '결혼식 당일 진행', desc: '평생 한 번뿐인 장면, 프로가 책임집니다.' },
];

function formatPhone(raw: string) {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function scrollToForm() {
  const el = document.getElementById('quick-form');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function WeddingMcLandingPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [dateUnknown, setDateUnknown] = useState(false);
  const [eventDate, setEventDate] = useState('');
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [eventTime, setEventTime] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // 로그인된 사용자라면 이름/전화 프리필
  useEffect(() => {
    if (authUser?.name) setName(authUser.name);
    if ((authUser as any)?.phone) setPhone(formatPhone((authUser as any).phone));
  }, [authUser]);

  // 리뷰 캐러셀 자동 슬라이드
  const reviewRef = useRef<HTMLDivElement | null>(null);
  const [reviewIdx, setReviewIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setReviewIdx((i) => (i + 1) % REVIEWS.length), 4500);
    return () => clearInterval(id);
  }, []);

  // UTM 보존
  const utm = useMemo(() => {
    if (typeof window === 'undefined') return {};
    const sp = new URLSearchParams(window.location.search);
    const out: Record<string, string> = {};
    sp.forEach((v, k) => {
      if (k.startsWith('utm_') || k === 'fbclid' || k === 'gclid') out[k] = v;
    });
    return out;
  }, []);

  const submit = async () => {
    const digits = phone.replace(/[^0-9]/g, '');
    if (!authUser && !name.trim()) {
      toast.error('이름을 입력해주세요.');
      return;
    }
    if (digits.length < 10) {
      toast.error('전화번호를 정확히 입력해주세요.');
      return;
    }
    if (!location.trim()) {
      toast.error('예식 장소(또는 지역)를 입력해주세요.');
      return;
    }
    if (!consent) {
      toast.error('개인정보 수집·이용에 동의해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await matchApi.quickRequest({
        name: name.trim() || undefined,
        phone: digits,
        categoryId: '결혼식사회자',
        type: 'multi',
        eventLocation: location.trim(),
        eventDate: dateUnknown ? undefined : eventDate || undefined,
        eventTime: timeUnknown ? undefined : eventTime || undefined,
        rawUserInput: {
          source: 'landing_wedding_mc',
          categoryName: '결혼식사회자',
          eventType: '결혼식',
          eventName: '결혼식',
          location: location.trim(),
          date: eventDate || null,
          dateUnknown,
          timeStart: eventTime || null,
          timeUnknown,
          targetScope: 'all',
          requestKind: 'multi',
          utm,
        },
      });

      // 익명 제출 시 토큰이 발급되어 옴 — 로그인 상태로 전환
      if (res?.accessToken && res?.refreshToken && res?.user) {
        setAuth(res.user, res.accessToken, res.refreshToken);
      }

      setSuccess(true);
      window.dispatchEvent(new Event('freetiful:match-requests-changed'));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || '제출에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-[100dvh] bg-gradient-to-b from-[#F5F8FF] to-white px-5 py-16">
        <div className="mx-auto flex max-w-[480px] flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#3180F7] shadow-[0_20px_40px_rgba(49,128,247,0.32)]">
            <Check size={42} className="text-white" strokeWidth={3} />
          </div>
          <h1 className="text-[28px] font-bold leading-tight text-[#2B313D]">
            견적 요청이 전송되었습니다
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#4E5968]">
            검증된 사회자분들의 견적과 프로필이
            <br />
            곧 <b className="text-[#3180F7]">채팅</b>으로 도착해요.
          </p>

          <div className="mt-8 w-full rounded-[24px] border border-[#E5E8EF] bg-white p-6 text-left shadow-[0_8px_28px_rgba(15,23,42,0.04)]">
            <p className="text-[13px] font-semibold text-[#3180F7]">다음 단계</p>
            <ol className="mt-3 space-y-3 text-[15px] text-[#2B313D]">
              <li className="flex gap-3">
                <span className="font-bold text-[#3180F7]">1.</span>
                사회자분들의 견적·프로필 채팅 도착
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-[#3180F7]">2.</span>
                마음에 드는 사회자와 직접 대화
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-[#3180F7]">3.</span>
                계약·사전 미팅 후 결혼식 당일
              </li>
            </ol>
          </div>

          <button
            type="button"
            onClick={() => router.push('/chat')}
            className="mt-8 h-[56px] w-full rounded-2xl bg-[#3180F7] text-[17px] font-bold text-white shadow-[0_14px_30px_rgba(49,128,247,0.28)] transition active:scale-[0.98]"
          >
            채팅으로 이동
          </button>
          <Link
            href="/main"
            className="mt-3 inline-flex h-12 items-center text-[14px] font-semibold text-[#6B7684] underline-offset-4 hover:underline"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-white pb-24 text-[#2B313D]">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#EEF5FF] via-white to-[#F5F8FF] pb-12 pt-14">
        <div className="mx-auto max-w-[480px] px-5">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-[#3180F7]/10 px-3 py-1 text-[12px] font-semibold text-[#3180F7]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3180F7]" />
            프리티풀 × 전문 사회자 매칭
          </p>
          <h1 className="mt-4 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#1B2230]">
            결혼식 사회자,
            <br />
            <span className="text-[#3180F7]">아무나</span> 구하세요?
          </h1>
          <p className="mt-4 text-[16px] leading-[1.55] text-[#4E5968]">
            평생 한 번뿐인 장면 —<br />
            사회자 한 명이, 그 분위기를 결정합니다.
          </p>

          <div className="mt-7 overflow-hidden rounded-[20px] shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
            <img
              src="/images/biz-promo/promo-1.jpeg"
              alt="결혼식 사회자 진행 장면"
              className="aspect-[5/3] w-full object-cover"
            />
          </div>

          <button
            type="button"
            onClick={scrollToForm}
            className="mt-7 flex h-[58px] w-full items-center justify-center gap-2 rounded-2xl bg-[#3180F7] text-[17px] font-bold text-white shadow-[0_18px_36px_rgba(49,128,247,0.32)] transition active:scale-[0.98]"
          >
            전문 사회자 무료 견적 받기
            <ChevronRight size={20} />
          </button>
          <p className="mt-3 text-center text-[12px] text-[#8B95A8]">
            * 신청 후 1영업일 이내 사회자 견적이 도착해요
          </p>
        </div>
      </section>

      {/* Stats bar */}
      <section className="mx-auto max-w-[480px] px-5">
        <div className="-mt-6 grid grid-cols-3 gap-2 rounded-[20px] border border-[#E5E8EF] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          {[
            { v: '200+', l: '검증 사회자' },
            { v: '98%', l: '만족도' },
            { v: '0건', l: '노쇼·사고' },
          ].map((it) => (
            <div key={it.l} className="text-center">
              <p className="text-[20px] font-bold text-[#2B313D]">{it.v}</p>
              <p className="mt-1 text-[11px] text-[#6B7684]">{it.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pain points */}
      <section className="mx-auto mt-16 max-w-[480px] px-5">
        <p className="text-[13px] font-semibold text-[#3180F7]">자주 듣는 고민</p>
        <h2 className="mt-2 text-[24px] font-bold leading-tight">
          이런 사회자, 진짜 괜찮을까요?
        </h2>
        <div className="mt-6 space-y-3">
          {PAIN_POINTS.map((p) => (
            <div
              key={p.title}
              className="flex gap-4 rounded-2xl border border-[#E5E8EF] bg-white p-4"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F2F4F8] text-[24px]">
                {p.emoji}
              </div>
              <div>
                <p className="text-[15px] font-bold text-[#2B313D]">{p.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#6B7684]">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MC gallery */}
      <section className="mt-16 bg-[#F8FAFD] py-14">
        <div className="mx-auto max-w-[480px] px-5">
          <p className="text-[13px] font-semibold text-[#3180F7]">검증된 전문 사회자</p>
          <h2 className="mt-2 text-[24px] font-bold leading-tight">
            방송 진행 경력
            <br />
            <span className="text-[#3180F7]">전문 사회자</span>가 함께합니다
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed text-[#6B7684]">
            KBS · SBS · MBC · YTN · JTBC · TV조선 · 홈쇼핑 쇼호스트 등
            <br />
            방송 진행 경력의 검증된 사회자만 등록됩니다.
          </p>

          <div className="mt-6 overflow-hidden rounded-[20px] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
            <img
              src="/images/biz-about-hosts.png"
              alt="프리티풀 전문 사회자 그룹"
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section className="mx-auto mt-16 max-w-[480px] px-5">
        <p className="text-[13px] font-semibold text-[#3180F7]">프리티풀이 다른 이유</p>
        <h2 className="mt-2 text-[24px] font-bold leading-tight">
          왜 프리티풀
          <br />
          사회자여야 할까요?
        </h2>
        <div className="mt-6 space-y-4">
          {DIFFERENTIATORS.map((d) => (
            <div
              key={d.no}
              className="rounded-[20px] border border-[#E5E8EF] bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.04)]"
            >
              <p className="text-[24px] font-bold text-[#3180F7]">{d.no}</p>
              <p className="mt-2 text-[17px] font-bold text-[#2B313D]">{d.title}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-[#6B7684]">{d.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Reviews */}
      <section className="mt-16 bg-gradient-to-b from-white to-[#F8FAFD] py-14">
        <div className="mx-auto max-w-[480px] px-5">
          <p className="text-[13px] font-semibold text-[#3180F7]">실제 고객 후기</p>
          <h2 className="mt-2 text-[24px] font-bold leading-tight">
            "정말 결혼식의 격이 달라졌어요"
          </h2>

          <div
            ref={reviewRef}
            className="mt-6 overflow-hidden rounded-[20px] border border-[#E5E8EF] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
          >
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${reviewIdx * 100}%)` }}
            >
              {REVIEWS.map((r, i) => (
                <div key={i} className="w-full shrink-0 p-6">
                  <div className="flex gap-1">
                    {Array.from({ length: r.rating }).map((_, k) => (
                      <Star key={k} size={16} className="fill-[#F5B400] text-[#F5B400]" />
                    ))}
                  </div>
                  <p className="mt-3 text-[15px] leading-relaxed text-[#2B313D]">"{r.body}"</p>
                  <p className="mt-4 text-[13px] font-semibold text-[#6B7684]">— {r.name}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-1.5 pb-4">
              {REVIEWS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setReviewIdx(i)}
                  aria-label={`리뷰 ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === reviewIdx ? 'w-6 bg-[#3180F7]' : 'w-1.5 bg-[#D6DBE3]'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="mx-auto mt-16 max-w-[480px] px-5">
        <p className="text-[13px] font-semibold text-[#3180F7]">신청부터 결혼식까지</p>
        <h2 className="mt-2 text-[24px] font-bold leading-tight">
          이렇게 진행됩니다
        </h2>
        <div className="mt-6 space-y-3">
          {PROCESS_STEPS.map((s) => (
            <div
              key={s.step}
              className="flex items-start gap-4 rounded-2xl border border-[#E5E8EF] bg-white p-4"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#3180F7] text-[16px] font-bold text-white">
                {s.step}
              </div>
              <div className="pt-1">
                <p className="text-[15px] font-bold text-[#2B313D]">{s.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#6B7684]">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="mt-16 bg-[#F8FAFD] py-14">
        <div className="mx-auto max-w-[480px] px-5">
          <p className="text-center text-[13px] font-semibold text-[#3180F7]">
            누적 2,000쌍+ 의 행복한 결혼식
          </p>
          <h2 className="mt-2 text-center text-[24px] font-bold leading-tight">
            다음은 당신의 차례입니다
          </h2>

          <div className="-mx-5 mt-8 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-3 px-5">
              {PROMO_IMAGES.slice(0, 8).map((src, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] w-[160px] shrink-0 overflow-hidden rounded-2xl bg-[#E5E8EF] shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Form */}
      <section
        id="quick-form"
        className="mx-auto mt-16 max-w-[480px] px-5 scroll-mt-6"
      >
        <p className="text-[13px] font-semibold text-[#3180F7]">무료 견적 신청</p>
        <h2 className="mt-2 text-[26px] font-bold leading-tight">
          1분이면 끝.
          <br />
          전문 사회자 견적을 받아보세요
        </h2>
        <p className="mt-2 text-[13px] text-[#6B7684]">
          아래 정보만 입력하면, 검증된 사회자들이 채팅으로 직접 견적을 보내드려요.
        </p>

        <div className="mt-6 space-y-4 rounded-[24px] border border-[#E5E8EF] bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.06)]">
          {!authUser && (
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-[#4E5968]">
                성함 <span className="text-[#3180F7]">*</span>
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 김프리티"
                autoComplete="name"
                className="h-[52px] w-full rounded-2xl border border-[#E5E8EF] bg-white px-4 text-[16px] font-medium text-[#2B313D] outline-none transition focus:border-[#3180F7] focus:ring-4 focus:ring-[#3180F7]/10"
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#4E5968]">
              연락처 <span className="text-[#3180F7]">*</span>
            </span>
            <input
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="010-0000-0000"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              className="h-[52px] w-full rounded-2xl border border-[#E5E8EF] bg-white px-4 text-[16px] font-medium text-[#2B313D] outline-none transition focus:border-[#3180F7] focus:ring-4 focus:ring-[#3180F7]/10"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#4E5968]">
              예식 장소 또는 지역 <span className="text-[#3180F7]">*</span>
            </span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="예: 서울 강남구 더본웨딩홀"
              className="h-[52px] w-full rounded-2xl border border-[#E5E8EF] bg-white px-4 text-[16px] font-medium text-[#2B313D] outline-none transition focus:border-[#3180F7] focus:ring-4 focus:ring-[#3180F7]/10"
            />
          </label>

          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-[#4E5968]">예식일</span>
            <div className="relative">
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                disabled={dateUnknown}
                className="h-[52px] w-full appearance-none rounded-2xl border border-[#E5E8EF] bg-white px-4 text-[15px] font-medium text-[#2B313D] outline-none transition [color-scheme:light] focus:border-[#3180F7] focus:ring-4 focus:ring-[#3180F7]/10 disabled:bg-[#F2F4F8] disabled:text-[#A4ABBA]"
              />
            </div>
            <label className="mt-2 flex items-center gap-2 text-[13px] text-[#6B7684]">
              <input
                type="checkbox"
                checked={dateUnknown}
                onChange={(e) => setDateUnknown(e.target.checked)}
                className="h-4 w-4 rounded border-[#D6DBE3] accent-[#3180F7]"
              />
              아직 정해지지 않았어요
            </label>
          </div>

          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-[#4E5968]">예식 시간</span>
            <input
              type="time"
              value={eventTime}
              onChange={(e) => setEventTime(e.target.value)}
              disabled={timeUnknown}
              className="h-[52px] w-full appearance-none rounded-2xl border border-[#E5E8EF] bg-white px-4 text-[15px] font-medium text-[#2B313D] outline-none transition [color-scheme:light] focus:border-[#3180F7] focus:ring-4 focus:ring-[#3180F7]/10 disabled:bg-[#F2F4F8] disabled:text-[#A4ABBA]"
            />
            <label className="mt-2 flex items-center gap-2 text-[13px] text-[#6B7684]">
              <input
                type="checkbox"
                checked={timeUnknown}
                onChange={(e) => setTimeUnknown(e.target.checked)}
                className="h-4 w-4 rounded border-[#D6DBE3] accent-[#3180F7]"
              />
              시간 미정
            </label>
          </div>

          <label className="flex items-start gap-2.5 pt-1 text-[13px] text-[#4E5968]">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#D6DBE3] accent-[#3180F7]"
            />
            <span className="leading-relaxed">
              <b className="text-[#2B313D]">개인정보 수집·이용</b>에 동의합니다.
              <br />
              (수집 항목: 이름·연락처·예식 정보 / 목적: 사회자 매칭 및 연락 / 보유: 매칭 종료 후 1년)
            </span>
          </label>

          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="mt-2 h-[56px] w-full rounded-2xl bg-[#3180F7] text-[17px] font-bold text-white shadow-[0_14px_30px_rgba(49,128,247,0.28)] transition active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? '전송 중...' : '다수 사회자에게 무료 견적 요청'}
          </button>

          <p className="text-center text-[11px] text-[#8B95A8]">
            * 신청 즉시 견적이 채팅으로 도착합니다. SMS 인증 없이 바로 진행됩니다.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto mt-16 max-w-[480px] px-5 pb-8 text-[11px] leading-relaxed text-[#8B95A8]">
        <p>프리티풀 | 대표: 김정훈 | 사업자등록번호: 851-87-03601</p>
        <p className="mt-1">서울특별시 강남구 테헤란로 ··· (사업장 주소)</p>
        <p className="mt-3">
          <Link href="/main" className="underline-offset-4 hover:underline">
            프리티풀 홈
          </Link>
        </p>
      </footer>

      {/* Sticky CTA (mobile) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E5E8EF] bg-white/95 px-5 py-3 backdrop-blur">
        <button
          type="button"
          onClick={scrollToForm}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#3180F7] text-[16px] font-bold text-white shadow-[0_10px_24px_rgba(49,128,247,0.25)] transition active:scale-[0.98]"
        >
          무료 견적 받기
          <ChevronRight size={18} />
        </button>
      </div>
    </main>
  );
}
