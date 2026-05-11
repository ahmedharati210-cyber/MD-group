import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getDolceSignupCompanyId } from "@/lib/dolce-signup-company";
import { SignupInviteShell } from "./signup-invite-shell";

export const metadata: Metadata = {
  title: "التسجيل — Dolce Chocolate",
  robots: { index: false, follow: false },
};

function SignupInviteFallback() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm text-neutral-500">جاري التحميل...</p>
      </div>
    </div>
  );
}

export default function SignupInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<SignupInviteFallback />}>
      <SignupInviteInner params={params} />
    </Suspense>
  );
}

async function SignupInviteInner({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await connection();
  const { token } = await params;
  if (!token || token.length < 8) {
    notFound();
  }

  const admin = createSupabaseAdminClient();
  const dolceCompanyId = await getDolceSignupCompanyId();

  const { data: req } = await admin
    .from("employee_signup_requests")
    .select("id, token_expires_at, token_used, status, company_id")
    .eq("invite_token", token)
    .maybeSingle<{
      id: string;
      token_expires_at: string;
      token_used: boolean;
      status: string;
      company_id: string;
    }>();

  if (!req) {
    notFound();
  }

  const expires = new Date(req.token_expires_at).getTime();
  const expired = Number.isFinite(expires) && expires < Date.now();
  const wrongCompany =
    !!dolceCompanyId && req.company_id !== dolceCompanyId;
  const invalid =
    expired ||
    req.token_used ||
    req.status !== "draft" ||
    wrongCompany;

  const { data: company } = await admin
    .from("companies")
    .select("name_ar")
    .eq("id", req.company_id)
    .maybeSingle<{ name_ar: string }>();

  const companyNameAr = company?.name_ar ?? "الشركة";

  return (
    <SignupInviteShell
      token={token}
      companyNameAr={companyNameAr}
      invalid={invalid}
      expired={expired}
      wrongCompany={wrongCompany}
    />
  );
}
