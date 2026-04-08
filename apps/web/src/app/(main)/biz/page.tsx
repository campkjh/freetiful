'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ChevronRight, Shield, BarChart3, Users, Building2,
  CheckCircle, Award, Download, MapPin, Phone, Mail,
  Clock, FileText, Send, User, Briefcase, Globe,
  Target, Heart, Star, Zap, X,
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ─── Scroll-Reveal 훅 ─────────────────────────────────────── */
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

/* ─── CountUp 애니메이션 ───────────────────────────────────── */
function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const { ref, visible } = useReveal();
  useEffect(() => {
    if (!visible) return;
    const dur = 1500;
    const st = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - st) / dur);
      setVal(Math.round(target * p));
      if (p < 1) requestAnimationFrame(tick);
    };
    tick();
  }, [visible, target]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

/* ─── Constants ────────────────────────────────────────────── */
const ACCENT = '#3180F7';

const COMPANY_INFO = {
  name: '주식회사 프리티풀',
  nameEn: 'Freetiful Inc.',
  ceo: '김정훈',
  established: '2024년 3월',
  business: '행사 전문가 매칭 플랫폼',
  employees: '15명',
  address: '서울특별시 강남구 테헤란로 123, 프리티풀 빌딩 8층',
  phone: '02-1234-5678',
  email: 'contact@freetiful.co.kr',
};

const NAV_SECTIONS = ['회사소개', '핵심서비스', '연혁', '자료실', '오시는길', '문의'];

const HISTORY = [
  { year: '2026', events: ['AI 매칭 시스템 v2.0 출시', '누적 매칭 10,000건 달성', '시리즈 A 투자 유치'] },
  { year: '2025', events: ['모바일 앱 출시', '전문가 500명 등록', '부산/대구 지역 서비스 확대'] },
  { year: '2024', events: ['프리티풀 서비스 정식 런칭', '웨딩 MC 매칭 서비스 시작', '법인 설립'] },
];

