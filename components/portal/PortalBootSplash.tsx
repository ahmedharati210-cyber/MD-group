import Image from "next/image";

/**
 * Full-screen branded splash while portal auth/layout data loads.
 * Used as Suspense fallback (cold PWA open) and portal segment loading UI.
 */
export function PortalBootSplash() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-primary-50 dark:bg-gray-950 px-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="جاري تحميل MD Group"
    >
      <span className="inline-flex rounded-2xl bg-white dark:bg-gray-900 shadow-md ring-1 ring-gray-100 dark:ring-gray-800 p-4 animate-pulse">
        <Image
          src="/Logo-MD.png"
          alt="MD Group"
          width={160}
          height={80}
          className="h-20 w-auto object-contain"
          priority
        />
      </span>
      <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">جاري التحميل...</p>
    </div>
  );
}
