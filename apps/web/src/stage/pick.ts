import { CITY_DOT, CITY_GLOW, CITY_LABEL, PIN_LAYER } from "./map-layers";

/** A tap or click covers a 44 × 44 px target (WCAG 2.5.5), even where a dot is 5 px wide. */
export const HIT_BOX = 44;
/** Topmost first: pins, then place names, dots and glows. */
export const PICKABLE = [PIN_LAYER, CITY_LABEL, CITY_DOT, CITY_GLOW];

type ScreenPoint = { x: number; y: number };
type Pixel = [number, number];
type ScreenBox = [Pixel, Pixel];

/** The part of a MapLibre map that picking uses (a fake in tests). */
export interface PickableMap {
  queryRenderedFeatures(
    geometry: Pixel | ScreenBox,
    options: { layers: string[] },
  ): {
    layer: { id: string };
    properties: Record<string, unknown> | null;
    geometry: { type: string; coordinates?: unknown };
  }[];
  project(lngLat: [number, number]): ScreenPoint;
}

export interface Picked {
  href: string;
  kind: "place" | "business";
}

const isPosition = (value: unknown): value is [number, number] =>
  Array.isArray(value) && typeof value[0] === "number" && typeof value[1] === "number";

/**
 * What a tap at `point` means: of the pins, names, dots and glows within the 44 px box around it,
 * the one whose point is nearest. A place name right under the tap counts as distance 0, because
 * a name sits beside its dot and is tapped where it is written.
 */
export function pickAt(map: PickableMap, point: ScreenPoint): Picked | null {
  const half = HIT_BOX / 2;
  const box: ScreenBox = [
    [point.x - half, point.y - half],
    [point.x + half, point.y + half],
  ];
  const near = map.queryRenderedFeatures(box, { layers: PICKABLE });
  if (near.length === 0) return null;
  const named = new Set(
    map
      .queryRenderedFeatures([point.x, point.y], { layers: [CITY_LABEL] })
      .map((f) => f.properties?.href)
      .filter((href) => typeof href === "string"),
  );
  let best: (Picked & { distance: number }) | null = null;
  for (const feature of near) {
    const href = feature.properties?.href;
    const at = feature.geometry.coordinates;
    if (typeof href !== "string" || feature.geometry.type !== "Point" || !isPosition(at)) continue;
    const onName = feature.layer.id === CITY_LABEL && named.has(href);
    const { x, y } = map.project(at);
    const distance = onName ? 0 : Math.hypot(x - point.x, y - point.y);
    // Strictly nearer only: on a tie the topmost layer (a pin over a dot) wins.
    if (!best || distance < best.distance)
      best = { href, kind: feature.layer.id === PIN_LAYER ? "business" : "place", distance };
  }
  return best && { href: best.href, kind: best.kind };
}
