"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser, requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

/** For md_admin (company_id = null), look up the construction company. */
async function resolveCompanyId(
  profile: { company_id: string | null },
): Promise<string | null> {
  if (profile.company_id) return profile.company_id;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("companies")
    .select("id")
    .contains("enabled_features", ["timeline"])
    .limit(1)
    .single();
  return data?.id ?? null;
}

export type ActionState = { error?: string; ok?: boolean };

const reportSchema = z.object({
  project_id: z.string().uuid().optional().nullable(),
  report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح"),
  work_done: z.string().optional().nullable(),
  materials_used: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function createReportAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { userId, profile } = await requireUser();
  const parsed = reportSchema.safeParse({
    project_id: formData.get("project_id") || null,
    report_date: formData.get("report_date"),
    work_done: formData.get("work_done") || null,
    materials_used: formData.get("materials_used") || null,
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const company_id = await resolveCompanyId(profile);
  if (!company_id) return { error: "لم يتم العثور على الشركة" };

  const supabase = await createSupabaseServerClient();
  const { data: newReport, error } = await supabase
    .from("engineer_reports")
    .insert({ company_id, author_id: userId, report_type: "daily", ...parsed.data })
    .select("id")
    .single<{ id: string }>();
  if (error) return { error: error.message };

  let project_name: string | undefined;
  if (parsed.data.project_id) {
    const { data: proj } = await supabase
      .from("projects")
      .select("name")
      .eq("id", parsed.data.project_id)
      .maybeSingle<{ name: string }>();
    if (proj?.name) project_name = proj.name;
  }

  void logAudit(userId, "create", "report", newReport?.id, {
    report_date: parsed.data.report_date,
    ...(project_name ? { project_name } : {}),
  });

  revalidatePath("/portal/reports");
  revalidateTag("reports", "default");
  revalidateTag("dashboard", "default");
  redirect("/portal/reports");
}

export async function deleteReportAction(id: string): Promise<ActionState> {
  const { userId } = await requireRole(["md_admin", "company_manager"]);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("engineer_reports").delete().eq("id", id);
  if (error) return { error: error.message };

  void logAudit(userId, "delete", "report", id);

  revalidateTag("reports", "default");
  revalidateTag("dashboard", "default");
  redirect("/portal/reports");
}
