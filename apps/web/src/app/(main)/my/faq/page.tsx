'use client';

import { useState } from 'react';
import { ArrowLeft, ChevronDown } from 'lucide-react';
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

  return (
    <div className="bg-gray-50 min-h-screen max-w-lg mx-auto">
      <div className="flex items-center px-4 h-14 border-b border-gray-100 bg-white sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-1"><ArrowLeft size={22} /></button>
        <h1 className="text-base font-bold ml-3">FAQ</h1>
      </div>

      <div className="p-4 space-y-6">
        {FAQ_DATA.map((section) => (
          <div key={section.category}>
            <h2 className="text-xs font-bold text-primary-500 mb-2 px-1">{section.category}</h2>
            <div className="bg-white rounded-2xl overflow-hidden">
              {section.items.map((item, idx) => {
                const id = `${section.category}-${idx}`;
                const isOpen = openId === id;
                return (
                  <div key={id} className="border-b border-gray-50 last:border-0">
                    <button
                      onClick={() => setOpenId(isOpen ? null : id)}
                      className="flex items-center justify-between w-full px-4 py-3.5 text-left"
                    >
                      <span className="text-sm text-gray-900 pr-4">{item.q}</span>
                      <ChevronDown size={16} className={`text-gray-300 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed bg-gray-50">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
