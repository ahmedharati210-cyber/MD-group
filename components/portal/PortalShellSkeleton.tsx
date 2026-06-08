/**
 * Skeleton that mirrors the PortalShell chrome while AuthenticatedPortal
 * resolves (auth + company + badges). Replaces the full-screen logo splash
 * so the transition to the real shell is smooth.
 *
 * Structure mirrors PortalShell exactly:
 *  - Mobile: sticky top header (min-h-14) with icon / title placeholders
 *  - Desktop (md+): fixed right sidebar (w-64) with nav-item placeholders
 *  - Content area: neutral page background so per-route loading.tsx shows inside it
 */
export function PortalShellSkeleton() {
  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-gray-950"
      role="status"
      aria-label="جاري التحميل…"
      aria-live="polite"
      aria-busy="true"
    >
      {/* ── Mobile header (hidden md+) ── */}
      <header className="md:hidden print:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 min-h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        {/* Hamburger placeholder */}
        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
        {/* Logo + title placeholder */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <div className="w-20 h-4 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
        </div>
        {/* Actions placeholder */}
        <div className="flex items-center gap-1">
          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
        </div>
      </header>

      {/* ── Desktop sidebar (right side, hidden below md) ── */}
      <aside className="hidden md:flex print:hidden fixed inset-y-0 right-0 z-40 w-64 flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800">
        {/* Sidebar header: logo + company name */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-24 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
            <div className="h-3 w-16 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ opacity: 1 - i * 0.08 }}
            >
              <div className="w-5 h-5 rounded bg-gray-100 dark:bg-gray-800 animate-pulse flex-shrink-0" />
              <div
                className="h-3.5 rounded bg-gray-100 dark:bg-gray-800 animate-pulse"
                style={{ width: `${60 + (i % 3) * 15}%` }}
              />
            </div>
          ))}
        </nav>

        {/* Sidebar footer: avatar + name */}
        <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-800">
          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-20 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
            <div className="h-2.5 w-14 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
          </div>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div className="md:mr-64">
        <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
          {/* Placeholder so per-route loading.tsx can render here */}
        </main>
      </div>
    </div>
  );
}
