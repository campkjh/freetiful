import { NextRequest, NextResponse } from 'next/server';
import {
  buildForwardHeaders,
  decodeBanner,
  filterBannersByPlacement,
  getApiBaseUrl,
  jsonError,
  readBackendJson,
  withEncodedPlacement,
} from '../../_banner-utils/placement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) return jsonError('API URL is not configured', 500);

  const placement = request.nextUrl.searchParams.get('placement');
  const response = await fetch(`${apiBaseUrl}/api/v1/admin/banners`, {
    headers: buildForwardHeaders(request),
    cache: 'no-store',
  });
  const data = await readBackendJson(response);
  if (!response.ok) {
    return NextResponse.json(data || { message: 'Admin banner API request failed' }, { status: response.status });
  }

  const banners = Array.isArray(data)
    ? placement ? filterBannersByPlacement(data, placement) : data.map(decodeBanner)
    : [];
  return NextResponse.json(banners, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) return jsonError('API URL is not configured', 500);

  const body = await request.json().catch(() => ({}));
  const response = await fetch(`${apiBaseUrl}/api/v1/admin/banners`, {
    method: 'POST',
    headers: buildForwardHeaders(request),
    body: JSON.stringify(withEncodedPlacement(body)),
    cache: 'no-store',
  });
  const data = await readBackendJson(response);
  if (!response.ok) {
    return NextResponse.json(data || { message: 'Create banner failed' }, { status: response.status });
  }

  return NextResponse.json(decodeBanner(data || {}), { status: response.status });
}
