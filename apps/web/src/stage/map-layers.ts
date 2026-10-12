import type { LayerSpecification } from "maplibre-gl";
import { colors } from "@darb/tokens";

export const CITY_SOURCE = "darb-city";
export const PIN_SOURCE = "darb-pins";
export const CITY_GLOW = "darb-city-glow";
export const CITY_DOT = "darb-city-dot";
export const CITY_LABEL = "darb-city-label";
export const PIN_LAYER = "darb-pin";
/** The one self-hosted glyph font (scripts/map/style.mjs MAP_FONT). */
export const MAP_FONT = "noto-sans-regular";

/** Darb's own layers over the basemap: live places glowing by density, then business pins. */
export function darbLayers(): LayerSpecification[] {
  return [
    {
      id: CITY_GLOW,
      type: "circle",
      source: CITY_SOURCE,
      filter: [">", ["get", "glow"], 0],
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          7,
          ["get", "glow"],
          12,
          ["*", ["get", "glow"], 2.5],
        ],
        "circle-color": colors.gold,
        "circle-opacity": 0.32,
        "circle-blur": 0.9,
      },
    },
    {
      id: CITY_DOT,
      type: "circle",
      source: CITY_SOURCE,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 2.5, 9, 3.5, 12, 6],
        "circle-color": colors.gold300,
        "circle-stroke-color": colors.night,
        "circle-stroke-width": 1.5,
      },
    },
    {
      id: CITY_LABEL,
      type: "symbol",
      source: CITY_SOURCE,
      minzoom: 7,
      layout: {
        "text-field": ["get", "name"],
        "text-font": [MAP_FONT],
        "text-size": ["interpolate", ["linear"], ["zoom"], 7, 11, 10, 13, 13, 14],
        // Beside its dot where there is room, never over a neighbour's name.
        "text-variable-anchor": ["top", "bottom", "left", "right"],
        "text-radial-offset": 0.7,
        "text-padding": 4,
        "symbol-sort-key": ["-", 0, ["get", "count"]],
      },
      paint: {
        "text-color": colors.ivory,
        "text-halo-color": colors.night,
        "text-halo-width": 1.4,
      },
    },
    {
      id: PIN_LAYER,
      type: "circle",
      source: PIN_SOURCE,
      paint: {
        "circle-radius": ["case", ["get", "active"], 11, 8],
        "circle-color": colors.gold,
        "circle-stroke-color": colors.ivory,
        "circle-stroke-width": ["case", ["get", "active"], 3, 2],
      },
    },
  ];
}
