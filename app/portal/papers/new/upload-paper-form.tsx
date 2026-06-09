"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Upload, CircleCheck } from "lucide-react";
import {
  PAPER_STAT_CATEGORIES,
  paperCategoryLabel,
} from "@/lib/paper-categories";

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

type UploadStep = "idle" | "preparing" | "uploading" | "saving" | "done";

export function UploadPaperForm({
  companies,
  employees,
  currentCompanyId,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<UploadStep>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedCompany, setSelectedCompany] = useState<string>(
    isAdmin ? "" : (currentCompanyId ?? ""),
  );

  const submitting = step !== "idle" && step !== "done";

  const filteredEmployees = useMemo(
    () => employees.filter((e) => e.company_id === selectedCompany),
    [employees, selectedCompany],
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");

    if (!(file instanceof File) || file.size === 0) {
      toast.error("يجب اختيار ملف");
      return;
    }

    const toastId = toast.loading("جارٍ التحضير...");
    setStep("preparing");
    setUploadProgress(0);

    try {
      // Step 1: get a signed upload URL from our server (tiny JSON, no file).
      const prepareRes = await fetch("/api/papers/prepare-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: data.get("company_id"),
          title: data.get("title"),
          file_name: file.name,
          mime_type: file.type || "application/octet-stream",
          file_size: file.size,
        }),
      });
      const prepareJson = await prepareRes.json();
      if (!prepareRes.ok) {
        toast.error(prepareJson?.error ?? "فشل التحضير", { id: toastId });
        setStep("idle");
        return;
      }

      const { signedUrl, storagePath } = prepareJson as {
        signedUrl: string;
        storagePath: string;
      };

      // Step 2: upload the file directly to Supabase Storage with XHR for progress.
      setStep("uploading");
      toast.loading("جارٍ رفع الملف...", { id: toastId });

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signedUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`رمز الاستجابة: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("فشل الاتصال بالخادم"));
        xhr.send(file);
      });

      // Step 3: save metadata row (tiny JSON, no file).
      setStep("saving");
      toast.loading("جارٍ الحفظ...", { id: toastId });

      const finalizeRes = await fetch("/api/papers/finalize-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storage_path: storagePath,
          company_id: data.get("company_id"),
          title: data.get("title"),
          category: data.get("category") ?? "other",
          owner_profile_id: data.get("owner_profile_id") || null,
          issued_on: data.get("issued_on") || null,
          expires_on: data.get("expires_on") || null,
          mime_type: file.type || null,
          file_size: file.size,
        }),
      });
      const finalizeJson = await finalizeRes.json();
      if (!finalizeRes.ok) {
        toast.error(finalizeJson?.error ?? "فشل الحفظ", { id: toastId });
        setStep("idle");
        return;
      }

      setStep("done");
      toast.success("تم الرفع بنجاح", { id: toastId });
      router.push(`/portal/papers/${finalizeJson.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ غير معروف", {
        id: toastId,
      });
      setStep("idle");
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
            {PAPER_STAT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {paperCategoryLabel[cat]}
              </option>
            ))}
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

        <div>
          <label className={labelClasses}>تاريخ الإصدار (اختياري)</label>
          <input name="issued_on" type="date" className={inputClasses} />
        </div>
        <div>
          <label className={labelClasses}>تاريخ انتهاء الصلاحية (اختياري)</label>
          <input name="expires_on" type="date" className={inputClasses} />
        </div>
        <p className="sm:col-span-2 text-xs text-gray-500 dark:text-gray-400 -mt-2">
          عند تحديد انتهاء الصلاحية، يُرسل تنبيه تلقائي لمديري المجموعة ومديري الشركة خلال
          الشهر الأخير قبل تاريخ الانتهاء.
        </p>

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

      {step === "uploading" && (
        <div className="w-full space-y-1">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>جارٍ رفع الملف مباشرةً...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold shadow-md hover:bg-primary-700 disabled:opacity-60"
      >
        {step === "preparing" && (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            جارٍ التحضير...
          </>
        )}
        {step === "uploading" && (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            جارٍ الرفع ({uploadProgress}%)...
          </>
        )}
        {step === "saving" && (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            جارٍ الحفظ...
          </>
        )}
        {step === "done" && (
          <>
            <CircleCheck className="w-4 h-4" />
            تم الرفع
          </>
        )}
        {step === "idle" && (
          <>
            <Upload className="w-4 h-4" />
            رفع الورقة
          </>
        )}
      </button>
    </form>
  );
}
