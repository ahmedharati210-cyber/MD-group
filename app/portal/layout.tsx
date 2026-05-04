import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getVisibleFeatures } from "@/lib/features";
import { PortalShell } from "@/components/portal/PortalShell";
import type { AppFeature, RoleFeatures } from "@/types/db";

export const metadata: import("next").Metadata = {
  title: "لوحة التحكم",
  applicationName: "MD Group",
  manifest: "/portal-manifest.json",
  appleWebApp: {
    capable: true,
    title: "MD Group",
    statusBarStyle: "default",
  },
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  let companyName: string | null = null;
  let enabledFeatures: AppFeature[] | null = null;
  let roleFeatures: RoleFeatures | null = null;

  if (profile.company_id) {
    const { data } = await supabase
      .from("companies")
      .select("name_ar, enabled_features, role_features")
      .eq("id", profile.company_id)
      .single<{
        name_ar: string;
        enabled_features: AppFeature[] | null;
        role_features: RoleFeatures | null;
      }>();
    companyName = data?.name_ar ?? null;
    enabledFeatures = data?.enabled_features ?? null;
    roleFeatures = data?.role_features ?? null;
  }

  // Sidebar notification badges
  const isSuperAdmin = profile.is_super_admin ?? false;
  const visibleFeatures = getVisibleFeatures(profile.role, enabledFeatures, roleFeatures, isSuperAdmin);

  const requestsVisible = visibleFeatures === null || visibleFeatures.includes("requests");
  const warningsVisible = visibleFeatures === null || visibleFeatures.includes("warnings");
  const isEmployee = profile.role === "employee";

  const [pendingRequestsResult, unreadWarningsResult] = await Promise.all([
    requestsVisible
      ? (isEmployee
          ? supabase.from("engineer_requests").select("id", { count: "exact", head: true }).eq("status", "pending").eq("requester_id", profile.id ?? "")
          : supabase.from("engineer_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
        )
      : Promise.resolve({ count: 0 }),
    // Only employees receive warnings — show badge for their unread ones.
    warningsVisible && isEmployee
      ? supabase
          .from("warnings")
          .select("id", { count: "exact", head: true })
          .eq("is_read", false)
          .or(`target_profile_id.eq.${profile.id ?? ""},target_profile_id.is.null`)
      : Promise.resolve({ count: 0 }),
  ]);

  const pendingRequestsCount = pendingRequestsResult.count ?? 0;
  const unreadWarningsCount = unreadWarningsResult.count ?? 0;

  return (
    <PortalShell
      role={profile.role}
      fullName={profile.full_name}
      companyId={profile.company_id}
      companyName={companyName}
      isSuperAdmin={isSuperAdmin}
      enabledFeatures={enabledFeatures}
      roleFeatures={roleFeatures}
      pendingRequestsCount={pendingRequestsCount}
      unreadWarningsCount={unreadWarningsCount}
    >
      {children}
    </PortalShell>
  );
}
