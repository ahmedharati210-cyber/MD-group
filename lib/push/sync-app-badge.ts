/** Client-only: sync home-screen badge with server unread notification-center counts. */

export async function syncPortalAppBadge(): Promise<void> {
  if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) return;

  try {
    const res = await fetch("/api/portal/badge-counts", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return;

    const { total } = (await res.json()) as { total?: number };
    const n = typeof total === "number" && total > 0 ? total : 0;

    if (n > 0) {
      await (
        navigator as Navigator & { setAppBadge: (count: number) => Promise<void> }
      ).setAppBadge(n);
    } else {
      await clearPortalAppBadge();
    }
  } catch {
    // ignore — badge is best-effort
  }
}

export async function clearPortalAppBadge(): Promise<void> {
  if (typeof navigator === "undefined" || !("clearAppBadge" in navigator)) return;
  try {
    await (
      navigator as Navigator & { clearAppBadge?: () => Promise<void> }
    ).clearAppBadge?.();
  } catch {
    // ignore
  }
}
