import { NextResponse } from "next/server";

/** Legacy CSV export — replaced by /api/attendance/export.xlsx */
export async function GET() {
  return NextResponse.json(
    { error: "تم استبدال التصدير. استخدم /api/attendance/export.xlsx" },
    { status: 410 },
  );
}
