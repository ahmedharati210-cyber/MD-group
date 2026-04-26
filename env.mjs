/**
 * Typed environment variable loader. Validates at build/start time so a
 * missing variable fails loudly instead of mysteriously at runtime.
 *
 * - Server vars (never exposed to the browser): put plain keys here.
 * - Public vars (shipped to the browser): must be prefixed with NEXT_PUBLIC_.
 */
import { z } from "zod";

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

const processEnv = {
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
};

// On the server we validate both; on the client only public keys are present.
const isServer = typeof window === "undefined";
const merged = isServer
  ? serverSchema.merge(clientSchema)
  : clientSchema;

const parsed = merged.safeParse(processEnv);

if (!parsed.success) {
  // During `next build` placeholder defaults are fine; during runtime we throw.
  if (process.env.SKIP_ENV_VALIDATION !== "1") {
    console.error(
      "Invalid environment variables:",
      parsed.error.flatten().fieldErrors,
    );
    throw new Error("Invalid environment variables. See server logs.");
  }
}

export const env = parsed.success ? parsed.data : processEnv;
