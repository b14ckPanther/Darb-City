"use client";

import { useEffect } from "react";

/**
 * Registers the helper app's service worker on its own scope (/helpers, /ar/helpers, /en/helpers),
 * so a photo shared into the app reaches the capture. Nothing breaks without it.
 */
export function HelperWorker({ scope }: { scope: string }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/helper-sw.js", { scope }).catch(() => undefined);
  }, [scope]);
  return null;
}
