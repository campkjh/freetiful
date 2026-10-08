'use client';

import { useEffect, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useT, type Translations } from '@/lib/biz/i18n';
import BizHeader, { BizPageFooter } from '@/components/biz/BizHeader';
import { CountUp, FadeUp, useInView } from '@/components/biz/biz-motion';
import { cameByHistory } from '@/components/biz/scroll-to';
import { CLIENTS, LOGOS, MOMENTS, SCALE } from '@/components/biz/toss/content';

/*
 * 비즈 고객사(261009 사장 '비즈의 모든 페이지를 프리티풀 톤앤매너로 이쁘고 일관성 있게 · 비즈 내용은 웨딩홀과 기업행사 위주').
 *  · 머리줄 = 비즈 공통 BizHeader(옛 반투명 알약 머리줄 · 햄버거 메뉴 시트 삭제).
 *  · 내용은 예전 그대로(함께한 기업 로고 52개 · 웨딩 파트너 로고 20개 · 고객 후기) — 묶음만 '웨딩홀' · '기업행사' 두 축으로 나눴다.
 *    로고 목록 · 제목 · 숫자는 비즈 첫 화면 장면 문구(toss/content.ts)를 그대로 읽는다(한 곳에서만 고치게).
 *  · 예전 숫자 줄(누적 고객사 500+ · 진행 행사 2,000+ · 만족도 98%)은 근거를 찾을 수 없어 비즈 첫 화면과 같은 사실 숫자
 *    (검증된 진행자 1,000+ · 결혼식 사회 13,000+ · 지상파 3사 출신)로 바꿨다. 후기의 실제 회사 이름(삼성전자)도 확인할 수 없어 뺐다.
 *  · 쓰이지 않던 옛 고객 목록 상수(KBS · 삼성전자 … 30곳, 화면에 안 그려지던 것)는 지웠다.
 *  · 움직임: 위 로고 띠가 양쪽으로 천천히 흐르고(올리면 멈춤 · 줄인 움직임이면 멈춘 채), 아래 로고 판은 화면에 들어오면 차례로 떠오른다.
 */

/** 웨딩 파트너 로고(예전 '파트너사' 칸과 같은 20개). 앞의 둘 = 2026년 6월 제휴(연혁) — 빌라드지디 웨딩홀 · 한국웨딩협회 */
const WEDDING_FEATURED = [
  { src: '/images/partners/frame-1707490598.svg', name: { ko: '빌라드지디 웨딩홀', en: 'Villa de GD Wedding Hall', ja: 'ヴィラ・ド・ジディ ウェディングホール', zh: 'Villa de GD 婚礼会馆' } as Translations },
  { src: '/images/partners/frame-1707490622.svg', name: { ko: '한국웨딩협회', en: 'Korea Wedding Association', ja: '韓国ウェディング協会', zh: '韩国婚礼协会' } as Translations },
];
const WEDDING_PARTNERS = [
  'frame-1707490594.svg', 'frame-1707490595.svg', 'frame-1707490596.svg', 'frame-1707490599.svg',
  'frame-1707490618.svg', 'frame-1707490619.svg', 'frame-1707490620.svg', 'frame-1707490621.svg',
  'frame-1707490623.svg', 'frame-1707490624.svg', 'frame-1707490625.svg', 'frame-1707490626.svg',
  'frame-1707490627.svg', 'frame-1707490628.svg', 'frame-1707490629.svg', 'frame-1707490630.svg',
  'frame-1707490631.svg', 'frame-1707490632.svg',
].map((f) => `/images/partners/${f}`);

/** 위 로고 띠 두 줄 — 1줄 = 기업 앞 절반, 2줄 = 기업 뒤 절반 + 웨딩 파트너(흑백으로 맞춰 섞여도 한 판처럼) */
const HALF = Math.ceil(LOGOS.length / 2);
const MARQUEE_ROWS = [LOGOS.slice(0, HALF), [...LOGOS.slice(HALF), ...WEDDING_FEATURED.map((w) => w.src), ...WEDDING_PARTNERS]];