/* ─── Page ─────────────────────────────────────────────────── */
export default function BizPage() {
  const [activeSection, setActiveSection] = useState('회사소개');
  const [inquiry, setInquiry] = useState({ company: '', name: '', phone: '', email: '', type: '', message: '' });
  const [sending, setSending] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  function scrollTo(id: string) {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleInquiry(e: React.FormEvent) {
    e.preventDefault();
    if (!inquiry.name || !inquiry.phone || !inquiry.message) {
      toast.error('필수 항목을 입력해주세요');
      return;
    }
    setSending(true);
    await new Promise((r) => setTimeout(r, 1000));
    toast.success('문의가 접수되었습니다. 1~2영업일 내 연락드리겠습니다.');
    setInquiry({ company: '', name: '', phone: '', email: '', type: '', message: '' });
    setSending(false);
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden -mx-4 lg:-mx-8">

      {/* ─── Sticky Section Nav ────────────────────────────────── */}
      <div className={`sticky top-0 lg:top-[72px] z-40 transition-all duration-500 ${scrollY > 100 ? 'bg-black/70 backdrop-blur-2xl border-b border-white/5' : 'bg-transparent'}`}>
        <div className="mx-auto max-w-[1100px] px-6">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-3">
            {NAV_SECTIONS.map((n) => (
              <button
                key={n}
                onClick={() => scrollTo(n)}
                className={`shrink-0 text-[12px] font-medium px-4 py-2 rounded-full transition-all ${
                  activeSection === n
                    ? 'bg-white/10 text-white'
                    : 'text-white/30 hover:text-white/60'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ Hero ═══════════════════════════════════════════════ */}
      <section className="relative flex min-h-[85vh] items-center justify-center">
        {/* 그라데이션 배경 */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#3180F7]/8 via-transparent to-violet-500/5" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#3180F7]/5 rounded-full blur-[120px]" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#050505]" />

        <div className="relative z-10 text-center px-6">
          <Reveal>
            <p className="mb-4 text-[11px] font-bold tracking-[0.4em] text-white/25">EVENT EXPERT MATCHING PLATFORM</p>
          </Reveal>
          <Reveal delay={200}>
            <h1 className="text-[40px] font-black leading-[1.1] tracking-tight md:text-[68px]">
              <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">모든 행사의 순간을</span><br />
              <span className="bg-gradient-to-r from-[#3180F7] to-[#82b1ff] bg-clip-text text-transparent">완벽하게</span>
            </h1>
          </Reveal>
          <Reveal delay={400}>
            <p className="mx-auto mt-6 max-w-[480px] text-[15px] leading-relaxed text-white/30">
              검증된 MC · 가수 · 쇼호스트와 AI 기반 맞춤 매칭으로<br />
              기업 행사부터 웨딩까지, 최고의 경험을 만듭니다.
            </p>
          </Reveal>
          <Reveal delay={600}>
            <div className="mt-10 flex justify-center gap-3">
              <button onClick={() => scrollTo('문의')} className="bg-white px-8 py-3.5 text-[14px] font-bold text-black transition-all hover:bg-white/90 active:scale-95">
                기업 문의하기
              </button>
              <button onClick={() => scrollTo('핵심서비스')} className="border border-white/15 px-8 py-3.5 text-[14px] font-bold text-white/50 transition-all hover:bg-white/5 hover:text-white">
                서비스 알아보기
              </button>
            </div>
          </Reveal>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronRight className="h-5 w-5 rotate-90 text-white/15" />
        </div>
      </section>

      {/* ═══ 회사소개 ═══════════════════════════════════════════ */}
      <section id="회사소개" className="border-t border-white/5 py-28">
        <div className="mx-auto max-w-[1100px] px-6">
          <Reveal><p className="text-[11px] font-bold tracking-[0.4em] text-[#3180F7]">ABOUT US</p></Reveal>
          <Reveal delay={100}>
            <h2 className="mt-3 text-[34px] font-black tracking-tight md:text-[40px]">
              행사 전문가와 고객을<br />한 번에 연결합니다
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-6 max-w-[600px] text-[15px] leading-[1.9] text-white/35">
              프리티풀은 &ldquo;모든 행사의 순간을 완벽하게&rdquo;라는 철학 아래, 검증된 행사 전문가와
              고객을 AI 기반으로 매칭하는 플랫폼입니다. 웨딩 MC, 기업 행사, 쇼호스트까지 —
              모든 특별한 순간에 최적의 전문가를 연결합니다.
            </p>
          </Reveal>

          {/* CEO 인사말 */}
          <Reveal delay={300}>
            <div className="mt-16 border border-white/8 bg-white/[0.02] p-8 md:flex md:items-start md:gap-8">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center bg-[#3180F7]/10 mb-6 md:mb-0">
                <User className="h-10 w-10 text-[#3180F7]" />
              </div>
              <div>
                <p className="text-[11px] font-bold tracking-[0.3em] text-white/20 mb-3">CEO MESSAGE</p>
                <p className="text-[15px] leading-[1.9] text-white/40">
                  프리티풀은 모든 분의 특별한 순간을 더욱 빛나게 만들어 드리기 위해 탄생했습니다.
                  검증된 전문가와 AI 기반 맞춤 매칭으로, 최고의 행사 경험을 약속드립니다.
                  앞으로도 신뢰와 혁신으로 대한민국 최고의 행사 전문가 플랫폼이 되겠습니다.
                </p>
                <p className="mt-4 text-[14px] font-bold">대표이사 {COMPANY_INFO.ceo}</p>
              </div>
            </div>
          </Reveal>

          {/* 핵심 수치 */}
          <div className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { num: 10000, suffix: '+', label: '누적 매칭', icon: <Star className="h-4 w-4" /> },
              { num: 500, suffix: '+', label: '등록 전문가', icon: <Users className="h-4 w-4" /> },
              { num: 4.9, suffix: '/5', label: '고객 만족도', icon: <Heart className="h-4 w-4" /> },
              { num: 92, suffix: '%', label: '재이용률', icon: <Zap className="h-4 w-4" /> },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="border border-white/8 bg-white/[0.02] p-5 transition-all hover:border-white/15 hover:bg-white/[0.04]">
                  <div className="flex items-center gap-2 text-white/20 mb-3">{s.icon}<span className="text-[10px] tracking-wider">{s.label}</span></div>
                  <p className="text-[28px] font-black text-white">
                    {s.num >= 100 ? <CountUp target={s.num} suffix={s.suffix} /> : <>{s.num}{s.suffix}</>}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* 미션 / 비전 / 핵심가치 */}
          <div className="mt-16 grid gap-4 md:grid-cols-3">
            {[
              { icon: <Target className="h-6 w-6" />, title: '미션', desc: '모든 행사의 순간을 완벽하게 만드는 전문가 매칭 플랫폼' },
              { icon: <Globe className="h-6 w-6" />, title: '비전', desc: '대한민국 No.1 행사 전문가 플랫폼으로 성장' },
              { icon: <Heart className="h-6 w-6" />, title: '핵심가치', desc: '신뢰 · 전문성 · 혁신 · 고객중심' },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="group border border-white/8 p-6 transition-all duration-300 hover:border-[#3180F7]/30 hover:bg-[#3180F7]/[0.03]">
                  <div className="flex h-12 w-12 items-center justify-center bg-[#3180F7]/10 text-[#3180F7] transition-transform duration-300 group-hover:scale-110">{item.icon}</div>
                  <h3 className="mt-4 text-[17px] font-bold">{item.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/35">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* 기업 정보 테이블 */}
          <Reveal delay={100}>
            <div className="mt-16 border border-white/8 overflow-hidden">
              {[
                ['회사명', COMPANY_INFO.name],
                ['영문명', COMPANY_INFO.nameEn],
                ['대표이사', COMPANY_INFO.ceo],
                ['설립일', COMPANY_INFO.established],
                ['사업분야', COMPANY_INFO.business],
                ['임직원수', COMPANY_INFO.employees],
                ['주소', COMPANY_INFO.address],
                ['대표전화', COMPANY_INFO.phone],
                ['이메일', COMPANY_INFO.email],
              ].map(([label, value], i) => (
                <div key={label} className={`flex px-6 py-4 ${i > 0 ? 'border-t border-white/5' : ''}`}>
                  <span className="text-[13px] font-bold text-white/25 w-[90px] shrink-0">{label}</span>
                  <span className="text-[13px] text-white/60">{value}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 핵심서비스 ═══════════════════════════════════════ */}
      <section id="핵심서비스" className="border-t border-white/5 py-28 bg-white/[0.01]">
        <div className="mx-auto max-w-[1100px] px-6">
          <Reveal><p className="text-[11px] font-bold tracking-[0.4em] text-[#3180F7]">CORE SERVICES</p></Reveal>
          <Reveal delay={100}>
            <h2 className="mt-3 text-[34px] font-black tracking-tight md:text-[40px]">
              전문가 매칭의<br />모든 것을 한곳에서
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {[
              { icon: <Users className="h-6 w-6" />, title: '검증된 전문가 네트워크', desc: '엄격한 심사를 거친 MC, 가수, 쇼호스트가 등록되어 있습니다. 경력, 전문분야, 고객 후기를 기반으로 검증된 전문가만 활동합니다.', color: '#3180F7' },
              { icon: <Shield className="h-6 w-6" />, title: '안전한 에스크로 결제', desc: '행사 완료까지 결제금을 안전하게 보호합니다. 고객과 전문가 모두가 안심할 수 있는 거래 환경을 제공합니다.', color: '#22c55e' },
              { icon: <BarChart3 className="h-6 w-6" />, title: 'AI 맞춤 매칭', desc: '행사 유형, 규모, 예산, 스타일 등 조건을 분석하여 최적의 전문가를 자동 추천합니다.', color: '#a855f7' },
              { icon: <Award className="h-6 w-6" />, title: '품질 보증 시스템', desc: '만족도 기반 전문가 등급 시스템으로 일관된 서비스 품질을 보장합니다. 불만족 시 재매칭을 지원합니다.', color: '#f59e0b' },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="group border border-white/8 p-7 transition-all duration-300 hover:border-white/15 hover:bg-white/[0.02]">
                  <div className="flex h-14 w-14 items-center justify-center transition-transform duration-300 group-hover:scale-110" style={{ background: `${item.color}15`, color: item.color }}>
                    {item.icon}
                  </div>
                  <h3 className="mt-5 text-[18px] font-bold">{item.title}</h3>
                  <p className="mt-2 text-[13px] leading-[1.8] text-white/35">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Before / After */}
          <Reveal delay={100}>
            <h3 className="mt-20 text-[11px] font-bold tracking-[0.4em] text-white/20">PROBLEM → SOLUTION</h3>
          </Reveal>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {[
              { before: '행사 전문가 직접 검색, 비교에 수일 소요', after: 'AI 기반 조건 분석으로 즉시 매칭' },
              { before: '비용 불투명, 사전 협의 어려움', after: '투명한 견적, 에스크로 결제로 안전 보장' },
              { before: '전문가 실력 검증 어려움', after: '경력·후기·등급 기반 검증 시스템' },
              { before: '행사 후 불만족 시 대처 불가', after: '품질 보증 및 재매칭 지원' },
            ].map((p, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="flex border border-white/8 overflow-hidden">
                  <div className="flex-1 bg-red-500/5 p-4 border-r border-white/5">
                    <p className="text-[10px] font-bold text-red-400/50 mb-1">BEFORE</p>
                    <p className="text-[13px] text-white/35">{p.before}</p>
                  </div>
                  <div className="flex-1 bg-[#3180F7]/5 p-4">
                    <p className="text-[10px] font-bold text-[#3180F7]/50 mb-1">AFTER</p>
                    <p className="text-[13px] text-white/55">{p.after}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 연혁 ═══════════════════════════════════════════════ */}
      <section id="연혁" className="border-t border-white/5 py-28">
        <div className="mx-auto max-w-[1000px] px-6">
          <Reveal><p className="text-[11px] font-bold tracking-[0.4em] text-[#3180F7]">MILESTONES</p></Reveal>
          <Reveal delay={100}><h2 className="mt-3 text-[34px] font-black tracking-tight">성장의 발자취</h2></Reveal>

          <div className="mt-14 space-y-6">
            {HISTORY.map((h, hi) => (
              <Reveal key={h.year} delay={hi * 120}>
                <div className="flex items-start gap-8 border-l-2 border-[#3180F7] pl-8 py-3 transition-all hover:pl-10">
                  <span className="text-[36px] font-black text-[#3180F7]/20 shrink-0 w-[80px]">{h.year}</span>
                  <div className="space-y-3 pt-2">
                    {h.events.map((event, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <CheckCircle className="h-4 w-4 shrink-0 text-[#3180F7]/40" />
                        <span className="text-[14px] text-white/50">{event}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Roadmap */}
          <Reveal delay={100}>
            <h3 className="mt-20 text-[11px] font-bold tracking-[0.4em] text-white/20">ROADMAP</h3>
          </Reveal>
          <div className="mt-6 space-y-4">
            {[
              { phase: '01', title: '전문가 매칭 플랫폼 고도화', desc: 'AI 매칭 정확도 향상, 전문가 카테고리 확장' },
              { phase: '02', title: '전국 서비스 확대', desc: '수도권 중심에서 전국 서비스 커버리지 확장' },
              { phase: '03', title: '종합 행사 솔루션', desc: '기획·공간·전문가·장비까지 원스톱 행사 플랫폼으로 진화' },
            ].map((p, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="flex items-start gap-6 border border-white/8 p-6 transition-all hover:border-white/15 hover:bg-white/[0.02]">
                  <span className="text-[32px] font-black text-[#3180F7]/15">{p.phase}</span>
                  <div>
                    <h3 className="text-[16px] font-bold">{p.title}</h3>
                    <p className="mt-1 text-[13px] text-white/30">{p.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 자료실 ═══════════════════════════════════════════ */}
      <section id="자료실" className="border-t border-white/5 py-28 bg-white/[0.01]">
        <div className="mx-auto max-w-[1000px] px-6">
          <Reveal><p className="text-[11px] font-bold tracking-[0.4em] text-[#3180F7]">RESOURCES</p></Reveal>
          <Reveal delay={100}><h2 className="mt-3 text-[34px] font-black">자료실</h2></Reveal>

          <div className="mt-12 grid gap-3 md:grid-cols-2">
            {[
              { icon: <FileText className="h-5 w-5" />, title: '회사소개서', desc: 'PDF · 5.2MB', action: () => toast('준비 중입니다') },
              { icon: <Download className="h-5 w-5" />, title: 'CI 가이드라인', desc: 'ZIP · 12.8MB', action: () => toast('준비 중입니다') },
              { icon: <FileText className="h-5 w-5" />, title: '서비스 이용가이드', desc: 'PDF · 3.1MB', action: () => toast('준비 중입니다') },
              { icon: <Briefcase className="h-5 w-5" />, title: '파트너 제안서', desc: 'PDF · 4.7MB', action: () => toast('준비 중입니다') },
              { icon: <Shield className="h-5 w-5" />, title: '개인정보처리방침', desc: '', action: () => setShowPrivacy(true) },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 80}>
                <button onClick={item.action} className="group flex w-full items-center gap-4 border border-white/8 p-5 text-left transition-all hover:border-[#3180F7]/30 hover:bg-[#3180F7]/[0.02]">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#3180F7]/10 text-[#3180F7] transition-transform group-hover:scale-110">{item.icon}</div>
                  <div className="flex-1"><p className="text-[15px] font-bold">{item.title}</p></div>
                  {item.desc && <span className="text-[11px] text-white/15">{item.desc}</span>}
                  <ChevronRight className="h-4 w-4 text-white/10 transition-transform group-hover:translate-x-1" />
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 오시는길 ═══════════════════════════════════════════ */}
      <section id="오시는길" className="border-t border-white/5 py-28">
        <div className="mx-auto max-w-[1000px] px-6">
          <Reveal><p className="text-[11px] font-bold tracking-[0.4em] text-[#3180F7]">LOCATION</p></Reveal>
          <Reveal delay={100}><h2 className="mt-3 text-[34px] font-black">오시는길</h2></Reveal>

          {/* 지도 영역 */}
          <Reveal delay={200}>
            <div className="mt-12 w-full h-[280px] border border-white/8 bg-white/[0.02] flex items-center justify-center">
              <div className="text-center">
                <MapPin className="h-8 w-8 text-white/10 mx-auto mb-2" />
                <p className="text-[13px] text-white/15">지도 영역</p>
              </div>
            </div>
          </Reveal>

          {/* 정보 카드 */}
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {[
              { icon: <MapPin className="h-5 w-5" />, label: '주소', value: COMPANY_INFO.address },
              { icon: <Phone className="h-5 w-5" />, label: '대표전화', value: COMPANY_INFO.phone },
              { icon: <Mail className="h-5 w-5" />, label: '이메일', value: COMPANY_INFO.email },
              { icon: <Clock className="h-5 w-5" />, label: '업무시간', value: '평일 09:00 - 18:00 (주말/공휴일 휴무)' },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="flex items-start gap-4 border border-white/8 p-5 transition-all hover:border-white/15">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#3180F7]/10 text-[#3180F7]">{item.icon}</div>
                  <div>
                    <p className="text-[11px] font-bold text-white/20">{item.label}</p>
                    <p className="mt-1 text-[14px] text-white/60">{item.value}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* 교통편 */}
          <Reveal delay={200}>
            <div className="mt-8 border border-white/8 p-6">
              <p className="text-[11px] font-bold tracking-[0.3em] text-white/20 mb-4">교통편 안내</p>
              <div className="space-y-3 text-[13px] text-white/40">
                <p><span className="text-[#3180F7] font-bold">지하철</span> — 2호선 강남역 3번 출구 도보 5분</p>
                <p><span className="text-emerald-400 font-bold">버스</span> — 강남역 정류장 하차 (146, 341, 360)</p>
                <p><span className="text-white/50 font-bold">주차</span> — 건물 지하 주차장 이용 (2시간 무료)</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 기업문의 ═══════════════════════════════════════════ */}
      <section id="문의" className="border-t border-white/5 py-28 bg-white/[0.01]">
        <div className="mx-auto max-w-[600px] px-6">
          <Reveal><p className="text-[11px] font-bold tracking-[0.4em] text-[#3180F7]">CONTACT</p></Reveal>
          <Reveal delay={100}><h2 className="mt-3 text-[34px] font-black">기업 문의</h2></Reveal>
          <Reveal delay={150}><p className="mt-3 text-[14px] text-white/30">제휴, 대량 의뢰, 기업 행사 등 문의해 주세요</p></Reveal>

          <Reveal delay={200}>
            <form onSubmit={handleInquiry} className="mt-10 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input className="h-12 w-full border border-white/8 bg-white/[0.03] px-4 text-[14px] text-white outline-none transition-all placeholder-white/15 focus:border-[#3180F7] focus:bg-[#3180F7]/[0.02]" placeholder="회사명" value={inquiry.company} onChange={(e) => setInquiry({ ...inquiry, company: e.target.value })} />
                <input className="h-12 w-full border border-white/8 bg-white/[0.03] px-4 text-[14px] text-white outline-none transition-all placeholder-white/15 focus:border-[#3180F7] focus:bg-[#3180F7]/[0.02]" placeholder="담당자명 *" value={inquiry.name} onChange={(e) => setInquiry({ ...inquiry, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className="h-12 w-full border border-white/8 bg-white/[0.03] px-4 text-[14px] text-white outline-none transition-all placeholder-white/15 focus:border-[#3180F7] focus:bg-[#3180F7]/[0.02]" placeholder="연락처 *" value={inquiry.phone} onChange={(e) => setInquiry({ ...inquiry, phone: e.target.value })} required />
                <input className="h-12 w-full border border-white/8 bg-white/[0.03] px-4 text-[14px] text-white outline-none transition-all placeholder-white/15 focus:border-[#3180F7] focus:bg-[#3180F7]/[0.02]" placeholder="이메일" value={inquiry.email} onChange={(e) => setInquiry({ ...inquiry, email: e.target.value })} />
              </div>
              <select
                value={inquiry.type}
                onChange={(e) => setInquiry({ ...inquiry, type: e.target.value })}
                className="h-12 w-full border border-white/8 bg-white/[0.03] px-4 text-[14px] text-white outline-none transition-all focus:border-[#3180F7] appearance-none"
              >
                <option value="" className="bg-[#111]">문의유형 선택</option>
                <option value="partnership" className="bg-[#111]">제휴 문의</option>
                <option value="enterprise" className="bg-[#111]">기업 행사 의뢰</option>
                <option value="bulk" className="bg-[#111]">대량 의뢰</option>
                <option value="advertisement" className="bg-[#111]">광고/마케팅</option>
                <option value="other" className="bg-[#111]">기타</option>
              </select>
              <textarea className="h-32 w-full resize-none border border-white/8 bg-white/[0.03] px-4 py-3 text-[14px] text-white outline-none transition-all placeholder-white/15 focus:border-[#3180F7]" placeholder="문의 내용 *" value={inquiry.message} onChange={(e) => setInquiry({ ...inquiry, message: e.target.value })} required />
              <button type="submit" disabled={sending} className="flex w-full items-center justify-center gap-2 bg-white py-3.5 text-[15px] font-bold text-black transition-all hover:bg-white/90 active:scale-[0.98] disabled:opacity-50">
                <Send className="h-4 w-4" /> {sending ? '전송 중...' : '문의하기'}
              </button>
              <p className="text-[11px] text-white/15 text-center">문의 접수 후 영업일 기준 1~2일 내 담당자가 연락드립니다</p>
            </form>
          </Reveal>
        </div>
      </section>

      {/* ═══ Footer ═══════════════════════════════════════════ */}
      <footer className="border-t border-white/5 py-12">
        <div className="mx-auto max-w-[1000px] px-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[16px] font-black">Prettyful <span className="text-white/20 font-normal text-[12px]">for Business</span></p>
              <p className="mt-1 text-[11px] text-white/15">{COMPANY_INFO.name} | 대표 {COMPANY_INFO.ceo} | T {COMPANY_INFO.phone} | E {COMPANY_INFO.email}</p>
              <p className="text-[10px] text-white/8">Copyright &copy; Freetiful Inc. All rights reserved.</p>
            </div>
            <div className="flex gap-4 text-[12px] text-white/20">
              <button onClick={() => setShowPrivacy(true)} className="transition-colors hover:text-white/40">개인정보처리방침</button>
            </div>
          </div>
        </div>
      </footer>

      {/* ═══ 개인정보처리방침 모달 ═══════════════════════════ */}
      {showPrivacy && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowPrivacy(false)}>
          <div className="relative w-full max-w-[700px] max-h-[80vh] overflow-auto bg-[#111] border border-white/10 p-8 animate-[scaleIn_0.2s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowPrivacy(false)} className="absolute top-4 right-4 text-white/20 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
            <h2 className="text-[22px] font-black mb-6">개인정보처리방침</h2>
            <div className="space-y-4 text-[13px] leading-[1.8] text-white/45">
              <p><strong className="text-white/80">제1조 (목적)</strong><br />주식회사 프리티풀(이하 &quot;회사&quot;)은 개인정보 보호법 제30조에 따라 정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 하기 위하여 다음과 같이 개인정보 처리방침을 수립·공개합니다.</p>
              <p><strong className="text-white/80">제2조 (수집하는 개인정보)</strong><br />필수항목: 이메일, 비밀번호 / 선택항목: 이름, 연락처, 프로필 사진 / 자동수집: 접속 IP, 접속 일시, 서비스 이용기록</p>
              <p><strong className="text-white/80">제3조 (처리목적)</strong><br />회원 가입 및 관리, 서비스 제공, 고객 문의 처리, 서비스 개선</p>
              <p><strong className="text-white/80">제4조 (보유·파기)</strong><br />개인정보 보유기간 경과 시 지체 없이 파기합니다.</p>
              <p><strong className="text-white/80">제5조 (제3자 제공)</strong><br />동의 없이 제3자에게 제공하지 않습니다. 법령에 의한 경우 예외.</p>
              <p><strong className="text-white/80">제6조 (안전성 확보)</strong><br />암호화, 접근 권한 관리, 접속기록 보관, 데이터 최소화 원칙 적용.</p>
              <p><strong className="text-white/80">제7조 (정보주체 권리)</strong><br />열람·정정·삭제·처리정지를 요구할 수 있습니다.</p>
              <p><strong className="text-white/80">제8조 (보호책임자)</strong><br />{COMPANY_INFO.ceo} / {COMPANY_INFO.phone} / {COMPANY_INFO.email}</p>
              <p className="text-white/15">시행일자: 2024년 3월 1일</p>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}
