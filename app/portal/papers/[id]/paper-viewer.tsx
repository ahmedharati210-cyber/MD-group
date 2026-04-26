"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

type Props = {
  id: string;
  mimeType: string | null;
};

export function PaperViewer({ id, mimeType }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/papers/${id}/signed-url`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "فشل جلب الرابط");
        if (!cancelled) setUrl(json.url);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "خطأ غير معروف");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-red-200 dark:border-red-900/60 p-5 sm:p-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-10 sm:p-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-gray-400 dark:text-gray-500 animate-spin" />
      </div>
    );
  }

  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType?.startsWith("image/");

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
          رابط صالح لمدة 5 دقائق فقط
        </span>
        <a
          href={url}
          download
          onClick={() => toast.success("بدء التنزيل")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 flex-shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          تنزيل
        </a>
      </div>
      {isPdf ? (
        <iframe
          src={url}
          className="w-full h-[60vh] sm:h-[70vh] bg-white"
          title="Paper preview"
        />
      ) : isImage ? (
        <div className="p-4 sm:p-6 flex items-center justify-center bg-gray-50 dark:bg-gray-800/60">
          <img
            src={url}
            alt="Paper"
            className="max-h-[60vh] sm:max-h-[70vh] w-auto rounded-lg shadow"
          />
        </div>
      ) : (
        <div className="p-8 sm:p-10 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            لا يمكن معاينة هذا النوع من الملفات.
          </p>
          <a
            href={url}
            download
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-semibold text-sm"
          >
            <Download className="w-4 h-4" />
            تنزيل الملف
          </a>
        </div>
      )}
    </div>
  );
}
