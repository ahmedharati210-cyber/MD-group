import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 md:p-10 shadow-sm max-w-md text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <FileQuestion className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">
          الصفحة غير موجودة
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          تأكّد من الرابط أو ارجع إلى الرئيسية.
        </p>
        <Link
          href="/portal"
          className="inline-flex items-center px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700"
        >
          العودة إلى البوابة
        </Link>
      </div>
    </div>
  );
}
