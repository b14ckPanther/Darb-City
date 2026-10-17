"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@darb/core";
import type { StageLevel, StagePlace } from "@darb/stage";
import { roundPoint } from "@/lib/client-ip";
import type { BusinessRowData } from "@/lib/rows";
import { pinsFromRows } from "@/lib/stage-data";
import { BusinessRow, type RowLabels } from "./BusinessRow";
import list from "./List.module.css";
import styles from "./KindResults.module.css";
import { StageData } from "./StageData";
import { positionGranted } from "@/lib/live-position";

export interface KindResultsLabels {
  businesses: string;
  filters: string;
  openNow: string;
  delivers: string;
  glutenFree: string;
  nearMe: string;
  locating: string;
  locationDenied: string;
  showMore: string;
  unreachable: string;
  filterNoResults: string;
  nothingOpen: string;
  includeClosed: string;
  rows: RowLabels;
}
export interface KindResultsProps {
  locale: Locale;
  place: string;
  kind: string;
  stagePlace: StagePlace;
  initialRows: BusinessRowData[];
  initialCursor: string | null;
  deliversAvailable: boolean;
  /** Food kinds only: a whole gluten-free kitchen means nothing for a barber (Task 27b). */
  glutenFreeAvailable: boolean;
  labels: KindResultsLabels;
}
type Point = { lat: number; lng: number };
interface Filters {
  open: boolean;
  delivers: boolean;
  glutenFree: boolean;
  near: Point | null;
}

const active = (f: Filters) => f.open || f.delivers || f.glutenFree || f.near !== null;

/** ?open=1, ?delivers=1 and ?glutenFree=1 mirror the toggles; Near me never enters the URL. */
function writeUrl(f: Filters) {
  const url = new URL(window.location.href);
  url.searchParams.delete("open");
  url.searchParams.delete("delivers");
  url.searchParams.delete("glutenFree");
  if (f.open) url.searchParams.set("open", "1");
  if (f.delivers) url.searchParams.set("delivers", "1");
  if (f.glutenFree) url.searchParams.set("glutenFree", "1");
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
}

