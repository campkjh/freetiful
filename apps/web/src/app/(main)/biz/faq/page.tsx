'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, ChevronDown, X } from 'lucide-react';
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

/* ─── Accordion Item ─────────────────────────────────────── */
function FaqItem({ question, answer, isOpen, onToggle, delay }: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  delay: number;
}) {
  return (
    <Reveal delay={delay}>
      <div className={`border rounded-2xl transition-all duration-300 ${isOpen ? 'border-blue-200 bg-blue-50/30 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}>
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between p-6 text-left"
        >
          <div className="flex items-start gap-3 flex-1 pr-4">
            <span className={`text-[14px] font-black shrink-0 mt-0.5 transition-colors ${isOpen ? 'text-blue-500' : 'text-gray-300'}`}>Q</span>
            <span className={`text-[15px] font-bold transition-colors ${isOpen ? 'text-gray-900' : 'text-gray-700'}`}>{question}</span>
          </div>
          <ChevronDown className={`w-5 h-5 shrink-0 transition-all duration-300 ${isOpen ? 'text-blue-500 rotate-180' : 'text-gray-300'}`} />
        </button>
        <div
          className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
        >
          <div className="px-6 pb-6 pl-[42px]">
            <div className="flex items-start gap-3">
              <span className="text-[14px] font-black text-blue-400 shrink-0 mt-0.5">A</span>
              <p className="text-[14px] leading-[1.8] text-gray-500">{answer}</p>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/* ─── Page ─────────────────────────────────────────────────── */
export default function FaqPage() {
  const t = useT();
  const [scrollY, setScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const FAQ_CATEGORIES = [
    { id: 'all',      label: t({ ko: '전체',        en: 'All',         ja: '全体',         zh: '全部' }) },
    { id: 'service',  label: t({ ko: '서비스 이용', en: 'Service',     ja: 'サービス利用', zh: '服务使用' }) },
    { id: 'matching', label: t({ ko: '매칭/예약',   en: 'Matching',    ja: 'マッチング',   zh: '匹配/预约' }) },
    { id: 'payment',  label: t({ ko: '결제/환불',   en: 'Payment',     ja: '決済/返金',    zh: '支付/退款' }) },
    { id: 'expert',   label: t({ ko: '전문가 관련', en: 'Professionals', ja: '専門家',     zh: '专业人士' }) },
  ];

  const FAQS = [
    {
      category: 'service',
      question: t({ ko: '프리티풀은 어떤 서비스인가요?', en: 'What service does Freetiful provide?', ja: 'Freetiful はどんなサービスですか?', zh: 'Freetiful 是什么服务?' }),
      answer: t({ ko: '프리티풀은 전문 진행자(MC, 아나운서, 쇼호스트 등)와 고객을 연결하는 매칭 플랫폼입니다. 결혼식, 기업 행사, 컨퍼런스, 세미나, 파티 등 다양한 행사에 맞는 최적의 전문 진행자를 매칭해드립니다.',
        en: 'Freetiful is a matching platform that connects clients with professional hosts (MCs, announcers, show hosts). We match the best professionals to weddings, corporate events, conferences, seminars, parties, and more.',
        ja: 'Freetiful は、プロ司会者(MC、アナウンサー、ショーホストなど)とお客様を繋ぐマッチングプラットフォームです。結婚式、企業イベント、カンファレンス、セミナー、パーティーなど様々なイベントに最適なプロ司会者をマッチングします。',
        zh: 'Freetiful 是连接专业主持人(MC、主播、购物主持人等)与客户的匹配平台。我们为婚礼、企业活动、会议、研讨会、派对等各类活动匹配最合适的专业主持人。' }),
    },
    {
      category: 'service',
      question: t({ ko: '어떤 종류의 행사에 이용할 수 있나요?', en: 'What types of events can I use it for?', ja: 'どのような種類のイベントで利用できますか?', zh: '可以用于哪些活动?' }),
      answer: t({ ko: '결혼식 사회, 기업 행사, 컨퍼런스, 세미나, 시상식, 축제, 송년회, 제품 런칭 이벤트, 쇼호스트 등 전문 진행자가 필요한 모든 행사에 이용하실 수 있습니다. 이벤트 유형에 맞는 전문가를 매칭해드립니다.',
        en: 'Weddings, corporate events, conferences, seminars, award ceremonies, festivals, year-end parties, product launches, shopping broadcasts — anywhere you need a professional host. We match the right expert to your event type.',
        ja: '結婚式司会、企業イベント、カンファレンス、セミナー、授賞式、フェスティバル、忘年会、製品発表会、ショーホストなど、プロ司会者が必要なすべてのイベントに利用可能です。イベントに合った専門家をマッチングします。',
        zh: '婚礼、企业活动、会议、研讨会、颁奖典礼、节庆、年会、产品发布、直播带货等,凡需要专业主持人的场合都可以使用。我们根据活动类型匹配合适的专家。' }),
    },
    {
      category: 'service',
      question: t({ ko: '전국 어디서든 이용 가능한가요?', en: 'Is service available nationwide?', ja: '全国どこでも利用できますか?', zh: '全国各地都能使用吗?' }),
      answer: t({ ko: '네, 전국 1,000여 명의 전문 진행자 네트워크를 보유하고 있어 전국 어디서든 매칭이 가능합니다. 서울/수도권은 물론 지방 행사도 지원합니다.',
        en: 'Yes. With a network of 1,000+ professional hosts nationwide, we can match anywhere in Korea — from Seoul and the capital region to provincial cities.',
        ja: 'はい、全国 1,000 名以上のプロ司会者ネットワークがあり、全国どこでもマッチング可能です。ソウル・首都圏はもちろん地方イベントにも対応します。',
        zh: '是的,我们拥有全国 1,000 余名专业主持人网络,全国各地都能匹配。首尔和首都圈自不必说,地方活动也同样支持。' }),
    },
    {
      category: 'matching',
      question: t({ ko: '매칭은 어떤 과정으로 진행되나요?', en: 'How does the matching process work?', ja: 'マッチングはどのように進みますか?', zh: '匹配流程是怎样的?' }),
      answer: t({ ko: '행사 정보(날짜, 장소, 유형, 예산 등)를 등록하시면, AI 기반 맞춤 매칭 시스템이 최적의 진행자를 추천합니다. 추천된 진행자의 프로필, 경력, 리뷰를 확인하신 후 원하는 분을 선택하시면 됩니다. 담당 매니저가 전 과정을 지원합니다.',
        en: 'Register your event info (date, venue, type, budget) and our AI-based system recommends optimal hosts. Review their profiles, careers, and reviews, then choose your preferred host. A dedicated manager supports you throughout the process.',
        ja: 'イベント情報(日時、場所、種類、予算など)を登録いただくと、AI ベースのマッチングシステムが最適な司会者を推薦します。推薦された司会者のプロフィール、経歴、レビューを確認し、お好みの方をお選びください。担当マネージャーが全過程をサポートします。',
        zh: '注册活动信息(日期、地点、类型、预算等)后,基于 AI 的匹配系统会推荐最合适的主持人。查看推荐主持人的简介、经历、评价后选择您喜欢的主持人。专属经理全程支持。' }),
    },
    {
      category: 'matching',
      question: t({ ko: '매칭까지 얼마나 걸리나요?', en: 'How long does matching take?', ja: 'マッチングまでどのくらいかかりますか?', zh: '匹配需要多久?' }),
      answer: t({ ko: '일반적으로 문의 후 1~2영업일 내에 맞춤 진행자를 추천해드립니다. 긴급 매칭이 필요한 경우에도 최대한 빠르게 대응하고 있으며, 최소 1주일 전에 문의하시는 것을 권장합니다.',
        en: 'Typically we recommend a customized host within 1-2 business days. Even urgent matching is handled as quickly as possible — we recommend inquiring at least 1 week in advance.',
        ja: '通常、お問合せ後 1~2 営業日以内にカスタマイズされた司会者を推薦します。緊急マッチングにも可能な限り迅速に対応しており、最低 1 週間前のお問合せを推奨いたします。',
        zh: '通常咨询后 1-2 个工作日内推荐定制主持人。紧急匹配也会尽快处理,建议至少提前 1 周咨询。' }),
    },
    {
      category: 'matching',
      question: t({ ko: '진행자를 직접 선택할 수 있나요?', en: 'Can I choose the host directly?', ja: '司会者を直接選べますか?', zh: '我可以自己选择主持人吗?' }),
      answer: t({ ko: '물론입니다. AI가 추천한 진행자 목록에서 프로필, 경력 사항, 샘플 영상, 고객 리뷰를 확인하신 후 원하시는 진행자를 직접 선택하실 수 있습니다.',
        en: 'Of course. From the AI-recommended list of hosts, review profiles, experience, sample videos, and client reviews, then select your preferred host directly.',
        ja: 'もちろんです。AI が推薦した司会者リストからプロフィール、経歴、サンプル映像、顧客レビューを確認し、お好みの司会者を直接お選びいただけます。',
        zh: '当然可以。从 AI 推荐的主持人名单中查看简介、经历、视频样本、客户评价,然后直接选择您喜欢的主持人。' }),
    },
    {
      category: 'payment',
      question: t({ ko: '비용은 어떻게 되나요?', en: 'How is pricing determined?', ja: '費用はどうなりますか?', zh: '费用如何计算?' }),
      answer: t({ ko: '비용은 행사 유형, 시간, 진행자 경력 등에 따라 달라집니다. 문의 시 행사 정보를 알려주시면 예상 견적을 안내해드립니다. 프리티풀은 투명한 가격 정책을 운영하며, 추가 비용 없이 명확한 견적을 제공합니다.',
        en: 'Pricing varies by event type, duration, and host experience. Share your event details when inquiring and we will provide an estimate. Freetiful operates transparent pricing — clear quotes with no hidden fees.',
        ja: '費用はイベントの種類、時間、司会者の経歴などにより異なります。お問合せの際にイベント情報をお知らせいただければ見積もりをご案内いたします。Freetiful は透明な価格ポリシーを運営し、追加費用なしの明確な見積もりを提供します。',
        zh: '费用因活动类型、时长、主持人经验等而异。咨询时告知活动信息,我们将提供预估报价。Freetiful 实行透明价格政策,提供明确报价,无额外费用。' }),
    },
    {
      category: 'payment',
      question: t({ ko: '결제는 어떻게 하나요?', en: 'How do I pay?', ja: '決済はどうしますか?', zh: '如何支付?' }),
      answer: t({ ko: '카드 결제, 계좌이체, 세금계산서 발행 등 다양한 결제 방법을 지원합니다. 기업 고객의 경우 세금계산서 발행 및 후불 결제도 가능합니다.',
        en: 'We support various payment methods: credit card, bank transfer, and tax invoice issuance. Corporate clients can also use tax invoice and deferred payment.',
        ja: 'カード決済、口座振込、税金計算書発行など様々な決済方法に対応しています。法人のお客様の場合、税金計算書発行及び後払いも可能です。',
        zh: '支持信用卡、银行转账、税务发票等多种支付方式。企业客户可使用税务发票与后付款。' }),
    },
    {
      category: 'payment',
      question: t({ ko: '취소 및 환불 정책이 궁금해요.', en: 'What is the cancellation and refund policy?', ja: 'キャンセル及び返金ポリシーを教えてください。', zh: '取消及退款政策是什么?' }),
      answer: t({ ko: '행사 7일 전 취소 시 전액 환불, 3~6일 전 취소 시 50% 환불, 2일 전 이내 취소 시 환불이 어렵습니다. 다만, 천재지변 등 불가피한 사유의 경우 별도 협의가 가능합니다. 자세한 사항은 고객센터로 문의해주세요.',
        en: 'Cancellations 7+ days before the event: full refund. 3-6 days before: 50% refund. Within 2 days: refund not possible. Unavoidable circumstances (e.g. natural disasters) are handled separately. Contact customer support for details.',
        ja: 'イベント 7 日前キャンセル時は全額返金、3~6 日前は 50% 返金、2 日前以内のキャンセルは返金困難です。ただし、天災など不可避な事由の場合は別途協議が可能です。詳細はカスタマーセンターにお問合せください。',
        zh: '活动 7 天前取消全额退款,3-6 天前取消退还 50%,2 天以内取消难以退款。但不可抗力(如自然灾害)可单独协商。详情请联系客服中心。' }),
    },
    {
      category: 'expert',
      question: t({ ko: '진행자들은 어떻게 검증되나요?', en: 'How are hosts verified?', ja: '司会者はどのように検証されますか?', zh: '主持人如何认证?' }),
      answer: t({ ko: '모든 진행자는 KBS, SBS, MBC 등 방송사 출신 경력 확인, 자격증/교육 이수 증명, 실제 행사 영상 리뷰, 인터뷰 평가 등 4단계 검증 절차를 거칩니다. 검증을 통과한 전문가만 프리티풀에 등록됩니다.',
        en: 'Every host goes through a 4-step verification: broadcaster career verification (KBS, SBS, MBC), certifications/training proofs, real event video review, and interview evaluation. Only verified professionals join Freetiful.',
        ja: 'すべての司会者は KBS、SBS、MBC 等の放送局出身経歴確認、資格証/教育修了証明、実イベント映像レビュー、インタビュー評価など 4 段階の検証手続きを経ます。検証を通過した専門家のみが Freetiful に登録されます。',
        zh: '所有主持人均经过 4 阶段认证:KBS、SBS、MBC 等广播公司经历验证、资格证/培训证明、实际活动视频审查、面试评估。仅通过认证的专业人士才能加入 Freetiful。' }),
    },
    {
      category: 'expert',
      question: t({ ko: '진행자로 활동하고 싶어요.', en: 'I want to work as a host.', ja: '司会者として活動したいです。', zh: '我想成为主持人。' }),
      answer: t({ ko: '프리티풀 앱 또는 웹사이트에서 전문가 등록을 신청하실 수 있습니다. 경력 사항과 포트폴리오를 제출하시면 검증 절차 진행 후 승인 결과를 안내드립니다. 자세한 사항은 freetiful2025@gmail.com으로 문의해주세요.',
        en: 'Apply for expert registration through the Freetiful app or website. Submit your career and portfolio, and we will inform you of the result after verification. Contact freetiful2025@gmail.com for details.',
        ja: 'Freetiful アプリまたはウェブサイトで専門家登録を申請できます。経歴とポートフォリオを提出いただき、検証手続き後に承認結果をご案内いたします。詳細は freetiful2025@gmail.com までお問合せください。',
        zh: '可通过 Freetiful 应用或官网申请专家注册。提交经历与作品集后,经过认证流程将告知审核结果。详情请联系 freetiful2025@gmail.com。' }),
    },
    {
      category: 'expert',
      question: t({ ko: '진행자와 사전 미팅이 가능한가요?', en: 'Can I meet the host before the event?', ja: '司会者と事前ミーティングは可能ですか?', zh: '可以与主持人事先会面吗?' }),
      answer: t({ ko: '네, 매칭 확정 후 행사 전 진행자와 사전 미팅(대면 또는 비대면)을 진행하실 수 있습니다. 사전 미팅을 통해 행사 세부 사항을 조율하고, 진행자와의 케미를 확인하실 수 있습니다.',
        en: 'Yes. After matching is confirmed, you can hold a pre-event meeting (in-person or online) with the host to fine-tune event details and check rapport.',
        ja: 'はい、マッチング確定後、イベント前に司会者と事前ミーティング(対面またはオンライン)を行うことができます。事前ミーティングを通じてイベントの詳細を調整し、司会者との相性を確認いただけます。',
        zh: '可以。匹配确定后,您可在活动前与主持人进行会前会议(线下或线上),协调活动细节并确认默契。' }),
    },
  ];

  const filteredFaqs = activeCategory === 'all'
    ? FAQS
    : FAQS.filter((f) => f.category === activeCategory);

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
            <p className="mb-5 text-[11px] font-medium tracking-normal text-gray-400">FREQUENTLY ASKED QUESTIONS</p>
          </Reveal>
          <Reveal delay={200}>
            <h1 className="text-[36px] font-black leading-[1.15] tracking-tight md:text-[56px]">
              {t({
                ko: <><span className="text-gray-900">자주 묻는 </span><span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">질문</span></>,
                en: <><span className="text-gray-900">Frequently </span><span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">Asked</span></>,
                ja: <><span className="text-gray-900">よくある</span><span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">質問</span></>,
                zh: <><span className="text-gray-900">常见</span><span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">问题</span></>,
              }) as any}
            </h1>
          </Reveal>
          <Reveal delay={400}>
            <p className="mx-auto mt-4 max-w-[460px] text-[15px] leading-relaxed text-gray-400">
              {t({
                ko: '프리티풀 서비스에 대해 궁금한 점을 확인해보세요',
                en: 'Find answers to common questions about Freetiful',
                ja: 'Freetiful サービスのご質問をご確認ください',
                zh: '了解 Freetiful 服务的常见问题',
              })}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══ FAQ List ═══════════════════════════════════════════ */}
      <section className="py-24">
        <div className="mx-auto max-w-[800px] px-6">
          {/* Category Tabs */}
          <Reveal>
            <div className="flex flex-wrap gap-2 mb-10">
              {FAQ_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); setOpenIndex(null); }}
                  className={`px-4 py-2 text-[13px] font-medium rounded-full transition-all ${
                    activeCategory === cat.id
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </Reveal>

          {/* FAQ Items */}
          <div className="space-y-3">
            {filteredFaqs.map((faq, i) => (
              <FaqItem
                key={`${activeCategory}-${i}`}
                question={faq.question}
                answer={faq.answer}
                isOpen={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
                delay={i * 60}
              />
            ))}
          </div>

          {/* Contact CTA */}
          <Reveal delay={200}>
            <div className="mt-16 text-center border border-gray-100 rounded-2xl p-8 bg-gray-50/50">
              <p className="text-[18px] font-bold text-gray-900">{t({
                ko: '찾으시는 답변이 없으신가요?',
                en: "Can't find the answer you're looking for?",
                ja: 'お探しの回答が見つかりませんか?',
                zh: '没找到您想要的答案吗?',
              })}</p>
              <p className="mt-2 text-[14px] text-gray-400">{t({
                ko: '프리티풀 고객센터에 문의해주시면 빠르게 답변드리겠습니다.',
                en: 'Contact Freetiful customer support for a prompt response.',
                ja: 'Freetiful カスタマーセンターにお問合せいただければ迅速にご回答いたします。',
                zh: '联系 Freetiful 客服中心,我们会尽快回复您。',
              })}</p>
              <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
                <Link
                  href="/biz#문의폼"
                  className="inline-flex items-center justify-center gap-2 bg-gray-900 px-6 py-3 text-[14px] font-bold text-white rounded-full transition-all hover:bg-gray-800 active:scale-95"
                >
                  {t({ ko: '문의하기', en: 'Contact Us', ja: 'お問合せ', zh: '联系我们' })}
                </Link>
                <a
                  href="mailto:freetiful2025@gmail.com"
                  className="inline-flex items-center justify-center gap-2 border border-gray-200 px-6 py-3 text-[14px] font-bold text-gray-500 rounded-full transition-all hover:border-gray-300 hover:text-gray-800 hover:bg-gray-50"
                >
                  {t({ ko: '이메일 보내기', en: 'Send Email', ja: 'メール送信', zh: '发送邮件' })}
                </a>
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
