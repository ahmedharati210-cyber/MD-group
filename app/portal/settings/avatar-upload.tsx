"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, User } from "lucide-react";
import toast from "react-hot-toast";

type Props = { currentUrl: string | null; fullName: string };

export function AvatarUpload({ currentUrl, fullName }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Optimistic preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    setUploading(true);
    const toastId = toast.loading("جارٍ رفع الصورة...");

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      const json = await res.json();

      if (!res.ok || json.error) {
        toast.error(json.error ?? "فشل رفع الصورة", { id: toastId });
        setPreviewUrl(currentUrl);
        return;
      }

      toast.success("تم تحديث الصورة الشخصية", { id: toastId });
      setPreviewUrl(json.url);
    } catch {
      toast.error("فشل رفع الصورة", { id: toastId });
      setPreviewUrl(currentUrl);
    } finally {
      setUploading(false);
    }
  }

  const initials = fullName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={fullName}
            className="w-20 h-20 rounded-2xl object-cover border-2 border-gray-200 dark:border-gray-700"
          />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold text-2xl border-2 border-gray-200 dark:border-gray-700">
            {initials || <User className="w-8 h-8" />}
          </div>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-label="تغيير الصورة الشخصية"
          className="absolute -bottom-1.5 -left-1.5 w-8 h-8 bg-primary-600 text-white rounded-xl shadow-md hover:bg-primary-700 flex items-center justify-center transition-colors disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Camera className="w-4 h-4" />
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={handleChange}
          aria-label="اختر صورة شخصية"
        />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">{fullName}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          JPG أو PNG أو WebP · حتى 2 ميغابايت
        </p>
      </div>
    </div>
  );
}
