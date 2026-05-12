import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Vercel Cron이 5분마다 호출 — Railway 백엔드가 sleep 상태면 이 요청으로 깨어남.
// 실제 DB 쿼리까지 돌아야 connection pool도 warm 되므로 /health 대신 인증 불필요한 엔드포인트 사용.
export async function GET() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (!apiUrl) {
    return NextResponse.json({ ok: false, reason: 'no api url' }, { status: 500 });
  }

  try {
    const res = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(12000),
    });
    return NextResponse.json({ ok: res.ok, status: res.status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, reason: e?.message }, { status: 200 });
  }
}
