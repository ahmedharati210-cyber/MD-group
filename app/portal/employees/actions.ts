"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { profileCacheTag, requireRole } from "@/lib/auth";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import {
  DOLCE_SIGNUP_INVITE_MAX_USES,
  DOLCE_SIGNUP_INVITE_VALIDITY_DAYS,
} from "@/lib/dolce-signup-invite-config";
import { getDolceSignupCompanyId } from "@/lib/dolce-signup-company";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";
import { getCompanyData } from "@/lib/company";
import { isMdManagerFeatureAllowed } from "@/lib/features";
import { logAudit } from "@/lib/audit";

const createSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  full_name: z.string().min(2),
  phone: z.string().optional().nullable(),
  job_title: z.string().optional().nullable(),
  national_id: z.string().optional().nullable(),
  hired_at: z.string().optional().nullable(),
  company_id: z.string().uuid(),
  role: z.enum(["employee", "company_manager"]).default("employee"),
  // Extended HR fields
  date_of_birth: z.string().optional().nullable(),
  gender: z.enum(["male", "female"]).optional().nullable(),
  nationality: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  contract_type: z.enum(["full_time", "part_time", "contract", "intern"]).optional().nullable(),
  contract_end_date: z.string().optional().nullable(),
  passport_number: z.string().optional().nullable(),
  blood_type: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional().nullable(),
  education_level: z.enum(["high_school", "diploma", "bachelor", "master", "phd", "other"]).optional().nullable(),
  emergency_contact_name: z.string().optional().nullable(),
  emergency_contact_phone: z.string().optional().nullable(),
  emergency_contact_relationship: z.string().optional().nullable(),
  hr_notes: z.string().optional().nullable(),
});

export type ActionState = { error?: string };

