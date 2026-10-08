'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useT, type Translations } from '@/lib/biz/i18n';
import BizHeader, { BizPageFooter } from '@/components/biz/BizHeader';
import { FadeUp } from '@/components/biz/biz-motion';
import { cameByHistory, prefersReducedMotion } from '@/components/biz/scroll-to';

/*
 * 비즈 연혁(261009 사장 '비즈의 모든 페이지를 지금까지의 프리티풀 톤앤매너 · 애니메이션을 참고해 이쁘고 일관성 있게').
 *  · 머리줄 = 비즈 공통 BizHeader(옛 떠 있는 반투명 알약 머리줄 · 햄버거 메뉴 시트 삭제 — 다른 소개 화면 가는 길은 바닥 '더 알아보기' 카드).
 *  · 연혁 항목 = 비즈 첫 화면(biz/page.tsx HISTORY_DATA)이 기준 — 예전 이 화면엔 2026년 5월(신용보증기금) · 6월(빌라드지디 웨딩홀 ·
 *    한국웨딩협회 제휴)이 빠져 두 화면 연혁이 달랐다. 새 숫자 · 실적은 넣지 않는다(사실만).
 *  · 움직임: 큰 제목이 아래에서 떠오르고, 세로 줄이 스크롤을 따라 파랗게 차오르며 지나간 항목의 점이 켜진다(토스 홈 연혁 어법 —
 *    코드 · 그림은 우리 것). 줄인 움직임이면 처음부터 다 켜진 채.
 */

type Ev = { month: string; title: Translations; desc: Translations; logos?: { src: string; alt: string }[] };

const HISTORY: { year: string; events: Ev[] }[] = [
  {
    year: '2026',
    events: [
      {
        month: '06',
        title: { ko: '빌라드지디 웨딩홀 & 한국웨딩협회 제휴 체결', en: 'Partnership with Villa de GD Wedding Hall & Korea Wedding Association', ja: 'ヴィラ・ド・ジディ ウェディングホール&韓国ウェディング協会と提携', zh: '与 Villa de GD 婚礼会馆和韩国婚礼协会签署合作' },
        desc: { ko: '웨딩홀 · 웨딩 업계와 공식 제휴', en: 'An official partnership with a wedding hall and the wedding industry', ja: '式場・ウェディング業界と公式提携', zh: '与婚礼堂及婚礼行业正式合作' },
        logos: [
          { src: '/images/partners/frame-1707490598.svg', alt: 'Villa de GD' },
          { src: '/images/partners/frame-1707490622.svg', alt: 'Korea Wedding Association' },
        ],
      },
      {
        month: '05',
        title: { ko: '신용보증기금 성장지원 기업 선정', en: 'Selected for the KODIT growth support program', ja: '信用保証基金の成長支援企業に選定', zh: '入选信用保证基金成长支持企业' },
        desc: { ko: '신용보증기금 성장지원 대상 기업으로 선정', en: 'Selected as a company for KODIT growth support', ja: '信用保証基金の成長支援対象企業に選定', zh: '入选信用保证基金成长支持对象企业' },
      },
      {
        month: '03',
        title: { ko: '프리티풀 정식 서비스 운영 개시', en: 'Official service operations launched', ja: 'Freetiful 正式サービス運営開始', zh: 'Freetiful 正式运营' },
        desc: { ko: '결혼식 · 기업행사 사회자 매칭 서비스 본격 운영', en: 'Full-scale launch of MC matching for weddings and corporate events', ja: '結婚式・企業イベント司会者マッチングサービス本格運営', zh: '婚礼与企业活动主持人匹配服务全面运营' },
      },
      {
        month: '03',
        title: { ko: '벤처기업 인증 획득', en: 'Certified as a Venture Company', ja: 'ベンチャー企業認証取得', zh: '获得风险企业认证' },
        desc: { ko: '기술 혁신형 벤처기업 공식 인증', en: 'Officially certified as a tech-innovation venture', ja: '技術革新型ベンチャー企業公式認証', zh: '获得技术创新型风险企业官方认证' },
      },
      {
        month: '02',
        title: { ko: '제휴업체 300여 곳과 전략적 파트너십 체결', en: '300+ strategic partnerships signed', ja: '提携先 300 社と戦略的パートナーシップ締結', zh: '与 300 余家合作伙伴建立战略合作' },
        desc: { ko: '전국 단위 행사 인프라 네트워크 구축', en: 'Built a nationwide event infrastructure network', ja: '全国単位のイベントインフラネットワーク構築', zh: '构建全国性活动基础设施网络' },
      },
      {
        month: '02',
        title: { ko: 'Seed 투자 유치', en: 'Seed round funding', ja: 'シード投資調達', zh: '获得种子轮投资' },
        desc: { ko: '전문투자기관으로부터 시드 라운드 투자 유치', en: 'Secured seed investment from institutional investors', ja: '専門投資機関よりシードラウンド投資調達', zh: '从专业投资机构获得种子轮投资' },
      },
      {
        month: '01',
        title: { ko: '전문 행사인력 매칭 플랫폼 출시', en: 'Event talent matching platform launched', ja: 'プロイベント人材マッチングプラットフォーム開始', zh: '专业活动人才匹配平台上线' },
        desc: { ko: 'MC, 아나운서, 쇼호스트 등 전문 인력 매칭 서비스 런칭', en: 'Launch of matching for MCs, announcers and show hosts', ja: 'MC、アナウンサー、ショーホスト等のプロ人材マッチングサービス開始', zh: '推出 MC、主播、购物主持人等专业人才匹配服务' },
      },
      {
        month: '01',
        title: { ko: '프리티풀 브랜드 공식 론칭', en: 'Freetiful brand officially launched', ja: 'Freetiful ブランド公式ローンチ', zh: 'Freetiful 品牌正式发布' },
        desc: { ko: 'Freetiful 브랜드 아이덴티티 공개', en: 'Freetiful brand identity unveiled', ja: 'Freetiful ブランドアイデンティティ公開', zh: 'Freetiful 品牌形象发布' },
      },
    ],
  },
  {
    year: '2025',
    events: [
      {
        month: '12',
        title: { ko: '주식회사 커넥트풀 설립', en: 'Connectful Inc. founded', ja: '株式会社 Connectful 設立', zh: 'Connectful 株式会社成立' },
        desc: { ko: '법인 설립 및 사업 개시', en: 'Corporation established and operations commenced', ja: '法人設立及び事業開始', zh: '法人成立及业务开始' },
      },
    ],
  },
];

