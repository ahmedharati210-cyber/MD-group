import { FormSectionsSkeleton } from "@/components/portal/skeletons/form-sections-skeleton";
import { PageHeaderSkeleton } from "@/components/portal/skeletons/page-header-skeleton";

export default function SettingsLoading() {
  return (
    <div className="animate-pulse">
      <PageHeaderSkeleton showAction={false} />
      <FormSectionsSkeleton sections={5} />
    </div>
  );
}
