# Next.js 16 PWA Technical Brief

Use this as an implementation brief for another agent. It describes the architecture and moving parts needed to add a scoped PWA with install UI, service worker updates, and Web Push notifications in a Next.js 16 App Router project.

## Target Architecture

- Framework: Next.js 16 App Router.
- PWA scope: choose one app area, for example `/portal`, `/dashboard`, or `/app`.
- Manifest: serve a dedicated manifest for that app scope, for example `/app-manifest.json`.
- Service worker: generate or serve `/sw.js`, then register it manually from the scoped app shell.
- Registration strategy: do not auto-register globally. Register only inside the authenticated/app area that should behave like a PWA.
- UI pieces:
  - Install banner: mobile browser only.
  - Service worker update banner: shown when a new worker is waiting.
  - Push opt-in modal: shown only after the app is installed or running in standalone mode.
- Push transport: standard Web Push with VAPID keys and a persistent `push_subscriptions` table.

## Recommended File Structure

```txt
app/
  sw.ts
  offline/page.tsx
  app-area/layout.tsx
  api/push/
    vapid-public-key/route.ts
    subscribe/route.ts
    unsubscribe/route.ts
  api/app/badge-counts/route.ts

components/pwa/
  pwa-install-banner.tsx
  pwa-update-banner.tsx
  push-opt-in-modal.tsx
  push-notifications-settings-card.tsx

lib/pwa/
  service-worker-registration.ts
  use-is-standalone.ts
  use-push-status.ts
  use-push-refresh.ts
  use-push-rebind.ts
  push-client.ts
  push-config.ts
  push-send.ts
  push-subscription-schema.ts
  app-badge.ts

public/
  app-manifest.json
  icons/icon-192.png
  icons/icon-512.png
  icons/icon-512-maskable.png
  icons/apple-touch-icon.png
```

## Manifest Requirements

Create a manifest scoped to the app area:

```json
{
  "id": "/app-area",
  "name": "Application Name",
  "short_name": "App",
  "start_url": "/app-area",
  "scope": "/app-area",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#111827",
  "lang": "en",
  "dir": "ltr",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icons/apple-touch-icon.png",
      "sizes": "180x180",
      "type": "image/png",
      "purpose": "any"
    }
  ]
}
```

In the scoped layout:

```ts
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "App",
  applicationName: "App",
  manifest: "/app-manifest.json",
  appleWebApp: {
    capable: true,
    title: "App",
    statusBarStyle: "default",
  },
  icons: {
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};
```

## Next.js 16 Config Notes

Use App Router route handlers for APIs. Do not use Pages Router API handlers.

If using a generated worker library such as Serwist:

```ts
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" }
        ],
      },
      {
        source: "/app-manifest.json",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
          { key: "Cache-Control", value: "public, max-age=86400" }
        ],
      },
    ];
  },
};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  register: false,
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
```

Important:

- `register: false` keeps the service worker from registering site-wide.
- Disable the service worker in development to avoid stale caches.
- For production, ensure the build process actually emits `public/sw.js`.
- If using Next.js 16 APIs such as `cookies()`, `headers()`, `params`, or `searchParams`, treat them as async where required.
- If the project uses route interception, use `proxy.ts` instead of old `middleware.ts` naming in Next.js 16.

## Manual Service Worker Registration

Register the service worker only inside the PWA-scoped app shell:

```ts
let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function getAppServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }

  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register("/sw.js", { scope: "/app-area/" })
      .catch(() => null);
  }

  return registrationPromise;
}
```

The `scope` should match the manifest `scope`.

## Service Worker Responsibilities

The service worker should handle:

- Precaching static assets.
- Runtime caching for safe static resources.
- Network-only handling for dynamic API routes.
- Offline document fallback.
- Push notification display.
- Notification click navigation.
- Message bridge back to open app clients.
- Optional app badge sync.

Core push shape:

```ts
type PushPayload = {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  id?: string;
};
```

Push event behavior:

