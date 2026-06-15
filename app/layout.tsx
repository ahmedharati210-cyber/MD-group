import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "react-hot-toast";
import { ThemeProvider, themeInitScript } from "@/components/theme/ThemeProvider";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "600"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MD Group - منصة الإدارة الداخلية",
    template: "%s | MD Group",
  },
  description:
    "MD Group — منصة إدارة الشركات الداخلية: الموظفون، الأوراق الرسمية، البريد، وجهات الاتصال.",
  keywords: "MD Group, إدارة, موارد بشرية, أوراق رسمية, شركات",
  manifest: "/portal-manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#8c6032" },
    { media: "(prefers-color-scheme: dark)", color: "#030712" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning data-scroll-behavior="smooth" className={cairo.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased font-sans m-0 p-0 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <ThemeProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                fontFamily: "var(--font-cairo), sans-serif",
                direction: "rtl",
              },
              className:
                "bg-white! dark:bg-gray-900! text-gray-900! dark:text-gray-100! border! border-gray-200! dark:border-gray-800!",
            }}
          />
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
