import { CLUSTER_PIN, HOT_PIN, PIN_LAYER } from "./map-layers";

/** A tap or click covers a 44 × 44 px target (WCAG 2.5.5), even where a pin is 13 px wide. */
export const HIT_BOX = 44;
/** Topmost first: the lifted pin, then pins, then merged pins. */
export const PICKABLE = [HOT_PIN, PIN_LAYER, CLUSTER_PIN];

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

export type Picked =
  | { type: "pin"; key: string; href: string }
  /** A "+N" pin: zoom in on it until it splits. */
  | { type: "cluster"; id: number; at: [number, number] };

const isPosition = (value: unknown): value is [number, number] =>
  Array.isArray(value) && typeof value[0] === "number" && typeof value[1] === "number";

function picked(id: string, props: Record<string, unknown>, at: [number, number]): Picked | null {
  if (id === CLUSTER_PIN)
    return typeof props.cluster_id === "number"
      ? { type: "cluster", id: props.cluster_id, at }
      : null;
  const { key, href } = props;
  return typeof key === "string" && typeof href === "string" ? { type: "pin", key, href } : null;
}

/**
 * What a tap at `point` means: of the pins within the 44 px box around it, the one whose point is
 * nearest. On a tie the topmost layer wins (the lifted pin over the pin it lifts).
 */
export function pickAt(map: PickableMap, point: ScreenPoint): Picked | null {
  const half = HIT_BOX / 2;
  const box: ScreenBox = [
    [point.x - half, point.y - half],
    [point.x + half, point.y + half],
  ];
  let best: { pick: Picked; distance: number } | null = null;
  for (const feature of map.queryRenderedFeatures(box, { layers: PICKABLE })) {
    const at = feature.geometry.coordinates;
    if (feature.geometry.type !== "Point" || !isPosition(at)) continue;
    const pick = picked(feature.layer.id, feature.properties ?? {}, at);
    if (!pick) continue;
    const { x, y } = map.project(at);
    const distance = Math.hypot(x - point.x, y - point.y);
    if (!best || distance < best.distance) best = { pick, distance };
  }
  return best?.pick ?? null;
}
