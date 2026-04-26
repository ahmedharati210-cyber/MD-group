import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client bound to the request's cookies.
 * Use inside Server Components, Server Actions, and Route Handlers.
 *
 * Note: we intentionally do NOT pass the `Database` generic — Supabase's
 * internal type inference with a hand-written schema keeps resolving table
 * Rows to `never`. Until we generate types from the live DB with
 * `supabase gen types typescript`, we type results explicitly at call sites.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `set` may be called from a Server Component during render; that's a
            // no-op — the middleware is responsible for refreshing cookies. This
            // try/catch prevents a crash in that case.
          }
        },
      },
    },
  );
}

/**
 * Privileged admin client bypassing RLS. Use ONLY in server-side code for
 * carefully-reviewed operations (e.g. user provisioning, audit writes).
 * Never expose the service-role key to the client.
 */
export function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
