"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Clock, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import type { ActionState } from "@/app/portal/timeline/actions";

type Size = "default" | "compact";

interface Props {
  initialEstimatedDays: number | null;
  estimatedDaysSetAt: string | null;
  canEdit: boolean;
  onSave: (days: number | null) => Promise<ActionState>;
  ariaLabel: string;
  heading?: string;
  size?: Size;
  showDivider?: boolean;
  successMessage?: string;
}

/** Days remaining in the countdown: estimated_days minus elapsed days since set_at. */
function calcRemaining(days: number | null, setAt: string | null): number | null {
  if (days == null) return null;
  if (!setAt) return days;
  const todayDate = new Date();
  const setDate = new Date(setAt);
  // Date-only diff — strip time component
  const todayLocal = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
  const setLocal = new Date(setDate.getFullYear(), setDate.getMonth(), setDate.getDate());
  const elapsed = Math.floor((todayLocal.getTime() - setLocal.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, days - elapsed);
}

function formatRemaining(remaining: number | null): { text: string; isLastDay: boolean } | null {
  if (remaining == null) return null;
  if (remaining === 0) return { text: "اليوم الأخير", isLastDay: true };
  return { text: remaining === 1 ? "يوم واحد" : `${remaining} يوم`, isLastDay: false };
}

const inputCls: Record<Size, string> = {
  default:
    "w-24 px-3 py-2 text-sm font-semibold tabular-nums border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 outline-hidden disabled:opacity-60",
  compact:
    "w-14 px-2 py-1 text-xs font-medium tabular-nums border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 outline-hidden disabled:opacity-60",
};

export function InlineEstimatedDaysField({
  initialEstimatedDays,
  estimatedDaysSetAt,
  canEdit,
  onSave,
  ariaLabel,
  heading,
  size = "default",
  showDivider = false,
  successMessage = "تم الحفظ",
}: Props) {
  const remaining = calcRemaining(initialEstimatedDays, estimatedDaysSetAt);
  const [value, setValue] = useState(remaining != null ? String(remaining) : "");
  const [isPending, startTransition] = useTransition();
  const lastSaved = useRef(remaining);

  // Sync when the server re-renders with fresh data
  useEffect(() => {
    const r = calcRemaining(initialEstimatedDays, estimatedDaysSetAt);
    setValue(r != null ? String(r) : "");
    lastSaved.current = r;
  }, [initialEstimatedDays, estimatedDaysSetAt]);

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

  // Read-only display
  if (!canEdit) {
    const fmt = formatRemaining(remaining);
    if (!fmt) return null;
    if (size === "compact") {
      return (
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium ${
            fmt.isLastDay
              ? "text-amber-600 dark:text-amber-400"
              : "text-gray-600 dark:text-gray-400"
          }`}
        >
          <Clock className="w-3 h-3" />
          متبقي {fmt.text}
        </span>
      );
    }
    return (
      <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <Clock className="w-4 h-4 shrink-0 text-gray-400" />
        <span>
          <span className="text-gray-500 dark:text-gray-400">{heading ?? "متبقي"}: </span>
          <span
            className={`font-semibold tabular-nums ${
              fmt.isLastDay ? "text-amber-600 dark:text-amber-400" : ""
            }`}
          >
            {fmt.text}
          </span>
        </span>
      </div>
    );
  }

  // Editable input row
  const fmt = formatRemaining(remaining);
  const isLastDay = fmt?.isLastDay ?? false;

  const inputEl = (
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
  );

  const row = (
    <div className="flex items-center gap-1.5 shrink-0">
      <span
        className={`whitespace-nowrap ${
          size === "compact" ? "text-xs" : "text-sm"
        } text-gray-500 dark:text-gray-400`}
      >
        متبقي
      </span>
      {inputEl}
      <span
        className={`${size === "compact" ? "text-xs" : "text-sm"} text-gray-500 dark:text-gray-400`}
      >
        يوم
      </span>
      {isLastDay ? (
        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
          · اليوم الأخير
        </span>
      ) : null}
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-600" aria-hidden /> : null}
    </div>
  );

  if (size === "compact") return row;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 sm:gap-3 ${
        showDivider ? "pb-3 mb-3 border-b border-gray-100 dark:border-gray-800" : ""
      }`}
    >
      {heading ? (
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <Clock className="w-4 h-4 text-gray-400 shrink-0" />
          <span>{heading}</span>
        </div>
      ) : null}
      {row}
    </div>
  );
}
