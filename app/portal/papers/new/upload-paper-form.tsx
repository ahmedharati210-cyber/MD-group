"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Upload } from "lucide-react";

type Company = { id: string; name_ar: string };
type Employee = { id: string; full_name: string; company_id: string | null };

type Props = {
  companies: Company[];
  employees: Employee[];
  currentCompanyId: string | null;
  isAdmin: boolean;
};

const inputClasses =
  "w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none";

const labelClasses =
  "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5";

export function UploadPaperForm({
  companies,
  employees,
  currentCompanyId,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string>(
    isAdmin ? "" : (currentCompanyId ?? ""),
  );

  const filteredEmployees = useMemo(
    () => employees.filter((e) => e.company_id === selectedCompany),
    [employees, selectedCompany],
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (!(data.get("file") instanceof File)) {
      toast.error("يجب اختيار ملف");
      return;
    }
    setSubmitting(true);
    const toastId = toast.loading("جارٍ الرفع...");
    try {
      const res = await fetch("/api/papers/upload", {
        method: "POST",
        body: data,
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error ?? "فشل الرفع", { id: toastId });
        return;
      }
      toast.success("تم الرفع بنجاح", { id: toastId });
      router.push(`/portal/papers/${json.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ غير معروف", {
        id: toastId,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClasses}>عنوان الورقة</label>
          <input
            name="title"
            required
            className={inputClasses}
            placeholder="مثال: عقد توريد مواد بناء"
          />
        </div>

        <div>
          <label className={labelClasses}>الشركة</label>
          <select
            name="company_id"
            required
            disabled={!isAdmin}
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className={`${inputClasses} disabled:bg-gray-50 dark:disabled:bg-gray-900`}
          >
            <option value="">اختر الشركة</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClasses}>النوع</label>
          <select
            name="category"
            defaultValue="other"
            className={inputClasses}
          >
            <option value="letter">مراسلة</option>
            <option value="contract">عقد</option>
            <option value="memo">مذكرة</option>
            <option value="personal">شخصي</option>
            <option value="other">أخرى</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClasses}>موظف مرتبط (اختياري)</label>
          <select
            name="owner_profile_id"
            defaultValue=""
            className={inputClasses}
          >
            <option value="">— لا يوجد —</option>
            {filteredEmployees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            يظهر الملف في ملف الموظف الشخصي، ويستطيع الموظف الاطلاع عليه.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClasses}>
            الملف (PDF أو صورة، حتى 25MB)
          </label>
          <input
            type="file"
            name="file"
            required
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
            className="block w-full text-sm text-gray-700 dark:text-gray-300 file:me-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary-50 dark:file:bg-primary-900/40 file:text-primary-700 dark:file:text-primary-300 hover:file:bg-primary-100 dark:hover:file:bg-primary-900/60"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold shadow-md hover:bg-primary-700 disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            جارٍ الرفع...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            رفع الورقة
          </>
        )}
      </button>
    </form>
  );
}
