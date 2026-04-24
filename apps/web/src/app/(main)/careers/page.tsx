'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ChevronDown, ChevronRight, MapPin, Clock, Users,
  Heart, Star, Zap, Send, Briefcase, Code, Megaphone,
  Palette, Headphones, ArrowRight, X, CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import LanguageToggle from '@/components/biz/LanguageToggle';
import { useT } from '@/lib/biz/i18n';

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

/* ─── Constants ───────────────────────────────────────────── */
const COMPANY = {
  name: '프리티풀',
  address: '서울 강남구 논현대로10길 30, 505-제이20호',
  email: 'freetiful2025@gmail.com',
};

/* ─── Page ─────────────────────────────────────────────────── */
export default function CareersPage() {
  const t = useT();
  const [scrollY, setScrollY] = useState(0);

  const BENEFITS = [
    { icon: <Clock className="h-5 w-5" />,      title: t({ ko: '유연근무제', en: 'Flexible Work',    ja: 'フレックス勤務',  zh: '弹性工作' }),   desc: t({ ko: '자율 출퇴근, 리모트 워크 가능', en: 'Self-directed hours, remote-friendly', ja: '自由出退勤、リモートワーク可能', zh: '自主上下班,可远程工作' }), color: 'bg-blue-50 text-blue-500' },
    { icon: <Heart className="h-5 w-5" />,      title: t({ ko: '건강 지원',   en: 'Health Support',   ja: '健康支援',        zh: '健康支持' }),   desc: t({ ko: '종합건강검진, 심리상담 지원',    en: 'Annual checkups, counseling support',  ja: '総合健康診断、心理カウンセリング支援', zh: '综合体检、心理咨询支持' }), color: 'bg-rose-50 text-rose-500' },
    { icon: <Star className="h-5 w-5" />,       title: t({ ko: '성장 지원',   en: 'Learning Support', ja: '成長支援',        zh: '成长支持' }),   desc: t({ ko: '도서비, 컨퍼런스, 교육비 전액 지원', en: 'Books, conferences, and training fully covered', ja: '書籍費、カンファレンス、教育費全額支援', zh: '图书、会议、培训费全额支持' }), color: 'bg-amber-50 text-amber-500' },
    { icon: <Zap className="h-5 w-5" />,        title: t({ ko: '최신 장비',   en: 'Top-Tier Gear',    ja: '最新機器',        zh: '顶级设备' }),   desc: t({ ko: '맥북 프로, 모니터 등 원하는 장비 지급', en: 'MacBook Pro, monitors, any gear you need', ja: 'MacBook Pro、モニターなど希望機器支給', zh: '提供 MacBook Pro、显示器等所需设备' }), color: 'bg-violet-50 text-violet-500' },
    { icon: <Users className="h-5 w-5" />,      title: t({ ko: '팀 문화',     en: 'Team Culture',     ja: 'チーム文化',      zh: '团队文化' }),   desc: t({ ko: '수평적 소통, 분기별 팀 워크샵',  en: 'Flat communication, quarterly team workshops', ja: 'フラットなコミュニケーション、四半期チームワークショップ', zh: '扁平化沟通、季度团队工坊' }), color: 'bg-emerald-50 text-emerald-500' },
    { icon: <Briefcase className="h-5 w-5" />,  title: t({ ko: '보상 체계',   en: 'Rewards',          ja: '報酬制度',        zh: '奖励体系' }),   desc: t({ ko: '성과 기반 인센티브, 스톡옵션 제도', en: 'Performance-based incentives, stock options', ja: '成果ベースのインセンティブ、ストックオプション制度', zh: '基于绩效的激励、股票期权制度' }), color: 'bg-cyan-50 text-cyan-500' },
  ];

  const FULLTIME  = t({ ko: '정규직',        en: 'Full-time',       ja: '正社員',        zh: '正式员工' });
  const INTERN    = t({ ko: '정규직/인턴',  en: 'Full-time/Intern', ja: '正社員/インターン', zh: '正式员工/实习生' });
  const SEOUL     = t({ ko: '서울',          en: 'Seoul',           ja: 'ソウル',        zh: '首尔' });
  const SEOUL_REM = t({ ko: '서울/리모트',  en: 'Seoul/Remote',    ja: 'ソウル/リモート', zh: '首尔/远程' });

  const POSITIONS = [
    {
      category: t({ ko: '개발', en: 'Engineering', ja: '開発', zh: '开发' }),
      icon: <Code className="h-5 w-5" />,
      color: 'bg-blue-50 text-blue-500',
      roles: [
        { title: t({ ko: '프론트엔드 개발자', en: 'Frontend Engineer', ja: 'フロントエンド開発者', zh: '前端工程师' }),   type: FULLTIME, location: SEOUL,     desc: t({ ko: 'React/Next.js 기반 프리티풀 웹·앱 개발', en: 'Build Freetiful web/app on React & Next.js', ja: 'React/Next.js で Freetiful Web・アプリ開発', zh: '基于 React/Next.js 开发 Freetiful Web/App' }) },
        { title: t({ ko: '백엔드 개발자',     en: 'Backend Engineer',  ja: 'バックエンド開発者',   zh: '后端工程师' }),   type: FULLTIME, location: SEOUL,     desc: t({ ko: 'Node.js/NestJS 기반 API 및 매칭 시스템 개발', en: 'Build API & matching system on Node.js & NestJS', ja: 'Node.js/NestJS ベースの API とマッチングシステム開発', zh: '基于 Node.js/NestJS 开发 API 与匹配系统' }) },
        { title: t({ ko: 'AI/ML 엔지니어',    en: 'AI/ML Engineer',    ja: 'AI/ML エンジニア',     zh: 'AI/ML 工程师' }), type: FULLTIME, location: SEOUL_REM, desc: t({ ko: 'AI 기반 전문가 매칭 알고리즘 고도화',     en: 'Advance AI-based expert matching algorithms',       ja: 'AI ベース専門家マッチングアルゴリズム高度化', zh: '升级 AI 驱动的专家匹配算法' }) },
      ],
    },
    {
      category: t({ ko: '마케팅', en: 'Marketing', ja: 'マーケティング', zh: '营销' }),
      icon: <Megaphone className="h-5 w-5" />,
      color: 'bg-rose-50 text-rose-500',
      roles: [
        { title: t({ ko: '그로스 마케터',  en: 'Growth Marketer',  ja: 'グロースマーケター',  zh: '增长营销经理' }), type: FULLTIME, location: SEOUL, desc: t({ ko: '유저 획득·리텐션 전략 수립 및 실행', en: 'Plan and execute user acquisition & retention strategies', ja: 'ユーザー獲得・リテンション戦略の立案と実行', zh: '用户获取与留存战略的制定与执行' }) },
        { title: t({ ko: '콘텐츠 마케터',  en: 'Content Marketer', ja: 'コンテンツマーケター',zh: '内容营销经理' }), type: INTERN,   location: SEOUL, desc: t({ ko: 'SNS 채널 운영 및 브랜드 콘텐츠 기획', en: 'Manage social channels and plan brand content',         ja: 'SNS チャネル運営とブランドコンテンツ企画', zh: '社交媒体运营与品牌内容策划' }) },
      ],
    },
    {
      category: t({ ko: '디자인', en: 'Design', ja: 'デザイン', zh: '设计' }),
      icon: <Palette className="h-5 w-5" />,
      color: 'bg-violet-50 text-violet-500',
      roles: [
        { title: t({ ko: '프로덕트 디자이너', en: 'Product Designer', ja: 'プロダクトデザイナー', zh: '产品设计师' }), type: FULLTIME, location: SEOUL, desc: t({ ko: '프리티풀 앱·웹 UX/UI 설계 및 디자인 시스템 구축', en: 'Design Freetiful app/web UX/UI and build the design system', ja: 'Freetiful アプリ・Web UX/UI 設計とデザインシステム構築', zh: '设计 Freetiful App/Web UX/UI,构建设计系统' }) },
      ],
    },
    {
      category: t({ ko: '운영', en: 'Operations', ja: '運営', zh: '运营' }),
      icon: <Headphones className="h-5 w-5" />,
      color: 'bg-emerald-50 text-emerald-500',
      roles: [
        { title: t({ ko: '전문가 매니저',     en: 'Pro Manager',              ja: '専門家マネージャー',   zh: '专家经理' }),   type: FULLTIME, location: SEOUL, desc: t({ ko: '진행자 온보딩, 품질 관리, 파트너십 운영', en: 'Host onboarding, quality control, partnerships', ja: '司会者オンボーディング、品質管理、パートナーシップ運営', zh: '主持人入职、质量管理、合作伙伴运营' }) },
        { title: t({ ko: '고객 경험 매니저',  en: 'Customer Experience Mgr.', ja: 'カスタマーエクスペリエンスマネージャー', zh: '客户体验经理' }), type: FULLTIME, location: SEOUL, desc: t({ ko: '고객 문의 대응 및 서비스 품질 개선',     en: 'Handle customer inquiries & improve service quality',      ja: 'お客様対応及びサービス品質改善', zh: '客户咨询处理与服务品质提升' }) },
      ],
    },
  ];

  const VALUES = [
    { num: '01', title: t({ ko: '신뢰를 설계합니다',         en: 'We engineer trust',               ja: '信頼を設計します',           zh: '我们设计信任' }),       desc: t({ ko: '검증되지 않은 것은 연결하지 않습니다. 시스템으로 신뢰를 만들어갑니다.',      en: 'We never connect the unverified — we build trust through systems.',       ja: '検証されていないものは繋がない。システムで信頼を築きます。',       zh: '不连接未经认证的事物。我们通过系统构建信任。' }) },
    { num: '02', title: t({ ko: '고객의 순간에 집중합니다',   en: 'We focus on customer moments',     ja: 'お客様の瞬間に集中します',   zh: '专注于客户时刻' }),     desc: t({ ko: '결혼식, 기업행사 — 누군가에게는 인생에서 가장 중요한 순간입니다.',          en: "Weddings, corporate events — these can be someone's most important moments.",  ja: '結婚式、企業イベント — 誰かにとって人生で最も大切な瞬間です。',      zh: '婚礼、企业活动——对有些人来说,是人生中最重要的时刻。' }) },
    { num: '03', title: t({ ko: '함께 성장합니다',             en: 'We grow together',                 ja: '共に成長します',              zh: '共同成长' }),           desc: t({ ko: '프리랜서 진행자가 안정적으로 성장할 수 있는 생태계를 만듭니다.',             en: 'We build an ecosystem where freelance hosts can grow stably.',              ja: 'フリーランス司会者が安定して成長できるエコシステムを築きます。',    zh: '打造自由主持人稳定成长的生态。' }) },
    { num: '04', title: t({ ko: '빠르게 실행합니다',           en: 'We execute fast',                  ja: '素早く実行します',            zh: '快速执行' }),           desc: t({ ko: '완벽한 계획보다 빠른 실행과 학습을 통해 더 나은 서비스를 만듭니다.',         en: 'Better to execute fast and learn than to plan perfectly.',                  ja: '完璧な計画より素早い実行と学習でより良いサービスを作ります。',       zh: '相比完美计划,快速执行与学习更能打造更好的服务。' }) },
  ];
  const [selectedRole, setSelectedRole] = useState<{ title: string; type: string; location: string; desc: string; category: string } | null>(null);
  const [apply, setApply] = useState({ name: '', phone: '', email: '', position: '', message: '' });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!apply.name || !apply.email || !apply.message) {
      toast.error(t({ ko: '필수 항목을 입력해주세요', en: 'Please fill in the required fields', ja: '必須項目を入力してください', zh: '请填写必填项' }));
      return;
    }
    setSending(true);
    await new Promise((r) => setTimeout(r, 1000));
    toast.success(t({
      ko: '지원서가 접수되었습니다. 검토 후 연락드리겠습니다.',
      en: 'Application received. We will review and get back to you.',
      ja: '応募を受け付けました。審査後にご連絡いたします。',
      zh: '已收到您的申请。我们将审核后与您联系。',
    }));
    setApply({ name: '', phone: '', email: '', position: '', message: '' });
    setSelectedRole(null);
    setSending(false);
  }

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

          <nav className={`hidden items-center gap-1 md:flex transition-all duration-700 ${scrollY > 80 ? 'gap-0' : 'gap-1'}`}>
            {[
              { id: '문화',     label: t({ ko: '문화',     en: 'Culture',   ja: '文化',       zh: '文化' }) },
              { id: '채용공고', label: t({ ko: '채용공고', en: 'Positions', ja: '募集職種',   zh: '职位' }) },
              { id: '복지',     label: t({ ko: '복지',     en: 'Benefits',  ja: '福利厚生',   zh: '福利' }) },
              { id: '지원하기', label: t({ ko: '지원하기', en: 'Apply',     ja: '応募',       zh: '申请' }) },
            ].map((n) => (
              <button
                key={n.id}
                onClick={() => scrollTo(n.id)}
                className={`font-medium rounded-full transition-all text-gray-400 hover:text-gray-700 ${
                  scrollY > 80 ? 'text-[11px] px-2.5 py-1.5' : 'text-[13px] px-4 py-2'
                }`}
              >
                {n.label}
              </button>
            ))}
            <Link
              href="/biz"
              className={`font-medium rounded-full transition-all text-gray-400 hover:text-gray-700 ${
                scrollY > 80 ? 'text-[11px] px-2.5 py-1.5' : 'text-[13px] px-4 py-2'
              }`}
            >
              {t({ ko: '회사소개', en: 'About', ja: '会社紹介', zh: '公司简介' })}
            </Link>
          </nav>

          <div className="flex items-center gap-1">
            <LanguageToggle />
            <button
              onClick={() => scrollTo('지원하기')}
              className={`bg-gray-900 font-bold text-white rounded-full transition-all hover:bg-gray-800 active:scale-95 ${
                scrollY > 80 ? 'text-[11px] px-4 py-1.5' : 'text-[13px] px-5 py-2'
              }`}
            >
              {t({ ko: '지원하기', en: 'Apply', ja: '応募', zh: '申请' })}
            </button>
          </div>
        </div>
      </header>

      {/* ═══ Hero ═══════════════════════════════════════════════ */}
      <section className="relative flex min-h-screen items-center justify-center pt-[60px] overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-50/80 via-white to-blue-50/50" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet-100/30 rounded-full blur-[150px]" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white" />

        <div className="relative z-10 text-center px-6">
          <Reveal>
            <p className="mb-5 text-[11px] font-medium tracking-normal text-gray-300">JOIN FREETIFUL</p>
          </Reveal>
          <Reveal delay={200}>
            <h1 className="text-[40px] font-black leading-[1.1] tracking-tight md:text-[72px]">
              {t({
                ko: <><span className="text-gray-900">소중한 순간을 만드는</span><br /><span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">사람들을 찾습니다</span></>,
                en: <><span className="text-gray-900">Looking for people who</span><br /><span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">create precious moments</span></>,
                ja: <><span className="text-gray-900">大切な瞬間を作る</span><br /><span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">仲間を探しています</span></>,
                zh: <><span className="text-gray-900">寻找创造珍贵时刻的</span><br /><span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">伙伴</span></>,
              }) as any}
            </h1>
          </Reveal>
          <Reveal delay={400}>
            <p className="mx-auto mt-6 max-w-[480px] text-[15px] leading-normal text-gray-400">
              {t({
                ko: <>전국 1,000여 명의 전문 진행자와 함께하는<br />프리랜서 진행자 매칭 플랫폼, 프리티풀에서 함께 성장하세요.</>,
                en: <>Grow together at Freetiful — a matching platform<br />with over 1,000 professional hosts nationwide.</>,
                ja: <>全国 1,000 名以上のプロ司会者と共にある<br />フリーランス司会者マッチングプラットフォーム、Freetiful で共に成長しましょう。</>,
                zh: <>携手全国 1,000 余名专业主持人的<br />自由主持人匹配平台 Freetiful,共同成长。</>,
              }) as any}
            </p>
          </Reveal>
          <Reveal delay={600}>
            <div className="mt-10 flex justify-center gap-3">
              <button onClick={() => scrollTo('채용공고')} className="bg-gray-900 px-8 py-3.5 text-[14px] font-bold text-white rounded-full transition-all hover:bg-gray-800 active:scale-95">
                {t({ ko: '채용공고 보기', en: 'See Open Positions', ja: '募集職種を見る', zh: '查看职位' })}
              </button>
              <button onClick={() => scrollTo('문화')} className="border border-gray-200 px-8 py-3.5 text-[14px] font-bold text-gray-500 rounded-full transition-all hover:border-gray-300 hover:text-gray-800 hover:bg-gray-50">
                {t({ ko: '우리 문화 알아보기', en: 'Learn About Our Culture', ja: '当社文化を知る', zh: '了解企业文化' })}
              </button>
            </div>
          </Reveal>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce z-10">
          <ChevronDown className="h-5 w-5 text-gray-300" />
        </div>
      </section>

      {/* ═══ 문화 ═══════════════════════════════════════════════ */}
      <section id="문화" className="py-28">
        <div className="mx-auto max-w-[1100px] px-6">
          <Reveal><p className="text-[11px] font-medium tracking-normal text-violet-500">OUR VALUES</p></Reveal>
          <Reveal delay={100}>
            <h2 className="mt-3 text-[34px] font-black tracking-tight md:text-[42px]">
              {t({
                ko: <>프리티풀이<br />일하는 방식</>,
                en: <>How Freetiful<br />works</>,
                ja: <>Freetiful の<br />働き方</>,
                zh: <>Freetiful 的<br />工作方式</>,
              }) as any}
            </h2>
          </Reveal>

          <div className="mt-14 space-y-4">
            {VALUES.map((v, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="group flex items-start gap-8 border border-gray-100 rounded-2xl p-8 transition-all hover:border-gray-200 hover:shadow-sm">
                  <span className="text-[40px] font-black text-violet-100 shrink-0 w-[60px] transition-colors group-hover:text-violet-200">{v.num}</span>
                  <div className="pt-2">
                    <h3 className="text-[20px] font-bold text-gray-900">{v.title}</h3>
                    <p className="mt-2 text-[14px] leading-normal text-gray-400">{v.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 채용공고 ═══════════════════════════════════════════ */}
      <section id="채용공고" className="py-28 bg-gray-50/60">
        <div className="mx-auto max-w-[1100px] px-6">
          <Reveal><p className="text-[11px] font-medium tracking-normal text-violet-500">OPEN POSITIONS</p></Reveal>
          <Reveal delay={100}>
            <h2 className="mt-3 text-[34px] font-black tracking-tight md:text-[42px]">
              {t({ ko: '채용 중인 포지션', en: 'Open Positions', ja: '募集中のポジション', zh: '招聘中的职位' })}
            </h2>
          </Reveal>

          <div className="mt-12 space-y-8">
            {POSITIONS.map((dept, di) => (
              <Reveal key={di} delay={di * 100}>
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${dept.color}`}>{dept.icon}</div>
                    <h3 className="text-[18px] font-bold text-gray-900">{dept.category}</h3>
                  </div>
                  <div className="space-y-2">
                    {dept.roles.map((role, ri) => (
                      <button
                        key={ri}
                        onClick={() => {
                          setSelectedRole({ ...role, category: dept.category });
                          setApply((prev) => ({ ...prev, position: `[${dept.category}] ${role.title}` }));
                          scrollTo('지원하기');
                        }}
                        className="group w-full flex items-center justify-between bg-white border border-gray-100 rounded-2xl p-5 text-left transition-all hover:border-gray-200 hover:shadow-md"
                      >
                        <div className="flex-1">
                          <p className="text-[16px] font-bold text-gray-900 group-hover:text-violet-600 transition-colors">{role.title}</p>
                          <p className="mt-1 text-[13px] text-gray-400">{role.desc}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <span className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">{role.type}</span>
                          <span className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">{role.location}</span>
                          <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-violet-500 group-hover:translate-x-1 transition-all" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 복지 ═══════════════════════════════════════════════ */}
      <section id="복지" className="py-28">
        <div className="mx-auto max-w-[1100px] px-6">
          <Reveal><p className="text-[11px] font-medium tracking-normal text-violet-500">BENEFITS</p></Reveal>
          <Reveal delay={100}>
            <h2 className="mt-3 text-[34px] font-black tracking-tight md:text-[42px]">
              {t({
                ko: '함께하면 누리는 것들',
                en: 'Benefits of joining us',
                ja: '一緒に働くと得られるもの',
                zh: '加入我们的福利',
              })}
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((item, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="group border border-gray-100 rounded-2xl p-6 transition-all duration-300 hover:border-gray-200 hover:shadow-sm">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${item.color} transition-transform duration-300 group-hover:scale-110`}>{item.icon}</div>
                  <h3 className="mt-4 text-[17px] font-bold text-gray-900">{item.title}</h3>
                  <p className="mt-2 text-[13px] leading-normal text-gray-400">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 지원하기 ═══════════════════════════════════════════ */}
      <section id="지원하기" className="py-28 bg-gray-50/60">
        <div className="mx-auto max-w-[600px] px-6">
          <Reveal><p className="text-[11px] font-medium tracking-normal text-violet-500">APPLY</p></Reveal>
          <Reveal delay={100}><h2 className="mt-3 text-[34px] font-black">{t({ ko: '지원하기', en: 'Apply', ja: '応募', zh: '申请' })}</h2></Reveal>
          <Reveal delay={150}><p className="mt-3 text-[14px] text-gray-400">{t({
            ko: '프리티풀과 함께 성장할 인재를 기다립니다',
            en: 'Waiting for talents who will grow with Freetiful',
            ja: 'Freetiful と共に成長する人材を待っています',
            zh: '期待与 Freetiful 共同成长的人才',
          })}</p></Reveal>

          {selectedRole && (
            <Reveal delay={100}>
              <div className="mt-6 flex items-center gap-3 bg-violet-50 border border-violet-100 rounded-xl p-4">
                <CheckCircle className="h-5 w-5 text-violet-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-violet-700">{selectedRole.title}</p>
                  <p className="text-[11px] text-violet-400">{selectedRole.category} · {selectedRole.type} · {selectedRole.location}</p>
                </div>
                <button onClick={() => { setSelectedRole(null); setApply((prev) => ({ ...prev, position: '' })); }} className="text-violet-300 hover:text-violet-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </Reveal>
          )}

          <Reveal delay={200}>
            <form onSubmit={handleApply} className="mt-8 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input className="h-12 w-full border border-gray-200 rounded-xl bg-white px-4 text-[14px] text-gray-900 outline-none transition-all placeholder-gray-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-50" placeholder={t({ ko: '이름 *', en: 'Name *', ja: '氏名 *', zh: '姓名 *' })} value={apply.name} onChange={(e) => setApply({ ...apply, name: e.target.value })} required />
                <input className="h-12 w-full border border-gray-200 rounded-xl bg-white px-4 text-[14px] text-gray-900 outline-none transition-all placeholder-gray-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-50" placeholder={t({ ko: '연락처', en: 'Phone', ja: '連絡先', zh: '联系电话' })} value={apply.phone} onChange={(e) => setApply({ ...apply, phone: e.target.value })} />
              </div>
              <input className="h-12 w-full border border-gray-200 rounded-xl bg-white px-4 text-[14px] text-gray-900 outline-none transition-all placeholder-gray-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-50" placeholder={t({ ko: '이메일 *', en: 'Email *', ja: 'メール *', zh: '邮箱 *' })} type="email" value={apply.email} onChange={(e) => setApply({ ...apply, email: e.target.value })} required />
              {!selectedRole && (
                <select
                  value={apply.position}
                  onChange={(e) => setApply({ ...apply, position: e.target.value })}
                  className="h-12 w-full border border-gray-200 rounded-xl bg-white px-4 text-[14px] text-gray-900 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-50"
                >
                  <option value="">{t({ ko: '지원 포지션 선택', en: 'Select position', ja: '応募ポジションを選択', zh: '选择申请职位' })}</option>
                  {POSITIONS.flatMap((d) => d.roles.map((r) => (
                    <option key={`${d.category}-${r.title}`} value={`[${d.category}] ${r.title}`}>[{d.category}] {r.title}</option>
                  )))}
                  <option value="기타">{t({ ko: '기타 / 열린 지원', en: 'Other / Open Application', ja: 'その他 / オープン応募', zh: '其他 / 开放申请' })}</option>
                </select>
              )}
              <textarea className="h-32 w-full resize-none border border-gray-200 rounded-xl bg-white px-4 py-3 text-[14px] text-gray-900 outline-none transition-all placeholder-gray-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-50" placeholder={t({ ko: '자기소개 및 지원동기 *', en: 'Introduction and motivation *', ja: '自己紹介と志望動機 *', zh: '自我介绍及申请动机 *' })} value={apply.message} onChange={(e) => setApply({ ...apply, message: e.target.value })} required />
              <button type="submit" disabled={sending} className="flex w-full items-center justify-center gap-2 bg-gray-900 py-3.5 text-[15px] font-bold text-white rounded-xl transition-all hover:bg-gray-800 active:scale-[0.98] disabled:opacity-50">
                <Send className="h-4 w-4" /> {sending ? t({ ko: '전송 중...', en: 'Sending...', ja: '送信中...', zh: '发送中...' }) : t({ ko: '지원서 제출', en: 'Submit Application', ja: '応募書提出', zh: '提交申请' })}
              </button>
              <p className="text-[11px] text-gray-300 text-center">{t({
                ko: '지원서 검토 후 영업일 기준 3~5일 내 연락드립니다',
                en: 'We will contact you within 3-5 business days after review',
                ja: '応募書類審査後、営業日 3~5 日以内にご連絡いたします',
                zh: '审核申请后,我们将在 3-5 个工作日内联系您',
              })}</p>
            </form>
          </Reveal>
        </div>
      </section>

      {/* ═══ Footer ═══════════════════════════════════════════ */}
      <footer className="border-t border-gray-100 py-12 bg-white">
        <div className="mx-auto max-w-[1000px] px-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[16px] font-black text-gray-900">Freetiful <span className="text-gray-300 font-normal text-[12px]">Careers</span></p>
              <p className="mt-1 text-[11px] text-gray-300">{t({ ko: '프리티풀', en: 'Freetiful', ja: 'Freetiful', zh: 'Freetiful' })} | {t({ ko: '서울 강남구 논현대로10길 30, 505-제이20호', en: 'Rm 505-J20, 30 Nonhyeon-daero 10-gil, Gangnam-gu, Seoul', ja: 'ソウル江南区論峴大路10ギル30, 505-ジェイ20号', zh: '首尔江南区论岘大路10街30号 505-J20号' })}</p>
              <p className="text-[10px] text-gray-200">Copyright &copy; Freetiful. All rights reserved.</p>
            </div>
            <div className="flex gap-4 text-[12px] text-gray-300">
              <Link href="/biz" className="transition-colors hover:text-gray-500">{t({ ko: '회사소개', en: 'About', ja: '会社紹介', zh: '公司简介' })}</Link>
              <Link href="/main" className="transition-colors hover:text-gray-500">{t({ ko: '홈으로', en: 'Home', ja: 'ホーム', zh: '返回首页' })}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
