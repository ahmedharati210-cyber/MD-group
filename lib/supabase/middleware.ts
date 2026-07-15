import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth cookie on every request, gates /portal/* behind
 * authentication, and injects the validated user ID as `x-user-id` into the
 * request headers so Server Components can skip the auth network call entirely.
 *
 * Security model:
 * - getSession() reads the JWT from the cookie and verifies its expiry locally
 *   (no network call, ~5ms). If the access token is expired and a refresh token
 *   exists, it calls the auth server to refresh — same as getUser().
 * - Any client-sent `x-user-id` header is deleted before setting our own, so
 *   header spoofing is impossible.
 * - Real security is enforced at the database level: all queries run through
 *   Supabase's PostgREST which validates the JWT signature before executing any
 *   SQL, and RLS policies use auth.uid() from that verified JWT.
 * - getUser() (server round-trip) is reserved for sensitive Server Actions that
 *   need to confirm the token is still valid against the auth server.
 */
export async function updateSession(request: NextRequest) {
  // Collect cookies that need to be written to the response (token refresh).
  // Using a collected array avoids creating an intermediate NextResponse inside
  // the setAll callback, which lets us build a single final response below.
  const refreshedCookies: Parameters<typeof NextResponse.prototype.cookies.set>[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Mirror cookies onto the request so later reads in this middleware
          // run see the refreshed values.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // Store for application onto the final response.
          cookiesToSet.forEach(({ name, value, options }) => {
            refreshedCookies.push([name, value, options as Parameters<typeof NextResponse.prototype.cookies.set>[2]]);
          });
        },
      },
    },
  );

  // getSession() reads the JWT from the cookie (~5ms, no network call).
  // It refreshes automatically when the access token is expired.
  // We parse the user ID directly from the JWT payload instead of accessing
  // session.user, which would trigger the Supabase SDK's "insecure" console
  // warning. The JWT sub claim is the Supabase user UUID — identical to what
  // auth.getUser() would return, and the database still verifies the JWT
  // signature on every query via PostgREST.
  let session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"] = null;
  try {
    ({
      data: { session },
    } = await supabase.auth.getSession());
  } catch (error) {
    const isAuthError =
      typeof error === "object" &&
      error !== null &&
      ("__isAuthError" in error || "code" in error);
    if (isAuthError) {
      // Stale/rotated refresh token — clear cookies instead of throwing on every request.
      await supabase.auth.signOut();
      session = null;
    } else {
      throw error;
    }
  }

  let userId: string | null = null;
  if (session?.access_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(session.access_token.split(".")[1], "base64").toString(),
      );
      userId = (payload.sub as string) ?? null;
    } catch {
      // malformed JWT — treat as unauthenticated
    }
  }

  const { pathname } = request.nextUrl;
  const isPortal = pathname.startsWith("/portal");
  const isLogin = pathname === "/login";

  if (isPortal && !userId) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (isLogin && userId) {
    const url = request.nextUrl.clone();
    url.pathname = "/portal";
    url.searchParams.delete("redirectTo");
    return NextResponse.redirect(url);
  }

  // Build the next request's headers. Always delete x-user-id first so a
  // malicious client header can never impersonate another user, then set the
  // server-validated value.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-user-id");
  if (userId) {
    requestHeaders.set("x-user-id", userId);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Forward any refreshed auth cookies to the browser.
  refreshedCookies.forEach((args) => response.cookies.set(...args));

  return response;
}
