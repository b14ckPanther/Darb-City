import type {
  CameraForBoundsOptions,
  FitBoundsOptions,
  FlyToOptions,
  JumpToOptions,
  LngLatBoundsLike,
  PaddingOptions,
} from "maplibre-gl";
import { easeOut, type Camera } from "@darb/stage";

/** The part of MapLibre's Map a camera move uses (a fake in tests). */
export interface MovableMap {
  setPadding(padding: PaddingOptions): unknown;
  jumpTo(options: JumpToOptions): unknown;
  fitBounds(bounds: LngLatBoundsLike, options: FitBoundsOptions): unknown;
  flyTo(options: FlyToOptions): unknown;
  cameraForBounds(
    bounds: LngLatBoundsLike,
    options: CameraForBoundsOptions,
  ): { zoom?: number } | undefined;
  on(type: "moveend", listener: () => void): unknown;
  off(type: "moveend", listener: () => void): unknown;
}

/** Px of the map covered at its top (the site header) and at each side (the desktop sheet). */
export interface Inset {
  top: number;
  left: number;
  right: number;
}

/** Around a fitted area, inside the inset. */
export const FIT_PADDING = 48;
/** A move that never reports its end still settles this long after its duration. */
const GRACE = 250;

/**
 * Starts a camera move and reports where it ends. MapLibre fires `moveend` synchronously from
 * `setPadding`/`jumpTo` and from the `stop()` that a new flight makes of the running one, so only a
 * `moveend` after this move started counts; a jump arrives at once. `target` is the destination zoom.
 */
export function moveCamera(
  map: MovableMap,
  camera: Camera,
  duration: number,
  inset: Inset,
): { target: number; arrived: Promise<void> } {
  let target: number;
  let start: () => void;
  if ("bounds" in camera) {
    // fitBounds adds the map's own padding to its own: reset it first (a jump, with its moveend).
    map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    const padding = {
      top: FIT_PADDING + inset.top,
      bottom: FIT_PADDING,
      left: FIT_PADDING + inset.left,
      right: FIT_PADDING + inset.right,
    };
    target =
      map.cameraForBounds(camera.bounds, { padding, maxZoom: camera.maxZoom })?.zoom ??
      camera.maxZoom;
    start = () =>
      map.fitBounds(camera.bounds, {
        padding,
        maxZoom: camera.maxZoom,
        duration,
        easing: easeOut,
        essential: true,
      });
  } else {
    target = camera.zoom;
    const padding = { top: inset.top, bottom: 0, left: inset.left, right: inset.right };
    start = () =>
      duration > 0
        ? map.flyTo({
            center: camera.center,
            zoom: camera.zoom,
            padding,
            duration,
            easing: easeOut,
            essential: true,
          })
        : map.jumpTo({ center: camera.center, zoom: camera.zoom, padding });
  }

  if (duration <= 0) {
    start();
    return { target, arrived: Promise.resolve() };
  }
  const arrived = new Promise<void>((resolve) => {
    let armed = false;
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      map.off("moveend", onEnd);
      resolve();
    };
    const onEnd = () => {
      if (armed) done();
    };
    const timer = setTimeout(done, duration + GRACE);
    map.on("moveend", onEnd);
    start();
    armed = true;
  });
  return { target, arrived };
}
