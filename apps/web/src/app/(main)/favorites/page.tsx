'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Heart, Star, MapPin, Building2, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { favoriteApi, getCachedFavoritesList } from '@/lib/api/favorite.api';

type Tab = 'service' | 'portfolio' | 'recent';
type ProCategory = '전체' | '사회자' | '쇼호스트' | '축가';
type BizCategory = '전체' | '웨딩홀' | '스튜디오' | '드레스' | '헤메샵';

const MOCK_FAVORITE_PROS = [
  { id: '15', name: '박인애', category: '사회자', badge: '', intro: '13년 생방송 뉴스 진행으로 다져진 품격있는 사회자', rating: 4.9, reviews: 134, image: '/images/pro-15/IMG_0196.avif', price: 550000, subName: '사회자 박인애' },
  { id: '23', name: '이승진', category: '사회자', badge: '', intro: '따뜻하고 깔끔한 진행의 사회자 이승진 입니다', rating: 4.8, reviews: 211, image: '/images/pro-23/IMG_46511771924269213.avif', price: 500000, subName: '사회자 이승진' },
  { id: '18', name: '성연채', category: '사회자', badge: '', intro: '따뜻하고 다정한 아나운서 성연채입니다', rating: 4.9, reviews: 75, image: '/images/pro-18/20161016_161406_IMG_5921.avif', price: 500000, subName: '사회자 성연채' },
];

