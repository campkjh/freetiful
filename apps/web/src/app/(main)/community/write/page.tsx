import { redirect } from 'next/navigation';

// 정적으로 구우면 Location 없는 307 본문만 나가 브라우저가 한 박자 늦게 넘어간다 — 요청마다 진짜 307 로
export const dynamic = 'force-dynamic';

// 옛 글쓰기 화면은 닫았다(261113 사장) — 웨딩숲에서 바로 새 글쓰기 칸을 연다(CommunityClient 의 ?compose=1).
export default function CommunityWritePage() {
  redirect('/community?compose=1');
}
