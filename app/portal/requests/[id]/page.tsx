import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ClipboardEdit, CalendarDays, User } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RespondForm } from "@/components/requests/RespondForm";
import { DeleteRequestButton } from "@/components/requests/DeleteRequestButton";
import type { RequestType, RequestStatus } from "@/types/db";

const typeLabels: Record<RequestType, string> = {
  vacation: "إجازة",
  day_off: "يوم راحة",
  advance: "سلفة مالية",
  equipment: "معدات / أدوات",
  other: "أخرى",
};

const statusMap: Record<RequestStatus, { label: string; cls: string }> = {
  pending: { label: "قيد الانتظار", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  approved: { label: "موافق عليه", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  rejected: { label: "مرفوض", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: raw } = await supabase
    .from("engineer_requests")
    .select("*, requester:requester_id(full_name, job_title), responder:responded_by(full_name)")
    .eq("id", id)
    .single();

  if (!raw) notFound();

  const r = raw as typeof raw & {
    requester: { full_name: string; job_title: string | null } | null;
    responder: { full_name: string } | null;
  };

  const { label: sLabel, cls: sCls } = statusMap[r.status as RequestStatus];
  const isManager = profile.role !== "employee";
  const canRespond = isManager && r.status === "pending";

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/portal/requests" className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400">
          <ArrowRight className="w-4 h-4" /> الطلبات
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <ClipboardEdit className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-gray-900 dark:text-gray-50">{typeLabels[r.request_type as RequestType]}</h1>
                <span className={`text-sm font-semibold px-3 py-1 rounded-full ${sCls}`}>{sLabel}</span>
              </div>
              <div className="flex flex-wrap gap-3 mt-1">
                {r.requester ? <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"><User className="w-4 h-4" />{r.requester.full_name}</span> : null}
                {r.requested_date ? <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"><CalendarDays className="w-4 h-4" />{r.requested_date}</span> : null}
              </div>
            </div>
          </div>
          {isManager ? <DeleteRequestButton requestId={id} /> : null}
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">وصف الطلب</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{r.description}</p>
          </div>

          {r.status !== "pending" && r.manager_response ? (
            <div className={`p-4 rounded-xl border ${r.status === "approved" ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"}`}>
              <p className="text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">رد المدير</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{r.manager_response}</p>
              {r.responder ? <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">— {r.responder.full_name}</p> : null}
            </div>
          ) : null}

          {canRespond ? <RespondForm requestId={id} /> : null}
        </div>
      </div>
    </div>
  );
}
