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
  address: '서울특별시 종로구 율곡로 294, 2층(종로6가)',
  email: 'freetiful2025@gmail.com',
};

const BENEFITS = [
  { icon: <Clock className="h-5 w-5" />, title: '유연근무제', desc: '자율 출퇴근, 리모트 워크 가능', color: 'bg-blue-50 text-blue-500' },
  { icon: <Heart className="h-5 w-5" />, title: '건강 지원', desc: '종합건강검진, 심리상담 지원', color: 'bg-rose-50 text-rose-500' },
  { icon: <Star className="h-5 w-5" />, title: '성장 지원', desc: '도서비, 컨퍼런스, 교육비 전액 지원', color: 'bg-amber-50 text-amber-500' },
  { icon: <Zap className="h-5 w-5" />, title: '최신 장비', desc: '맥북 프로, 모니터 등 원하는 장비 지급', color: 'bg-violet-50 text-violet-500' },
  { icon: <Users className="h-5 w-5" />, title: '팀 문화', desc: '수평적 소통, 분기별 팀 워크샵', color: 'bg-emerald-50 text-emerald-500' },
  { icon: <Briefcase className="h-5 w-5" />, title: '보상 체계', desc: '성과 기반 인센티브, 스톡옵션 제도', color: 'bg-cyan-50 text-cyan-500' },
];

const POSITIONS = [
  {
    category: '개발',
    icon: <Code className="h-5 w-5" />,
    color: 'bg-blue-50 text-blue-500',
    roles: [
      { title: '프론트엔드 개발자', type: '정규직', location: '서울', desc: 'React/Next.js 기반 프리티풀 웹·앱 개발' },
      { title: '백엔드 개발자', type: '정규직', location: '서울', desc: 'Node.js/NestJS 기반 API 및 매칭 시스템 개발' },
      { title: 'AI/ML 엔지니어', type: '정규직', location: '서울/리모트', desc: 'AI 기반 전문가 매칭 알고리즘 고도화' },
    ],
  },
  {
    category: '마케팅',
    icon: <Megaphone className="h-5 w-5" />,
    color: 'bg-rose-50 text-rose-500',
    roles: [
      { title: '그로스 마케터', type: '정규직', location: '서울', desc: '유저 획득·리텐션 전략 수립 및 실행' },
      { title: '콘텐츠 마케터', type: '정규직/인턴', location: '서울', desc: 'SNS 채널 운영 및 브랜드 콘텐츠 기획' },
    ],
  },
  {
    category: '디자인',
    icon: <Palette className="h-5 w-5" />,
    color: 'bg-violet-50 text-violet-500',
    roles: [
      { title: '프로덕트 디자이너', type: '정규직', location: '서울', desc: '프리티풀 앱·웹 UX/UI 설계 및 디자인 시스템 구축' },
    ],
  },
  {
    category: '운영',
    icon: <Headphones className="h-5 w-5" />,
    color: 'bg-emerald-50 text-emerald-500',
    roles: [
      { title: '전문가 매니저', type: '정규직', location: '서울', desc: '진행자 온보딩, 품질 관리, 파트너십 운영' },
      { title: '고객 경험 매니저', type: '정규직', location: '서울', desc: '고객 문의 대응 및 서비스 품질 개선' },
    ],
  },
];

const VALUES = [
  { num: '01', title: '신뢰를 설계합니다', desc: '검증되지 않은 것은 연결하지 않습니다. 시스템으로 신뢰를 만들어갑니다.' },
  { num: '02', title: '고객의 순간에 집중합니다', desc: '결혼식, 기업행사 — 누군가에게는 인생에서 가장 중요한 순간입니다.' },
  { num: '03', title: '함께 성장합니다', desc: '프리랜서 진행자가 안정적으로 성장할 수 있는 생태계를 만듭니다.' },
  { num: '04', title: '빠르게 실행합니다', desc: '완벽한 계획보다 빠른 실행과 학습을 통해 더 나은 서비스를 만듭니다.' },
];

