import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white border-t border-gray-800">
      <div className="container-custom">
        <div className="py-14">
          <div className="grid md:grid-cols-3 gap-12 mb-10">
            <div>
              <div className="flex items-center gap-4 mb-5">
                <img
                  src="/logo.png"
                  alt="MD Group"
                  className="w-16 h-16 object-contain flex-shrink-0"
                  width={64}
                  height={64}
                />
                <div>
                  <h3 className="text-lg font-bold">MD Group</h3>
                  <p className="text-xs text-gray-400">
                    مجموعة شركات متكاملة
                  </p>
                </div>
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
                    href="mailto:info@mdgroup.ly"
                    className="hover:text-white transition-colors"
                  >
                    info@mdgroup.ly
                  </a>
                </li>
                <li>طرابلس – ليبيا</li>
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
