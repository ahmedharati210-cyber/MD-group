"use client";

import { updateTaskEstimatedDaysAction } from "@/app/portal/timeline/actions";
import { InlineEstimatedDaysField } from "@/components/timeline/InlineEstimatedDaysField";

export function TaskEstimatedDaysField({
  taskId,
  projectId,
  initialEstimatedDays,
  canEdit,
}: {
  taskId: string;
  projectId: string;
  initialEstimatedDays: number | null;
  canEdit: boolean;
}) {
  return (
    <InlineEstimatedDaysField
      size="compact"
      initialEstimatedDays={initialEstimatedDays}
      canEdit={canEdit}
      ariaLabel="أيام تقديرية للمهمة"
      successMessage="تم حفظ تقدير المهمة"
      onSave={(days) => updateTaskEstimatedDaysAction(taskId, projectId, days)}
    />
  );
}
