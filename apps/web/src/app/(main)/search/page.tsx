'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Search, X, Star, Clock } from 'lucide-react';
import { discoveryApi, getCachedProList, getCachedProSearchPool, type ProListItem } from '@/lib/api/discovery.api';

const RECENT_SEARCHES_KEY = 'freetiful_recent_searches';
const SEARCH_INDEX_PARAMS = { limit: 100, sort: 'pudding' as const, withTotal: false, realtime: true };
const SEARCH_RESULT_LIMIT = 30;

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

function normalizeSearchText(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function mergeProItems(...groups: ProListItem[][]) {
  const seen = new Set<string>();
  const merged: ProListItem[] = [];
  groups.forEach((items) => {
    items.forEach((item) => {
      if (!item?.id || seen.has(item.id)) return;
      seen.add(item.id);
      merged.push(item);
    });
  });
  return merged;
}

function getSearchText(pro: ProListItem) {
  return [
    pro.name,
    pro.shortIntro,
    pro.mainExperience,
    pro.categories?.join(' '),
    pro.regions?.join(' '),
    pro.tags?.join(' '),
    pro.languages?.join(' '),
  ].filter(Boolean).join(' ').toLowerCase();
}

function scoreProSearch(pro: ProListItem, q: string) {
  const name = normalizeSearchText(pro.name);
  const categories = normalizeSearchText(pro.categories?.join(' '));
  const regions = normalizeSearchText(pro.regions?.join(' '));
  const tags = normalizeSearchText(pro.tags?.join(' '));
  const intro = normalizeSearchText(`${pro.shortIntro || ''} ${pro.mainExperience || ''}`);

  if (name === q) return 100;
  if (name.startsWith(q)) return 90;
  if (name.includes(q)) return 80;
  if (categories.includes(q)) return 70;
  if (tags.includes(q)) return 65;
  if (regions.includes(q)) return 55;
  if (intro.includes(q)) return 45;
  return 0;
}

function filterLocalPros(pool: ProListItem[], q: string) {
  if (!q) return [];
  return pool
    .map((pro) => ({ pro, score: scoreProSearch(pro, q), text: getSearchText(pro) }))
    .filter((item) => item.score > 0 || item.text.includes(q))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.pro.avgRating !== a.pro.avgRating) return b.pro.avgRating - a.pro.avgRating;
      return b.pro.reviewCount - a.pro.reviewCount;
    })
    .map((item) => item.pro)
    .slice(0, SEARCH_RESULT_LIMIT);
}

