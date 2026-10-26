/**
 * 어드민 결제 조회 · 정산 내역 공용 — 돋보기 검색과 결제일/예식일 정렬(261026 사장 전달 운영팀 요청
 * '이나연 고객을 채팅 매칭에서 찾아 날짜를 알아낸 뒤 결제 조회에서 일일이 찾아야 한다' · '결제일/예식일 오름·내림차순').
 * 결제일(paymentPaidAt)·예식일(paymentEventOf)은 계산값이라 DB 정렬이 안 된다 → 거르기 조건에 맞는 줄의 키만 받아
 * 여기서 거르고 정렬한 뒤, 그 페이지 줄만 자세히 다시 받는다(결제 수가 수천 건 안쪽이라 충분).
 */

export type AdminPaySort = 'paid_desc' | 'paid_asc' | 'event_asc' | 'event_desc';

const SORTS: readonly AdminPaySort[] = ['paid_desc', 'paid_asc', 'event_asc', 'event_desc'];

/** 모르는 값·빈 값 = 결제일 최신순(예전 기본 순서) */
export function parseAdminPaySort(v?: string | null): AdminPaySort {
  return SORTS.includes(v as AdminPaySort) ? (v as AdminPaySort) : 'paid_desc';
}

/** 띄어쓰기·대소문자 무시('이 나연' = '이나연') */
const fold = (s: string) => s.toLowerCase().replace(/\s+/g, '');

export interface AdminSearchQuery {
  /** 접은 글자 */
  text: string;
  /** 연락처로 볼 숫자 — 숫자·하이픈·괄호·+·띄어쓰기만으로 된 검색어일 때(3자리 이상) */
  digits: string | null;
}

export function parseAdminSearch(raw?: string | null): AdminSearchQuery | null {
  const text = fold(String(raw ?? '').slice(0, 100));
  if (!text) return null;
  const digits = /^[\d\-()+.]+$/.test(text) ? text.replace(/\D/g, '') : '';
  return { text, digits: digits.length >= 3 ? digits : null };
}

export interface AdminSearchFields {
  /** 고객·사회자 이름, 행사 제목·종류·장소 */
  texts: Array<string | null | undefined>;
  /** 고객 연락처(결제 때 받은 번호 · 계정 번호) — 하이픈이 있든 없든 숫자로 맞춘다 */
  phones: Array<string | null | undefined>;
  /** 결제 ID · 주문번호 — 6자 이상일 때만(짧은 숫자가 UUID 속 숫자에 걸리지 않게) */
  ids: Array<string | null | undefined>;
}

export function matchesAdminSearch(q: AdminSearchQuery, f: AdminSearchFields): boolean {
  if (f.texts.some((t) => t && fold(t).includes(q.text))) return true;
  if (q.digits && f.phones.some((p) => p && p.replace(/\D/g, '').includes(q.digits!))) return true;
  if (q.text.length >= 6 && f.ids.some((id) => id && id.toLowerCase().includes(q.text))) return true;
  return false;
}

export interface AdminSortKey {
  id: string;
  paidAt: Date;
  /** 'YYYY-MM-DD' — 없으면 어느 쪽으로 정렬하든 맨 뒤 */
  eventDate: string | null;
}

/** 같은 값끼리는 결제일 최신 → id 순으로 고정(페이지를 넘겨도 줄이 겹치거나 빠지지 않게) */
export function compareAdminSort(sort: AdminPaySort, a: AdminSortKey, b: AdminSortKey): number {
  const paid = b.paidAt.getTime() - a.paidAt.getTime();
  const tie = paid || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (sort === 'paid_desc') return tie;
  if (sort === 'paid_asc') return -paid || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (a.eventDate !== b.eventDate) {
    if (!a.eventDate) return 1;
    if (!b.eventDate) return -1;
    const ev = a.eventDate < b.eventDate ? -1 : 1;
    return sort === 'event_asc' ? ev : -ev;
  }
  return tie;
}

export function sortAndPage<T>(rows: T[], sort: AdminPaySort, keyOf: (r: T) => AdminSortKey, page: number, limit: number): T[] {
  const keyed = rows.map((r) => ({ r, k: keyOf(r) }));
  keyed.sort((x, y) => compareAdminSort(sort, x.k, y.k));
  const start = (Math.max(1, page) - 1) * limit;
  return keyed.slice(start, start + limit).map((x) => x.r);
}

/** 정렬에 예식일이 필요한가 · 검색이 있나 — 둘 다 아니면 행사 정보(견적·매칭 요청)를 키 단계에서 안 받는다 */
export const needsEventKeys = (sort: AdminPaySort, q: AdminSearchQuery | null) => !!q || sort === 'event_asc' || sort === 'event_desc';
