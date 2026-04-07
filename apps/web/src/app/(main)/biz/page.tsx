'use client';

import Link from 'next/link';
import {
  ArrowRight, Shield, BarChart3, Users,
  CheckCircle2, Star, ChevronRight, Award,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Users,
    title: '검증된 전문가 네트워크',
    desc: '엄격한 심사를 거친 MC, 가수, 쇼호스트가 대기하고 있습니다.',
    color: 'from-blue-500 to-blue-600',
  },
  {
    icon: Shield,
    title: '안전한 에스크로 결제',
    desc: '행사 완료까지 결제금이 안전하게 보호됩니다.',
    color: 'from-emerald-500 to-emerald-600',
  },
  {
    icon: BarChart3,
    title: 'AI 맞춤 매칭',
    desc: '고객의 취향과 조건을 분석해 가장 적합한 전문가를 추천합니다.',
    color: 'from-violet-500 to-violet-600',
  },
];

const STATS = [
  { number: '2,400+', label: '등록 전문가' },
  { number: '98%', label: '고객 만족도' },
  { number: '15,000+', label: '성사된 매칭' },
  { number: '4.9', label: '평균 평점' },
];

const STEPS = [
  { step: '01', title: '견적 요청', desc: '원하는 행사 정보를 입력하면 AI가 조건을 분석합니다.' },
  { step: '02', title: '전문가 매칭', desc: '조건에 맞는 전문가 3~5명이 견적을 보내드립니다.' },
  { step: '03', title: '비교 & 선택', desc: '프로필, 리뷰, 가격을 비교하고 마음에 드는 전문가를 선택하세요.' },
  { step: '04', title: '안전한 결제', desc: '에스크로 결제로 행사 완료 확인 후 자동 정산됩니다.' },
];

const REVIEWS = [
  { name: '김서연', event: '결혼식', rating: 5, text: '김민준 MC님 덕분에 결혼식이 정말 특별했어요. 하객분들도 너무 좋아하셨습니다.', avatar: 'https://i.pravatar.cc/100?img=5' },
  { name: '이준호', event: '기업행사', rating: 5, text: '행사 진행이 매끄럽고 프로페셔널했습니다. 다음 행사도 꼭 프리티풀로!', avatar: 'https://i.pravatar.cc/100?img=11' },
  { name: '박지영', event: '돌잔치', rating: 5, text: '축가 가수분 목소리가 너무 좋아서 감동받았어요. 추천합니다!', avatar: 'https://i.pravatar.cc/100?img=9' },
];

