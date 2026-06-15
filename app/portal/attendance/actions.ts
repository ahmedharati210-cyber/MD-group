"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, requireUser } from "@/lib/auth";
import { isPlatformFeatureEnabled } from "@/lib/features";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; ok?: boolean };

const FEATURE_UNAVAILABLE: ActionState = {
  error: "الميزة غير متاحة حالياً",
};

function guardAttendance(): ActionState | null {
  if (!isPlatformFeatureEnabled("attendance")) return FEATURE_UNAVAILABLE;
  return null;
}

/**
 * Employee self-check-in: upserts today's row, sets `check_in` if empty.
 */
export async function checkInAction(): Promise<ActionState> {
  const blocked = guardAttendance();
  if (blocked) return blocked;

  const { userId, profile } = await requireUser();
  if (!profile.company_id) {
    return { error: "لا توجد شركة مرتبطة بحسابك" };
  }

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const supabase = await createSupabaseServerClient();

  // Check whether today's row already exists.
  const { data: existing } = await supabase
    .from("attendance")
    .select("id, check_in")
    .eq("profile_id", userId)
    .eq("date", today)
    .maybeSingle();

  if (existing?.check_in) {
    return { error: "تم تسجيل الحضور مسبقاً اليوم" };
  }

  if (existing) {
    const { error } = await supabase
      .from("attendance")
      .update({ check_in: now, status: "present" })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("attendance").insert({
      profile_id: userId,
      company_id: profile.company_id,
      date: today,
      check_in: now,
      status: "present",
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/portal/attendance");
  revalidateTag("attendance", "default");
  revalidateTag("dashboard", "default");
  return { ok: true };
}

/**
 * Employee self-check-out for today.
 */
export async function checkOutAction(): Promise<ActionState> {
  const blocked = guardAttendance();
  if (blocked) return blocked;

  const { userId } = await requireUser();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("attendance")
    .select("id")
    .eq("profile_id", userId)
    .eq("date", today)
    .maybeSingle();

  if (!existing) {
    return { error: "لم يتم تسجيل الحضور بعد" };
  }

  const { error } = await supabase
    .from("attendance")
    .update({ check_out: now })
    .eq("id", existing.id);
  if (error) return { error: error.message };

  revalidatePath("/portal/attendance");
  revalidateTag("attendance", "default");
  revalidateTag("dashboard", "default");
  return { ok: true };
}

const markSchema = z.object({
  profile_id: z.string().uuid(),
  company_id: z.string().uuid(),
  date: z.string(),
  status: z.enum(["present", "absent", "late", "leave"]),
  notes: z.string().optional().nullable(),
});

/**
 * Manager marks attendance status for an employee on a given day.
 */
export async function markAttendanceAction(formData: FormData) {
  if (!isPlatformFeatureEnabled("attendance")) return;

  const parsed = markSchema.safeParse({
    profile_id: formData.get("profile_id"),
    company_id: formData.get("company_id"),
    date: formData.get("date"),
    status: formData.get("status"),
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) return;

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("attendance")
    .select("id")
    .eq("profile_id", parsed.data.profile_id)
    .eq("date", parsed.data.date)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("attendance")
      .update({ status: parsed.data.status, notes: parsed.data.notes })
      .eq("id", existing.id);
  } else {
    await supabase.from("attendance").insert(parsed.data);
  }

  revalidatePath("/portal/attendance");
  revalidateTag("attendance", "default");
  revalidateTag("dashboard", "default");
}

/**
 * Combine `YYYY-MM-DD` and `HH:MM` (local time) into an ISO timestamp, or null.
 */
function combineDateTime(date: string, time: string | null): string | null {
  if (!time) return null;
  const iso = new Date(`${date}T${time}:00`);
  if (Number.isNaN(iso.getTime())) return null;
  return iso.toISOString();
}

const createSchema = z.object({
  profile_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح"),
  status: z.enum(["present", "absent", "late", "leave"]),
  check_in: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "وقت غير صالح")
    .optional()
    .or(z.literal("")),
  check_out: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "وقت غير صالح")
    .optional()
    .or(z.literal("")),
  notes: z.string().optional().nullable(),
});

/**
 * Manager/admin manually creates or updates an attendance record for a given
 * employee + date. Uses admin-style logic but still enforces role scoping.
 */
export async function createAttendanceAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const blocked = guardAttendance();
  if (blocked) return blocked;

  const current = await requireRole(["md_admin", "company_manager"]);

  const parsed = createSchema.safeParse({
    profile_id: formData.get("profile_id"),
    date: formData.get("date"),
    status: formData.get("status"),
    check_in: formData.get("check_in") || "",
    check_out: formData.get("check_out") || "",
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const supabase = await createSupabaseServerClient();

  // Resolve the employee's company and enforce manager scoping.
  const { data: emp } = await supabase
    .from("profiles")
    .select("id, company_id")
    .eq("id", parsed.data.profile_id)
    .single<{ id: string; company_id: string | null }>();

  if (!emp || !emp.company_id) {
    return { error: "الموظف غير موجود أو غير مرتبط بشركة" };
  }
  if (
    current.profile.role === "company_manager" &&
    emp.company_id !== current.profile.company_id
  ) {
    return { error: "صلاحيات غير كافية" };
  }

  const check_in = combineDateTime(parsed.data.date, parsed.data.check_in || null);
  const check_out = combineDateTime(
    parsed.data.date,
    parsed.data.check_out || null,
  );

  const payload = {
    profile_id: parsed.data.profile_id,
    company_id: emp.company_id,
    date: parsed.data.date,
    status: parsed.data.status,
    check_in,
    check_out,
    notes: parsed.data.notes,
  };

  // Upsert by (profile_id, date) — unique in the schema.
  const { data: existing } = await supabase
    .from("attendance")
    .select("id")
    .eq("profile_id", parsed.data.profile_id)
    .eq("date", parsed.data.date)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("attendance")
      .update(payload)
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("attendance").insert(payload);
    if (error) return { error: error.message };
  }

  revalidatePath("/portal/attendance");
  revalidatePath(`/portal/employees/${parsed.data.profile_id}`);
  revalidateTag("attendance", "default");
  revalidateTag("dashboard", "default");
  redirect(`/portal/attendance?date=${parsed.data.date}`);
}

export async function deleteAttendanceAction(formData: FormData) {
  if (!isPlatformFeatureEnabled("attendance")) return;

  const current = await requireRole(["md_admin", "company_manager"]);
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase
    .from("attendance")
    .select("id, company_id, date")
    .eq("id", id)
    .single<{ id: string; company_id: string; date: string }>();

  if (!row) return;

  if (
    current.profile.role === "company_manager" &&
    row.company_id !== current.profile.company_id
  ) {
    return;
  }

  await supabase.from("attendance").delete().eq("id", id);
  revalidatePath("/portal/attendance");
  revalidateTag("attendance", "default");
  revalidateTag("dashboard", "default");
  redirect(`/portal/attendance?date=${row.date}`);
}
