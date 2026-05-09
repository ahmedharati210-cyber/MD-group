import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";
import withSerwistInit from "@serwist/next";

// Collect every private LAN IPv4 on this machine so Next 16's cross-origin
// dev-asset check (`allowedDevOrigins`) doesn't block phones/laptops that
// visit http://<lan-ip>:3000 during development.
function getLanOrigins(): string[] {
  const ifaces = networkInterfaces();
  const origins = new Set<string>();
  for (const list of Object.values(ifaces)) {
    for (const iface of list ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        origins.add(iface.address);
      }
    }
  }
  return [...origins];
}

// Extract the Supabase storage hostname for next/image remote pattern.
// Falls back gracefully if the env var isn't available at build time.
const supabaseHostname = (() => {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return url ? new URL(url).hostname : "*.supabase.co";
  } catch {
    return "*.supabase.co";
  }
})();

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHostname,
        pathname: "/storage/v1/object/**",
      },
    ],
  },
  serverExternalPackages: ["pdf-parse"],
  allowedDevOrigins: getLanOrigins(),
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Empty turbopack config acknowledges that Turbopack is used for `next dev`
  // while `next build --webpack` is used for production (required by @serwist/next).
  turbopack: {},
};

// Serwist builds the service worker from app/sw.ts → public/sw.js.
// Registration is done manually in PwaInstallBanner (portal-only, scoped to /portal/).
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Disable auto-registration — we register manually from the portal layout only
  register: false,
  // Disable in dev to avoid SW cache interference during development
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
