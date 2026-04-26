import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PortalShell } from "@/components/portal/PortalShell";

export const metadata = {
  title: "لوحة التحكم",
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireUser();

  let companyName: string | null = null;
  if (profile.company_id) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("companies")
      .select("name_ar")
      .eq("id", profile.company_id)
      .single<{ name_ar: string }>();
    companyName = data?.name_ar ?? null;
  }

  return (
    <PortalShell
      role={profile.role}
      fullName={profile.full_name}
      companyName={companyName}
    >
      {children}
    </PortalShell>
  );
}
