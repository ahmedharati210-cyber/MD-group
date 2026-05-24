"use client";

import {
  updateProjectEstimatedDaysAction,
} from "@/app/portal/timeline/actions";
import { InlineEstimatedDaysField } from "@/components/timeline/InlineEstimatedDaysField";

interface Props {
  projectId: string;
  initialEstimatedDays: number | null;
  canEdit: boolean;
  showDivider?: boolean;
}

export function ProjectEstimatedDaysField({
  projectId,
  initialEstimatedDays,
  canEdit,
  showDivider = true,
}: Props) {
  return (
    <InlineEstimatedDaysField
      initialEstimatedDays={initialEstimatedDays}
      canEdit={canEdit}
      showDivider={showDivider}
      heading="إجمالي الأيام التقديرية للمشروع"
      ariaLabel="إجمالي الأيام التقديرية للمشروع"
      successMessage="تم حفظ التقدير الإجمالي"
      onSave={(days) => updateProjectEstimatedDaysAction(projectId, days)}
    />
  );
}
