import { inIsrael, type LatLng } from "@darb/core";

/** Six decimals is about 10 cm: finer than a pin can be placed, and short enough to read. */
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
export const rounded = (p: LatLng): LatLng => ({ lat: round6(p.lat), lng: round6(p.lng) });
export const formatCoord = (n: number) => n.toFixed(6);

export type Placed = { ok: true; point: LatLng } | { ok: false; reason: "outside" | "incomplete" };

/** A point from the map or the numbers, rounded, and only if it lies inside Israel. */
export function place(p: LatLng): Placed {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng))
    return { ok: false, reason: "incomplete" };
  const point = rounded(p);
  return inIsrael(point) ? { ok: true, point } : { ok: false, reason: "outside" };
}

/** The two typed numbers; an empty or half-typed one is incomplete, not zero. */
export function placeTyped(lat: string, lng: string): Placed {
  const read = (s: string) => (s.trim() === "" ? Number.NaN : Number(s));
  return place({ lat: read(lat), lng: read(lng) });
}
