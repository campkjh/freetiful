'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, ChevronDown, X } from 'lucide-react';

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

/* ─── Menu items ─────────────────────────────────────────── */
const MENU_ITEMS = [
  { label: 'CEO 인사말', href: '/biz/ceo' },
  { label: '연혁', href: '/biz/history' },
  { label: '인재채용', href: '/careers' },
  { label: '주요소식', href: '/biz', hash: '자료실' },
  { label: '자주묻는질문', href: '/biz/faq' },
  { label: '고객사', href: '/biz/clients' },
];

/* ─── FAQ Data ───────────────────────────────────────────── */
const FAQ_CATEGORIES = [
  { id: 'all', label: '전체' },
  { id: 'service', label: '서비스 이용' },
  { id: 'matching', label: '매칭/예약' },
  { id: 'payment', label: '결제/환불' },
  { id: 'expert', label: '전문가 관련' },
];

const FAQS = [
  {
    category: 'service',
    question: '프리티풀은 어떤 서비스인가요?',
    answer: '프리티풀은 전문 진행자(MC, 아나운서, 쇼호스트 등)와 고객을 연결하는 매칭 플랫폼입니다. 결혼식, 기업 행사, 컨퍼런스, 세미나, 파티 등 다양한 행사에 맞는 최적의 전문 진행자를 매칭해드립니다.',
  },
  {
    category: 'service',
    question: '어떤 종류의 행사에 이용할 수 있나요?',
    answer: '결혼식 사회, 기업 행사, 컨퍼런스, 세미나, 시상식, 축제, 송년회, 제품 런칭 이벤트, 쇼호스트 등 전문 진행자가 필요한 모든 행사에 이용하실 수 있습니다. 이벤트 유형에 맞는 전문가를 매칭해드립니다.',
  },
  {
    category: 'service',
    question: '전국 어디서든 이용 가능한가요?',
    answer: '네, 전국 1,000여 명의 전문 진행자 네트워크를 보유하고 있어 전국 어디서든 매칭이 가능합니다. 서울/수도권은 물론 지방 행사도 지원합니다.',
  },
  {
    category: 'matching',
    question: '매칭은 어떤 과정으로 진행되나요?',
    answer: '행사 정보(날짜, 장소, 유형, 예산 등)를 등록하시면, AI 기반 맞춤 매칭 시스템이 최적의 진행자를 추천합니다. 추천된 진행자의 프로필, 경력, 리뷰를 확인하신 후 원하는 분을 선택하시면 됩니다. 담당 매니저가 전 과정을 지원합니다.',
  },
  {
    category: 'matching',
    question: '매칭까지 얼마나 걸리나요?',
    answer: '일반적으로 문의 후 1~2영업일 내에 맞춤 진행자를 추천해드립니다. 긴급 매칭이 필요한 경우에도 최대한 빠르게 대응하고 있으며, 최소 1주일 전에 문의하시는 것을 권장합니다.',
  },
  {
    category: 'matching',
    question: '진행자를 직접 선택할 수 있나요?',
    answer: '물론입니다. AI가 추천한 진행자 목록에서 프로필, 경력 사항, 샘플 영상, 고객 리뷰를 확인하신 후 원하시는 진행자를 직접 선택하실 수 있습니다.',
  },
  {
    category: 'payment',
    question: '비용은 어떻게 되나요?',
    answer: '비용은 행사 유형, 시간, 진행자 경력 등에 따라 달라집니다. 문의 시 행사 정보를 알려주시면 예상 견적을 안내해드립니다. 프리티풀은 투명한 가격 정책을 운영하며, 추가 비용 없이 명확한 견적을 제공합니다.',
  },
  {
    category: 'payment',
    question: '결제는 어떻게 하나요?',
    answer: '카드 결제, 계좌이체, 세금계산서 발행 등 다양한 결제 방법을 지원합니다. 기업 고객의 경우 세금계산서 발행 및 후불 결제도 가능합니다.',
  },
  {
    category: 'payment',
    question: '취소 및 환불 정책이 궁금해요.',
    answer: '행사 7일 전 취소 시 전액 환불, 3~6일 전 취소 시 50% 환불, 2일 전 이내 취소 시 환불이 어렵습니다. 다만, 천재지변 등 불가피한 사유의 경우 별도 협의가 가능합니다. 자세한 사항은 고객센터로 문의해주세요.',
  },
  {
    category: 'expert',
    question: '진행자들은 어떻게 검증되나요?',
    answer: '모든 진행자는 KBS, SBS, MBC 등 방송사 출신 경력 확인, 자격증/교육 이수 증명, 실제 행사 영상 리뷰, 인터뷰 평가 등 4단계 검증 절차를 거칩니다. 검증을 통과한 전문가만 프리티풀에 등록됩니다.',
  },
  {
    category: 'expert',
    question: '진행자로 활동하고 싶어요.',
    answer: '프리티풀 앱 또는 웹사이트에서 전문가 등록을 신청하실 수 있습니다. 경력 사항과 포트폴리오를 제출하시면 검증 절차 진행 후 승인 결과를 안내드립니다. 자세한 사항은 freetiful2025@gmail.com으로 문의해주세요.',
  },
  {
    category: 'expert',
    question: '진행자와 사전 미팅이 가능한가요?',
    answer: '네, 매칭 확정 후 행사 전 진행자와 사전 미팅(대면 또는 비대면)을 진행하실 수 있습니다. 사전 미팅을 통해 행사 세부 사항을 조율하고, 진행자와의 케미를 확인하실 수 있습니다.',
  },
];

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
  const [scrollY, setScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

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
          <Link href="/main" className="transition-all duration-700">
            <Image
              src="/images/logo-prettyful.svg"
              alt="Freetiful"
              width={scrollY > 80 ? 100 : 120}
              height={scrollY > 80 ? 30 : 35}
              className="transition-all duration-700"
              style={{ width: scrollY > 80 ? 100 : 120, height: 'auto' }}
            />
          </Link>

          <button
            className="flex flex-col items-center justify-center gap-[5px] w-9 h-9"
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className="block w-5 h-[2px] rounded-full bg-gray-900 transition-all duration-300" />
            <span className="block w-5 h-[2px] rounded-full bg-gray-900 transition-all duration-300" />
            <span className="block w-3.5 h-[2px] rounded-full bg-gray-900 transition-all duration-300" />
          </button>
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
              <span className="text-[14px] font-bold text-gray-900">메뉴</span>
              <button onClick={() => setMobileMenuOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="h-px bg-gray-100 mx-6" />
            <div className="flex-1 px-6 py-4 flex flex-col gap-1">
              {MENU_ITEMS.map((item) => (
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
                문의하기
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
            <p className="mb-5 text-[11px] font-bold tracking-[0.4em] text-gray-400">FREQUENTLY ASKED QUESTIONS</p>
          </Reveal>
          <Reveal delay={200}>
            <h1 className="text-[36px] font-black leading-[1.15] tracking-tight md:text-[56px]">
              <span className="text-gray-900">자주 묻는 </span>
              <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">질문</span>
            </h1>
          </Reveal>
          <Reveal delay={400}>
            <p className="mx-auto mt-4 max-w-[460px] text-[15px] leading-relaxed text-gray-400">
              프리티풀 서비스에 대해 궁금한 점을 확인해보세요
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
              <p className="text-[18px] font-bold text-gray-900">찾으시는 답변이 없으신가요?</p>
              <p className="mt-2 text-[14px] text-gray-400">프리티풀 고객센터에 문의해주시면 빠르게 답변드리겠습니다.</p>
              <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
                <Link
                  href="/biz#문의폼"
                  className="inline-flex items-center justify-center gap-2 bg-gray-900 px-6 py-3 text-[14px] font-bold text-white rounded-full transition-all hover:bg-gray-800 active:scale-95"
                >
                  문의하기
                </Link>
                <a
                  href="mailto:freetiful2025@gmail.com"
                  className="inline-flex items-center justify-center gap-2 border border-gray-200 px-6 py-3 text-[14px] font-bold text-gray-500 rounded-full transition-all hover:border-gray-300 hover:text-gray-800 hover:bg-gray-50"
                >
                  이메일 보내기
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
              <p className="mt-1 text-[11px] text-gray-300">프리티풀 | 서울특별시 종로구 율곡로 294, 2층(종로6가)</p>
              <p className="text-[10px] text-gray-200">Copyright &copy; Freetiful. All rights reserved.</p>
            </div>
            <div className="flex gap-4 text-[12px] text-gray-300">
              <Link href="/biz" className="transition-colors hover:text-gray-500">회사소개</Link>
              <Link href="/careers" className="transition-colors hover:text-gray-500">채용</Link>
              <Link href="/main" className="transition-colors hover:text-gray-500">홈으로</Link>
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
