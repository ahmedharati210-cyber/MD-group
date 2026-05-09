import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  await requireRole(["md_admin", "company_manager"]);

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const companyId = searchParams.get("companyId");

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("attendance")
    .select(
      "date, status, check_in, check_out, notes, profiles(full_name), companies(name_ar)",
    )
    .order("date", { ascending: false });

  if (date) query = query.eq("date", date);
  if (companyId) query = query.eq("company_id", companyId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const header = [
    "date",
    "company",
    "employee",
    "status",
    "check_in",
    "check_out",
    "notes",
  ];
  type Row = {
    date: string;
    status: string;
    check_in: string | null;
    check_out: string | null;
    notes: string | null;
    profiles?: { full_name: string } | null;
    companies?: { name_ar: string } | null;
  };
  const rows = ((data ?? []) as unknown as Row[]).map((r) =>
    [
      r.date,
      r.companies?.name_ar ?? "",
      r.profiles?.full_name ?? "",
      r.status,
      r.check_in ?? "",
      r.check_out ?? "",
      r.notes ?? "",
    ]
      .map(csvEscape)
      .join(","),
  );

  const csv = [header.join(","), ...rows].join("\n");
  // UTF-8 BOM so Excel renders Arabic correctly.
  const body = "\uFEFF" + csv;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${date ?? "all"}.csv"`,
    },
  });
}
