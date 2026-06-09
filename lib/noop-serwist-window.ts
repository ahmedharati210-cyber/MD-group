/** No-op replacement for @serwist/window — SW is registered manually in portal-sw.ts */
export class Serwist {
  constructor(_scriptURL: string, _options?: unknown) {}

  register(): Promise<ServiceWorkerRegistration | undefined> {
    return Promise.resolve(undefined);
  }
}
