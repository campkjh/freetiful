import { matchApi } from './match.api';

// 새요청(/pro-dashboard/inquiries) 데이터를 앱 로드 시 미리 받아 캐시를 데워둔다.
// → 사용자가 새요청 탭을 누르면 페이지가 캐시를 즉시 읽어 렌더 + 네이티브 브리지로 바로 전달(콜드 지연 제거).
// 인콰이어리 페이지와 "동일한 캐시 키 + 매핑"을 사용한다(페이지는 건드리지 않음).

const MATCH_DELIVERIES_CACHE_KEY = 'freetiful-pro-simple-requests-cache-v1';

function cacheKey(userId?: string | null) {
  return userId ? `${MATCH_DELIVERIES_CACHE_KEY}:${userId}` : MATCH_DELIVERIES_CACHE_KEY;
}

function mapMatchDeliveries(items: any[]) {
  return items
    .filter((d: any) => ['pending', 'viewed', 'archived'].includes(d.status))
    .map((d: any) => {
      const raw = typeof d.matchRequest?.rawUserInput === 'object' && d.matchRequest?.rawUserInput
        ? d.matchRequest.rawUserInput
        : {};
      const requestKind = d.matchRequest?.type === 'single' ? 'single' : 'multi';
      return {
        id: d.id,
        matchRequestId: d.matchRequestId,
        customerId: d.matchRequest?.user?.id || '',
        customerName: d.matchRequest?.user?.name || '고객',
        customerImage: d.matchRequest?.user?.profileImageUrl || '/images/default-profile.png',
        requestKind,
        status: d.status || 'pending',
        categoryName: d.matchRequest?.category?.name || raw.categoryName || '사회자 요청',
        eventCategoryName: d.matchRequest?.eventCategory?.name || raw.eventType || '',
        eventDate: d.matchRequest?.eventDate || raw.date || null,
        eventTime: raw.timeStart || d.matchRequest?.eventTime || null,
        eventLocation: d.matchRequest?.eventLocation || raw.location || null,
        eventPart: raw.eventPart || null,
        note: raw.note || '',
        deliveredAt: d.deliveredAt,
      };
    });
}

let lastPrefetchTs = 0;
let inFlight = false;

// ─── iOS 네이티브 새요청 즉시 렌더 — 페이지 마운트 없이도 프리페치 데이터를 행으로 전송 ───
function inquiryTimeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}일 전`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function inquiryFormatDate(iso: string | null): string {
  if (!iso) return '일시 미정';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}/${d.getDate()} (${weekdays[d.getDay()]})`;
}
function inquiryFormatTime(value: string | null): string {
  if (!value) return '';
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  const isoTime = value.match(/T(\d{2}:\d{2})/);
  if (isoTime) return isoTime[1];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// 인콰이어리 페이지의 네이티브 행 매핑과 동일한 형태 (전체 탭 = archived 제외)
function postRowsToNative(mapped: any[]) {
  const handler = (window as any).webkit?.messageHandlers?.nativeInquiryRows;
  if (!handler) return;
  // 페이지가 이미 떠 있으면 페이지 쪽 포스트가 정확(탭 필터 반영) — 중복 전송 방지
  if ((window as any).__freetifulInquiryList) return;
  const rows = mapped
    .filter((r: any) => r.status !== 'archived')
    .map((r: any) => ({
      id: r.id,
      name: r.customerName,
      image: r.customerImage,
      kind: r.requestKind,
      isMulti: r.requestKind === 'multi',
      kindLabel: r.requestKind === 'multi' ? '다수요청' : '개인요청',
      timeAgo: inquiryTimeAgo(r.deliveredAt),
      category: [r.categoryName, r.eventCategoryName].filter(Boolean).join(' · '),
      parts: r.eventPart ? String(r.eventPart).split(', ').filter(Boolean) : [],
      dateText: `${inquiryFormatDate(r.eventDate)} ${inquiryFormatTime(r.eventTime)}`.trim(),
      location: r.eventLocation || '',
      note: r.note || '',
    }));
  try { handler.postMessage(rows); } catch {}
}

// 네이티브가 새요청 진입 시 호출 — 프리페치 캐시를 즉시 행으로 전송(페이지 로드 대기 없음)
function registerPrewarmBridge(userId?: string | null) {
  (window as any).__freetifulInquiryPrefetchPost = () => {
    try {
      const raw = localStorage.getItem(cacheKey(userId)) || localStorage.getItem(MATCH_DELIVERIES_CACHE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const mapped = Array.isArray(parsed?.data) ? parsed.data : (Array.isArray(parsed) ? parsed : []);
      if (!mapped.length) return false;
      postRowsToNative(mapped);
      return true;
    } catch { return false; }
  };
}

export async function prefetchProRequests(userId?: string | null) {
  if (typeof window === 'undefined') return;
  registerPrewarmBridge(userId);
  if (inFlight) return;
  if (Date.now() - lastPrefetchTs < 30_000) return; // 30초 쓰로틀
  inFlight = true;
  lastPrefetchTs = Date.now();
  try {
    const res: any = await matchApi.getProRequests({ limit: 100, skip: 0 });
    const items: any[] = Array.isArray(res) ? res : (res?.items || res?.data || res?.requests || []);
    const mapped = mapMatchDeliveries(items);
    const payload = JSON.stringify({ data: mapped, ts: Date.now() });
    localStorage.setItem(cacheKey(userId), payload);
    sessionStorage.setItem(MATCH_DELIVERIES_CACHE_KEY, JSON.stringify(mapped));
    // 새요청 페이지가 떠 있으면 페이지 브리지로, 아니면 네이티브에 직접 행 전송(즉시 렌더)
    (window as any).__freetifulInquiryRowsPost?.();
    postRowsToNative(mapped);
  } catch {
    // 실패해도 무시 (페이지 진입 시 정상 fetch)
  } finally {
    inFlight = false;
  }
}
