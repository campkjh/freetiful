'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Share2, ChevronRight, Check } from 'lucide-react';
import { discoveryApi, type ProListItem } from '@/lib/api/discovery.api';

const BRAND = '#3180F7';

// ─── Reveal Hook ────────────────────────────────────────────
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    ob.observe(el);
    return () => ob.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ─── Event Data ─────────────────────────────────────────────
interface EventPlan {
  label: string;
  price: number;
  duration: string;
  desc: string[];
}

interface EventData {
  type: string;
  title: string;
  tagline: string;
  heroImage: string;
  intro: string;
  highlights: string[];
  plans: EventPlan[];
  faqs: { q: string; a: string }[];
  recommendCategory?: string;
}

const EVENTS: Record<string, EventData> = {
  wedding: {
    type: 'wedding',
    title: '결혼식',
    tagline: '인생의 가장 빛나는 순간',
    heroImage: '/images/biz-about-hosts.png',
    intro:
      '하객 100명부터 500명까지, 품격 있는 결혼식을 만드는 전문 사회자가 필요합니다.\n프리티풀의 검증된 전문가가 두 분의 특별한 순간을 완성합니다.',
    highlights: ['검증된 전문 사회자', '사전 미팅 포함', '대본 작성 지원', '현장 리허설 참여'],
    plans: [
      { label: 'Premium', price: 450000, duration: '1시간', desc: ['결혼식 진행', '사전 미팅 1회', '기본 대본 준비'] },
      { label: 'Superior', price: 800000, duration: '2시간', desc: ['결혼식 + 2차', '사전 미팅 2회', '맞춤 대본 작성', '현장 리허설', '포토타임 진행'] },
      { label: 'Enterprise', price: 1700000, duration: '6시간', desc: ['전 과정 풀타임', '사전 미팅 무제한', '맞춤 대본 + 수정', '리허설 참여', '축사·건배사 코디', '하객 응대 안내', '전담 코디네이터'] },
    ],
    faqs: [
      { q: '결혼식 몇일 전에 예약해야 하나요?', a: '최소 2~3개월 전 예약을 권장합니다. 인기 전문가는 6개월 전 마감되기도 합니다.' },
      { q: '사전 미팅은 어떻게 진행되나요?', a: '화상 미팅 또는 대면 미팅 중 선택 가능합니다. 요청사항을 반영하여 맞춤 대본을 준비합니다.' },
      { q: '당일 시간이 지연되면 추가 비용이 있나요?', a: '선택한 플랜 시간을 초과하는 경우 30분당 추가 비용이 발생합니다. 사전 협의 시 할인 가능합니다.' },
    ],
    recommendCategory: '외국어사회자',
  },
  corporate: {
    type: 'corporate',
    title: '기업 행사',
    tagline: '브랜드를 빛내는 전문 진행',
    heroImage: '/images/biz-about-hosts.png',
    intro:
      '컨퍼런스, 시상식, 런칭쇼까지 — 기업의 격을 높이는 전문 사회자.\n방송 경력자 중심으로 안정감 있는 진행을 보장합니다.',
    highlights: ['현직 아나운서·방송인', 'MC + 사회자 동시 진행', '대본·큐시트 완성', '2개국어 진행 가능'],
    plans: [
      { label: 'Premium', price: 800000, duration: '2시간 이내', desc: ['행사 진행', '큐시트 준비', '사전 리허설'] },
      { label: 'Superior', price: 1500000, duration: '4시간 이내', desc: ['행사 + Q&A 진행', '맞춤 대본', '리허설 참여', '영상 큐시트 관리'] },
      { label: 'Enterprise', price: 3000000, duration: '풀데이', desc: ['컨퍼런스 풀타임', '전담 MC + 사회자', '영어/한국어 진행', 'VIP 의전 지원', '전문 코디네이터'] },
    ],
    faqs: [
      { q: '영어 진행 가능한가요?', a: '외국어 전문 MC가 별도로 있으며, 영어·중국어·일본어 진행 가능합니다.' },
      { q: '세금계산서 발행되나요?', a: '네, 프리티풀 명의로 세금계산서 발행됩니다.' },
    ],
    recommendCategory: '기업행사',
  },
  party: {
    type: 'party',
    title: '연례 행사',
    tagline: '기억에 남는 송년회·시상식',
    heroImage: '/images/biz-about-hosts.png',
    intro:
      '송년회, 워크샵, 시상식 — 직원들과 함께하는 특별한 순간.\n분위기를 살리는 베테랑 사회자가 진행합니다.',
    highlights: ['게임·레크리에이션', '이벤트 기획 상담', '경품 추첨 진행', '분위기 맞춤형'],
    plans: [
      { label: 'Premium', price: 500000, duration: '2시간', desc: ['행사 진행', '기본 이벤트 진행'] },
      { label: 'Superior', price: 900000, duration: '3시간', desc: ['행사 진행 + 레크리에이션', '경품 추첨', '맞춤 대본'] },
      { label: 'Enterprise', price: 1800000, duration: '5시간', desc: ['풀패키지 진행', '레크리에이션 + 게임', '경품 진행', '사진·영상 큐', '전담 코디'] },
    ],
    faqs: [
      { q: '게임·레크리에이션도 진행되나요?', a: '연례 행사 전문 MC는 레크리에이션까지 한번에 진행합니다.' },
    ],
    recommendCategory: '기업행사',
  },
  academic: {
    type: 'academic',
    title: '컨퍼런스',
    tagline: '전문성과 품격을 담은 진행',
    heroImage: '/images/biz-about-hosts.png',
    intro:
      '학술대회, 세미나, 국제 컨퍼런스 — 전문 용어를 정확히 이해하는 사회자가 필요합니다.',
    highlights: ['영문 진행 가능', '학술 용어 이해', '시간 엄수', '패널 진행 경력'],
    plans: [
      { label: 'Premium', price: 800000, duration: '반나절', desc: ['컨퍼런스 진행', '세션별 소개'] },
      { label: 'Superior', price: 1500000, duration: '종일', desc: ['풀데이 진행', '패널 토론 진행', '영문 진행'] },
      { label: 'Enterprise', price: 2800000, duration: '다일', desc: ['2일 이상 진행', '동시통역 코디', 'VIP 의전', '전담 팀'] },
    ],
    faqs: [],
    recommendCategory: '기업행사',
  },
  sports: {
    type: 'sports',
    title: '체육대회',
    tagline: '에너지 넘치는 현장',
    heroImage: '/images/biz-about-hosts.png',
    intro:
      '기업 체육대회, 운동회 — 활기찬 진행으로 팀워크를 살립니다.',
    highlights: ['에너지 있는 진행', '팀별 매칭 관리', '시상식 진행', '응원 리드'],
    plans: [
      { label: 'Premium', price: 400000, duration: '2시간', desc: ['체육대회 진행', '시상식'] },
      { label: 'Superior', price: 700000, duration: '4시간', desc: ['종일 진행', '팀 구성 관리', '중계 진행'] },
      { label: 'Enterprise', price: 1300000, duration: '풀데이', desc: ['전체 진행', '레크리에이션', '응원 리드', '시상식'] },
    ],
    faqs: [],
    recommendCategory: '기업행사',
  },
  'live-commerce': {
    type: 'live-commerce',
    title: '라이브커머스',
    tagline: '매출을 만드는 실시간 진행',
    heroImage: '/images/biz-about-hosts.png',
    intro: '라이브 방송 전문 쇼호스트로 온라인 마켓의 매출을 극대화합니다.\n홈쇼핑/라방 경험이 풍부한 검증된 진행자를 매칭해드립니다.',
    highlights: ['홈쇼핑 경력 쇼호스트', '실시간 호응·인터랙션', '상품 특징 정확한 전달', '시청자 참여 이벤트'],
    plans: [
      { label: 'Premium', price: 500000, duration: '1시간', desc: ['라이브 진행', '사전 상품 리뷰'] },
      { label: 'Superior', price: 900000, duration: '2시간', desc: ['라이브 + 이벤트 진행', '스크립트 작성', '사전 미팅'] },
      { label: 'Enterprise', price: 1800000, duration: '풀 패키지', desc: ['풀 라이브 운영', '전담 쇼호스트', '기획·연출 코디', '반복 방송 협의'] },
    ],
    faqs: [
      { q: '상품 사전 리뷰는 얼마나 하나요?', a: '모든 플랜에서 라이브 전 최소 1회 상품 리뷰 미팅을 진행합니다.' },
    ],
    recommendCategory: '쇼호스트',
  },
  'official-event': {
    type: 'official-event',
    title: '공식행사',
    tagline: '기업의 격을 높이는 전문 진행',
    heroImage: '/images/biz-about-hosts.png',
    intro: '개업식·론칭쇼·시상식 등 공식 행사의 품격을 지키는 전문 사회자.\n방송 경력자 중심으로 안정감 있는 진행을 보장합니다.',
    highlights: ['현직 아나운서', '공식 의전 숙지', 'VIP 응대', '큐시트 정확 관리'],
    plans: [
      { label: 'Premium', price: 800000, duration: '2시간', desc: ['공식 행사 진행', '큐시트 준비'] },
      { label: 'Superior', price: 1500000, duration: '4시간', desc: ['공식 행사 + Q&A', '맞춤 대본', '리허설'] },
      { label: 'Enterprise', price: 3000000, duration: '풀데이', desc: ['풀타임 진행', '전담 코디', '영어/한국어 진행'] },
    ],
    faqs: [],
    recommendCategory: '기업행사',
  },
  'year-end-party': {
    type: 'year-end-party',
    title: '송년회',
    tagline: '한 해를 마무리하는 특별한 밤',
    heroImage: '/images/biz-about-hosts.png',
    intro: '송년회·신년회는 직원들의 결속력을 다지는 중요한 행사.\n분위기를 살리는 베테랑 사회자가 게임·시상을 한번에 진행합니다.',
    highlights: ['경품 추첨 진행', '게임·레크리에이션', '감사 멘트 구성', '사장님 연설 지원'],
    plans: [
      { label: 'Premium', price: 500000, duration: '2시간', desc: ['송년회 진행', '기본 이벤트'] },
      { label: 'Superior', price: 900000, duration: '3시간', desc: ['레크리에이션 + 경품추첨', '맞춤 대본'] },
      { label: 'Enterprise', price: 1800000, duration: '5시간', desc: ['풀패키지', '게임·레크·경품', '전담 코디'] },
    ],
    faqs: [],
    recommendCategory: '기업행사',
  },
  interpretation: {
    type: 'interpretation',
    title: '통번역',
    tagline: '국제 행사의 다리',
    heroImage: '/images/biz-about-hosts.png',
    intro: '국제 컨퍼런스, 외빈 응대에 필요한 동시통역·순차통역 서비스.\n영어·중국어·일본어 등 다국어 MC를 함께 매칭합니다.',
    highlights: ['원어민 수준 통역사', '동시통역 / 순차통역', '외국어 사회 병행', '다국어 큐시트'],
    plans: [
      { label: 'Premium', price: 600000, duration: '2시간', desc: ['순차통역 진행', '사전 자료 숙지'] },
      { label: 'Superior', price: 1200000, duration: '4시간', desc: ['동시통역 1인', '외국어 MC 겸임'] },
      { label: 'Enterprise', price: 2500000, duration: '풀데이', desc: ['동시통역 팀(2인)', '다국어 진행', '국제 의전'] },
    ],
    faqs: [
      { q: '어느 언어까지 지원되나요?', a: '영어, 중국어, 일본어, 태국어, 베트남어, 스페인어, 아랍어 등 주요 언어 지원됩니다.' },
    ],
    recommendCategory: '외국어사회자',
  },
  'corporate-pt': {
    type: 'corporate-pt',
    title: '기업 PT',
    tagline: '임팩트 있는 프레젠테이션 진행',
    heroImage: '/images/biz-about-hosts.png',
    intro: '투자 설명회·IR·제품 발표 등 기업 PT 행사 전문 진행.\n청중을 집중시키는 스피치 노하우를 제공합니다.',
    highlights: ['IR·투자 행사 경력', '발표 스피치 코칭', '임원 Q&A 진행', '영상 큐 관리'],
    plans: [
      { label: 'Premium', price: 700000, duration: '1시간', desc: ['PT 진행', '발표자 소개'] },
      { label: 'Superior', price: 1300000, duration: '2시간', desc: ['PT + 패널 토론', '맞춤 큐시트'] },
      { label: 'Enterprise', price: 2500000, duration: '풀데이', desc: ['IR·Roadshow 진행', '다발표자 코디', '영어 진행'] },
    ],
    faqs: [],
    recommendCategory: '기업행사',
  },
  recreation: {
    type: 'recreation',
    title: '레크리에이션',
    tagline: '웃음이 끊이지 않는 현장',
    heroImage: '/images/biz-about-hosts.png',
    intro: '기업 워크숍·단합대회·팀 빌딩 등을 활력 넘치게 이끄는 레크리에이션 MC.\n참여형 프로그램으로 분위기를 달굽니다.',
    highlights: ['게임 기획 상담', '그룹 미션 진행', '경품·시상 코디', '전 연령 맞춤'],
    plans: [
      { label: 'Premium', price: 500000, duration: '2시간', desc: ['기본 레크 진행', '게임 3종'] },
      { label: 'Superior', price: 900000, duration: '3시간', desc: ['레크 + 팀 미션', '시상·경품'] },
      { label: 'Enterprise', price: 1600000, duration: '풀데이', desc: ['풀타임 레크·팀 빌딩', '전담 진행팀'] },
    ],
    faqs: [],
    recommendCategory: '기업행사',
  },
  'team-building': {
    type: 'team-building',
    title: '팀빌딩',
    tagline: '팀워크를 다지는 특별한 시간',
    heroImage: '/images/biz-about-hosts.png',
    intro: '조직 활성화와 팀워크 강화를 위한 맞춤형 팀빌딩 프로그램.\n교육·게임·토론을 하나로 엮어 실질적 변화를 이끕니다.',
    highlights: ['조직 컨설턴트 동반', '맞춤 프로그램 설계', '참여형 워크숍', '후속 리포트 제공'],
    plans: [
      { label: 'Premium', price: 800000, duration: '반나절', desc: ['팀빌딩 세션 진행', '아이스브레이킹'] },
      { label: 'Superior', price: 1500000, duration: '종일', desc: ['풀데이 팀빌딩', '피드백 워크숍'] },
      { label: 'Enterprise', price: 3000000, duration: '1박2일', desc: ['합숙 팀빌딩', '전 과정 코디', '사후 리포트'] },
    ],
    faqs: [],
    recommendCategory: '기업행사',
  },
  workshop: {
    type: 'workshop',
    title: '워크숍',
    tagline: '효과적인 교육·학습의 장',
    heroImage: '/images/biz-about-hosts.png',
    intro: '사내 교육, 리더십 세미나, 직무 교육 등을 전문 진행합니다.\n강의 퍼실리테이션·토론 운영에 능한 사회자가 참여합니다.',
    highlights: ['퍼실리테이션 전문', '강사 섭외 지원', '커리큘럼 컨설팅', '결과물 문서화'],
    plans: [
      { label: 'Premium', price: 700000, duration: '반나절', desc: ['워크숍 퍼실리테이션', 'Q&A 진행'] },
      { label: 'Superior', price: 1400000, duration: '종일', desc: ['풀데이 진행', '강사 코디', '결과 공유'] },
      { label: 'Enterprise', price: 2800000, duration: '연속', desc: ['장기 워크숍', '커리큘럼 설계', '전담 팀'] },
    ],
    faqs: [],
    recommendCategory: '기업행사',
  },
};

