// 웨딩런 랭킹 API 앞 미들웨어(261011 사장 '웨딩런' 랭킹 — 검증 high: 서버의 WR_PROXY_SECRET 을 붙일 길이 없었다)
//  · 같은 출처 /api/v1/game/** 만(matcher) — 다른 화면·API 에는 끼지 않는다. 그 뒤는 next.config.js rewrites 가 Railway API 로 넘긴다.
//  · 웹(Vercel)에 WR_PROXY_SECRET 이 있으면 요청 머리글에 x-wr-proxy(비밀) + x-wr-client-ip(Vercel 이 정한 손님 IP)를 붙인다.
//    API(apps/api/src/game/game-ip.ts)는 비밀이 맞을 때만 그 IP 를 믿는다 → x-forwarded-for 위조로 속도 제한·열린 판 상한을 비켜 가지 못함.
//    손님이 보낸 x-wr-client-ip·x-wr-proxy 는 덮어쓴다(위조 불가). 바꾼 요청 머리글은 응답으로 나가지 않는다(비밀 노출 없음).
//  · 비밀이 없으면 아무것도 하지 않는다(지금 운영 = 예전 동작 그대로).
//  ⚠ 켜는 순서: ① Vercel 에 WR_PROXY_SECRET 설정·배포 → 게임 API 응답 머리글 X-WR-IP-Mode 가 'legacy+proxy' 인지 확인
//     → ② Railway API 에 같은 값 → 'trusted' 확인. ②를 먼저 하면 모든 손님이 한 칸으로 묶여 429.
import { NextResponse, type NextRequest } from 'next/server';

export const config = {
  matcher: ['/api/v1/game/:path*'],
};

export function middleware(req: NextRequest) {
  const secret = (process.env.WR_PROXY_SECRET || '').trim();
  if (!secret) return NextResponse.next();
  const headers = new Headers(req.headers);
  // Vercel: req.ip(= x-real-ip) · x-forwarded-for 는 Vercel 이 손님 값으로 덮어쓴다
  const ip = (req.ip || req.headers.get('x-real-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0] || '').trim().slice(0, 64);
  headers.set('x-wr-proxy', secret);
  if (ip) headers.set('x-wr-client-ip', ip);
  else headers.delete('x-wr-client-ip');
  return NextResponse.next({ request: { headers } });
}
