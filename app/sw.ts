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

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [apiNetworkOnly, ...defaultCache],
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
};

const worker = self as unknown as ServiceWorkerGlobalScope & EventTarget;

worker.addEventListener("push", (event: Event) => {
  const pushEvent = event as Event & {
    data?: { json(): unknown; text(): string };
    waitUntil(p: Promise<unknown>): void;
  };
  if (!pushEvent.data) return;
  let data: PushPayload = {};
  try {
    data = pushEvent.data.json() as PushPayload;
  } catch {
    data = { body: pushEvent.data.text() };
  }
  const title = data.title ?? "MD Group";
  const options: NotificationOptions = {
    body: data.body ?? "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag ?? "md-group",
    data: { url: data.url ?? "/portal/notifications" },
    dir: "rtl",
    lang: "ar",
  };
  pushEvent.waitUntil(self.registration.showNotification(title, options));
});

worker.addEventListener("notificationclick", (event: Event) => {
  const clickEvent = event as Event & {
    notification: Notification & { close(): void; data?: { url?: string } };
    waitUntil(p: Promise<unknown>): void;
  };
  clickEvent.notification.close();
  const raw = (clickEvent.notification.data?.url as string) ?? "/portal/notifications";
  const targetUrl = new URL(raw, self.location.origin).href;

  type SwClient = { url: string; focus(): Promise<SwClient>; navigate?(url: string): Promise<SwClient> };
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
    swClients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (!client.url.includes("/portal")) continue;
        if (client.navigate) {
          return client.navigate(targetUrl).then(() => client.focus());
        }
        return client.focus();
      }
      if (swClients.openWindow) {
        return swClients.openWindow(targetUrl);
      }
    }),
  );
});
