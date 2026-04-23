import { apiClient } from '../api/client';
import { useAuthStore } from '../store/auth.store';

const ONESIGNAL_PENDING_KEY = 'freetiful-onesignal-pending';

/**
 * Subscribe the current (logged-in) browser to web push.
 * Uses the JWT from apiClient — caller must be authenticated.
 * Returns the PushSubscription, or null if unsupported / denied / missing VAPID key.
 */
export async function registerPushSubscription(): Promise<PushSubscription | null> {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return null;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const keys = sub.toJSON().keys || {};
    await apiClient.post('/api/v1/push/subscribe', {
      endpoint: sub.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    });

    return sub;
  } catch (e) {
    console.error('Push subscription failed:', e);
    return null;
  }
}

function getIOSHandler(name: string) {
  if (typeof window === 'undefined') return null;
  const mh = (window as unknown as {
    webkit?: { messageHandlers?: Record<string, { postMessage: (body: unknown) => void }> };
  }).webkit?.messageHandlers;
  return mh?.[name] ?? null;
}

function getAndroidBridge():
  | { oneSignalLogin?: (userId: string) => void; oneSignalLogout?: () => void }
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
  // iOS
  const iosHandler = getIOSHandler('oneSignalLogin');
  if (iosHandler) {
    try {
      iosHandler.postMessage(userId);
      return;
    } catch {}
  }
  // Android
  const android = getAndroidBridge();
  if (android?.oneSignalLogin) {
    try {
      android.oneSignalLogin(userId);
    } catch {}
  }
}

/**
 * Notify the native WebView that the user has logged out, so the native app can
 * call `OneSignal.logout()` to clear the external_id alias on this device.
 */
export function notifyNativeLogout() {
  const iosHandler = getIOSHandler('socialLogout');
  if (iosHandler) {
    try {
      iosHandler.postMessage('');
      return;
    } catch {}
  }
  const android = getAndroidBridge();
  if (android?.oneSignalLogout) {
    try {
      android.oneSignalLogout();
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
export function initIOSPushBridge() {
  if (typeof window === 'undefined') return;
  (window as unknown as { bubble_fn_savePushId: (id: string) => void }).bubble_fn_savePushId = (
    playerId: string,
  ) => {
    if (!playerId) return;
    try {
      localStorage.setItem(ONESIGNAL_PENDING_KEY, playerId);
    } catch {}
    void flushOneSignalPlayerId();
  };
}

/**
 * If the user is authenticated and a pending OneSignal Player ID exists in
 * localStorage, POST it to the backend and clear the buffer. Safe to call at
 * any time — no-ops when nothing to flush or user is anonymous.
 */
export async function flushOneSignalPlayerId(): Promise<void> {
  if (typeof window === 'undefined') return;
  const playerId = (() => {
    try {
      return localStorage.getItem(ONESIGNAL_PENDING_KEY);
    } catch {
      return null;
    }
  })();
  if (!playerId) return;

  const token = useAuthStore.getState().accessToken;
  if (!token) return;

  try {
    await apiClient.post('/api/v1/push/onesignal/register', {
      playerId,
      platform: 'iOS',
    });
    try {
      localStorage.removeItem(ONESIGNAL_PENDING_KEY);
    } catch {}
  } catch (e) {
    console.error('OneSignal Player ID flush failed:', e);
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}
