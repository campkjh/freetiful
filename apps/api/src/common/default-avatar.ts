// 일반 유저 기본 프로필 — 동물 친구들 20종(apps/web/public/images/avatars/animal-01~20.webp) 중 랜덤.
// 카카오의 공용 기본 이미지(account_images/default_profile)는 '사진 없음'으로 본다.
const AVATAR_ORIGIN = 'https://freetiful.com';
export const ANIMAL_AVATAR_COUNT = 20;

export function randomAnimalAvatar(): string {
  const n = Math.floor(Math.random() * ANIMAL_AVATAR_COUNT) + 1;
  return `${AVATAR_ORIGIN}/images/avatars/animal-${String(n).padStart(2, '0')}.webp`;
}

export function isPlaceholderProfileImage(url?: string | null): boolean {
  return !url || !url.trim() || /account_images(\/|%2F)default_profile/i.test(url);
}

/**
 * http:// 소셜 프로필 사진 → https://(261008) — 카카오는 secure_resource 없이 부르면 http 주소를 준다.
 * 안드로이드 앱(WebView, MIXED_CONTENT_NEVER_ALLOW)은 https 화면 속 http 이미지를 막아 갤럭시에서만 사진이 비었다
 * (PC 크롬 · iOS 는 알아서 https 로 바꿔 불러 멀쩡해 보임). https 로도 같은 그림을 주는 호스트만 바꾼다
 * (kakaocdn 은 40/40 같은 바이트 확인, 구글 · 네이버 프로필 CDN 도 https). 상대 경로(/uploads · /images)와 그 밖의 호스트는 그대로.
 */
const HTTPS_IMAGE_HOSTS = /^http:\/\/((?:[a-z0-9-]+\.)*(?:kakaocdn\.net|googleusercontent\.com|pstatic\.net|phinf\.naver\.net))(?=[/:?#]|$)/i;
export function toSecureImageUrl<T extends string | null | undefined>(url: T): T {
  if (!url || typeof url !== 'string') return url;
  return url.replace(HTTPS_IMAGE_HOSTS, 'https://$1') as T;
}

/** 가입 시 소셜 프로필 사진이 없거나 카카오 기본 이미지면 동물 프로필로 대신한다. */
export function generalProfileImage(url?: string | null): string {
  return isPlaceholderProfileImage(url) ? randomAnimalAvatar() : toSecureImageUrl(url as string);
}
