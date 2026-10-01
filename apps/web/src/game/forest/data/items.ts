// 아이템 — 고유 ID 로 저장(표기 이름을 바꿔도 저장 참조 유지). 재료는 종류별로 쌓인다(stack).
export type ItemKind = 'material' | 'seed' | 'craft' | 'decor' | 'key';
export type IconKind =
  | 'flower'
  | 'rare'
  | 'wood'
  | 'branch'
  | 'fruit'
  | 'stone'
  | 'ribbon'
  | 'seed'
  | 'bouquet'
  | 'arch'
  | 'chair'
  | 'rug'
  | 'center'
  | 'lantern'
  | 'cake'
  | 'pot'
  | 'post'
  | 'frame';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  icon: IconKind;
  color: string;
  stack: number;
  /** 소담 가게에 팔 때 도토리 */
  sell?: number;
  /** 가게에서 살 때 도토리 */
  buy?: number;
  desc: string;
  /** 사용처 안내(가방에서 보여 줌) */
  use?: string;
  /** 놓을 수 있는 장식이면 장식 ID */
  decor?: string;
}

export const ITEMS: Record<string, ItemDef> = {
  white_flower: { id: 'white_flower', name: '흰 꽃', kind: 'material', icon: 'flower', color: '#FFFFFF', stack: 99, sell: 10, desc: '숲 곳곳에 피는 하얀 데이지.', use: '부케 · 웨딩 아치 · 센터피스' },
  pink_flower: { id: 'pink_flower', name: '분홍 꽃', kind: 'material', icon: 'flower', color: '#F0AFC4', stack: 99, sell: 10, desc: '볼이 발그레해지는 분홍 꽃.', use: '꽃길 러그 · 센터피스 · 꽃 화분' },
  yellow_flower: { id: 'yellow_flower', name: '노란 꽃', kind: 'material', icon: 'flower', color: '#F6D46B', stack: 99, sell: 10, desc: '햇살을 닮은 노란 꽃.', use: '꽃 화분' },
  rare_flower: { id: 'rare_flower', name: '달빛 은방울', kind: 'material', icon: 'rare', color: '#DCEBFF', stack: 99, sell: 60, desc: '속삭임 숲에서만 피는 희귀한 꽃.', use: '팔면 도토리를 많이 받아요' },
  wood: { id: 'wood', name: '목재', kind: 'material', icon: 'wood', color: '#B88A5E', stack: 99, sell: 8, desc: '나무를 흔들거나 공방 목재 더미에서 얻어요.', use: '웨딩 아치 · 의자 · 케이크 테이블 · 리본 기둥' },
  branch: { id: 'branch', name: '나뭇가지', kind: 'material', icon: 'branch', color: '#9B7752', stack: 99, sell: 5, desc: '가늘고 단단한 나뭇가지.', use: '센터피스 · 숲속 랜턴' },
  fruit: { id: 'fruit', name: '숲 열매', kind: 'material', icon: 'fruit', color: '#E8836B', stack: 99, sell: 12, desc: '열매 나무를 흔들면 떨어져요.', use: '케이크 테이블' },
  stone: { id: 'stone', name: '작은 돌', kind: 'material', icon: 'stone', color: '#CFC8BA', stack: 99, sell: 6, desc: '둥글둥글 매끈한 돌.', use: '숲속 랜턴 · 꽃 화분' },
  ribbon: { id: 'ribbon', name: '리본', kind: 'material', icon: 'ribbon', color: '#F4B9C9', stack: 99, sell: 15, buy: 40, desc: '부드러운 분홍 리본.', use: '숲속 부케 · 리본 기둥' },
  seed_white: { id: 'seed_white', name: '흰 꽃 씨앗', kind: 'seed', icon: 'seed', color: '#FFFFFF', stack: 99, sell: 4, buy: 20, desc: '심으면 새싹 → 봉오리 → 흰 꽃이 피어요.', use: '집 앞마당 · 온실 화단에 심기' },
  seed_pink: { id: 'seed_pink', name: '분홍 꽃 씨앗', kind: 'seed', icon: 'seed', color: '#F0AFC4', stack: 99, sell: 4, buy: 20, desc: '심으면 분홍 꽃이 피어요.', use: '집 앞마당 · 온실 화단에 심기' },
  bouquet: { id: 'bouquet', name: '숲속 부케', kind: 'craft', icon: 'bouquet', color: '#FFFFFF', stack: 9, sell: 80, desc: '흰 꽃 세 송이를 리본으로 묶은 첫 부케.', use: '예식에서 손에 들고 입장해요' },
  arch: { id: 'arch', name: '웨딩 아치', kind: 'decor', icon: 'arch', color: '#FFFFFF', stack: 9, sell: 120, desc: '흰 꽃으로 감싼 나무 아치.', use: '서약의 정원에 놓기 · 예식 필수', decor: 'arch' },
  chair: { id: 'chair', name: '하객 의자', kind: 'decor', icon: 'chair', color: '#C79A6B', stack: 99, sell: 15, desc: '하객이 앉는 나무 의자.', use: '서약의 정원 · 집 앞마당', decor: 'chair' },
  aisle_rug: { id: 'aisle_rug', name: '꽃길 러그', kind: 'decor', icon: 'rug', color: '#F7EFE4', stack: 9, sell: 30, desc: '꽃잎을 뿌린 입장 통로 러그.', use: '입장 통로 위에 놓아도 길을 막지 않아요', decor: 'aisle_rug' },
  centerpiece: { id: 'centerpiece', name: '센터피스', kind: 'decor', icon: 'center', color: '#F0AFC4', stack: 9, sell: 30, desc: '작은 테이블 위 꽃 장식.', use: '서약의 정원 · 집 앞마당', decor: 'centerpiece' },
  lantern: { id: 'lantern', name: '숲속 랜턴', kind: 'decor', icon: 'lantern', color: '#F6D46B', stack: 9, sell: 25, desc: '밤이 되면 따뜻하게 빛나요.', use: '서약의 정원 · 집 앞마당', decor: 'lantern' },
  cake_table: { id: 'cake_table', name: '케이크 테이블', kind: 'decor', icon: 'cake', color: '#FFFFFF', stack: 9, sell: 60, desc: '3단 웨딩 케이크를 올린 테이블.', use: '서약의 정원 · 집 앞마당', decor: 'cake_table' },
  flower_pot: { id: 'flower_pot', name: '꽃 화분', kind: 'decor', icon: 'pot', color: '#F6D46B', stack: 9, sell: 25, desc: '노랗고 분홍빛 꽃이 담긴 화분.', use: '서약의 정원 · 집 앞마당', decor: 'flower_pot' },
  ribbon_post: { id: 'ribbon_post', name: '리본 기둥', kind: 'decor', icon: 'post', color: '#F4B9C9', stack: 9, sell: 25, desc: '바람에 리본이 나풀거리는 기둥.', use: '서약의 정원 · 집 앞마당', decor: 'ribbon_post' },
  photo_frame: { id: 'photo_frame', name: '기념 액자', kind: 'decor', icon: 'frame', color: '#E3B866', stack: 9, desc: '첫 결혼식 단체 사진을 담은 액자.', use: '우리의 집 앞마당에 놓기', decor: 'photo_frame' },
};

export const BAG_SIZE = 24;
export const DEFAULT_STACK = 99;

export function itemName(id: string): string {
  return ITEMS[id]?.name ?? id;
}
