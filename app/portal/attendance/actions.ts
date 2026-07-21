"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAttendanceAccess, requireRole } from "@/lib/auth";
import { computeDayRecord } from "@/lib/attendance/monthly-calculations";
import {
  fullTimeConfigFromBranch,
  processAttendanceImportFile,
} from "@/lib/attendance/import-process";
import type { MatchedImportRow } from "@/lib/attendance/raw-excel-parser";
import {
  computeDayRecordWithShift,
  computeSessionRecord,
} from "@/lib/attendance/shift-matching";
import {
  customSchedulePayloadSnapshot,
  isSyntheticCustomShiftId,
  personToSyntheticShift,
} from "@/lib/attendance/person-schedule";
import type { AttendancePerson } from "@/types/db";
import {
  punchSessionFromManualEdit,
  punchSessionFromRecord,
} from "@/lib/attendance/session-from-record";
import {
  assertAttendanceCompanyAccess,
  assertBranchBelongsToCompany,
  requireSuperAdmin,
  resolveAttendanceCompanyId,
} from "@/lib/attendance/scope";
import {
  computeImportReimportDiff,
  type ImportReimportDiff,
} from "@/lib/attendance/import-reimport-diff";
import {
  getAttendanceBranch,
  getAttendanceCompanies,
  getAttendanceImport,
  getAttendancePeopleByExternalNumbers,
  getAttendanceShifts,
} from "@/lib/data/monthly-attendance";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ABSENT_STATUS,
  HOLIDAY_LEAVE_TYPE,
  isLeaveType,
  LEAVE_TYPES,
} from "@/lib/attendance/leave-types";

import type { Profile } from "@/types/db";

export type ActionState = { error?: string; ok?: boolean };

export type ImportPreviewState = {
  error?: string;
  rows?: MatchedImportRow[];
  newPeople?: string[];
  newPeopleDetails?: Array<{ externalNumber: string; name: string }>;
  warnings?: string[];
  fileName?: string;
  importFormat?: "per_day" | "raw_punch_log";
  monthMismatch?: {
    detectedMonth: string;
    selectedMonth: string;
    message: string;
  };
  reimportDiff?: ImportReimportDiff;
};

async function resolveCompanyScope(
  companyId: string | null,
  profile: Pick<Profile, "role" | "company_id" | "is_super_admin">,
): Promise<{ companyId: string } | { error: string }> {
  if (profile.is_super_admin) {
    if (!companyId) return { error: "اختر الشركة" };
    return { companyId };
  }

  if (profile.role === "company_manager") {
    if (!profile.company_id) return { error: "لا توجد شركة مرتبطة بحسابك" };
    if (companyId && companyId !== profile.company_id) {
      return { error: "صلاحيات غير كافية" };
    }
    return { companyId: profile.company_id };
  }

  if (profile.role === "md_admin") {
    const companies = await getAttendanceCompanies({
      attendanceEnabledOnly: !profile.is_super_admin,
    });
    const resolvedCompanyId = await resolveAttendanceCompanyId(
      profile,
      companyId,
      companies,
    );
    if (!resolvedCompanyId) return { error: "اختر الشركة" };
    const access = await assertAttendanceCompanyAccess(profile, resolvedCompanyId);
    if ("error" in access) return { error: access.error };
    return { companyId: resolvedCompanyId };
  }

  return { error: "صلاحيات غير كافية" };
}

function revalidateAttendanceData() {
  revalidatePath("/portal/attendance");
  revalidatePath("/portal/attendance/person");
  revalidatePath("/portal/attendance/summary");
  revalidateTag("attendance", "default");
}

const monthSchema = z.string().regex(/^\d{4}-\d{2}-01$/);

export async function previewAttendanceImportAction(
  _prev: ImportPreviewState | undefined,
  formData: FormData,
): Promise<ImportPreviewState> {
  await requireAttendanceAccess();
  const current = await requireRole(["md_admin", "company_manager"]);

  const file = formData.get("file");
  const branchId = formData.get("branch_id");
  const month = formData.get("month");
  let companyId = formData.get("company_id") as string | null;

  if (!(file instanceof File) || file.size === 0) {
    return { error: "اختر ملف Excel صالح" };
  }
  if (typeof branchId !== "string" || !branchId) {
    return { error: "اختر الفرع" };
  }
  if (typeof month !== "string" || !monthSchema.safeParse(`${month}-01`).success) {
    return { error: "اختر شهراً صالحاً" };
  }

  const scope = await resolveCompanyScope(companyId, current.profile);
  if ("error" in scope) return { error: scope.error };

  const branchCheck = await assertBranchBelongsToCompany(scope.companyId, branchId);
  if ("error" in branchCheck) return { error: branchCheck.error };

  const buffer = await file.arrayBuffer();
  const processed = await processAttendanceImportFile(
    buffer,
    scope.companyId,
    branchId,
    month,
  );
  if ("error" in processed) return { error: processed.error };

  const matched = { rows: processed.rows, warnings: processed.warnings };

  const newPeopleDetails = [
    ...new Map(
      matched.rows
        .filter((r) => r.isNewPerson)
        .map((r) => [
          r.externalEmployeeNumber,
          { externalNumber: r.externalEmployeeNumber, name: r.employeeName },
        ]),
    ).values(),
  ];

  const newPeople = newPeopleDetails.map(
    (p) => `${p.name} (${p.externalNumber})`,
  );

  const monthDate = `${month}-01`;
  const supabase = await createSupabaseServerClient();
  const { data: existingImport } = await supabase
    .from("attendance_imports")
    .select("id")
    .eq("company_id", scope.companyId)
    .eq("branch_id", branchId)
    .eq("month", monthDate)
    .maybeSingle<{ id: string }>();

  let reimportDiff: ImportReimportDiff | undefined;
  if (existingImport?.id) {
    const { data: existingRecords } = await supabase
      .from("attendance_monthly_records")
      .select(
        "external_employee_number, date, first_check_in, last_check_out, manually_overridden",
      )
      .eq("import_id", existingImport.id);

    reimportDiff = computeImportReimportDiff(
      existingRecords ?? [],
      matched.rows,
    );
  }

  return {
    rows: matched.rows,
    newPeople,
    newPeopleDetails,
    warnings: matched.warnings,
    fileName: file.name,
    importFormat: processed.format === "unknown" ? undefined : processed.format,
    monthMismatch: processed.monthMismatch ?? undefined,
    reimportDiff,
  };
}

