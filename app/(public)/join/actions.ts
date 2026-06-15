"use server";

import { randomUUID } from "node:crypto";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { passportStorageFileName } from "@/lib/passport-archive-name";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getDolceSignupCompanyId } from "@/lib/dolce-signup-company";

function normalizeGenderStored(input: string | null | undefined): string | null {
  const t = input?.trim() ?? "";
  if (t === "ذكر") return "male";
  if (t === "أنثى") return "female";
  if (t === "male" || t === "female") return t;
  return null;
}

/** Libyan mobile: 10 digits, 09 + 8 digits */
const lyMobile10 = z
  .string()
  .transform((s) => s.replace(/\s+/g, ""))
  .pipe(
    z
      .string()
      .regex(
        /^09\d{8}$/,
        "رقم الجوال يجب أن يكون 10 أرقام بالشكل 09xxxxxxxx",
      ),
  );

const isoDateString = z
  .string()
  .trim()
  .min(1, "تاريخ الميلاد مطلوب")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "أدخل التاريخ بصيغة 1990-05-15 (سنة-شهر-يوم)")
  .refine((s) => {
    const [y, m, d] = s.split("-").map(Number);
    if (!y || m < 1 || m > 12 || d < 1 || d > 31) return false;
    const dt = new Date(y, m - 1, d);
    if (
      dt.getFullYear() !== y ||
      dt.getMonth() !== m - 1 ||
      dt.getDate() !== d
    ) {
      return false;
    }
    const maxBirth = new Date();
    maxBirth.setHours(0, 0, 0, 0);
    maxBirth.setFullYear(maxBirth.getFullYear() - 16);
    dt.setHours(0, 0, 0, 0);
    return dt <= maxBirth;
  }, "يجب أن يكون العمر 16 سنة على الأقل");

const ALLOWED_PASSPORT_IMAGE = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_PASSPORT_BYTES = 8 * 1024 * 1024;

/** Placeholder expiry for open signups (no invite slot). */
const OPEN_SIGNUP_TOKEN_EXPIRES = "2099-01-01T00:00:00.000Z";

const openSubmitSchema = z.object({
  full_name: z.string().min(2, "الاسم مطلوب"),
  phone: lyMobile10,
  passport_number: z.string().min(2, "رقم الجواز مطلوب"),
  external_employee_number: z
    .string()
    .trim()
    .min(1, "رقم الموظف (الخارجي) مطلوب")
    .max(64, "رقم الموظف طويل جداً"),
  national_id: z.string().optional().nullable(),
  job_title: z.string().optional().nullable(),
  branch: z.string().min(2, "الفرع مطلوب"),
  date_of_birth: isoDateString,
  gender: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  blood_type: z.string().optional().nullable(),
  emergency_contact_name: z.string().min(2, "اسم جهة الطوارئ مطلوب"),
  emergency_contact_phone: lyMobile10,
  emergency_contact_relationship: z.string().min(2, "صلة القرابة مطلوبة"),
  website: z.string().optional(),
});

export type JoinSubmitState = { error?: string; ok?: boolean };

function extFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "img";
}

/**
 * Public open Dolce signup — no invite token. Inserts a pending request for
 * manager approval in the portal signup-requests queue.
 */
export async function submitOpenDolceSignupAction(
  _prev: JoinSubmitState | undefined,
  formData: FormData,
): Promise<JoinSubmitState> {
  const honeypot = formData.get("website");
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return { ok: true };
  }

  const parsed = openSubmitSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    passport_number: formData.get("passport_number"),
    external_employee_number: formData.get("external_employee_number"),
    national_id: formData.get("national_id") || null,
    job_title: formData.get("job_title") || null,
    branch: formData.get("branch"),
    date_of_birth: formData.get("date_of_birth") || null,
    gender: formData.get("gender") || null,
    nationality: formData.get("nationality") || null,
    address: formData.get("address") || null,
    blood_type: formData.get("blood_type") || null,
    emergency_contact_name: formData.get("emergency_contact_name"),
    emergency_contact_phone: formData.get("emergency_contact_phone"),
    emergency_contact_relationship: formData.get(
      "emergency_contact_relationship",
    ),
    website: formData.get("website"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
    };
  }

  const passportFile = formData.get("passport_image");
  if (!(passportFile instanceof File) || passportFile.size === 0) {
    return { error: "صورة جواز السفر مطلوبة." };
  }
  if (passportFile.size > MAX_PASSPORT_BYTES) {
    return { error: "صورة الجواز يجب ألا تتجاوز 8 ميجابايت." };
  }
  const mime = passportFile.type || "application/octet-stream";
  if (!ALLOWED_PASSPORT_IMAGE.has(mime)) {
    return {
      error: "نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WebP.",
    };
  }

  const dolceCompanyId = await getDolceSignupCompanyId();
  if (!dolceCompanyId) {
    return {
      error:
        "التسجيل غير متاح حالياً. يرجى المحاولة لاحقاً أو التواصل مع الإدارة.",
    };
  }

  const fileBuffer = Buffer.from(await passportFile.arrayBuffer());
  const genderStored = normalizeGenderStored(parsed.data.gender);
  const ext = extFromMime(mime);
  const newId = randomUUID();
  const placeholderToken = randomUUID();

  const admin = createSupabaseAdminClient();
  const storagePath = `employee-signup/${dolceCompanyId}/${newId}/${passportStorageFileName(parsed.data.full_name, parsed.data.phone, newId, ext)}`;

  const { error: uploadErr } = await admin.storage
    .from("documents")
    .upload(storagePath, fileBuffer, {
      contentType: mime,
      upsert: false,
    });

  if (uploadErr) {
    return {
      error:
        uploadErr.message ?? "تعذّر رفع صورة الجواز. حاول مرة أخرى لاحقاً.",
    };
  }

  const { error: insErr } = await admin.from("employee_signup_requests").insert({
    id: newId,
    company_id: dolceCompanyId,
    invite_id: null,
    invite_token: placeholderToken,
    token_expires_at: OPEN_SIGNUP_TOKEN_EXPIRES,
    token_used: true,
    status: "pending",
    created_by: null,
    full_name: parsed.data.full_name,
    phone: parsed.data.phone,
    passport_number: parsed.data.passport_number.trim(),
    email: null,
    national_id: parsed.data.national_id?.trim() || null,
    job_title: parsed.data.job_title?.trim() || null,
    department: parsed.data.branch.trim(),
    date_of_birth: parsed.data.date_of_birth.trim(),
    gender: genderStored,
    nationality: parsed.data.nationality?.trim() || null,
    address: parsed.data.address?.trim() || null,
    blood_type: parsed.data.blood_type?.trim() || null,
    external_employee_number: parsed.data.external_employee_number,
    passport_image_path: storagePath,
    emergency_contact_name: parsed.data.emergency_contact_name.trim(),
    emergency_contact_phone: parsed.data.emergency_contact_phone,
    emergency_contact_relationship:
      parsed.data.emergency_contact_relationship.trim(),
  });

  if (insErr) {
    await admin.storage.from("documents").remove([storagePath]);
    return { error: insErr.message ?? "تعذّر حفظ الطلب." };
  }

  revalidateTag("badges", "default");
  return { ok: true };
}
