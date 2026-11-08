'use client';

// 송년회 손님 = 이 기기(브라우저가 처음 만든 UUID) + 자리 탭에서 입력한 이름. 로그인 없음.
// 서버는 기기 id 로 사진 1장·좋아요/공감 10개 상한을 센다(머리글 X-RC-Device — lib/reception/api.ts).
import { useEffect, useState } from 'react';
import { RECEPTION_EVENT_KEY } from './event';

export interface ReceptionGuest {
  deviceId: string;
  name: string;
}

const KEY = `freetiful-reception-${RECEPTION_EVENT_KEY}`;
const EVT = 'freetiful:reception-guest';

function uuid() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {}
  const b = new Uint8Array(16);
  try { crypto.getRandomValues(b); } catch { for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256); }
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// 저장소가 막힌 브라우저(사생활 보호 등)에서도 이 탭 안에서는 같은 기기 id 를 쓴다
let memory: ReceptionGuest | null = null;

export function readGuest(): ReceptionGuest {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && typeof v.deviceId === 'string' && /^[0-9a-f-]{36}$/i.test(v.deviceId)) {
      memory = { deviceId: v.deviceId.toLowerCase(), name: typeof v.name === 'string' ? v.name : '' };
      return memory;
    }
  } catch {}
  if (!memory) memory = { deviceId: uuid(), name: '' };
  try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch {}
  return memory;
}

export const cleanGuestName = (v: string) => v.replace(/\s+/g, ' ').trim().slice(0, 20);

export function saveGuestName(name: string) {
  const next = { ...readGuest(), name: cleanGuestName(name) };
  memory = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  window.dispatchEvent(new Event(EVT));
  return next;
}

/** 첫 그리기(서버)에선 null — 하이드레이션 뒤 저장된 값으로 채운다 */
export function useReceptionGuest() {
  const [guest, setGuest] = useState<ReceptionGuest | null>(null);
  useEffect(() => {
    const sync = () => setGuest({ ...readGuest() });
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener('storage', sync); };
  }, []);
  return guest;
}
