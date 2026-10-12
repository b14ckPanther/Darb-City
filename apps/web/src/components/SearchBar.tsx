import type { ReactNode } from "react";
import type { Locale } from "@darb/core";
import { t } from "@darb/i18n";
import { href, paths } from "@/lib/routes";
import styles from "./SearchBar.module.css";

/** Plan 3 wires search. Top bar on desktop, docked at the bottom (thumb reach) on phones. */
export function SearchBar({ locale, nearMe }: { locale: Locale; nearMe?: ReactNode }) {
  return (
    <div className={styles.dock} data-search-bar="">
      <form
        role="search"
        action={href(locale, paths.search())}
        method="get"
        className={styles.form}
      >
        <label htmlFor="q" className="visually-hidden">
          {t(locale, "search")}
        </label>
        <input
          id="q"
          name="q"
          type="search"
          placeholder={t(locale, "searchPlaceholder")}
          autoComplete="off"
          enterKeyHint="search"
          className={styles.input}
        />
        <button type="submit" className={styles.submit} aria-label={t(locale, "search")}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </form>
      {nearMe}
    </div>
  );
}
