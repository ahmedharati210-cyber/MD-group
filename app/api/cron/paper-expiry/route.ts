import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import { formatDate } from "@/lib/utils";

type DueDoc = {
  id: string;
  company_id: string;
  title: string;
  expires_on: string;
  owner_profile_id: string | null;
  created_by: string | null;
};

function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function runPaperExpiryCron(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }

  if (!authorizeCron(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  const { data: dueDocs, error: rpcErr } = await admin.rpc(
    "documents_due_for_expiry_notification",
  );

  if (rpcErr) {
    console.error("[cron/paper-expiry]", rpcErr);
    return NextResponse.json({ ok: false, error: rpcErr.message }, { status: 500 });
  }

  const docs = (dueDocs ?? []) as DueDoc[];

  const { data: fallbackSenders } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "md_admin")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1);

  const defaultSender = fallbackSenders?.[0]?.id ?? null;
  if (!defaultSender) {
    console.error("[cron/paper-expiry] No md_admin profile for sender_id");
    return NextResponse.json(
      { ok: false, error: "No md_admin sender available" },
      { status: 500 },
    );
  }

  let documentsNotified = 0;

  for (const doc of docs) {
    let senderId = defaultSender;
    if (doc.created_by) {
      const { data: creator } = await admin
        .from("profiles")
        .select("id, role, company_id")
        .eq("id", doc.created_by)
        .maybeSingle<{
          id: string;
          role: string;
          company_id: string | null;
        }>();
      if (
        creator &&
        (creator.role === "md_admin" ||
          (creator.role === "company_manager" &&
            creator.company_id === doc.company_id))
      ) {
        senderId = creator.id;
      }
    }

    const { data: mdRows } = await admin
      .from("profiles")
      .select("id, phone, full_name")
      .eq("role", "md_admin")
      .eq("is_active", true);

    const { data: cmRows } = await admin
      .from("profiles")
      .select("id, phone, full_name")
      .eq("role", "company_manager")
      .eq("company_id", doc.company_id)
      .eq("is_active", true);

    const byId = new Map<string, { id: string; phone: string | null; full_name: string }>();
    for (const r of [...(mdRows ?? []), ...(cmRows ?? [])]) {
      byId.set(r.id, r as { id: string; phone: string | null; full_name: string });
    }

    if (byId.size === 0) {
      console.warn("[cron/paper-expiry] No recipients for doc", doc.id);
      continue;
    }

    let ownerPart = "";
    if (doc.owner_profile_id) {
      const { data: owner } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", doc.owner_profile_id)
        .maybeSingle<{ full_name: string }>();
      if (owner?.full_name) {
        ownerPart = ` (الموظف: ${owner.full_name})`;
      }
    }

    const message = `تنبيه انتهاء صلاحية ورقة: «${doc.title}»${ownerPart}. تاريخ الانتهاء: ${formatDate(doc.expires_on)}.`;

    const rows = [...byId.values()].map((r) => ({
      company_id: doc.company_id,
      sender_id: senderId,
      target_profile_id: r.id,
      message,
      kind: "warning" as const,
    }));

    const { error: insErr } = await admin.from("warnings").insert(rows);
    if (insErr) {
      console.error("[cron/paper-expiry] insert warnings", doc.id, insErr);
      continue;
    }

    const { error: upErr } = await admin
      .from("documents")
      .update({ expiry_notified_at: new Date().toISOString() })
      .eq("id", doc.id);
    if (upErr) {
      console.error("[cron/paper-expiry] update doc", doc.id, upErr);
      continue;
    }

    documentsNotified += 1;

    for (const r of byId.values()) {
      if (r.phone) {
        void sendWhatsAppTemplate(r.phone, message);
      }
    }
  }

  if (documentsNotified > 0) {
    revalidateTag("warnings", "default");
    revalidateTag("badges", "default");
  }

  return NextResponse.json({
    ok: true,
    candidates: docs.length,
    documentsNotified,
  });
}

export async function GET(req: Request) {
  return runPaperExpiryCron(req);
}

export async function POST(req: Request) {
  return runPaperExpiryCron(req);
}
