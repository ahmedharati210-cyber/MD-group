"use client";

import { useEffect, useState } from "react";

/** True when the portal runs as an installed PWA (Home Screen / standalone). */
export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const check = () => setStandalone(mq.matches || nav.standalone === true);
    check();
    mq.addEventListener("change", check);
    return () => mq.removeEventListener("change", check);
  }, []);

  return standalone;
}
