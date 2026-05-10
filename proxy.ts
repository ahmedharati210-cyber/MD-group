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
     *
     * App Router API routes must be included: Route Handlers rely on the same
     * `x-user-id` header as Server Components (see lib/auth.ts). Without this,
     * client fetch() to /api/* gets redirect("/login") + HTML, and res.json()
     * throws "Unexpected token '<'".
     */
    "/portal/:path*",
    "/api/:path*",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/auth/:path*",
  ],
};