export default function BizLandingPage() {
  return (
    <div className="bg-white min-h-screen -mx-[calc((100vw-100%)/2)] lg:mx-0">
      {/* ═══════════════════════════════════════════════════════════════════
         HERO — Dark navy, full viewport
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative bg-[#0B1426] text-white overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-[-30%] right-[-10%] w-[600px] h-[600px] rounded-full bg-primary-500/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] rounded-full bg-blue-400/8 blur-[100px]" />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 pt-24 pb-20 lg:pt-40 lg:pb-32">
          <div className="max-w-2xl">
            <p className="text-[12px] lg:text-[13px] uppercase tracking-[0.2em] text-primary-300 font-bold mb-6">
              Freetiful Biz
            </p>
            <h1 className="text-[32px] md:text-[48px] lg:text-[64px] font-black leading-[1.1] tracking-tight mb-6">
              당신의 행사를<br />
              <span className="bg-gradient-to-r from-primary-400 to-blue-300 bg-clip-text text-transparent">
                완벽하게
              </span>{' '}
              만들어줄<br />
              전문가를 만나보세요
            </h1>
            <p className="text-[15px] lg:text-[18px] text-gray-400 leading-relaxed mb-10 max-w-lg">
              웨딩 MC부터 축가 가수, 쇼호스트까지.<br />
              AI가 추천하는 검증된 전문가와 안전하게 거래하세요.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/match"
                className="inline-flex items-center justify-center gap-2 bg-primary-500 text-white text-[15px] font-bold px-8 py-4 rounded-2xl hover:bg-primary-400 active:scale-[0.98] hover:shadow-[0_0_40px_rgba(49,128,247,0.3)]"
                style={{ transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
              >
                무료로 견적 받기 <ArrowRight size={18} />
              </Link>
              <Link
                href="/pros"
                className="inline-flex items-center justify-center gap-2 bg-white/10 text-white text-[15px] font-semibold px-8 py-4 rounded-2xl border border-white/10 hover:bg-white/15 active:scale-[0.98]"
                style={{ transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
              >
                전문가 둘러보기
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
         STATS BAR
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-surface-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10 lg:py-14">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className="text-center opacity-0 animate-fade-in"
                style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'forwards' }}
              >
                <p className="text-[28px] lg:text-[36px] font-black text-gray-900 tracking-tight">{s.number}</p>
                <p className="text-[13px] text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
         FEATURES — 3 cards
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-32">
          <div className="text-center mb-14">
            <p className="eyebrow mb-3">WHY FREETIFUL</p>
            <h2 className="text-[24px] lg:text-[36px] font-black text-gray-900 tracking-tight leading-tight">
              프리티풀이<br className="lg:hidden" /> 특별한 이유
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="card-interactive p-7 lg:p-8 opacity-0 animate-fade-in"
                style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'forwards' }}
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-5`}>
                  <f.icon size={22} className="text-white" />
                </div>
                <h3 className="text-[17px] font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-[14px] text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
         HOW IT WORKS — Steps
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#F6FAFF]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-32">
          <div className="text-center mb-14">
            <p className="eyebrow mb-3">HOW IT WORKS</p>
            <h2 className="text-[24px] lg:text-[36px] font-black text-gray-900 tracking-tight">
              이렇게 진행돼요
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s, i) => (
              <div
                key={s.step}
                className="relative opacity-0 animate-fade-in"
                style={{ animationDelay: `${i * 120}ms`, animationFillMode: 'forwards' }}
              >
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px bg-gray-200" />
                )}
                <div className="bg-white rounded-3xl p-6 lg:p-7 text-center shadow-card">
                  <div className="w-14 h-14 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-[18px] font-black text-primary-500">{s.step}</span>
                  </div>
                  <h3 className="text-[16px] font-bold text-gray-900 mb-2">{s.title}</h3>
                  <p className="text-[13px] text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
         TRUST — Dark section with checkmarks
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#0B1426] text-white relative overflow-hidden">
        <div className="absolute top-[20%] right-[-5%] w-[300px] h-[300px] rounded-full bg-primary-500/8 blur-[80px]" />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-32">
          <div className="lg:flex items-center gap-16">
            <div className="flex-1 mb-12 lg:mb-0">
              <p className="text-[12px] uppercase tracking-[0.2em] text-primary-300 font-bold mb-4">SECURITY</p>
              <h2 className="text-[24px] lg:text-[36px] font-black leading-tight tracking-tight mb-6">
                안심하고 거래하세요
              </h2>
              <p className="text-[15px] text-gray-400 leading-relaxed mb-8 max-w-md">
                프리티풀은 고객과 전문가 모두를 위한 안전한 거래 환경을 제공합니다.
              </p>
              <div className="space-y-4">
                {[
                  '에스크로 결제로 행사 완료 전까지 결제금 보호',
                  '전문가 신원 확인 및 경력 검증 완료',
                  '행사 7일 전까지 전액 환불 보장',
                  '24시간 고객센터 운영',
                  '개인정보 암호화 및 보안 관리',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-[14px] text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 max-w-md mx-auto lg:mx-0">
              <div className="bg-white/5 rounded-3xl border border-white/10 p-6 lg:p-8 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                    <Shield size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold">에스크로 결제</p>
                    <p className="text-[12px] text-gray-500">결제금이 안전하게 보호됩니다</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="bg-white/5 rounded-2xl p-4 flex items-center justify-between">
                    <span className="text-[13px] text-gray-400">결제 금액</span>
                    <span className="text-[16px] font-bold">500,000원</span>
                  </div>
                  <div className="bg-emerald-500/10 rounded-2xl p-4 flex items-center justify-between border border-emerald-500/20">
                    <span className="text-[13px] text-emerald-300 flex items-center gap-1.5"><Shield size={14} /> 보호 상태</span>
                    <span className="text-[13px] font-bold text-emerald-400">안전하게 보관중</span>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 flex items-center justify-between">
                    <span className="text-[13px] text-gray-400">행사일</span>
                    <span className="text-[14px] font-semibold">2026.04.05</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
         REVIEWS
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-32">
          <div className="text-center mb-14">
            <p className="eyebrow mb-3">REVIEWS</p>
            <h2 className="text-[24px] lg:text-[36px] font-black text-gray-900 tracking-tight">
              고객님들의 실제 후기
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {REVIEWS.map((r, i) => (
              <div
                key={r.name}
                className="card p-6 lg:p-7 opacity-0 animate-fade-in"
                style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'forwards' }}
              >
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} size={16} className="fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-[14px] text-gray-700 leading-relaxed mb-5">&ldquo;{r.text}&rdquo;</p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <img src={r.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <p className="text-[13px] font-bold text-gray-900">{r.name}</p>
                    <p className="text-[11px] text-gray-400">{r.event}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
         FOR PROFESSIONALS — CTA
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-surface-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-28">
          <div className="card-bezel max-w-3xl mx-auto">
            <div className="card-bezel-inner bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 p-8 lg:p-12 text-white text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-60 h-60 bg-primary-500/10 rounded-full -translate-y-20 translate-x-20 blur-[60px]" />
              <div className="relative">
                <div className="w-14 h-14 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Award size={24} className="text-primary-400" />
                </div>
                <h2 className="text-[22px] lg:text-[28px] font-black tracking-tight mb-3">
                  전문가이신가요?
                </h2>
                <p className="text-[14px] lg:text-[16px] text-gray-400 leading-relaxed mb-8 max-w-md mx-auto">
                  프리티풀에 등록하고 더 많은 고객을 만나보세요.<br />
                  가입비 무료, 성사 수수료만 발생합니다.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    href="/pro-register"
                    className="inline-flex items-center justify-center gap-2 bg-primary-500 text-white text-[14px] font-bold px-8 py-3.5 rounded-2xl hover:bg-primary-400 active:scale-[0.98] hover:shadow-[0_0_30px_rgba(49,128,247,0.3)]"
                    style={{ transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
                  >
                    파트너 등록하기 <ArrowRight size={16} />
                  </Link>
                  <Link
                    href="/my/faq"
                    className="inline-flex items-center justify-center gap-1.5 text-gray-400 text-[14px] font-medium px-6 py-3.5 rounded-2xl hover:text-white hover:bg-white/10"
                    style={{ transition: 'all 0.3s' }}
                  >
                    자주 묻는 질문 <ChevronRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
         FINAL CTA
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-28 text-center">
          <h2 className="text-[24px] lg:text-[40px] font-black text-gray-900 tracking-tight leading-tight mb-4">
            지금 바로 시작하세요
          </h2>
          <p className="text-[15px] text-gray-500 mb-10 max-w-md mx-auto">
            3분이면 견적 요청 완료. 최대 5명의 전문가가 맞춤 견적을 보내드립니다.
          </p>
          <Link
            href="/match"
            className="inline-flex items-center gap-2 bg-primary-500 text-white text-[16px] font-bold px-10 py-4.5 rounded-2xl hover:bg-primary-600 active:scale-[0.98] hover:shadow-float"
            style={{ transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            무료 견적 받기 <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
         FOOTER
         ═══════════════════════════════════════════════════════════════════ */}
      <footer className="bg-[#0B1426] text-gray-400">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-14 lg:py-20">
          <div className="lg:flex justify-between gap-12 mb-12">
            <div className="mb-8 lg:mb-0">
              <p className="text-[20px] font-black text-white tracking-tight mb-3">Freetiful</p>
              <p className="text-[13px] text-gray-500 leading-relaxed max-w-xs">
                나의 특별한 행사를 완성하는 전문가 매칭 플랫폼
              </p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
              <div>
                <p className="text-[12px] font-bold text-gray-300 uppercase tracking-wider mb-4">서비스</p>
                <div className="space-y-2.5">
                  <Link href="/pros" className="block text-[13px] hover:text-white" style={{ transition: 'color 0.2s' }}>전문가 찾기</Link>
                  <Link href="/match" className="block text-[13px] hover:text-white" style={{ transition: 'color 0.2s' }}>견적 요청</Link>
                  <Link href="/businesses" className="block text-[13px] hover:text-white" style={{ transition: 'color 0.2s' }}>비즈니스</Link>
                </div>
              </div>
              <div>
                <p className="text-[12px] font-bold text-gray-300 uppercase tracking-wider mb-4">고객지원</p>
                <div className="space-y-2.5">
                  <Link href="/my/faq" className="block text-[13px] hover:text-white" style={{ transition: 'color 0.2s' }}>FAQ</Link>
                  <Link href="/my/support" className="block text-[13px] hover:text-white" style={{ transition: 'color 0.2s' }}>고객센터</Link>
                  <Link href="/my/announcements" className="block text-[13px] hover:text-white" style={{ transition: 'color 0.2s' }}>공지사항</Link>
                </div>
              </div>
              <div>
                <p className="text-[12px] font-bold text-gray-300 uppercase tracking-wider mb-4">정책</p>
                <div className="space-y-2.5">
                  <Link href="/terms/service" className="block text-[13px] hover:text-white" style={{ transition: 'color 0.2s' }}>이용약관</Link>
                  <Link href="/terms/privacy" className="block text-[13px] hover:text-white" style={{ transition: 'color 0.2s' }}>개인정보처리방침</Link>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8">
            <p className="text-[11px] text-gray-600 leading-relaxed">
              프리티풀 | 대표: 홍길동 | 사업자등록번호: 123-45-67890<br />
              서울특별시 강남구 테헤란로 123, 4층 | 고객센터: 1544-0000 | support@freetiful.co.kr<br />
              &copy; 2026 Freetiful Inc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
