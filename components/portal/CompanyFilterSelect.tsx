import type { ChangeEvent } from "react";

const DEFAULT_SELECT_CLASS =
  "px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-hidden";

export function CompanyFilterSelect({
  companies,
  value,
  name = "companyId",
  onChange,
  className,
  id,
}: {
  companies: { id: string; name_ar: string }[];
  value: string;
  name?: string;
  onChange?: (value: string) => void;
  className?: string;
  id?: string;
}) {
  const isControlled = typeof onChange === "function";

  return (
    <select
      id={id}
      name={name}
      className={className ?? DEFAULT_SELECT_CLASS}
      {...(isControlled
        ? {
            value,
            onChange: (event: ChangeEvent<HTMLSelectElement>) => {
              onChange(event.target.value);
            },
          }
        : { defaultValue: value })}
    >
      <option value="">كل الشركات</option>
      {companies.map((company) => (
        <option key={company.id} value={company.id}>
          {company.name_ar}
        </option>
      ))}
    </select>
  );
}
