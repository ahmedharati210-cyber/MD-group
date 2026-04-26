import {
  ShieldCheck,
  Users,
  Target,
  Award,
  Compass,
  Handshake,
} from "lucide-react";

export const metadata = {
  title: "عن المجموعة",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <section className="relative bg-gradient-to-br from-accent-dark via-gray-800 to-accent-dark dark:from-gray-950 dark:via-gray-900 dark:to-black text-white section-padding overflow-hidden">
        <div className="container-custom relative">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-5 md:mb-6">
              عن المجموعة
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
              مجموعة أعمال تقدّم خدمات متنوّعة بجودة وثقة
            </p>
          </div>
        </div>
      </section>

      <section className="section-padding bg-white dark:bg-gray-950">
        <div className="container-custom">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10 md:mb-12">
              <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-gray-50 mb-4">
                من نحن
              </h2>
              <div className="w-24 h-1 bg-gradient-to-r from-secondary-500 to-primary-500 mx-auto rounded-full"></div>
            </div>
            <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-900/60 rounded-3xl p-6 sm:p-10 md:p-14 shadow-xl dark:shadow-black/40 border-2 border-gray-100 dark:border-gray-800">
              <p className="text-base sm:text-lg md:text-xl text-gray-800 dark:text-gray-200 leading-relaxed mb-6 text-center">
                <strong className="text-primary-700 dark:text-primary-300">
                  MD Group
                </strong>{" "}
                هي مجموعة أعمال تضمّ عدّة شركات تعمل في قطاعات متنوّعة تحت
                إدارة موحّدة. نحرص على تقديم خدمات موثوقة وجودة مستدامة تواكب
                احتياجات عملائنا وشركائنا.
              </p>
              <p className="text-sm sm:text-base md:text-lg text-gray-700 dark:text-gray-300 leading-relaxed text-center">
                تعمل كلّ شركة من شركات المجموعة في مجالها بكفاءة واستقلالية، مع
                الاستفادة من الخبرة الإدارية والمرجعية المشتركة التي تضمن مستوى
                عالٍ من الأداء والانضباط.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="container-custom">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-gray-50 mb-4">
              قيمنا الأساسية
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-secondary-500 to-primary-500 mx-auto rounded-full mt-4"></div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-7xl mx-auto">
            {[
              {
                icon: ShieldCheck,
                title: "الثقة والمصداقية",
                desc: "نبني شراكاتنا على الثقة، والالتزام الكامل بتعهّداتنا.",
              },
              {
                icon: Compass,
                title: "رؤية واضحة",
                desc: "نعمل وفق خطط مدروسة تحقّق أهدافاً ملموسة على المدى الطويل.",
              },
              {
                icon: Users,
                title: "فريق مؤهَّل",
                desc: "كوادر بشرية متخصّصة تقدّم الخدمة بكفاءة واحترافية.",
              },
              {
                icon: Target,
                title: "جودة في التنفيذ",
                desc: "نحرص على الإتقان في كلّ التفاصيل وعلى رضا عملائنا.",
              },
              {
                icon: Handshake,
                title: "علاقات طويلة الأمد",
                desc: "نسعى لبناء شراكات مستدامة تتخطّى نطاق الخدمة الواحدة.",
              },
              {
                icon: Award,
                title: "التطوّر المستمر",
                desc: "نستثمر في التطوير المستمر ومواكبة أفضل الممارسات.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center mb-5 shadow-md group-hover:scale-110 transition-transform">
                  <Icon className="w-6 h-6 md:w-7 md:h-7 text-white" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-50 mb-3">
                  {title}
                </h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