```ts
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const payload = event.data?.json() as PushPayload | undefined;

      await self.registration.showNotification(payload?.title ?? "App", {
        body: payload?.body ?? "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: payload?.tag ?? payload?.id ?? "app",
        renotify: true,
        data: {
          url: payload?.url ?? "/app-area/notifications",
        },
      });

      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clients) {
        if (client.url.includes("/app-area")) {
          client.postMessage({
            type: "APP_REFRESH",
            url: payload?.url,
          });
        }
      }
    })(),
  );
});
```

Notification click behavior:

```ts
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(
    event.notification.data?.url ?? "/app-area/notifications",
    self.location.origin,
  ).href;

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clients) {
        if (client.url.includes("/app-area")) {
          if ("navigate" in client) {
            await client.navigate(targetUrl);
          }
          await client.focus();
          return;
        }
      }

      await self.clients.openWindow(targetUrl);
    })(),
  );
});
```

## Standalone Detection

Use this hook to know whether the app is installed or launched as standalone:

```ts
"use client";

import { useEffect, useState } from "react";

export function useIsStandalone(): boolean {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const nav = window.navigator as Navigator & { standalone?: boolean };

    const check = () => {
      setIsStandalone(mediaQuery.matches || nav.standalone === true);
    };

    check();
    mediaQuery.addEventListener("change", check);

    return () => mediaQuery.removeEventListener("change", check);
  }, []);

  return isStandalone;
}
```

## Install Banner Requirements

Install banner should be a client component and dynamically mounted with `ssr: false`.

Rules:

- Do not show if already standalone.
- Do not show on desktop.
- Do not show if dismissed recently.
- On iOS Safari, show instructions: Share, then Add to Home Screen.
- On Chromium mobile browsers, listen for `beforeinstallprompt`, store the event, and call `prompt()` when the user taps install.
- On `appinstalled`, hide the banner.
- Store dismissal in `localStorage` for a cooldown, for example 14 days.

Mobile detection:

```ts
function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent;

  if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }

  if (/iPad/i.test(ua)) return true;

  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}
```

Install prompt type:

```ts
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
```

Install banner flow:

```ts
useEffect(() => {
  if (isStandalone) return;
  if (!isMobileDevice()) return;
  if (isDismissedRecently()) return;

  void getAppServiceWorkerRegistration();

  const ua = window.navigator.userAgent;
  const isIosSafari =
    /iphone|ipad|ipod/i.test(ua) &&
    /safari/i.test(ua) &&
    !/crios|fxios|opios/i.test(ua) &&
    !(window.navigator as Navigator & { standalone?: boolean }).standalone;

  if (isIosSafari) {
    setIsIos(true);
    setIsVisible(true);
    return;
  }

  const onBeforeInstallPrompt = (event: Event) => {
    event.preventDefault();
    setDeferredPrompt(event as BeforeInstallPromptEvent);
    setIsVisible(true);
  };

  const onAppInstalled = () => setIsVisible(false);

  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onAppInstalled);

  return () => {
    window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.removeEventListener("appinstalled", onAppInstalled);
  };
}, [isStandalone]);
```

## Service Worker Update Banner

Show this when a new service worker is waiting:

```ts
useEffect(() => {
  let isCancelled = false;

  void getAppServiceWorkerRegistration().then((registration) => {
    if (!registration || isCancelled) return;

    if (registration.waiting) {
      setWaitingWorker(registration.waiting);
    }

    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing) return;

      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          setWaitingWorker(registration.waiting);
        }
      });
    });
  });

  const onControllerChange = () => window.location.reload();
  navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange);

  return () => {
    isCancelled = true;
    navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
  };
}, []);
```

Apply update:

```ts
waitingWorker?.postMessage({ type: "SKIP_WAITING" });
```

If not using Serwist, add a `message` listener inside the service worker that calls `self.skipWaiting()` when it receives `SKIP_WAITING`.

