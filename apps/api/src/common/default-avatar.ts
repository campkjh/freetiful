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

/** 가입 시 소셜 프로필 사진이 없거나 카카오 기본 이미지면 동물 프로필로 대신한다. */
export function generalProfileImage(url?: string | null): string {
  return isPlaceholderProfileImage(url) ? randomAnimalAvatar() : (url as string);
}
