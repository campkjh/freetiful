'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, X } from 'lucide-react';

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

/* ─── Page ─────────────────────────────────────────────────── */
export default function CeoPage() {
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
          <Link href="/home" className="transition-all duration-700">
            <Image
              src="/images/logo-prettyful.svg"
              alt="Freetiful"
              width={scrollY > 80 ? 100 : 120}
              height={scrollY > 80 ? 30 : 35}
              className="transition-all duration-700"
              style={{ width: scrollY > 80 ? 100 : 120, height: 'auto' }}
            />
          </Link>

          {/* 모바일 햄버거 메뉴 버튼 */}
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
            <p className="mb-5 text-[11px] font-bold tracking-[0.4em] text-gray-400">CEO MESSAGE</p>
          </Reveal>
          <Reveal delay={200}>
            <h1 className="text-[36px] font-black leading-[1.15] tracking-tight md:text-[56px]">
              <span className="text-gray-900">CEO 인사말</span>
            </h1>
          </Reveal>
          <Reveal delay={400}>
            <p className="mx-auto mt-4 max-w-[460px] text-[15px] leading-relaxed text-gray-400">
              프리티풀의 비전과 철학을 소개합니다
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
                <div className="w-[220px] h-[280px] md:w-[260px] md:h-[340px] rounded-2xl overflow-hidden shadow-lg">
                  <Image
                    src="/images/ceo.png"
                    alt="서나웅 대표이사"
                    width={260}
                    height={340}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className="absolute -bottom-3 -right-3 bg-white rounded-xl shadow-md px-4 py-2 border border-gray-100">
                  <p className="text-[18px] font-black text-gray-900">서나웅</p>
                  <p className="text-[11px] text-gray-400 font-medium">대표이사 / CEO</p>
                </div>
              </div>
            </Reveal>

            {/* Greeting */}
            <div className="flex-1">
              <Reveal delay={200}>
                <h2 className="text-[28px] font-black tracking-tight md:text-[34px] leading-[1.3]">
                  <span className="text-gray-900">&ldquo;소중한 순간을</span><br />
                  <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">가장 아름답게 만드는 연결&rdquo;</span>
                </h2>
              </Reveal>
              <Reveal delay={300}>
                <div className="mt-8 space-y-5 text-[15px] leading-[1.85] text-gray-500">
                  <p>
                    안녕하세요, 프리티풀 대표 서나웅입니다.
                  </p>
                  <p>
                    누군가의 결혼식, 기업의 중요한 행사, 인생에서 가장 특별한 순간 — 이 모든 자리에는
                    그 순간을 빛나게 만드는 &lsquo;사람&rsquo;이 있습니다. 프리티풀은 그런 전문 진행자와
                    고객을 가장 정확하게 연결하는 플랫폼입니다.
                  </p>
                  <p>
                    저는 이 사업을 시작하면서 한 가지 원칙을 세웠습니다.
                    <strong className="text-gray-800"> &ldquo;검증되지 않은 것은 연결하지 않는다.&rdquo;</strong>
                    KBS, SBS, MBC 등 방송사 출신의 검증된 아나운서, MC, 쇼호스트만을 엄선하여
                    전국 1,000여 명의 전문 진행자 네트워크를 구축했습니다.
                  </p>
                  <p>
                    프리티풀은 단순한 매칭 서비스를 넘어, 고객의 소중한 순간을 함께 설계하는
                    파트너가 되고자 합니다. AI 기반 맞춤 매칭 시스템과 체계적인 품질 관리를 통해
                    모든 행사가 성공적으로 진행될 수 있도록 최선을 다하겠습니다.
                  </p>
                  <p>
                    앞으로도 프리랜서 진행자가 안정적으로 성장할 수 있는 생태계를 만들고,
                    고객에게는 신뢰할 수 있는 최고의 서비스를 제공하는 프리티풀이 되겠습니다.
                  </p>
                  <p className="text-gray-400">감사합니다.</p>
                </div>
              </Reveal>
              <Reveal delay={400}>
                <div className="mt-10 flex items-center gap-4">
                  <div className="h-px flex-1 bg-gray-100" />
                  <div className="text-right">
                    <p className="text-[16px] font-bold text-gray-900">주식회사 프리티풀</p>
                    <p className="text-[14px] text-gray-500">대표이사 <strong className="text-gray-800">서나웅</strong></p>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Philosophy / Vision ═══════════════════════════════ */}
      <section className="py-24 bg-gray-50/60">
        <div className="mx-auto max-w-[900px] px-6">
          <Reveal>
            <p className="text-[11px] font-bold tracking-[0.4em] text-blue-500">OUR PHILOSOPHY</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="mt-3 text-[30px] font-black tracking-tight md:text-[38px]">경영 철학</h2>
          </Reveal>

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {[
              { num: '01', title: '신뢰 중심 경영', desc: '검증된 전문가만을 연결합니다. 시스템으로 신뢰를 설계하고, 데이터로 품질을 보장합니다.' },
              { num: '02', title: '고객 가치 최우선', desc: '고객의 소중한 순간에 집중합니다. 결혼식, 기업행사 등 인생의 중요한 순간을 완벽하게 만드는 것이 우리의 사명입니다.' },
              { num: '03', title: '상생의 생태계', desc: '프리랜서 진행자가 안정적으로 활동하고 성장할 수 있는 환경을 만듭니다. 플랫폼과 전문가가 함께 성장합니다.' },
              { num: '04', title: '기술 기반 혁신', desc: 'AI 매칭, 데이터 분석 등 최신 기술을 활용하여 매칭의 정확도와 서비스 품질을 끊임없이 높여갑니다.' },
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
              <p className="mt-1 text-[11px] text-gray-300">프리티풀 | 서울특별시 종로구 율곡로 294, 2층(종로6가)</p>
              <p className="text-[10px] text-gray-200">Copyright &copy; Freetiful. All rights reserved.</p>
            </div>
            <div className="flex gap-4 text-[12px] text-gray-300">
              <Link href="/biz" className="transition-colors hover:text-gray-500">회사소개</Link>
              <Link href="/careers" className="transition-colors hover:text-gray-500">채용</Link>
              <Link href="/home" className="transition-colors hover:text-gray-500">홈으로</Link>
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
