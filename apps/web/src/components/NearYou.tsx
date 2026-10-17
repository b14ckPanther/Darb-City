"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Locale } from "@darb/core";
import { HERE_EVENT, hereFrom, keepHere, PRECISE, readHere, type Here } from "@/lib/here";
import {
  kmBetween,
  positionGranted,
  serverSnapshot,
  snapshot,
  subscribe,
} from "@/lib/live-position";
import type { BusinessRowData } from "@/lib/rows";
import { REDUCED_MOTION, useMedia } from "@/lib/use-media";
import type { NearMap } from "@/stage/near-map";
import { BusinessRow, type RowLabels } from "./BusinessRow";
import list from "./List.module.css";
import styles from "./NearYou.module.css";

export interface NearYouLabels {
  nearYou: string;
  /** "Near you · {place}". */
  nearYouAt: string;
  lead: string;
  ask: string;
  useMyLocation: string;
  locating: string;
  denied: string;
  browsePlaces: string;
  empty: string;
  unreachable: string;
  retry: string;
  showMore: string;
  businesses: string;
  hereMarker: string;
  map: string;
  mapData: string;
  rows: RowLabels;
}

export interface NearYouProps {
  locale: Locale;
  /** The country index: where "browse places" goes when location is off. */
  placesHref: string;
  labels: NearYouLabels;
}

/** Moving further than this re-sorts the list around the new spot. */
export const MOVED_KM = 0.3;

type Status = "starting" | "ask" | "locating" | "denied" | "loading" | "ready" | "error";

interface Page {
  rows: BusinessRowData[];
  nextCursor: string | null;
  place?: string;
}

async function fetchNear(locale: Locale, here: Here, cursor: string | null, signal: AbortSignal) {
  // POST: the point stays out of URLs; the server rounds it and never caches the answer.
  const res = await fetch("/api/near/businesses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ locale, lat: here.lat, lng: here.lng, ...(cursor ? { cursor } : {}) }),
    signal,
  });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as Page;
}

/**
 * The /near page: the businesses closest to where the visitor stands, with a small map. The point
 * comes from the header's "near me" (kept in this tab only) or from this page's own button; the
 * page never asks for location by itself.
 */