export function KindResults(props: KindResultsProps) {
  const { locale, place, kind, stagePlace, deliversAvailable, glutenFreeAvailable, labels } = props;
  const [filters, setFilters] = useState<Filters>({
    open: false,
    delivers: false,
    glutenFree: false,
    near: null,
  });
  const [rows, setRows] = useState(props.initialRows);
  const [cursor, setCursor] = useState(props.initialCursor);
  const [state, setState] = useState<"idle" | "loading" | "locating" | "denied" | "error">("idle");
  const listRef = useRef<HTMLUListElement>(null);
  /** The latest request: an older answer that lands later never replaces a newer one. */
  const request = useRef(0);
  /** The filters right now, for callbacks that outlive a render (geolocation, navigation). */
  const current = useRef(filters);
  const pathname = usePathname();
  const shownAt = useRef(pathname);

  // The list stays mounted under a business sheet, but opening a row or a pin and closing the
  // sheet navigate to URLs without the query: the pressed filters go back into the URL, so a
  // reload or a shared link shows the same list.
  useEffect(() => {
    if (shownAt.current === pathname) return;
    shownAt.current = pathname;
    writeUrl(current.current);
  }, [pathname]);

  // M6: the map shows exactly the rows on the list.
  const level = useMemo<StageLevel>(
    () => ({ depth: 3, place: stagePlace, pins: pinsFromRows(rows) }),
    [stagePlace, rows],
  );

  async function load(next: Filters, after: string | null) {
    const id = ++request.current;
    setState("loading");
    try {
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          locale,
          place,
          kind,
          open: next.open,
          delivers: next.delivers,
          glutenFree: next.glutenFree,
          ...(next.near ? { near: roundPoint(next.near) } : {}),
          ...(after ? { cursor: after } : {}),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { rows: BusinessRowData[]; nextCursor: string | null };
      if (id !== request.current) return;
      const firstNew = after ? rows.length : 0;
      setRows((current) => (after ? [...current, ...body.rows] : body.rows));
      setCursor(body.nextCursor);
      setState("idle");
      if (after)
        requestAnimationFrame(() =>
          listRef.current?.querySelectorAll<HTMLAnchorElement>("a")[firstNew]?.focus(),
        );
    } catch {
      if (id === request.current) setState("error");
    }
  }

  function apply(next: Filters) {
    current.current = next;
    setFilters(next);
    writeUrl(next);
    if (active(next)) void load(next, null);
    else {
      request.current += 1; // drop any answer still on its way
      setRows(props.initialRows);
      setCursor(props.initialCursor);
      setState("idle");
    }
  }

  // Filters in a shared URL (?open=1&delivers=1) apply after hydration; the server list is unfiltered.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const fromUrl = {
      open: q.get("open") === "1",
      delivers: deliversAvailable && q.get("delivers") === "1",
      glutenFree: glutenFreeAvailable && q.get("glutenFree") === "1",
      near: null,
    };
    if (!active(fromUrl)) return;
    // A task, not a render-time update: Strict Mode's first mount is cancelled, so it fetches once.
    const timer = setTimeout(() => apply(fromUrl), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  function nearMe() {
    if (filters.near) return apply({ ...filters, near: null });
    if (!("geolocation" in navigator)) return setState("denied");
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      // The filters as they are when the position arrives, not when the button was pressed.
      ({ coords }) => {
        positionGranted({ lat: coords.latitude, lng: coords.longitude });
        apply({ ...current.current, near: { lat: coords.latitude, lng: coords.longitude } });
      },
      () => setState("denied"),
      { timeout: 10_000, maximumAge: 600_000 },
    );
  }

  return (
    <section aria-labelledby="businesses-title" aria-busy={state === "loading"}>
      <StageData level={level} />
      <h2 id="businesses-title" className="visually-hidden">
        {labels.businesses}
      </h2>
      <div role="group" aria-label={labels.filters} className={styles.filters} data-filters="">
        <button
          type="button"
          className={styles.toggle}
          aria-pressed={filters.open}
          onClick={() => apply({ ...filters, open: !filters.open })}
          data-filter="open"
        >
          {labels.openNow}
        </button>
        {deliversAvailable ? (
          <button
            type="button"
            className={styles.toggle}
            aria-pressed={filters.delivers}
            onClick={() => apply({ ...filters, delivers: !filters.delivers })}
            data-filter="delivers"
          >
            {labels.delivers}
          </button>
        ) : null}
        {glutenFreeAvailable ? (
          <button
            type="button"
            className={styles.toggle}
            aria-pressed={filters.glutenFree}
            onClick={() => apply({ ...filters, glutenFree: !filters.glutenFree })}
            data-filter="gluten-free"
          >
            {labels.glutenFree}
          </button>
        ) : null}
        <button
          type="button"
          className={styles.toggle}
          aria-pressed={filters.near !== null}
          aria-busy={state === "locating"}
          onClick={nearMe}
          data-filter="near"
        >
          {state === "locating" ? labels.locating : labels.nearMe}
        </button>
      </div>
      {state === "denied" ? <p role="status">{labels.locationDenied}</p> : null}
      {state === "error" ? <p role="status">{labels.unreachable}</p> : null}
      {rows.length > 0 ? (
        <ul ref={listRef} className={list.list} data-business-list="">
          {rows.map((row) => (
            <BusinessRow key={row.key} row={row} labels={labels.rows} />
          ))}
        </ul>
      ) : filters.open && !filters.delivers && !filters.glutenFree ? (
        // Open now emptied the list: say so, and offer the same kind open or closed.
        <div className={styles.empty} data-filter-empty="">
          <p>{labels.nothingOpen}</p>
          <button
            type="button"
            className="button"
            onClick={() => apply({ ...filters, open: false })}
            data-include-closed=""
          >
            {labels.includeClosed}
          </button>
        </div>
      ) : (
        <p className={styles.empty} data-filter-empty="">
          {labels.filterNoResults}
        </p>
      )}
      {cursor ? (
        <div className={list.more}>
          <button
            type="button"
            className="button"
            onClick={() => void load(filters, cursor)}
            disabled={state === "loading"}
            data-show-more=""
          >
            {labels.showMore}
          </button>
        </div>
      ) : null}
    </section>
  );
}
