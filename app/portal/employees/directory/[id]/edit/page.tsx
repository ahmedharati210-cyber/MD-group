import { redirect } from "next/navigation";

export default async function LegacyEmployeeDirectoryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/portal/employees/${id}/edit`);
}
