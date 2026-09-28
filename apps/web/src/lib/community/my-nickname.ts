'use client';

// 내 웨딩숲 닉네임(260928) — 서버 /community/me/nickname. 허용된 계정만 직접 정하고(계정당 하나), 나머지는 '꾸밈말 동물' 랜덤.
// 한 번 받은 값은 모듈에 기억(글쓰기 칸·댓글 칸이 같이 씀). 로그인 전엔 부르지 않는다(401 이면 로그인 시트가 뜬다).
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth.store';

export type MyNickname = { nickname: string; custom: string | null; canSetNickname: boolean };

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

export async function saveMyNickname(nickname: string): Promise<MyNickname> {
  const r = await apiClient.put<MyNickname>('/api/v1/community/me/nickname', { nickname });
  const user = useAuthStore.getState().user;
  if (user) cached = { userId: user.id, promise: Promise.resolve(r.data) };
  return r.data;
}
