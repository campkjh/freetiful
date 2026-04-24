import { NextRequest, NextResponse } from 'next/server';

const KAKAO_CLIENT_ID = 'dca1b472188890116c81a55eff590885';

function isAllowedRedirectUri(value: string) {
  try {
    const url = new URL(value);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const isFreetiful = url.hostname === 'freetiful.com' || url.hostname === 'www.freetiful.com';
    return (isLocal || isFreetiful) && url.pathname === '/auth/kakao/callback';
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const code = typeof body?.code === 'string' ? body.code : '';
  const redirectUri = typeof body?.redirectUri === 'string' ? body.redirectUri : '';
  if (!code || !isAllowedRedirectUri(redirectUri)) {
    return NextResponse.json({ message: 'Invalid Kakao OAuth request' }, { status: 400 });
  }

  const clientSecret = process.env.KAKAO_CLIENT_SECRET;
  if (!clientSecret) {
    return NextResponse.json({ message: 'Kakao OAuth secret is not configured' }, { status: 501 });
  }

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: KAKAO_CLIENT_ID,
    redirect_uri: redirectUri,
    code,
  });
  params.set('client_secret', clientSecret);

  const res = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: params,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    return NextResponse.json({ message: 'Kakao token exchange failed' }, { status: res.ok ? 502 : res.status || 502 });
  }

  return NextResponse.json({ accessToken: data.access_token });
}
