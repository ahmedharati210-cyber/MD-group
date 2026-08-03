"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAttendanceAccess, requireRole } from "@/lib/auth";
import { diffFields, logAudit } from "@/lib/audit";
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
  normalizeWorkDaysSelection,
  personToSyntheticShift,
} from "@/lib/attendance/person-schedule";
import {
  applyManagementPasses,
  mergeManagementPassesIntoPayload,
  parseManagementPassesFromForm,
} from "@/lib/attendance/management-passes";
import { buildRecalculatedRecordPatch } from "@/lib/attendance/recalculate-person-month";
import {
  ANNUAL_LEAVE_ENTITLEMENT,
  balanceDeltaForLeaveChange,
  formatLeaveBalanceWarning,
  hasLeaveBalanceDelta,
  type LeaveBalanceDelta,
  SICK_LEAVE_ENTITLEMENT,
} from "@/lib/attendance/leave-balance";
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
  getAttendancePeople,
  getAttendancePeopleByExternalNumbers,
  getAttendanceShifts,
  getCompanyAttendanceMonthStartDay,
} from "@/lib/data/monthly-attendance";
import { resolveAttendancePeriod, resolveAttendanceLabelForDate } from "@/lib/attendance/attendance-period";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ABSENT_STATUS,
  HOLIDAY_LEAVE_TYPE,
  isLeaveType,
  LEAVE_TYPES,
} from "@/lib/attendance/leave-types";

import type { Profile } from "@/types/db";

export type ActionState = {
  error?: string;
  ok?: boolean;
  message?: string;
  warning?: string;
  updatedCount?: number;
};

export type ImportPreviewState = {
  error?: string;
  rows?: MatchedImportRow[];
  newPeople?: string[];
  newPeopleDetails?: Array<{ externalNumber: string; name: string }>;
  warnings?: string[];
  fileName?: string;
  importFormat?: "per_day" | "raw_punch_log" | "hikvision_month_grid";
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
  revalidatePath("/portal/attendance/branches");
  revalidateTag("attendance", "default");
}

type LeaveRecordSnapshot = {
  attendance_person_id: string | null;
  leave_type: string | null;
};

async function applyLeaveBalanceDeltaRaw(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  personId: string,
  delta: LeaveBalanceDelta,
): Promise<
  | { annualRemaining: number; sickRemaining: number }
  | { error: string }
> {
  const { data, error } = await supabase.rpc(
    "apply_attendance_leave_balance_delta",
    {
      p_person_id: personId,
      p_annual_delta: delta.annual,
      p_sick_delta: delta.sick,
    },
  );

  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { error: "الموظف غير موجود" };
    return {
      annualRemaining: Number(row.annual_leave_remaining),
      sickRemaining: Number(row.sick_leave_remaining),
    };
  }

  // Fallback when RPC migration is not applied yet.
  const { data: person, error: loadError } = await supabase
    .from("attendance_people")
    .select("id, annual_leave_remaining, sick_leave_remaining")
    .eq("id", personId)
    .maybeSingle<{
      id: string;
      annual_leave_remaining: number;
      sick_leave_remaining: number;
    }>();

  if (loadError) return { error: loadError.message || error.message };
  if (!person) return { error: "الموظف غير موجود" };

  const annualRemaining = person.annual_leave_remaining + delta.annual;
  const sickRemaining = person.sick_leave_remaining + delta.sick;
  const { error: updateError } = await supabase
    .from("attendance_people")
    .update({
      annual_leave_remaining: annualRemaining,
      sick_leave_remaining: sickRemaining,
    })
    .eq("id", personId);

  if (updateError) return { error: updateError.message };
  return { annualRemaining, sickRemaining };
}

async function applyPersonLeaveBalanceDelta(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  personId: string,
  previousLeaveType: string | null | undefined,
  nextLeaveType: string | null | undefined,
): Promise<{ warning?: string } | { error: string }> {
  const delta = balanceDeltaForLeaveChange(previousLeaveType, nextLeaveType);
  if (!hasLeaveBalanceDelta(delta)) return {};

  const result = await applyLeaveBalanceDeltaRaw(supabase, personId, delta);
  if ("error" in result) return { error: result.error };

  return {
    warning:
      formatLeaveBalanceWarning({
        annualRemaining: result.annualRemaining,
        sickRemaining: result.sickRemaining,
        delta,
      }) ?? undefined,
  };
}

