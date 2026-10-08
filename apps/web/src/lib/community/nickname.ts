import { toSecureImageUrl } from '@/lib/default-profile';

/**
 * 웨딩숲(커뮤니티) 일반 회원 닉네임 — '사랑받는 오리' 식 랜덤 닉네임(260928 사장 "사회자들 제외하고 일반 사람들은 랜덤 닉네임").
 *  · 실명(카카오 이름 등)이 웨딩숲에 뜨지 않게 한다. 회원 ID 로 정해져 사람마다 늘 같은 이름(DB 에 저장하지 않음).
 *  · 동물 친구 프로필(animal-NN)이면 그 동물로 — 사진 속 동물과 이름이 맞는다. 직접 올린 사진이면 동물도 ID 로 고른다.
 *  · 사회자·업체·운영자(role ≠ general)와 운영진 에디터 계정은 원래 이름 그대로.
 *  · 서로 다른 회원이 같은 닉네임일 수는 있다(꾸밈말 64 × 동물).
 * ⚠ apps/api/src/community/community-nickname.ts 와 apps/web/src/lib/community/nickname.ts 는 글자 하나까지 같아야 한다
 *   (내 글쓰기 칸에 보이는 이름 = 서버가 글·댓글에 붙이는 이름). 고치면 두 파일 모두.
 */

/** 동물 친구 프로필 20종 — public/images/avatars/animal-01~20.webp 순서(원본 zip 파일 이름) */
export const AVATAR_ANIMALS = [
  '사막여우', '레서판다', '수달', '카피바라', '고슴도치', '라쿤', '코알라', '북극곰', '판다', '호랑이',
  '사자', '토끼', '다람쥐', '양', '사슴', '펭귄', '오리', '햄스터', '나무늘보', '물범',
];

/** 직접 올린 사진인 회원용으로 더 넣는 동물 */
export const EXTRA_ANIMALS = ['오소리', '강아지', '고양이', '알파카', '부엉이', '돌고래', '해달', '미어캣', '너구리', '기린', '코끼리', '청설모'];

export const MODIFIERS = [
  '사랑받는', '행복회로', '설레는', '반짝이는', '꿈꾸는', '포근한', '씩씩한', '느긋한',
  '다정한', '상큼한', '든든한', '말랑한', '보송한', '용감한', '수줍은', '당당한',
  '해맑은', '달달한', '산뜻한', '빛나는', '노래하는', '춤추는', '웃음많은', '눈치빠른',
  '부지런한', '낭만적인', '기분좋은', '센스있는', '야무진', '꼼꼼한', '따뜻한', '사려깊은',
  '잠꾸러기', '여행하는', '산책하는', '편지쓰는', '반지낀', '청첩장쓰는', '설렘가득', '두근두근',
  '콩닥콩닥', '몽글몽글', '알콩달콩', '싱글벙글', '방긋웃는', '복받은', '운좋은', '행운의',
  '봄날의', '햇살같은', '별빛같은', '솜사탕', '꿀떨어지는', '칼퇴하는', '계획왕', '커플링낀',
  '허니문가는', '집들이하는', '축하받는', '손잡은', '미소천사', '긍정왕', '명랑한', '상냥한',
];

/** 운영진 에디터 계정(role=general 이지만 '프리티풀 에디터 …' 이름을 그대로 보여 준다 — 운영진 글이 회원 글처럼 보이지 않게) */
const STAFF_USER_IDS = new Set<string>([
  '939313a1-1b41-4f2a-b3c0-f9c189616daa', // 프리티풀 에디터 하나
  'fe30b69f-5396-4fa6-b466-6e0cdca3431a', // 프리티풀 에디터 도윤
  '03d9933c-454f-4913-9493-d75dff85e8e7', // 프리티풀 웨딩가이드 서아
  'b30daa89-aad7-488a-acdf-3e2ddc47e7fa', // 프리티풀 에디터 준
]);

/** 동물 친구 프로필 사진 주소(DB 값과 같은 절대 주소) — 목록에 없는 동물이면 null */
export function animalAvatarUrl(animal: string): string | null {
  const i = AVATAR_ANIMALS.indexOf(animal);
  return i < 0 ? null : `https://freetiful.com/images/avatars/animal-${String(i + 1).padStart(2, '0')}.webp`;
}

function hash32(text: string, seed: number): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export type CommunityNicknameUser = {
  id?: string | null;
  role?: string | null;
  name?: string | null;
  profileImageUrl?: string | null;
};

/**
 * 실제 사진(카톡·네이버·직접 올린 사진 — 가입 때 무작위로 받은 동물 친구가 아님)인가.
 * 있으면 웨딩숲에서 실명 + 그 사진으로 보인다(261006 사장 '카톡 프로필이 있으면 랜덤 프로필 말고 실제 이름', 예전 글 포함).
 */
export function hasRealProfilePhoto(url?: string | null): boolean {
  const u = String(url || '').trim();
  if (!u) return false;
  return !/\/images\/avatars\/animal-\d{2}\.webp|default-profile/i.test(u);
}

/** 웨딩숲에 보일 이름 — 일반 회원은 '꾸밈말 동물'(실제 사진이 있으면 실명), 나머지는 원래 이름 */
export function communityNickname(user: CommunityNicknameUser): string {
  const name = (user.name || '').trim();
  if (!user.id || (user.role && user.role !== 'general') || STAFF_USER_IDS.has(user.id)) return name || '회원';
  if (name && hasRealProfilePhoto(user.profileImageUrl)) return name;
  const avatar = /\/images\/avatars\/animal-(\d{2})\.webp/.exec(user.profileImageUrl || '');
  const avatarIndex = avatar ? Number(avatar[1]) - 1 : -1;
  const pool = [...AVATAR_ANIMALS, ...EXTRA_ANIMALS];
  const animal = avatarIndex >= 0 && avatarIndex < AVATAR_ANIMALS.length ? AVATAR_ANIMALS[avatarIndex] : pool[hash32(user.id, 1) % pool.length];
  return `${MODIFIERS[hash32(user.id, 0) % MODIFIERS.length]} ${animal}`;
}

/**
 * 웨딩숲에 보일 회원 이름·사진 — 실제 사진(카톡 등)이 있는 일반 회원은 실명 + 그 사진(직접 정한·관리자가 바꾼 닉네임보다 앞),
 * 아니면 정한 닉네임·사진 → 자동 '꾸밈말 동물'. 사회자·업체 등은 원래 이름.
 */
export function memberCommunityDisplay(
  user: CommunityNicknameUser,
  own?: { nickname?: string | null; avatarUrl?: string | null } | null,
): { nickname: string; avatar: string | null; real: boolean } {
  const name = (user.name || '').trim();
  const general = !user.role || user.role === 'general';
  if (general && name && user.id && !STAFF_USER_IDS.has(user.id) && hasRealProfilePhoto(user.profileImageUrl)) {
    return { nickname: name, avatar: toSecureImageUrl(user.profileImageUrl) || null, real: true };
  }
  // 사진 주소는 https 로(카카오 http 사진은 갤럭시 앱 WebView 에서 막힘, 261008)
  return { nickname: own?.nickname || communityNickname(user), avatar: toSecureImageUrl(own?.avatarUrl || user.profileImageUrl) || null, real: false };
}
