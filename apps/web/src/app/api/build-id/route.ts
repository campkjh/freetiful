import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

let cachedBuildId: string | null | undefined;

function getBuildId() {
  const envBuildId = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_BUILD_ID;
  if (envBuildId) return envBuildId;

  if (process.env.NODE_ENV !== 'production') return null;

  if (cachedBuildId !== undefined) return cachedBuildId;

  const buildIdPath = join(process.cwd(), '.next', 'BUILD_ID');
  if (!existsSync(buildIdPath)) {
    cachedBuildId = null;
    return cachedBuildId;
  }

  cachedBuildId = readFileSync(buildIdPath, 'utf8').trim() || null;
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
