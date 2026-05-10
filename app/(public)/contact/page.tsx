import { Phone, Mail, MapPin } from "lucide-react";
import {
  PUBLIC_ADDRESS,
  PUBLIC_EMAIL,
  PUBLIC_PHONE_DISPLAY,
  PUBLIC_PHONE_TEL,
} from "@/lib/public-contact";

export const metadata = {
  title: "اتصل بنا",
};

const cardFocusPhone =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950";

const cardFocusEmail =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <section className="relative bg-gradient-to-br from-accent-dark via-gray-800 to-accent-dark dark:from-gray-950 dark:via-gray-900 dark:to-black text-white section-padding overflow-hidden">
        <div className="container-custom relative">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-5 md:mb-6">
              اتصل بنا
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
              للاستفسارات العامة والتواصل مع إدارة MD Group
            </p>
          </div>
        </div>
      </section>

      <section className="section-padding bg-white dark:bg-gray-950">
        <div className="container-custom">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 md:gap-6 max-w-5xl mx-auto items-stretch">
            <a
              href={`tel:${PUBLIC_PHONE_TEL}`}
              aria-label={`الاتصال على الرقم ${PUBLIC_PHONE_DISPLAY}`}
              className={
                "card card-hover group flex flex-col items-center justify-center " +
                "p-6 md:p-8 text-center min-h-[11rem] sm:min-h-[12rem] " +
                "bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-900/30 dark:to-primary-900/10 " +
                "border-2 border-primary-200 dark:border-primary-800 shadow-lg " +
                "transition-transform active:scale-[0.99] motion-reduce:active:scale-100 " +
                cardFocusPhone
              }
            >
              <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-5 md:mb-6 shadow-md pointer-events-none">
                <Phone className="w-7 h-7 md:w-8 md:h-8 text-white" aria-hidden />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-50 mb-3 pointer-events-none">
                الهاتف
              </h3>
              <span
                dir="ltr"
                className="text-primary-700 dark:text-primary-300 group-hover:text-primary-800 dark:group-hover:text-primary-200 text-base md:text-lg font-semibold transition-colors pointer-events-none"
              >
                {PUBLIC_PHONE_DISPLAY}
              </span>
            </a>

            <a
              href={`mailto:${PUBLIC_EMAIL}`}
              aria-label={`إرسال بريد إلكتروني إلى ${PUBLIC_EMAIL}`}
              className={
                "card card-hover group flex flex-col items-center justify-center " +
                "p-6 md:p-8 text-center min-h-[11rem] sm:min-h-[12rem] " +
                "bg-gradient-to-br from-secondary-50 to-secondary-100/50 dark:from-secondary-900/30 dark:to-secondary-900/10 " +
                "border-2 border-secondary-200 dark:border-secondary-800 shadow-lg " +
                "transition-transform active:scale-[0.99] motion-reduce:active:scale-100 " +
                cardFocusEmail
              }
            >
              <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-secondary-500 to-secondary-600 rounded-2xl flex items-center justify-center mx-auto mb-5 md:mb-6 shadow-md pointer-events-none">
                <Mail className="w-7 h-7 md:w-8 md:h-8 text-white" aria-hidden />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-50 mb-3 pointer-events-none">
                البريد الإلكتروني
              </h3>
              <span className="text-secondary-700 dark:text-secondary-300 group-hover:text-secondary-800 dark:group-hover:text-secondary-200 text-base md:text-lg font-semibold break-all transition-colors pointer-events-none">
                {PUBLIC_EMAIL}
              </span>
            </a>

            <div
              className={
                "card flex flex-col items-center justify-center " +
                "p-6 md:p-8 text-center min-h-[11rem] sm:min-h-[12rem] " +
                "sm:col-span-2 md:col-span-1 " +
                "bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-900/30 dark:to-primary-900/10 " +
                "border-2 border-primary-200 dark:border-primary-800 shadow-lg"
              }
            >
              <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center mx-auto mb-5 md:mb-6 shadow-md">
                <MapPin className="w-7 h-7 md:w-8 md:h-8 text-white" aria-hidden />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-50 mb-3">
                العنوان
              </h3>
              <p className="text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
                {PUBLIC_ADDRESS}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
