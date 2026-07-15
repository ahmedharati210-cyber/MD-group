import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Refresh notification inbox UI after warnings/notifications mutations.
 *
 * Uses revalidatePath (not revalidateTag("warnings")) because inbox data is
 * fetched per-request — the "warnings" tag had no cache consumers but triggered
 * Next.js PPR "revalidateTag during render" errors on /portal/timeline.
 */
export function revalidateNotificationInbox(): void {
  revalidatePath("/portal/notifications");
  revalidatePath("/portal");
  revalidateTag("badges", "default");
  revalidateTag("dashboard", "default");
}
