import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDolceSignupCompanyId } from "@/lib/dolce-signup-company";
import { InviteLinkGenerator } from "@/components/portal/InviteLinkGenerator";
import {
  SignupInvitesList,
  type SignupInviteRow,
} from "@/components/portal/SignupInvitesList";

export async function DolceSignupInvitesSection({
  companyNameAr,
}: {
  companyNameAr: string;
}) {
  const dolceId = await getDolceSignupCompanyId();
  if (!dolceId) return null;

  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("employee_signup_invites")
    .select(
      "id, invite_token, token_expires_at, max_uses, use_count, created_at",
    )
    .eq("company_id", dolceId)
    .order("created_at", { ascending: false });

  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  const invites: SignupInviteRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    invite_url: `${base}/signup/${r.invite_token}`,
    token_expires_at: r.token_expires_at,
    max_uses: r.max_uses,
    use_count: r.use_count,
    created_at: r.created_at,
  }));

  return (
    <div className="space-y-6 mb-8">
      <InviteLinkGenerator companyNameAr={companyNameAr} />
      <SignupInvitesList invites={invites} />
    </div>
  );
}
