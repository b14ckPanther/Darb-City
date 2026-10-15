import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import type { Locale } from "@darb/core";
import {
  cityCollection,
  ISRAEL_NORTH,
  pinCollection,
  zoomedOut,
  type Camera,
  type CityDot,
  type StagePin,
} from "@darb/stage";
import { moveCamera } from "./camera-move";
import { loadMapLibre } from "./load-maplibre";
import { CITY_GLOW, CITY_SOURCE, darbLayers, PIN_SOURCE } from "./map-layers";
import { prepareStyle, PROTOMAPS_SOURCE } from "./map-style";
import { pickAt } from "./pick";
import type { StageMap } from "./types";
import { styleUrl, TILES_URL } from "./vendor";

const READY_TIMEOUT = 15_000;
const PADDING = 48;

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
      tilesUrl: TILES_URL ?? "",
    });
    // Places within ~60 px merge into one bubble whose count is the sum of their businesses.
    style.sources[CITY_SOURCE] = {
      type: "geojson",
      data: cityCollection([]),
      cluster: true,
      clusterRadius: 72,
      clusterMaxZoom: 11,
      clusterProperties: { count: ["+", ["get", "count"]] },
    };
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
    // A forgiving 44 px target around each tap: the dots are 5–12 px (pick.ts).
    this.map.on("click", (event) => {
      // A bubble opens: zoom in on it until it splits into its places.
      const bubble = this.map.queryRenderedFeatures(event.point, { layers: [CITY_GLOW] })[0];
      if (bubble?.geometry.type === "Point") {
        const [lng, lat] = bubble.geometry.coordinates as [number, number];
        this.map.easeTo({ center: [lng, lat], zoom: this.map.getZoom() + 2, duration: 550 });
        return;
      }
      const picked = pickAt(this.map, event.point);
      if (picked) options.onPick(picked.href, picked.kind);
    });
    this.map.on("mousemove", (event) => {
      const bubble = this.map.queryRenderedFeatures(event.point, { layers: [CITY_GLOW] }).length;
      canvas.style.cursor = bubble || pickAt(this.map, event.point) ? "pointer" : "";
    });
    this.map.on("zoomend", (event) => {
      if (event.originalEvent && zoomedOut(this.target, this.map.getZoom())) options.onZoomOut();
    });
  }

  move(camera: Camera, duration: number, insetEnd: number): Promise<void> {
    const side = this.dir === "rtl" ? { left: insetEnd, right: 0 } : { left: 0, right: insetEnd };
    // The translucent site header over the desktop stage (StageMount.module.css --stage-top).
    const style = getComputedStyle(this.map.getContainer());
    const top = Number.parseFloat(style.getPropertyValue("--stage-top")) || 0;
    const { target, arrived } = moveCamera(this.map, camera, duration, { top, ...side });
    this.target = target;
    return arrived;
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
