'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronDown, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { faqApi, type Faq } from '@/lib/api/faq.api';

interface Section {
  category: string;
  items: Faq[];
}

export default function FaqPage() {
  const router = useRouter();
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
    <div className="bg-white min-h-screen max-w-lg mx-auto pb-24" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-gray-100/60">
        <div className="flex items-center px-4 h-[52px]">
          <button onClick={() => router.back()} className="p-1 active:scale-90 transition-transform">
            <ChevronLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="text-[17px] font-bold ml-2 text-gray-900">자주 묻는 질문</h1>
        </div>
      </div>

      {/* 검색 */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="궁금한 내용을 검색해보세요"
            className="w-full bg-gray-100 rounded-full pl-10 pr-9 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-gray-200 placeholder:text-gray-400 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 active:scale-90">
              <X size={16} className="text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* 카테고리 칩 */}
      <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveCategory(null)}
          className={`shrink-0 px-4 py-2 rounded-full text-[13px] font-medium transition-all active:scale-95 ${
            !activeCategory ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          전체
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
            className={`shrink-0 px-4 py-2 rounded-full text-[13px] font-medium transition-all active:scale-95 ${
              activeCategory === cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* FAQ 리스트 */}
      <div className="px-4 pt-2 space-y-5">
        {loading && (
          <div className="text-center py-16">
            <p className="text-[14px] text-gray-400">불러오는 중...</p>
          </div>
        )}
        {!loading && filtered.map((section) => (
          <div key={section.category}>
            <p className="text-[11px] font-bold tracking-wider text-gray-400 uppercase mb-2 px-1">{section.category}</p>
            <div className="space-y-2">
              {section.items.map((item) => {
                const id = item.id;
                const isOpen = openId === id;
                return (
                  <div
                    key={id}
                    className={`rounded-2xl border transition-all duration-300 ${
                      isOpen ? 'border-gray-200 shadow-sm bg-white' : 'border-gray-100 bg-white'
                    }`}
                  >
                    <button
                      onClick={() => setOpenId(isOpen ? null : id)}
                      className="flex items-center justify-between w-full px-4 py-4 text-left active:bg-gray-50 rounded-2xl transition-colors"
                    >
                      <span className={`text-[14px] pr-4 leading-snug ${isOpen ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {item.question}
                      </span>
                      <ChevronDown
                        size={18}
                        className={`text-gray-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    <div
                      className="overflow-hidden transition-all duration-400 ease-out"
                      style={{
                        maxHeight: isOpen ? 9999 : 0,
                        opacity: isOpen ? 1 : 0,
                      }}
                    >
                      <div className="mx-4 border-t border-gray-100" />
                      <p className="px-4 pt-3 pb-4 text-[13px] text-gray-500 leading-[1.8] whitespace-pre-line">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[14px] text-gray-400">
              {faqs.length === 0 ? '등록된 FAQ가 없습니다' : '검색 결과가 없습니다'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
