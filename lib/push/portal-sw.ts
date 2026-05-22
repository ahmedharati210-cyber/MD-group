/** Portal-scoped service worker registration (shared by PWA banner, push, updates). */

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function getPortalServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register("/sw.js", { scope: "/portal/" })
      .catch(() => null);
  }
  return registrationPromise;
}
