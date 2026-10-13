import Form from "next/form";
import type { ReactNode } from "react";
import type { Locale } from "@darb/core";
import { t } from "@darb/i18n";
import { href, paths } from "@/lib/routes";
import type { SearchLabels } from "@/search/types";
import { SearchBox } from "./SearchBox";
import styles from "./SearchBar.module.css";

/** The combobox's strings: client components get copy as props, never @darb/i18n. */
export function searchLabels(locale: Locale): SearchLabels {
  return {
    search: t(locale, "search"),
    placeholder: t(locale, "searchPlaceholder"),
    places: t(locale, "suggestPlaces"),
    kinds: t(locale, "suggestKinds"),
    businesses: t(locale, "suggestBusinesses"),
    searchFor: t(locale, "searchFor"),
    suggestionCount: t(locale, "suggestionCount"),
    noSuggestions: t(locale, "noSuggestions"),
  };
}

/**
 * Top bar on desktop, docked at the bottom (thumb reach) on phones.
 */
export function SearchBar({ locale, nearMe }: { locale: Locale; nearMe?: ReactNode }) {
  return (
    <div className={styles.dock} data-search-bar="">
      {/*
        next/form: Enter with nothing picked navigates on the client (the stage and map stay up);
        without JavaScript it is a plain GET form to /search?q=.
      */}
      <Form
        role="search"
        action={href(locale, paths.search())}
        prefetch={false}
        className={styles.form}
      >
        <label htmlFor="q" className="visually-hidden">
          {t(locale, "search")}
        </label>
        <SearchBox locale={locale} labels={searchLabels(locale)} />
        <button type="submit" className={styles.submit} aria-label={t(locale, "search")}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </Form>
      {nearMe}
    </div>
  );
}
