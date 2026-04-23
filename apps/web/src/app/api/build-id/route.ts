import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const buildId = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_BUILD_ID || Date.now().toString();
  return NextResponse.json({ buildId });
}
