import type { CSSProperties } from "react";

/**
 * Skeleton that mirrors the PortalShell chrome while AuthenticatedPortal
 * resolves (auth + company + badges).
 *
 * Uses inline styles + a tiny embedded <style> so the shell paints on FCP
 * before the external Tailwind CSS bundle is downloaded and parsed.
 */
const colors = {
  page: "#f9fafb",
  surface: "#ffffff",
  block: "#f3f4f6",
  border: "#e5e7eb",
} as const;

const pulseClass = "portal-skel-pulse";

const embeddedStyles = `
@keyframes portal-skel-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
.${pulseClass} { animation: portal-skel-pulse 2s ease-in-out infinite; }
.portal-skel-mobile-header { display: flex; }
.portal-skel-sidebar { display: none; }
.portal-skel-main { margin-right: 0; }
@media (min-width: 768px) {
  .portal-skel-mobile-header { display: none !important; }
  .portal-skel-sidebar { display: flex !important; }
  .portal-skel-main { margin-right: 16rem; }
}
`;

function Block({
  width,
  height,
  borderRadius = 8,
  style,
}: {
  width: number | string;
  height: number | string;
  borderRadius?: number | string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={pulseClass}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: colors.block,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

export function PortalShellSkeleton() {
  return (
    <div
      role="status"
      aria-label="جاري التحميل…"
      aria-live="polite"
      aria-busy="true"
      style={{
        minHeight: "100vh",
        backgroundColor: colors.page,
        margin: 0,
        padding: 0,
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: embeddedStyles }} />

      {/* Mobile header */}
      <header
        className="portal-skel-mobile-header"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "0 16px",
          minHeight: 56,
          backgroundColor: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <Block width={32} height={32} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Block width={32} height={32} />
          <Block width={80} height={16} borderRadius={4} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Block width={32} height={32} />
          <Block width={32} height={32} />
        </div>
      </header>

      {/* Desktop sidebar (RTL: fixed right) */}
      <aside
        className="portal-skel-sidebar"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          width: 256,
          flexDirection: "column",
          backgroundColor: colors.surface,
          borderLeft: `1px solid ${colors.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px",
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <Block width={36} height={36} borderRadius={12} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <Block width={96} height={14} borderRadius={4} />
            <Block width={64} height={12} borderRadius={4} />
          </div>
        </div>

        <nav
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 12,
                opacity: 1 - i * 0.08,
              }}
            >
              <Block width={20} height={20} borderRadius={4} />
              <Block
                width={`${60 + (i % 3) * 15}%`}
                height={14}
                borderRadius={4}
                style={{ flex: 1 }}
              />
            </div>
          ))}
        </nav>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <Block width={32} height={32} borderRadius="50%" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <Block width={80} height={12} borderRadius={4} />
            <Block width={56} height={10} borderRadius={4} />
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="portal-skel-main">
        <main
          style={{
            padding: "16px",
            maxWidth: 1280,
            margin: "0 auto",
          }}
        />
      </div>
    </div>
  );
}
