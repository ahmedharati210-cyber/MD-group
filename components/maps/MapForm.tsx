"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createMapAction, updateMapAction } from "@/app/portal/maps/actions";
import type { MapLink } from "@/types/db";

type ProjectOption = { id: string; name: string };
type State = { error?: string; ok?: boolean };
const init: State = {};

const inputCls = "w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

export function MapForm({ map, projects }: { map?: MapLink; projects: ProjectOption[] }) {
  const action = map ? updateMapAction.bind(null, map.id) : createMapAction;
  const [state, formAction, isPending] = useActionState(action, init);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">{state.error}</div>
      ) : null}

      <div>
        <label className={labelCls}>اسم الخريطة *</label>
        <input type="text" name="name" required defaultValue={map?.name ?? ""} placeholder="مثال: خريطة الموقع الرئيسي" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>رابط Google Drive *</label>
        <input type="url" name="drive_url" required defaultValue={map?.drive_url ?? ""} placeholder="https://drive.google.com/..." className={inputCls} />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">الصق رابط المشاركة من Google Drive.</p>
      </div>

      <div>
        <label className={labelCls}>المشروع / الموقع المرتبط</label>
        <select name="project_id" defaultValue={(map as (MapLink & { project_id?: string | null }) | undefined)?.project_id ?? ""} className={inputCls}>
          <option value="">— بدون مشروع —</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div>
        <label className={labelCls}>وصف</label>
        <textarea name="description" rows={3} defaultValue={map?.description ?? ""} placeholder="ما تحتوي عليه هذه الخريطة..." className={inputCls} />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={isPending} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-60 transition-colors">
          {isPending ? "جارٍ الحفظ..." : map ? "حفظ التعديلات" : "إضافة الخريطة"}
        </button>
        <Link href="/portal/maps" className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-semibold text-sm text-center hover:bg-gray-200 dark:hover:bg-gray-700">
          إلغاء
        </Link>
      </div>
    </form>
  );
}