/* ─── Page ─────────────────────────────────────────────────── */
export default function CareersPage() {
  const [scrollY, setScrollY] = useState(0);
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
      toast.error('필수 항목을 입력해주세요');
      return;
    }
    setSending(true);
    await new Promise((r) => setTimeout(r, 1000));
    toast.success('지원서가 접수되었습니다. 검토 후 연락드리겠습니다.');
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

          <nav className={`hidden items-center gap-1 md:flex transition-all duration-700 ${scrollY > 80 ? 'gap-0' : 'gap-1'}`}>
            {['문화', '채용공고', '복지', '지원하기'].map((n) => (
              <button
                key={n}
                onClick={() => scrollTo(n)}
                className={`font-medium rounded-full transition-all text-gray-400 hover:text-gray-700 ${
                  scrollY > 80 ? 'text-[11px] px-2.5 py-1.5' : 'text-[13px] px-4 py-2'
                }`}
              >
                {n}
              </button>
            ))}
            <Link
              href="/biz"
              className={`font-medium rounded-full transition-all text-gray-400 hover:text-gray-700 ${
                scrollY > 80 ? 'text-[11px] px-2.5 py-1.5' : 'text-[13px] px-4 py-2'
              }`}
            >
              회사소개
            </Link>
          </nav>

          <button
            onClick={() => scrollTo('지원하기')}
            className={`bg-gray-900 font-bold text-white rounded-full transition-all hover:bg-gray-800 active:scale-95 ${
              scrollY > 80 ? 'text-[11px] px-4 py-1.5' : 'text-[13px] px-5 py-2'
            }`}
          >
            지원하기
          </button>
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
            <p className="mb-5 text-[11px] font-bold tracking-[0.4em] text-gray-300">JOIN FREETIFUL</p>
          </Reveal>
          <Reveal delay={200}>
            <h1 className="text-[40px] font-black leading-[1.1] tracking-tight md:text-[72px]">
              <span className="text-gray-900">소중한 순간을 만드는</span><br />
              <span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">사람들을 찾습니다</span>
            </h1>
          </Reveal>
          <Reveal delay={400}>
            <p className="mx-auto mt-6 max-w-[480px] text-[15px] leading-relaxed text-gray-400">
              전국 1,000여 명의 전문 진행자와 함께하는<br />
              프리랜서 진행자 매칭 플랫폼, 프리티풀에서 함께 성장하세요.
            </p>
          </Reveal>
          <Reveal delay={600}>
            <div className="mt-10 flex justify-center gap-3">
              <button onClick={() => scrollTo('채용공고')} className="bg-gray-900 px-8 py-3.5 text-[14px] font-bold text-white rounded-full transition-all hover:bg-gray-800 active:scale-95">
                채용공고 보기
              </button>
              <button onClick={() => scrollTo('문화')} className="border border-gray-200 px-8 py-3.5 text-[14px] font-bold text-gray-500 rounded-full transition-all hover:border-gray-300 hover:text-gray-800 hover:bg-gray-50">
                우리 문화 알아보기
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
          <Reveal><p className="text-[11px] font-bold tracking-[0.4em] text-violet-500">OUR VALUES</p></Reveal>
          <Reveal delay={100}>
            <h2 className="mt-3 text-[34px] font-black tracking-tight md:text-[42px]">
              프리티풀이<br />일하는 방식
            </h2>
          </Reveal>

          <div className="mt-14 space-y-4">
            {VALUES.map((v, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="group flex items-start gap-8 border border-gray-100 rounded-2xl p-8 transition-all hover:border-gray-200 hover:shadow-sm">
                  <span className="text-[40px] font-black text-violet-100 shrink-0 w-[60px] transition-colors group-hover:text-violet-200">{v.num}</span>
                  <div className="pt-2">
                    <h3 className="text-[20px] font-bold text-gray-900">{v.title}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-gray-400">{v.desc}</p>
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
          <Reveal><p className="text-[11px] font-bold tracking-[0.4em] text-violet-500">OPEN POSITIONS</p></Reveal>
          <Reveal delay={100}>
            <h2 className="mt-3 text-[34px] font-black tracking-tight md:text-[42px]">
              채용 중인 포지션
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
          <Reveal><p className="text-[11px] font-bold tracking-[0.4em] text-violet-500">BENEFITS</p></Reveal>
          <Reveal delay={100}>
            <h2 className="mt-3 text-[34px] font-black tracking-tight md:text-[42px]">
              함께하면 누리는 것들
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((item, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="group border border-gray-100 rounded-2xl p-6 transition-all duration-300 hover:border-gray-200 hover:shadow-sm">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${item.color} transition-transform duration-300 group-hover:scale-110`}>{item.icon}</div>
                  <h3 className="mt-4 text-[17px] font-bold text-gray-900">{item.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-gray-400">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 지원하기 ═══════════════════════════════════════════ */}
      <section id="지원하기" className="py-28 bg-gray-50/60">
        <div className="mx-auto max-w-[600px] px-6">
          <Reveal><p className="text-[11px] font-bold tracking-[0.4em] text-violet-500">APPLY</p></Reveal>
          <Reveal delay={100}><h2 className="mt-3 text-[34px] font-black">지원하기</h2></Reveal>
          <Reveal delay={150}><p className="mt-3 text-[14px] text-gray-400">프리티풀과 함께 성장할 인재를 기다립니다</p></Reveal>

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
                <input className="h-12 w-full border border-gray-200 rounded-xl bg-white px-4 text-[14px] text-gray-900 outline-none transition-all placeholder-gray-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-50" placeholder="이름 *" value={apply.name} onChange={(e) => setApply({ ...apply, name: e.target.value })} required />
                <input className="h-12 w-full border border-gray-200 rounded-xl bg-white px-4 text-[14px] text-gray-900 outline-none transition-all placeholder-gray-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-50" placeholder="연락처" value={apply.phone} onChange={(e) => setApply({ ...apply, phone: e.target.value })} />
              </div>
              <input className="h-12 w-full border border-gray-200 rounded-xl bg-white px-4 text-[14px] text-gray-900 outline-none transition-all placeholder-gray-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-50" placeholder="이메일 *" type="email" value={apply.email} onChange={(e) => setApply({ ...apply, email: e.target.value })} required />
              {!selectedRole && (
                <select
                  value={apply.position}
                  onChange={(e) => setApply({ ...apply, position: e.target.value })}
                  className="h-12 w-full border border-gray-200 rounded-xl bg-white px-4 text-[14px] text-gray-900 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-50"
                >
                  <option value="">지원 포지션 선택</option>
                  {POSITIONS.flatMap((d) => d.roles.map((r) => (
                    <option key={`${d.category}-${r.title}`} value={`[${d.category}] ${r.title}`}>[{d.category}] {r.title}</option>
                  )))}
                  <option value="기타">기타 / 열린 지원</option>
                </select>
              )}
              <textarea className="h-32 w-full resize-none border border-gray-200 rounded-xl bg-white px-4 py-3 text-[14px] text-gray-900 outline-none transition-all placeholder-gray-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-50" placeholder="자기소개 및 지원동기 *" value={apply.message} onChange={(e) => setApply({ ...apply, message: e.target.value })} required />
              <button type="submit" disabled={sending} className="flex w-full items-center justify-center gap-2 bg-gray-900 py-3.5 text-[15px] font-bold text-white rounded-xl transition-all hover:bg-gray-800 active:scale-[0.98] disabled:opacity-50">
                <Send className="h-4 w-4" /> {sending ? '전송 중...' : '지원서 제출'}
              </button>
              <p className="text-[11px] text-gray-300 text-center">지원서 검토 후 영업일 기준 3~5일 내 연락드립니다</p>
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
              <p className="mt-1 text-[11px] text-gray-300">{COMPANY.name} | {COMPANY.address}</p>
              <p className="text-[10px] text-gray-200">Copyright &copy; Freetiful. All rights reserved.</p>
            </div>
            <div className="flex gap-4 text-[12px] text-gray-300">
              <Link href="/biz" className="transition-colors hover:text-gray-500">회사소개</Link>
              <Link href="/home" className="transition-colors hover:text-gray-500">홈으로</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
