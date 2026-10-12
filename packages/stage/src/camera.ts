import type { Camera, CityDot, LngLat, StageLevel, StageView, Transition } from "./types.js";

/** Camera moves and crossfades (ms): --dur and --dur-fast in apps/web/src/app/globals.css. */
export const MOTION = { move: 550, fade: 400 } as const;

/** Northern and Haifa districts, the launch region, before the live places load. */
export const ISRAEL_NORTH: Camera = {
  bounds: [
    [34.85, 32.35],
    [35.9, 33.35],
  ],
  maxZoom: 9,
};
export const PLACE_ZOOM = 13.5;
export const STREET_ZOOM = 14;

const ZOOM_IN = 1.08;
const ZOOM_OUT = 0.94;

export function viewFor(level: StageLevel): StageView {
  return (level.depth === 1 || level.depth === 2) && level.doors.length > 0 ? "plaza" : "map";
}

export function sceneKey(level: StageLevel): string {
  if (level.depth === 1) return `place:${level.place.slug}`;
  if (level.depth === 2) return `sector:${level.place.slug}/${level.sector.slug}`;
  return `map:${level.depth}`;
}

function boundsOf(points: readonly LngLat[], maxZoom: number, pad = 0.02): Camera | null {
  if (points.length === 0) return null;
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return {
    bounds: [
      [Math.min(...lngs) - pad, Math.min(...lats) - pad],
      [Math.max(...lngs) + pad, Math.max(...lats) + pad],
    ],
    maxZoom,
  };
}

export function cameraFor(level: StageLevel, dots: readonly CityDot[] = []): Camera {
  if (level.depth === 0)
    return (
      boundsOf(
        dots.map((d) => [d.lng, d.lat]),
        9,
        0.08,
      ) ?? ISRAEL_NORTH
    );
  const center: LngLat = [level.place.lng, level.place.lat];
  if (level.depth === 3) {
    if (level.pins.length > 1)
      return boundsOf(
        level.pins.map((p) => [p.lng, p.lat]),
        15,
      )!;
    return { center, zoom: STREET_ZOOM };
  }
  return { center, zoom: PLACE_ZOOM };
}

/** The same level: same depth, place and sector, and at street level the same pins. */
export function sameLevel(a: StageLevel, b: StageLevel): boolean {
  if (a.depth === 0 || b.depth === 0) return a.depth === b.depth;
  if (a.depth !== b.depth || a.place.slug !== b.place.slug) return false;
  if (a.depth === 2 && b.depth === 2) return a.sector.slug === b.sector.slug;
  if (a.depth === 3 && b.depth === 3)
    return a.pins.length === b.pins.length && a.pins.every((pin, i) => pin.key === b.pins[i]?.key);
  return true;
}

/**
 * How the stage moves from one level to the next (spec §3.5): the camera flies for 550 ms on the
 * Darb ease-out while the layers crossfade, or, with reduced motion, jumps under a 400 ms fade on
 * every level change.
 */
export function planTransition(
  from: StageLevel | null,
  to: StageLevel,
  dots: readonly CityDot[],
  options: { reducedMotion: boolean },
): Transition {
  const view = viewFor(to);
  const camera = cameraFor(to, dots);
  const reduced = options.reducedMotion;
  const fadeMs = reduced ? MOTION.fade : MOTION.move;
  if (from === null)
    return {
      view,
      camera,
      motion: "jump",
      duration: 0,
      fade: { kind: "cross", duration: fadeMs, outScale: 1, inScale: 1 },
      direction: "none",
    };
  const direction = to.depth > from.depth ? "in" : to.depth < from.depth ? "out" : "none";
  const motion = reduced ? "jump" : "fly";
  const out = reduced ? 1 : direction === "in" ? ZOOM_IN : direction === "out" ? ZOOM_OUT : 1;
  const into = reduced ? 1 : direction === "in" ? ZOOM_OUT : direction === "out" ? ZOOM_IN : 1;
  const fromView = viewFor(from);
  let fade: Transition["fade"] = null;
  if (fromView !== view) fade = { kind: "cross", duration: fadeMs, outScale: out, inScale: into };
  else if (view === "plaza" && sceneKey(from) !== sceneKey(to))
    fade = { kind: "through", duration: fadeMs, outScale: out, inScale: into };
  // Reduced motion: the camera jumps, so every level change (map to map too) fades through.
  else if (reduced && !sameLevel(from, to))
    fade = { kind: "through", duration: fadeMs, outScale: 1, inScale: 1 };
  return { view, camera, motion, duration: motion === "fly" ? MOTION.move : 0, fade, direction };
}
