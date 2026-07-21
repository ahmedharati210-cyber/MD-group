import Link from "next/link";
import { Download, FileText } from "lucide-react";

type Props = {
  pdfHref: string;
  excelHref: string;
  canExport: boolean;
  showHint?: boolean;
  className?: string;
};

export function AttendanceExportActions({
  pdfHref,
  excelHref,
  canExport,
  showHint = false,
  className = "mb-6",
}: Props) {
  if (!canExport && !showHint) return null;

  return (
    <div className={className}>
      {canExport ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            href={pdfHref}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700"
          >
            <FileText className="w-4 h-4" />
            تصدير PDF
          </Link>
          <Link
            href={excelHref}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-sm"
          >
            <Download className="w-4 h-4" />
            تصدير Excel
          </Link>
        </div>
      ) : showHint ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          قم باستيراد ملف الحضور لتفعيل التصدير.
        </p>
      ) : null}
    </div>
  );
}
