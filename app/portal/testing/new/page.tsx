import { requireTestingAccess } from "@/lib/auth";
import { canManageTesting } from "@/lib/itqan-testing";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/portal/PageHeader";
import { QaProjectForm } from "@/components/testing/QaProjectForm";

export const metadata = { title: "منصة جديدة" };

export default async function NewQaProjectPage() {
  const { profile } = await requireTestingAccess();
  if (!canManageTesting(profile)) redirect("/portal/testing");

  return (
    <div className="max-w-xl">
      <PageHeader
        title="منصة جديدة"
        description="أضف منصة أو موقعاً ليختبرها الفريق."
      />
      <QaProjectForm />
    </div>
  );
}
