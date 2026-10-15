const LANDING_PAGES: Record<string, string> = {
  '/quick-match': '퀵매칭',
  '/wedding-mc': '웨딩 MC 랜딩',
  '/corporate-mc': '기업행사 MC 랜딩',
  '/main': '홈',
  '/': '홈',
};

const SOURCE_PATHS = new Map([
  ['landing_quick_match', '/quick-match'],
  ['home_simple_request_modal', '/main'],
  ['freetiful-corporate-mc', '/corporate-mc'],
]);

/** The submitted form's source takes priority over the session's first landing URL. */
export function chatLandingSource(rawUserInput: unknown): { label: string; path: string | null } | null {
  if (!rawUserInput || typeof rawUserInput !== 'object' || Array.isArray(rawUserInput)) return null;
  const raw = rawUserInput as Record<string, unknown>;
  const source = typeof raw.source === 'string' ? raw.source.trim() : '';
  const sourcePath = SOURCE_PATHS.get(source);
  if (sourcePath) return { label: LANDING_PAGES[sourcePath], path: sourcePath };
  if (/^landing_wedding_mc(?:_v\d+)?$/.test(source) || /^freetiful-mc-wedding(?:-v\d+)?$/.test(source)) {
    return { label: LANDING_PAGES['/wedding-mc'], path: '/wedding-mc' };
  }
  if (source === 'pro_detail_inquiry') {
    const proId = typeof raw.targetProProfileId === 'string' ? raw.targetProProfileId.trim() : '';
    return { label: '사회자 상세', path: proId ? `/pros/${encodeURIComponent(proId)}` : null };
  }

  if (typeof raw.landing_url !== 'string' || !raw.landing_url.trim()) return null;
  try {
    const url = new URL(raw.landing_url.trim(), 'https://freetiful.com');
    if (!['https:', 'http:'].includes(url.protocol) || !/^(www\.)?freetiful\.(com|co\.kr)$/.test(url.hostname)) return null;
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const label = LANDING_PAGES[path] || (path.startsWith('/pros/') ? '사회자 상세' : null);
    return label ? { label, path } : null;
  } catch {
    return null;
  }
}
