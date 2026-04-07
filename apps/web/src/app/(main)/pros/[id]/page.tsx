'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Share2, Heart, MessageCircle, Star, MapPin,
  Calendar, ChevronDown, ChevronUp, Play, ExternalLink,
  Award, Globe, Building2, Clock
} from 'lucide-react';

const MOCK_PRO = {
  id: '1',
  name: '김민준',
  category: 'MC',
  shortIntro: '10년 경력 웨딩/기업행사 전문 MC',
  mainExperience: '결혼식 500회 이상 진행',
  careerYears: 10,
  gender: '남성',
  rating: 4.9,
  reviewCount: 142,
  responseRate: 98,
  puddingRank: 1,
  regions: ['서울/경기', '전국'],
  eventCategories: ['결혼식', '돌잔치', '생신잔치', '기업행사'],
  languages: ['한국어', 'English'],
  awards: '2023 대한민국 베스트 MC 대상, MBC 방송 MC 출연',
  companies: ['호텔신라', '반포JW메리어트', '그랜드하얏트'],
  images: [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop',
  ],
  youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  showPartnersLogo: true,
  detailHtml: `
    <h3>안녕하세요, MC 김민준입니다</h3>
    <p>10년간 500회 이상의 결혼식과 다양한 행사를 진행해온 전문 MC입니다.</p>
    <p>여러분의 특별한 날을 더욱 빛나게 만들어 드리겠습니다.</p>
    <h3>진행 스타일</h3>
    <p>격식과 유머를 적절히 조화시킨 진행을 추구합니다. 하객분들의 반응을 살피며 분위기를 이끌어가는 것이 저의 강점입니다.</p>
  `,
  services: [
    { id: '1', title: '웨딩 MC 패키지', description: '리허설 + 본식 진행 + 피로연', basePrice: 500000, priceUnit: 'per_event' },
    { id: '2', title: '돌잔치/생신잔치', description: '맞춤형 진행 + 이벤트 기획', basePrice: 400000, priceUnit: 'per_event' },
    { id: '3', title: '기업행사', description: '세미나, 시상식, 연말파티 등', basePrice: 600000, priceUnit: 'per_event' },
  ],
  faqs: [
    { id: '1', question: '사전 미팅은 가능한가요?', answer: '네, 행사 전 온/오프라인 미팅을 통해 세부 사항을 조율합니다. 보통 행사 2주 전에 진행합니다.' },
    { id: '2', question: '교통비는 별도인가요?', answer: '서울/경기 지역은 포함이며, 그 외 지역은 교통비가 별도로 발생합니다.' },
    { id: '3', question: '리허설은 포함인가요?', answer: '웨딩 MC 패키지에는 본식 당일 1시간 전 리허설이 포함되어 있습니다.' },
  ],
  availableDates: ['2026-04-05', '2026-04-12', '2026-04-19', '2026-04-26', '2026-05-03'],
  reviews: [
    { id: '1', name: '박**', date: '2026-03-15', rating: 5.0, satisfaction: 5, composition: 5, experience: 5, appearance: 5, voice: 5, wit: 5, comment: '결혼식 MC로 최고였습니다! 하객분들이 정말 재미있어하셨어요. 감동적이면서도 유머러스한 진행 덕분에 평생 기억에 남을 결혼식이 됐습니다.', proReply: '축하드립니다! 행복한 결혼생활 하세요 ❤️' },
    { id: '2', name: '이**', date: '2026-03-01', rating: 4.8, satisfaction: 5, composition: 5, experience: 5, appearance: 4, voice: 5, wit: 5, comment: '돌잔치 진행을 맡겼는데 정말 만족스러웠어요. 아이 축하 이벤트도 센스있게 해주셨고, 시간 배분도 완벽했습니다.' },
    { id: '3', name: '최**', date: '2026-02-20', rating: 4.9, satisfaction: 5, composition: 5, experience: 5, appearance: 5, voice: 5, wit: 4, comment: '기업 시상식 MC를 해주셨는데, 전문적이면서도 딱딱하지 않은 진행이 좋았습니다. 다음에도 꼭 부탁드릴 예정입니다.' },
  ],
  recommendedPros: [
    { id: '2', name: '이서연 MC', category: 'MC', rating: 4.8, reviews: 98, image: 'https://i.pravatar.cc/150?img=5' },
    { id: '3', name: '박준혁 가수', category: '가수', rating: 5.0, reviews: 67, image: 'https://i.pravatar.cc/150?img=3' },
    { id: '4', name: '최지은 쇼호스트', category: '쇼호스트', rating: 4.7, reviews: 55, image: 'https://i.pravatar.cc/150?img=9' },
  ],
};

