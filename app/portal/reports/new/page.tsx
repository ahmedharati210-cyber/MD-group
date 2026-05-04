import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { ReportForm } from "@/components/reports/ReportForm";

export const metadata = { title: "تقرير جديد" };

export default async function NewReportPage() {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: projects } = await supabase.from("projects").select("id, name").order("name");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-xl">
      <PageHeader title="تقرير جديد" description="أضف تقريراً يومياً أو أسبوعياً." />
      <ReportForm projects={projects ?? []} today={today} />
    </div>
  );
}
