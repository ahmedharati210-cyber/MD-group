/** Characters unsafe in ZIP / filesystem entry names (keep Unicode letters incl. Arabic). */
const INVALID_ARCHIVE_NAME_CHARS = /[/\\:*?"<>|\u0000-\u001f]/g;

/**
 * Safe segment for passport archive filenames (ZIP entries, optional storage suffix).
 */
export function sanitizePassportArchiveLabel(raw: string): string {
  let s = raw.trim().replace(/\s+/g, "_");
  s = s.replace(INVALID_ARCHIVE_NAME_CHARS, "");
  s = s.replace(/_+/g, "_").replace(/^_|_$/g, "");
  return s.slice(0, 120);
}

function extensionFromStoragePath(storagePath: string): string {
  if (!storagePath.includes(".")) return "jpg";
  return storagePath.split(".").pop()!.toLowerCase();
}

/**
 * ZIP entry name: `{name}_{phone}_{shortRequestId}.{ext}` — sorts by name, easy lookup by phone.
 */
export function passportZipEntryFileName(
  fullName: string | null,
  phone: string | null,
  requestId: string,
  storagePath: string,
): string {
  const ext = extensionFromStoragePath(storagePath);
  const namePart =
    sanitizePassportArchiveLabel(fullName ?? "") || "unknown";
  const phonePart =
    sanitizePassportArchiveLabel((phone ?? "").replace(/\s/g, "")) ||
    "no-phone";
  const idPart = requestId.replace(/-/g, "").slice(0, 8);
  return `${namePart}_${phonePart}_${idPart}.${ext}`;
}

/**
 * Object key file segment for Supabase Storage: `{name}_{phone}.{ext}` (no request id; folder is unique).
 */
export function passportStorageFileName(
  fullName: string,
  phone: string,
  fallbackId: string,
  ext: string,
): string {
  const a = sanitizePassportArchiveLabel(fullName) || "unknown";
  const b = sanitizePassportArchiveLabel(phone.replace(/\s/g, "")) || "no-phone";
  const base = `${a}_${b}`.slice(0, 200);
  const stem = base || fallbackId.replace(/-/g, "").slice(0, 8);
  return `${stem}.${ext}`;
}
