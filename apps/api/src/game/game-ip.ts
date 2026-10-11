import { timingSafeEqual } from 'crypto';

/**
 * 웨딩런 요청자 IP(261011 랭킹 API 검증 보강 — x-forwarded-for 위조로 속도 제한을 비켜 가던 문제).
 *
 * 정상 손님은 모두 웹(Vercel, 같은 출처 /api/v1/** → Next rewrites)을 거친다. Vercel 은 x-forwarded-for 를 실제 손님 IP 로 덮어쓴다.
 * 그런데 Railway 원본 주소는 공개돼 있어 직접 요청하면 x-forwarded-for 를 마음대로 넣을 수 있다. 그래서:
 *  · WR_PROXY_SECRET 이 설정돼 있고 웹이 붙인 머리글 x-wr-proxy 가 그 값과 같으면 → x-forwarded-for 첫 값을 믿는다(trusted).
 *  · 머리글이 없거나 틀리면 → 머리글은 믿지 않고 연결 주소 하나('direct:…')로 묶는다. 웹을 거치지 않은 요청은 전부 한 칸에서
 *    속도 제한·열린 세션 상한을 나눠 쓴다(정상 손님에게는 영향 없음).
 *  · WR_PROXY_SECRET 이 아직 없으면(웹 미들웨어 붙이기 전) 예전처럼 x-forwarded-for 첫 값 — 우회 가능, 서비스가 한 번 경고 로그.
 * 원문 IP 는 저장하지 않는다(해시만 — game.service.ts).
 *
 * (261011 검증 high 반영) 비밀 머리글을 붙이는 길 = 웹 apps/web/src/middleware.ts(matcher /api/v1/game/:path*):
 *   웹에 WR_PROXY_SECRET 이 있으면 x-wr-proxy + x-wr-client-ip(Vercel 이 정한 손님 IP)를 붙여 rewrites 로 넘긴다.
 *   trusted 모드에선 x-wr-client-ip → x-forwarded-for 첫 값 → 연결 주소 순으로 쓴다.
 * ⚠ 켜는 순서: ① 웹(Vercel)에 WR_PROXY_SECRET 설정·배포 → 게임 API 응답 머리글 X-WR-IP-Mode 가 'legacy+proxy' 인지 확인
 *   → ② API(Railway)에 같은 값 설정 → 'trusted' 확인. ①보다 ②를 먼저 하면 모든 손님이 연결 주소 한 칸으로 묶여 429 가 난다.
 */

export const WR_PROXY_HEADER = 'x-wr-proxy';
/** 웹 미들웨어가 붙이는 실제 손님 IP(trusted 일 때만 믿음) */
export const WR_CLIENT_IP_HEADER = 'x-wr-client-ip';

export interface WRClientIp {
  /** 속도 제한·열린 세션 상한에 쓰는 키(해시 전 원문) */
  ip: string | null;
  /** 'trusted' = 웹 비밀 머리글 확인 · 'direct' = 웹을 안 거침(연결 주소로 묶음) · 'legacy' = 비밀 미설정(머리글 그대로 믿음) */
  mode: 'trusted' | 'direct' | 'legacy';
  /** legacy 인데 x-wr-proxy 머리글이 왔다(웹 쪽 비밀은 켜짐 — API 쪽만 켜면 됨). 응답 머리글로 켜는 순서 확인용 */
  proxySeen?: boolean;
}

function headerValue(req: any, name: string): string {
  const v = req?.headers?.[name];
  return (Array.isArray(v) ? v[0] : String(v ?? '')).trim();
}

function firstForwarded(req: any): string {
  return headerValue(req, 'x-forwarded-for').split(',')[0].trim();
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function resolveClientIp(req: any, proxySecret?: string | null): WRClientIp {
  const socketIp = String(req?.socket?.remoteAddress || req?.ip || '').trim() || null;
  const secret = String(proxySecret || '').trim();
  const got = headerValue(req, WR_PROXY_HEADER);
  if (!secret) return { ip: firstForwarded(req) || socketIp, mode: 'legacy', proxySeen: !!got };
  if (got && sameSecret(got, secret)) {
    const client = headerValue(req, WR_CLIENT_IP_HEADER).slice(0, 64);
    return { ip: client || firstForwarded(req) || socketIp, mode: 'trusted' };
  }
  return { ip: `direct:${socketIp || 'unknown'}`, mode: 'direct' };
}
