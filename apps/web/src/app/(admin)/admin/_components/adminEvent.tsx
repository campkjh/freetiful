/**
 * 정산 내역 · 결제 조회 공용 칸 — 누가(사회자 · 고객) · 어떤 행사를 언제 어디서
 * (261004 사장 '정산내역에 어디서 어떤 고객과 행사' · '결제조회도 정산내역이랑 동일하게').
 */

/** 서버(payment-event.ts)가 계산해 주는 행사 요약 */
export interface AdminEvent {
  title: string | null;
  kind: string | null;
  date: string | null;
  time: string | null;
  location: string | null;
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const DAY_MS = 86400000;
const KST_MS = 9 * 3600000;

/** 오늘 KST 'YYYY-MM-DD' */
export const kstToday = () => new Date(Date.now() + KST_MS).toISOString().slice(0, 10);
/** 'YYYY-MM-DD' → 날짜 번호(두 날짜 사이 일수 계산용) */
const dayNo = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
};
/** b − a (일) */
export const daysBetween = (a: string, b: string) => dayNo(b) - dayNo(a);

/** '10.14 (수)' — 연도가 올해가 아니면 앞에 붙인다 */
export function formatYmd(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const wd = WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const head = y !== Number(kstToday().slice(0, 4)) ? `${y}.` : '';
  return `${head}${m}.${d} (${wd})`;
}

/** 행사 일시 — '10.14 (수) 13:30' */
export function formatEventWhen(date?: string | null, time?: string | null): string {
  if (!date) return time || '';
  return `${formatYmd(date)}${time ? ` ${time}` : ''}`;
}

/** ISO 시각 → KST '10.01 (목) 14:32' */
export function formatKstDateTime(iso?: string | null): string {
  if (!iso) return '';
  const k = new Date(new Date(iso).getTime() + KST_MS);
  if (Number.isNaN(k.getTime())) return '';
  const ymd = k.toISOString().slice(0, 10);
  return `${formatYmd(ymd)} ${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`;
}

/** ISO 시각 → KST 'YYYY-MM-DD' */
export const kstYmd = (iso: string) => new Date(new Date(iso).getTime() + KST_MS).toISOString().slice(0, 10);

/** 저장은 숫자만(01012345678) — 보기 좋게 하이픈을 넣어 표시 */
export function formatPhone(raw?: string | null): string {
  const d = String(raw ?? '').replace(/[^0-9]/g, '');
  if (!d) return '';
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return String(raw ?? '');
}

/** 사회자 · 고객(전화 걸기) */
export function AdminPartyCell({ pro, customer, phone }: { pro?: string | null; customer?: string | null; phone?: string | null }) {
  return (
    <>
      <span className="adm-cell-main">{pro || '—'}</span>
      <span className="adm-cell-sub">
        고객 {customer || '—'}
        {phone && (
          <>
            {' · '}
            <a href={`tel:${phone}`} className="font-semibold text-[#3182F6] tabular-nums hover:underline">{formatPhone(phone)}</a>
          </>
        )}
      </span>
    </>
  );
}

/** 행사 — 종류 뱃지 · 제목 / 일시 · D-day · 장소 */
export function AdminEventCell({ ev }: { ev: AdminEvent }) {
  const when = formatEventWhen(ev.date, ev.time);
  const left = ev.date ? daysBetween(kstToday(), ev.date) : null;
  return (
    <>
      <span className="adm-ev-head">
        {ev.kind && <span className="adm-badge blue">{ev.kind}</span>}
        <span className={`adm-ev-title ${ev.title ? '' : 'none'}`}>{ev.title || '행사 정보 없음'}</span>
      </span>
      {(when || ev.location) && (
        <span className="adm-ev-meta">
          {when && (
            <span className="adm-ev-when">
              {when}
              {left != null && (
                <span className={`adm-ev-dday ${left < 0 ? 'past' : left === 0 ? 'today' : ''}`}>
                  {left < 0 ? '끝남' : left === 0 ? '오늘' : `D-${left}`}
                </span>
              )}
            </span>
          )}
          {ev.location && <span className="adm-ev-where">{ev.location}</span>}
        </span>
      )}
    </>
  );
}
