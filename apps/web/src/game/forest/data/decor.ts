// 꾸미기 장식 — 배치 인스턴스는 { uid, id, x, z, rot } 로 저장. 발자국(footprint)은 회전 전 가로(w)·세로(d).
export type DecorRole = 'arch' | 'seat' | 'aisle' | 'light' | 'center' | 'cake' | 'pot' | 'post' | 'frame';
export type DecorArea = 'garden' | 'home';

export interface DecorDef {
  id: string;
  item: string;
  name: string;
  role: DecorRole;
  w: number;
  d: number;
  /** 사람이 지나갈 수 없는지(러그는 지나감) */
  solid: boolean;
  /** 입장 통로 위에 놓아도 되는지 */
  aisleOk: boolean;
  areas: DecorArea[];
}

export const DECOR: Record<string, DecorDef> = {
  arch: { id: 'arch', item: 'arch', name: '웨딩 아치', role: 'arch', w: 2.6, d: 0.7, solid: true, aisleOk: true, areas: ['garden'] },
  chair: { id: 'chair', item: 'chair', name: '하객 의자', role: 'seat', w: 0.62, d: 0.62, solid: true, aisleOk: false, areas: ['garden', 'home'] },
  aisle_rug: { id: 'aisle_rug', item: 'aisle_rug', name: '꽃길 러그', role: 'aisle', w: 1.3, d: 3.0, solid: false, aisleOk: true, areas: ['garden', 'home'] },
  centerpiece: { id: 'centerpiece', item: 'centerpiece', name: '센터피스', role: 'center', w: 0.8, d: 0.8, solid: true, aisleOk: false, areas: ['garden', 'home'] },
  lantern: { id: 'lantern', item: 'lantern', name: '숲속 랜턴', role: 'light', w: 0.5, d: 0.5, solid: true, aisleOk: false, areas: ['garden', 'home'] },
  cake_table: { id: 'cake_table', item: 'cake_table', name: '케이크 테이블', role: 'cake', w: 1.0, d: 1.0, solid: true, aisleOk: false, areas: ['garden', 'home'] },
  flower_pot: { id: 'flower_pot', item: 'flower_pot', name: '꽃 화분', role: 'pot', w: 0.6, d: 0.6, solid: true, aisleOk: false, areas: ['garden', 'home'] },
  ribbon_post: { id: 'ribbon_post', item: 'ribbon_post', name: '리본 기둥', role: 'post', w: 0.45, d: 0.45, solid: true, aisleOk: false, areas: ['garden', 'home'] },
  photo_frame: { id: 'photo_frame', item: 'photo_frame', name: '기념 액자', role: 'frame', w: 0.9, d: 0.6, solid: true, aisleOk: false, areas: ['home'] },
};

export interface PlacedDecor {
  uid: string;
  id: string;
  x: number;
  z: number;
  /** 0,1,2,3 = 0°,90°,180°,270° */
  rot: number;
}

/** 회전을 반영한 발자국 반폭 */
export function footprint(def: DecorDef, rot: number): { hw: number; hd: number } {
  const turned = rot % 2 === 1;
  return { hw: (turned ? def.d : def.w) / 2, hd: (turned ? def.w : def.d) / 2 };
}
