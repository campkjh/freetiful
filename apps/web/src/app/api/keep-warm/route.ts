// Railway API 콜드스타트 방지 — Vercel cron 이 주기적으로 호출해 /health 를 깨워둔다.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const raw = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
  const base = raw.replace(/\/api\/v1$/, '').replace(/\/api$/, '');
  const url = `${base}/api/v1/health`;
  let ok = false;
  let status = 0;
  const started = Date.now();
  try {
    const res = await fetch(url, { cache: 'no-store' });
    ok = res.ok;
    status = res.status;
  } catch {
    ok = false;
  }
  return Response.json({ ok, status, ms: Date.now() - started, url });
}
