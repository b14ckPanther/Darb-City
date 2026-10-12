import type { CityDot, StagePin } from "./types.js";

export interface PointFeature<P> {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: P;
}
export interface FeatureCollection<P> {
  type: "FeatureCollection";
  features: PointFeature<P>[];
}

/** Glow radius in px at zoom 7: none for an empty place, 6–24 px by the square root of density. */
export function glowRadius(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.round((6 + 18 * Math.sqrt(Math.min(count, max) / max)) * 10) / 10;
}

const point = <P>(lng: number, lat: number, properties: P): PointFeature<P> => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lng, lat] },
  properties,
});

export function cityCollection(dots: readonly CityDot[]) {
  const max = Math.max(0, ...dots.map((d) => d.count));
  return {
    type: "FeatureCollection" as const,
    features: dots.map((d) =>
      point(d.lng, d.lat, {
        slug: d.slug,
        name: d.name,
        href: d.href,
        count: d.count,
        glow: glowRadius(d.count, max),
      }),
    ),
  };
}

export function pinCollection(pins: readonly StagePin[], activeHref: string | null) {
  return {
    type: "FeatureCollection" as const,
    features: pins.map((p) =>
      point(p.lng, p.lat, {
        key: p.key,
        name: p.name,
        href: p.href,
        active: p.href === activeHref,
      }),
    ),
  };
}
