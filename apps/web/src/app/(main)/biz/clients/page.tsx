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

/* ─── Clients Data ───────────────────────────────────────── */
const CLIENT_CATEGORIES = [
  { id: 'all', label: '전체' },
  { id: 'broadcast', label: '방송/미디어' },
  { id: 'corporate', label: '기업' },
  { id: 'wedding', label: '웨딩/이벤트' },
  { id: 'education', label: '교육/협회' },
  { id: 'public', label: '공공기관' },
];

const CLIENTS = [
  // 방송/미디어
  { name: 'KBS', category: 'broadcast', desc: '한국방송공사', color: 'from-red-500 to-rose-600' },
  { name: 'SBS', category: 'broadcast', desc: 'SBS 미디어그룹', color: 'from-blue-600 to-blue-700' },
  { name: 'MBC', category: 'broadcast', desc: '문화방송', color: 'from-green-500 to-emerald-600' },
  { name: 'tvN', category: 'broadcast', desc: 'CJ ENM', color: 'from-lime-500 to-green-600' },
  { name: 'JTBC', category: 'broadcast', desc: '중앙일보 미디어', color: 'from-sky-500 to-blue-600' },
  { name: 'YTN', category: 'broadcast', desc: '연합뉴스TV', color: 'from-red-600 to-red-700' },

  // 기업
  { name: '삼성전자', category: 'corporate', desc: '제품 런칭 이벤트', color: 'from-blue-500 to-indigo-600' },
  { name: '현대자동차', category: 'corporate', desc: '신차 발표회', color: 'from-slate-600 to-slate-800' },
  { name: 'LG전자', category: 'corporate', desc: '기업 세미나', color: 'from-red-500 to-pink-600' },
  { name: 'SK텔레콤', category: 'corporate', desc: '기술 컨퍼런스', color: 'from-red-500 to-rose-600' },
  { name: '카카오', category: 'corporate', desc: '기업 행사', color: 'from-yellow-500 to-amber-600' },
  { name: '네이버', category: 'corporate', desc: '개발자 컨퍼런스', color: 'from-green-500 to-emerald-600' },
  { name: '쿠팡', category: 'corporate', desc: '사내 이벤트', color: 'from-orange-500 to-red-500' },
  { name: '배달의민족', category: 'corporate', desc: '브랜드 행사', color: 'from-cyan-500 to-teal-600' },

  // 웨딩/이벤트
  { name: '더채플앳청담', category: 'wedding', desc: '프리미엄 웨딩홀', color: 'from-pink-400 to-rose-500' },
  { name: '그랜드하얏트', category: 'wedding', desc: '호텔 웨딩', color: 'from-amber-600 to-yellow-700' },
  { name: '신라호텔', category: 'wedding', desc: '호텔 행사', color: 'from-amber-500 to-orange-600' },
  { name: '롯데호텔', category: 'wedding', desc: '컨벤션 행사', color: 'from-red-500 to-rose-600' },
  { name: 'JW메리어트', category: 'wedding', desc: '국제 행사', color: 'from-slate-500 to-gray-700' },
  { name: '아모리스홀', category: 'wedding', desc: '웨딩 전문', color: 'from-violet-400 to-purple-500' },

  // 교육/협회
  { name: '한국아나운서협회', category: 'education', desc: '아나운서 교육 파트너', color: 'from-indigo-500 to-violet-600' },
  { name: '서울대학교', category: 'education', desc: '대학 행사', color: 'from-blue-600 to-blue-800' },
  { name: '연세대학교', category: 'education', desc: '학술 컨퍼런스', color: 'from-blue-500 to-indigo-600' },
  { name: '고려대학교', category: 'education', desc: '축제/행사', color: 'from-red-600 to-red-800' },
  { name: '한국MC협회', category: 'education', desc: 'MC 교육 파트너', color: 'from-teal-500 to-emerald-600' },

  // 공공기관
  { name: '서울특별시', category: 'public', desc: '시 주최 행사', color: 'from-blue-500 to-blue-700' },
  { name: '문화체육관광부', category: 'public', desc: '정부 행사', color: 'from-blue-600 to-indigo-700' },
  { name: '한국관광공사', category: 'public', desc: '관광 홍보 행사', color: 'from-green-500 to-teal-600' },
  { name: '대한상공회의소', category: 'public', desc: '비즈니스 포럼', color: 'from-slate-600 to-gray-700' },
  { name: '한국무역협회', category: 'public', desc: '전시/박람회', color: 'from-blue-500 to-cyan-600' },
];

