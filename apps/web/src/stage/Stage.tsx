"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { dir } from "@darb/i18n";
import {
  buildPlaza,
  type CityDot,
  type PlazaLevel,
  type StageLevel,
  type StagePin,
} from "@darb/stage";
import { INTL_TAG } from "@/lib/locale";
import { hotStore, previewStore, type Preview } from "@/lib/map-focus";
import type { MapPin } from "@/lib/map-pins";
import { stageStore } from "@/lib/stage-store";
import { DESKTOP, REDUCED_MOTION, useMedia } from "@/lib/use-media";
import { CityMap } from "./city-map";
import { Director } from "./director";
import { fadeLayer, nextFrame } from "./fade";
import { PlazaView } from "./PlazaView";
import { MapCaption, PinCard } from "./StageFocus";
import type { StageProps } from "./types";
import styles from "./stage.module.css";

/** check-budget.mjs finds this string in an async chunk and in no first-load chunk. */
export const STAGE_CHUNK_MARKER = "darb:stage-chunk";
const COUNTRY: StageLevel = { depth: 0 };
/** The desktop sheet's width (Sheet.module.css): the map keeps its subject beside it. */
const SHEET_INSET = 480;
/** A business page's sheet is on screen (level 4); a kind's list alone hides none of the map. */
const sheetOpen = () => document.querySelector("[data-sheet]") !== null;

const fill = (template: string, name: string, value: string) =>
  template.replace(`{${name}}`, value);

/** The phone's pin card: the map keeps a chosen pin above it. */
const CARD_SPACE = 120;

async function loadDots(): Promise<CityDot[]> {
  try {
    const res = await fetch("/api/city");
    return res.ok ? ((await res.json()) as { dots: CityDot[] }).dots : [];
  } catch {
    return [];
  }
}

/** The path bar's "up one level" link: where Back-like gestures go. */
const upHref = () =>
  document.querySelector<HTMLAnchorElement>("[data-path-bar] [data-up]")?.getAttribute("href") ??
  null;

const SEARCH_PATH = /^(?:\/(?:ar|en))?\/search$/;

const previewKey = (locale: string, p: Preview) => `${locale}|${p.place}|${p.kind}`;
type Loaded = Record<string, MapPin[] | "error">;

/**
 * The Zoomable City (spec §3.1), moved by the Director on every level change. The map answers only
 * what the list asks: a place's map shows the place, a category row being looked at shows that
 * kind's businesses, a kind's list or a search shows numbered pins like its rows, a business its
 * own pin. Desktop: beside the list. Phone: behind a Map/List pill (levels 0–3 and /search), with a
 * header saying what is shown and a card for a tapped pin. Loaded lazily by StageMount; any failure
 * hands the city back to the list (spec §7).
 */
