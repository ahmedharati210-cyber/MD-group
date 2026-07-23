import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAttendanceAccess } from "@/lib/auth";
import {
  assertAttendanceCompanyAccess,
  assertBranchBelongsToCompany,
} from "@/lib/attendance/scope";
import { buildAttendanceReport } from "@/lib/attendance/attendance-report";
import {
  buildMonthlyAttendanceWorkbook,
  monthExportFileName,
} from "@/lib/attendance/monthly-export";
import {
  getAttendanceImport,
  getAttendancePeople,
  getAttendanceShifts,
  getMonthlyAttendanceRecords,
} from "@/lib/data/monthly-attendance";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

export async function GET(req: NextRequest) {
  const { profile } = await requireAttendanceAccess();

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  const branchId = searchParams.get("branchId");
  const month = searchParams.get("month");

  if (!companyId || !branchId || !month) {
    return NextResponse.json(
      { error: "companyId و branchId و month مطلوبة" },
      { status: 400 },
    );
  }

  if (!monthSchema.safeParse(month).success) {
    return NextResponse.json({ error: "شهر غير صالح" }, { status: 400 });
  }

  const companyAccess = await assertAttendanceCompanyAccess(profile, companyId);
  if ("error" in companyAccess) {
    return NextResponse.json({ error: companyAccess.error }, { status: 403 });
  }

  const monthDate = `${month}-01`;

  const branchCheck = await assertBranchBelongsToCompany(companyId, branchId);
  if ("error" in branchCheck) {
    return NextResponse.json({ error: branchCheck.error }, { status: 400 });
  }

  const importRow = await getAttendanceImport(companyId, branchId, monthDate);
  if (!importRow) {
    return NextResponse.json(
      { error: "لا يوجد استيراد محفوظ لهذا الشهر" },
      { status: 404 },
    );
  }

  const [records, people, shifts, companyRes] = await Promise.all([
    getMonthlyAttendanceRecords(importRow.id),
    getAttendancePeople(companyId, branchId),
    getAttendanceShifts(branchId),
    createSupabaseServerClient()
      .then((sb) =>
        sb
          .from("companies")
          .select("name_ar, attendance_month_start_day")
          .eq("id", companyId)
          .single(),
      ),
  ]);

  const branch = branchCheck;

  const companyData = companyRes.data as {
    name_ar: string;
    attendance_month_start_day: number | null;
  } | null;
  const companyName = companyData?.name_ar ?? "الشركة";
  const monthStartDay = companyData?.attendance_month_start_day ?? 1;

  const report = buildAttendanceReport({
    companyName,
    branch,
    month: monthDate,
    records,
    people,
    shifts,
    monthStartDay,
  });

  const buffer = await buildMonthlyAttendanceWorkbook(report);

  const fileName = monthExportFileName(companyName, branch.name, monthDate);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
