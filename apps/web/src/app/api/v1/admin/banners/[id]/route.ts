import { NextRequest, NextResponse } from 'next/server';
import {
  buildForwardHeaders,
  decodeBanner,
  getApiBaseUrl,
  jsonError,
  readBackendJson,
  withEncodedPlacement,
} from '../../../_banner-utils/placement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) return jsonError('API URL is not configured', 500);

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const response = await fetch(`${apiBaseUrl}/api/v1/admin/banners/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: buildForwardHeaders(request),
    body: JSON.stringify(withEncodedPlacement(body)),
    cache: 'no-store',
  });
  const data = await readBackendJson(response);
  if (!response.ok) {
    return NextResponse.json(data || { message: 'Update banner failed' }, { status: response.status });
  }

  return NextResponse.json(decodeBanner(data || {}), { status: response.status });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) return jsonError('API URL is not configured', 500);

  const { id } = await params;
  const response = await fetch(`${apiBaseUrl}/api/v1/admin/banners/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: buildForwardHeaders(request),
    cache: 'no-store',
  });
  const data = await readBackendJson(response);
  if (!response.ok) {
    return NextResponse.json(data || { message: 'Delete banner failed' }, { status: response.status });
  }

  return NextResponse.json(data || { ok: true }, { status: response.status });
}
