"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { dir } from "@darb/i18n";
import { buildPlaza, type CityDot, type PlazaLevel, type StageLevel } from "@darb/stage";
import { INTL_TAG } from "@/lib/locale";
import { stageStore } from "@/lib/stage-store";
import { DESKTOP, REDUCED_MOTION, useMedia } from "@/lib/use-media";
import { CityMap } from "./city-map";
import { Director } from "./director";
import { fadeLayer, nextFrame } from "./fade";
import { PlazaView } from "./PlazaView";
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

async function loadDots(locale: string): Promise<CityDot[]> {
  try {
    const res = await fetch(`/api/city?locale=${locale}`);
    return res.ok ? ((await res.json()) as { dots: CityDot[] }).dots : [];
  } catch {
    return [];
  }
}

/** The path bar's "up one level" link: where Back-like gestures go. */
const upHref = () =>
  document.querySelector<HTMLAnchorElement>("[data-path-bar] [data-up]")?.getAttribute("href") ??
  null;

/**
 * The Zoomable City (spec §3.1): the map at levels 0 and 3–4, the plaza at 1–2, moved by the
 * Director on every level change. Desktop: beside the list. Phone: behind a Map/List pill at levels
 * 0–2. Loaded lazily by StageMount; any failure hands the city back to the list (spec §7).
 */
export function Stage({ locale, labels, onFail }: StageProps) {
  const pathname = usePathname();
  const router = useRouter();
  const desktop = useMedia(DESKTOP);
  const reduced = useMedia(REDUCED_MOTION);
  const level = useSyncExternalStore(stageStore.subscribe, stageStore.get, () => null) ?? COUNTRY;
  const [open, setOpen] = useState(false);
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
  const showToggle = !desktop && level.depth <= 2;
  const visible = desktop || (open && showToggle);

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

  // Phone: the open stage covers the city, which stops taking focus until "List". Declared before
  // the map effect so the stage is displayed (has a size) when the map is created.
  useEffect(() => {
    if (desktop || !visible) return;
    const root = document.documentElement;
    const behind = [
      document.querySelector("[data-city]"),
      document.getElementById("site-header"),
    ].filter((el): el is HTMLElement => el !== null);
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
        onPick: (href, kind) => router.push(href, { scroll: kind === "place" }),
        onZoomOut: () => {
          if (director.current?.depth === 3) goUp();
        },
      }),
      loadDots(locale),
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

  // e2e only: where a place or business is on screen, and where the map looks.
  useEffect(() => {
    if (!ready || !("__DARB_E2E__" in window)) return;
    Object.assign(window, {
      darbStage: {
        pointOf: (id: string) => city.current?.pointOf(id) ?? null,
        center: () => city.current?.center() ?? null,
      },
    });
  }, [ready]);

  const scene = useMemo(
    () => (plaza && size ? buildPlaza(plaza.doors, { ...size, dir: textDir }) : null),
    [plaza, size, textDir],
  );
  const numbers = useMemo(() => new Intl.NumberFormat(INTL_TAG[locale]), [locale]);
  const caption = plaza
    ? plaza.depth === 2
      ? `${plaza.sector.name} · ${plaza.place.name}`
      : plaza.place.name
    : "";

  return (
    <>
      <div
        ref={host}
        className={styles.host}
        data-stage-host=""
        data-stage-state={ready ? "ready" : "loading"}
        data-stage-chunk={STAGE_CHUNK_MARKER}
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
        <div ref={plazaLayer} className={styles.layer} data-stage-layer="plaza">
          {scene && plaza ? (
            <PlazaView
              scene={scene}
              caption={caption}
              label={fill(labels.plaza, "place", caption)}
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
              onClick={() => setOpen((v) => !v)}
            >
              {open ? labels.showList : labels.showMap}
            </button>,
            document.body,
          )
        : null}
    </>
  );
}
