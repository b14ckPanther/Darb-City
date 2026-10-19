/** The App Badging API's two calls, where a browser has them (installed apps on most systems). */
export interface BadgeNavigator {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
}

/**
 * The installed admin's icon shows how many wait for an answer (join requests plus helpers who
 * applied); none clears it. A browser without the API, or one that refuses (not installed,
 * permission), is left alone: the badge is a convenience, never an error.
 */
export async function syncAppBadge(nav: BadgeNavigator | undefined, count: number): Promise<void> {
  if (!nav || typeof nav.setAppBadge !== "function") return;
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  try {
    if (n > 0) await nav.setAppBadge(n);
    else if (typeof nav.clearAppBadge === "function") await nav.clearAppBadge();
    else await nav.setAppBadge(0);
  } catch {
    // Not installed, or not allowed here: nothing to show.
  }
}
