import { apiClient } from '../api/client';
import { useAuthStore } from '../store/auth.store';

const ONESIGNAL_PENDING_KEY = 'freetiful-onesignal-pending';
const ONESIGNAL_PENDING_PLATFORM_KEY = 'freetiful-onesignal-pending-platform';

type PendingOneSignalId = {
  playerId: string;
  platform: string;
};

/**
 * Subscribe the current (logged-in) browser to web push.
 * Uses the JWT from apiClient — caller must be authenticated.
 * Returns the PushSubscription, or null if unsupported / denied / missing VAPID key.
 */
export async function registerPushSubscription(): Promise<PushSubscription | null> {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return null;

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return null;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      await postWebSubscription(existing);
      return existing;
    }

    if (Notification.permission === 'denied') return null;
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    await postWebSubscription(sub);
    return sub;
  } catch (e) {
    console.error('Push subscription failed:', e);
    return null;
  }
}

async function postWebSubscription(sub: PushSubscription) {
  const keys = sub.toJSON().keys || {};
  if (!sub.endpoint || !keys.p256dh || !keys.auth) return;
  await apiClient.post('/api/v1/push/subscribe', {
    endpoint: sub.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  });
}

function getIOSHandler(name: string) {
  if (typeof window === 'undefined') return null;
  const mh = (window as unknown as {
    webkit?: { messageHandlers?: Record<string, { postMessage: (body: unknown) => void }> };
  }).webkit?.messageHandlers;
  return mh?.[name] ?? null;
}

function getAndroidBridge():
  | {
      oneSignalLogin?: (userId: string) => void;
      pushLogin?: (userId: string) => void;
      setOneSignalExternalId?: (userId: string) => void;
      oneSignalLogout?: () => void;
      pushLogout?: () => void;
    }
  | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { Android?: Record<string, (...args: unknown[]) => void> })
    .Android as never;
}

/**
 * Notify the native WebView (iOS or Android) that a user is authenticated,
 * so the native app can call `OneSignal.login(userId)` and set the external_id alias.
 * Required because auto-login / webview-based login never triggers the native
 * OAuth flow, leaving OneSignal unmapped.
 * No-op on desktop browsers or when the handler isn't registered (older builds).
 */
export function notifyNativeLogin(userId: string | undefined | null) {
  if (!userId) return;
  let delivered = false;
  for (const handlerName of ['oneSignalLogin', 'pushLogin', 'setOneSignalExternalId']) {
    const iosHandler = getIOSHandler(handlerName);
    if (!iosHandler) continue;
    try {
      iosHandler.postMessage(userId);
      delivered = true;
    } catch {}
  }
  const android = getAndroidBridge();
  if (android?.oneSignalLogin) {
    try {
      android.oneSignalLogin(userId);
      delivered = true;
    } catch {}
  }
  if (android?.pushLogin) {
    try {
      android.pushLogin(userId);
      delivered = true;
    } catch {}
  }
  if (android?.setOneSignalExternalId) {
    try {
      android.setOneSignalExternalId(userId);
      delivered = true;
    } catch {}
  }
  if (!delivered) return;
}

/**
 * Notify the native WebView that the user has logged out, so the native app can
 * call `OneSignal.logout()` to clear the external_id alias on this device.
 */
export function notifyNativeLogout() {
  for (const handlerName of ['oneSignalLogout', 'pushLogout', 'socialLogout']) {
    const iosHandler = getIOSHandler(handlerName);
    if (!iosHandler) continue;
    try {
      iosHandler.postMessage('');
    } catch {}
  }
  const android = getAndroidBridge();
  if (android?.oneSignalLogout) {
    try {
      android.oneSignalLogout();
    } catch {}
  }
  if (android?.pushLogout) {
    try {
      android.pushLogout();
    } catch {}
  }
}

// Backwards-compatible aliases — existing call sites can keep using old names.
export const notifyIOSLogin = notifyNativeLogin;
export const notifyIOSLogout = notifyNativeLogout;

/**
 * Install the iOS WebView → web bridge for OneSignal Player ID.
 * The native app calls `window.bubble_fn_savePushId(playerId)` once permission
 * is granted. We buffer the id in localStorage (since the user may not be logged
 * in yet when iOS fires this) and flush to the API on next authenticated moment.
 */
export function initNativePushBridge() {
  if (typeof window === 'undefined') return;
  const w = window as unknown as Record<string, (payload: unknown) => void>;
  const save = (payload: unknown, fallbackPlatform = 'native') => {
    const parsed = parseOneSignalPayload(payload, fallbackPlatform);
    if (!parsed) return;
    try {
      localStorage.setItem(ONESIGNAL_PENDING_KEY, JSON.stringify(parsed));
      localStorage.setItem(ONESIGNAL_PENDING_PLATFORM_KEY, parsed.platform);
    } catch {}
    void flushOneSignalPlayerId();
  };

  w.bubble_fn_savePushId = (payload: unknown) => save(payload, 'iOS');
  w.bubble_fn_saveOneSignalPlayerId = (payload: unknown) => save(payload, 'iOS');
  w.freetifulSavePushId = (payload: unknown) => save(payload, 'native');
  w.savePushId = (payload: unknown) => save(payload, 'native');
  w.saveOneSignalPlayerId = (payload: unknown) => save(payload, 'native');
}

export const initIOSPushBridge = initNativePushBridge;

function parseOneSignalPayload(payload: unknown, fallbackPlatform: string): PendingOneSignalId | null {
  if (typeof payload === 'string') {
    const playerId = payload.trim();
    return playerId ? { playerId, platform: fallbackPlatform } : null;
  }
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  const id = obj.playerId || obj.subscriptionId || obj.pushId || obj.token || obj.id;
  if (typeof id !== 'string' || !id.trim()) return null;
  const platform = obj.platform || obj.os || obj.deviceType || fallbackPlatform;
  return {
    playerId: id.trim(),
    platform: typeof platform === 'string' && platform.trim() ? platform.trim() : fallbackPlatform,
  };
}

function getPendingOneSignalId(): PendingOneSignalId | null {
  try {
    const raw = localStorage.getItem(ONESIGNAL_PENDING_KEY);
    if (!raw) return null;
    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw);
      return parseOneSignalPayload(parsed, parsed?.platform || 'native');
    }
    return {
      playerId: raw,
      platform: localStorage.getItem(ONESIGNAL_PENDING_PLATFORM_KEY) || 'iOS',
    };
  } catch {
    return null;
  }
}

/**
 * If the user is authenticated and a pending OneSignal Player ID exists in
 * localStorage, POST it to the backend and clear the buffer. Safe to call at
 * any time — no-ops when nothing to flush or user is anonymous.
 */
export async function flushOneSignalPlayerId(): Promise<void> {
  if (typeof window === 'undefined') return;
  const pending = getPendingOneSignalId();
  if (!pending?.playerId) return;

  const token = useAuthStore.getState().accessToken;
  if (!token) return;

  try {
    await apiClient.post('/api/v1/push/onesignal/register', {
      playerId: pending.playerId,
      platform: pending.platform,
    });
    try {
      localStorage.removeItem(ONESIGNAL_PENDING_KEY);
      localStorage.removeItem(ONESIGNAL_PENDING_PLATFORM_KEY);
    } catch {}
  } catch (e) {
    console.error('OneSignal Player ID flush failed:', e);
  }
}

export async function syncPushRegistration(userId?: string | null): Promise<void> {
  if (userId) notifyNativeLogin(userId);
  await Promise.allSettled([
    registerPushSubscription(),
    flushOneSignalPlayerId(),
  ]);
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}
