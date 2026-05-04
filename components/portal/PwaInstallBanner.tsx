"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Smartphone } from "lucide-react";

const DISMISSED_KEY = "pwa-install-dismissed-v1";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Register service worker scoped to /portal only
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/portal/" })
        .catch(() => {
          // SW registration failure is non-fatal
        });
    }

    // Already installed as standalone app — don't show banner
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Already dismissed — don't show again
    if (localStorage.getItem(DISMISSED_KEY)) return;

    // iOS Safari detection — no beforeinstallprompt event on iOS
    const ua = window.navigator.userAgent;
    const isIosSafari =
      /iphone|ipad|ipod/i.test(ua) &&
      /safari/i.test(ua) &&
      !/crios|fxios|opios|mercury/i.test(ua) &&
      !(window.navigator as Navigator & { standalone?: boolean }).standalone;

    if (isIosSafari) {
      setIsIos(true);
      setShow(true);
      return;
    }

    // Chrome/Edge/Android — capture the prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Auto-hide once the user installs
    const installedHandler = () => {
      setShow(false);
      setIsInstalled(true);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShow(false);
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  }

  if (isInstalled) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="pwa-banner"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="print:hidden w-full bg-gradient-to-l from-[#8c6032] to-[#704d28] text-white px-4 py-3 z-50"
          dir="rtl"
        >
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            {/* Icon */}
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-white" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">ثبّت التطبيق على جهازك</p>
              {isIos ? (
                <p className="text-xs text-white/80 mt-0.5">
                  اضغط على <strong>مشاركة</strong> ثم <strong>إضافة إلى الشاشة الرئيسية</strong>
                </p>
              ) : (
                <p className="text-xs text-white/80 mt-0.5">
                  للوصول السريع بدون متصفح
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {!isIos && deferredPrompt && (
                <button
                  onClick={install}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-[#8c6032] rounded-lg text-sm font-bold hover:bg-white/90 active:scale-95 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  تثبيت
                </button>
              )}
              <button
                onClick={dismiss}
                aria-label="إغلاق"
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
