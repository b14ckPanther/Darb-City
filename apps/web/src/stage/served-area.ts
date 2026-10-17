import type {
  FilterSpecification,
  LayerSpecification,
  LngLatBoundsLike,
  StyleSpecification,
} from "maplibre-gl";
import { mapColors } from "@darb/tokens";
import { PROTOMAPS_SOURCE } from "./map-style";

/** Written by scripts/copy-map.mjs (scripts/map/served-area.mjs): the land Darb serves. */
export const SERVED_URL = "/map/served-area.json";
export const VEIL_SOURCE = "darb-veil";
export const SERVED_SOURCE = "darb-served";
export const VEIL = "darb-veil";
export const VEIL_EDGE = "darb-veil-edge";
export const WATER_ABOVE = "darb-water-above";
/** A town label is Darb's when one of its places is this close (OSM and the seed share points). */
export const TOWN_LABEL_M = 800;
/** Basemap town names: shown only for Darb's own towns. */
const TOWN_LABELS = new Set(["places_locality"]);

type Ring = [number, number][];
export interface ServedArea {
  type: "Feature";
  bbox: [number, number, number, number];
  properties: Record<string, never>;
  geometry: { type: "MultiPolygon"; coordinates: Ring[][] };
  /** Darb's places themselves. */
  places: { type: "MultiPoint"; coordinates: [number, number][] };
}

let loading: Promise<ServedArea | null> | null = null;

/** The served outline, fetched once per page; null (no veil, the map still works) on a failure. */
export function loadServedArea(): Promise<ServedArea | null> {
  loading ??= fetch(SERVED_URL)
    .then((res) => (res.ok ? (res.json() as Promise<unknown>) : null))
    .catch(() => null)
    .then((body) => {
      const area = isServedArea(body) ? body : null;
      if (!area) loading = null;
      return area;
    });
  return loading;
}

function isServedArea(body: unknown): body is ServedArea {
  const area = body as Partial<ServedArea> | null;
  return (
    area?.geometry?.type === "MultiPolygon" &&
    area.places?.type === "MultiPoint" &&
    Array.isArray(area.bbox) &&
    area.bbox.length === 4
  );
}

/** The whole world with the served land cut out of it: outer ring counter-clockwise, holes clockwise. */
export function veilPolygon(area: ServedArea): { type: "Polygon"; coordinates: Ring[] } {
  const world: Ring = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ];
  const holes = area.geometry.coordinates.map((polygon) => [...polygon[0]!].reverse());
  return { type: "Polygon", coordinates: [world, ...holes] };
}

/** The served bbox grown by margin degrees, for maxBounds. */
export function servedBounds(area: ServedArea, margin: number): LngLatBoundsLike {
  const [west, south, east, north] = area.bbox;
  return [
    [west - margin, south - margin],
    [east + margin, north + margin],
  ];
}

const getter = (key: unknown) => (key === "$type" ? ["geometry-type"] : ["get", key]);

/**
 * A legacy filter (["in", "kind", "a", "b"]) as an expression, so it can be combined with
 * ["within", …]: MapLibre treats a filter as legacy or expression as a whole. Null when a filter
 * uses something we do not translate; that layer is then left as it was.
 */
export function toExpression(filter: unknown): unknown {
  if (filter === undefined) return true;
  if (!Array.isArray(filter) || typeof filter[0] !== "string") return null;
  const [op, ...args] = filter as [string, ...unknown[]];
  // Already an expression: ["==", ["get", "kind"], "x"].
  if (Array.isArray(args[0])) return op === "all" || op === "any" ? fromList(op, args) : filter;
  switch (op) {
    case "all":
    case "any":
      return fromList(op, args);
    case "none": {
      const any = fromList("any", args);
      return any && ["!", any];
    }
    case "has":
      return ["has", args[0]];
    case "!has":
      return ["!", ["has", args[0]]];
    case "==":
    case "!=":
    case "<":
    case "<=":
    case ">":
    case ">=":
      return [op, getter(args[0]), args[1]];
    case "in":
    case "!in": {
      const values = [...new Set(args.slice(1))];
      if (values.length === 0) return op === "!in";
      const match = ["match", getter(args[0]), values, true, false];
      return op === "in" ? match : ["!", match];
    }
    default:
      return null;
  }
}

function fromList(op: "all" | "any", args: unknown[]): unknown {
  const parts = args.map(toExpression);
  return parts.includes(null) ? null : [op, ...parts];
}

/**
 * The Darb style with only the served land alive. Outside it the land stays land and the sea stays
 * sea, but nothing made by people is drawn: a plain land mask covers roads, buildings and land use
 * (over them, under the labels), the water is drawn again above it so the whole sea keeps its
 * colour, and basemap labels outside are hidden. A style without an area is returned as it was.
 */
export function withServedArea(
  style: StyleSpecification,
  area: ServedArea | null,
): StyleSpecification {
  if (!area) return style;
  const layers = style.layers.map((layer) => {
    if (layer.type !== "symbol" || layer.source !== PROTOMAPS_SOURCE) return layer;
    const filter = toExpression(layer.filter);
    if (filter === null) return layer;
    const where = TOWN_LABELS.has(layer.id)
      ? ["<", ["distance", area.places], TOWN_LABEL_M]
      : ["within", area.geometry];
    return { ...layer, filter: ["all", filter, where] as unknown as FilterSpecification };
  });
  const earth = style.layers.find((l) => l.id === "earth");
  const land =
    (earth?.type === "fill" && typeof earth.paint?.["fill-color"] === "string"
      ? earth.paint["fill-color"]
      : null) ?? mapColors.land;
  const water = style.layers.find((l) => l.id === "water");
  const above = water?.type === "fill" ? [{ ...water, id: WATER_ABOVE } as LayerSpecification] : [];
  const firstLabel = layers.findIndex((l) => l.type === "symbol");
  layers.splice(firstLabel < 0 ? layers.length : firstLabel, 0, ...veilLayers(land), ...above);
  return {
    ...style,
    sources: {
      ...style.sources,
      [VEIL_SOURCE]: {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: veilPolygon(area) },
      },
      [SERVED_SOURCE]: {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: area.geometry },
      },
    },
    layers,
  };
}

/** Pixel widths by zoom: the fade is wide over the whole country and narrow at street level. */
const width = (z5: number, z9: number, z14: number) =>
  ["interpolate", ["linear"], ["zoom"], 5, z5, 9, z9, 14, z14] as never;

export function veilLayers(land: string): LayerSpecification[] {
  return [
    {
      // Plain land outside: no roads, no buildings, no towns.
      id: VEIL,
      type: "fill",
      source: VEIL_SOURCE,
      paint: { "fill-color": land, "fill-opacity": 1, "fill-antialias": false },
    },
    {
      // The same land drawn across the edge, so roads fade out instead of stopping at a line.
      id: VEIL_EDGE,
      type: "line",
      source: SERVED_SOURCE,
      paint: {
        "line-color": land,
        "line-opacity": 0.9,
        "line-width": width(10, 18, 34),
        "line-blur": width(10, 18, 34),
      },
    },
  ];
}
