import { Suspense } from "react";
import Link from "next/link";
import { Loader2, LogIn } from "lucide-react";
import { LoginForm } from "./login-form";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export const metadata = {
  title: "تسجيل الدخول | MD Group",
};

type SearchParams = Promise<{ redirectTo?: string }>;

/**
 * Sync outer component — static shell (background, logo, heading).
 * LoginContent (which reads searchParams) is wrapped in Suspense
 * so it can stream without blocking the static shell.
 */
export default function LoginPage(props: { searchParams: SearchParams }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-primary-50 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 px-4 py-10 sm:py-12">
      <div className="absolute top-4 left-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-6 md:mb-8">
          <Link
            href="/"
            className="inline-flex flex-col items-center gap-4 mb-5 md:mb-6 group"
          >
            <span className="inline-flex rounded-2xl bg-white shadow-md ring-1 ring-gray-100 p-3 transition-transform group-hover:scale-105">
              <img
                src="/Logo-MD.png"
                alt="MD Group Holding Company"
                className="h-20 w-auto object-contain"
                width={160}
                height={80}
              />
            </span>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              منصة الإدارة الداخلية
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
          <Suspense
            fallback={
              <div className="flex justify-center py-10" aria-busy="true">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
              </div>
            }
          >
            <LoginContent searchParams={props.searchParams} />
          </Suspense>
        </div>

        <p className="text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-5 md:mt-6 flex items-center justify-center gap-2">
          <LogIn className="w-4 h-4" />
          المنصة مخصصة للموظفين والمدراء فقط
        </p>
      </div>
    </div>
  );
}

/** Async inner component — reads searchParams (dynamic per-request data). */
async function LoginContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { redirectTo } = await searchParams;
  return <LoginForm redirectTo={redirectTo} />;
}
