import "server-only";

/** True when VAPID keys are set — required to subscribe or send Web Push. */
export function isWebPushConfigured(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  return Boolean(pub && priv);
}

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? null;
}

/** Apple rejects some fake domains; use a real contact address in VAPID_SUBJECT. */
const DEFAULT_VAPID_SUBJECT = "mailto:notifications@md-group.com";

/**
 * VAPID "subject" — server-only contact URI for Apple/Google push services.
 * Not something users subscribe to; use mailto:your-team@company.com or https://your-site.com.
 * Must be https:// or mailto: (web-push rejects http://localhost).
 */
export function getVapidSubject(): string {
  const explicit = process.env.VAPID_SUBJECT?.trim();
  if (explicit) return explicit;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl?.startsWith("https://") || siteUrl?.startsWith("mailto:")) {
    return siteUrl;
  }

  return DEFAULT_VAPID_SUBJECT;
}
