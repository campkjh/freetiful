'use client';

// 내 웨딩숲 프로필(260928) — 서버 /community/me/nickname. 허용된 계정만 닉네임·웨딩숲 사진을 직접 정하고(계정당 하나), 나머지는 '꾸밈말 동물' 랜덤.
// 한 번 받은 값은 모듈에 기억(글쓰기 칸·댓글 칸이 같이 씀). 로그인 전엔 부르지 않는다(401 이면 로그인 시트가 뜬다).
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth.store';

export type MyNickname = {
  /** 웨딩숲에 보이는 이름 */
  nickname: string;
  /** 직접 정한 닉네임(없으면 null = 랜덤) */
  custom: string | null;
  /** 웨딩숲에 보이는 사진 */
  avatar: string | null;
  /** 직접 고른 웨딩숲 사진(없으면 null = 원래 프로필 사진) */
  customAvatar: string | null;
  canSetNickname: boolean;
};
export type NicknameSuggestion = { nickname: string; avatarUrl: string };

let cached: { userId: string; promise: Promise<MyNickname | null> } | null = null;

export function fetchMyNickname(force = false): Promise<MyNickname | null> {
  const { user, accessToken } = useAuthStore.getState();
  if (!user || !accessToken) return Promise.resolve(null);
  if (!force && cached && cached.userId === user.id) return cached.promise;
  const promise = apiClient
    .get<MyNickname>('/api/v1/community/me/nickname')
    .then((r) => r.data)
    .catch(() => null);
  cached = { userId: user.id, promise };
  return promise;
}

/** avatarUrl: 동물 친구 사진 주소 · null = 원래 사진으로 · 생략 = 그대로 */
export async function saveMyNickname(nickname: string, avatarUrl?: string | null): Promise<MyNickname> {
  const body = avatarUrl === undefined ? { nickname } : { nickname, avatarUrl };
  const r = await apiClient.put<MyNickname>('/api/v1/community/me/nickname', body);
  const user = useAuthStore.getState().user;
  if (user) cached = { userId: user.id, promise: Promise.resolve(r.data) };
  return r.data;
}

/** AI 닉네임 추천 6개 — '꾸밈말 + 동물' + 그 동물 사진 */
export async function suggestNicknames(): Promise<NicknameSuggestion[]> {
  const r = await apiClient.post<{ items: NicknameSuggestion[] }>('/api/v1/community/me/nickname/suggest');
  return Array.isArray(r.data?.items) ? r.data.items : [];
}
