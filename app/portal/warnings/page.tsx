import { redirect } from "next/navigation";

type SearchParams = Promise<{ page?: string; companyId?: string }>;

/**
 * Legacy URL: bookmarks and old links redirect to the notifications center.
 */
export default async function WarningsPageRedirect({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  if (typeof sp.page === "string" && sp.page.trim()) {
    q.set("page", sp.page.trim());
  }
  if (typeof sp.companyId === "string" && sp.companyId.trim()) {
    q.set("companyId", sp.companyId.trim());
  }
  const suffix = q.toString() ? `?${q.toString()}` : "";
  redirect(`/portal/notifications${suffix}`);
}