async function upsertAttendancePeople(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  companyId: string,
  branchId: string,
  rows: MatchedImportRow[],
): Promise<Map<string, string>> {
  const existingPeople = await getAttendancePeopleByExternalNumbers(companyId, branchId);

  const byExt = new Map<
    string,
    { full_name: string; raw_department_hint: string | null }
  >();
  for (const row of rows) {
    if (!byExt.has(row.externalEmployeeNumber)) {
      byExt.set(row.externalEmployeeNumber, {
        full_name: row.employeeName,
        raw_department_hint: row.departmentHint,
      });
    }
  }

  const now = new Date().toISOString();
  const upsertRows = [...byExt.entries()].map(([ext, meta]) => {
    const existing = existingPeople.get(ext);
    return {
      company_id: companyId,
      branch_id: branchId,
      external_employee_number: ext,
      full_name: meta.full_name,
      raw_department_hint: meta.raw_department_hint,
      shift_id: existing?.shift_id ?? null,
      custom_start_time: existing?.custom_start_time ?? null,
      custom_end_time: existing?.custom_end_time ?? null,
      custom_crosses_midnight: existing?.custom_crosses_midnight ?? false,
      custom_late_grace_minutes: existing?.custom_late_grace_minutes ?? 15,
      custom_early_leave_grace_minutes:
        existing?.custom_early_leave_grace_minutes ?? 15,
      custom_work_days: existing?.custom_work_days ?? null,
      active: true,
      last_seen_at: now,
    };
  });

  if (upsertRows.length > 0) {
    const { error } = await supabase.from("attendance_people").upsert(upsertRows, {
      onConflict: "company_id,branch_id,external_employee_number",
    });
    if (error) throw new Error(error.message);
  }

  const people = await getAttendancePeopleByExternalNumbers(companyId, branchId);
  const idMap = new Map<string, string>();
  for (const [ext, person] of people) {
    idMap.set(ext, person.id);
  }
  return idMap;
}

export async function saveAttendanceImportAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const current = await requireAttendanceAccess();
  await requireRole(["md_admin", "company_manager"]);

  const file = formData.get("file");
  const branchId = formData.get("branch_id");
  const month = formData.get("month");
  let companyId = formData.get("company_id") as string | null;
  const fileName = formData.get("file_name");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "أعد رفع ملف Excel للحفظ" };
  }
  if (typeof branchId !== "string" || !branchId) return { error: "اختر الفرع" };
  if (typeof month !== "string" || !monthSchema.safeParse(`${month}-01`).success) {
    return { error: "شهر غير صالح" };
  }

  const scope = await resolveCompanyScope(companyId, current.profile);
  if ("error" in scope) return { error: scope.error };

  const branchCheck = await assertBranchBelongsToCompany(scope.companyId, branchId);
  if ("error" in branchCheck) return { error: branchCheck.error };

  const buffer = await file.arrayBuffer();
  const processed = await processAttendanceImportFile(
    buffer,
    scope.companyId,
    branchId,
    month,
  );
  if ("error" in processed) return { error: processed.error };

  const rows = processed.rows;

  const confirmMismatch = formData.get("confirm_month_mismatch") === "true";
  if (processed.monthMismatch && !confirmMismatch) {
    return {
      error: `${processed.monthMismatch.message} أكّد المتابعة أو غيّر الشهر المحدد.`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const monthDate = `${month}-01`;

  let personIdByExt: Map<string, string>;
  try {
    personIdByExt = await upsertAttendancePeople(
      supabase,
      scope.companyId,
      branchId,
      rows,
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "تعذر حفظ قائمة الحضور" };
  }

  const existingCount = new Set(
    rows.filter((r) => !r.isNewPerson).map((r) => r.externalEmployeeNumber),
  ).size;
  const newCount = new Set(
    rows.filter((r) => r.isNewPerson).map((r) => r.externalEmployeeNumber),
  ).size;

  const { data: existingImport } = await supabase
    .from("attendance_imports")
    .select("id")
    .eq("company_id", scope.companyId)
    .eq("branch_id", branchId)
    .eq("month", monthDate)
    .maybeSingle<{ id: string }>();

  if (existingImport?.id) {
    await supabase
      .from("attendance_monthly_records")
      .delete()
      .eq("import_id", existingImport.id);
    await supabase.from("attendance_imports").delete().eq("id", existingImport.id);
  }

  const { data: importRow, error: importError } = await supabase
    .from("attendance_imports")
    .insert({
      company_id: scope.companyId,
      branch_id: branchId,
      month: monthDate,
      file_name: typeof fileName === "string" ? fileName : null,
      created_by: current.userId,
      matched_count: existingCount,
      unmatched_count: newCount,
      warning_summary:
        newCount || processed.warnings.length
          ? {
              new_people_count: newCount,
              messages: processed.warnings.slice(0, 100),
            }
          : null,
    })
    .select("id")
    .single<{ id: string }>();

  if (importError || !importRow) {
    return { error: importError?.message ?? "تعذر حفظ الاستيراد" };
  }

  const recordRows = rows.map((r) => ({
    import_id: importRow.id,
    company_id: scope.companyId,
    branch_id: branchId,
    attendance_person_id: personIdByExt.get(r.externalEmployeeNumber) ?? null,
    profile_id: null,
    external_employee_number: r.externalEmployeeNumber,
    employee_name: r.employeeName,
    date: r.date,
    first_check_in: r.firstCheckIn,
    last_check_out: r.lastCheckOut,
    total_minutes: r.totalMinutes,
    shift_type: r.computed.shiftType,
    expected_minutes: r.computed.expectedMinutes,
    late_minutes: r.computed.lateMinutes,
    early_leave_minutes: r.computed.earlyLeaveMinutes,
    overtime_minutes: r.computed.overtimeMinutes,
    deduction_minutes: r.computed.deductionMinutes,
    is_holiday: false,
    is_absent: r.computed.isAbsent,
    notes: r.computed.notes,
    shift_id: r.shiftId ?? null,
    punch_count: r.punchCount ?? null,
    raw_payload: r.rawPayload ?? {
      department_hint: r.departmentHint,
      day_name: r.dayName,
      total_time: r.totalTime,
    },
  }));

  if (recordRows.length > 0) {
    const { error: recordsError } = await supabase
      .from("attendance_monthly_records")
      .insert(recordRows);
    if (recordsError) return { error: recordsError.message };
  }

  revalidateAttendanceData();
  revalidatePath("/portal/attendance/branches");
  return { ok: true };
}

const punchTimeSchema = z
  .string()
  .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, "صيغة الوقت غير صالحة")
  .optional()
  .nullable();