// 한글 이름 → URL 슬러그 매핑 (쿼리 파라미터로 들어오는 경우 대응)
const NAME_TO_SLUG: Record<string, string> = {
  '라이브커머스': 'live-commerce',
  '공식행사': 'official-event',
  '송년회': 'year-end-party',
  '통번역': 'interpretation',
  '기업 PT': 'corporate-pt',
  '레크리에이션': 'recreation',
  '팀빌딩': 'team-building',
  '체육대회': 'sports',
  '워크숍': 'workshop',
  '결혼식': 'wedding',
  '기업행사': 'corporate',
  '연례행사': 'party',
  '컨퍼런스': 'academic',
};

export default function EventDetailPage() {
  const { type } = useParams<{ type: string }>();
  const router = useRouter();
  // type이 한글 이름이면 슬러그로 매핑, 아니면 그대로 사용
  const resolvedType = NAME_TO_SLUG[decodeURIComponent(type)] || type;
  const event = EVENTS[resolvedType] || EVENTS.wedding;
  const [activePlan, setActivePlan] = useState(1);
  const [headerSolid, setHeaderSolid] = useState(false);
  const [recommendedPros, setRecommendedPros] = useState<ProListItem[]>([]);

  useEffect(() => {
    const onScroll = () => setHeaderSolid(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    discoveryApi.getProList({ limit: 6, sort: 'rating', withTotal: false })
      .then((res) => setRecommendedPros(res.data || []))
      .catch(() => {});
  }, []);

  const plan = event.plans[activePlan] || event.plans[0];

  return (
    <div className="bg-white pb-24 overflow-x-hidden" style={{ letterSpacing: '-0.02em', maxWidth: '100vw' }}>
      {/* Top Header */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 transition-all duration-300 ${
          headerSolid ? 'bg-white border-b border-gray-100 h-[60px]' : 'pt-3 pb-3'
        }`}
      >
        <button
          onClick={() => router.back()}
          className={`flex items-center justify-center shrink-0 active:scale-90 transition-all w-9 h-9 ${
            headerSolid ? 'text-gray-900' : 'rounded-full bg-white/90 backdrop-blur-md shadow-sm'
          }`}
        >
          <ChevronLeft size={22} className="text-gray-900" />
        </button>
        {headerSolid && (
          <p className="text-[15px] font-bold text-gray-900 truncate">{event.title}</p>
        )}
        <button
          onClick={() => navigator.share?.({ title: event.title, url: window.location.href }).catch(() => {})}
          className={`flex items-center justify-center shrink-0 active:scale-90 transition-all w-9 h-9 ${
            headerSolid ? 'text-gray-900' : 'rounded-full bg-white/90 backdrop-blur-md shadow-sm'
          }`}
        >
          <Share2 size={18} className="text-gray-900" />
        </button>
      </div>

      {/* Hero Image */}
      <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
        <img
          src={event.heroImage}
          alt={event.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-6 left-5 right-5 text-white">
          <p className="text-[13px] font-medium text-white/80 mb-1">{event.tagline}</p>
          <h1 className="text-[28px] font-black">{event.title}</h1>
        </div>
      </div>

      {/* Intro */}
      <div className="px-5 pt-6">
        <Reveal>
          <p className="text-[15px] leading-relaxed text-gray-700 whitespace-pre-wrap">{event.intro}</p>
        </Reveal>

        {/* Highlights */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          {event.highlights.map((h, i) => (
            <Reveal key={i} delay={i * 60}>
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                <div className="w-5 h-5 rounded-full bg-[#3180F7]/10 flex items-center justify-center shrink-0">
                  <Check size={12} className="text-[#3180F7]" />
                </div>
                <span className="text-[13px] font-medium text-gray-700">{h}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      <div className="h-2 bg-gray-50 mt-8" />

      {/* Plans */}
      <div className="px-5 pt-6">
        <Reveal>
          <h2 className="text-[20px] font-bold text-gray-900 mb-1">플랜 선택</h2>
          <p className="text-[13px] text-gray-400 mb-5">예산과 규모에 맞는 플랜을 선택하세요</p>
        </Reveal>

        {/* Plan Tabs */}
        <div className="flex gap-2 mb-4">
          {event.plans.map((p, i) => (
            <button
              key={i}
              onClick={() => setActivePlan(i)}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all ${
                activePlan === i
                  ? 'bg-[#3180F7] text-white shadow-[0_2px_8px_rgba(49,128,247,0.3)]'
                  : 'bg-gray-50 text-gray-500'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Plan Content */}
        <div className="bg-gradient-to-br from-[#EAF3FF]/40 to-white border border-[#3180F7]/15 rounded-2xl p-5">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-[13px] font-bold text-[#3180F7]">{plan.label}</span>
            <span className="text-[12px] text-gray-400">{plan.duration}</span>
          </div>
          <div className="mb-5">
            <span className="text-[28px] font-black text-gray-900">{plan.price.toLocaleString()}</span>
            <span className="text-[14px] text-gray-500 ml-1">원~</span>
          </div>
          <div className="space-y-2">
            {plan.desc.map((d, i) => (
              <div key={i} className="flex items-start gap-2">
                <Check size={16} className="text-[#3180F7] shrink-0 mt-0.5" />
                <span className="text-[14px] text-gray-700">{d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="h-2 bg-gray-50 mt-8" />

      {/* FAQ */}
      {event.faqs.length > 0 && (
        <>
          <div className="px-5 pt-6">
            <Reveal>
              <h2 className="text-[20px] font-bold text-gray-900 mb-5">자주 묻는 질문</h2>
            </Reveal>
            <div className="space-y-3">
              {event.faqs.map((f, i) => (
                <Reveal key={i} delay={i * 80}>
                  <div className="border border-gray-100 rounded-xl p-4">
                    <p className="text-[14px] font-bold text-gray-900 mb-2">Q. {f.q}</p>
                    <p className="text-[13px] text-gray-500 leading-relaxed">{f.a}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
          <div className="h-2 bg-gray-50 mt-8" />
        </>
      )}

      {/* Recommended Pros */}
      {recommendedPros.length > 0 && (
        <div className="px-5 pt-6">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-[20px] font-bold text-gray-900">추천 전문가</h2>
              <p className="text-[13px] text-gray-400 mt-1">{event.title}에 적합한 사회자</p>
            </div>
            <Link href="/pros" className="text-[13px] text-gray-400 font-medium flex items-center gap-0.5">
              전체보기 <ChevronRight size={14} />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5">
            {recommendedPros.slice(0, 6).map((pro) => (
              <Link
                key={pro.id}
                href={`/pros/${pro.id}`}
                className="shrink-0 w-[120px]"
              >
                <div className="relative w-[120px] h-[160px] rounded-xl overflow-hidden bg-gray-100">
                  <img
                    src={pro.profileImageUrl || pro.images?.[0] || '/images/default-profile.svg'}
                    alt={pro.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="mt-2 text-[14px] font-bold text-gray-900 truncate">{pro.name}</p>
                {pro.avgRating > 0 && (
                  <p className="text-[11px] text-gray-400">★ {pro.avgRating.toFixed(1)} ({pro.reviewCount})</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Bottom CTA Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-3 pt-2" style={{ background: 'linear-gradient(to top, white 60%, transparent)' }}>
        <div className="flex h-12 rounded-full overflow-hidden shadow-lg max-w-[680px] mx-auto">
          <Link
            href="/pros"
            className="flex-1 bg-white border border-gray-200 border-r-0 rounded-l-full flex items-center justify-center text-[14px] font-semibold text-gray-700 active:bg-gray-50"
          >
            전문가 보기
          </Link>
          <Link
            href={`/quote?mode=event&type=${event.type}`}
            className="flex-1 bg-[#3180F7] rounded-r-full flex items-center justify-center text-[14px] font-bold text-white active:scale-[0.98]"
          >
            견적 요청하기
          </Link>
        </div>
      </div>
    </div>
  );
}
