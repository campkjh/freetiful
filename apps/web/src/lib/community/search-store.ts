'use client';

// 웨딩숲 검색어 — PC 는 검색창이 전체 헤더((main)/layout)에 있고 피드(CommunityClient)가 그 값으로 찾는다(260928 사장 'PC 웨딩숲 헤더 2개 → 하나로, 검색창은 헤더로').
// 모바일은 웨딩숲 머리줄의 검색칸이 같은 값을 쓴다.
import { create } from 'zustand';

export const useCommunitySearch = create<{ query: string; setQuery: (query: string) => void }>((set) => ({
  query: '',
  setQuery: (query) => set({ query }),
}));
