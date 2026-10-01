// 추적 중인 목표 1개 — 다음 행동 한 문장 + 장소(제작 프롬프트 13쪽 '퀘스트는 다음 행동과 장소').
import { MAIN_CHAIN, QUESTS } from '../data/quests';
import { countIn } from './store';
import type { GameData } from './types';

export interface Objective {
  id: string;
  title: string;
  next: string;
  place: string;
  status: string;
  progress?: Array<{ label: string; have: number; need: number }>;
}

export function currentQuestId(d: Pick<GameData, 'quests'>): string {
  for (const id of MAIN_CHAIN) {
    const s = d.quests[id];
    if (s && s !== 'done' && s !== 'locked') return id;
  }
  return 'free';
}

export function objectiveOf(d: GameData): Objective {
  const id = currentQuestId(d);
  const q = QUESTS[id];
  const st = d.quests[id];
  const c = (item: string) => countIn(d.bag, item);
  const base = { id, title: q.title, place: q.place, status: st };
  switch (id) {
    case 'welcome':
      return { ...base, next: '꽃잎 온실의 소담에게 인사해 보세요', place: '꽃잎 온실 · 광장 동남쪽' };
    case 'sodam_flowers':
      if (st === 'available') return { ...base, next: '소담에게 부탁을 들어 보세요', place: '소담 곁' };
      if (st === 'ready') return { ...base, next: '소담에게 흰 꽃 세 송이를 보여 주세요', place: '소담 곁', progress: [{ label: '흰 꽃', have: Math.min(3, c('white_flower')), need: 3 }] };
      return { ...base, next: '길가와 광장 근처에서 흰 꽃을 따 보세요', progress: [{ label: '흰 꽃', have: Math.min(3, c('white_flower')), need: 3 }] };
    case 'first_bouquet':
      return {
        ...base,
        next: c('white_flower') >= 3 ? '부케 테이블에서 숲속 부케를 만들어요' : '흰 꽃을 조금 더 따서 부케 테이블로 가요',
        progress: [
          { label: '흰 꽃', have: Math.min(3, c('white_flower')), need: 3 },
          { label: '리본', have: Math.min(1, c('ribbon')), need: 1 },
        ],
      };
    case 'meet_woody':
      return { ...base, next: '나뭇결 공방의 우디를 찾아가요', place: '광장 서쪽 · 나뭇결 공방' };
    case 'woody_arch':
      if (st === 'available') return { ...base, next: '우디에게 아치 만드는 법을 들어요', place: '우디 곁' };
      return {
        ...base,
        next: c('wood') >= 8 && c('white_flower') >= 6 ? '작업대에서 웨딩 아치를 만들어요' : '나무를 흔들어 목재를, 길가에서 흰 꽃을 모아요',
        progress: [
          { label: '목재', have: Math.min(8, c('wood')), need: 8 },
          { label: '흰 꽃', have: Math.min(6, c('white_flower')), need: 6 },
        ],
      };
    case 'decorate_garden':
      return { ...base, next: '표지판에서 꾸미기를 시작해 아치는 통로 끝, 의자 6개는 양옆에 놓아요' };
    case 'wedding_outfit':
      return { ...base, next: '거울에서 나와 파트너의 웨딩 의상을 골라요', place: '햇살 의상실 · 광장 서쪽 끝' };
    case 'first_wedding':
      return { ...base, next: '서약의 정원에서 도담에게 말을 걸어 예식을 시작해요' };
    case 'place_frame':
      return { ...base, next: "집 현관에서 '앞마당 꾸미기'로 기념 액자를 놓아요" };
    default:
      return { ...base, next: '꽃을 심고 장식을 더 만들고, 사진도 찍어 보세요' };
  }
}