## Web Push Environment Variables

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com
```

Generate keys:

```bash
npx web-push generate-vapid-keys
```

Rules:

- Public key can be exposed to the browser.
- Private key must remain server-only.
- `VAPID_SUBJECT` must be `mailto:` or `https:`.
- Do not use `http://localhost` as the VAPID subject.

## Push Subscription Storage

Use a persistent table:

```sql
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on push_subscriptions (user_id);
```

If using Supabase, enable RLS and allow authenticated users to select, insert, update, and delete only their own rows. Server-side push sending should use an admin/service role client.

## Push Client Helpers

```ts
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }

  return output;
}

export function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
```

## Push API Routes

Use Next.js 16 App Router route handlers.

`GET /api/push/vapid-public-key`:

- Return `{ publicKey }`.
- Return `503` if Web Push is not configured.

`POST /api/push/subscribe`:

- Require authenticated user.
- Validate body:

```ts
{
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}
```

- Upsert by `endpoint`.
- Store current `user_id`, keys, user agent, and `updated_at`.

`POST /api/push/unsubscribe`:

- Require authenticated user.
- Validate body `{ endpoint: string }`.
- Delete the matching subscription for the current user.

## Push Enable Flow

Client flow:

```ts
export async function enableWebPush(): Promise<"granted" | "denied" | "unsupported" | "unconfigured" | "error"> {
  if (!isPushSupported()) return "unsupported";

  const keyResponse = await fetch("/api/push/vapid-public-key");
  if (!keyResponse.ok) return "unconfigured";

  const { publicKey } = (await keyResponse.json()) as { publicKey: string };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const registration = await getAppServiceWorkerRegistration();
  if (!registration) return "unsupported";

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    const p256dh = subscription.getKey("p256dh");
    const auth = subscription.getKey("auth");

    if (!p256dh || !auth) return "error";

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64Url(p256dh),
          auth: arrayBufferToBase64Url(auth),
        },
      }),
    });

    return response.ok ? "granted" : "error";
  } catch {
    return "error";
  }
}
```

Disable flow:

- Get current `registration.pushManager.getSubscription()`.
- POST endpoint to `/api/push/unsubscribe`.
- Call `subscription.unsubscribe()`.
- Clear app badge if using the Badge API.

## Push Opt-in Modal

Show the permission modal only when:

- The app is running standalone.
- Push is supported.
- VAPID public key route is configured.
- `Notification.permission !== "denied"`.
- No current push subscription exists.
- User has not dismissed the modal recently.

Do not show the push opt-in modal in normal mobile Safari/Chrome before installation. On iOS, Web Push requires an installed PWA.

## Push Rebind on Login

On app shell mount, check whether the browser already has a push subscription. If it does, POST it to `/api/push/subscribe` for the currently authenticated user.

Purpose:

- Handles shared devices.
- Handles logout/login as another user.
- Keeps the endpoint attached to the latest authenticated user.

```ts
useEffect(() => {
  if (!isPushSupported()) return;

  void (async () => {
    const registration = await getAppServiceWorkerRegistration();
    const subscription = registration ? await registration.pushManager.getSubscription() : null;

    if (!subscription) return;

    const p256dh = subscription.getKey("p256dh");
    const auth = subscription.getKey("auth");

    if (!p256dh || !auth) return;

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64Url(p256dh),
          auth: arrayBufferToBase64Url(auth),
        },
      }),
    });
  })().catch(() => undefined);
}, []);
```

## Server Push Sending

Use `web-push` server-side only:

```ts
import "server-only";
import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

await webpush.sendNotification(
  {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  },
  JSON.stringify({
    title: "Notification title",
    body: "Notification body",
    url: "/app-area/notifications",
    tag: `notification-${id}`,
    id,
  }),
  { TTL: 60 * 60 * 24 },
);
```

Operational rules:

- Load all subscriptions for target user IDs.
- Send one notification per subscription.
- Remove stale subscriptions on `404` or `410`.
- If `403 BadJwtToken` happens after changing VAPID keys, remove the stale subscription and require the user to enable notifications again.
- Use unique `tag` values for distinct notifications, especially for iOS behavior.

