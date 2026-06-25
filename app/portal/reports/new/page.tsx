import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tripoliTodayIso } from "@/lib/utils";
import { PageHeader } from "@/components/portal/PageHeader";
import { ReportForm } from "@/components/reports/ReportForm";

export const metadata = { title: "تقرير جديد" };

export default async function NewReportPage() {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: projects } = await supabase.from("projects").select("id, name").order("name");
  const today = tripoliTodayIso();

  return (
    <div className="max-w-xl">
      <PageHeader title="تقرير جديد" description="أضف تقرير يومي عن الأعمال المنجزة." />
      <ReportForm projects={projects ?? []} today={today} />
    </div>
  );
}
