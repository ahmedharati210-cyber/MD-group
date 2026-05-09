import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Only run on routes that need session refresh or auth gating.
     * Public pages (/, /about, /contact) are intentionally excluded —
     * they don't use auth and running getUser() on them adds ~200ms of
     * unnecessary Supabase round-trip latency on every public page load.
     */
    "/portal/:path*",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/auth/:path*",
  ],
};
