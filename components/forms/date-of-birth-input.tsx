"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const MIN_BIRTH_YEAR = 1940;
const MIN_EMPLOYEE_AGE = 16;

function maxBirthDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setFullYear(d.getFullYear() - MIN_EMPLOYEE_AGE);
  return d;
}

function maxBirthYear(): number {
  return maxBirthDate().getFullYear();
}

function daysInMonth(month: number, year: number): number {
  if (month < 1 || month > 12) return 31;
  return new Date(year, month, 0).getDate();
}

/** Format up to 8 raw digits as DD/MM/YYYY, inserting slashes automatically. */
function formatDigits(digits: string): string {
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

function toIso(digits: string): string {
  if (digits.length !== 8) return "";
  const day = parseInt(digits.slice(0, 2), 10);
  const month = parseInt(digits.slice(2, 4), 10);
  const year = parseInt(digits.slice(4, 8), 10);
  if (day < 1 || day > 31 || month < 1 || month > 12) return "";
  if (year < MIN_BIRTH_YEAR || year > maxBirthYear()) return "";
  const dt = new Date(year, month - 1, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return "";
  }
  const birth = new Date(year, month - 1, day);
  birth.setHours(0, 0, 0, 0);
  if (birth > maxBirthDate()) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getValidationError(digits: string): string | null {
  if (digits.length < 8) return null;
  const day = parseInt(digits.slice(0, 2), 10);
  const month = parseInt(digits.slice(2, 4), 10);
  const year = parseInt(digits.slice(4, 8), 10);
  if (day < 1 || day > 31) return "اليوم يجب أن يكون بين 01 و 31.";
  if (month < 1 || month > 12) return "الشهر يجب أن يكون بين 01 و 12.";
  if (year < MIN_BIRTH_YEAR || year > maxBirthYear()) {
    return `السنة يجب أن تكون بين ${MIN_BIRTH_YEAR} و ${maxBirthYear()} (العمر ${MIN_EMPLOYEE_AGE} سنة على الأقل).`;
  }
  const dt = new Date(year, month - 1, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return `هذا الشهر لا يحتوي على ${String(day).padStart(2, "0")} يوماً (أيام الشهر: ${daysInMonth(month, year)}).`;
  }
  const birth = new Date(year, month - 1, day);
  birth.setHours(0, 0, 0, 0);
  if (birth > maxBirthDate()) {
    return `يجب أن يكون العمر ${MIN_EMPLOYEE_AGE} سنة على الأقل.`;
  }
  return null;
}

export function DateOfBirthInput({
  hintClassName,
  inputClassName,
}: {
  hintClassName?: string;
  inputClassName?: string;
}) {
  const [digits, setDigits] = useState("");

  const display = formatDigits(digits);
  const iso = toIso(digits);
  const error = getValidationError(digits);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
    setDigits(raw);
  };

  return (
    <>
      <p
        className={cn(
          "text-xs mb-2 leading-relaxed text-gray-500 dark:text-gray-400",
          hintClassName,
        )}
      >
        .يوم / شهر / سنة </p>
      <input
        type="text"
        inputMode="numeric"
        dir="ltr"
        autoComplete="bday"
        placeholder="15/05/1990"
        value={display}
        onChange={handleChange}
        className={cn(
          inputClassName,
          error ? "border-red-400 focus:border-red-500 focus:ring-red-500/15" : null,
        )}
        aria-label="تاريخ الميلاد"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "dob-error" : undefined}
      />
      {error ? (
        <p id="dob-error" className="mt-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <input type="hidden" name="date_of_birth" value={iso} required />
    </>
  );
}
