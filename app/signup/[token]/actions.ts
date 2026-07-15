"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { passportStorageFileName, passportUploadUserMessage } from "@/lib/passport-archive-name";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { rejectIfBot } from "@/lib/botid/verify-public-form";

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

const submitSchema = z.object({
  token: z.string().min(8),
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
  /** فرع المتجر — stored in `department` column */
  branch: z.string().min(2, "الفرع مطلوب"),
  date_of_birth: isoDateString,
  gender: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  blood_type: z.string().optional().nullable(),
  emergency_contact_name: z.string().min(2, "اسم جهة الطوارئ مطلوب"),
  emergency_contact_phone: lyMobile10,
  emergency_contact_relationship: z.string().min(2, "صلة القرابة مطلوبة"),
  /** Honeypot — must stay empty */
  website: z.string().optional(),
});

export type SignupSubmitState = { error?: string; ok?: boolean };

function extFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "img";
}

/**
 * Public signup submit: validates invite token server-side and stores the
 * application as pending manager approval. Uses service role only on the server.
 */
export async function submitEmployeeSignupAction(
  _prev: SignupSubmitState | undefined,
  formData: FormData,
): Promise<SignupSubmitState> {
  const botError = await rejectIfBot();
  if (botError) return { error: botError };

  const honeypot = formData.get("website");
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return { ok: true };
  }

  const parsed = submitSchema.safeParse({
    token: formData.get("token"),
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

  const fileBuffer = Buffer.from(await passportFile.arrayBuffer());
  const genderStored = normalizeGenderStored(parsed.data.gender);
  const ext = extFromMime(mime);

  const admin = createSupabaseAdminClient();

  type InviteSlotRow = {
    invite_id: string;
    company_id: string;
    token_expires_at: string;
  };

  const { data: rpcData, error: rpcErr } = await admin.rpc(
    "reserve_invite_slot",
    { p_token: parsed.data.token },
  );

  if (rpcErr) {
    return {
      error: rpcErr.message ?? "تعذّر التحقق من الرابط.",
    };
  }

  const slotArr = rpcData as InviteSlotRow[] | null | undefined;
  const slot =
    Array.isArray(slotArr) && slotArr.length > 0 ? slotArr[0]! : null;

  if (slot) {
    const newId = crypto.randomUUID();
    const storagePath = `employee-signup/${slot.company_id}/${newId}/${passportStorageFileName(parsed.data.full_name, parsed.data.phone, newId, ext)}`;

    const { error: uploadErr } = await admin.storage
      .from("documents")
      .upload(storagePath, fileBuffer, {
        contentType: mime,
        upsert: false,
      });

    if (uploadErr) {
      await admin.rpc("release_invite_slot", { p_invite_id: slot.invite_id });
      return { error: passportUploadUserMessage() };
    }

    const { error: insErr } = await admin.from("employee_signup_requests").insert({
      id: newId,
      company_id: slot.company_id,
      invite_id: slot.invite_id,
      invite_token: parsed.data.token,
      token_expires_at: slot.token_expires_at,
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
      await admin.rpc("release_invite_slot", { p_invite_id: slot.invite_id });
      return { error: insErr.message ?? "تعذّر حفظ الطلب." };
    }

    revalidateTag("badges", "default");
    return { ok: true };
  }

  const { data: legacyRows, error: fetchErr } = await admin
    .from("employee_signup_requests")
    .select("id, company_id, token_used, status, token_expires_at")
    .eq("invite_token", parsed.data.token)
    .eq("status", "draft")
    .eq("token_used", false)
    .limit(1);

  const row = legacyRows?.[0];

  if (fetchErr || !row) {
    return {
      error:
        "رابط الدعوة غير صالح أو منتهي أو وصل للحد الأقصى للتسجيلات.",
    };
  }

  const expires = new Date(row.token_expires_at).getTime();
  if (Number.isFinite(expires) && expires < Date.now()) {
    return { error: "انتهت صلاحية رابط الدعوة." };
  }

  if (row.token_used || row.status !== "draft") {
    return { error: "تم استخدام هذا الرابط مسبقاً." };
  }

  const storagePath = `employee-signup/${row.company_id}/${row.id}/${passportStorageFileName(parsed.data.full_name, parsed.data.phone, row.id, ext)}`;

  const { error: uploadErr } = await admin.storage
    .from("documents")
    .upload(storagePath, fileBuffer, {
      contentType: mime,
      upsert: false,
    });

  if (uploadErr) {
    return { error: passportUploadUserMessage() };
  }

  const { error: updErr } = await admin
    .from("employee_signup_requests")
    .update({
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
      token_used: true,
      status: "pending",
    })
    .eq("id", row.id)
    .eq("status", "draft")
    .eq("token_used", false);

  if (updErr) {
    await admin.storage.from("documents").remove([storagePath]);
    return { error: updErr.message ?? "تعذّر حفظ الطلب." };
  }

  revalidateTag("badges", "default");
  return { ok: true };
}
