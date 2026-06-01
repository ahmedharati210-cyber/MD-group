"use client";

import { updateCategoryEstimatedDaysAction } from "@/app/portal/timeline/actions";
import { InlineEstimatedDaysField } from "@/components/timeline/InlineEstimatedDaysField";

export function CategoryEstimatedDaysField({
  categoryId,
  projectId,
  initialEstimatedDays,
  estimatedDaysSetAt,
  canEdit,
}: {
  categoryId: string;
  projectId: string;
  initialEstimatedDays: number | null;
  estimatedDaysSetAt: string | null;
  canEdit: boolean;
}) {
  return (
    <InlineEstimatedDaysField
      size="compact"
      initialEstimatedDays={initialEstimatedDays}
      estimatedDaysSetAt={estimatedDaysSetAt}
      canEdit={canEdit}
      ariaLabel="أيام تقديرية للفئة"
      successMessage="تم الحفظ — العد التنازلي يبدأ من اليوم"
      onSave={(days) => updateCategoryEstimatedDaysAction(categoryId, projectId, days)}
    />
  );
}
