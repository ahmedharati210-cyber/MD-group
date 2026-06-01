"use client";

import { updateProjectEstimatedDaysAction } from "@/app/portal/timeline/actions";
import { InlineEstimatedDaysField } from "@/components/timeline/InlineEstimatedDaysField";

interface Props {
  projectId: string;
  initialEstimatedDays: number | null;
  estimatedDaysSetAt: string | null;
  canEdit: boolean;
  showDivider?: boolean;
}

export function ProjectEstimatedDaysField({
  projectId,
  initialEstimatedDays,
  estimatedDaysSetAt,
  canEdit,
  showDivider = true,
}: Props) {
  return (
    <InlineEstimatedDaysField
      initialEstimatedDays={initialEstimatedDays}
      estimatedDaysSetAt={estimatedDaysSetAt}
      canEdit={canEdit}
      showDivider={showDivider}
      heading="إجمالي الأيام المتبقية للمشروع"
      ariaLabel="إجمالي الأيام المتبقية للمشروع"
      successMessage="تم حفظ التقدير — العد التنازلي يبدأ من اليوم"
      onSave={(days) => updateProjectEstimatedDaysAction(projectId, days)}
    />
  );
}
