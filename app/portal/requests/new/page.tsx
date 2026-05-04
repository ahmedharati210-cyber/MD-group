import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/portal/PageHeader";
import { RequestForm } from "@/components/requests/RequestForm";

export const metadata = { title: "طلب جديد" };

export default async function NewRequestPage() {
  const { profile } = await requireUser();

  // Managers review requests — they don't submit them.
  if (profile.role !== "employee") {
    redirect("/portal/requests");
  }

  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="max-w-xl">
      <PageHeader title="طلب جديد" description="قدم طلب إجازة أو سلفة أو معدات أو غيرها." />
      <RequestForm today={today} />
    </div>
  );
}
