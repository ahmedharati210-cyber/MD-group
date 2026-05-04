"use client";

import { Download } from "lucide-react";

interface SaveAsPdfButtonProps {
  projectId: string;
}

export function SaveAsPdfButton({ projectId }: SaveAsPdfButtonProps) {
  function handleSave() {
    // Opens the server-rendered HTML doc with auto-print enabled.
    // The browser's native PDF engine handles Arabic RTL perfectly.
    window.open(
      `/api/timeline/${projectId}/pdf?autoprint=1`,
      "_blank",
      "width=960,height=720,menubar=yes,toolbar=no",
    );
  }

  return (
    <button
      onClick={handleSave}
      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors print:hidden"
    >
      <Download className="w-4 h-4" />
      حفظ كـ PDF
    </button>
  );
}
