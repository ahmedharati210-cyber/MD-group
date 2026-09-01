"use client";

import { Download, CircleAlert, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";

type Props = {
  signedUrl: string | null;
  mimeType: string | null;
  error?: string | null;
};

export function PaperViewer({ signedUrl, mimeType, error }: Props) {
  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-red-200 dark:border-red-900/60 p-5 sm:p-6 flex items-start gap-3">
        <CircleAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  if (!signedUrl) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-red-200 dark:border-red-900/60 p-5 sm:p-6 flex items-start gap-3">
        <CircleAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
        <p className="text-sm text-red-700 dark:text-red-300">فشل جلب رابط المعاينة</p>
      </div>
    );
  }

  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType?.startsWith("image/");

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs">
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
          رابط صالح لمدة 5 دقائق فقط
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            فتح
          </a>
          <a
            href={signedUrl}
            download
            onClick={() => toast.success("بدء التنزيل")}
            className="inline-flex min-h-11 items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Download className="w-3.5 h-3.5" />
            تنزيل
          </a>
        </div>
      </div>
      {isPdf ? (
        <iframe
          src={signedUrl}
          className="w-full h-[60vh] sm:h-[70vh] bg-white"
          title="Paper preview"
        />
      ) : isImage ? (
        <div className="p-4 sm:p-6 flex items-center justify-center bg-gray-50 dark:bg-gray-800/60">
          <img
            src={signedUrl}
            alt="Paper"
            className="max-h-[60vh] sm:max-h-[70vh] w-auto rounded-lg shadow-xs"
          />
        </div>
      ) : (
        <div className="p-8 sm:p-10 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            لا يمكن معاينة هذا النوع من الملفات.
          </p>
          <a
            href={signedUrl}
            download
            className="inline-flex min-h-11 items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-semibold text-sm"
          >
            <Download className="w-4 h-4" />
            تنزيل الملف
          </a>
        </div>
      )}
    </div>
  );
}
