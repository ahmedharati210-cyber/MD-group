import Link from "next/link";
import Image from "next/image";
import { Building2, UserPlus } from "lucide-react";
import { DOLCE_EMPLOYEE_SIGNUP_COMPANY_SLUG } from "@/lib/dolce-signup-company";
import { DolceBrandLogo } from "@/components/public/dolce-brand-logo";

export type PublicCompanyCardProps = {
  slug: string;
  name_ar: string;
  name_en: string | null;
  logo_url?: string | null;
};

export function PublicCompanyCard({
  company,
}: {
  company: PublicCompanyCardProps;
}) {
  const isDolce = company.slug === DOLCE_EMPLOYEE_SIGNUP_COMPANY_SLUG;

  return (
    <div className="group relative flex flex-col items-center text-center bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-7 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-primary-300 dark:hover:border-primary-700 transition-all">
      <div className="mb-4 flex w-full justify-center">
        {isDolce ? (
          <DolceBrandLogo className="max-w-[120px] md:max-w-[140px]" />
        ) : company.logo_url ? (
          <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800 shadow-md group-hover:scale-110 transition-transform">
            <Image
              src={company.logo_url}
              alt={company.name_ar}
              fill
              className="object-contain p-1"
            />
          </div>
        ) : (
          <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
            <Building2 className="w-6 h-6 md:w-7 md:h-7 text-white" />
          </div>
        )}
      </div>

      <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-50 mb-1">
        {company.name_ar}
      </h3>
      {company.name_en ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          {company.name_en}
        </p>
      ) : (
        <div className="flex-1 min-h-[0.25rem]" />
      )}

      {isDolce ? (
        <Link
          href="/join"
          className="mt-5 inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm shadow-md hover:bg-primary-700 transition-colors"
        >
          <UserPlus className="w-4 h-4 shrink-0" aria-hidden />
          سجّل كموظف
        </Link>
      ) : null}
    </div>
  );
}