const TESTIMONIALS: { quote: Translations; author: Translations; role: Translations }[] = [
  {
    quote: { ko: '프리티풀 덕분에 회사 송년회를 완벽하게 진행할 수 있었습니다. 전문 MC의 진행이 행사의 품격을 한층 높여주었습니다.', en: "Thanks to Freetiful, our company's year-end party went perfectly. The professional MC elevated the quality of the event.", ja: 'Freetiful のおかげで会社の忘年会を完璧に進行できました。プロ MC の進行がイベントの品格をさらに高めてくれました。', zh: '多亏 Freetiful,我们公司的年会完美举办。专业 MC 的主持让活动更加高档。' },
    author: { ko: '김OO', en: 'Mr. Kim', ja: '金OO', zh: '金先生' },
    role: { ko: '인사팀 과장 · 기업 송년회', en: 'HR Manager · Year-end party', ja: '人事部課長・会社の忘年会', zh: '人事部课长 · 企业年会' },
  },
  {
    quote: { ko: '결혼식 사회자를 고민하다가 프리티풀을 알게 되었어요. AI 매칭으로 딱 맞는 분을 만나 최고의 결혼식이 되었습니다.', en: 'I was looking for a wedding MC and discovered Freetiful. The AI matching found the perfect host and made my wedding unforgettable.', ja: '結婚式の司会者を悩んでいて Freetiful を知りました。AI マッチングでぴったりの方に出会い、最高の結婚式になりました。', zh: '为婚礼主持犹豫时发现了 Freetiful。AI 匹配为我找到了最合适的主持,成就了最棒的婚礼。' },
    author: { ko: '이OO', en: 'Ms. Lee', ja: '李OO', zh: '李女士' },
    role: { ko: '신부 · 웨딩홀 예식', en: 'Bride · Wedding hall ceremony', ja: '新婦・式場の挙式', zh: '新娘 · 婚礼堂仪式' },
  },
  {
    quote: { ko: '신제품 런칭 이벤트에 전문 쇼호스트를 섭외했는데, 기대 이상이었습니다. 매칭부터 행사 당일까지 매니저 분의 케어가 훌륭했습니다.', en: "We booked a professional show host for our product launch — the result exceeded expectations. The manager's support from matching to event day was exceptional.", ja: '新製品ローンチイベントにプロショーホストを依頼しましたが、期待以上でした。マッチングからイベント当日までマネージャーの対応が素晴らしかったです。', zh: '为新品发布会邀请了专业购物主持人,效果超出预期。从匹配到活动当天,经理的服务都非常出色。' },
    author: { ko: '박OO', en: 'Mr. Park', ja: '朴OO', zh: '朴先生' },
    role: { ko: '마케팅 팀장 · 신제품 런칭', en: 'Marketing Lead · Product launch', ja: 'マーケティングチームリーダー・新製品発表', zh: '营销团队负责人 · 新品发布' },
  },
];

