import { NextRequest, NextResponse } from 'next/server';
import { filterBannersByPlacement, getApiBaseUrl, jsonError, normalizePlacement, readBackendJson } from '../_banner-utils/placement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) return jsonError('API URL is not configured', 500);

  const placement = normalizePlacement(request.nextUrl.searchParams.get('placement'));
  const response = await fetch(`${apiBaseUrl}/api/v1/banners?placement=${placement}`, {
    cache: 'no-store',
  });
  const data = await readBackendJson(response);
  if (!response.ok) {
    return NextResponse.json(data || { message: 'Banner API request failed' }, { status: response.status });
  }

  const banners = Array.isArray(data) ? filterBannersByPlacement(data, placement) : [];
  return NextResponse.json(banners, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
