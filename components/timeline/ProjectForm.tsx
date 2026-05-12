"use client";

import { useActionState } from "react";
import Link from "next/link";
import { HardHat } from "lucide-react";
import { createProjectAction, updateProjectAction } from "@/app/portal/timeline/actions";
import type { Project } from "@/types/db";

type EngineerOption = { id: string; full_name: string };
type State = { error?: string; ok?: boolean };
const init: State = {};

const inputCls = "w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
const sectionCls = "border-t border-gray-100 dark:border-gray-800 pt-4";

export function ProjectForm({
  project,
  engineers = [],
}: {
  project?: Project;
  engineers?: EngineerOption[];
}) {
  const action = project ? updateProjectAction.bind(null, project.id) : createProjectAction;
  const [state, formAction, isPending] = useActionState(action, init);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
          {state.error}
        </div>
      ) : null}

      {/* Project info */}
      <div>
        <label className={labelCls}>اسم المشروع / الموقع *</label>
        <input type="text" name="name" required defaultValue={project?.name ?? ""} placeholder="مثال: مبنى A — الشارع الرابع" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>وصف</label>
        <textarea name="description" rows={2} defaultValue={project?.description ?? ""} className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>تاريخ البداية</label>
          <input type="date" name="start_date" defaultValue={project?.start_date ?? ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>تاريخ الانتهاء</label>
          <input type="date" name="end_date" defaultValue={project?.end_date ?? ""} className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>الحالة</label>
        <select name="status" defaultValue={project?.status ?? "planning"} className={inputCls}>
          <option value="planning">تصميم</option>
          <option value="active">انشاء (اعمال الهيكل)</option>
          <option value="completed">تشطيب</option>
          <option value="maintenance">صيانة</option>
          <option value="survey">رفع مساحي</option>
          <option value="on_hold">متوقف</option>
          <option value="on_hold_claim">متوقف ( مطالبة)</option>
        </select>
      </div>

      {/* Site / location info */}
      <div className={sectionCls}>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">بيانات الموقع</p>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>ملاحظات الموقع / الموقع الجغرافي</label>
            <textarea name="location_notes" rows={3} defaultValue={project?.location_notes ?? ""} placeholder="رابط خرائط، وصف الموقع، تعليمات الوصول..." className={inputCls} />
          </div>

          <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <HardHat className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">المهندس المسؤول</p>
            </div>
            <select name="default_engineer_id" defaultValue={project?.default_engineer_id ?? ""} className={inputCls}>
              <option value="">— بدون مهندس افتراضي —</option>
              {engineers.map((e) => (
                <option key={e.id} value={e.id}>{e.full_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Doorman — edit mode only (no doorman during initial planning) */}
      {project ? (
        <div className={sectionCls}>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">بيانات الغفير</p>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>اسم الغفير</label>
              <input type="text" name="manager_name" defaultValue={project.manager_name ?? ""} placeholder="اسم الغفير" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>هاتف الغفير</label>
              <input type="tel" name="manager_phone" defaultValue={project.manager_phone ?? ""} placeholder="+218..." className={inputCls} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={isPending} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-60 transition-colors">
          {isPending ? "جارٍ الحفظ..." : project ? "حفظ التعديلات" : "إنشاء المشروع"}
        </button>
        <Link
          href={project ? `/portal/timeline/${project.id}` : "/portal/timeline"}
          className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-semibold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 text-center"
        >
          إلغاء
        </Link>
      </div>
    </form>
  );
}
