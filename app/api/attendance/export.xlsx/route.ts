import { NextResponse, type NextRequest } from "next/server";
import { requireFeature } from "@/lib/auth";
import { assertBranchBelongsToCompany } from "@/lib/attendance/scope";
import {
  buildMonthlyAttendanceWorkbook,
  monthExportFileName,
} from "@/lib/attendance/monthly-export";
import {
  getAttendanceImport,
  getMonthlyAttendanceRecords,
} from "@/lib/data/monthly-attendance";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  await requireFeature("attendance", ["md_admin", "company_manager"]);

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

  const [records, companyRes] = await Promise.all([
    getMonthlyAttendanceRecords(importRow.id),
    createSupabaseServerClient()
      .then((sb) =>
        sb.from("companies").select("name_ar").eq("id", companyId).single(),
      ),
  ]);

  const branch = branchCheck;

  const companyName =
    (companyRes.data as { name_ar: string } | null)?.name_ar ?? "الشركة";

  const buffer = await buildMonthlyAttendanceWorkbook({
    companyName,
    branch,
    month: monthDate,
    records,
  });

  const fileName = monthExportFileName(companyName, branch.name, monthDate);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
