import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { ISRAEL_BOX, type LatLng, type Locale } from "@darb/core";
import { ISRAEL_NORTH } from "@darb/stage";
import { loadMapLibre } from "./load-maplibre";
import { fetchDarbStyle, whenReady } from "./map-boot";
import { ensurePmtiles } from "./protocol";

/** Street level over the pin; a little wider over a place with no pin yet. */
export const PIN_ZOOM = 16;
export const NEAR_ZOOM = 13;
/** Arrow keys move the pin this many screen pixels (Shift: five times as far). */
export const NUDGE_PX = 10;
/** A little past the box, so a pin can sit right on its edge and still be seen. */
const PAN_MARGIN = 0.3;

export interface PickerMapOptions {
  container: HTMLElement;
  locale: Locale;
  /** The canvas's accessible name. */
  label: string;
  /** The pin's accessible name, and the id of the text that reads out where it is. */
  pinLabel: string;
  pinDescribedBy: string;
  /** The pin's look (a class from the caller's CSS module). */
  pinClass: string;
  /** MapLibre's own hints, e.g. "Use two fingers to move the map". */
  gestures: { windows: string; mac: string; mobile: string };
  pin: LatLng | null;
  /** Where to open when there is no pin yet. */
  near: LatLng | null;
  /** A click on the map, a drag of the pin or an arrow key: the caller decides whether it stays. */
  onMove: (p: LatLng) => void;
}

const lngLat = (p: LatLng): [number, number] => [p.lng, p.lat];
const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

/** A Darb map with one draggable pin, for choosing where a business is. */
export class PickerMap {
  private constructor(
    private readonly map: MapLibreMap,
    private readonly marker: Marker,
    private placed: boolean,
  ) {}

  static async create(options: PickerMapOptions): Promise<PickerMap> {
    const maplibre = await loadMapLibre();
    ensurePmtiles(maplibre);
    const style = await fetchDarbStyle(options.locale);
    const start = options.pin ?? options.near;
    // Throws when the device will not give a WebGL2 context: the caller shows the numbers instead.
    const map = new maplibre.Map({
      container: options.container,
      style,
      ...(start
        ? { center: lngLat(start), zoom: options.pin ? PIN_ZOOM : NEAR_ZOOM }
        : {
            bounds: "bounds" in ISRAEL_NORTH ? ISRAEL_NORTH.bounds : undefined,
            fitBoundsOptions: { padding: 24 },
          }),
      maxBounds: [
        [ISRAEL_BOX.lng[0] - PAN_MARGIN, ISRAEL_BOX.lat[0] - PAN_MARGIN],
        [ISRAEL_BOX.lng[1] + PAN_MARGIN, ISRAEL_BOX.lat[1] + PAN_MARGIN],
      ],
      // Two fingers (or Ctrl + scroll) move the map, so one finger still scrolls the form.
      cooperativeGestures: true,
      locale: {
        "CooperativeGesturesHandler.WindowsHelpText": options.gestures.windows,
        "CooperativeGesturesHandler.MacHelpText": options.gestures.mac,
        "CooperativeGesturesHandler.MobileHelpText": options.gestures.mobile,
      },
      // The picker shows its own always-visible attribution line (no 24 px toggle under 44 px).
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
    });
    const element = document.createElement("button");
    element.type = "button";
    element.className = options.pinClass;
    element.setAttribute("aria-label", options.pinLabel);
    element.setAttribute("aria-describedby", options.pinDescribedBy);
    element.setAttribute("data-location-pin", "");
    const marker = new maplibre.Marker({ element, anchor: "bottom", draggable: true });
    const picker = new PickerMap(map, marker, false);
    try {
      await whenReady(map);
    } catch (error) {
      map.remove();
      throw error;
    }
    picker.wire(options, element);
    picker.setPin(options.pin);
    return picker;
  }

  private wire(options: PickerMapOptions, element: HTMLElement): void {
    const canvas = this.map.getCanvas();
    canvas.setAttribute("aria-label", options.label);
    this.map.on("click", (event) => {
      options.onMove({ lat: event.lngLat.lat, lng: event.lngLat.lng });
    });
    this.marker.on("dragend", () => {
      const { lat, lng } = this.marker.getLngLat();
      options.onMove({ lat, lng });
    });
    // A custom pin's keys are ours (MapLibre moves only its default marker by keyboard).
    element.addEventListener("keydown", (event) => {
      const step = ARROWS[event.key];
      if (!step) return;
      event.preventDefault();
      const px = NUDGE_PX * (event.shiftKey ? 5 : 1);
      const at = this.map.project(this.marker.getLngLat());
      const { lat, lng } = this.map.unproject([at.x + step[0] * px, at.y + step[1] * px]);
      options.onMove({ lat, lng });
    });
  }

  /** Shows the pin at p, or hides it until the first click. */
  setPin(p: LatLng | null): void {
    if (!p) {
      if (this.placed) this.marker.remove();
      this.placed = false;
      return;
    }
    this.marker.setLngLat(lngLat(p));
    if (!this.placed) this.marker.addTo(this.map);
    this.placed = true;
  }

  centreOn(p: LatLng, zoom = Math.max(this.map.getZoom(), NEAR_ZOOM)): void {
    this.map.easeTo({ center: lngLat(p), zoom, duration: 550 });
  }

  destroy(): void {
    this.map.remove();
  }
}
