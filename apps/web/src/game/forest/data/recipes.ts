// 제작법 — 재료 확인·차감·완성품 지급을 한 묶음(store.craft)으로 처리한다.
// station: 어디서 만드는지(꽃잎 온실의 부케 테이블 / 나뭇결 공방 작업대)
export type Station = 'bouquet_table' | 'workbench';

export interface Recipe {
  id: string;
  name: string;
  station: Station;
  inputs: Array<{ id: string; qty: number }>;
  output: { id: string; qty: number };
  /** 처음부터 아는지(아니면 주민에게 배움) */
  starter?: boolean;
  hint: string;
}

export const RECIPES: Record<string, Recipe> = {
  bouquet: {
    id: 'bouquet',
    name: '숲속 부케',
    station: 'bouquet_table',
    inputs: [
      { id: 'white_flower', qty: 3 },
      { id: 'ribbon', qty: 1 },
    ],
    output: { id: 'bouquet', qty: 1 },
    hint: '소담에게 배우는 첫 부케',
  },
  arch: {
    id: 'arch',
    name: '웨딩 아치',
    station: 'workbench',
    inputs: [
      { id: 'wood', qty: 8 },
      { id: 'white_flower', qty: 6 },
    ],
    output: { id: 'arch', qty: 1 },
    hint: '우디가 알려 주는 예식의 중심',
  },
  chair: {
    id: 'chair',
    name: '하객 의자',
    station: 'workbench',
    inputs: [{ id: 'wood', qty: 2 }],
    output: { id: 'chair', qty: 1 },
    hint: '하객 자리',
  },
  aisle_rug: {
    id: 'aisle_rug',
    name: '꽃길 러그',
    station: 'workbench',
    inputs: [
      { id: 'pink_flower', qty: 2 },
      { id: 'white_flower', qty: 1 },
    ],
    output: { id: 'aisle_rug', qty: 1 },
    hint: '입장 통로를 꾸며요',
  },
  centerpiece: {
    id: 'centerpiece',
    name: '센터피스',
    station: 'workbench',
    inputs: [
      { id: 'white_flower', qty: 1 },
      { id: 'pink_flower', qty: 1 },
      { id: 'branch', qty: 1 },
    ],
    output: { id: 'centerpiece', qty: 1 },
    hint: '테이블 꽃 장식',
  },
  lantern: {
    id: 'lantern',
    name: '숲속 랜턴',
    station: 'workbench',
    inputs: [
      { id: 'stone', qty: 1 },
      { id: 'branch', qty: 1 },
    ],
    output: { id: 'lantern', qty: 1 },
    hint: '밤 예식을 밝혀요',
  },
  cake_table: {
    id: 'cake_table',
    name: '케이크 테이블',
    station: 'workbench',
    inputs: [
      { id: 'wood', qty: 3 },
      { id: 'fruit', qty: 3 },
    ],
    output: { id: 'cake_table', qty: 1 },
    hint: '3단 웨딩 케이크',
  },
  flower_pot: {
    id: 'flower_pot',
    name: '꽃 화분',
    station: 'workbench',
    inputs: [
      { id: 'stone', qty: 1 },
      { id: 'yellow_flower', qty: 1 },
      { id: 'pink_flower', qty: 1 },
    ],
    output: { id: 'flower_pot', qty: 1 },
    hint: '정원에 색을 더해요',
  },
  ribbon_post: {
    id: 'ribbon_post',
    name: '리본 기둥',
    station: 'workbench',
    inputs: [
      { id: 'wood', qty: 1 },
      { id: 'ribbon', qty: 1 },
    ],
    output: { id: 'ribbon_post', qty: 1 },
    hint: '통로 옆 포인트',
  },
};

/** 우디를 만나면 배우는 공방 제작법 */
export const WORKSHOP_RECIPES = ['arch', 'chair', 'aisle_rug', 'centerpiece', 'lantern', 'cake_table', 'flower_pot', 'ribbon_post'];
