import { josa } from './josa';

// 첫 15분의 동선(제작 프롬프트 16쪽): 입장·이동 → 소담의 부탁 → 흰 꽃 3 → 리본·부케 → 꽃·목재 추가 → 공방 아치 →
// 장식 배치 → 웨딩 의상 → 도담과 첫 예식 → 단체 사진·기념품 → 집에 액자. 부탁 상태 = 수락 가능·진행 중·완료 가능·보상 수령.
export type QuestStatus = 'locked' | 'available' | 'active' | 'ready' | 'done';

export interface QuestDef {
  id: string;
  title: string;
  giver?: string;
  /** 다음 행동 한 문장 + 장소(추적 목표) */
  place: string;
  /** 지도·안내 대상(주민 ID 또는 지점) */
  target: { resident?: string; zone?: string; pos?: [number, number] };
  next?: string;
}

export const QUESTS: Record<string, QuestDef> = {
  welcome: { id: 'welcome', title: '숲에 온 걸 환영해요', place: '꽃잎 온실', target: { resident: 'sodam' }, next: 'sodam_flowers' },
  sodam_flowers: { id: 'sodam_flowers', title: '소담의 부탁: 흰 꽃 세 송이', giver: 'sodam', place: '숲 곳곳의 흰 꽃', target: { resident: 'sodam' }, next: 'first_bouquet' },
  first_bouquet: { id: 'first_bouquet', title: '첫 부케 만들기', place: '꽃잎 온실 부케 테이블', target: { pos: [11.7, 12.1] }, next: 'meet_woody' },
  meet_woody: { id: 'meet_woody', title: '공방의 우디 찾아가기', place: '나뭇결 공방', target: { resident: 'woody' }, next: 'woody_arch' },
  woody_arch: { id: 'woody_arch', title: '우디와 웨딩 아치 만들기', giver: 'woody', place: '나뭇결 공방 작업대', target: { pos: [-10.1, 11.6] }, next: 'decorate_garden' },
  decorate_garden: { id: 'decorate_garden', title: '서약의 정원 꾸미기', place: '서약의 정원 표지판', target: { pos: [2.7, -20.2] }, next: 'wedding_outfit' },
  wedding_outfit: { id: 'wedding_outfit', title: '웨딩 의상 고르기', place: '햇살 의상실 거울', target: { pos: [-20.9, 1.0] }, next: 'first_wedding' },
  first_wedding: { id: 'first_wedding', title: '도담과 첫 결혼식', giver: 'dodam', place: '서약의 정원', target: { resident: 'dodam' }, next: 'place_frame' },
  place_frame: { id: 'place_frame', title: '우리 집에 기념 액자 놓기', place: '우리의 집 앞마당', target: { pos: [-9.7, -11.2] }, next: 'free' },
  free: { id: 'free', title: '숲에서의 새로운 일상', place: '어디든', target: {} },
};

export const MAIN_CHAIN = ['welcome', 'sodam_flowers', 'first_bouquet', 'meet_woody', 'woody_arch', 'decorate_garden', 'wedding_outfit', 'first_wedding', 'place_frame', 'free'];

export const MEMORY_DEFS: Record<string, { title: string; text: (n: { me: string; partner: string }) => string }> = {
  first_meet: { title: '첫 만남', text: ({ me, partner }) => `${josa(me, '와/과')} ${partner}, 결혼의 숲으로 함께 이사 온 날.` },
  first_bouquet: { title: '첫 부케', text: () => '흰 꽃 세 송이를 리본으로 묶어 만든 우리의 첫 부케.' },
  first_wedding: { title: '첫 예식', text: ({ me, partner }) => `서약의 정원에서 ${josa(me, '와/과')} ${josa(partner, '이/가')} 반지를 나눴어요.` },
  promise_tree: { title: '약속의 나무', text: () => '예식이 끝나고 함께 심은 작은 나무. 해마다 조금씩 자라요.' },
  first_home: { title: '첫 집 꾸미기', text: () => '단체 사진을 담은 액자를 우리 집 앞에 놓았어요.' },
};
