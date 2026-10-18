import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { Locale } from "@darb/core";
import {
  heatCollection,
  hereCollection,
  ISRAEL_NORTH,
  pinCollection,
  zoomedOut,
  type Camera,
  type CityDot,
  type StagePin,
  type StagePlace,
} from "@darb/stage";
import { moveCamera, type Inset } from "./camera-move";
import { loadMapLibre } from "./load-maplibre";
import {
  CLUSTER_MAX_ZOOM,
  darbLayers,
  darbSources,
  HEAT_SOURCE,
  HERE_SOURCE,
  HOT_SOURCE,
  PIN_SOURCE,
} from "./map-layers";
import { fetchDarbStyle, whenReady } from "./map-boot";
import { pickAt } from "./pick";
import { ensurePmtiles } from "./protocol";
import { loadServedArea, servedBounds } from "./served-area";
import type { StageMap } from "./types";

const PADDING = 48;
/** Wide enough that the whole country still fits a wide screen; far enough to stop a pan to Europe. */
const PAN_MARGIN = 3;
/** A "+N" pin opens onto its businesses: the camera's zoom into it. */
const CLUSTER_ZOOM_MS = 450;

export interface CityMapOptions {
  container: HTMLElement;
  locale: Locale;
  dir: "ltr" | "rtl";
  /** The canvas's accessible name. */
  label: string;
  /** A business pin was tapped or clicked. */
  onPick: (pin: { key: string; href: string }) => void;
  /** The pointer is over a business pin (its key), or left every pin (null). */
  onHover: (key: string | null) => void;
  /** The person zoomed well out of a street-level view: go up a level. */
  onZoomOut: () => void;
  /** Reduced motion: a "+N" pin jumps in instead of easing. */
  reducedMotion: () => boolean;
}

/**
 * MapLibre with the Darb style over PMTiles. It draws only what it is asked: the country's faint
 * warmth, the place in view, and the businesses someone is looking at (numbered like the list, or
 * a previewed category), with one lifted pin on top.
 */
export class CityMap implements StageMap {
  private dots: readonly CityDot[] = [];
  private pins: readonly StagePin[] = [];
  private hot: StagePin | null = null;
  private target = 0;
  private hovered: string | null = null;

  private constructor(
    private readonly map: MapLibreMap,
    private readonly dir: "ltr" | "rtl",
  ) {}

