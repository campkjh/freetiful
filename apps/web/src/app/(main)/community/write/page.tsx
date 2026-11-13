import { redirect } from 'next/navigation';

// 옛 글쓰기 화면은 닫았다(261113 사장) — 웨딩숲에서 바로 새 글쓰기 칸을 연다(CommunityClient 의 ?compose=1).
export default function CommunityWritePage() {
  redirect('/community?compose=1');
}
