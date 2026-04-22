import { apiClient } from '../api/client';

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

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}
