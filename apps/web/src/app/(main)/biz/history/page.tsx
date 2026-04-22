'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, X } from 'lucide-react';
import { useT } from '@/lib/biz/i18n';
import LanguageToggle from '@/components/biz/LanguageToggle';

/* ─── Scroll-Reveal ───────────────────────────────────────── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.15 },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'translate-y-0 opacity-100 blur-0' : 'translate-y-10 opacity-0 blur-[4px]'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────── */
export default function HistoryPage() {
  const t = useT();
  const [scrollY, setScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const HISTORY = [
    {
      year: '2026',
      events: [
        { month: '03', title: t({ ko: '프리티풀 정식 서비스 운영 개시', en: 'Official service operations launched', ja: 'Freetiful 正式サービス運営開始', zh: 'Freetiful 正式运营' }), desc: t({ ko: '전문 행사인력 매칭 서비스 본격 운영', en: 'Full-scale launch of event talent matching service', ja: 'プロイベント人材マッチングサービス本格運営', zh: '专业活动人才匹配服务全面运营' }) },
        { month: '03', title: t({ ko: '벤처기업 인증 획득', en: 'Certified as Venture Company', ja: 'ベンチャー企業認証取得', zh: '获得风险企业认证' }), desc: t({ ko: '기술 혁신형 벤처기업 공식 인증', en: 'Officially certified as a tech-innovation venture', ja: '技術革新型ベンチャー企業公式認証', zh: '获得技术创新型风险企业官方认证' }) },
        { month: '02', title: t({ ko: '제휴업체 300여 곳과 전략적 파트너십 체결', en: '300+ strategic partnerships signed', ja: '提携先 300 社と戦略的パートナーシップ締結', zh: '与 300 余家合作伙伴建立战略合作' }), desc: t({ ko: '전국 단위 행사 인프라 네트워크 구축', en: 'Built a nationwide event infrastructure network', ja: '全国単位のイベントインフラネットワーク構築', zh: '构建全国性活动基础设施网络' }) },
        { month: '02', title: t({ ko: 'Seed 투자 유치', en: 'Seed round funding', ja: 'シード投資調達', zh: '获得种子轮投资' }), desc: t({ ko: '전문투자기관으로부터 시드 라운드 투자 유치', en: 'Secured seed investment from institutional investors', ja: '専門投資機関よりシードラウンド投資調達', zh: '从专业投资机构获得种子轮投资' }) },
        { month: '01', title: t({ ko: '전문 행사인력 매칭 플랫폼 출시', en: 'Event talent matching platform launched', ja: 'プロイベント人材マッチングプラットフォーム開始', zh: '专业活动人才匹配平台上线' }), desc: t({ ko: 'MC, 아나운서, 쇼호스트 등 전문 인력 매칭 서비스 런칭', en: 'Launch of matching service for MCs, announcers, and show hosts', ja: 'MC、アナウンサー、ショーホスト等のプロ人材マッチングサービス開始', zh: '推出 MC、主播、购物主持人等专业人才匹配服务' }) },
        { month: '01', title: t({ ko: '프리티풀 브랜드 공식 론칭', en: 'Freetiful brand officially launched', ja: 'Freetiful ブランド公式ローンチ', zh: 'Freetiful 品牌正式发布' }), desc: t({ ko: 'Freetiful 브랜드 아이덴티티 공개', en: 'Freetiful brand identity unveiled', ja: 'Freetiful ブランドアイデンティティ公開', zh: 'Freetiful 品牌形象发布' }) },
      ],
    },
    {
      year: '2025',
      events: [
        { month: '12', title: t({ ko: '주식회사 커넥트풀 설립', en: 'Connectful Inc. founded', ja: '株式会社 Connectful 設立', zh: 'Connectful 株式会社成立' }), desc: t({ ko: '법인 설립 및 사업 개시', en: 'Corporation established and operations commenced', ja: '法人設立及び事業開始', zh: '法人成立及业务开始' }) },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">

      {/* ─── Floating Header ─────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex justify-center transition-all duration-700 ease-out"
        style={{ padding: scrollY > 80 ? '12px 16px 0' : '0' }}
      >
        <div
          className={`flex items-center justify-between transition-all duration-700 ease-out ${
            scrollY > 80
              ? 'max-w-[720px] w-full h-[52px] px-4 bg-white/80 backdrop-blur-2xl shadow-lg border border-gray-200/60 rounded-full'
              : 'max-w-[1200px] w-full h-[60px] px-6 bg-transparent'
          }`}
        >
          <Link href="/biz" className="transition-all duration-700">
            <Image
              src="/images/logo-prettyful.svg"
              alt="Freetiful"
              width={scrollY > 80 ? 100 : 120}
              height={scrollY > 80 ? 30 : 35}
              className="transition-all duration-700"
              style={{ width: scrollY > 80 ? 100 : 120, height: 'auto' }}
            />
          </Link>

          <div className="flex items-center gap-1">
            <LanguageToggle />
            <button
              className="flex flex-col items-center justify-center gap-[5px] w-9 h-9"
              onClick={() => setMobileMenuOpen(true)}
            >
              <span className="block w-5 h-[2px] rounded-full bg-gray-900 transition-all duration-300" />
              <span className="block w-5 h-[2px] rounded-full bg-gray-900 transition-all duration-300" />
              <span className="block w-3.5 h-[2px] rounded-full bg-gray-900 transition-all duration-300" />
            </button>
          </div>
        </div>
      </header>

      {/* ═══ 모바일 메뉴 패널 ═══════════════════════════════════ */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            style={{ animation: 'menuOverlayIn 0.3s ease-out' }}
          />
          <div
            className="absolute top-0 right-0 w-[280px] h-full bg-white shadow-2xl flex flex-col"
            style={{ animation: 'menuSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <span className="text-[14px] font-bold text-gray-900">{t({ ko: '메뉴', en: 'Menu', ja: 'メニュー', zh: '菜单' })}</span>
              <button onClick={() => setMobileMenuOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="h-px bg-gray-100 mx-6" />
            <div className="flex-1 px-6 py-4 flex flex-col gap-1">
              {[
                { label: t({ ko: 'CEO 인사말',   en: "CEO's Message", ja: 'CEO 挨拶',         zh: 'CEO 致辞' }),     href: '/biz/ceo' },
                { label: t({ ko: '연혁',         en: 'Milestones',    ja: '沿革',             zh: '发展历程' }),      href: '/biz/history' },
                { label: t({ ko: '인재채용',     en: 'Careers',       ja: '採用情報',         zh: '人才招聘' }),      href: '/careers' },
                { label: t({ ko: '주요소식',     en: 'News',          ja: 'お知らせ',         zh: '主要消息' }),      href: '/biz', hash: '자료실' },
                { label: t({ ko: '자주묻는질문', en: 'FAQ',           ja: 'よくある質問',     zh: '常见问题' }),      href: '/biz/faq' },
                { label: t({ ko: '고객사',       en: 'Clients',       ja: '取引先',           zh: '客户' }),          href: '/biz/clients' },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.hash ? `${item.href}#${item.hash}` : item.href}
                  className="flex items-center justify-between py-3.5 px-2 rounded-xl text-[15px] font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </Link>
              ))}
            </div>
            <div className="px-6 pb-8">
              <Link
                href="/biz#문의폼"
                className="block w-full py-3 bg-gray-900 text-white text-[14px] font-bold rounded-full text-center active:scale-95 transition-transform"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t({ ko: '문의하기', en: 'Contact Us', ja: 'お問合せ', zh: '联系我们' })}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Hero ═══════════════════════════════════════════════ */}
      <section className="relative flex min-h-[60vh] items-center justify-center pt-[60px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/60 via-white to-gray-50/40" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white" />

        <div className="relative z-10 text-center px-6">
          <Reveal>
            <p className="mb-5 text-[11px] font-medium tracking-normal text-gray-400">COMPANY HISTORY</p>
          </Reveal>
          <Reveal delay={200}>
            <h1 className="text-[36px] font-black leading-[1.15] tracking-tight md:text-[56px]">
              <span className="text-gray-900">Freetiful</span>{' '}
              <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">{t({
                ko: '연혁',
                en: 'Milestones',
                ja: '沿革',
                zh: '发展历程',
              })}</span>
            </h1>
          </Reveal>
          <Reveal delay={400}>
            <p className="mx-auto mt-4 max-w-[460px] text-[15px] leading-normal text-gray-400">
              {t({
                ko: '프리티풀의 발자취를 확인해보세요',
                en: 'Discover the footsteps of Freetiful',
                ja: 'Freetiful の歩みをご覧ください',
                zh: '探寻 Freetiful 的成长足迹',
              })}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══ Timeline — minimal vertical list ═══════════════════ */}
      <section className="py-24">
        <div className="mx-auto max-w-[900px] px-6">
          {HISTORY.map((yearGroup, yi) => (
            <div key={yearGroup.year} className="relative mb-20 last:mb-0">
              {/* Year — 큰 아웃라인 숫자, 미니멀 */}
              <Reveal delay={yi * 80}>
                <div className="flex items-baseline gap-4 mb-10">
                  <span
                    className="text-[72px] md:text-[96px] font-bold leading-none tracking-tight text-transparent"
                    style={{ WebkitTextStroke: '1.5px #3180F7' }}
                  >
                    {yearGroup.year}
                  </span>
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-[11px] font-medium text-gray-300 tracking-normal uppercase">
                    {yearGroup.events.length} {t({ ko: '건', en: 'events', ja: '件', zh: '项' })}
                  </span>
                </div>
              </Reveal>

              {/* Events — 카드 없이 깔끔한 리스트, hover interaction */}
              <div className="relative pl-6 md:pl-8 border-l border-gray-100">
                {yearGroup.events.map((event, ei) => (
                  <Reveal key={ei} delay={yi * 80 + ei * 60}>
                    <div className="group relative py-5 first:pt-0 cursor-default">
                      {/* 미니 도트 + 좌측 타임라인 위 hover line */}
                      <span
                        className="absolute -left-[25px] md:-left-[33px] top-7 w-2 h-2 rounded-full bg-white border-2 border-gray-200 transition-all duration-300 group-hover:border-[#3180F7] group-hover:scale-[1.8] group-hover:shadow-[0_0_0_6px_rgba(49,128,247,0.12)]"
                      />
                      {/* hover 시 좌측 세로 바 강조 */}
                      <span className="absolute -left-px top-0 bottom-0 w-px bg-[#3180F7] scale-y-0 group-hover:scale-y-100 origin-top transition-transform duration-500 ease-out pointer-events-none" />

                      {/* 월 배지 + 제목 */}
                      <div className="flex items-baseline gap-4">
                        <span className="text-[11px] font-medium text-gray-300 tabular-nums tracking-normal shrink-0 transition-colors duration-300 group-hover:text-[#3180F7]">
                          {event.month}
                        </span>
                        <h3 className="text-[16px] md:text-[18px] font-medium text-gray-800 transition-transform duration-300 group-hover:translate-x-1.5">
                          {event.title}
                        </h3>
                      </div>
                      {/* 설명 — 기본 은은, hover 시 더 또렷 */}
                      <p className="mt-1.5 ml-[36px] text-[13px] leading-normal text-gray-400 transition-colors duration-300 group-hover:text-gray-600">
                        {event.desc}
                      </p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          ))}

          {/* Future — 미니멀 */}
          <Reveal>
            <div className="mt-24 pt-12 border-t border-gray-100 flex flex-col md:flex-row md:items-baseline md:gap-6">
              <span
                className="text-[72px] md:text-[96px] font-bold leading-none tracking-tight text-transparent"
                style={{ WebkitTextStroke: '1.5px #E5E7EB' }}
              >
                NEXT
              </span>
              <div className="mt-4 md:mt-0 md:pb-2">
                <p className="text-[15px] font-medium text-gray-500">{t({
                  ko: '더 큰 도약을 준비하고 있습니다',
                  en: 'Preparing for a bigger leap',
                  ja: 'さらなる飛躍を準備しています',
                  zh: '正在准备更大的飞跃',
                })}</p>
                <p className="text-[13px] text-gray-300 mt-1">{t({
                  ko: '프리티풀의 다음 이야기를 기대해주세요',
                  en: "Stay tuned for Freetiful's next chapter",
                  ja: 'Freetiful の次のストーリーにご期待ください',
                  zh: '敬请期待 Freetiful 的下一个篇章',
                })}</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ Footer ═══════════════════════════════════════════ */}
      <footer className="border-t border-gray-100 py-12 bg-white">
        <div className="mx-auto max-w-[1000px] px-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[16px] font-black text-gray-900">Freetiful</p>
              <p className="mt-1 text-[11px] text-gray-300">{t({ ko: '프리티풀', en: 'Freetiful', ja: 'Freetiful', zh: 'Freetiful' })} | {t({ ko: '서울 중구 퇴계로 36길 2, 본관 130호', en: 'Rm 130, Main Bldg, 2 Toegye-ro 36-gil, Jung-gu, Seoul', ja: 'ソウル中区退渓路36ギル2 本館130号', zh: '首尔中区退溪路36街2号 本馆130号' })}</p>
              <p className="text-[10px] text-gray-200">Copyright &copy; Freetiful. All rights reserved.</p>
            </div>
            <div className="flex gap-4 text-[12px] text-gray-300">
              <Link href="/biz" className="transition-colors hover:text-gray-500">{t({ ko: '회사소개', en: 'About', ja: '会社紹介', zh: '公司简介' })}</Link>
              <Link href="/careers" className="transition-colors hover:text-gray-500">{t({ ko: '채용', en: 'Careers', ja: '採用', zh: '招聘' })}</Link>
              <Link href="/main" className="transition-colors hover:text-gray-500">{t({ ko: '홈으로', en: 'Home', ja: 'ホーム', zh: '返回首页' })}</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ─── Keyframes ─────────────────────────────────────────── */}
      {/* eslint-disable-next-line react/no-danger */}
      <div dangerouslySetInnerHTML={{ __html: `<style>
        @keyframes menuSlideIn {
          0% { transform: translateX(100%); }
          100% { transform: translateX(0); }
        }
        @keyframes menuOverlayIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      </style>` }} />
    </div>
  );
}
