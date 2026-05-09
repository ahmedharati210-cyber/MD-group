import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { ThemeProvider, themeInitScript } from "@/components/theme/ThemeProvider";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MD Group - منصة الإدارة الداخلية",
    template: "%s | MD Group",
  },
  description:
    "MD Group — منصة إدارة الشركات الداخلية: الموظفون، الحضور، الأوراق الرسمية، البريد، وجهات الاتصال.",
  keywords: "MD Group, إدارة, موارد بشرية, أوراق رسمية, شركات",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/Icon-MD.png", sizes: "any", type: "image/png" },
    ],
    apple: [
      { url: "/Icon-MD.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#8c6032" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className={cairo.variable}>
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
                "!bg-white dark:!bg-gray-900 !text-gray-900 dark:!text-gray-100 !border !border-gray-200 dark:!border-gray-800",
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