export function Stage({ locale, labels, onFail }: StageProps) {
  const pathname = usePathname();
  const router = useRouter();
  const desktop = useMedia(DESKTOP);
  const reduced = useMedia(REDUCED_MOTION);
  const level = useSyncExternalStore(stageStore.subscribe, stageStore.get, () => null) ?? COUNTRY;
  const preview = useSyncExternalStore(previewStore.subscribe, previewStore.get, () => null);
  const hot = useSyncExternalStore(hotStore.subscribe, hotStore.get, () => null);
  const [open, setOpen] = useState(false);
  /** A phone's tapped pin, shown on its card. */
  const [chosen, setChosen] = useState<string | null>(null);
  /** Previewed categories' pins, by previewKey: fetched once each. */
  const [loaded, setLoaded] = useState<Loaded>({});
  const [ready, setReady] = useState(false);
  const [plaza, setPlaza] = useState<PlazaLevel | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const mapLayer = useRef<HTMLDivElement>(null);
  const mapBox = useRef<HTMLDivElement>(null);
  const plazaLayer = useRef<HTMLDivElement>(null);
  const director = useRef<Director | null>(null);
  const city = useRef<CityMap | null>(null);
  const started = useRef(false);
  const alive = useRef(true);
  const reducedNow = useRef(reduced);
  const desktopNow = useRef(desktop);
  const textDir = dir(locale);
  // Phone: the pill wherever the map has something to say: a place, a kind's numbered pins, a
  // search. A business page has its sheet instead.
  const business = level.depth === 3 && level.pins.some((p) => p.href === pathname);
  const showToggle = !desktop && (level.depth <= 2 || SEARCH_PATH.test(pathname) || !business);
  const visible = desktop || (open && showToggle);
  // A category previewed on this place's list.
  const placeSlug = level.depth === 1 || level.depth === 2 ? level.place.slug : null;
  const focus = preview && preview.place === placeSlug ? preview : null;
  const focusPins = focus ? loaded[previewKey(locale, focus)] : undefined;
  // The businesses on the map now: a preview's (unnumbered), or a kind's or search's (numbered).
  const previewing = focus !== null && Array.isArray(focusPins);
  const mapPins: readonly StagePin[] = previewing
    ? (focusPins as MapPin[])
    : level.depth === 3
      ? level.pins
      : [];
  const chosenAt = chosen ? mapPins.findIndex((p) => p.key === chosen) : -1;
  const card = chosenAt >= 0 ? { pin: mapPins[chosenAt]!, n: previewing ? 0 : chosenAt + 1 } : null;

  // A new page closes the phone's map (its list is the page) and its card.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
    setChosen(null);
  }
  // A category chosen with its map button opens the phone's map on it.
  const [seenPreview, setSeenPreview] = useState(preview);
  if (seenPreview !== preview) {
    setSeenPreview(preview);
    setChosen(null);
    if (preview?.sticky && !desktop) setOpen(true);
  }

  const close = useCallback(() => {
    setOpen(false);
    setChosen(null);
    if (previewStore.get()?.sticky) previewStore.set(null);
  }, []);

  useEffect(() => {
    reducedNow.current = reduced;
    desktopNow.current = desktop;
  });

  const goUp = useCallback(() => {
    const up = upHref();
    if (up) router.push(up);
  }, [router]);

  // The Director, once the layers exist; the map is torn down with the stage.
  useEffect(() => {
    if (!host.current || !mapLayer.current || !plazaLayer.current) return;
    director.current = new Director({
      host: host.current,
      layers: { map: mapLayer.current, plaza: plazaLayer.current },
      showPlaza: setPlaza,
      fade: fadeLayer,
      frame: nextFrame,
      reducedMotion: () => reducedNow.current,
      insetEnd: (l) => (desktopNow.current && l.depth === 3 && sheetOpen() ? SHEET_INSET : 0),
    });
    alive.current = true;
    return () => {
      alive.current = false;
      director.current = null;
      city.current?.destroy();
      city.current = null;
    };
  }, []);

  // The plaza is laid out for the stage's size.
  useEffect(() => {
    const el = host.current;
    if (!el || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setSize({
          width: Math.round(entry.contentRect.width),
          height: Math.round(entry.contentRect.height),
        });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Phone: the open stage covers the city and the header's top bar, which stop taking focus until
  // "List". The docked search bar stays above the stage and usable. Declared before the map effect
  // so the stage is displayed (has a size) when the map is created.
  useEffect(() => {
    if (desktop || !visible) return;
    const root = document.documentElement;
    const behind = [
      document.querySelector("[data-city]"),
      ...document.querySelectorAll("[data-site-header] > * > :not([data-search-bar])"),
    ].filter((el): el is Element => el !== null && !el.hasAttribute("inert"));
    root.setAttribute("data-stage-open", "");
    for (const el of behind) el.setAttribute("inert", "");
    return () => {
      root.removeAttribute("data-stage-open");
      for (const el of behind) el.removeAttribute("inert");
    };
  }, [desktop, visible]);

  // The map and the live places, the first time the stage is visible.
  useEffect(() => {
    if (!visible || started.current || !mapBox.current) return;
    started.current = true;
    Promise.all([
      CityMap.create({
        container: mapBox.current,
        locale,
        dir: textDir,
        label: labels.map,
        // Desktop opens the business beside its list; a phone first shows its card.
        onPick: ({ key, href }) => {
          if (desktopNow.current) router.push(href, { scroll: false });
          else setChosen(key);
        },
        onHover: (key) => {
          if (key) hotStore.set({ key, from: "map" });
          else if (hotStore.get()?.from === "map") hotStore.set(null);
        },
        onZoomOut: () => {
          if (director.current?.depth === 3) goUp();
        },
        reducedMotion: () => reducedNow.current,
      }),
      loadDots(),
    ]).then(
      ([map, dots]) => {
        if (!alive.current) {
          map.destroy();
          return;
        }
        city.current = map;
        director.current?.setDots(dots);
        director.current?.attachMap(map);
        setReady(true);
      },
      () => {
        if (alive.current) onFail();
      },
    );
  }, [visible, locale, textDir, labels.map, router, goUp, onFail]);

  // Every level change is a camera move.
  useEffect(() => {
    if (!visible || !ready) return;
    void director.current?.show(level, pathname);
  }, [visible, ready, level, pathname]);

  // A previewed category's pins, fetched once (a stale answer is dropped by the abort).
  const focusKey = focus ? previewKey(locale, focus) : null;
  const focusKind = focus?.kind;
  useEffect(() => {
    if (!focusKey || !placeSlug || !focusKind || focusPins !== undefined) return;
    const abort = new AbortController();
    const query = new URLSearchParams({ locale, place: placeSlug, kind: focusKind });
    fetch(`/api/pins?${query}`, { signal: abort.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ pins: MapPin[] }>) : Promise.reject()))
      .then(
        ({ pins }) => setLoaded((all) => ({ ...all, [focusKey]: pins })),
        () => {
          if (!abort.signal.aborted) setLoaded((all) => ({ ...all, [focusKey]: "error" }));
        },
      );
    return () => abort.abort();
  }, [focusKey, focusKind, focusPins, placeSlug, locale]);

  // Only the previewed category on the place's map; none, and the place comes back.
  useEffect(() => {
    if (!visible || !ready) return;
    const d = director.current;
    if (!d || !placeSlug) return;
    if (focus && Array.isArray(focusPins))
      void d.showPreview({ place: focus.place, kind: focus.kind, pins: focusPins });
    else if (!focus || focusPins === "error") void d.showPreview(null);
  }, [visible, ready, focus, focusPins, placeSlug, level]);

  // One pin lifted: a phone's chosen pin, else the hovered row or pin.
  const lifted = chosen ?? hot?.key ?? null;
  useEffect(() => {
    if (ready) director.current?.lift(lifted);
  }, [ready, lifted, focusPins, level]);

  // A chosen pin stays in sight above its card.
  const cardPin = card?.pin ?? null;
  useEffect(() => {
    if (ready && cardPin) city.current?.reveal(cardPin, CARD_SPACE, reducedNow.current);
  }, [ready, cardPin]);

  // e2e only: where a place or business is on screen, and where the map looks.
  useEffect(() => {
    if (!ready || !("__DARB_E2E__" in window)) return;
    Object.assign(window, {
      darbStage: {
        pointOf: (id: string) => city.current?.pointOf(id) ?? null,
        /** The businesses on the map now, by key, in list order. */
        pins: () => city.current?.pinKeys() ?? [],
        center: () => city.current?.center() ?? null,
      },
    });
  }, [ready]);

  const scene = useMemo(
    () => (plaza && size ? buildPlaza(plaza.doors, { ...size, dir: textDir }) : null),
    [plaza, size, textDir],
  );
  const numbers = useMemo(() => new Intl.NumberFormat(INTL_TAG[locale]), [locale]);
  const plazaCaption = plaza
    ? plaza.depth === 2
      ? `${plaza.sector.name} · ${plaza.place.name}`
      : plaza.place.name
    : "";

  // What the map shows, said over it: a previewed category anywhere, a kind or search on a phone.
  const mapCaption =
    focus && focusPins !== "error"
      ? {
          title: focus.title,
          count: numbers.format(focus.count),
          loading: focusPins === undefined,
        }
      : !desktop && level.depth === 3 && level.title
        ? {
            title: level.title,
            count: level.count === undefined ? null : numbers.format(level.count),
            loading: false,
          }
        : null;

  return (
    <>
      <div
        ref={host}
        className={styles.host}
        data-stage-host=""
        data-stage-state={ready ? "ready" : "loading"}
        data-stage-chunk={STAGE_CHUNK_MARKER}
        data-stage-captioned={mapCaption && !desktop ? "" : undefined}
      >
        <div ref={mapLayer} className={styles.layer} data-stage-layer="map">
          {/* MapLibre makes its container position: relative, so it fills an absolute frame. */}
          <div className={styles.map}>
            <div ref={mapBox} className={styles.canvas} />
          </div>
          <p className={styles.attribution} data-stage-attribution="">
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
        </div>
        {mapCaption ? (
          <MapCaption
            key={mapCaption.title}
            title={mapCaption.title}
            count={mapCaption.count}
            loading={mapCaption.loading}
            phone={!desktop}
            labels={labels}
            onBack={close}
          />
        ) : null}
        {card && !desktop ? (
          <PinCard
            key={card.pin.key}
            pin={card.pin}
            n={card.n}
            labels={labels}
            locale={INTL_TAG[locale]}
            onClose={() => setChosen(null)}
          />
        ) : null}
        <div ref={plazaLayer} className={styles.layer} data-stage-layer="plaza">
          {scene && plaza ? (
            <PlazaView
              scene={scene}
              caption={plazaCaption}
              label={fill(labels.plaza, "place", plazaCaption)}
              countText={(n) => numbers.format(n)}
              countLabel={(n) => fill(labels.businessCount, "count", numbers.format(n))}
              parallax={desktop && !reduced}
              onPinchOut={goUp}
            />
          ) : null}
        </div>
      </div>
      {showToggle
        ? createPortal(
            <button
              type="button"
              className={styles.toggle}
              data-stage-toggle=""
              aria-controls="stage"
              aria-expanded={open}
              onClick={() => (open ? close() : setOpen(true))}
            >
              {open ? labels.showList : labels.showMap}
            </button>,
            document.body,
          )
        : null}
    </>
  );
}
