import { notFound } from 'next/navigation';
import NaverMapLab from './NaverMapLab';

// 개발용 네이버 지도 실험실(261012 사장 '네이버 다이나믹맵 전부 다 적용') — 지도 칸(NaverMap)의 모드 · 실패 사다리를 한 화면에서 본다.
//  · 운영(NODE_ENV=production — Vercel 운영 · 미리보기 둘 다)에선 404. 검색 노출도 막는다.
//  · 헤드리스 확인 스크립트 = scratchpad/nmap/lab.mjs (인증 성공 흉내 · 잘못된 키 · 그림 차단 등).
export const metadata = { robots: { index: false, follow: false } };

export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <NaverMapLab />;
}
