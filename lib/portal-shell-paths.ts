/**
 * Company “hub” routes: single-company profile and its sub-pages (e.g. edit).
 * These use a full-width layout without the main portal sidebar.
 */
export function isCompanyImmersivePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return /^\/portal\/companies\/(?!new$)[^/]+(?:\/.*)?$/.test(pathname);
}
