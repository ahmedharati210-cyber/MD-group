import { notFound } from "next/navigation";
import Link from "next/link";
import { FileBarChart2, CalendarDays, MapPin, User, Users, Package, StickyNote, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DeleteReportButton } from "@/components/reports/DeleteReportButton";
import type { ReportType } from "@/types/db";

const typeLabels: Record<ReportType, { label: string; cls: string }> = {
  daily: { label: "يومي", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  weekly: { label: "أسبوعي", cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
};

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: raw } = await supabase
    .from("engineer_reports")
    .select("*, author:author_id(full_name, job_title), project:project_id(name)")
    .eq("id", id)
    .single();

  if (!raw) notFound();

  const r = raw as typeof raw & {
    author: { full_name: string; job_title: string | null } | null;
    project: { name: string } | null;
  };

  const { label, cls } = typeLabels[r.report_type as ReportType];
  const canDelete = profile.role !== "employee" || r.author_id === profile.id;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/portal/reports" className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400">
          <ArrowRight className="w-4 h-4" /> التقارير
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
                <FileBarChart2 className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full ${cls}`}>{label}</span>
                  <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                    <CalendarDays className="w-4 h-4" /> {r.report_date}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 mt-1">
                  {r.project ? (
                    <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                      <MapPin className="w-4 h-4" /> {r.project.name}
                    </span>
                  ) : null}
                  {r.author ? (
                    <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                      <User className="w-4 h-4" /> {r.author.full_name}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            {canDelete ? <DeleteReportButton reportId={id} /> : null}
          </div>
        </div>

        <div className="p-6 space-y-5">
          {r.work_done ? (
            <Section icon={<FileBarChart2 className="w-4 h-4" />} title="الأعمال المنجزة" content={r.work_done} />
          ) : null}
          {r.materials_used ? (
            <Section icon={<Package className="w-4 h-4" />} title="المواد المستخدمة" content={r.materials_used} />
          ) : null}
          {r.workers_count != null ? (
            <Section icon={<Users className="w-4 h-4" />} title="عدد العمال" content={String(r.workers_count)} />
          ) : null}
          {r.notes ? (
            <Section icon={<StickyNote className="w-4 h-4" />} title="ملاحظات" content={r.notes} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, content }: { icon: React.ReactNode; title: string; content: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400">
        {icon}
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</span>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{content}</p>
    </div>
  );
}
