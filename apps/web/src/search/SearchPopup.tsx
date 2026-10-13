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
  /** Grows on every focus of the box: an index that failed to load is fetched again. */
  attempt: number;
  /** The options in drawn order; settled once the index has loaded or failed. */
  onOptions(options: SearchOption[], settled: boolean): void;
  onPick(option: SearchOption): void;
}

/** Business names and the query they answer, so names for older text are never shown. */
interface Names {
  q: string;
  options: SearchOption[];
}

export function SearchPopup({
  locale,
  query,
  place,
  labels,
  listboxId,
  activeId,
  attempt,
  onOptions,
  onPick,
}: PopupProps) {
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [failed, setFailed] = useState(false);
  const [names, setNames] = useState<Names>({ q: "", options: [] });
  const q = query.trim();

  useEffect(() => {
    if (prepared) return;
    let live = true;
    loadPrepared(INDEX_URL).then(
      (p) => {
        if (!live) return;
        setPrepared(p);
        setFailed(false);
      },
      () => live && setFailed(true), // loadPrepared forgets the failure: the next focus retries
    );
    return () => {
      live = false;
    };
  }, [attempt, prepared]);

  // Business names from the API (debounced); lane 1 never waits for them.
  useEffect(() => {
    if (q.length < 2) return; // shorter queries show no businesses (see options below)
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q, locale, ...(place ? { place } : {}) });
      fetch(`/api/search/suggest?${params}`, { signal: controller.signal })
        .then((res) =>
          res.ok ? (res.json() as Promise<{ options: SearchOption[] }>) : { options: [] },
        )
        .then((body) => setNames({ q, options: body.options.slice(0, 5) }))
        .catch(() => {
          // Aborted for newer text, or failed: either way nothing old stays on screen.
          if (!controller.signal.aborted) setNames({ q, options: [] });
        });
    }, 150);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q, locale, place]);

  const options = useMemo(() => {
    // Until the index arrives (or if it cannot), the full search is still offered.
    const instant = prepared
      ? instantOptions(prepared, query, locale, labels)
      : [searchOption(query, locale, labels)].filter((o) => o !== null);
    const search = instant.filter((o) => o.group === "search");
    const current = q.length >= 2 && names.q === q ? names.options : [];
    return inGroups([...instant.filter((o) => o.group !== "search"), ...current, ...search]);
  }, [prepared, query, q, locale, labels, names]);

  // The box moves through options in this order, which is the order they are drawn in.
  const settled = prepared !== null || failed;
  useEffect(() => {
    onOptions(options, settled);
  }, [options, settled, onOptions]);

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
    </>
  );
}
