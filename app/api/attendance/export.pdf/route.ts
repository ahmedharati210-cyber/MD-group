import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireFeature } from "@/lib/auth";
import {
  attendanceReportFileName,
  buildAttendanceReportHtml,
} from "@/lib/attendance/attendance-pdf";
import { assertAttendanceCompanyAccess, assertBranchBelongsToCompany } from "@/lib/attendance/scope";
import {
  getAttendanceImport,
  getAttendancePeople,
  getMonthlyAttendanceRecords,
} from "@/lib/data/monthly-attendance";
import { contentDispositionHeader, renderPdfFromHtml } from "@/lib/pdf/render-html-to-pdf";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

export async function GET(req: NextRequest) {
  const { profile } = await requireFeature("attendance", ["md_admin", "company_manager"]);

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

  const [records, people, companyRes] = await Promise.all([
    getMonthlyAttendanceRecords(importRow.id),
    getAttendancePeople(companyId, branchId),
    createSupabaseServerClient()
      .then((sb) =>
        sb.from("companies").select("name_ar").eq("id", companyId).single(),
      ),
  ]);

  const branch = branchCheck;
  const companyName =
    (companyRes.data as { name_ar: string } | null)?.name_ar ?? "الشركة";

  const html = buildAttendanceReportHtml({
    companyName,
    branch,
    month: monthDate,
    records,
    people,
  });

  const pdfBytes = await renderPdfFromHtml(html);
  const fileName = attendanceReportFileName(companyName, branch.name, monthDate);

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDispositionHeader(fileName, "pdf"),
    },
  });
}
