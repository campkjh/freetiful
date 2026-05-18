import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

let cachedBuildId: string | null | undefined;

function getBuildId() {
  const explicitBuildId = process.env.NEXT_PUBLIC_BUILD_ID;
  if (explicitBuildId) return explicitBuildId;

  if (process.env.NODE_ENV !== 'production') return null;

  if (cachedBuildId !== undefined) return cachedBuildId;

  const buildIdPath = join(process.cwd(), '.next', 'BUILD_ID');
  if (existsSync(buildIdPath)) {
    cachedBuildId = readFileSync(buildIdPath, 'utf8').trim() || null;
    if (cachedBuildId) return cachedBuildId;
  }

  cachedBuildId = process.env.VERCEL_URL || process.env.VERCEL_GIT_COMMIT_SHA || null;
  return cachedBuildId;
}

export async function GET() {
  const buildId = getBuildId();
  return NextResponse.json(
    { buildId },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
        Pragma: 'no-cache',
        Expires: '0',
      },
    },
  );
}
