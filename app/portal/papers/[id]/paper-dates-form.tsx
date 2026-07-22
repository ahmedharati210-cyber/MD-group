"use client";

import { useActionState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  updatePaperDatesAction,
  type PaperDatesState,
} from "@/app/portal/papers/actions";
import {
  PAPER_STAT_CATEGORIES,
  paperCategoryLabel,
  paperCategoryLabelFor,
} from "@/lib/paper-categories";
import { formatDate, formatDateTime } from "@/lib/utils";

const inputClasses =
  "w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-hidden";
const labelClasses =
  "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5";

type Props = {
  documentId: string;
  title: string;
  category: string;
  issuedOn: string | null;
  expiresOn: string | null;
  expiryNotifiedAt: string | null;
  renewalInProgress: boolean;
  canEdit: boolean;
};

function categoriesForSelect(current: string): string[] {
  if (
    PAPER_STAT_CATEGORIES.includes(
      current as (typeof PAPER_STAT_CATEGORIES)[number],
    )
  ) {
    return [...PAPER_STAT_CATEGORIES];
  }
  return [...PAPER_STAT_CATEGORIES, current];
}

export function PaperDatesForm({
  documentId,
  title,
  category,
  issuedOn,
  expiresOn,
  expiryNotifiedAt,
  renewalInProgress,
  canEdit,
}: Props) {
  const router = useRouter();
  const wasPendingRef = useRef(false);
  const [state, formAction, pending] = useActionState<
    PaperDatesState | undefined,
    FormData
  >(updatePaperDatesAction, undefined);

  const categoryOptions = useMemo(
    () => categoriesForSelect(category),
    [category],
  );

  useEffect(() => {
    if (pending) {
      wasPendingRef.current = true;
      return;
    }
    if (wasPendingRef.current && state?.ok) {
      wasPendingRef.current = false;
      toast.success("تم حفظ التغييرات.", { id: "paper-dates-saved" });
      router.push("/portal/papers");
      router.refresh();
      return;
    }
    if (wasPendingRef.current && state?.error) {
      wasPendingRef.current = false;
      toast.error(state.error);
    }
  }, [pending, state, router]);

  if (!canEdit) {
    return (
      <div className="space-y-2 text-sm">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            عنوان الورقة
          </div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">النوع</div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">
            {paperCategoryLabelFor(category)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            تاريخ الإصدار
          </div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">
            {formatDate(issuedOn) || "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            انتهاء الصلاحية
          </div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">
            {formatDate(expiresOn) || "—"}
          </div>
        </div>
        {renewalInProgress ? (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              حالة التجديد
            </div>
            <div className="font-semibold text-sky-700 dark:text-sky-300">
              قيد التجديد
            </div>
          </div>
        ) : null}
        {expiryNotifiedAt ? (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            تم إرسال تنبيه انتهاء الصلاحية للإدارة:{" "}
            {formatDateTime(expiryNotifiedAt)}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="document_id" value={documentId} />
      <div>
        <label className={labelClasses} htmlFor={`title-${documentId}`}>
          عنوان الورقة
        </label>
        <input
          id={`title-${documentId}`}
          name="title"
          type="text"
          required
          defaultValue={title}
          className={inputClasses}
        />
      </div>
      <div>
        <label className={labelClasses} htmlFor={`category-${documentId}`}>
          النوع
        </label>
        <select
          id={`category-${documentId}`}
          name="category"
          defaultValue={category}
          className={inputClasses}
        >
          {categoryOptions.map((cat) => (
            <option key={cat} value={cat}>
              {paperCategoryLabel[cat] ?? paperCategoryLabelFor(cat)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClasses} htmlFor={`issued-${documentId}`}>
          تاريخ الإصدار
        </label>
        <input
          id={`issued-${documentId}`}
          name="issued_on"
          type="date"
          defaultValue={issuedOn ?? ""}
          className={inputClasses}
        />
      </div>
      <div>
        <label className={labelClasses} htmlFor={`expires-${documentId}`}>
          تاريخ انتهاء الصلاحية
        </label>
        <input
          id={`expires-${documentId}`}
          name="expires_on"
          type="date"
          defaultValue={expiresOn ?? ""}
          className={inputClasses}
        />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        يُرسل تنبيه تلقائي لمديري المجموعة ومديري الشركة خلال الشهر الأخير قبل
        انتهاء الصلاحية (عند تحديد التاريخ). يمكن وضع الورقة «قيد التجديد» من
        قائمة الأوراق.
      </p>
      {expiryNotifiedAt ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          تم إرسال تنبيه سابق للإدارة: {formatDateTime(expiryNotifiedAt)}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            جارٍ الحفظ...
          </>
        ) : (
          "حفظ التغييرات"
        )}
      </button>
    </form>
  );
}
