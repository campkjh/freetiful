'use client';

// 웨딩숲(커뮤니티) 첫 화면을 바로 띄우기(260926 사장 '웨딩숲 뜨는 거 너무 느림').
//  · 앱이 뜨고 한가할 때 그룹·최신 글을 미리 받아 CommunityClient 가 읽는 메모리 캐시(clientCache)에 같은 키로 넣는다
//    → 하단 탭 '웨딩숲'을 누르면 기다림 없이 목록이 뜨고, 화면은 그 뒤에 새로 받아 달라진 것만 바꾼다.
//  · 마지막으로 본 목록을 localStorage 에도 남겨, 앱을 새로 켠 직후에도 먼저 보여준다(계정이 바뀌면 쓰지 않음).
import { clientCache } from '@/lib/clientCache';
import { cfetch } from '@/lib/community/cfetch';
import { useAuthStore } from '@/lib/store/auth.store';

const PERSIST_KEY = 'fcom-feed-cache-v1';
const PERSIST_MAX_AGE = 3 * 24 * 60 * 60 * 1000;
const PREFETCH_THROTTLE = 60_000;

/** CommunityClient 와 같은 글 목록 캐시 키(필터 조합별) */
export const communityPostsKey = (groupId: string, q: string, tagId = '', sort = '') =>
  `community-posts:${groupId}:${tagId}:${sort}:${q.trim()}`;

const LATEST_KEY = communityPostsKey('', '', '', 'latest');
const GROUPS_KEY = 'community-groups';

/** CommunityClient.loadGroups 와 같은 순서 — '자유'를 맨 앞으로 */
export function orderCommunityGroups<T extends { name?: string }>(groups: T[]): T[] {
  return [...groups].sort((a, b) => {
    if (a.name === '자유') return -1;
    if (b.name === '자유') return 1;
    return 0;
  });
}

function currentUserKey() {
  try {
    return useAuthStore.getState().user?.id || 'guest';
  } catch {
    return 'guest';
  }
}

/** 받은 목록을 기기에 남긴다(전체·최신순만) — 다른 필터는 남기지 않는다 */
export function persistCommunityFeed(part: { groups?: unknown[]; latest?: unknown[] }) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    const prev = raw ? JSON.parse(raw) : null;
    const same = prev && prev.user === currentUserKey();
    const next = {
      user: currentUserKey(),
      ts: Date.now(),
      groups: part.groups ?? (same ? prev.groups : undefined),
      latest: part.latest ?? (same ? prev.latest : undefined),
    };
    localStorage.setItem(PERSIST_KEY, JSON.stringify(next));
  } catch {
    /* 저장 공간 부족 등은 무시 */
  }
}

/** 메모리 캐시가 비어 있으면 기기에 남긴 목록으로 먼저 채운다 */
export function hydrateCommunityCache() {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved?.ts || Date.now() - saved.ts > PERSIST_MAX_AGE || saved.user !== currentUserKey()) return;
    if (Array.isArray(saved.groups) && !clientCache.has(GROUPS_KEY)) clientCache.set(GROUPS_KEY, saved.groups);
    if (Array.isArray(saved.latest) && !clientCache.has(LATEST_KEY)) clientCache.set(LATEST_KEY, saved.latest);
  } catch {
    /* 깨진 캐시는 무시 */
  }
}

let lastPrefetchAt = 0;
let inFlight = false;

/** 앱 로드 후 한가할 때 호출 — 그룹·최신 글을 미리 받아 캐시를 데운다(1분 쓰로틀) */
export async function prefetchCommunity() {
  if (typeof window === 'undefined') return;
  hydrateCommunityCache();
  if (inFlight || Date.now() - lastPrefetchAt < PREFETCH_THROTTLE) return;
  inFlight = true;
  lastPrefetchAt = Date.now();
  try {
    const [gr, pr] = await Promise.all([cfetch('/api/category-groups'), cfetch('/api/community/posts?sort=latest')]);
    const gj = gr.ok ? await gr.json().catch(() => null) : null;
    const pj = pr.ok ? await pr.json().catch(() => null) : null;
    const groups = gj && Array.isArray(gj.groups) ? orderCommunityGroups(gj.groups) : undefined;
    const latest = pj && Array.isArray(pj.posts) ? pj.posts : undefined;
    if (groups) clientCache.set(GROUPS_KEY, groups);
    if (latest) clientCache.set(LATEST_KEY, latest);
    if (groups || latest) persistCommunityFeed({ groups, latest });
  } catch {
    /* 실패해도 화면 진입 때 정상으로 받는다 */
  } finally {
    inFlight = false;
  }
}
