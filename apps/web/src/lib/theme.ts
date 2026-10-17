import type { Locale } from "@darb/core";

/** Where the visitor's own pick (day or night) is remembered. No pick: the device's scheme. */
export const THEME_KEY = "darb-theme";

export type Theme = "light" | "dark";

/**
 * Runs in <head> before the first paint: a remembered pick sets html[data-theme], so a visitor who
 * chose night never sees a flash of day (or the other way round). Storage may be blocked.
 */
export function themeBootScript(): string {
  return `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`;
}

/** The scheme the page shows now: the visitor's pick, else the device's preference. */
export function currentTheme(): Theme {
  const picked = document.documentElement.getAttribute("data-theme");
  if (picked === "light" || picked === "dark") return picked;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Shows `theme` now and remembers it (when storage allows). */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private mode or blocked storage: the pick holds for this page only.
  }
}

/** The toggle's accessible name: what pressing it does. */
export const themeCopy: Record<Locale, { toDark: string; toLight: string }> = {
  he: { toDark: "מעבר למצב לילה", toLight: "מעבר למצב יום" },
  ar: { toDark: "حوّل لوضع الليل", toLight: "حوّل لوضع النهار" },
  en: { toDark: "Switch to night mode", toLight: "Switch to day mode" },
};
