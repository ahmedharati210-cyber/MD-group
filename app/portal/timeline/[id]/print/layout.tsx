import { requireUser } from "@/lib/auth";

// Standalone print layout — no sidebar chrome.
// Cannot use <html>/<body> here (root layout owns those).
// The portal sidebar is hidden on print via print:hidden in PortalShell.
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <>{children}</>;
}