/* ─── Page ─────────────────────────────────────────────────── */
export default function ClientsPage() {
  const [scrollY, setScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const filteredClients = activeCategory === 'all'
    ? CLIENTS
    : CLIENTS.filter((c) => c.category === activeCategory);

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
            <p className="mb-5 text-[11px] font-bold tracking-[0.4em] text-gray-400">OUR CLIENTS</p>
          </Reveal>
          <Reveal delay={200}>
            <h1 className="text-[36px] font-black leading-[1.15] tracking-tight md:text-[56px]">
              <span className="text-gray-900">함께하는 </span>
              <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">고객사</span>
            </h1>
          </Reveal>
          <Reveal delay={400}>
            <p className="mx-auto mt-4 max-w-[500px] text-[15px] leading-relaxed text-gray-400">
              대한민국 대표 기업, 기관, 방송사가 선택한<br />
              프리티풀의 전문 진행자 매칭 서비스
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══ Stats ═══════════════════════════════════════════════ */}
      <section className="py-16">
        <div className="mx-auto max-w-[900px] px-6">
          <Reveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { num: '500+', label: '누적 고객사' },
                { num: '2,000+', label: '진행 행사' },
                { num: '98%', label: '고객 만족도' },
                { num: '1,000+', label: '전문 진행자' },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <p className="text-[32px] md:text-[40px] font-black bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">{stat.num}</p>
                  <p className="mt-1 text-[13px] text-gray-400 font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ Client Grid ═══════════════════════════════════════ */}
      <section className="py-24 bg-gray-50/60">
        <div className="mx-auto max-w-[1100px] px-6">
          <Reveal>
            <p className="text-[11px] font-bold tracking-[0.4em] text-blue-500">PARTNERS</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="mt-3 text-[30px] font-black tracking-tight md:text-[38px]">주요 고객사</h2>
          </Reveal>

          {/* Category Tabs */}
          <Reveal delay={150}>
            <div className="flex flex-wrap gap-2 mt-10 mb-10">
              {CLIENT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 text-[13px] font-medium rounded-full transition-all ${
                    activeCategory === cat.id
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </Reveal>

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredClients.map((client, i) => (
              <Reveal key={`${activeCategory}-${client.name}`} delay={i * 40}>
                <div className="group bg-white border border-gray-100 rounded-2xl p-5 text-center transition-all duration-300 hover:border-gray-200 hover:shadow-md h-full flex flex-col items-center justify-center">
                  {/* Logo placeholder */}
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${client.color} flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110 shadow-sm`}>
                    <span className="text-[16px] font-black text-white leading-none">
                      {client.name.charAt(0)}
                    </span>
                  </div>
                  <p className="text-[14px] font-bold text-gray-900">{client.name}</p>
                  <p className="mt-1 text-[11px] text-gray-400">{client.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Testimonials ═══════════════════════════════════════ */}
      <section className="py-24">
        <div className="mx-auto max-w-[900px] px-6">
          <Reveal>
            <p className="text-[11px] font-bold tracking-[0.4em] text-blue-500">TESTIMONIALS</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="mt-3 text-[30px] font-black tracking-tight md:text-[38px]">고객 후기</h2>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {[
              {
                quote: '프리티풀 덕분에 회사 송년회를 완벽하게 진행할 수 있었습니다. 전문 MC의 진행이 행사의 품격을 한층 높여주었습니다.',
                author: '김OO',
                role: '대기업 인사팀 과장',
                company: '삼성전자',
              },
              {
                quote: '결혼식 사회자를 고민하다가 프리티풀을 알게 되었어요. AI 매칭으로 딱 맞는 분을 만나 최고의 결혼식이 되었습니다.',
                author: '이OO',
                role: '신부',
                company: '웨딩 고객',
              },
              {
                quote: '신제품 런칭 이벤트에 전문 쇼호스트를 섭외했는데, 기대 이상이었습니다. 매칭부터 행사 당일까지 매니저 분의 케어가 훌륭했습니다.',
                author: '박OO',
                role: '마케팅 팀장',
                company: 'IT기업',
              },
              {
                quote: '학술 컨퍼런스 진행자를 급하게 구해야 했는데, 프리티풀에서 하루 만에 완벽한 분을 매칭해주셨습니다. 정말 감사합니다.',
                author: '최OO',
                role: '학회 사무국장',
                company: '대학 연구기관',
              },
            ].map((t, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="border border-gray-100 rounded-2xl p-7 transition-all hover:border-gray-200 hover:shadow-sm h-full flex flex-col">
                  <div className="text-[28px] text-blue-200 font-serif leading-none mb-3">&ldquo;</div>
                  <p className="text-[14px] leading-[1.8] text-gray-500 flex-1">{t.quote}</p>
                  <div className="mt-5 pt-4 border-t border-gray-50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                      <span className="text-[13px] font-bold text-gray-500">{t.author.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-gray-900">{t.author}</p>
                      <p className="text-[11px] text-gray-400">{t.role} · {t.company}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══════════════════════════════════════════════ */}
      <section className="py-24 bg-gray-50/60">
        <div className="mx-auto max-w-[600px] px-6 text-center">
          <Reveal>
            <h2 className="text-[28px] font-black tracking-tight md:text-[36px]">
              프리티풀과 함께<br />
              <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">성공적인 행사를 만들어보세요</span>
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="mt-4 text-[14px] text-gray-400 leading-relaxed">
              검증된 전문 진행자와의 맞춤 매칭으로<br />
              어떤 행사든 완벽하게 만들어 드립니다.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <Link
                href="/biz#문의폼"
                className="inline-flex items-center justify-center gap-2 bg-gray-900 px-8 py-3.5 text-[14px] font-bold text-white rounded-full transition-all hover:bg-gray-800 active:scale-95"
              >
                기업 문의하기
              </Link>
              <Link
                href="/biz"
                className="inline-flex items-center justify-center gap-2 border border-gray-200 px-8 py-3.5 text-[14px] font-bold text-gray-500 rounded-full transition-all hover:border-gray-300 hover:text-gray-800 hover:bg-gray-50"
              >
                회사소개 보기
              </Link>
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