export default function SearchPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestSeqRef = useRef(0);
  const localResultCountRef = useRef(0);
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchPool, setSearchPool] = useState<ProListItem[]>(() => getCachedProSearchPool());
  const [apiResults, setApiResults] = useState<ProListItem[]>([]);
  const [isApiSearching, setIsApiSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
    inputRef.current?.focus();
    const cachedIndex = getCachedProList(SEARCH_INDEX_PARAMS);
    if (cachedIndex?.data?.length) {
      setSearchPool((prev) => mergeProItems(cachedIndex.data, prev));
    }
    discoveryApi.getProList(SEARCH_INDEX_PARAMS)
      .then((res) => setSearchPool((prev) => mergeProItems(res.data || [], prev)))
      .catch(() => {});
  }, []);

  const q = query.trim().toLowerCase();
  const localResults = useMemo(() => filterLocalPros(searchPool, q), [searchPool, q]);

  useEffect(() => {
    localResultCountRef.current = localResults.length;
  }, [localResults.length]);

  // 캐시 결과를 먼저 보여주고, 서버 검색은 짧게 지연해 뒤에서 보강한다.
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (q.length === 0) {
      requestSeqRef.current += 1;
      setApiResults([]);
      setIsApiSearching(false);
      return;
    }

    const cachedSearch = getCachedProList({ search: q, limit: SEARCH_RESULT_LIMIT, withTotal: false });
    setApiResults(cachedSearch?.data || []);

    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;
    searchTimerRef.current = setTimeout(() => {
      setIsApiSearching(true);
      discoveryApi.getProList({ search: q, limit: SEARCH_RESULT_LIMIT, withTotal: false })
        .then((res) => {
          if (requestSeqRef.current !== requestId) return;
          setApiResults(res.data || []);
        })
        .catch(() => { /* fallback to local filter */ })
        .finally(() => {
          if (requestSeqRef.current === requestId) setIsApiSearching(false);
        });
    }, localResultCountRef.current > 0 ? 120 : 180);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [q]);

  const mergedResults = useMemo(
    () => mergeProItems(localResults, apiResults).slice(0, SEARCH_RESULT_LIMIT),
    [localResults, apiResults],
  );

  const results = mergedResults.map((p) => ({
    id: p.id,
    name: p.name,
    category: 'MC',
    role: '사회자',
    region: '',
    rating: p.avgRating,
    reviews: p.reviewCount,
    image: p.profileImageUrl || p.images?.[0] || '/images/default-profile.svg',
    intro: p.shortIntro,
    price: p.basePrice,
  }));
  const showEmptyState = q.length > 0 && results.length === 0 && !isApiSearching;

  const handleSearch = () => {
    if (q.length > 0) {
      saveRecentSearch(query.trim());
      setRecentSearches(getRecentSearches());
    }
  };

  const handleRecentClick = (s: string) => {
    setQuery(s);
    saveRecentSearch(s);
    setRecentSearches(getRecentSearches());
  };

  const handleClearRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  return (
    <div className="min-h-[100dvh] bg-white" style={{ letterSpacing: '-0.02em' }}>
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
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="이름, 소개, 카테고리로 검색"
              className="flex-1 bg-transparent text-[16px] text-gray-900 placeholder-gray-400 outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')} className="p-0.5">
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
                  <div
                    key={pro.id}
                  >
                    <Link href={`/pros/${pro.id}`} className="block px-4 py-3">
                      <div className="flex gap-3">
                        <div className="w-[80px] h-[106px] rounded-lg overflow-hidden bg-gray-100 shrink-0">
                          <img
                            src={pro.image}
                            alt={pro.name}
                            className="w-full h-full object-cover"
                            loading={i < 4 ? 'eager' : 'lazy'}
                            decoding="async"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[16px] font-bold text-gray-900">{pro.role} {pro.name}</p>
                          <div className="flex items-center gap-0.5 mt-1">
                            <Star size={13} className="fill-yellow-400 text-yellow-400" />
                            <span className="text-[13px] font-bold text-gray-900">{pro.rating}</span>
                            <span className="text-[13px] text-gray-400">({pro.reviews})</span>
                          </div>
                          <p className="text-[15px] font-bold text-gray-900 mt-1">{pro.price ? `${pro.price.toLocaleString()}원~` : '가격 협의'}</p>
                          <p className="text-[13px] text-gray-500 mt-1 line-clamp-2 leading-snug">&ldquo;{pro.intro}&rdquo;</p>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ) : showEmptyState ? (
            <div className="flex flex-col items-center py-20">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-gray-100">
                <Search size={28} className="text-gray-300" />
              </div>
              <p className="text-gray-400 text-[14px]">&ldquo;{query}&rdquo;에 대한 검색 결과가 없습니다</p>
            </div>
          ) : (
            <div className="px-4 py-3 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-[80px] h-[106px] rounded-lg bg-gray-100 shrink-0" />
                  <div className="flex-1 pt-1">
                    <div className="h-4 w-28 rounded bg-gray-100" />
                    <div className="h-3 w-20 rounded bg-gray-100 mt-3" />
                    <div className="h-4 w-24 rounded bg-gray-100 mt-4" />
                    <div className="h-3 w-full rounded bg-gray-100 mt-4" />
                    <div className="h-3 w-2/3 rounded bg-gray-100 mt-2" />
                  </div>
                </div>
              ))}
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
                  <button
                    key={`${s}-${i}`}
                    onClick={() => handleRecentClick(s)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 rounded-full text-[13px] text-gray-600 font-medium active:scale-95 transition-transform"
                  >
                    <Clock size={12} className="text-gray-400" />
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-gray-400 py-4">최근 검색어가 없습니다</p>
            )}

            {/* Popular suggestions */}
            <div className="mt-8">
              <p className="text-[14px] font-bold text-gray-900 mb-3">인기 검색어</p>
              <div className="flex flex-wrap gap-2">
                {['결혼식', '아나운서', '따뜻한', '서울', '웨딩'].map((s) => (
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
