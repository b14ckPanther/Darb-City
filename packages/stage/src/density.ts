import type { CityDot, StagePin, StagePlace } from "./types.js";

export interface PointFeature<P> {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: P;
}
export interface FeatureCollection<P> {
  type: "FeatureCollection";
  features: PointFeature<P>[];
}

const point = <P>(lng: number, lat: number, properties: P): PointFeature<P> => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lng, lat] },
  properties,
});

const collection = <P>(features: PointFeature<P>[]): FeatureCollection<P> => ({
  type: "FeatureCollection",
  features,
});

/**
 * The country map's faint warmth where businesses are: one point per live place, weighted 0–1 by
 * the log of its count, so a city of thousands never drowns its villages. Never a number; empty
 * places are left out.
 */
export function heatCollection(dots: readonly CityDot[]): FeatureCollection<{ weight: number }> {
  const live = dots.filter((d) => d.count > 0);
  const top = Math.log1p(Math.max(0, ...live.map((d) => d.count)));
  return collection(
    live.map((d) =>
      point(d.lng, d.lat, {
        weight: top > 0 ? Math.round((Math.log1p(d.count) / top) * 100) / 100 : 0,
      }),
    ),
  );
}

/** The place a level is about, gently marked on its map: a halo, a dot and its one name. */
export function hereCollection(place: StagePlace | null): FeatureCollection<{ name: string }> {
  return collection(place && place.slug ? [point(place.lng, place.lat, { name: place.name })] : []);
}

export interface PinProperties {
  key: string;
  name: string;
  href: string;
  /** The pin's place on the list (1, 2, 3…); 0 for a preview, whose pins carry no number. */
  n: number;
}

/** Businesses on the map, numbered in list order when the list is beside them. */
export function pinCollection(
  pins: readonly StagePin[],
  options: { numbered: boolean } = { numbered: true },
): FeatureCollection<PinProperties> {
  return collection(
    pins.map((p, i) =>
      point(p.lng, p.lat, {
        key: p.key,
        name: p.name,
        href: p.href,
        n: options.numbered ? i + 1 : 0,
      }),
    ),
  );
}
