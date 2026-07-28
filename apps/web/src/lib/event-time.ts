/**
 * 행사 시각 포맷 — 사용자가 입력한 '벽시계 시각'을 그대로 보여준다.
 *
 * 행사 시각은 DB 에 UTC 표기(…T22:10:00.000Z)로 저장되지만 그 값은 시간대 변환 대상이
 * 아니라 "저녁 10시 10분"이라는 입력값 자체다. 그래서 new Date(v).getHours() 로 읽으면
 * 기기 시간대만큼 밀려(KST 면 +9h) 22:10 이 07:10 으로 보이는 버그가 난다.
 * → ISO 문자열에서 시:분을 문자 그대로 뽑고, 그게 불가능할 때만 UTC 기준으로 읽는다.
 *
 * 새요청 목록(pro-dashboard/inquiries)·프리페치가 쓰던 방식과 동일하게 맞춘 것.
 */
export function formatEventTime(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') {
    // "22:10" / "22:10:00" 처럼 이미 시각 문자열
    if (/^\d{1,2}:\d{2}/.test(value)) {
      const [h, m] = value.split(':');
      return `${h.padStart(2, '0')}:${m.slice(0, 2)}`;
    }
    // "2026-07-28T22:10:00.000Z" → "22:10" (시간대 변환 없이 문자 그대로)
    const iso = value.match(/T(\d{2}):(\d{2})/);
    if (iso) return `${iso[1]}:${iso[2]}`;
  }
  try {
    const d = value instanceof Date ? value : new Date(value as any);
    if (Number.isNaN(d.getTime())) return '';
    // Date 객체로 들어온 경우도 저장된 벽시계(UTC 표기) 기준으로 읽는다.
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}
