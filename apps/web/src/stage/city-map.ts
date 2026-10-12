import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import type { Locale } from "@darb/core";
import {
  cityCollection,
  easeOut,
  ISRAEL_NORTH,
  pinCollection,
  zoomedOut,
  type Camera,
  type CityDot,
  type StagePin,
} from "@darb/stage";
import { loadMapLibre } from "./load-maplibre";
import { CITY_DOT, CITY_GLOW, CITY_SOURCE, darbLayers, PIN_LAYER, PIN_SOURCE } from "./map-layers";
import { prepareStyle, PROTOMAPS_SOURCE } from "./map-style";
import type { StageMap } from "./types";
import { styleUrl, TILES_URL } from "./vendor";

const READY_TIMEOUT = 15_000;
const PADDING = 48;
const PICKABLE = [PIN_LAYER, CITY_DOT, CITY_GLOW];

let protocol: Protocol | null = null;

export interface CityMapOptions {
  container: HTMLElement;
  locale: Locale;
  dir: "ltr" | "rtl";
  /** The canvas's accessible name. */
  label: string;
  onPick: (href: string, kind: "place" | "business") => void;
  /** The person zoomed well out of a street-level view: go up a level. */
  onZoomOut: () => void;
}

/** MapLibre with the Darb style over PMTiles, the live places by density and a kind's businesses. */
export class CityMap implements StageMap {
  private dots: readonly CityDot[] = [];
  private pins: readonly StagePin[] = [];
  private target = 0;

  private constructor(
    private readonly map: MapLibreMap,
    private readonly dir: "ltr" | "rtl",
  ) {}

  static async create(options: CityMapOptions): Promise<CityMap> {
    const maplibre = await loadMapLibre();
    if (!protocol) {
      protocol = new Protocol();
      maplibre.addProtocol("pmtiles", protocol.tile);
    }
    const res = await fetch(styleUrl(options.locale));
    if (!res.ok) throw new Error(`Map style: ${res.status}`);
    const style = prepareStyle((await res.json()) as StyleSpecification, {
      origin: window.location.origin,
      tilesUrl: TILES_URL,
    });
    style.sources[CITY_SOURCE] = { type: "geojson", data: cityCollection([]) };
    style.sources[PIN_SOURCE] = { type: "geojson", data: pinCollection([], null) };
    style.layers.push(...darbLayers());
    // Throws GPUInitializationError when the device will not give a WebGL2 context.
    const map = new maplibre.Map({
      container: options.container,
      style,
      bounds: "bounds" in ISRAEL_NORTH ? ISRAEL_NORTH.bounds : undefined,
      fitBoundsOptions: { padding: PADDING },
      // Attribution is the stage's own always-visible line (no 24 px toggle under 44 px).
      attributionControl: false,
      // Pointer-only: keyboard users have the list (spec §8).
      keyboard: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
    });
    const city = new CityMap(map, options.dir);
    try {
      await city.ready();
    } catch (error) {
      map.remove();
      throw error;
    }
    city.wire(options);
    return city;
  }

  /** The first idle frame; fails if the tiles cannot be read (a 404 archive, a bad URL). */
  private ready(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: unknown) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        this.map.off("error", onError);
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
      this.map.on("error", onError);
      this.map.once("idle", () => finish());
    });
  }

  private wire(options: CityMapOptions): void {
    const canvas = this.map.getCanvas();
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", options.label);
    canvas.setAttribute("tabindex", "-1");
    this.map.on("click", (event) => {
      const [top] = this.map.queryRenderedFeatures(event.point, { layers: PICKABLE });
      const href = top?.properties?.href;
      if (top && typeof href === "string")
        options.onPick(href, top.layer.id === PIN_LAYER ? "business" : "place");
    });
    this.map.on("mousemove", (event) => {
      const over = this.map.queryRenderedFeatures(event.point, { layers: PICKABLE }).length > 0;
      canvas.style.cursor = over ? "pointer" : "";
    });
    this.map.on("zoomend", (event) => {
      if (event.originalEvent && zoomedOut(this.target, this.map.getZoom())) options.onZoomOut();
    });
  }

  move(camera: Camera, duration: number, insetEnd: number): Promise<void> {
    const start = this.dir === "rtl" ? insetEnd : 0;
    const end = this.dir === "rtl" ? 0 : insetEnd;
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        this.map.off("moveend", done);
        this.target = this.map.getZoom();
        resolve();
      };
      const timer = window.setTimeout(done, duration + 250);
      this.map.on("moveend", done);
      if ("bounds" in camera) {
        // fitBounds adds the map's own padding to its own: reset it first.
        this.map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
        this.map.fitBounds(camera.bounds, {
          padding: { top: PADDING, bottom: PADDING, left: PADDING + start, right: PADDING + end },
          maxZoom: camera.maxZoom,
          duration,
          easing: easeOut,
          essential: true,
        });
        return;
      }
      const padding = { top: 0, bottom: 0, left: start, right: end };
      if (duration > 0)
        this.map.flyTo({
          center: camera.center,
          zoom: camera.zoom,
          padding,
          duration,
          easing: easeOut,
          essential: true,
        });
      else this.map.jumpTo({ center: camera.center, zoom: camera.zoom, padding });
    });
  }

  setDots(dots: readonly CityDot[]): void {
    this.dots = dots;
    this.map.getSource<GeoJSONSource>(CITY_SOURCE)?.setData(cityCollection(dots));
  }

  setPins(pins: readonly StagePin[], activeHref: string | null): void {
    this.pins = pins;
    this.map.getSource<GeoJSONSource>(PIN_SOURCE)?.setData(pinCollection(pins, activeHref));
  }

  pointOf(id: string): [number, number] | null {
    const at = this.dots.find((d) => d.slug === id) ?? this.pins.find((p) => p.key === id);
    if (!at) return null;
    const point = this.map.project([at.lng, at.lat]);
    const box = this.map.getCanvas().getBoundingClientRect();
    return [box.left + point.x, box.top + point.y];
  }

  center(): [number, number] {
    const { lng, lat } = this.map.getCenter();
    return [lng, lat];
  }

  destroy(): void {
    this.map.remove();
  }
}
