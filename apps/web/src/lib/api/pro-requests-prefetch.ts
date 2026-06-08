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

export async function prefetchProRequests(userId?: string | null) {
  if (typeof window === 'undefined') return;
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
    // 새요청 페이지가 떠 있으면 네이티브 브리지를 즉시 갱신
    (window as any).__freetifulInquiryRowsPost?.();
  } catch {
    // 실패해도 무시 (페이지 진입 시 정상 fetch)
  } finally {
    inFlight = false;
  }
}
