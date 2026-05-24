"use client";

import { updateCategoryEstimatedDaysAction } from "@/app/portal/timeline/actions";
import { InlineEstimatedDaysField } from "@/components/timeline/InlineEstimatedDaysField";

export function CategoryEstimatedDaysField({
  categoryId,
  projectId,
  initialEstimatedDays,
  canEdit,
}: {
  categoryId: string;
  projectId: string;
  initialEstimatedDays: number | null;
  canEdit: boolean;
}) {
  return (
    <InlineEstimatedDaysField
      size="compact"
      initialEstimatedDays={initialEstimatedDays}
      canEdit={canEdit}
      ariaLabel={`أيام تقديرية للفئة`}
      successMessage="تم حفظ تقدير الفئة"
      onSave={(days) => updateCategoryEstimatedDaysAction(categoryId, projectId, days)}
    />
  );
}