/** Aggregate restore deltas (leave_type → null) per person, then apply atomically. */
async function restoreLeaveBalancesForDeletedRecords(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  records: LeaveRecordSnapshot[],
): Promise<{ error?: string }> {
  const byPerson = new Map<string, LeaveBalanceDelta>();

  for (const record of records) {
    if (!record.attendance_person_id || !record.leave_type) continue;
    const delta = balanceDeltaForLeaveChange(record.leave_type, null);
    if (!hasLeaveBalanceDelta(delta)) continue;
    const current = byPerson.get(record.attendance_person_id) ?? {
      annual: 0,
      sick: 0,
    };
    current.annual += delta.annual;
    current.sick += delta.sick;
    byPerson.set(record.attendance_person_id, current);
  }

  for (const [personId, delta] of byPerson) {
    const result = await applyLeaveBalanceDeltaRaw(supabase, personId, delta);
    if ("error" in result) return { error: result.error };
  }

  return {};
}

const IMPORT_RECORD_INSERT_CHUNK = 400;

async function insertAttendanceRecordsChunked(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  recordRows: Record<string, unknown>[],
): Promise<{ error?: string }> {
  for (let i = 0; i < recordRows.length; i += IMPORT_RECORD_INSERT_CHUNK) {
    const chunk = recordRows.slice(i, i + IMPORT_RECORD_INSERT_CHUNK);
    const { error } = await supabase
      .from("attendance_monthly_records")
      .insert(chunk);
    if (error) return { error: error.message };
  }
  return {};
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
        "external_employee_number, date, first_check_in, last_check_out, leave_type, is_holiday, raw_payload",
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

  // Capture leave rows before the atomic replace so balances can be restored.
  let oldLeaveRows: LeaveRecordSnapshot[] = [];
  if (existingImport?.id) {
    const { data } = await supabase
      .from("attendance_monthly_records")
      .select("attendance_person_id, leave_type")
      .eq("import_id", existingImport.id)
      .not("leave_type", "is", null);
    oldLeaveRows = data ?? [];
  }

  const recordPayload = rows.map((r) => ({
    attendance_person_id: personIdByExt.get(r.externalEmployeeNumber) ?? null,
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

  const warningSummary =
    newCount || processed.warnings.length
      ? {
          new_people_count: newCount,
          messages: processed.warnings.slice(0, 100),
        }
      : null;

  // Prefer atomic RPC; fall back to chunked client writes if RPC is unavailable.
  const { data: rpcImportId, error: rpcError } = await supabase.rpc(
    "replace_attendance_import",
    {
      p_old_import_id: existingImport?.id ?? null,
      p_company_id: scope.companyId,
      p_branch_id: branchId,
      p_month: monthDate,
      p_file_name: typeof fileName === "string" ? fileName : null,
      p_created_by: current.userId,
      p_matched_count: existingCount,
      p_unmatched_count: newCount,
      p_warning_summary: warningSummary,
      p_records: recordPayload,
    },
  );

  let savedImportId: string | null =
    typeof rpcImportId === "string" ? rpcImportId : null;

  if (rpcError) {
    // Fallback path (migration not applied yet): wipe + chunked insert.
    if (existingImport?.id) {
      await supabase
        .from("attendance_monthly_records")
        .delete()
        .eq("import_id", existingImport.id);
      await supabase
        .from("attendance_imports")
        .delete()
        .eq("id", existingImport.id);
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
        warning_summary: warningSummary,
      })
      .select("id")
      .single<{ id: string }>();

    if (importError || !importRow) {
      return {
        error:
          importError?.message ??
          rpcError.message ??
          "تعذر حفظ الاستيراد",
      };
    }

    savedImportId = importRow.id;

    const recordRows = recordPayload.map((r) => ({
      ...r,
      import_id: importRow.id,
      company_id: scope.companyId,
      branch_id: branchId,
      profile_id: null,
    }));

    if (recordRows.length > 0) {
      const insertResult = await insertAttendanceRecordsChunked(
        supabase,
        recordRows,
      );
      if (insertResult.error) {
        return {
          error: `${insertResult.error} أعد رفع الملف — تم مسح الاستيراد السابق لهذا الشهر.`,
        };
      }
    }
  } else if (!rpcImportId) {
    return { error: "تعذر حفظ الاستيراد" };
  }

  if (oldLeaveRows.length > 0) {
    const restoreResult = await restoreLeaveBalancesForDeletedRecords(
      supabase,
      oldLeaveRows,
    );
    if (restoreResult.error) {
      return {
        error: `تم حفظ الاستيراد لكن تعذر استعادة أرصدة الإجازات: ${restoreResult.error}`,
      };
    }
  }

  void logAudit(current.userId, "create", "attendance_import", savedImportId, {
    month: monthDate,
    file_name: typeof fileName === "string" ? fileName : null,
    branch_id: branchId,
  });

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

  const formPasses = parseManagementPassesFromForm(formData);

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("attendance_monthly_records")
    .select(
      "id, company_id, branch_id, attendance_person_id, first_check_in, last_check_out, is_holiday, date, raw_payload, punch_count, leave_type",
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
      leave_type: string | null;
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

    // Custom schedule wins over a stored branch shift_id unless no custom exists
    // and an explicit branch shift was selected on the form.
    if (preferredShift) {
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
      if (personRow) {
        updatedPayloadBase = {
          custom_schedule: customSchedulePayloadSnapshot(personRow),
        };
      }
    } else if (shiftId) {
      const shift = shifts.find((s) => s.id === shiftId);
      if (shift) {
        computed = computeDayRecordWithShift(session, shift);
        resolvedShiftId = shift.id;
      } else {
        const result = computeSessionRecord(session, shifts, fullTimeConfig);
        computed = result.computed;
        resolvedShiftId = result.shift?.id ?? null;
      }
    } else {
      const result = computeSessionRecord(session, shifts, fullTimeConfig);
      computed = result.computed;
      resolvedShiftId = result.shift?.id ?? null;
    }
  }

  const passes =
    isAbsentStatus || leaveType
      ? { waiveLate: false, waiveEarlyLeave: false }
      : formPasses;
  computed = applyManagementPasses(computed, passes);

  const updatedPayload: Record<string, unknown> = mergeManagementPassesIntoPayload(
    {
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
    },
    passes,
  );

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

  const recordDiff = diffFields(
    {
      first_check_in: existing.first_check_in,
      last_check_out: existing.last_check_out,
      leave_type: existing.leave_type,
      is_holiday: existing.is_holiday,
    },
    {
      first_check_in: firstCheckIn,
      last_check_out: lastCheckOut,
      leave_type: leaveType,
      is_holiday: isHoliday,
    },
    ["first_check_in", "last_check_out", "leave_type", "is_holiday"],
  );
  if (Object.keys(recordDiff).length > 0) {
    void logAudit(current.userId, "update", "attendance_record", existing.id, {
      ...recordDiff,
      date: existing.date,
    });
  }

  let warning: string | undefined;
  if (existing.attendance_person_id) {
    const balanceResult = await applyPersonLeaveBalanceDelta(
      supabase,
      existing.attendance_person_id,
      existing.leave_type,
      leaveType,
    );
    if ("error" in balanceResult) return { error: balanceResult.error };
    warning = balanceResult.warning;
  }

  revalidateAttendanceData();
  return { ok: true, warning };
}

const recalculatePersonMonthSchema = z.object({
  attendance_person_id: z.string().uuid(),
  company_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export async function recalculatePersonMonthAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await requireAttendanceAccess();
  const current = await requireRole(["md_admin", "company_manager"]);

  const parsed = recalculatePersonMonthSchema.safeParse({
    attendance_person_id: formData.get("attendance_person_id"),
    company_id: formData.get("company_id"),
    branch_id: formData.get("branch_id"),
    month: formData.get("month"),
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

  const supabase = await createSupabaseServerClient();
  const { data: personRow } = await supabase
    .from("attendance_people")
    .select("*")
    .eq("id", parsed.data.attendance_person_id)
    .eq("company_id", parsed.data.company_id)
    .eq("branch_id", parsed.data.branch_id)
    .maybeSingle<AttendancePerson>();

  if (!personRow) return { error: "الموظف غير موجود" };

  const monthStartDay = await getCompanyAttendanceMonthStartDay(
    parsed.data.company_id,
  );
  const period = resolveAttendancePeriod(parsed.data.month, monthStartDay);
  if (!period) return { error: "شهر غير صالح" };
  const monthStart = period.startDate;
  const monthEnd = period.endDate;

  const { data: records, error: loadError } = await supabase
    .from("attendance_monthly_records")
    .select(
      "id, date, first_check_in, last_check_out, punch_count, leave_type, raw_payload",
    )
    .eq("company_id", parsed.data.company_id)
    .eq("branch_id", parsed.data.branch_id)
    .eq("attendance_person_id", parsed.data.attendance_person_id)
    .gte("date", monthStart)
    .lte("date", monthEnd);

  if (loadError) return { error: loadError.message };
  if (!records?.length) {
    return { error: "لا توجد سجلات لهذا الشهر" };
  }

  const [shifts, branch] = await Promise.all([
    getAttendanceShifts(parsed.data.branch_id),
    getAttendanceBranch(parsed.data.branch_id),
  ]);
  const fullTimeConfig = fullTimeConfigFromBranch(branch);

  let updatedCount = 0;
  for (const record of records) {
    const patch = buildRecalculatedRecordPatch(
      record,
      personRow,
      shifts,
      fullTimeConfig,
    );
    if (!patch) continue;

    const { error } = await supabase
      .from("attendance_monthly_records")
      .update({
        shift_id: patch.shift_id,
        total_minutes: patch.total_minutes,
        shift_type: patch.shift_type,
        expected_minutes: patch.expected_minutes,
        late_minutes: patch.late_minutes,
        early_leave_minutes: patch.early_leave_minutes,
        overtime_minutes: patch.overtime_minutes,
        deduction_minutes: patch.deduction_minutes,
        is_absent: patch.is_absent,
        raw_payload: patch.raw_payload,
      })
      .eq("id", record.id);

    if (error) return { error: error.message };
    updatedCount += 1;
  }

  void logAudit(current.userId, "update", "attendance_recalc", null, {
    scope: "person",
    count: updatedCount,
    month: parsed.data.month,
    attendance_person_id: parsed.data.attendance_person_id,
  });

  revalidateAttendanceData();
  return {
    ok: true,
    updatedCount,
    message: `تم إعادة احتساب ${updatedCount} يومًا`,
  };
}

const recalculateBranchMonthSchema = z.object({
  company_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export async function recalculateBranchMonthAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await requireAttendanceAccess();
  const current = await requireRole(["md_admin", "company_manager"]);

  const parsed = recalculateBranchMonthSchema.safeParse({
    company_id: formData.get("company_id"),
    branch_id: formData.get("branch_id"),
    month: formData.get("month"),
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

  const monthStartDay = await getCompanyAttendanceMonthStartDay(
    parsed.data.company_id,
  );
  const period = resolveAttendancePeriod(parsed.data.month, monthStartDay);
  if (!period) return { error: "شهر غير صالح" };
  const monthStart = period.startDate;
  const monthEnd = period.endDate;

  const supabase = await createSupabaseServerClient();
  const [people, shifts, branch, recordsResult] = await Promise.all([
    getAttendancePeople(parsed.data.company_id, parsed.data.branch_id),
    getAttendanceShifts(parsed.data.branch_id),
    getAttendanceBranch(parsed.data.branch_id),
    supabase
      .from("attendance_monthly_records")
      .select(
        "id, date, first_check_in, last_check_out, punch_count, leave_type, raw_payload, attendance_person_id",
      )
      .eq("company_id", parsed.data.company_id)
      .eq("branch_id", parsed.data.branch_id)
      .gte("date", monthStart)
      .lte("date", monthEnd),
  ]);

  if (recordsResult.error) return { error: recordsResult.error.message };
  const records = recordsResult.data ?? [];
  if (!records.length) {
    return { error: "لا توجد سجلات لهذا الشهر" };
  }

  const peopleById = new Map(people.map((p) => [p.id, p]));
  const fullTimeConfig = fullTimeConfigFromBranch(branch);

  let updatedCount = 0;
  for (const record of records) {
    const personRow = record.attendance_person_id
      ? peopleById.get(record.attendance_person_id)
      : null;
    if (!personRow) continue;

    const patch = buildRecalculatedRecordPatch(
      record,
      personRow,
      shifts,
      fullTimeConfig,
    );
    if (!patch) continue;

    const { error } = await supabase
      .from("attendance_monthly_records")
      .update({
        shift_id: patch.shift_id,
        total_minutes: patch.total_minutes,
        shift_type: patch.shift_type,
        expected_minutes: patch.expected_minutes,
        late_minutes: patch.late_minutes,
        early_leave_minutes: patch.early_leave_minutes,
        overtime_minutes: patch.overtime_minutes,
        deduction_minutes: patch.deduction_minutes,
        is_absent: patch.is_absent,
        raw_payload: patch.raw_payload,
      })
      .eq("id", record.id);

    if (error) return { error: error.message };
    updatedCount += 1;
  }

  void logAudit(current.userId, "update", "attendance_recalc", null, {
    scope: "branch",
    count: updatedCount,
    month: parsed.data.month,
    branch_id: parsed.data.branch_id,
  });

  revalidateAttendanceData();
  return {
    ok: true,
    updatedCount,
    message: `تم إعادة احتساب ${updatedCount} يومًا للفرع`,
  };
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

  const monthStartDay = await getCompanyAttendanceMonthStartDay(
    parsed.data.company_id,
  );
  const labelMonth = resolveAttendanceLabelForDate(
    parsed.data.date,
    monthStartDay,
  );
  if (!labelMonth) return { error: "تاريخ غير صالح" };
  const month = `${labelMonth}-01`;
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

  const { data: createdLeave, error } = await supabase
    .from("attendance_monthly_records")
    .insert({
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
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    if (error.code === "23505") {
      return { error: "يوجد سجل لهذا الموظف في هذا اليوم بالفعل." };
    }
    return { error: error.message };
  }

  void logAudit(current.userId, "create", "attendance_record", createdLeave?.id ?? null, {
    date: parsed.data.date,
    leave_type: leaveType,
    attendance_person_id: person.id,
    employee_name: person.full_name,
  });

  let warning: string | undefined;
  if (leaveType) {
    const balanceResult = await applyPersonLeaveBalanceDelta(
      supabase,
      person.id,
      null,
      leaveType,
    );
    if ("error" in balanceResult) return { error: balanceResult.error };
    warning = balanceResult.warning;
  }

  revalidateAttendanceData();
  return { ok: true, warning };
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

const resetPersonLeaveBalanceSchema = z.object({
  attendance_person_id: z.string().uuid(),
});

export async function resetPersonLeaveBalanceAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await requireAttendanceAccess();
  const current = await requireRole(["md_admin"]);

  const parsed = resetPersonLeaveBalanceSchema.safeParse({
    attendance_person_id: formData.get("attendance_person_id"),
  });
  if (!parsed.success) return { error: "بيانات غير صالحة" };

  const supabase = await createSupabaseServerClient();
  const { data: person } = await supabase
    .from("attendance_people")
    .select(
      "id, company_id, full_name, annual_leave_remaining, sick_leave_remaining",
    )
    .eq("id", parsed.data.attendance_person_id)
    .maybeSingle<{
      id: string;
      company_id: string;
      full_name: string;
      annual_leave_remaining: number | null;
      sick_leave_remaining: number | null;
    }>();

  if (!person) return { error: "الموظف غير موجود" };

  const companyAccess = await assertAttendanceCompanyAccess(
    current.profile,
    person.company_id,
  );
  if ("error" in companyAccess) return { error: companyAccess.error };

  const { error } = await supabase
    .from("attendance_people")
    .update({
      annual_leave_remaining: ANNUAL_LEAVE_ENTITLEMENT,
      sick_leave_remaining: SICK_LEAVE_ENTITLEMENT,
      leave_balance_reset_at: new Date().toISOString(),
    })
    .eq("id", person.id);

  if (error) return { error: error.message };

  void logAudit(current.userId, "update", "attendance_person", person.id, {
    full_name: person.full_name,
    annual_leave_remaining: {
      before: person.annual_leave_remaining,
      after: ANNUAL_LEAVE_ENTITLEMENT,
    },
    sick_leave_remaining: {
      before: person.sick_leave_remaining,
      after: SICK_LEAVE_ENTITLEMENT,
    },
  });

  revalidateAttendanceData();
  return {
    ok: true,
    message: `تمت إعادة تعيين الرصيد إلى ${ANNUAL_LEAVE_ENTITLEMENT} سنوية و ${SICK_LEAVE_ENTITLEMENT} مرضية`,
  };
}

const updateCompanyMonthStartSchema = z.object({
  company_id: z.string().uuid(),
  attendance_month_start_day: z.coerce.number().int().min(1).max(31),
});

export async function updateCompanyAttendanceMonthStartAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await requireAttendanceAccess();
  const current = await requireRole(["md_admin"]);

  const parsed = updateCompanyMonthStartSchema.safeParse({
    company_id: formData.get("company_id"),
    attendance_month_start_day: formData.get("attendance_month_start_day"),
  });
  if (!parsed.success) return { error: "بيانات غير صالحة" };

  const companyAccess = await assertAttendanceCompanyAccess(
    current.profile,
    parsed.data.company_id,
  );
  if ("error" in companyAccess) return { error: companyAccess.error };

  const supabase = await createSupabaseServerClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, attendance_month_start_day")
    .eq("id", parsed.data.company_id)
    .maybeSingle<{ id: string; attendance_month_start_day: number | null }>();

  if (!company) return { error: "الشركة غير موجودة" };

  const previousDay = company.attendance_month_start_day ?? 1;
  const nextDay = parsed.data.attendance_month_start_day;
  const confirmed = formData.get("confirm_period_change") === "true";

  if (previousDay !== nextDay && !confirmed) {
    const { count } = await supabase
      .from("attendance_imports")
      .select("id", { count: "exact", head: true })
      .eq("company_id", parsed.data.company_id);

    if ((count ?? 0) > 0) {
      return {
        error: `تغيير بداية الشهر من ${previousDay} إلى ${nextDay} سيعيد تفسير ${count} استيراد موجود. أكّد المتابعة.`,
      };
    }
  }

  const { error } = await supabase
    .from("companies")
    .update({
      attendance_month_start_day: nextDay,
    })
    .eq("id", parsed.data.company_id);

  if (error) return { error: error.message };

  if (previousDay !== nextDay) {
    void logAudit(current.userId, "update", "company", parsed.data.company_id, {
      attendance_month_start_day: { before: previousDay, after: nextDay },
    });
  }

  revalidateAttendanceData();
  revalidatePath("/portal/companies");
  revalidateTag("companies", "default");
  revalidateTag(`company:${parsed.data.company_id}`, "default");
  return {
    ok: true,
    message: `تم ضبط بداية شهر الحضور على اليوم ${nextDay}`,
  };
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
    .select("id, company_id, month, file_name, branch_id")
    .eq("id", importId)
    .maybeSingle<{
      id: string;
      company_id: string;
      month: string;
      file_name: string | null;
      branch_id: string | null;
    }>();

  if (!row) return { error: "الاستيراد غير موجود" };
  if (
    current.profile.role === "company_manager" &&
    row.company_id !== current.profile.company_id
  ) {
    return { error: "صلاحيات غير كافية" };
  }

  const { data: leaveRows } = await supabase
    .from("attendance_monthly_records")
    .select("attendance_person_id, leave_type")
    .eq("import_id", importId)
    .not("leave_type", "is", null);

  await supabase.from("attendance_monthly_records").delete().eq("import_id", importId);
  const { error } = await supabase.from("attendance_imports").delete().eq("id", importId);
  if (error) return { error: error.message };

  const restoreResult = await restoreLeaveBalancesForDeletedRecords(
    supabase,
    leaveRows ?? [],
  );
  if (restoreResult.error) return { error: restoreResult.error };

  void logAudit(current.userId, "delete", "attendance_import", importId, {
    month: row.month,
    file_name: row.file_name,
    branch_id: row.branch_id,
  });

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
    .select(
      "id, company_id, attendance_person_id, leave_type, date, employee_name, external_employee_number",
    )
    .eq("id", id)
    .maybeSingle<{
      id: string;
      company_id: string;
      attendance_person_id: string | null;
      leave_type: string | null;
      date: string;
      employee_name: string | null;
      external_employee_number: string | null;
    }>();

  if (!row) return { error: "السجل غير موجود" };
  if (
    current.profile.role === "company_manager" &&
    row.company_id !== current.profile.company_id
  ) {
    return { error: "صلاحيات غير كافية" };
  }

  const { error } = await supabase.from("attendance_monthly_records").delete().eq("id", id);
  if (error) return { error: error.message };

  if (row.attendance_person_id && row.leave_type) {
    const balanceResult = await applyPersonLeaveBalanceDelta(
      supabase,
      row.attendance_person_id,
      row.leave_type,
      null,
    );
    if ("error" in balanceResult) return { error: balanceResult.error };
  }

  void logAudit(current.userId, "delete", "attendance_record", id, {
    date: row.date,
    employee_name: row.employee_name,
    external_employee_number: row.external_employee_number,
    leave_type: row.leave_type,
  });

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
    const { data: leaveRows } = await supabase
      .from("attendance_monthly_records")
      .select("attendance_person_id, leave_type")
      .eq("attendance_person_id", id)
      .not("leave_type", "is", null);

    await supabase
      .from("attendance_monthly_records")
      .delete()
      .eq("attendance_person_id", id);

    const restoreResult = await restoreLeaveBalancesForDeletedRecords(
      supabase,
      leaveRows ?? [],
    );
    if (restoreResult.error) return { error: restoreResult.error };
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

  const [
    { count: peopleCount },
    { count: importCount },
    { count: shiftCount },
    { count: recordCount },
  ] = await Promise.all([
    supabase
      .from("attendance_people")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", id),
    supabase
      .from("attendance_imports")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", id),
    supabase
      .from("attendance_shifts")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", id),
    supabase
      .from("attendance_monthly_records")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", id),
  ]);

  const hasRelated =
    (peopleCount ?? 0) > 0 ||
    (importCount ?? 0) > 0 ||
    (shiftCount ?? 0) > 0 ||
    (recordCount ?? 0) > 0;
  if (hasRelated && !confirm) {
    return {
      error: `الفرع "${branch.name}" يحتوي على ${peopleCount ?? 0} شخص و${importCount ?? 0} استيراد و${shiftCount ?? 0} وردية و${recordCount ?? 0} سجل حضور. أعد المحاولة مع التأكيد.`,
    };
  }

  // Re-check immediately before delete to shrink the TOCTOU window.
  if (confirm) {
    const [{ count: peopleNow }, { count: importsNow }] = await Promise.all([
      supabase
        .from("attendance_people")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", id),
      supabase
        .from("attendance_imports")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", id),
    ]);
    if ((peopleNow ?? 0) !== (peopleCount ?? 0) || (importsNow ?? 0) !== (importCount ?? 0)) {
      return {
        error:
          "عناصر مرتبطة تغيّرت أثناء التأكيد. أعد المحاولة لعرض العدد المحدّث قبل الحذف.",
      };
    }
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
  work_days: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  display_order: z.coerce.number().int().optional(),
});

function parseOptionalTime(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") return null;
  return value;
}

function parseShiftWorkDays(formData: FormData): number[] | null {
  return normalizeWorkDaysSelection(formData.getAll("work_days").map(String));
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
    work_days: parseShiftWorkDays(formData),
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
    work_days: parsed.data.work_days ?? null,
    display_order: parsed.data.display_order ?? 0,
  });
  if (error) return { error: error.message };

  revalidateAttendanceData();
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
    work_days: parseShiftWorkDays(formData),
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
      work_days: updates.work_days ?? null,
      display_order: updates.display_order ?? 0,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidateAttendanceData();
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
  revalidateAttendanceData();
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

  revalidateAttendanceData();
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
