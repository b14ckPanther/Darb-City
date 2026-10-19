"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@darb/core";
import { roundPoint } from "@/lib/client-ip";
import { editedHref, removeChip, type SearchView } from "@/lib/search-view";
import { BusinessRow, type RowLabels } from "./BusinessRow";
import { NoneYet } from "./NoneYet";
import { StageData } from "./StageData";
import { useMapRows } from "./useMapRows";
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
  /** Said (unseen) before a row's matched thing: "Has shawarma". */
  matchedOn: string;
  didYouMean: string;
  nothingFound: string;
  refining: string;
  refined: string;
  rows: RowLabels;
}

/** The thing on the card that answered the search, gold-marked, with what it belongs to. */
function Matched({ label, context, on }: { label: string; context: string | null; on: string }) {
  return (
    <span className={list.rowMatch} data-matched="">
      <span className={list.matchMark} aria-hidden="true" />
      <span className="visually-hidden">{on} </span>
      <span className={list.matchLabel}>{label}</span>
      {context ? <span className={list.matchContext}> · {context}</span> : null}
    </span>
  );
}

/** A function replacement, so "$&" or "$1" in a query or name stays as typed. */
const fill = (s: string, k: string, v: string | number) => s.replace(`{${k}}`, () => String(v));
/** The free-text chip is shown in quotes; the sentence that names it brings its own. */
const unquoted = (label: string) => label.replace(/^[“„«](.*)[”»]$/u, "$1");

export function SearchResults({
  locale,
  initial,
  labels,
  refining = false,
  refined = false,
}: {
  locale: Locale;
  initial: SearchView;
  labels: ResultsLabels;
  /** Quick results: the full search's answer is on its way and will replace them. */
  refining?: boolean;
  /** The full search's answer, just streamed over the quick one. */
  refined?: boolean;
}) {
  const [view, setView] = useState(initial);
  const [state, setState] = useState<"idle" | "loading" | "locating" | "denied" | "error">("idle");
  const title = useRef<HTMLHeadingElement>(null);
  const results = useRef<HTMLUListElement>(null);
  useMapRows(results, view.rows.length > 0);
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
      const next = (await res.json()) as SearchView;
      // A chip edit goes into the URL, so a reload or a shared link shows these results without
      // the model. It replaces this search's history entry: Back leaves the search, and Next keeps
      // the page as it is (router.replace would render it again and run the search a second time).
      if (!near)
        window.history.replaceState(
          window.history.state,
          "",
          editedHref(locale, next.q, next.intent),
        );
      refocus.current = true;
      setView(next);
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
      data-search-refining={refining ? "" : undefined}
      data-search-refined={refined ? "" : undefined}
      className={refined ? styles.refined : undefined}
      aria-busy={state === "loading" || refining}
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
      {view.fallback && view.rows.length > 0 ? (
        // Honest: what came instead of an exact match, said once above the list.
        <p className={styles.fallback} data-search-fallback-line={view.fallback.type}>
          {view.fallback.line}
        </p>
      ) : null}
      {refining ? (
        <p role="status" className={styles.refining}>
          {labels.refining}
        </p>
      ) : refined ? (
        <p role="status" className="visually-hidden">
          {labels.refined}
        </p>
      ) : null}
      {view.suggestions.length > 0 ? (
        <nav aria-label={labels.didYouMean} data-search-suggestions="">
          <ul className={styles.suggest}>
            <li aria-hidden="true">{labels.didYouMean}</li>
            {view.suggestions.map((s) => (
              <li key={s.key}>
                <Link href={s.href}>{s.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      {state === "denied" ? <p role="status">{labels.locationDenied}</p> : null}
      {state === "error" ? <p role="status">{labels.unreachable}</p> : null}
      {view.rows.length > 0 ? (
        <ul
          ref={results}
          className={refining ? `${list.list} ${styles.refiningList}` : list.list}
          data-business-list=""
        >
          {view.rows.map((row, i) => (
            <BusinessRow
              key={row.key}
              row={row}
              n={i + 1}
              labels={labels.rows}
              onOpen={() => clicked(row.key)}
              note={row.matched ? <Matched {...row.matched} on={labels.matchedOn} /> : null}
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
          ) : refining ? null : (
            <p className={styles.empty}>{labels.nothingFound}</p>
          )}
          {view.nearest.length > 0 ? (
            <NoneYet title={labels.nearestPlaces} subtitle="" places={view.nearest} />
          ) : null}
        </div>
      )}
    </section>
  );
}
