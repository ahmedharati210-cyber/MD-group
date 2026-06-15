"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { profileCacheTag, requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  canAccessDolceEmployeeSignup,
} from "@/lib/dolce-signup-company";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";
import type { BloodType, Gender } from "@/types/db";

const BLOOD_VALUES: readonly BloodType[] = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
];

function parseBloodType(v: string | null): BloodType | null {
  if (!v) return null;
  return (BLOOD_VALUES as readonly string[]).includes(v)
    ? (v as BloodType)
    : null;
}

function parseGenderFromSignup(v: string | null): Gender | null {
  if (!v) return null;
  const s = v.trim();
  if (s === "male" || s === "ذكر") return "male";
  if (s === "female" || s === "أنثى") return "female";
  return null;
}

/**
 * Internal-only auth email so Supabase Auth always has a unique login identifier.
 * Not shown to the applicant — manager uses it (or Supabase dashboard) to set password / login policy.
 */
function syntheticAuthEmailFromRequestId(requestId: string): string {
  const domain =
    process.env.SIGNUP_INTERNAL_AUTH_EMAIL_DOMAIN ?? "signup-local.invalid";
  const slug = String(requestId).replace(/-/g, "");
  return `emp-${slug}@${domain}`;
}

const idOnly = z.object({ request_id: z.string().uuid() });

export type SignupReviewState = {
  error?: string;
  ok?: boolean;
  /** Synthetic login email created for Supabase Auth (unique; optional env domain). */
  internalAuthEmail?: string;
};

export async function approveSignupRequestAction(
  _prev: SignupReviewState | undefined,
  formData: FormData,
): Promise<SignupReviewState> {
  const current = await requireRole(["md_admin", "company_manager"]);

  const parsed = idOnly.safeParse({
    request_id: formData.get("request_id"),
  });
  if (!parsed.success) {
    return { error: "معرف الطلب غير صالح." };
  }

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("employee_signup_requests")
    .select("*")
    .eq("id", parsed.data.request_id)
    .maybeSingle();

  if (!row || row.status !== "pending") {
    return { error: "الطلب غير موجود أو تمت معالجته." };
  }

  if (!current.profile.is_super_admin) {
    if (
      current.profile.role === "company_manager" &&
      row.company_id !== current.profile.company_id
    ) {
      return { error: "صلاحيات غير كافية." };
    }

    if (current.profile.role === "md_admin") {
      const shellId = await getShellCompanyIdForProfile(current.profile);
      if (
        !shellId ||
        row.company_id !== shellId ||
        !(await canAccessDolceEmployeeSignup(current.profile, shellId))
      ) {
        return { error: "صلاحيات غير كافية." };
      }
    }
  }

  const full_name = row.full_name?.trim();
  const phone = row.phone?.trim();
  const externalNum = row.external_employee_number?.trim();

  if (!full_name || !phone || !externalNum) {
    return {
      error:
        "بيانات المتقدّم ناقصة: يجب الاسم، رقم الجوال (09xxxxxxxx)، ورقم الموظف الخارجي (البصمة).",
    };
  }

  if (!/^09\d{8}$/.test(phone)) {
    return { error: "رقم الجوال المُخزَّن في الطلب غير صالح (يتوقع 09xxxxxxxx)." };
  }

  const gender = parseGenderFromSignup(row.gender);

  const syntheticEmail = syntheticAuthEmailFromRequestId(row.id);

  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email: syntheticEmail,
      password: randomBytes(32).toString("base64url"),
      email_confirm: true,
      user_metadata: {
        full_name,
        role: "employee",
      },
    });

  if (createErr || !created?.user) {
    return {
      error:
        createErr?.message ??
        "تعذّر إنشاء حساب المستخدم (قد يكون البريد الداخلي مُكرَّراً أو إعدادات Auth غير مكتملة).",
    };
  }

  const uid = created.user.id;

  const { error: profErr } = await admin
    .from("profiles")
    .update({
      full_name,
      phone: row.phone,
      role: "employee",
      company_id: row.company_id,
      job_title: row.job_title,
      national_id: row.national_id,
      department: row.department,
      date_of_birth: row.date_of_birth,
      gender,
      nationality: row.nationality,
      address: row.address,
      passport_number: row.passport_number,
      blood_type: parseBloodType(row.blood_type),
      emergency_contact_name: row.emergency_contact_name,
      emergency_contact_phone: row.emergency_contact_phone,
      emergency_contact_relationship: row.emergency_contact_relationship,
      external_employee_number: externalNum,
    })
    .eq("id", uid);

  if (profErr) {
    await admin.auth.admin.deleteUser(uid);
    return { error: profErr.message };
  }

  const { error: reqErr } = await admin
    .from("employee_signup_requests")
    .update({
      status: "approved",
      reviewed_by: current.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.request_id);

  if (reqErr) {
    return { error: reqErr.message };
  }

  await admin.from("audit_log").insert({
    actor_id: current.userId,
    action: "employee_signup.approve",
    entity: "employee_signup_requests",
    entity_id: parsed.data.request_id,
    payload: {
      employee_name: full_name,
      external_employee_number: externalNum,
    },
  });

  revalidatePath("/portal/employees/signup-requests");
  revalidatePath("/portal/employees");
  revalidateTag(profileCacheTag(uid), "default");
  revalidateTag("employees", "default");
  revalidateTag("dashboard", "default");
  revalidateTag("badges", "default");
  return { ok: true, internalAuthEmail: syntheticEmail };
}