const MOCK_FAVORITE_BIZ = [
  { id: '1', name: '시에나호텔 웨딩', category: '웨딩홀', image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&h=400&fit=crop', address: '서울 강남구', rating: 4.8, reviews: 234, price: 3500000 },
  { id: '2', name: '루미에스튜디오', category: '스튜디오', image: 'https://images.unsplash.com/photo-1554080353-a576cf803bda?w=400&h=400&fit=crop', address: '서울 마포구', rating: 4.9, reviews: 189, price: 1200000 },
  { id: '3', name: '라벨드레스', category: '드레스', image: 'https://images.unsplash.com/photo-1594552072238-b8a33785b261?w=400&h=400&fit=crop', address: '서울 청담동', rating: 5.0, reviews: 67, price: 800000 },
];

// Complete pro data for favorites + recent lookup
const ALL_PROS: { id: string; name: string; category: string; badge: string; intro: string; rating: number; reviews: number; image: string; price: number; subName: string }[] = [
  { id: '1', name: '강도현', category: '사회자', badge: '', intro: '신뢰감 있는 보이스로 현직 아나운서', rating: 4.6, reviews: 117, image: '/images/pro-01/10000133881772850005043.avif', price: 450000, subName: '사회자 강도현' },
  { id: '2', name: '김동현', category: '사회자', badge: '', intro: '안녕하세요 MC 김동현 입니다', rating: 4.7, reviews: 165, image: '/images/pro-02/10000365351773046135169.avif', price: 450000, subName: '사회자 김동현' },
  { id: '3', name: '김민지', category: '사회자', badge: '', intro: '꼼꼼하고 부드러운 진행', rating: 4.8, reviews: 96, image: '/images/pro-03/IMG_06781773894450803.avif', price: 450000, subName: '사회자 김민지' },
  { id: '4', name: '김솔', category: '사회자', badge: '', intro: '자연스럽고 편안한 분위기의 웨딩 전문 MC', rating: 4.7, reviews: 36, image: '/images/pro-04/IMG_23601771788594274.avif', price: 450000, subName: '사회자 김솔' },
  { id: '5', name: '김유석', category: '사회자', badge: '', intro: '최고의 진행자 아나운서 김유석입니다', rating: 4.7, reviews: 65, image: '/images/pro-05/10000029811773033474612.avif', price: 450000, subName: '사회자 김유석' },
  { id: '6', name: '김재성', category: '사회자', badge: '', intro: '순간을 기억으로 만드는 사회자', rating: 4.5, reviews: 235, image: '/images/pro-06/10000602271772960706687.avif', price: 450000, subName: '사회자 김재성' },
  { id: '7', name: '김진아', category: '사회자', badge: '', intro: '아나운서 김진아입니다', rating: 4.6, reviews: 170, image: '/images/pro-07/IMG_53011772965035335.avif', price: 450000, subName: '사회자 김진아' },
  { id: '8', name: '김호중', category: '사회자', badge: '', intro: '기획에서 진행까지, 무대를 완성하다', rating: 4.6, reviews: 232, image: '/images/pro-08/0DBA6E02-BBC8-4660-8464-5B5162FAD2461773045822216.avif', price: 450000, subName: '사회자 김호중' },
  { id: '9', name: '나연지', category: '사회자', badge: '', intro: '공식행사 전문 MC', rating: 4.9, reviews: 239, image: '/images/pro-09/Facetune_10-02-2026-21-07-511772438130235.avif', price: 450000, subName: '사회자 나연지' },
  { id: '10', name: '노유재', category: '사회자', badge: '', intro: '무대에서 다진 표현력과 방송에서 쌓은 전달력', rating: 4.7, reviews: 197, image: '/images/pro-10/10000016211774440274171.avif', price: 450000, subName: '사회자 노유재' },
  { id: '11', name: '도준석', category: '사회자', badge: '', intro: '격 있는 사회자입니다', rating: 4.8, reviews: 163, image: '/images/pro-11/1-1231772850030951.avif', price: 450000, subName: '사회자 도준석' },
  { id: '12', name: '문정은', category: '사회자', badge: '', intro: '품격있고 고급스러운 진행 + 편안함', rating: 5.0, reviews: 242, image: '/images/pro-12/0913 문정은5705 복사1772621245459.avif', price: 450000, subName: '사회자 문정은' },
  { id: '13', name: '박상설', category: '사회자', badge: '', intro: '10년 경력, 2000번의 행사 경력', rating: 4.9, reviews: 43, image: '/images/pro-13/10000077391773050357628.avif', price: 450000, subName: '사회자 박상설' },
  { id: '14', name: '박은결', category: '사회자', badge: '', intro: '아나운서 사회자 박은결입니다', rating: 4.6, reviews: 156, image: '/images/pro-14/IMG_02661773035503788.avif', price: 450000, subName: '사회자 박은결' },
  { id: '15', name: '박인애', category: '사회자', badge: '', intro: '13년 생방송 뉴스 진행으로 다져진 품격있는 사회자', rating: 4.6, reviews: 119, image: '/images/pro-15/IMG_0196.avif', price: 450000, subName: '사회자 박인애' },
  { id: '16', name: '박주은', category: '사회자', badge: '', intro: 'SBS Sports 아나운서', rating: 4.8, reviews: 225, image: '/images/pro-16/IMG_01621772973118334.avif', price: 450000, subName: '사회자 박주은' },
  { id: '17', name: '배유정', category: '사회자', badge: '', intro: '믿고 맏기는 행사입니다!', rating: 4.8, reviews: 92, image: '/images/pro-17/IMG_21541773026472716.avif', price: 450000, subName: '사회자 배유정' },
  { id: '18', name: '성연채', category: '사회자', badge: '', intro: '따뜻하고 다정한 아나운서 성연채입니다', rating: 4.7, reviews: 241, image: '/images/pro-18/20161016_161406_IMG_5921.avif', price: 450000, subName: '사회자 성연채' },
  { id: '19', name: '송지은', category: '사회자', badge: '', intro: '믿고 맡기는 아나운서', rating: 4.8, reviews: 86, image: '/images/pro-19/DE397232-C3A6-4FD0-80C8-0251D66A66AF1772092441240.avif', price: 450000, subName: '사회자 송지은' },
  { id: '20', name: '유하늘', category: '사회자', badge: '', intro: '따뜻하고 사랑스러운 분위기의 결혼식 전문 사회자', rating: 4.9, reviews: 34, image: '/images/pro-20/D54BC1BA-3BF2-4827-AA76-096D4056BCDB1773030157943.avif', price: 450000, subName: '사회자 유하늘' },
  { id: '21', name: '유하영', category: '사회자', badge: '', intro: 'KBS 캐스터 유하영 입니다', rating: 4.6, reviews: 54, image: '/images/pro-21/22712e20f03327c2843673c063c881f432f6af591772967031477.avif', price: 450000, subName: '사회자 유하영' },
  { id: '22', name: '이강문', category: '사회자', badge: '', intro: '10년베테랑사회자의 안정적인진행!', rating: 4.6, reviews: 210, image: '/images/pro-22/10000353831773035180593.avif', price: 450000, subName: '사회자 이강문' },
  { id: '23', name: '이승진', category: '사회자', badge: '', intro: '따뜻하고 깔끔한 진행의 사회자 이승진 입니다', rating: 4.8, reviews: 133, image: '/images/pro-23/IMG_46511771924269213.avif', price: 450000, subName: '사회자 이승진' },
  { id: '24', name: '이용석', category: '사회자', badge: '', intro: '1000회 이상의 결혼식사회, 공식행사, 방송진행', rating: 4.9, reviews: 117, image: '/images/pro-24/10001176941772847263491.avif', price: 450000, subName: '사회자 이용석' },
  { id: '25', name: '이우영', category: '사회자', badge: '', intro: '현직 아나운서의 고품격 진행', rating: 4.7, reviews: 222, image: '/images/pro-25/2-11772248201484.avif', price: 450000, subName: '사회자 이우영' },
  { id: '26', name: '이원영', category: '사회자', badge: '', intro: 'KBS 춘천방송총국 기상캐스터', rating: 4.5, reviews: 94, image: '/images/pro-26/1-1231772531708677.avif', price: 450000, subName: '사회자 이원영' },
  { id: '27', name: '이재원', category: '사회자', badge: '', intro: '영어MC / 영어아나운서 이재원', rating: 4.9, reviews: 24, image: '/images/pro-27/17230390916981773388202648.avif', price: 450000, subName: '사회자 이재원' },
  { id: '28', name: '이한나', category: '사회자', badge: '', intro: '생방송 4년차, 현직 아나운서 이한나', rating: 4.6, reviews: 68, image: '/images/pro-28/IMG_002209_01772081523241.avif', price: 450000, subName: '사회자 이한나' },
  { id: '29', name: '임하람', category: '사회자', badge: '', intro: '남들과 다른 특별한 예식을 진행해드립니다', rating: 4.8, reviews: 166, image: '/images/pro-29/10000118841772968813129.avif', price: 450000, subName: '사회자 임하람' },
  { id: '30', name: '장윤영', category: '사회자', badge: '', intro: '아나운서 장윤영입니다', rating: 4.8, reviews: 225, image: '/images/pro-30/IMG_27051772976548211.avif', price: 450000, subName: '사회자 장윤영' },
  { id: '31', name: '전해별', category: '사회자', badge: '', intro: '탄탄한 발성의 아나운서가 여러분을 빛내 드리겠습니다', rating: 4.5, reviews: 201, image: '/images/pro-31/025209A2-09A8-4777-9A6A-DF4751F560A71772850104015.avif', price: 450000, subName: '사회자 전해별' },
  { id: '32', name: '전혜인', category: '사회자', badge: '', intro: '믿고 맡기는 아나운서 전혜인', rating: 5.0, reviews: 152, image: '/images/pro-32/IMG_19181773027236141.avif', price: 450000, subName: '사회자 전혜인' },
  { id: '33', name: '정미정', category: '사회자', badge: '', intro: '경력 13년차 아나운서 및 사회자', rating: 4.7, reviews: 48, image: '/images/pro-33/0533d0a3d5f361ad511e32dafb775319b26ce7541772100346528.avif', price: 450000, subName: '사회자 정미정' },
  { id: '34', name: '정애란', category: '사회자', badge: '', intro: '임기응변에 강한 따뜻한 목소리', rating: 4.9, reviews: 226, image: '/images/pro-34/IMG_2920.avif', price: 450000, subName: '사회자 정애란' },
  { id: '35', name: '정이현', category: '사회자', badge: '', intro: '정이현 사회자입니다', rating: 4.8, reviews: 129, image: '/images/pro-35/44561772622988798.avif', price: 450000, subName: '사회자 정이현' },
  { id: '36', name: '조하늘', category: '사회자', badge: '', intro: '아나돌: 아이돌 같은 아나운서 조하늘', rating: 4.9, reviews: 152, image: '/images/pro-36/IMG_27041773036338469.avif', price: 450000, subName: '사회자 조하늘' },
  { id: '37', name: '최진선', category: '사회자', badge: '', intro: '최진선', rating: 4.9, reviews: 204, image: '/images/pro-37/10001059551772371340253.avif', price: 450000, subName: '사회자 최진선' },
  { id: '38', name: '한가람', category: '사회자', badge: '', intro: '고급스럽고 따뜻한 보이스 사회자 한가람 입니다', rating: 4.7, reviews: 62, image: '/images/pro-38/IMG_34281772111635068.avif', price: 450000, subName: '사회자 한가람' },
  { id: '39', name: '함현지', category: '사회자', badge: '', intro: '깔끔하고 격식있는 진행, 함현지입니다', rating: 4.6, reviews: 115, image: '/images/pro-39/11773004544652.avif', price: 450000, subName: '사회자 함현지' },
  { id: '40', name: '허수빈', category: '사회자', badge: '', intro: '순간을 놓치지 않는 센스와 따뜻한 진행', rating: 5.0, reviews: 97, image: '/images/pro-40/IMG_01991772961130928.avif', price: 450000, subName: '사회자 허수빈' },
  { id: '41', name: '홍현미', category: '사회자', badge: '', intro: '정부|기업 공식행사 전문아나운서의 고급스러운 진행', rating: 4.7, reviews: 222, image: '/images/pro-41/IMG_12201772513865121.avif', price: 450000, subName: '사회자 홍현미' },
];

export default function FavoritesPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('service');
  const [proCategory, setProCategory] = useState<ProCategory>('전체');
  const [bizCategory, setBizCategory] = useState<BizCategory>('전체');
  // 세션 캐시에서 initial state 생성 (재방문 시 skeleton 안 보임)
  const cached = typeof window !== 'undefined' ? getCachedFavoritesList() : null;
  const cachedPros = cached?.items?.length > 0
    ? cached.items.map((f: any) => ({
        id: f.proProfile?.id || f.proProfileId,
        name: f.proProfile?.user?.name || '',
        category: '사회자',
        badge: '',
        intro: f.proProfile?.shortIntro || '',
        rating: Number(f.proProfile?.avgRating || 0),
        reviews: f.proProfile?.reviewCount || 0,
        image: f.proProfile?.images?.[0]?.imageUrl || f.proProfile?.user?.profileImageUrl || '',
        price: f.proProfile?.services?.[0]?.basePrice || 450000,
        subName: `사회자 ${f.proProfile?.user?.name || ''}`,
      }))
    : [];
  const [favPros, setFavPros] = useState<typeof MOCK_FAVORITE_PROS>(cachedPros);
  const [favBiz, setFavBiz] = useState<typeof MOCK_FAVORITE_BIZ>([]);
  const [favLoading, setFavLoading] = useState(cachedPros.length === 0);
  const authUser = useAuthStore((s) => s.user);

  // Login check + load favorites
  useEffect(() => {
    const loggedIn = authUser !== null || localStorage.getItem('freetiful-logged-in') === 'true';
    setIsLoggedIn(loggedIn);
    if (!loggedIn) { setFavLoading(false); return; }

    // localStorage 먼저 즉시 렌더 (체감 속도 개선)
    try {
      const stored: string[] = JSON.parse(localStorage.getItem('freetiful-favorites') || '[]');
      if (stored.length > 0) {
        const mapped = stored
          .map((id) => ALL_PROS.find((p) => p.id === id))
          .filter(Boolean) as typeof ALL_PROS;
        setFavPros(mapped);
        setFavLoading(false);
      }
    } catch {}

    // Demo biz fallback
    if (localStorage.getItem('freetiful-has-demo-data') === 'true') {
      setFavBiz(MOCK_FAVORITE_BIZ);
    }

    // API로 최신 데이터 fetch (백그라운드)
    if (authUser) {
      favoriteApi.getList({ limit: 50 })
        .then((res: any) => {
          if (res?.items) {
            setFavPros(res.items.map((f: any) => ({
              id: f.proProfile?.id || f.proProfileId,
              name: f.proProfile?.user?.name || '',
              category: '사회자',
              badge: '',
              intro: f.proProfile?.shortIntro || '',
              rating: Number(f.proProfile?.avgRating || 0),
              reviews: f.proProfile?.reviewCount || 0,
              image: f.proProfile?.images?.[0]?.imageUrl || f.proProfile?.user?.profileImageUrl || '',
              price: f.proProfile?.services?.[0]?.basePrice || 450000,
              subName: `사회자 ${f.proProfile?.user?.name || ''}`,
            })));
          }
        })
        .catch(() => {})
        .finally(() => setFavLoading(false));
    } else {
      setFavLoading(false);
    }
  }, [authUser]);
  const [recentPros, setRecentPros] = useState<typeof ALL_PROS>([]);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 60);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('viewed-pros') || '[]') as { id: string; time: number }[];
      const recent = stored
        .map((v) => ALL_PROS.find((p) => p.id === v.id) || null)
        .filter(Boolean) as typeof ALL_PROS;
      setRecentPros(recent);
    } catch {}
  }, []);

  const removePro = (id: string) => {
    setFavPros((prev) => prev.filter((p) => p.id !== id));
    try {
      const stored: string[] = JSON.parse(localStorage.getItem('freetiful-favorites') || '[]');
      localStorage.setItem('freetiful-favorites', JSON.stringify(stored.filter((s) => s !== id)));
    } catch {}
  };
  const removeBiz = (id: string) => setFavBiz((prev) => prev.filter((b) => b.id !== id));

  const filteredPros = proCategory === '전체'
    ? favPros
    : favPros.filter((p) => p.category === proCategory);

  const filteredBiz = bizCategory === '전체'
    ? favBiz
    : favBiz.filter((b) => b.category === bizCategory);

  const tabs: { key: Tab; label: string; badge?: string }[] = [
    { key: 'service', label: '전문가' },
    { key: 'portfolio', label: '웨딩파트너' },
    { key: 'recent', label: '최근 본', badge: recentPros.length > 0 ? 'NEW' : undefined },
  ];

  const proCategories: { key: ProCategory; count: number }[] = [
    { key: '전체', count: favPros.length },
    { key: '사회자', count: favPros.filter((p) => p.category === '사회자').length },
    { key: '쇼호스트', count: favPros.filter((p) => p.category === '쇼호스트').length },
    { key: '축가', count: favPros.filter((p) => p.category === '축가').length },
  ];

  const bizCategories: { key: BizCategory; count: number }[] = [
    { key: '전체', count: favBiz.length },
    { key: '웨딩홀', count: favBiz.filter((b) => b.category === '웨딩홀').length },
    { key: '스튜디오', count: favBiz.filter((b) => b.category === '스튜디오').length },
    { key: '드레스', count: favBiz.filter((b) => b.category === '드레스').length },
    { key: '헤메샵', count: favBiz.filter((b) => b.category === '헤메샵').length },
  ];

  return (
    <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
      {/* Header - sticky */}
      <div ref={headerRef} className="sticky top-0 z-20 bg-white border-b border-gray-100" style={{ willChange: 'contents' }}>
        <div className="h-[52px] flex items-center px-4 gap-3">
          <h1 className="text-[18px] font-bold text-gray-900 shrink-0">찜목록</h1>

          {/* 탭: 스크롤하면 칩 형태로 변신하며 헤더 우측에 붙음 */}
          <div
            className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide"
            style={{
              marginLeft: scrolled ? 0 : 'auto',
              transition: 'margin-left 0.3s ease',
            }}
          >
            <>
              {tabs.map((t) => {
                const isActive = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`relative isolate shrink-0 font-semibold whitespace-nowrap transition-all duration-300 active:scale-95 ${isActive ? 'text-white' : 'text-gray-500'}`}
                    style={{ fontSize: scrolled ? 12 : 13, padding: scrolled ? '4px 10px' : '6px 14px', borderRadius: 999 }}
                  >
                    <span
                      className={`absolute inset-0 bg-gray-900 rounded-full transition-all duration-300 ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
                      style={{ zIndex: -1 }}
                    />
                    <span className="relative">
                      {t.label}
                      {t.badge && <span className="ml-0.5 text-[9px] font-bold text-red-400">{t.badge}</span>}
                    </span>
                  </button>
                );
              })}
            </>
          </div>
        </div>

        {/* 카테고리 칩 - 스크롤 시 접힘 */}
        <div
          className="overflow-hidden"
          style={{
            maxHeight: scrolled ? 0 : 48,
            opacity: scrolled ? 0 : 1,
            transition: 'max-height 0.3s ease, opacity 0.2s ease',
          }}
        >
          {activeTab === 'service' && (
            <>
              <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
                {proCategories.map((c) => {
                  const active = proCategory === c.key;
                  return (
                    <button key={c.key} onClick={() => setProCategory(c.key)} className={`relative isolate px-3.5 py-1.5 text-[13px] font-medium shrink-0 rounded-full ${active ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                      {active && <span className="absolute inset-0 bg-[#2B313D] rounded-full" style={{ zIndex: -1 }} />}
                      <span className="relative">{c.key} ({c.count})</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {activeTab === 'portfolio' && (
            <>
              <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
                {bizCategories.filter((c) => c.count > 0 || c.key === '전체').map((c) => {
                  const active = bizCategory === c.key;
                  return (
                    <button key={c.key} onClick={() => setBizCategory(c.key)} className={`relative isolate px-3.5 py-1.5 text-[13px] font-medium shrink-0 rounded-full ${active ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                      {active && <span className="absolute inset-0 bg-[#2B313D] rounded-full" style={{ zIndex: -1 }} />}
                      <span className="relative">{c.key} ({c.count})</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 전문가 탭 */}
      {activeTab === 'service' && (
        <div className="bg-white">
          {favLoading && filteredPros.length === 0 ? (
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 4 }).map((_, i) => (
                <ProCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredPros.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {filteredPros.map((pro) => (
                <ProCard key={pro.id} pro={pro} onRemove={removePro} />
              ))}
            </div>
          ) : (
            <>
              <EmptyState message={isLoggedIn ? "찜한 전문가가 없습니다" : "로그인 후 찜한 전문가를 확인하세요"} linkText={isLoggedIn ? "전문가 찾아보기" : "로그인하기"} linkHref={isLoggedIn ? "/pros" : "/"} />
              {isLoggedIn && favPros.length === 0 && (
                <div className="flex justify-center -mt-16 pb-8">
                  <button
                    onClick={() => { localStorage.setItem('freetiful-has-demo-data', 'true'); setFavPros(MOCK_FAVORITE_PROS); setFavBiz(MOCK_FAVORITE_BIZ); }}
                    className="text-[13px] text-blue-500 font-medium px-4 py-2 rounded-full border border-blue-200 hover:bg-blue-50 transition-colors"
                  >
                    데모 데이터 로드
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 웨딩파트너 탭 */}
      {activeTab === 'portfolio' && (
        <div className="bg-white">
          {filteredBiz.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {filteredBiz.map((biz) => (
                <div key={biz.id} className="px-4 py-3">
                  <div className="flex gap-3">
                    <Link href={`/businesses/${biz.id}`} className="shrink-0">
                      <div className="w-[140px] h-[140px] rounded-lg overflow-hidden bg-gray-100">
                        <img src={biz.image} alt={biz.name} className="w-full h-full object-cover" />
                      </div>
                    </Link>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <Link href={`/businesses/${biz.id}`} className="flex-1">
                        <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded mb-1.5">
                          {biz.category}
                        </span>
                        <p className="text-[14px] font-medium text-gray-900 leading-snug">{biz.name}</p>
                        <p className="text-[12px] text-gray-400 mt-1 flex items-center gap-0.5">
                          <MapPin size={11} /> {biz.address}
                        </p>
                        <div className="flex items-center gap-0.5 mt-1.5">
                          <Star size={13} className="fill-yellow-400 text-yellow-400" />
                          <span className="text-[13px] font-bold text-gray-900">{biz.rating}</span>
                          <span className="text-[13px] text-gray-400">({biz.reviews})</span>
                        </div>
                        <p className="text-[16px] font-bold text-gray-900 mt-1">
                          {biz.price.toLocaleString()}원~
                        </p>
                      </Link>
                      <div className="flex justify-end">
                        <button onClick={() => removeBiz(biz.id)} className="p-1 active:scale-90 transition-transform">
                          <Heart size={22} className="fill-red-400 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="찜한 웨딩파트너가 없습니다" linkText="웨딩파트너 찾아보기" linkHref="/businesses" />
          )}
        </div>
      )}

      {/* 최근 본 탭 */}
      {activeTab === 'recent' && (
        <div className="bg-white">
          {recentPros.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {recentPros.map((pro) => (
                <SwipeToDelete key={pro.id} onDelete={() => {
                  setRecentPros((prev) => prev.filter((p) => p.id !== pro.id));
                  try {
                    const stored = JSON.parse(localStorage.getItem('viewed-pros') || '[]');
                    localStorage.setItem('viewed-pros', JSON.stringify(stored.filter((v: { id: string }) => v.id !== pro.id)));
                  } catch {}
                }}>
                  <ProCard pro={pro} />
                </SwipeToDelete>
              ))}
            </div>
          ) : (
            <EmptyState message="최근 본 전문가가 없습니다" linkText="전문가 찾아보기" linkHref="/pros" />
          )}
        </div>
      )}
    </div>
  );
}

function ProCard({ pro, onRemove }: { pro: { id: string; name: string; category: string; badge: string; intro: string; rating: number; reviews: number; image: string; price: number; subName: string }; onRemove?: (id: string) => void }) {
  return (
    <div className="px-4 py-3">
      <div className="flex gap-3">
        <Link href={`/pros/${pro.id}`} className="shrink-0">
          <div className="w-[105px] h-[140px] rounded-lg overflow-hidden bg-gray-100">
            <img src={pro.image} alt={pro.name} className="w-full h-full object-cover" />
          </div>
        </Link>
        <div className="flex-1 min-w-0 flex flex-col">
          <Link href={`/pros/${pro.id}`} className="flex-1">
            <p className="text-[16px] font-bold text-gray-900">{pro.category} {pro.name}</p>
            <div className="flex items-center gap-0.5 mt-1">
              <Star size={13} className="fill-yellow-400 text-yellow-400" />
              <span className="text-[13px] font-bold text-gray-900">{pro.rating}</span>
              <span className="text-[13px] text-gray-400">({pro.reviews})</span>
            </div>
            <p className="text-[15px] font-bold text-gray-900 mt-1">{pro.price.toLocaleString()}원~</p>
            <p className="text-[13px] text-gray-500 mt-2 line-clamp-2 leading-snug">&ldquo;{pro.intro}&rdquo;</p>
          </Link>
          {onRemove && (
            <div className="flex justify-end mt-auto">
              <button onClick={() => onRemove(pro.id)} className="p-1 active:scale-90 transition-transform">
                <Heart size={22} className="fill-red-400 text-red-400" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProCardSkeleton() {
  return (
    <div className="px-4 py-3">
      <div className="flex gap-3">
        <div className="w-[105px] h-[140px] rounded-lg bg-gray-200 animate-pulse shrink-0" />
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="h-4 w-28 bg-gray-200 rounded-full animate-pulse" />
          <div className="flex items-center gap-0.5 mt-2">
            <div className="h-3 w-20 bg-gray-100 rounded-full animate-pulse" />
          </div>
          <div className="h-4 w-24 bg-gray-200 rounded-full animate-pulse mt-2" />
          <div className="h-3 w-full bg-gray-100 rounded-full animate-pulse mt-3" />
          <div className="h-3 w-3/4 bg-gray-100 rounded-full animate-pulse mt-1.5" />
        </div>
      </div>
    </div>
  );
}

function SwipeToDelete({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const startX = useRef(0);
  const [offsetX, setOffsetX] = useState(0);
  const [swiped, setSwiped] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; };
  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = startX.current - e.touches[0].clientX;
    if (diff > 0) setOffsetX(Math.min(diff, 80));
  };
  const handleTouchEnd = () => {
    if (offsetX > 50) { setSwiped(true); setOffsetX(80); }
    else { setSwiped(false); setOffsetX(0); }
  };

  return (
    <div className="relative overflow-hidden">
      <div
        className="absolute right-0 top-0 bottom-0 w-[80px] flex items-center justify-center bg-red-500"
        onClick={onDelete}
      >
        <Trash2 size={20} className="text-white" />
      </div>
      <div
        className="relative bg-white transition-transform"
        style={{ transform: `translateX(-${offsetX}px)`, transition: offsetX === 0 || swiped ? 'transform 0.2s ease' : 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

function EmptyState({ message, linkText, linkHref }: { message: string; linkText: string; linkHref: string }) {
  return (
    <div className="flex flex-col items-center py-24 text-gray-400">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mb-3">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#FBBF24"/>
      </svg>
      <p className="text-[14px]">{message}</p>
      <Link href={linkHref} className="text-[13px] text-blue-500 font-medium mt-2">{linkText}</Link>
    </div>
  );
}
