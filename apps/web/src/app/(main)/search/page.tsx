'use client';

// 검색 — 260926 사장 "검색 부분도 디자인·인터랙션 다". 웨딩숲 톤(토스 계층) + 퀵매칭 등장.
//  · 들어올 때: 홈 오른쪽 위 돋보기가 검색칸으로 벌어지듯 칸이 오른쪽에서 왼쪽으로 늘어나고(.srch-field),
//    아래 칸(최근 검색·추천 검색어)이 차례로 떠오른다.
//  · 결과 줄은 새로 생긴 것만 오른쪽→왼쪽으로 스르륵(같은 사람은 타자 칠 때마다 다시 움직이지 않는다), 일치 글자는 파랑 굵게.
//  · 최근 검색은 칩(× 로 하나씩 — 오그라들며 사라짐), 추천 검색어는 사회자들이 실제로 단 행사 태그(260926 운영 데이터 기준).
//  · 결과를 굴리면 키보드를 내린다. 결과를 누르면 그 검색어를 최근 검색에 남긴다.
//  · iOS 앱은 /search 를 네이티브 화면(NativeSearchContent)으로 덮어 이 화면이 안 보인다.
import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowBackIcon } from '@/components/icons/chat';
import { SearchIcon, CloseIcon, ClockIcon } from '@/components/icons/mono';
import { EmptySearchIcon } from '@/components/icons/color';
import { highlightText } from '@/lib/highlight-text';
import { discoveryApi, getCachedProList, getCachedProSearchPool, type ProListItem } from '@/lib/api/discovery.api';

const RECENT_SEARCHES_KEY = 'freetiful_recent_searches';
const SEARCH_INDEX_PARAMS = { limit: 100, sort: 'reviews' as const, withTotal: false, realtime: true };
const SEARCH_RESULT_LIMIT = 30;
// 추천 검색어 — 사회자들이 단 행사 태그 중 많은 것 + 영어 진행(운영 데이터 260926: 기업행사 42·결혼식 41·컨퍼런스 37·송년회 28 …)
const SUGGESTED_KEYWORDS = ['결혼식', '기업행사', '돌잔치', '송년회', '컨퍼런스', '레크리에이션', '체육대회', '팀빌딩', '쇼호스트', '영어'];

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
    return Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : [];
  } catch {
    return [];
  }
}

function writeRecentSearches(list: string[]) {
  try {
    if (list.length === 0) localStorage.removeItem(RECENT_SEARCHES_KEY);
    else localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list.slice(0, 10)));
  } catch { /* 저장 못 해도 검색은 된다 */ }
}