export function NearYou({ locale, placesHref, labels }: NearYouProps) {
  const router = useRouter();
  const reduced = useMedia(REDUCED_MOTION);
  const [status, setStatus] = useState<Status>("starting");
  const [here, setHere] = useState<Here | null>(null);
  const [rows, setRows] = useState<BusinessRowData[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [more, setMore] = useState<"idle" | "loading" | "error">("idle");
  const [mapState, setMapState] = useState<"waiting" | "ready" | "off">("waiting");
  const request = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const mapBox = useRef<HTMLDivElement>(null);
  const map = useRef<NearMap | null>(null);
  const fitted = useRef(false);
  // The map's callbacks are bound once; they read the latest values through this.
  const latest = useRef({ labels, reduced, router });
  useEffect(() => {
    latest.current = { labels, reduced, router };
  });

  /** The first page of businesses around a point (a new point replaces the list). */
  const load = useCallback(
    async (at: Here) => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setHere(at);
      setStatus("loading");
      setMore("idle");
      try {
        const page = await fetchNear(locale, at, null, controller.signal);
        if (controller.signal.aborted) return;
        fitted.current = false;
        setRows(page.rows);
        setNext(page.nextCursor);
        setPlace(page.place ?? null);
        setStatus("ready");
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    },
    [locale],
  );

  // Storage is read after mount (the server render has none); a kept point lists at once.
  useEffect(() => {
    const kept = readHere();
    // Read after mount: the server render has no storage, so the first paint is the empty shell.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (kept) void load(kept);
    else setStatus("ask");
    const onHere = (event: Event) => void load((event as CustomEvent<Here>).detail);
    window.addEventListener(HERE_EVENT, onHere);
    return () => {
      window.removeEventListener(HERE_EVENT, onHere);
      request.current?.abort();
    };
  }, [load]);

  // Walking on: once the browser already shares the location, a move of 300 m re-sorts the list.
  // The live watch is coarse (it saves battery), so it only hints at a move: a precise fix, which
  // no longer prompts once granted, decides. A hint is checked once until the next 300 m.
  const live = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const checked = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!live || !here || status === "loading") return;
    if (kmBetween(live, here) <= MOVED_KM) return;
    if (checked.current && kmBetween(live, checked.current) <= MOVED_KM) return;
    checked.current = live;
    navigator.geolocation?.getCurrentPosition(
      (position) => {
        const at = hereFrom(position);
        if (kmBetween(at, here) > MOVED_KM) keepHere(at);
      },
      () => {},
      PRECISE,
    );
  }, [live, here, status]);

  function locate() {
    if (!("geolocation" in navigator)) {
      setStatus("denied");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const at = hereFrom(position);
        positionGranted({ lat: at.lat, lng: at.lng });
        keepHere(at);
      },
      () => setStatus("denied"),
      PRECISE,
    );
  }

  async function showMore() {
    if (!next || !here) return;
    setMore("loading");
    const firstNew = rows.length;
    try {
      const page = await fetchNear(locale, here, next, AbortSignal.timeout(10_000));
      setRows((current) => [...current, ...page.rows]);
      setNext(page.nextCursor);
      setMore("idle");
      // Keyboard users continue from the first new row.
      requestAnimationFrame(() =>
        listRef.current?.querySelectorAll<HTMLAnchorElement>("a")[firstNew]?.focus(),
      );
    } catch {
      setMore("error");
    }
  }

  // The map loads once there is a point, never before (and never on the server).
  const hasPoint = here !== null;
  useEffect(() => {
    if (!hasPoint || mapState !== "waiting" || map.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const { NearMap } = await import("@/stage/near-map");
        const at = readHere() ?? here!;
        const l = latest.current.labels;
        const created = await NearMap.create({
          container: mapBox.current!,
          locale,
          label: l.map,
          hereLabel: l.hereMarker,
          classes: {
            here: styles.here!,
            hereDot: styles.hereDot!,
            hereRing: styles.hereRing!,
            pin: styles.pin!,
          },
          here: at,
          onOpen: (target) => latest.current.router.push(target),
        });
        if (cancelled) created.destroy();
        else {
          map.current = created;
          setMapState("ready");
        }
      } catch {
        // No WebGL, no tiles, a blocked module: the list does the job alone.
        if (!cancelled) setMapState("off");
      }
    })();
    return () => {
      cancelled = true;
    };
    // Starts once per page; later points and rows reach the map through its own methods.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPoint, mapState]);

  useEffect(() => () => map.current?.destroy(), []);

  useEffect(() => {
    if (mapState !== "ready" || !here) return;
    map.current?.setHere(here);
  }, [here, mapState]);

  useEffect(() => {
    if (mapState !== "ready" || status !== "ready") return;
    map.current?.setPins(rows);
    if (!fitted.current) {
      fitted.current = true;
      map.current?.fit(rows, !latest.current.reduced);
    }
  }, [rows, status, mapState]);

  const title = place ? labels.nearYouAt.replace("{place}", place) : labels.nearYou;
  const listed = status === "ready" || (status === "loading" && rows.length > 0);

  return (
    <div className={styles.near} data-near-you={status}>
      <header className={styles.head}>
        <h1 id="main-heading" tabIndex={-1} className={`page-title ${styles.title}`}>
          {title}
        </h1>
        {hasPoint ? <p className={`lede ${styles.lead}`}>{labels.lead}</p> : null}
      </header>

      {status === "starting" ? (
        <div className={styles.starting} />
      ) : status === "ask" || status === "locating" || status === "denied" ? (
        <section className={styles.ask} aria-live="polite">
          <span className={styles.askMark} aria-hidden="true">
            <span className={styles.hereRing} />
            <span className={styles.hereDot} />
          </span>
          {status === "denied" ? (
            <>
              <p role="status" className={styles.askText} data-near-you-denied="">
                {labels.denied}
              </p>
              <Link className="button-link" href={placesHref}>
                {labels.browsePlaces}
              </Link>
            </>
          ) : (
            <>
              <p className={styles.askText}>{labels.ask}</p>
              <button
                type="button"
                className={`button ${styles.use}`}
                onClick={locate}
                disabled={status === "locating"}
                aria-busy={status === "locating"}
                data-near-you-locate=""
              >
                {status === "locating" ? labels.locating : labels.useMyLocation}
              </button>
            </>
          )}
        </section>
      ) : (
        <div className={styles.layout} data-map={mapState}>
          <div className={styles.mapColumn}>
            <div className={styles.mapFrame}>
              <div ref={mapBox} className={styles.mapCanvas} data-near-map="" />
            </div>
            {mapState === "ready" ? (
              <p className={styles.attribution}>
                {labels.mapData}:{" "}
                <bdi>
                  <a href="https://www.openstreetmap.org/copyright" rel="noreferrer">
                    © OpenStreetMap
                  </a>{" "}
                  ·{" "}
                  <a href="https://protomaps.com" rel="noreferrer">
                    Protomaps
                  </a>
                </bdi>
              </p>
            ) : null}
          </div>
          <section
            className={styles.listColumn}
            aria-labelledby="near-businesses"
            aria-busy={status === "loading"}
          >
            <h2 id="near-businesses" className="visually-hidden">
              {labels.businesses}
            </h2>
            {status === "error" ? (
              <div className="quiet" role="status">
                <span>{labels.unreachable}</span>
                <button type="button" className="button" onClick={() => here && load(here)}>
                  {labels.retry}
                </button>
              </div>
            ) : listed && rows.length === 0 ? (
              <p className="quiet" role="status" data-near-you-empty="">
                {labels.empty}
              </p>
            ) : listed ? (
              <>
                <ul ref={listRef} className={`${list.list} ${styles.list}`} data-business-list="">
                  {rows.map((row) => (
                    <BusinessRow
                      key={row.key}
                      // Live distance once the browser shares the location; the server's until then.
                      row={live ? { ...row, distance: null } : row}
                      labels={labels.rows}
                    />
                  ))}
                </ul>
                <div className={list.more}>
                  {more === "error" ? <p role="status">{labels.unreachable}</p> : null}
                  {next ? (
                    <button
                      type="button"
                      className="button"
                      onClick={showMore}
                      disabled={more === "loading"}
                      aria-busy={more === "loading"}
                      data-show-more=""
                    >
                      {labels.showMore}
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <ul className={`${list.list} ${styles.list}`} aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <li key={i} className={styles.placeholder} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
