import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

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

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["pdf-parse"],
  allowedDevOrigins: getLanOrigins(),
};

export default nextConfig;
