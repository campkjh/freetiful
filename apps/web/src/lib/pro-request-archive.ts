'use client';

const MATCH_REQUEST_ARCHIVE_KEY = 'freetiful-pro-match-request-archives-v1';
const AUTO_ARCHIVE_MS = 14 * 24 * 60 * 60 * 1000;

type ArchiveMeta = {
  archivedAt: string;
};

type ArchiveMap = Record<string, ArchiveMeta>;

function readArchiveMap(): ArchiveMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MATCH_REQUEST_ARCHIVE_KEY);
    return raw ? (JSON.parse(raw) as ArchiveMap) : {};
  } catch {
    return {};
  }
}

function writeArchiveMap(next: ArchiveMap) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MATCH_REQUEST_ARCHIVE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('freetiful:match-request-archive-changed'));
  } catch {}
}

export function archiveMatchRequest(id: string) {
  const current = readArchiveMap();
  current[id] = { archivedAt: new Date().toISOString() };
  writeArchiveMap(current);
}

export function isAutoArchivedMatchRequest(deliveredAt?: string | null) {
  if (!deliveredAt) return false;
  const deliveredTime = new Date(deliveredAt).getTime();
  if (Number.isNaN(deliveredTime)) return false;
  return Date.now() - deliveredTime >= AUTO_ARCHIVE_MS;
}

export function isArchivedMatchRequest(id: string, deliveredAt?: string | null) {
  const current = readArchiveMap();
  return Boolean(current[id]) || isAutoArchivedMatchRequest(deliveredAt);
}

export function splitArchivedMatchRequests<T extends { id: string; deliveredAt?: string | null }>(items: T[]) {
  const active: T[] = [];
  const archived: T[] = [];

  items.forEach((item) => {
    if (isArchivedMatchRequest(item.id, item.deliveredAt)) archived.push(item);
    else active.push(item);
  });

  return { active, archived };
}
