import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isWebPushConfigured } from "@/lib/push/config";
import { pushSubscriptionSchema } from "@/lib/push/subscription-schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "Web Push not configured" }, { status: 503 });
  }

  const { userId } = await requireUser();
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = pushSubscriptionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid subscription" },
      { status: 400 },
    );
  }

  const { endpoint, keys } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const userAgent = request.headers.get("user-agent") ?? null;

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
