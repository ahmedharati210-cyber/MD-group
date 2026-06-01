"use client";

import { updateTaskEstimatedDaysAction } from "@/app/portal/timeline/actions";
import { InlineEstimatedDaysField } from "@/components/timeline/InlineEstimatedDaysField";

export function TaskEstimatedDaysField({
  taskId,
  projectId,
  initialEstimatedDays,
  estimatedDaysSetAt,
  canEdit,
}: {
  taskId: string;
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
      ariaLabel="أيام تقديرية للمهمة"
      successMessage="تم الحفظ — العد التنازلي يبدأ من اليوم"
      onSave={(days) => updateTaskEstimatedDaysAction(taskId, projectId, days)}
    />
  );
}
