"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  deleteQaScreenshotAction,
  finalizeQaScreenshotUploadAction,
  getQaScreenshotSignedUrlAction,
  prepareQaScreenshotUploadAction,
  type QaAttachmentRow,
} from "@/app/portal/testing/screenshot-actions";
import {
  QA_SCREENSHOT_MAX_COUNT,
  QA_SCREENSHOT_MAX_BYTES,
  QA_SCREENSHOT_MIME,
  type QaAttachmentScope,
} from "@/lib/qa-screenshots";
import { cn } from "@/lib/utils";

export type QaScreenshotMeta = Pick<
  QaAttachmentRow,
  "id" | "scope" | "mime_type" | "byte_size" | "sort_order" | "attempt_id"
>;

export function QaScreenshotGallery({
  itemId,
  projectId,
  scope,
  attachments: initial,
  canEdit,
  compact = false,
}: {
  itemId: string;
  projectId: string;
  scope: QaAttachmentScope;
  attachments: QaScreenshotMeta[];
  canEdit: boolean;
  compact?: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  useEffect(() => {
    let cancelled = false;
    const missing = items.filter((a) => !urls[a.id]);
    if (missing.length === 0) return;

    void Promise.all(
      missing.map(async (a) => {
        const res = await getQaScreenshotSignedUrlAction(a.id);
        return [a.id, res.url] as const;
      }),
    ).then((pairs) => {
      if (cancelled) return;
      setUrls((prev) => {
        const next = { ...prev };
        for (const [id, url] of pairs) {
          if (url) next[id] = url;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [items, urls]);

  async function onFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = QA_SCREENSHOT_MAX_COUNT - items.length;
    if (remaining <= 0) {
      toast.error(`حد أقصى ${QA_SCREENSHOT_MAX_COUNT} صور`);
      return;
    }

    const selected = Array.from(files).slice(0, remaining);
    setUploading(true);
    try {
      for (const file of selected) {
        if (!QA_SCREENSHOT_MIME.has(file.type)) {
          toast.error("نوع الصورة غير مدعوم (jpeg / png / webp)");
          continue;
        }
        if (file.size > QA_SCREENSHOT_MAX_BYTES) {
          toast.error("الصورة أكبر من 5 ميجابايت");
          continue;
        }

        const prepared = await prepareQaScreenshotUploadAction(
          itemId,
          projectId,
          scope,
          file.type,
          file.size,
        );
        if (prepared.error || !prepared.signedUrl || !prepared.storagePath) {
          toast.error(prepared.error ?? "فشل الرفع");
          continue;
        }

        const put = await fetch(prepared.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!put.ok) {
          toast.error("فشل رفع الصورة");
          continue;
        }

        const finalized = await finalizeQaScreenshotUploadAction(
          itemId,
          projectId,
          scope,
          prepared.storagePath,
          file.type,
          file.size,
        );
        if (finalized.error || !finalized.attachment) {
          toast.error(finalized.error ?? "فشل حفظ الصورة");
          continue;
        }
        setItems((prev) => [...prev, finalized.attachment!]);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteQaScreenshotAction(id, projectId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setItems((prev) => prev.filter((a) => a.id !== id));
      setUrls((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    });
  }

  if (items.length === 0 && !canEdit) return null;

  return (
    <div className={cn("space-y-1.5", compact && "mt-1")}>
      <div className="flex flex-wrap gap-1.5 items-center">
        {items.map((a) => {
          const url = urls[a.id];
          return (
            <div
              key={a.id}
              className="relative group w-14 h-14 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shrink-0"
            >
              {url ? (
                <button
                  type="button"
                  onClick={() => setLightbox(url)}
                  className="block w-full h-full"
                  aria-label="عرض الصورة"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                </div>
              )}
              {canEdit ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => remove(a.id)}
                  className="absolute top-0.5 start-0.5 p-0.5 rounded bg-black/55 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  aria-label="حذف الصورة"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              ) : null}
            </div>
          );
        })}

        {canEdit && items.length < QA_SCREENSHOT_MAX_COUNT ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(e) => void onFilesSelected(e.target.files)}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-md border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 hover:border-teal-400 hover:text-teal-600 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ImagePlus className="w-3.5 h-3.5" />
              )}
              لقطة شاشة
            </button>
          </>
        ) : null}
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="عرض لقطة الشاشة"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute top-4 end-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={() => setLightbox(null)}
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-w-full max-h-full rounded-lg shadow-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Read-only strip for archived attempt screenshots. */
export function QaScreenshotThumbs({
  attachments,
}: {
  attachments: QaScreenshotMeta[];
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      attachments.map(async (a) => {
        const res = await getQaScreenshotSignedUrlAction(a.id);
        return [a.id, res.url] as const;
      }),
    ).then((pairs) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const [id, url] of pairs) {
        if (url) next[id] = url;
      }
      setUrls(next);
    });
    return () => {
      cancelled = true;
    };
  }, [attachments]);

  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {attachments.map((a) => {
        const url = urls[a.id];
        return (
          <button
            key={a.id}
            type="button"
            disabled={!url}
            onClick={() => url && setLightbox(url)}
            className="w-12 h-12 rounded overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
            aria-label="عرض الصورة"
          >
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Loader2 className="w-3 h-3 m-auto animate-spin text-gray-400" />
            )}
          </button>
        );
      })}
      {lightbox ? (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-w-full max-h-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
