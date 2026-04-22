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

/* ─── Highlight (형광펜 애니메이션) ────────────────────────── */
function Highlight({ children, color = '#FDE68A', delay = 0 }: { children: React.ReactNode; color?: string; delay?: number }) {
  const { ref, visible } = useReveal();
  return (
    <span ref={ref} className="relative inline">
      <span className="relative z-10">{children}</span>
      <span
        className="absolute left-0 bottom-[2px] h-[40%] rounded-sm z-0"
        style={{
          backgroundColor: color,
          width: visible ? '100%' : '0%',
          transition: `width 0.8s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
        }}
      />
    </span>
  );
}

/* ─── Menu items ─────────────────────────────────────────── */
const MENU_ITEMS = [
  { label: 'CEO 인사말', href: '/biz/ceo' },
  { label: '연혁', href: '/biz/history' },
  { label: '인재채용', href: '/careers' },
  { label: '주요소식', href: '/biz', hash: '자료실' },
  { label: '자주묻는질문', href: '/biz/faq' },
  { label: '고객사', href: '/biz/clients' },
];

/* ─── Page ─────────────────────────────────────────────────── */
export default function CeoPage() {
  const t = useT();
  const [scrollY, setScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

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

          {/* 언어 토글 + 모바일 햄버거 메뉴 버튼 */}
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
            <p className="mb-5 text-[11px] font-medium tracking-normal text-gray-400">CEO MESSAGE</p>
          </Reveal>
          <Reveal delay={200}>
            <h1 className="text-[36px] font-black leading-[1.15] tracking-tight md:text-[56px]">
              <span className="text-gray-900">{t({ ko: 'CEO 인사말', en: "CEO's Message", ja: 'CEO 挨拶', zh: 'CEO 致辞' })}</span>
            </h1>
          </Reveal>
          <Reveal delay={400}>
            <p className="mx-auto mt-4 max-w-[460px] text-[15px] leading-relaxed text-gray-400">
              {t({
                ko: '프리티풀의 비전과 철학을 소개합니다',
                en: "Our vision and philosophy",
                ja: 'Freetiful のビジョンと哲学',
                zh: 'Freetiful 的愿景与理念',
              })}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══ CEO Profile ═══════════════════════════════════════ */}
      <section className="py-24">
        <div className="mx-auto max-w-[900px] px-6">
          <div className="flex flex-col items-center gap-12 md:flex-row md:items-start">
            {/* CEO Photo */}
            <Reveal>
              <div className="relative shrink-0">
                <Image
                  src="/images/ceo.png"
                  alt="서나웅 대표이사"
                  width={400}
                  height={520}
                  className="w-[280px] md:w-[320px] object-cover object-top"
                />
              </div>
            </Reveal>

            {/* Greeting */}
            <div className="flex-1">
              <Reveal delay={200}>
                <h2 className="text-[28px] font-black tracking-tight md:text-[34px] leading-[1.3]">
                  <span className="text-gray-900">&ldquo;</span>
                  <Highlight color="#BFDBFE" delay={400}>{t({
                    ko: '검증되지 않은 사람은 연결하지 않는다',
                    en: "We don't connect anyone who isn't verified",
                    ja: '検証されていない人は繋がない',
                    zh: '未经认证者,绝不连接',
                  })}</Highlight>
                  <span className="text-gray-900">&rdquo;</span>
                </h2>
              </Reveal>
              <Reveal delay={300}>
                <div className="mt-8 space-y-5 text-[15px] leading-[1.85] text-gray-500">
                  <p>{t({
                    ko: '안녕하세요. 프리티풀 대표이사 서나웅입니다.',
                    en: 'Hello. I am Naung Seo, CEO of Freetiful.',
                    ja: 'こんにちは。Freetiful 代表取締役の徐ナウンです。',
                    zh: '您好,我是 Freetiful 代表理事徐娜雄。',
                  })}</p>
                  <p>
                    {t({
                      ko: <>여러분의 결혼식, 기업 행사, 공식 의전, 그리고 인생의 중요한 순간들. 특별한 자리에는 언제나 그 순간의 품격과 분위기를 완성하는 사람이 있습니다. 프리티풀은 바로 그 가치를 누구보다 잘 알기에, <Highlight color="#FDE68A" delay={200}> 전문 진행자와 고객을 가장 정확하고 신뢰도 높게 연결하는 플랫폼</Highlight>을 만들고 있습니다.</>,
                      en: <>Weddings, corporate events, official ceremonies, and life's most important moments — every special occasion needs someone who elevates its tone and atmosphere. Because we understand that value better than anyone, Freetiful is building <Highlight color="#FDE68A" delay={200}> the most accurate and trustworthy platform connecting professional hosts with clients</Highlight>.</>,
                      ja: <>結婚式、企業イベント、公式行事、そして人生の大切な瞬間。特別な場には、その瞬間の品格と雰囲気を完成させる人が必要です。Freetiful はその価値を誰よりもよく理解しているからこそ、<Highlight color="#FDE68A" delay={200}> プロ司会者とお客様を最も正確かつ信頼できる形で結ぶプラットフォーム</Highlight>を構築しています。</>,
                      zh: <>婚礼、企业活动、官方典礼,以及人生中重要的时刻。特别的场合总需要能够成就品格与氛围的人。Freetiful 比任何人都更理解这一价值,因此我们正在打造 <Highlight color="#FDE68A" delay={200}> 以最准确、最值得信赖的方式连接专业主持人与客户的平台</Highlight>。</>,
                    }) as any}
                  </p>
                  <p>
                    {t({
                      ko: <>프리티풀은 KBS, SBS, MBC 등 주요 방송사 출신을 비롯해, 풍부한 현장 경험과 전문성을 갖춘 아나운서, MC, 쇼호스트를 엄선하여 <strong className="text-gray-800">전국 1,000여 명의 전문 진행자 네트워크</strong>를 구축해왔습니다.</>,
                      en: <>Freetiful carefully selects announcers, MCs, and show hosts — including alumni of KBS, SBS, and MBC — with extensive field experience and proven expertise, building a <strong className="text-gray-800">nationwide network of over 1,000 professional hosts</strong>.</>,
                      ja: <>Freetiful は KBS、SBS、MBC 等の主要放送局出身をはじめ、豊富な現場経験と専門性を持つアナウンサー、MC、ショーホストを厳選し、<strong className="text-gray-800">全国 1,000 名以上のプロ司会者ネットワーク</strong>を築いてきました。</>,
                      zh: <>Freetiful 精心挑选来自 KBS、SBS、MBC 等主要广播公司的主播、MC、购物主持人,他们拥有丰富的现场经验与专业能力,已建成 <strong className="text-gray-800">覆盖全国 1,000 余名专业主持人的网络</strong>。</>,
                    }) as any}
                  </p>
                  <p>
                    {t({
                      ko: <>이를 바탕으로 고객의 소중한 시간을 가장 아름다운 순간으로 완성하고, 프리랜서 진행자들이 더욱 안정적으로 성장할 수 있는 환경을 조성해 <Highlight color="#D1FAE5" delay={300}> 모두가 함께 성장하는 건강한 생태계</Highlight>를 만들어가고자 합니다.</>,
                      en: <>On this foundation, we complete our clients' precious moments as truly beautiful memories, while creating an environment where freelance hosts can grow more stably — building <Highlight color="#D1FAE5" delay={300}> a healthy ecosystem where everyone grows together</Highlight>.</>,
                      ja: <>これを基盤に、お客様の大切な時間を最も美しい瞬間に仕上げ、フリーランス司会者がより安定的に成長できる環境を整え <Highlight color="#D1FAE5" delay={300}> 皆が共に成長する健全なエコシステム</Highlight>を築いていきます。</>,
                      zh: <>以此为基础,我们将客户珍贵的时光打造为最美的回忆,同时为自由主持人创造更稳定的成长环境,构建 <Highlight color="#D1FAE5" delay={300}> 共同成长的健康生态</Highlight>。</>,
                    }) as any}
                  </p>
                  <p>{t({
                    ko: '단순히 사람을 연결하는 것을 넘어, 고객이 원하는 분위기와 목적에 가장 적합한 검증된 진행자를 제안하는 것, 그것이 프리티풀의 역할이라고 믿습니다.',
                    en: "Beyond simply connecting people, our role is to recommend the verified host that best matches each client's desired atmosphere and purpose.",
                    ja: '単に人を繋ぐだけでなく、お客様が望む雰囲気と目的に最も適した認証済み司会者を提案すること、それが Freetiful の役割だと信じています。',
                    zh: '不仅仅是连接人与人,更是向客户推荐最契合期望氛围与目的的认证主持人——这才是 Freetiful 的使命。',
                  })}</p>
                  <p>
                    {t({
                      ko: <>앞으로도 체계적인 품질 관리 시스템을 바탕으로, 고객이 행사진행의 모든 순간을 <Highlight color="#FDE68A" delay={400}> 믿고 맡길 수 있는 최고의 서비스</Highlight>를 제공하겠습니다.</>,
                      en: <>Going forward, backed by a systematic quality management system, we will deliver <Highlight color="#FDE68A" delay={400}> the best service that clients can trust with every moment of their event</Highlight>.</>,
                      ja: <>今後も体系的な品質管理システムを基に、お客様がイベント進行のすべての瞬間を <Highlight color="#FDE68A" delay={400}> 安心して任せられる最高のサービス</Highlight>をご提供いたします。</>,
                      zh: <>未来,我们将基于体系化的品质管理系统,为客户提供 <Highlight color="#FDE68A" delay={400}> 可以放心托付每一个活动瞬间的顶级服务</Highlight>。</>,
                    }) as any}
                  </p>
                  <p className="text-gray-400">{t({ ko: '감사합니다.', en: 'Thank you.', ja: 'ありがとうございます。', zh: '感谢您的支持。' })}</p>
                  <p className="text-gray-700 font-bold pt-2">
                    {t({
                      ko: '여러분의 소중한 시간을 아름다운 순간으로. 프리티풀.',
                      en: 'Turning your precious moments into beautiful memories. Freetiful.',
                      ja: '皆様の大切な時間を美しい瞬間へ。Freetiful.',
                      zh: '将您珍贵的时光化为美好回忆。Freetiful。',
                    })}
                  </p>
                </div>
              </Reveal>
              <Reveal delay={400}>
                <div className="mt-10 flex items-center gap-4">
                  <div className="h-px flex-1 bg-gray-100" />
                  <div className="text-right">
                    <p className="text-[16px] font-bold text-gray-900">{t({ ko: '주식회사 프리티풀', en: 'Freetiful Inc.', ja: '株式会社 Freetiful', zh: 'Freetiful 株式会社' })}</p>
                    <p className="text-[14px] text-gray-500">{t({ ko: '대표이사', en: 'CEO', ja: '代表取締役', zh: '代表理事' })} <strong className="text-gray-800">{t({ ko: '서나웅', en: 'Naung Seo', ja: '徐ナウン', zh: '徐娜雄' })}</strong></p>
                    <Image src="/images/ceo-signature.svg" alt="Signature" width={160} height={60} className="ml-auto mt-3 opacity-80" />
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 이사진 소개 ═══════════════════════════════════════ */}
      <section className="py-24 bg-gray-50/60">
        <div className="mx-auto max-w-[1100px] px-6">
          <Reveal>
            <p className="text-[11px] font-medium tracking-normal text-blue-500">LEADERSHIP</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="mt-3 text-[30px] font-black tracking-tight md:text-[38px]">{t({
              ko: '이사진 소개',
              en: 'Leadership',
              ja: '役員紹介',
              zh: '董事会介绍',
            })}</h2>
          </Reveal>

          <div className="mt-14 grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                name: t({ ko: '서나웅', en: 'Naung Seo', ja: '徐ナウン', zh: '徐娜雄' }),
                role: t({ ko: '대표이사', en: 'CEO', ja: '代表取締役', zh: '代表理事' }),
                badge: 'CEO',
                image: '/images/ceo.png',
              },
              {
                name: t({ ko: '신동혁', en: 'Donghyuk Shin', ja: '申東赫', zh: '申东赫' }),
                role: t({ ko: '최고운영책임자', en: 'Chief Operating Officer', ja: '最高執行責任者', zh: '首席运营官' }),
                badge: 'COO',
                image: '/images/director-shin-dh.png',
              },
              {
                name: t({ ko: '김명옥', en: 'Myeongok Kim', ja: '金明玉', zh: '金明玉' }),
                role: t({ ko: '최고재무책임자', en: 'Chief Financial Officer', ja: '最高財務責任者', zh: '首席财务官' }),
                badge: 'CFO',
                image: '/images/director-kim-mo.png',
              },
              {
                name: t({ ko: '김정훈', en: 'Jeonghun Kim', ja: '金正勳', zh: '金正勋' }),
                role: t({ ko: '최고기술책임자', en: 'Chief Technology Officer', ja: '最高技術責任者', zh: '首席技术官' }),
                badge: 'CTO',
                image: '/images/director-kim-jh.png',
              },
              {
                name: t({ ko: '임하람', en: 'Haram Lim', ja: '林ハラム', zh: '林哈蓝' }),
                role: t({ ko: '최고마케팅책임자', en: 'Chief Marketing Officer', ja: '最高マーケティング責任者', zh: '首席营销官' }),
                badge: 'CMO',
                image: '/images/director-lim-hr.png',
              },
              {
                name: t({ ko: '김수연', en: 'Suyeon Kim', ja: '金秀妍', zh: '金秀妍' }),
                role: t({ ko: '최고인재책임자', en: 'Chief People Officer', ja: '最高人事責任者', zh: '首席人才官' }),
                badge: 'CPO',
                image: '/images/director-kim-sy.png',
              },
              {
                name: t({ ko: '박수용', en: 'Suyong Park', ja: '朴秀勇', zh: '朴秀勇' }),
                role: t({ ko: '마케팅본부장', en: 'Head of Marketing', ja: 'マーケティング本部長', zh: '营销部门负责人' }),
                badge: 'HB',
                image: '/images/director-park-sy.png',
              },
            ].map((person, i) => (
              <Reveal key={person.name} delay={i * 80}>
                <div className="group">
                  {/* 사진 + 이름 오버레이 */}
                  <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl overflow-hidden aspect-[3/4]">
                    <Image
                      src={person.image}
                      alt={person.name}
                      fill
                      className="object-cover object-top"
                    />
                    {/* 하단 글래스 오버레이 */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 pt-12 bg-gradient-to-t from-black/60 via-black/30 to-transparent">
                      <p className="text-[22px] md:text-[26px] font-black text-white leading-tight">{person.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[13px] md:text-[14px] font-semibold text-white/80">{person.role}</p>
                        <span className="text-[11px] font-bold text-white/60 bg-white/15 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/20">
                          {person.badge}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 조직도 ═══════════════════════════════════════ */}
      <section className="py-24 bg-white">
        <div className="mx-auto max-w-[1100px] px-6">
          <Reveal>
            <p className="text-[11px] font-medium tracking-normal text-blue-500">ORGANIZATION</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="mt-3 text-[30px] font-bold tracking-tight md:text-[38px]">{t({
              ko: '조직도',
              en: 'Organization Chart',
              ja: '組織図',
              zh: '组织架构',
            })}</h2>
          </Reveal>

          <div className="mt-14">
            {/* CEO 카드 */}
            <Reveal>
              <div className="flex justify-center">
                <div className="relative inline-block">
                  <div className="bg-[#3180F7] text-white rounded-xl px-10 py-5 text-center shadow-lg shadow-blue-500/20 min-w-[200px]">
                    <p className="text-[11px] font-medium tracking-normal opacity-80">CEO</p>
                    <p className="mt-1 text-[20px] font-bold">{t({ ko: '서나웅', en: 'Naung Seo', ja: '徐ナウン', zh: '徐娜雄' })}</p>
                    <p className="text-[12px] opacity-90">{t({ ko: '대표이사', en: 'CEO', ja: '代表取締役', zh: '代表理事' })}</p>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* CEO → C-레벨 수직 연결선 */}
            <div className="mx-auto w-px h-10 bg-gray-300" />

            {/* C-레벨 수평 연결선 (데스크톱) */}
            <div className="hidden md:block relative mx-auto" style={{ maxWidth: '880px' }}>
              <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gray-300" />
            </div>

            {/* C-레벨 6개 그리드 */}
            <div className="mt-0 md:mt-0 grid grid-cols-2 md:grid-cols-6 gap-6 md:gap-3">
              {[
                {
                  badge: 'COO',
                  name: t({ ko: '신동혁', en: 'Donghyuk Shin', ja: '申東赫', zh: '申东赫' }),
                  role: t({ ko: '최고운영책임자', en: 'COO', ja: '最高執行責任者', zh: '首席运营官' }),
                  teams: [t({ ko: '운영전략팀', en: 'Ops Strategy', ja: '運営戦略チーム', zh: '运营战略' }), t({ ko: '사업개발팀', en: 'Biz Development', ja: '事業開発チーム', zh: '业务开发' })],
                },
                {
                  badge: 'CFO',
                  name: t({ ko: '김명옥', en: 'Myeongok Kim', ja: '金明玉', zh: '金明玉' }),
                  role: t({ ko: '최고재무책임자', en: 'CFO', ja: '最高財務責任者', zh: '首席财务官' }),
                  teams: [t({ ko: '재무회계팀', en: 'Finance', ja: '財務会計チーム', zh: '财务会计' }), t({ ko: '경영지원팀', en: 'Admin', ja: '経営支援チーム', zh: '经营支援' })],
                },
                {
                  badge: 'CTO',
                  name: t({ ko: '김정훈', en: 'Jeonghun Kim', ja: '金正勳', zh: '金正勋' }),
                  role: t({ ko: '최고기술책임자', en: 'CTO', ja: '最高技術責任者', zh: '首席技术官' }),
                  teams: [t({ ko: '개발팀', en: 'Engineering', ja: '開発チーム', zh: '开发' }), t({ ko: '인프라팀', en: 'Infrastructure', ja: 'インフラチーム', zh: '基础设施' })],
                },
                {
                  badge: 'CMO',
                  name: t({ ko: '임하람', en: 'Haram Lim', ja: '林ハラム', zh: '林哈蓝' }),
                  role: t({ ko: '최고마케팅책임자', en: 'CMO', ja: '最高マーケティング責任者', zh: '首席营销官' }),
                  teams: [t({ ko: '마케팅팀', en: 'Marketing', ja: 'マーケティングチーム', zh: '营销' }), t({ ko: '콘텐츠팀', en: 'Content', ja: 'コンテンツチーム', zh: '内容' })],
                },
                {
                  badge: 'CPO',
                  name: t({ ko: '김수연', en: 'Suyeon Kim', ja: '金秀妍', zh: '金秀妍' }),
                  role: t({ ko: '최고인재책임자', en: 'CPO', ja: '最高人事責任者', zh: '首席人才官' }),
                  teams: [t({ ko: '인재개발팀', en: 'Talent Dev', ja: '人材開発チーム', zh: '人才发展' }), t({ ko: '전문가지원팀', en: 'Host Support', ja: '専門家支援チーム', zh: '专家支援' })],
                },
                {
                  badge: 'HB',
                  name: t({ ko: '박수용', en: 'Suyong Park', ja: '朴秀勇', zh: '朴秀勇' }),
                  role: t({ ko: '마케팅본부장', en: 'Head of Marketing', ja: 'マーケティング本部長', zh: '营销部门负责人' }),
                  teams: [t({ ko: '퍼포먼스팀', en: 'Performance', ja: 'パフォーマンスチーム', zh: '效果营销' }), t({ ko: '브랜드팀', en: 'Brand', ja: 'ブランドチーム', zh: '品牌' })],
                },
              ].map((c, i) => (
                <Reveal key={c.badge} delay={i * 80}>
                  <div className="flex flex-col items-center">
                    {/* 세로 연결선 (모바일 제외) */}
                    <div className="hidden md:block w-px h-6 bg-gray-300" />
                    {/* C-레벨 카드 */}
                    <div className="w-full bg-white border-2 border-[#3180F7]/20 rounded-xl px-4 py-4 text-center shadow-sm hover:shadow-md hover:border-[#3180F7]/40 transition-all">
                      <p className="text-[10px] font-medium tracking-normal text-[#3180F7]">{c.badge}</p>
                      <p className="mt-1 text-[16px] font-bold text-gray-900">{c.name}</p>
                      <p className="text-[11px] text-gray-500 leading-snug">{c.role}</p>
                    </div>
                    {/* 팀 연결선 */}
                    <div className="w-px h-4 bg-gray-300" />
                    {/* 산하 팀 */}
                    <div className="w-full space-y-1.5">
                      {c.teams.map((team) => (
                        <div
                          key={team}
                          className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-center text-[12px] text-gray-700"
                        >
                          {team}
                        </div>
                      ))}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* 설명 캡션 */}
            <Reveal delay={400}>
              <p className="mt-12 text-center text-[13px] text-gray-500 leading-relaxed">
                {t({
                  ko: <>각 부문별 전문 임원이 독립적으로 책임을 맡아,<br className="md:hidden" /> 빠른 의사결정과 실행력 있는 조직 운영을 지향합니다.</>,
                  en: <>Each domain is led independently by a specialized executive,<br className="md:hidden" /> enabling fast decisions and agile execution.</>,
                  ja: <>各部門の専門役員が独立して責任を負い、<br className="md:hidden" /> 迅速な意思決定と実行力のある組織運営を目指します。</>,
                  zh: <>各部门由专业高管独立负责,<br className="md:hidden" /> 追求快速决策与高效执行的组织运营。</>,
                }) as any}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══ Philosophy / Vision ═══════════════════════════════ */}
      <section className="py-24 bg-gray-50/60">
        <div className="mx-auto max-w-[900px] px-6">
          <Reveal>
            <p className="text-[11px] font-medium tracking-normal text-blue-500">OUR PHILOSOPHY</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="mt-3 text-[30px] font-black tracking-tight md:text-[38px]">{t({ ko: '경영 철학', en: 'Management Philosophy', ja: '経営哲学', zh: '经营理念' })}</h2>
          </Reveal>

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {[
              {
                num: '01',
                title: t({ ko: '신뢰 중심 경영', en: 'Trust-First Management', ja: '信頼中心の経営', zh: '信任为本' }),
                desc: t({ ko: '검증된 전문가만을 연결합니다. 시스템으로 신뢰를 설계하고, 데이터로 품질을 보장합니다.', en: 'We connect only verified professionals. Trust is designed through systems, quality assured through data.', ja: '検証された専門家のみを繋ぎます。システムで信頼を設計し、データで品質を保証します。', zh: '仅连接经过认证的专业人士。以系统构建信任,以数据保障质量。' }),
              },
              {
                num: '02',
                title: t({ ko: '고객 가치 최우선', en: 'Customer Value First', ja: 'お客様価値優先', zh: '客户价值至上' }),
                desc: t({ ko: '고객의 소중한 순간에 집중합니다. 결혼식, 기업행사 등 인생의 중요한 순간을 완벽하게 만드는 것이 우리의 사명입니다.', en: "We focus on our customers' precious moments. Making life's important events — weddings, corporate gatherings — perfect is our mission.", ja: 'お客様の大切な瞬間に集中します。結婚式、企業イベントなど人生の大切な瞬間を完璧に仕上げることが我々の使命です。', zh: '专注于客户珍贵的瞬间。将婚礼、企业活动等人生重要时刻做到完美,是我们的使命。' }),
              },
              {
                num: '03',
                title: t({ ko: '상생의 생태계', en: 'Win-Win Ecosystem', ja: '共生のエコシステム', zh: '共生生态' }),
                desc: t({ ko: '프리랜서 진행자가 안정적으로 활동하고 성장할 수 있는 환경을 만듭니다. 플랫폼과 전문가가 함께 성장합니다.', en: 'We build an environment where freelance hosts can work and grow stably. Platform and professionals grow together.', ja: 'フリーランス司会者が安定して活動し成長できる環境を作ります。プラットフォームと専門家が共に成長します。', zh: '为自由主持人打造稳定的工作与成长环境。平台与专业人士共同成长。' }),
              },
              {
                num: '04',
                title: t({ ko: '기술 기반 혁신', en: 'Tech-Driven Innovation', ja: '技術基盤の革新', zh: '技术驱动创新' }),
                desc: t({ ko: 'AI 매칭, 데이터 분석 등 최신 기술을 활용하여 매칭의 정확도와 서비스 품질을 끊임없이 높여갑니다.', en: 'We leverage cutting-edge tech like AI matching and data analytics to continuously improve accuracy and service quality.', ja: 'AI マッチング、データ分析等の最新技術を活用し、マッチング精度とサービス品質を絶えず向上させます。', zh: '运用 AI 匹配、数据分析等前沿技术,持续提升匹配精准度与服务品质。' }),
              },
            ].map((v, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="group border border-gray-100 bg-white rounded-2xl p-8 transition-all hover:border-gray-200 hover:shadow-sm h-full">
                  <span className="text-[36px] font-black text-blue-100 group-hover:text-blue-200 transition-colors">{v.num}</span>
                  <h3 className="mt-2 text-[18px] font-bold text-gray-900">{v.title}</h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-gray-400">{v.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
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
