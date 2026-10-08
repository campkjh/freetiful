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
  if (trimmed && !isDefaultProfileImageUrl(trimmed)) return toSecureImageUrl(trimmed);
  return getDefaultProfileImage(seed);
}

/**
 * http:// 소셜 프로필 사진 → https://(261008, 서버 apps/api/src/common/default-avatar.ts toSecureImageUrl 과 같은 규칙).
 * 안드로이드 앱(WebView)은 https 화면 속 http 이미지를 막아 갤럭시에서만 카톡 사진이 비었다. https 로도 같은 그림을 주는 호스트만 바꾼다.
 */
const HTTPS_IMAGE_HOSTS = /^http:\/\/((?:[a-z0-9-]+\.)*(?:kakaocdn\.net|googleusercontent\.com|pstatic\.net|phinf\.naver\.net))(?=[/:?#]|$)/i;
export function toSecureImageUrl<T extends string | null | undefined>(url: T): T {
  if (!url || typeof url !== 'string') return url;
  return url.replace(HTTPS_IMAGE_HOSTS, 'https://$1') as T;
}
