import type { LatLng } from "@darb/core";

/** A house number OpenStreetMap knows on the street, with its point. */
export interface KnownNumber {
  n: number;
  suffix: string;
  point: LatLng;
}

/** Metres between two points (haversine; plenty for a street). */
export function metres(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The known point of exactly this number (and letter, when one was typed). */
export function exactNumber(known: KnownNumber[], n: number, suffix = ""): KnownNumber | null {
  return (
    known.find((k) => k.n === n && k.suffix === suffix) ??
    (suffix ? null : (known.find((k) => k.n === n && k.suffix === "") ?? null))
  );
}

/**
 * Between two known numbers. Two known numbers this far apart are too loose to place a door
 * between them; nor are numbers this many apart.
 */
export const BETWEEN_MAX_M = 400;
export const BETWEEN_MAX_SPAN = 40;

export interface Between {
  point: LatLng;
  lo: KnownNumber;
  hi: KnownNumber;
}

/**
 * The point for `n` placed between the nearest lower and higher known numbers on the same side
 * of the street (the same parity: Israeli streets put odd numbers on one side, even on the
 * other), in proportion to the numbers. Null when either side is missing, or the two are too far
 * apart (BETWEEN_MAX_M, BETWEEN_MAX_SPAN).
 */
export function interpolate(
  known: KnownNumber[],
  n: number,
  limits = { maxMetres: BETWEEN_MAX_M, maxSpan: BETWEEN_MAX_SPAN },
): Between | null {
  const side = known.filter((k) => k.n % 2 === n % 2);
  const below = side.filter((k) => k.n < n);
  const above = side.filter((k) => k.n > n);
  if (!below.length || !above.length) return null;
  const loN = Math.max(...below.map((k) => k.n));
  const hiN = Math.min(...above.map((k) => k.n));
  if (hiN - loN > limits.maxSpan) return null;
  // A number mapped more than once (two entrances): the closest pair.
  let best: { lo: KnownNumber; hi: KnownNumber; d: number } | null = null;
  for (const lo of below.filter((k) => k.n === loN))
    for (const hi of above.filter((k) => k.n === hiN)) {
      const d = metres(lo.point, hi.point);
      if (!best || d < best.d) best = { lo, hi, d };
    }
  if (!best || best.d > limits.maxMetres) return null;
  const f = (n - loN) / (hiN - loN);
  const { lo, hi } = best;
  return {
    point: {
      lat: round6(lo.point.lat + (hi.point.lat - lo.point.lat) * f),
      lng: round6(lo.point.lng + (hi.point.lng - lo.point.lng) * f),
    },
    lo,
    hi,
  };
}

/** The known number nearest a point, within `within` metres. */
export function nearestNumber(known: KnownNumber[], p: LatLng, within = 150): KnownNumber | null {
  let best: { k: KnownNumber; d: number } | null = null;
  for (const k of known) {
    const d = metres(k.point, p);
    if (d <= within && (!best || d < best.d)) best = { k, d };
  }
  return best?.k ?? null;
}

export const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
export const numberText = (k: KnownNumber) => `${k.n}${k.suffix}`;