const updateRecordSchema = z.object({
  id: z.string().uuid(),
  first_check_in: punchTimeSchema,
  last_check_out: punchTimeSchema,
  leave_type: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  shift_id: z.string().uuid().optional().nullable(),
});

export async function updateMonthlyRecordAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await requireAttendanceAccess();
  const current = await requireRole(["md_admin", "company_manager"]);

  const parsed = updateRecordSchema.safeParse({
    id: formData.get("id"),
    first_check_in: formData.get("first_check_in") || null,
    last_check_out: formData.get("last_check_out") || null,
    leave_type: (formData.get("leave_type") as string | null) || null,
    notes: formData.get("notes") || null,
    shift_id: (formData.get("shift_id") as string | null) || null,
  });
  if (!parsed.success) return { error: "بيانات غير صالحة" };

  const leaveTypeRaw = parsed.data.leave_type?.trim() || null;
  const isAbsentStatus = leaveTypeRaw === ABSENT_STATUS;
  const leaveType = isAbsentStatus ? null : leaveTypeRaw;
  if (leaveTypeRaw && !isAbsentStatus && !isLeaveType(leaveTypeRaw)) {
    return { error: "نوع الإجازة غير صالح" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("attendance_monthly_records")
    .select(
      "id, company_id, branch_id, attendance_person_id, first_check_in, last_check_out, is_holiday, date, raw_payload, punch_count",
    )
    .eq("id", parsed.data.id)
    .single<{
      id: string;
      company_id: string;
      branch_id: string;
      attendance_person_id: string | null;
      first_check_in: string | null;
      last_check_out: string | null;
      is_holiday: boolean;
      date: string;
      raw_payload: Record<string, unknown> | null;
      punch_count: number | null;
    }>();

  if (!existing) return { error: "السجل غير موجود" };
  if (
    current.profile.role === "company_manager" &&
    existing.company_id !== current.profile.company_id
  ) {
    return { error: "صلاحيات غير كافية" };
  }
  const recordCompanyAccess = await assertAttendanceCompanyAccess(
    current.profile,
    existing.company_id,
  );
  if ("error" in recordCompanyAccess) return { error: recordCompanyAccess.error };

  const firstCheckIn =
    isAbsentStatus || leaveType
      ? null
      : (parsed.data.first_check_in ?? existing.first_check_in);
  const lastCheckOut =
    isAbsentStatus || leaveType
      ? null
      : (parsed.data.last_check_out ?? existing.last_check_out);
  const isHoliday = leaveType === HOLIDAY_LEAVE_TYPE;
  const shiftId = isAbsentStatus ? null : parsed.data.shift_id ?? null;

  const rawPayload = existing.raw_payload ?? {};
  // Form sends HH:MM while Postgres stores HH:MM:SS — compare normalized values.
  const normalizeTime = (t: string | null) => t?.slice(0, 5) ?? null;
  const manuallyEdited =
    !isAbsentStatus &&
    (normalizeTime(firstCheckIn) !== normalizeTime(existing.first_check_in) ||
      normalizeTime(lastCheckOut) !== normalizeTime(existing.last_check_out));

  const session =
    isAbsentStatus || leaveType
      ? null
      : manuallyEdited
        ? punchSessionFromManualEdit(
            existing.date,
            firstCheckIn,
            lastCheckOut,
            rawPayload,
          )
        : punchSessionFromRecord({
            date: existing.date,
            first_check_in: firstCheckIn,
            last_check_out: lastCheckOut,
            punch_count: existing.punch_count,
            raw_payload: rawPayload,
          });

  let computed = computeDayRecord({
    firstCheckIn,
    lastCheckOut,
    isHoliday,
  });
  let resolvedShiftId: string | null = shiftId;
  let updatedPayloadBase: Record<string, unknown> = {};

  if (isAbsentStatus) {
    computed = {
      totalMinutes: null,
      shiftType: null,
      expectedMinutes: null,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      deductionMinutes: 0,
      isAbsent: true,
      notes: null,
    };
    resolvedShiftId = null;
  } else if (leaveType) {
    computed = {
      totalMinutes: null,
      shiftType: null,
      expectedMinutes: null,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      deductionMinutes: 0,
      isAbsent: false,
      notes: null,
    };
    resolvedShiftId = null;
  } else if (session) {
    const [shifts, branch, personRow] = await Promise.all([
      getAttendanceShifts(existing.branch_id),
      getAttendanceBranch(existing.branch_id),
      existing.attendance_person_id
        ? supabase
            .from("attendance_people")
            .select("*")
            .eq("id", existing.attendance_person_id)
            .maybeSingle<AttendancePerson>()
            .then((r) => r.data)
        : Promise.resolve(null),
    ]);
    const fullTimeConfig = fullTimeConfigFromBranch(branch);
    const preferredShift = personRow ? personToSyntheticShift(personRow) : null;

    if (shiftId) {
      const shift = shifts.find((s) => s.id === shiftId);
      if (shift) {
        computed = computeDayRecordWithShift(session, shift);
        resolvedShiftId = shift.id;
      } else {
        const result = computeSessionRecord(
          session,
          shifts,
          fullTimeConfig,
          preferredShift,
        );
        computed = result.computed;
        resolvedShiftId =
          result.shift && !isSyntheticCustomShiftId(result.shift.id)
            ? result.shift.id
            : null;
      }
    } else {
      const result = computeSessionRecord(
        session,
        shifts,
        fullTimeConfig,
        preferredShift,
      );
      computed = result.computed;
      resolvedShiftId =
        result.shift && !isSyntheticCustomShiftId(result.shift.id)
          ? result.shift.id
          : null;
    }

    if (preferredShift && personRow && !shiftId) {
      updatedPayloadBase = {
        custom_schedule: customSchedulePayloadSnapshot(personRow),
      };
    }
  }

  const updatedPayload: Record<string, unknown> = {
    ...rawPayload,
    ...(manuallyEdited ? { manually_overridden: true } : {}),
    ...(isAbsentStatus ? { manual_absent: true } : {}),
    ...updatedPayloadBase,
    ...(session && !leaveType && !isAbsentStatus
      ? {
          first_punch_date: session.firstPunchDate,
          last_punch_date: session.lastPunchDate,
          selected_check_in: session.firstCheckIn
            ? { date: session.firstPunchDate, time: session.firstCheckIn }
            : null,
          selected_check_out: session.lastCheckOut
            ? { date: session.lastPunchDate, time: session.lastCheckOut }
            : null,
        }
      : {}),
  };

  const { error } = await supabase
    .from("attendance_monthly_records")
    .update({
      first_check_in: firstCheckIn,
      last_check_out: lastCheckOut,
      is_holiday: isHoliday,
      leave_type: leaveType,
      notes: parsed.data.notes,
      shift_id: resolvedShiftId,
      punch_count:
        isAbsentStatus || leaveType ? null : existing.punch_count,
      total_minutes: computed.totalMinutes,
      shift_type: computed.shiftType,
      expected_minutes: computed.expectedMinutes,
      late_minutes: computed.lateMinutes,
      early_leave_minutes: computed.earlyLeaveMinutes,
      overtime_minutes: computed.overtimeMinutes,
      deduction_minutes: computed.deductionMinutes,
      is_absent: computed.isAbsent,
      raw_payload: updatedPayload,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidateAttendanceData();
  return { ok: true };
}

const createLeaveSchema = z.object({
  attendance_person_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  leave_type: z.string().min(1),
  company_id: z.string().uuid(),
  branch_id: z.string().uuid(),
});

export async function createLeaveRecordAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await requireAttendanceAccess();
  const current = await requireRole(["md_admin", "company_manager"]);

  const parsed = createLeaveSchema.safeParse({
    attendance_person_id: formData.get("attendance_person_id"),
    date: formData.get("date"),
    leave_type: formData.get("leave_type"),
    company_id: formData.get("company_id"),
    branch_id: formData.get("branch_id"),
  });
  if (!parsed.success) return { error: "بيانات غير صالحة" };

  if (
    current.profile.role === "company_manager" &&
    parsed.data.company_id !== current.profile.company_id
  ) {
    return { error: "صلاحيات غير كافية" };
  }

  const companyAccess = await assertAttendanceCompanyAccess(
    current.profile,
    parsed.data.company_id,
  );
  if ("error" in companyAccess) return { error: companyAccess.error };

  const branchCheck = await assertBranchBelongsToCompany(
    parsed.data.company_id,
    parsed.data.branch_id,
  );
  if ("error" in branchCheck) return { error: branchCheck.error };

  const month = `${parsed.data.date.slice(0, 7)}-01`;
  const importRow = await getAttendanceImport(
    parsed.data.company_id,
    parsed.data.branch_id,
    month,
  );
  if (!importRow) {
    return {
      error:
        "لا يوجد استيراد لهذا الشهر. قم باستيراد ملف الحضور أولاً ثم أعد المحاولة.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: person } = await supabase
    .from("attendance_people")
    .select("id, company_id, branch_id, external_employee_number, full_name")
    .eq("id", parsed.data.attendance_person_id)
    .maybeSingle<{
      id: string;
      company_id: string;
      branch_id: string | null;
      external_employee_number: string;
      full_name: string;
    }>();

  if (!person || person.company_id !== parsed.data.company_id) {
    return { error: "الموظف غير موجود" };
  }
  if (person.branch_id && person.branch_id !== parsed.data.branch_id) {
    return { error: "الموظف لا ينتمي لهذا الفرع" };
  }

  const statusValue = parsed.data.leave_type;
  const isAbsentStatus = statusValue === ABSENT_STATUS;
  if (!isAbsentStatus && !isLeaveType(statusValue)) {
    return { error: "نوع الحالة غير صالح" };
  }

  const leaveType = isAbsentStatus ? null : statusValue;
  const isHoliday = leaveType === HOLIDAY_LEAVE_TYPE;

  const { error } = await supabase.from("attendance_monthly_records").insert({
    import_id: importRow.id,
    company_id: parsed.data.company_id,
    branch_id: parsed.data.branch_id,
    attendance_person_id: person.id,
    profile_id: null,
    external_employee_number: person.external_employee_number,
    employee_name: person.full_name,
    date: parsed.data.date,
    first_check_in: null,
    last_check_out: null,
    total_minutes: null,
    shift_type: null,
    expected_minutes: null,
    late_minutes: 0,
    early_leave_minutes: 0,
    overtime_minutes: 0,
    deduction_minutes: 0,
    is_holiday: isHoliday,
    is_absent: isAbsentStatus,
    leave_type: leaveType,
    notes: null,
    shift_id: null,
    punch_count: null,
    raw_payload: isAbsentStatus ? { manual_absent: true } : { manual_leave: true },
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "يوجد سجل لهذا الموظف في هذا اليوم بالفعل." };
    }
    return { error: error.message };
  }

  revalidateAttendanceData();
  return { ok: true };
}

const branchSchema = z.object({
  company_id: z.string().uuid(),
  name: z.string().min(2),
  code: z.string().optional().nullable(),
  display_order: z.coerce.number().int().optional(),
});

export async function createAttendanceBranchAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await requireAttendanceAccess();
  const current = await requireRole(["md_admin", "company_manager"]);

  const parsed = branchSchema.safeParse({
    company_id: formData.get("company_id"),
    name: formData.get("name"),
    code: formData.get("code") || null,
    display_order: formData.get("display_order") || 0,
  });
  if (!parsed.success) return { error: "بيانات الفرع غير صالحة" };

  const companyAccess = await assertAttendanceCompanyAccess(
    current.profile,
    parsed.data.company_id,
  );
  if ("error" in companyAccess) return { error: companyAccess.error };

  if (
    current.profile.role === "company_manager" &&
    parsed.data.company_id !== current.profile.company_id
  ) {
    return { error: "صلاحيات غير كافية" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("attendance_branches").insert({
    company_id: parsed.data.company_id,
    name: parsed.data.name,
    code: parsed.data.code,
    display_order: parsed.data.display_order ?? 0,
  });
  if (error) return { error: error.message };

  revalidatePath("/portal/attendance/branches");
  revalidatePath("/portal/attendance");
  return { ok: true };
}

export async function toggleAttendanceBranchAction(formData: FormData) {
  await requireAttendanceAccess();
  const current = await requireRole(["md_admin", "company_manager"]);
  const id = formData.get("id");
  const active = formData.get("active") === "true";
  if (typeof id !== "string") return;

  const supabase = await createSupabaseServerClient();
  const { data: branch } = await supabase
    .from("attendance_branches")
    .select("company_id")
    .eq("id", id)
    .single<{ company_id: string }>();
  if (!branch) return;
  const companyAccess = await assertAttendanceCompanyAccess(
    current.profile,
    branch.company_id,
  );
  if ("error" in companyAccess) return;
  if (
    current.profile.role === "company_manager" &&
    branch.company_id !== current.profile.company_id
  ) {
    return;
  }

  await supabase.from("attendance_branches").update({ active }).eq("id", id);
  revalidatePath("/portal/attendance/branches");
  revalidatePath("/portal/attendance");
}

const personSchema = z.object({
  company_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  external_employee_number: z.string().min(1),
  full_name: z.string().min(1),
  notes: z.string().optional().nullable(),
});

export async function createAttendancePersonAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await requireAttendanceAccess();
  const current = await requireRole(["md_admin", "company_manager"]);

  const parsed = personSchema.safeParse({
    company_id: formData.get("company_id"),
    branch_id: formData.get("branch_id"),
    external_employee_number: formData.get("external_employee_number"),
    full_name: formData.get("full_name"),
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) return { error: "بيانات غير صالحة" };

  const companyAccess = await assertAttendanceCompanyAccess(
    current.profile,
    parsed.data.company_id,
  );
  if ("error" in companyAccess) return { error: companyAccess.error };

  if (
    current.profile.role === "company_manager" &&
    parsed.data.company_id !== current.profile.company_id
  ) {
    return { error: "صلاحيات غير كافية" };
  }

  const branchCheck = await assertBranchBelongsToCompany(
    parsed.data.company_id,
    parsed.data.branch_id,
  );
  if ("error" in branchCheck) return { error: branchCheck.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("attendance_people").insert({
    company_id: parsed.data.company_id,
    branch_id: parsed.data.branch_id,
    external_employee_number: parsed.data.external_employee_number.trim(),
    full_name: parsed.data.full_name.trim(),
    notes: parsed.data.notes,
    active: true,
  });
  if (error) return { error: error.message };

  revalidatePath("/portal/attendance/branches");
  return { ok: true };
}

const timeHmSchema = z
  .string()
  .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
  .nullable();

const updatePersonSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().min(1).optional(),
  external_employee_number: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
  custom_start_time: timeHmSchema.optional(),
  custom_end_time: timeHmSchema.optional(),
  custom_crosses_midnight: z.boolean().optional(),
  custom_late_grace_minutes: z.coerce.number().int().min(0).max(180).optional(),
  custom_early_leave_grace_minutes: z.coerce.number().int().min(0).max(180).optional(),
  custom_work_days: z.array(z.number().int().min(0).max(6)).nullable().optional(),
});

export async function updateAttendancePersonAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await requireAttendanceAccess();
  const current = await requireRole(["md_admin", "company_manager"]);

  const startRaw = String(formData.get("custom_start_time") ?? "").trim();
  const endRaw = String(formData.get("custom_end_time") ?? "").trim();
  const workDaysRaw = formData.getAll("custom_work_days").map(String);
  const hasCustomTimes = Boolean(startRaw && endRaw);

  const parsed = updatePersonSchema.safeParse({
    id: formData.get("id"),
    full_name: formData.get("full_name") || undefined,
    external_employee_number: formData.get("external_employee_number") || undefined,
    notes: formData.get("notes") || null,
    custom_start_time: hasCustomTimes ? startRaw : null,
    custom_end_time: hasCustomTimes ? endRaw : null,
    custom_crosses_midnight: formData.get("custom_crosses_midnight") === "true",
    custom_late_grace_minutes: formData.get("custom_late_grace_minutes") || 15,
    custom_early_leave_grace_minutes:
      formData.get("custom_early_leave_grace_minutes") || 15,
    custom_work_days: hasCustomTimes
      ? workDaysRaw
          .map((v) => Number(v))
          .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
      : null,
  });
  if (!parsed.success) return { error: "بيانات غير صالحة" };
  if ((startRaw && !endRaw) || (!startRaw && endRaw)) {
    return { error: "أدخل وقت البداية والنهاية معاً، أو اتركهما فارغين" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: person } = await supabase
    .from("attendance_people")
    .select("company_id")
    .eq("id", parsed.data.id)
    .single<{ company_id: string }>();
  if (!person) return { error: "الشخص غير موجود" };
  const companyAccess = await assertAttendanceCompanyAccess(
    current.profile,
    person.company_id,
  );
  if ("error" in companyAccess) return { error: companyAccess.error };
  if (
    current.profile.role === "company_manager" &&
    person.company_id !== current.profile.company_id
  ) {
    return { error: "صلاحيات غير كافية" };
  }

  const { id, ...updates } = parsed.data;
  const { error } = await supabase
    .from("attendance_people")
    .update({
      ...updates,
      external_employee_number: updates.external_employee_number?.trim(),
      full_name: updates.full_name?.trim(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/portal/attendance/branches");
  revalidatePath("/portal/attendance");
  revalidatePath("/portal/attendance/person");
  return { ok: true };
}

export async function toggleAttendancePersonAction(formData: FormData) {
  await requireAttendanceAccess();
  const current = await requireRole(["md_admin", "company_manager"]);
  const id = formData.get("id");
  const active = formData.get("active") === "true";
  if (typeof id !== "string") return;

  const supabase = await createSupabaseServerClient();
  const { data: person } = await supabase
    .from("attendance_people")
    .select("company_id")
    .eq("id", id)
    .single<{ company_id: string }>();
  if (!person) return;
  const companyAccess = await assertAttendanceCompanyAccess(
    current.profile,
    person.company_id,
  );
  if ("error" in companyAccess) return;
  if (
    current.profile.role === "company_manager" &&
    person.company_id !== current.profile.company_id
  ) {
    return;
  }

  await supabase.from("attendance_people").update({ active }).eq("id", id);
  revalidatePath("/portal/attendance/branches");
}

export async function deleteAttendanceImportAction(
  formData: FormData,
): Promise<ActionState> {
  const current = await requireAttendanceAccess();
  await requireRole(["md_admin", "company_manager"]);

  const adminCheck = await requireSuperAdmin(current.profile.is_super_admin);
  if ("error" in adminCheck) return { error: adminCheck.error };

  const importId = formData.get("import_id");
  if (typeof importId !== "string" || !importId) {
    return { error: "معرّف الاستيراد غير صالح" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase
    .from("attendance_imports")
    .select("id, company_id")
    .eq("id", importId)
    .maybeSingle<{ id: string; company_id: string }>();

  if (!row) return { error: "الاستيراد غير موجود" };
  if (
    current.profile.role === "company_manager" &&
    row.company_id !== current.profile.company_id
  ) {
    return { error: "صلاحيات غير كافية" };
  }

  await supabase.from("attendance_monthly_records").delete().eq("import_id", importId);
  const { error } = await supabase.from("attendance_imports").delete().eq("id", importId);
  if (error) return { error: error.message };

  revalidateAttendanceData();
  revalidatePath("/portal/attendance/branches");
  return { ok: true };
}

export async function deleteMonthlyRecordAction(
  formData: FormData,
): Promise<ActionState> {
  const current = await requireAttendanceAccess();
  await requireRole(["md_admin", "company_manager"]);

  const adminCheck = await requireSuperAdmin(current.profile.is_super_admin);
  if ("error" in adminCheck) return { error: adminCheck.error };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "معرّف غير صالح" };

  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase
    .from("attendance_monthly_records")
    .select("id, company_id")
    .eq("id", id)
    .maybeSingle<{ id: string; company_id: string }>();

  if (!row) return { error: "السجل غير موجود" };
  if (
    current.profile.role === "company_manager" &&
    row.company_id !== current.profile.company_id
  ) {
    return { error: "صلاحيات غير كافية" };
  }

  const { error } = await supabase.from("attendance_monthly_records").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidateAttendanceData();
  return { ok: true };
}

export async function deleteAttendancePersonAction(
  formData: FormData,
): Promise<ActionState> {
  const current = await requireAttendanceAccess();
  await requireRole(["md_admin", "company_manager"]);

  const adminCheck = await requireSuperAdmin(current.profile.is_super_admin);
  if ("error" in adminCheck) return { error: adminCheck.error };

  const id = formData.get("id");
  const force = formData.get("force") === "true";
  if (typeof id !== "string" || !id) return { error: "معرّف غير صالح" };

  const supabase = await createSupabaseServerClient();
  const { data: person } = await supabase
    .from("attendance_people")
    .select("id, company_id")
    .eq("id", id)
    .maybeSingle<{ id: string; company_id: string }>();

  if (!person) return { error: "الشخص غير موجود" };
  const companyAccess = await assertAttendanceCompanyAccess(
    current.profile,
    person.company_id,
  );
  if ("error" in companyAccess) return { error: companyAccess.error };
  if (
    current.profile.role === "company_manager" &&
    person.company_id !== current.profile.company_id
  ) {
    return { error: "صلاحيات غير كافية" };
  }

  const { count } = await supabase
    .from("attendance_monthly_records")
    .select("id", { count: "exact", head: true })
    .eq("attendance_person_id", id);

  if ((count ?? 0) > 0 && !force) {
    return {
      error: "لا يمكن الحذف: يوجد سجلات حضور مرتبطة. احذف الاستيراد أولاً أو أكّد الحذف القسري.",
    };
  }

  if (force && (count ?? 0) > 0) {
    await supabase
      .from("attendance_monthly_records")
      .delete()
      .eq("attendance_person_id", id);
  }

  const { error } = await supabase.from("attendance_people").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/portal/attendance");
  revalidatePath("/portal/attendance/branches");
  return { ok: true };
}

export async function deleteAttendanceBranchAction(
  formData: FormData,
): Promise<ActionState> {
  const current = await requireAttendanceAccess();
  await requireRole(["md_admin", "company_manager"]);

  const adminCheck = await requireSuperAdmin(current.profile.is_super_admin);
  if ("error" in adminCheck) return { error: adminCheck.error };

  const id = formData.get("id");
  const confirm = formData.get("confirm") === "true";
  if (typeof id !== "string" || !id) return { error: "معرّف غير صالح" };

  const supabase = await createSupabaseServerClient();
  const { data: branch } = await supabase
    .from("attendance_branches")
    .select("id, company_id, name")
    .eq("id", id)
    .maybeSingle<{ id: string; company_id: string; name: string }>();

  if (!branch) return { error: "الفرع غير موجود" };
  const companyAccess = await assertAttendanceCompanyAccess(
    current.profile,
    branch.company_id,
  );
  if ("error" in companyAccess) return { error: companyAccess.error };
  if (
    current.profile.role === "company_manager" &&
    branch.company_id !== current.profile.company_id
  ) {
    return { error: "صلاحيات غير كافية" };
  }

  const [{ count: peopleCount }, { count: importCount }] = await Promise.all([
    supabase
      .from("attendance_people")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", id),
    supabase
      .from("attendance_imports")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", id),
  ]);

  const hasRelated = (peopleCount ?? 0) > 0 || (importCount ?? 0) > 0;
  if (hasRelated && !confirm) {
    return {
      error: `الفرع "${branch.name}" يحتوي على ${peopleCount ?? 0} شخص و${importCount ?? 0} استيراد. أعد المحاولة مع التأكيد.`,
    };
  }

  const { error } = await supabase.from("attendance_branches").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/portal/attendance");
  revalidatePath("/portal/attendance/branches");
  return { ok: true };
}

const shiftSchema = z.object({
  company_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  name: z.string().min(1),
  start_time: z.string().min(4),
  end_time: z.string().min(4),
  crosses_midnight: z.coerce.boolean().optional(),
  checkout_cutoff_time: z.string().optional().nullable(),
  expected_minutes: z.coerce.number().int().positive(),
  late_grace_minutes: z.coerce.number().int().min(0).optional(),
  early_leave_grace_minutes: z.coerce.number().int().min(0).optional(),
  check_in_window_start: z.string().optional().nullable(),
  check_in_window_end: z.string().optional().nullable(),
  check_out_window_start: z.string().optional().nullable(),
  check_out_window_end: z.string().optional().nullable(),
  display_order: z.coerce.number().int().optional(),
});

function parseOptionalTime(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") return null;
  return value;
}

function parseShiftForm(formData: FormData) {
  return shiftSchema.safeParse({
    company_id: formData.get("company_id"),
    branch_id: formData.get("branch_id"),
    name: formData.get("name"),
    start_time: formData.get("start_time"),
    end_time: formData.get("end_time"),
    crosses_midnight:
      formData.get("crosses_midnight") === "on" ||
      formData.get("crosses_midnight") === "true",
    checkout_cutoff_time: parseOptionalTime(formData, "checkout_cutoff_time"),
    expected_minutes: formData.get("expected_minutes"),
    late_grace_minutes: formData.get("late_grace_minutes") ?? 15,
    early_leave_grace_minutes: formData.get("early_leave_grace_minutes") ?? 15,
    check_in_window_start: parseOptionalTime(formData, "check_in_window_start"),
    check_in_window_end: parseOptionalTime(formData, "check_in_window_end"),
    check_out_window_start: parseOptionalTime(formData, "check_out_window_start"),
    check_out_window_end: parseOptionalTime(formData, "check_out_window_end"),
    display_order: formData.get("display_order") ?? 0,
  });
}

export async function createAttendanceShiftAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await requireAttendanceAccess();
  const current = await requireRole(["md_admin", "company_manager"]);

  const parsed = parseShiftForm(formData);
  if (!parsed.success) return { error: "بيانات الوردية غير صالحة" };

  const branchCheck = await assertBranchBelongsToCompany(
    parsed.data.company_id,
    parsed.data.branch_id,
  );
  if ("error" in branchCheck) return { error: branchCheck.error };

  const companyAccess = await assertAttendanceCompanyAccess(
    current.profile,
    parsed.data.company_id,
  );
  if ("error" in companyAccess) return { error: companyAccess.error };

  if (
    current.profile.role === "company_manager" &&
    parsed.data.company_id !== current.profile.company_id
  ) {
    return { error: "صلاحيات غير كافية" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("attendance_shifts").insert({
    company_id: parsed.data.company_id,
    branch_id: parsed.data.branch_id,
    name: parsed.data.name.trim(),
    start_time: parsed.data.start_time,
    end_time: parsed.data.end_time,
    crosses_midnight: parsed.data.crosses_midnight ?? false,
    checkout_cutoff_time: parsed.data.checkout_cutoff_time,
    expected_minutes: parsed.data.expected_minutes,
    late_grace_minutes: parsed.data.late_grace_minutes ?? 15,
    early_leave_grace_minutes: parsed.data.early_leave_grace_minutes ?? 15,
    check_in_window_start: parsed.data.check_in_window_start,
    check_in_window_end: parsed.data.check_in_window_end,
    check_out_window_start: parsed.data.check_out_window_start,
    check_out_window_end: parsed.data.check_out_window_end,
    display_order: parsed.data.display_order ?? 0,
  });
  if (error) return { error: error.message };

  revalidatePath("/portal/attendance/branches");
  return { ok: true };
}

const updateShiftSchema = shiftSchema.extend({
  id: z.string().uuid(),
});

export async function updateAttendanceShiftAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await requireAttendanceAccess();
  const current = await requireRole(["md_admin", "company_manager"]);

  const parsed = updateShiftSchema.safeParse({
    id: formData.get("id"),
    company_id: formData.get("company_id"),
    branch_id: formData.get("branch_id"),
    name: formData.get("name"),
    start_time: formData.get("start_time"),
    end_time: formData.get("end_time"),
    crosses_midnight:
      formData.get("crosses_midnight") === "on" ||
      formData.get("crosses_midnight") === "true",
    checkout_cutoff_time: formData.get("checkout_cutoff_time") || null,
    expected_minutes: formData.get("expected_minutes"),
    late_grace_minutes: formData.get("late_grace_minutes") ?? 15,
    early_leave_grace_minutes: formData.get("early_leave_grace_minutes") ?? 15,
    check_in_window_start: parseOptionalTime(formData, "check_in_window_start"),
    check_in_window_end: parseOptionalTime(formData, "check_in_window_end"),
    check_out_window_start: parseOptionalTime(formData, "check_out_window_start"),
    check_out_window_end: parseOptionalTime(formData, "check_out_window_end"),
    display_order: formData.get("display_order") ?? 0,
  });
  if (!parsed.success) return { error: "بيانات الوردية غير صالحة" };

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("attendance_shifts")
    .select("company_id")
    .eq("id", parsed.data.id)
    .maybeSingle<{ company_id: string }>();
  if (!existing) return { error: "الوردية غير موجودة" };
  const companyAccess = await assertAttendanceCompanyAccess(
    current.profile,
    existing.company_id,
  );
  if ("error" in companyAccess) return { error: companyAccess.error };
  if (
    current.profile.role === "company_manager" &&
    existing.company_id !== current.profile.company_id
  ) {
    return { error: "صلاحيات غير كافية" };
  }

  const { id, company_id: _companyId, branch_id: _branchId, ...updates } = parsed.data;
  const { error } = await supabase
    .from("attendance_shifts")
    .update({
      name: updates.name.trim(),
      start_time: updates.start_time,
      end_time: updates.end_time,
      crosses_midnight: updates.crosses_midnight ?? false,
      checkout_cutoff_time: updates.checkout_cutoff_time,
      expected_minutes: updates.expected_minutes,
      late_grace_minutes: updates.late_grace_minutes ?? 15,
      early_leave_grace_minutes: updates.early_leave_grace_minutes ?? 15,
      check_in_window_start: updates.check_in_window_start,
      check_in_window_end: updates.check_in_window_end,
      check_out_window_start: updates.check_out_window_start,
      check_out_window_end: updates.check_out_window_end,
      display_order: updates.display_order ?? 0,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/portal/attendance/branches");
  return { ok: true };
}

export async function toggleAttendanceShiftAction(formData: FormData) {
  await requireAttendanceAccess();
  const current = await requireRole(["md_admin", "company_manager"]);
  const id = formData.get("id");
  const active = formData.get("active") === "true";
  if (typeof id !== "string") return;

  const supabase = await createSupabaseServerClient();
  const { data: shift } = await supabase
    .from("attendance_shifts")
    .select("company_id")
    .eq("id", id)
    .single<{ company_id: string }>();
  if (!shift) return;
  const companyAccess = await assertAttendanceCompanyAccess(
    current.profile,
    shift.company_id,
  );
  if ("error" in companyAccess) return;
  if (
    current.profile.role === "company_manager" &&
    shift.company_id !== current.profile.company_id
  ) {
    return;
  }

  await supabase.from("attendance_shifts").update({ active }).eq("id", id);
  revalidatePath("/portal/attendance/branches");
}

export async function deleteAttendanceShiftAction(
  formData: FormData,
): Promise<ActionState> {
  const current = await requireAttendanceAccess();
  await requireRole(["md_admin", "company_manager"]);

  const adminCheck = await requireSuperAdmin(current.profile.is_super_admin);
  if ("error" in adminCheck) return { error: adminCheck.error };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "معرّف غير صالح" };

  const supabase = await createSupabaseServerClient();
  const { data: shift } = await supabase
    .from("attendance_shifts")
    .select("id, company_id")
    .eq("id", id)
    .maybeSingle<{ id: string; company_id: string }>();
  if (!shift) return { error: "الوردية غير موجودة" };
  const companyAccess = await assertAttendanceCompanyAccess(
    current.profile,
    shift.company_id,
  );
  if ("error" in companyAccess) return { error: companyAccess.error };
  if (
    current.profile.role === "company_manager" &&
    shift.company_id !== current.profile.company_id
  ) {
    return { error: "صلاحيات غير كافية" };
  }

  const { error } = await supabase.from("attendance_shifts").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/portal/attendance/branches");
  return { ok: true };
}

const fullTimeRuleSchema = z.object({
  branch_id: z.string().uuid(),
  threshold_hours: z.coerce.number().min(1).max(24),
  expected_hours: z.coerce.number().min(1).max(24),
});

export async function updateAttendanceBranchFullTimeRuleAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await requireAttendanceAccess();
  const current = await requireRole(["md_admin", "company_manager"]);

  const parsed = fullTimeRuleSchema.safeParse({
    branch_id: formData.get("branch_id"),
    threshold_hours: formData.get("threshold_hours"),
    expected_hours: formData.get("expected_hours"),
  });
  if (!parsed.success) return { error: "بيانات غير صالحة" };

  const supabase = await createSupabaseServerClient();
  const { data: branch } = await supabase
    .from("attendance_branches")
    .select("id, company_id")
    .eq("id", parsed.data.branch_id)
    .maybeSingle<{ id: string; company_id: string }>();
  if (!branch) return { error: "الفرع غير موجود" };
  const companyAccess = await assertAttendanceCompanyAccess(
    current.profile,
    branch.company_id,
  );
  if ("error" in companyAccess) return { error: companyAccess.error };
  if (
    current.profile.role === "company_manager" &&
    branch.company_id !== current.profile.company_id
  ) {
    return { error: "صلاحيات غير كافية" };
  }

  const { error } = await supabase
    .from("attendance_branches")
    .update({
      full_time_threshold_minutes: parsed.data.threshold_hours * 60,
      full_time_expected_minutes: parsed.data.expected_hours * 60,
    })
    .eq("id", parsed.data.branch_id);
  if (error) return { error: error.message };

  revalidatePath("/portal/attendance/branches");
  revalidatePath("/portal/attendance");
  return { ok: true };
}

/** Legacy daily actions — disabled for employees in monthly workflow. */
export async function checkInAction(): Promise<ActionState> {
  return { error: "تسجيل الحضور الذاتي غير متاح" };
}

export async function checkOutAction(): Promise<ActionState> {
  return { error: "تسجيل الانصراف الذاتي غير متاح" };
}

export async function markAttendanceAction(_formData: FormData) {
  return;
}

export async function createAttendanceAction(): Promise<ActionState> {
  return { error: "استخدم استيراد الحضور الشهري" };
}

export async function deleteAttendanceAction(_formData: FormData) {
  return;
}
