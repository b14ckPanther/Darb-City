import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import type { Locale } from "@darb/core";
import { prepareStyle, PROTOMAPS_SOURCE } from "./map-style";
import { styleUrl, TILES_URL } from "./vendor";

const READY_TIMEOUT = 15_000;

/** The locale's Darb style, fetched and pointed at this origin's glyphs and the tiles archive. */
export async function fetchDarbStyle(locale: Locale): Promise<StyleSpecification> {
  const res = await fetch(styleUrl(locale));
  if (!res.ok) throw new Error(`Map style: ${res.status}`);
  return prepareStyle((await res.json()) as StyleSpecification, {
    origin: window.location.origin,
    tilesUrl: TILES_URL ?? "",
  });
}

/** The first idle frame; fails if the tiles cannot be read (a 404 archive, a bad URL). */
export function whenReady(map: MapLibreMap): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      map.off("error", onError);
      if (error) reject(error);
      else resolve();
    };
    const onError = (event: { error: { message: string } }) => {
      if ((event as { sourceId?: string }).sourceId === PROTOMAPS_SOURCE) finish(event.error);
    };
    const timer = window.setTimeout(
      () => finish(new Error("The map took too long")),
      READY_TIMEOUT,
    );
    map.on("error", onError);
    map.once("idle", () => finish());
  });
}