/** 로고 판 — 화면에 들어오면 칸들이 차례로 떠오른다(칸마다 관찰자를 달지 않고 판 하나로) */
function LogoGrid({ logos, className, cell, img, label }: { logos: string[]; className: string; cell: string; img: string; label: string }) {
  const { ref, inView } = useInView<HTMLUListElement>({ threshold: 0.08 });
  return (
    <ul ref={ref} aria-label={label} className={`m-0 list-none p-0 ${className}`} data-shown={inView ? '1' : '0'}>
      {logos.map((src, i) => (
        <li key={src} className="cl-cell" style={{ '--d': `${Math.min(i, 28) * 22}ms` } as CSSProperties}>
          <div className={`flex items-center justify-center bg-white transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-14px_rgba(0,27,55,0.25)] ${cell}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- public 로고 svg */}
            <img src={src} alt="" loading="lazy" decoding="async" draggable={false} className={`max-w-full select-none object-contain ${img}`} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function ClientsPage() {
  const t = useT();

  useEffect(() => {
    if (!cameByHistory()) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  return (
    <div data-no-natural-reveal className="min-h-screen bg-white pt-14 text-[#191F28] md:pt-16" style={{ letterSpacing: '-0.02em' }}>
      <BizHeader />

      {/* ═══ 큰 제목 ═══ */}
      <section className="mx-auto max-w-[1100px] px-6 pb-10 pt-10 sm:px-8 lg:px-10 lg:pb-14 lg:pt-24">
        <FadeUp y={20}>
          <p className="m-0 text-[15px] font-semibold tracking-[-0.2px] text-[#3182F6] lg:text-[18px]">
            {t({ ko: '고객사', en: 'Clients', ja: '取引先', zh: '客户' })}
          </p>
        </FadeUp>
        <FadeUp y={28} delay={80}>
          <h1 className="m-0 mt-3 break-keep text-[34px] font-bold leading-[1.3] tracking-[-1px] lg:mt-4 lg:text-[60px] lg:tracking-[-2px]">
            {t(CLIENTS.title[0])}
            <br />
            {t(CLIENTS.title[1])}
          </h1>
        </FadeUp>
        <FadeUp y={24} delay={160}>
          <p className="m-0 mt-5 max-w-[620px] break-keep text-[17px] font-medium leading-[1.6] tracking-[-0.3px] text-[#4E5968] lg:mt-6 lg:text-[20px]">{t(CLIENTS.desc)}</p>
        </FadeUp>
      </section>

      {/* ═══ 로고 띠 — 양쪽으로 흐른다(장식이라 읽기 프로그램엔 숨김, 전체 목록은 아래 판) ═══ */}
      <FadeUp y={24} delay={220}>
        <div aria-hidden className="flex flex-col gap-3 lg:gap-4">
          {MARQUEE_ROWS.map((row, ri) => (
            <div key={ri} className="cl-row overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_9%,#000_91%,transparent)]">
              <div className="cl-track" data-dir={ri % 2 ? 'r' : 'l'} style={{ animationDuration: `${row.length * 2.6}s` }}>
                {[...row, ...row].map((src, i) => (
                  <span key={`${src}-${i}`} className="mr-3 flex h-[64px] w-[148px] shrink-0 items-center justify-center rounded-[18px] bg-[#F9FAFB] px-5 lg:mr-4 lg:h-[80px] lg:w-[184px] lg:rounded-[22px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" loading="lazy" decoding="async" draggable={false} className="cl-mono max-h-[30px] max-w-full select-none object-contain lg:max-h-[36px]" />
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </FadeUp>

      {/* ═══ 숫자 — 비즈 첫 화면과 같은 사실 숫자 ═══ */}
      <section className="mx-auto max-w-[1100px] px-5 pt-16 sm:px-8 lg:px-10 lg:pt-24">
        {/* 모바일 = 한 카드 안 세 줄(이름 왼쪽 · 숫자 오른쪽), sm 이상 = 세 칸 카드 */}
        <FadeUp y={28}>
          <ul className="m-0 grid list-none grid-cols-1 rounded-[24px] bg-[#F9FAFB] p-0 px-6 py-2 sm:grid-cols-3 sm:gap-3 sm:rounded-none sm:bg-transparent sm:p-0 lg:gap-4">
            {SCALE.stats.map((s, i) => (
              <li key={s.value} className={`flex items-center justify-between py-4 sm:block sm:rounded-[24px] sm:bg-[#F9FAFB] sm:px-6 sm:py-7 lg:rounded-[28px] lg:px-8 lg:py-9 ${i > 0 ? 'border-t border-[#EEF0F3] sm:border-0' : ''}`}>
                <p className="m-0 text-[15px] font-semibold text-[#6B7684] sm:text-[#8B95A1] lg:text-[16px]">{t(s.label)}</p>
                <p className="m-0 text-[26px] font-bold leading-[1.15] tracking-[-0.8px] text-[#191F28] tabular-nums sm:mt-2 sm:text-[38px] sm:tracking-[-1.2px] lg:mt-3 lg:text-[52px] lg:tracking-[-2px]">
                  <CountUp target={s.value} suffix={t(s.suffix)} />
                </p>
              </li>
            ))}
          </ul>
        </FadeUp>
      </section>

      {/* ═══ 웨딩홀 ═══ */}
      <section className="mx-auto max-w-[1100px] px-5 pt-24 sm:px-8 lg:px-10 lg:pt-36">
        <div className="px-1 sm:px-0">
          <FadeUp y={20}>
            <p className="m-0 text-[15px] font-semibold text-[#3182F6] lg:text-[17px]">{t({ ko: '웨딩홀', en: 'Wedding halls', ja: '式場', zh: '婚礼堂' })}</p>
          </FadeUp>
          <FadeUp y={28} delay={60}>
            <h2 className="m-0 mt-2 break-keep text-[28px] font-bold leading-[1.35] tracking-[-0.8px] lg:mt-3 lg:text-[44px] lg:tracking-[-1.5px]">
              {t({
                ko: <>웨딩홀 · 웨딩 파트너와<br />함께해요</>,
                en: <>Together with wedding halls<br />and wedding partners</>,
                ja: <>式場・ウェディング<br />パートナーと共に</>,
                zh: <>与婚礼堂及<br />婚礼伙伴携手</>,
              })}
            </h2>
          </FadeUp>
          <FadeUp y={24} delay={120}>
            <p className="m-0 mt-4 max-w-[600px] break-keep text-[16px] font-medium leading-[1.65] text-[#4E5968] lg:text-[19px]">
              {t({
                ko: '빌라드지디 웨딩홀 · 한국웨딩협회와 제휴하고, 여러 웨딩 파트너와 함께하고 있어요.',
                en: 'We partner with Villa de GD Wedding Hall and the Korea Wedding Association, alongside many wedding partners.',
                ja: 'ヴィラ・ド・ジディ ウェディングホール・韓国ウェディング協会と提携し、多くのウェディングパートナーと歩んでいます。',
                zh: '我们与 Villa de GD 婚礼会馆、韩国婚礼协会合作，并与众多婚礼伙伴携手同行。',
              })}
            </p>
          </FadeUp>
        </div>

        {/* 제휴 두 곳 — 크게 */}
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:mt-12 lg:gap-4">
          {WEDDING_FEATURED.map((w, i) => (
            <FadeUp key={w.src} y={32} delay={i * 100}>
              <div className="group relative flex h-full flex-col overflow-hidden rounded-[28px] bg-[#F2F7FF] p-2.5 lg:p-3">
                <div className="flex h-[132px] items-center justify-center rounded-[22px] bg-white px-6 py-3 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.015] lg:h-[176px] lg:py-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 그림 안 여백이 커서 칸 높이를 꽉 채워 키운다 */}
                  <img src={w.src} alt={t(w.name)} loading="lazy" className="h-full w-full max-w-[300px] object-contain" />
                </div>
                <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-4 lg:px-4 lg:pb-3 lg:pt-5">
                  <span className="break-keep text-[17px] font-bold tracking-[-0.3px] text-[#191F28] lg:text-[19px]">{t(w.name)}</span>
                  <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-[#3182F6]">
                    {t({ ko: '2026.06 제휴', en: 'Partner since Jun 2026', ja: '2026.06 提携', zh: '2026.06 合作' })}
                  </span>
                </div>
              </div>
            </FadeUp>
          ))}
        </div>

        <div className="mt-3 rounded-[28px] bg-[#F9FAFB] p-2.5 lg:mt-4 lg:p-3">
          <LogoGrid
            logos={WEDDING_PARTNERS}
            label={t({ ko: '웨딩 파트너 로고', en: 'Wedding partner logos', ja: 'ウェディングパートナーのロゴ', zh: '婚礼伙伴标志' })}
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 lg:gap-2.5"
            cell="h-[76px] rounded-[18px] px-4 lg:h-[92px]"
            img="max-h-[40px] lg:max-h-[46px]"
          />
        </div>
      </section>

      {/* ═══ 기업행사 ═══ */}
      <section className="mx-auto max-w-[1100px] px-5 pt-24 sm:px-8 lg:px-10 lg:pt-36">
        <div className="px-1 sm:px-0">
          <FadeUp y={20}>
            <p className="m-0 text-[15px] font-semibold text-[#3182F6] lg:text-[17px]">{t({ ko: '기업행사', en: 'Corporate events', ja: '企業イベント', zh: '企业活动' })}</p>
          </FadeUp>
          <FadeUp y={28} delay={60}>
            <h2 className="m-0 mt-2 break-keep text-[28px] font-bold leading-[1.35] tracking-[-0.8px] lg:mt-3 lg:text-[44px] lg:tracking-[-1.5px]">
              {t({
                ko: <>기업 · 공공기관 · 방송사<br />행사 무대에서</>,
                en: <>On the stages of companies,<br />institutions and broadcasters</>,
                ja: <>企業・公共機関・放送局の<br />イベントの舞台で</>,
                zh: <>在企业、公共机构、<br />电视台的活动舞台上</>,
              })}
            </h2>
          </FadeUp>
          <FadeUp y={24} delay={120}>
            <p className="m-0 mt-4 max-w-[600px] break-keep text-[16px] font-medium leading-[1.65] text-[#4E5968] lg:text-[19px]">
              {t({
                ko: `기업과 공공기관, 방송사 행사에서 프리티풀 진행자와 함께한 ${LOGOS.length}곳이에요.`,
                en: `${LOGOS.length} companies, public institutions and broadcasters whose events our hosts have led.`,
                ja: `企業・公共機関・放送局のイベントで Freetiful の司会者と共にした ${LOGOS.length} の企業・機関です。`,
                zh: `在企业、公共机构和电视台的活动中，与 Freetiful 主持人合作过的 ${LOGOS.length} 家单位。`,
              })}
            </p>
          </FadeUp>
        </div>
        <div className="mt-8 rounded-[28px] bg-[#F9FAFB] p-2.5 lg:mt-12 lg:p-3">
          <LogoGrid
            logos={LOGOS}
            label={t({ ko: '함께한 기업 · 기관 로고', en: 'Logos of companies and institutions', ja: '共にした企業・機関のロゴ', zh: '合作企业与机构标志' })}
            className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 lg:gap-2.5"
            cell="h-[64px] rounded-[16px] px-3 lg:h-[76px] lg:rounded-[18px]"
            img="max-h-[28px] lg:max-h-[32px]"
          />
        </div>
      </section>

      {/* ═══ 후기 — 모바일은 옆으로 넘기는 카드 ═══ */}
      <section className="mx-auto max-w-[1100px] pt-24 lg:px-10 lg:pt-36">
        <div className="px-6 sm:px-8 lg:px-0">
          <FadeUp y={20}>
            <p className="m-0 text-[15px] font-semibold text-[#3182F6] lg:text-[17px]">{t({ ko: '고객 후기', en: 'Reviews', ja: 'お客様の声', zh: '客户评价' })}</p>
          </FadeUp>
          <FadeUp y={28} delay={60}>
            <h2 className="m-0 mt-2 break-keep text-[28px] font-bold leading-[1.35] tracking-[-0.8px] lg:mt-3 lg:text-[44px] lg:tracking-[-1.5px]">
              {t({ ko: '행사를 마친 분들의 이야기', en: 'From clients after their events', ja: 'イベントを終えた方々の声', zh: '活动结束后客户的分享' })}
            </h2>
          </FadeUp>
        </div>
        <ul className="m-0 mt-8 flex list-none snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 p-0 px-5 pb-2 sm:scroll-px-8 sm:px-8 lg:mt-12 lg:grid lg:snap-none lg:grid-cols-3 lg:gap-4 lg:overflow-visible lg:px-0" style={{ scrollbarWidth: 'none' }}>
          {TESTIMONIALS.map((tm, i) => (
            <li key={i} className="w-[84%] max-w-[360px] shrink-0 snap-start sm:w-[60%] lg:w-auto lg:max-w-none">
              <FadeUp y={32} delay={i * 100} className="h-full">
                <figure className="m-0 flex h-full flex-col rounded-[28px] bg-[#F9FAFB] p-7 lg:p-8">
                  <span aria-hidden className="block h-8 text-[44px] font-bold leading-[1] text-[#C9E2FF]">&ldquo;</span>
                  <blockquote className="m-0 mt-3 flex-1 break-keep text-[16px] font-medium leading-[1.7] text-[#333D4B] lg:text-[17px]">{t(tm.quote)}</blockquote>
                  <figcaption className="mt-6 flex items-center gap-3">
                    <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[15px] font-bold text-[#3182F6] shadow-[0_1px_2px_rgba(0,23,51,0.06)]">{t(tm.author).charAt(0)}</span>
                    <span>
                      <span className="block text-[15px] font-bold text-[#191F28]">{t(tm.author)}</span>
                      <span className="block break-keep text-[13px] font-medium text-[#8B95A1]">{t(tm.role)}</span>
                    </span>
                  </figcaption>
                </figure>
              </FadeUp>
            </li>
          ))}
        </ul>
      </section>

      {/* ═══ 마무리 — 비즈 첫 화면 마지막 문장과 같은 말 ═══ */}
      <section className="mx-auto max-w-[1100px] px-5 pt-20 sm:px-8 lg:px-10 lg:pt-32">
        <FadeUp y={32}>
          <div className="relative overflow-hidden rounded-[28px] bg-[#191F28] px-7 pb-9 pt-12 text-center lg:rounded-[32px] lg:px-16 lg:pb-16 lg:pt-20">
            <span aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[560px] -translate-x-1/2 rounded-full bg-[#3182F6] opacity-25 blur-[80px]" />
            <p className="relative m-0 break-keep text-[26px] font-bold leading-[1.4] tracking-[-0.7px] text-white lg:text-[44px] lg:tracking-[-1.5px]">
              {t(MOMENTS.closing[0])}
              <br />
              {t(MOMENTS.closing[1])}
            </p>
            <div className="relative mt-8 flex flex-col justify-center gap-2.5 sm:flex-row lg:mt-10">
              <Link href="/biz/inquiry" className="inline-flex h-14 items-center justify-center gap-1.5 rounded-[16px] bg-[#3182F6] px-7 text-[17px] font-semibold text-white transition-[transform,background-color] duration-150 hover:bg-[#2272EB] active:scale-[0.98]">
                {t({ ko: '웨딩홀 · 기업행사 문의', en: 'Wedding hall · Corporate inquiry', ja: '式場・企業イベントのお問合せ', zh: '婚礼堂 · 企业活动咨询' })}
                <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden />
              </Link>
              <Link href="/biz/ceo" className="inline-flex h-14 items-center justify-center rounded-[16px] bg-white/10 px-7 text-[17px] font-semibold text-white transition-[transform,background-color] duration-150 hover:bg-white/15 active:scale-[0.98]">
                {t({ ko: '기업소개 보기', en: 'About Freetiful', ja: '会社紹介を見る', zh: '查看公司介绍' })}
              </Link>
            </div>
          </div>
        </FadeUp>
      </section>

      <BizPageFooter current="clients" />

      <style dangerouslySetInnerHTML={{ __html: `
        .cl-track{display:flex;width:max-content;animation:clMarquee 120s linear infinite;will-change:transform}
        .cl-track[data-dir="r"]{animation-direction:reverse}
        .cl-mono{filter:grayscale(1);opacity:.62;mix-blend-mode:multiply} /* 웨딩 파트너 svg 는 흰 바탕이 들어 있어 회색 칸 위에서 흰 네모로 보였다 */
        @media (hover:hover){.cl-row:hover .cl-track{animation-play-state:paused}}
        @keyframes clMarquee{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}
        .cl-cell{opacity:0;transform:translate3d(0,18px,0);transition:opacity .7s cubic-bezier(.22,1,.36,1) var(--d,0ms),transform .7s cubic-bezier(.22,1,.36,1) var(--d,0ms)}
        [data-shown="1"]>.cl-cell{opacity:1;transform:none}
        @media (prefers-reduced-motion: reduce){.cl-track{animation:none}.cl-cell{opacity:1;transform:none;transition:none}}
      ` }} />
    </div>
  );
}
