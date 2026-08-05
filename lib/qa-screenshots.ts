export const QA_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
export const QA_SCREENSHOT_MAX_COUNT = 3;
export const QA_SCREENSHOT_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type QaAttachmentScope = "item" | "result";

export function qaScreenshotExt(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export function validateQaScreenshotMeta(
  mimeType: string,
  byteSize: number,
): string | null {
  if (!QA_SCREENSHOT_MIME.has(mimeType)) {
    return "نوع الصورة غير مدعوم (jpeg / png / webp)";
  }
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    return "حجم الملف غير صالح";
  }
  if (byteSize > QA_SCREENSHOT_MAX_BYTES) {
    return "الصورة أكبر من 5 ميجابايت";
  }
  return null;
}
