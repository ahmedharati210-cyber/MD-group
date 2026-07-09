"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import type { AttendancePerson } from "@/types/db";
import {
  buildBranchPersonHref,
  buildPersonMonthHref,
  type AttendanceNavContext,
} from "./attendance-navigation";

type PersonWithCount = AttendancePerson & { recordCount: number };

type Props = {
  people: PersonWithCount[];
  selectedPersonId: string | null;
  hasSearch: boolean;
  navContext: AttendanceNavContext;
};

export function AttendancePersonList({
  people,
  selectedPersonId,
  hasSearch,
  navContext,
}: Props) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
      <h3 className="px-4 py-3 font-bold border-b border-gray-100 dark:border-gray-800">
        قائمة الحضور
      </h3>
      {people.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500 text-center">
          {hasSearch
            ? "لا توجد نتائج مطابقة للبحث."
            : "لا يوجد أشخاص في قائمة الحضور لهذا الفرع."}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[420px] overflow-y-auto">
          {people.map((person) => {
            const isSelected = selectedPersonId === person.id;
            return (
              <li key={person.id} className="flex items-stretch">
                <Link
                  href={buildBranchPersonHref(navContext, person.id, selectedPersonId)}
                  className={`flex-1 min-w-0 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                    isSelected ? "bg-primary-50 dark:bg-primary-900/20" : ""
                  }`}
                >
                  <p className="font-semibold text-sm">{person.full_name}</p>
                  <p className="text-xs text-gray-500 flex justify-between mt-0.5">
                    <span dir="ltr">#{person.external_employee_number}</span>
                    <span>{person.recordCount} يوم</span>
                  </p>
                </Link>
                <a
                  href={buildPersonMonthHref(navContext, person.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="فتح شهر الموظف للتعديل"
                  aria-label={`فتح شهر ${person.full_name} للتعديل`}
                  className="relative z-10 shrink-0 px-3 my-2 ml-2 rounded-lg text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Eye className="w-4 h-4" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
