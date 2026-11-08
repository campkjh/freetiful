'use client';

// 송년회 이벤트·설문 API(NestJS apps/api/src/reception) — 같은 출처 /api/v1/** 를 Next rewrites 가 Railway 로 넘긴다.
// apiClient(axios) 대신 fetch: 로그인 없는 화면이라 401 → 로그인 시트 흐름을 타면 안 된다(wedding-run.api.ts 와 같은 이유).
import { RECEPTION_EVENT_KEY } from './event';

const BASE = `/api/v1/reception/${RECEPTION_EVENT_KEY}`;

export type VoteKind = 'like' | 'empathy';

export interface ReceptionPhoto {
  id: string;
  name: string;
  imageUrl: string;
  thumbUrl: string;
  width: number;
  height: number;
  likes: number;
  empathies: number;
  createdAt: string;
  rank: number;
  mine: boolean;
  liked: boolean;
  empathized: boolean;
}

export interface ReceptionFeed {
  photos: ReceptionPhoto[];
  me: { likesLeft: number; empathiesLeft: number; myPhotoId: string | null; limit: number };
}

export interface SurveyAnswers {
  rating: number;
  best: string;
  again: 'yes' | 'maybe' | 'no';
  comment: string;
}

async function call<T>(path: string, deviceId: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'X-RC-Device': deviceId };
  if (init.body && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store', ...init, headers: { ...headers, ...(init.headers as any) } });
  if (!res.ok) {
    let msg = res.status === 413 ? '사진이 너무 커요. 다른 사진으로 올려 주세요.' : '잠시 후 다시 시도해 주세요.';
    try {
      const j = await res.json();
      const m = Array.isArray(j?.message) ? j.message[0] : j?.message;
      if (typeof m === 'string' && m && res.status < 500) msg = m;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const receptionApi = {
  feed: (deviceId: string) => call<ReceptionFeed>('/photos', deviceId),
  upload: (deviceId: string, name: string, file: Blob, fileName: string) => {
    const fd = new FormData();
    fd.append('name', name);
    fd.append('file', file, fileName);
    return call<ReceptionFeed>('/photos', deviceId, { method: 'POST', body: fd });
  },
  remove: (deviceId: string, id: string) => call<ReceptionFeed>(`/photos/${encodeURIComponent(id)}`, deviceId, { method: 'DELETE' }),
  vote: (deviceId: string, id: string, kind: VoteKind, on: boolean) =>
    call<ReceptionFeed>(`/photos/${encodeURIComponent(id)}/votes`, deviceId, { method: 'POST', body: JSON.stringify({ kind, on }) }),
  /** 손님 남기기(어드민 참여자 목록) — 이름이 있는 기기만, 화면을 열 때 한 번 */
  guest: (deviceId: string, name: string) => call<{ ok: boolean }>('/guest', deviceId, { method: 'PUT', body: JSON.stringify({ name }) }),
  survey: (deviceId: string) => call<{ survey: { name: string; answers: SurveyAnswers; updatedAt: string } | null }>('/survey', deviceId),
  saveSurvey: (deviceId: string, name: string, answers: SurveyAnswers) =>
    call<{ survey: { name: string; answers: SurveyAnswers; updatedAt: string } | null }>('/survey', deviceId, { method: 'PUT', body: JSON.stringify({ name, answers }) }),
};

/** 올리기 전에 줄인다 — 폰 원본(3~8MB)은 웹 앞단(Vercel) 본문 한도에 걸릴 수 있다. 실패하면 원본 그대로 */
export async function shrinkPhoto(file: File): Promise<{ blob: Blob; name: string }> {
  const MAX = 2048;
  try {
    let src: ImageBitmap | HTMLImageElement;
    let w: number;
    let h: number;
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
      src = bmp; w = bmp.width; h = bmp.height;
    } catch {
      const url = URL.createObjectURL(file);
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        src = img; w = img.naturalWidth; h = img.naturalHeight;
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    }
    const scale = Math.min(1, MAX / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no ctx');
    ctx.drawImage(src as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.88));
    if (!blob) throw new Error('no blob');
    return { blob, name: 'photo.jpg' };
  } catch {
    return { blob: file, name: file.name || 'photo.jpg' };
  }
}
