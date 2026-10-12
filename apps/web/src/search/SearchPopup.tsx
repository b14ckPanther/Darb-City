"use client";

import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@darb/core";
import type { Prepared } from "@darb/search-text";
import { inGroups, instantOptions, loadPrepared, searchOption } from "./engine";
import type { SearchLabels, SearchOption } from "./types";
import styles from "@/components/SearchBox.module.css";

/** check-budget.mjs finds this string in the search group's lazy chunk and in no first-load chunk. */
export const SEARCH_CHUNK_MARKER = "darb:search-chunk";
const INDEX_URL = process.env.NEXT_PUBLIC_SEARCH_INDEX_URL ?? "";

export interface PopupProps {
  locale: Locale;
  query: string;
  place: string | null;
  labels: SearchLabels;
  listboxId: string;
  activeId: string | null;
  onOptions(options: SearchOption[]): void;
  onPick(option: SearchOption): void;
}

export function SearchPopup({
  locale,
  query,
  place,
  labels,
  listboxId,
  activeId,
  onOptions,
  onPick,
}: PopupProps) {
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [businesses, setBusinesses] = useState<SearchOption[]>([]);

  useEffect(() => {
    let live = true;
    loadPrepared(INDEX_URL).then(
      (p) => live && setPrepared(p),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);

  // Business names from the API (debounced); lane 1 never waits for them.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return; // shorter queries show no businesses (see options below)
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q, locale, ...(place ? { place } : {}) });
      fetch(`/api/search/suggest?${params}`, { signal: controller.signal })
        .then((res) =>
          res.ok ? (res.json() as Promise<{ options: SearchOption[] }>) : { options: [] },
        )
        .then((body) => setBusinesses(body.options.slice(0, 5)))
        .catch(() => undefined);
    }, 150);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, locale, place]);

  const options = useMemo(() => {
    // Until the index arrives (or if it cannot), the full search is still offered.
    const instant = prepared
      ? instantOptions(prepared, query, locale, labels)
      : [searchOption(query, locale, labels)].filter((o) => o !== null);
    const search = instant.filter((o) => o.group === "search");
    const names = query.trim().length >= 2 ? businesses : [];
    return inGroups([...instant.filter((o) => o.group !== "search"), ...names, ...search]);
  }, [prepared, query, locale, labels, businesses]);

  // The box moves through options in this order, which is the order they are drawn in.
  useEffect(() => onOptions(options), [options, onOptions]);

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  const headings: Record<SearchOption["group"], string> = {
    places: labels.places,
    kinds: labels.kinds,
    businesses: labels.businesses,
    search: "",
  };
  const groups = [...new Set(options.map((o) => o.group))].map(
    (group) => [group, headings[group]] as const,
  );
  return (
    <>
      <ul
        role="listbox"
        id={listboxId}
        aria-label={labels.search}
        className={styles.listbox}
        data-search-listbox=""
        data-search-chunk={SEARCH_CHUNK_MARKER}
      >
        {groups.map(([group, heading]) => {
          const items = options.filter((o) => o.group === group);
          if (items.length === 0) return null;
          return (
            <li key={group} role="presentation">
              {heading ? (
                <div className={styles.heading} aria-hidden="true">
                  {heading}
                </div>
              ) : null}
              <ul
                role="group"
                aria-label={heading || labels.search}
                className={styles.group}
                data-group={group}
              >
                {items.map((o) => {
                  const id = `${listboxId}-${o.id}`;
                  return (
                    <li
                      key={o.id}
                      id={id}
                      role="option"
                      aria-selected={id === activeId}
                      className={styles.option}
                      data-option={o.id}
                      onMouseDown={(e) => e.preventDefault()} // keep focus in the input
                      onClick={() => onPick(o)}
                    >
                      <span className={styles.label}>{o.label}</span>
                      {o.sublabel ? <span className={styles.sublabel}>{o.sublabel}</span> : null}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
      <p role="status" className="visually-hidden">
        {options.length > 1
          ? labels.suggestionCount.replace("{count}", String(options.length))
          : labels.noSuggestions}
      </p>
    </>
  );
}
