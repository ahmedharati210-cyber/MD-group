"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { formatMonthLabel } from "@/lib/attendance/import-month";
import {
  previewAttendanceImportAction,
  saveAttendanceImportAction,
  type ActionState,
  type ImportPreviewState,
} from "./actions";

const EXCEL_ACCEPT =
  ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

type Props = {
  companyId: string;
  branchId: string;
  month: string;
};

function isExcelAttendanceFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".xls") || name.endsWith(".xlsx");
}

function assignFileToInput(input: HTMLInputElement | null, file: File | null) {
  if (!input) return;
  const transfer = new DataTransfer();
  if (file) transfer.items.add(file);
  input.files = transfer.files;
}

function importFormatLabel(format: ImportPreviewState["importFormat"]): string {
  if (format === "raw_punch_log") return "سجل بصمات خام";
  if (format === "hikvision_month_grid") return "Hikvision Attendance Record";
  if (format === "per_day") return "ملف يومي";
  return "";
}

export function AttendanceImportForm({
  companyId,
  branchId,
  month,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, previewAction, previewPending] = useActionState<
    ImportPreviewState | undefined,
    FormData
  >(previewAttendanceImportAction, undefined);
  const [saveState, saveAction, savePending] = useActionState<
    ActionState | undefined,
    FormData
  >(saveAttendanceImportAction, undefined);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const previewForFile =
    preview && fileName && preview.fileName === fileName ? preview : undefined;
  const hasMonthMismatch = Boolean(previewForFile?.monthMismatch);
  const hasSaveablePreview =
    Boolean(previewForFile) &&
    ((previewForFile?.rows?.length ?? 0) > 0 ||
      (previewForFile?.newPeople?.length ?? 0) > 0);
  const canPreview = Boolean(selectedFile) && !previewPending;
  const canSave =
    Boolean(selectedFile) &&
    hasSaveablePreview &&
    !savePending &&
    (!hasMonthMismatch || confirmMismatch);

  useEffect(() => {
    setConfirmMismatch(false);
  }, [previewForFile?.monthMismatch?.detectedMonth, previewForFile?.monthMismatch?.selectedMonth]);

  useEffect(() => {
    if (!saveState?.ok) return;
    setSelectedFile(null);
    setFileName(null);
    setConfirmMismatch(false);
    assignFileToInput(fileInputRef.current, null);
  }, [saveState]);

  function setChosenFile(file: File | null) {
    if (file && !isExcelAttendanceFile(file)) {
      setFileError("اختر ملف Excel بصيغة .xls أو .xlsx");
      return;
    }
    setFileError(null);
    setSelectedFile(file);
    setFileName(file?.name ?? null);
    setConfirmMismatch(false);
    assignFileToInput(fileInputRef.current, file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setChosenFile(e.target.files?.[0] ?? null);
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    setChosenFile(e.dataTransfer.files?.[0] ?? null);
  }

  function switchToDetectedMonthHref() {
    if (!previewForFile?.monthMismatch) return "#";
    const params = new URLSearchParams();
    params.set("companyId", companyId);
    params.set("branchId", branchId);
    params.set("month", previewForFile.monthMismatch.detectedMonth);
    return `/portal/attendance?${params.toString()}`;
  }

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFile || !canSave) return;
    const fd = new FormData();
    fd.set("company_id", companyId);
    fd.set("branch_id", branchId);
    fd.set("month", month);
    fd.set("file_name", fileName ?? previewForFile?.fileName ?? "");
    fd.set("file", selectedFile);
    if (hasMonthMismatch && confirmMismatch) {
      fd.set("confirm_month_mismatch", "true");
    }
    startTransition(() => {
      saveAction(fd);
    });
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-sm font-semibold"
      >
        <span className="inline-flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-primary-600" />
          استيراد ملف البصمة
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded ? (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100 dark:border-gray-800 pt-4">
          <form action={previewAction} className="space-y-3">
              <input type="hidden" name="company_id" value={companyId} />
              <input type="hidden" name="branch_id" value={branchId} />
              <input type="hidden" name="month" value={month} />
              <input
                ref={fileInputRef}
                id="attendance-import-file"
                type="file"
                name="file"
                accept={EXCEL_ACCEPT}
                required
                onChange={onFileChange}
                className="sr-only"
              />

              <label
                htmlFor="attendance-import-file"
                onDragEnter={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={onDrop}
                className={`flex min-h-[9.5rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                  isDragging
                    ? "border-primary-400 bg-primary-50 dark:border-primary-500 dark:bg-primary-950/40"
                    : selectedFile
                      ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30"
                      : "border-gray-200 bg-gray-50 hover:border-primary-300 hover:bg-primary-50/50 dark:border-gray-700 dark:bg-gray-800/40 dark:hover:border-primary-700"
                }`}
              >
                {selectedFile ? (
                  <>
                    <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                    <p className="max-w-full min-w-0 break-all px-2 text-sm font-semibold text-gray-900 dark:text-gray-50" dir="ltr">
                      {fileName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      جاهز للمعاينة — استيراد {formatMonthLabel(month)}
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-primary-600" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      اسحب ملف Excel هنا أو اضغط للاختيار
                    </p>
                    <p className="max-w-sm text-xs text-gray-500 dark:text-gray-400">
                      Attendance Record من Hikvision، أو سجل البصمات، أو التقرير اليومي
                      (.xls / .xlsx) — لشهر {formatMonthLabel(month)}
                    </p>
                  </>
                )}
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={!canPreview}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900"
                >
                  {previewPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  معاينة
                </button>
                {selectedFile ? (
                  <button
                    type="button"
                    onClick={() => setChosenFile(null)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <X className="w-4 h-4" />
                    إزالة الملف
                  </button>
                ) : (
                  <label
                    htmlFor="attendance-import-file"
                    className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    اختيار ملف
                  </label>
                )}
              </div>
            </form>

          {fileError ? (
            <p className="text-sm text-red-600">{fileError}</p>
          ) : null}
          {previewForFile?.error ? (
            <p className="text-sm text-red-600">{previewForFile.error}</p>
          ) : null}
          {saveState?.error ? (
            <p className="text-sm text-red-600">{saveState.error}</p>
          ) : null}
          {saveState?.ok ? (
            <p className="text-sm text-emerald-600">تم حفظ الاستيراد بنجاح</p>
          ) : null}

          {previewForFile?.monthMismatch ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4 text-sm space-y-3">
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                {previewForFile.monthMismatch.message}
              </p>
              <Link
                href={switchToDetectedMonthHref()}
                className="inline-flex px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold"
              >
                التبديل إلى {formatMonthLabel(previewForFile.monthMismatch.detectedMonth)}
              </Link>
              <label className="flex items-start gap-2 text-amber-900 dark:text-amber-100">
                <input
                  type="checkbox"
                  checked={confirmMismatch}
                  onChange={(e) => setConfirmMismatch(e.target.checked)}
                  className="mt-0.5"
                />
                <span>أؤكد المتابعة مع هذا الشهر رغم الاختلاف</span>
              </label>
            </div>
          ) : null}

          {previewForFile?.reimportDiff ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4 text-sm space-y-2">
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                مقارنة مع الاستيراد الحالي (سيتم استبداله)
              </p>
              <ul className="grid gap-1 sm:grid-cols-2 text-amber-900 dark:text-amber-100">
                <li>السجلات الحالية: {previewForFile.reimportDiff.existingRecordCount}</li>
                <li>سجلات الملف الجديد: {previewForFile.reimportDiff.newRecordCount}</li>
                <li>أيام جديدة: {previewForFile.reimportDiff.newDays}</li>
                <li>أيام ستُحذف: {previewForFile.reimportDiff.removedDays}</li>
                <li>تغيّر في البصمات: {previewForFile.reimportDiff.changedPunches}</li>
                <li>بدون تغيير: {previewForFile.reimportDiff.unchanged}</li>
              </ul>
              {previewForFile.reimportDiff.manuallyEditedAtRisk > 0 ? (
                <p className="text-amber-800 dark:text-amber-200 font-medium">
                  تحذير: {previewForFile.reimportDiff.manuallyEditedAtRisk} سجل معدّل يدوياً
                  قد يتغيّر بعد إعادة الاستيراد.
                </p>
              ) : null}
            </div>
          ) : null}

          {previewForFile?.warnings && previewForFile.warnings.length > 0 ? (
            <ul className="text-sm text-amber-700 dark:text-amber-300 list-disc pr-5">
              {previewForFile.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          {previewForFile?.newPeople && previewForFile.newPeople.length > 0 ? (
            <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 p-3 text-sm">
              <p className="font-semibold mb-1">أشخاص جدد سيُضافون لقائمة الحضور:</p>
              <ul className="list-disc pr-5">
                {previewForFile.newPeople.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {hasSaveablePreview ? (
            <div className="space-y-3">
              <p className="min-w-0 break-all text-sm text-gray-600 dark:text-gray-400">
                {previewForFile?.rows && previewForFile.rows.length > 0
                  ? `${previewForFile.rows.length} سجل يومي`
                  : "بدون سجلات يومية — سيُضاف الأشخاص الجدد للقائمة"}
                {importFormatLabel(previewForFile?.importFormat)
                  ? ` (${importFormatLabel(previewForFile?.importFormat)})`
                  : ""}
                {" — "}
                {fileName ?? previewForFile?.fileName ?? ""}
              </p>
              <form onSubmit={onSave}>
                <button
                  type="submit"
                  disabled={!canSave}
                  className="px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {savePending ? "جاري الحفظ..." : "حفظ الاستيراد (إعادة تحليل الملف)"}
                </button>
              </form>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
