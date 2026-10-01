// 아바타 외형 — 성별과 상관없이 모든 항목을 조합할 수 있다(제작 프롬프트 5쪽).
// 첫 버전 자산: 헤어 4 · 일상 의상 4 · 웨딩 의상 2 · 신발 3 · 액세서리 4(+안경). 색상 변형은 모델 수와 따로 센다.
export type HairStyle = 'bob' | 'short' | 'long' | 'bun';
export type EyeStyle = 'round' | 'sparkle' | 'sleepy' | 'smiley';
export type BrowStyle = 'soft' | 'flat' | 'up';
export type Accessory = 'none' | 'crown' | 'ribbon' | 'straw' | 'pin';
export type BottomKind = 'shorts' | 'skirt' | 'pants' | 'dress' | 'longdress';

export interface Appearance {
  skin: number;
  hair: HairStyle;
  hairColor: number;
  eyes: EyeStyle;
  brows: BrowStyle;
  blush: number; // 0 없음 · 1 연분홍 · 2 복숭아
  glasses: boolean;
  accessory: Accessory;
  outfit: string; // 일상 의상 ID
  shoes: number;
  wedding: string | null; // 웨딩 의상 ID(입었으면)
}

export const SKINS = ['#FCE6D6', '#F4D3B9', '#E7BA95', '#C99169', '#9E6C4F'];
export const HAIR_COLORS = ['#3B2B24', '#6B4A35', '#A9744F', '#E5C38F', '#C9785B', '#7A7491'];
export const HAIR_STYLES: Array<{ id: HairStyle; name: string }> = [
  { id: 'bob', name: '단발' },
  { id: 'short', name: '짧은 머리' },
  { id: 'long', name: '긴 생머리' },
  { id: 'bun', name: '똥머리' },
];
export const EYE_STYLES: Array<{ id: EyeStyle; name: string }> = [
  { id: 'round', name: '동글' },
  { id: 'sparkle', name: '반짝' },
  { id: 'sleepy', name: '나른' },
  { id: 'smiley', name: '방긋' },
];
export const BROW_STYLES: Array<{ id: BrowStyle; name: string }> = [
  { id: 'soft', name: '둥근 눈썹' },
  { id: 'flat', name: '일자 눈썹' },
  { id: 'up', name: '올라간 눈썹' },
];
export const BLUSHES = ['없음', '연분홍', '복숭아'];
export const ACCESSORIES: Array<{ id: Accessory; name: string }> = [
  { id: 'none', name: '없음' },
  { id: 'crown', name: '화관' },
  { id: 'ribbon', name: '리본' },
  { id: 'straw', name: '밀짚모자' },
  { id: 'pin', name: '꽃핀' },
];
export const SHOES: Array<{ name: string; color: string; kind: 'sneaker' | 'dress' | 'sandal' }> = [
  { name: '운동화', color: '#F4F1EA', kind: 'sneaker' },
  { name: '구두', color: '#6B4A3A', kind: 'dress' },
  { name: '샌들', color: '#D9B48A', kind: 'sandal' },
];

export interface OutfitDef {
  id: string;
  name: string;
  wedding?: boolean;
  top: string;
  /** 상의 보조색(줄무늬·멜빵·셔츠 앞판) */
  accent: string;
  bottom: string;
  bottomKind: BottomKind;
  sleeves: 'short' | 'long' | 'none';
  /** 보조색을 어디에: 턱받이(멜빵·셔츠 앞판) · 옷깃 · 없음 */
  accentKind?: 'bib' | 'collar' | 'none';
  /** 전신 의상(상·하의를 한 벌로 덮음) — 상하의와 동시에 입지 않는다 */
  full?: boolean;
  /** 신발을 덮는 긴 치마(다리·신발 숨김 — 관통 방지) */
  hidesLegs?: boolean;
}

export const OUTFITS: Record<string, OutfitDef> = {
  tee: { id: 'tee', name: '티셔츠 & 반바지', top: '#F7E3A1', accent: '#F7E3A1', bottom: '#7FA3C7', bottomKind: 'shorts', sleeves: 'short', accentKind: 'none' },
  overall: { id: 'overall', name: '멜빵 원피스', top: '#FFFFFF', accent: '#9CC08B', bottom: '#9CC08B', bottomKind: 'skirt', sleeves: 'short', full: true, accentKind: 'bib' },
  knit: { id: 'knit', name: '니트 & 치마', top: '#E8B4C2', accent: '#FFF6F8', bottom: '#8E7EA8', bottomKind: 'skirt', sleeves: 'long', accentKind: 'collar' },
  shirt: { id: 'shirt', name: '셔츠 & 바지', top: '#CFE3EC', accent: '#FFFFFF', bottom: '#5E6E86', bottomKind: 'pants', sleeves: 'long', accentKind: 'collar' },
  aline: { id: 'aline', name: 'A라인 웨딩드레스', wedding: true, top: '#FFFDF7', accent: '#F4E9DA', bottom: '#FFFDF7', bottomKind: 'longdress', sleeves: 'none', full: true, hidesLegs: true, accentKind: 'none' },
  tux: { id: 'tux', name: '부드러운 턱시도', wedding: true, top: '#3E4556', accent: '#FFFFFF', bottom: '#3E4556', bottomKind: 'pants', sleeves: 'long', full: true, accentKind: 'bib' },
};

export const DAILY_OUTFITS = ['tee', 'overall', 'knit', 'shirt'];
export const WEDDING_OUTFITS = ['aline', 'tux'];

export const DEFAULT_PLAYER: Appearance = {
  skin: 1,
  hair: 'bob',
  hairColor: 1,
  eyes: 'round',
  brows: 'soft',
  blush: 1,
  glasses: false,
  accessory: 'none',
  outfit: 'tee',
  shoes: 0,
  wedding: null,
};

export const DEFAULT_PARTNER: Appearance = {
  skin: 1,
  hair: 'short',
  hairColor: 0,
  eyes: 'smiley',
  brows: 'flat',
  blush: 2,
  glasses: false,
  accessory: 'none',
  outfit: 'shirt',
  shoes: 1,
  wedding: null,
};

export function wornOutfit(a: Appearance): OutfitDef {
  return OUTFITS[a.wedding || a.outfit] || OUTFITS.tee;
}