  static async create(options: CityMapOptions): Promise<CityMap> {
    const maplibre = await loadMapLibre();
    ensurePmtiles(maplibre);
    const style = await fetchDarbStyle(options.locale);
    // Cached by fetchDarbStyle: no second request.
    const served = await loadServedArea();
    Object.assign(style.sources, darbSources());
    style.layers.push(...darbLayers());
    // Throws GPUInitializationError when the device will not give a WebGL2 context.
    const map = new maplibre.Map({
      container: options.container,
      style,
      bounds: "bounds" in ISRAEL_NORTH ? ISRAEL_NORTH.bounds : undefined,
      fitBoundsOptions: { padding: PADDING },
      ...(served ? { maxBounds: servedBounds(served, PAN_MARGIN) } : {}),
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
      await whenReady(map);
      // The style is loaded now, so its sources take data.
      city.warmUp();
      await whenReady(map);
    } catch (error) {
      map.remove();
      throw error;
    }
    city.coolDown();
    city.wire(options);
    return city;
  }

  private wire(options: CityMapOptions): void {
    const canvas = this.map.getCanvas();
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", options.label);
    canvas.setAttribute("tabindex", "-1");
    // A forgiving 44 px target around each tap (pick.ts).
    this.map.on("click", (event) => {
      const picked = pickAt(this.map, event.point);
      if (!picked) return;
      if (picked.type === "pin") return options.onPick(picked);
      // A "+N" pin: zoom in until it splits into its businesses.
      void this.map
        .getSource<GeoJSONSource>(PIN_SOURCE)
        ?.getClusterExpansionZoom(picked.id)
        .then((zoom) => {
          const to = { center: picked.at, zoom: Math.min(zoom + 0.25, CLUSTER_MAX_ZOOM + 1) };
          if (options.reducedMotion()) this.map.jumpTo(to);
          else this.map.easeTo({ ...to, duration: CLUSTER_ZOOM_MS });
        })
        .catch(() => {});
    });
    this.map.on("mousemove", (event) => {
      const picked = pickAt(this.map, event.point);
      canvas.style.cursor = picked ? "pointer" : "";
      const key = picked?.type === "pin" ? picked.key : null;
      if (key === this.hovered) return;
      this.hovered = key;
      options.onHover(key);
    });
    this.map.getCanvasContainer().addEventListener("mouseleave", () => {
      if (this.hovered === null) return;
      this.hovered = null;
      options.onHover(null);
    });
    this.map.on("zoomend", (event) => {
      if (event.originalEvent && zoomedOut(this.target, this.map.getZoom())) options.onZoomOut();
    });
  }

  /**
   * Draws every Darb layer once while the stage is still hidden, so WebGL compiles their programs
   * now and not in the middle of the first flight into a place (a 100+ ms long task otherwise).
   */
  private warmUp(): void {
    const { lng, lat } = this.map.getCenter();
    const at = (dx: number): StagePin => ({
      key: `warm-${dx}`,
      href: "",
      name: " ",
      lat,
      lng: lng + dx,
    });
    this.setHere({ slug: "warm", name: " ", lat, lng });
    // Two at one spot merge into a "+N" pin; the third stands alone with its number.
    this.setPins([at(0), at(0), at(0.4)], true);
    this.setHot(at(-0.4), 1);
  }

  private coolDown(): void {
    this.setHere(null);
    this.setPins([], false);
    this.setHot(null, 0);
  }

  move(camera: Camera, duration: number, insetEnd: number, insetBottom = 0): Promise<void> {
    const side = this.dir === "rtl" ? { left: insetEnd, right: 0 } : { left: 0, right: insetEnd };
    // The translucent site header over the desktop stage, or the phone map's header.
    const inset: Inset = { top: this.focusTop(), bottom: insetBottom, ...side };
    const { target, arrived } = moveCamera(this.map, camera, duration, inset);
    this.target = target;
    return arrived;
  }

  /**
   * Keeps a chosen pin in sight above a phone's card (`bottom` px): the camera eases only when the
   * pin is hidden or crowding an edge, and never changes the zoom.
   */
  reveal(pin: StagePin, bottom: number, reduced: boolean): void {
    const { x, y } = this.map.project([pin.lng, pin.lat]);
    const { width, height } = this.map.getCanvas().getBoundingClientRect();
    const top = this.focusTop();
    const margin = 32;
    const inside =
      x > margin && x < width - margin && y > top + margin && y < height - bottom - margin;
    if (inside) return;
    const to = {
      center: [pin.lng, pin.lat] as [number, number],
      padding: { top, bottom, left: 0, right: 0 },
    };
    if (reduced) this.map.jumpTo(to);
    else this.map.easeTo({ ...to, duration: CLUSTER_ZOOM_MS });
  }

  /** Px over the map's top: the desktop's site header, or the phone map's header. */
  private focusTop(): number {
    const style = getComputedStyle(this.map.getContainer());
    const read = (name: string) => Number.parseFloat(style.getPropertyValue(name)) || 0;
    return read("--stage-top") + read("--stage-focus");
  }

  setHeat(dots: readonly CityDot[]): void {
    this.dots = dots;
    this.map.getSource<GeoJSONSource>(HEAT_SOURCE)?.setData(heatCollection(dots));
  }

  setHere(place: StagePlace | null): void {
    this.map.getSource<GeoJSONSource>(HERE_SOURCE)?.setData(hereCollection(place));
  }

  setPins(pins: readonly StagePin[], numbered: boolean): void {
    this.pins = pins;
    this.map.getSource<GeoJSONSource>(PIN_SOURCE)?.setData(pinCollection(pins, { numbered }));
  }

  setHot(pin: StagePin | null, n: number): void {
    this.hot = pin;
    const data = pinCollection(pin ? [pin] : [], { numbered: n > 0 });
    // The lifted pin keeps its number from the list (pinCollection numbers from 1).
    for (const feature of data.features) feature.properties.n = n;
    this.map.getSource<GeoJSONSource>(HOT_SOURCE)?.setData(data);
  }

  pointOf(id: string): [number, number] | null {
    const at =
      this.pins.find((p) => p.key === id) ??
      (this.hot?.key === id ? this.hot : undefined) ??
      this.dots.find((d) => d.slug === id);
    if (!at) return null;
    const point = this.map.project([at.lng, at.lat]);
    const box = this.map.getCanvas().getBoundingClientRect();
    return [box.left + point.x, box.top + point.y];
  }

  pinKeys(): string[] {
    return this.pins.map((p) => p.key);
  }

  center(): [number, number] {
    const { lng, lat } = this.map.getCenter();
    return [lng, lat];
  }

  destroy(): void {
    this.map.remove();
  }
}
