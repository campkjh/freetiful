// 동물 주민 — 퀘스트 안내판이 아니라 취향과 일정을 가진 이웃(제작 프롬프트 9쪽). 첫 버전: 소담·우디·도담.
// 예식 전용 하객 4명(루루·모리·보리·하랑)은 관계 시스템 없이 결혼식에만 온다.
export type Species = 'rabbit' | 'bear' | 'squirrel' | 'cat' | 'fox' | 'dog' | 'deer';

export interface AnimalLook {
  species: Species;
  fur: string;
  /** 귀 안쪽·주둥이·배 */
  light: string;
  /** 의상 몸통 */
  outfit: string;
  outfitAccent: string;
  bottom: 'shorts' | 'skirt' | 'pants';
  bottomColor: string;
  /** 손에 드는 것 */
  hold?: 'card' | 'watering' | 'hammer' | 'camera' | null;
  /** 옷 보조색 자리 — 앞치마·멜빵·셔츠 앞판(bib) / 옷깃(collar) */
  accentKind?: 'bib' | 'collar' | 'none';
  bow?: string;
}

export interface ScheduleSlot {
  from: number; // 시(0~24)
  to: number;
  node: string; // NAV_NODES 키
  activity: 'work' | 'walk' | 'rest' | 'sleep';
  label: string;
}

export interface ResidentDef {
  id: string;
  name: string;
  role: string;
  personality: string;
  look: AnimalLook;
  voice: { base: number; wave: OscillatorType };
  schedule: ScheduleSlot[];
  color: string; // 이름표 색
  likes: string[]; // 좋아하는 선물 아이템
}

export const RESIDENTS: Record<string, ResidentDef> = {
  sodam: {
    id: 'sodam',
    name: '소담',
    role: '꽃잎 온실 꽃집',
    personality: '다정하고 꼼꼼함',
    look: { species: 'rabbit', fur: '#F6F0E7', light: '#F6C9D3', outfit: '#F4C3D0', outfitAccent: '#FFFFFF', bottom: 'skirt', bottomColor: '#E8A9BC', hold: null, bow: '#FFFFFF', accentKind: 'bib' },
    voice: { base: 640, wave: 'sine' },
    color: '#D98AA3',
    likes: ['white_flower', 'pink_flower', 'rare_flower'],
    schedule: [
      { from: 6, to: 12, node: 'gh_counter', activity: 'work', label: '꽃에 물 주는 중' },
      { from: 12, to: 16, node: 'gh_farm', activity: 'walk', label: '화단 산책 중' },
      { from: 16, to: 21, node: 'plaza_bench', activity: 'rest', label: '광장 벤치에서 쉬는 중' },
      { from: 21, to: 30, node: 'gh_counter', activity: 'sleep', label: '온실에서 쉬는 중' },
    ],
  },
  woody: {
    id: 'woody',
    name: '우디',
    role: '나뭇결 공방',
    personality: '느긋하고 듬직함',
    look: { species: 'bear', fur: '#B0835C', light: '#E7CFAE', outfit: '#E9D9B6', outfitAccent: '#5C8A5E', bottom: 'pants', bottomColor: '#5C8A5E', hold: 'hammer', accentKind: 'bib' },
    voice: { base: 210, wave: 'triangle' },
    color: '#A77D5A',
    likes: ['wood', 'fruit', 'branch'],
    schedule: [
      { from: 7, to: 12, node: 'ws_bench', activity: 'work', label: '목재 다듬는 중' },
      { from: 12, to: 16, node: 'lake_deck', activity: 'walk', label: '호숫가 산책 중' },
      { from: 16, to: 22, node: 'ws_logs', activity: 'rest', label: '공방 앞에서 쉬는 중' },
      { from: 22, to: 31, node: 'ws_bench', activity: 'sleep', label: '공방에서 쉬는 중' },
    ],
  },
  dodam: {
    id: 'dodam',
    name: '도담',
    role: '결혼식 사회자',
    personality: '명랑하고 수다스러움',
    look: { species: 'squirrel', fur: '#CE8A52', light: '#F6E2C8', outfit: '#3F5B7A', outfitAccent: '#FFFFFF', bottom: 'shorts', bottomColor: '#3F5B7A', hold: 'card', bow: '#E46F8C', accentKind: 'bib' },
    voice: { base: 900, wave: 'square' },
    color: '#C9824F',
    likes: ['fruit', 'yellow_flower', 'bouquet'],
    schedule: [
      { from: 8, to: 12, node: 'plaza_board', activity: 'work', label: '광장에서 사회 연습 중' },
      { from: 12, to: 18, node: 'garden_arch', activity: 'walk', label: '서약의 정원 둘러보는 중' },
      { from: 18, to: 22, node: 'plaza_s', activity: 'rest', label: '광장에서 수다 떠는 중' },
      { from: 22, to: 32, node: 'garden_in', activity: 'sleep', label: '정원 입구에서 쉬는 중' },
    ],
  },
};

export const RESIDENT_IDS = ['sodam', 'woody', 'dodam'];

export interface GuestDef {
  id: string;
  name: string;
  look: AnimalLook;
}

export const GUESTS: GuestDef[] = [
  { id: 'lulu', name: '루루', look: { species: 'cat', fur: '#D8D3CE', light: '#F7F2EE', outfit: '#C8B6E2', outfitAccent: '#FFFFFF', bottom: 'skirt', bottomColor: '#B39DD6', bow: '#B39DD6' } },
  { id: 'mori', name: '모리', look: { species: 'fox', fur: '#E39A5B', light: '#FFF4E8', outfit: '#8C6A4F', outfitAccent: '#F2E6D2', bottom: 'pants', bottomColor: '#6E5442', hold: 'camera' } },
  { id: 'bori', name: '보리', look: { species: 'dog', fur: '#E3C79B', light: '#FBF1E1', outfit: '#F3D36B', outfitAccent: '#FFFFFF', bottom: 'shorts', bottomColor: '#7FA3C7' } },
  { id: 'harang', name: '하랑', look: { species: 'deer', fur: '#C7956A', light: '#F4E3CC', outfit: '#A9D3C2', outfitAccent: '#FFFFFF', bottom: 'skirt', bottomColor: '#8CC2AE' } },
];

/** 친밀도 단계 — 대사·선물 해금 기준 */
export function affinityLevel(points: number): number {
  if (points >= 12) return 3;
  if (points >= 6) return 2;
  if (points >= 2) return 1;
  return 0;
}
