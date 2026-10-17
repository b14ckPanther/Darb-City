import type { LayerSpecification } from "maplibre-gl";
import { colors, mapColors } from "@darb/tokens";

export const CITY_SOURCE = "darb-city";
export const PIN_SOURCE = "darb-pins";
export const CITY_GLOW = "darb-city-glow";
export const CITY_DOT = "darb-city-dot";
export const CITY_LABEL = "darb-city-label";
export const CLUSTER_COUNT = "darb-cluster-count";
export const PIN_LAYER = "darb-pin";
/** The one self-hosted glyph font (scripts/map/style.mjs MAP_FONT). */
export const MAP_FONT = "noto-sans-regular";

/** Clustered points carry point_count; single places do not. */
const CLUSTER = ["has", "point_count"];
/** A bubble of places that all have no businesses yet says nothing worth drawing. */
const BUBBLE = ["all", CLUSTER, [">", ["get", "count"], 0]];
const SINGLE = ["all", ["!", CLUSTER], [">", ["get", "count"], 0]];

/**
 * Darb's own layers over the basemap. Nearby places merge into one bubble that says how many
 * businesses are there (tap it to zoom in); as you zoom, bubbles split into single places, each a
 * small point sized by its count with its name beside it. Empty places are never drawn. Pins on top.
 */
export function darbLayers(): LayerSpecification[] {
  return [
    {
      id: CITY_GLOW,
      type: "circle",
      source: CITY_SOURCE,
      filter: BUBBLE as never,
      paint: {
        // Logarithmic, so a city of thousands never swallows its neighbours.
        "circle-radius": ["+", 12, ["*", 3.2, ["ln", ["+", 1, ["get", "count"]]]]],
        // Forest on the sunlit land, ringed in gold.
        "circle-color": mapColors.bubble,
        "circle-opacity": 0.95,
        "circle-stroke-color": colors.gold,
        "circle-stroke-width": 2,
      },
    },
    {
      id: CLUSTER_COUNT,
      type: "symbol",
      source: CITY_SOURCE,
      filter: BUBBLE as never,
      layout: {
        "text-field": ["to-string", ["get", "count"]],
        "text-font": [MAP_FONT],
        "text-size": 13,
        "text-allow-overlap": true,
      },
      paint: { "text-color": colors.ivory },
    },
    {
      id: CITY_DOT,
      type: "circle",
      source: CITY_SOURCE,
      filter: SINGLE as never,
      paint: {
        "circle-radius": ["+", 4, ["*", 1.4, ["ln", ["+", 1, ["get", "count"]]]]],
        "circle-color": colors.gold,
        "circle-stroke-color": mapColors.bubble,
        "circle-stroke-width": 2,
      },
    },
    {
      id: CITY_LABEL,
      type: "symbol",
      source: CITY_SOURCE,
      filter: SINGLE as never,
      layout: {
        "text-field": ["get", "name"],
        "text-font": [MAP_FONT],
        "text-size": ["interpolate", ["linear"], ["zoom"], 8, 12, 13, 14],
        // Beside its point where there is room, never over a neighbour's name.
        "text-variable-anchor": ["top", "bottom", "left", "right"],
        "text-radial-offset": 0.9,
        "text-padding": 6,
        "symbol-sort-key": ["-", 0, ["get", "count"]],
      },
      paint: {
        "text-color": mapColors.label,
        "text-halo-color": mapColors.halo,
        "text-halo-width": 1.6,
      },
    },
    {
      id: PIN_LAYER,
      type: "circle",
      source: PIN_SOURCE,
      paint: {
        "circle-radius": ["case", ["get", "active"], 11, 8],
        "circle-color": colors.gold,
        "circle-stroke-color": mapColors.bubble,
        "circle-stroke-width": ["case", ["get", "active"], 3, 2],
      },
    },
  ];
}
