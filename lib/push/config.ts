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

export function getVapidSubject(): string {
  return (
    process.env.VAPID_SUBJECT?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "mailto:support@mdgroup.local"
  );
}
