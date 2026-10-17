"use client";

import { useSyncExternalStore } from "react";
import { applyTheme, currentTheme, type Theme } from "@/lib/theme";
import styles from "./ThemeToggle.module.css";

const CHANGE = "darb-theme-change";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  media?.addEventListener("change", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    media?.removeEventListener("change", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

/**
 * Day or night: the moon by day, the sun by night (the scheme it switches to). The server cannot
 * know the scheme, so it renders the day state; the boot script has already painted the right
 * colours, and only the icon settles on hydration.
 */
export function ThemeToggle({ toDark, toLight }: { toDark: string; toLight: string }) {
  const theme = useSyncExternalStore<Theme>(subscribe, currentTheme, () => "light");
  const night = theme === "dark";
  return (
    <button
      type="button"
      className={styles.toggle}
      data-theme-toggle=""
      data-night={night ? "" : undefined}
      aria-label={night ? toLight : toDark}
      onClick={() => {
        applyTheme(night ? "light" : "dark");
        window.dispatchEvent(new Event(CHANGE));
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
        <g className={styles.sun}>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
        </g>
        <path className={styles.moon} d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1Z" />
      </svg>
    </button>
  );
}
