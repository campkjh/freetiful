import type { SyntheticEvent } from 'react';

export const BUSINESS_IMAGE_FALLBACK = '/images/default-profile.svg';

export function toBusinessImageUrl(imageUrl?: string | null) {
  const raw = String(imageUrl || '').trim();
  if (!raw) return BUSINESS_IMAGE_FALLBACK;
  if (raw.startsWith('/') || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;

  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return BUSINESS_IMAGE_FALLBACK;
    return `/api/v1/business/image-proxy?url=${encodeURIComponent(raw)}`;
  } catch {
    return raw;
  }
}

export function toBusinessImageUrls(images: ReadonlyArray<string | null | undefined>) {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const image of images) {
    const next = toBusinessImageUrl(image);
    if (!next || seen.has(next)) continue;
    seen.add(next);
    urls.push(next);
  }

  return urls.length > 0 ? urls : [BUSINESS_IMAGE_FALLBACK];
}

export function handleBusinessImageError(event: SyntheticEvent<HTMLImageElement>) {
  if (event.currentTarget.src.endsWith(BUSINESS_IMAGE_FALLBACK)) return;
  event.currentTarget.src = BUSINESS_IMAGE_FALLBACK;
}
