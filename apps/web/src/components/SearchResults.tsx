"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@darb/core";
import { roundPoint } from "@/lib/client-ip";
import { removeChip, type SearchView } from "@/lib/search-view";
import { BusinessRow, type RowLabels } from "./BusinessRow";
import { NoneYet } from "./NoneYet";
import { StageData } from "./StageData";
import list from "./List.module.css";
import styles from "./SearchResults.module.css";

export interface ResultsLabels {
  removeChip: string;
  resultCount: string;
  noResults: string;
  blocked: string;
  places: string;
  placesHref: string;
  nearMe: string;
  locating: string;
  locationDenied: string;
  unreachable: string;
  nearestPlaces: string;
  nothingOpen: string;
  rows: RowLabels;
}

/** A function replacement, so "$&" or "$1" in a query or name stays as typed. */
const fill = (s: string, k: string, v: string | number) => s.replace(`{${k}}`, () => String(v));
/** The free-text chip is shown in quotes; the sentence that names it brings its own. */
const unquoted = (label: string) => label.replace(/^[“„«](.*)[”»]$/u, "$1");

export function SearchResults({
  locale,
  initial,
  labels,
}: {
  locale: Locale;
  initial: SearchView;
  labels: ResultsLabels;
}) {
  const [view, setView] = useState(initial);
  const [state, setState] = useState<"idle" | "loading" | "locating" | "denied" | "error">("idle");
  const title = useRef<HTMLHeadingElement>(null);
  const refocus = useRef(false);

  // After a re-run the pressed × is gone: focus lands on the results heading, never on <body>.
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    title.current?.focus();
  }, [view]);

  async function rerun(intent: SearchView["intent"], near?: { lat: number; lng: number }) {
    setState("loading");
    try {
      const res = await fetch("/api/search/results", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          q: view.q,
          locale,
          intent,
          ...(near ? { near: roundPoint(near) } : {}),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      refocus.current = true;
      setView((await res.json()) as SearchView);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  function locate() {
    if (!("geolocation" in navigator)) return setState("denied");
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => void rerun(view.intent, { lat: coords.latitude, lng: coords.longitude }),
      () => setState("denied"),
      { timeout: 10_000, maximumAge: 600_000 },
    );
  }

  /** Which result the search led to (spec §4.7). Fire and forget; never blocks navigation. */
  function clicked(key: string) {
    if (!view.queryId) return;
    const body = JSON.stringify({ queryId: view.queryId, key });
    navigator.sendBeacon?.("/api/search/click", new Blob([body], { type: "application/json" }));
  }

  if (view.status === "blocked")
    return (
      <section data-search-blocked="" className={styles.blocked}>
        <StageData level={view.stage} />
        <p>{labels.blocked}</p>
        <p>
          <Link className="button-link" href={labels.placesHref}>
            {labels.places}
          </Link>
        </p>
      </section>
    );

  return (
    <section
      aria-labelledby="search-results-title"
      data-search-results=""
      aria-busy={state === "loading"}
    >
      <StageData level={view.stage} />
      <h2 id="search-results-title" ref={title} tabIndex={-1} className="visually-hidden">
        {fill(labels.resultCount, "count", view.rows.length)}
      </h2>
      {view.chips.length > 0 ? (
        <ul className={styles.chips}>
          {view.chips.map((chip) => (
            <li key={chip.id} className={styles.chip} data-chip={chip.id}>
              <span>{chip.label}</span>
              <button
                type="button"
                className={styles.remove}
                aria-label={fill(labels.removeChip, "chip", chip.label)}
                onClick={() => void rerun(removeChip(view.intent, chip.id))}
                disabled={state === "loading"}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {view.needsLocation ? (
        <p>
          <button
            type="button"
            className="button"
            onClick={locate}
            aria-busy={state === "locating"}
            data-search-near-me=""
          >
            {state === "locating" ? labels.locating : labels.nearMe}
          </button>
        </p>
      ) : null}
      {state === "denied" ? <p role="status">{labels.locationDenied}</p> : null}
      {state === "error" ? <p role="status">{labels.unreachable}</p> : null}
      {view.rows.length > 0 ? (
        <ul className={list.list} data-business-list="">
          {view.rows.map((row) => (
            <BusinessRow
              key={row.key}
              row={row}
              labels={labels.rows}
              onOpen={() => clicked(row.key)}
            />
          ))}
        </ul>
      ) : (
        <div data-search-empty="">
          {view.withoutOpenNow ? (
            <>
              <p className={styles.empty}>{labels.nothingOpen}</p>
              <p>
                <Link className="button-link" href={view.withoutOpenNow.href}>
                  {view.withoutOpenNow.label}
                </Link>
              </p>
            </>
          ) : view.narrowest ? (
            <p className={styles.empty}>
              {fill(labels.noResults, "chip", unquoted(view.narrowest.label))}
            </p>
          ) : null}
          {view.nearest.length > 0 ? (
            <NoneYet title={labels.nearestPlaces} subtitle="" places={view.nearest} />
          ) : null}
        </div>
      )}
    </section>
  );
}