export async function createEmployeeAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const current = await requireRole(["md_admin", "company_manager"]);

  const parsed = createSchema.safeParse({
    email: formData.get("email") || undefined,
    password: formData.get("password") || undefined,
    full_name: formData.get("full_name"),
    phone: formData.get("phone") || null,
    job_title: formData.get("job_title") || null,
    national_id: formData.get("national_id") || null,
    hired_at: formData.get("hired_at") || null,
    company_id: formData.get("company_id"),
    role: formData.get("role") || "employee",
    date_of_birth: formData.get("date_of_birth") || null,
    gender: formData.get("gender") || null,
    nationality: formData.get("nationality") || null,
    address: formData.get("address") || null,
    department: formData.get("department") || null,
    contract_type: formData.get("contract_type") || null,
    contract_end_date: formData.get("contract_end_date") || null,
    passport_number: formData.get("passport_number") || null,
    blood_type: formData.get("blood_type") || null,
    education_level: formData.get("education_level") || null,
    emergency_contact_name: formData.get("emergency_contact_name") || null,
    emergency_contact_phone: formData.get("emergency_contact_phone") || null,
    emergency_contact_relationship: formData.get("emergency_contact_relationship") || null,
    hr_notes: formData.get("hr_notes") || null,
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

  const domain =
    process.env.SIGNUP_INTERNAL_AUTH_EMAIL_DOMAIN ?? "signup-local.invalid";
  const finalEmail =
    parsed.data.email ?? `emp-${randomBytes(8).toString("hex")}@${domain}`;
  const finalPassword =
    parsed.data.password ?? randomBytes(16).toString("base64url");

  const admin = createSupabaseAdminClient();

  const { data: userData, error: userErr } = await admin.auth.admin.createUser({
    email: finalEmail,
    password: finalPassword,
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
      date_of_birth: parsed.data.date_of_birth,
      gender: parsed.data.gender,
      nationality: parsed.data.nationality,
      address: parsed.data.address,
      department: parsed.data.department,
      contract_type: parsed.data.contract_type,
      contract_end_date: parsed.data.contract_end_date,
      passport_number: parsed.data.passport_number,
      blood_type: parsed.data.blood_type,
      education_level: parsed.data.education_level,
      emergency_contact_name: parsed.data.emergency_contact_name,
      emergency_contact_phone: parsed.data.emergency_contact_phone,
      emergency_contact_relationship: parsed.data.emergency_contact_relationship,
      hr_notes: parsed.data.hr_notes,
    })
    .eq("id", userData.user.id);

  if (profErr) return { error: profErr.message };

  let company_name: string | null = null;
  const { data: companyRow } = await admin
    .from("companies")
    .select("name")
    .eq("id", parsed.data.company_id)
    .maybeSingle<{ name: string }>();
  if (companyRow?.name) company_name = companyRow.name;

  await admin.from("audit_log").insert({
    actor_id: current.userId,
    action: "employee.create",
    entity: "profiles",
    entity_id: userData.user.id,
    payload: {
      email: finalEmail,
      ...(company_name ? { company_name } : {}),
    },
  });

  revalidatePath("/portal/employees");
  revalidateTag(profileCacheTag(userData.user.id), "default");
  revalidateTag("employees", "default");
  revalidateTag("dashboard", "default");
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
  // Extended HR fields
  date_of_birth: z.string().optional().nullable(),
  gender: z.enum(["male", "female"]).optional().nullable(),
  nationality: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  contract_type: z.enum(["full_time", "part_time", "contract", "intern"]).optional().nullable(),
  contract_end_date: z.string().optional().nullable(),
  passport_number: z.string().optional().nullable(),
  blood_type: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional().nullable(),
  education_level: z.enum(["high_school", "diploma", "bachelor", "master", "phd", "other"]).optional().nullable(),
  emergency_contact_name: z.string().optional().nullable(),
  emergency_contact_phone: z.string().optional().nullable(),
  emergency_contact_relationship: z.string().optional().nullable(),
  hr_notes: z.string().optional().nullable(),
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
    date_of_birth: formData.get("date_of_birth") || null,
    gender: formData.get("gender") || null,
    nationality: formData.get("nationality") || null,
    address: formData.get("address") || null,
    department: formData.get("department") || null,
    contract_type: formData.get("contract_type") || null,
    contract_end_date: formData.get("contract_end_date") || null,
    passport_number: formData.get("passport_number") || null,
    blood_type: formData.get("blood_type") || null,
    education_level: formData.get("education_level") || null,
    emergency_contact_name: formData.get("emergency_contact_name") || null,
    emergency_contact_phone: formData.get("emergency_contact_phone") || null,
    emergency_contact_relationship: formData.get("emergency_contact_relationship") || null,
    hr_notes: formData.get("hr_notes") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const { id, role, company_id, hr_notes, ...rest } = parsed.data;
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
  // hr_notes is only writable by managers/admins
  if (current.profile.role !== "employee") {
    payload.hr_notes = hr_notes ?? null;
  }

  const { error } = await admin.from("profiles").update(payload).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/portal/employees/${id}`);
  revalidatePath("/portal/employees");
  revalidateTag(profileCacheTag(id), "default");
  revalidateTag("employees", "default");
  revalidateTag("dashboard", "default");
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
  revalidateTag(profileCacheTag(id), "default");
  revalidateTag("employees", "default");
  revalidateTag("dashboard", "default");
}

export type InviteTokenState = {
  error?: string;
  ok?: boolean;
  inviteUrl?: string;
};

/**
 * Creates a reusable signup invite for Dolce employees under «الطريق الصحيح» only
 * (seed company slug `company-two`). Cap and validity are defined on the invite row.
 */
export async function generateInviteTokenAction(
  _prev: InviteTokenState | undefined,
  _formData: FormData,
): Promise<InviteTokenState> {
  const current = await requireRole(["md_admin", "company_manager"]);

  const dolceCompanyId = await getDolceSignupCompanyId();
  if (!dolceCompanyId) {
    return {
      error:
        "لم يتم العثور على شركة الطريق الصحيح في النظام. اتصل بالدعم الفني.",
    };
  }

  if (current.profile.role === "company_manager") {
    if (!current.profile.company_id) {
      return { error: "لم يتم ربط حسابك بشركة." };
    }
    if (current.profile.company_id !== dolceCompanyId) {
      return {
        error:
          "رابط تسجيل Dolce متاح لمديري شركة الطريق الصحيح فقط.",
      };
    }
  }

  if (current.profile.role === "md_admin") {
    const shellId = await getShellCompanyIdForProfile(current.profile);
    if (!shellId || shellId !== dolceCompanyId) {
      return {
        error:
          "رابط تسجيل Dolce متاح عند اختيار شركة الطريق الصحيح كنشطة فقط.",
      };
    }
    const shellCompany = await getCompanyData(shellId);
    if (
      !isMdManagerFeatureAllowed(
        "employee_signup",
        shellCompany?.enabled_features ?? null,
      )
    ) {
      return {
        error:
          "طلبات التوظيف غير مفعّلة لشركتك النشطة. يفعّلها Super Admin من لوحة الإدارة.",
      };
    }
  }

  const company_id = dolceCompanyId;

  const token = crypto.randomUUID();
  const expires = new Date(
    Date.now() + DOLCE_SIGNUP_INVITE_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const admin = createSupabaseAdminClient();
  const { data: companyRow } = await admin
    .from("companies")
    .select("name")
    .eq("id", company_id)
    .maybeSingle<{ name: string }>();
  const company_name = companyRow?.name ?? null;

  const { data: insertedInvite, error } = await admin
    .from("employee_signup_invites")
    .insert({
      company_id,
      invite_token: token,
      token_expires_at: expires,
      max_uses: DOLCE_SIGNUP_INVITE_MAX_USES,
      use_count: 0,
      created_by: current.userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    return { error: error.message ?? "تعذّر إنشاء الرابط." };
  }

  void logAudit(current.userId, "create", "employee_signup_invite", insertedInvite?.id ?? null, {
    ...(company_name ? { company_name } : {}),
    max_uses: DOLCE_SIGNUP_INVITE_MAX_USES,
    token_expires_at: new Date(expires).toLocaleString("ar-LY", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  });

  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  const inviteUrl = `${base}/signup/${token}`;

  revalidatePath("/portal/employees");
  revalidatePath("/portal/employees/signup-requests");

  return { ok: true, inviteUrl };
}

export type DeleteSignupInviteState = {
  error?: string;
  ok?: boolean;
};

/**
 * Removes an invite campaign row; the URL stops working. Linked signup rows keep
 * `invite_id` null (on delete set null). Dolce company access only.
 */
export async function deleteSignupInviteAction(
  _prev: DeleteSignupInviteState | undefined,
  formData: FormData,
): Promise<DeleteSignupInviteState> {
  const current = await requireRole(["md_admin", "company_manager"]);

  const rawId = formData.get("invite_id");
  if (typeof rawId !== "string" || !rawId) {
    return { error: "معرف الرابط غير صالح." };
  }

  const dolceCompanyId = await getDolceSignupCompanyId();
  if (!dolceCompanyId) {
    return {
      error:
        "لم يتم العثور على شركة الطريق الصحيح في النظام. اتصل بالدعم الفني.",
    };
  }

  if (current.profile.role === "company_manager") {
    if (!current.profile.company_id) {
      return { error: "لم يتم ربط حسابك بشركة." };
    }
    if (current.profile.company_id !== dolceCompanyId) {
      return {
        error:
          "روابط تسجيل Dolce متاحة لمديري شركة الطريق الصحيح فقط.",
      };
    }
  }

  if (current.profile.role === "md_admin") {
    const shellId = await getShellCompanyIdForProfile(current.profile);
    if (!shellId || shellId !== dolceCompanyId) {
      return {
        error:
          "روابط تسجيل Dolce متاحة عند اختيار شركة الطريق الصحيح كنشطة فقط.",
      };
    }
    const shellCompany = await getCompanyData(shellId);
    if (
      !isMdManagerFeatureAllowed(
        "employee_signup",
        shellCompany?.enabled_features ?? null,
      )
    ) {
      return {
        error:
          "طلبات التوظيف غير مفعّلة لشركتك النشطة. يفعّلها Super Admin من لوحة الإدارة.",
      };
    }
  }

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("employee_signup_invites")
    .select("id, company_id")
    .eq("id", rawId)
    .maybeSingle<{ id: string; company_id: string }>();

  if (!row || row.company_id !== dolceCompanyId) {
    return { error: "الرابط غير موجود أو غير مصرّح بحذفه." };
  }

  const { data: companyRow } = await admin
    .from("companies")
    .select("name")
    .eq("id", row.company_id)
    .maybeSingle<{ name: string }>();
  const company_name = companyRow?.name ?? null;

  const { error } = await admin
    .from("employee_signup_invites")
    .delete()
    .eq("id", rawId);

  if (error) {
    return { error: error.message ?? "تعذّر حذف الرابط." };
  }

  await admin.from("audit_log").insert({
    actor_id: current.userId,
    action: "employee_signup_invite.delete",
    entity: "employee_signup_invites",
    entity_id: rawId,
    payload: company_name ? { company_name } : {},
  });

  revalidatePath("/portal/employees");
  revalidatePath("/portal/employees/signup-requests");

  return { ok: true };
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
  revalidateTag("employees", "default");
  revalidateTag("dashboard", "default");
  redirect("/portal/employees");
}