export default function ProDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'info' | 'reviews'>('info');
  const [activeImage, setActiveImage] = useState(0);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);

  const pro = MOCK_PRO;

  const formatPrice = (price: number) => price.toLocaleString('ko-KR') + '원';

  return (
    <div className="bg-white min-h-screen pb-24">
      {/* Header */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-30 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center justify-between px-4 h-12">
          <button onClick={() => router.back()} className="p-1">
            <ArrowLeft size={22} />
          </button>
          <div className="flex items-center gap-2">
            <button className="p-2" onClick={() => navigator.share?.({ url: window.location.href })}>
              <Share2 size={20} className="text-gray-600" />
            </button>
            <button className="p-2" onClick={() => setIsFavorited(!isFavorited)}>
              <Heart size={20} className={isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-600'} />
            </button>
          </div>
        </div>
      </div>

      {/* Image Gallery - 3분할 그리드 */}
      <div className="pt-12">
        <div className="grid grid-cols-3 gap-0.5 bg-gray-100" style={{ height: '420px' }}>
          {/* 1번: 세로형 프로필 이미지 */}
          <div className="relative overflow-hidden row-span-1 h-full">
            <img
              src={pro.images[0]}
              alt={`${pro.name} 프로필`}
              className="w-full h-full object-cover"
            />
            {pro.showPartnersLogo && (
              <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm rounded-md px-1.5 py-0.5 shadow-sm">
                <span className="text-[9px] font-bold text-primary-500 tracking-tight">PARTNERS</span>
              </div>
            )}
          </div>

          {/* 2번: 유튜브 영상 또는 프로필 이미지 대체 */}
          <div className="relative overflow-hidden h-full">
            {pro.youtubeUrl ? (
              <div className="w-full h-full relative group">
                {/* 유튜브 썸네일 + 재생 오버레이 */}
                <img
                  src={`https://img.youtube.com/vi/${pro.youtubeUrl.match(/(?:v=|\/)([\w-]{11})/)?.[1]}/hqdefault.jpg`}
                  alt="영상 미리보기"
                  className="w-full h-full object-cover"
                />
                <a
                  href={pro.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors"
                >
                  <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                    <Play size={20} className="text-white fill-white ml-0.5" />
                  </div>
                </a>
                <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[9px] font-medium px-1.5 py-0.5 rounded">
                  YouTube
                </div>
              </div>
            ) : (
              <img
                src={pro.images[1] || pro.images[0]}
                alt={`${pro.name} 프로필`}
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* 3번: 프로필 이미지 */}
          <div className="relative overflow-hidden h-full">
            <img
              src={pro.images[2] || pro.images[1] || pro.images[0]}
              alt={`${pro.name} 프로필`}
              className="w-full h-full object-cover"
            />
            {pro.images.length > 3 && (
              <button
                onClick={() => setActiveImage(0)}
                className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-medium px-2 py-1 rounded-full"
              >
                +{pro.images.length - 3}장
              </button>
            )}
          </div>
        </div>

        {/* 이미지 인디케이터 (전체 이미지 스크롤) */}
        <div className="flex gap-2 px-4 py-3 overflow-x-auto">
          {pro.images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveImage(i)}
              className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                i === activeImage ? 'border-primary-500' : 'border-transparent'
              }`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      {/* Basic Info */}
      <div className="px-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-primary-50 text-primary-500 text-xs font-bold px-2 py-0.5 rounded-full">
            {pro.category}
          </span>
          {pro.puddingRank <= 3 && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              pro.puddingRank === 1 ? 'bg-yellow-50 text-yellow-600' :
              pro.puddingRank === 2 ? 'bg-gray-50 text-gray-500' :
              'bg-orange-50 text-orange-600'
            }`}>
              {pro.puddingRank === 1 ? '🥇' : pro.puddingRank === 2 ? '🥈' : '🥉'} TOP {pro.puddingRank}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">{pro.name}</h1>
        <p className="text-sm text-gray-600 mt-1">{pro.shortIntro}</p>
        <p className="text-xs text-gray-400 mt-0.5">{pro.mainExperience}</p>

        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-1">
            <Star size={16} className="fill-yellow-400 text-yellow-400" />
            <span className="font-bold text-sm">{pro.rating}</span>
            <span className="text-xs text-gray-400">({pro.reviewCount})</span>
          </div>
          <div className="flex items-center gap-1 text-gray-500">
            <Clock size={14} />
            <span className="text-xs">응답률 {pro.responseRate}%</span>
          </div>
          <div className="flex items-center gap-1 text-gray-500">
            <Calendar size={14} />
            <span className="text-xs">경력 {pro.careerYears}년</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {pro.regions.map((r) => (
            <span key={r} className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
              <MapPin size={10} /> {r}
            </span>
          ))}
          {pro.languages.map((l) => (
            <span key={l} className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
              <Globe size={10} /> {l}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-12 z-20 bg-white border-b border-gray-100">
        <div className="flex">
          {[
            { key: 'info' as const, label: '상세정보' },
            { key: 'reviews' as const, label: `리뷰 ${pro.reviewCount}` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-colors ${
                activeTab === key
                  ? 'text-primary-500 border-primary-500'
                  : 'text-gray-400 border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'info' ? (
        <div>
          {/* Awards & Companies */}
          {(pro.awards || pro.companies.length > 0) && (
            <section className="px-4 py-5 border-b border-gray-100">
              {pro.awards && (
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Award size={16} className="text-primary-500" />
                    <span className="text-sm font-bold text-gray-900">수상 경력</span>
                  </div>
                  <p className="text-sm text-gray-600 pl-6">{pro.awards}</p>
                </div>
              )}
              {pro.companies.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 size={16} className="text-primary-500" />
                    <span className="text-sm font-bold text-gray-900">주요 활동</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pl-6">
                    {pro.companies.map((c) => (
                      <span key={c} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Event Categories */}
          <section className="px-4 py-5 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-3">가능한 행사</h3>
            <div className="flex flex-wrap gap-2">
              {pro.eventCategories.map((ec) => (
                <span key={ec} className="text-xs bg-primary-50 text-primary-600 px-3 py-1.5 rounded-full font-medium">{ec}</span>
              ))}
            </div>
          </section>

          {/* YouTube */}
          {pro.youtubeUrl && (
            <section className="px-4 py-5 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 mb-3">영상</h3>
              <a
                href={pro.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors"
              >
                <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center shrink-0">
                  <Play size={20} className="text-white fill-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">YouTube 영상 보기</p>
                  <p className="text-xs text-gray-400 truncate">{pro.youtubeUrl}</p>
                </div>
                <ExternalLink size={16} className="text-gray-400 shrink-0" />
              </a>
            </section>
          )}

          {/* Detail HTML */}
          <section className="px-4 py-5 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-3">소개</h3>
            <div
              className="prose prose-sm max-w-none text-gray-600"
              dangerouslySetInnerHTML={{ __html: pro.detailHtml }}
            />
          </section>

          {/* Services */}
          <section className="px-4 py-5 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-3">서비스</h3>
            <div className="space-y-3">
              {pro.services.map((svc) => (
                <div key={svc.id} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{svc.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{svc.description}</p>
                    </div>
                    <p className="text-sm font-bold text-primary-500 shrink-0">
                      {formatPrice(svc.basePrice)}~
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section className="px-4 py-5 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-3">자주 묻는 질문</h3>
            <div className="space-y-2">
              {pro.faqs.map((faq) => (
                <div key={faq.id} className="bg-gray-50 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <span className="text-sm font-medium text-gray-900">Q. {faq.question}</span>
                    {expandedFaq === faq.id ? (
                      <ChevronUp size={16} className="text-gray-400 shrink-0" />
                    ) : (
                      <ChevronDown size={16} className="text-gray-400 shrink-0" />
                    )}
                  </button>
                  {expandedFaq === faq.id && (
                    <div className="px-4 pb-4 text-sm text-gray-600">
                      A. {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Available Dates */}
          <section className="px-4 py-5 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-3">가능한 날짜</h3>
            <div className="flex flex-wrap gap-2">
              {pro.availableDates.map((d) => {
                const date = new Date(d);
                const month = date.getMonth() + 1;
                const day = date.getDate();
                const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
                return (
                  <span key={d} className="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-full font-medium">
                    {month}/{day}({weekday})
                  </span>
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        /* Reviews Tab */
        <div className="px-4 py-5">
          {/* Rating Summary */}
          <div className="bg-gray-50 rounded-2xl p-5 mb-5">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-4xl font-black text-gray-900">{pro.rating}</p>
                <div className="flex items-center gap-0.5 mt-1 justify-center">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={14} className={i < Math.round(pro.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">리뷰 {pro.reviewCount}개</p>
              </div>
              <div className="flex-1 space-y-1.5">
                {['만족도', '구성', '경험', '외모', '목소리', '위트'].map((label, i) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-12">{label}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                      <div className="bg-primary-500 h-1.5 rounded-full" style={{ width: `${([98, 96, 99, 95, 97, 94][i])}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Review List */}
          <div className="space-y-4">
            {pro.reviews.map((review) => (
              <div key={review.id} className="border-b border-gray-100 pb-4 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-xs text-gray-500">{review.name[0]}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{review.name}</p>
                      <p className="text-xs text-gray-400">{review.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Star size={12} className="fill-yellow-400 text-yellow-400" />
                    <span className="text-xs font-bold">{review.rating}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>
                {review.proReply && (
                  <div className="mt-3 bg-gray-50 rounded-xl p-3">
                    <p className="text-xs font-bold text-primary-500 mb-1">전문가 답변</p>
                    <p className="text-xs text-gray-600">{review.proReply}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Pros */}
      <section className="px-4 py-5 bg-gray-50">
        <h3 className="text-sm font-bold text-gray-900 mb-3">추천 전문가</h3>
        <div className="flex gap-3 overflow-x-auto -mx-4 px-4 scrollbar-hide">
          {pro.recommendedPros.map((rec) => (
            <Link key={rec.id} href={`/pros/${rec.id}`} className="shrink-0 w-32">
              <div className="bg-white rounded-xl overflow-hidden shadow-sm">
                <img src={rec.image} alt={rec.name} className="w-full aspect-square object-cover" />
                <div className="p-2.5">
                  <p className="text-xs font-bold text-gray-900 truncate">{rec.name}</p>
                  <p className="text-[10px] text-gray-500">{rec.category}</p>
                  <div className="flex items-center gap-0.5 mt-1">
                    <Star size={10} className="fill-yellow-400 text-yellow-400" />
                    <span className="text-[10px] font-bold">{rec.rating}</span>
                    <span className="text-[10px] text-gray-400">({rec.reviews})</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Floating Bottom Bar */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t border-gray-100 px-4 py-3 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsFavorited(!isFavorited)}
            className="w-12 h-12 flex items-center justify-center border border-gray-200 rounded-xl shrink-0"
          >
            <Heart size={22} className={isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-400'} />
          </button>
          <Link href={`/chat/new?proId=${id}`} className="flex-1">
            <button className="btn-primary flex items-center justify-center gap-2">
              <MessageCircle size={18} />
              1:1 문의하기
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
