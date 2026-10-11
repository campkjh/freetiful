'use client';

// 웨딩런 기기 저장(261011 사장 '최고점수·첫 완주 여부·최대 도달 구간·사운드 설정을 localStorage 에 저장')
//  · wr-best        최고점수(정수)
//  · wr-first-clear 첫 신혼집 도착 시각(ms) — 없으면 아직 완주 전
//  · wr-max-segment 가장 멀리 간 위치 = 완주 수 × 12 + 구간(0~11) — '다음 여정 2바퀴째 경복궁' 까지 보여 줄 수 있게
//  · wr-sound       '1' 켜짐 / '0' 꺼짐(처음엔 켜짐)
//  · wr-device-id   기기 uuid(게스트 순위 키)
//  · wr-nickname    정한 닉네임(없으면 기본 '꾸밈말 동물')
//  · wr-nickname-reset '1' = 기본 닉네임으로 되돌리기를 다음 기록 때 서버에 알릴 것(261011 검증 반영 — 서버가 직접 정한 이름을 지우게)
//  · wr-nickname-owner 위 두 값을 정한 계정('u:<id>' / 'guest') — (261011 검증 E4) 계정을 바꾸면 남의 계정 이름을 보내
//    '이미 다른 분이 쓰는 닉네임' 토스트가 계정 바꿀 때마다 반복됐다 → 주인이 다르면 보내지 않음(서버가 그 계정 이름 유지)
//  · 사파리 사생활 보호 모드·저장소 차단에서도 터지지 않게 전부 try — 실패하면 이번 방문 메모리에만 둔다.

export const WR_SEGMENT_COUNT = 12;

const K = {
  best: 'wr-best',
  firstClear: 'wr-first-clear',
  maxSegment: 'wr-max-segment',
  sound: 'wr-sound',
  device: 'wr-device-id',
  nickname: 'wr-nickname',
  nicknameReset: 'wr-nickname-reset',
  nicknameOwner: 'wr-nickname-owner',
} as const;

const mem: Record<string, string> = {};

function read(key: string): string | null {
  try {
    const v = window.localStorage.getItem(key);
    if (v != null) return v;
  } catch {
    /* 저장소 막힘 — 메모리 값 */
  }
  return key in mem ? mem[key] : null;
}

function write(key: string, value: string) {
  mem[key] = value;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 저장 불가 — 이번 방문만 */
  }
}

function readInt(key: string): number {
  const n = parseInt(read(key) || '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function getBest(): number {
  return readInt(K.best);
}

/** 더 높을 때만 저장 — 저장 뒤 최고점 */
export function saveBest(score: number): number {
  const s = Math.max(0, Math.floor(Number(score) || 0));
  const cur = getBest();
  if (s > cur) {
    write(K.best, String(s));
    return s;
  }
  return cur;
}

export function getFirstClearAt(): number | null {
  const n = readInt(K.firstClear);
  return n > 0 ? n : null;
}

/** 첫 완주는 처음 한 번만 기록(이미 있으면 그대로) */
export function markFirstClear(): number {
  const cur = getFirstClearAt();
  if (cur) return cur;
  const now = Date.now();
  write(K.firstClear, String(now));
  return now;
}

/** 가장 멀리 간 위치(완주 수 × 12 + 구간) */
export function getMaxProgress(): number {
  return readInt(K.maxSegment);
}

export function saveMaxProgress(laps: number, segment: number): number {
  const p = Math.max(0, Math.floor(laps)) * WR_SEGMENT_COUNT + Math.max(0, Math.min(WR_SEGMENT_COUNT - 1, Math.floor(segment)));
  const cur = getMaxProgress();
  if (p > cur) {
    write(K.maxSegment, String(p));
    return p;
  }
  return cur;
}

export function getSoundOn(): boolean {
  return read(K.sound) !== '0';
}

export function saveSoundOn(on: boolean) {
  write(K.sound, on ? '1' : '0');
}

function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* 아래로 */
  }
  const b = new Uint8Array(16);
  try {
    crypto.getRandomValues(b);
  } catch {
    for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  }
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function getDeviceId(): string {
  const saved = read(K.device);
  if (saved && /^[0-9a-f-]{16,64}$/i.test(saved)) return saved;
  const id = uuid();
  write(K.device, id);
  return id;
}

export function getSavedNickname(): string | null {
  const s = read(K.nickname);
  return s && s.trim() ? s.trim() : null;
}

export function saveNickname(s: string) {
  write(K.nickname, s.trim());
}

/** 기본 닉네임 되돌리기 대기 중인가 */
export function getNicknameReset(): boolean {
  return read(K.nicknameReset) === '1';
}

export function setNicknameReset(on: boolean) {
  write(K.nicknameReset, on ? '1' : '');
}

/** 정한 닉네임·되돌리기 값의 주인 계정('u:<id>' / 'guest', 예전 저장값은 null) */
export function getNicknameOwner(): string | null {
  const s = read(K.nicknameOwner);
  return s && s.trim() ? s.trim() : null;
}

export function setNicknameOwner(owner: string) {
  write(K.nicknameOwner, owner);
}
