// 웨딩런 링크 미리보기 이미지(261011 사장 '공유 링크로 들어오면 ○○님의 1,280점에 도전!' 이 바로 보이게 · 첨부 그림 실제 사용)
//  · /api/wedding-run/og            → 기본(웨딩런: 신혼집까지 달려! + 키 비주얼)
//  · /api/wedding-run/og?c=<기록 id> → '○○님의 N점에 도전!' + 도달 구간 (운영 API GET /game/wedding-run/scores/:id — 서버가 검증한 기록만)
//    링크의 ?t=(검증 안 된 목표 점수)는 미리보기에 쓰지 않는다 — 남의 이름으로 가짜 기록 이미지를 만들 수 있어서.
//  · 바탕 = public/wedding-run/entry.webp(키 비주얼: 벚꽃 서울 + 손잡고 달리는 신랑신부). 같은 출처에서 받아 data URI 로 넣는다.
//  · 한글 글꼴 = 구글 폰트 Noto Sans KR 을 '쓰는 글자만' 받아 쓴다(작고 빠름) → 실패하면 Pretendard 전체(메모리 기억).
//  · 개발 서버에서만 ?n=닉네임&s=점수&sg=구간&a=1 로 모양 확인 가능(운영은 무시).
import { ImageResponse } from 'next/og';
import { NextResponse, type NextRequest } from 'next/server';
import { WR_ENTRY } from '@/app/wedding-run/assets';
import { clientIpFrom, fetchPublicScore, isScoreIdServer } from '@/app/wedding-run/ui/score-server';
import { fmtScore, reachHeadline } from '@/app/wedding-run/ui/text';
import type { WrPublicScore } from '@/lib/api/wedding-run.api';

export const runtime = 'nodejs';

let pretendardCache: Promise<ArrayBuffer | null> | null = null;
let artCache: { at: number; uri: string } | null = null;

async function googleSubset(weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&text=${encodeURIComponent(text)}`, {
      signal: AbortSignal.timeout(2500),
    }).then((r) => r.text());
    const m = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
    if (!m) return null;
    const res = await fetch(m[1], { signal: AbortSignal.timeout(2500) });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

function pretendard(): Promise<ArrayBuffer | null> {
  if (!pretendardCache) {
    pretendardCache = fetch('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/public/static/Pretendard-ExtraBold.otf', { signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null)
      .then((b) => {
        if (!b) pretendardCache = null;
        return b;
      });
  }
  return pretendardCache;
}

/** 키 비주얼을 PNG data URI 로(이미지 렌더러가 webp 를 못 읽는 경우 대비해 sharp 로 바꿔 둔다 — 실패하면 그림 없이) */
async function artUri(origin: string): Promise<string | null> {
  if (artCache && Date.now() - artCache.at < 3600_000) return artCache.uri;
  try {
    const res = await fetch(`${origin}${WR_ENTRY.src}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const webp = Buffer.from(await res.arrayBuffer());
    let uri: string;
    try {
      const sharp = (await import('sharp')).default;
      const png = await sharp(webp).resize(1400).jpeg({ quality: 82 }).toBuffer();
      uri = `data:image/jpeg;base64,${png.toString('base64')}`;
    } catch {
      uri = `data:image/webp;base64,${webp.toString('base64')}`;
    }
    artCache = { at: Date.now(), uri };
    return uri;
  } catch {
    return null;
  }
}

/**
 * 키 비주얼을 받아 올 출처 — 운영에선 요청 Host 를 믿지 않는다(위조 Host 로 남의 그림을 받아 1시간 기억하는 일 방지, 261011 통합: API 검증 6번).
 * 개발 서버는 지금 출처(localhost).
 */
