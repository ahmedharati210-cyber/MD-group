import Link from "next/link";
import { LogIn } from "lucide-react";
import { LoginForm } from "./login-form";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export const metadata = {
  title: "تسجيل الدخول | MD Group",
};

type SearchParams = Promise<{ redirectTo?: string }>;

export default async function LoginPage(props: { searchParams: SearchParams }) {
  const { redirectTo } = await props.searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-primary-50 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 px-4 py-10 sm:py-12">
      <div className="absolute top-4 left-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-6 md:mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-3 mb-5 md:mb-6 group"
          >
            <img
              src="/logo.png"
              alt="MD Group"
              className="w-12 h-12 md:w-14 md:h-14 object-contain"
            />
            <div className="text-right">
              <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-50">
                MD Group
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                منصة الإدارة الداخلية
              </div>
            </div>
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-50 mb-2">
            تسجيل الدخول
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            أدخل بيانات حسابك للوصول إلى منصة MD Group
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl dark:shadow-black/40 border border-gray-100 dark:border-gray-800 p-6 sm:p-8">
          <LoginForm redirectTo={redirectTo} />
        </div>

        <p className="text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-5 md:mt-6 flex items-center justify-center gap-2">
          <LogIn className="w-4 h-4" />
          المنصة مخصصة للموظفين والمدراء فقط
        </p>
      </div>
    </div>
  );
}
