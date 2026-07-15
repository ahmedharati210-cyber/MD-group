import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkOnly } from "serwist";
import { defaultCache } from "@serwist/next/worker";

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    registration: ServiceWorkerRegistration;
    location: { origin: string };
  }
}

declare const self: ServiceWorkerGlobalScope;

/** Do not cache dynamic API responses — avoids stale portal data. */
const apiNetworkOnly = {
  matcher: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
    sameOrigin && url.pathname.startsWith("/api/"),
  handler: new NetworkOnly(),
};

/**
 * Never cache HTML/RSC navigations — stale PPR "postponed state" shells from a
 * prior deployment cause "Failed to parse postponed state" on resume after deploy.
 */
const navigationNetworkOnly = {
  matcher: ({ request }: { request: Request }) => request.mode === "navigate",
  handler: new NetworkOnly(),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [apiNetworkOnly, navigationNetworkOnly, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

type PushPayload = {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  warningId?: string;
};

type SwClient = {
  url: string;
  focus(): Promise<SwClient>;
  navigate?(url: string): Promise<SwClient>;
  postMessage?(message: unknown): void;
};

const worker = self as unknown as ServiceWorkerGlobalScope & EventTarget;

async function notifyPortalClients(payload: { url?: string }): Promise<void> {
  const swClients = (
    self as unknown as {
      clients: {
        matchAll(opts: {
          type: string;
          includeUncontrolled: boolean;
        }): Promise<readonly SwClient[]>;
      };
    }
  ).clients;

  const clientList = await swClients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  for (const client of clientList) {
    if (!client.url.includes("/portal")) continue;
    client.postMessage?.({ type: "PORTAL_REFRESH", url: payload.url });
  }
}

async function syncBadgeFromServer(origin: string): Promise<void> {
  try {
    const sw = self as ServiceWorkerGlobalScope & {
      navigator?: Navigator & {
        setAppBadge?: (count: number) => Promise<void>;
        clearAppBadge?: () => Promise<void>;
      };
    };
    if (typeof sw.navigator?.setAppBadge !== "function") return;

    const res = await fetch(`${origin}/api/portal/badge-counts`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return;

    const data = (await res.json()) as { total?: number };
    const total = typeof data.total === "number" ? data.total : 0;

    if (total > 0) {
      await sw.navigator.setAppBadge(total);
    } else if (typeof sw.navigator.clearAppBadge === "function") {
      await sw.navigator.clearAppBadge();
    }
  } catch {
    // badge is best-effort
  }
}

worker.addEventListener("push", (event: Event) => {
  const pushEvent = event as Event & {
    data?: { json(): unknown; text(): string };
    waitUntil(p: Promise<unknown>): void;
  };
  if (!pushEvent.data) return;

  pushEvent.waitUntil(
    (async () => {
      let data: PushPayload = {};
      try {
        data = pushEvent.data!.json() as PushPayload;
      } catch {
        data = { body: pushEvent.data!.text() };
      }

      const title = data.title ?? "MD Group";
      const origin = self.location.origin;
      const tag =
        data.tag ?? (data.warningId ? `warning-${data.warningId}` : "md-group");
      const options = {
        body: data.body ?? "",
        icon: `${origin}/icons/icon-192.png`,
        badge: `${origin}/icons/icon-192.png`,
        tag,
        renotify: true,
        data: { url: data.url ?? "/portal/notifications" },
        dir: "rtl" as NotificationOptions["dir"],
        lang: "ar",
      } satisfies NotificationOptions & { renotify?: boolean };

      try {
        await self.registration.showNotification(title, options);
      } catch {
        await self.registration.showNotification(title, {
          body: options.body,
          tag: options.tag,
          renotify: true,
          data: options.data,
          dir: "rtl",
          lang: "ar",
        } as NotificationOptions & { renotify?: boolean });
      }

      await Promise.all([
        notifyPortalClients({ url: data.url }),
        syncBadgeFromServer(origin),
      ]);
    })(),
  );
});

worker.addEventListener("notificationclick", (event: Event) => {
  const clickEvent = event as Event & {
    notification: Notification & { close(): void; data?: { url?: string } };
    waitUntil(p: Promise<unknown>): void;
    preventDefault(): void;
  };
  clickEvent.preventDefault();
  clickEvent.notification.close();
  const raw = (clickEvent.notification.data?.url as string) ?? "/portal/notifications";
  const targetUrl = new URL(raw, self.location.origin).href;

  const swClients = (
    self as unknown as {
      clients: {
        matchAll(opts: {
          type: string;
          includeUncontrolled: boolean;
        }): Promise<readonly SwClient[]>;
        openWindow?(url: string): Promise<SwClient | null>;
      };
    }
  ).clients;

  clickEvent.waitUntil(
    (async () => {
      await notifyPortalClients({ url: raw });

      const clientList = await swClients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clientList) {
        if (!client.url.includes("/portal")) continue;
        if (client.navigate) {
          await client.navigate(targetUrl);
          await client.focus();
          return;
        }
        await client.focus();
        return;
      }

      if (swClients.openWindow) {
        await swClients.openWindow(targetUrl);
      }
    })(),
  );
});
