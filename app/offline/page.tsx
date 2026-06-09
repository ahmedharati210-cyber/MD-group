"use client";

import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-primary-50 flex flex-col items-center justify-center px-6 text-center"
    >
      {/* Logo */}
      <div className="mb-8">
        <img
          src="/icons/icon-192.png"
          alt="MD Group"
          width={72}
          height={72}
          className="rounded-2xl shadow-md mx-auto"
        />
      </div>

      {/* Icon */}
      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg mb-6 ring-4 ring-primary-500/10">
        <WifiOff className="w-9 h-9 text-primary-500" />
      </div>

      {/* Heading */}
      <h1 className="text-2xl font-bold text-gray-900 mb-3" style={{ fontFamily: "Cairo, sans-serif" }}>
        أنت غير متصل بالإنترنت
      </h1>

      {/* Body */}
      <p className="text-base text-gray-500 max-w-xs leading-relaxed mb-8" style={{ fontFamily: "Cairo, sans-serif" }}>
        تحقق من اتصالك بالإنترنت وحاول مرة أخرى. ستعود الصفحة إلى طبيعتها فور استعادة الاتصال.
      </p>

      {/* Retry button */}
      <button
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-2.5 px-6 py-3 bg-primary-500 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-primary-600 active:scale-95 transition-all"
        style={{ fontFamily: "Cairo, sans-serif" }}
      >
        <RefreshCw className="w-4 h-4" />
        حاول مرة أخرى
      </button>

      {/* Footer */}
      <p className="mt-12 text-xs text-gray-400" style={{ fontFamily: "Cairo, sans-serif" }}>
        MD Group — منصة الإدارة الداخلية
      </p>
    </div>
  );
}
