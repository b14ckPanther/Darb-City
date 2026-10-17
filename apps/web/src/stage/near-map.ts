import type { LngLatBoundsLike, Map as MapLibreMap, Marker } from "maplibre-gl";
import { ISRAEL_BOX, type LatLng, type Locale } from "@darb/core";
import { loadMapLibre, type MapLibre } from "./load-maplibre";
import { fetchDarbStyle, whenReady } from "./map-boot";
import { ensurePmtiles } from "./protocol";

/** Street level around the visitor before any business is placed. */
const HERE_ZOOM = 15;
/** Never closer than this when fitting the visitor and the nearest businesses. */
const FIT_MAX_ZOOM = 16;
/** The visitor plus this many of the closest businesses decide the first view. */
export const FIT_COUNT = 10;
const PAN_MARGIN = 0.3;
/** MapLibre's world is 512 px wide at zoom 0. */
const EARTH_PX_M = 40_075_016.686 / 512;

export interface NearPin {
  key: string;
  name: string;
  href: string;
  lat: number;
  lng: number;
}

export interface NearMapOptions {
  container: HTMLElement;
  locale: Locale;
  /** The canvas's accessible name. */
  label: string;
  /** The "you are here" marker's accessible name. */
  hereLabel: string;
  /** Looks from the caller's CSS module. */
  classes: { here: string; hereDot: string; hereRing: string; pin: string };
  here: LatLng & { accuracy?: number };
  /** A pin was tapped: the caller navigates (client-side) to the business. */
  onOpen: (href: string) => void;
}

const lngLat = (p: LatLng): [number, number] => [p.lng, p.lat];

/** Metres to screen pixels at a latitude and zoom. */
export function metresToPx(metres: number, lat: number, zoom: number): number {
  return metres / ((EARTH_PX_M * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom);
}

/** The visitor and the first FIT_COUNT pins, as [[west, south], [east, north]]. */
export function fitBounds(here: LatLng, pins: readonly LatLng[]): [[number, number], [number, number]] {
  const points = [here, ...pins.slice(0, FIT_COUNT)];
  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

/** A small Darb map for /near: the visitor as a pulsing gold dot, each business as a gold pin. */
export class NearMap {
  private pins = new Map<string, Marker>();
  private here: LatLng & { accuracy?: number };

  private constructor(
    private readonly maplibre: MapLibre,
    private readonly map: MapLibreMap,
    private readonly hereMarker: Marker,
    private readonly ring: HTMLElement,
    private readonly options: NearMapOptions,
  ) {
    this.here = options.here;
  }

  static async create(options: NearMapOptions): Promise<NearMap> {
    const maplibre = await loadMapLibre();
    ensurePmtiles(maplibre);
    const style = await fetchDarbStyle(options.locale);
    // Throws when the device will not give a WebGL2 context: the caller keeps the list alone.
    const map = new maplibre.Map({
      container: options.container,
      style,
      center: lngLat(options.here),
      zoom: HERE_ZOOM,
      maxBounds: [
        [ISRAEL_BOX.lng[0] - PAN_MARGIN, ISRAEL_BOX.lat[0] - PAN_MARGIN],
        [ISRAEL_BOX.lng[1] + PAN_MARGIN, ISRAEL_BOX.lat[1] + PAN_MARGIN],
      ],
      // The page shows its own always-visible attribution line (no 24 px toggle under 44 px).
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
    });
    const element = document.createElement("div");
    element.className = options.classes.here;
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", options.hereLabel);
    element.setAttribute("data-near-here", "");
    const ring = document.createElement("span");
    ring.className = options.classes.hereRing;
    ring.setAttribute("aria-hidden", "true");
    const dot = document.createElement("span");
    dot.className = options.classes.hereDot;
    dot.setAttribute("aria-hidden", "true");
    element.append(ring, dot);
    const hereMarker = new maplibre.Marker({ element, anchor: "center" })
      .setLngLat(lngLat(options.here))
      .addTo(map);
    const near = new NearMap(maplibre, map, hereMarker, ring, options);
    try {
      await whenReady(map);
    } catch (error) {
      map.remove();
      throw error;
    }
    map.getCanvas().setAttribute("aria-label", options.label);
    map.on("zoom", () => near.sizeRing());
    near.sizeRing();
    return near;
  }

  /** The accuracy ring, in metres on the ground, at the current zoom. */
  private sizeRing(): void {
    const accuracy = this.here.accuracy;
    if (!accuracy) {
      this.ring.hidden = true;
      return;
    }
    const px = 2 * metresToPx(accuracy, this.here.lat, this.map.getZoom());
    this.ring.hidden = px < 24;
    this.ring.style.setProperty("--ring", `${Math.min(px, 600).toFixed(1)}px`);
  }

  setHere(here: LatLng & { accuracy?: number }): void {
    this.here = here;
    this.hereMarker.setLngLat(lngLat(here));
    this.sizeRing();
  }

  /** One pin per business, in list order; pins no longer listed are removed. */
  setPins(pins: readonly NearPin[]): void {
    const keep = new Set(pins.map((p) => p.key));
    for (const [key, marker] of this.pins) {
      if (keep.has(key)) continue;
      marker.remove();
      this.pins.delete(key);
    }
    for (const pin of pins) {
      const existing = this.pins.get(pin.key);
      if (existing) {
        existing.setLngLat(lngLat(pin));
        continue;
      }
      const element = document.createElement("a");
      element.href = pin.href;
      element.className = this.options.classes.pin;
      element.setAttribute("aria-label", pin.name);
      // The list beside the map holds the same links for keyboards and screen readers.
      element.tabIndex = -1;
      element.setAttribute("aria-hidden", "true");
      element.setAttribute("data-near-pin", pin.key);
      element.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        this.options.onOpen(pin.href);
      });
      const marker = new this.maplibre.Marker({ element, anchor: "center" })
        .setLngLat(lngLat(pin))
        .addTo(this.map);
      this.pins.set(pin.key, marker);
    }
  }

  /** The visitor and the closest businesses in view. */
  fit(pins: readonly LatLng[], animate: boolean): void {
    if (pins.length === 0) {
      this.map.easeTo({ center: lngLat(this.here), zoom: HERE_ZOOM, duration: animate ? 550 : 0 });
      return;
    }
    this.map.fitBounds(fitBounds(this.here, pins) as LngLatBoundsLike, {
      padding: 48,
      maxZoom: FIT_MAX_ZOOM,
      duration: animate ? 550 : 0,
    });
  }

  /** The map's container changed size (the layout moved between phone and desktop). */
  resize(): void {
    this.map.resize();
  }

  destroy(): void {
    for (const marker of this.pins.values()) marker.remove();
    this.pins.clear();
    this.map.remove();
  }
}