function saveRecentSearch(query: string) {
  const q = query.trim();
  if (!q) return getRecentSearches();
  const next = [q, ...getRecentSearches().filter((s) => s !== q)].slice(0, 10);
  writeRecentSearches(next);
  return next;
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

/** '수도권(서울/인천/경기)' → '수도권', '전국가능' → '전국' */
function shortRegion(region?: string) {
  const r = String(region || '').replace(/\(.*?\)/g, '').trim();
  return r === '전국가능' ? '전국' : r;
}

/** 결과 줄 태그 — 검색어와 맞는 태그 먼저, 최대 3개 */
function resultTags(pro: ProListItem, q: string) {
  const tags = [...(pro.tags || []), ...(pro.languages || []).filter((l) => /[가-힣]/.test(l)).map((l) => `${l} 진행`)];
  const uniq = Array.from(new Set(tags.filter(Boolean)));
  const hit = uniq.filter((t) => t.toLowerCase().includes(q));
  const rest = uniq.filter((t) => !t.toLowerCase().includes(q));
  return [...hit, ...rest].slice(0, 3).map((t) => ({ label: t, hit: t.toLowerCase().includes(q) }));
}

export default function SearchPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const requestSeqRef = useRef(0);
  const localResultCountRef = useRef(0);
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [clearingAll, setClearingAll] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchPool, setSearchPool] = useState<ProListItem[]>(() => getCachedProSearchPool());
  const [apiResults, setApiResults] = useState<ProListItem[]>([]);
  const [isApiSearching, setIsApiSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
    inputRef.current?.focus({ preventScroll: true });
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

  // 검색어가 바뀌면 결과 맨 위부터
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [q]);

  const results = useMemo(
    () => mergeProItems(localResults, apiResults).slice(0, SEARCH_RESULT_LIMIT),
    [localResults, apiResults],
  );
  const showEmptyState = q.length > 0 && results.length === 0 && !isApiSearching;

  const remember = (value: string) => {
    if (!value.trim()) return;
    setRecentSearches(saveRecentSearch(value));
  };

  // 칩(최근·추천)을 누르면 그 말로 찾고 키보드는 내린다
  const pick = (value: string) => {
    setQuery(value);
    remember(value);
    inputRef.current?.blur();
  };

  const removeRecent = (value: string) => {
    setRemoving((prev) => new Set(prev).add(value));
    window.setTimeout(() => {
      const next = getRecentSearches().filter((s) => s !== value);
      writeRecentSearches(next);
      setRecentSearches(next);
      setRemoving((prev) => {
        const n = new Set(prev);
        n.delete(value);
        return n;
      });
    }, 220);
  };

  const clearAll = () => {
    setClearingAll(true);
    window.setTimeout(() => {
      writeRecentSearches([]);
      setRecentSearches([]);
      setClearingAll(false);
    }, 240);
  };

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.replace('/main');
  };

  return (
    // 풀스크린 오버레이(fixed inset-0) — 안드 웹뷰에서 (main) 레이아웃/sticky 와 얽혀
    // 폭이 고정되어 보이거나 헤더(뒤로가기)가 가려지던 문제 방지. 채팅 화면과 동일한 견고한 구조.
    <div className="fixed inset-0 z-[60] flex flex-col bg-white" style={{ letterSpacing: '-0.02em' }}>
      {/* 헤더 — 뒤로 · 검색칸(홈 돋보기가 벌어지듯 오른쪽에서 늘어난다) */}
      <div className="shrink-0 bg-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex h-[60px] w-full max-w-[720px] items-center gap-1 pl-1.5 pr-4">
          <button
            type="button"
            onClick={goBack}
            aria-label="뒤로"
            className="srch-back flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#191F28] transition-colors active:bg-[#F2F4F6]"
          >
            <ArrowBackIcon size={24} />
          </button>
          <div className="flex min-w-0 flex-1 justify-end">
            <div className="srch-field relative h-12 w-full overflow-hidden rounded-[14px] bg-[#F2F4F6] transition-colors focus-within:bg-[#EDEFF2]">
              <SearchIcon size={19} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B95A1]" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    remember(query);
                    inputRef.current?.blur();
                  }
                }}
                placeholder="이름, 행사, 지역으로 검색"
                enterKeyHint="search"
                autoComplete="off"
                className="srch-input h-full w-full bg-transparent pl-11 pr-11 text-[17px] font-medium text-[#191F28] outline-none placeholder:font-normal placeholder:text-[#8B95A1] [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); inputRef.current?.focus({ preventScroll: true }); }}
                  aria-label="검색어 지우기"
                  className="srch-clear absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-[#C9CED6] text-white"
                >
                  <CloseIcon size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
        {/* 굴리면 헤더 아래 얇은 선 */}
        <div className={`h-px bg-[#F2F4F6] transition-opacity duration-300 ${scrolled ? 'opacity-100' : 'opacity-0'}`} />
      </div>

      {/* 본문 — 자기 칸에서 굴러간다(바깥이 fixed 라 몸통 스크롤이 안 먹는다) */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        onScroll={(e) => {
          const top = e.currentTarget.scrollTop;
          setScrolled(top > 4);
          if (top > 12 && typeof document !== 'undefined' && document.activeElement === inputRef.current) inputRef.current?.blur();
        }}
      >
        <div className="mx-auto w-full max-w-[720px] pb-28">
          {q.length > 0 ? (
            results.length > 0 ? (
              <>
                <p className="px-5 pb-1 pt-4 text-[15px] text-[#6B7684]">
                  사회자 <b className="font-bold tabular-nums text-[#3182F6]">{results.length}</b>명
                </p>
                <ul>
                  {results.map((pro, i) => {
                    const image = pro.profileImageUrl || pro.images?.[0] || '/images/default-profile.png';
                    const region = shortRegion(pro.regions?.[0]) || (pro.isNationwide ? '전국' : '');
                    const tags = resultTags(pro, q);
                    return (
                      <li key={pro.id} className="srch-row" style={{ animationDelay: `${Math.min(i, 8) * 0.045}s` }}>
                        <Link
                          href={`/pros/${pro.id}`}
                          onClick={() => remember(query)}
                          className="flex gap-4 px-5 py-3.5 transition-colors active:bg-[#F9FAFB] lg:hover:bg-[#FBFCFD]"
                        >
                          <div className="h-[92px] w-[72px] shrink-0 overflow-hidden rounded-[14px] bg-[#F2F4F6]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={image}
                              alt=""
                              className="h-full w-full object-cover"
                              loading={i < 4 ? 'eager' : 'lazy'}
                              decoding="async"
                            />
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <p className="truncate text-[17px] font-bold leading-[1.35] text-[#191F28]">
                              {highlightText(pro.name, q, 'srch-hl')}
                            </p>
                            <p className="mt-1 flex items-center gap-1 text-[14px] text-[#8B95A1]">
                              {pro.reviewCount > 0 ? (
                                <>
                                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
                                    <path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill="#FFC933" />
                                  </svg>
                                  <b className="font-semibold text-[#333D4B]">{Number(pro.avgRating || 0).toFixed(1)}</b>
                                  <span>({pro.reviewCount})</span>
                                </>
                              ) : (
                                <span className="font-semibold text-[#3182F6]">새로 온 사회자</span>
                              )}
                              {pro.careerYears > 0 && (
                                <>
                                  <span className="text-[#D1D6DB]">·</span>
                                  <span>경력 {pro.careerYears}년</span>
                                </>
                              )}
                              {region && (
                                <>
                                  <span className="text-[#D1D6DB]">·</span>
                                  <span className="truncate">{highlightText(region, q, 'srch-hl')}</span>
                                </>
                              )}
                            </p>
                            {tags.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {tags.map((t) => (
                                  <span
                                    key={t.label}
                                    className={`rounded-[6px] px-1.5 py-[3px] text-[12.5px] font-semibold ${
                                      t.hit ? 'bg-[#E8F3FF] text-[#3182F6]' : 'bg-[#F2F4F6] text-[#6B7684]'
                                    }`}
                                  >
                                    {t.label}
                                  </span>
                                ))}
                              </div>
                            )}
                            {pro.shortIntro && (
                              <p className="mt-1.5 line-clamp-1 text-[14.5px] leading-[1.5] text-[#6B7684]">
                                {highlightText(pro.shortIntro, q, 'srch-hl')}
                              </p>
                            )}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : showEmptyState ? (
              <div className="flex flex-col items-center px-8 pt-16 text-center">
                <div className="srch-pop">
                  <EmptySearchIcon size={72} />
                </div>
                <p className="qd-a-title mt-5 text-[18px] font-bold text-[#191F28]">
                  ‘{query.trim()}’ 검색 결과가 없어요
                </p>
                <p className="qd-a-sub mt-1.5 text-[15px] text-[#8B95A1]">이름·행사·지역으로 다시 찾아보세요</p>
                <div className="mt-7 flex flex-wrap justify-center gap-2">
                  {SUGGESTED_KEYWORDS.slice(0, 6).map((k, i) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => pick(k)}
                      className="qd-a-item h-10 rounded-full border border-[#E5E8EB] bg-white px-4 text-[15px] font-medium text-[#333D4B] transition-transform active:scale-95"
                      style={{ animationDelay: `${0.3 + i * 0.05}s` }}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // 찾는 중 — 결과 줄 모양 그대로 반짝이는 자리
              <div className="px-5 pt-5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex gap-4 py-3.5">
                    <div className="skeleton h-[92px] w-[72px] shrink-0 rounded-[14px]" />
                    <div className="flex-1 pt-1">
                      <div className="skeleton h-[18px] w-28 rounded-[6px]" />
                      <div className="skeleton mt-2.5 h-[14px] w-40 rounded-[6px]" />
                      <div className="mt-3 flex gap-1">
                        <div className="skeleton h-[22px] w-14 rounded-[6px]" />
                        <div className="skeleton h-[22px] w-16 rounded-[6px]" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <>
              {/* 최근 검색 */}
              <section className="qd-a-title px-5 pt-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-[18px] font-bold text-[#191F28]">최근 검색</h2>
                  {recentSearches.length > 0 && (
                    <button type="button" onClick={clearAll} className="text-[14px] text-[#8B95A1] transition-opacity active:opacity-60">
                      전체 삭제
                    </button>
                  )}
                </div>
                {recentSearches.length > 0 ? (
                  <div
                    className={`-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${clearingAll ? 'srch-clearing' : ''}`}
                  >
                    {recentSearches.map((s, i) => (
                      <span
                        key={s}
                        className={`srch-chip qd-a-item inline-flex h-10 shrink-0 items-center rounded-full border border-[#E5E8EB] bg-white ${removing.has(s) ? 'is-out' : ''}`}
                        style={{ animationDelay: `${0.14 + i * 0.045}s` }}
                      >
                        <button
                          type="button"
                          onClick={() => pick(s)}
                          className="flex h-full items-center gap-1.5 pl-3.5 pr-1 text-[15px] font-medium text-[#333D4B]"
                        >
                          <ClockIcon size={15} className="shrink-0 text-[#B0B8C1]" />
                          <span className="max-w-[160px] truncate">{s}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRecent(s)}
                          aria-label={`최근 검색어 ${s} 지우기`}
                          className="flex h-full items-center pl-1 pr-3 text-[#B0B8C1] transition-colors active:text-[#6B7684]"
                        >
                          <CloseIcon size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="qd-a-sub mt-3 text-[15px] text-[#8B95A1]">최근에 검색한 기록이 없어요</p>
                )}
              </section>

              {/* 추천 검색어 */}
              <section className="qd-a-sub px-5 pt-9">
                <h2 className="text-[18px] font-bold text-[#191F28]">추천 검색어</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SUGGESTED_KEYWORDS.map((k, i) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => pick(k)}
                      className="qd-a-item h-10 rounded-full bg-[#F2F4F6] px-4 text-[15px] font-medium text-[#333D4B] transition-transform active:scale-95"
                      style={{ animationDelay: `${0.3 + i * 0.04}s` }}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
