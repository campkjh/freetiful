import { NextRequest, NextResponse } from 'next/server';

// NCP Naver OAuth — 백엔드 NAVER_CLIENT_ID 와 동일해야 한다.
// 이전엔 잘못된 client_id 가 들어가있어 token 교환이 항상 실패하고
// fallback (backend code login) 으로만 동작했다. naver 가 code 를 한 번만
// 허용하기 때문에 fallback 도 종종 실패해 웹 로그인이 안 되는 원인이었다.
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || 'R4WM7ZyC8hHuE_O7qLdy';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || 'dmDCW1zGye';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const code = typeof body?.code === 'string' ? body.code : '';
  const state = typeof body?.state === 'string' ? body.state : '';
  if (!code || !state) {
    return NextResponse.json({ message: 'Invalid Naver OAuth request' }, { status: 400 });
  }

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: NAVER_CLIENT_ID,
    client_secret: NAVER_CLIENT_SECRET,
    code,
    state,
  });

  const res = await fetch(`https://nid.naver.com/oauth2.0/token?${params.toString()}`, {
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    return NextResponse.json({ message: 'Naver token exchange failed' }, { status: res.ok ? 502 : res.status || 502 });
  }

  return NextResponse.json({ accessToken: data.access_token });
}
