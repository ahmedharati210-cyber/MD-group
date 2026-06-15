import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireFeature, requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { formatTime } from "@/lib/utils";
import { AttendanceForm } from "./attendance-form";

export const metadata = { title: "إضافة سجل حضور" };

type SearchParams = Promise<{ date?: string; profileId?: string }>;

export default async function NewAttendancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireFeature("attendance");
  const { profile } = await requireRole(["md_admin", "company_manager"]);
  const { date, profileId } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const selectedDate = date ?? today;
  const isAdmin = profile.role === "md_admin";

  const supabase = await createSupabaseServerClient();

  let empQuery = supabase
    .from("profiles")
    .select("id, full_name, company_id")
    .eq("is_active", true)
    .in("role", ["employee", "company_manager"])
    .order("full_name");
  if (!isAdmin && profile.company_id) {
    empQuery = empQuery.eq("company_id", profile.company_id);
  }

  const [{ data: employees }, { data: companies }] = await Promise.all([
    empQuery,
    supabase.from("companies").select("id, name_ar").order("name_ar"),
  ]);

  // If an employee + date are provided, fetch an existing record so the form
  // doubles as "edit".
  let existing: {
    status: "present" | "absent" | "late" | "leave";
    check_in: string | null;
    check_out: string | null;
    notes: string | null;
  } | null = null;

  if (profileId) {
    const { data } = await supabase
      .from("attendance")
      .select("status, check_in, check_out, notes")
      .eq("profile_id", profileId)
      .eq("date", selectedDate)
      .maybeSingle<{
        status: "present" | "absent" | "late" | "leave";
        check_in: string | null;
        check_out: string | null;
        notes: string | null;
      }>();
    existing = data ?? null;
  }

  return (
    <div className="max-w-2xl">
      <Link
        href={`/portal/attendance?date=${selectedDate}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
      >
        <ArrowRight className="w-4 h-4" />
        العودة إلى الحضور
      </Link>
      <PageHeader
        title={existing ? "تعديل سجل حضور" : "إضافة سجل حضور"}
        description="أضف أو حدّث سجل حضور موظف لتاريخ محدد."
      />
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-xs">
        <AttendanceForm
          companies={companies ?? []}
          employees={employees ?? []}
          lockedCompanyId={!isAdmin ? (profile.company_id ?? null) : null}
          isAdmin={isAdmin}
          defaultDate={selectedDate}
          defaultEmployeeId={profileId ?? null}
          defaultStatus={existing?.status ?? "present"}
          defaultCheckIn={existing?.check_in ? formatTime(existing.check_in) : ""}
          defaultCheckOut={
            existing?.check_out ? formatTime(existing.check_out) : ""
          }
          defaultNotes={existing?.notes ?? ""}
        />
      </div>
    </div>
  );
}
