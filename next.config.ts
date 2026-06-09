import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import withSerwistInit from "@serwist/next";

const projectDir = path.dirname(fileURLToPath(import.meta.url));

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
  serverExternalPackages: ["pdf-parse", "web-push"],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/portal-manifest.json",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=86400",
          },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=86400",
          },
        ],
      },
    ];
  },
  allowedDevOrigins: getLanOrigins(),
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Empty turbopack config acknowledges that Turbopack is used for `next dev`
  // while `next build --webpack` is used for production (required by @serwist/next).
  turbopack: {},
  webpack(config, options) {
    // Strip @serwist/window from the client bundle — we register the SW manually
    // via navigator.serviceWorker.register() in lib/push/portal-sw.ts.
    if (!options.isServer) {
      const { webpack } = options;
      config.plugins?.push(
        new webpack.NormalModuleReplacementPlugin(
          /^@serwist\/window$/,
          path.resolve(projectDir, "lib/noop-serwist-window.ts"),
        ),
        new webpack.NormalModuleReplacementPlugin(
          /^@serwist\/window\/internal$/,
          path.resolve(projectDir, "lib/noop-serwist-window-internal.ts"),
        ),
      );
    }
    return config;
  },
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
