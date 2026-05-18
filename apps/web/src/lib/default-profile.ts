export const DEFAULT_PROFILE_IMAGES = [
  '/images/default-profiles/avatar-01.png',
  '/images/default-profiles/avatar-02.png',
  '/images/default-profiles/avatar-03.png',
  '/images/default-profiles/avatar-04.png',
  '/images/default-profiles/avatar-05.png',
  '/images/default-profiles/avatar-06.png',
  '/images/default-profiles/avatar-07.png',
  '/images/default-profiles/avatar-08.png',
  '/images/default-profiles/avatar-09.png',
] as const;

export const DEFAULT_PROFILE_IMAGE = DEFAULT_PROFILE_IMAGES[0];

function hashSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getDefaultProfileImage(seed?: string | null) {
  const normalized = (seed || 'freetiful-user').trim();
  return DEFAULT_PROFILE_IMAGES[hashSeed(normalized) % DEFAULT_PROFILE_IMAGES.length];
}

export function isDefaultProfileImageUrl(src?: string | null) {
  if (!src) return true;
  return src.includes('/images/default-profile') || src.includes('/images/default-profiles/');
}

export function getProfileImageUrl(src?: string | null, seed?: string | null) {
  const trimmed = src?.trim();
  if (trimmed && !isDefaultProfileImageUrl(trimmed)) return trimmed;
  return getDefaultProfileImage(seed);
}
