'use client';

// 스타디 커뮤니티 이식용 fetch 래퍼.
// - 스타디 경로(/api/community, /api/category-groups, /api/tags, /api/auth/me)를
//   프리티풀 경로(/api/v1/community/*, /api/v1/auth/me)로 매핑
// - 프리티풀 JWT(Bearer, useAuthStore accessToken)를 자동 첨부(쿠키 대신)
// - /api/auth/me 응답을 스타디가 기대하는 { user: {...nickname, avatar} } 형태로 정규화
import { useAuthStore } from '@/lib/store/auth.store';

const PATH_MAP: [RegExp, string][] = [
  [/^\/api\/community\//, '/api/v1/community/'],
  [/^\/api\/category-groups\b/, '/api/v1/community/groups'],
  [/^\/api\/tags\b/, '/api/v1/community/tags'],
  [/^\/api\/auth\/me\b/, '/api/v1/auth/me'],
];

function mapUrl(input: string): string {
  for (const [re, to] of PATH_MAP) if (re.test(input)) return input.replace(re, to);
  return input;
}

export async function cfetch(input: string, init: RequestInit = {}): Promise<Response> {
  const url = mapUrl(input);
  const token =
    typeof window !== 'undefined' ? useAuthStore.getState().accessToken : null;
  const headers = new Headers(init.headers || {});
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { ...init, headers });

  // /api/auth/me: freetiful User → { user: {..., nickname, avatar} }
  if (/^\/api\/auth\/me\b/.test(input)) {
    if (!res.ok) return res;
    const u = await res
      .clone()
      .json()
      .catch(() => null);
    if (u && u.id) {
      const body = JSON.stringify({
        user: {
          ...u,
          nickname: u.name ?? u.nickname ?? '사용자',
          avatar: u.profileImageUrl ?? u.avatar ?? null,
        },
      });
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  return res;
}