const rejectSchema = z.object({
  request_id: z.string().uuid(),
  rejection_reason: z.string().max(500).optional().nullable(),
});

export async function rejectSignupRequestAction(
  _prev: SignupReviewState | undefined,
  formData: FormData,
): Promise<SignupReviewState> {
  const current = await requireRole(["md_admin", "company_manager"]);

  const parsed = rejectSchema.safeParse({
    request_id: formData.get("request_id"),
    rejection_reason: formData.get("rejection_reason") || null,
  });
  if (!parsed.success) {
    return { error: "بيانات غير صالحة." };
  }

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("employee_signup_requests")
    .select("id, company_id, status, passport_image_path, full_name")
    .eq("id", parsed.data.request_id)
    .maybeSingle<{
      id: string;
      company_id: string;
      status: string;
      passport_image_path: string | null;
      full_name: string | null;
    }>();

  if (!row || row.status !== "pending") {
    return { error: "الطلب غير موجود أو تمت معالجته." };
  }

  if (!current.profile.is_super_admin) {
    if (
      current.profile.role === "company_manager" &&
      row.company_id !== current.profile.company_id
    ) {
      return { error: "صلاحيات غير كافية." };
    }

    if (current.profile.role === "md_admin") {
      const shellId = await getShellCompanyIdForProfile(current.profile);
      if (
        !shellId ||
        row.company_id !== shellId ||
        !(await canAccessDolceEmployeeSignup(current.profile, shellId))
      ) {
        return { error: "صلاحيات غير كافية." };
      }
    }
  }

  if (row.passport_image_path) {
    await admin.storage.from("documents").remove([row.passport_image_path]);
  }

  const { error } = await admin
    .from("employee_signup_requests")
    .update({
      status: "rejected",
      rejection_reason: parsed.data.rejection_reason?.trim() || null,
      reviewed_by: current.userId,
      reviewed_at: new Date().toISOString(),
      passport_image_path: null,
    })
    .eq("id", parsed.data.request_id);

  if (error) {
    return { error: error.message };
  }

  await admin.from("audit_log").insert({
    actor_id: current.userId,
    action: "employee_signup.reject",
    entity: "employee_signup_requests",
    entity_id: parsed.data.request_id,
    payload: row.full_name?.trim()
      ? { employee_name: row.full_name.trim() }
      : {},
  });

  revalidatePath("/portal/employees/signup-requests");
  revalidateTag("badges", "default");
  return { ok: true };
}
