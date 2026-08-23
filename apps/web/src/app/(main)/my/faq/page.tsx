'use client';

import { useState, useEffect, useMemo } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import Link from 'next/link';
import { ChevronDownIcon, CloseIcon, SearchIcon } from '@/components/icons/mono';
import { EmptySearchIcon } from '@/components/icons/color';
import { MY_CARD, MySectionTitle, MyDetailHeader } from '../_components/detail-ui';
import { faqApi, type Faq } from '@/lib/api/faq.api';

/**
 * 답변 안에 약관 이름이 나오면 눌러서 바로 열 수 있게 링크로 바꾼다.
 *
 * "자세한 내용은 홈화면의 플랫폼 환불규정을 확인해주세요" 같은 답변이 그냥 글자라서,
 * 고객이 규정을 보려면 홈 맨 아래까지 스크롤해 찾아야 했다.
 */
const ANSWER_LINKS: { re: RegExp; href: string }[] = [
  { re: /플랫폼\s?환불\s?규정|환불\s?규정/g, href: '/terms/refund' },
  { re: /서비스\s?이용약관|이용약관/g, href: '/terms/service' },
  { re: /개인정보\s?처리방침|개인정보\s?수집\s?및\s?이용약관/g, href: '/terms/privacy' },
];

function renderAnswer(text: string) {
  const nodes: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest) {
    let best: { index: number; length: number; href: string } | null = null;
    for (const { re, href } of ANSWER_LINKS) {
      re.lastIndex = 0;
      const found = re.exec(rest);
      if (found && found[0] && (!best || found.index < best.index)) {
        best = { index: found.index, length: found[0].length, href };
      }
    }
    if (!best) {
      nodes.push(rest);
      break;
    }
    if (best.index > 0) nodes.push(rest.slice(0, best.index));
    nodes.push(
      <Link
        key={key++}
        href={best.href}
        className="font-bold text-[#3180F7] underline underline-offset-2"
      >
        {rest.slice(best.index, best.index + best.length)}
      </Link>,
    );
    rest = rest.slice(best.index + best.length);
  }
  return nodes;
}

interface Section {
  category: string;
  items: Faq[];
}

export default function FaqPage() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await faqApi.getList();
        setFaqs(data);
      } catch (e) {
        setFaqs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 카테고리별 그룹핑
  const sections: Section[] = useMemo(() => {
    const map = new Map<string, Faq[]>();
    for (const f of faqs) {
      const arr = map.get(f.category) || [];
      arr.push(f);
      map.set(f.category, arr);
    }
    // 각 카테고리 내부 정렬은 서버가 해주지만 안전을 위해 한 번 더
    return Array.from(map.entries()).map(([category, items]) => ({
      category,
      items: items.sort((a, b) => a.displayOrder - b.displayOrder),
    }));
  }, [faqs]);

  const categories = sections.map((s) => s.category);

  const filtered = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const q = search.toLowerCase();
        const matchSearch =
          !search || item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q);
        const matchCategory = !activeCategory || section.category === activeCategory;
        return matchSearch && matchCategory;
      }),
    }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white pb-24" style={{ letterSpacing: '-0.02em' }}>
      <MyDetailHeader title="자주 묻는 질문" />

      {/* 검색 + 카테고리 — 스크롤해도 따라온다 */}
      <div className="sticky top-14 z-10 bg-white px-4 pb-2 pt-1">
        <div className="relative">
          <SearchIcon size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A4ABBA]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="궁금한 내용을 검색해보세요"
            className="h-12 w-full rounded-[14px] bg-[#F2F3F5] pl-11 pr-10 text-[15px] font-medium text-[#2B313D] transition-colors placeholder:font-normal placeholder:text-[#A4ABBA] focus:bg-[#EDEFF2] focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="검색어 지우기"
              className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#A4ABBA] active:bg-[#E4E7EB]"
            >
              <CloseIcon size={15} />
            </button>
          )}
        </div>

        {/* 카테고리 — 회색 트랙 위로 흰 알약이 미끄러진다 */}
        {categories.length > 0 && (
          <LayoutGroup id="faq-category-tabs">
            <div className="scrollbar-hide mt-2 flex gap-1 overflow-x-auto rounded-2xl bg-[#F2F3F5] p-1">
              {[null, ...categories].map((cat) => {
                const on = activeCategory === cat;
                return (
                  <button
                    key={cat ?? 'all'}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`relative flex shrink-0 flex-1 items-center justify-center rounded-[13px] px-3 py-2 text-[13px] transition-colors ${
                      on ? 'font-bold text-[#2B313D]' : 'font-semibold text-[#A4ABBA] hover:text-[#51535C]'
                    }`}
                  >
                    {on && (
                      <motion.span
                        layoutId="faq-category-pill"
                        className="absolute inset-0 rounded-[13px] bg-white shadow-sm"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative whitespace-nowrap">{cat ?? '전체'}</span>
                  </button>
                );
              })}
            </div>
          </LayoutGroup>
        )}
      </div>

      {/* FAQ 리스트 */}
      <div
        key={`${activeCategory ?? 'all'}`}
        className="space-y-5 px-4 pt-2"
        style={{ animation: 'proPageExpand 0.32s cubic-bezier(0.16, 1, 0.3, 1) both' }}
      >
        {loading && (
          <div className="space-y-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[60px] animate-pulse rounded-[24px] bg-[#F7F8FA]" />
            ))}
          </div>
        )}
        {!loading && filtered.map((section) => (
          <div key={section.category}>
            <MySectionTitle>{section.category}</MySectionTitle>
            <div className="space-y-2.5">
              {section.items.map((item) => {
                const id = item.id;
                const isOpen = openId === id;
                return (
                  <div key={id} className={MY_CARD}>
                    <button
                      onClick={() => setOpenId(isOpen ? null : id)}
                      className="flex w-full items-center justify-between rounded-[24px] px-5 py-4 text-left transition-colors active:bg-[#FBFCFD] lg:hover:bg-[#FBFCFD]"
                    >
                      <span className={`pr-4 text-[15px] leading-snug ${isOpen ? 'font-bold text-[#2B313D]' : 'font-semibold text-[#51535C]'}`}>
                        {item.question}
                      </span>
                      <ChevronDownIcon
                        size={18}
                        className={`shrink-0 text-[#C8CEDA] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    <div
                      className="overflow-hidden transition-all duration-400 ease-out"
                      style={{
                        maxHeight: isOpen ? 9999 : 0,
                        opacity: isOpen ? 1 : 0,
                      }}
                    >
                      <div className="mx-5 border-t border-[#F5F6F8]" />
                      <p className="whitespace-pre-line px-5 pb-5 pt-3.5 text-[14px] leading-[1.8] text-[#51535C]">
                        {renderAnswer(item.answer)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {!loading && filtered.length === 0 && (
          <div className={`${MY_CARD} flex flex-col items-center justify-center px-6 py-16 text-center`}>
            <EmptySearchIcon size={64} className="mb-3" />
            <p className="text-[15px] font-bold text-[#2B313D]">
              {faqs.length === 0 ? '등록된 FAQ가 없습니다' : '검색 결과가 없습니다'}
            </p>
            <p className="mt-1.5 text-[13px] text-[#A4ABBA]">
              {faqs.length === 0 ? '준비되는 대로 안내드릴게요.' : '다른 검색어로 찾아보시거나 고객센터로 문의해 주세요.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