/** 한눈에 — 위 연혁에서 고른 세 시점(새 숫자 아님) */
const GLANCE: { date: string; label: Translations }[] = [
  { date: '2025.12', label: { ko: '주식회사 커넥트풀 설립', en: 'Connectful Inc. founded', ja: '株式会社 Connectful 設立', zh: 'Connectful 株式会社成立' } },
  { date: '2026.03', label: { ko: '정식 서비스 운영 개시', en: 'Official service launch', ja: '正式サービス運営開始', zh: '正式运营' } },
  { date: '2026.06', label: { ko: '웨딩홀 · 웨딩협회 제휴', en: 'Wedding hall partnership', ja: '式場・ウェディング協会と提携', zh: '婚礼堂 · 婚礼协会合作' } },
];

const MONTH_EN = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * 세로 줄 차오르기 — 화면 위에서 55% 되는 선을 기준으로, 그 선이 지나간 만큼 줄이 파랗게 차고 지나간 항목(점)이 켜진다.
 * 스크롤마다 다시 그리지 않고 한 프레임에 한 번 DOM 스타일 · data-on 만 바꾼다.
 */
function useRailFill(rootRef: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const groups = Array.from(root.querySelectorAll<HTMLElement>('[data-rail]'));
    if (prefersReducedMotion()) {
      groups.forEach((g) => {
        const fill = g.querySelector<HTMLElement>('[data-rail-fill]');
        if (fill) fill.style.transform = 'scaleY(1)';
        g.querySelectorAll<HTMLElement>('[data-ev]').forEach((ev) => { ev.dataset.on = '1'; });
      });
      return undefined;
    }
    let raf = 0;
    const paint = () => {
      raf = 0;
      const line = window.innerHeight * 0.55;
      groups.forEach((g) => {
        const rail = g.querySelector<HTMLElement>('[data-rail-line]');
        const fill = g.querySelector<HTMLElement>('[data-rail-fill]');
        if (!rail || !fill) return;
        const r = rail.getBoundingClientRect();
        const h = Math.max(1, r.height);
        const p = Math.max(0, Math.min(1, (line - r.top) / h));
        fill.style.transform = `scaleY(${p.toFixed(4)})`;
        g.querySelectorAll<HTMLElement>('[data-ev]').forEach((ev) => {
          const dot = ev.querySelector<HTMLElement>('[data-dot]');
          if (!dot) return;
          const d = dot.getBoundingClientRect();
          const on = d.top + d.height / 2 <= line;
          if ((ev.dataset.on === '1') !== on) ev.dataset.on = on ? '1' : '0';
        });
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [rootRef]);
}

export default function HistoryPage() {
  const t = useT();
  const timelineRef = useRef<HTMLElement>(null);
  useRailFill(timelineRef);

  // 탭 · 링크로 오면 맨 위부터(html 이 scroll-behavior:smooth 라 'instant' — 아니면 앞 화면 자리에서 굴러 올라온다). 뒤로가기는 브라우저 복원에 맡긴다
  useEffect(() => {
    if (!cameByHistory()) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const monthLabel = (m: string) =>
    t({ ko: `${Number(m)}월`, en: MONTH_EN[Number(m)] || m, ja: `${Number(m)}月`, zh: `${Number(m)}月` });

  return (
    <div data-no-natural-reveal className="min-h-screen bg-white pt-14 text-[#191F28] md:pt-16" style={{ letterSpacing: '-0.02em' }}>
      <BizHeader />

      {/* ═══ 큰 제목 ═══ */}
      <section className="mx-auto max-w-[1100px] px-6 pb-10 pt-10 sm:px-8 lg:px-10 lg:pb-16 lg:pt-24">
        <FadeUp y={20}>
          <p className="m-0 text-[15px] font-semibold tracking-[-0.2px] text-[#3182F6] lg:text-[18px]">
            {t({ ko: '연혁', en: 'Milestones', ja: '沿革', zh: '发展历程' })}
          </p>
        </FadeUp>
        <FadeUp y={28} delay={80}>
          <h1 className="m-0 mt-3 break-keep text-[34px] font-bold leading-[1.3] tracking-[-1px] text-[#191F28] lg:mt-4 lg:text-[60px] lg:tracking-[-2px]">
            {t({
              ko: <>프리티풀이<br />걸어온 길</>,
              en: <>The road<br />Freetiful has walked</>,
              ja: <>Freetiful が<br />歩んできた道</>,
              zh: <>Freetiful<br />走过的路</>,
            })}
          </h1>
        </FadeUp>
        <FadeUp y={24} delay={160}>
          <p className="m-0 mt-5 max-w-[560px] break-keep text-[17px] font-medium leading-[1.6] tracking-[-0.3px] text-[#4E5968] lg:mt-6 lg:text-[20px]">
            {t({
              ko: '법인 설립부터 정식 서비스, 웨딩홀 제휴까지 — 웨딩홀과 기업행사의 무대를 잇기까지의 발자취예요.',
              en: 'From our founding to official launch and wedding hall partnerships — the steps that connected us to wedding halls and corporate events.',
              ja: '法人設立から正式サービス、式場提携まで——式場と企業イベントの舞台をつなぐまでの歩みです。',
              zh: '从法人成立、正式运营到婚礼堂合作——这是我们连接婚礼堂与企业活动舞台的足迹。',
            })}
          </p>
        </FadeUp>
      </section>

      {/* ═══ 한눈에 — 세 시점 카드 ═══ */}
      <section className="mx-auto max-w-[1100px] px-5 sm:px-8 lg:px-10">
        {/* 모바일도 세 칸 한 줄(세로로 쌓으면 첫 화면이 카드 셋으로 꽉 찼다) — 글자만 작게 */}
        <ol className="m-0 grid list-none grid-cols-3 gap-2 p-0 sm:gap-3 lg:gap-4">
          {GLANCE.map((g, i) => (
            <li key={g.date}>
              <FadeUp y={28} delay={220 + i * 90} className="h-full">
                <div className="relative h-full overflow-hidden rounded-[20px] bg-[#F9FAFB] px-3.5 pb-4 pt-4 sm:rounded-[24px] sm:px-6 sm:py-6 lg:rounded-[28px] lg:px-7 lg:py-8">
                  <span className="text-[12px] font-semibold text-[#8B95A1] sm:text-[13px] lg:text-[14px]">0{i + 1}</span>
                  <p className="m-0 mt-1.5 text-[18px] font-bold leading-[1.2] tracking-[-0.5px] text-[#191F28] tabular-nums sm:mt-2 sm:text-[28px] sm:tracking-[-0.8px] lg:mt-4 lg:text-[40px] lg:tracking-[-1.2px]">
                    {g.date}
                  </p>
                  <p className="m-0 mt-1 break-keep text-[13px] font-medium leading-[1.45] text-[#4E5968] sm:mt-1.5 sm:text-[15px] lg:mt-2 lg:text-[17px]">{t(g.label)}</p>
                  {i === GLANCE.length - 1 && (
                    <span aria-hidden className="absolute right-3.5 top-4 h-2 w-2 rounded-full bg-[#3182F6] shadow-[0_0_0_5px_rgba(49,130,246,0.14)] sm:right-5 sm:top-5 sm:h-2.5 sm:w-2.5 lg:right-7 lg:top-7" />
                  )}
                </div>
              </FadeUp>
            </li>
          ))}
        </ol>
      </section>

      {/* ═══ 연혁 — 해마다 세로 줄 ═══ */}
      <section ref={timelineRef} aria-label={t({ ko: '연도별 연혁', en: 'Milestones by year', ja: '年度別沿革', zh: '年度历程' })} className="mx-auto max-w-[1100px] px-6 pb-8 pt-20 sm:px-8 lg:px-10 lg:pt-32">
        {HISTORY.map((group) => (
          <div key={group.year} data-rail className="relative mb-20 last:mb-0 lg:mb-32 lg:grid lg:grid-cols-[280px_1fr] lg:gap-10">
            {/* 연도 — PC 는 왼쪽에 붙어 따라 내려온다 */}
            <div className="mb-8 lg:mb-0">
              <div className="lg:sticky lg:top-[120px]">
                <FadeUp y={24}>
                  <p className="m-0 text-[56px] font-bold leading-none tracking-[-2px] text-[#191F28] tabular-nums lg:text-[96px] lg:tracking-[-3.5px]">{group.year}</p>
                  <p className="m-0 mt-3 text-[14px] font-semibold text-[#8B95A1] lg:mt-5 lg:text-[16px]">
                    {t({ ko: `${group.events.length}개의 기록`, en: `${group.events.length} ${group.events.length === 1 ? 'milestone' : 'milestones'}`, ja: `${group.events.length}件の記録`, zh: `${group.events.length} 项记录` })}
                  </p>
                </FadeUp>
              </div>
            </div>

            {/* 항목 — 왼쪽 세로 줄(회색 위로 파랑이 차오름) + 점 */}
            <div className="relative pl-8 lg:pl-12">
              <span data-rail-line aria-hidden className="absolute bottom-3 left-[7px] top-3 w-[2px] rounded-full bg-[#F2F4F6] lg:left-[11px]">
                <span data-rail-fill className="absolute inset-0 origin-top rounded-full bg-[#3182F6]" style={{ transform: 'scaleY(0)' }} />
              </span>
              <ol className="m-0 list-none p-0">
                {group.events.map((ev, ei) => (
                  <li key={`${ev.month}-${ei}`} data-ev data-on="0" className="hist-ev group relative pb-10 last:pb-0 lg:pb-14">
                    <span
                      data-dot
                      aria-hidden
                      className="hist-dot absolute -left-8 top-[6px] h-4 w-4 rounded-full border-2 border-[#D1D6DB] bg-white lg:-left-12 lg:top-1 lg:h-6 lg:w-6 lg:border-[2.5px]"
                    />
                    <FadeUp y={22} delay={Math.min(ei, 3) * 70}>
                      <span className="hist-month inline-flex h-7 items-center rounded-full bg-[#F2F4F6] px-3 text-[13px] font-semibold text-[#6B7684] lg:h-8 lg:text-[14px]">
                        {monthLabel(ev.month)}
                      </span>
                      <h3 className="hist-title m-0 mt-3 break-keep text-[19px] font-bold leading-[1.45] tracking-[-0.4px] lg:text-[24px] lg:tracking-[-0.6px]">
                        {t(ev.title)}
                      </h3>
                      <p className="m-0 mt-1.5 break-keep text-[15px] font-medium leading-[1.6] text-[#8B95A1] lg:text-[17px]">{t(ev.desc)}</p>
                      {ev.logos && (
                        <div className="mt-5 grid max-w-[520px] grid-cols-2 gap-2.5 rounded-[24px] bg-[#F2F7FF] p-2.5 lg:mt-6 lg:gap-3 lg:p-3">
                          {ev.logos.map((l) => (
                            <div key={l.src} className="flex h-[84px] items-center justify-center rounded-[18px] bg-white px-3 lg:h-[104px]">
                              {/* eslint-disable-next-line @next/next/no-img-element -- 제휴처 로고 svg(고객사 화면과 같은 파일, 그림 안 여백이 커서 칸을 꽉 채워 키운다) */}
                              <img src={l.src} alt={l.alt} loading="lazy" className="h-full max-h-[76px] w-full object-contain lg:max-h-[92px]" />
                            </div>
                          ))}
                        </div>
                      )}
                    </FadeUp>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ))}
      </section>

      {/* ═══ 다음 이야기 ═══ */}
      <section className="mx-auto max-w-[1100px] px-5 pt-16 sm:px-8 lg:px-10 lg:pt-24">
        <FadeUp y={32}>
          <div className="relative overflow-hidden rounded-[28px] bg-[#F9FAFB] px-6 pb-8 pt-10 lg:flex lg:items-end lg:justify-between lg:gap-10 lg:px-14 lg:pb-14 lg:pt-14">
            <div className="relative">
              <p aria-hidden className="m-0 select-none text-[64px] font-bold leading-none tracking-[-2.5px] text-[#E5E8EB] lg:text-[112px] lg:tracking-[-4.5px]">NEXT</p>
              <p className="m-0 mt-5 break-keep text-[22px] font-bold leading-[1.4] tracking-[-0.5px] text-[#191F28] lg:mt-6 lg:text-[30px] lg:tracking-[-0.8px]">
                {t({
                  ko: <>웨딩홀과 기업행사의<br />다음 무대를 준비하고 있어요</>,
                  en: <>Preparing the next stage<br />for wedding halls and corporate events</>,
                  ja: <>式場と企業イベントの<br />次のステージを準備しています</>,
                  zh: <>正在为婚礼堂与企业活动<br />准备下一个舞台</>,
                })}
              </p>
              <p className="m-0 mt-2 break-keep text-[15px] font-medium text-[#8B95A1] lg:text-[17px]">
                {t({ ko: '프리티풀의 다음 이야기를 기대해 주세요', en: "Stay tuned for Freetiful's next chapter", ja: 'Freetiful の次のストーリーにご期待ください', zh: '敬请期待 Freetiful 的下一个篇章' })}
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-2.5 sm:flex-row lg:mt-0 lg:shrink-0">
              <Link href="/biz/inquiry" className="inline-flex h-14 items-center justify-center gap-1.5 rounded-[16px] bg-[#3182F6] px-6 text-[17px] font-semibold text-white transition-[transform,background-color] duration-150 hover:bg-[#2272EB] active:scale-[0.98]">
                {t({ ko: '웨딩홀 · 기업행사 문의', en: 'Wedding hall · Corporate inquiry', ja: '式場・企業イベントのお問合せ', zh: '婚礼堂 · 企业活动咨询' })}
                <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden />
              </Link>
              <Link href="/biz/clients" className="inline-flex h-14 items-center justify-center rounded-[16px] bg-white px-6 text-[17px] font-semibold text-[#4E5968] shadow-[inset_0_0_0_1px_#E5E8EB] transition-[transform,background-color] duration-150 hover:bg-[#F2F4F6] active:scale-[0.98]">
                {t({ ko: '함께한 고객사 보기', en: 'See our clients', ja: '取引先を見る', zh: '查看合作客户' })}
              </Link>
            </div>
          </div>
        </FadeUp>
      </section>

      <BizPageFooter current="history" />

      {/* 점 · 글자 켜짐 — data-on 은 위 useRailFill 이 스크롤을 따라 바꾼다 */}
      <style dangerouslySetInnerHTML={{ __html: `
        .hist-dot{transition:background-color .35s ease,border-color .35s ease,box-shadow .45s cubic-bezier(.22,1,.36,1),transform .45s cubic-bezier(.34,1.56,.64,1)}
        .hist-ev[data-on="1"] .hist-dot{background:#3182F6;border-color:#3182F6;box-shadow:0 0 0 6px rgba(49,130,246,.14);transform:scale(1.08)}
        .hist-title{color:#6B7684;transition:color .4s ease}
        .hist-ev[data-on="1"] .hist-title{color:#191F28}
        .hist-month{transition:background-color .35s ease,color .35s ease}
        .hist-ev[data-on="1"] .hist-month{background:#E8F3FF;color:#1B64DA}
        @media (prefers-reduced-motion: reduce){.hist-dot,.hist-title,.hist-month{transition:none}}
      ` }} />
    </div>
  );
}
