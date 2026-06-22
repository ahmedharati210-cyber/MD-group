"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface SaveAsPdfButtonProps {
  projectId: string;
}

function parseFilename(contentDisposition: string | null): string {
  if (!contentDisposition) return "project-timeline.pdf";
  const match = contentDisposition.match(/filename="([^"]+)"/);
  return match?.[1] ?? "project-timeline.pdf";
}

export function SaveAsPdfButton({ projectId }: SaveAsPdfButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleSave() {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const res = await fetch(`/api/timeline/${projectId}/pdf?format=pdf`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = parseFilename(res.headers.get("Content-Disposition"));
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("تم حفظ PDF");
    } catch {
      toast.error("فشل حفظ PDF");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={isLoading}
      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors print:hidden disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      {isLoading ? "جاري الحفظ..." : "حفظ كـ PDF"}
    </button>
  );
}
