import type { Metadata } from "next";
import { DolceBrandLogo } from "@/components/public/dolce-brand-logo";
import { JoinForm } from "./join-form";

export const metadata: Metadata = {
  title: "تسجيل موظف — Dolce",
  description:
    "تقديم طلب انضمام كموظف في Dolce Chocolate — شركة الطريق الصحيح ضمن مجموعة MD.",
};

const DOLCE_NAME_AR = "شركة الطريق الصحيح";
const DOLCE_NAME_EN = "Dolce Chocolate";

export default function JoinPage() {
  return (
    <div className="section-padding bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
      <div className="container-custom max-w-2xl mx-auto">
        <header className="text-center mb-8 md:mb-10">
          <DolceBrandLogo className="max-w-[200px] mb-6" priority />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-50 mb-2">
            تسجيل موظف
          </h1>
          <p className="text-lg font-semibold text-primary-700 dark:text-primary-300">
            {DOLCE_NAME_AR}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {DOLCE_NAME_EN}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-4 max-w-md mx-auto leading-relaxed">
            املأ النموذج أدناه لتقديم طلب انضمام. سيتم مراجعة طلبك من قبل
            إدارة الشركة قبل تفعيل حسابك.
          </p>
          <div className="w-20 h-1 bg-gradient-to-r from-secondary-500 to-primary-500 mx-auto rounded-full mt-5" />
        </header>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 sm:p-8">
          <JoinForm companyNameAr={DOLCE_NAME_AR} />
        </div>
      </div>
    </div>
  );
}
