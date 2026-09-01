import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import {
  buildEmployeeDirectoryWorkbook,
  employeeDirectoryFileName,
  mapProfileToDirectoryRow,
  MD_GROUP_LABEL,
  type EmployeeDirectoryRow,
} from "@/lib/employees/directory-export";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type {
  BloodType,
  ContractType,
  EducationLevel,
  Gender,
  UserRole,
} from "@/types/db";

const companyIdSchema = z.string().uuid();
const statusSchema = z.enum(["active", "inactive"]);
const PROFILE_PAGE_SIZE = 1000;
const AUTH_PAGE_SIZE = 1000;

const PROFILE_SELECT = [
  "id",
  "full_name",
  "phone",
  "job_title",
  "national_id",
  "hired_at",
  "is_active",
  "date_of_birth",
  "gender",
  "nationality",
  "address",
  "department",
  "contract_type",
  "contract_end_date",
  "passport_number",
  "blood_type",
  "education_level",
  "emergency_contact_name",
  "emergency_contact_phone",
  "emergency_contact_relationship",
  "external_employee_number",
  "role",
  "company_id",
  "companies(name_ar)",
].join(", ");

type CompanyJoin = { name_ar: string } | { name_ar: string }[] | null;

type ProfileExportRow = {
  id: string;
  full_name: string;
  phone: string | null;
  job_title: string | null;
  national_id: string | null;
  hired_at: string | null;
  is_active: boolean;
  date_of_birth: string | null;
  gender: Gender | null;
  nationality: string | null;
  address: string | null;
  department: string | null;
  contract_type: ContractType | null;
  contract_end_date: string | null;
  passport_number: string | null;
  blood_type: BloodType | null;
  education_level: EducationLevel | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  external_employee_number: string | null;
  role: UserRole;
  company_id: string | null;
  companies: CompanyJoin;
};

function companyNameOf(join: CompanyJoin): string | null {
  if (!join) return null;
  const row = Array.isArray(join) ? join[0] : join;
  return row?.name_ar ?? null;
}

async function listAllUserEmails(
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<Map<string, string>> {
  const emailMap = new Map<string, string>();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: AUTH_PAGE_SIZE,
    });
    if (error) throw error;
    const users = data?.users ?? [];
    for (const user of users) {
      if (user.email) emailMap.set(user.id, user.email);
    }
    if (users.length < AUTH_PAGE_SIZE) break;
    page += 1;
    if (page > 50) break;
  }
  return emailMap;
}

async function listExportProfiles(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  companyId: string | null,
  status: "active" | "inactive" | null,
): Promise<ProfileExportRow[]> {
  const profiles: ProfileExportRow[] = [];
  let from = 0;
  for (;;) {
    let query = admin
      .from("profiles")
      .select(PROFILE_SELECT)
      .in("role", ["employee", "company_manager", "md_admin"])
      .neq("is_super_admin", true);

    if (companyId) query = query.eq("company_id", companyId);
    if (status) query = query.eq("is_active", status === "active");

    const { data, error } = await query
      .order("full_name", { ascending: true })
      .range(from, from + PROFILE_PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data ?? []) as unknown as ProfileExportRow[];
    profiles.push(...batch);
    if (batch.length < PROFILE_PAGE_SIZE) break;
    from += PROFILE_PAGE_SIZE;
  }
  return profiles;
}

export async function GET(req: NextRequest) {
  const current = await requireRole(["md_admin", "company_manager", "owner"]);

  const rawCompanyId = req.nextUrl.searchParams.get("companyId") || null;
  if (rawCompanyId && !companyIdSchema.safeParse(rawCompanyId).success) {
    return NextResponse.json({ error: "معرّف الشركة غير صالح" }, { status: 400 });
  }

  const rawStatus = req.nextUrl.searchParams.get("status") || null;
  if (rawStatus && !statusSchema.safeParse(rawStatus).success) {
    return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
  }
  const status = rawStatus as "active" | "inactive" | null;

  let scopedCompanyId: string | null = rawCompanyId;

  if (current.profile.role === "company_manager") {
    if (!current.profile.company_id) {
      return NextResponse.json(
        { error: "لم يتم ربط حسابك بشركة." },
        { status: 403 },
      );
    }
    scopedCompanyId = current.profile.company_id;
  }

  const admin = createSupabaseAdminClient();

  let profiles: ProfileExportRow[];
  let emailMap: Map<string, string>;
  try {
    [profiles, emailMap] = await Promise.all([
      listExportProfiles(admin, scopedCompanyId, status),
      listAllUserEmails(admin),
    ]);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "تعذّر تحميل بيانات الموظفين";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const rows: EmployeeDirectoryRow[] = profiles
    .map((profile) =>
      mapProfileToDirectoryRow({
        full_name: profile.full_name,
        phone: profile.phone,
        job_title: profile.job_title,
        national_id: profile.national_id,
        hired_at: profile.hired_at,
        is_active: profile.is_active,
        date_of_birth: profile.date_of_birth,
        gender: profile.gender,
        nationality: profile.nationality,
        address: profile.address,
        department: profile.department,
        contract_type: profile.contract_type,
        contract_end_date: profile.contract_end_date,
        passport_number: profile.passport_number,
        blood_type: profile.blood_type,
        education_level: profile.education_level,
        emergency_contact_name: profile.emergency_contact_name,
        emergency_contact_phone: profile.emergency_contact_phone,
        emergency_contact_relationship: profile.emergency_contact_relationship,
        external_employee_number: profile.external_employee_number,
        role: profile.role,
        companyName: companyNameOf(profile.companies),
        email: emailMap.get(profile.id) ?? null,
      }),
    )
    .sort((a, b) => {
      const aIsMdGroup = a.companyName === MD_GROUP_LABEL;
      const bIsMdGroup = b.companyName === MD_GROUP_LABEL;
      if (aIsMdGroup !== bIsMdGroup) return aIsMdGroup ? -1 : 1;
      const byCompany = a.companyName.localeCompare(b.companyName, "ar");
      if (byCompany !== 0) return byCompany;
      return a.fullName.localeCompare(b.fullName, "ar");
    });

  const buffer = await buildEmployeeDirectoryWorkbook(rows);
  const fileName = employeeDirectoryFileName();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
