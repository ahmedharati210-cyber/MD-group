import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/portal/PageHeader";
import { ClaimForm } from "@/components/claims/ClaimForm";

export const metadata = { title: "مطالبة جديدة" };

export default async function NewClaimPage() {
  await requireRole(["md_admin", "company_manager"]);
  return (
    <div className="max-w-xl">
      <PageHeader title="مطالبة جديدة" description="أضف مطالبة مع ملف PDF." />
      <ClaimForm />
    </div>
  );
}
