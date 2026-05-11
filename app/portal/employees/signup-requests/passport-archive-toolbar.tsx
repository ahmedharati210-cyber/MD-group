"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Archive, Loader2, Trash2 } from "lucide-react";

export function PassportArchiveToolbar() {
  const [zipPending, setZipPending] = useState(false);
  const [purgePending, setPurgePending] = useState(false);

  async function downloadZip() {
    setZipPending(true);
    try {
      const res = await fetch("/api/portal/employee-signup/passports/zip", {
        method: "GET",
        credentials: "same-origin",
      });
      if (res.status === 404) {
        const j = (await res.json()) as { error?: string };
        toast.error(j.error ?? "لا توجد صور للتحميل.");
        return;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error ?? "فشل التحميل.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dolce-passports-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تنزيل ملف ZIP. احفظه ثم يمكنك حذف النسخ من السحابة.");
    } catch {
      toast.error("تعذّر تنزيل الملف.");
    } finally {
      setZipPending(false);
    }
  }

  async function purgeStorage() {
    if (
      !window.confirm(
        "سيتم حذف جميع صور الجواز من التخزين السحابي بعد التأكيد. تأكد أنك نزّلت الأرشيف ZIP أولاً. المتابعة؟",
      )
    ) {
      return;
    }
    setPurgePending(true);
    try {
      const res = await fetch("/api/portal/employee-signup/passports/purge", {
        method: "POST",
        credentials: "same-origin",
      });
      const j = (await res.json()) as {
        ok?: boolean;
        deleted?: number;
        error?: string;
      };
      if (!res.ok || !j.ok) {
        toast.error(j.error ?? "فشل الحذف.");
        return;
      }
      toast.success(
        j.deleted
          ? `تم حذف ${j.deleted} ملفاً من التخزين وتحديث السجلات.`
          : "لا توجد ملفات للحذف.",
      );
      window.location.reload();
    } catch {
      toast.error("تعذّر تنفيذ الحذف.");
    } finally {
      setPurgePending(false);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <p className="text-sm text-gray-700 dark:text-gray-300">
        صور الجواز تُخزَّن مؤقتاً في السحابة. نزّل أرشيف ZIP واحفظه محلياً، ثم احذف
        النسخ من التخزين لتوفير المساحة.
      </p>
      <div className="flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          onClick={() => void downloadZip()}
          disabled={zipPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60"
        >
          {zipPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Archive className="w-4 h-4" />
          )}
          تحميل كل الصور (ZIP)
        </button>
        <button
          type="button"
          onClick={() => void purgeStorage()}
          disabled={purgePending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-60"
        >
          {purgePending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          حذف الصور من السحابة
        </button>
      </div>
    </div>
  );
}
