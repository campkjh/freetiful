'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Search, X, Star, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/lib/store/auth.store';
import { discoveryApi, type ProListItem } from '@/lib/api/discovery.api';

const MOCK_PROS = [
  { id: '1', name: '강도현', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 117, image: '/images/강도현/10000133881772850005043.avif', intro: '신뢰감 있는 보이스의 현직 아나운서', price: 500000 },
  { id: '2', name: '김동현', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 165, image: '/images/김동현/10000365351773046135169.avif', intro: 'MC 김동현', price: 400000 },
  { id: '3', name: '김민지', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 96, image: '/images/김민지/IMG_06781773894450803.avif', intro: '꼼꼼하고 부드러운 진행', price: 550000 },
  { id: '4', name: '김솔', category: 'MC', role: '사회자', region: '전국', rating: 4.7, reviews: 36, image: '/images/김솔/IMG_23601771788594274.avif', intro: '자연스럽고 편안한 분위기의 웨딩 전문 MC', price: 450000 },
  { id: '5', name: '김유석', category: 'MC', role: '사회자', region: '전국', rating: 4.7, reviews: 65, image: '/images/김유석/10000029811773033474612.avif', intro: '최고의 진행자 아나운서 김유석', price: 550000 },
  { id: '6', name: '김재성', category: 'MC', role: '사회자', region: '충청', rating: 4.5, reviews: 235, image: '/images/김재성/10000602271772960706687.avif', intro: '순간을 기억으로 만드는 사회자', price: 450000 },
  { id: '7', name: '김진아', category: 'MC', role: '사회자', region: '경상', rating: 4.6, reviews: 170, image: '/images/김진아/IMG_53011772965035335.avif', intro: '아나운서 김진아', price: 300000 },
  { id: '8', name: '김호중', category: 'MC', role: '사회자', region: '전라', rating: 4.6, reviews: 232, image: '/images/김호중/0DBA6E02-BBC8-4660-8464-5B5162FAD2461773045822216.avif', intro: '기획에서 진행까지, 무대를 완성하다', price: 300000 },
  { id: '9', name: '나연지', category: 'MC', role: '사회자', region: '강원', rating: 4.9, reviews: 239, image: '/images/나연지/Facetune_10-02-2026-21-07-511772438130235.avif', intro: '공식행사 전문 MC', price: 300000 },
  { id: '10', name: '노유재', category: 'MC', role: '사회자', region: '제주', rating: 4.7, reviews: 197, image: '/images/노유재/10000016211774440274171.avif', intro: '신뢰와 감동이 공존하는 진행', price: 600000 },
  { id: '11', name: '도준석', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 163, image: '/images/도준석/1-1231772850030951.avif', intro: '격 있는 사회자', price: 550000 },
  { id: '12', name: '문정은', category: 'MC', role: '사회자', region: '서울/경기', rating: 5.0, reviews: 242, image: '/images/문정은/IMG_27221772621229571.avif', intro: '품격있고 고급스러운 진행', price: 550000 },
  { id: '13', name: '박상설', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 43, image: '/images/박상설/10000077391773050357628.avif', intro: '10년 경력, 2000번의 행사 경력', price: 600000 },
  { id: '14', name: '박은결', category: 'MC', role: '사회자', region: '전국', rating: 4.6, reviews: 156, image: '/images/박은결/IMG_02661773035503788.avif', intro: '아나운서 사회자 박은결', price: 550000 },
  { id: '15', name: '박인애', category: 'MC', role: '사회자', region: '전국', rating: 4.6, reviews: 119, image: '/images/박인애/IMG_0196.avif', intro: '13년 생방송 뉴스 진행으로 다져진 품격', price: 550000 },
  { id: '16', name: '박주은', category: 'MC', role: '사회자', region: '충청', rating: 4.8, reviews: 225, image: '/images/박주은/IMG_01621772973118334.avif', intro: 'SBS Sports 아나운서', price: 450000 },
  { id: '17', name: '배유정', category: 'MC', role: '사회자', region: '경상', rating: 4.8, reviews: 92, image: '/images/배유정/IMG_21541773026472716.avif', intro: '믿고 맡기는 행사', price: 550000 },
  { id: '18', name: '성연채', category: 'MC', role: '사회자', region: '전라', rating: 4.7, reviews: 241, image: '/images/성연채/20161016_161406_IMG_5921.avif', intro: '따뜻하고 다정한 아나운서', price: 500000 },
  { id: '19', name: '송지은', category: 'MC', role: '사회자', region: '강원', rating: 4.8, reviews: 86, image: '/images/송지은/DE397232-C3A6-4FD0-80C8-0251D66A66AF1772092441240.avif', intro: '믿고 맡기는 아나운서', price: 350000 },
  { id: '20', name: '유하늘', category: 'MC', role: '사회자', region: '제주', rating: 4.9, reviews: 34, image: '/images/유하늘/D54BC1BA-3BF2-4827-AA76-096D4056BCDB1773030157943.avif', intro: '따뜻하고 사랑스러운 결혼식 전문 사회자', price: 550000 },
  { id: '21', name: '유하영', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 54, image: '/images/유하영/22712e20f03327c2843673c063c881f432f6af591772967031477.avif', intro: 'KBS 캐스터 유하영', price: 300000 },
  { id: '22', name: '이강문', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 210, image: '/images/이강문/10000353831773035180593.avif', intro: '10년 베테랑 사회자의 안정적인 진행', price: 350000 },
  { id: '23', name: '이승진', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 133, image: '/images/이승진/IMG_46511771924269213.avif', intro: '따뜻하고 깔끔한 진행의 사회자', price: 500000 },
  { id: '24', name: '이용석', category: 'MC', role: '사회자', region: '전국', rating: 4.9, reviews: 117, image: '/images/이용석/10001176941772847263491.avif', intro: '1000회 이상 결혼식사회 경력', price: 600000 },
  { id: '25', name: '이우영', category: 'MC', role: '사회자', region: '전국', rating: 4.7, reviews: 222, image: '/images/이우영/2-11772248201484.avif', intro: '현직 아나운서의 고품격 진행', price: 400000 },
  { id: '26', name: '이원영', category: 'MC', role: '사회자', region: '충청', rating: 4.5, reviews: 94, image: '/images/이원영/1-1231772531708677.avif', intro: 'KBS 춘천방송총국 기상캐스터', price: 350000 },
  { id: '27', name: '이재원', category: 'MC', role: '사회자', region: '경상', rating: 4.9, reviews: 24, image: '/images/이재원/17230390916981773388202648.avif', intro: '영어MC / 영어아나운서 이재원', price: 400000 },
  { id: '28', name: '이한나', category: 'MC', role: '사회자', region: '전라', rating: 4.6, reviews: 68, image: '/images/이한나/IMG_002209_01772081523241.avif', intro: '생방송 4년차, 현직 아나운서', price: 350000 },
  { id: '29', name: '임하람', category: 'MC', role: '사회자', region: '강원', rating: 4.8, reviews: 166, image: '/images/임하람/10000118841772968813129.avif', intro: '남들과 다른 특별한 예식을 진행', price: 300000 },
  { id: '30', name: '장윤영', category: 'MC', role: '사회자', region: '제주', rating: 4.8, reviews: 225, image: '/images/장윤영/IMG_27051772976548211.avif', intro: '아나운서 장윤영', price: 300000 },
  { id: '31', name: '전해별', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.5, reviews: 201, image: '/images/전해별/025209A2-09A8-4777-9A6A-DF4751F560A71772850104015.avif', intro: '탄탄한 발성의 아나운서', price: 500000 },
  { id: '32', name: '전혜인', category: 'MC', role: '사회자', region: '서울/경기', rating: 5.0, reviews: 152, image: '/images/전혜인/IMG_19181773027236141.avif', intro: '믿고 맡기는 아나운서 전혜인', price: 600000 },
  { id: '33', name: '정미정', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 48, image: '/images/정미정/0533d0a3d5f361ad511e32dafb775319b26ce7541772100346528.avif', intro: '경력 13년차 아나운서 및 사회자', price: 550000 },
  { id: '34', name: '정애란', category: 'MC', role: '사회자', region: '전국', rating: 4.9, reviews: 226, image: '/images/정애란/IMG_2920.avif', intro: '임기응변에 강한 따뜻한 목소리', price: 300000 },
  { id: '35', name: '정이현', category: 'MC', role: '사회자', region: '전국', rating: 4.8, reviews: 129, image: '/images/정이현/44561772622988798.avif', intro: '10년차 전문 사회자', price: 600000 },
  { id: '36', name: '조하늘', category: 'MC', role: '사회자', region: '충청', rating: 4.9, reviews: 152, image: '/images/조하늘/IMG_27041773036338469.avif', intro: '아이돌 같은 아나운서 조하늘', price: 350000 },
  { id: '37', name: '최진선', category: 'MC', role: '사회자', region: '경상', rating: 4.9, reviews: 204, image: '/images/최진선/10001059551772371340253.avif', intro: '최진선', price: 550000 },
  { id: '38', name: '한가람', category: 'MC', role: '사회자', region: '전라', rating: 4.7, reviews: 62, image: '/images/한가람/IMG_34281772111635068.avif', intro: '고급스럽고 따뜻한 보이스 사회자', price: 550000 },
  { id: '39', name: '함현지', category: 'MC', role: '사회자', region: '강원', rating: 4.6, reviews: 115, image: '/images/함현지/11773004544652.avif', intro: '깔끔하고 격식있는 진행', price: 450000 },
  { id: '40', name: '허수빈', category: 'MC', role: '사회자', region: '제주', rating: 5.0, reviews: 97, image: '/images/허수빈/IMG_01991772961130928.avif', intro: '센스와 따뜻한 진행의 전문 사회자', price: 300000 },
  { id: '41', name: '홍현미', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 222, image: '/images/홍현미/IMG_12201772513865121.avif', intro: '정부/기업 공식행사 전문아나운서', price: 450000 },
];

