"use client";

import { AlertCircle } from "lucide-react";
import { useEffect } from "react";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-red-200 dark:border-red-900/60 p-6 sm:p-8 shadow-sm max-w-md text-center">
        <div className="w-14 h-14 bg-red-50 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-2">
          حدث خطأ
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
          تعذّر تحميل هذه الصفحة. حاول مرة أخرى.
        </p>
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
