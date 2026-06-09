import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/portal/PageHeader";
import { SettingsForm } from "./settings-form";
import { AppearanceCard } from "./appearance-card";
import { PushNotificationsCard } from "@/components/portal/PushNotificationsCard";
import { LogoutButton } from "@/components/portal/LogoutButton";
import { AvatarUpload } from "./avatar-upload";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = { title: "الإعدادات" };

export default async function SettingsPage() {
  const { profile } = await requireUser();

  return (
    <div className="max-w-2xl space-y-5 sm:space-y-6">
      <PageHeader
        title="الإعدادات"
        description="تعديل معلومات حسابك والمظهر."
      />
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-xs">
        <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-50 mb-4">
          الصورة الشخصية
        </h2>
        <AvatarUpload currentUrl={profile.avatar_url} fullName={profile.full_name} />
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-xs">
        <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-50 mb-4">
          المعلومات الشخصية
        </h2>
        <SettingsForm
          profileId={profile.id}
          fullName={profile.full_name}
          phone={profile.phone}
          jobTitle={profile.job_title}
        />
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-xs">
        <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-50 mb-1">
          كلمة المرور
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          اترك الحقلين فارغَين إذا لم ترد تغيير كلمة المرور.
        </p>
        <ChangePasswordForm />
      </div>
      <PushNotificationsCard />
      <AppearanceCard />
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-xs">
        <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-50 mb-1">
          تسجيل الخروج
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          إنهاء الجلسة على هذا الجهاز والعودة إلى صفحة تسجيل الدخول.
        </p>
        <LogoutButton variant="full" />
      </div>
    </div>
  );
}
