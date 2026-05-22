"use client";

import { useCallback, useEffect, useState } from "react";
import {
  disableWebPush,
  enableWebPush,
  getWebPushStatus,
  type WebPushEnableResult,
  type WebPushStatus,
} from "@/lib/push/enable-push";

type Options = {
  /** When true, successful enable/disable shows no toast (caller handles UI). */
  silent?: boolean;
};

export function useEnableWebPush(options: Options = {}) {
  const [status, setStatus] = useState<WebPushStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await getWebPushStatus();
    setStatus(next.status);
    setEndpoint(next.endpoint);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async (): Promise<WebPushEnableResult> => {
    setBusy(true);
    try {
      const result = await enableWebPush();
      await refresh();
      return result;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const disable = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    try {
      const ok = await disableWebPush();
      await refresh();
      return ok;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return {
    status,
    busy,
    endpoint,
    refresh,
    enable,
    disable,
    silent: options.silent ?? false,
  };
}
