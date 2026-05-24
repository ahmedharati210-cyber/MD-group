"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Clock, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import type { ActionState } from "@/app/portal/timeline/actions";

type Size = "default" | "compact";

interface Props {
  initialEstimatedDays: number | null;
  canEdit: boolean;
  onSave: (days: number | null) => Promise<ActionState>;
  ariaLabel: string;
  heading?: string;
  size?: Size;
  showDivider?: boolean;
  successMessage?: string;
}

function formatDays(days: number | null): string | null {
  if (days == null || days < 0) return null;
  return days === 1 ? "يوم واحد" : `${days} يوم`;
}

const inputCls: Record<Size, string> = {
  default:
    "w-24 px-3 py-2 text-sm font-semibold tabular-nums border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 outline-none disabled:opacity-60",
  compact:
    "w-14 px-2 py-1 text-xs font-medium tabular-nums border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 outline-none disabled:opacity-60",
};

export function InlineEstimatedDaysField({
  initialEstimatedDays,
  canEdit,
  onSave,
  ariaLabel,
  heading,
  size = "default",
  showDivider = false,
  successMessage = "تم الحفظ",
}: Props) {
  const [value, setValue] = useState(
    initialEstimatedDays != null ? String(initialEstimatedDays) : "",
  );
  const [isPending, startTransition] = useTransition();
  const lastSaved = useRef(initialEstimatedDays);

  useEffect(() => {
    setValue(initialEstimatedDays != null ? String(initialEstimatedDays) : "");
    lastSaved.current = initialEstimatedDays;
  }, [initialEstimatedDays]);

  function parseInput(raw: string): number | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (Number.isNaN(n) || n < 0 || !Number.isInteger(n)) return null;
    return n;
  }

  function save() {
    const next = parseInput(value);
    const prev = lastSaved.current;
    if (next === prev) return;
    if (value.trim() !== "" && next === null) {
      toast.error("أدخل عدداً صحيحاً موجباً أو اترك الحقل فارغاً");
      setValue(prev != null ? String(prev) : "");
      return;
    }

    startTransition(async () => {
      const res = await onSave(next);
      if (res.error) {
        toast.error(res.error);
        setValue(prev != null ? String(prev) : "");
        return;
      }
      lastSaved.current = next;
      toast.success(successMessage, { id: `est-days-${ariaLabel}` });
    });
  }

  if (!canEdit) {
    const label = formatDays(initialEstimatedDays);
    if (!label) return null;
    if (size === "compact") {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
          <Clock className="w-3 h-3" />
          {label}
        </span>
      );
    }
    return (
      <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <Clock className="w-4 h-4 flex-shrink-0 text-gray-400" />
        <span>
          <span className="text-gray-500 dark:text-gray-400">{heading ?? "أيام تقديرية"}: </span>
          <span className="font-semibold tabular-nums">{label}</span>
        </span>
      </div>
    );
  }

  const row = (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {size === "compact" ? (
        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">أيام</span>
      ) : null}
      <input
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        disabled={isPending}
        placeholder="—"
        className={inputCls[size]}
        aria-label={ariaLabel}
      />
      {size === "default" ? (
        <span className="text-sm text-gray-500 dark:text-gray-400">يوم</span>
      ) : null}
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-600" aria-hidden /> : null}
    </div>
  );

  if (size === "compact") return row;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 sm:gap-3 ${showDivider ? "pb-3 mb-3 border-b border-gray-100 dark:border-gray-800" : ""}`}
    >
      {heading ? (
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span>{heading}</span>
        </div>
      ) : null}
      {row}
    </div>
  );
}
