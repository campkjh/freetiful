'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronDown, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

const FAQ_DATA = [
  {
    category: '서비스 이용',
    items: [
      { q: '프리티풀은 어떤 서비스인가요?', a: '프리티풀은 웨딩 MC, 가수, 쇼호스트 등 결혼식 전문가를 쉽고 빠르게 매칭해주는 플랫폼입니다. AI 기반 매칭 시스템으로 고객님의 취향에 맞는 전문가를 추천해드립니다.' },
      { q: '전문가에게 어떻게 문의하나요?', a: '전문가 프로필 페이지에서 "문의하기" 버튼을 누르면 채팅방이 생성됩니다. 채팅을 통해 견적을 받고 상세 상담을 진행할 수 있습니다.' },
      { q: '매칭 요청은 어떻게 하나요?', a: '홈 화면 또는 하단 "견적요청" 탭에서 원하는 카테고리와 조건을 선택하면 AI가 적합한 전문가를 매칭해드립니다.' },
    ],
  },
  {
    category: '결제/환불',
    items: [
      { q: '결제는 어떻게 진행되나요?', a: '전문가가 보낸 견적서에서 "결제하기" 버튼을 누르면 결제 페이지로 이동합니다. 카카오페이, 신용카드, 계좌이체 등 다양한 결제 수단을 지원합니다.' },
      { q: '에스크로 결제란 무엇인가요?', a: '결제 금액을 프리티풀이 안전하게 보관한 뒤, 행사 완료 확인 후 전문가에게 정산하는 방식입니다. 고객님의 결제를 안전하게 보호합니다.' },
      { q: '환불은 어떻게 하나요?', a: '행사일 7일 전까지 전액 환불 가능합니다. 7일~3일 전까지는 50% 환불, 3일 이내 및 당일은 환불이 불가합니다. 마이페이지 > 결제내역에서 환불 신청이 가능합니다.' },
    ],
  },
  {
    category: '계정',
    items: [
      { q: '소셜 로그인은 어떤 것을 지원하나요?', a: '카카오, 구글, 네이버, 애플 로그인을 지원합니다.' },
      { q: '회원 탈퇴는 어떻게 하나요?', a: '마이페이지 > 설정 > 회원탈퇴에서 탈퇴할 수 있습니다. 탈퇴 후 30일간 데이터가 보관되며, 이후 영구 삭제됩니다.' },
    ],
  },
];

export default function FaqPage() {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = FAQ_DATA.map((s) => s.category);

  const filtered = FAQ_DATA.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      const q = search.toLowerCase();
      const matchSearch = !search || item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q);
      const matchCategory = !activeCategory || section.category === activeCategory;
      return matchSearch && matchCategory;
    }),
  })).filter((s) => s.items.length > 0);

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
        {filtered.map((section) => (
          <div key={section.category}>
            <p className="text-[11px] font-bold tracking-wider text-gray-400 uppercase mb-2 px-1">{section.category}</p>
            <div className="space-y-2">
              {section.items.map((item, idx) => {
                const id = `${section.category}-${idx}`;
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
                        {item.q}
                      </span>
                      <ChevronDown
                        size={18}
                        className={`text-gray-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    <div
                      className="overflow-hidden transition-all duration-400 ease-out"
                      style={{
                        maxHeight: isOpen ? 300 : 0,
                        opacity: isOpen ? 1 : 0,
                      }}
                    >
                      <div className="px-4 pb-4">
                        <div className="bg-gray-50 rounded-xl px-4 py-3.5 text-[13px] text-gray-600 leading-[1.8]">
                          {item.a}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[14px] text-gray-400">검색 결과가 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