## Client Refresh After Push

In the app shell, listen for messages from the service worker:

```ts
useEffect(() => {
  function onMessage(event: MessageEvent<{ type?: string; url?: string }>) {
    if (event.data?.type !== "APP_REFRESH") return;

    if (event.data.url) {
      router.push(event.data.url);
    } else {
      router.refresh();
    }
  }

  navigator.serviceWorker?.addEventListener("message", onMessage);

  return () => {
    navigator.serviceWorker?.removeEventListener("message", onMessage);
  };
}, [router]);
```

Optional:

- Debounce refresh by 300-500ms.
- Refresh when `document.visibilityState === "visible"`.
- Sync App Badge API after refresh.

## App Badge API

Optional badge sync:

```ts
export async function syncAppBadge(): Promise<void> {
  if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) return;

  const response = await fetch("/api/app/badge-counts", {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) return;

  const { total } = (await response.json()) as { total?: number };

  if (typeof total === "number" && total > 0) {
    await (navigator as Navigator & { setAppBadge: (count: number) => Promise<void> }).setAppBadge(total);
    return;
  }

  await (navigator as Navigator & { clearAppBadge?: () => Promise<void> }).clearAppBadge?.();
}
```

`/api/app/badge-counts` should return private, no-store JSON:

```ts
return Response.json(
  { total },
  { headers: { "Cache-Control": "private, no-store" } },
);
```

## Shell Integration

Mount all PWA client components in the scoped app shell:

```tsx
"use client";

import dynamic from "next/dynamic";

const PwaInstallBanner = dynamic(
  () => import("@/components/pwa/pwa-install-banner").then((mod) => mod.PwaInstallBanner),
  { ssr: false },
);

const PwaUpdateBanner = dynamic(
  () => import("@/components/pwa/pwa-update-banner").then((mod) => mod.PwaUpdateBanner),
  { ssr: false },
);

const PushOptInModal = dynamic(
  () => import("@/components/pwa/push-opt-in-modal").then((mod) => mod.PushOptInModal),
  { ssr: false },
);

export function AppShell({ children }: { children: React.ReactNode }) {
  usePushRefresh();
  usePushRebind();

  return (
    <>
      <PwaUpdateBanner />
      <PwaInstallBanner />
      <PushOptInModal />
      {children}
    </>
  );
}
```

## Testing Matrix

Desktop browser:

- Install banner should not appear.
- Service worker update banner may appear if an update is waiting.
- Push settings can show unsupported/off/on depending on browser support.

Mobile browser:

- Install banner should appear if not standalone and not dismissed.
- iOS Safari should show manual install instructions.
- Chromium mobile should use `beforeinstallprompt`.

Installed PWA:

- Install banner should not appear.
- Push opt-in modal may appear if not subscribed and not dismissed.
- Push notifications should display while app is backgrounded.
- Clicking a notification should focus or open the app and route to the payload URL.

After deployment:

- New service worker should wait.
- Update banner should appear.
- Applying update should activate the worker and reload the page.

Push delivery:

- Subscriptions should be stored after permission grant.
- Server should send to every active endpoint for target users.
- Expired endpoints should be removed.
- App should refresh or navigate after receiving push.

## Critical Implementation Rules

- Keep PWA scope explicit and narrow.
- Register the service worker manually, not globally.
- Keep API routes network-only in the service worker.
- Never cache authenticated API responses in the service worker.
- Keep install UI separate from push permission UI.
- Show install UI only on mobile devices.
- Show push permission UI only in standalone mode.
- Use route handlers, not Pages Router APIs.
- Keep VAPID private key server-only.
- Persist subscriptions by endpoint and user.
- Rebind existing subscriptions on login.
- Use unique notification tags.
- Handle stale subscriptions automatically.
- Disable service worker in local development unless specifically testing PWA behavior.
