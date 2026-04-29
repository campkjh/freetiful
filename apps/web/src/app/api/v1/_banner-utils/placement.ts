import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export type BannerPlacement = 'home' | 'businesses';

const PLACEMENT_MARKER = '[freetiful:banner-placement=businesses]';

export function normalizePlacement(value?: string | null): BannerPlacement {
  return value === 'businesses' ? 'businesses' : 'home';
}

export function getApiBaseUrl() {
  const raw = (process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || '').replace(/\/+$/, '');
  return raw.replace(/\/api\/v1$/, '').replace(/\/api$/, '');
}

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ message }, { status });
}

export function buildForwardHeaders(request: NextRequest) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const auth = request.headers.get('authorization');
  const adminKey = request.headers.get('x-admin-key');
  const platform = request.headers.get('x-platform');
  if (auth) headers.Authorization = auth;
  if (adminKey) headers['x-admin-key'] = adminKey;
  if (platform) headers['x-platform'] = platform;
  return headers;
}

export function encodeSubtitle(subtitle?: string | null, placement?: string | null) {
  const clean = String(subtitle || '').replace(PLACEMENT_MARKER, '').trim();
  return normalizePlacement(placement) === 'businesses'
    ? `${PLACEMENT_MARKER}${clean ? ` ${clean}` : ''}`
    : clean;
}

export function decodeBanner<T extends Record<string, any>>(banner: T): T & { placement: BannerPlacement } {
  const rawSubtitle = String(banner.subtitle || '');
  const markerPlacement = rawSubtitle.includes(PLACEMENT_MARKER) ? 'businesses' : 'home';
  const placement = normalizePlacement(banner.placement || markerPlacement);
  return {
    ...banner,
    placement,
    subtitle: rawSubtitle.replace(PLACEMENT_MARKER, '').trim(),
  };
}

export function filterBannersByPlacement<T extends Record<string, any>>(banners: T[], placement?: string | null) {
  const normalized = normalizePlacement(placement);
  return banners.map(decodeBanner).filter((banner) => banner.placement === normalized);
}

export function withEncodedPlacement<T extends Record<string, any>>(body: T) {
  const placement = normalizePlacement(body.placement);
  return {
    ...body,
    placement,
    subtitle: encodeSubtitle(body.subtitle, placement),
  };
}

export async function readBackendJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
