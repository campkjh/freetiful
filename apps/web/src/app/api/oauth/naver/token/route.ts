import { NextRequest, NextResponse } from 'next/server';

const NAVER_CLIENT_ID = 'cnaly_pSLgjMyP3Itds_';
const NAVER_CLIENT_SECRET = 'dmDCW1zGye';

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
