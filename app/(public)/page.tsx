import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  Compass,
  Handshake,
  Sparkles,
} from "lucide-react";
import { cacheTag, cacheLife } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { Company } from "@/types/db";

// Uses the anon Supabase client (no cookies) so 'use cache' creates a single
// shared entry across all visitors rather than per-session.
async function getCompanies(): Promise<Company[]> {
  "use cache";
  cacheTag("public-companies");
  cacheLife("minutes");
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data } = await supabase
      .from("companies")
      .select("*")
      .eq("active", true)
      .order("name_ar");
    return (data ?? []) as unknown as Company[];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const companies = await getCompanies();

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-accent-dark via-gray-800 to-accent-dark dark:from-gray-950 dark:via-gray-900 dark:to-black text-white overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='100' height='100' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 100 0 L 0 0 0 100' fill='none' stroke='%23ffffff' stroke-width='0.5' opacity='0.1'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100' height='100' fill='url(%23grid)'/%3E%3C/svg%3E")`,
          }}
        ></div>
        <div className="container-custom relative pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-block px-4 py-1.5 bg-secondary-500/20 border border-secondary-400/30 rounded-full mb-5 md:mb-6">
              <span className="text-secondary-200 text-xs sm:text-sm font-semibold">
                مجموعة MD
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-5 md:mb-6 leading-tight">
              مجموعة MD
              <br />
              <span className="text-secondary-300">
                خبرة تمتدّ عبر القطاعات
              </span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-300 mb-8 md:mb-10 leading-relaxed max-w-2xl mx-auto">
              مجموعة شركات تعمل في قطاعات متنوّعة، نسعى لتقديم خدمات موثوقة
              بجودة عالية وإدارة احترافية تواكب تطلّعات عملائنا وشركائنا.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link
                href="/about"
                className="px-6 sm:px-8 py-3 sm:py-4 bg-secondary-500 text-white rounded-xl font-semibold hover:bg-secondary-600 transition-all shadow-xl hover:-translate-y-0.5 inline-flex items-center justify-center gap-2"
              >
                تعرّف علينا
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <Link
                href="/contact"
                className="px-6 sm:px-8 py-3 sm:py-4 bg-white/10 text-white border-2 border-white/30 rounded-xl font-semibold hover:bg-white/20 transition-all inline-flex items-center justify-center gap-2"
              >
                <Phone className="w-5 h-5" />
                اتصل بنا
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="section-padding bg-white dark:bg-gray-950">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-gray-900 dark:text-gray-50 mb-5 md:mb-6">
              من نحن
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-secondary-500 to-primary-500 mx-auto rounded-full mb-6 md:mb-8"></div>
            <p className="text-base sm:text-lg md:text-xl text-gray-700 dark:text-gray-300 leading-relaxed">
              <strong className="text-primary-700 dark:text-primary-300">
                MD Group
              </strong>{" "}
              هي مجموعة أعمال تضمّ عدة شركات تعمل تحت إدارة موحّدة، وتقدّم
              خدمات متنوّعة في عدة مجالات. نركّز على الجودة، الالتزام، وبناء
              علاقات طويلة الأمد مع عملائنا.
            </p>
          </div>
        </div>
      </section>

      {/* Companies */}
      <section className="section-padding bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="container-custom">
          <div className="text-center mb-10 md:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-gray-900 dark:text-gray-50 mb-4">
              شركات المجموعة
            </h2>
            <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              شركات تعمل تحت مظلّة المجموعة، لكل منها هويتها ومجال نشاطها.
            </p>
            <div className="w-24 h-1 bg-gradient-to-r from-secondary-500 to-primary-500 mx-auto rounded-full mt-4"></div>
          </div>

          {companies.length === 0 ? (
            <div className="max-w-xl mx-auto p-8 bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl text-center">
              <Building2 className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                سيتم عرض شركات المجموعة قريبًا.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 max-w-6xl mx-auto">
              {companies.map((c) => (
                <div
                  key={c.id}
                  className="group relative bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-7 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-primary-300 dark:hover:border-primary-700 transition-all"
                >
                  <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform mb-4">
                    <Building2 className="w-6 h-6 md:w-7 md:h-7 text-white" />
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-50 mb-1">
                    {c.name_ar}
                  </h3>
                  {c.name_en ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                      {c.name_en}
                    </p>
                  ) : null}
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    عضو في مجموعة MD.
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Values */}
      <section className="section-padding bg-white dark:bg-gray-950">
        <div className="container-custom">
          <div className="text-center mb-10 md:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-gray-900 dark:text-gray-50 mb-4">
              ما يميّزنا
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-secondary-500 to-primary-500 mx-auto rounded-full mt-4"></div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 max-w-6xl mx-auto">
            {[
              {
                icon: Compass,
                title: "رؤية واضحة",
                desc: "نعمل بخطط مدروسة وأهداف واضحة تحقّق قيمة مستدامة لعملائنا وشركائنا.",
              },
              {
                icon: Handshake,
                title: "الالتزام والثقة",
                desc: "نبني علاقاتنا على الالتزام بالمواعيد وجودة التنفيذ والشفافية في التعامل.",
              },
              {
                icon: Sparkles,
                title: "جودة في التفاصيل",
                desc: "نركّز على التفاصيل التي تصنع الفرق، ونحرص على الإتقان في كلّ ما نقدّمه.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-7 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all"
              >
                <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/40 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-2">
                  {title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="section-padding bg-gradient-to-br from-accent-dark via-gray-800 to-accent-dark dark:from-gray-950 dark:via-gray-900 dark:to-black text-white">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-5 md:mb-6">
              هل تودّ التواصل معنا؟
            </h2>
            <p className="text-base md:text-lg text-gray-300 mb-8 max-w-xl mx-auto">
              يسعدنا استقبال استفساراتكم واقتراحاتكم في أيّ وقت.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-secondary-500 rounded-xl font-semibold hover:bg-secondary-600 transition-all shadow-xl"
              >
                <Mail className="w-5 h-5" />
                تواصل معنا
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-white/10 border-2 border-white/30 rounded-xl font-semibold hover:bg-white/20 transition-all"
              >
                <MapPin className="w-5 h-5" />
                تعرّف علينا أكثر
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