function artOrigin(req: NextRequest): string {
  const o = req.nextUrl.origin;
  if (process.env.NODE_ENV !== 'production') return o;
  return /^https:\/\/(www\.)?freetiful\.com$/.test(o) ? o : 'https://freetiful.com';
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const c = sp.get('c');
  let score: WrPublicScore | null = isScoreIdServer(c) ? await fetchPublicScore(c, req.ip || clientIpFrom(req.headers)) : null;
  // ?c= 가 있는데 기록을 못 찾으면 그리지 않고 기본 미리보기로 보낸다 — 아무 id 나 넣어 이미지 렌더 비용을 키우는 요청 차단(261011 통합: API 검증 6번)
  if (c != null && !score && !(process.env.NODE_ENV !== 'production' && sp.get('n') && sp.get('s'))) {
    return NextResponse.redirect(new URL('/api/wedding-run/og', req.nextUrl.origin), { status: 302, headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } });
  }
  if (!score && process.env.NODE_ENV !== 'production' && sp.get('n') && sp.get('s')) {
    score = {
      id: 'preview',
      nickname: String(sp.get('n')).slice(0, 12),
      score: Math.max(0, parseInt(String(sp.get('s')), 10) || 0),
      stage: Math.max(0, Math.min(4, parseInt(String(sp.get('st') || '0'), 10) || 0)),
      segment: Math.max(0, Math.min(11, parseInt(String(sp.get('sg') || '0'), 10) || 0)),
      arrived: sp.get('a') === '1',
    };
  }

  const head = score ? `${score.nickname}님의` : '웨딩런:';
  const big = score ? `${fmtScore(score.score)}점에 도전!` : '신혼집까지 달려!';
  const sub = score ? reachHeadline({ arrived: score.arrived, segment: score.segment, laps: score.arrived ? 1 : 0 }) : '점프하고, 슬라이드하고, 신혼집까지!';
  const pill = '프리티풀 미니게임';
  const foot = 'freetiful.com/wedding-run';
  const text = `${head}${big}${sub}${pill}${foot}0123456789,점`;

  const [bold, art] = await Promise.all([googleSubset(800, text).then((b) => b || pretendard()), artUri(artOrigin(req))]);
  const fonts = bold ? [{ name: 'WR', data: bold, weight: 800 as const, style: 'normal' as const }] : [];

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: 'flex', position: 'relative', background: 'linear-gradient(135deg, #FFF0F5 0%, #F3EEFF 60%, #FFE9F1 100%)', fontFamily: 'WR' }}>
        {art && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} width={1400} height={630} alt="" style={{ position: 'absolute', left: -200, top: 0, width: 1400, height: 630, objectFit: 'cover' }} />
        )}
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'linear-gradient(90deg, rgba(255,248,252,0.95) 0%, rgba(255,246,252,0.86) 34%, rgba(255,246,252,0.2) 58%, rgba(255,246,252,0) 70%)' }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', width: 640, height: 630, paddingLeft: 70 }}>
          <div style={{ display: 'flex' }}>
            <div style={{ display: 'flex', padding: '10px 24px', borderRadius: 999, background: '#ffffff', border: '3px solid #b9a2ea', color: '#7655c2', fontSize: 28 }}>{pill}</div>
          </div>
          <div style={{ display: 'flex', marginTop: 26, fontSize: score ? 56 : 104, color: score ? '#563a78' : '#7655c2', letterSpacing: -3, lineHeight: 1.05 }}>{head}</div>
          <div style={{ display: 'flex', marginTop: 8, fontSize: score ? 78 : 66, color: '#ef5d8f', letterSpacing: -2.5, lineHeight: 1.08 }}>{big}</div>
          <div style={{ display: 'flex', marginTop: 22, fontSize: 32, color: '#7d64a0', letterSpacing: -0.8 }}>{sub}</div>
          <div style={{ display: 'flex', marginTop: 40, fontSize: 26, color: '#9a86b8' }}>{foot}</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
      // ?c= 기록 이미지는 짧게(10분) — 운영자가 판을 숨기거나 닉네임을 초기화하면 CDN 사본도 10분 안에 사라지게(261011 검증 low: 예전 1일+7일 SWR)
      headers: { 'Cache-Control': score ? 'public, max-age=300, s-maxage=600' : 'public, max-age=3600, s-maxage=86400' },
    },
  );
}
