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

/* ─── History Data (from biz/page.tsx) ───────────────────── */
const HISTORY = [
  {
    year: '2026',
    events: [
      { month: '03', title: '프리티풀 정식 서비스 운영 개시', desc: '전문 행사인력 매칭 서비스 본격 운영' },
      { month: '03', title: '벤처기업 인증 획득', desc: '기술 혁신형 벤처기업 공식 인증' },
      { month: '02', title: '제휴업체 300여 곳과 전략적 파트너십 체결', desc: '전국 단위 행사 인프라 네트워크 구축' },
      { month: '02', title: 'Seed 투자 유치', desc: '전문투자기관으로부터 시드 라운드 투자 유치' },
      { month: '01', title: '전문 행사인력 매칭 플랫폼 출시', desc: 'MC, 아나운서, 쇼호스트 등 전문 인력 매칭 서비스 런칭' },
      { month: '01', title: '프리티풀 브랜드 공식 론칭', desc: 'Prettyful 브랜드 아이덴티티 공개' },
    ],
  },
  {
    year: '2025',
    events: [
      { month: '12', title: '주식회사 커넥트풀 설립', desc: '법인 설립 및 사업 개시' },
    ],
  },
];

/* ─── Page ─────────────────────────────────────────────────── */
export default function HistoryPage() {
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
              alt="Prettyful"
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
            <p className="mb-5 text-[11px] font-bold tracking-[0.4em] text-gray-400">COMPANY HISTORY</p>
          </Reveal>
          <Reveal delay={200}>
            <h1 className="text-[36px] font-black leading-[1.15] tracking-tight md:text-[56px]">
              <span className="text-gray-900">프리티풀</span>{' '}
              <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">연혁</span>
            </h1>
          </Reveal>
          <Reveal delay={400}>
            <p className="mx-auto mt-4 max-w-[460px] text-[15px] leading-relaxed text-gray-400">
              프리티풀의 발자취를 확인해보세요
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══ Timeline ═══════════════════════════════════════════ */}
      <section className="py-24">
        <div className="mx-auto max-w-[800px] px-6">
          {HISTORY.map((yearGroup, yi) => (
            <div key={yearGroup.year} className="relative">
              {/* Year Label */}
              <Reveal delay={yi * 100}>
                <div className="flex items-center gap-4 mb-10">
                  <div className="flex items-center justify-center w-[80px] h-[80px] md:w-[100px] md:h-[100px] rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-200/50">
                    <span className="text-[28px] md:text-[36px] font-black text-white">{yearGroup.year}</span>
                  </div>
                  <div className="h-px flex-1 bg-gray-100" />
                </div>
              </Reveal>

              {/* Events */}
              <div className="relative ml-[38px] md:ml-[48px] border-l-2 border-gray-100 pl-8 md:pl-10 pb-16 space-y-8">
                {yearGroup.events.map((event, ei) => (
                  <Reveal key={ei} delay={yi * 100 + ei * 80}>
                    <div className="relative group">
                      {/* Timeline dot */}
                      <div className="absolute -left-[41px] md:-left-[45px] top-1.5 w-3 h-3 rounded-full bg-blue-500 border-[3px] border-white shadow-sm group-hover:scale-125 transition-transform" />

                      <div className="border border-gray-100 rounded-2xl p-6 transition-all hover:border-gray-200 hover:shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-[12px] font-bold text-blue-500 bg-blue-50 px-2.5 py-1 rounded-full">
                            {yearGroup.year}.{event.month}
                          </span>
                        </div>
                        <h3 className="text-[17px] font-bold text-gray-900">{event.title}</h3>
                        <p className="mt-2 text-[14px] leading-relaxed text-gray-400">{event.desc}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          ))}

          {/* Future */}
          <Reveal>
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center justify-center w-[80px] h-[80px] md:w-[100px] md:h-[100px] rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300 border-2 border-dashed border-gray-300">
                <span className="text-[16px] md:text-[18px] font-black text-gray-400">NEXT</span>
              </div>
              <div className="flex-1">
                <p className="text-[16px] font-bold text-gray-300">더 큰 도약을 준비하고 있습니다</p>
                <p className="text-[13px] text-gray-300 mt-1">프리티풀의 다음 이야기를 기대해주세요</p>
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
              <p className="text-[16px] font-black text-gray-900">Prettyful</p>
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
