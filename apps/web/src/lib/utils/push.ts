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
