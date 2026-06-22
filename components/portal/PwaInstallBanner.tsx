"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Smartphone } from "lucide-react";
import { getPortalServiceWorkerRegistration } from "@/lib/push/portal-sw";
import { useIsStandalone } from "@/lib/hooks/use-is-standalone";

const DISMISSED_KEY = "pwa-install-dismissed-v2";

function isDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return true;
    const fourteenDays = 14 * 24 * 60 * 60 * 1000;
    return Date.now() - at < fourteenDays;
  } catch {
    return false;
  }
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
  if (/iPad/i.test(ua)) return true;
  // iPadOS 13+ may report as Mac; touch points distinguish it from desktop Mac
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallBanner() {
  const isStandalone = useIsStandalone();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    void getPortalServiceWorkerRegistration();
  }, []);

  useEffect(() => {
    if (isStandalone) return;
    if (isDismissedRecently()) return;
    if (!isMobileDevice()) return;

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

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => setShow(false);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, [isStandalone]);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setShow(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShow(false);
    }
    setDeferredPrompt(null);
  }

  if (isStandalone || !isMobileDevice()) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="pwa-banner"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="print:hidden w-full bg-linear-to-l from-primary-500 to-primary-600 text-white px-4 py-3 z-50 pt-[max(0.75rem,env(safe-area-inset-top))]"
          dir="rtl"
        >
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-white" />
            </div>

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

            <div className="flex items-center gap-2 shrink-0">
              {!isIos && deferredPrompt ? (
                <button
                  type="button"
                  onClick={() => void install()}
                  className="inline-flex items-center gap-1.5 min-h-11 px-3.5 py-2 bg-white text-primary-500 rounded-lg text-sm font-bold hover:bg-white/90 active:scale-95 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  تثبيت
                </button>
              ) : null}
              <button
                type="button"
                onClick={dismiss}
                aria-label="إغلاق"
                className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
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
