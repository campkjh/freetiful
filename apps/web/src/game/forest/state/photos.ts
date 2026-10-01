// 사진 앨범 — 원본(중간 크기)과 썸네일을 이 브라우저 IndexedDB 에 보관. 저장 데이터에는 사진 ID 만 남긴다.
// IndexedDB 를 못 쓰는 환경(사생활 보호 창 등)에선 메모리에만 두고, 저장 실패를 알려 다시 시도하게 한다.
export interface PhotoRecord {
  id: string;
  full: string; // dataURL(jpeg)
  thumb: string; // dataURL(jpeg)
  createdAt: number;
  caption: string;
}

const DB = 'wedding-forest';
const STORE = 'photos';
const memory = new Map<string, PhotoRecord>();

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no-idb'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('idb-open'));
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

export async function putPhoto(rec: PhotoRecord): Promise<boolean> {
  memory.set(rec.id, rec);
  try {
    await tx('readwrite', (s) => s.put(rec));
    return true;
  } catch {
    return false;
  }
}

export async function getPhoto(id: string): Promise<PhotoRecord | null> {
  if (memory.has(id)) return memory.get(id)!;
  try {
    const r = await tx<PhotoRecord | undefined>('readonly', (s) => s.get(id) as IDBRequest<PhotoRecord | undefined>);
    if (r) memory.set(id, r);
    return r || null;
  } catch {
    return null;
  }
}

export async function deletePhoto(id: string): Promise<void> {
  memory.delete(id);
  try {
    await tx('readwrite', (s) => s.delete(id));
  } catch {
    /* 무시 */
  }
}

/** 캔버스(렌더러)에서 사진을 만든다 — 원본 960px · 썸네일 320px */
export function makePhotoFromCanvas(src: HTMLCanvasElement, caption: string, frame: 'none' | 'polaroid' | 'flower' = 'none'): PhotoRecord {
  const id = `p${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`;
  const fullW = 960;
  const ratio = src.height / src.width;
  const full = drawScaled(src, fullW, Math.round(fullW * ratio), frame);
  const thumb = drawScaled(src, 320, Math.round(320 * ratio), frame);
  return { id, full: full.toDataURL('image/jpeg', 0.86), thumb: thumb.toDataURL('image/jpeg', 0.8), createdAt: Date.now(), caption };
}

function drawScaled(src: HTMLCanvasElement, w: number, h: number, frame: 'none' | 'polaroid' | 'flower'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.drawImage(src, 0, 0, w, h);
  if (frame === 'polaroid') {
    const b = Math.round(w * 0.035);
    g.fillStyle = '#FFFDF8';
    g.fillRect(0, 0, w, b);
    g.fillRect(0, 0, b, h);
    g.fillRect(w - b, 0, b, h);
    g.fillRect(0, h - b * 3, w, b * 3);
    g.fillStyle = '#7A6A58';
    g.font = `600 ${Math.round(b * 1.1)}px Pretendard, sans-serif`;
    g.textAlign = 'center';
    g.fillText('결혼의 숲', w / 2, h - b * 1.2);
  } else if (frame === 'flower') {
    const r = Math.round(w * 0.018);
    const colors = ['#FFFFFF', '#F4B9C9', '#F6D46B', '#FFFFFF'];
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      const pts = [
        [t * w, r * 1.4],
        [t * w, h - r * 1.4],
        [r * 1.4, t * h],
        [w - r * 1.4, t * h],
      ];
      pts.forEach(([x, y], k) => {
        g.fillStyle = colors[(i + k) % colors.length];
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          g.beginPath();
          g.arc(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.55, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = '#F2C14E';
        g.beginPath();
        g.arc(x, y, r * 0.35, 0, Math.PI * 2);
        g.fill();
      });
    }
  }
  return c;
}
