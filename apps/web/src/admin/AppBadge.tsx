"use client";

import { useEffect } from "react";
import { syncAppBadge, type BadgeNavigator } from "./app-badge";

/**
 * Puts the number waiting on the installed admin's home screen icon, from the counts the shell
 * already loads for its nav badges; the shell renders again after every decision, so it follows.
 */
export function AppBadge({ count }: { count: number }) {
  useEffect(() => {
    void syncAppBadge(
      typeof navigator === "undefined" ? undefined : (navigator as BadgeNavigator),
      count,
    );
  }, [count]);
  return null;
}
