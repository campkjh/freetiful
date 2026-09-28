// 웨딩홀 상세 정보(260928 다이렉트결혼준비 제휴 웨딩홀 가져오기) — 업체 descriptionHtml 안의 숨은 표시
// `<!--freetiful-hall-info:BASE64(JSON)-->` 로 들어온다(스키마 변경 없이, 태그 표시와 같은 방식).
// 상세 화면(businesses/[id])이 '웨딩홀 정보'(이런 점이 좋아요 · 홀 타입 · 메뉴 · 식대 · 보증 인원 · 주차)와 '홀 안내'(홀별 사진 · 예식 · 수용 · 식대 · 대관료…)로 그린다.

export type HallDetail = {
  name: string;
  floor?: string;
  /** '웨딩홀 컨벤션 분리/70분' */
  style?: string;
  /** '최소 250명 착석 170명 최대 700명' */
  capacity?: string;
  /** '뷔페 75,000원' */
  meal?: string;
  /** '대관료 있음 7,500,000원 연출료 (필수)' */
  rental?: string;
  flower?: string;
  drink?: string;
  images?: string[];
};

export type HallInfo = {
  v: number;
  /** 정보 출처(제휴사 이름) */
  source?: string;
  keypoints?: string[];
  hallType?: string;
  menu?: string;
  mealPrice?: string;
  guarantee?: string;
  parking?: string;
  halls?: HallDetail[];
};

const HALL_MARKER_RE = /<!--freetiful-hall-info:([A-Za-z0-9+/=]+)-->/;

export function extractHallInfo(html?: string | null): HallInfo | null {
  const encoded = String(html || '').match(HALL_MARKER_RE)?.[1];
  if (!encoded) return null;
  try {
    const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    const info = JSON.parse(new TextDecoder().decode(bytes));
    return info && typeof info === 'object' ? (info as HallInfo) : null;
  } catch {
    return null;
  }
}

const tidy = (s?: string) => String(s || '').replace(/\s+/g, ' ').trim();

/** '최소 보증 인원 250명, 최대 수용 인원 700명' → '최소 250명 · 최대 700명' */
export const formatGuarantee = (s?: string) =>
  tidy(s).replace(/최소\s*보증\s*인원\s*/, '최소 ').replace(/,\s*최대\s*수용\s*인원\s*/, ' · 최대 ');

/** '2500대 / 무료3시간' → '2,500대 · 무료 3시간' */
export const formatParking = (s?: string) =>
  tidy(s)
    .replace(/(\d{4,})대/, (_, n) => `${Number(n).toLocaleString('ko-KR')}대`)
    .replace(/\s*\/\s*/g, ' · ')
    .replace(/(무료|유료)(\d)/, '$1 $2');

/** '웨딩홀 컨벤션 분리/70분' → '웨딩홀 컨벤션 · 분리예식 · 70분 간격' */
export const formatStyle = (s?: string) =>
  tidy(s).replace(/\s*((?:동시|분리)(?:,\s*(?:동시|분리))?)\/(\d+)분$/, (_, kind: string, min: string) => ` · ${kind.replace(/,\s*/, '·')}예식 · ${min}분 간격`);

/** '최소 250명 착석 170명 최대 700명' → '최소 250명 · 착석 170명 · 최대 700명' */
export const formatCapacity = (s?: string) => tidy(s).replace(/명\s+(?=\S)/g, '명 · ');

/** '대관료 있음 7,500,000원 연출료 (필수)' → '대관료 7,500,000원 · 연출료 필수' */
export const formatRental = (s?: string) =>
  tidy(s)
    .replace(/대관료\s*있음\s*/, '대관료 ')
    .replace(/연출료\s*있음\s*/, '연출료 ')
    .replace(/\s+연출료/, ' · 연출료')
    .replace(/\s*\(필수\)/g, ' 필수');

/** '꽃장식 (필수) 대관료 포함' → '꽃장식 필수 · 대관료 포함' */
export const formatFlower = (s?: string) => tidy(s).replace(/\s*\(필수\)\s*/g, ' 필수 · ').replace(/ · $/, '');