const RECENT_SEARCHES_KEY = 'freetiful_recent_searches';

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  const recent = getRecentSearches().filter((s) => s !== query);
  recent.unshift(query);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, 10)));
}

function clearRecentSearches() {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
}

export default function SearchPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [apiResults, setApiResults] = useState<ProListItem[]>([]);
  const [isApiSearching, setIsApiSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
    inputRef.current?.focus();
  }, []);

  const q = query.trim().toLowerCase();

  // Debounced API search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (q.length === 0) { setApiResults([]); return; }
    searchTimerRef.current = setTimeout(() => {
      setIsApiSearching(true);
      discoveryApi.getProList({ search: q })
        .then((res) => { setApiResults(res.data || []); })
        .catch(() => { /* fallback to local filter */ })
        .finally(() => setIsApiSearching(false));
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [q]);

  // Use API results if available, otherwise fall back to local mock filter
  const localResults = q.length > 0
    ? MOCK_PROS.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.intro.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.region.includes(q)
      )
    : [];

  const results = apiResults.length > 0
    ? apiResults.map((p) => ({
        id: p.id,
        name: p.name,
        category: 'MC',
        role: '사회자',
        region: '',
        rating: p.avgRating,
        reviews: p.reviewCount,
        image: p.profileImageUrl || p.images?.[0] || '',
        intro: p.shortIntro,
        price: p.basePrice,
      }))
    : localResults;

  const handleSearch = () => {
    if (q.length > 0) {
      saveRecentSearch(query.trim());
      setRecentSearches(getRecentSearches());
      setHasSearched(true);
    }
  };

  const handleRecentClick = (s: string) => {
    setQuery(s);
    setHasSearched(true);
    saveRecentSearch(s);
    setRecentSearches(getRecentSearches());
  };

  const handleClearRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  return (
    <div className="min-h-screen bg-white" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100">
        <div className="h-[52px] flex items-center px-4 gap-3">
          <button onClick={() => router.back()} className="p-1 -ml-2 shrink-0 active:scale-90 transition-transform">
            <ChevronLeft size={24} className="text-gray-800" />
          </button>
          <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHasSearched(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="이름, 소개, 카테고리로 검색"
              className="flex-1 bg-transparent text-[15px] text-gray-900 placeholder-gray-400 outline-none"
            />
            {query && (
              <button onClick={() => { setQuery(''); setHasSearched(false); }} className="p-0.5">
                <X size={16} className="text-gray-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pb-24">
        {/* Live results or searched results */}
        {q.length > 0 ? (
          results.length > 0 ? (
            <div>
              <p className="px-4 py-3 text-[13px] text-gray-500">
                검색결과 <span className="font-bold text-gray-900">{results.length}</span>명
              </p>
              <div className="divide-y divide-gray-100">
                {results.map((pro, i) => (
                  <motion.div
                    key={pro.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                  >
                    <Link href={`/pros/${pro.id}`} className="block px-4 py-3">
                      <div className="flex gap-3">
                        <div className="w-[80px] h-[106px] rounded-lg overflow-hidden bg-gray-100 shrink-0">
                          <img src={pro.image} alt={pro.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[16px] font-bold text-gray-900">{pro.role} {pro.name}</p>
                          <div className="flex items-center gap-0.5 mt-1">
                            <Star size={13} className="fill-yellow-400 text-yellow-400" />
                            <span className="text-[13px] font-bold text-gray-900">{pro.rating}</span>
                            <span className="text-[13px] text-gray-400">({pro.reviews})</span>
                          </div>
                          <p className="text-[15px] font-bold text-gray-900 mt-1">{pro.price.toLocaleString()}원~</p>
                          <p className="text-[13px] text-gray-500 mt-1 line-clamp-2 leading-snug">&ldquo;{pro.intro}&rdquo;</p>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-20">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-gray-100">
                <Search size={28} className="text-gray-300" />
              </div>
              <p className="text-gray-400 text-[14px]">&ldquo;{query}&rdquo;에 대한 검색 결과가 없습니다</p>
            </div>
          )
        ) : (
          /* Recent Searches */
          <div className="px-4 pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[14px] font-bold text-gray-900">최근 검색어</p>
              {recentSearches.length > 0 && (
                <button onClick={handleClearRecent} className="text-[12px] text-gray-400">
                  전체 삭제
                </button>
              )}
            </div>
            {recentSearches.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((s, i) => (
                  <motion.button
                    key={`${s}-${i}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => handleRecentClick(s)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 rounded-full text-[13px] text-gray-600 font-medium active:scale-95 transition-transform"
                  >
                    <Clock size={12} className="text-gray-400" />
                    {s}
                  </motion.button>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-gray-400 py-4">최근 검색어가 없습니다</p>
            )}

            {/* Popular suggestions */}
            <div className="mt-8">
              <p className="text-[14px] font-bold text-gray-900 mb-3">인기 검색어</p>
              <div className="flex flex-wrap gap-2">
                {['결혼식', '아나운서', '따뜻한', '서울', '웨딩'].map((s, i) => (
                  <button
                    key={s}
                    onClick={() => handleRecentClick(s)}
                    className="px-3 py-2 bg-blue-50 rounded-full text-[13px] text-blue-600 font-medium active:scale-95 transition-transform"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
