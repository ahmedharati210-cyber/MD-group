"use client";

import { useEffect } from "react";

/** Removes the root inline PWA boot splash once the React splash is mounted. */
export function PortalBootSplashDismiss() {
  useEffect(() => {
    document.getElementById("md-boot-splash")?.remove();
  }, []);
  return null;
}
