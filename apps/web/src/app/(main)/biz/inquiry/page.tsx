'use client';

// 비즈 '문의하기' = 상담 채팅(261009 사장 '문의하기 누르면 문의 섹션으로 슬라이드 이동하지 말고 섹션은 삭제,
// 타임키퍼 키키 상담처럼 문의유형 → 회사명 → 담당자명 → 연락처 → 문의 내용 → 첨부 → 접수 완료. 말풍선은 프리티풀 채팅이랑 똑같이').
//  · 비즈 하단 탭 '문의하기' · 머리줄 · 모든 '문의하기' CTA 가 여기로 온다. 채팅 화면이라 비즈 머리줄(BizHeader) · 하단 탭바는 그리지 않는다
//    (탭바는 BizTabBar 가 이 경로에서 스스로 빠지고, 머리줄은 채팅방식 자기 머리줄 — 뒤로 + '프리티풀 비즈 상담').
//  · 화면 전체는 components/biz/BizInquiryChat.tsx.
import BizInquiryChat from '@/components/biz/BizInquiryChat';

export default function BizInquiryPage() {
  return <BizInquiryChat />;
}
