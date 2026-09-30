'use client';

// 웨딩숲 '올릴 이름' — 허용 계정이 글·댓글을 운영진 에디터 이름으로 올릴 때 고른 에디터(260930). null = 내 웨딩숲 프로필.
// 글쓰기 칸·댓글 칸이 같이 쓴다(한 번 고르면 바꿀 때까지 그 이름, 새로고침하면 내 프로필로). 서버가 허용 계정·에디터 목록을 다시 확인한다.
// 고른 계정(ownerId)에 묶어 둔다 — 같은 기기에서 다른 계정으로 바꿔 들어오면 예전 선택이 따라가지 않게.
import { create } from 'zustand';
import { useAuthStore } from '@/lib/store/auth.store';

type PersonaState = {
  editorId: string | null;
  ownerId: string | null;
  setEditorId: (id: string | null) => void;
};

const store = create<PersonaState>((set) => ({
  editorId: null,
  ownerId: null,
  setEditorId: (editorId) => set({ editorId, ownerId: editorId ? useAuthStore.getState().user?.id ?? null : null }),
}));

/** 지금 계정이 고른 에디터 id(다른 계정이 고른 값이면 null) */
export function useCommunityPersona<T>(pick: (s: { editorId: string | null; setEditorId: PersonaState['setEditorId'] }) => T): T {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  return store((s) => pick({ editorId: s.ownerId && s.ownerId === userId ? s.editorId : null, setEditorId: s.setEditorId }));
}

/** 댓글·글 저장 몸통에 붙일 값 */
export const personaBody = () => {
  const { editorId, ownerId } = store.getState();
  const userId = useAuthStore.getState().user?.id ?? null;
  return editorId && ownerId && ownerId === userId ? { asEditorId: editorId } : {};
};
