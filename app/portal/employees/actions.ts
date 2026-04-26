"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(2),
  phone: z.string().optional().nullable(),
  job_title: z.string().optional().nullable(),
  national_id: z.string().optional().nullable(),
  hired_at: z.string().optional().nullable(),
  company_id: z.string().uuid(),
  role: z.enum(["employee", "company_manager"]).default("employee"),
});

export type ActionState = { error?: string; ok?: boolean };

export async function createEmployeeAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const current = await requireRole(["md_admin", "company_manager"]);

  const parsed = createSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    full_name: formData.get("full_name"),
    phone: formData.get("phone") || null,
    job_title: formData.get("job_title") || null,
    national_id: formData.get("national_id") || null,
    hired_at: formData.get("hired_at") || null,
    company_id: formData.get("company_id"),
    role: formData.get("role") || "employee",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  // A manager can only create employees within their own company, and cannot
  // create other managers.
  if (current.profile.role === "company_manager") {
    if (parsed.data.company_id !== current.profile.company_id) {
      return { error: "لا يمكنك إضافة موظف لشركة أخرى" };
    }
    if (parsed.data.role !== "employee") {
      return { error: "صلاحية إنشاء المدراء مخصّصة لإدارة المجموعة" };
    }
  }

  const admin = createSupabaseAdminClient();

  const { data: userData, error: userErr } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.full_name,
      role: parsed.data.role,
    },
  });
  if (userErr || !userData.user) {
    return { error: userErr?.message ?? "فشل إنشاء المستخدم" };
  }

  // The trigger created a profile row; update it with the rest of the fields.
  const { error: profErr } = await admin
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      role: parsed.data.role,
      company_id: parsed.data.company_id,
      job_title: parsed.data.job_title,
      national_id: parsed.data.national_id,
      hired_at: parsed.data.hired_at,
    })
    .eq("id", userData.user.id);

  if (profErr) return { error: profErr.message };

  await admin.from("audit_log").insert({
    actor_id: current.userId,
    action: "employee.create",
    entity: "profiles",
    entity_id: userData.user.id,
    payload: { email: parsed.data.email, company_id: parsed.data.company_id },
  });

  revalidatePath("/portal/employees");
  redirect("/portal/employees");
}

const updateSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().min(2),
  phone: z.string().optional().nullable(),
  job_title: z.string().optional().nullable(),
  national_id: z.string().optional().nullable(),
  hired_at: z.string().optional().nullable(),
  company_id: z.string().uuid().optional().nullable(),
  role: z.enum(["employee", "company_manager", "md_admin"]).optional(),
  is_active: z.coerce.boolean().optional(),
});

export async function updateEmployeeAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const current = await requireRole(["md_admin", "company_manager"]);

  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    full_name: formData.get("full_name"),
    phone: formData.get("phone") || null,
    job_title: formData.get("job_title") || null,
    national_id: formData.get("national_id") || null,
    hired_at: formData.get("hired_at") || null,
    company_id: formData.get("company_id") || null,
    role: formData.get("role") || undefined,
    is_active: formData.get("is_active") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const { id, role, company_id, ...rest } = parsed.data;
  const admin = createSupabaseAdminClient();

  // Fetch the target to enforce scoping rules.
  const { data: target } = await admin
    .from("profiles")
    .select("id, role, company_id")
    .eq("id", id)
    .single<{
      id: string;
      role: "md_admin" | "company_manager" | "employee";
      company_id: string | null;
    }>();
  if (!target) return { error: "الموظف غير موجود" };

  if (current.profile.role === "company_manager") {
    if (target.company_id !== current.profile.company_id) {
      return { error: "صلاحيات غير كافية" };
    }
    if (role && role !== "employee") {
      return { error: "لا يمكنك تغيير دور المستخدم" };
    }
    if (company_id && company_id !== current.profile.company_id) {
      return { error: "لا يمكنك نقل الموظف إلى شركة أخرى" };
    }
  }

  if (role === "md_admin" && current.profile.role !== "md_admin") {
    return { error: "صلاحيات غير كافية" };
  }

  const payload: Record<string, unknown> = { ...rest };
  if (current.profile.role === "md_admin") {
    if (role) payload.role = role;
    if (company_id !== undefined) payload.company_id = company_id || null;
  }

  const { error } = await admin.from("profiles").update(payload).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/portal/employees/${id}`);
  revalidatePath("/portal/employees");
  redirect(`/portal/employees/${id}`);
}

export async function deactivateEmployeeAction(formData: FormData) {
  await requireRole(["md_admin", "company_manager"]);
  const id = formData.get("id");
  if (typeof id !== "string") return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("profiles").update({ is_active: false }).eq("id", id);
  revalidatePath("/portal/employees");
  revalidatePath(`/portal/employees/${id}`);
}

export async function deleteEmployeeAction(formData: FormData) {
  const current = await requireRole(["md_admin", "company_manager"]);
  const id = formData.get("id");
  if (typeof id !== "string") return;

  if (id === current.userId) {
    redirect(
      `/portal/employees/${id}?error=${encodeURIComponent(
        "لا يمكنك حذف حسابك الخاص.",
      )}`,
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, role, company_id")
    .eq("id", id)
    .single<{
      id: string;
      role: "md_admin" | "company_manager" | "employee";
      company_id: string | null;
    }>();
  if (!target) return;

  if (current.profile.role === "company_manager") {
    if (
      target.company_id !== current.profile.company_id ||
      target.role !== "employee"
    ) {
      redirect(
        `/portal/employees/${id}?error=${encodeURIComponent(
          "صلاحيات غير كافية.",
        )}`,
      );
    }
  }

  // Delete auth user; the profiles row cascades via FK.
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    redirect(
      `/portal/employees/${id}?error=${encodeURIComponent(error.message)}`,
    );
  }

  await admin.from("audit_log").insert({
    actor_id: current.userId,
    action: "employee.delete",
    entity: "profiles",
    entity_id: id,
  });

  revalidatePath("/portal/employees");
  redirect("/portal/employees");
}
