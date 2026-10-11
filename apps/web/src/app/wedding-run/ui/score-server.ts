// 웨딩런 서버 쪽 도우미(261011 사장 '공유 링크로 들어오면 ○○님의 N점에 도전!') — page.tsx 메타·OG 이미지가 같이 쓴다.
//  · 'use client' 모듈(lib/api/wedding-run.api.ts)을 서버에서 부를 수 없어 운영 API 를 직접 부른다.
//  · 짧게 끊고(1.5초) 실패하면 null → 기본 미리보기·도전 배너 없음(가짜 기록 금지).
//  · (261011 검증 low) 캐시 60초(운영자가 판을 숨기거나 닉네임을 초기화하면 1분 안에 반영) · 요청한 손님 IP 를 같이 넘겨
//    서버 읽기 한도(300/분)를 손님마다 따로 쓰게 한다 — 예전엔 Vercel 출구 IP 한 칸을 나눠 써서, 아무 uuid ?c= 를 두드리면
//    진짜 공유 링크의 미리보기·도전 배너까지 실패했다. (WR_PROXY_SECRET 이 있을 때 API 가 x-wr-client-ip 를 믿음, 없으면 x-forwarded-for)
import type { WrPublicScore } from '@/lib/api/wedding-run.api';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isScoreIdServer(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

function apiOrigin() {
  return (process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || '').replace(/\/+$/, '').replace(/\/api\/v1$/, '').replace(/\/api$/, '');
}

/** 서버 컴포넌트·라우트에서 요청한 손님 IP(Vercel: x-real-ip · x-forwarded-for 첫 값) */
export function clientIpFrom(h: { get(name: string): string | null } | null | undefined): string | null {
  if (!h) return null;
  const v = (h.get('x-real-ip') || (h.get('x-forwarded-for') || '').split(',')[0] || '').trim();
  return v ? v.slice(0, 64) : null;
}

export async function fetchPublicScore(id: string, clientIp?: string | null): Promise<WrPublicScore | null> {
  if (!isScoreIdServer(id)) return null;
  const origin = apiOrigin();
  if (!origin) return null;
  try {
    // 서버끼리 부르는 요청도 웹을 거친 요청으로 표시(WR_PROXY_SECRET 이 있을 때만) — 없으면 Railway 직통 요청과 한 칸에서 읽기 한도를 나눠 씀(261011 통합)
    const proxySecret = (process.env.WR_PROXY_SECRET || '').trim();
    const headers: Record<string, string> = {};
    if (proxySecret) headers['x-wr-proxy'] = proxySecret;
    if (clientIp) {
      headers['x-wr-client-ip'] = clientIp;
      headers['x-forwarded-for'] = clientIp;
    }
    const res = await fetch(`${origin}/api/v1/game/wedding-run/scores/${id}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(1500),
      headers,
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Partial<WrPublicScore> | null;
    if (!j || typeof j.score !== 'number' || typeof j.nickname !== 'string') return null;
    return {
      id: String(j.id || id),
      nickname: j.nickname.slice(0, 24),
      score: Math.max(0, Math.floor(j.score)),
      stage: Math.max(0, Math.min(4, Math.floor(Number(j.stage) || 0))),
      // 2D 판 = 12구간(0~11)
      segment: Math.max(0, Math.min(11, Math.floor(Number(j.segment) || 0))),
      arrived: !!j.arrived,
    };
  } catch {
    return null;
  }
}
