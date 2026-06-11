import Image from "next/image";
import Link from "next/link";
import { cacheLife } from "next/cache";
import {
  PUBLIC_ADDRESS,
  PUBLIC_EMAIL,
  PUBLIC_PHONE_DISPLAY,
  PUBLIC_PHONE_TEL,
} from "@/lib/public-contact";

export async function PublicFooter() {
  "use cache";
  cacheLife("days");
  return (
    <footer className="bg-linear-to-br from-gray-900 via-gray-900 to-gray-800 text-white border-t border-gray-800">
      <div className="container-custom">
        <div className="py-14">
          <div className="grid md:grid-cols-3 gap-12 mb-10">
            <div>
              <div className="mb-5">
                <span className="inline-flex rounded-xl bg-white shadow-xs p-2">
                  <Image
                    src="/Logo-MD.png"
                    alt="MD Group Holding Company"
                    className="h-20 w-auto object-contain"
                    width={160}
                    height={80}
                    sizes="160px"
                  />
                </span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                مجموعة أعمال تضمّ عدّة شركات تعمل في قطاعات متنوّعة تحت إدارة
                موحّدة.
              </p>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-5">روابط سريعة</h4>
              <ul className="space-y-3">
                <li>
                  <Link
                    href="/"
                    className="text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    الرئيسية
                  </Link>
                </li>
                <li>
                  <Link
                    href="/about"
                    className="text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    عن المجموعة
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    اتصل بنا
                  </Link>
                </li>
                <li>
                  <Link
                    href="/login"
                    className="text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    تسجيل الدخول
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-5">معلومات التواصل</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li>
                  <a
                    href={`tel:${PUBLIC_PHONE_TEL}`}
                    className="hover:text-white transition-colors"
                    dir="ltr"
                  >
                    {PUBLIC_PHONE_DISPLAY}
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${PUBLIC_EMAIL}`}
                    className="hover:text-white transition-colors"
                  >
                    {PUBLIC_EMAIL}
                  </a>
                </li>
                <li>{PUBLIC_ADDRESS}</li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-800">
            <p className="text-gray-400 text-sm text-center">
              © {new Date().getFullYear()} MD Group. جميع الحقوق محفوظة.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
