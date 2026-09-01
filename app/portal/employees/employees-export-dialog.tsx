"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";

type Company = { id: string; name_ar: string };

type Props = {
  companies: Company[];
  /** Company managers are always scoped server-side to their own company, so the
   * company selector is hidden for them — only the status filter is shown. */
  canPickCompany: boolean;
  defaultCompanyId?: string;
};

function fileNameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      // fall through to the plain filename match below
    }
  }
  const plainMatch = /filename="?([^";]+)"?/i.exec(header);
  return plainMatch?.[1] ?? null;
}

export function EmployeesExportDialog({
  companies,
  canPickCompany,
  defaultCompanyId = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !isDownloading) setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isDownloading) return;

    const params = new URLSearchParams();
    const formData = new FormData(e.currentTarget);
    const companyId = formData.get("companyId");
    const status = formData.get("status");
    if (typeof companyId === "string" && companyId) {
      params.set("companyId", companyId);
    }
    if (typeof status === "string" && status) {
      params.set("status", status);
    }
    const query = params.toString();
    const url = `/api/employees/export.xlsx${query ? `?${query}` : ""}`;

    setIsDownloading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        let message = "تعذّر تصدير الملف.";
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) message = body.error;
        } catch {
          // response wasn't JSON — keep the generic message
        }
        toast.error(message);
        return;
      }

      const blob = await res.blob();
      const fileName =
        fileNameFromContentDisposition(res.headers.get("Content-Disposition")) ??
        "دليل_الموظفين.xlsx";

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);

      setOpen(false);
    } catch {
      toast.error("تعذّر الاتصال بالخادم لتصدير الملف.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-sm hover:bg-gray-800 dark:hover:bg-white transition-colors w-full sm:w-auto justify-center"
      >
        <Download className="w-4 h-4" />
        تصدير Excel
      </button>

      {open ? (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-4"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-label="خيارات تصدير الموظفين"
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-800 overflow-hidden"
            dir="rtl"
          >
            <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-gray-50 text-base">
                تصدير بيانات الموظفين
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isDownloading}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
              {canPickCompany ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    الشركة
                  </label>
                  <select
                    name="companyId"
                    defaultValue={defaultCompanyId}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-hidden"
                  >
                    <option value="">كل الشركات</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name_ar}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  حالة الموظف
                </label>
                <select
                  name="status"
                  defaultValue=""
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-hidden"
                >
                  <option value="">الجميع (نشط وغير نشط)</option>
                  <option value="active">النشطون فقط</option>
                  <option value="inactive">غير النشطين فقط</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isDownloading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isDownloading ? "جارٍ التصدير..." : "تنزيل الملف"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
