// 웨딩런 화면 문구·숫자 도우미(261011 사장 '웨딩런: 신혼집까지 달려!' — 12구간·5단계)
//  · 순수 함수만 — 화면·공유·OG(서버)가 같이 쓴다. 엔진·Phaser 를 import 하지 않는다.
//  · 구간 번호 0~11 = 사양서 [5] 순서, 단계 번호 0~4 = 사양서 [4] 1~5단계.

export const GAME_TITLE = '웨딩런: 신혼집까지 달려!';

/** 사양서 [5] 12구간 이름(assets.ts WR_SEGMENTS 의 name 과 같은 순서) */
export const SEGMENT_NAMES = [
  '서울',
  '종로',
  '경복궁',
  '상견례',
  '드레스 매장',
  '가전 매장',
  '웨딩플래너 상담',
  '빈 웨딩홀',
  '하객 웨딩홀',
  '비행기',
  '발리',
  '신혼집',
] as const;

export const SEGMENT_COUNT = SEGMENT_NAMES.length;
/** 발리 구간(신혼여행) — 공유 문구 판정 */
export const HONEYMOON_FROM = 9; // 비행기부터 = 신혼여행 출발
export const GROOM_STAGE = 3; // 4단계(0부터 3) = 신랑 합류

/** 사양서 [4] 단계 이름·전환 문구('진화' 대신 '준비 완료'·'다음 여정') */
export const STAGE_INFO = [
  { name: '웨딩드레스 신부', toast: '결혼 준비, 출발!' },
  { name: '부케를 든 신부', toast: '부케 장착!' },
  { name: '부케·베일·티아라 신부', toast: '본식 준비 완료!' },
  { name: '신랑과 나란히', toast: '신랑 합류! 이제 같이 준비해♥' },
  { name: '손잡고 함께', toast: '신혼집까지 함께!' },
] as const;

export function clampSegment(n: unknown): number {
  return Math.max(0, Math.min(SEGMENT_COUNT - 1, Math.floor(Number(n) || 0)));
}

export function clampStage(n: unknown): number {
  return Math.max(0, Math.min(4, Math.floor(Number(n) || 0)));
}

export function segmentName(n: unknown): string {
  return SEGMENT_NAMES[clampSegment(n)];
}

export function fmtScore(n: unknown): string {
  return Math.max(0, Math.floor(Number(n) || 0)).toLocaleString('ko-KR');
}

/** 종료 화면 맨 위 '도달 결과' */
export function reachHeadline(r: { arrived: boolean; segment: number; laps: number }): string {
  if (r.laps >= 2) return `신혼집 ${r.laps}번 입주 성공!`;
  if (r.arrived) return '신혼집 입주 성공!';
  const s = clampSegment(r.segment);
  if (s === SEGMENT_COUNT - 1) return '신혼집 바로 앞까지!';
  return `${SEGMENT_NAMES[s]}까지 도착!`;
}

/** 짧은 도달 표시(랭킹 줄·도전 배너·공유 글) */
export function reachShort(r: { arrived: boolean; segment: number; laps?: number }): string {
  if (r.arrived) return (r.laps ?? 1) >= 2 ? `신혼집 ${r.laps}번 입주` : '신혼집 입주';
  return `${segmentName(r.segment)} 구간`;
}

/** 가장 멀리 간 위치(완주 수 × 12 + 구간) → 사람 말 */
export function progressLabel(p: number): string {
  const laps = Math.floor(Math.max(0, p) / SEGMENT_COUNT);
  const seg = Math.max(0, p) % SEGMENT_COUNT;
  if (laps <= 0) return SEGMENT_NAMES[seg];
  if (seg === 0) return laps === 1 ? '신혼집 입주 완료' : `신혼집 ${laps}번 입주`;
  return `다음 여정 ${laps + 1}바퀴째 ${SEGMENT_NAMES[seg]}`;
}
