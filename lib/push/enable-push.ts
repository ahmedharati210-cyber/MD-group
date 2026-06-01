import { getPortalServiceWorkerRegistration } from "@/lib/push/portal-sw";
import { clearPortalAppBadge } from "@/lib/push/sync-app-badge";
import {
  arrayBufferToBase64Url,
  isPushSupported,
  urlBase64ToUint8Array,
} from "@/lib/push/client";

export type WebPushStatus =
  | "loading"
  | "unsupported"
  | "unconfigured"
  | "off"
  | "on"
  | "denied";

export type WebPushEnableResult =
  | "granted"
  | "denied"
  | "error"
  | "unconfigured"
  | "unsupported";

export async function getWebPushStatus(): Promise<{
  status: WebPushStatus;
  endpoint: string | null;
}> {
  if (!isPushSupported()) {
    return { status: "unsupported", endpoint: null };
  }

  const keyRes = await fetch("/api/push/vapid-public-key");
  if (!keyRes.ok) {
    return { status: "unconfigured", endpoint: null };
  }

  const reg = await getPortalServiceWorkerRegistration();
  if (!reg) {
    return { status: "unsupported", endpoint: null };
  }

  if (Notification.permission === "denied") {
    return { status: "denied", endpoint: null };
  }

  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    return { status: "on", endpoint: sub.endpoint };
  }

  return { status: "off", endpoint: null };
}

export async function enableWebPush(): Promise<WebPushEnableResult> {
  if (!isPushSupported()) return "unsupported";

  const keyRes = await fetch("/api/push/vapid-public-key");
  if (!keyRes.ok) return "unconfigured";

  const { publicKey } = (await keyRes.json()) as { publicKey: string };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const reg = await getPortalServiceWorkerRegistration();
  if (!reg) return "unsupported";

  try {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: {
          p256dh: arrayBufferToBase64Url(sub.getKey("p256dh")!),
          auth: arrayBufferToBase64Url(sub.getKey("auth")!),
        },
      }),
    });

    if (!res.ok) return "error";
    return "granted";
  } catch {
    return "error";
  }
}

export async function disableWebPush(): Promise<boolean> {
  try {
    const reg = await getPortalServiceWorkerRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    await clearPortalAppBadge();
    return true;
  } catch {
    return false;
  }
}

export const PUSH_OPT_IN_DISMISS_KEY = "push-opt-in-dismissed-v1";
const PUSH_OPT_IN_DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

export function isPushOptInDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(PUSH_OPT_IN_DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return true;
    return Date.now() - at < PUSH_OPT_IN_DISMISS_MS;
  } catch {
    return false;
  }
}

export function dismissPushOptIn(): void {
  try {
    localStorage.setItem(PUSH_OPT_IN_DISMISS_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function resetPushOptInDismiss(): void {
  try {
    localStorage.removeItem(PUSH_OPT_IN_DISMISS_KEY);
  } catch {
    // ignore
  }
}

/** Whether the standalone PWA opt-in modal should appear. */
export async function shouldShowPushOptIn(isStandalone: boolean): Promise<boolean> {
  if (!isStandalone) return false;
  if (isPushOptInDismissedRecently()) return false;
  if (!isPushSupported()) return false;

  const keyRes = await fetch("/api/push/vapid-public-key");
  if (!keyRes.ok) return false;

  if (Notification.permission === "denied") return false;

  const reg = await getPortalServiceWorkerRegistration();
  if (!reg) return false;

  const sub = await reg.pushManager.getSubscription();
  return !sub;
}
